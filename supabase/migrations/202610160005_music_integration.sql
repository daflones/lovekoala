begin;
-- Only the Edge service role can read or replace the YouTube credential.
-- The public configuration exposes a boolean, never the secret.
create or replace function public.lk_music_key() returns text
language sql security definer set search_path='' as $$
 select decrypted_secret from vault.decrypted_secrets where name='lovekoala_youtube_key' limit 1;
$$;
create or replace function public.lk_set_music_key(p_value text) returns void
language plpgsql security definer set search_path='' as $$
declare secret_id uuid;
begin
 if length(p_value)>200 then raise exception 'KEY_INVALID';end if;
 perform pg_advisory_xact_lock(hashtext('lovekoala_youtube_key'));
 select id into secret_id from vault.secrets where name='lovekoala_youtube_key' limit 1;
 if p_value='' then
  delete from vault.secrets where id=secret_id;
 elsif secret_id is null then
  perform vault.create_secret(p_value,'lovekoala_youtube_key','LoveKoala YouTube Data API v3');
 else
  perform vault.update_secret(secret_id,p_value,'lovekoala_youtube_key');
 end if;
end;$$;
revoke execute on function public.lk_music_key(),public.lk_set_music_key(text) from public,anon,authenticated;
grant execute on function public.lk_music_key(),public.lk_set_music_key(text) to service_role;
commit;
