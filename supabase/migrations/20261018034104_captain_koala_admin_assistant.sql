begin;
create table public.lk_captain_proposals(
 id uuid primary key default gen_random_uuid(),admin_id uuid not null references auth.users(id),
 kind text not null check(kind in ('plan','settings','gift_status','user_status')),target text not null,
 summary text not null,before_data jsonb not null,after_data jsonb not null,
 status text not null default 'pending' check(status in ('pending','applied','canceled')),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',applied_at timestamptz,
 check(pg_column_size(after_data)<100000)
);
alter table public.lk_captain_proposals enable row level security;
revoke all on public.lk_captain_proposals from anon,authenticated;
grant all on public.lk_captain_proposals to service_role;
create index lk_captain_pending on public.lk_captain_proposals(admin_id,created_at desc);

create or replace function public.lk_captain_report(p_year integer,p_month integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;first_day timestamptz;last_day timestamptz;
begin
 if p_year<2020 or p_year>2100 or (p_month is not null and (p_month<1 or p_month>12)) then raise exception 'PERIOD_INVALID';end if;
 first_day:=make_date(p_year,coalesce(p_month,1),1)::timestamp at time zone 'America/Sao_Paulo';
 last_day:=case when p_month is null then (make_date(p_year+1,1,1)::timestamp at time zone 'America/Sao_Paulo') else first_day+interval '1 month' end;
 with months as (select m::date month_start,(m::timestamp at time zone 'America/Sao_Paulo') start_at,((m+interval '1 month')::timestamp at time zone 'America/Sao_Paulo') end_at from generate_series(make_date(p_year,1,1),make_date(p_year,12,1),interval '1 month') m where p_month is null or extract(month from m)=p_month),
 ledger as (
  select o.id::text payment_id,o.paid_at,o.amount_cents,o.plan_id,o.provider from public.lk_orders o where o.status='paid' and o.paid_at>=first_day and o.paid_at<last_day
  union all
  select r.id::text,r.paid_at,r.amount_cents,s.plan_id,r.provider from public.lk_billing_receipts r join public.lk_subscriptions s on s.id=r.subscription_id where r.paid_at>=first_day and r.paid_at<last_day and not r.initial_cycle and not exists(select 1 from public.lk_orders o where o.provider=r.provider and o.provider_id=r.provider_invoice_id)
 ), monthly as (
  select to_char(m.month_start,'YYYY-MM') as "month",
   (select count(*) from public.lk_analytics_events e where e.created_at>=m.start_at and e.created_at<m.end_at and event_type='page_view') views,
   (select count(distinct session_id) from public.lk_analytics_events e where e.created_at>=m.start_at and e.created_at<m.end_at and event_type='page_view') sessions,
   (select count(*) from public.lk_analytics_events e where e.created_at>=m.start_at and e.created_at<m.end_at and event_type='cta_create') create_clicks,
   (select count(distinct session_id) from public.lk_analytics_events e where e.created_at>=m.start_at and e.created_at<m.end_at and event_type='checkout_started') checkout_sessions,
   (select count(*) from public.lk_profiles u where u.created_at>=m.start_at and u.created_at<m.end_at) new_accounts,
   (select count(*) from public.lk_gifts g where g.created_at>=m.start_at and g.created_at<m.end_at and g.deleted_at is null) gifts_created,
   (select count(*) from ledger l where l.paid_at>=m.start_at and l.paid_at<m.end_at) confirmed_payments,
   (select coalesce(sum(l.amount_cents),0) from ledger l where l.paid_at>=m.start_at and l.paid_at<m.end_at) revenue_cents,
   (select coalesce(sum(o.amount_cents),0) from public.lk_orders o where o.status='refunded' and o.paid_at>=m.start_at and o.paid_at<m.end_at) refunded_sales_cents
  from months m
 ) select jsonb_build_object('year',p_year,'month',p_month,'timezone','America/Sao_Paulo','generated_at',now(),
 'months',(select coalesce(jsonb_agg(to_jsonb(t) order by t."month"),'[]') from monthly t),
 'by_plan',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select plan_id,count(*) payments,sum(amount_cents) revenue_cents from ledger group by plan_id order by revenue_cents desc)t),
 'by_provider',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select provider,count(*) payments,sum(amount_cents) revenue_cents from ledger group by provider)t),
 'sources',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select coalesce(nullif(properties->>'utm_source',''),'direto') source,count(distinct session_id) sessions from public.lk_analytics_events where created_at>=first_day and created_at<last_day and event_type='page_view' group by 1 order by sessions desc limit 20)t),
 'current',(select jsonb_build_object('active_subscriptions',(select count(*) from public.lk_subscriptions where status='active' and period_end>now()),'published_gifts',(select count(*) from public.lk_gifts where status='published' and not suspended and not frozen and deleted_at is null),'storage_bytes',(select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects where bucket_id in ('love-memories','love-art','love-ai-references')))),
 'scope','Receita confirmada bruta: pedidos pagos e renovações sem duplicar a primeira fatura. Não desconta taxas, impostos, custos ou estornos de faturas recorrentes posteriores. Reembolsos de pedidos são associados ao mês da venda. Sessões dependem dos eventos registrados; não representam pessoas identificadas.') into result;
 return result;
