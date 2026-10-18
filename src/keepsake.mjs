import {relationshipClock} from './features.mjs';
import {photoStoryGroups} from './reader-navigation.mjs';
import {chapterList} from './experience.mjs';
import {fullWeekends,milestoneDate,cohortUsable,cityCohortUsable} from './retrospective-facts.mjs';

export function keepsakeFacts(gift,now=new Date()){
 const clock=relationshipClock(gift.start_date,gift.start_time,now);
 if(!clock)return null;
 const [year,month,day]=gift.start_date.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day,12));
 const first=new Date(Date.UTC(year,month-1,1,12)),offset=(first.getUTCDay()+6)%7;
 const count=new Date(Date.UTC(year,month,0,12)).getUTCDate();
 const badges=[7,30,100,365,500,1000,2000,3000,5000,10000,20000,36525].map(days=>({days,date:milestoneDate(gift.start_date,days),unlocked:clock.days>=days}));
 const nextBadge=badges.find(b=>!b.unlocked),previous=badges.filter(b=>b.unlocked).at(-1)?.days||0;
 return {...clock,year,month,day,weekday:date.toLocaleDateString('pt-BR',{weekday:'long',timeZone:'UTC'}),
  monthName:date.toLocaleDateString('pt-BR',{month:'long',timeZone:'UTC'}),
  dateLabel:date.toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}),
  weekends:fullWeekends(gift.start_date,gift.start_time,now),nextBadge:nextBadge?{...nextBadge,remaining:nextBadge.days-clock.days,progress:Math.min(100,(clock.totalSeconds/86400-previous)/(nextBadge.days-previous)*100)}:null,
  monthCells:[...Array(offset).fill(null),...Array.from({length:count},(_,i)=>i+1)],badges,
  unlocked:badges.filter(b=>b.unlocked).length};
}

export function dateChoices(start){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start||''))return [];
 const instant=Date.parse(start+'T12:00:00Z');if(!Number.isFinite(instant)||new Date(instant).toISOString().slice(0,10)!==start)return [];
 return [-7,0,1].map(offset=>new Date(instant+offset*86400000).toISOString().slice(0,10));
}

/** @returns {Array<{id:string,kind:string,label:string,photo?:number,photoIndices?:number[]}>} */
export function keepsakeStories(gift,cohort=null,skyAvailable=false){
 const allowed=new Set(chapterList(gift).map(c=>c.id)),photos=gift.photos||[];
 const groups=photoStoryGroups(photos.length);const dated=!!keepsakeFacts(gift),items=[{id:'opening',kind:'opening',label:'Nossa edição'}];
 if(dated)items.push({id:'minutes',kind:'minutes',label:'Cada minuto conta'});
 if(allowed.has('start')&&(gift.place||gift.relationship_city||gift.story))items.push({id:'origin',kind:'origin',label:'O lugar do nosso começo'});
 if(photos.length)items.push({id:'photo-0',kind:'photo',label:'Uma memória favorita',photo:groups[0][0],photoIndices:groups[0]});
 if(dated){items.push({id:'calendar',kind:'calendar',label:'O nosso primeiro dia'});if(!gift.section_selection?.length||gift.section_selection.includes('quiz'))items.push({id:'date-game',kind:'date-game',label:'Você lembra?'});if(allowed.has('stats'))items.push({id:'numbers',kind:'numbers',label:'Muito além dos dias'},{id:'heartbeats',kind:'heartbeats',label:'Dois corações no mesmo ritmo'},{id:'badges',kind:'badges',label:'Nossos pequenos marcos'});}
 if(dated&&allowed.has('stats')&&cohortUsable(cohort)){items.push({id:'community',kind:'community',label:'A nossa história na comunidade'});if(cityCohortUsable(cohort))items.push({id:'city',kind:'city',label:'Um amor na nossa cidade'});}
 if(gift.music_title||gift.music_url||gift.music_track)items.push({id:'soundtrack',kind:'soundtrack',label:'A música que virou nós'});
 if(skyAvailable&&dated){items.push({id:'moon',kind:'moon',label:'A lua do nosso começo'},{id:'season',kind:'season',label:'A estação em que tudo começou'});}
 if(groups.length>1)items.push({id:'photo-1',kind:'photo',label:'Mais um replay',photo:groups[1][0],photoIndices:groups[1]});
 if(allowed.has('timeline')&&gift.milestones?.some(m=>m.title?.trim()))items.push({id:'journey',kind:'journey',label:'A nossa linha do tempo'});
 if(allowed.has('places')&&gift.places?.some(p=>p.name?.trim()))items.push({id:'places',kind:'places',label:'Lugares que viraram nós'});
 if(allowed.has('achievements')&&gift.achievements?.some(Boolean))items.push({id:'achievements',kind:'achievements',label:'O que o nosso time conquistou'});
 if(allowed.has('letter')&&gift.letter?.trim())items.push({id:'letter',kind:'letter',label:'Palavras para guardar'});
 if(allowed.has('reasons')&&gift.reasons?.some(Boolean))items.push({id:'reasons',kind:'reasons',label:'Eu te escolheria de novo'});
 if(allowed.has('dreams')&&gift.dreams?.some(Boolean))items.push({id:'dreams',kind:'dreams',label:'O que ainda vem'});
 if(allowed.has('letters')&&gift.open_when?.some(c=>c.title&&c.text))items.push({id:'letters',kind:'letters',label:'Abra quando precisar de mim'});
 if(allowed.has('coupons')&&gift.coupons?.some(Boolean))items.push({id:'coupons',kind:'coupons',label:'Vales para o nosso próximo encontro'});
 if(allowed.has('quiz')&&gift.quiz?.some(q=>q.question))items.push({id:'quiz',kind:'quiz',label:'Quanto você sabe sobre nós?'});
 if(allowed.has('games')&&gift.selected_games?.length&&(dated||photos.length||gift.sender||gift.recipient))items.push({id:'games',kind:'games',label:'Uma pausa para o nosso play'});
 if(groups.length>2)items.push({id:'photo-2',kind:'photo',label:'Essa também é nossa',photo:groups[2][0],photoIndices:groups[2]});
 items.push({id:'ending',kind:'ending',label:'O melhor ainda vem'});return items;
}

