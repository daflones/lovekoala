import test from 'node:test';
import assert from 'node:assert/strict';
import {storyAstronomyFacts} from '../src/story-astronomy.mjs';
test('curiosidades astronômicas reproduzem lua cheia e inverno da data do vídeo',()=>{
 const facts=storyAstronomyFacts({start_date:'2022-09-11'},new Date('2026-10-18T14:00:00Z'));
 assert.equal(facts.phaseLabel,'Lua cheia');assert.equal(facts.season,'Inverno');assert.equal(facts.fullMoons,50);assert.equal(facts.illumination,99);assert.equal(facts.seasonChanges,17);
});
test('eclipse de abril/2024 é lua nova e próxima lua cheia entra só após seu instante',()=>{
 const gift={start_date:'2024-04-08',start_time:'15:21'};
 const before=storyAstronomyFacts(gift,new Date('2024-04-23T23:48:00Z')),after=storyAstronomyFacts(gift,new Date('2024-04-23T23:51:00Z'));
 assert.equal(before.phaseLabel,'Lua nova');assert(before.illumination<=1);assert.equal(before.fullMoons,0);assert.equal(after.fullMoons,1);assert.equal(after.season,'Outono');
});
test('estação muda no equinócio real, incluindo a virada de dia entre UTC e Brasília',()=>{
 assert.equal(storyAstronomyFacts({start_date:'2022-09-22',start_time:'22:03'},new Date('2022-09-23T02:00:00Z')).season,'Inverno');
 assert.equal(storyAstronomyFacts({start_date:'2022-09-22',start_time:'22:05'},new Date('2022-09-23T02:00:00Z')).season,'Primavera');
 for(const start_date of ['','invalid','2024-02-31','2030-01-01','1800-01-01'])assert.equal(storyAstronomyFacts({start_date},new Date('2026-10-18T14:00:00Z')),null);
});
