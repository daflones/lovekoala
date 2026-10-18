import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {emptyGift} from '../src/domain.mjs';
test('visitante paga com chave privada sem criar conta; publicar exige conta; vinculação usa RPC atômica',async()=>{
 const previous={Deno:globalThis.Deno,fetch:globalThis.fetch};const origin='https://lovekoala.com.br',root='https://db.test',gid='00000000-0000-4000-8000-000000000001',uid='00000000-0000-4000-8000-000000000002',oid='00000000-0000-4000-8000-000000000003';
 const edit='a'.repeat(64),hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(edit))).toString('hex');let handler,signedIn=false,claimed=0,paid=false,charge=0,wrongEmail=false,saved=0;
 const gift={id:gid,edit_token_hash:hash,status:'draft',owner_user_id:null,plan_id:'encanto',format:'album',theme:'eucalipto',content:{sender:'Ana',recipient:'Bia',letter:'Minha carta',email:'buyer@example.invalid'},checkout_email:'buyer@example.invalid',expires_at:'infinity',access_kind:'lifetime'};
 const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json'}});
 globalThis.Deno={env:{get:n=>({SUPABASE_URL:root,SUPABASE_SERVICE_ROLE_KEY:'fixture',SITE_URL:origin,STRIPE_SECRET_KEY:'fixture-stripe',STRIPE_WEBHOOK_SECRET:'fixture-hook'}[n])},serve:fn=>{handler=fn;}};
 globalThis.fetch=async(target,init={})=>{const u=new URL(target),p=u.pathname,b=typeof init.body==='string'&&init.body.startsWith('{')?JSON.parse(init.body):{};
 if(u.origin===root){
  if(p==='/rest/v1/rpc/lk_allow'||p==='/rest/v1/rpc/lk_claim_order')return json(true);
  if(p==='/auth/v1/user')return json({id:uid,email:'buyer@example.invalid'});
  if(p==='/rest/v1/lk_profiles')return json([]);
  if(p==='/rest/v1/lk_gifts'){if(init.method==='PATCH'){saved++;assert(!Object.hasOwn(b,'owner_user_id'));assert.equal(b.content.email,gift.checkout_email);assert.equal(b.content.relationship_city,'Teresópolis');assert.equal(b.content.relationship_state,'RJ');return json([gift]);}return json(u.searchParams.get('edit_token_hash')==='eq.'+hash||!u.searchParams.has('edit_token_hash')?[{...gift,status:paid?'paid':'draft'}]:[]);}
  if(p==='/rest/v1/lk_photos')return json([{id:gid}]);
  if(p==='/rest/v1/lk_image_jobs')return json([]);
  if(p==='/rest/v1/lk_orders')return json(init.method==='PATCH'?[{id:oid,...b}]:u.searchParams.get('select')==='id'?[{id:oid}]:[]);
  if(p==='/rest/v1/lk_plans')return json([{id:'encanto',name:'Para sempre',access_kind:'lifetime',formats:['album','retrospectiva','ambos'],max_photos:40}]);
  if(p==='/rest/v1/rpc/lk_prepare_order_v2')return json({id:oid,gift_id:gid,amount_cents:4990,provider:'stripe',billing_cycle:'once'});
  if(p==='/rest/v1/rpc/lk_capture_checkout')return json({});
  if(p==='/rest/v1/rpc/lk_claim_gift_owner'){assert(signedIn);assert.equal(b.p_owner,uid);if(wrongEmail)return json({message:'CHECKOUT_EMAIL_REQUIRED'},400);claimed++;gift.owner_user_id=uid;return json(null);}
 }
 if(u.origin==='https://api.stripe.com'){charge++;return json({id:'cs-fixture',url:'https://checkout.stripe.com/fixture'});}
 assert.fail('Unexpected guest operation: '+p);
 };
 const call=(action,extra={},token=edit)=>handler(new Request(root+'/functions/v1/lovekoala-api',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-edit-token':token,...(signedIn?{Authorization:'Bearer '+('z'.repeat(64))}:{})},body:JSON.stringify({action,gift_id:gid,...extra})}));
 try{
 const {code}=await transform(await readFile(new URL('../supabase/functions/lovekoala-api/index.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm',target:'es2022'});await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const r=await call('checkout',{provider:'stripe',plan_id:'encanto',offer_version:2,request_id:uid,return_url:origin+'/criar?rascunho=test'});assert.equal(r.status,200);assert.equal(charge,1);assert.equal(claimed,0);assert.equal(gift.owner_user_id,null);
 assert.equal((await call('checkout',{provider:'stripe',plan_id:'encanto',request_id:uid,return_url:origin+'/criar'},'b'.repeat(64))).status,404);
 paid=true;assert.equal((await call('publish',{slug:'ana-e-bia',public_consent:true})).status,401);
 signedIn=true;wrongEmail=true;const changed={...emptyGift,...gift.content,format:'album',theme:'eucalipto',plan_id:'encanto',email:'changed@example.invalid',relationship_city:'Teresópolis',relationship_state:'rj',photos:[]};assert.equal((await call('save',{gift:changed})).status,403);assert.equal(saved,0);assert.equal(gift.owner_user_id,null);
 wrongEmail=false;assert.equal((await call('save',{gift:changed})).status,200);assert.equal(saved,1);assert.equal(claimed,1);assert.equal(gift.owner_user_id,uid);
 assert.equal((await call('claim_gift')).status,200);assert.equal(claimed,2);
 }finally{globalThis.Deno=previous.Deno;globalThis.fetch=previous.fetch;}
});