export function puzzleTiles(random=Math.random){
 const tiles=Array.from({length:9},(_,i)=>i);
 for(let i=8;i>0;i--){const j=Math.floor(random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]];}
 if(tiles.every((n,i)=>n===i))tiles.push(tiles.shift());return tiles;
}
export function swapTiles(tiles,a,b){
 if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=tiles.length||b>=tiles.length)return tiles;
 const next=[...tiles];[next[a],next[b]]=[next[b],next[a]];return next;
}
export const puzzleSolved=tiles=>tiles.length===9&&tiles.every((n,i)=>n===i);

export async function photoStripBlob(photos,gift){
 if(!photos?.length)throw Error('Adicione uma foto para criar a tirinha.');
 const images=await Promise.all(Array.from({length:3},(_,i)=>new Promise((resolve,reject)=>{
  const img=new Image();const timer=setTimeout(()=>{img.src='';reject(Error('Uma foto demorou para abrir. Tente novamente.'));},15000);
  img.crossOrigin='anonymous';img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);reject(Error('Não foi possível preparar uma das fotos para baixar.'));};img.src=photos[i%photos.length].url;
 })));
 const canvas=document.createElement('canvas');canvas.width=900;canvas.height=2200;const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('Seu navegador não conseguiu preparar a tirinha.');
 ctx.fillStyle='#f9f0e2';ctx.fillRect(0,0,900,2200);ctx.strokeStyle='#9b7aab';ctx.lineWidth=2;ctx.strokeRect(35,35,830,2130);
 ctx.fillStyle='#725780';ctx.textAlign='center';ctx.font='18px sans-serif';ctx.fillText('LOVEKOALA  /  UMA TIRINHA DE NÓS',450,100);
 ctx.font='italic 46px Georgia';ctx.fillText(`${gift.sender||'Você'} & ${gift.recipient||'seu amor'}`,450,175,740);
 images.forEach((img,i)=>{const x=70,y=220+i*555,w=760,h=505;const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight),sw=w/scale,sh=h/scale;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,x,y,w,h);ctx.restore();
  ctx.fillStyle='#9b7aab';ctx.font='15px sans-serif';ctx.fillText(String(i+1).padStart(2,'0')+'  /  PEQUENOS INFINITOS',450,y+h+29);
 });
 ctx.fillStyle='#725780';ctx.font='italic 31px Georgia';ctx.fillText('O meu lugar favorito é com você.',450,1998,760);
 ctx.font='16px sans-serif';ctx.fillText(gift.start_date?'DESDE '+gift.start_date.split('-').reverse().join('/'):'FEITO DE NÓS. FEITO COM AMOR.',450,2050);
 return new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Não foi possível criar o arquivo.')),'image/png');}catch{reject(Error('Esta foto não permite exportação pelo navegador. Você pode escolher outra foto.'));}});
}
