create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key,statements text[],name text);
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160001','lovekoala',array[$migration$begin;
create extension if not exists pgcrypto;

create table public.lk_plans (
 id text primary key, name text not null, price_cents integer not null check(price_cents>0),
 max_photos integer not null check(max_photos between 1 and 100), image_credits integer not null check(image_credits between 0 and 12),
 access_days integer not null check(access_days>0), formats text[] not null, active boolean not null default true
);
insert into public.lk_plans values
 ('carinho','Carinho',2990,20,0,365,array['album','retrospectiva'],true),
 ('encanto','Encanto',4990,40,3,1095,array['album','retrospectiva'],true),
 ('universo','Universo',7990,80,6,1825,array['album','retrospectiva','ambos'],true);
create table public.lk_templates (
 id text primary key, name text not null, active boolean not null default true,
 image_prompt text not null, palette jsonb not null, version integer not null default 1
);
insert into public.lk_templates(id,name,image_prompt,palette) values
 ('eucalipto','Eucalipto','Original romantic watercolor illustration on warm ivory cotton paper, delicate eucalyptus leaves, soft sage green and muted terracotta accents, intimate gentle light, tactile brush strokes, elegant editorial scrapbook composition. No text, no typography, no logo, no watermark, no faces of real people.', '{"color":"#426957","paper":"#f6f4e9"}'),
 ('poesia','Poesia','Original romantic watercolor illustration, warm ivory handmade paper, dusty rose petals, faded burgundy and blush, tender atmosphere, fine editorial botanical details. No text, no typography, no logo, no watermark, no faces of real people.', '{"color":"#a15e60","paper":"#fbefe8"}'),
 ('estrelas','Sob as estrelas','Original romantic gouache illustration of a dreamy night, rich muted midnight blue, cream and warm golden tiny stars, gentle celestial romantic storybook art, original composition. Not a scientifically accurate star map. No text, no typography, no logo, no watermark, no faces of real people.', '{"color":"#323c63","paper":"#f5f0e3"}'),
 ('solar','Dias de sol','Original romantic watercolor illustration, golden hour honey sunlight, linen and warm cream, wildflowers, amber and olive green accents, tender summery editorial scrapbook. No text, no typography, no logo, no watermark, no faces of real people.', '{"color":"#b5803d","paper":"#fff6df"}');

create table public.lk_gifts (
 id uuid primary key default gen_random_uuid(), edit_token_hash text not null check(length(edit_token_hash)=64),
 slug text unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 4 and 80),
 format text not null default 'album' check(format in ('album','retrospectiva','ambos')),
 theme text not null default 'eucalipto' references public.lk_templates(id),
 plan_id text not null default 'encanto' references public.lk_plans(id),
 content jsonb not null default '{}'::jsonb, status text not null default 'draft' check(status in ('draft','paid','published','refunded')),
 public_consent boolean not null default false, paid_at timestamptz, published_at timestamptz, expires_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(jsonb_typeof(content)='object' and pg_column_size(content)<100000)
);
create index lk_gifts_status on public.lk_gifts(status,expires_at);
create table public.lk_photos (
 id uuid primary key default gen_random_uuid(),gift_id uuid not null references public.lk_gifts(id) on delete cascade,
 storage_path text not null unique,caption text not null default '' check(length(caption)<=500),taken_at date,
 sort_order integer not null default 0, created_at timestamptz not null default now()
);
create index lk_photos_gift on public.lk_photos(gift_id,sort_order);
create table public.lk_orders (
 id uuid primary key default gen_random_uuid(),gift_id uuid not null references public.lk_gifts(id),
 request_id uuid not null unique,provider text not null check(provider in ('stripe','mercosulpay')),
 plan_id text not null references public.lk_plans(id),amount_cents integer not null check(amount_cents>0),currency text not null default 'BRL',
 status text not null default 'created' check(status in ('created','pending','uncertain','paid','failed','refunded')),
 provider_id text, provider_payment_intent text,checkout_url text,pix_code text,paid_at timestamptz,
 expires_at timestamptz,created_at timestamptz not null default now(),unique(provider,provider_id)
);
create unique index lk_one_active_order on public.lk_orders(gift_id) where status in ('created','pending','uncertain');
create unique index lk_one_paid_order on public.lk_orders(gift_id) where status='paid';
create table public.lk_payment_events (
 provider text not null,event_id text not null,payload_hash text not null,status text not null default 'received',
 created_at timestamptz not null default now(),primary key(provider,event_id)
);
create table public.lk_image_jobs (
 id uuid primary key default gen_random_uuid(),gift_id uuid not null references public.lk_gifts(id),slot integer not null,
 status text not null default 'queued' check(status in ('queued','running','completed','failed')),
 attempts integer not null default 0,template_version integer not null,storage_path text,error_code text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(gift_id,slot)
);
create table public.lk_rate_limits (bucket text not null,window_start timestamptz not null,hits integer not null,primary key(bucket,window_start));

create or replace function public.lk_allow(p_bucket text,p_limit integer) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;w timestamptz:=date_trunc('hour',now());
begin
 insert into public.lk_rate_limits values(p_bucket,w,1) on conflict(bucket,window_start) do update set hits=public.lk_rate_limits.hits+1 returning hits into n;
 delete from public.lk_rate_limits where window_start<now()-interval '2 days';return n<=p_limit;
end;$$;

create or replace function public.lk_prepare_order(p_gift uuid,p_plan text,p_provider text,p_request uuid) returns public.lk_orders
language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;p public.lk_plans;o public.lk_orders;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found then raise exception 'GIFT_NOT_FOUND';end if;
 if g.status<>'draft' then raise exception 'ALREADY_PAID';end if;
 select * into p from public.lk_plans where id=p_plan and active;
 if not found or not(g.format=any(p.formats)) then raise exception 'PLAN_INCOMPATIBLE';end if;
 if (select count(*) from public.lk_photos where gift_id=p_gift)>p.max_photos then raise exception 'PHOTO_LIMIT';end if;
 select * into o from public.lk_orders where request_id=p_request;
 if found then
  if o.gift_id<>p_gift or o.provider<>p_provider or o.plan_id<>p_plan then raise exception 'REQUEST_CONFLICT';end if;return o;
 end if;
 select * into o from public.lk_orders where gift_id=p_gift and status in ('created','pending','uncertain');
 if found then
  if o.provider<>p_provider or o.plan_id<>p_plan then raise exception 'ORDER_PENDING';end if;return o;
 end if;
 insert into public.lk_orders(gift_id,request_id,provider,plan_id,amount_cents) values(p_gift,p_request,p_provider,p_plan,p.price_cents) returning * into o;
 update public.lk_gifts set plan_id=p_plan,updated_at=now() where id=p_gift;return o;
