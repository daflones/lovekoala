import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

// Exercise the actual Edge HTTP handler with isolated provider/database doubles.
// No request is allowed to reach a network service or create a real charge.
test('Stripe mensal, compra única e renovação manual enviam contratos de cobrança distintos',async()=>{
 const originalDeno=globalThis.Deno,originalFetch=globalThis.fetch;
 const origin='https://lovekoala.test',root='https://database.test';
 const id='00000000-0000-4000-8000-000000000001',uid='00000000-0000-4000-8000-000000000002',oid='00000000-0000-4000-8000-000000000003';
 const env={SUPABASE_URL:root,SUPABASE_SERVICE_ROLE_KEY:'server-test-credential',SITE_URL:origin,STRIPE_SECRET_KEY:'provider-test-credential',STRIPE_WEBHOOK_SECRET:'webhook-test-credential'};
 let handler,cycle='monthly',purpose='initial',captured,prepared;
 const gift={id,owner_user_id:uid,status:'draft',content:{sender:'Ana',recipient:'Bia',letter:'Uma carta',email:'qa@lovekoala.invalid'}};
 const plan={id:'carinho',name:'Carinho',price_cents:2990,monthly_price_cents:1990,max_photos:20,formats:['album','retrospectiva']};
 const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 globalThis.Deno={env:{get:name=>env[name]},serve:fn=>{handler=fn;}};
 globalThis.fetch=async(url,init={})=>{
  const u=new URL(url);const path=u.pathname;
  if(u.origin===root){
   if(path==='/auth/v1/user')return response({id:uid,email:'qa@lovekoala.invalid'});
   if(path==='/rest/v1/rpc/lk_capture_checkout')return response(oid);
   if(path==='/rest/v1/rpc/lk_allow'||path==='/rest/v1/rpc/lk_claim_order')return response(true);
   if(path==='/rest/v1/lk_profiles')return response(u.searchParams.has('disabled')?[]:[{id:uid,disabled:false}]);
   if(path==='/rest/v1/lk_gifts')return response([gift]);
   if(path==='/rest/v1/lk_photos')return response([{id}]);
   if(path==='/rest/v1/lk_plans')return response([plan]);
   if(path==='/rest/v1/rpc/lk_prepare_order_v2'){
    prepared=JSON.parse(init.body);assert.equal(prepared.p_cycle,cycle);
    return response({id:oid,gift_id:id,plan_id:plan.id,billing_cycle:cycle,purpose,amount_cents:cycle==='monthly'?1990:2990});
   }
   if(path==='/rest/v1/lk_orders'&&init.method==='PATCH')return response([{id:oid,billing_cycle:cycle,purpose,amount_cents:cycle==='monthly'?1990:2990,...JSON.parse(init.body)}]);
  }
  if(u.origin==='https://api.stripe.com'&&path==='/v1/checkout/sessions'){
   captured=new URLSearchParams(init.body);assert.equal(init.headers['Idempotency-Key'],'lovekoala-'+oid);
   return response({id:'cs_fixture',url:'https://checkout.stripe.com/fixture'});
  }
  throw new Error('Unexpected request in isolated contract test: '+u.origin+path);
 };
 try{
  const ts=await readFile(new URL('../supabase/functions/lovekoala-api/index.ts',import.meta.url),'utf8');
  const {code}=await transform(ts,{loader:'ts',format:'esm',target:'es2022'});
  await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  for(const scenario of [{cycle:'monthly',purpose:'initial',mode:'subscription'},{cycle:'once',purpose:'initial',mode:'payment'},{cycle:'monthly',purpose:'renewal',mode:'payment'}]){
   cycle=scenario.cycle;purpose=scenario.purpose;captured=null;
   const result=await handler(new Request(origin+'/functions/v1/lovekoala-api',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+('a'.repeat(64))},body:JSON.stringify({action:'checkout',offer_version:2,gift_id:id,plan_id:plan.id,provider:'stripe',billing_cycle:cycle,request_id:crypto.randomUUID(),amount_cents:1,return_url:origin+'/criar'})}));
   const body=await result.json();assert.equal(result.status,200,body.message);assert.equal(captured.get('mode'),scenario.mode);
   assert.equal(captured.get('line_items[0][price_data][unit_amount]'),cycle==='monthly'?'1990':'2990');
   assert.equal(captured.get('line_items[0][price_data][currency]'),'brl');
   assert.equal(captured.get('metadata[gift_id]'),id);
   if(scenario.mode==='subscription'){
    assert.equal(captured.get('line_items[0][price_data][recurring][interval]'),'month');
    assert.equal(captured.get('subscription_data[metadata][application]'),'lovekoala');
    assert.equal(captured.get('payment_intent_data[metadata][application]'),null);
   }else{
    assert.equal(captured.get('line_items[0][price_data][recurring][interval]'),null);
    assert.equal(captured.get('payment_intent_data[metadata][application]'),'lovekoala');
   }
  }
 }finally{globalThis.Deno=originalDeno;globalThis.fetch=originalFetch;}
});