end;$$;

create or replace function public.lk_apply_captain_change(p_proposal uuid,p_admin uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.lk_captain_proposals;p public.lk_plans;s public.lk_site_settings;v jsonb;current_value jsonb;
begin
 if not exists(select 1 from public.lk_admins where user_id=p_admin) or exists(select 1 from public.lk_profiles where id=p_admin and disabled) then raise exception 'ADMIN_REQUIRED';end if;
 select * into r from public.lk_captain_proposals where id=p_proposal and admin_id=p_admin for update;
 if not found then raise exception 'PROPOSAL_NOT_FOUND';end if;
 if r.status='applied' then return jsonb_build_object('ok',true,'already_applied',true,'id',r.id);end if;
 if r.status<>'pending' or r.expires_at<=now() then raise exception 'PROPOSAL_EXPIRED';end if;
 v:=r.after_data;
 if r.kind='plan' then
  select * into p from public.lk_plans where id=r.target for update;
  if not found or to_jsonb(p) is distinct from r.before_data then raise exception 'PROPOSAL_CONFLICT';end if;
  if (v->>'price_cents')::int not between 1 and 5000000 or (v->>'monthly_price_cents')::int not between 1 and 5000000 or (v->>'max_photos')::int not between 1 and 80 or (v->>'monthly_gifts')::int not between 2 and 20 or length(v->>'name') not between 1 and 60 or jsonb_typeof(v->'formats')<>'array' or jsonb_array_length(v->'formats')=0 or exists(select 1 from jsonb_array_elements_text(v->'formats') f where f not in ('album','retrospectiva','ambos')) then raise exception 'PLAN_INVALID';end if;
  update public.lk_plans set name=v->>'name',description=v->>'description',features=v->'features',price_cents=(v->>'price_cents')::int,monthly_price_cents=(v->>'monthly_price_cents')::int,max_photos=(v->>'max_photos')::int,monthly_gifts=(v->>'monthly_gifts')::int,formats=array(select jsonb_array_elements_text(v->'formats')),active=(v->>'active')::boolean where id=p.id;
 elsif r.kind='settings' then
  select * into s from public.lk_site_settings where id='public' for update;
  if jsonb_build_object('data',s.data,'revision',s.revision) is distinct from r.before_data then raise exception 'PROPOSAL_CONFLICT';end if;
  if jsonb_typeof(v)<>'object' then raise exception 'SETTINGS_INVALID';end if;
  update public.lk_site_settings set data=v,revision=revision+1,updated_at=now(),updated_by=p_admin where id='public';
 elsif r.kind='gift_status' then
  select jsonb_build_object('suspended',suspended) into current_value from public.lk_gifts where id=r.target::uuid and deleted_at is null for update;
  if not found or current_value is distinct from r.before_data or jsonb_typeof(v->'suspended')<>'boolean' then raise exception 'PROPOSAL_CONFLICT';end if;
  update public.lk_gifts set suspended=(v->>'suspended')::boolean,updated_at=now() where id=r.target::uuid;
 elsif r.kind='user_status' then
  if r.target::uuid=p_admin or exists(select 1 from public.lk_admins where user_id=r.target::uuid) then raise exception 'ADMIN_PROTECTED';end if;
  select jsonb_build_object('disabled',disabled) into current_value from public.lk_profiles where id=r.target::uuid for update;
  if not found or current_value is distinct from r.before_data or jsonb_typeof(v->'disabled')<>'boolean' then raise exception 'PROPOSAL_CONFLICT';end if;
  update public.lk_profiles set disabled=(v->>'disabled')::boolean where id=r.target::uuid;
 end if;
 update public.lk_captain_proposals set status='applied',applied_at=now() where id=r.id;
 insert into public.lk_admin_audit(admin_id,action,target,details) values(p_admin,'captain_change_applied',r.target,jsonb_build_object('proposal_id',r.id,'kind',r.kind,'before',r.before_data,'after',r.after_data));
 return jsonb_build_object('ok',true,'id',r.id,'kind',r.kind,'target',r.target);
end;$$;
revoke execute on function public.lk_captain_report(integer,integer),public.lk_apply_captain_change(uuid,uuid) from public,anon,authenticated;
grant execute on function public.lk_captain_report(integer,integer),public.lk_apply_captain_change(uuid,uuid) to service_role;
commit;