end;$$;

create or replace function public.lk_confirm_order(p_order uuid,p_provider text,p_provider_id text,p_amount integer,p_currency text,p_intent text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare o public.lk_orders;p public.lk_plans;
begin
 select * into o from public.lk_orders where id=p_order for update;
 if not found or o.provider<>p_provider or o.provider_id is distinct from p_provider_id or o.amount_cents<>p_amount or upper(p_currency)<>'BRL' then raise exception 'PAYMENT_MISMATCH';end if;
 if o.status='paid' then return false;end if;
 if o.status='refunded' then raise exception 'ORDER_REFUNDED';end if;
 select * into p from public.lk_plans where id=o.plan_id;
 perform 1 from public.lk_gifts where id=o.gift_id for update;
 update public.lk_orders set status='paid',paid_at=now(),provider_payment_intent=p_intent where id=o.id;
 update public.lk_gifts set status='paid',plan_id=o.plan_id,paid_at=now(),expires_at=now()+make_interval(days=>p.access_days),updated_at=now() where id=o.gift_id;
 return true;
end;$$;

create or replace function public.lk_publish(p_gift uuid,p_slug text) returns text
language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.status not in ('paid','published') or g.expires_at<=now() then raise exception 'PAYMENT_REQUIRED';end if;
 if not g.public_consent then raise exception 'CONSENT_REQUIRED';end if;
 if length(coalesce(g.content->>'sender',''))<1 or length(coalesce(g.content->>'recipient',''))<1 or length(coalesce(g.content->>'letter',''))<1 then raise exception 'CONTENT_REQUIRED';end if;
 if not exists(select 1 from public.lk_photos where gift_id=p_gift) then raise exception 'PHOTO_REQUIRED';end if;
 update public.lk_gifts set status='published',slug=p_slug,published_at=coalesce(published_at,now()),updated_at=now() where id=p_gift;
 return p_slug;
end;$$;

create or replace function public.lk_claim_image(p_gift uuid,p_slot integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;p public.lk_plans;j public.lk_image_jobs;t public.lk_templates;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.status not in ('paid','published') or g.expires_at<=now() then raise exception 'PAYMENT_REQUIRED';end if;
 select * into p from public.lk_plans where id=g.plan_id;
 if p_slot<0 or p_slot>=p.image_credits then raise exception 'IMAGE_LIMIT';end if;
 select * into t from public.lk_templates where id=g.theme;
 insert into public.lk_image_jobs(gift_id,slot,template_version) values(p_gift,p_slot,t.version) on conflict(gift_id,slot) do nothing;
 select * into j from public.lk_image_jobs where gift_id=p_gift and slot=p_slot for update;
 if j.status='completed' or j.status='running' or j.attempts>=3 then return jsonb_build_object('claimed',false,'job',to_jsonb(j));end if;
 update public.lk_image_jobs set status='running',attempts=attempts+1,updated_at=now(),error_code=null where id=j.id returning * into j;
 return jsonb_build_object('claimed',true,'job',to_jsonb(j));
end;$$;

alter table public.lk_plans enable row level security;
alter table public.lk_templates enable row level security;
alter table public.lk_gifts enable row level security;
alter table public.lk_photos enable row level security;
alter table public.lk_orders enable row level security;
alter table public.lk_payment_events enable row level security;
alter table public.lk_image_jobs enable row level security;
alter table public.lk_rate_limits enable row level security;
revoke all on public.lk_gifts,public.lk_photos,public.lk_orders,public.lk_payment_events,public.lk_image_jobs,public.lk_rate_limits from anon,authenticated;
revoke all on public.lk_plans,public.lk_templates from anon,authenticated;
grant select on public.lk_plans to anon,authenticated;
grant select(id,name,active,palette,version) on public.lk_templates to anon,authenticated;
create policy lk_plans_read on public.lk_plans for select to anon,authenticated using(active);
create policy lk_templates_read on public.lk_templates for select to anon,authenticated using(active);
revoke execute on function public.lk_allow(text,integer),public.lk_prepare_order(uuid,text,text,uuid),public.lk_confirm_order(uuid,text,text,integer,text,text),public.lk_publish(uuid,text),public.lk_claim_image(uuid,integer) from public,anon,authenticated;
grant execute on function public.lk_allow(text,integer),public.lk_prepare_order(uuid,text,text,uuid),public.lk_confirm_order(uuid,text,text,integer,text,text),public.lk_publish(uuid,text),public.lk_claim_image(uuid,integer) to service_role;
grant all on all tables in schema public to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('love-memories','love-memories',false,6291456,array['image/jpeg','image/png','image/webp']),('love-art','love-art',false,12582912,array['image/png','image/webp','image/jpeg']);
comment on table public.lk_gifts is 'LoveKoala v0.1: token de edição somente em SHA-256; leitura pública exclusivamente pela Edge Function depois da publicação paga.';
commit;
$migration$]) on conflict(version) do nothing;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160002','guards',array[$migration$begin;
create or replace function public.lk_add_photo(p_gift uuid,p_path text) returns public.lk_photos language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;p public.lk_plans;r public.lk_photos;n integer;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.status='refunded' then raise exception 'GIFT_NOT_FOUND';end if;
 select * into p from public.lk_plans where id=g.plan_id;
 select count(*) into n from public.lk_photos where gift_id=p_gift;
 if n>=(case when g.status='draft' then 80 else p.max_photos end) then raise exception 'PHOTO_LIMIT';end if;
 insert into public.lk_photos(gift_id,storage_path,sort_order) values(p_gift,p_path,n) returning * into r;return r;
end;$$;
create or replace function public.lk_claim_order(p_order uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.lk_orders set status='uncertain' where id=p_order and status='created';return found;
end;$$;
create or replace function public.lk_refund_order(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.lk_orders;
begin
 select * into o from public.lk_orders where id=p_order for update;
 if not found then raise exception 'ORDER_NOT_FOUND';end if;
 update public.lk_orders set status='refunded' where id=p_order;
 update public.lk_gifts set status='refunded',updated_at=now() where id=o.gift_id;
end;$$;
revoke execute on function public.lk_add_photo(uuid,text),public.lk_claim_order(uuid),public.lk_refund_order(uuid) from public,anon,authenticated;
grant execute on function public.lk_add_photo(uuid,text),public.lk_claim_order(uuid),public.lk_refund_order(uuid) to service_role;
commit;
$migration$]) on conflict(version) do nothing;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160003','reconciliation',array[$migration$begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
-- CRON_SECRET is provisioned in Vault and Edge secrets through hidden stdin.
-- No secret value belongs to this migration or its source repository.
select cron.schedule('lovekoala-reconcile','*/5 * * * *',$job$
 select net.http_post(
  url:='https://enhnlektomuoumozjsfp.supabase.co/functions/v1/lovekoala-api',
  headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',
   (select decrypted_secret from vault.decrypted_secrets where name='lovekoala_cron_secret' limit 1)),
  body:='{"action":"reconcile"}'::jsonb,
  timeout_milliseconds:=55000
 );
 $job$);
