begin;
create table public.lk_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null,display_name text not null default '',disabled boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.lk_admins(user_id uuid primary key references auth.users(id) on delete cascade,created_at timestamptz not null default now());
create or replace function public.lk_new_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.lk_profiles(id,email,display_name) values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'name',''),100)) on conflict(id) do update set email=excluded.email;return new;end;$$;
create trigger lk_auth_profile after insert or update of email on auth.users for each row execute function public.lk_new_profile();
insert into public.lk_profiles(id,email,display_name) select id,coalesce(email,''),left(coalesce(raw_user_meta_data->>'name',''),100) from auth.users on conflict(id) do nothing;
alter table public.lk_gifts add column owner_user_id uuid references auth.users(id) on delete set null;
alter table public.lk_gifts add column suspended boolean not null default false;
alter table public.lk_gifts add column frozen boolean not null default false;
alter table public.lk_gifts add column deleted_at timestamptz;
create index lk_gifts_owner on public.lk_gifts(owner_user_id,created_at desc);
alter table public.lk_plans add column monthly_price_cents integer check(monthly_price_cents>0);
alter table public.lk_plans add column description text not null default '';
alter table public.lk_plans add column features jsonb not null default '[]';
update public.lk_plans set monthly_price_cents=price_cents;
create table public.lk_site_settings(
 id text primary key check(id='public'),data jsonb not null default '{}',revision integer not null default 1,
 updated_at timestamptz not null default now(),updated_by uuid references auth.users(id),check(pg_column_size(data)<200000)
);
insert into public.lk_site_settings(id) values('public');
create table public.lk_analytics_events(
 id uuid primary key,session_id uuid not null,event_type text not null,path text not null default '/',
 properties jsonb not null default '{}',created_at timestamptz not null default now(),check(pg_column_size(properties)<3000)
);
create index lk_events_date on public.lk_analytics_events(created_at desc,event_type);
create index lk_events_session on public.lk_analytics_events(session_id,created_at);
create table public.lk_admin_audit(
 id bigint generated always as identity primary key,admin_id uuid references auth.users(id),action text not null,target text,
 details jsonb not null default '{}',created_at timestamptz not null default now()
);
create table public.lk_subscriptions(
 id uuid primary key default gen_random_uuid(),gift_id uuid not null unique references public.lk_gifts(id),
 owner_user_id uuid references auth.users(id),plan_id text not null references public.lk_plans(id),
 provider text not null check(provider in ('stripe','mercosulpay')),provider_subscription_id text unique,
 auto_renew boolean not null default false,cancel_at_period_end boolean not null default false,
 status text not null default 'incomplete' check(status in ('incomplete','active','past_due','canceled','paused')),
 amount_cents integer not null check(amount_cents>0),period_start timestamptz,period_end timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.lk_billing_receipts(
 id uuid primary key default gen_random_uuid(),subscription_id uuid not null references public.lk_subscriptions(id),
 provider text not null,provider_invoice_id text not null,amount_cents integer not null,currency text not null default 'BRL',
 period_end timestamptz not null,initial_cycle boolean not null default false,paid_at timestamptz not null default now(),unique(provider,provider_invoice_id)
);
alter table public.lk_orders add column billing_cycle text not null default 'once' check(billing_cycle in ('once','monthly'));
alter table public.lk_orders add column purpose text not null default 'initial' check(purpose in ('initial','renewal'));
alter table public.lk_orders add column subscription_id uuid references public.lk_subscriptions(id);
drop index public.lk_one_paid_order;
create unique index lk_one_paid_initial_order on public.lk_orders(gift_id) where status='paid' and purpose='initial';
create or replace function public.lk_prepare_order_v2(p_gift uuid,p_plan text,p_provider text,p_request uuid,p_cycle text default 'once') returns public.lk_orders
language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;p public.lk_plans;o public.lk_orders;s public.lk_subscriptions;amount integer;purpose text:='initial';
begin
 if p_cycle not in ('once','monthly') or p_provider not in ('stripe','mercosulpay') then raise exception 'PLAN_INCOMPATIBLE';end if;
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.deleted_at is not null or g.suspended then raise exception 'GIFT_NOT_FOUND';end if;
 select * into p from public.lk_plans where id=p_plan and active;
 if not found or not(g.format=any(p.formats)) then raise exception 'PLAN_INCOMPATIBLE';end if;
 if (select count(*) from public.lk_photos where gift_id=p_gift)>p.max_photos then raise exception 'PHOTO_LIMIT';end if;
 amount:=case when p_cycle='monthly' then p.monthly_price_cents else p.price_cents end;
 if amount is null or amount<=0 then raise exception 'PLAN_INCOMPATIBLE';end if;
 if g.status<>'draft' then
  select * into s from public.lk_subscriptions where gift_id=g.id for update;
  if not found or p_cycle<>'monthly' or g.status='refunded' or s.plan_id<>p_plan then raise exception 'ALREADY_PAID';end if;
  if s.auto_renew and s.status<>'canceled' then raise exception 'AUTOMATIC_SUBSCRIPTION';end if;
  if s.period_end>now()+interval '7 days' then raise exception 'RENEWAL_NOT_DUE';end if;
  amount:=s.amount_cents;purpose:='renewal';
 end if;
 select * into o from public.lk_orders where request_id=p_request;
 if found then
  if o.gift_id<>p_gift or o.provider<>p_provider or o.plan_id<>p_plan or o.billing_cycle<>p_cycle then raise exception 'REQUEST_CONFLICT';end if;return o;
 end if;
 select * into o from public.lk_orders where gift_id=p_gift and status in ('created','pending','uncertain');
 if found then
  if o.provider<>p_provider or o.plan_id<>p_plan or o.billing_cycle<>p_cycle then raise exception 'ORDER_PENDING';end if;return o;
 end if;
 insert into public.lk_orders(gift_id,request_id,provider,plan_id,amount_cents,billing_cycle,purpose,subscription_id)
 values(p_gift,p_request,p_provider,p_plan,amount,p_cycle,purpose,s.id) returning * into o;
 if g.status='draft' then update public.lk_gifts set plan_id=p_plan,updated_at=now() where id=p_gift;end if;return o;
end;$$;
create or replace function public.lk_prepare_order(p_gift uuid,p_plan text,p_provider text,p_request uuid) returns public.lk_orders
language sql security definer set search_path='' as $$ select public.lk_prepare_order_v2(p_gift,p_plan,p_provider,p_request,'once');$$;
create or replace function public.lk_confirm_order(p_order uuid,p_provider text,p_provider_id text,p_amount integer,p_currency text,p_intent text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare o public.lk_orders;p public.lk_plans;g public.lk_gifts;s public.lk_subscriptions;until_date timestamptz;
begin
 select * into o from public.lk_orders where id=p_order for update;
 if not found or o.provider<>p_provider or o.provider_id is distinct from p_provider_id or o.amount_cents<>p_amount or upper(p_currency)<>'BRL' then raise exception 'PAYMENT_MISMATCH';end if;
 if o.status='paid' then return false;end if;if o.status='refunded' then raise exception 'ORDER_REFUNDED';end if;
 select * into p from public.lk_plans where id=o.plan_id;
 select * into g from public.lk_gifts where id=o.gift_id for update;
 if g.deleted_at is not null then raise exception 'GIFT_DELETED';end if;
 until_date:=case when o.billing_cycle='monthly' then greatest(coalesce(g.expires_at,now()),now())+interval '1 month' else now()+make_interval(days=>p.access_days) end;
 update public.lk_orders set status='paid',paid_at=now(),provider_payment_intent=p_intent where id=o.id;
 update public.lk_gifts set status=case when g.status='published' then 'published' else 'paid' end,plan_id=o.plan_id,paid_at=coalesce(paid_at,now()),expires_at=until_date,frozen=false,updated_at=now() where id=o.gift_id;
 if o.billing_cycle='monthly' then
  insert into public.lk_subscriptions(gift_id,owner_user_id,plan_id,provider,status,amount_cents,period_start,period_end)
  values(g.id,g.owner_user_id,o.plan_id,o.provider,'active',o.amount_cents,now(),until_date)
  on conflict(gift_id) do update set status='active',period_start=now(),period_end=until_date,provider=excluded.provider,updated_at=now() returning * into s;
  update public.lk_orders set subscription_id=s.id where id=o.id;
  insert into public.lk_billing_receipts(subscription_id,provider,provider_invoice_id,amount_cents,period_end) values(s.id,o.provider,o.provider_id,o.amount_cents,until_date) on conflict(provider,provider_invoice_id) do nothing;
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
 update public.lk_subscriptions set provider='stripe',provider_subscription_id=p_subscription,auto_renew=true,cancel_at_period_end=p_cancel,
 status=case when p_status='canceled' then 'canceled' when p_status in ('past_due','unpaid','incomplete_expired','paused') then 'past_due' when p_paid or p_status='active' then 'active' else 'incomplete' end,
 updated_at=now() where id=s.id;
 if p_paid and p_invoice is not null then
  insert into public.lk_billing_receipts(subscription_id,provider,provider_invoice_id,amount_cents,period_end,initial_cycle) values(s.id,'stripe',p_invoice,p_amount,p_end,p_initial) on conflict(provider,provider_invoice_id) do nothing;new_receipt:=found;
  update public.lk_subscriptions set period_start=p_start,period_end=p_end,status='active' where id=s.id and (period_end is null or period_end<=p_end);
  update public.lk_gifts set expires_at=p_end,frozen=(p_end<=now()),updated_at=now() where id=g.id and expires_at<=p_end+interval '2 days';
 end if;return new_receipt;
end;$$;
create or replace function public.lk_freeze_expired() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update public.lk_subscriptions set status='past_due',updated_at=now() where period_end<=now() and status='active';
 update public.lk_gifts g set frozen=true,updated_at=now() where exists(select 1 from public.lk_subscriptions s where s.gift_id=g.id and s.period_end<=now()) and not g.frozen;get diagnostics n=row_count;return n;
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
 'revenue_cents',(select coalesce(sum(amount_cents),0) from public.lk_orders where status='paid' and paid_at>=start_date)+(select coalesce(sum(r.amount_cents),0) from public.lk_billing_receipts r where r.paid_at>=start_date and r.provider='stripe' and r.provider_invoice_id like 'in_%' and not r.initial_cycle),
 'events',(select coalesce(jsonb_agg(x),'[]') from (select event_type,count(*) total,count(distinct session_id) sessions from public.lk_analytics_events where created_at>=start_date group by event_type order by total desc)x),
 'daily',(select coalesce(jsonb_agg(x),'[]') from (select created_at::date day_date,count(*) filter(where event_type='page_view') views,count(distinct session_id) sessions from public.lk_analytics_events where created_at>=start_date group by created_at::date order by day_date)x),
 'sources',(select coalesce(jsonb_agg(x),'[]') from (select coalesce(nullif(properties->>'utm_source',''),'direto') source,count(distinct session_id) sessions from public.lk_analytics_events where event_type='page_view' and created_at>=start_date group by 1 order by 2 desc limit 20)x),
 'formats',(select coalesce(jsonb_agg(x),'[]') from (select format,count(*) total from public.lk_gifts where created_at>=start_date and deleted_at is null group by format)x),
 'plans',(select coalesce(jsonb_agg(x),'[]') from (select plan_id,billing_cycle,count(*) total,sum(amount_cents) revenue_cents from public.lk_orders where status='paid' and paid_at>=start_date group by plan_id,billing_cycle)x)
 ) into result;return result;
end;$$;
create or replace function public.lk_publish(p_gift uuid,p_slug text) returns text language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.status not in ('paid','published') or g.expires_at<=now() or g.frozen or g.suspended or g.deleted_at is not null then raise exception 'PAYMENT_REQUIRED';end if;
 if not g.public_consent then raise exception 'CONSENT_REQUIRED';end if;
 if length(coalesce(g.content->>'sender',''))<1 or length(coalesce(g.content->>'recipient',''))<1 or length(coalesce(g.content->>'letter',''))<1 then raise exception 'CONTENT_REQUIRED';end if;
 if not exists(select 1 from public.lk_photos where gift_id=p_gift) then raise exception 'PHOTO_REQUIRED';end if;
 update public.lk_gifts set status='published',slug=p_slug,published_at=coalesce(published_at,now()),updated_at=now() where id=p_gift;return p_slug;
end;$$;
do $$declare tbl text;begin
 foreach tbl in array array['lk_profiles','lk_admins','lk_site_settings','lk_analytics_events','lk_admin_audit','lk_subscriptions','lk_billing_receipts'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from anon,authenticated',tbl);
  execute format('grant all on public.%I to service_role',tbl);
 end loop;
end;$$;
grant usage,select on sequence public.lk_admin_audit_id_seq to service_role;
revoke execute on function public.lk_new_profile(),public.lk_prepare_order_v2(uuid,text,text,uuid,text),public.lk_apply_stripe_cycle(uuid,text,text,timestamptz,timestamptz,integer,text,boolean,boolean,boolean),public.lk_freeze_expired(),public.lk_admin_metrics(integer) from public,anon,authenticated;
grant execute on function public.lk_prepare_order_v2(uuid,text,text,uuid,text),public.lk_apply_stripe_cycle(uuid,text,text,timestamptz,timestamptz,integer,text,boolean,boolean,boolean),public.lk_freeze_expired(),public.lk_admin_metrics(integer) to service_role;
commit;
