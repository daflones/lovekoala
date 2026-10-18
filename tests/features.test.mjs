import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDay,monthDays,localToday} from '../src/calendar.mjs';
import {DEFAULT_GAMES,planFeatures,relationshipStats,shuffledPairs,dropHeart,fourWinner,coalaMove} from '../src/features.mjs';
import {PLANS} from '../src/domain.mjs';
import {completeGift,chapterList} from '../src/experience.mjs';
import {buildDemoGift,DEMO_PHOTOS} from '../src/demo.mjs';

test('calendário rejeita datas que virariam outro mês e inclui o ano bissexto',()=>{
 assert.equal(parseDay('2026-02-29'),null);assert.equal(parseDay('2026-04-31'),null);assert.equal(parseDay('2026-13-01'),null);assert.equal(parseDay('2026-2-01'),null);
 assert.equal(localToday(parseDay('2024-02-29')),'2024-02-29');
 const days=monthDays(2024,1);assert.equal(days.filter(Boolean).length,29);assert.equal(days.length%7,0);assert.equal(days[0],null);assert(days.includes('2024-02-29'));
 assert.equal(localToday(new Date(2026,9,16,0,1)),'2026-10-16');
});
test('tempo juntos usa dias de calendário, meses completos e aniversário em ano bissexto',()=>{
 const now=new Date(2026,9,16,1);const stats=relationshipStats('2022-06-12',now);
 assert.equal(stats.days,1587);assert.equal(stats.months,52);assert.equal(stats.hours,stats.days*24);assert.equal(stats.minutes,stats.days*1440);assert.equal(stats.nextAnniversary,239);
 assert.equal(relationshipStats('2026-10-17',now),null);assert.equal(relationshipStats('2026-02-30',now),null);
 assert.equal(relationshipStats('2024-02-29',new Date(2025,1,27,12)).nextAnniversary,1);
 const anniversary=relationshipStats('2022-06-12',new Date(2026,5,12,12));assert.equal(anniversary.days,1461);assert.equal(anniversary.nextAnniversary,365);
});
test('cartões de planos e os seis exemplos respeitam limites e formatos reais',()=>{
 assert.equal(new Set(DEMO_PHOTOS.map(p=>p.url)).size,5);
 for(const plan of PLANS)for(const format of ['album','retrospectiva']){
  const demo=buildDemoGift(plan.id,format);const features=planFeatures(plan,format);
  assert.equal(demo.plan_id,plan.id);assert.equal(demo.format,format);assert(demo.photos.length<=plan.max_photos);assert.equal(new Set(demo.photos.map(p=>p.url)).size,demo.photos.length);
  assert(features.some(f=>f.includes(String(plan.max_photos))));assert(features.some(f=>f.includes('3 minijogos')));assert.equal(features.some(f=>f.includes('no mesmo presente')),plan.formats.includes('ambos'));
  assert.equal(demo.music_track.provider,'youtube');assert.equal(demo.music_track.id,'2Vv-BfVoq4g');assert.equal(chapterList(demo).length,17);assert.deepEqual(demo.selected_games,DEFAULT_GAMES);
 }
 const without=completeGift({...buildDemoGift(),selected_games:[],section_selection:[]});assert(!chapterList(without).some(c=>c.kind==='games'));assert.deepEqual(without.selected_games,[]);
});
test('memória gera seis pares identificáveis sem repetir uma mesma foto em pares diferentes',()=>{
 const cards=shuffledPairs(DEMO_PHOTOS,()=>.3);assert.equal(cards.length,12);assert.equal(new Set(cards.map(c=>c.id)).size,12);
 for(let pair=0;pair<6;pair++){const same=cards.filter(c=>c.pair===pair);assert.equal(same.length,2);assert.equal(same[0].url,same[1].url);}
 assert.equal(cards.filter(c=>c.url).length,10);assert.equal(new Set(cards.filter(c=>c.url).map(c=>c.url)).size,5);
});
test('quatro corações respeita gravidade, colunas cheias e vitória em todas as direções',()=>{
 const empty=Array(42).fill(0);const b=dropHeart(empty,3,1);assert.equal(b[38],1);assert.equal(empty[38],0);assert.equal(dropHeart(empty,-1,1),null);
 let full=empty;for(let i=0;i<6;i++)full=dropHeart(full,0,i%2+1);assert.equal(dropHeart(full,0,1),null);
 for(const cells of [[35,36,37,38],[3,10,17,24],[7,15,23,31],[13,19,25,31]]){const board=Array(42).fill(0);for(const cell of cells)board[cell]=2;assert.equal(fourWinner(board),2);}
 assert.equal(fourWinner(empty),null);const wrap=Array(42).fill(0);for(const cell of [5,6,7,8])wrap[cell]=1;assert.equal(fourWinner(wrap),null);
});
test('Coala no jogo vence quando pode e bloqueia vitória imediata do jogador',()=>{
 const attack=Array(42).fill(0);attack[35]=attack[36]=attack[37]=2;assert.equal(coalaMove(attack),3);
 const defense=Array(42).fill(0);defense[35]=defense[36]=defense[37]=1;assert.equal(coalaMove(defense),3);assert.equal(coalaMove(Array(42).fill(1)),null);
});
