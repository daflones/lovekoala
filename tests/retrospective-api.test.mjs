import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
test('API de estatísticas fornece apenas agregado, valida duração/cidade e mantém limite e origem',async()=>{
 const saved={Deno:globalThis.Deno,fetch:globalThis.fetch},root='https://db-stats.test',origin='https://lovekoala.com.br';let handler,calls=0,limited=false;
 const json=d=>new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json'}});
 globalThis.Deno={env:{get:k=>({SUPABASE_URL:root,SUPABASE_SERVICE_ROLE_KEY:'fixture',SITE_URL:origin}[k])},serve:fn=>handler=fn};
 globalThis.fetch=async(target,init={})=>{const u=new URL(target),body=JSON.parse(init.body||'{}');assert.equal(u.origin,root);if(u.pathname==='/rest/v1/rpc/lk_allow')return json(!limited);if(u.pathname==='/rest/v1/rpc/lk_story_stats'){assert.deepEqual(body,{p_days:1498,p_city:'Teresópolis',p_state:'RJ'});calls++;return json({available:true,participants:20,percentile:75,top_percent:25,city:{available:true,participants:20,rank:5,percentile:75}});}assert.fail('Unexpected request '+u.pathname);};
 const call=async(extra={},from=origin)=>{const r=await handler(new Request(root+'/functions/v1/lovekoala-api',{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify({action:'couple_stats',days:1498,city:'Teresópolis',state:'rj',...extra})}));return {status:r.status,body:await r.json()};};
 try{
  const {code}=await transform(await readFile(new URL('../supabase/functions/lovekoala-api/index.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm',target:'es2022'});await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const r=await call();assert.equal(r.status,200);assert.equal(r.body.city.rank,5);assert.equal(calls,1);assert(!JSON.stringify(r.body).includes('Teresópolis'));
  for(const days of [-1,36526,1.5,null])assert.equal((await call({days})).status,400);
  assert.equal((await call({state:'XX'})).status,400);assert.equal((await call({city:'x'.repeat(101)})).status,400);assert.equal((await call({},'https://untrusted.test')).status,403);assert.equal(calls,1);
  limited=true;assert.equal((await call()).status,429);assert.equal(calls,1);
 }finally{globalThis.Deno=saved.Deno;globalThis.fetch=saved.fetch;}
});
