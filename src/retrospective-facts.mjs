// Creative equivalences, never biometric measurements or listening history.
export const HEARTBEATS_PER_MINUTE=72;
export const BRAZIL_STATES=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export const heartbeatEstimate=seconds=>Number.isFinite(Number(seconds))?Math.floor(Math.max(0,Number(seconds))/60*HEARTBEATS_PER_MINUTE*2):0;
export function songReplays(seconds,duration){return Number.isFinite(duration)&&duration>0&&Number.isFinite(seconds)&&seconds>=0?Math.floor(seconds/duration):null;}
export function fullWeekends(start,time='',now=new Date()){
 const begin=Date.parse(`${start}T${time||'00:00'}:00-03:00`),end=now.getTime();if(!Number.isFinite(begin)||!Number.isFinite(end)||begin>end||new Date(start+'T12:00:00Z').toISOString().slice(0,10)!==start)return 0;
 const day=new Date(start+'T12:00:00Z').getUTCDay(),midnight=Date.parse(start+'T00:00:00-03:00');
 let first=midnight+(6-day+7)%7*86400000;if(first<begin)first+=7*86400000;
 return Math.max(0,Math.floor((end-first-2*86400000)/(7*86400000))+1);
}
export function milestoneDate(start,days){const date=new Date(start+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
export function cohortUsable(cohort){return cohort?.available===true&&Number.isInteger(cohort.participants)&&cohort.participants>=20&&Number.isFinite(cohort.percentile)&&cohort.percentile>=0&&cohort.percentile<=100;}
export function cityCohortUsable(cohort){return cohortUsable(cohort)&&cohort.city?.available===true&&Number.isInteger(cohort.city.participants)&&cohort.city.participants>=20&&cohort.city.participants<=cohort.participants&&Number.isInteger(cohort.city.rank)&&cohort.city.rank>=1&&cohort.city.rank<=cohort.city.participants+1&&Number.isFinite(cohort.city.percentile)&&cohort.city.percentile>=0&&cohort.city.percentile<=100;}
// Used exclusively by the explicitly marked example viewer, never by a saved gift.
export const DEMO_COHORT=Object.freeze({available:true,participants:200,percentile:80,top_percent:20,illustrative:true,city:{available:true,participants:40,rank:4,percentile:90}});
