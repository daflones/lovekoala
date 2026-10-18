import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,CalendarDays,Check,ChevronLeft,ChevronRight,Clock,Heart,Headphones,List,Mail,Pause,Play,RotateCcw,Ticket,X} from 'lucide-react';
import {dateChoices,keepsakeFacts,keepsakeStories} from './keepsake.mjs';
import {useRelationshipClock} from './LoveClock';
import {SoundtrackDock} from './MusicPlayer';
import {useReaderDialog} from './useReaderDialog';
import {PHOTO} from './domain.mjs';
import {AnimatedNumber} from './AnimatedCount';
export {AnimatedNumber} from './AnimatedCount';
import GameRoom from './GameRoom';
import MemoryLab from './MemoryLab';
import StoryPhotoReel from './StoryPhotoReel';
import {photoProgress,storyNeedsReading,toggleVisitItem} from './reader-navigation.mjs';
import {storyAstronomyFacts} from './story-astronomy.mjs';
import {MoonStory,SeasonStory} from './StorySky';
import {PlacesStory,AchievementsStory,LettersStory,CouponsStory,QuizStory,GamesStory,JourneyStory,ReasonsStory,DreamsStory} from './StoryExtras';
import {useCoupleStats} from './useCoupleStats';
import {CommunityStory,CityStory,HeartbeatStory,StoryNumberBoard,MilestoneStory,OriginStory,SoundtrackStory} from './StoryStatistics';
const number=(n:number)=>Math.max(0,n||0).toLocaleString('pt-BR');
const fullDate=(iso:string)=>new Date(iso+'T12:00:00Z').toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});

export function MemoryCalendar({facts}:{facts:any}){if(!facts)return null;return <div className="edition-calendar-paper"><div><span>{facts.monthName}</span><strong>{facts.year}</strong></div><div className="edition-calendar-grid" role="group" aria-label={'Calendário de '+facts.monthName+' de '+facts.year}>{['S','T','Q','Q','S','S','D'].map((label,i)=><span className="calendar-weekday" key={'w'+i} aria-hidden="true">{label}</span>)}{facts.monthCells.map((day:number|null,i:number)=><span key={i} className={day===facts.day?'our-day':''} aria-label={day===facts.day?'Dia '+day+', o começo da nossa história':day?'Dia '+day:undefined}>{day}{day===facts.day&&<Heart size={12} fill="currentColor"/>}</span>)}</div><span className="calendar-handnote">o dia em que tudo mudou.</span></div>;}

