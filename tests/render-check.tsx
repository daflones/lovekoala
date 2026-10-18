import CaptainKoala from '../src/CaptainKoala';
import AuthPanel from '../src/AuthPanel';
import KoalaSupport from '../src/KoalaSupport';
import KoalaAvatar from '../src/KoalaAvatar';
import React from 'react';
import {parseHTML} from 'linkedom';
import AlbumPageIndex from '../src/AlbumPageIndex';
import StoryPhotoReel from '../src/StoryPhotoReel';
import {createAlbumPage} from '../src/album-dom.mjs';
import {readAlbumIndex,photoStoryGroups} from '../src/reader-navigation.mjs';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import Landing from '../src/LandingV2';
import CreatorFields from '../src/CreatorFields';
import Retrospective from '../src/Retrospective';
import {buildAlbumPages} from '../src/GiftViewer';
import {demoGift,emptyGift} from '../src/domain.mjs';
import {completeGift,DEMO_DETAILS} from '../src/experience.mjs';
import Admin from '../src/Admin';
import RetrospectiveStories,{MemoryCalendar} from '../src/RetrospectiveStories';
import MemoryLab,{PhotoBooth,PhotoPuzzle} from '../src/MemoryLab';
import {keepsakeFacts,keepsakeStories} from '../src/keepsake.mjs';
import {DEMO_COHORT} from '../src/retrospective-facts.mjs';
import {storyAstronomyFacts} from '../src/story-astronomy.mjs';
import {CommunityStory,CityStory,HeartbeatStory,StoryNumberBoard,MilestoneStory,SoundtrackStory,OriginStory} from '../src/StoryStatistics';
import {MoonStory,SeasonStory} from '../src/StorySky';
import {PlacesStory,AchievementsStory,LettersStory,CouponsStory,QuizStory,GamesStory,JourneyStory,ReasonsStory,DreamsStory} from '../src/StoryExtras';
import AdminAi from '../src/AdminAi';
import {PaymentApproval} from '../src/AdminBilling';
import Account from '../src/Account';
import CoalaGuide from '../src/CoalaGuide';
import MusicPlayer from '../src/MusicPlayer';
import {SiteContext} from '../src/SiteContext';
import {MUSIC_CATALOG} from '../src/music.mjs';
import DemoGallery from '../src/DemoGallery';
import DatePicker from '../src/DatePicker';
import GameRoom from '../src/GameRoom';
import RelationshipStats from '../src/RelationshipStats';
import CheckoutRecovery,{PendingPayment} from '../src/CheckoutRecovery';
import EditorPreview from '../src/EditorPreview';
import PhotoCarousel from '../src/PhotoCarousel';
import {PLANS} from '../src/domain.mjs';
import {buildDemoGift} from '../src/demo.mjs';
(globalThis as any).location={pathname:'/',search:'',origin:'https://lovekoala.test'};
const gift=completeGift({...demoGift,...DEMO_DETAILS,plan_id:'universo',email:'test@example.com'});
const no=()=>{};
const landing=renderToStaticMarkup(<Landing onStart={no} onDemo={no} onChat={no} onLegal={no}/>);
assert(landing.includes('Vocês viveram.'));assert(landing.includes('Retrospectiva'));
for(let step=0;step<12;step++){
 const form=renderToStaticMarkup(<CreatorFields step={step} gift={gift} patch={no} fileInput={React.createRef()} uploading={0} addFiles={no} removePhoto={no} movePhoto={no}/>);
 assert(form.includes('<h1>'),`stage ${step+1} renders`);assert(!form.includes('[object Object]'));
}
const retro=renderToStaticMarkup(<Retrospective gift={gift}/>);
assert.equal((retro.match(/class="memory-track"/g)||[]).length,17);assert(retro.includes('Buscar'));
const pages=buildAlbumPages(gift);
assert.equal(pages.length,39);
const rendered=pages.map((p,i)=>renderToStaticMarkup(<React.Fragment key={i}>{p}</React.Fragment>));
for(const page of rendered){assert(page.includes('album-page'));assert(!page.includes('[object Object]'));}
const book=rendered.join('');for(const target of book.matchAll(/data-goto="([^"]+)"/g))assert(book.includes('data-section="'+target[1]+'"'),`index target ${target[1]} exists`);
const hostile=completeGift({...emptyGift,sender:'<script>alert(1)</script>',recipient:'<img src=x onerror=alert(1)>',letter:'<script>test</script>'});
const escaped=buildAlbumPages(hostile).map(p=>renderToStaticMarkup(p as any)).join('');assert(!escaped.includes('<script>'));assert(escaped.includes('&lt;script&gt;'));
const admin=renderToStaticMarkup(<Admin/>);assert(admin.includes('ADMIN'));assert(admin.includes('type="password"'));
const account=renderToStaticMarkup(<Account/>);assert(account.includes('Criar conta'));
const coala=renderToStaticMarkup(<CoalaGuide onClose={no} onStart={no}/>);assert(coala.includes('Quero os dois'));assert(coala.includes('Responder ao Coala'));
const music=renderToStaticMarkup(<MusicPlayer track={MUSIC_CATALOG[0]}/>);assert(music.includes('<audio'));assert(music.includes('Ouvir música'));
const youtube=renderToStaticMarkup(<MusicPlayer track={MUSIC_CATALOG[1]}/>);assert(youtube.includes('youtube-visible-player'));assert(!youtube.includes('<audio'));
const custom=renderToStaticMarkup(<SiteContext.Provider value={{settings:{copy:{'landing.copy.006':'Título personalizado'},sections:{order:['cta','hero'],hidden:[]}}}}><Landing onStart={no} onDemo={no} onChat={no} onLegal={no}/></SiteContext.Provider>);
assert(custom.includes('Título personalizado'));assert(custom.indexOf('lk-last-call')<custom.indexOf('lk-hero'));assert(!custom.includes('id="planos"'));
for(const plan of PLANS)for(const format of ['album','retrospectiva']){
 const demo=buildDemoGift(plan.id,format);const markup=renderToStaticMarkup(<DemoGallery initialFormat={format} initialPlan={plan.id} onCreate={no}/>);
 assert(markup.includes('Fotos e história fictícias'));assert(markup.includes(plan.name));assert(markup.includes('Formato do exemplo'));assert(!markup.includes('Fotos com YouTube'));
 const album=buildAlbumPages(demo);assert.equal(album.length,40);const content=album.map(p=>renderToStaticMarkup(p as any)).join('');
 assert(content.includes('data-scratch-canvas'));assert(content.includes('data-game="memory"'));assert(content.includes('data-stats'));
 for(const photo of demo.photos)assert(content.includes(photo.url));
}
for(const game of ['memory','connect','wheel']){
 const markup=renderToStaticMarkup(<GameRoom gift={gift} initialGame={game} onClose={no}/>);
 assert(markup.includes('role="dialog"'));assert(markup.includes('mesmo aparelho'));assert(markup.includes('Resultados ficam só nesta visita'));
 if(game==='memory')assert.equal((markup.match(/class="memory-card-front"/g)||[]).length,12);
 if(game==='connect')assert.equal((markup.match(/connect-cell player-/g)||[]).length,42);
 if(game==='wheel')assert(markup.includes('Girar o nosso próximo encontro'));
}
const stats=renderToStaticMarkup(<RelationshipStats gift={gift}/>);assert(stats.includes('segundos'));assert(!stats.includes('20 casais'));assert(!stats.includes('dura mais que aproximadamente'));
const calendar=renderToStaticMarkup(<DatePicker value="2022-06-12" onChange={no}/>);assert(calendar.includes('12 de junho de 2022'));assert(calendar.includes('aria-expanded="false"'));
const demo=buildDemoGift();const carousel=renderToStaticMarkup(<PhotoCarousel photos={demo.photos} index={1} onChange={no}/>);assert(carousel.includes('carrossel'));assert(carousel.includes('Foto anterior'));assert(carousel.includes('demo-cafe.png'));assert(carousel.includes('Próxima foto'));
const expandable=renderToStaticMarkup(<PhotoCarousel photos={demo.photos} index={1} onChange={no} onOpen={no}/>);assert(expandable.includes('Ver foto 2 inteira'));assert(expandable.includes('carousel-expand'));
const gallery=renderToStaticMarkup(<MemoryLab gift={demo} mode="photos" initialPhoto={1} onClose={no}/>);assert(gallery.includes('Deslize a foto'));assert(gallery.includes('MEMÓRIA 2 DE'));assert(gallery.includes('lab-gallery-thumbnails'));assert(!gallery.includes('[object Object]'));
for(const provider of ['mercosulpay','stripe']){
 const order={id:'test-order',provider,amount_cents:2990,billing_cycle:'once',pix_code:provider==='mercosulpay'?'code':'',checkout_url:provider==='stripe'?'https://checkout.stripe.com/example':''};
 const pending=renderToStaticMarkup(<PendingPayment order={order} qr="data:image/png;base64,eA==" collapsed={false} onToggle={no} onSummary={no} onCard={no} onCancel={no} onCopy={no} copied={false} busy={false}/>);
 assert(pending.includes('Pendente'));assert(pending.includes('Guardar um resumo por e-mail'));
 if(provider==='mercosulpay')assert(pending.includes('QR Code para pagar'));else assert(pending.includes('Continuar no Stripe'));
 const recovery=renderToStaticMarkup(<CheckoutRecovery gift={gift} order={order} draft={{id:'draft-test',edit_token:''}} onClose={no} onLeave={no}/>);
 assert(recovery.includes('continuar=1'));assert(recovery.includes('type="email"'));assert(recovery.includes('Isso não inclui seu e-mail em campanhas'));
}
const preview=renderToStaticMarkup(<EditorPreview gift={gift} onOpen={no} onDemo={no}/>);assert(preview.includes('studio-preview'));assert(!preview.includes('[object Object]'));
const quiet=buildAlbumPages(completeGift({...gift,album_music_enabled:false})).map(p=>renderToStaticMarkup(p as any)).join('');assert(!quiet.includes('music-page'));assert(book.includes('data-clock-unit="secondsPart"'));assert(book.includes('data-section="music"'));assert(book.includes('data-album-music="true"'));assert(!quiet.includes('data-section="music"'));
const support=renderToStaticMarkup(<KoalaSupport open onOpen={no} onClose={no} onChoose={no} onNavigate={()=>true}/>);assert(support.includes('Enviar pergunta'));assert(support.includes('role="log"'));assert(support.includes('Qual plano combina comigo?'));assert(!support.includes('nvapi-'));
const mascot=renderToStaticMarkup(<KoalaAvatar mood="thinking"/>);assert(mascot.includes('koala-thinking'));assert(mascot.includes('koala-mouth'));
const artGift={...gift,illustrations:[{id:'qa-art',url:'/assets/test-art.webp',caption:'Uma cena imaginada',ai:true}]};const artBook=buildAlbumPages(artGift).map(p=>renderToStaticMarkup(p as any)).join('');assert(artBook.includes('/assets/test-art.webp'));assert(artBook.includes('ILUSTRAÇÃO CRIADA COM IA'));
const artCarousel=renderToStaticMarkup(<PhotoCarousel photos={artGift.illustrations} index={0} onChange={no}/>);assert(artCarousel.includes('UMA CENA IMAGINADA COM IA'));
console.log(JSON.stringify({ok:true,landing:true,admin_login:true,account_login:true,coala_choices:true,koala_ai_support:true,image_generation_paused:true,ai_art_album_and_carousel:true,music_players:true,cms_copy_and_section_order:true,editor_stages:12,retrospective_chapters:17,album_pages:pages.length,expanded_demo_pages:40,plan_format_examples:6,game_engines:3,calendar:true,stats:true,photo_carousel:true,pending_payment_both_providers:true,checkout_recovery:true,index_targets:true,user_text_escaped:true}));

