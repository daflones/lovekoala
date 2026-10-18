import {authToken} from './auth';
import {SUPABASE_URL,PUBLIC_KEY,ENDPOINT} from './backend-config';
import {koalaAction} from './koala-navigation.mjs';
export {SUPABASE_URL,ENDPOINT} from './backend-config';
// NVIDIA requests were verified in this Edge region; editor/storage keep automatic routing.
const AI_ENDPOINT=ENDPOINT+'?forceFunctionRegion=us-west-1';
export type RemoteDraft={id:string;edit_token:string;status?:string};
export async function api(action:string,body:Record<string,unknown>={},draft?:RemoteDraft,timeout=30000){
 const token=await authToken();const response=await fetch(action==='ai_prepare'?AI_ENDPOINT:ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',apikey:PUBLIC_KEY,...(token?{Authorization:'Bearer '+token}:{}),...(draft?{'x-edit-token':draft.edit_token}:{})},body:JSON.stringify({action,...body,...(draft?{gift_id:draft.id}:{})}),signal:AbortSignal.timeout(timeout)});
 let data;try{data=await response.json();}catch{throw new Error('O Coala não conseguiu conectar agora. Seu rascunho continua salvo neste dispositivo.');}
 if(!response.ok)throw new Error(data.message||'Não foi possível concluir. Tente novamente.');return data;
}
export async function uploadPhoto(file:File,draft:RemoteDraft){
 const token=await authToken();const form=new FormData();form.append('file',file);form.append('gift_id',draft.id);
 const response=await fetch(ENDPOINT+'?action=upload',{method:'POST',headers:{apikey:PUBLIC_KEY,...(token?{Authorization:'Bearer '+token}:{}),'x-edit-token':draft.edit_token},body:form,signal:AbortSignal.timeout(45000)});
 const data=await response.json();if(!response.ok)throw new Error(data.message||'Não foi possível enviar esta foto.');return data;
}
export function compressPhoto(file:File):Promise<File>{return new Promise((resolve,reject)=>{if(!['image/jpeg','image/png','image/webp'].includes(file.type)){reject(new Error('Use fotos JPG, PNG ou WebP.'));return;}if(file.size>20*1024*1024){reject(new Error('Cada foto pode ter até 20 MB.'));return;}const url=URL.createObjectURL(file),im=new Image();im.onload=()=>{const scale=Math.min(1,1600/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=im.width*scale;c.height=im.height*scale;c.getContext('2d')!.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(url);c.toBlob(b=>b?resolve(new File([b],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp'})):reject(new Error('Não foi possível preparar a foto.')),'image/webp',.86);};im.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Esta foto não pôde ser aberta.'));};im.src=url;});}
export function localImage(file:File):Promise<string>{return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file);});}

export async function streamKoala(messages:{role:string;content:string}[],onDelta:(text:string)=>void,signal:AbortSignal,page='home'):Promise<ReturnType<typeof koalaAction>>{
 const token=await authToken();const response=await fetch(AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',apikey:PUBLIC_KEY,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action:'koala_chat',messages,page}),signal});
 if(!response.ok){const d=await response.json().catch(()=>({}));throw Error(d.message||'O Koala não conseguiu responder agora.');}if(!response.body)throw Error('Não foi possível abrir a conversa.');
 const {sseDecoder}=await import('./ai-studio.mjs');let done=false;let problem='';let action:ReturnType<typeof koalaAction>=null;
 const parser=sseDecoder((event:string,data:string)=>{const d=JSON.parse(data);if(event==='delta'&&typeof d.text==='string')onDelta(d.text);if(event==='action')action=koalaAction(d);if(event==='done')done=true;if(event==='error')problem=d.message||'A resposta foi interrompida.';});
 const reader=response.body.getReader(),decoder=new TextDecoder();try{for(;;){const part=await reader.read();if(part.done)break;parser.push(decoder.decode(part.value,{stream:true}));}parser.push(decoder.decode());parser.finish();if(problem)throw Error(problem);if(!done)throw Error('A conexão foi interrompida. Tente novamente.');return action;}finally{await reader.cancel().catch(()=>{});}
}
export async function uploadAiReference(file:File,subject:string,draft:RemoteDraft){
 const token=await authToken(),form=new FormData();form.append('file',file);form.append('gift_id',draft.id);form.append('subject',subject);form.append('consent','true');
 const response=await fetch(ENDPOINT+'?action=ai_reference',{method:'POST',headers:{apikey:PUBLIC_KEY,...(token?{Authorization:'Bearer '+token}:{}),'x-edit-token':draft.edit_token},body:form,signal:AbortSignal.timeout(45000)});const d=await response.json();if(!response.ok)throw Error(d.message||'Não foi possível guardar a referência.');return d;
}
// Reference copies have a small, bounded payload and no EXIF metadata.
export async function prepareReference(file:File):Promise<File>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('Use uma foto JPG, PNG ou WebP de até 20 MB.');
 const bitmap=await createImageBitmap(file);try{const scale=Math.min(1,768/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');if(!context)throw Error('Não foi possível preparar essa foto.');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Não foi possível preparar essa foto.')),'image/jpeg',.82));if(blob.size>1048576)throw Error('Escolha uma referência mais leve.');return new File([blob],'referencia.jpg',{type:'image/jpeg'});}finally{bitmap.close();}
}

export async function streamCaptain(messages:{role:string;content:string}[],onEvent:(event:string,data:any)=>void,signal:AbortSignal){
 const token=await authToken();if(!token)throw Error('Entre na sua conta administradora.');
 const response=await fetch(AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',apikey:PUBLIC_KEY,Authorization:'Bearer '+token},body:JSON.stringify({action:'admin_captain_chat',messages}),signal});
 if(!response.ok){const d=await response.json().catch(()=>({}));throw Error(d.message||'O Capitão não conseguiu abrir a conversa.');}if(!response.body)throw Error('Conexão indisponível.');
 const {sseDecoder}=await import('./ai-studio.mjs');let done=false,error='';
 const parser=sseDecoder((event:string,raw:string)=>{const data=JSON.parse(raw);if(event==='done')done=true;else if(event==='error')error=data.message||'A resposta foi interrompida.';onEvent(event,data);});
 const reader=response.body.getReader(),decoder=new TextDecoder();try{for(;;){const part=await reader.read();if(part.done)break;parser.push(decoder.decode(part.value,{stream:true}));}parser.push(decoder.decode());parser.finish();if(error)throw Error(error);if(!done)throw Error('A conexão foi interrompida. As propostas ficam salvas para revisão.');}finally{await reader.cancel().catch(()=>{});}
}
