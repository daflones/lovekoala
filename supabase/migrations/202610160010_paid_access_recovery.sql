begin;
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
