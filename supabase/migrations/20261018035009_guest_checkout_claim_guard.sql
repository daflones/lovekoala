begin;
-- All attachment paths use this RPC, including autosave. A pending payment
-- already fixes the purchaser email; do not let another account claim it.
create or replace function public.lk_claim_gift_owner(p_gift uuid,p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;u auth.users;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.deleted_at is not null then raise exception 'GIFT_NOT_FOUND';end if;
 if g.owner_user_id is not null and g.owner_user_id<>p_owner then raise exception 'GIFT_OWNER';end if;
 select * into u from auth.users where id=p_owner;
 if not found then raise exception 'ACCOUNT_REQUIRED';end if;
 if g.owner_user_id is null and exists(select 1 from public.lk_orders where gift_id=g.id and status in ('created','pending','uncertain','paid')) then
  if u.email_confirmed_at is null or lower(trim(u.email)) is distinct from g.checkout_email then raise exception 'CHECKOUT_EMAIL_REQUIRED';end if;
 end if;
 update public.lk_gifts set owner_user_id=p_owner,updated_at=now() where id=g.id;
 update public.lk_subscriptions set owner_user_id=p_owner,updated_at=now() where gift_id=g.id and (owner_user_id is null or owner_user_id=p_owner);
 update public.lk_guest_resumes set consumed_at=coalesce(consumed_at,now()) where gift_id=g.id;
end;$$;
revoke execute on function public.lk_claim_gift_owner(uuid,uuid) from public,anon,authenticated;
grant execute on function public.lk_claim_gift_owner(uuid,uuid) to service_role;
commit;
