"""Deployment helper. Credentials are read once from hidden stdin; never written.
Use: python scripts/backend-ops.py <inspect|migrate|deploy|secrets|probe>
"""
import json,sys,pathlib,termios,urllib.request,urllib.error,urllib.parse,uuid,secrets
try:
    settings=termios.tcgetattr(sys.stdin);settings[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin,termios.TCSANOW,settings)
except (termios.error,ValueError): pass
print('Ready for backend JSON on stdin (input is hidden).',flush=True)
cfg=json.loads(sys.stdin.readline())
ref=cfg['ref'];base='https://api.supabase.com/v1/projects/'+ref
headers={'Authorization':'Bearer '+cfg['token']}
action=sys.argv[1]
def http(url,method='GET',json_body=None,files=None,extra_headers=None):
    h={**headers,**(extra_headers or {})};data=None
    if json_body is not None:
        data=json.dumps(json_body).encode();h['Content-Type']='application/json'
    if files:
        boundary='love'+uuid.uuid4().hex;parts=[]
        for name,(filename,value,kind) in files.items():
            value=value.encode() if isinstance(value,str) else value
            disposition=f'Content-Disposition: form-data; name="{name}"'+(f'; filename="{filename}"' if filename else '')
            parts.append(('--'+boundary+'\r\n'+disposition+'\r\nContent-Type: '+kind+'\r\n\r\n').encode()+value+b'\r\n')
        data=b''.join(parts)+('--'+boundary+'--\r\n').encode();h['Content-Type']='multipart/form-data; boundary='+boundary
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=data,headers=h,method=method),timeout=55) as r:
            raw=r.read();return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw=e.read().decode();parsed=json.loads(raw) if raw.startswith('{') else {};err=parsed.get('error',{});code=err.get('code','request_rejected') if isinstance(err,dict) else 'request_rejected';print(json.dumps({'ok':False,'status':e.code,'error_code':code,**({'message':parsed.get('message',err if isinstance(err,str) else '')[:700]} if url.startswith(base) else {})}));sys.exit(1)
def call(path,method='GET',json=None,files=None):
    return http(base+path,method,json_body=json,files=files)
if action=='setup_admin':
    keys=call('/api-keys')
    service=next((k['api_key'] for k in keys if k.get('name')=='service_role'),None)
    if not service:raise RuntimeError('Legacy server key unavailable')
    authroot='https://'+ref+'.supabase.co'
    sh={'Authorization':'Bearer '+service,'apikey':service}
    users=http(authroot+'/auth/v1/admin/users?page=1&per_page=1000',extra_headers=sh)
    current=next((u for u in users.get('users',[]) if u.get('email','').lower()==cfg['admin']['email'].lower()),None)
    body={'email':cfg['admin']['email'],'password':cfg['admin']['password'],'email_confirm':True,'user_metadata':{'name':'Eduardo Daflon'}}
    if current:user=http(authroot+'/auth/v1/admin/users/'+current['id'],'PUT',json_body=body,extra_headers=sh)
    else:user=http(authroot+'/auth/v1/admin/users','POST',json_body=body,extra_headers=sh)
    uid=user['id']
    http(authroot+'/rest/v1/lk_admins?on_conflict=user_id','POST',json_body={'user_id':uid},extra_headers={**sh,'Prefer':'resolution=ignore-duplicates'})
    login=http(authroot+'/auth/v1/token?grant_type=password','POST',json_body={'email':cfg['admin']['email'],'password':cfg['admin']['password']},extra_headers={'Authorization':'','apikey':cfg['public_key']})
    ah={'Authorization':'Bearer '+login['access_token'],'apikey':cfg['public_key'],'Origin':'https://lovekoala.contatodaflonedu.chatgpt.site'}
    endpoint=authroot+'/functions/v1/lovekoala-api'
    check=http(endpoint,'POST',json_body={'action':'me'},extra_headers=ah)
    sync=http(endpoint,'POST',json_body={'action':'admin_billing_setup'},extra_headers=ah)
    # Configure only this project's auth redirects; no email is sent by createUser.
    call('/config/auth','PATCH',json={'site_url':'https://lovekoala.contatodaflonedu.chatgpt.site','uri_allow_list':'https://lovekoala.contatodaflonedu.chatgpt.site/**,https://lovekoala.com.br/**,https://www.lovekoala.com.br/**'})
    print(json.dumps({'ok':True,'account':cfg['admin']['email'],'admin':check.get('admin'),'password_signin':bool(login.get('access_token')),'stripe_monthly_events':sync.get('ok'),'email_sent':False}))