const guestAuth=renderToStaticMarkup(<AuthPanel initialEmail="buyer@example.invalid" initialMode="signup" onSuccess={no}/>);assert(guestAuth.includes('value="buyer@example.invalid"'));assert(guestAuth.includes('Criar minha conta'));
const captain=renderToStaticMarkup(<CaptainKoala/>);assert(captain.includes('Capitão Koala'));assert(captain.includes('Exclusivo para admins'));assert(captain.includes('Alterações para revisar'));assert(!captain.includes('nvapi-'));

const hiddenChat=renderToStaticMarkup(<Landing chatEnabled={false} onStart={no} onDemo={no} onChat={no} onLegal={no}/>);assert(!hiddenChat.includes('lk-coala-invite'));assert(hiddenChat.includes('Criar o nosso presente'));
const aiControl=renderToStaticMarkup(<AdminAi/>);assert(aiControl.includes('role="switch"'));assert(aiControl.includes('Conversa com IA para clientes'));
const approval=renderToStaticMarkup(<PaymentApproval order={{id:'fixture-order',gift_id:'fixture-gift',plan_id:'universo',amount_cents:4990,billing_cycle:'monthly',provider:'stripe'}} busy={false} error="" onApprove={no} onCancel={no}/>);assert(approval.includes('Motivo da aprovação'));assert(approval.includes('type="checkbox"'));assert(approval.includes('não cobra o cliente'));assert(approval.includes('Confirmar aprovação'));

