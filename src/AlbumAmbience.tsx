import {DecorationArtwork} from './GiftArtwork';
import {DECORATIONS} from './features.mjs';
export default function AlbumAmbience({selected=[]}:{selected:string[]}){return <div className="love-ambience" aria-hidden="true">{DECORATIONS.filter(d=>selected.includes(d.id)).flatMap((d,k)=>Array.from({length:5},(_,i)=><i key={d.id+i} className={'ambience-'+d.id} style={{left:((i*23+k*17)%94+2)+'%',top:((i*31+k*19)%86+5)+'%',animationDelay:-(i*1.3+k)+'s',animationDuration:(7+i%3*2)+'s'}}><DecorationArtwork kind={d.id}/></i>))}</div>;}
