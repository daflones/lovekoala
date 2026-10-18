import {DEFAULT_GAMES} from './features.mjs';
import {PHOTO,elapsed} from './domain.mjs';
export const EDITOR_STEPS=['O presente','Os nomes','O começo','As fotos','O universo','A música','A mensagem','Os marcos','Os motivos','Os lugares','Os sonhos','As surpresas','A entrega'];
export const EDITOR_PROMPTS=[
 'Vamos fazer essa surpresa juntos? Escolha o formato e a ocasião. Eu organizo uma pergunta de cada vez.',
 'Primeiro, os protagonistas: qual é o seu nome e o de quem vai receber?',
 'Todo amor tem um começo. Em que dia e em que lugar a história de vocês começou?',
 'Agora quero ver as memórias! Envie suas fotos favoritas. A primeira será a capa; você pode mudar a ordem.',
 'Romântico, estrelado ou cheio de cor? Escolha o universo do presente. As artes e animações já estão prontas.',
 'Qual música é a cara de vocês? Diga o nome e, se quiser, cole o link. Também temos uma trilha instrumental.',
 'O que você quer dizer para essa pessoa? Escreva como se ela estivesse bem pertinho de você.',
 'Vamos marcar os capítulos importantes: primeiro encontro, viagem, mudança, pedido… Adicione os seus.',
 'Quais pequenos detalhes fazem você escolher essa pessoa todos os dias? Um motivo por linha.',
 'Quais lugares têm um pedacinho de vocês? Pode ser uma cidade, uma praia ou o sofá de casa.',
 'O que vocês já conquistaram e ainda querem viver? Separe as lembranças dos planos para o futuro.',
 'Vamos esconder alguns carinhos? Prepare cartas, vales e um pequeno quiz sobre vocês. Tudo é opcional.',
 'Prontinho. Confira os capítulos, veja a prévia e escolha como entregar essa surpresa.'
];
export const DETAIL_DEFAULTS={ai_descriptions:[],ai_style:'storybook',editor_version:2,start_time:'',album_music_enabled:true,place:'',first_memory:'',promise:'',dedication:'',milestones:[],places:[],dreams:[],achievements:[],quiz:[],section_selection:[],selected_games:DEFAULT_GAMES,decorations:['hearts','stars'],scratch_message:''};
export function completeGift(gift){return {...DETAIL_DEFAULTS,...gift,milestones:gift.milestones||[],places:gift.places||[],dreams:gift.dreams||[],achievements:gift.achievements||[],quiz:gift.quiz||[],selected_games:gift.selected_games??DEFAULT_GAMES,decorations:gift.decorations??['hearts','stars']};}
export function validateStep(step,gift){if(step===1&&(!gift.sender?.trim()||!gift.recipient?.trim()))return 'Me conta o nome de vocês dois.';if(step===2&&gift.start_date&&new Date(gift.start_date+'T12:00:00')>new Date())return 'O começo da história precisa ser hoje ou uma data anterior.';if(step===3&&!gift.photos?.length)return 'Escolha pelo menos uma foto para a história de vocês.';if(step===6&&!gift.letter?.trim())return 'Escreva uma mensagem para o seu amor.';if(step===12){if(!gift.sender?.trim()||!gift.recipient?.trim()||!gift.letter?.trim()||!gift.photos?.length)return 'Complete os nomes, a mensagem e pelo menos uma foto antes da entrega.';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gift.email||''))return 'Informe seu e-mail para o comprovante.';if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gift.slug||'')||gift.slug.length<4)return 'Escolha um endereço com pelo menos 4 letras, números ou traços.';}return '';}
export function chapterList(gift){const g=completeGift(gift),days=elapsed(g.start_date).days;const all=[
 {id:'song',title:'A nossa música',subtitle:g.music_title||'A trilha de nós dois',kind:'music',color:'#234b78',duration:20},
 {id:'about',title:'Sobre nós dois',subtitle:g.start_date?days.toLocaleString('pt-BR')+' dias de história':'O nosso pequeno infinito',kind:'about',color:'#68479f',duration:18},
 {id:'letter',title:'Tudo o que eu queria dizer',subtitle:'Uma mensagem de '+(g.sender||'você'),kind:'letter',color:'#9b3a80',duration:30},
 {id:'photos',title:'Nossas melhores memórias',subtitle:(g.photos?.length||0)+' fotos, infinitos sentimentos',kind:'photos',color:'#215d66',duration:8},
 {id:'start',title:'Quando a gente virou nós',subtitle:g.place||'O primeiro capítulo',kind:'story',color:'#905e3a',duration:22},
 {id:'timeline',title:'A nossa linha do tempo',subtitle:g.milestones.length+' momentos importantes',kind:'timeline',color:'#4855a4',duration:22,optional:!g.milestones.length},
 {id:'reasons',title:'Por todos esses motivos',subtitle:(g.reasons?.filter(Boolean).length||0)+' jeitos de te escolher',kind:'reasons',color:'#a2485f',duration:20,optional:!g.reasons?.filter(Boolean).length},
 {id:'places',title:'Lugares que têm a gente',subtitle:g.places.length+' destinos do coração',kind:'places',color:'#347677',duration:20,optional:!g.places.length},
 {id:'achievements',title:'Olha tudo o que vivemos',subtitle:'As conquistas do nosso time',kind:'achievements',color:'#867130',duration:20,optional:!g.achievements.length},
 {id:'dreams',title:'O que a gente ainda vai viver',subtitle:'Planos para o nosso futuro',kind:'dreams',color:'#61419b',duration:20,optional:!g.dreams.length},
 {id:'letters',title:'Abra quando precisar de mim',subtitle:(g.open_when?.length||0)+' cartas para guardar',kind:'letters',color:'#9c4d69',duration:22,optional:!g.open_when?.length},
 {id:'coupons',title:'Vale um momento a dois',subtitle:(g.coupons?.filter(Boolean).length||0)+' promessas para resgatar',kind:'coupons',color:'#4f6a48',duration:22,optional:!g.coupons?.filter(Boolean).length},
 {id:'quiz',title:'Quanto você sabe sobre nós?',subtitle:'Um quiz feito pelo seu amor',kind:'quiz',color:'#976034',duration:30,optional:!g.quiz.length},
 {id:'night',title:'Nosso universo particular',subtitle:'Um céu inteiro para o nosso amor',kind:'night',color:'#192b62',duration:18},
 {id:'stats',title:'O nosso amor em números',subtitle:'Cada dia conta uma história',kind:'stats',color:'#784e9d',duration:26,optional:!g.start_date},
 {id:'games',title:'Nosso cantinho de brincar',subtitle:(g.selected_games?.length||0)+' jogos para solo ou dupla',kind:'games',color:'#985c80',duration:35,optional:!g.selected_games?.length},
 {id:'ending',title:'O próximo capítulo é você',subtitle:'Essa história está só começando',kind:'ending',color:'#6c438e',duration:20}
 ];return all.filter(c=>!c.optional&&(!g.section_selection?.length||g.section_selection.includes(c.id)||['song','about','photos','ending'].includes(c.id)));}
