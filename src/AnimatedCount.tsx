import {useEffect,useRef,useState} from 'react';
export function AnimatedNumber({value}:{value:number}){
 const [shown,setShown]=useState(value),previous=useRef(0);
 useEffect(()=>{
  const target=Math.max(0,value||0);if(typeof matchMedia!=='function'||matchMedia('(prefers-reduced-motion: reduce)').matches){previous.current=target;setShown(target);return;}
  let frame=0;const from=previous.current,start=performance.now(),duration=Math.abs(target-from)>10?1000:380;
  const tick=(time:number)=>{const p=Math.min(1,(time-start)/duration),next=Math.floor(from+(target-from)*(1-Math.pow(1-p,3)));previous.current=next;setShown(next);if(p<1)frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[value]);
 return <>{Math.max(0,shown||0).toLocaleString('pt-BR')}</>;
}
