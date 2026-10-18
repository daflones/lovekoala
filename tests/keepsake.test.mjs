import test from 'node:test';
import assert from 'node:assert/strict';
import {completeGift} from '../src/experience.mjs';
import {keepsakeFacts,dateChoices,keepsakeStories,puzzleTiles,swapTiles,puzzleSolved,photoStripBlob} from '../src/keepsake.mjs';
import {waterGarden,bindAlbumScenes} from '../src/keepsake-scenes.mjs';

test('calendário destaca o dia certo em ano bissexto e conta desde Brasília',()=>{
 const facts=keepsakeFacts({start_date:'2024-02-29',start_time:'23:59'},new Date('2024-03-01T03:01:00Z'));
 assert.equal(facts.day,29);assert.equal(facts.month,2);assert.equal(facts.weekday,'quinta-feira');assert.equal(facts.totalSeconds,120);assert.equal(facts.totalMinutes,2);
 assert.equal(facts.monthCells.filter(Boolean).length,29);assert.equal(facts.monthCells[3],1);assert.equal(facts.monthCells.at(-1),29);
 assert.equal(facts.unlocked,0);assert(facts.badges.every(b=>!b.unlocked));
 assert.equal(keepsakeFacts({start_date:'2030-01-01'},new Date('2029-01-01Z')),null);
 assert.equal(keepsakeFacts({start_date:'2024-02-31'}),null);
});
test('bilhetes do primeiro dia atravessam meses/anos mantendo uma única resposta correta',()=>{
 for(const date of ['2024-03-01','2025-01-01','2022-06-12']){
  const choices=dateChoices(date);assert.equal(choices.length,3);assert.equal(new Set(choices).size,3);assert.equal(choices.filter(c=>c===date).length,1);
  for(const iso of choices)assert.equal(new Date(iso+'T12:00:00Z').toISOString().slice(0,10),iso);
 }
 assert.deepEqual(dateChoices('2024-02-31'),[]);assert.deepEqual(dateChoices(''),[]);
});
test('edição omite conteúdo ausente e respeita capítulos selecionados; não inventa rankings',()=>{
 const gift=completeGift({sender:'A',recipient:'B',photos:[{url:'/photo'}],start_date:'2022-06-12',letter:'Nossa carta',reasons:['Um motivo'],dreams:['Nosso sonho'],section_selection:['photos','letter']});
 const stories=keepsakeStories(gift);assert(stories.some(s=>s.kind==='letter'));assert(stories.some(s=>s.kind==='calendar'));
 for(const excluded of ['reasons','dreams','badges','numbers','date-game'])assert(!stories.some(s=>s.kind===excluded));
 const empty=keepsakeStories(completeGift({photos:[]}));assert.deepEqual(empty.map(s=>s.kind),['opening','ending']);
 assert(!JSON.stringify(stories).includes('percentile'));assert.equal(new Set(stories.map(s=>s.id)).size,stories.length);
});
test('quebra-cabeça começa embaralhado, mantém nove peças únicas e resolve por trocas válidas',()=>{
 const tiles=puzzleTiles(()=>.99);assert.equal(tiles.length,9);assert.equal(new Set(tiles).size,9);assert(!puzzleSolved(tiles));
 let current=tiles;for(let target=0;target<9;target++)current=swapTiles(current,target,current.indexOf(target));
 assert(puzzleSolved(current));assert(!puzzleSolved(tiles));assert.notEqual(current,tiles);
 assert.equal(swapTiles(tiles,-1,0),tiles);assert.equal(swapTiles(tiles,0,9),tiles);assert(!puzzleSolved([]));
});
test('regar revela o jardim em três ações, sem avançar além do estado final',()=>{
 const label={textContent:''},button={disabled:false,querySelector:()=>label},message={textContent:''},count={textContent:''};
 const page={dataset:{gardenStep:'0'},querySelector:s=>({'[data-garden-message]':message,'[data-garden-count]':count,'[data-garden-water]':button})[s]};
 assert.equal(waterGarden(page),1);assert.equal(button.disabled,false);assert.equal(waterGarden(page),2);assert.equal(waterGarden(page),3);
 assert.equal(button.disabled,true);assert.equal(count.textContent,'3 / 3');assert(message.textContent.includes('cultivou'));assert.equal(waterGarden(page),3);
});
test('animações são ativadas só nas folhas visíveis e removem assinaturas ao fechar',()=>{
 const listeners=new Map(),active=new Set();let index=1,orientation='landscape';
 const book={getCurrentPageIndex:()=>index,getOrientation:()=>orientation,on:(n,fn)=>listeners.set(n,fn),off:n=>listeners.delete(n)};
 const pages=Array.from({length:5},(_,i)=>({classList:{toggle:(_,yes)=>yes?active.add(i):active.delete(i)}}));
 const cleanup=bindAlbumScenes(book,pages);assert.deepEqual([...active],[1,2]);orientation='portrait';listeners.get('changeOrientation')();assert.deepEqual([...active],[1]);index=3;listeners.get('flip')();assert.deepEqual([...active],[3]);cleanup();assert.equal(listeners.size,0);
});
test('tirinha exporta três recortes sem distorcer as fotos e trata restrições de exportação',async()=>{
 const oldImage=globalThis.Image,oldDocument=globalThis.document;const draws=[];let fail=false;
 class Picture{naturalWidth=2000;naturalHeight=1000;set src(url){queueMicrotask(()=>url.includes('broken')?this.onerror():this.onload());}}
 const context={fillRect(){},strokeRect(){},fillText(){},save(){},beginPath(){},rect(){},clip(){},restore(){},drawImage:(...args)=>draws.push(args)};
 const canvas={getContext:()=>context,toBlob:fn=>{if(fail)throw Error('tainted');fn(new Blob(['png'],{type:'image/png'}));}};
 globalThis.Image=Picture;globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');return canvas;}};
 try{
  const blob=await photoStripBlob([{url:'/photo'}],{sender:'A',recipient:'B'});assert.equal(blob.type,'image/png');assert.equal(draws.length,3);assert.equal(canvas.width,900);assert.equal(canvas.height,2200);
  for(const d of draws){assert(d[1]>0,'landscape crops symmetrically at the sides');assert.equal(d[2],0);assert.equal(d[4],1000);assert.equal(d[7],760);assert.equal(d[8],505);}
  fail=true;await assert.rejects(photoStripBlob([{url:'/photo'}],{}),/não permite exportação/);
  fail=false;await assert.rejects(photoStripBlob([{url:'/broken'}],{}),/uma das fotos/);
  await assert.rejects(photoStripBlob([],{}),/Adicione uma foto/);
 }finally{globalThis.Image=oldImage;globalThis.document=oldDocument;}
});
