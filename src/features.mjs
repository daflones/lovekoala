import {parseDay} from './calendar.mjs';
export const DECORATIONS=[{id:'hearts',name:'Corações flutuantes'},{id:'stars',name:'Estrelinhas'},{id:'petals',name:'Pétalas ao vento'},{id:'fireflies',name:'Vaga-lumes'},{id:'paperplanes',name:'Cartinhas voando'}];
export const GAMES=[{id:'memory',name:'Memória de nós',description:'Encontre os pares das suas fotos. Sozinho ou em dupla.'},{id:'connect',name:'Quatro corações',description:'Quatro em linha, contra o Coala ou com seu amor.'},{id:'wheel',name:'Roleta do carinho',description:'Gire e descubra um pequeno encontro para viver.'}];
export const DEFAULT_GAMES=GAMES.map(g=>g.id);
export function planFeatures(plan,format='album'){
 const common=[`Até ${plan.max_photos} fotos com legendas`,plan.formats.includes('ambos')?'Álbum + retrospectiva no mesmo presente':'Escolha álbum ou retrospectiva','Trilha opcional + link e QR Code'];
 return [...common,...(format==='album'?['Livro 3D com som de folhas','Cartas, bilhetes e surpresa de raspar','Jardim que floresce + cabine de fotos','Tirinha para baixar + quebra-cabeça','Adesivos animados + 3 minijogos']:['Playlist + edição em histórias animadas','Carrossel, calendário, lua e estação','Batimentos estimados + marcos com datas','Cartas, vales, quiz e jogos nos stories','3 minijogos para solo ou dupla']),plan.access_kind==='24h'?'24 horas de acesso e edição após pagar':plan.access_kind==='lifetime'?'Acesso e edição sem vencimento':plan.access_kind==='club'?`${plan.monthly_gifts||2} presentes vitalícios por mês pago`:`${Math.round(plan.access_days/365)} anos de acesso`];
}
export function relationshipStats(start,now=new Date()){
 const date=parseDay(start);if(!date)return null;
 const begin=Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()),end=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
 if(begin>end)return null;const days=Math.floor((end-begin)/86400000),months=(now.getFullYear()-date.getFullYear())*12+now.getMonth()-date.getMonth()-(now.getDate()<date.getDate()?1:0);
 const year=now.getFullYear()+(now.getMonth()>date.getMonth()||now.getMonth()===date.getMonth()&&now.getDate()>=date.getDate()?1:0);
 const anniversary=new Date(year,date.getMonth(),Math.min(date.getDate(),new Date(year,date.getMonth()+1,0).getDate()),12);
 return {days,weeks:Math.floor(days/7),months:Math.max(0,months),hours:days*24,minutes:days*1440,nextAnniversary:Math.round((Date.UTC(anniversary.getFullYear(),anniversary.getMonth(),anniversary.getDate())-end)/86400000),years:Math.max(0,Math.floor(months/12))};
}
// Dates entered in Brazil use Brasília time. Missing times start at midnight.
// Work from the original instant on every tick, so sleeping tabs do not drift.
export function relationshipClock(start,time='',now=new Date()){
 const date=parseDay(start);if(!date||time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
 const begin=Date.parse(`${start}T${time||'00:00'}:00-03:00`),instant=now.getTime();
 if(!Number.isFinite(instant)||begin>instant)return null;
 const totalSeconds=Math.floor((instant-begin)/1000),br=new Date(instant-3*3600000);
 const calendar=relationshipStats(start,new Date(br.getUTCFullYear(),br.getUTCMonth(),br.getUTCDate(),12));if(!calendar)return null;
 return {...calendar,days:Math.floor(totalSeconds/86400),hoursPart:Math.floor(totalSeconds/3600)%24,minutesPart:Math.floor(totalSeconds/60)%60,secondsPart:totalSeconds%60,totalSeconds,totalMinutes:Math.floor(totalSeconds/60),totalHours:Math.floor(totalSeconds/3600)};
}
export function shuffledPairs(photos,random=Math.random){const choices=Array.from({length:6},(_,i)=>({pair:i,url:photos[i]?.url||'',artwork:['hearts','stars','petals','fireflies','paperplanes','moon'][i]}));const cards=choices.flatMap(p=>[{...p,id:p.pair+'a'},{...p,id:p.pair+'b'}]);for(let i=cards.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}return cards;}
export function dropHeart(board,col,player){if(!Number.isInteger(col)||col<0||col>6)return null;const next=[...board];for(let row=5;row>=0;row--){const i=row*7+col;if(!next[i]){next[i]=player;return next;}}return null;}
export function fourWinner(board){for(let r=0;r<6;r++)for(let c=0;c<7;c++){const p=board[r*7+c];if(!p)continue;for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){let ok=true;for(let k=1;k<4;k++){const rr=r+dr*k,cc=c+dc*k;if(rr<0||rr>5||cc<0||cc>6||board[rr*7+cc]!==p){ok=false;break;}}if(ok)return p;}}return board.every(Boolean)?'draw':null;}
export function coalaMove(board,random=Math.random){const order=[3,2,4,1,5,0,6].filter(c=>!board[c]);for(const p of [2,1])for(const c of order){if(fourWinner(dropHeart(board,c,p))===p)return c;}return order[Math.floor(random()*Math.min(3,order.length))]??null;}
export const DATE_IDEAS=['Um café sem celular, só com a nossa conversa.','Escolher três fotos e contar o que cada uma lembra.','Colocar a nossa música e dançar na sala.','Cozinhar juntos uma receita que ainda não tentamos.','Um passeio sem pressa para ver o pôr do sol.','Cada um escreve três coisas que ama no outro.','Montar a playlist do nosso próximo encontro.','Rever o nosso primeiro filme juntos.'];
