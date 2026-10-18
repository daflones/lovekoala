"""Export source for a user's Git/EasyPanel deployment, with no local secrets or Git metadata.
Usage: python scripts/export-project.py /absolute/path/LoveKoala.zip
"""
import base64, hashlib, json, pathlib, re, subprocess, sys, zipfile

ROOT=pathlib.Path(__file__).resolve().parents[1]
EXCLUDED={'.git','.openai','.sites-runtime','node_modules','dist','tmp','__pycache__'}
PRIVATE=re.compile(rb'(?:nvapi-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{15,}|sbp_[a-zA-Z0-9]{20,}|sk_live_[A-Za-z0-9]{15,}|sk_test_[A-Za-z0-9]{15,}|otp_live_[A-Za-z0-9]{15,}|whsec_[A-Za-z0-9]{20,})')
JWT=re.compile(rb'eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+')


def files():
    names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT).decode().split('\0')
    for name in sorted(set(filter(None,names))):
        path=pathlib.PurePosixPath(name)
        if set(path.parts)&EXCLUDED or any(part.startswith('.env') and part!='.env.example' for part in path.parts):continue
        if path.suffix in {'.log','.pyc','.zip','.gz','.tsbuildinfo'}:continue
        full=ROOT/name
        if not full.is_file() or full.is_symlink():continue
        data=full.read_bytes()
        if PRIVATE.search(data):raise RuntimeError('Private credential pattern found in '+name)
        for match in JWT.finditer(data):
            try:claims=json.loads(base64.urlsafe_b64decode(match.group(1)+b'='*(-len(match.group(1))%4)))
            except (ValueError,TypeError):continue
            if claims.get('role')=='service_role':raise RuntimeError('Service-role JWT found in '+name)
        yield name,data


def main():
    if len(sys.argv)!=2:raise RuntimeError(__doc__)
    output=pathlib.Path(sys.argv[1]).resolve()
    if output.is_relative_to(ROOT):raise RuntimeError('Export outside the source checkout.')
    output.parent.mkdir(parents=True,exist_ok=True)
    selected=list(files());required={'package.json','package-lock.json','Dockerfile','deploy/nginx.conf','src/App.tsx','src/CaptainKoala.tsx','supabase/migrations/20261018033136_production_domain_image_pause.sql','supabase/migrations/20261018033423_guest_checkout_after_payment.sql','supabase/migrations/20261018034104_captain_koala_admin_assistant.sql','supabase/migrations/20261018035009_guest_checkout_claim_guard.sql','docs/EASYPANEL.md','docs/CAPITAO_KOALA.md','docs/DEVIN_CONTINUACAO.md','.env.example','supabase/.env.example'}
    if not required.issubset({name for name,_ in selected}):raise RuntimeError('Source export is incomplete.')
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for name,data in selected:archive.writestr('lovekoala/'+name,data)
    with zipfile.ZipFile(output) as archive:
        bad=archive.testzip()
        if bad:raise RuntimeError('Corrupt archive member: '+bad)
    print(json.dumps({'file':str(output),'files':len(selected),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'private_credentials_detected':False}))


if __name__=='__main__':
    try:main()
    except RuntimeError as error:print(str(error),file=sys.stderr);sys.exit(1)
