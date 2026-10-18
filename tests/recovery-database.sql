begin;
do $$
declare g uuid;g2 uuid;o public.lk_orders;second_order public.lk_orders;r public.lk_checkout_recovery;j jsonb;n integer;i integer;
begin
 if has_table_privilege('anon','public.lk_checkout_recovery','SELECT') or has_table_privilege('authenticated','public.lk_checkout_recovery','SELECT') then raise exception 'RECOVERY_TABLE_EXPOSED';end if;
 if has_function_privilege('authenticated','public.lk_get_mail_config()','EXECUTE') or has_function_privilege('anon','public.lk_set_mail_config(jsonb)','EXECUTE') or has_function_privilege('authenticated','public.lk_take_summary(uuid)','EXECUTE') or has_function_privilege('anon','public.lk_couple_stats(integer)','EXECUTE') then raise exception 'PRIVATE_RPC_EXPOSED';end if;
 insert into public.lk_gifts(edit_token_hash,format,plan_id,content,public_consent) values(repeat('c',64),'album','carinho','{"sender":"QA","recipient":"Recuperação","email":"qa@lovekoala.invalid","letter":"Carta"}',true) returning id into g;
 perform public.lk_add_photo(g,g::text||'/qa.png');
 o:=public.lk_prepare_order_v2(g,'carinho','stripe',gen_random_uuid(),'once');
 update public.lk_orders set created_at=now()-interval '1 hour' where id=o.id;
 r:=public.lk_capture_checkout(o.id,'https://lovekoala.test');
 if r.email_consent or r.email_status<>'none' or r.status<>'pending' or r.summary->>'photos'<>'1' or r.email<>'qa@lovekoala.invalid' then raise exception 'CAPTURE_DEFAULTS';end if;
 r:=public.lk_capture_checkout(o.id,'https://lovekoala.test',true,'stripe_return');
 if not r.email_consent or r.email_status<>'queued' or r.status<>'abandoned' or r.scheduled_at<now()+interval '14 minutes' then raise exception 'OPTIN_DELAY';end if;
 j:=public.lk_take_summary(r.id);if (j->>'claimed')::boolean then raise exception 'EARLY_MAIL_CLAIM';end if;
 update public.lk_checkout_recovery set scheduled_at=now()-interval '1 second' where id=r.id;
 j:=public.lk_take_summary(r.id);if not (j->>'claimed')::boolean then raise exception 'SUMMARY_NOT_CLAIMED';end if;
 j:=public.lk_take_summary(r.id);if (j->>'claimed')::boolean then raise exception 'DOUBLE_SUMMARY_CLAIM';end if;
 r:=public.lk_capture_checkout(o.id,'https://lovekoala.test',false,'left_editor');if r.email_status<>'none' or r.email_consent then raise exception 'CONSENT_REVOCATION';end if;
 update public.lk_orders set status='failed' where id=o.id;
 second_order:=public.lk_prepare_order_v2(g,'carinho','stripe',gen_random_uuid(),'once');
 r:=public.lk_capture_checkout(second_order.id,'https://lovekoala.test',true);
 update public.lk_orders set provider_id='cs_qa_recovery' where id=second_order.id;
 perform public.lk_confirm_order(second_order.id,'stripe','cs_qa_recovery',second_order.amount_cents,'BRL');
 if exists(select 1 from public.lk_checkout_recovery where gift_id=g and (status<>'recovered' or email_status<>'skipped')) then raise exception 'PAID_DID_NOT_RECOVER_HISTORY';end if;
 r:=public.lk_capture_checkout(o.id,'https://lovekoala.test',true,'summary_requested');if r.status<>'recovered' or r.email_status<>'skipped' then raise exception 'OLDER_ATTEMPT_REOPENED';end if;
 j:=public.lk_take_summary(r.id);if (j->>'claimed')::boolean then raise exception 'PAID_MAIL_ALLOWED';end if;
 -- Publication rechecks the acquired product after any edits during checkout.
 update public.lk_gifts set format='ambos' where id=g;
 begin perform public.lk_publish(g,'qa-recovery-rollback');raise exception 'WRONG_FORMAT_PUBLISHED';exception when others then if sqlerrm<>'PLAN_INCOMPATIBLE' then raise;end if;end;
 update public.lk_gifts set format='album' where id=g;
 insert into public.lk_photos(gift_id,storage_path,sort_order) select g,g::text||'/'||x||'.png',x from generate_series(1,20) x;
 begin perform public.lk_publish(g,'qa-recovery-rollback');raise exception 'PHOTO_LIMIT_BYPASSED';exception when others then if sqlerrm<>'PLAN_INCOMPATIBLE' then raise;end if;end;
 -- Isolate cohort contents inside this rolled-back transaction; other sessions see committed data.
 update public.lk_gifts set status='paid' where status='published';
 for i in 1..19 loop
  insert into public.lk_gifts(edit_token_hash,format,plan_id,status,expires_at,content) values(repeat('d',64),'album','carinho','published',now()+interval '1 day',jsonb_build_object('sender','QA pessoa '||i,'recipient','QA amor '||i,'start_date',(current_date-i)::text,'stats_consent',true));
 end loop;
 j:=public.lk_couple_stats(10);if (j->>'available')::boolean or j ? 'minimum' or j ? 'percentile' then raise exception 'SMALL_COHORT_DISCLOSED';end if;
 insert into public.lk_gifts(edit_token_hash,format,plan_id,status,expires_at,content) values(repeat('e',64),'album','carinho','published',now()+interval '1 day',jsonb_build_object('sender','QA pessoa 19','recipient','QA amor 19','start_date',(current_date-19)::text));
 j:=public.lk_couple_stats(10);if (j->>'available')::boolean then raise exception 'SAME_COUPLE_COUNTED_TWICE';end if;
 insert into public.lk_gifts(edit_token_hash,format,plan_id,status,expires_at,content) values(repeat('e',64),'album','carinho','published',now()+interval '1 day',jsonb_build_object('sender','QA pessoa 20','recipient','QA amor 20','start_date',(current_date-20)::text,'stats_consent',true));
 j:=public.lk_couple_stats(10);if not (j->>'available')::boolean or j->>'participants'<>'20' or j->>'percentile'<>'45' then raise exception 'COHORT_CALCULATION';end if;
 if j ? 'start_date' or j ? 'names' then raise exception 'COHORT_LEAK';end if;
 if public.lk_safe_date('2026-02-31') is not null or public.lk_safe_date('garbage') is not null then raise exception 'INVALID_DATE_ACCEPTED';end if;
end;$$;
select 'PASS: recovery capture, delayed consent, atomic claim, no mail after payment, recovered retries, publication limits, private Vault and anonymous cohort threshold' as result;
rollback;
