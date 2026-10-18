import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {bindReaderDialog} from '../src/reader-dialog.mjs';
import {canAdvancePlaylist,playlistReadingMode,photoSwipeDirection} from '../src/reader-navigation.mjs';

function page(){
 const {document:doc,window}=parseHTML('<html><head></head><body><button id="launch">Abrir</button><section id="parent" data-reader-dialog><button id="first">Primeiro</button><button hidden id="hidden">Oculto</button><button disabled tabindex="0" id="disabled">Indisponível</button><button id="last">Último</button></section><section id="child" data-reader-dialog><button id="child-first">Fechar foto</button><button id="child-last">Ampliar</button></section></body></html>');
 Object.defineProperty(doc,'activeElement',{value:doc.getElementById('launch'),writable:true,configurable:true});doc.body.style.overflow='auto';
 for(const element of doc.querySelectorAll('*'))element.focus=()=>{doc.activeElement=element;element.dispatchEvent(new window.Event('focusin',{bubbles:true}));};
 const key=(value,shiftKey=false)=>{const event=new window.Event('keydown',{bubbles:true,cancelable:true});Object.assign(event,{key:value,shiftKey});doc.dispatchEvent(event);return event;};
 return {doc,key,parent:doc.getElementById('parent'),child:doc.getElementById('child')};
}

test('playlist só avança na cena visível, sem atropelar leitura, interação, outra aba ou diálogo',()=>{
 const active={playing:true,scene:true};assert.equal(canAdvancePlaylist(active),true);
 for(const change of [{playing:false},{scene:false},{reading:true},{hidden:true},{holding:true},{overlay:true}])assert.equal(canAdvancePlaylist({...active,...change}),false);
 assert.equal(canAdvancePlaylist({...active,hidden:true,reading:true}),false);
 assert.equal(canAdvancePlaylist({...active,hidden:false,reading:false}),true);
});
test('capítulos da playlist traduzem os campos de leitura e deixam quiz/cartas/estatísticas sem prazo',()=>{
 for(const kind of ['letter','letters','quiz','games','coupons','places','achievements','stats'])assert.equal(playlistReadingMode(kind,{}),true);
 assert.equal(playlistReadingMode('photos',{}),false);
 assert.equal(playlistReadingMode('timeline',{milestones:Array(6).fill({title:'Um dia'})}),true);
 assert.equal(playlistReadingMode('story',{story:'x'.repeat(451)}),true);
 assert.equal(playlistReadingMode('story',{story:'Um encontro'}),false);
});
test('gesto horizontal muda a foto, rolagem vertical/diagonal, gesto curto e zoom preservam a imagem',()=>{
 const from={x:200,y:100};assert.equal(photoSwipeDirection(from,{x:80,y:112}),1);assert.equal(photoSwipeDirection(from,{x:290,y:100}),-1);
 for(const to of [{x:130,y:230},{x:170,y:100},{x:120,y:180},{x:NaN,y:100}])assert.equal(photoSwipeDirection(from,to),0);
 assert.equal(photoSwipeDirection(from,{x:80,y:112},true),0);assert.equal(photoSwipeDirection(null,{x:0,y:0}),0);
});
test('Escape fecha somente o leitor do topo e restaura o foco e a rolagem na ordem correta',()=>{
 const {doc,key,parent,child}=page();let parentClosed=0,childClosed=0;
 const disposeParent=bindReaderDialog(()=>parentClosed++,{doc,dialog:parent});assert.equal(doc.activeElement.id,'first');assert.equal(doc.body.style.overflow,'hidden');
 const disposeChild=bindReaderDialog(()=>{childClosed++;disposeChild();},{doc,dialog:child});assert.equal(doc.activeElement.id,'child-first');
 assert.equal(key('Escape').defaultPrevented,true);assert.equal(childClosed,1);assert.equal(parentClosed,0);assert.equal(doc.activeElement.id,'first');assert.equal(doc.body.style.overflow,'hidden');
 key('Escape');assert.equal(parentClosed,1);disposeParent();assert.equal(doc.activeElement.id,'launch');assert.equal(doc.body.style.overflow,'auto');
});
test('retirar o leitor de baixo antes do de cima não libera a rolagem nem perde o controle de Escape',()=>{
 const {doc,key,parent,child}=page();let escaped=0;
 const disposeParent=bindReaderDialog(()=>assert.fail('Leitor removido não recebe Escape'),{doc,dialog:parent});
 const disposeChild=bindReaderDialog(()=>escaped++,{doc,dialog:child});parent.remove();disposeParent();assert.equal(doc.body.style.overflow,'hidden');
 key('Escape');assert.equal(escaped,1);disposeChild();disposeChild();assert.equal(doc.body.style.overflow,'auto');
});
test('Tab mantém o foco no leitor atual, ignora controles ocultos/desativados e acompanha mudanças do formulário',()=>{
 const {doc,key,parent}=page();const dispose=bindReaderDialog(()=>{},{doc,dialog:parent});
 key('Tab',true);assert.equal(doc.activeElement.id,'last');key('Tab');assert.equal(doc.activeElement.id,'first');
 doc.getElementById('last').setAttribute('disabled','');key('Tab',true);assert.equal(doc.activeElement.id,'first');
 doc.getElementById('launch').focus();assert.equal(doc.activeElement.id,'first');
 dispose();assert.equal(doc.activeElement.id,'launch');
});
test('leitor sem controles recebe foco e permite fechamento; ausência de diálogo não bloqueia a página',()=>{
 const {doc,key,parent}=page();parent.replaceChildren();let close=0;
 const dispose=bindReaderDialog(()=>close++,{doc,dialog:parent});assert.equal(doc.activeElement,parent);assert.equal(parent.getAttribute('tabindex'),'-1');assert(key('Tab').defaultPrevented);
 key('Escape');assert.equal(close,1);dispose();assert.equal(doc.body.style.overflow,'auto');
 for(const node of doc.querySelectorAll('[data-reader-dialog]'))node.remove();bindReaderDialog(()=>{},{doc})();assert.equal(doc.body.style.overflow,'auto');
});
