import {useEffect,useState} from 'react';
import {Heart} from 'lucide-react';
import {relationshipClock} from './features.mjs';
export const CLOCK_UNITS=[['days','dias'],['hoursPart','horas'],['minutesPart','minutos'],['secondsPart','segundos']] as const;
export function clockValue(clock:any,unit:string){return unit==='days'||unit.startsWith('total')?Number(clock[unit]).toLocaleString('pt-BR'):String(clock[unit]).padStart(2,'0');}
export function useRelationshipClock(gift:any){const [now,setNow]=useState(()=>new Date());useEffect(()=>{let interval:ReturnType<typeof setInterval>;const tick=()=>setNow(new Date());tick();const first=setTimeout(()=>{tick();interval=setInterval(tick,1000);},1000-Date.now()%1000);return()=>{clearTimeout(first);clearInterval(interval);};},[]);return relationshipClock(gift.start_date,gift.start_time,now);}
// Also rendered to static album pages; data attributes let the book tick without
// reinitializing PageFlip, losing its current page or interrupting a drag.
export function StaticLoveClock({gift}:{gift:any}){const clock=relationshipClock(gift.start_date,gift.start_time);if(!clock)return null;return <div className="love-live-clock" aria-label="Tempo juntos"><div className="live-clock-label"><Heart size={11}/><span>A NOSSA HISTÓRIA CONTINUA</span><i/></div><div className="live-clock-digits">{CLOCK_UNITS.map(([unit,label])=><div key={unit}><strong data-clock-unit={unit}>{clockValue(clock,unit)}</strong><span>{label}</span></div>)}</div></div>;}
export function ClockFace({clock}:{clock:any}){if(!clock)return null;return <div className="love-live-clock" aria-label="Tempo juntos"><div className="live-clock-label"><Heart size={11}/><span>A NOSSA HISTÓRIA CONTINUA</span><i/></div><div className="live-clock-digits">{CLOCK_UNITS.map(([unit,label])=><div key={unit}><strong><b key={clock[unit]}>{clockValue(clock,unit)}</b></strong><span>{label}</span></div>)}</div></div>;}

export default function LoveClock({gift}:{gift:any}){return <ClockFace clock={useRelationshipClock(gift)}/>;}
