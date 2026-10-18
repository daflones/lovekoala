begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
-- CRON_SECRET is provisioned in Vault and Edge secrets through hidden stdin.
-- No secret value belongs to this migration or its source repository.
select cron.schedule('lovekoala-reconcile','*/5 * * * *',$job$
 select net.http_post(
  url:='https://enhnlektomuoumozjsfp.supabase.co/functions/v1/lovekoala-api',
  headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',
   (select decrypted_secret from vault.decrypted_secrets where name='lovekoala_cron_secret' limit 1)),
  body:='{"action":"reconcile"}'::jsonb,
  timeout_milliseconds:=55000
 );
 $job$);
commit;
