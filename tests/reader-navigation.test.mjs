import test from 'node:test';
import assert from 'node:assert/strict';
import {photoStoryGroups,photoProgress,storyNeedsReading,albumCategory,filterAlbumIndex,toggleVisitItem} from '../src/reader-navigation.mjs';
import {keepsakeStories} from '../src/keepsake.mjs';
import {completeGift} from '../src/experience.mjs';
test('todos os limites de fotos entram em três replays ordenados, sem omissão ou repetição',()=>{
 for(let count=1;count<=80;count++){
  const groups=photoStoryGroups(count);assert.equal(groups.length,Math.min(3,count));assert.deepEqual(groups.flat(),Array.from({length:count},(_,i)=>i));assert(Math.max(...groups.map(g=>g.length))-Math.min(...groups.map(g=>g.length))<=1);
  const gift=completeGift({photos:Array.from({length:count},(_,i)=>({id:String(i),url:'/photo-'+i}))});
  const stories=keepsakeStories(gift).filter(story=>story.kind==='photo');assert.deepEqual(stories.flatMap(story=>story.photoIndices),Array.from({length:count},(_,i)=>i));
 }
 for(const value of [0,-1,NaN,1.5,undefined])assert.deepEqual(photoStoryGroups(value),[]);
});
test('progresso do replay só termina depois da última foto e fica nos limites',()=>{
 assert.equal(photoProgress(0,0,5),0);assert.equal(photoProgress(0,100,5),20);assert.equal(photoProgress(1,0,5),20);assert.equal(photoProgress(4,100,5),100);assert.equal(photoProgress(0,100,1),100);assert.equal(photoProgress(0,0,0),0);assert.equal(photoProgress(-1,-10,4),0);assert.equal(photoProgress(9,200,4),100);
});
test('listas grandes e textos longos têm leitura livre sem cortar o conteúdo',()=>{
 for(const [kind,field] of [['journey','milestones'],['reasons','reasons'],['dreams','dreams']]){
  assert.equal(storyNeedsReading(kind,{[field]:['Curto']}),false);assert.equal(storyNeedsReading(kind,{[field]:Array(6).fill('Memória')}),true);assert.equal(storyNeedsReading(kind,{[field]:['x'.repeat(451)]}),true);
 }
 assert.equal(storyNeedsReading('journey',{milestones:[{title:'Dia',description:'x'.repeat(450)}]}),true);assert.equal(storyNeedsReading('origin',{story:'x'.repeat(350),first_memory:'x'.repeat(120)}),true);assert.equal(storyNeedsReading('photo',{}),false);assert.equal(storyNeedsReading('letters',{}),true);
});
test('busca do índice combina palavras, acentos, números e categorias sem perder páginas',()=>{
 const pages=[{number:1,title:'A nossa história',subtitle:'O início',category:'story',section:'story'},{number:8,title:'Um café em Teresópolis',subtitle:'O primeiro encontro',category:'photos',section:'photos'},{number:12,title:'Nossa carta',subtitle:'Abra quando bater saudade',category:'letters',section:'letter'}];
 assert.deepEqual(filterAlbumIndex(pages,'teresopolis cafe'),[pages[1]]);assert.deepEqual(filterAlbumIndex(pages,'12'),[pages[2]]);assert.deepEqual(filterAlbumIndex(pages,'saudade','letters'),[pages[2]]);assert.equal(filterAlbumIndex(pages,'café','letters').length,0);assert.equal(filterAlbumIndex(pages,'','all').length,3);
 for(const kind of ['garden','puzzle','scratch','games','quiz'])assert.equal(albumCategory(kind),'surprises');for(const kind of ['memories','illustration','booth'])assert.equal(albumCategory(kind),'photos');assert.equal(albumCategory('keepsake-letter'),'letters');
});
test('estado de cartas e vales é idempotente e preserva os outros itens desta visita',()=>{
 const original=[1];assert.equal(toggleVisitItem(original,1,true),original);assert.equal(toggleVisitItem(original,2,false),original);assert.deepEqual(toggleVisitItem(original,2,true),[1,2]);assert.deepEqual(toggleVisitItem(original,1),[]);assert.deepEqual(original,[1]);
});
