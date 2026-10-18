import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

test('ativação do domínio exige proxies assinados, preserva o endpoint dedicado e usa callback no Pix',async()=>{
 const saved={Deno:globalThis.Deno,fetch:globalThis.fetch};
 const root='https://database.test',origin='https://lovekoala.com.br',uid='00000000-0000-4000-8000-000000000001',gid='00000000-0000-4000-8000-000000000002',oid='00000000-0000-4000-8000-000000000003';
 let handler,ready=false,admin=true,base='',hook={id:'we_lovekoala',url:root+'/functions/v1/lovekoala-api/webhook/stripe',status:'enabled',enabled_events:['charge.refunded']},mutations=[],pix;
 const json=(d,status=200,headers={})=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json',...headers}});
 globalThis.Deno={env:{get:n=>({SUPABASE_URL:root,SUPABASE_SERVICE_ROLE_KEY:'fixture-key',SITE_URL:origin,STRIPE_SECRET_KEY:'fixture-stripe',STRIPE_WEBHOOK_SECRET:'fixture-signing',MERCOSULPAY_API_KEY:'fixture-pix',MERCOSULPAY_ENABLED:'true',MERCOSULPAY_WEBHOOK_SECRET:'fixture-pix-signing'}[n])},serve:fn=>{handler=fn;}};
 globalThis.fetch=async(target,init={})=>{
  const u=new URL(target),path=u.pathname,body=typeof init.body==='string'&&init.body.startsWith('{')?JSON.parse(init.body):{};
  if(u.origin===root){
   if(path==='/auth/v1/user')return json({id:uid});
   if(path==='/rest/v1/lk_profiles')return json([]);
   if(path==='/rest/v1/lk_admins')return json(admin?[{user_id:uid}]:[]);
   if(path==='/rest/v1/rpc/lk_allow'||path==='/rest/v1/rpc/lk_claim_order')return json(true);
   if(path==='/rest/v1/rpc/lk_payment_webhook_base')return json(base);
   if(path==='/rest/v1/rpc/lk_set_payment_webhook_base'){mutations.push('vault');base=body.p_value;return json(null);}
   if(path==='/rest/v1/lk_admin_audit')return json([]);
   if(path==='/rest/v1/lk_gifts')return json([{id:gid,owner_user_id:uid,status:'draft',content:{sender:'A',recipient:'B',letter:'Carta',email:'qa@example.invalid'}}]);
   if(path==='/rest/v1/lk_photos')return json([{id:gid}]);
   if(path==='/rest/v1/lk_plans')return json([{id:'encanto',name:'Para sempre',access_kind:'lifetime'}]);
   if(path==='/rest/v1/rpc/lk_prepare_order_v2')return json({id:oid,gift_id:gid,amount_cents:4990,provider:'mercosulpay'});
   if(path==='/rest/v1/rpc/lk_capture_checkout')return json(oid);
   if(path==='/rest/v1/lk_orders')return json([{id:oid,...body}]);
  }
  if(u.origin===origin&&path.startsWith('/api/webhooks/')){assert.equal(init.body,'{}');assert.equal(init.redirect,'error');assert(!init.headers.Authorization);return json({code:ready?'BAD_SIGNATURE':'WRONG_SITE'},401,{'x-lovekoala-webhook':path.split('/').at(-1)});}
  if(u.origin==='https://api.stripe.com'){
   if(path==='/v1/webhook_endpoints')return json({data:[{id:'we_other_project',url:'https://another.test/webhook',status:'enabled'},hook]});
   assert.equal(path,'/v1/webhook_endpoints/we_lovekoala');const fields=new URLSearchParams(init.body);mutations.push('stripe');hook={...hook,url:fields.get('url')||hook.url,enabled_events:[...fields].filter(([key])=>key.startsWith('enabled_events[')).map(([,value])=>value)};return json(hook);
  }
  if(u.origin==='https://mercosulpay.com'){pix=body;return json({id:'pix-fixture',qr_code:'fixture-pix-code',reference_id:oid,amount:49.9});}
  assert.fail('Unexpected production operation: '+path);
 };
 const call=action=>handler(new Request(root+'/functions/v1/lovekoala-api',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+('a'.repeat(64))},body:JSON.stringify(typeof action==='string'?{action}:action)}));
 try{
  const source=await readFile(new URL('../supabase/functions/lovekoala-api/index.ts',import.meta.url),'utf8');const {code}=await transform(source,{loader:'ts',format:'esm',target:'es2022'});await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  admin=false;assert.equal((await call('admin_production_status')).status,403);admin=true;
  assert.equal((await call('admin_production_activate')).status,409);assert.equal(mutations.length,0);assert.equal(base,'');
  ready=true;assert.equal((await call('admin_production_activate')).status,200);assert.deepEqual(mutations,['stripe','vault']);assert.equal(hook.url,origin+'/api/webhooks/stripe');assert(hook.enabled_events.includes('invoice.paid'));assert(hook.enabled_events.includes('customer.subscription.deleted'));
  const status=await (await call({action:'admin_production_status',verify:true})).json();assert.equal(status.custom_domain_active,true);assert.equal(status.stripe_events_ready,true);assert(status.checks.every(c=>c.ready));
  const checkout=await call({action:'checkout',gift_id:gid,plan_id:'encanto',provider:'mercosulpay',request_id:uid,offer_version:2,return_url:origin+'/criar?id='+gid});assert.equal(checkout.status,200);assert.equal(pix.webhook_url,origin+'/api/webhooks/mercosulpay');assert.equal(pix.amount,49.9);
  const unsigned=await handler(new Request(root+'/functions/v1/lovekoala-api/webhook/stripe',{method:'POST',body:'{}'}));assert.equal(unsigned.status,401);assert.equal((await unsigned.json()).code,'BAD_SIGNATURE');
 }finally{globalThis.Deno=saved.Deno;globalThis.fetch=saved.fetch;}
});
