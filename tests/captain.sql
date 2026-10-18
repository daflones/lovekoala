begin;
do $$
declare admin_id uuid:=gen_random_uuid();other_admin uuid:=gen_random_uuid();proposal uuid;second uuid;before_plan jsonb;after_plan jsonb;first_report jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(admin_id,'captain-test-'||admin_id||'@example.invalid',now(),'{}'),(other_admin,'captain-other-'||other_admin||'@example.invalid',now(),'{}');
 insert into public.lk_admins(user_id) values(admin_id),(other_admin);
 select to_jsonb(p) into before_plan from public.lk_plans p where id='encanto';after_plan:=before_plan||'{"price_cents":5990}';
 insert into public.lk_captain_proposals(admin_id,kind,target,summary,before_data,after_data) values(admin_id,'plan','encanto','Fixture de teste',before_plan,after_plan) returning id into proposal;
 begin perform public.lk_apply_captain_change(proposal,other_admin);raise exception 'OTHER_ADMIN_APPLIED';exception when others then if sqlerrm<>'PROPOSAL_NOT_FOUND' then raise;end if;end;
 perform public.lk_apply_captain_change(proposal,admin_id);perform public.lk_apply_captain_change(proposal,admin_id);
 if (select price_cents from public.lk_plans where id='encanto')<>5990 then raise exception 'PLAN_NOT_UPDATED';end if;
 if (select count(*) from public.lk_admin_audit where action='captain_change_applied' and details->>'proposal_id'=proposal::text)<>1 then raise exception 'DOUBLE_APPLY';end if;
 insert into public.lk_captain_proposals(admin_id,kind,target,summary,before_data,after_data) values(admin_id,'plan','encanto','Stale fixture',before_plan,after_plan) returning id into second;
 begin perform public.lk_apply_captain_change(second,admin_id);raise exception 'STALE_PLAN_OVERWRITTEN';exception when others then if sqlerrm<>'PROPOSAL_CONFLICT' then raise;end if;end;
 update public.lk_captain_proposals set expires_at=now()-interval '1 minute' where id=second;
 begin perform public.lk_apply_captain_change(second,admin_id);raise exception 'EXPIRED_PLAN_APPLIED';exception when others then if sqlerrm<>'PROPOSAL_EXPIRED' then raise;end if;end;
 first_report:=public.lk_captain_report(2026);if jsonb_array_length(first_report->'months')<>12 then raise exception 'MONTHS_MISSING';end if;
 if has_table_privilege('anon','public.lk_captain_proposals','SELECT') or has_function_privilege('authenticated','public.lk_apply_captain_change(uuid,uuid)','EXECUTE') then raise exception 'CAPTAIN_PRIVILEGES_EXPOSED';end if;
end $$;
rollback;
