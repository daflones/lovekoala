begin;
-- Exercise grandfathered purchases using the former offer, entirely in rollback.
update public.lk_plans set access_kind='legacy',access_days=365 where id='carinho';
do $$
declare g uuid;old_g uuid;monthly_g uuid;o public.lk_orders;old_o public.lk_orders;monthly_o public.lk_orders;t timestamptz;until_date timestamptz;restored boolean;
begin
 if has_function_privilege('anon','public.lk_restore_paid_access(uuid)','EXECUTE') or has_function_privilege('authenticated','public.lk_restore_paid_access(uuid)','EXECUTE') then raise exception 'RESTORE_ACCESS_RPC_EXPOSED';end if;
 insert into public.lk_gifts(edit_token_hash,format,plan_id,content,public_consent)
 values(repeat('f',64),'retrospectiva','carinho','{"sender":"QA","recipient":"Acesso","letter":"Mensagem"}',true) returning id into g;
 perform public.lk_add_photo(g,g::text||'/fixture.png');
 o:=public.lk_prepare_order_v2(g,'carinho','mercosulpay',gen_random_uuid(),'once');
 begin perform public.lk_restore_paid_access(o.id);raise exception 'UNPAID_ACCESS_GRANTED';exception when others then if sqlerrm<>'PAYMENT_REQUIRED' then raise;end if;end;
 t:=now()-interval '10 minutes';update public.lk_orders set status='paid',paid_at=t,provider_id='qa_restore_once' where id=o.id;
 restored:=public.lk_restore_paid_access(o.id);if not restored then raise exception 'PAID_ACCESS_NOT_RESTORED';end if;
 select expires_at into until_date from public.lk_gifts where id=g;
 if (select status from public.lk_gifts where id=g)<>'paid' or until_date<>t+interval '365 days' or (select paid_at from public.lk_gifts where id=g)<>t then raise exception 'ACCESS_PERIOD_WRONG';end if;
 if public.lk_restore_paid_access(o.id) or (select expires_at from public.lk_gifts where id=g)<>until_date then raise exception 'REPLAY_EXTENDS_ACCESS';end if;
 perform public.lk_publish(g,'qa-recovered-publish');if(select status from public.lk_gifts where id=g)<>'published' then raise exception 'RECOVERED_GIFT_NOT_PUBLISHED';end if;
 update public.lk_gifts set suspended=true where id=g;
 if public.lk_restore_paid_access(o.id) or not(select suspended from public.lk_gifts where id=g) then raise exception 'PAUSE_BYPASSED';end if;
 update public.lk_gifts set status='refunded',expires_at=null where id=g;
 begin perform public.lk_restore_paid_access(o.id);raise exception 'REFUNDED_ACCESS_RESTORED';exception when others then if sqlerrm<>'GIFT_NOT_FOUND' then raise;end if;end;
 insert into public.lk_gifts(edit_token_hash,format,plan_id,content) values(repeat('f',64),'album','carinho','{"sender":"QA","recipient":"Vencido","letter":"Mensagem"}') returning id into old_g;
 old_o:=public.lk_prepare_order_v2(old_g,'carinho','mercosulpay',gen_random_uuid(),'once');
 update public.lk_orders set status='paid',paid_at=now()-interval '2 years',provider_id='qa_restore_expired' where id=old_o.id;
 perform public.lk_restore_paid_access(old_o.id);
 if not(select frozen from public.lk_gifts where id=old_g) or (select expires_at from public.lk_gifts where id=old_g)>now() then raise exception 'EXPIRED_ACCESS_RESTARTED';end if;
 insert into public.lk_gifts(edit_token_hash,format,plan_id,content) values(repeat('f',64),'album','carinho','{"sender":"QA","recipient":"Mensal","letter":"Mensagem"}') returning id into monthly_g;
 monthly_o:=public.lk_prepare_order_v2(monthly_g,'carinho','mercosulpay',gen_random_uuid(),'monthly');
 update public.lk_orders set status='paid',paid_at=t,provider_id='qa_restore_monthly' where id=monthly_o.id;
 perform public.lk_restore_paid_access(monthly_o.id);
 if (select expires_at from public.lk_gifts where id=monthly_g)<>t+interval '1 month' then raise exception 'MONTHLY_PERIOD_WRONG';end if;
 if (select count(*) from public.lk_billing_receipts where provider_invoice_id='qa_restore_monthly')<>1 then raise exception 'MONTHLY_RECEIPT_MISSING';end if;
 if public.lk_restore_paid_access(monthly_o.id) or (select count(*) from public.lk_billing_receipts where provider_invoice_id='qa_restore_monthly')<>1 then raise exception 'MONTHLY_REPLAY_DUPLICATED';end if;
end;$$;
select 'PASS: paid order without access restored, owner publication, preserved dates, replay idempotency, unpaid/refund/expired protections, monthly receipt and private RPC' as result;
rollback;
