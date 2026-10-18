import {Body,Illumination,MoonPhase,SearchMoonPhase,Seasons} from 'astronomy-engine';
const seasonCache=new Map();
function seasons(year){if(!seasonCache.has(year))seasonCache.set(year,Seasons(year));return seasonCache.get(year);}
const keys=['mar_equinox','jun_solstice','sep_equinox','dec_solstice'];
const names=['Outono','Inverno','Primavera','Verão'];
export function storyAstronomyFacts(gift,now=new Date()){
 const iso=gift.start_date;if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||''))return null;
 const begin=new Date(`${iso}T${gift.start_time||'00:00'}:00-03:00`),elapsed=now.getTime()-begin.getTime();
 if(!Number.isFinite(elapsed)||elapsed<0||elapsed>36525*86400000||new Date(iso+'T12:00:00Z').toISOString().slice(0,10)!==iso)return null;
 const angle=MoonPhase(begin),phaseIndex=Math.floor((angle+22.5)/45)%8;
 const phaseLabel=['Lua nova','Lua crescente','Quarto crescente','Gibosa crescente','Lua cheia','Gibosa minguante','Quarto minguante','Lua minguante'][phaseIndex];
 let fullMoons=0,search=begin;
 for(let i=0;i<1240;i++){const moon=SearchMoonPhase(180,search,32);if(!moon||moon.date>now)break;fullMoons++;search=moon.AddDays(1);}
 let season='Verão',seasonIndex=3,seasonChanges=0;
 for(let y=begin.getUTCFullYear()-1;y<=now.getUTCFullYear();y++){
  const events=seasons(y);keys.forEach((key,i)=>{const instant=events[key].date;if(instant<=begin){season=names[i];seasonIndex=i;}if(instant>begin&&instant<=now)seasonChanges++;});
 }
 return {phaseLabel,phaseIndex,angle,illumination:Math.round(Illumination(Body.Moon,begin).phase_fraction*100),fullMoons,season,seasonIndex,seasonChanges};
}
