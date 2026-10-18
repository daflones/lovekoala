"""HTTP integration checks. Hidden JSON stdin: ref, token, public_key, stripe_key (optional).
No purchases are made. The optional live Checkout Session is expired without payment.
Synthetic fixtures are removed in finally. Never print credentials or private tokens.
"""
import sys,json,urllib.request,urllib.error,urllib.parse,termios,uuid,base64
try:
 t=termios.tcgetattr(sys.stdin);t[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin,termios.TCSANOW,t)
except (termios.error,ValueError):pass
print('Ready for hidden integration JSON.',flush=True);cfg=json.loads(sys.stdin.readline())
url='https://'+cfg['ref']+'.supabase.co/functions/v1/lovekoala-api';origin='https://lovekoala.contatodaflonedu.chatgpt.site';fixtures=[];passed=[]
def http(target,body=None,h=None,method='POST'):
 data=json.dumps(body).encode() if body is not None else None
 try:
  with urllib.request.urlopen(urllib.request.Request(target,data=data,headers=h or {},method=method),timeout=50) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:
  try:return e.code,json.load(e)
  except:return e.code,{}
def api(action,body=None,token=None,with_origin=True):
 h={'Content-Type':'application/json','apikey':cfg['public_key']}
 if with_origin:h['Origin']=origin
 if token:h['x-edit-token']=token
 return http(url,{'action':action,**(body or {})},h)
def expect(code,want,label):
 if code!=want:raise RuntimeError(label+': expected '+str(want)+', received '+str(code))
 passed.append(label)
