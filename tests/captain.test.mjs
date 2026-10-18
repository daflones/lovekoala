import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {sseDecoder} from '../src/ai-studio.mjs';
test('Capitão consulta dados, propõe sem alterar e só aplica proposta anterior após confirmação de admin',async()=>{
 const prior={Deno:globalThis.Deno,fetch:globalThis.fetch};const origin='https://lovekoala.com.br',root='https://database.test',uid='00000000-0000-4000-8000-000000000001',pid='00000000-0000-4000-8000-000000000002';let handler,admin=true,pending=[],plan={id:'encanto',name:'Para sempre',description:'Plano',features:[],formats:['album','retrospectiva','ambos'],price_cents:4990,monthly_price_cents:4990,max_photos:40,monthly_gifts:2,active:true,access_kind:'lifetime'},mode='report',round=0,applied=0,proposed=0,provider=0;
 const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json'}});
 globalThis.Deno={env:{get:n=>({SUPABASE_URL:root,SUPABASE_SERVICE_ROLE_KEY:'fixture-service',SITE_URL:origin,NVIDIA_CHAT_API_KEY:'fixture-chat'}[n])},serve:fn=>{handler=fn;}};
 globalThis.fetch=async(target,init={})=>{const u=new URL(target),p=u.pathname,b=typeof init.body==='string'&&init.body.startsWith('{')?JSON.parse(init.body):{};
  if(u.origin===root){
   if(p==='/auth/v1/user')return json({id:uid,email:'admin@example.invalid'});
   if(p==='/rest/v1/lk_profiles')return json([]);
   if(p==='/rest/v1/lk_admins')return json(admin?[{user_id:uid}]:[]);
   if(p==='/rest/v1/rpc/lk_allow')return json(true);
   if(p==='/rest/v1/lk_plans')return json([plan]);
   if(p==='/rest/v1/lk_site_settings')return json([{id:'public',data:{steps:[]},revision:1}]);
   if(p==='/rest/v1/lk_captain_proposals'){if(init.method==='POST'){proposed++;const row={id:pid,status:'pending',...b};pending=[row];return json([row]);}return json(pending);}
   if(p==='/rest/v1/rpc/lk_captain_report'){assert.equal(b.p_year,2026);return json({year:2026,months:[{month:'2026-10',revenue_cents:12345,confirmed_payments:3}]});}
   if(p==='/rest/v1/rpc/lk_apply_captain_change'){applied++;return json({ok:true,id:pid});}
  }
  if(u.origin==='https://integrate.api.nvidia.com'){
   provider++;assert.equal(b.model,'nvidia/nemotron-3.5-lightning-30b-a3b');assert.equal(b.reasoning_budget,0);assert.equal(b.chat_template_kwargs.enable_thinking,false);assert(!JSON.stringify(b).includes('fixture-service'));let frames;
   if(round++===0){const name=mode==='report'?'monthly_report':mode==='settings'?'read_site_settings':mode==='propose'?'propose_plan':'apply_proposal';const args=mode==='report'?{year:2026,month:10}:mode==='settings'?{}:mode==='propose'?{plan_id:'encanto',changes:{price_cents:5990}}:{proposal_id:pid};frames=[{choices:[{delta:{reasoning_content:'PRIVATE REASONING',tool_calls:[{index:0,id:'call-1',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}]}];}
   else{const toolMessage=b.messages.findLast(m=>m.role==='tool');assert(toolMessage);if(mode==='report'){const data=JSON.parse(toolMessage.content);assert.match(data.report.months[0].revenue_brl,/123,45/);assert(data.money_instructions.includes('centavos'));}if(mode==='settings'){const data=JSON.parse(toolMessage.content);assert.equal(data.settings.steps.length,13);assert.equal(data.settings.steps[5].title,'A música');assert(data.fields.some(f=>f.id==='faq.0.a'));}frames=[{choices:[{delta:{content:'Consulta concluída. Confira o resultado e as propostas.'},finish_reason:'stop'}]}];}
   return new Response(frames.map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }
  assert.fail('Unexpected Captain request: '+p);
 };
 const call=async(question,auth=true)=>{round=0;return handler(new Request(root+'/functions/v1/lovekoala-api',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+('a'.repeat(64))}:{})},body:JSON.stringify({action:'admin_captain_chat',messages:[{role:'user',content:question}]})}));};
 const parse=async(r)=>{const events=[],decoder=sseDecoder((type,data)=>events.push({type,...JSON.parse(data)}));decoder.push(await r.text());decoder.finish();assert(!JSON.stringify(events).includes('PRIVATE REASONING'));return events;};
 try{
  const {code}=await transform(await readFile(new URL('../supabase/functions/lovekoala-api/index.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm',target:'es2022'});await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  assert.equal((await call('Receita?',false)).status,401);admin=false;assert.equal((await call('Receita?')).status,403);assert.equal(provider,0);admin=true;
  let events=await parse(await call('Como foi outubro de 2026?'));assert(events.some(e=>e.type==='report'&&e.months[0].revenue_cents===12345));assert(events.some(e=>e.type==='done'));assert.equal(applied,0);
  mode='settings';await parse(await call('Quais são as etapas e os textos atuais?'));
  mode='propose';events=await parse(await call('Altere o Para sempre para 59,90.'));assert.equal(proposed,1);assert(events.some(e=>e.type==='proposal'));assert.equal(applied,0);assert.equal(plan.price_cents,4990);
  mode='apply';await parse(await call('Como eu aplicaria essa proposta?'));assert.equal(applied,0);
  events=await parse(await call('Sim, pode aplicar.'));assert.equal(applied,1);assert(events.some(e=>e.type==='applied'));
  pending=[];await parse(await call('Aplique uma proposta inventada.'));assert.equal(applied,1);
 }finally{globalThis.Deno=prior.Deno;globalThis.fetch=prior.fetch;}
});
