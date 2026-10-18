begin;
do $$
declare buyer uuid:=gen_random_uuid();wrong_buyer uuid:=gen_random_uuid();gift uuid;other_gift uuid;resume_gift uuid;o public.lk_orders;hash text:=repeat('c',64);newhash text:=repeat('d',64);balance jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(buyer,'guest-checkout-'||buyer||'@example.invalid',now(),'{}'),(wrong_buyer,'wrong-'||wrong_buyer||'@example.invalid',now(),'{}');
 insert into public.lk_gifts(edit_token_hash,plan_id,format,content) values(repeat('a',64),'universo','album',jsonb_build_object('email','guest-checkout-'||buyer||'@example.invalid')) returning id into gift;
 o:=public.lk_prepare_order_v2(gift,'universo','mercosulpay',gen_random_uuid(),'monthly');
 if (select owner_user_id is not null from public.lk_gifts where id=gift) then raise exception 'GUEST_CREATED_ACCOUNT_BEFORE_PAYING';end if;
 begin perform public.lk_claim_gift_owner(gift,wrong_buyer);raise exception 'PENDING_WRONG_EMAIL_CLAIMED';exception when others then if sqlerrm<>'CHECKOUT_EMAIL_REQUIRED' then raise;end if;end;
 update public.lk_orders set provider_id='fixture-'||o.id where id=o.id;
 perform public.lk_confirm_order(o.id,'mercosulpay','fixture-'||o.id,o.amount_cents,'BRL');
 if not exists(select 1 from public.lk_subscriptions where gift_id=gift and owner_user_id is null) then raise exception 'GUEST_SUBSCRIPTION_NOT_PRESERVED';end if;
 begin perform public.lk_claim_gift_owner(gift,wrong_buyer);raise exception 'WRONG_EMAIL_CLAIMED';exception when others then if sqlerrm<>'CHECKOUT_EMAIL_REQUIRED' then raise;end if;end;
 perform public.lk_claim_gift_owner(gift,buyer);perform public.lk_claim_gift_owner(gift,buyer);
 if not exists(select 1 from public.lk_gifts where id=gift and owner_user_id=buyer) or not exists(select 1 from public.lk_subscriptions where gift_id=gift and owner_user_id=buyer) then raise exception 'GIFT_OR_SUBSCRIPTION_NOT_ATTACHED';end if;
 balance:=public.lk_club_balance(buyer);if (balance->>'remaining')::int<>1 then raise exception 'CLUB_FIRST_GIFT_NOT_COUNTED';end if;
 begin perform public.lk_claim_gift_owner(gift,wrong_buyer);raise exception 'OWNER_REPLACED';exception when others then if sqlerrm<>'GIFT_OWNER' then raise;end if;end;
 insert into public.lk_gifts(edit_token_hash,plan_id,content) values(repeat('b',64),'universo',jsonb_build_object('email','guest-checkout-'||buyer||'@example.invalid')) returning id into other_gift;
 begin perform public.lk_prepare_order_v2(other_gift,'universo','mercosulpay',gen_random_uuid(),'monthly');raise exception 'DUPLICATE_CLUB_PAID';exception when others then if sqlerrm<>'CLUB_EXISTS' then raise;end if;end;
 insert into public.lk_gifts(edit_token_hash,content) values(repeat('b',64),'{}') returning id into resume_gift;
 insert into public.lk_guest_resumes(token_hash,gift_id) values(hash,resume_gift);
 if public.lk_resume_guest_checkout(hash,newhash)<>resume_gift or public.lk_resume_guest_checkout(hash,newhash)<>resume_gift then raise exception 'RESUME_NOT_IDEMPOTENT';end if;
 begin perform public.lk_resume_guest_checkout(hash,repeat('e',64));raise exception 'RESUME_REPLACED';exception when others then if sqlerrm<>'RESUME_INVALID' then raise;end if;end;
 perform public.lk_claim_gift_owner(resume_gift,buyer);
 begin perform public.lk_resume_guest_checkout(hash,newhash);raise exception 'OWNED_GIFT_RESUMED_ANONYMOUSLY';exception when others then if sqlerrm<>'RESUME_INVALID' then raise;end if;end;
 if has_table_privilege('anon','public.lk_guest_resumes','SELECT') or has_function_privilege('authenticated','public.lk_claim_gift_owner(uuid,uuid)','EXECUTE') then raise exception 'GUEST_INTERNALS_EXPOSED';end if;
end $$;
rollback;
