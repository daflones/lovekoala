begin;
-- Exercise grandfathered purchases using the former offer, entirely in rollback.
update public.lk_plans set access_kind='legacy',access_days=365 where id='carinho';
do $$
declare g uuid;g2 uuid;o public.lk_orders;r public.lk_orders;s public.lk_subscriptions;n boolean;until_date timestamptz;price integer;
begin
 insert into public.lk_gifts(edit_token_hash,format,plan_id,content,public_consent)
 values(repeat('b',64),'album','carinho','{"sender":"Teste mensal","recipient":"QA","letter":"Carta preservada"}',true) returning id into g;
 perform public.lk_add_photo(g,g::text||'/monthly.png');
 select monthly_price_cents into price from public.lk_plans where id='carinho';
 o:=public.lk_prepare_order_v2(g,'carinho','mercosulpay',gen_random_uuid(),'monthly');
 if o.amount_cents<>price or o.purpose<>'initial' then raise exception 'MONTHLY_PRICE';end if;
 r:=public.lk_prepare_order_v2(g,'carinho','mercosulpay',gen_random_uuid(),'monthly');
 if r.id<>o.id then raise exception 'DUPLICATE_ACTIVE_ORDER';end if;
 update public.lk_orders set provider_id='qa_pix_initial' where id=o.id;
 begin perform public.lk_confirm_order(o.id,'mercosulpay','qa_pix_initial',1,'BRL');raise exception 'WRONG_AMOUNT_ALLOWED';exception when others then if sqlerrm<>'PAYMENT_MISMATCH' then raise;end if;end;
 n:=public.lk_confirm_order(o.id,'mercosulpay','qa_pix_initial',price,'BRL');if not n then raise exception 'MONTHLY_CONFIRM';end if;
 select * into s from public.lk_subscriptions where gift_id=g;
 if s.auto_renew or s.period_end<now()+interval '27 days' or s.period_end>now()+interval '32 days' then raise exception 'MANUAL_MONTH_PERIOD';end if;
 until_date:=s.period_end;
 n:=public.lk_confirm_order(o.id,'mercosulpay','qa_pix_initial',price,'BRL');if n or (select expires_at from public.lk_gifts where id=g)<>until_date then raise exception 'DUPLICATE_EXTENDS_ACCESS';end if;
 perform public.lk_publish(g,'qa-monthly-rollback');
 begin perform public.lk_prepare_order_v2(g,'carinho','mercosulpay',gen_random_uuid(),'monthly');raise exception 'EARLY_RENEW_ALLOWED';exception when others then if sqlerrm<>'RENEWAL_NOT_DUE' then raise;end if;end;
 update public.lk_subscriptions set period_end=now()-interval '1 minute' where gift_id=g;
 update public.lk_gifts set expires_at=now()-interval '1 minute' where id=g;
 perform public.lk_freeze_expired();
 if not(select frozen from public.lk_gifts where id=g) then raise exception 'FREEZE_FAILED';end if;
 if (select content->>'letter' from public.lk_gifts where id=g)<>'Carta preservada' or (select count(*) from public.lk_photos where gift_id=g)<>1 then raise exception 'FREEZE_LOST_CONTENT';end if;
 begin perform public.lk_publish(g,'qa-monthly-rollback');raise exception 'EXPIRED_PUBLISH_ALLOWED';exception when others then if sqlerrm<>'PAYMENT_REQUIRED' then raise;end if;end;
 -- An admin price change affects new purchases; the existing subscription keeps its amount.
 update public.lk_plans set monthly_price_cents=monthly_price_cents+100 where id='carinho';
 r:=public.lk_prepare_order_v2(g,'carinho','stripe',gen_random_uuid(),'monthly');
 if r.purpose<>'renewal' or r.amount_cents<>price then raise exception 'RENEWAL_CHANGED_PRICE';end if;
 update public.lk_orders set provider_id='qa_card_renewal' where id=r.id;
 n:=public.lk_confirm_order(r.id,'stripe','qa_card_renewal',price,'BRL');
 if not n or (select frozen from public.lk_gifts where id=g) or (select status from public.lk_gifts where id=g)<>'published' then raise exception 'RENEWAL_FAILED';end if;
 if (select slug from public.lk_gifts where id=g)<>'qa-monthly-rollback' then raise exception 'RENEWAL_CHANGED_URL';end if;
 select expires_at into until_date from public.lk_gifts where id=g;
 n:=public.lk_apply_stripe_cycle(g,'sub_qa_rollback','past_due',now(),now()+interval '2 months',price,null,false,false,false);
 if (select expires_at from public.lk_gifts where id=g)<>until_date then raise exception 'UNPAID_CYCLE_EXTENDED_ACCESS';end if;
 n:=public.lk_apply_stripe_cycle(g,'sub_qa_rollback','active',now(),now()+interval '2 months',price,'in_qa_rollback',true,false,false);
 if not n then raise exception 'PAID_CYCLE_NOT_RECORDED';end if;
 n:=public.lk_apply_stripe_cycle(g,'sub_qa_rollback','active',now(),now()+interval '2 months',price,'in_qa_rollback',true,false,false);
 if n or (select count(*) from public.lk_billing_receipts where provider_invoice_id='in_qa_rollback')<>1 then raise exception 'INVOICE_DUPLICATE';end if;
 n:=public.lk_apply_stripe_cycle(g,'sub_qa_rollback','canceled',now(),now()+interval '2 months',price,'in_qa_rollback',true,false,false);
 select * into s from public.lk_subscriptions where gift_id=g;
 if s.status<>'canceled' or s.auto_renew then raise exception 'CANCELED_REACTIVATED';end if;
 if has_table_privilege('authenticated','public.lk_admins','INSERT') or has_table_privilege('anon','public.lk_analytics_events','SELECT') or has_table_privilege('authenticated','public.lk_subscriptions','UPDATE') then raise exception 'PRIVATE_TABLE_EXPOSED';end if;
 if has_function_privilege('authenticated','public.lk_music_key()','EXECUTE') or has_function_privilege('anon','public.lk_set_music_key(text)','EXECUTE') or has_function_privilege('authenticated','public.lk_apply_stripe_cycle(uuid,text,text,timestamptz,timestamptz,integer,text,boolean,boolean,boolean)','EXECUTE') then raise exception 'PRIVATE_RPC_EXPOSED';end if;
end;$$;
select 'PASS: monthly price, idempotency, freeze, preserved content, renewal, Stripe invoice verification, canceled status and admin/Vault permissions' as result;
rollback;
