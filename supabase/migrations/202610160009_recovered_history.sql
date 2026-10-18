begin;
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