commit;
$migration$]) on conflict(version) do nothing;

insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160004','admin_billing',array[$migration$begin;
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
$migration$]) on conflict(version) do nothing;

insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160005','music_integration',array[$migration$begin;
-- Only the Edge service role can read or replace the YouTube credential.
-- The public configuration exposes a boolean, never the secret.
create or replace function public.lk_music_key() returns text
language sql security definer set search_path='' as $$
 select decrypted_secret from vault.decrypted_secrets where name='lovekoala_youtube_key' limit 1;
$$;
create or replace function public.lk_set_music_key(p_value text) returns void
language plpgsql security definer set search_path='' as $$
declare secret_id uuid;
begin
 if length(p_value)>200 then raise exception 'KEY_INVALID';end if;
 perform pg_advisory_xact_lock(hashtext('lovekoala_youtube_key'));
 select id into secret_id from vault.secrets where name='lovekoala_youtube_key' limit 1;
 if p_value='' then
  delete from vault.secrets where id=secret_id;
 elsif secret_id is null then
  perform vault.create_secret(p_value,'lovekoala_youtube_key','LoveKoala YouTube Data API v3');
 else
  perform vault.update_secret(secret_id,p_value,'lovekoala_youtube_key');
 end if;
end;$$;
revoke execute on function public.lk_music_key(),public.lk_set_music_key(text) from public,anon,authenticated;
grant execute on function public.lk_music_key(),public.lk_set_music_key(text) to service_role;
commit;
$migration$]) on conflict(version) do nothing;

insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160006','canceled_cycle',array[$migration$begin;
-- Reconciliation of the last paid invoice must not reactivate a canceled subscription.
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
  update public.lk_gifts set expires_at=p_end,frozen=(p_end<=now()),updated_at=now() where id=g.id and expires_at<=p_end+interval '2 days';
 end if;return new_receipt;
end;$$;
commit;
$migration$]) on conflict(version) do nothing;


insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160007','checkout_recovery',array[$migration$begin;
create table public.lk_checkout_recovery(
 id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.lk_orders(id) on delete cascade,
 gift_id uuid not null references public.lk_gifts(id) on delete cascade,owner_user_id uuid references auth.users(id) on delete cascade,
 email text not null,plan_id text not null,provider text not null,billing_cycle text not null,amount_cents integer not null,
 summary jsonb not null,resume_origin text not null,status text not null default 'pending' check(status in ('pending','abandoned','recovered')),
 reason text not null default 'checkout_started',email_consent boolean not null default false,consented_at timestamptz,
 email_status text not null default 'none' check(email_status in ('none','queued','sending','sent','failed','unavailable','skipped')),
 email_requested_at timestamptz,scheduled_at timestamptz,sending_started_at timestamptz,sent_at timestamptz,
 attempts integer not null default 0,provider_message_id text,last_error text,message_payload jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(length(email)<=254),check(pg_column_size(summary)<5000),check(length(resume_origin)<300)
);
create index lk_recovery_status on public.lk_checkout_recovery(status,updated_at desc);
create index lk_recovery_queue on public.lk_checkout_recovery(email_status,scheduled_at) where email_consent and status<>'recovered';
create or replace function public.lk_capture_checkout(p_order uuid,p_origin text,p_consent boolean default null,p_reason text default 'checkout_started') returns public.lk_checkout_recovery
language plpgsql security definer set search_path='' as $$
declare o public.lk_orders;g public.lk_gifts;p public.lk_plans;r public.lk_checkout_recovery;
begin
 select * into o from public.lk_orders where id=p_order;
 select * into g from public.lk_gifts where id=o.gift_id;
 if o.id is null or g.id is null or g.deleted_at is not null then raise exception 'GIFT_NOT_FOUND';end if;
 if p_reason not in ('checkout_started','stripe_return','pix_closed','left_editor','expired','payment_failed','summary_requested') then raise exception 'INVALID_REASON';end if;
 if p_origin!~'^https://[a-zA-Z0-9.-]+(:[0-9]+)?$' then raise exception 'INVALID_ORIGIN';end if;
 select * into p from public.lk_plans where id=o.plan_id;
 insert into public.lk_checkout_recovery(order_id,gift_id,owner_user_id,email,plan_id,provider,billing_cycle,amount_cents,summary,resume_origin)
 values(o.id,g.id,g.owner_user_id,g.content->>'email',o.plan_id,o.provider,o.billing_cycle,o.amount_cents,
 jsonb_build_object('sender',g.content->>'sender','recipient',g.content->>'recipient','format',g.format,'plan_name',p.name,'photos',(select count(*) from public.lk_photos where gift_id=g.id),'music_title',g.content->>'music_title'),p_origin)
 on conflict(order_id) do nothing;
 select * into r from public.lk_checkout_recovery where order_id=o.id for update;
 update public.lk_checkout_recovery set
  status=case when o.status='paid' then 'recovered' when p_reason<>'checkout_started' then 'abandoned' else status end,
  reason=p_reason,updated_at=now(),
  email_consent=coalesce(p_consent,email_consent),
  consented_at=case when p_consent=true then coalesce(consented_at,now()) else consented_at end,
  email_status=case when o.status='paid' and email_status<>'sent' then 'skipped' when p_consent=false and email_status<>'sent' then 'none' when p_consent=true and email_status in ('none','unavailable') then 'queued' else email_status end,
  email_requested_at=case when p_consent=true and email_status in ('none','unavailable') then now() else email_requested_at end,
  scheduled_at=case when p_consent=true and email_status in ('none','unavailable') then now()+interval '15 minutes' else scheduled_at end
 where id=r.id returning * into r;return r;
