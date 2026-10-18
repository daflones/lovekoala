import {useEffect,useMemo,useRef,useState} from 'react';
import {Check,ChevronRight,ExternalLink,Heart,Headphones,Link2,Loader2,Play,Search,Sparkles,X,Youtube} from 'lucide-react';
import MusicPlayer from './MusicPlayer';
import {MUSIC_CATALOG,filterMusic,musicPatch,parseMusicUrl,trackFromGift} from './music.mjs';
import {api} from './api';
import {track} from './tracking';
export default function MusicPicker({gift,patch,globalSearch=false}:{gift:any;patch:(v:any)=>void;globalSearch?:boolean}){
 const selected=trackFromGift(gift);
 const [query,setQuery]=useState(''),[category,setCategory]=useState('all'),[remote,setRemote]=useState<any[]|null>(null),[preview,setPreview]=useState<any>(null),[url,setUrl]=useState(''),[tab,setTab]=useState('explore'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [searchMode,setSearchMode]=useState('selection'),[searchedQuery,setSearchedQuery]=useState(''),[nextPage,setNextPage]=useState(''),[limited,setLimited]=useState(false);
 const playerHost=useRef<HTMLDivElement>(null),linkInput=useRef<HTMLInputElement>(null),sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++;},[]);
 const tracks=useMemo(()=>remote??filterMusic(MUSIC_CATALOG,query,category),[remote,query,category]);
 const youtubeResults=remote!==null&&searchMode==='youtube';
 const youtubeLink='https://www.youtube.com/results?search_query='+encodeURIComponent(query.trim()||'músicas românticas');
 function listen(song:any){setPreview(song);if(innerWidth<1000)requestAnimationFrame(()=>playerHost.current?.scrollIntoView({behavior:'smooth',block:'nearest'}));}
 function choose(song:any){patch(musicPatch(song));}
 function editQuery(value:string){sequence.current++;setBusy(false);setQuery(value);setRemote(null);setNextPage('');setSearchedQuery('');setLimited(false);setError('');}
 function showLink(){setTab('link');setError('');requestAnimationFrame(()=>linkInput.current?.focus());}
 async function resolveTrack(value:string){
  const current=++sequence.current;setBusy(true);setError('');
  try{const r=await api('music_resolve',{url:value.trim()});if(sequence.current!==current)return;listen(r.track);setUrl('');}
  catch(e){if(sequence.current===current)setError((e as Error).message);}
  finally{if(sequence.current===current)setBusy(false);}
 }
 async function search(e?:React.FormEvent,more=false){
  e?.preventDefault();if(busy)return;const term=(more?searchedQuery:query).trim();
  if(!term){editQuery('');return;}
  if(parseMusicUrl(term)){await resolveTrack(term);return;}
  if(term.length>120){setError('Procure pelo nome da música ou artista, com até 120 caracteres. Links podem ser colados em “Tenho um link”.');return;}
  const current=++sequence.current;setBusy(true);setError('');
  track('music_search',{label:more?'youtube_more':'search'});
  try{
   // Always consult the server, including when this tab loaded before a key was configured.
   const r=await api('music_search',{query:term,...(more?{page_token:nextPage}:{})});
   if(sequence.current!==current)return;
   const found=Array.isArray(r.tracks)?r.tracks:[];
   setRemote(previous=>{const list=more?[...(previous||[]),...found]:found;const seen=new Set();return list.filter((song:any)=>{const key=song.provider+':'+song.id;if(seen.has(key))return false;seen.add(key);return true;});});
   setSearchMode(r.search_mode||'selection');setSearchedQuery(term);setNextPage(r.next_page_token||'');setLimited(r.search_mode!=='youtube');setCategory('all');
  }catch(e){if(sequence.current===current){setError((e as Error).message);setNextPage('');}}
  finally{if(sequence.current===current)setBusy(false);}
 }
 return <section className="music-studio">
  <header className="music-studio-header"><div className="music-studio-icon"><Headphones size={25}/><Sparkles size={15}/></div><div><span>FEITA PARA DAR REPLAY</span><h3>A trilha de vocês.</h3><p>Encontre uma música, ouça e escolha a que abraça essa história.</p></div></header>
  <div className="music-studio-selected"><span>{selected.artwork?<img src={selected.artwork} alt=""/>:<Heart size={22} fill="currentColor"/>}</span><div><small><Check size={12}/> ESCOLHIDA PARA O PRESENTE</small><strong>{selected.title}</strong><p>{selected.artist}</p></div><button aria-label={'Ouvir música escolhida: '+selected.title} onClick={()=>listen(selected)}><Play size={18} fill="currentColor"/></button></div>
  <div className="music-studio-tabs" role="group" aria-label="Como encontrar sua música"><button className={tab==='explore'?'selected':''} aria-pressed={tab==='explore'} onClick={()=>setTab('explore')}><Search size={16}/> Buscar músicas</button><button className={tab==='link'?'selected':''} aria-pressed={tab==='link'} onClick={showLink}><Link2 size={17}/> Tenho um link</button></div>
  {tab==='explore'?<>
   <form className="music-studio-search" onSubmit={search}><Search size={20}/><input value={query} onChange={e=>editQuery(e.target.value)} maxLength={600} aria-label="Buscar música ou artista" placeholder="Digite a música, o artista ou cole o link"/>{query&&<button type="button" aria-label="Limpar busca" onClick={()=>editQuery('')}><X size={17}/></button>}<button type="submit" disabled={busy}>{busy?<Loader2 size={17} className="spin"/>:'Buscar'}</button></form>
   <p className="music-search-caption">{globalSearch||youtubeResults?'Digite o nome e toque em Buscar para procurar no YouTube.':'Explore a seleção abaixo ou encontre outra música pelo link do YouTube.'}</p>
   {limited&&<div className="music-search-limited" role="status"><Youtube size={21}/><div><strong>A busca geral ainda não está disponível.</strong><p>Estes resultados são da seleção do LoveKoala. Você pode encontrar outra música no YouTube e colar o link para ouvi-la aqui.</p></div></div>}
   {(limited||!globalSearch&&!youtubeResults||error)&&<div className="music-find-anywhere"><a href={youtubeLink} target="_blank" rel="noopener noreferrer"><Youtube size={17}/> Pesquisar no YouTube <ExternalLink size={13}/></a><button onClick={showLink}><Link2 size={16}/> Colar o link da música <ChevronRight size={14}/></button></div>}
   {youtubeResults?<div className="music-results-source"><span><Youtube size={15}/> Resultados do YouTube</span><button onClick={()=>{editQuery('');setSearchMode('selection');}}>Voltar às sugestões</button></div>:<div className="music-studio-filters">{[['all','Para vocês'],['brasil','Brasil'],['internacional','Internacional'],['original','Instrumental original']].map(([id,label])=><button key={id} className={category===id?'selected':''} onClick={()=>{sequence.current++;setBusy(false);setCategory(id);setRemote(null);setNextPage('');}} aria-pressed={category===id}>{label}</button>)}</div>}
   <div className="music-studio-list" aria-label="Músicas encontradas" aria-busy={busy}><div className="music-studio-list-label"><span>{youtubeResults?'NO YOUTUBE':'NA SELEÇÃO DO LOVEKOALA'}</span><span>{tracks.length} {tracks.length===1?'música':'músicas'}</span></div>
    {tracks.map((song:any)=>{const chosen=song.id===selected.id&&song.provider===selected.provider;return <article key={song.provider+song.id} className={(chosen?'selected ':'')+(preview?.id===song.id?'listening':'')}><button className="studio-song-listen" onClick={()=>listen(song)} aria-label={'Ouvir '+song.title}>{song.artwork?<img src={song.artwork} alt="" loading="lazy"/>:<Heart size={23}/>}<i><Play size={17} fill="currentColor"/></i></button><button className="studio-song-info" onClick={()=>listen(song)}><strong>{song.title}</strong><small>{song.artist}</small><span>{song.provider==='original'?'LOVEKOALA ORIGINAL · 0:32':'YouTube'}</span></button><button className="studio-song-select" aria-pressed={chosen} onClick={()=>choose(song)} aria-label={(chosen?'Música escolhida: ':'Escolher ')+song.title}>{chosen?<Check size={18}/>:<Heart size={18}/>}<span>{chosen?'Escolhida':'Escolher'}</span></button></article>;})}
    {!tracks.length&&!busy&&<div className="music-studio-empty"><Search size={28}/><strong>{youtubeResults?'Vamos tentar de outro jeito?':'Essa música ainda não está na seleção.'}</strong><p>{youtubeResults?'Nenhum vídeo foi encontrado para esse nome. Tente o artista ou outro título.':'Você pode pesquisar no YouTube e colar o link para ouvir dentro do presente.'}</p><button onClick={showLink}><Link2 size={15}/> Adicionar o link <ChevronRight size={15}/></button></div>}
   </div>
   {youtubeResults&&nextPage&&<button className="music-load-more" disabled={busy} onClick={()=>search(undefined,true)}>{busy?<Loader2 size={17} className="spin"/>:<Search size={16}/>} Carregar mais músicas</button>}
  </>:<form className="music-studio-link" onSubmit={e=>{e.preventDefault();if(url.trim())resolveTrack(url);}}><Link2 size={27}/><h4>A música que já é de vocês.</h4><p>Cole um link do YouTube ou Spotify. Primeiro você ouve, depois escolhe.</p><label>Link da música<input ref={linkInput} type="url" value={url} onChange={e=>setUrl(e.target.value)} maxLength={600} placeholder="https://www.youtube.com/watch?v=…" required/></label><button disabled={busy}>{busy?<Loader2 size={17} className="spin"/>:<Headphones size={17}/>} Encontrar e ouvir</button></form>}
  {error&&<div className="music-studio-error" role="alert">{error}</div>}
  {preview&&<div className="music-studio-audition" ref={playerHost}><header><Headphones size={16}/><span>OUÇA ANTES DE ESCOLHER</span><button aria-label="Fechar e pausar música" onClick={()=>setPreview(null)}><X size={19}/></button></header><MusicPlayer key={preview.provider+preview.id} track={preview} autoPlay/><button className="music-studio-use" onClick={()=>choose(preview)}><Check size={18}/>{selected.id===preview.id&&selected.provider===preview.provider?'Essa é a música de vocês':'Usar esta música no presente'}</button></div>}
  <footer>O YouTube toca no player oficial dentro do LoveKoala. Disponibilidade e anúncios dependem da plataforma.</footer>
 </section>;
}
