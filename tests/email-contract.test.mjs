import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

// Exercise the production handler. All HTTP calls are doubles; no real email is sent.
test('resumo usa consentimento, remetente privado, escape de HTML e idempotência de envio',async()=>{
 const oldDeno=globalThis.Deno,oldFetch=globalThis.fetch;
 const origin='https://lovekoala.test',root='https://database.test';
 const gid='00000000-0000-4000-8000-000000000001',uid='00000000-0000-4000-8000-000000000002',oid='00000000-0000-4000-8000-000000000003',rid='00000000-0000-4000-8000-000000000004';
 const env={SUPABASE_URL:root,SUPABASE_SERVICE_ROLE_KEY:'server-fixture',SITE_URL:origin,RESEND_API_KEY:'re_fixture_only',EMAIL_FROM:'LoveKoala <qa@lovekoala.invalid>',EMAIL_ENABLED:'true'};
 let handler,mailRequests=[],providerFails=false;
 let record={id:rid,order_id:oid,gift_id:gid,email:'qa@lovekoala.invalid',resume_origin:origin,status:'abandoned',email_consent:true,email_status:'queued',email_requested_at:'2026-10-16T12:00:00Z',amount_cents:2990,billing_cycle:'once',summary:{sender:'<img src=x>',recipient:'Bia & Ana',format:'album',plan_name:'Carinho',photos:5}};
 const gift={id:gid,owner_user_id:uid,content:{email:record.email}};
 const order={id:oid,gift_id:gid,status:'created',provider:'stripe'};
 const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 globalThis.Deno={env:{get:name=>env[name]},serve:fn=>{handler=fn;}};
 globalThis.fetch=async(url,init={})=>{
  const u=new URL(url),path=u.pathname;
  if(u.origin===root){
   if(path==='/auth/v1/user')return response({id:uid,email:record.email});
   if(path==='/rest/v1/lk_profiles')return response(init.method==='POST'?[]:u.searchParams.has('disabled')?[]:[{id:uid,disabled:false}]);
   if(path==='/rest/v1/lk_gifts')return response([gift]);
   if(path==='/rest/v1/lk_orders')return response([order]);
   if(path==='/rest/v1/rpc/lk_allow')return response(true);
   if(path==='/rest/v1/rpc/lk_get_mail_config')return response({});
   if(path==='/rest/v1/rpc/lk_capture_checkout')return response(record);
   if(path==='/rest/v1/rpc/lk_take_summary')return response({claimed:record.email_status==='queued'||record.email_status==='failed',record});
   if(path==='/rest/v1/lk_checkout_recovery'){
    if(init.method==='PATCH'){record={...record,...JSON.parse(init.body)};return response([record]);}
    return response([record]);
   }
  }
  if(u.origin==='https://api.resend.com'&&path==='/emails'){
   mailRequests.push({payload:JSON.parse(init.body),key:init.headers['Idempotency-Key']});
   assert.equal(init.headers.Authorization,'Bearer '+env.RESEND_API_KEY);
   return providerFails?new Response('{}',{status:503}):response({id:'email_fixture'});
  }
  throw Error('Unexpected isolated mail request: '+u.origin+path);
 };
 const call=async(consent=true)=>{
  const r=await handler(new Request(origin+'/functions/v1/lovekoala-api',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+('a'.repeat(64))},body:JSON.stringify({action:'request_summary_email',gift_id:gid,order_id:oid,consent,email:record.email})}));return {status:r.status,body:await r.json()};
 };
 try{
  const ts=await readFile(new URL('../supabase/functions/lovekoala-api/index.ts',import.meta.url),'utf8');const {code}=await transform(ts,{loader:'ts',format:'esm',target:'es2022'});await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  assert.equal((await call(false)).status,400);assert.equal(mailRequests.length,0);
  providerFails=true;const failed=await call();assert.equal(failed.status,200,failed.body.message);assert.equal(failed.body.email_status,'failed');assert.equal(mailRequests.length,1);
  providerFails=false;const sent=await call();assert.equal(sent.status,200,sent.body.message);assert.equal(sent.body.email_status,'sent');assert.equal(mailRequests.length,2);
  assert.equal(mailRequests[0].key,mailRequests[1].key);assert.deepEqual(mailRequests[0].payload,mailRequests[1].payload);assert(mailRequests[1].payload.html.includes('&lt;img src=x&gt;'));assert(!mailRequests[1].payload.html.includes('<img src=x>'));assert(mailRequests[1].payload.text.includes('/criar?id='+gid+'&continuar=1'));
  assert.equal((await call()).body.email_status,'sent');assert.equal(mailRequests.length,2);
  record={...record,status:'recovered',email_status:'skipped'};assert.equal((await call()).body.email_status,'skipped');assert.equal(mailRequests.length,2);
  record={...record,status:'abandoned',email_status:'queued'};env.EMAIL_ENABLED='false';assert.equal((await call()).body.email_status,'unavailable');assert.equal(mailRequests.length,2);
 }finally{globalThis.Deno=oldDeno;globalThis.fetch=oldFetch;}
});
