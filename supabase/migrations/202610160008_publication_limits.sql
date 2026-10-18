begin;
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
