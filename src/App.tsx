import KoalaSupport from './KoalaSupport';
import type {KoalaNavigation} from './KoalaSupport';
import {koalaAction,koalaActionHref} from './koala-navigation.mjs';
const DemoGallery=lazy(()=>import('./DemoGallery'));
import CoalaGuide from './CoalaGuide';
import {useSite,SiteImage} from './SiteContext';
import {acceptAuthRedirect} from './auth';
import {track} from './tracking';
const Admin=lazy(()=>import('./Admin'));
const Account=lazy(()=>import('./Account'));
import LandingV2 from './LandingV2';
import {lazy,Suspense,useEffect,useState} from 'react';
import {ArrowRight,Heart,X} from 'lucide-react';
import {demoGift,KOALA,inferConversation} from './domain.mjs';
import {api} from './api';
const Creator=lazy(()=>import('./Creator'));
const GiftViewer=lazy(()=>import('./GiftViewer'));
import {readDrafts} from './storage';

export function navigate(path:string){
 if(!path.startsWith('/')||path.startsWith('//'))return false;
 if(!window.dispatchEvent(new CustomEvent('lovekoala-before-navigate',{detail:{path},cancelable:true})))return false;
 history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));window.scrollTo({top:0,behavior:'instant'});
 const section=new URL(path,location.origin).hash.slice(1);
 if(['planos','como-funciona','duvidas'].includes(section)){let remaining=90;const reveal=()=>{const el=document.getElementById(section);if(el){el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});el.setAttribute('tabindex','-1');el.focus({preventScroll:true});}else if(remaining-->0)requestAnimationFrame(reveal);};requestAnimationFrame(reveal);}
 return true;
}
export function Brand({light=false}:{light?:boolean}){return <a className={'brand '+(light?'light':'')} href="/" onClick={e=>{e.preventDefault();navigate('/');}} aria-label="LoveKoala — início"><SiteImage imageKey="logo" fallback="/favicon.svg" alt=""/><span>love<span className="brand-koala">koala</span><i>♡</i></span></a>;}
export function Button({children,onClick,secondary=false,className='',...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{secondary?:boolean}){return <button className={`${secondary?'button-secondary':'button-primary'} ${className}`} onClick={onClick} {...props}>{children}</button>;}
export function Modal({children,onClose,className=''}:{children:React.ReactNode;onClose:()=>void;className?:string}){
 useEffect(()=>{const old=document.activeElement as HTMLElement;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const modal=document.querySelector('[role="dialog"]');const els=modal?.querySelectorAll<HTMLElement>('button,a[href],input,textarea,select,[tabindex="0"]');if(!els?.length)return;const first=els[0],last=els[els.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};window.addEventListener('keydown',key);requestAnimationFrame(()=>document.querySelector<HTMLElement>('[role="dialog"] button')?.focus());return ()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',key);old?.focus();};},[onClose]);
 return <div className={'modal-backdrop '+className} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-label="LoveKoala"><button className="icon-button modal-close" onClick={onClose} aria-label="Fechar"><X size={20}/></button>{children}</section></div>;
}
export default function App(){
 const {config}=useSite();const [url,setUrl]=useState(location.pathname+location.search+location.hash);const path=url.split(/[?#]/)[0];
 const [demo,setDemo]=useState<{format:string;plan:string}|null>(null),[chat,setChat]=useState(false),[supportOpen,setSupportOpen]=useState(false),[legal,setLegal]=useState<string|null>(null);
 useEffect(()=>{const fn=()=>setUrl(location.pathname+location.search+location.hash);window.addEventListener('popstate',fn);if(acceptAuthRedirect())fn();return()=>window.removeEventListener('popstate',fn);},[]);
 useEffect(()=>{track('page_view');},[url]);
 const start=(format='album')=>{track('cta_create',{format});navigate('/criar?formato='+format);};
 const openDemo=(format:string,plan='encanto')=>{track('cta_preview',{format,plan_id:plan});setDemo({format,plan});};
 function follow(value:KoalaNavigation){const action=koalaAction(value),target=koalaActionHref(value);if(!action||!target)return false;
  if(action.destination==='checkout'&&path==='/criar'){return window.dispatchEvent(new Event('lovekoala-review',{cancelable:true}));}
  if(action.destination==='create'&&path==='/criar'){window.scrollTo({top:0,behavior:'smooth'});return true;}
  const moved=navigate(target);if(moved){setDemo(null);if(action.destination==='create'||action.destination==='checkout')track('cta_create',{format:action.format,plan_id:action.plan});if(action.destination==='examples')track('cta_preview',{format:action.format,plan_id:action.plan});}return moved;
 }
 const params=new URLSearchParams(location.search),example=koalaAction({destination:'examples',format:params.get('formato'),plan:params.get('plano')})!;
 const supportAllowed=path!=='/admin'&&(!path.startsWith('/presente/')||path==='/presente/exemplo');
 let content;
 if(path==='/admin')content=<Admin/>;
 else if(path==='/conta')content=<Account/>;
 else if(path==='/presente/exemplo')content=<DemoGallery key={url} initialFormat={example.format} initialPlan={example.plan||'encanto'} onCreate={(plan,format)=>navigate('/criar?formato='+format+'&plano='+plan)}/>;
 else if(path.startsWith('/presente/'))content=<PublicGift slug={path.split('/')[2]||''} onDemo={openDemo}/>;
 else if(path==='/criar')content=<Creator config={config} onDemo={openDemo}/>;
 else if(path==='/meus-presentes')content=<MyGifts onStart={()=>start()} onDemo={openDemo}/>;
 else content=<LandingV2 onStart={start} onDemo={openDemo} onChat={()=>{track('coala_open');setSupportOpen(true);}} onLegal={setLegal} plans={config?.plans}/>;
 return <>
  <Suspense fallback={<div className="loading-page"><img src={KOALA} alt=""/><span>O Coala está preparando tudo…</span></div>}>{content}</Suspense>
  {demo&&<Modal className="viewer-modal demo-gallery-modal" onClose={()=>setDemo(null)}><Suspense fallback={<div className="loading-page">Preparando os exemplos…</div>}><DemoGallery initialFormat={demo.format} initialPlan={demo.plan} onCreate={(plan,format)=>{setDemo(null);track('cta_create',{format,plan_id:plan});navigate('/criar?formato='+format+'&plano='+plan);}}/></Suspense></Modal>}
  {supportAllowed&&<KoalaSupport open={supportOpen} onOpen={()=>{track('coala_open');setSupportOpen(true);}} onClose={()=>setSupportOpen(false)} onChoose={()=>setChat(true)} onNavigate={follow} page={path==='/criar'?'create':path==='/conta'||path==='/meus-presentes'?'account':path==='/presente/exemplo'?'examples':'home'}/>}
  {chat&&<CoalaGuide onClose={()=>setChat(false)} onStart={selection=>{setChat(false);track('cta_create',{format:selection.format});navigate('/criar?formato='+selection.format+'&plano='+selection.plan_id+'&ocasiao='+encodeURIComponent(selection.occasion||''));}}/>}
  {legal&&<Modal onClose={()=>setLegal(null)}><div className="legal-copy"><span className="eyebrow">COMBINADOS COM CARINHO</span><h2>{legal==='privacidade'?'Sua história merece cuidado.':'Sobre o seu presente.'}</h2>{legal==='privacidade'?<><p>As fotos e os textos do rascunho ficam vinculados a uma chave privada de edição. Os arquivos são armazenados em um espaço privado, com acesso temporário para a prévia.</p><p>Ao publicar, você autoriza que qualquer pessoa com o endereço do presente veja o conteúdo. Escolha fotos que você e a outra pessoa tenham o direito de compartilhar. Guarde sua chave de edição com cuidado.</p><p>O presente é organizado com as informações fornecidas e modelos prontos. O suporte Koala usa IA e envia à NVIDIA as mensagens que você escreve na conversa e o tipo de página aberta. Ele não recebe automaticamente suas fotos, cartas, dados de pagamento ou conteúdo privado dos presentes. O Koala pode abrir páginas do LoveKoala quando você pedir; pagamentos e publicação são realizados por você nas telas correspondentes.</p><p>Você pode remover as fotos pelo seu editor. O prazo do link acompanha o plano contratado.</p></>:<><p>LoveKoala cria presentes digitais para abrir no navegador. Os preços, limites de fotos e prazo de acesso são exibidos antes do pagamento.</p><p>A publicação depende da confirmação do pagamento. O álbum, a retrospectiva e seus capítulos usam modelos e animações prontos, personalizados com as informações fornecidas.</p><p>O QR Code leva ao endereço do presente e pode ser salvo para impressão. Não enviamos produtos físicos. Músicas de plataformas externas dependem da disponibilidade e das regras dessas plataformas.</p><p>Os direitos previstos na legislação brasileira para compras online são preservados. A identificação do responsável e o canal de atendimento comercial serão definidos antes do lançamento público.</p></>}</div></Modal>}
 </>;
}
function MyGifts({onStart,onDemo}:{onStart:()=>void;onDemo:(s:string)=>void}){const [drafts]=useState(readDrafts);return <div className="dashboard-page"><header className="editor-header"><Brand/><div><Button secondary onClick={()=>navigate('/conta')}>Minha conta</Button><Button onClick={onStart}>Novo presente <Heart size={15}/></Button></div></header><main className="wrap section"><span className="eyebrow">UM CANTINHO PARA AS SUAS HISTÓRIAS</span><h1>Meus <em>presentes.</em></h1><p className="muted">Rascunhos e presentes salvos neste dispositivo. A chave privada permite continuar depois.</p>{!drafts.length?<div className="empty-state"><img src={KOALA} alt="Seu Coala"/><h3>A primeira história ainda está por vir.</h3><p>Escolha as memórias. Eu te ajudo com o resto.</p><Button onClick={onStart}>Criar nosso presente <ArrowRight size={16}/></Button><button className="inline-link" onClick={()=>onDemo('album')}>Ver um exemplo primeiro</button></div>:<div className="draft-grid">{drafts.map((d:any)=><article className="draft-card" key={d.key}><div className={'draft-cover theme-'+d.gift.theme}><Heart size={26}/><h3>{d.gift.sender||'Você'} & {d.gift.recipient||'seu amor'}</h3><span>{d.remote?.status==='published'?'Publicado':'Em criação'}</span></div><div><small>{d.gift.format==='retrospectiva'?'Retrospectiva':'Álbum interativo'}</small><h3>{d.gift.occasion||'Um presente especial'}</h3><Button secondary onClick={()=>navigate('/criar?rascunho='+d.key)}>Continuar <ArrowRight size={16}/></Button></div></article>)}</div>}</main></div>;}
function PublicGift({slug,onDemo}:{slug:string;onDemo:(s:string)=>void}){const [data,setData]=useState<any>(null),[error,setError]=useState('');useEffect(()=>{if(slug==='exemplo'){setData(demoGift);return;}setData(null);setError('');api('gift',{slug}).then(r=>{setData(r.gift);track('gift_opened',{format:r.gift.format});}).catch(e=>setError(e.message));},[slug]);if(error)return <div className="gift-error"><img src={KOALA} alt="Coala"/><h1>Esse presente ainda está guardadinho.</h1><p>{error}</p><Button onClick={()=>navigate('/')}>Conhecer o LoveKoala <ArrowRight size={16}/></Button><button className="inline-link" onClick={()=>onDemo('album')}>Explorar um exemplo</button></div>;if(!data)return <div className="loading-page"><img src={KOALA} alt=""/><span>Preparando um lugar bonito para essas memórias…</span></div>;return <GiftViewer gift={data} mode={data.format==='retrospectiva'?'retrospectiva':'album'} demo={slug==='exemplo'} onCreate={()=>navigate('/criar')}/>;}
