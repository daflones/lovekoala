import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

test('controles de Koala e pagamentos exigem admin e preservam origem e confirmação da aprovação',async()=>{
 const prior={Deno:globalThis.Deno,fetch:globalThis.fetch},root='https://database.test',origin='https://lovekoala.com.br';
 const uid='00000000-0000-4000-8000-000000000001',oid='00000000-0000-4000-8000-000000000002',gid='00000000-0000-4000-8000-000000000003';
 let handler,admin=false,enabled=true,revision=1,providerCalls=0,approvals=0,verified=0,order={id:oid,gift_id:gid,provider_id:'pix-fixture',status:'pending',provider:'mercosulpay',amount_cents:2990,billing_cycle:'once'};
 const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json'}});
 globalThis.Deno={env:{get:n=>({SUPABASE_URL:root,SUPABASE_SERVICE_ROLE_KEY:'fixture-service',SITE_URL:origin,NVIDIA_CHAT_API_KEY:'fixture-chat',MERCOSULPAY_API_KEY:'fixture-pix'}[n])},serve:fn=>{handler=fn;}};
 globalThis.fetch=async(target,init={})=>{
  const u=new URL(target),p=u.pathname,b=init.body?JSON.parse(init.body):{};
  if(u.origin===root){
   if(p==='/auth/v1/user')return json({id:uid});
   if(p==='/rest/v1/lk_profiles')return json([]);
   if(p==='/rest/v1/lk_admins')return json(admin?[{user_id:uid}]:[]);
   if(p==='/rest/v1/lk_site_settings'){
    if(init.method==='PATCH'){enabled=b.data.features.koala_chat;revision=b.revision;}
    return json([{id:'public',revision,data:{copy:{title:'Preservado'},features:{koala_chat:enabled}}}]);
   }
   if(p==='/rest/v1/lk_admin_audit')return json([]);
   if(p==='/rest/v1/lk_orders')return json([order]);
   if(p==='/rest/v1/lk_subscriptions')return json([]);
   if(p==='/rest/v1/lk_gifts')return json([{id:gid,status:'paid',expires_at:'infinity',access_kind:'lifetime'}]);
   if(p==='/rest/v1/rpc/lk_allow')return json(true);
   if(p==='/rest/v1/rpc/lk_set_koala_chat'){assert.equal(b.p_admin,uid);enabled=b.p_enabled;revision++;return json({chat_enabled:enabled,revision});}
   if(p==='/rest/v1/rpc/lk_admin_approve_order'){assert.equal(b.p_admin,uid);assert.equal(b.p_order,oid);assert.equal(b.p_reason,'Recebimento conferido no extrato.');assert.equal(b.p_amount,2990);approvals++;order={...order,status:'paid',approval_source:'manual'};return json({ok:true,order_id:oid,approval_source:'manual'});}
   if(p==='/rest/v1/rpc/lk_verify_manual_order'){verified++;order={...order,approval_source:'provider'};return json(true);}
   if(p==='/rest/v1/rpc/lk_restore_paid_access')return json(false);
  }
  if(u.origin==='https://mercosulpay.com'){providerCalls++;return json({id:'pix-fixture',reference_id:oid,amount:29.90,currency:'BRL',status:verified===-1?'completed':'expired'});}
  if(u.origin==='https://integrate.api.nvidia.com'){providerCalls++;assert.fail('Disabled customer chat must never invoke NVIDIA');}
  assert.fail('Unexpected request '+u.origin+p);
 };
 const call=async(action,data={},auth=true)=>{const response=await handler(new Request(root+'/functions/v1/lovekoala-api',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+('a'.repeat(64))}:{})},body:JSON.stringify({action,...data})}));return {status:response.status,body:await response.json()};};
 try{
  const {code}=await transform(await readFile(new URL('../supabase/functions/lovekoala-api/index.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm',target:'es2022'});await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const approval={order_id:oid,amount_cents:2990,reason:'Recebimento conferido no extrato.',confirm:true,admin_id:'forged-admin'};
  for(const action of ['admin_koala_toggle','admin_payment_approve']){
   assert.equal((await call(action,approval,false)).status,401);
   assert.equal((await call(action,approval)).status,403);
  }
  assert.equal(approvals,0);admin=true;
  assert.equal((await call('admin_koala_toggle',{enabled:'false'})).status,400);
  assert.equal((await call('admin_koala_toggle',{enabled:false,admin_id:'forged-admin'})).body.chat_enabled,false);
  const disabled=await call('koala_chat',{messages:[{role:'user',content:'Olá'}]},false);assert.equal(disabled.status,503);assert.equal(disabled.body.code,'KOALA_DISABLED');assert.equal(providerCalls,0);
  const ai=await call('admin_ai_config');assert.equal(ai.body.chat_enabled,false);assert.equal(ai.body.chat,true,'Captain/provider readiness remains independent');
  const saved=await call('admin_settings_save',{revision,data:{features:{koala_chat:false}}});assert.equal(saved.body.settings.data.features.koala_chat,false,'CMS saves preserve the feature setting');
  assert.equal((await call('admin_payment_approve',{...approval,confirm:false})).status,400);
  assert.equal((await call('admin_payment_approve',{...approval,reason:'curto'})).status,400);assert.equal(approvals,0);
  assert.equal((await call('admin_payment_approve',approval)).status,200);assert.equal(approvals,1);assert.equal(providerCalls,0,'manual approval does not charge the customer or invent a provider receipt');
  let checked=await call('admin_payment_check',{order_id:oid});assert.equal(checked.body.order.status,'paid','expired provider checkout must not revoke a manual approval');assert.equal(checked.body.order.approval_source,'manual');
  verified=-1;checked=await call('admin_payment_check',{order_id:oid});assert.equal(checked.body.order.approval_source,'provider');assert.equal(verified,0,'real provider confirmation records verification without another access grant');assert.equal(approvals,1);
  const listed=await call('admin_orders');assert.equal(listed.body.orders[0].id,oid);
 }finally{globalThis.Deno=prior.Deno;globalThis.fetch=prior.fetch;}
});
