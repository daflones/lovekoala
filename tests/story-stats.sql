-- Every synthetic row and temporary isolation change is rolled back.
begin;
set local statement_timeout='10s';
do $$
declare j jsonb;i integer;today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if has_function_privilege('anon','public.lk_story_stats(integer,text,text)','EXECUTE') or has_function_privilege('authenticated','public.lk_story_stats(integer,text,text)','EXECUTE') or has_function_privilege('anon','public.lk_couple_stats(integer)','EXECUTE') then raise exception 'AGGREGATE_RPC_EXPOSED';end if;
 update public.lk_gifts set status='paid' where status='published';
 j:=public.lk_story_stats(10,'Teresópolis','RJ');if j<>'{"available":false}'::jsonb then raise exception 'EMPTY_COHORT';end if;
 for i in 1..19 loop
  insert into public.lk_gifts(edit_token_hash,format,plan_id,status,expires_at,content) values(repeat('f',64),'album','carinho','published','infinity',jsonb_build_object('sender','Pessoa '||i,'recipient','Amor '||i,'start_date',(today-i)::text,'relationship_city',case when i%2=0 then 'Teresópolis' else '  teresopolis  ' end,'relationship_state','RJ','stats_consent',false));
 end loop;
 j:=public.lk_story_stats(10,'Teresópolis','RJ');if j<>'{"available":false}'::jsonb then raise exception 'NINETEEN_DISCLOSED';end if;
 insert into public.lk_gifts(edit_token_hash,format,plan_id,status,expires_at,updated_at,content) values(repeat('f',64),'album','carinho','published','infinity',now()+interval '1 second',jsonb_build_object('sender',' AMOR 19 ','recipient','PESSOA 19','start_date',(today-19)::text,'relationship_city','TERESÓPOLIS','relationship_state','RJ'));
 j:=public.lk_story_stats(10,'Teresópolis','RJ');if j<>'{"available":false}'::jsonb then raise exception 'DUPLICATE_COUNTED';end if;
 insert into public.lk_gifts(edit_token_hash,format,plan_id,status,expires_at,content) values(repeat('f',64),'album','carinho','published','infinity',jsonb_build_object('sender','Pessoa 20','recipient','Amor 20','start_date',(today-20)::text,'relationship_city','Teresópolis','relationship_state','RJ'));
 j:=public.lk_story_stats(10,'Teresopolis','rj');
 if j->>'participants'<>'20' or j->>'percentile'<>'45' or j->>'top_percent'<>'55' or j#>>'{city,participants}'<>'20' or j#>>'{city,rank}'<>'11' then raise exception 'BAD_PERCENT_OR_LOCAL_RANK: %',j;end if;
 if j ? 'names' or j ? 'start_date' or j ? 'cities' or j::text like '%Pessoa%' then raise exception 'PERSONAL_DATA_LEAK';end if;
 j:=public.lk_story_stats(20,'Teresópolis','SP');if j ? 'city' then raise exception 'STATE_MISMATCH';end if;
 update public.lk_gifts set content=content-'relationship_city' where content->>'sender'='Pessoa 20';
 j:=public.lk_story_stats(10,'Teresópolis','RJ');if j ? 'city' or j->>'participants'<>'20' then raise exception 'SMALL_CITY_DISCLOSED';end if;
 -- Inaccessible, undated and unnamed rows must not affect the published cohort.
 insert into public.lk_gifts(edit_token_hash,format,plan_id,status,expires_at,suspended,content) values(repeat('f',64),'album','carinho','published','infinity',true,jsonb_build_object('sender','Suspenso','recipient','Amor','start_date',(today-100)::text));
 insert into public.lk_gifts(edit_token_hash,format,plan_id,status,expires_at,content) values(repeat('f',64),'album','carinho','published',now()-interval '1 second',jsonb_build_object('sender','Expirado','recipient','Amor','start_date',(today-100)::text)),(repeat('f',64),'album','carinho','published','infinity',jsonb_build_object('sender','Sem data','recipient','Amor','start_date','2024-02-31')),(repeat('f',64),'album','carinho','published','infinity',jsonb_build_object('start_date',(today-100)::text));
 j:=public.lk_couple_stats(10);if j->>'participants'<>'20' then raise exception 'INELIGIBLE_COUNTED';end if;
 j:=public.lk_story_stats(36525);if j->>'percentile'<>'100' or j->>'top_percent'<>'5' then raise exception 'TOP_BOUNDARY';end if;
 begin perform public.lk_story_stats(-1);raise exception 'INVALID_ACCEPTED';exception when others then if sqlerrm<>'INVALID_DURATION' then raise;end if;end;
 begin perform public.lk_story_stats(10,'Cidade','XX');raise exception 'INVALID_ACCEPTED';exception when others then if sqlerrm<>'INVALID_CITY' then raise;end if;end;
end;$$;
select 'PASS: thresholds 19/20, city threshold, accent normalization, states, ties, duplicates, expiry, privacy, grants and range checks' as result;
rollback;
