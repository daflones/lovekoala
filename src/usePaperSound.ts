import {useCallback,useEffect,useRef,useState} from 'react';
export function usePaperSound(){
 const [enabled,setEnabled]=useState(true);const enabledRef=useRef(true),context=useRef<AudioContext|null>(null),buffer=useRef<AudioBuffer|null>(null),last=useRef(0);enabledRef.current=enabled;
 useEffect(()=>{const controller=new AbortController();let active=true;try{const Ctor=window.AudioContext||(window as any).webkitAudioContext;if(!Ctor)return;const ctx=new Ctor();context.current=ctx;fetch('/assets/page-turn.wav?v=recorded-1',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.arrayBuffer();}).then(bytes=>ctx.decodeAudioData(bytes)).then(decoded=>{if(active)buffer.current=decoded;}).catch(()=>{});}catch{}return()=>{active=false;controller.abort();context.current?.close().catch(()=>{});context.current=null;};},[]);
 const unlock=useCallback(()=>{if(enabledRef.current&&context.current?.state==='suspended')context.current.resume().catch(()=>{});},[]);
 const turn=useCallback(()=>{const ctx=context.current;if(!enabledRef.current||!ctx||!buffer.current||performance.now()-last.current<180)return;last.current=performance.now();try{const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer.current;source.playbackRate.value=.96+Math.random()*.08;gain.gain.value=.46;source.connect(gain);gain.connect(ctx.destination);source.start(ctx.currentTime+.06);source.onended=()=>{source.disconnect();gain.disconnect();};}catch{}},[]);
 return {enabled,setEnabled,unlock,turn};
}