end;$$;
create or replace function public.lk_recovery_paid() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='paid' then update public.lk_checkout_recovery set status='recovered',email_status=case when email_status='sent' then 'sent' else 'skipped' end,scheduled_at=null,updated_at=now() where order_id=new.id;end if;return new;
end;$$;
create trigger lk_order_recovery_paid after update of status on public.lk_orders for each row execute function public.lk_recovery_paid();
create or replace function public.lk_take_summary(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.lk_checkout_recovery;
begin
 update public.lk_checkout_recovery set email_status='sending',sending_started_at=now(),attempts=attempts+1
 where id=p_id and email_consent and status<>'recovered' and attempts<3 and scheduled_at<=now() and email_requested_at>now()-interval '7 days'
 and (email_status in ('queued','failed') or email_status='sending' and sending_started_at<now()-interval '5 minutes') returning * into r;
 return jsonb_build_object('claimed',found,'record',to_jsonb(r));
end;$$;
create or replace function public.lk_mark_abandoned() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;begin
 update public.lk_checkout_recovery set status='abandoned' where status='pending' and updated_at<now()-interval '15 minutes';get diagnostics n=row_count;return n;
end;$$;
create or replace function public.lk_get_mail_config() returns jsonb language sql security definer set search_path='' as $$
 select coalesce((select decrypted_secret::jsonb from vault.decrypted_secrets where name='lovekoala_mail_config' limit 1),'{}'::jsonb);
$$;
create or replace function public.lk_set_mail_config(p_config jsonb) returns void language plpgsql security definer set search_path='' as $$
declare secret_id uuid;begin
 if jsonb_typeof(p_config)<>'object' or pg_column_size(p_config)>4000 then raise exception 'CONFIG_INVALID';end if;
 perform pg_advisory_xact_lock(hashtext('lovekoala_mail_config'));
 select id into secret_id from vault.secrets where name='lovekoala_mail_config' limit 1;
 if secret_id is null then perform vault.create_secret(p_config::text,'lovekoala_mail_config','LoveKoala transactional summary email');
 else perform vault.update_secret(secret_id,p_config::text,'lovekoala_mail_config');end if;
end;$$;
-- Only opted-in, published histories participate. No dates or identifiers are returned.
create or replace function public.lk_safe_date(p_value text) returns date language plpgsql immutable set search_path='' as $$
declare d date;begin if p_value!~'^\d{4}-\d{2}-\d{2}$' then return null;end if;d:=p_value::date;if to_char(d,'YYYY-MM-DD')<>p_value then return null;end if;return d;exception when others then return null;end;$$;
create or replace function public.lk_couple_stats(p_days integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer;percent integer;begin
 if p_days<0 or p_days>36525 then raise exception 'INVALID_DURATION';end if;
 with histories as(select current_date-public.lk_safe_date(content->>'start_date') days from public.lk_gifts where status='published' and not suspended and not frozen and deleted_at is null and expires_at>now() and content->>'stats_consent'='true'),eligible as(select days from histories where days between 0 and 36525)
 select count(*),round(100.0*count(*) filter(where days<p_days)/nullif(count(*),0)/5)*5 into n,percent from eligible;
 if n<20 then return jsonb_build_object('available',false,'minimum',20);end if;
 return jsonb_build_object('available',true,'participants',n,'percentile',least(100,greatest(0,percent)));
end;$$;
alter table public.lk_checkout_recovery enable row level security;
revoke all on public.lk_checkout_recovery from anon,authenticated;
grant all on public.lk_checkout_recovery to service_role;
revoke execute on function public.lk_capture_checkout(uuid,text,boolean,text),public.lk_recovery_paid(),public.lk_take_summary(uuid),public.lk_mark_abandoned(),public.lk_get_mail_config(),public.lk_set_mail_config(jsonb),public.lk_safe_date(text),public.lk_couple_stats(integer) from public,anon,authenticated;
grant execute on function public.lk_capture_checkout(uuid,text,boolean,text),public.lk_take_summary(uuid),public.lk_mark_abandoned(),public.lk_get_mail_config(),public.lk_set_mail_config(jsonb),public.lk_couple_stats(integer) to service_role;
commit;
$migration$]) on conflict(version) do nothing;

insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160008','publication_limits',array[$migration$begin;
-- Validate the purchased limits again at publication, including edits made while a payment was pending.
create or replace function public.lk_publish(p_gift uuid,p_slug text) returns text language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;p public.lk_plans;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.status not in ('paid','published') or g.expires_at<=now() or g.frozen or g.suspended or g.deleted_at is not null then raise exception 'PAYMENT_REQUIRED';end if;
 select * into p from public.lk_plans where id=g.plan_id;
 if not(g.format=any(p.formats)) or (select count(*) from public.lk_photos where gift_id=g.id)>p.max_photos then raise exception 'PLAN_INCOMPATIBLE';end if;
 if not g.public_consent then raise exception 'CONSENT_REQUIRED';end if;
 if length(coalesce(g.content->>'sender',''))<1 or length(coalesce(g.content->>'recipient',''))<1 or length(coalesce(g.content->>'letter',''))<1 then raise exception 'CONTENT_REQUIRED';end if;
 if not exists(select 1 from public.lk_photos where gift_id=p_gift) then raise exception 'PHOTO_REQUIRED';end if;
 update public.lk_gifts set status='published',slug=p_slug,published_at=coalesce(published_at,now()),updated_at=now() where id=p_gift;return p_slug;
end;$$;
-- Bring existing unfinished purchases into the admin list without authorizing any email.
do $$declare o record;begin
 for o in select orders.id from public.lk_orders orders join public.lk_gifts g on g.id=orders.gift_id
 where orders.status in ('created','pending','uncertain','failed') and g.deleted_at is null and g.content->>'email' ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 and not exists(select 1 from public.lk_checkout_recovery r where r.order_id=orders.id)
 loop perform public.lk_capture_checkout(o.id,'https://lovekoala.contatodaflonedu.chatgpt.site',null,'left_editor');end loop;
end;$$;
commit;
$migration$]) on conflict(version) do nothing;

insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160009','recovered_history',array[$migration$begin;
-- A later successful attempt also recovers earlier unfinished attempts for this gift.
create or replace function public.lk_capture_checkout(p_order uuid,p_origin text,p_consent boolean default null,p_reason text default 'checkout_started') returns public.lk_checkout_recovery
language plpgsql security definer set search_path='' as $$
declare o public.lk_orders;g public.lk_gifts;p public.lk_plans;r public.lk_checkout_recovery;paid boolean;
begin
 select * into o from public.lk_orders where id=p_order;
 select * into g from public.lk_gifts where id=o.gift_id;
 if o.id is null or g.id is null or g.deleted_at is not null then raise exception 'GIFT_NOT_FOUND';end if;
 if p_reason not in ('checkout_started','stripe_return','pix_closed','left_editor','expired','payment_failed','summary_requested') then raise exception 'INVALID_REASON';end if;
 if p_origin!~'^https://[a-zA-Z0-9.-]+(:[0-9]+)?$' then raise exception 'INVALID_ORIGIN';end if;
 paid:=o.status='paid' or exists(select 1 from public.lk_orders newer where newer.gift_id=o.gift_id and newer.status='paid' and newer.created_at>=o.created_at);
 select * into p from public.lk_plans where id=o.plan_id;
 insert into public.lk_checkout_recovery(order_id,gift_id,owner_user_id,email,plan_id,provider,billing_cycle,amount_cents,summary,resume_origin)
 values(o.id,g.id,g.owner_user_id,g.content->>'email',o.plan_id,o.provider,o.billing_cycle,o.amount_cents,
 jsonb_build_object('sender',g.content->>'sender','recipient',g.content->>'recipient','format',g.format,'plan_name',p.name,'photos',(select count(*) from public.lk_photos where gift_id=g.id),'music_title',g.content->>'music_title'),p_origin)
 on conflict(order_id) do nothing;
 select * into r from public.lk_checkout_recovery where order_id=o.id for update;
 update public.lk_checkout_recovery set
  status=case when paid then 'recovered' when p_reason<>'checkout_started' then 'abandoned' else status end,
  reason=p_reason,updated_at=now(),
  email_consent=coalesce(p_consent,email_consent),
  consented_at=case when p_consent=true then coalesce(consented_at,now()) else consented_at end,
  email_status=case when paid and email_status<>'sent' then 'skipped' when p_consent=false and email_status<>'sent' then 'none' when p_consent=true and email_status in ('none','unavailable') then 'queued' else email_status end,
  email_requested_at=case when p_consent=true and email_status in ('none','unavailable') then now() else email_requested_at end,
  scheduled_at=case when p_consent=true and email_status in ('none','unavailable') then now()+interval '15 minutes' else scheduled_at end
 where id=r.id returning * into r;return r;
end;$$;
create or replace function public.lk_recovery_paid() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='paid' then update public.lk_checkout_recovery set status='recovered',email_status=case when email_status='sent' then 'sent' else 'skipped' end,scheduled_at=null,updated_at=now() where gift_id=new.gift_id and order_id in(select id from public.lk_orders where gift_id=new.gift_id and created_at<=new.created_at);end if;return new;
end;$$;

update public.lk_checkout_recovery r set status='recovered',email_status=case when email_status='sent' then 'sent' else 'skipped' end,scheduled_at=null,updated_at=now() where exists(select 1 from public.lk_orders paid join public.lk_orders original on original.id=r.order_id where paid.gift_id=r.gift_id and paid.status='paid' and paid.created_at>=original.created_at);
commit;
$migration$]) on conflict(version) do nothing;


insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160010','paid_access_recovery',array[$migration$begin;
-- Repair a verified paid initial order whose access grant is missing. Never extend an existing period.
create or replace function public.lk_restore_paid_access(p_order uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare o public.lk_orders;g public.lk_gifts;p public.lk_plans;s public.lk_subscriptions;until_date timestamptz;
begin
 select * into o from public.lk_orders where id=p_order for update;
 if not found or o.status<>'paid' or o.paid_at is null or o.purpose<>'initial' then raise exception 'PAYMENT_REQUIRED';end if;
 select * into g from public.lk_gifts where id=o.gift_id for update;
 if not found or g.deleted_at is not null or g.status='refunded' then raise exception 'GIFT_NOT_FOUND';end if;
 if g.expires_at is not null then return false;end if;
 select * into p from public.lk_plans where id=o.plan_id;
 if not found then raise exception 'PLAN_INCOMPATIBLE';end if;
 until_date:=case when o.billing_cycle='monthly' then o.paid_at+interval '1 month' else o.paid_at+make_interval(days=>p.access_days) end;
 if o.billing_cycle='monthly' then
  select * into s from public.lk_subscriptions where gift_id=g.id for update;
  if found then until_date:=s.period_end;
  else
   insert into public.lk_subscriptions(gift_id,owner_user_id,plan_id,provider,status,amount_cents,period_start,period_end)
   values(g.id,g.owner_user_id,o.plan_id,o.provider,case when until_date<=now() then 'past_due' else 'active' end,o.amount_cents,o.paid_at,until_date) returning * into s;
  end if;
  update public.lk_orders set subscription_id=s.id where id=o.id;
  insert into public.lk_billing_receipts(subscription_id,provider,provider_invoice_id,amount_cents,period_end)
  values(s.id,o.provider,o.provider_id,o.amount_cents,until_date) on conflict(provider,provider_invoice_id) do nothing;
 end if;
 if until_date is null then raise exception 'PAYMENT_REQUIRED';end if;
 update public.lk_gifts set status=case when status='published' then 'published' else 'paid' end,
 plan_id=o.plan_id,paid_at=coalesce(paid_at,o.paid_at),expires_at=until_date,frozen=(until_date<=now()),updated_at=now() where id=g.id;
 return true;
end;$$;
revoke execute on function public.lk_restore_paid_access(uuid) from public,anon,authenticated;
grant execute on function public.lk_restore_paid_access(uuid) to service_role;
commit;
$migration$]) on conflict(version) do nothing;

insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160011','live_experience',array[$migration$begin;
-- Show only a real aggregate once twenty published histories are available.
-- Pair + start date deduplicates multiple gifts for the same relationship.
create or replace function public.lk_couple_stats(p_days integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer;percent integer;begin
 if p_days<0 or p_days>36525 then raise exception 'INVALID_DURATION';end if;
 with histories as(
  select distinct least(lower(trim(content->>'sender')),lower(trim(content->>'recipient'))) a,
  greatest(lower(trim(content->>'sender')),lower(trim(content->>'recipient'))) b,
  public.lk_safe_date(content->>'start_date') started
  from public.lk_gifts where status='published' and not suspended and not frozen and deleted_at is null and expires_at>now()
 ),eligible as(select (now() at time zone 'America/Sao_Paulo')::date-started days from histories where started is not null)
 select count(*),round(100.0*count(*) filter(where days<p_days)/nullif(count(*),0)/5)*5 into n,percent from eligible where days between 0 and 36525;
 if n<20 then return jsonb_build_object('available',false);end if;
 return jsonb_build_object('available',true,'participants',n,'percentile',least(100,greatest(0,percent)));
end;$$;
-- Cron can also repair the uncommon paid-order/missing-grant inconsistency.
create or replace function public.lk_incomplete_paid_orders() returns setof public.lk_orders language sql security definer set search_path='' as $$
 select o.* from public.lk_orders o join public.lk_gifts g on g.id=o.gift_id where o.status='paid' and o.purpose='initial' and g.expires_at is null and g.deleted_at is null and g.status<>'refunded' and not g.suspended order by o.paid_at limit 25;
$$;
revoke execute on function public.lk_incomplete_paid_orders() from public,anon,authenticated;
grant execute on function public.lk_incomplete_paid_orders() to service_role;
commit;
$migration$]) on conflict(version) do nothing;

insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160012','access_offers',array[$migration$begin;
-- Existing purchases retain their original access term. New orders snapshot the offer.
alter table public.lk_plans add column access_kind text not null default 'legacy' check(access_kind in ('legacy','24h','lifetime','club'));
alter table public.lk_plans add column monthly_gifts integer not null default 2 check(monthly_gifts between 2 and 20);
alter table public.lk_gifts add column access_kind text not null default 'legacy' check(access_kind in ('legacy','24h','lifetime','club'));
alter table public.lk_gifts add column edit_expires_at timestamptz;
alter table public.lk_gifts add column club_subscription_id uuid references public.lk_subscriptions(id);
alter table public.lk_orders add column access_kind text not null default 'legacy' check(access_kind in ('legacy','24h','lifetime','club'));
alter table public.lk_orders add column access_days_snapshot integer;
update public.lk_orders o set access_days_snapshot=p.access_days from public.lk_plans p where p.id=o.plan_id;
create table public.lk_club_periods(
 id uuid primary key default gen_random_uuid(),subscription_id uuid not null references public.lk_subscriptions(id),
 period_start timestamptz not null,period_end timestamptz not null,gift_limit integer not null check(gift_limit>=2),
 created_at timestamptz not null default now(),unique(subscription_id,period_start),check(period_end>period_start)
);
create table public.lk_club_redemptions(
 gift_id uuid primary key references public.lk_gifts(id),period_id uuid not null references public.lk_club_periods(id),created_at timestamptz not null default now()
);
create index lk_club_period_uses on public.lk_club_redemptions(period_id);
alter table public.lk_club_periods enable row level security;
alter table public.lk_club_redemptions enable row level security;
revoke all on public.lk_club_periods,public.lk_club_redemptions from anon,authenticated;
grant all on public.lk_club_periods,public.lk_club_redemptions to service_role;
create or replace function public.lk_order_offer_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.lk_plans;g public.lk_gifts;begin
 select * into p from public.lk_plans where id=new.plan_id;select * into g from public.lk_gifts where id=new.gift_id;
 new.access_kind:=case when new.purpose='renewal' then g.access_kind else p.access_kind end;
 new.access_days_snapshot:=p.access_days;return new;
