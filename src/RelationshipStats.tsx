import {CalendarDays,Clock,Heart,Sparkles} from 'lucide-react';
import {ClockFace,useRelationshipClock} from './LoveClock';
import {useCoupleStats} from './useCoupleStats';
import {CommunityStory,CityStory,HeartbeatStory} from './StoryStatistics';
export default function RelationshipStats({gift,demo=false}:{gift:any;demo?:boolean}){
 const stats=useRelationshipClock(gift),cohort=useCoupleStats(gift,stats?.days,demo);
 if(!stats)return null;const n=(v:number)=>v.toLocaleString('pt-BR');
 return <section className="relationship-stats"><span className="memory-kicker">O NOSSO AMOR EM NÚMEROS</span><h2>Olha tudo o que<br/><i>a gente já é.</i></h2><ClockFace clock={stats}/><div className="relationship-number-grid">{[{Icon:CalendarDays,value:stats.months,label:'meses completos'},{Icon:Sparkles,value:stats.weeks,label:'semanas de história'},{Icon:Clock,value:stats.totalHours,label:'horas juntos'},{Icon:Heart,value:stats.totalMinutes,label:'minutos de nós'}].map(s=><div key={s.label}><s.Icon size={19}/><strong><b key={s.value}>{n(s.value)}</b></strong><span>{s.label}</span></div>)}</div><div className="relationship-seconds"><span>Já são</span><strong key={stats.totalSeconds}>{n(stats.totalSeconds)}</strong><span>segundos dividindo a vida.</span></div><div className="relationship-next"><span>O PRÓXIMO CAPÍTULO</span><strong>{stats.nextAnniversary} dias para mais um aniversário.</strong></div><div className="relationship-story-facts"><HeartbeatStory clock={stats}/><CommunityStory cohort={cohort}/><CityStory cohort={cohort} gift={gift}/></div></section>;
}
