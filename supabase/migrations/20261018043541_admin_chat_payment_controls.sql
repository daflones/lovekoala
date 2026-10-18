begin;
-- Keep a separate, durable provenance for approval and preserve manual history after provider confirmation.
alter table public.lk_orders add column approval_source text check(approval_source in ('provider','manual'));
alter table public.lk_orders add column manual_approved_at timestamptz;
alter table public.lk_orders add column manual_approved_by uuid references auth.users(id);
alter table public.lk_orders add column manual_approval_reason text;
alter table public.lk_orders add column provider_verified_at timestamptz;
alter table public.lk_orders add constraint lk_manual_approval_complete check(approval_source is distinct from 'manual' or (manual_approved_at is not null and manual_approved_by is not null and length(btrim(manual_approval_reason)) between 10 and 1000));
update public.lk_orders set approval_source='provider',provider_verified_at=paid_at where status in ('paid','refunded');
alter table public.lk_billing_receipts add column approval_source text not null default 'provider' check(approval_source in ('provider','manual'));

create or replace function public.lk_set_koala_chat(p_admin uuid,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.lk_site_settings;before_enabled boolean;
begin
 if not exists(select 1 from public.lk_admins where user_id=p_admin) or exists(select 1 from public.lk_profiles where id=p_admin and disabled) then raise exception 'ADMIN_REQUIRED';end if;
 if p_enabled is null then raise exception 'SETTINGS_INVALID';end if;
 select * into s from public.lk_site_settings where id='public' for update;
 before_enabled:=coalesce((s.data#>>'{features,koala_chat}')::boolean,true);
 if before_enabled is distinct from p_enabled then
  update public.lk_site_settings set data=jsonb_set(data,'{features}',coalesce(data->'features','{}'::jsonb)||jsonb_build_object('koala_chat',p_enabled)),revision=revision+1,updated_at=now(),updated_by=p_admin where id='public' returning * into s;
  insert into public.lk_admin_audit(admin_id,action,target,details) values(p_admin,'koala_chat_toggled','public',jsonb_build_object('before',before_enabled,'enabled',p_enabled));
 end if;
 return jsonb_build_object('chat_enabled',p_enabled,'revision',s.revision);
end;$$;

create or replace function public.lk_admin_approve_order(p_admin uuid,p_order uuid,p_reason text,p_amount integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.lk_orders;g public.lk_gifts;s public.lk_subscriptions;changed boolean;
begin
 if not exists(select 1 from public.lk_admins where user_id=p_admin) or exists(select 1 from public.lk_profiles where id=p_admin and disabled) then raise exception 'ADMIN_REQUIRED';end if;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then raise exception 'APPROVAL_INVALID';end if;
 select * into o from public.lk_orders where id=p_order for update;
 if not found or p_amount is distinct from o.amount_cents then raise exception 'APPROVAL_CONFLICT';end if;
 if o.status='paid' then return jsonb_build_object('ok',true,'already_approved',true,'order_id',o.id,'approval_source',o.approval_source);end if;
 if o.status not in ('created','pending','uncertain','failed') or o.provider_id is null then raise exception 'APPROVAL_INVALID';end if;
 select * into g from public.lk_gifts where id=o.gift_id for update;
 if not found or g.deleted_at is not null or g.suspended or g.status='refunded' then raise exception 'APPROVAL_INVALID';end if;
 if exists(select 1 from public.lk_orders where gift_id=g.id and id<>o.id and ((status='paid' and o.purpose='initial') or status in ('created','pending','uncertain'))) then raise exception 'APPROVAL_CONFLICT';end if;
 select * into s from public.lk_subscriptions where gift_id=g.id for update;
 if o.purpose='renewal' and (s.id is null or s.auto_renew and s.status<>'canceled' or s.period_end>now()+interval '7 days') then raise exception 'APPROVAL_INVALID';end if;
 changed:=public.lk_confirm_order(o.id,o.provider,o.provider_id,o.amount_cents,o.currency,o.provider_payment_intent);
 if changed then
  update public.lk_orders set approval_source='manual',provider_verified_at=null,manual_approved_at=now(),manual_approved_by=p_admin,manual_approval_reason=btrim(p_reason) where id=o.id;
  update public.lk_billing_receipts set approval_source='manual' where provider=o.provider and provider_invoice_id=o.provider_id;
  insert into public.lk_admin_audit(admin_id,action,target,details) values(p_admin,'payment_manually_approved',o.id::text,jsonb_build_object('gift_id',o.gift_id,'amount_cents',o.amount_cents,'provider',o.provider,'plan_id',o.plan_id,'previous_status',o.status,'reason',btrim(p_reason)));
 end if;
 return jsonb_build_object('ok',true,'already_approved',not changed,'order_id',o.id,'gift_id',o.gift_id,'approval_source','manual');
end;$$;

-- Called only after a server-side provider read validates the order, reference, amount and currency.
create or replace function public.lk_verify_manual_order(p_order uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare o public.lk_orders;
begin
 select * into o from public.lk_orders where id=p_order for update;
 if not found or o.status<>'paid' or o.approval_source<>'manual' then return false;end if;
 update public.lk_orders set approval_source='provider',provider_verified_at=now() where id=o.id;
 update public.lk_billing_receipts set approval_source='provider' where provider=o.provider and provider_invoice_id=o.provider_id;
 insert into public.lk_admin_audit(action,target,details) values('payment_provider_verified',o.id::text,jsonb_build_object('previous_approval','manual','provider',o.provider));
 return true;
end;$$;

create or replace function public.lk_financial_ledger() returns table(payment_id text,paid_at timestamptz,amount_cents integer,plan_id text,provider text,approval_source text)
language sql stable security definer set search_path='' as $$
 select o.id::text,o.paid_at,o.amount_cents,o.plan_id,o.provider,coalesce(o.approval_source,'provider') from public.lk_orders o where o.status='paid'
 union all
 select r.id::text,r.paid_at,r.amount_cents,s.plan_id,r.provider,r.approval_source from public.lk_billing_receipts r join public.lk_subscriptions s on s.id=r.subscription_id where not r.initial_cycle and not exists(select 1 from public.lk_orders o where o.provider=r.provider and o.provider_id=r.provider_invoice_id);
$$;

create or replace function public.lk_confirm_order(p_order uuid,p_provider text,p_provider_id text,p_amount integer,p_currency text,p_intent text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare o public.lk_orders;p public.lk_plans;g public.lk_gifts;s public.lk_subscriptions;until_date timestamptz;access_until timestamptz;period_from timestamptz;
begin
 select * into o from public.lk_orders where id=p_order for update;
 if not found or o.provider<>p_provider or o.provider_id is distinct from p_provider_id or o.amount_cents<>p_amount or upper(p_currency)<>'BRL' then raise exception 'PAYMENT_MISMATCH';end if;
 if o.status='paid' then return false;end if;if o.status='refunded' then raise exception 'ORDER_REFUNDED';end if;
 select * into p from public.lk_plans where id=o.plan_id;
 select * into g from public.lk_gifts where id=o.gift_id for update;
 if g.deleted_at is not null then raise exception 'GIFT_DELETED';end if;
 select * into s from public.lk_subscriptions where gift_id=g.id for update;
 period_from:=case when o.access_kind='club' and o.purpose='renewal' then greatest(coalesce(s.period_end,now()),now()) else now() end;
 until_date:=case when o.access_kind='club' then period_from+interval '1 month' when o.billing_cycle='monthly' then greatest(coalesce(g.expires_at,now()),now())+interval '1 month' else now()+make_interval(days=>coalesce(o.access_days_snapshot,p.access_days)) end;
 access_until:=case when o.access_kind in ('lifetime','club') then 'infinity'::timestamptz when o.access_kind='24h' then now()+interval '24 hours' else until_date end;
 update public.lk_orders set status='paid',paid_at=now(),provider_payment_intent=p_intent,approval_source='provider',provider_verified_at=now() where id=o.id;
 update public.lk_gifts set status=case when g.status='published' then 'published' else 'paid' end,plan_id=o.plan_id,paid_at=coalesce(paid_at,now()),expires_at=access_until,access_kind=o.access_kind,edit_expires_at=case when o.access_kind='24h' then access_until else null end,frozen=false,updated_at=now() where id=o.gift_id;
 if o.billing_cycle='monthly' then
  insert into public.lk_subscriptions(gift_id,owner_user_id,plan_id,provider,status,amount_cents,period_start,period_end)
  values(g.id,g.owner_user_id,o.plan_id,o.provider,'active',o.amount_cents,period_from,until_date)
  on conflict(gift_id) do update set status='active',period_start=period_from,period_end=until_date,provider=excluded.provider,updated_at=now() returning * into s;
  update public.lk_orders set subscription_id=s.id where id=o.id;
  insert into public.lk_billing_receipts(subscription_id,provider,provider_invoice_id,amount_cents,period_end) values(s.id,o.provider,o.provider_id,o.amount_cents,until_date) on conflict(provider,provider_invoice_id) do nothing;
  if o.access_kind='club' then perform public.lk_issue_club_period(s.id,period_from,until_date,o.purpose='initial');end if;
 end if;return true;
end;$$;

create or replace function public.lk_apply_stripe_cycle(p_gift uuid,p_subscription text,p_status text,p_start timestamptz,p_end timestamptz,p_amount integer,p_invoice text default null,p_paid boolean default false,p_cancel boolean default false,p_initial boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
declare s public.lk_subscriptions;g public.lk_gifts;new_receipt boolean:=false;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 select * into s from public.lk_subscriptions where gift_id=p_gift for update;
 if not found or g.deleted_at is not null or s.amount_cents<>p_amount or (s.provider_subscription_id is not null and s.provider_subscription_id<>p_subscription) then raise exception 'PAYMENT_MISMATCH';end if;
 if p_end is null or p_end>now()+interval '13 months' or p_start is null or p_end<=p_start then raise exception 'INVALID_PERIOD';end if;
 update public.lk_subscriptions set provider='stripe',provider_subscription_id=p_subscription,auto_renew=(p_status<>'canceled'),cancel_at_period_end=p_cancel,
 status=case when p_status='canceled' then 'canceled' when p_status in ('past_due','unpaid','incomplete_expired','paused') then 'past_due' when p_paid or p_status='active' then 'active' else 'incomplete' end,
 updated_at=now() where id=s.id;
 if p_paid and p_invoice is not null then
  insert into public.lk_billing_receipts(subscription_id,provider,provider_invoice_id,amount_cents,period_end,initial_cycle) values(s.id,'stripe',p_invoice,p_amount,p_end,p_initial) on conflict(provider,provider_invoice_id) do nothing;new_receipt:=found;
  update public.lk_subscriptions set period_start=p_start,period_end=p_end,status=case when p_status='canceled' then 'canceled' else 'active' end where id=s.id and (period_end is null or period_end<=p_end);
  if g.access_kind='club' then
   -- Align the allocation already granted by manual approval, even if payment was days later.
   -- A later first Stripe invoice must not grant a second initial monthly quota.
   if p_initial and exists(select 1 from public.lk_orders where gift_id=g.id and purpose='initial' and manual_approved_at is not null and status='paid') then
    update public.lk_club_periods set period_start=p_start,period_end=p_end where id=(select period_id from public.lk_club_redemptions where gift_id=g.id);
   end if;
   perform public.lk_issue_club_period(s.id,p_start,p_end,p_initial);
  else
   update public.lk_gifts set expires_at=p_end,frozen=(p_end<=now()),updated_at=now() where id=g.id and expires_at<=p_end+interval '2 days';
  end if;
 end if;return new_receipt;
end;$$;

create or replace function public.lk_captain_report(p_year integer,p_month integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;first_day timestamptz;last_day timestamptz;
begin
 if p_year<2020 or p_year>2100 or (p_month is not null and (p_month<1 or p_month>12)) then raise exception 'PERIOD_INVALID';end if;
 first_day:=make_date(p_year,coalesce(p_month,1),1)::timestamp at time zone 'America/Sao_Paulo';
 last_day:=case when p_month is null then (make_date(p_year+1,1,1)::timestamp at time zone 'America/Sao_Paulo') else first_day+interval '1 month' end;
 with months as (select m::date month_start,(m::timestamp at time zone 'America/Sao_Paulo') start_at,((m+interval '1 month')::timestamp at time zone 'America/Sao_Paulo') end_at from generate_series(make_date(p_year,1,1),make_date(p_year,12,1),interval '1 month') m where p_month is null or extract(month from m)=p_month),
 ledger as (select * from public.lk_financial_ledger() where paid_at>=first_day and paid_at<last_day), monthly as (
  select to_char(m.month_start,'YYYY-MM') as "month",
   (select count(*) from public.lk_analytics_events e where e.created_at>=m.start_at and e.created_at<m.end_at and event_type='page_view') views,
   (select count(distinct session_id) from public.lk_analytics_events e where e.created_at>=m.start_at and e.created_at<m.end_at and event_type='page_view') sessions,
   (select count(*) from public.lk_analytics_events e where e.created_at>=m.start_at and e.created_at<m.end_at and event_type='cta_create') create_clicks,
   (select count(distinct session_id) from public.lk_analytics_events e where e.created_at>=m.start_at and e.created_at<m.end_at and event_type='checkout_started') checkout_sessions,
   (select count(*) from public.lk_profiles u where u.created_at>=m.start_at and u.created_at<m.end_at) new_accounts,
   (select count(*) from public.lk_gifts g where g.created_at>=m.start_at and g.created_at<m.end_at and g.deleted_at is null) gifts_created,
   (select count(*) from ledger l where l.paid_at>=m.start_at and l.paid_at<m.end_at) approved_payments,
   (select count(*) from ledger l where l.paid_at>=m.start_at and l.paid_at<m.end_at and l.approval_source='provider') confirmed_payments,
   (select count(*) from ledger l where l.paid_at>=m.start_at and l.paid_at<m.end_at and l.approval_source='manual') manual_payments,
   (select coalesce(sum(l.amount_cents),0) from ledger l where l.paid_at>=m.start_at and l.paid_at<m.end_at and l.approval_source='manual') manual_revenue_cents,
   (select coalesce(sum(l.amount_cents),0) from ledger l where l.paid_at>=m.start_at and l.paid_at<m.end_at and l.approval_source='provider') provider_revenue_cents,
   (select coalesce(sum(l.amount_cents),0) from ledger l where l.paid_at>=m.start_at and l.paid_at<m.end_at) revenue_cents,
   (select coalesce(sum(o.amount_cents),0) from public.lk_orders o where o.status='refunded' and o.paid_at>=m.start_at and o.paid_at<m.end_at) refunded_sales_cents
  from months m
 ) select jsonb_build_object('year',p_year,'month',p_month,'timezone','America/Sao_Paulo','generated_at',now(),
 'months',(select coalesce(jsonb_agg(to_jsonb(t) order by t."month"),'[]') from monthly t),
 'by_plan',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select plan_id,count(*) payments,sum(amount_cents) revenue_cents from ledger group by plan_id order by revenue_cents desc)t),
 'by_provider',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select provider,count(*) payments,sum(amount_cents) revenue_cents from ledger group by provider)t),
 'by_approval_source',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select approval_source,count(*) payments,sum(amount_cents) revenue_cents from ledger group by approval_source)t),
 'sources',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select coalesce(nullif(properties->>'utm_source',''),'direto') source,count(distinct session_id) sessions from public.lk_analytics_events where created_at>=first_day and created_at<last_day and event_type='page_view' group by 1 order by sessions desc limit 20)t),
 'current',(select jsonb_build_object('active_subscriptions',(select count(*) from public.lk_subscriptions where status='active' and period_end>now()),'published_gifts',(select count(*) from public.lk_gifts where status='published' and not suspended and not frozen and deleted_at is null),'storage_bytes',(select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects where bucket_id in ('love-memories','love-art','love-ai-references')))),
 'scope','Receita bruta aprovada: pedidos e renovações sem duplicar a primeira fatura. Valores aprovados manualmente são separados dos confirmados no provedor; aprovação manual não comprova recebimento externo. Não desconta taxas, impostos, custos ou estornos de faturas recorrentes posteriores. Reembolsos de pedidos são associados ao mês da venda. Sessões dependem dos eventos registrados; não representam pessoas identificadas.') into result;
 return result;