elif action=='inspect':
    p=call('');f=call('/functions');s=call('/secrets')
    q=call('/database/query','POST',json={'query':"select tablename from pg_tables where schemaname='public' order by tablename;"})
    print(json.dumps({'project':{'id':p.get('id'),'status':p.get('status')},'functions':[x['slug'] for x in f], 'secret_names':[x['name'] for x in s], 'tables':q}))
elif action=='migrate':
    sql=pathlib.Path('supabase/migrations/202610160001_lovekoala.sql').read_text()
    result=call('/database/query','POST',json={'query':sql})
    print(json.dumps({'ok':True,'migration':'202610160001_lovekoala','result':result}))
elif action=='secrets':
    if cfg.get('generate_salt'):cfg['secrets']['RATE_LIMIT_SALT']=secrets.token_hex(32)
    call('/secrets','POST',json=[{'name':k,'value':v} for k,v in cfg['secrets'].items()])
    print(json.dumps({'ok':True,'secret_names':list(cfg['secrets'])}))
elif action=='cron_setup':
    cron_secret=secrets.token_hex(32)
    call('/secrets','POST',json=[{'name':'CRON_SECRET','value':cron_secret}])
    # Vault is the supported database secret store. The value is never output.
    call('/database/query','POST',json={'query':"select vault.create_secret('"+cron_secret+"','lovekoala_cron_secret','LoveKoala periodic payment reconciliation');"})
    print(json.dumps({'ok':True,'configured':'CRON_SECRET + Vault'}))
elif action=='stripe_check':
    result=http('https://api.stripe.com/v1/account',extra_headers={'Authorization':'Bearer '+cfg['stripe_key']})
    print(json.dumps({'ok':True,'charges_enabled':result.get('charges_enabled'),'country':result.get('country')}))
elif action=='stripe_setup':
    sh={'Authorization':'Bearer '+cfg['stripe_key']}
    account=http('https://api.stripe.com/v1/account',extra_headers=sh)
    if not account.get('charges_enabled'):
        print(json.dumps({'ok':False,'error_code':'charges_not_enabled'}));sys.exit(1)
    url='https://'+ref+'.supabase.co/functions/v1/lovekoala-api/webhook/stripe'
    hooks=http('https://api.stripe.com/v1/webhook_endpoints?limit=100',extra_headers=sh)
    if any(h.get('url')==url and h.get('status')=='enabled' for h in hooks['data']):
        print(json.dumps({'ok':False,'error_code':'matching_webhook_exists'}));sys.exit(1)
    fields=[('url',url),('description','LoveKoala payment confirmation'),('metadata[application]','lovekoala')]+[('enabled_events[]',e) for e in ['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired','charge.refunded']]
    data=urllib.parse.urlencode(fields).encode()
    with urllib.request.urlopen(urllib.request.Request('https://api.stripe.com/v1/webhook_endpoints',method='POST',data=data,headers={**sh,'Content-Type':'application/x-www-form-urlencoded'}),timeout=30) as r:hook=json.load(r)
    call('/secrets','POST',json=[{'name':'STRIPE_SECRET_KEY','value':cfg['stripe_key']},{'name':'STRIPE_WEBHOOK_SECRET','value':hook['secret']}])
    print(json.dumps({'ok':True,'webhook_id':hook['id'],'charges_enabled':True,'country':account.get('country'),'webhook_url':url}))
elif action=='query':
    query=pathlib.Path(cfg['path']).read_text() if cfg.get('path') else cfg['query']
    print(json.dumps({'ok':True,'result':call('/database/query','POST',json={'query':query})}))
