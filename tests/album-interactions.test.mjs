import test from 'node:test';
import assert from 'node:assert/strict';
import {bindAlbumGestures,bindAlbumMusic,musicPageVisible} from '../src/album-interactions.mjs';
import {bindScratchCard} from '../src/scratch-card.mjs';
class Surface extends EventTarget{captured=new Set();setPointerCapture(id){this.captured.add(id);}hasPointerCapture(id){return this.captured.has(id);}releasePointerCapture(id){this.captured.delete(id);}getBoundingClientRect(){return {left:0,top:0,width:480,height:260};}}
function pointer(target,type,x,y,{id=1,interactive=false,pointerType='touch'}={}){const e=new Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerId:id,button:0,isPrimary:true,pointerType});Object.defineProperty(e,'target',{value:{closest:()=>interactive?{}:null}});target.dispatchEvent(e);return e;}
test('raspar, botões e rolar texto não começam um gesto de virar folha; arrastar papel começa',()=>{
 const root=new Surface(),calls=[];const book={getUI:()=>({getDistElement:()=>root}),getState:()=> 'read',startUserTouch:p=>calls.push(['start',p]),userMove:p=>calls.push(['move',p]),userStop:p=>calls.push(['stop',p])};const clean=bindAlbumGestures(root,book);
 for(const pointerType of ['touch','mouse','pen']){pointer(root,'pointerdown',400,150,{interactive:true,pointerType});pointer(root,'pointermove',200,150,{pointerType});pointer(root,'pointerup',200,150,{pointerType});}assert.equal(calls.length,0);
 pointer(root,'pointerdown',400,100);pointer(root,'pointermove',401,150);pointer(root,'pointerup',401,150);assert.equal(calls.length,0,'vertical scroll stays native');
 pointer(root,'pointerdown',400,100);pointer(root,'pointermove',350,101);pointer(root,'pointermove',180,102);pointer(root,'pointerup',180,102);assert.deepEqual(calls.map(x=>x[0]),['start','move','move','stop']);assert.equal(root.captured.size,0);
 clean();pointer(root,'pointerdown',400,100);pointer(root,'pointermove',200,100);assert.equal(calls.length,4,'no listener survives disposal');
});
test('música entra com a página visível à esquerda, à direita ou sozinha, sem repetir ao redimensionar',()=>{
 const pages=Array.from({length:10},(_,i)=>({dataset:{section:i===6?'music':''}}));assert.equal(musicPageVisible(pages,5,'landscape'),true);assert.equal(musicPageVisible(pages,5,'portrait'),false);assert.equal(musicPageVisible(pages,6,'portrait'),true);assert.equal(musicPageVisible(pages,0,'landscape'),false);
 let page=0,orientation='landscape',starts=0;const events=new Map();const book={getCurrentPageIndex:()=>page,getOrientation:()=>orientation,on:(name,fn)=>events.set(name,fn),off:name=>events.delete(name)};const clean=bindAlbumMusic(book,pages,()=>starts++);
 page=5;events.get('flip')();assert.equal(starts,1);events.get('init')();events.get('changeOrientation')();assert.equal(starts,1);
 orientation='portrait';events.get('changeOrientation')();page=6;events.get('flip')();assert.equal(starts,2);
 page=7;events.get('flip')();page=6;events.get('flip')();assert.equal(starts,3);clean();assert.equal(events.size,0);
});
test('raspagem mantém traço contínuo, captura o ponteiro, revela a surpresa e oferece alternativa por botão',()=>{
 const canvas=new Surface(),button=new Surface(),marks=new Set(),paths=[];let clear=false;
 const ctx={createLinearGradient:()=>({addColorStop(){}}),fillRect(){},fillText(){},beginPath(){},moveTo:(x,y)=>paths.push(['from',x,y]),lineTo:(x,y)=>paths.push(['to',x,y]),stroke(){},arc(){},fill(){},getImageData:()=>({data:new Uint8ClampedArray(480*260*4).fill(clear?0:255)})};
 canvas.getContext=()=>ctx;canvas.closest=()=>({classList:{add:value=>marks.add(value)},querySelector:()=>button});const clean=bindScratchCard(canvas);
 const down=pointer(canvas,'pointerdown',30,40);assert.equal(down.defaultPrevented,true);pointer(canvas,'pointermove',280,100);assert.deepEqual(paths.slice(-2),[['from',30,40],['to',280,100]],'fast strokes do not leave gaps');
 pointer(canvas,'pointerup',280,100);assert.equal(canvas.captured.size,0);assert.equal(marks.size,0);
 clear=true;pointer(canvas,'pointerdown',40,50);pointer(canvas,'pointermove',380,150);pointer(canvas,'pointerup',380,150);assert(marks.has('scratch-revealed'));
 clean();const count=paths.length;pointer(canvas,'pointerdown',50,50);pointer(canvas,'pointermove',150,50);assert.equal(paths.length,count);
 const second=new Surface();second.getContext=()=>ctx;const secondMarks=new Set(),revealButton=new Surface();second.closest=()=>({classList:{add:value=>secondMarks.add(value)},querySelector:()=>revealButton});const cleanup=bindScratchCard(second);revealButton.dispatchEvent(new Event('click'));assert(secondMarks.has('scratch-revealed'));cleanup();
});