export const DEMO_DETAILS={...DETAIL_DEFAULTS,place:'Teresópolis, RJ',first_memory:'O café esfriou, a conversa não. Foi ali que a gente descobriu que alguns encontros mudam o caminho inteiro.',promise:'Prometo continuar te escolhendo nos dias leves, nos dias difíceis e em todos os domingos que ainda vêm.',dedication:'Para Marina, que transformou encontros em lar.',milestones:[{title:'Aquele café que mudou tudo',date:'2022-06-12',description:'Nosso primeiro encontro, uma tarde chuvosa e uma conversa sem fim.'},{title:'A primeira viagem',date:'2023-01-14',description:'Uma mala pequena e planos gigantes.'},{title:'Um cantinho só nosso',date:'2024-08-10',description:'Dois jeitos de ser, um lugar para chamar de lar.'}],places:[{name:'Teresópolis',note:'O lugar onde a gente começou.'},{name:'A nossa praia',note:'O pôr do sol favorito é com você.'},{name:'Nosso sofá',note:'O melhor destino para um domingo.'}],dreams:['Ver a aurora boreal de mãos dadas','Ter uma casa com varanda e um cachorro','Continuar rindo das mesmas piadas daqui a 50 anos'],achievements:['Fizemos nossa primeira viagem juntos','Montamos um lar com a nossa cara','Aprendemos a ser o time um do outro'],quiz:[{question:'Onde foi o nosso primeiro encontro?',options:['Num café','Na praia','No cinema'],answer:0},{question:'Qual é o nosso programa de domingo?',options:['Uma trilha','Filme e abraço','Sair para dançar'],answer:1}]};
export function embeddedMusic(url){if(!url)return null;try{const u=new URL(url);if(u.protocol!=='https:')return null;if(u.hostname==='open.spotify.com'){const m=u.pathname.match(/^\/(?:intl-[a-z]+\/)?(track|album|playlist|episode)\/([a-zA-Z0-9]+)\/?$/);if(m)return {provider:'Spotify',src:'https://open.spotify.com/embed/'+m[1]+'/'+m[2],height:152};}let id='';if(u.hostname==='youtu.be')id=u.pathname.slice(1);if(['youtube.com','www.youtube.com','music.youtube.com'].includes(u.hostname))id=u.searchParams.get('v')||u.pathname.split('/').pop()||'';if(/^[a-zA-Z0-9_-]{11}$/.test(id))return {provider:'YouTube',src:'https://www.youtube.com/embed/'+id+'?playsinline=1&rel=0',height:230};return null;}catch{return null;}}
