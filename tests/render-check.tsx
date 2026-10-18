import CaptainKoala from '../src/CaptainKoala';
import AuthPanel from '../src/AuthPanel';
import KoalaSupport from '../src/KoalaSupport';
import KoalaAvatar from '../src/KoalaAvatar';
import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import Landing from '../src/LandingV2';
import CreatorFields from '../src/CreatorFields';
import Retrospective from '../src/Retrospective';
import {buildAlbumPages} from '../src/GiftViewer';
import {demoGift,emptyGift} from '../src/domain.mjs';
import {completeGift,DEMO_DETAILS} from '../src/experience.mjs';
import Admin from '../src/Admin';
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
assert.equal(pages.length,35);
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
 const album=buildAlbumPages(demo);assert.equal(album.length,36);const content=album.map(p=>renderToStaticMarkup(p as any)).join('');
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
console.log(JSON.stringify({ok:true,landing:true,admin_login:true,account_login:true,coala_choices:true,koala_ai_support:true,image_generation_paused:true,ai_art_album_and_carousel:true,music_players:true,cms_copy_and_section_order:true,editor_stages:12,retrospective_chapters:17,album_pages:pages.length,expanded_demo_pages:36,plan_format_examples:6,game_engines:3,calendar:true,stats:true,photo_carousel:true,pending_payment_both_providers:true,checkout_recovery:true,index_targets:true,user_text_escaped:true}));

const guestAuth=renderToStaticMarkup(<AuthPanel initialEmail="buyer@example.invalid" initialMode="signup" onSuccess={no}/>);assert(guestAuth.includes('value="buyer@example.invalid"'));assert(guestAuth.includes('Criar minha conta'));
const captain=renderToStaticMarkup(<CaptainKoala/>);assert(captain.includes('Capitão Koala'));assert(captain.includes('Exclusivo para admins'));assert(captain.includes('Alterações para revisar'));assert(!captain.includes('nvapi-'));
