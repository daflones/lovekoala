"""Authenticated integration checks. Hidden stdin credentials; no purchase or email.
Temporary confirmed user and gifts are deleted in finally. Secrets are never printed.
"""
import sys,json,termios,uuid,secrets,urllib.request,urllib.error
try:
 t=termios.tcgetattr(sys.stdin);t[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin,termios.TCSANOW,t)
except (termios.error,ValueError):pass
print('Ready for hidden admin test JSON.',flush=True);cfg=json.loads(sys.stdin.readline())
root='https://'+cfg['ref']+'.supabase.co';endpoint=root+'/functions/v1/lovekoala-api';management='https://api.supabase.com/v1/projects/'+cfg['ref']
origin='https://lovekoala.contatodaflonedu.chatgpt.site';passed=[];gifts=[];uid=None;service=None;event_ids=[]
def http(url,body=None,headers=None,method='POST'):
 data=json.dumps(body).encode() if body is not None else None
 try:
  with urllib.request.urlopen(urllib.request.Request(url,data=data,headers={'Content-Type':'application/json',**(headers or {})},method=method),timeout=50) as r:
   raw=r.read();return r.status,json.loads(raw) if raw else None
 except urllib.error.HTTPError as e:
  try:return e.code,json.load(e)
  except:return e.code,{}
def mgmt(path,body=None,method='POST'):return http(management+path,body,{'Authorization':'Bearer '+cfg['token']},method)
def api(action,body=None,jwt=None,edit=None):return http(endpoint,{'action':action,**(body or {})},{'Origin':origin,'apikey':cfg['public_key'],**({'Authorization':'Bearer '+jwt} if jwt else {}),**({'x-edit-token':edit} if edit else {})})
def expect(code,want,label):
 if code!=want:raise RuntimeError(label+': expected '+str(want)+', received '+str(code))
 passed.append(label);print('PASS: '+label,flush=True)
