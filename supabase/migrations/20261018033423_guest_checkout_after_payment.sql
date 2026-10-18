begin;
alter table public.lk_gifts add column if not exists checkout_email text;
update public.lk_gifts g set checkout_email=lower(trim(g.content->>'email')) where checkout_email is null and exists(select 1 from public.lk_orders o where o.gift_id=g.id);
create index if not exists lk_guest_checkout_email on public.lk_gifts(checkout_email) where owner_user_id is null;
create table public.lk_guest_resumes(
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),gift_id uuid not null references public.lk_gifts(id) on delete cascade,
 expires_at timestamptz not null default now()+interval '30 days',consumed_at timestamptz,created_at timestamptz not null default now()
);
alter table public.lk_guest_resumes enable row level security;
revoke all on public.lk_guest_resumes from anon,authenticated;
grant all on public.lk_guest_resumes to service_role;
create or replace function public.lk_prepare_order_v2(p_gift uuid,p_plan text,p_provider text,p_request uuid,p_cycle text default 'once') returns public.lk_orders
language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;p public.lk_plans;o public.lk_orders;s public.lk_subscriptions;amount integer;purpose text:='initial';
begin
 if p_cycle not in ('once','monthly') or p_provider not in ('stripe','mercosulpay') then raise exception 'PLAN_INCOMPATIBLE';end if;
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.deleted_at is not null or g.suspended then raise exception 'GIFT_NOT_FOUND';end if;
 if not exists(select 1 from public.lk_orders where gift_id=g.id and status in ('created','pending','uncertain','paid')) then
  update public.lk_gifts set checkout_email=lower(trim(content->>'email')) where id=g.id returning * into g;
 end if;
 select * into p from public.lk_plans where id=p_plan and active;
 if not found or not(g.format=any(p.formats)) then raise exception 'PLAN_INCOMPATIBLE';end if;
 if (select count(*) from public.lk_photos where gift_id=p_gift)>p.max_photos then raise exception 'PHOTO_LIMIT';end if;
 amount:=case when p_cycle='monthly' then p.monthly_price_cents else p.price_cents end;
 if amount is null or amount<=0 then raise exception 'PLAN_INCOMPATIBLE';end if;
 if g.status='draft' and not exists(select 1 from public.lk_orders where gift_id=g.id and status in ('created','pending','uncertain','paid')) then
  if (p.access_kind='club' and p_cycle<>'monthly') or (p.access_kind in ('24h','lifetime') and p_cycle<>'once') then raise exception 'PLAN_INCOMPATIBLE';end if;
  if p.access_kind='club' then
   if coalesce(g.checkout_email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'EMAIL_REQUIRED';end if;
   perform pg_advisory_xact_lock(hashtextextended('checkout-email:'||g.checkout_email,0));
   if g.owner_user_id is not null then perform pg_advisory_xact_lock(hashtextextended(g.owner_user_id::text,0));end if;
   if exists(select 1 from public.lk_subscriptions x join public.lk_gifts xg on xg.id=x.gift_id where (x.owner_user_id=g.owner_user_id or xg.checkout_email=g.checkout_email) and xg.access_kind='club' and (x.period_end>now() or x.auto_renew and x.status<>'canceled') and xg.deleted_at is null) then raise exception 'CLUB_EXISTS';end if;
   if exists(select 1 from public.lk_orders x join public.lk_gifts xg on xg.id=x.gift_id where (xg.owner_user_id=g.owner_user_id or xg.checkout_email=g.checkout_email) and x.access_kind='club' and x.status in ('created','pending','uncertain')) then raise exception 'ORDER_PENDING';end if;
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

-- Called only after the Edge Function checks both JWT and the private edit capability.
create or replace function public.lk_claim_gift_owner(p_gift uuid,p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;u auth.users;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.deleted_at is not null then raise exception 'GIFT_NOT_FOUND';end if;
 if g.owner_user_id is not null and g.owner_user_id<>p_owner then raise exception 'GIFT_OWNER';end if;
 select * into u from auth.users where id=p_owner;
 if not found then raise exception 'ACCOUNT_REQUIRED';end if;
 if g.owner_user_id is null and exists(select 1 from public.lk_orders where gift_id=g.id and status='paid') then
  if u.email_confirmed_at is null or lower(trim(u.email)) is distinct from g.checkout_email then raise exception 'CHECKOUT_EMAIL_REQUIRED';end if;
 end if;
 update public.lk_gifts set owner_user_id=p_owner,updated_at=now() where id=g.id;
 update public.lk_subscriptions set owner_user_id=p_owner,updated_at=now() where gift_id=g.id and (owner_user_id is null or owner_user_id=p_owner);
 update public.lk_guest_resumes set consumed_at=coalesce(consumed_at,now()) where gift_id=g.id;
end;$$;
create or replace function public.lk_resume_guest_checkout(p_hash text,p_edit_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.lk_guest_resumes;g public.lk_gifts;
begin
 if p_hash !~ '^[a-f0-9]{64}$' or p_edit_hash !~ '^[a-f0-9]{64}$' then raise exception 'RESUME_INVALID';end if;
 select * into r from public.lk_guest_resumes where token_hash=p_hash for update;
 if not found or r.expires_at<=now() then raise exception 'RESUME_INVALID';end if;
 select * into g from public.lk_gifts where id=r.gift_id for update;
 if not found or g.owner_user_id is not null or g.deleted_at is not null or g.suspended then raise exception 'RESUME_INVALID';end if;
 if r.consumed_at is not null then
  if g.edit_token_hash=p_edit_hash then return g.id;end if;raise exception 'RESUME_INVALID';
 end if;
 update public.lk_guest_resumes set consumed_at=now() where token_hash=p_hash;
 update public.lk_gifts set edit_token_hash=p_edit_hash where id=g.id;
 return g.id;
end;$$;
revoke execute on function public.lk_claim_gift_owner(uuid,uuid),public.lk_resume_guest_checkout(text,text) from public,anon,authenticated;
grant execute on function public.lk_claim_gift_owner(uuid,uuid),public.lk_resume_guest_checkout(text,text) to service_role;
commit;
