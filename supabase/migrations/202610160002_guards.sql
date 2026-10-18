begin;
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