try:
 status,login=http(root+'/auth/v1/token?grant_type=password',cfg['admin'],{'apikey':cfg['public_key']});expect(status,200,'requested administrator can sign in')
 admin=login['access_token'];admin_id=login['user']['id']
 status,me=api('me',jwt=admin);expect(status,200,'verified account session');assert me['admin'] is True
 expect(api('admin_overview')[0],401,'anonymous cannot access admin')
 expect(api('admin_overview',jwt='forged.jwt.token')[0],401,'forged JWT cannot access admin')
 for action in ['admin_overview','admin_users','admin_gifts','admin_orders','admin_plans','admin_settings','admin_journeys','admin_audit','admin_music_config','admin_recoveries','admin_email_config']:
  status,data=api(action,jwt=admin);expect(status,200,action+' reads actual backend')
  if action=='admin_music_config':assert set(data)=={'configured','environment','search_available','key_required'} and data['search_available'] is True and data['key_required'] is False
  if action=='admin_email_config':assert 'api_key' not in data;email_config=data
 status,keys=mgmt('/api-keys',method='GET');assert status==200
 service=next(k['api_key'] for k in keys if k.get('name')=='service_role');sh={'apikey':service,'Authorization':'Bearer '+service}
 email='qa-'+uuid.uuid4().hex+'@lovekoala.invalid';password=secrets.token_urlsafe(24)
 status,user=http(root+'/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'user_metadata':{'role':'admin','is_admin':True}},sh);expect(status,200,'temporary normal user created without email');uid=user['id']
 status,normal=http(root+'/auth/v1/token?grant_type=password',{'email':email,'password':password},{'apikey':cfg['public_key']});assert status==200;normal_jwt=normal['access_token']
 status,normal_me=api('me',jwt=normal_jwt);assert status==200 and normal_me['admin'] is False
 expect(api('admin_overview',jwt=normal_jwt)[0],403,'user metadata cannot grant admin role')
 for table in ['lk_admins','lk_site_settings','lk_subscriptions','lk_analytics_events','lk_checkout_recovery']:
  code,_=http(root+'/rest/v1/'+table+'?select=*',headers={'apikey':cfg['public_key'],'Authorization':'Bearer '+normal_jwt},method='GET');assert code in [401,403];passed.append('RLS blocks direct '+table)
 status,draft=api('create',{'format':'album'},jwt=admin);expect(status,200,'create gift owned by authenticated user');gid=draft['gift_id'];edit=draft['edit_token'];gifts.append(gid)
 status,mine=api('my_gifts',jwt=admin);assert status==200 and any(g['id']==gid for g in mine['gifts'])
 expect(api('editor',{'gift_id':gid},jwt=normal_jwt)[0],404,'different account cannot read another gift')
 expect(api('editor',{'gift_id':gid},jwt=admin)[0],200,'owner resumes without capability token')
 gift={'format':'album','theme':'eucalipto','plan_id':'carinho','sender':'QA','recipient':'Admin','letter':'Teste temporário','story':'História de teste','email':cfg['admin']['email'],'slug':'qa-admin-'+uuid.uuid4().hex[:12],'open_when':[],'photos':[],'billing_cycle':'monthly','analytics_session_id':str(uuid.uuid4()),'music_title':'Perfect','music_url':'https://www.youtube.com/watch?v=2Vv-BfVoq4g','music_track':{'provider':'youtube','id':'2Vv-BfVoq4g','title':'Perfect','artist':'Ed Sheeran'}}
 expect(api('save',{'gift_id':gid,'gift':gift},jwt=admin)[0],200,'structured music and billing saved')
 status,editor=api('editor',{'gift_id':gid},jwt=admin);assert status==200 and editor['gift']['music_track']['id']=='2Vv-BfVoq4g' and editor['gift']['billing_cycle']=='monthly'
 expect(api('checkout',{'gift_id':gid,'plan_id':'carinho','provider':'stripe','request_id':str(uuid.uuid4()),'return_url':origin+'/criar'},edit=edit)[0],400,'checkout validates required photo before creating charge')
 # An order row without a provider id is a DB-only fixture: no actual charge or mail.
 oid=str(uuid.uuid4())
 status,_=mgmt('/database/query',{'query':"insert into public.lk_orders(id,gift_id,plan_id,provider,status,amount_cents,request_id,billing_cycle) values('"+oid+"','"+gid+"','carinho','stripe','created',2990,'"+str(uuid.uuid4())+"','once');"});assert status in (200,201)
 expect(api('checkout_exit',{'gift_id':gid,'order_id':oid,'reason':'stripe_return'},jwt=normal_jwt)[0],404,'another account cannot capture checkout exit')
 expect(api('checkout_exit',{'gift_id':gid,'order_id':oid,'reason':'stripe_return'},jwt=admin)[0],200,'returning customer preserves unfinished purchase')
 status,recovery=api('admin_recoveries',{'search':cfg['admin']['email']},jwt=admin);assert status==200 and any(r['order_id']==oid and r['status']=='abandoned' and r['email_consent'] is False for r in recovery['recoveries']);passed.append('admin sees captured email without consent for campaigns')
 status,restored=api('editor',{'gift_id':gid},jwt=admin);assert status==200 and restored['active_order']['id']==oid and restored['recovery']['email_consent'] is False;passed.append('owner can resume actual pending checkout')
 expect(api('request_summary_email',{'gift_id':gid,'order_id':oid,'consent':True},edit=edit)[0],401,'summary request requires verified customer account')
 expect(api('request_summary_email',{'gift_id':gid,'order_id':oid,'consent':False},jwt=admin)[0],400,'summary request requires explicit consent')
 if not email_config['ready']:
  status,summary=api('request_summary_email',{'gift_id':gid,'order_id':oid,'email':'summary-qa@lovekoala.invalid','consent':True},jwt=admin);expect(status,200,'unconfigured mail still stores resumable request');assert summary['email_status']=='unavailable' and 'continuar=1' in summary['resume_url']
  status,recovery=api('admin_recoveries',{'search':'summary-qa@lovekoala.invalid'},jwt=admin);assert status==200 and any(r['order_id']==oid and r['email_status']=='unavailable' and r['email_consent'] is True for r in recovery['recoveries']);passed.append('admin shows honest unsent status')
 expect(api('admin_email_config_save',{'from':'bad from','api_key':'invalid'},jwt=admin)[0],400,'invalid email configuration rejected without storage')
 # This fixture only models published state; no payment record or provider request is made.
 status,_=mgmt('/database/query',{'query':"update public.lk_gifts set status='published',slug='"+gift['slug']+"',expires_at=now()+interval '1 month' where id='"+gid+"';"});assert status in (200,201)
 status,public=api('gift',{'slug':gift['slug']});expect(status,200,'published gift can be opened');assert 'email' not in public['gift'] and 'analytics_session_id' not in public['gift']
 expect(api('admin_gift',{'gift_id':gid},jwt=admin)[0],200,'admin can inspect gift and owner')
 expect(api('admin_gift_status',{'gift_id':gid,'suspended':True},jwt=admin)[0],200,'admin pauses gift')
 expect(api('gift',{'slug':gift['slug']})[0],404,'paused gift is unavailable publicly')
 expect(api('admin_gift_status',{'gift_id':gid,'suspended':False},jwt=admin)[0],200,'admin reactivates gift')
 status,_=mgmt('/database/query',{'query':"update public.lk_gifts set expires_at=now()-interval '1 minute' where id='"+gid+"';"});assert status in (200,201)
 expect(api('gift',{'slug':gift['slug']})[0],404,'expired gift closes immediately before cron')
 status,settings=api('admin_settings',jwt=admin);assert status==200
 expect(api('admin_settings_save',{'revision':settings['settings']['revision']-1,'data':{}},jwt=admin)[0],409,'stale customizer changes rejected')
 expect(api('admin_settings_save',{'revision':settings['settings']['revision'],'data':{'tags':{'ga4':'<script>unsafe</script>'}}},jwt=admin)[0],400,'arbitrary script cannot be inserted as tag')
 expect(api('admin_music_key',{'value':'invalid'},jwt=admin)[0],400,'invalid private music key rejected')
 status,tracks=api('music_search',{'query':'Perfect'});expect(status,200,'music search returns available selection');assert any(t['id']=='2Vv-BfVoq4g' for t in tracks['tracks'])
 expect(api('music_resolve',{'url':'https://youtube.com.evil.test/watch?v=2Vv-BfVoq4g'})[0],400,'music resolver blocks foreign host')
 status,resolved=api('music_resolve',{'url':'https://youtu.be/2Vv-BfVoq4g'});expect(status,200,'official YouTube metadata resolves');assert resolved['track']['provider']=='youtube'
 eid=str(uuid.uuid4());sid=str(uuid.uuid4());event_ids.append(eid)
 expect(api('analytics',{'id':eid,'session_id':sid,'event':'step_view','path':'/criar','properties':{'step':4,'format':'album','story':'must not persist','email':'must not persist'}})[0],200,'funnel event is recorded')
 status,journey=api('admin_journeys',{'session_id':sid},jwt=admin);assert status==200 and len(journey['events'])==1 and 'story' not in journey['events'][0]['properties'] and 'email' not in journey['events'][0]['properties']
 expect(api('analytics',{'id':str(uuid.uuid4()),'session_id':sid,'event':'payment_succeeded'})[0],400,'client cannot forge a confirmed purchase event')
 expect(api('admin_user_status',{'user_id':uid,'disabled':True},jwt=admin)[0],200,'admin can pause normal account')
 expect(api('me',jwt=normal_jwt)[0],403,'paused account is blocked at API')
 expect(api('admin_user_status',{'user_id':admin_id,'disabled':True},jwt=admin)[0],400,'admin cannot accidentally pause own account')
 expect(api('admin_gift_delete',{'gift_id':gid,'confirm':'wrong'},jwt=admin)[0],400,'deletion requires exact gift confirmation')
 expect(api('admin_gift_delete',{'gift_id':gid,'confirm':gift['slug']},jwt=admin)[0],200,'confirmed deletion clears gift content')
 expect(api('editor',{'gift_id':gid},jwt=admin)[0],404,'deleted gift cannot be edited')
 print(json.dumps({'ok':True,'checks':len(passed),'purchase_made':False,'email_sent':False}),flush=True)
finally:
 if gifts:
  ids=','.join("'"+g+"'" for g in gifts)
  status,_=mgmt('/database/query',{'query':"delete from public.lk_admin_audit where target in ("+ids+");delete from public.lk_orders where gift_id in ("+ids+");delete from public.lk_gifts where id in ("+ids+");"})
  if status not in (200,201):print('Fixture cleanup failed.',flush=True)
 if event_ids:mgmt('/database/query',{'query':"delete from public.lk_analytics_events where id in ("+','.join("'"+e+"'" for e in event_ids)+");"})
 if uid and service:
  mgmt('/database/query',{'query':"delete from public.lk_admin_audit where target='"+uid+"';"})
  status,_=http(root+'/auth/v1/admin/users/'+uid,headers={'apikey':service,'Authorization':'Bearer '+service},method='DELETE')
  if status!=200:print('Temporary user cleanup failed.',flush=True)