elif action=='mercosul_check':
    result=http('https://mercosulpay.com/api/public/v1/pix/charges',extra_headers={'Authorization':'Bearer '+cfg['mercosul_key']})
    print(json.dumps({'ok':True,'response_type':type(result).__name__,'top_level_fields':list(result.keys()) if isinstance(result,dict) else [],'records':len(result) if isinstance(result,list) else None}))
elif action=='mercosul_contract':
    result=http('https://mercosulpay.com/api/public/v1/pix/charges',extra_headers={'Authorization':'Bearer '+cfg['mercosul_key']})
    d=result.get('data',{})
    first=d[0] if isinstance(d,list) and d else d
    print(json.dumps({'sample_fields':list(first.keys()) if isinstance(first,dict) else [],'list_count':len(d) if isinstance(d,list) else None}))
    result=http('https://mercosulpay.com/api/public/v1/webhooks',extra_headers={'Authorization':'Bearer '+cfg['mercosul_key']})
    d=result.get('data',result);first=d[0] if isinstance(d,list) and d else d
    print(json.dumps({'webhook_fields':list(first.keys()) if isinstance(first,dict) else [],'list_count':len(d) if isinstance(d,list) else None}))
elif action=='pix_flow':
    endpoint='https://'+ref+'.supabase.co/functions/v1/lovekoala-api'
    origin='https://lovekoala.contatodaflonedu.chatgpt.site'
    ah={'Authorization':'','apikey':cfg['public_key'],'Origin':origin}
    d=http(endpoint,'POST',json_body={'action':'create','format':'album'},extra_headers=ah)
    gid=d['gift_id'];ah['x-edit-token']=d['edit_token']
    gift={'format':'album','theme':'eucalipto','plan_id':'carinho','sender':'Teste LoveKoala','recipient':'Verificação Pix','story':'Teste sintético da integração.','letter':'Verificação do Pix sem realizar pagamento.','occasion':'Teste técnico','email':'lovekoala-check@example.com','slug':'qa-pix-'+uuid.uuid4().hex[:10],'start_date':'2022-06-12','music_title':'','music_url':'','illustration_brief':'','reasons':[],'coupons':[],'open_when':[],'photos':[]}
    http(endpoint,'POST',json_body={'action':'save','gift_id':gid,'gift':gift},extra_headers=ah)
    call('/database/query','POST',json={'query':"select public.lk_add_photo('"+gid+"','"+gid+"/qa-pix.png');"})
    result=http(endpoint,'POST',json_body={'action':'checkout','gift_id':gid,'plan_id':'carinho','provider':'mercosulpay','request_id':str(uuid.uuid4()),'return_url':origin+'/criar?rascunho=qa'},extra_headers=ah)
    o=result['order']
    valid=o['amount_cents']==2990 and bool(o.get('pix_code')) and o['status']=='pending'
    state=http(endpoint,'POST',json_body={'action':'order_status','gift_id':gid,'order_id':o['id']},extra_headers=ah)
    print(json.dumps({'ok':valid,'amount_cents':o['amount_cents'],'qr_received':bool(o.get('pix_code')),'provider_status':state['order']['status'],'purchase_made':False}))
    call('/database/query','POST',json={'query':"delete from public.lk_photos where gift_id='"+gid+"';delete from public.lk_orders where gift_id='"+gid+"' and status<>'paid';delete from public.lk_gifts where id='"+gid+"' and status='draft';"})
elif action=='deploy':
    source=pathlib.Path('supabase/functions/lovekoala-api/index.ts').read_bytes()
    meta={'name':'lovekoala-api','entrypoint_path':'index.ts','verify_jwt':False}
    result=call('/functions/deploy?slug=lovekoala-api','POST',files={'metadata':(None,json.dumps(meta),'application/json'),'file':('index.ts',source,'application/typescript')})
    print(json.dumps({'ok':True,'slug':result.get('slug'),'status':result.get('status'),'version':result.get('version'),'verify_jwt':result.get('verify_jwt')}))
elif action=='probe':
    body=http('https://'+ref+'.supabase.co/functions/v1/lovekoala-api','POST',json_body={'action':'config'},extra_headers={'apikey':cfg.get('public_key','')})
    print(json.dumps({'ok':True,'body':body}))
