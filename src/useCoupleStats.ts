import {useEffect,useState} from 'react';
import {api} from './api';
import {DEMO_COHORT} from './retrospective-facts.mjs';
const cache=new Map<string,{expires:number;value:Promise<any>}>();
export function useCoupleStats(gift:any,days:number|undefined,demo=false){
 const city=gift.relationship_city||'',state=gift.relationship_state||'';
 const [result,setResult]=useState<{key:string;data:any}|null>(null),key=JSON.stringify([days,city,state]);
 useEffect(()=>{
  if(demo||days===undefined)return;let active=true;
  let entry=cache.get(key);if(!entry||entry.expires<Date.now()){
   if(cache.size>80)cache.clear();const value=api('couple_stats',{days,city,state}).catch(()=>null);
   entry={expires:Date.now()+180000,value};cache.set(key,entry);
  }
  entry.value.then(data=>{if(active)setResult({key,data});});return()=>{active=false;};
 },[key,days,city,state,demo]);
 return demo?DEMO_COHORT:result?.key===key?result.data:null;
}
