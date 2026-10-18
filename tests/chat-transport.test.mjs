import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

const dataModule=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
async function client(){
 let source=await readFile(new URL('../src/api.ts',import.meta.url),'utf8');
 source=source.replaceAll("'./auth'",JSON.stringify(dataModule("export async function authToken(){return 'fixture-auth-token';}"))).replaceAll("'./backend-config'",JSON.stringify(dataModule("export const SUPABASE_URL='https://database.test',PUBLIC_KEY='fixture-public',ENDPOINT=SUPABASE_URL+'/functions/v1/lovekoala-api';"))).replaceAll("'./koala-navigation.mjs'",JSON.stringify(new URL('../src/koala-navigation.mjs',import.meta.url).href)).replaceAll("'./ai-studio.mjs'",JSON.stringify(new URL('../src/ai-studio.mjs',import.meta.url).href));
 const {code}=await transform(source,{loader:'ts',format:'esm',target:'es2022'});return import(dataModule(code));
}

test('chats concluem no evento done sem esperar a conexão fechar e cancelam o leitor',async()=>{
 const original=globalThis.fetch;let canceled=0;const encoder=new TextEncoder();
 globalThis.fetch=async(_,init)=>{const captain=JSON.parse(init.body).action==='admin_captain_chat';return new Response(new ReadableStream({start(c){c.enqueue(encoder.encode('event: status\ndata: {"text":"Preparando…"}\n\nevent: delta\ndata: {"text":"Olá"}\n\n'+(captain?'':'event: action\ndata: {"destination":"plans"}\n\n')+'event: done\ndata: {}\n\n'));},cancel(){canceled++;}}),{headers:{'Content-Type':'text/event-stream'}});};
 try{
  const {streamKoala,streamCaptain}=await client(),pieces=[],status=[];
  const signal=AbortSignal.timeout(1000);const action=await streamKoala([{role:'user',content:'Planos'}],t=>pieces.push(t),signal,'home',t=>status.push(t));assert.equal(action.destination,'plans');assert.deepEqual(pieces,['Olá']);assert.deepEqual(status,['Preparando…']);
  const events=[];await streamCaptain([{role:'user',content:'Receita?'}],(e,d)=>events.push([e,d]),signal);assert(events.some(([e])=>e==='done'));assert.equal(canceled,2);
 }finally{globalThis.fetch=original;}
});

test('erro de streaming encerra ambos os chats sem bloquear a próxima pergunta',async()=>{
 const original=globalThis.fetch;let canceled=0;const encoder=new TextEncoder();
 globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(encoder.encode('event: ready\ndata: {}\n\nevent: error\ndata: {"message":"IA temporariamente indisponível"}\n\n'));},cancel(){canceled++;}}),{headers:{'Content-Type':'text/event-stream'}});
 try{const {streamKoala,streamCaptain}=await client(),signal=AbortSignal.timeout(1000);await assert.rejects(streamKoala([{role:'user',content:'Olá'}],()=>{},signal),/IA temporariamente indisponível/);await assert.rejects(streamCaptain([{role:'user',content:'Olá'}],()=>{},signal),/IA temporariamente indisponível/);assert.equal(canceled,2);}finally{globalThis.fetch=original;}
});
