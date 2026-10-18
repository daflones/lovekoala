begin;
create table public.lk_checkout_recovery(
 id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.lk_orders(id) on delete cascade,
 gift_id uuid not null references public.lk_gifts(id) on delete cascade,owner_user_id uuid references auth.users(id) on delete cascade,
 email text not null,plan_id text not null,provider text not null,billing_cycle text not null,amount_cents integer not null,
 summary jsonb not null,resume_origin text not null,status text not null default 'pending' check(status in ('pending','abandoned','recovered')),
 reason text not null default 'checkout_started',email_consent boolean not null default false,consented_at timestamptz,
 email_status text not null default 'none' check(email_status in ('none','queued','sending','sent','failed','unavailable','skipped')),
 email_requested_at timestamptz,scheduled_at timestamptz,sending_started_at timestamptz,sent_at timestamptz,
 attempts integer not null default 0,provider_message_id text,last_error text,message_payload jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(length(email)<=254),check(pg_column_size(summary)<5000),check(length(resume_origin)<300)
);
create index lk_recovery_status on public.lk_checkout_recovery(status,updated_at desc);
create index lk_recovery_queue on public.lk_checkout_recovery(email_status,scheduled_at) where email_consent and status<>'recovered';
create or replace function public.lk_capture_checkout(p_order uuid,p_origin text,p_consent boolean default null,p_reason text default 'checkout_started') returns public.lk_checkout_recovery
language plpgsql security definer set search_path='' as $$
declare o public.lk_orders;g public.lk_gifts;p public.lk_plans;r public.lk_checkout_recovery;
begin
 select * into o from public.lk_orders where id=p_order;
 select * into g from public.lk_gifts where id=o.gift_id;
 if o.id is null or g.id is null or g.deleted_at is not null then raise exception 'GIFT_NOT_FOUND';end if;
 if p_reason not in ('checkout_started','stripe_return','pix_closed','left_editor','expired','payment_failed','summary_requested') then raise exception 'INVALID_REASON';end if;
 if p_origin!~'^https://[a-zA-Z0-9.-]+(:[0-9]+)?$' then raise exception 'INVALID_ORIGIN';end if;
 select * into p from public.lk_plans where id=o.plan_id;
 insert into public.lk_checkout_recovery(order_id,gift_id,owner_user_id,email,plan_id,provider,billing_cycle,amount_cents,summary,resume_origin)
 values(o.id,g.id,g.owner_user_id,g.content->>'email',o.plan_id,o.provider,o.billing_cycle,o.amount_cents,
 jsonb_build_object('sender',g.content->>'sender','recipient',g.content->>'recipient','format',g.format,'plan_name',p.name,'photos',(select count(*) from public.lk_photos where gift_id=g.id),'music_title',g.content->>'music_title'),p_origin)
 on conflict(order_id) do nothing;
 select * into r from public.lk_checkout_recovery where order_id=o.id for update;
 update public.lk_checkout_recovery set
  status=case when o.status='paid' then 'recovered' when p_reason<>'checkout_started' then 'abandoned' else status end,
  reason=p_reason,updated_at=now(),
  email_consent=coalesce(p_consent,email_consent),
  consented_at=case when p_consent=true then coalesce(consented_at,now()) else consented_at end,
  email_status=case when o.status='paid' and email_status<>'sent' then 'skipped' when p_consent=false and email_status<>'sent' then 'none' when p_consent=true and email_status in ('none','unavailable') then 'queued' else email_status end,
  email_requested_at=case when p_consent=true and email_status in ('none','unavailable') then now() else email_requested_at end,
  scheduled_at=case when p_consent=true and email_status in ('none','unavailable') then now()+interval '15 minutes' else scheduled_at end
 where id=r.id returning * into r;return r;