end;$$;

create or replace function public.lk_admin_metrics(p_days integer default 30) returns jsonb language plpgsql security definer set search_path='' as $$
declare start_date timestamptz:=now()-make_interval(days=>least(greatest(p_days,1),365));result jsonb;
begin
 select jsonb_build_object(
 'visits',(select count(*) from public.lk_analytics_events where event_type='page_view' and created_at>=start_date),
 'sessions',(select count(distinct session_id) from public.lk_analytics_events where created_at>=start_date),
 'users',(select count(*) from public.lk_profiles),
 'gifts',(select count(*) from public.lk_gifts where deleted_at is null),
 'published',(select count(*) from public.lk_gifts where status='published' and deleted_at is null),
 'frozen',(select count(*) from public.lk_gifts where frozen and deleted_at is null),
 'active_subscriptions',(select count(*) from public.lk_subscriptions where status='active' and period_end>now()),
 'storage_bytes',(select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects where bucket_id in ('love-memories','love-art')),
 'photos',(select count(*) from public.lk_photos),
 'revenue_cents',(select coalesce(sum(amount_cents),0) from public.lk_financial_ledger() where paid_at>=start_date),
 'manual_revenue_cents',(select coalesce(sum(amount_cents),0) from public.lk_financial_ledger() where paid_at>=start_date and approval_source='manual'),
 'provider_revenue_cents',(select coalesce(sum(amount_cents),0) from public.lk_financial_ledger() where paid_at>=start_date and approval_source='provider'),
 'events',(select coalesce(jsonb_agg(x),'[]') from (select event_type,count(*) total,count(distinct session_id) sessions from public.lk_analytics_events where created_at>=start_date group by event_type order by total desc)x),
 'daily',(select coalesce(jsonb_agg(x),'[]') from (select created_at::date day_date,count(*) filter(where event_type='page_view') views,count(distinct session_id) sessions from public.lk_analytics_events where created_at>=start_date group by created_at::date order by day_date)x),
 'sources',(select coalesce(jsonb_agg(x),'[]') from (select coalesce(nullif(properties->>'utm_source',''),'direto') source,count(distinct session_id) sessions from public.lk_analytics_events where event_type='page_view' and created_at>=start_date group by 1 order by 2 desc limit 20)x),
 'formats',(select coalesce(jsonb_agg(x),'[]') from (select format,count(*) total from public.lk_gifts where created_at>=start_date and deleted_at is null group by format)x),
 'plans',(select coalesce(jsonb_agg(x),'[]') from (select plan_id,billing_cycle,count(*) total,sum(amount_cents) revenue_cents from public.lk_orders where status='paid' and paid_at>=start_date group by plan_id,billing_cycle)x)
 ) into result;return result;
end;$$;

revoke execute on function public.lk_set_koala_chat(uuid,boolean),public.lk_admin_approve_order(uuid,uuid,text,integer),public.lk_verify_manual_order(uuid),public.lk_financial_ledger() from public,anon,authenticated;
grant execute on function public.lk_set_koala_chat(uuid,boolean),public.lk_admin_approve_order(uuid,uuid,text,integer),public.lk_verify_manual_order(uuid),public.lk_financial_ledger() to service_role;
commit;
