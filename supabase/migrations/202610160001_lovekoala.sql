begin;
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
