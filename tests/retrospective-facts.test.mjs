import test from 'node:test';
import assert from 'node:assert/strict';
import {heartbeatEstimate,songReplays,fullWeekends,cohortUsable,cityCohortUsable,DEMO_COHORT,milestoneDate} from '../src/retrospective-facts.mjs';
import {keepsakeFacts,keepsakeStories} from '../src/keepsake.mjs';
import {completeGift} from '../src/experience.mjs';
test('batimentos contam dois corações a 72 bpm e continuam a partir do instante original',()=>{
 assert.equal(heartbeatEstimate(0),0);assert.equal(heartbeatEstimate(60),144);assert.equal(heartbeatEstimate(86400),207360);
 assert.equal(heartbeatEstimate(1498*86400),310625280);assert.equal(heartbeatEstimate(-5),0);
 const g={start_date:'2024-02-29',start_time:'23:59'};
 const a=keepsakeFacts(g,new Date('2024-03-01T03:00:00Z')),b=keepsakeFacts(g,new Date('2024-03-01T03:00:01Z'));
 assert.equal(heartbeatEstimate(b.totalSeconds)-heartbeatEstimate(a.totalSeconds),2);
});
test('equivalência musical usa duração medida sem simular reproduções reais',()=>{
 assert.equal(songReplays(86400,240),360);assert.equal(songReplays(86399,240),359);assert.equal(songReplays(0,32),0);
 for(const value of [0,-10,NaN,Infinity,undefined])assert.equal(songReplays(100,value),null);
 assert.equal(songReplays(-1,32),null);
});
test('fins de semana exigem sábado e domingo inteiros e respeitam Brasília',()=>{
 assert.equal(fullWeekends('2026-10-16','',new Date('2026-10-19T02:59:59Z')),0);
 assert.equal(fullWeekends('2026-10-16','',new Date('2026-10-19T03:00:00Z')),1);
 assert.equal(fullWeekends('2026-10-17','00:00',new Date('2026-10-19T03:00:00Z')),1);
 assert.equal(fullWeekends('2026-10-17','00:01',new Date('2026-10-19T03:00:00Z')),0);
 assert.equal(fullWeekends('2026-10-17','00:01',new Date('2026-10-26T03:00:00Z')),1);
 assert.equal(fullWeekends('2026-10-16','',new Date('2026-10-26T03:00:00Z')),2);
 assert.equal(fullWeekends('invalid','',new Date()),0);
});
test('marcos trazem datas reais, cruzam anos bissextos e mostram progresso até o próximo',()=>{
 assert.equal(milestoneDate('2024-02-29',1),'2024-03-01');assert.equal(milestoneDate('2023-12-31',100),'2024-04-09');
 const g={start_date:'2024-02-29',start_time:''};const facts=keepsakeFacts(g,new Date('2024-03-30T15:00:00Z'));
 assert.equal(facts.days,30);assert.equal(facts.badges.find(b=>b.days===30).date,'2024-03-30');assert.equal(facts.nextBadge.days,100);assert.equal(facts.nextBadge.remaining,70);assert(facts.nextBadge.progress>0&&facts.nextBadge.progress<100);
});
test('stories de comparação exigem vinte histórias tanto na comunidade quanto na cidade',()=>{
 const gift=completeGift({start_date:'2022-06-12',place:'Um café',relationship_city:'Teresópolis',relationship_state:'RJ',story:'Nosso primeiro encontro',photos:[],music_title:'Nossa canção'});
 const ordinary=keepsakeStories(gift);for(const id of ['heartbeats','origin','soundtrack','numbers'])assert(ordinary.some(s=>s.kind===id));
 for(const candidate of [null,{available:false},{available:true,participants:19,percentile:80}]){
  assert(!cohortUsable(candidate));assert(!keepsakeStories(gift,candidate).some(s=>['city','community'].includes(s.kind)));
 }
 assert(cohortUsable(DEMO_COHORT));assert(cityCohortUsable(DEMO_COHORT));const full=keepsakeStories(gift,DEMO_COHORT);assert(full.some(s=>s.kind==='community'));assert(full.some(s=>s.kind==='city'));assert.equal(new Set(full.map(s=>s.id)).size,full.length);
 const smallCity={...DEMO_COHORT,city:{available:true,participants:19,rank:3}};assert(!cityCohortUsable(smallCity));assert(!keepsakeStories(gift,smallCity).some(s=>s.kind==='city'));
 const restricted=keepsakeStories({...gift,section_selection:['photos']},DEMO_COHORT);for(const id of ['heartbeats','city','community','origin'])assert(!restricted.some(s=>s.kind===id));
});
