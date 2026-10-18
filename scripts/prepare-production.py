"""Apply this release to the existing LoveKoala Supabase project.
Python 3.10+, standard library only. Token comes from env or a hidden prompt.
No provider key is downloaded, printed, replaced or stored in a file.
"""
import argparse, getpass, json, os, pathlib, sys, urllib.error, urllib.request, uuid

REF = 'enhnlektomuoumozjsfp'
SITE = 'https://lovekoala.com.br'
PREVIEW = 'https://lovekoala.contatodaflonedu.chatgpt.site'
ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = (
    ('20261018033136', 'production_domain_image_pause'),
    ('20261018033423', 'guest_checkout_after_payment'),
    ('20261018034104', 'captain_koala_admin_assistant'),
    ('20261018035009', 'guest_checkout_claim_guard'),
    ('20261018043541', 'admin_chat_payment_controls'),
    ('20261018120929', 'admin_approval_guards'),
    ('20261018143421', 'retrospective_community_stats'),
)
BASE = 'https://api.supabase.com/v1/projects/' + REF


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Apply missing release migrations, function and production auth/origins')
    args = parser.parse_args()
    token = os.environ.get('SUPABASE_ACCESS_TOKEN') or getpass.getpass('Supabase access token (hidden): ')
    if not token:
        raise RuntimeError('No access token provided.')

    def request(path, method='GET', body=None, multipart=None):
        headers = {'Authorization': 'Bearer ' + token}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers['Content-Type'] = 'application/json'
        if multipart is not None:
            boundary = 'lovekoala-' + uuid.uuid4().hex
            parts = []
            for name, filename, content, mime in multipart:
                disposition = 'form-data; name="' + name + '"'
                if filename:
                    disposition += '; filename="' + filename + '"'
                parts.append(('--' + boundary + '\r\nContent-Disposition: ' + disposition + '\r\nContent-Type: ' + mime + '\r\n\r\n').encode() + content + b'\r\n')
            data = b''.join(parts) + ('--' + boundary + '--\r\n').encode()
            headers['Content-Type'] = 'multipart/form-data; boundary=' + boundary
        try:
            with urllib.request.urlopen(urllib.request.Request(BASE + path, data=data, method=method, headers=headers), timeout=55) as response:
                raw = response.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            raise RuntimeError('Supabase operation rejected: HTTP ' + str(error.code) + ' at ' + path.split('?')[0]) from None
        except (urllib.error.URLError, TimeoutError):
            raise RuntimeError('Cannot reach Supabase. Check network access and retry; completed steps are idempotent.') from None

    def query(sql):
        return request('/database/query', 'POST', {'query': sql})

    project = request('')
    if project.get('id') != REF:
        raise RuntimeError('Project identity mismatch.')
    auth = request('/config/auth')
    history = query("select version from supabase_migrations.schema_migrations order by version;")
    versions = {row['version'] for row in history}
    required = {'202610160013', '202610160014'}
    if not required.issubset(versions):
        raise RuntimeError('This script targets the existing LoveKoala database with migrations 001–014. Read docs/EASYPANEL.md before migrating another project.')
    print(json.dumps({'project': REF, 'production_site': auth.get('site_url'), 'release_migrations': {version: version in versions for version, _ in MIGRATIONS}, 'write_requested': args.apply}, ensure_ascii=False))
    if not args.apply:
        return
    for version, name in MIGRATIONS:
        if version in versions:
            continue
        migration = (ROOT / 'supabase/migrations' / (version + '_' + name + '.sql')).read_text()
        # Store the migration text and history entry in the same transaction.
        inner = migration.strip().removeprefix('begin;').removesuffix('commit;')
        delimiter = '$lovekoala_' + uuid.uuid4().hex + '$'
        sql = "begin;\n" + inner + "\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('" + version + "','" + name + "',array[" + delimiter + migration + delimiter + "]) on conflict(version) do nothing;\ncommit;"
        query(sql)
    print('Release migrations 015–021 ready.', flush=True)
    source = (ROOT / 'supabase/functions/lovekoala-api/index.ts').read_bytes()
    metadata = json.dumps({'name': 'lovekoala-api', 'entrypoint_path': 'index.ts', 'verify_jwt': False}).encode()
    deployed = request('/functions/deploy?slug=lovekoala-api', 'POST', multipart=[('metadata', None, metadata, 'application/json'), ('file', 'index.ts', source, 'application/typescript')])
    if deployed.get('status') != 'ACTIVE':
        raise RuntimeError('Function deployment did not report ACTIVE. Inspect Supabase logs before continuing.')
    origins = ','.join([SITE, 'https://www.lovekoala.com.br', PREVIEW, 'http://localhost:4173'])
    request('/secrets', 'POST', [{'name': 'SITE_URL', 'value': SITE}, {'name': 'ALLOWED_ORIGINS', 'value': origins}])
    redirects = set(filter(None, (auth.get('uri_allow_list') or '').split(',')))
    redirects.update([SITE + '/**', 'https://www.lovekoala.com.br/**', PREVIEW + '/**', 'http://localhost:4173/**'])
    request('/config/auth', 'PATCH', {'site_url': SITE, 'uri_allow_list': ','.join(sorted(redirects))})
    checks = query("select image_credits from public.lk_plans where image_credits<>0;")
    if checks:
        raise RuntimeError('Image plan credits did not pause as expected.')
    print(json.dumps({'ok': True, 'function_status': deployed.get('status'), 'function_version': deployed.get('version'), 'site_url': SITE, 'image_generation': 'paused', 'provider_secrets_preserved': True, 'next': 'Deploy the Dockerfile on port 8080, then Admin > Pagamentos > Verificar domínio > Ativar webhooks no domínio.'}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, KeyboardInterrupt) as error:
        print(str(error) or 'Cancelled.', file=sys.stderr)
        sys.exit(1)