end;$$;
create or replace function public.lk_recovery_paid() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='paid' then update public.lk_checkout_recovery set status='recovered',email_status=case when email_status='sent' then 'sent' else 'skipped' end,scheduled_at=null,updated_at=now() where order_id=new.id;end if;return new;
end;$$;
create trigger lk_order_recovery_paid after update of status on public.lk_orders for each row execute function public.lk_recovery_paid();
create or replace function public.lk_take_summary(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.lk_checkout_recovery;
begin
 update public.lk_checkout_recovery set email_status='sending',sending_started_at=now(),attempts=attempts+1
 where id=p_id and email_consent and status<>'recovered' and attempts<3 and scheduled_at<=now() and email_requested_at>now()-interval '7 days'
 and (email_status in ('queued','failed') or email_status='sending' and sending_started_at<now()-interval '5 minutes') returning * into r;
 return jsonb_build_object('claimed',found,'record',to_jsonb(r));
end;$$;
create or replace function public.lk_mark_abandoned() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;begin
 update public.lk_checkout_recovery set status='abandoned' where status='pending' and updated_at<now()-interval '15 minutes';get diagnostics n=row_count;return n;
end;$$;
create or replace function public.lk_get_mail_config() returns jsonb language sql security definer set search_path='' as $$
 select coalesce((select decrypted_secret::jsonb from vault.decrypted_secrets where name='lovekoala_mail_config' limit 1),'{}'::jsonb);
$$;
create or replace function public.lk_set_mail_config(p_config jsonb) returns void language plpgsql security definer set search_path='' as $$
declare secret_id uuid;begin
 if jsonb_typeof(p_config)<>'object' or pg_column_size(p_config)>4000 then raise exception 'CONFIG_INVALID';end if;
 perform pg_advisory_xact_lock(hashtext('lovekoala_mail_config'));
 select id into secret_id from vault.secrets where name='lovekoala_mail_config' limit 1;
 if secret_id is null then perform vault.create_secret(p_config::text,'lovekoala_mail_config','LoveKoala transactional summary email');
 else perform vault.update_secret(secret_id,p_config::text,'lovekoala_mail_config');end if;
end;$$;
-- Only opted-in, published histories participate. No dates or identifiers are returned.
create or replace function public.lk_safe_date(p_value text) returns date language plpgsql immutable set search_path='' as $$
declare d date;begin if p_value!~'^\d{4}-\d{2}-\d{2}$' then return null;end if;d:=p_value::date;if to_char(d,'YYYY-MM-DD')<>p_value then return null;end if;return d;exception when others then return null;end;$$;
create or replace function public.lk_couple_stats(p_days integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer;percent integer;begin
 if p_days<0 or p_days>36525 then raise exception 'INVALID_DURATION';end if;
 with histories as(select current_date-public.lk_safe_date(content->>'start_date') days from public.lk_gifts where status='published' and not suspended and not frozen and deleted_at is null and expires_at>now() and content->>'stats_consent'='true'),eligible as(select days from histories where days between 0 and 36525)
 select count(*),round(100.0*count(*) filter(where days<p_days)/nullif(count(*),0)/5)*5 into n,percent from eligible;
 if n<20 then return jsonb_build_object('available',false,'minimum',20);end if;
 return jsonb_build_object('available',true,'participants',n,'percentile',least(100,greatest(0,percent)));
end;$$;
alter table public.lk_checkout_recovery enable row level security;
revoke all on public.lk_checkout_recovery from anon,authenticated;
grant all on public.lk_checkout_recovery to service_role;
revoke execute on function public.lk_capture_checkout(uuid,text,boolean,text),public.lk_recovery_paid(),public.lk_take_summary(uuid),public.lk_mark_abandoned(),public.lk_get_mail_config(),public.lk_set_mail_config(jsonb),public.lk_safe_date(text),public.lk_couple_stats(integer) from public,anon,authenticated;
grant execute on function public.lk_capture_checkout(uuid,text,boolean,text),public.lk_take_summary(uuid),public.lk_mark_abandoned(),public.lk_get_mail_config(),public.lk_set_mail_config(jsonb),public.lk_couple_stats(integer) to service_role;
commit;
