begin;
-- Keep existing artwork, consent and history. Stop offering new image credits.
update public.lk_plans set image_credits=0;

-- The custom webhook domain is activated only after server-side proxy checks.
-- Service-only Vault access; no management token or provider key in public settings.
create or replace function public.lk_payment_webhook_base() returns text
language sql security definer set search_path='' as $$
 select coalesce((select decrypted_secret from vault.decrypted_secrets
  where name='lovekoala_payment_webhook_base' limit 1),'');
$$;
create or replace function public.lk_set_payment_webhook_base(p_value text) returns void
language plpgsql security definer set search_path='' as $$
declare secret_id uuid;
begin
 if p_value is null or p_value not in ('','https://lovekoala.com.br/api/webhooks') then
  raise exception 'WEBHOOK_DOMAIN_INVALID';
 end if;
 perform pg_advisory_xact_lock(hashtext('lovekoala_payment_webhook_base'));
 select id into secret_id from vault.secrets where name='lovekoala_payment_webhook_base' limit 1;
 if p_value='' then delete from vault.secrets where id=secret_id;
 elsif secret_id is null then
  perform vault.create_secret(p_value,'lovekoala_payment_webhook_base','LoveKoala verified payment domain');
 else perform vault.update_secret(secret_id,p_value,'lovekoala_payment_webhook_base');
 end if;
end;$$;
revoke execute on function public.lk_payment_webhook_base(),public.lk_set_payment_webhook_base(text) from public,anon,authenticated;
grant execute on function public.lk_payment_webhook_base(),public.lk_set_payment_webhook_base(text) to service_role;
commit;
