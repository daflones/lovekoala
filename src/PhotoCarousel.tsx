import {useEffect,useRef} from 'react';
import {ChevronLeft,ChevronRight,Heart} from 'lucide-react';
type Props={photos:any[];index:number;onChange:(n:number)=>void;progress?:number};
export default function PhotoCarousel({photos,index,onChange,progress=0}:Props){
 const start=useRef<number|null>(null),thumbs=useRef<HTMLDivElement>(null);const photo=photos[index]||photos[0];
 useEffect(()=>{thumbs.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});},[index]);
 if(!photo)return null;
 const go=(n:number)=>onChange(Math.max(0,Math.min(photos.length-1,n)));
 return <section className="love-photo-carousel" aria-roledescription="carrossel" aria-label="Fotos da nossa história" tabIndex={0} onKeyDown={e=>{if(e.target instanceof HTMLInputElement)return;if(e.key==='ArrowLeft'){e.preventDefault();go(index-1);}if(e.key==='ArrowRight'){e.preventDefault();go(index+1);}}} onTouchStart={e=>{start.current=e.touches[0].clientX;}} onTouchEnd={e=>{if(start.current===null)return;const diff=e.changedTouches[0].clientX-start.current;start.current=null;if(Math.abs(diff)>45)go(index+(diff<0?1:-1));}}>
 <div className="carousel-progress" aria-hidden="true">{photos.map((p,i)=><span key={p.id||i}><i style={{width:i<index?'100%':i===index?progress+'%':'0%'}}/></span>)}</div>
 <div className="carousel-photo"><img key={photo.url} src={photo.url} alt={photo.caption||'Memória '+(index+1)} decoding="async"/><span className="carousel-photo-count"><Heart size={12} fill="currentColor"/> {String(index+1).padStart(2,'0')} / {String(photos.length).padStart(2,'0')}</span><button className="carousel-arrow previous" aria-label="Foto anterior" disabled={index===0} onClick={()=>go(index-1)}><ChevronLeft size={23}/></button><button className="carousel-arrow next" aria-label="Próxima foto" disabled={index===photos.length-1} onClick={()=>go(index+1)}><ChevronRight size={23}/></button></div>
 <div className="carousel-caption" aria-live="polite"><span>{photo.ai?'UMA CENA IMAGINADA COM IA':'UM PEDACINHO DA GENTE'}</span><h2>{photo.caption||'Meu lugar favorito é com você.'}</h2></div><div className="carousel-thumbnails" ref={thumbs} aria-label="Escolha uma foto">{photos.map((p,i)=><button key={p.id||i} aria-label={'Ver foto '+(i+1)+(p.caption?': '+p.caption:'')} aria-current={i===index?'true':undefined} onClick={()=>go(i)}><img src={p.url} alt="" loading="lazy"/><span>{String(i+1).padStart(2,'0')}</span></button>)}</div><small className="carousel-swipe-hint">Deslize ou escolha uma memória para reviver.</small>
 </section>;
}
