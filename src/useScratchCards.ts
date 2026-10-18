import {useEffect} from 'react';
import {bindScratchCard} from './scratch-card.mjs';
export function useScratchCards(host:React.RefObject<HTMLElement|null>,revision:any){useEffect(()=>{const clean=Array.from(host.current?.querySelectorAll<HTMLCanvasElement>('canvas[data-scratch-canvas]')||[]).map(bindScratchCard);return()=>clean.forEach(fn=>fn());},[revision]);}