const edition=renderToStaticMarkup(<RetrospectiveStories gift={gift} onClose={no}/>);assert(edition.includes('A edição da nossa história'));assert(edition.includes('Ir para O nosso primeiro dia'));assert(edition.includes('Voltar à playlist'));assert(!edition.includes('TOP 18%'));
const dateScene=renderToStaticMarkup(<MemoryCalendar facts={keepsakeFacts(gift)}/>);assert(dateScene.includes('our-day'));assert(dateScene.includes('junho'));
const booth=renderToStaticMarkup(<PhotoBooth gift={gift} photos={gift.photos}/>);assert(booth.includes('Revelar nossa tirinha'));assert(booth.includes('Não acessamos sua câmera'));assert(booth.includes('Escolher foto 1'));
const puzzle=renderToStaticMarkup(<PhotoPuzzle photos={gift.photos}/>);assert.equal((puzzle.match(/aria-label="Posição /g)||[]).length,9);assert(puzzle.includes('Toque em duas peças'));assert(puzzle.includes('Ver foto completa'));
for(const feature of ['data-garden-water','data-keepsake="booth"','data-keepsake="puzzle"','data-photo-index','data-section="dreamscape"'])assert(book.includes(feature),feature+' included in album');

const factClock=keepsakeFacts(gift,new Date('2026-10-18T14:00:00Z')),sky=storyAstronomyFacts(gift,new Date('2026-10-18T14:00:00Z'));
const beats=renderToStaticMarkup(<HeartbeatStory clock={factClock}/>);assert(beats.includes('sim nós calculamos isso!'));assert(beats.includes('Estimativa')||beats.includes('estimativa'));assert(beats.includes('dois corações'));
for(const Component of [CommunityStory,CityStory]){
 assert.equal(renderToStaticMarkup(<Component cohort={{available:false}} gift={gift}/>),'');
 assert.equal(renderToStaticMarkup(<Component cohort={{...DEMO_COHORT,participants:19}} gift={gift}/>),'');
 const html=renderToStaticMarkup(<Component cohort={DEMO_COHORT} gift={gift}/>);assert(html.includes('DADOS ILUSTRATIVOS'));assert(!html.includes('[object Object]'));
}
const numeric=renderToStaticMarkup(<StoryNumberBoard clock={factClock} facts={factClock} sky={sky}/>);assert(numeric.includes('luas cheias'));assert(numeric.includes('mudanças de estação'));assert(numeric.includes('fins de semana completos'));
const stamps=renderToStaticMarkup(<MilestoneStory facts={factClock} pair="Lucas & Marina"/>);assert(stamps.includes('dateTime')||stamps.includes('datetime'));assert(stamps.includes('progressbar'));
const songStory=renderToStaticMarkup(<SoundtrackStory gift={gift} clock={factClock} duration={240} onPlay={no}/>);assert(songStory.includes('EM REPEAT'));assert(songStory.includes('equivalência'));assert(songStory.includes('duração da faixa'));
const unknownSong=renderToStaticMarkup(<SoundtrackStory gift={gift} clock={factClock} duration={0} onPlay={no}/>);assert(!unknownSong.includes('EM REPEAT DESDE'));
for(const component of [<OriginStory gift={gift}/>,<MoonStory sky={sky} facts={factClock}/>,<SeasonStory sky={sky}/>,<PlacesStory gift={gift}/>,<AchievementsStory gift={gift}/>,<LettersStory gift={gift}/>,<CouponsStory gift={gift}/>,<QuizStory gift={gift}/>,<GamesStory gift={gift} onGame={no}/>]){const html=renderToStaticMarkup(component);assert(html.includes('edition-'));assert(!html.includes('[object Object]'));}
const fullEdition=renderToStaticMarkup(<RetrospectiveStories gift={gift} demo onClose={no}/>);assert(fullEdition.includes('Explorar todas as histórias'));assert(fullEdition.includes('Ir para A nossa história na comunidade'));assert(fullEdition.includes('Ir para A lua do nosso começo'));assert.equal(keepsakeStories(gift,DEMO_COHORT,true).length,27);
console.log(JSON.stringify({expanded_story_scenes:27,heartbeats_estimate:true,real_community_and_city_threshold:true,astronomy:true,dated_stamps:true,song_equivalence:true,optional_interactive_chapters:true}));

// Node DOM check: reproduces the React 19 image preload prefix, not visual browser QA.
const {document:albumDocument}=parseHTML('<!doctype html><html><body><main id="album-test"></main></body></html>');
const actualHost=albumDocument.querySelector('#album-test')!;
rendered.forEach((markup,i)=>actualHost.appendChild(createAlbumPage(markup,i,albumDocument)));
assert.equal(actualHost.children.length,pages.length);assert.equal(actualHost.querySelectorAll('.album-page').length,pages.length);assert.equal(actualHost.querySelectorAll(':scope > link').length,0);
assert(actualHost.firstElementChild?.classList.contains('cover-page'));assert(actualHost.firstElementChild?.querySelector('img'));assert.equal((actualHost.children[6] as HTMLElement).dataset.page,'6');
const prefixed=createAlbumPage('<link rel="preload" as="image" href="/photo"><div class="album-page"><h2>Uma foto</h2><img src="/photo" alt="Memória"/></div>',91,albumDocument);assert(prefixed.classList.contains('album-page'));assert.equal(prefixed.dataset.page,'91');assert.equal(prefixed.querySelector('img')?.getAttribute('src'),'/photo');
assert.throws(()=>createAlbumPage('<link rel="preload" as="image" href="/photo">',0,albumDocument),/preparar/);
const visualEntries=readAlbumIndex(actualHost.querySelectorAll('.album-page'));assert.equal(visualEntries.length,pages.length);assert(visualEntries.some((page:any)=>page.kind==='garden'&&page.category==='surprises'));assert(visualEntries.some((page:any)=>page.kind==='booth'&&page.category==='photos'));
const pageIndex=renderToStaticMarkup(<AlbumPageIndex pages={visualEntries} current={0} onSelect={no} onClose={no}/>);assert(pageIndex.includes('Explorar páginas do álbum'));assert(pageIndex.includes('Buscar uma página'));assert.equal((pageIndex.match(/class="album-index-card /g)||[]).length,pages.length);assert(pageIndex.includes('VOCÊ ESTÁ AQUI'));
const manyPhotos=Array.from({length:80},(_,i)=>({id:'reel-'+i,url:'/reel-photo-'+i+'.webp',caption:'Memória '+i}));
const photoChapters=photoStoryGroups(80).map((indices:any)=>renderToStaticMarkup(<StoryPhotoReel photos={manyPhotos} indices={indices} cursor={0} pair="Nós" onChange={no} onGallery={no} onHold={no}/>)).join('');
for(const p of manyPhotos)assert(photoChapters.includes(p.url));assert(photoChapters.includes('Ver as 80 fotos'));assert(photoChapters.includes('Fotos deste capítulo'));assert(photoChapters.includes('Foto anterior neste capítulo'));
const fullLists={...gift,reasons:Array.from({length:20},(_,i)=>'Motivo completo '+i),dreams:Array.from({length:20},(_,i)=>'Sonho completo '+i),milestones:Array.from({length:12},(_,i)=>({title:'Marco completo '+i,date:'2024-01-01',description:'Uma história.'}))};
for(const [Component,field] of [[ReasonsStory,'reasons'],[DreamsStory,'dreams'],[JourneyStory,'milestones']] as const){const html=renderToStaticMarkup(<Component gift={fullLists}/>);for(const item of fullLists[field])assert(html.includes(typeof item==='string'?item:item.title));}
const revealed=renderToStaticMarkup(<CouponsStory gift={gift} revealed={[0]} onReveal={no}/>);assert(revealed.includes(gift.coupons[0]));assert(revealed.includes('aria-pressed="true"'));
const answered=renderToStaticMarkup(<QuizStory gift={gift} answers={{0:0}} onAnswer={no}/>);assert(answered.includes('disabled=""'));assert(answered.includes('lembrança'));
const openLetter=renderToStaticMarkup(<LettersStory gift={gift} opened={[0]} onToggle={no}/>);assert(openLetter.includes('open=""'));
console.log(JSON.stringify({actual_album_nodes:actualHost.children.length,react19_image_preload_regression:true,visual_page_index:true,all_eighty_story_photos:true,controlled_visit_state:true}));
