begin;
do $$
declare u uuid;g uuid;life uuid;anchor uuid;second_g uuid;third_g uuid;o public.lk_orders;s public.lk_subscriptions;b jsonb;n integer;t timestamptz;
begin
 insert into auth.users(id,email) values(gen_random_uuid(),'qa-access-offers@lovekoala.invalid') returning id into u;
 insert into public.lk_gifts(edit_token_hash,owner_user_id,format,plan_id,content,public_consent) values(repeat('a',64),u,'album','carinho','{"sender":"QA","recipient":"24h","letter":"Sintético"}',true) returning id into g;
 perform public.lk_add_photo(g,g::text||'/24h.png');
 begin perform public.lk_prepare_order_v2(g,'carinho','stripe',gen_random_uuid(),'monthly');raise exception 'WRONG_CYCLE_ALLOWED';exception when others then if sqlerrm<>'PLAN_INCOMPATIBLE' then raise;end if;end;
 o:=public.lk_prepare_order_v2(g,'carinho','stripe',gen_random_uuid(),'once');update public.lk_orders set provider_id='qa_24h' where id=o.id;
 perform public.lk_confirm_order(o.id,'stripe','qa_24h',o.amount_cents,'BRL');
 if not exists(select 1 from public.lk_gifts where id=g and expires_at=paid_at+interval '24 hours' and edit_expires_at=expires_at and access_kind='24h') then raise exception 'NOT_EXACTLY_24_HOURS';end if;
 perform public.lk_publish(g,'qa-access-day');update public.lk_gifts set expires_at=now()-interval '1 second',edit_expires_at=now()-interval '1 second' where id=g;
 perform public.lk_freeze_expired();if not(select frozen from public.lk_gifts where id=g) then raise exception 'DAY_NOT_FROZEN';end if;
 begin perform public.lk_publish(g,'qa-access-day');raise exception 'EXPIRED_PUBLISH_ALLOWED';exception when others then if sqlerrm<>'PAYMENT_REQUIRED' then raise;end if;end;
 insert into public.lk_gifts(edit_token_hash,owner_user_id,format,plan_id,content,public_consent) values(repeat('a',64),u,'ambos','encanto','{"sender":"QA","recipient":"Eterno","letter":"Sintético"}',true) returning id into life;
 perform public.lk_add_photo(life,life::text||'/forever.png');o:=public.lk_prepare_order_v2(life,'encanto','mercosulpay',gen_random_uuid(),'once');update public.lk_orders set provider_id='qa_forever' where id=o.id;
 perform public.lk_confirm_order(o.id,'mercosulpay','qa_forever',o.amount_cents,'BRL');
 if not exists(select 1 from public.lk_gifts where id=life and expires_at='infinity' and edit_expires_at is null and access_kind='lifetime') then raise exception 'LIFETIME_EXPIRES';end if;
 perform public.lk_publish(life,'qa-access-forever');
 insert into public.lk_gifts(edit_token_hash,owner_user_id,format,plan_id,content,public_consent) values(repeat('a',64),u,'ambos','universo','{"sender":"QA","recipient":"Clube","letter":"Sintético"}',true) returning id into anchor;
 perform public.lk_add_photo(anchor,anchor::text||'/club.png');o:=public.lk_prepare_order_v2(anchor,'universo','stripe',gen_random_uuid(),'monthly');update public.lk_orders set provider_id='qa_club' where id=o.id;
 perform public.lk_confirm_order(o.id,'stripe','qa_club',o.amount_cents,'BRL');select * into s from public.lk_subscriptions where gift_id=anchor;
 b:=public.lk_club_balance(u);if b->>'remaining'<>'1' or b->>'used'<>'1' then raise exception 'FIRST_GIFT_NOT_COUNTED';end if;
 perform public.lk_apply_stripe_cycle(anchor,'sub_qa_access','active',s.period_start-interval '1 second',s.period_end-interval '1 second',o.amount_cents,'in_qa_access',true,false,true);
 if(select count(*) from public.lk_club_periods where subscription_id=s.id)<>1 then raise exception 'INITIAL_CANONICAL_PERIOD_DUPLICATED';end if;
 insert into public.lk_gifts(edit_token_hash,owner_user_id,format,plan_id,content) values(repeat('a',64),u,'album','universo','{"sender":"QA","recipient":"Segundo","letter":"Sintético"}') returning id into second_g;
 perform public.lk_add_photo(second_g,second_g::text||'/second.png');perform public.lk_redeem_club_gift(second_g,u);perform public.lk_redeem_club_gift(second_g,u);
 if(public.lk_club_balance(u)->>'remaining')<>'0' then raise exception 'SECOND_GIFT_NOT_COUNTED';end if;
 insert into public.lk_gifts(edit_token_hash,owner_user_id,format,plan_id,content) values(repeat('a',64),u,'album','universo','{"sender":"QA","recipient":"Terceiro","letter":"Sintético"}') returning id into third_g;
 perform public.lk_add_photo(third_g,third_g::text||'/third.png');
 begin perform public.lk_redeem_club_gift(third_g,u);raise exception 'THIRD_GIFT_ALLOWED';exception when others then if sqlerrm<>'CLUB_LIMIT' then raise;end if;end;
 begin perform public.lk_prepare_order_v2(third_g,'universo','stripe',gen_random_uuid(),'monthly');raise exception 'SECOND_SUBSCRIPTION_ALLOWED';exception when others then if sqlerrm<>'CLUB_EXISTS' then raise;end if;end;
 -- An unpaid invoice never creates a new allocation.
 perform public.lk_apply_stripe_cycle(anchor,'sub_qa_access','past_due',s.period_end,s.period_end+interval '1 month',o.amount_cents,null,false,false,false);
 if(select count(*) from public.lk_club_periods where subscription_id=s.id)<>1 then raise exception 'UNPAID_CREDITS_GRANTED';end if;
 -- A new paid month creates precisely one new allocation; replay is harmless.
 perform public.lk_apply_stripe_cycle(anchor,'sub_qa_access','active',s.period_end,s.period_end+interval '1 month',o.amount_cents,'in_qa_access_next',true,false,false);
 perform public.lk_apply_stripe_cycle(anchor,'sub_qa_access','active',s.period_end,s.period_end+interval '1 month',o.amount_cents,'in_qa_access_next',true,false,false);
 if(select count(*) from public.lk_club_periods where subscription_id=s.id)<>2 then raise exception 'RENEWAL_PERIOD_WRONG';end if;
 if not exists(select 1 from public.lk_club_periods p where subscription_id=s.id and p.period_start=s.period_end and (select count(*) from public.lk_club_redemptions r where r.period_id=p.id)=0) then raise exception 'RENEWAL_QUOTA_NOT_RESET';end if;
 update public.lk_subscriptions set period_end=now()-interval '1 second',status='canceled',auto_renew=false where id=s.id;perform public.lk_freeze_expired();
 if exists(select 1 from public.lk_gifts where id in (anchor,second_g,life) and (frozen or expires_at<>'infinity')) then raise exception 'PERMANENT_GIFT_FROZEN';end if;
 if(public.lk_club_balance(u)->>'active')::boolean then raise exception 'EXPIRED_CLUB_ACTIVE';end if;
 if has_function_privilege('authenticated','public.lk_redeem_club_gift(uuid,uuid)','EXECUTE') or has_table_privilege('anon','public.lk_club_periods','SELECT') then raise exception 'CLUB_PERMISSIONS';end if;
end;$$;
select 'PASS: exact 24h, lifetime, two club gifts, replay, duplicate subscription, unpaid denial, monthly allocation, cancellation retention, RLS' as result;
rollback;
