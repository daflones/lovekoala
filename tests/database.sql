begin;
do $$
declare g uuid;o public.lk_orders;n boolean;j jsonb;
begin
 insert into public.lk_gifts(edit_token_hash,format,plan_id,content) values(repeat('a',64),'album','encanto','{"sender":"Teste","recipient":"QA","letter":"Uma mensagem de teste"}') returning id into g;
 perform public.lk_add_photo(g,g::text||'/test.png');
 begin perform public.lk_publish(g,'lovekoala-test');raise exception 'UNPAID_PUBLICATION_ALLOWED';exception when others then if sqlerrm<>'PAYMENT_REQUIRED' then raise;end if;end;
 o:=public.lk_prepare_order(g,'encanto','stripe',gen_random_uuid());
 if o.amount_cents<>4990 then raise exception 'PRICE_NOT_SERVER_SIDE';end if;
 update public.lk_orders set provider_id='cs_lovekoala_test' where id=o.id;
 begin perform public.lk_confirm_order(o.id,'stripe','cs_lovekoala_test',1,'BRL');raise exception 'WRONG_AMOUNT_ACCEPTED';exception when others then if sqlerrm<>'PAYMENT_MISMATCH' then raise;end if;end;
 n:=public.lk_confirm_order(o.id,'stripe','cs_lovekoala_test',4990,'brl');if not n then raise exception 'FIRST_CONFIRMATION_FAILED';end if;
 n:=public.lk_confirm_order(o.id,'stripe','cs_lovekoala_test',4990,'BRL');if n then raise exception 'DUPLICATE_CONFIRMATION';end if;
 begin perform public.lk_publish(g,'lovekoala-test');raise exception 'NO_CONSENT_ALLOWED';exception when others then if sqlerrm<>'CONSENT_REQUIRED' then raise;end if;end;
 update public.lk_gifts set public_consent=true where id=g;perform public.lk_publish(g,'lovekoala-test');
 if (select status from public.lk_gifts where id=g)<>'published' then raise exception 'PUBLICATION_FAILED';end if;
 j:=public.lk_claim_image(g,0);if not(j->>'claimed')::boolean then raise exception 'IMAGE_NOT_CLAIMED';end if;
 j:=public.lk_claim_image(g,0);if (j->>'claimed')::boolean then raise exception 'DOUBLE_IMAGE_CLAIM';end if;
 begin perform public.lk_claim_image(g,3);raise exception 'IMAGE_LIMIT_BROKEN';exception when others then if sqlerrm<>'IMAGE_LIMIT' then raise;end if;end;
 perform public.lk_refund_order(o.id);
 if (select status from public.lk_gifts where id=g)<>'refunded' then raise exception 'REFUND_ACCESS_NOT_REVOKED';end if;
 if has_table_privilege('anon','public.lk_gifts','SELECT') then raise exception 'ANON_CAN_READ_DRAFTS';end if;
 if has_function_privilege('anon','public.lk_confirm_order(uuid,text,text,integer,text,text)','EXECUTE') then raise exception 'ANON_CAN_CONFIRM_PAYMENTS';end if;
 if exists(select 1 from storage.buckets where id in ('love-memories','love-art') and public) then raise exception 'PUBLIC_PRIVATE_BUCKET';end if;
end;$$;
select 'PASS: price, unpaid publication, consent, payment idempotency, image budget, refunds, RLS and private buckets' as result;
rollback;