end;$$;
create trigger lk_snapshot_order before insert on public.lk_orders for each row execute function public.lk_order_offer_snapshot();
create or replace function public.lk_issue_club_period(p_subscription uuid,p_start timestamptz,p_end timestamptz,p_initial boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.lk_subscriptions;b public.lk_club_periods;p public.lk_plans;begin
 select * into s from public.lk_subscriptions where id=p_subscription for update;
 select * into p from public.lk_plans where id=s.plan_id;
 if not found or p.access_kind<>'club' or p_end<=p_start then raise exception 'PLAN_INCOMPATIBLE';end if;
 -- Stripe's canonical period may differ by seconds from initial checkout confirmation.
 select * into b from public.lk_club_periods where subscription_id=s.id and abs(extract(epoch from period_start-p_start))<259200 and abs(extract(epoch from period_end-p_end))<259200 order by created_at limit 1 for update;
 if found then update public.lk_club_periods set period_start=p_start,period_end=p_end where id=b.id;
 else insert into public.lk_club_periods(subscription_id,period_start,period_end,gift_limit) values(s.id,p_start,p_end,p.monthly_gifts) returning * into b;end if;
 if p_initial then
  insert into public.lk_club_redemptions(gift_id,period_id) values(s.gift_id,b.id) on conflict(gift_id) do nothing;
  update public.lk_gifts set club_subscription_id=s.id where id=s.gift_id and access_kind='club';
 end if;return b.id;
end;$$;

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
 if g.status='draft' and not exists(select 1 from public.lk_orders where gift_id=g.id and status in ('created','pending','uncertain','paid')) then
  if (p.access_kind='club' and p_cycle<>'monthly') or (p.access_kind in ('24h','lifetime') and p_cycle<>'once') then raise exception 'PLAN_INCOMPATIBLE';end if;
  if p.access_kind='club' then
   if g.owner_user_id is null then raise exception 'ACCOUNT_REQUIRED';end if;
   perform pg_advisory_xact_lock(hashtextextended(g.owner_user_id::text,0));
   if exists(select 1 from public.lk_subscriptions x join public.lk_gifts xg on xg.id=x.gift_id where x.owner_user_id=g.owner_user_id and xg.access_kind='club' and (x.period_end>now() or x.auto_renew and x.status<>'canceled') and xg.deleted_at is null) then raise exception 'CLUB_EXISTS';end if;
   if exists(select 1 from public.lk_orders x join public.lk_gifts xg on xg.id=x.gift_id where xg.owner_user_id=g.owner_user_id and x.access_kind='club' and x.status in ('created','pending','uncertain')) then raise exception 'ORDER_PENDING';end if;
  end if;
 end if;
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
 update public.lk_orders set status='paid',paid_at=now(),provider_payment_intent=p_intent where id=o.id;
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
   perform public.lk_issue_club_period(s.id,p_start,p_end,p_initial);
  else
   update public.lk_gifts set expires_at=p_end,frozen=(p_end<=now()),updated_at=now() where id=g.id and expires_at<=p_end+interval '2 days';
  end if;
 end if;return new_receipt;
end;$$;
create or replace function public.lk_restore_paid_access(p_order uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare o public.lk_orders;g public.lk_gifts;p public.lk_plans;s public.lk_subscriptions;until_date timestamptz;
begin
 select * into o from public.lk_orders where id=p_order for update;
 if not found or o.status<>'paid' or o.paid_at is null or o.purpose<>'initial' then raise exception 'PAYMENT_REQUIRED';end if;
 select * into g from public.lk_gifts where id=o.gift_id for update;
 if not found or g.deleted_at is not null or g.status='refunded' then raise exception 'GIFT_NOT_FOUND';end if;
 if g.expires_at is not null then return false;end if;
 select * into p from public.lk_plans where id=o.plan_id;
 if not found then raise exception 'PLAN_INCOMPATIBLE';end if;
 until_date:=case when o.billing_cycle='monthly' then o.paid_at+interval '1 month' when o.access_kind='lifetime' then 'infinity'::timestamptz when o.access_kind='24h' then o.paid_at+interval '24 hours' else o.paid_at+make_interval(days=>coalesce(o.access_days_snapshot,p.access_days)) end;
 if o.billing_cycle='monthly' then
  select * into s from public.lk_subscriptions where gift_id=g.id for update;
  if found then until_date:=s.period_end;
  else
   insert into public.lk_subscriptions(gift_id,owner_user_id,plan_id,provider,status,amount_cents,period_start,period_end)
   values(g.id,g.owner_user_id,o.plan_id,o.provider,case when until_date<=now() then 'past_due' else 'active' end,o.amount_cents,o.paid_at,until_date) returning * into s;
  end if;
  update public.lk_orders set subscription_id=s.id where id=o.id;
  insert into public.lk_billing_receipts(subscription_id,provider,provider_invoice_id,amount_cents,period_end)
  values(s.id,o.provider,o.provider_id,o.amount_cents,until_date) on conflict(provider,provider_invoice_id) do nothing;
 end if;
 if o.access_kind='club' and s.id is not null then perform public.lk_issue_club_period(s.id,s.period_start,s.period_end,true);end if;
 if until_date is null then raise exception 'PAYMENT_REQUIRED';end if;
 update public.lk_gifts set status=case when status='published' then 'published' else 'paid' end,
 plan_id=o.plan_id,paid_at=coalesce(paid_at,o.paid_at),access_kind=o.access_kind,edit_expires_at=case when o.access_kind='24h' then until_date else null end,expires_at=case when o.access_kind='club' then 'infinity'::timestamptz else until_date end,frozen=(o.access_kind<>'club' and until_date<=now()),updated_at=now() where id=g.id;
 return true;
end;$$;

create or replace function public.lk_redeem_club_gift(p_gift uuid,p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;s public.lk_subscriptions;b public.lk_club_periods;p public.lk_plans;n integer;begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.owner_user_id is distinct from p_owner or g.deleted_at is not null or g.suspended then raise exception 'GIFT_NOT_FOUND';end if;
 if exists(select 1 from public.lk_club_redemptions where gift_id=g.id) then return jsonb_build_object('ok',true,'already_redeemed',true);end if;
 if g.status<>'draft' then raise exception 'ALREADY_PAID';end if;
 if exists(select 1 from public.lk_orders where gift_id=g.id and status in ('created','pending','uncertain','paid')) then raise exception 'ORDER_PENDING';end if;
 select x.* into s from public.lk_subscriptions x join public.lk_gifts anchor on anchor.id=x.gift_id where x.owner_user_id=p_owner and anchor.access_kind='club' and anchor.status<>'refunded' and anchor.deleted_at is null and not anchor.suspended and x.period_end>now() and x.status in ('active','canceled') order by x.period_end desc limit 1 for update of x;
 if not found then raise exception 'CLUB_INACTIVE';end if;
 select * into b from public.lk_club_periods where subscription_id=s.id and period_start<=now() and period_end>now() order by period_start desc limit 1 for update;
 if not found then raise exception 'CLUB_INACTIVE';end if;
 select count(*) into n from public.lk_club_redemptions where period_id=b.id;
 if n>=b.gift_limit then raise exception 'CLUB_LIMIT';end if;
 select * into p from public.lk_plans where id=s.plan_id;
 if not(g.format=any(p.formats)) or (select count(*) from public.lk_photos where gift_id=g.id)>p.max_photos then raise exception 'PLAN_INCOMPATIBLE';end if;
 if length(coalesce(g.content->>'sender',''))=0 or length(coalesce(g.content->>'recipient',''))=0 or length(coalesce(g.content->>'letter',''))=0 or not exists(select 1 from public.lk_photos where gift_id=g.id) then raise exception 'CONTENT_REQUIRED';end if;
 insert into public.lk_club_redemptions(gift_id,period_id) values(g.id,b.id);
 update public.lk_gifts set status='paid',plan_id=s.plan_id,access_kind='club',club_subscription_id=s.id,paid_at=now(),expires_at='infinity',edit_expires_at=null,frozen=false,updated_at=now() where id=g.id;
 return jsonb_build_object('ok',true,'remaining',b.gift_limit-n-1,'period_end',b.period_end);
end;$$;
create or replace function public.lk_club_balance(p_owner uuid) returns jsonb language sql security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('active',true,'subscription_id',s.id,'anchor_gift_id',s.gift_id,'limit',b.gift_limit,'used',(select count(*) from public.lk_club_redemptions r where r.period_id=b.id),'remaining',greatest(0,b.gift_limit-(select count(*) from public.lk_club_redemptions r where r.period_id=b.id)),'period_start',b.period_start,'period_end',b.period_end,'auto_renew',s.auto_renew,'cancel_at_period_end',s.cancel_at_period_end)
 from public.lk_subscriptions s join public.lk_gifts g on g.id=s.gift_id join public.lk_club_periods b on b.subscription_id=s.id
 where s.owner_user_id=p_owner and g.access_kind='club' and g.deleted_at is null and g.status<>'refunded' and not g.suspended and s.status in ('active','canceled') and s.period_end>now() and b.period_start<=now() and b.period_end>now() order by b.period_end desc limit 1),'{"active":false}'::jsonb);
$$;
create or replace function public.lk_freeze_expired() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;begin
 update public.lk_subscriptions set status='past_due',updated_at=now() where period_end<=now() and status='active';
 update public.lk_gifts g set frozen=true,updated_at=now() where not g.frozen and g.status in ('paid','published') and g.access_kind not in ('lifetime','club') and (g.expires_at<=now() or exists(select 1 from public.lk_subscriptions s where s.gift_id=g.id and s.period_end<=now()));get diagnostics n=row_count;return n;
end;$$;
create or replace function public.lk_publish(p_gift uuid,p_slug text) returns text language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;p public.lk_plans;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.status not in ('paid','published') or g.expires_at is null or g.expires_at<=now() or g.frozen or g.suspended or g.deleted_at is not null then raise exception 'PAYMENT_REQUIRED';end if;
 if g.access_kind='24h' and g.edit_expires_at<=now() then raise exception 'EDIT_EXPIRED';end if;
 select * into p from public.lk_plans where id=g.plan_id;
 if not(g.format=any(p.formats)) or (select count(*) from public.lk_photos where gift_id=g.id)>p.max_photos then raise exception 'PLAN_INCOMPATIBLE';end if;
 if not g.public_consent then raise exception 'CONSENT_REQUIRED';end if;
 if length(coalesce(g.content->>'sender',''))<1 or length(coalesce(g.content->>'recipient',''))<1 or length(coalesce(g.content->>'letter',''))<1 then raise exception 'CONTENT_REQUIRED';end if;
 if not exists(select 1 from public.lk_photos where gift_id=p_gift) then raise exception 'PHOTO_REQUIRED';end if;
 update public.lk_gifts set status='published',slug=p_slug,published_at=coalesce(published_at,now()),updated_at=now() where id=p_gift;return p_slug;
end;$$;
-- The public endpoint and editor enforce the exact instant; cron also marks expired rows.
select cron.schedule('lovekoala-freeze-expired','* * * * *','select public.lk_freeze_expired();');
revoke execute on function public.lk_order_offer_snapshot(),public.lk_issue_club_period(uuid,timestamptz,timestamptz,boolean),public.lk_redeem_club_gift(uuid,uuid),public.lk_club_balance(uuid) from public,anon,authenticated;
grant execute on function public.lk_issue_club_period(uuid,timestamptz,timestamptz,boolean),public.lk_redeem_club_gift(uuid,uuid),public.lk_club_balance(uuid) to service_role;
update public.lk_plans set access_kind='24h',access_days=1,name='24 horas',description='Uma surpresa para viver intensamente por um dia.',features='["1 presente","24 horas de acesso e edição após o pagamento","Álbum ou retrospectiva","Até 20 fotos"]' where id='carinho';
update public.lk_plans set access_kind='lifetime',name='Para sempre',description='Uma história para guardar e revisitar sem prazo.',formats=array['album','retrospectiva','ambos'],features='["1 presente vitalício","Acesso e edição sem vencimento","Álbum e retrospectiva","Até 40 fotos"]' where id='encanto';
update public.lk_plans set access_kind='club',name='Clube do Coala',description='Novas formas de dizer eu te amo, todos os meses.',monthly_gifts=2,features='["2 novos presentes por mês pago","Presentes criados com acesso vitalício","Álbum e retrospectiva","Até 80 fotos por presente"]' where id='universo';
commit;
$migration$]) on conflict(version) do nothing;
select version,name from supabase_migrations.schema_migrations order by version;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160013','koala_ai',array[$migration$begin;
-- Reference portraits stay separate from recipient-visible memories.
create table public.lk_ai_references (
 id uuid primary key default gen_random_uuid(), gift_id uuid not null references public.lk_gifts(id) on delete cascade,
 subject text not null check(subject in ('sender','recipient')), storage_path text not null unique,
 mime text not null check(mime in ('image/jpeg','image/png','image/webp')),
 consent_at timestamptz not null, created_at timestamptz not null default now(), unique(gift_id,subject)
);
alter table public.lk_ai_references enable row level security;
revoke all on public.lk_ai_references from public,anon,authenticated;
grant all on public.lk_ai_references to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('love-ai-references','love-ai-references',false,1048576,array['image/jpeg','image/png','image/webp']);
alter table public.lk_image_jobs
 add column description text not null default '' check(length(description)<=1000),
 add column style text not null default 'storybook' check(style in ('storybook','watercolor','cinematic','travel')),
 add column prompt text not null default '' check(length(prompt)<=5000),
 add column reference_fingerprint text not null default '',
 add column run_id uuid, add column included boolean not null default true,
 add column completed_at timestamptz;
