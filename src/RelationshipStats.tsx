import {useEffect,useState} from 'react';
import {CalendarDays,Clock,Heart,Sparkles,Users} from 'lucide-react';
import {ClockFace,useRelationshipClock} from './LoveClock';
import {api} from './api';
export default function RelationshipStats({gift}:{gift:any}){
 const stats=useRelationshipClock(gift),[cohort,setCohort]=useState<any>(null);
 useEffect(()=>{let active=true;setCohort(null);if(stats)api('couple_stats',{days:stats.days}).then(r=>{if(active)setCohort(r);}).catch(()=>{});return()=>{active=false;};},[gift.start_date,stats?.days]);
 if(!stats)return null;const n=(v:number)=>v.toLocaleString('pt-BR');
 return <section className="relationship-stats"><span className="memory-kicker">O NOSSO AMOR EM NÚMEROS</span><h2>Olha tudo o que<br/><i>a gente já é.</i></h2><ClockFace clock={stats}/><div className="relationship-number-grid">{[{Icon:CalendarDays,value:stats.months,label:'meses completos'},{Icon:Sparkles,value:stats.weeks,label:'semanas de história'},{Icon:Clock,value:stats.totalHours,label:'horas juntos'},{Icon:Heart,value:stats.totalMinutes,label:'minutos de nós'}].map(s=><div key={s.label}><s.Icon size={19}/><strong><b key={s.value}>{n(s.value)}</b></strong><span>{s.label}</span></div>)}</div><div className="relationship-seconds"><span>Já são</span><strong key={stats.totalSeconds}>{n(stats.totalSeconds)}</strong><span>segundos dividindo a vida.</span></div><div className="relationship-next"><span>O PRÓXIMO CAPÍTULO</span><strong>{stats.nextAnniversary} dias para mais um aniversário.</strong></div>{cohort?.available&&<div className="relationship-community"><Users size={24}/><div><strong>Um amor entre tantas histórias.</strong><p>Vocês têm mais tempo juntos que aproximadamente <b>{cohort.percentile}%</b> das histórias publicadas no LoveKoala. Comparação anônima da nossa comunidade.</p></div></div>}</section>;
}
