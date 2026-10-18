import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

// The real Edge handler with isolated Google/Vault doubles. No key or quota is used.
test('busca pública funciona sem chave, filtra anúncios e mantém paginação opcional sem expor credenciais',async()=>{
 const previousDeno=globalThis.Deno,previousFetch=globalThis.fetch;
 const origin='https://lovekoala.test',root='https://database.test';
 let handler,key='',failProvider=false,publicBlocked=false,publicRequests=0;const providerRequests=[];
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 globalThis.Deno={env:{get:n=>({SUPABASE_URL:root,SUPABASE_SERVICE_ROLE_KEY:'server-fixture',SITE_URL:origin}[n])},serve:fn=>{handler=fn;}};
 globalThis.fetch=async(target)=>{
  const u=new URL(target);
  if(u.origin===root&&u.pathname==='/rest/v1/rpc/lk_allow')return json(true);
  if(u.origin===root&&u.pathname==='/rest/v1/rpc/lk_music_key')return json(key);
  if(u.origin==='https://www.youtube.com'&&u.pathname==='/results'){
   publicRequests++;if(publicBlocked)return new Response('<html><body>Search unavailable</body></html>');const data={contents:{twoColumnSearchResultsRenderer:{primaryContents:{sectionListRenderer:{contents:[{itemSectionRenderer:{contents:[{videoRenderer:{videoId:'public00001',title:{runs:[{text:'Outra música do YouTube'}]},ownerText:{runs:[{text:'Outro artista'}]}}},{videoRenderer:{videoId:'public00001',title:{runs:[{text:'Duplicado'}]}}},{adSlotRenderer:{videoRenderer:{videoId:'advert00001',title:{runs:[{text:'Anúncio'}]}}}},{videoRenderer:{videoId:'invalid',title:{runs:[{text:'Invalid'}]}}}]}}]}}}}};
   return new Response('<script>var ytInitialData = '+JSON.stringify(data)+';</script>',{headers:{'Content-Type':'text/html'}});
  }
  if(u.origin==='https://www.googleapis.com'&&u.pathname==='/youtube/v3/search'){
   providerRequests.push(u);if(failProvider)return json({error:{message:'Do not expose private provider details'}},403);
   const next=u.searchParams.has('pageToken');return json({items:[{id:{videoId:next?'newSong0002':'newSong0001'},snippet:{title:next?'Outro resultado':'Música fora da seleção',channelTitle:'Artista'}},{id:{videoId:'invalid'},snippet:{title:'Invalid',channelTitle:'Unknown'}}],...(next?{}:{nextPageToken:'CURSOR_2'})});
  }
  throw Error('Unexpected music contract request: '+u.origin+u.pathname);
 };
 const call=async(body)=>{const r=await handler(new Request(origin+'/functions/v1/lovekoala-api',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'music_search',...body})}));return {status:r.status,body:await r.json()};};
 try{
  const ts=await readFile(new URL('../supabase/functions/lovekoala-api/index.ts',import.meta.url),'utf8');const {code}=await transform(ts,{loader:'ts',format:'esm',target:'es2022'});await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const suggestions=await call({query:''});assert.equal(suggestions.status,200);assert.equal(suggestions.body.search_mode,'selection');assert.equal(suggestions.body.tracks.length,8);assert.equal(providerRequests.length,0);assert.equal(publicRequests,0);
  const publicResult=await call({query:'Ed Sheeran'});assert.equal(publicResult.status,200,publicResult.body.message);assert.equal(publicResult.body.search_mode,'youtube');assert.equal(publicResult.body.search_source,'public');assert.equal(publicResult.body.search_available,true);assert.equal(publicResult.body.tracks.length,1);assert.equal(publicResult.body.tracks[0].id,'public00001');assert.equal(publicResult.body.next_page_token,null);assert.equal(providerRequests.length,0);assert.equal(publicRequests,1);
  assert.equal((await call({query:'Ed Sheeran'})).body.tracks[0].id,'public00001');assert.equal(publicRequests,1);
  publicBlocked=true;const blocked=await call({query:'Another public query'});assert.equal(blocked.status,503);assert.equal(blocked.body.code,'MUSIC_SEARCH');assert.equal(publicRequests,2);
  key='AIza'+'x'.repeat(35);const full=await call({query:'Ed Sheeran'});assert.equal(full.status,200);assert.equal(full.body.search_mode,'youtube');assert.equal(full.body.search_available,true);assert.equal(full.body.tracks.length,1);assert.equal(full.body.tracks[0].id,'newSong0001');assert.equal(full.body.next_page_token,'CURSOR_2');assert(!JSON.stringify(full.body).includes(key));
  const request=providerRequests[0];assert.equal(request.searchParams.get('maxResults'),'25');assert.equal(request.searchParams.get('videoEmbeddable'),'true');assert.equal(request.searchParams.get('type'),'video');assert.equal(request.searchParams.get('videoCategoryId'),null);
  const next=await call({query:'Ed Sheeran',page_token:full.body.next_page_token});assert.equal(next.status,200);assert.equal(next.body.tracks[0].id,'newSong0002');assert.equal(next.body.next_page_token,null);assert.equal(providerRequests[1].searchParams.get('pageToken'),'CURSOR_2');
  assert.equal((await call({query:'Ed Sheeran',page_token:'https://evil.invalid/cursor'})).status,400);assert.equal(providerRequests.length,2);
  failProvider=true;const failure=await call({query:'Ed Sheeran'});assert.equal(failure.status,503);assert.equal(failure.body.code,'MUSIC_SEARCH');assert(!JSON.stringify(failure.body).includes(key));assert(!JSON.stringify(failure.body).includes('private provider'));
 }finally{globalThis.Deno=previousDeno;globalThis.fetch=previousFetch;}
});
