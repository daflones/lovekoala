const KEY='lovekoala_drafts_v1';
export function readDrafts():any[]{try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch{return [];}}
export function saveDraft(key:string,gift:any,remote:any,step:number){
 const drafts=readDrafts();const record={key,gift,remote,step,updated_at:new Date().toISOString()};const next=[record,...drafts.filter(d=>d.key!==key)].slice(0,12);
 try{localStorage.setItem(KEY,JSON.stringify(next));return true;}catch{return false;}
}