try:
 status,conf=api('config');expect(status,200,'public configuration')
 expect(api('create',{'format':'album'},with_origin=False)[0],403,'mutation requires trusted origin')
 status,d=api('create',{'format':'album'});expect(status,200,'create private draft');fixtures.append(d['gift_id']);token=d['edit_token'];gid=d['gift_id']
 expect(api('editor',{'gift_id':gid})[0],401,'private access requires token')
 expect(api('editor',{'gift_id':gid},'0'*64)[0],404,'wrong edit token rejected')
 gift={'format':'album','theme':'eucalipto','plan_id':'carinho','sender':'Teste LoveKoala','recipient':'Verificação','story':'História sintética para verificar o fluxo.','letter':'Uma mensagem de teste que não será publicada.','occasion':'Teste técnico','analytics_session_id':str(uuid.uuid4()),'email':'lovekoala-check@example.com','slug':'qa-'+uuid.uuid4().hex[:12],'start_date':'2022-06-12','music_title':'','music_url':'','illustration_brief':'','reasons':[],'coupons':[],'open_when':[],'photos':[]}
 expect(api('save',{'gift_id':gid,'gift':{**gift,'theme':'unsupported'}},token)[0],400,'unsupported template rejected')
 expect(api('save',{'gift_id':gid,'gift':{**gift,'music_url':'javascript:alert(1)'}},token)[0],400,'unsafe media URL rejected')
 gift.update({'editor_version':2,'selected_games':['memory','connect','wheel'],'decorations':['hearts','petals','paperplanes'],'scratch_message':'Um abraço escondido','stats_consent':True,'start_time':'14:35','album_music_enabled':False,'place':'Lugar de teste','first_memory':'Uma lembrança sintética','dedication':'Dedicatória de teste','promise':'Promessa de teste','milestones':[{'title':'Primeiro capítulo','date':'2022-06-12','description':'Descrição sintética'}],'places':[{'name':'Nossa cidade','note':'Postal de teste'}],'dreams':['Um sonho de teste'],'achievements':['Conquista de teste'],'quiz':[{'question':'Onde?','options':['Aqui','Ali','Lá'],'answer':1}],'coupons':['Um abraço'],'open_when':[{'title':'Quando precisar','text':'Uma carta sintética.'}]})
 expect(api('save',{'gift_id':gid,'gift':{**gift,'quiz':[{'question':'Inválido','options':['A','B'],'answer':7}]}},token)[0],400,'invalid quiz answer rejected')
 expect(api('save',{'gift_id':gid,'gift':{**gift,'milestones':[{'title':'Data inválida','date':'2026-02-31','description':''}]}},token)[0],400,'invalid milestone calendar date rejected')
 expect(api('save',{'gift_id':gid,'gift':{**gift,'section_selection':['unsupported']}},token)[0],400,'unsupported chapter rejected')
 expect(api('save',{'gift_id':gid,'gift':{**gift,'selected_games':['unavailable']}},token)[0],400,'unsupported game rejected')
 expect(api('save',{'gift_id':gid,'gift':{**gift,'decorations':['unknown']}},token)[0],400,'unsupported decoration rejected')
 expect(api('save',{'gift_id':gid,'gift':{**gift,'start_date':'2026-02-31'}},token)[0],400,'impossible relationship date rejected')
 expect(api('save',{'gift_id':gid,'gift':{**gift,'start_time':'25:00'}},token)[0],400,'impossible relationship time rejected')
 status,stats=api('couple_stats',{'days':10});expect(status,200,'anonymous cohort returns aggregate only');assert 'names' not in stats and 'start_date' not in stats
 expect(api('couple_stats',{'days':-1})[0],400,'invalid cohort duration rejected')
 expect(api('save',{'gift_id':gid,'gift':gift},token)[0],200,'save structured story without AI')
 boundary='LoveKoalaTest'+uuid.uuid4().hex
 image=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')
 multipart=(f'--{boundary}\r\nContent-Disposition: form-data; name="gift_id"\r\n\r\n{gid}\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="qa.png"\r\nContent-Type: image/png\r\n\r\n'.encode()+image+f'\r\n--{boundary}--\r\n'.encode())
 req=urllib.request.Request(url+'?action=upload',data=multipart,headers={'Origin':origin,'apikey':cfg['public_key'],'x-edit-token':token,'Content-Type':'multipart/form-data; boundary='+boundary},method='POST')
 with urllib.request.urlopen(req,timeout=40) as r:photo=json.load(r);expect(r.status,200,'private image upload')
 with urllib.request.urlopen(photo['url'],timeout=30) as r:expect(r.status,200,'temporary signed photo opens')
 gift['photos']=[photo];expect(api('save',{'gift_id':gid,'gift':gift},token)[0],200,'photo captions and ordering saved')
 expect(api('gift',{'slug':gift['slug']})[0],404,'draft never publicly accessible')
 expect(api('publish',{'gift_id':gid,'slug':gift['slug'],'public_consent':True},token)[0],402,'unpaid gift cannot publish')
 if conf['readiness']['stripe']:
  for plan in ['carinho','encanto','universo']:
   code,data=api('checkout',{'offer_version':2,'gift_id':gid,'plan_id':plan,'provider':'stripe','request_id':str(uuid.uuid4()),'return_url':'https://invalid.example/criar'},token)
   expect(code,400,'all core content reaches checkout without AI: '+plan);assert data.get('code')=='RETURN_INVALID'
 status,view=api('editor',{'gift_id':gid},token);expect(status,200,'draft can be resumed');assert len(view['gift']['photos'])==1
 for field in ['selected_games','decorations','scratch_message','start_time','album_music_enabled','stats_consent','editor_version','place','first_memory','dedication','promise','milestones','places','dreams','achievements','quiz','coupons','open_when']:assert view['gift'][field]==gift[field], 'round-trip '+field
 passed.append('all expanded gift fields survive private resume')
 management='https://api.supabase.com/v1/projects/'+cfg['ref']+'/database/query'
 mh={'Authorization':'Bearer '+cfg['token'],'Content-Type':'application/json'}
 status,rows=http(management,{'query':"update public.lk_gifts set status='paid',access_kind='lifetime',expires_at='infinity',public_consent=true where id='"+gid+"';"},mh);expect(status,201,'synthetic lifetime access fixture prepared')
 expect(api('publish',{'gift_id':gid,'slug':gift['slug'],'public_consent':True},token)[0],200,'lifetime gift publishes through actual endpoint')
 status,public=api('gift',{'slug':gift['slug']});expect(status,200,'published lifetime gift opens for recipient');assert public['gift']['expires_at']=='infinity' and 'email' not in public['gift']
 status,rows=http(management,{'query':"update public.lk_gifts set access_kind='24h',edit_expires_at=now()-interval '1 second',expires_at=now()-interval '1 second' where id='"+gid+"';"},mh);expect(status,201,'synthetic expired access fixture prepared')
 expect(api('save',{'gift_id':gid,'gift':gift},token)[0],403,'expired 24h editing denied by actual endpoint')
 expect(api('delete_photo',{'gift_id':gid,'photo_id':photo['id']},token)[0],403,'expired 24h photo mutation denied')
 expect(api('gift',{'slug':gift['slug']})[0],404,'expired site closes before cron tick')
 http(management,{'query':"update public.lk_gifts set status='draft',access_kind='legacy',edit_expires_at=null,expires_at=null,slug=null where id='"+gid+"';delete from public.lk_analytics_events where session_id='"+gift['analytics_session_id']+"';"},mh)
 expect(http(url+'/webhook/stripe',{'id':'fake'},{'Content-Type':'application/json'})[0],401,'unsigned Stripe webhook rejected')
 expect(http(url+'/webhook/mercosulpay',{'id':'fake'},{'Content-Type':'application/json'})[0],401,'unsigned Pix webhook rejected')
 if cfg.get('stripe_key') and conf['readiness']['stripe']:
  status,checkout=api('checkout',{'offer_version':2,'gift_id':gid,'plan_id':'carinho','provider':'stripe','request_id':str(uuid.uuid4()),'amount_cents':1,'return_url':origin+'/criar?rascunho=qa'},token)
  expect(status,200,'Stripe hosted checkout created');assert checkout['order']['amount_cents']==2990;passed.append('client cannot set purchase price')
  # Retrieve provider id only inside this process, then expire the unpurchased session.
  management='https://api.supabase.com/v1/projects/'+cfg['ref']+'/database/query'
  status,rows=http(management,{'query':"select provider_id from public.lk_orders where id='"+checkout['order']['id']+"'"},{'Authorization':'Bearer '+cfg['token'],'Content-Type':'application/json'})
  session=rows[0]['provider_id'];req=urllib.request.Request('https://api.stripe.com/v1/checkout/sessions/'+session+'/expire',data=b'',headers={'Authorization':'Bearer '+cfg['stripe_key']},method='POST')
  with urllib.request.urlopen(req,timeout=30) as r:expired=json.load(r);assert expired['status']=='expired'
  passed.append('unpaid test checkout expired without purchase')
  status,check=api('order_status',{'gift_id':gid,'order_id':checkout['order']['id']},token);expect(status,200,'server reconciles provider status');assert check['order']['status']=='failed'
 print(json.dumps({'ok':True,'passed':passed,'count':len(passed),'readiness':conf['readiness']},ensure_ascii=False),flush=True)
finally:
 if fixtures:
  for gid in fixtures:
   try:
    http('https://api.supabase.com/v1/projects/'+cfg['ref']+'/database/query',{'query':"update public.lk_gifts set status='draft',access_kind='legacy',edit_expires_at=null,expires_at=null,slug=null where id='"+gid+"';"},{'Authorization':'Bearer '+cfg['token'],'Content-Type':'application/json'})
    status,view=api('editor',{'gift_id':gid},token)
    for p in view.get('gift',{}).get('photos',[]):api('delete_photo',{'gift_id':gid,'photo_id':p['id']},token)
    query="delete from public.lk_orders where gift_id='"+gid+"'; delete from public.lk_gifts where id='"+gid+"' and status='draft';"
    http('https://api.supabase.com/v1/projects/'+cfg['ref']+'/database/query',{'query':query},{'Authorization':'Bearer '+cfg['token'],'Content-Type':'application/json'})
   except Exception:print('Synthetic fixture cleanup requires review.',flush=True)
