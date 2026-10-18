export const AI_STYLES=[
 {id:'storybook',name:'Filme de animação',detail:'Luz suave e um romance de cinema.',color:'#b696cf'},
 {id:'watercolor',name:'Aquarela',detail:'Papel, pinceladas e tons delicados.',color:'#e1aaac'},
 {id:'cinematic',name:'Retrato de cinema',detail:'Uma cena com luz e atmosfera.',color:'#7d9b9e'},
 {id:'travel',name:'Cartão de viagem',detail:'Vocês em um lugar dos sonhos.',color:'#dbb273'}
];
export const AI_EXAMPLES=[
 'Nós dois em um piquenique num jardim, ao pôr do sol, com flores e uma manta.',
 'Um passeio abraçados por Paris à noite, com luzes quentes e clima romântico.',
 'Um retrato nosso em uma cabana nas montanhas, tomando chocolate quente.',
 'Nós observando as estrelas na praia, de mãos dadas, com o mar iluminado.'
];
export function aiLimit(plan){return ['encanto','universo'].includes(plan?.id)?Math.min(4,Math.max(0,Number(plan.image_credits)||0)):0;}
export function studioPhotos(gift){return [...(gift.photos||[]),...(gift.illustrations||[]).map(a=>({...a,caption:a.caption||'Uma cena imaginada para nós.',ai:true}))];}
// SSE parsing handles split UTF-8/CRLF boundaries without exposing model reasoning.
export function sseDecoder(onEvent){let buffer='';return {push(chunk){buffer+=chunk;buffer=buffer.replace(/\r\n/g,'\n');let i;while((i=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,i);buffer=buffer.slice(i+2);const type=frame.split('\n').find(l=>l.startsWith('event:'))?.slice(6).trim()||'message';const data=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data)onEvent(type,data);}},finish(){if(buffer.trim())this.push('\n\n');}};}

export function koalaHistory(messages){const result=[];let size=0;for(let i=messages.length-1;i>=0&&result.length<9;i--){const m=messages[i];if(!m.content||m.failed)continue;const item={role:m.role,content:m.content.slice(0,1500)};if(size+item.content.length>7000)break;size+=item.content.length;result.push(item);}result.reverse();while(result[0]?.role==='assistant')result.shift();return result;}
