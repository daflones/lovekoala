import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {COALA_INITIAL,answerCoala,coalaOptions} from '../src/coala.mjs';
import {MUSIC_CATALOG,filterMusic,parseMusicUrl,trackFromGift,musicPatch} from '../src/music.mjs';
test('Coala mantém o contexto para uma resposta genérica e troca os botões a cada escolha',()=>{
 let state=answerCoala(COALA_INITIAL,'vai ser um presente').state;
 assert.equal(state.stage,'format');assert(coalaOptions(state).includes('Quero os dois'));
 state=answerCoala(state,'quero álbum e retrospectiva').state;
 assert.equal(state.format,'ambos');assert.equal(state.stage,'occasion');assert(coalaOptions(state).includes('Pedido especial'));
 state=answerCoala(state,'aniversário de namoro').state;assert.equal(state.stage,'photos');
 const result=answerCoala(state,'umas 40 fotos');state=result.state;
 assert.equal(state.stage,'ready');assert.equal(state.photos,40);assert(result.response.includes('Para sempre'));
 state=answerCoala(state,'Mudar o formato').state;assert.equal(state.stage,'format');
 state=answerCoala(state,'Retrospectiva com música').state;assert.equal(state.format,'retrospectiva');assert.equal(state.occasion,'Aniversário de namoro');
});
test('ajuda do Coala permite uma escolha e limita a quantidade ao que o sistema suporta',()=>{
 let state=answerCoala(COALA_INITIAL,'me ajuda a escolher').state;assert.equal(state.stage,'compare');
 state=answerCoala(state,'Gosto de cartas e detalhes').state;assert.equal(state.format,'album');
 state=answerCoala(state,'Nossas viagens').state;
 state=answerCoala(state,'Até 500 fotos').state;assert.equal(state.photos,80);
});
test('busca da seleção considera artista, palavras e acentos',()=>{
 assert.equal(MUSIC_CATALOG.length,8);assert.equal(filterMusic(MUSIC_CATALOG,'ed sheeran perfect').length,1);
 assert(filterMusic(MUSIC_CATALOG,'','original').every(t=>t.provider==='original'));
 assert.equal(filterMusic(MUSIC_CATALOG,'uma música que não está aqui').length,0);
});
test('música persistida usa apenas provedores e identificadores válidos',()=>{
 const track=MUSIC_CATALOG.find(t=>t.provider==='youtube');const patch=musicPatch(track);
 assert.equal(trackFromGift(patch).id,track.id);
 assert.equal(parseMusicUrl('https://music.youtube.com/watch?v='+track.id).id,track.id);
 assert.equal(parseMusicUrl('https://youtu.be/short'),null);
 assert.equal(parseMusicUrl('https://youtube.com.evil.test/watch?v='+track.id),null);
 assert.equal(parseMusicUrl('javascript:alert(1)'),null);
 assert.equal(parseMusicUrl('http://youtu.be/'+track.id),null);
 assert.equal(trackFromGift({music_track:{provider:'original',id:'https://evil.test/a.mp3'}}).id,'koala-theme');
});
test('páginas da biblioteca mantêm o posicionamento absoluto durante o arraste',async()=>{
 const css=await readFile(new URL('../src/redesign.css',import.meta.url),'utf8');
 assert.match(css,/\.album-v2 \.book-host \.album-page\.stf__item\s*\{[^}]*position:\s*absolute/);
 const rules=[...css.matchAll(/\.album-v2 \.album-page\s*\{([^}]+)\}/g)];
 assert(rules.every(m=>!m[1].includes('position:relative')));
});
