begin;
-- Show only a real aggregate once twenty published histories are available.
-- Pair + start date deduplicates multiple gifts for the same relationship.
create or replace function public.lk_couple_stats(p_days integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer;percent integer;begin
 if p_days<0 or p_days>36525 then raise exception 'INVALID_DURATION';end if;
 with histories as(
  select distinct least(lower(trim(content->>'sender')),lower(trim(content->>'recipient'))) a,
  greatest(lower(trim(content->>'sender')),lower(trim(content->>'recipient'))) b,
  public.lk_safe_date(content->>'start_date') started
  from public.lk_gifts where status='published' and not suspended and not frozen and deleted_at is null and expires_at>now()
 ),eligible as(select (now() at time zone 'America/Sao_Paulo')::date-started days from histories where started is not null)
 select count(*),round(100.0*count(*) filter(where days<p_days)/nullif(count(*),0)/5)*5 into n,percent from eligible where days between 0 and 36525;
 if n<20 then return jsonb_build_object('available',false);end if;
 return jsonb_build_object('available',true,'participants',n,'percentile',least(100,greatest(0,percent)));
end;$$;
-- Cron can also repair the uncommon paid-order/missing-grant inconsistency.
create or replace function public.lk_incomplete_paid_orders() returns setof public.lk_orders language sql security definer set search_path='' as $$
 select o.* from public.lk_orders o join public.lk_gifts g on g.id=o.gift_id where o.status='paid' and o.purpose='initial' and g.expires_at is null and g.deleted_at is null and g.status<>'refunded' and not g.suspended order by o.paid_at limit 25;
$$;
revoke execute on function public.lk_incomplete_paid_orders() from public,anon,authenticated;
grant execute on function public.lk_incomplete_paid_orders() to service_role;
commit;
