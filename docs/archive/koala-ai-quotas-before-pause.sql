begin;
do $$
declare g uuid:=gen_random_uuid();c jsonb;j jsonb;blocked boolean;before_attempts integer;i integer;
begin
 insert into public.lk_gifts(id,edit_token_hash,plan_id,status,access_kind,expires_at,content)
 values(g,repeat('a',64),'encanto','paid','lifetime','infinity','{"sender":"QA AI","recipient":"Synthetic"}');
 if has_table_privilege('anon','public.lk_ai_references','select') or has_table_privilege('authenticated','public.lk_ai_references','select') then raise exception 'Reference RLS privilege leaked';end if;
 if has_function_privilege('authenticated','public.lk_save_ai_scene(uuid,integer,text,text,text,text)','execute') then raise exception 'Prompt function leaked';end if;
 if (select public from storage.buckets where id='love-ai-references') then raise exception 'Public reference bucket';end if;
 -- No arbitrary generation before a server-compiled prompt exists.
 blocked:=false;begin perform public.lk_claim_image(g,0);exception when others then blocked:=sqlerrm like '%AI_SCENE_REQUIRED%';end;if not blocked then raise exception 'Unprepared scene accepted';end if;
 for i in 0..3 loop
  j:=public.lk_save_ai_scene(g,i,'A garden with a happy couple','watercolor','A beautiful watercolor illustration of a loving couple in a garden, soft light.','fixture');
  if (j->>'included')::boolean then raise exception 'New image was included before creator review';end if;
  c:=public.lk_claim_image(g,i);
  if not (c->>'claimed')::boolean or (c->'job'->>'attempts')::integer<>1 then raise exception 'Image not claimed once';end if;
  if i=0 then
   perform public.lk_save_ai_scene(g,1,'A sunset with a happy couple','watercolor','A beautiful watercolor illustration of a loving couple at sunset, warm light.','fixture');
   blocked:=false;begin perform public.lk_claim_image(g,1);exception when others then blocked:=sqlerrm like '%AI_BUSY%';end;if not blocked then raise exception 'Parallel image generation accepted';end if;
  end if;
  update public.lk_image_jobs set status='completed',storage_path=g::text||'/fixture-'||i||'.jpg' where id=(c->'job'->>'id')::uuid;
  c:=public.lk_claim_image(g,i);if (c->>'claimed')::boolean then raise exception 'Completed image regenerated';end if;
  blocked:=false;begin perform public.lk_save_ai_scene(g,i,'A different sunset scene','watercolor','A different scene that would replace the already completed image.','fixture');exception when others then blocked:=sqlerrm like '%AI_SCENE_LOCKED%';end;if not blocked then raise exception 'Completed prompt replaced';end if;
 end loop;
 blocked:=false;begin perform public.lk_save_ai_scene(g,4,'A fifth scene attempted','watercolor','A fifth image that must never be accepted as a free extra credit.','fixture');exception when others then blocked:=sqlerrm like '%IMAGE_LIMIT%';end;if not blocked then raise exception 'Fifth image accepted';end if;
 if (select count(*) from public.lk_image_jobs where gift_id=g and status='completed')<>4 then raise exception 'Wrong successful quota';end if;
 -- Excluding an image does not free a slot.
 update public.lk_image_jobs set included=false where gift_id=g and slot=0;
 c:=public.lk_claim_image(g,0);if (c->>'claimed')::boolean then raise exception 'Exclusion restored credit';end if;
 delete from public.lk_image_jobs where gift_id=g;
 update public.lk_gifts set plan_id='carinho',access_kind='24h',expires_at=now()+interval '1 hour' where id=g;
 blocked:=false;begin perform public.lk_save_ai_scene(g,0,'A garden with a happy couple','watercolor','A prompt for a plan that does not include any AI images.','fixture');exception when others then blocked:=sqlerrm like '%IMAGE_LIMIT%';end;if not blocked then raise exception 'Entry plan granted image';end if;
 update public.lk_gifts set plan_id='encanto',access_kind='lifetime',expires_at='infinity',status='draft' where id=g;
 blocked:=false;begin perform public.lk_save_ai_scene(g,0,'A garden with a happy couple','watercolor','A prompt for an unpaid present that must not be accepted.','fixture');exception when others then blocked:=sqlerrm like '%PAYMENT_REQUIRED%';end;if not blocked then raise exception 'Unpaid image accepted';end if;
 update public.lk_gifts set status='published',frozen=true where id=g;
 blocked:=false;begin perform public.lk_save_ai_scene(g,0,'A garden with a happy couple','watercolor','A prompt for a frozen gift must not consume any new AI credits.','fixture');exception when others then blocked:=sqlerrm like '%PAYMENT_REQUIRED%';end;if not blocked then raise exception 'Frozen image accepted';end if;
 update public.lk_gifts set frozen=false,status='refunded' where id=g;
 blocked:=false;begin perform public.lk_claim_image(g,0);exception when others then blocked:=sqlerrm like '%PAYMENT_REQUIRED%';end;if not blocked then raise exception 'Refunded image accepted';end if;
end;$$;
select 'koala_ai_quota_and_private_references_passed' as result;
rollback;
