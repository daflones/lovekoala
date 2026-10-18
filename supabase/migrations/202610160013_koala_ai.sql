begin;
-- Reference portraits stay separate from recipient-visible memories.
create table public.lk_ai_references (
 id uuid primary key default gen_random_uuid(), gift_id uuid not null references public.lk_gifts(id) on delete cascade,
 subject text not null check(subject in ('sender','recipient')), storage_path text not null unique,
 mime text not null check(mime in ('image/jpeg','image/png','image/webp')),
 consent_at timestamptz not null, created_at timestamptz not null default now(), unique(gift_id,subject)
);
alter table public.lk_ai_references enable row level security;
revoke all on public.lk_ai_references from public,anon,authenticated;
grant all on public.lk_ai_references to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('love-ai-references','love-ai-references',false,1048576,array['image/jpeg','image/png','image/webp']);
alter table public.lk_image_jobs
 add column description text not null default '' check(length(description)<=1000),
 add column style text not null default 'storybook' check(style in ('storybook','watercolor','cinematic','travel')),
 add column prompt text not null default '' check(length(prompt)<=5000),
 add column reference_fingerprint text not null default '',
 add column run_id uuid, add column included boolean not null default true,
 add column completed_at timestamptz;
-- Exactly four completed images per eligible gift; successful slots cannot be regenerated.
update public.lk_plans set image_credits=case when id in ('encanto','universo') then 4 else 0 end;

create or replace function public.lk_save_ai_scene(p_gift uuid,p_slot integer,p_description text,p_style text,p_prompt text,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;p public.lk_plans;j public.lk_image_jobs;t public.lk_templates;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.status not in ('paid','published') or g.expires_at is null or g.expires_at<=now()
 or g.frozen or g.suspended or g.deleted_at is not null then raise exception 'PAYMENT_REQUIRED';end if;
 if g.access_kind='24h' and g.edit_expires_at<=now() then raise exception 'EDIT_EXPIRED';end if;
 select * into p from public.lk_plans where id=g.plan_id;
 if p.id not in ('encanto','universo') or p_slot<0 or p_slot>=least(4,p.image_credits) then raise exception 'IMAGE_LIMIT';end if;
 if length(p_description) not between 8 and 1000 or length(p_prompt) not between 20 and 5000
 or p_style not in ('storybook','watercolor','cinematic','travel') then raise exception 'AI_SCENE_INVALID';end if;
 select * into t from public.lk_templates where id=g.theme;
 insert into public.lk_image_jobs(gift_id,slot,template_version) values(p_gift,p_slot,t.version) on conflict(gift_id,slot) do nothing;
 select * into j from public.lk_image_jobs where gift_id=p_gift and slot=p_slot for update;
 if j.status in ('running','completed') or j.attempts>=3 then raise exception 'AI_SCENE_LOCKED';end if;
 update public.lk_image_jobs set description=p_description,style=p_style,prompt=p_prompt,
 reference_fingerprint=p_fingerprint,status='queued',error_code=null,updated_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end;$$;
create or replace function public.lk_claim_image(p_gift uuid,p_slot integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.lk_gifts;p public.lk_plans;j public.lk_image_jobs;
begin
 select * into g from public.lk_gifts where id=p_gift for update;
 if not found or g.status not in ('paid','published') or g.expires_at is null or g.expires_at<=now()
 or g.frozen or g.suspended or g.deleted_at is not null then raise exception 'PAYMENT_REQUIRED';end if;
 if g.access_kind='24h' and g.edit_expires_at<=now() then raise exception 'EDIT_EXPIRED';end if;
 select * into p from public.lk_plans where id=g.plan_id;
 if p.id not in ('encanto','universo') or p_slot<0 or p_slot>=least(4,p.image_credits) then raise exception 'IMAGE_LIMIT';end if;
 select * into j from public.lk_image_jobs where gift_id=p_gift and slot=p_slot for update;
 if not found or length(j.prompt)<20 then raise exception 'AI_SCENE_REQUIRED';end if;
 if j.status='completed' or j.status='running' or j.attempts>=3 then return jsonb_build_object('claimed',false,'job',to_jsonb(j));end if;
 -- One provider request per gift at a time, also across browser tabs.
 if exists(select 1 from public.lk_image_jobs where gift_id=p_gift and status='running') then raise exception 'AI_BUSY';end if;
 update public.lk_image_jobs set status='running',attempts=attempts+1,run_id=gen_random_uuid(),error_code=null,updated_at=now()
 where id=j.id returning * into j;
 return jsonb_build_object('claimed',true,'job',to_jsonb(j));
end;$$;
revoke execute on function public.lk_save_ai_scene(uuid,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.lk_save_ai_scene(uuid,integer,text,text,text,text) to service_role;
revoke execute on function public.lk_claim_image(uuid,integer) from public,anon,authenticated;
grant execute on function public.lk_claim_image(uuid,integer) to service_role;
commit;
