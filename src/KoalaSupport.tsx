import {useEffect,useRef,useState} from 'react';
import {ArrowRight,BookOpen,ChevronDown,MessageCircle,RotateCcw,Send,Square} from 'lucide-react';
import KoalaAvatar from './KoalaAvatar';
import {streamKoala} from './api';
import {koalaHistory} from './ai-studio.mjs';
import {koalaActionLabel} from './koala-navigation.mjs';
import {useSite} from './SiteContext';
export type KoalaNavigation={destination:string;format:string;plan:string;automatic:boolean};
type Message={id:number;role:'assistant'|'user';content:string;failed?:boolean;navigation?:KoalaNavigation;moved?:boolean};
const QUICK=['Quero criar um presente','Qual plano combina comigo?','Me mostra uma retrospectiva','Como funciona o álbum?'];
export default function KoalaSupport({open,onOpen,onClose,onChoose,onNavigate,page='home'}:{open:boolean;onOpen:()=>void;onClose:()=>void;onChoose:()=>void;onNavigate:(action:KoalaNavigation)=>boolean;page?:string}){
 const {config}=useSite();
 const [messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(''),[phase,setPhase]=useState<'idle'|'thinking'|'talking'|'happy'>('idle'),[error,setError]=useState(''),[status,setStatus]=useState('');
 const body=useRef<HTMLDivElement>(null),panel=useRef<HTMLElement>(null),field=useRef<HTMLInputElement>(null),abort=useRef<AbortController|null>(null),sequence=useRef(0),pending=useRef(false),lastQuestion=useRef('');
 const navigateRef=useRef(onNavigate),pageRef=useRef(page);navigateRef.current=onNavigate;pageRef.current=page;
 const mounted=useRef(true),busy=phase==='thinking'||phase==='talking';
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;abort.current?.abort();};},[]);
 useEffect(()=>{if(open)field.current?.focus();},[open]);
 useEffect(()=>{if(!open)return;const viewport=window.visualViewport;const resize=()=>panel.current?.style.setProperty('--koala-viewport',`${viewport?.height||window.innerHeight}px`);resize();viewport?.addEventListener('resize',resize);return()=>viewport?.removeEventListener('resize',resize);},[open]);
 useEffect(()=>{const el=body.current;if(el)el.scrollTo({top:el.scrollHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});},[messages,phase,error]);
 useEffect(()=>{if(phase!=='happy')return;const timer=setTimeout(()=>setPhase('idle'),2400);return()=>clearTimeout(timer);},[phase]);
 function go(action:KoalaNavigation,id?:number){const moved=navigateRef.current(action);if(id)setMessages(list=>list.map(m=>m.id===id?{...m,moved}:m));field.current?.blur();onClose();return moved;}
 async function send(value=input,retry=false){
  const content=value.trim();if(!content||pending.current)return;
  pending.current=true;lastQuestion.current=content;setInput('');setError('');setStatus('Conectando ao Koala…');setPhase('thinking');
  const history=retry?messages.filter((m,i)=>!(i===messages.length-1&&m.role==='assistant')&&!m.failed):[...messages,{id:++sequence.current,role:'user' as const,content}];
  if(retry&&history.at(-1)?.role!=='user')history.push({id:++sequence.current,role:'user',content});
  const replyId=++sequence.current;setMessages([...history,{id:replyId,role:'assistant',content:''}]);
  const sourcePage=page;const controller=new AbortController();abort.current=controller;const timeout=setTimeout(()=>controller.abort('timeout'),120000);
  try{
   const action=await streamKoala(koalaHistory(history),piece=>{if(!mounted.current)return;setStatus('Respondendo…');setPhase('talking');setMessages(list=>list.map(m=>m.id===replyId?{...m,content:m.content+piece}:m));},controller.signal,page,text=>{if(mounted.current)setStatus(text);});
   if(!mounted.current)return;setPhase('happy');
   if(action){const nextAction={...action,automatic:action.automatic&&sourcePage===pageRef.current};setMessages(list=>list.map(m=>m.id===replyId?{...m,navigation:nextAction}:m));if(nextAction.automatic)go(nextAction,replyId);}
  }catch(e){
   if(!mounted.current)return;
   setMessages(list=>list.map(m=>m.id===replyId?{...m,failed:true}:m));
   setError(controller.signal.reason==='stop'?'Resposta interrompida.':controller.signal.aborted?'O Koala demorou para responder. Tente de novo.':(e as Error).message);setPhase('idle');
  }finally{clearTimeout(timeout);pending.current=false;if(abort.current===controller)abort.current=null;}
 }
 function reset(){abort.current?.abort('stop');setMessages([]);setError('');setInput('');setPhase('idle');}
 if(!open)return <button className="koala-support-launcher" onClick={onOpen} aria-label="Abrir suporte com o Koala"><KoalaAvatar mood={phase}/><span><strong>Precisa de uma patinha?</strong><small>Converse com o Koala</small></span><MessageCircle size={18}/></button>;
 return <aside ref={panel} className="koala-support" role="dialog" aria-label="Suporte LoveKoala com o Koala">
  <header><KoalaAvatar mood={phase}/><div><strong>Koala</strong><small aria-live="polite"><i/>{busy?status||'Preparando sua resposta…':'Seu assistente LoveKoala'}</small></div><button onClick={reset} aria-label="Começar outra conversa" disabled={busy}><RotateCcw size={16}/></button><button onClick={onClose} aria-label="Minimizar conversa"><ChevronDown size={23}/></button></header>
  <div className="koala-support-messages" ref={body} role="log" aria-label="Conversa com o Koala">
   <div className="koala-welcome"><span>UMA PATINHA, SEM COMPLICAÇÃO</span><h2>Oi, eu sou o Koala.</h2><p>Te ajudo a escolher o presente, conhecer os planos e continuar sua surpresa. Se quiser ir a alguma página, é só me pedir.</p></div>
   {!messages.length&&<div className="koala-quick">{QUICK.map(q=><button key={q} disabled={busy||config?.readiness?.koala===false} onClick={()=>send(q)}>{q}<ArrowRight size={14}/></button>)}</div>}
   {messages.map(m=><div className={'koala-message '+m.role+(m.failed?' failed':'')} key={m.id}>{m.content||(m.failed?'Não consegui concluir esta resposta.':<span className="koala-typing" aria-label="Koala está pensando"><i/><i/><i/></span>)}{m.navigation&&!m.failed&&<button className="koala-navigation" onClick={()=>go(m.navigation!,m.id)} disabled={busy}>{koalaActionLabel(m.navigation)}<ArrowRight size={15}/></button>}{m.moved&&<small className="koala-moved">Página aberta. Podemos continuar a conversa quando quiser.</small>}</div>)}
   {error&&<div className="koala-chat-error" role="alert"><p>{error}</p><button onClick={()=>send(lastQuestion.current,true)} disabled={busy}>Tentar novamente <RotateCcw size={13}/></button></div>}
   {config?.readiness?.koala===false&&<p className="koala-chat-error">O Koala está indisponível agora. Os atalhos e o guia de escolhas continuam disponíveis.</p>}
  </div>
  <div className="koala-shortcuts" aria-label="Atalhos do LoveKoala">{[['plans','Planos'],['examples','Exemplos'],['account','Meus presentes']].map(([destination,label])=><button key={destination} onClick={()=>go({destination,format:'album',plan:'',automatic:false})}>{label}<ArrowRight size={12}/></button>)}</div>
  <div className="koala-support-guide"><button onClick={()=>{onClose();onChoose();}}><BookOpen size={15}/> Me ajudar a escolher um presente <ArrowRight size={14}/></button></div>
  <form onSubmit={e=>{e.preventDefault();void send();}}><label className="sr-only" htmlFor="koala-question">Sua dúvida para o Koala</label><input id="koala-question" ref={field} value={input} onChange={e=>setInput(e.target.value)} maxLength={1000} disabled={busy||config?.readiness?.koala===false} placeholder="Me conta o que você precisa…" autoComplete="off"/>{busy?<button type="button" onClick={()=>abort.current?.abort('stop')} aria-label="Interromper resposta"><Square size={16}/></button>:<button type="submit" disabled={!input.trim()||config?.readiness?.koala===false} aria-label="Enviar pergunta"><Send size={17}/></button>}</form><footer>Assistente com IA · Confira os valores antes de pagar.</footer>
 </aside>;
}
