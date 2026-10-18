import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
test('Clube usa o proprietário autenticado e libera um presente sem nova cobrança',async()=>{
 const savedDeno=globalThis.Deno,savedFetch=globalThis.fetch;
 const root='https://database.test',origin='https://lovekoala.test',gid='10000000-0000-4000-8000-000000000001',uid='10000000-0000-4000-8000-000000000002';let handler,redeems=0,deny=false,anonymous=false;
 let gift={id:gid,owner_user_id:uid,status:'draft',expires_at:null,access_kind:'legacy',content:{sender:'QA',recipient:'Clube'},format:'album',plan_id:'universo'};
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 globalThis.Deno={env:{get:n=>({SUPABASE_URL:root,SUPABASE_SERVICE_ROLE_KEY:'fixture-service',SITE_URL:origin}[n])},serve:fn=>{handler=fn;}};
 globalThis.fetch=async(target,init={})=>{const u=new URL(target),p=u.pathname;if(u.origin!==root)throw Error('No provider or purchase is expected for a club redemption');
  if(p==='/auth/v1/user')return json(anonymous?{}:{id:uid},anonymous?401:200);
  if(p==='/rest/v1/lk_profiles'||p==='/rest/v1/lk_photos'||p==='/rest/v1/lk_image_jobs')return json([]);
  if(p==='/rest/v1/rpc/lk_allow')return json(true);
  if(p==='/rest/v1/lk_gifts')return json([gift]);
  if(p==='/rest/v1/rpc/lk_redeem_club_gift'){const args=JSON.parse(init.body);assert.equal(args.p_owner,uid);assert.equal(args.p_gift,gid);if(deny)return json({message:'CLUB_LIMIT'},400);redeems++;gift={...gift,status:'paid',access_kind:'club',expires_at:'infinity'};return json({ok:true});}
  if(p==='/rest/v1/rpc/lk_club_balance')return json({active:true,limit:2,used:2,remaining:0});
  throw Error('Unexpected club request '+p);
 };
 const call=async()=>{const r=await handler(new Request(origin+'/api',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(anonymous?{}:{Authorization:'Bearer '+('a'.repeat(64))})},body:JSON.stringify({action:'redeem_club',gift_id:gid,owner_user_id:'untrusted-user',amount_cents:1})}));return {status:r.status,body:await r.json()};};
 try{const {code}=await transform(await readFile(new URL('../supabase/functions/lovekoala-api/index.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm',target:'es2022'});await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const result=await call();assert.equal(result.status,200,result.body.message);assert.equal(result.body.gift.expires_at,'infinity');assert.equal(result.body.club.remaining,0);assert.equal(redeems,1);
  deny=true;const limit=await call();assert.equal(limit.status,409);assert.equal(limit.body.code,'CLUB_LIMIT');assert.equal(redeems,1);
  anonymous=true;assert.equal((await call()).status,401);assert.equal(redeems,1);
 }finally{globalThis.Deno=savedDeno;globalThis.fetch=savedFetch;}
});
