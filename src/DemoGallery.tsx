import {useMemo,useState} from 'react';
import {BookOpen,ChevronRight,Music2,Sparkles} from 'lucide-react';
import GiftViewer from './GiftViewer';
import {buildDemoGift} from './demo.mjs';
import {PLANS,money,accessLabel} from './domain.mjs';
import {planFeatures} from './features.mjs';
import {useSite} from './SiteContext';
type Props={initialFormat?:string;initialPlan?:string;onCreate:(plan:string,format:string)=>void};
export default function DemoGallery({initialFormat='retrospectiva',initialPlan='encanto',onCreate}:Props){
 const {config}=useSite();const [planId,setPlan]=useState(initialPlan),[format,setFormat]=useState(initialFormat==='album'?'album':'retrospectiva');
 const available=PLANS.filter(p=>!config?.plans||config.plans.some((x:any)=>x.id===p.id));const base=available.find(p=>p.id===planId)||available[0]||PLANS[1];const plan={...base,...config?.plans?.find((p:any)=>p.id===base.id)};
 const gift=useMemo(()=>buildDemoGift(plan.id,format,plan),[plan.id,format,plan.max_photos]);
 return <div className="demo-gallery demo-gallery-v2"><header className="demo-gallery-header"><div className="demo-gallery-heading"><span><Sparkles size={13}/> EXPLORE O PRESENTE</span><h2>A próxima história pode ser <em>a de vocês.</em></h2></div><div className="demo-compact-tools"><div className="demo-format-tabs" role="group" aria-label="Formato do exemplo"><button className={format==='album'?'selected':''} onClick={()=>setFormat('album')} aria-pressed={format==='album'}><BookOpen size={16}/> Álbum 3D</button><button className={format==='retrospectiva'?'selected':''} onClick={()=>setFormat('retrospectiva')} aria-pressed={format==='retrospectiva'}><Music2 size={16}/> Retrospectiva</button></div><label><span>PLANO</span><select aria-label="Plano do exemplo" value={plan.id} onChange={e=>setPlan(e.target.value)}>{available.map(p=><option key={p.id} value={p.id}>{config?.plans?.find((x:any)=>x.id===p.id)?.name||p.name}</option>)}</select></label></div></header><div className="demo-live-view" key={gift.id}><GiftViewer gift={gift} mode={format} demo compact={false}/></div><footer className="demo-gallery-footer"><div><strong>{plan.name}</strong><small>{money(plan.access_kind==='club'?plan.monthly_price_cents||plan.price_cents:plan.price_cents)}{plan.access_kind==='club'?'/mês':' · pagamento único'} · {accessLabel(plan)}</small><details className="demo-plan-details"><summary>O que vem neste exemplo</summary><p>Fotos e história fictícias, interações de verdade.</p><ul>{planFeatures(plan,format).map(f=><li key={f}>{f}</li>)}</ul></details></div><button onClick={()=>onCreate(plan.id,format)}>Criar o nosso <ChevronRight size={17}/></button></footer></div>;
}
