begin;
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
