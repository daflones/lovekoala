begin;
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
 if o.access_kind='club' and o.purpose='initial' then
  if g.checkout_email is not null then perform pg_advisory_xact_lock(hashtextextended('checkout-email:'||g.checkout_email,0));end if;
  if g.owner_user_id is not null then perform pg_advisory_xact_lock(hashtextextended(g.owner_user_id::text,0));end if;
  if exists(select 1 from public.lk_subscriptions x join public.lk_gifts xg on xg.id=x.gift_id where xg.id<>g.id and (x.owner_user_id=g.owner_user_id or xg.checkout_email=g.checkout_email) and xg.access_kind='club' and xg.deleted_at is null and (x.period_end>now() or x.auto_renew and x.status<>'canceled')) then raise exception 'APPROVAL_CONFLICT';end if;
  if exists(select 1 from public.lk_orders x join public.lk_gifts xg on xg.id=x.gift_id where x.id<>o.id and xg.id<>g.id and (xg.owner_user_id=g.owner_user_id or xg.checkout_email=g.checkout_email) and x.access_kind='club' and x.status in ('created','pending','uncertain')) then raise exception 'APPROVAL_CONFLICT';end if;
 end if;
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
commit;
