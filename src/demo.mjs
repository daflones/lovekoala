import {demoGift,PLANS} from './domain.mjs';
import {DEMO_DETAILS,completeGift} from './experience.mjs';
import {MUSIC_CATALOG} from './music.mjs';
export const DEMO_PHOTOS=[
 {id:'demo-sunset',url:'/assets/couple-demo.webp',caption:'Meu lugar favorito é com você.',date:'2022-06-12'},
 {id:'demo-cafe',url:'/assets/demo-cafe.png',caption:'O café esfriou. A conversa, nunca.',date:'2022-06-12'},
 {id:'demo-praia',url:'/assets/demo-praia.png',caption:'A nossa primeira viagem, o nosso mar.',date:'2023-01-14'},
 {id:'demo-casa',url:'/assets/demo-casa.png',caption:'A felicidade mora nos dias comuns.',date:'2024-08-10'},
 {id:'demo-serra',url:'/assets/demo-serra.png',caption:'Sempre tem um próximo caminho para nós.',date:'2025-06-12'}
];
export function buildDemoGift(planId='encanto',format='retrospectiva',livePlan={}){
 const plan={...(PLANS.find(p=>p.id===planId)||PLANS[1]),...livePlan};
 const song=MUSIC_CATALOG.find(t=>t.id==='2Vv-BfVoq4g');
 return completeGift({...demoGift,...DEMO_DETAILS,id:'demo-'+plan.id+'-'+format,format,plan_id:plan.id,theme:plan.id==='carinho'?'poesia':plan.id==='encanto'?'eucalipto':'estrelas',photos:DEMO_PHOTOS.slice(0,Math.min(plan.max_photos,DEMO_PHOTOS.length)),music_track:song,music_url:song.url,music_title:song.title});
}