export default function RetrospectiveStories({gift,onClose,demo=false,cohort:preloadedCohort}:{gift:any;onClose:()=>void;demo?:boolean;cohort?:any}){
 const clock=useRelationshipClock(gift),cohort=useCoupleStats(gift,clock?.days,demo);
 // Snapshot the cohort at opening: late network responses never reorder an active story.
 const sky=useMemo(()=>storyAstronomyFacts(gift),[gift.start_date,gift.start_time,clock?.days]);
 const [storyCohort,setStoryCohort]=useState(preloadedCohort||cohort);const stories=useMemo(()=>keepsakeStories(gift,storyCohort,!!sky),[gift,storyCohort,!!sky]);
 const [game,setGame]=useState<string|null>(null),[indexOpen,setIndexOpen]=useState(false);
 const [songDuration,setSongDuration]=useState(0),[gallery,setGallery]=useState<number|null>(null),[photoPositions,setPhotoPositions]=useState<Record<string,number>>({}),[couponRevealed,setCouponRevealed]=useState<number[]>([]),[quizAnswers,setQuizAnswers]=useState<Record<number,number>>({}),[openLetters,setOpenLetters]=useState<number[]>([]);
 const facts=useMemo(()=>keepsakeFacts(gift),[gift.start_date,gift.start_time,clock?.days]);
 const [index,setIndex]=useState(0),[playing,setPlaying]=useState(()=>typeof matchMedia==='function'?!matchMedia('(prefers-reduced-motion: reduce)').matches:true),[progress,setProgress]=useState(0),[holding,setHolding]=useState(false),[hidden,setHidden]=useState(false),[music,setMusic]=useState(false),[musicPlaying,setMusicPlaying]=useState(true),[choice,setChoice]=useState<string|null>(null);
 const progressRef=useRef(0),touch=useRef<{x:number;y:number}|null>(null),card=useRef<HTMLElement>(null);
 const current=stories[Math.min(index,stories.length-1)],photoIndices=current.photoIndices||[],photoCursor=Math.min(photoPositions[current.id]||0,Math.max(0,photoIndices.length-1));
 useEffect(()=>{if(!storyCohort?.available&&(preloadedCohort||cohort)?.available&&index<=stories.findIndex(s=>s.kind==='badges'))setStoryCohort(preloadedCohort||cohort);},[cohort,preloadedCohort,storyCohort,index,stories]);
 const closeGame=useCallback(()=>setGame(null),[]),closeGallery=useCallback(()=>setGallery(null),[]);
 const close=useCallback(()=>{if(indexOpen)setIndexOpen(false);else onClose();},[onClose,indexOpen]);useReaderDialog(!game&&gallery===null,close);
 const select=useCallback((n:number)=>{setIndex(Math.max(0,Math.min(stories.length-1,n)));progressRef.current=0;setProgress(0);setChoice(null);setIndexOpen(false);card.current?.scrollTo({top:0});},[stories.length]);
 useEffect(()=>{const visibility=()=>{setHidden(document.hidden);setHolding(false);};document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[]);
 const changePhoto=useCallback((cursor:number)=>{setPhotoPositions(value=>({...value,[current.id]:cursor}));progressRef.current=0;setProgress(0);},[current.id]);
 const reading=!!game||gallery!==null||indexOpen||storyNeedsReading(current.kind,gift)||current.kind==='date-game'&&!choice;
 useEffect(()=>{if(!playing||holding||hidden||reading)return;const duration=current.kind==='photo'?8500:10500,start=performance.now()-progressRef.current/100*duration;
  const timer=setInterval(()=>{const next=Math.min(100,(performance.now()-start)/duration*100);progressRef.current=next;setProgress(next);if(next>=100){clearInterval(timer);if(current.kind==='photo'&&photoCursor<photoIndices.length-1)changePhoto(photoCursor+1);else if(index===stories.length-1)setPlaying(false);else select(index+1);}},80);
  return()=>clearInterval(timer);
 },[index,playing,holding,hidden,reading,current.kind,stories.length,select,photoCursor,photoIndices.length,changePhoto]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(game||gallery!==null||indexOpen||e.defaultPrevented)return;if(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select'))return;if(e.key==='ArrowRight'){e.preventDefault();if(current.kind==='photo'&&photoCursor<photoIndices.length-1)changePhoto(photoCursor+1);else select(index+1);}if(e.key==='ArrowLeft'){e.preventDefault();if(current.kind==='photo'&&photoCursor>0)changePhoto(photoCursor-1);else select(index-1);}if(e.code==='Space'&&!(e.target instanceof HTMLElement&&e.target.closest('button'))){e.preventDefault();setPlaying(v=>!v);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[index,select,game,gallery,indexOpen,current.kind,photoCursor,photoIndices.length,changePhoto]);
 function restart(){setPhotoPositions({});select(0);setPlaying(true);}
 function toggle(){if(index===stories.length-1&&progress>=100){restart();}else setPlaying(v=>!v);}
 const pair=`${gift.sender||'Você'} & ${gift.recipient||'seu amor'}`;
 return <><div inert={!!game||gallery!==null} aria-hidden={!!game||gallery!==null||undefined} className={'edition-backdrop theme-'+gift.theme}><section className={'koala-edition edition-'+current.kind+(playing?' edition-playing':' edition-paused')} data-reader-dialog role="dialog" aria-modal="true" aria-label="A edição da nossa história">
  <header className="edition-header"><div className="edition-segments" aria-label={'Capítulo '+(index+1)+' de '+stories.length}>{stories.map((story:any,i:number)=><button key={story.id} aria-label={'Ir para '+story.label} aria-current={i===index?'step':undefined} onClick={()=>select(i)}><i style={{width:i<index?'100%':i===index?(current.kind==='photo'?photoProgress(photoCursor,progress,photoIndices.length):progress)+'%':'0%'}}/></button>)}</div><div className="edition-header-row"><span><Heart size={13}/> LOVEKOALA <i>/</i> A NOSSA EDIÇÃO</span><div><button aria-label="Explorar todas as histórias" aria-expanded={indexOpen} onClick={()=>setIndexOpen(v=>!v)}><List size={17}/></button><button aria-label={playing?'Pausar histórias':'Reproduzir histórias'} onClick={toggle}>{playing?<Pause size={16}/>:<Play size={16}/>}</button><button aria-pressed={music} aria-label="Abrir música da retrospectiva" onClick={()=>{setMusic(v=>!v);setMusicPlaying(true);}}><Headphones size={17}/></button><button aria-label="Voltar à playlist" onClick={onClose}><X size={20}/></button></div></div></header>
  {indexOpen&&<nav className="edition-story-index" aria-label="Todas as histórias">{stories.map((story:any,i:number)=><button key={story.id} onClick={()=>select(i)} aria-current={i===index?'step':undefined}><span>{String(i+1).padStart(2,'0')}</span>{story.label}{i===index&&<Check size={15}/>}</button>)}</nav>}
  <main ref={card} key={current.id} className="edition-card" onPointerDown={e=>{if(!(e.target as HTMLElement).closest('button,input,a,[data-story-interactive]'))setHolding(true);}} onPointerUp={()=>setHolding(false)} onPointerCancel={()=>setHolding(false)} onPointerLeave={()=>setHolding(false)} onTouchStart={e=>{touch.current=null;if((e.target as HTMLElement).closest('button,input,a,details,select,[data-story-interactive]'))return;touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchCancel={()=>{touch.current=null;setHolding(false);}} onTouchEnd={e=>{if(!touch.current)return;const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y;touch.current=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5)select(index+(dx<0?1:-1));}}>
   {current.kind==='opening'&&<div className="edition-opening"><div className="edition-oversize-monogram" aria-hidden="true">{(gift.sender||'N').slice(0,1)}<i>{(gift.recipient||'S').slice(0,1)}</i></div><span className="edition-kicker">UMA EDIÇÃO LIMITADA. UM AMOR INTEIRO.</span><h1>A nossa<br/>história,<br/><em>no repeat.</em></h1><div className="edition-vinyl"><div className="edition-vinyl-disc"><img src={gift.photos?.[0]?.url||PHOTO} alt="O casal"/><i/></div><span className="edition-name-tape">{pair}</span><span className="edition-release">LADO A<br/><strong>NÓS</strong></span></div><p>Tem memórias que merecem<br/>ser vividas mais de uma vez.</p><button className="edition-pill" onClick={()=>select(index+1)}>Dar play na nossa história <ArrowRight size={16}/></button></div>}
   {current.kind==='minutes'&&clock&&<div className="edition-minutes"><span className="edition-kicker">DESDE {facts?.dateLabel}</span><h2>Olha o tanto<br/>de vida que<br/><em>já virou nós.</em></h2><div className="edition-giant-number"><AnimatedNumber value={clock.totalMinutes}/></div><span className="edition-vertical-tape">MINUTOS DE NÓS · MINUTOS DE NÓS</span><div className="edition-time-footer"><Clock size={20}/><p>E enquanto você lê,<br/>a nossa história continua.</p><strong>{number(clock.totalSeconds)}<small>segundos juntos</small></strong></div></div>}
   {current.kind==='photo'&&<StoryPhotoReel photos={gift.photos||[]} indices={photoIndices} cursor={photoCursor} pair={pair} onChange={changePhoto} onHold={setHolding} onGallery={index=>{setMusic(false);setMusicPlaying(false);setGallery(index);}}/>}
   {current.kind==='calendar'&&facts&&<div className="edition-calendar-story"><span className="edition-kicker">UM DIA COMUM. UM ENCONTRO INCOMUM.</span><h2>O calendário<br/>ganhou um<br/><em>dia favorito.</em></h2><MemoryCalendar facts={facts}/><p>Tudo começou numa <strong>{facts.weekday}.</strong></p><span className="edition-date-sticker"><CalendarDays size={17}/>{facts.dateLabel}</span></div>}
   {current.kind==='date-game'&&facts&&<div className="edition-date-game"><span className="edition-kicker">ANTES DO PRÓXIMO REPLAY…</span><h2>Você lembra<br/>quando a gente<br/><em>virou nós?</em></h2><div className="edition-date-tickets">{dateChoices(gift.start_date).map((iso:string,i:number)=><button key={iso} disabled={!!choice} className={choice?(iso===gift.start_date?'correct':iso===choice?'incorrect':'muted'):''} onClick={()=>setChoice(iso)}><span>{String(i+1).padStart(2,'0')}</span><strong>{fullDate(iso)}</strong>{choice&&iso===gift.start_date?<Check size={20}/>:<Ticket size={21}/>}</button>)}</div><p aria-live="polite">{choice?choice===gift.start_date?'Tem coisas que o coração não esquece.':'O nosso dia foi '+facts.dateLabel+'. Mais uma lembrança para guardar.':'Escolha um dos bilhetes. Sem pressa.'}</p>{choice&&<button className="edition-pill" onClick={()=>select(index+1)}>Continuar a história <ArrowRight size={16}/></button>}</div>}
   {current.kind==='numbers'&&<StoryNumberBoard clock={clock} facts={facts} sky={sky}/>}
   {current.kind==='heartbeats'&&<HeartbeatStory clock={clock}/>}
   {current.kind==='community'&&<CommunityStory cohort={storyCohort}/>}
   {current.kind==='city'&&<CityStory gift={gift} cohort={storyCohort}/>}
   {current.kind==='badges'&&<MilestoneStory facts={facts} pair={pair}/>}
   {current.kind==='origin'&&<OriginStory gift={gift}/>}
   {current.kind==='soundtrack'&&<SoundtrackStory gift={gift} clock={clock} duration={songDuration} onPlay={()=>{setMusic(true);setMusicPlaying(true);}}/>}
   {current.kind==='moon'&&<MoonStory sky={sky} facts={facts}/>}
   {current.kind==='season'&&<SeasonStory sky={sky}/>}
   {current.kind==='places'&&<PlacesStory gift={gift}/>}
   {current.kind==='achievements'&&<AchievementsStory gift={gift}/>}
   {current.kind==='letters'&&<LettersStory gift={gift} opened={openLetters} onToggle={(i,open)=>setOpenLetters(items=>toggleVisitItem(items,i,open))}/>}
   {current.kind==='coupons'&&<CouponsStory gift={gift} revealed={couponRevealed} onReveal={i=>setCouponRevealed(items=>toggleVisitItem(items,i))}/>}
   {current.kind==='quiz'&&<QuizStory gift={gift} answers={quizAnswers} onAnswer={(question,answer)=>setQuizAnswers(answers=>answers[question]===undefined?{...answers,[question]:answer}:answers)}/>}
   {current.kind==='games'&&<GamesStory gift={gift} onGame={id=>{setMusic(false);setGame(id);}}/>}
   {current.kind==='journey'&&<JourneyStory gift={gift}/>}
   {current.kind==='letter'&&<div className="edition-letter-story"><span className="edition-kicker">DE {gift.sender||'QUEM TE AMA'} PARA {gift.recipient||'VOCÊ'}</span><div className="edition-letter-paper"><Mail size={23}/><h2>Algumas palavras<br/><em>ficam.</em></h2><p>{gift.letter}</p><span>{gift.sender}</span></div><small>Uma pausa para ler no seu tempo.</small></div>}
   {current.kind==='reasons'&&<ReasonsStory gift={gift}/>}
   {current.kind==='dreams'&&<DreamsStory gift={gift}/>}
   {current.kind==='ending'&&<div className="edition-ending-story"><img className="edition-scene-bg" src="/assets/scenes/moon-garden.webp" alt=""/><span className="edition-kicker">A EDIÇÃO TERMINA. A GENTE CONTINUA.</span><h2>O meu<br/>próximo<br/>capítulo<br/><em>favorito?</em></h2><div className="edition-ending-names">{gift.recipient||'Você'}<Heart size={26}/></div><p>{gift.promise||'Que a gente continue encontrando um no outro o melhor lugar para ficar.'}</p><button className="edition-pill" onClick={restart}><RotateCcw size={15}/> Viver tudo outra vez</button></div>}
  </main>
  <footer className="edition-navigation"><button onClick={()=>select(index-1)} disabled={!index} aria-label="História anterior"><ChevronLeft size={22}/></button><div><span>{current.label}</span><small>{reading?'NO SEU TEMPO':!playing?'PAUSADO':holding?'SEGURE PARA LER':'DESLIZE PARA EXPLORAR'} · {index+1} / {stories.length}</small></div><button onClick={()=>index===stories.length-1?onClose():select(index+1)} aria-label={index===stories.length-1?'Voltar à playlist':'Próxima história'}>{index===stories.length-1?<Check size={21}/>:<ChevronRight size={22}/>}</button></footer>
  {music&&<SoundtrackDock gift={gift} requestedPlaying={musicPlaying} onPlaybackChange={setMusicPlaying} onDurationChange={setSongDuration} onClose={()=>{setMusic(false);setMusicPlaying(false);}}/>}
 </section></div>{gallery!==null&&<MemoryLab gift={gift} mode="photos" initialPhoto={gallery} onClose={closeGallery}/>} {game&&<GameRoom gift={gift} initialGame={game} onClose={closeGame}/>}</>;
}
