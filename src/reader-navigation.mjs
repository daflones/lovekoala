// Keep every uploaded photo in order while preserving three photo chapters.
export function photoStoryGroups(count){
 if(!Number.isInteger(count)||count<1)return [];
 const groups=Math.min(3,count),base=Math.floor(count/groups),remainder=count%groups;let next=0;
 return Array.from({length:groups},(_,group)=>Array.from({length:base+(group<remainder?1:0)},()=>next++));
}
export function photoProgress(cursor,progress,count){return count>0?Math.min(100,Math.max(0,(cursor+Math.min(100,Math.max(0,progress))/100)/count*100)):0;}
export function storyNeedsReading(kind,gift){
 if(['letter','letters','coupons','quiz','games','places','achievements'].includes(kind))return true;
 if(kind==='origin')return (gift.story?.length||0)+(gift.first_memory?.length||0)>450;
 const field={journey:'milestones',reasons:'reasons',dreams:'dreams'}[kind];if(!field)return false;
 const items=(gift[field]||[]).filter(Boolean);return items.length>5||items.reduce((length,item)=>length+(typeof item==='string'?item.length:(item.title?.length||0)+(item.description?.length||0)),0)>450;
}
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
export function albumCategory(kind){
 if(['memories','illustration','booth'].includes(kind))return 'photos';
 if(['envelope','handwritten','keepsake-letter','notes','reasons','promise'].includes(kind))return 'letters';
 if(['garden','puzzle','scratch','games','quiz','coupons','bucket'].includes(kind))return 'surprises';
 return 'story';
}
const pageLabels={cover:'A capa do nosso livro','back-cover':'Feito de nós',dedication:'Uma dedicatória',contents:'O sumário',counter:'O tempo de nós',constellation:'Nosso universo',memories:'Memórias em fotografias',envelope:'A carta de amor',handwritten:'Palavras para guardar','keepsake-letter':'Uma carta para a hora certa',notes:'Bilhetinhos',reasons:'O pote dos nossos motivos',music:'A trilha de nós',scratch:'Uma surpresa para raspar',garden:'Nosso jardim secreto',booth:'A cabine de fotos',puzzle:'Cada pedacinho de nós',ending:'As próximas páginas'};
export function readAlbumIndex(pages){return Array.from(pages,(page,index)=>{
 const classes=Array.from(page.classList),kind=classes.find(c=>c.endsWith('-scene')&&c!=='keepsake-scene')?.replace(/-scene$/,'')||classes.find(c=>c.endsWith('-page')&&c!=='album-page')?.replace(/-page$/,'')||'story';
 const heading=page.querySelector('h2')?.cloneNode(true);heading?.querySelectorAll('br').forEach(br=>br.replaceWith(' '));
 const title=(heading?.textContent||'').replace(/\s+/g,' ').trim(),thumbnail=page.querySelector('img')?.getAttribute('src')||'';
 return {index,number:index+1,kind,category:albumCategory(kind),title:pageLabels[kind]||title||'Uma página nossa',subtitle:title,thumbnail,section:page.dataset.section||''};
});}
export function filterAlbumIndex(pages,query='',category='all'){
 const words=normalized(query).split(' ').filter(Boolean);
 return pages.filter(page=>(category==='all'||page.category===category)&&words.every(word=>normalized([page.title,page.subtitle,page.number,page.section].join(' ')).includes(word)));
}
export function toggleVisitItem(items,value,open){const included=items.includes(value),wanted=open??!included;if(included===wanted)return items;return wanted?[...items,value]:items.filter(i=>i!==value);}
export function playlistReadingMode(kind,gift){return kind==='stats'||storyNeedsReading(({timeline:'journey',story:'origin'})[kind]||kind,gift);}
export function canAdvancePlaylist({playing,scene,reading=false,hidden=false,holding=false,overlay=false}){return !!playing&&!!scene&&!reading&&!hidden&&!holding&&!overlay;}
// A vertical scroll, a thumbnail-strip scroll or a zoomed image is not a photo swipe.
export function photoSwipeDirection(start,end,zoomed=false){
 if(!start||!end||zoomed)return 0;
 const dx=end.x-start.x,dy=end.y-start.y;
 return Number.isFinite(dx)&&Number.isFinite(dy)&&Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5?(dx<0?1:-1):0;
}
