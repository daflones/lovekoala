import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

// Reproduce the reported failure through the production handler, without a real payment.
test('pedido pago sem acesso é verificado no provedor e liberado antes de publicar',async()=>{
 const savedDeno=globalThis.Deno,savedFetch=globalThis.fetch;
 const root='https://database.test',origin='https://lovekoala.test';
 const gid='00000000-0000-4000-8000-000000000001',uid='00000000-0000-4000-8000-000000000002',oid='00000000-0000-4000-8000-000000000003';
 let handler,gift,providerPaid=true,wrongAmount=false,restores=0,providerReads=0,published=0;
 const reset=()=>{gift={id:gid,owner_user_id:uid,status:'draft',expires_at:null,paid_at:null,frozen:false,suspended:false,deleted_at:null,plan_id:'carinho',format:'retrospectiva',content:{sender:'QA',recipient:'Teste'}};};reset();
 const order={id:oid,gift_id:gid,status:'paid',provider:'mercosulpay',provider_id:'fixture-paid',amount_cents:2990,billing_cycle:'once',plan_id:'carinho'};
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 globalThis.Deno={env:{get:n=>({SUPABASE_URL:root,SUPABASE_SERVICE_ROLE_KEY:'fixture-service',SITE_URL:origin,MERCOSULPAY_API_KEY:'fixture-provider'}[n])},serve:fn=>{handler=fn;}};
 globalThis.fetch=async(target,init={})=>{
  const u=new URL(target),p=u.pathname;
  if(u.origin===root){
   if(p==='/auth/v1/user')return json({id:uid,email:'qa@lovekoala.invalid'});
   if(p==='/rest/v1/lk_profiles')return json([]);
   if(p==='/rest/v1/rpc/lk_allow')return json(true);
   if(p==='/rest/v1/lk_gifts'){
    if(init.method==='PATCH'){gift={...gift,...JSON.parse(init.body)};return json([gift]);}
    return json([gift]);
   }
   if(p==='/rest/v1/lk_orders')return json([order]);
   if(p==='/rest/v1/rpc/lk_restore_paid_access'){restores++;gift={...gift,status:'paid',paid_at:'2026-10-16T16:36:15Z',expires_at:'2099-10-16T16:36:15Z'};return json(true);}
   if(p==='/rest/v1/rpc/lk_confirm_order')throw Error('A paid order must not be confirmed as a new purchase');
   if(p==='/rest/v1/rpc/lk_publish'){
    assert.equal(gift.status,'paid');assert(gift.expires_at);published++;gift={...gift,status:'published',slug:'qa-presente'};return json('qa-presente');
   }
   if(p==='/rest/v1/lk_analytics_events')return json([]);
  }
  if(u.origin==='https://mercosulpay.com'&&p==='/api/public/v1/pix/charges/fixture-paid'){
   providerReads++;return json({data:{id:'fixture-paid',reference_id:oid,amount:wrongAmount?1:29.9,currency:'BRL',status:providerPaid?'completed':'pending'}});
  }
  throw Error('Unexpected isolated paid-access request: '+u.origin+p);
 };
 const call=async(action)=>{const r=await handler(new Request(origin+'/functions/v1/lovekoala-api',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+('a'.repeat(64))},body:JSON.stringify({action,gift_id:gid,order_id:oid,slug:'qa-presente',public_consent:true})}));return {status:r.status,body:await r.json()};};
 try{
  const ts=await readFile(new URL('../supabase/functions/lovekoala-api/index.ts',import.meta.url),'utf8');const {code}=await transform(ts,{loader:'ts',format:'esm',target:'es2022'});await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const recovered=await call('order_status');assert.equal(recovered.status,200,recovered.body.message);assert.equal(recovered.body.order.status,'paid');assert.equal(recovered.body.access_ready,true);assert.equal(restores,1);assert.equal(providerReads,1);
  assert.equal((await call('order_status')).body.access_ready,true);assert.equal(providerReads,1);assert.equal(restores,1);
  reset();const publication=await call('publish');assert.equal(publication.status,200,publication.body.message);assert.equal(publication.body.slug,'qa-presente');assert.equal(published,1);assert.equal(restores,2);
  reset();providerPaid=false;const pending=await call('publish');assert.equal(pending.status,409);assert.equal(restores,2);assert.equal(published,1);assert.equal(gift.status,'draft');assert.equal(order.status,'paid');
  reset();gift={...gift,status:'published',access_kind:'24h',edit_expires_at:'2020-01-01T00:00:00Z',expires_at:'2020-01-01T00:00:00Z'};for(const action of ['save','delete_photo','generate']){const expired=await call(action);assert.equal(expired.status,403);assert.equal(expired.body.code,'EDIT_EXPIRED');}
  reset();providerPaid=true;wrongAmount=true;const mismatch=await call('order_status');assert.equal(mismatch.status,409);assert.equal(restores,2);
 }finally{globalThis.Deno=savedDeno;globalThis.fetch=savedFetch;}
});
