begin;
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
