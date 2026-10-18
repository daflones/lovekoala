begin;
-- Aggregate only published, accessible relationships; no row-level data leaves this RPC.
create or replace function public.lk_city_key(p_value text) returns text
language sql immutable security invoker set search_path='' as $$
 select trim(regexp_replace(translate(lower(coalesce(p_value,'')),
 'áàâãäåéèêëíìîïóòôõöúùûüçñ','aaaaaaeeeeiiiiooooouuuucn'),'[^a-z0-9]+',' ','g'));
$$;
create or replace function public.lk_story_stats(p_days integer,p_city text default '',p_state text default '')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare n integer; shorter integer; local_n integer; local_shorter integer; local_longer integer;
 city_key text:=public.lk_city_key(p_city); state_key text:=upper(trim(coalesce(p_state,''))); result jsonb;
begin
 if p_days is null or p_days<0 or p_days>36525 then raise exception 'INVALID_DURATION';end if;
 if length(coalesce(p_city,''))>100 or (state_key<>'' and state_key<>all(array['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'])) then raise exception 'INVALID_CITY';end if;
 with raw as(
  select id,updated_at,
   least(lower(trim(content->>'sender')),lower(trim(content->>'recipient'))) a,
   greatest(lower(trim(content->>'sender')),lower(trim(content->>'recipient'))) b,
   public.lk_safe_date(content->>'start_date') started,
   case when content->>'start_time' ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then content->>'start_time' else '00:00' end began_time,
   public.lk_city_key(content->>'relationship_city') city,upper(trim(content->>'relationship_state')) state
  from public.lk_gifts where status='published' and not suspended and not frozen and deleted_at is null and expires_at>now()
   and nullif(trim(content->>'sender'),'') is not null and nullif(trim(content->>'recipient'),'') is not null
 ),deduplicated as(
  select distinct on(a,b,started) a,b,started,began_time,city,state from raw where started is not null
  order by a,b,started,updated_at desc,id desc
 ),histories as(
  select floor(extract(epoch from(now()-(started::text||'T'||began_time||':00-03:00')::timestamptz))/86400)::integer days,city,state from deduplicated
 ),eligible as materialized(select days,city,state from histories where days between 0 and 36525)
 select count(*),count(*) filter(where days<p_days),
  count(*) filter(where city_key<>'' and state_key<>'' and city=city_key and state=state_key),
  count(*) filter(where city_key<>'' and state_key<>'' and city=city_key and state=state_key and days<p_days),
  count(*) filter(where city_key<>'' and state_key<>'' and city=city_key and state=state_key and days>p_days)
 into n,shorter,local_n,local_shorter,local_longer from eligible;
 if n<20 then return jsonb_build_object('available',false);end if;
 result:=jsonb_build_object('available',true,'participants',n,
  'percentile',round(100.0*shorter/n/5)*5,
  'top_percent',greatest(5,ceil(100.0*(n-shorter)/n/5)*5));
 if local_n>=20 then
  result:=result||jsonb_build_object('city',jsonb_build_object('available',true,'participants',local_n,
   'rank',local_longer+1,'percentile',round(100.0*local_shorter/local_n/5)*5));
 end if;
 return result;
end;$$;
-- Preserve the legacy internal signature without maintaining two calculations.
create or replace function public.lk_couple_stats(p_days integer) returns jsonb
language sql stable security invoker set search_path='' as $$select public.lk_story_stats(p_days,'','');$$;
revoke execute on function public.lk_city_key(text),public.lk_story_stats(integer,text,text),public.lk_couple_stats(integer) from public,anon,authenticated;
grant execute on function public.lk_city_key(text),public.lk_story_stats(integer,text,text),public.lk_couple_stats(integer) to service_role;
commit;