-- Exactly four completed images per eligible gift; successful slots cannot be regenerated.
update public.lk_plans set image_credits=case when id in ('encanto','universo') then 4 else 0 end;

create or replace function public.lk_save_ai_scene(p_gift uuid,p_slot integer,p_description text,p_style text,p_prompt text,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;p public.lk_plans;j public.lk_image_jobs;t public.lk_templates;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.status not in ('paid','published') or g.expires_at is null or g.expires_at<=now()
 or g.frozen or g.suspended or g.deleted_at is not null then raise exception 'PAYMENT_REQUIRED';end if;
 if g.access_kind='24h' and g.edit_expires_at<=now() then raise exception 'EDIT_EXPIRED';end if;
 select * into p from public.lk_plans where id=g.plan_id;
 if p.id not in ('encanto','universo') or p_slot<0 or p_slot>=least(4,p.image_credits) then raise exception 'IMAGE_LIMIT';end if;
 if length(p_description) not between 8 and 1000 or length(p_prompt) not between 20 and 5000
 or p_style not in ('storybook','watercolor','cinematic','travel') then raise exception 'AI_SCENE_INVALID';end if;
 select * into t from public.lk_templates where id=g.theme;
 insert into public.lk_image_jobs(gift_id,slot,template_version) values(p_gift,p_slot,t.version) on conflict(gift_id,slot) do nothing;
 select * into j from public.lk_image_jobs where gift_id=p_gift and slot=p_slot for update;
 if j.status in ('running','completed') or j.attempts>=3 then raise exception 'AI_SCENE_LOCKED';end if;
 update public.lk_image_jobs set description=p_description,style=p_style,prompt=p_prompt,
 reference_fingerprint=p_fingerprint,status='queued',error_code=null,updated_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end;$$;
create or replace function public.lk_claim_image(p_gift uuid,p_slot integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;p public.lk_plans;j public.lk_image_jobs;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.status not in ('paid','published') or g.expires_at is null or g.expires_at<=now()
 or g.frozen or g.suspended or g.deleted_at is not null then raise exception 'PAYMENT_REQUIRED';end if;
 if g.access_kind='24h' and g.edit_expires_at<=now() then raise exception 'EDIT_EXPIRED';end if;
 select * into p from public.lk_plans where id=g.plan_id;
 if p.id not in ('encanto','universo') or p_slot<0 or p_slot>=least(4,p.image_credits) then raise exception 'IMAGE_LIMIT';end if;
 select * into j from public.lk_image_jobs where gift_id=p_gift and slot=p_slot for update;
 if not found or length(j.prompt)<20 then raise exception 'AI_SCENE_REQUIRED';end if;
 if j.status='completed' or j.status='running' or j.attempts>=3 then return jsonb_build_object('claimed',false,'job',to_jsonb(j));end if;
 -- One provider request per gift at a time, also across browser tabs.
 if exists(select 1 from public.lk_image_jobs where gift_id=p_gift and status='running') then raise exception 'AI_BUSY';end if;
 update public.lk_image_jobs set status='running',attempts=attempts+1,run_id=gen_random_uuid(),error_code=null,updated_at=now()
 where id=j.id returning * into j;
 return jsonb_build_object('claimed',true,'job',to_jsonb(j));
end;$$;
revoke execute on function public.lk_save_ai_scene(uuid,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.lk_save_ai_scene(uuid,integer,text,text,text,text) to service_role;
revoke execute on function public.lk_claim_image(uuid,integer) from public,anon,authenticated;
grant execute on function public.lk_claim_image(uuid,integer) to service_role;
commit;
$migration$]) on conflict(version) do nothing;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610160014','ai_selection',array[$migration$begin;
-- Keep pre-existing artwork selections; new images wait for the creator's choice.
alter table public.lk_image_jobs alter column included set default false;
commit;
$migration$]) on conflict(version) do nothing;
