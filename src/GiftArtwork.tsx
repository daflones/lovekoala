import type {ReactNode} from 'react';

// Shared vector artwork: identical on every device, with no emoji font fallback.
const ink='#795875',rose='#cc8ca8',blush='#edc9d7',cream='#fff7ec',gold='#c6a065',sage='#9cb7a9',lavender='#b8a0d3';
const heart='M16 28S3 20 3 11a7 7 0 0 1 13-4 7 7 0 0 1 13 4c0 9-13 17-13 17Z';
function LoveMark({x,y,scale=1,fill=rose}:{x:number;y:number;scale?:number;fill?:string}){return <path d={heart} transform={`translate(${x} ${y}) scale(${scale})`} fill={fill} stroke="none"/>;}
function Glint({x,y,size=4}:{x:number;y:number;size?:number}){return <path d={`M${x} ${y-size}Q${x} ${y} ${x+size} ${y}Q${x} ${y} ${x} ${y+size}Q${x} ${y} ${x-size} ${y}Q${x} ${y} ${x} ${y-size}Z`} fill={gold} stroke="none"/>;}
function Art({children,name,className='',viewBox='0 0 96 80'}:{children:ReactNode;name:string;className?:string;viewBox?:string}){return <svg className={'gift-artwork '+className} data-artwork={name} viewBox={viewBox} fill="none" stroke={ink} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;}

export const OCCASIONS=[
 {id:'anniversary',label:'Aniversário de namoro'},
 {id:'birthday',label:'Aniversário do meu amor'},
 {id:'love',label:'Só porque é amor'},
 {id:'proposal',label:'Pedido especial'},
 {id:'travel',label:'Nossas viagens'},
 {id:'wedding',label:'Casamento'}
];
export function OccasionArtwork({kind}:{kind:string}){
 const scenes:Record<string,ReactNode>={
  anniversary:<><path d="M22 51h52v11q-26 12-52 0Z" fill={blush}/><ellipse cx="48" cy="51" rx="26" ry="8" fill={cream}/><path d="M22 51v8q4 6 8 0t8 0t8 0t8 0t8 0t8 0l4-3" stroke={rose}/><path d="M17 68h62" stroke={gold} strokeWidth="3"/><path d="M34 46V30m14 15V26m14 20V30" stroke={lavender} strokeWidth="4"/><path d="m32 24 2-5 2 5q0 4-2 4t-2-4Zm14-4 2-5 2 5q0 4-2 4t-2-4Zm14 4 2-5 2 5q0 4-2 4t-2-4Z" fill={gold} stroke="none"/><LoveMark x={43} y={51} scale={.31}/><Glint x={77} y={29}/><circle cx="19" cy="36" r="2" fill={sage} stroke="none"/></>,
  birthday:<><rect x="24" y="37" width="48" height="29" rx="4" fill={blush}/><path d="M24 48h48" stroke={rose}/><rect x="21" y="30" width="54" height="12" rx="4" fill={cream}/><path d="M43 31h10v35H43Z" fill={lavender} stroke="none"/><path d="M48 30c-27 0-23-20-11-14 6 3 11 14 11 14Zm0 0c27 0 23-20 11-14-6 3-11 14-11 14Z" fill="#d7c5e9" stroke={ink}/><path d="m48 30-9 14m9-14 10 13"/><rect x="59" y="44" width="14" height="18" rx="3" fill={cream} transform="rotate(12 59 44)"/><LoveMark x={61} y={47} scale={.3}/><Glint x={16} y={24}/><Glint x={80} y={50} size={3}/></>,
  love:<><g transform="rotate(-10 48 40)"><rect x="25" y="18" width="45" height="47" rx="5" fill={cream}/><path d="M34 28h24m-24 6h16" stroke="#c8b4d7"/><LoveMark x={40} y={36} scale={.68}/></g><path d="M19 40h59v25a5 5 0 0 1-5 5H24a5 5 0 0 1-5-5Z" fill={sage}/><path d="m19 41 29 20 30-20M19 67l20-15m39 15L58 52" stroke="#6f9587"/><circle cx="48" cy="56" r="9" fill={blush} stroke={rose}/><LoveMark x={43} y={51} scale={.32}/><Glint x={77} y={19}/><LoveMark x={12} y={22} scale={.28} fill={lavender}/></>,
  proposal:<><path d="M26 41V20q0-5 5-5h34q5 0 5 5v21Z" fill={sage}/><path d="M31 38V23q0-3 3-3h28q3 0 3 3v15" stroke="#f7faf5"/><path d="m23 43 6-7h38l7 7v21H23Z" fill="#d8cae7"/><path d="M23 45h51v19a4 4 0 0 1-4 4H27a4 4 0 0 1-4-4Z" fill={lavender}/><ellipse cx="48" cy="42" rx="12" ry="14" stroke={gold} strokeWidth="3"/><path d="m40 27 4-6h8l4 6-8 9Z" fill={cream} stroke={gold}/><path d="m44 21 4 15 4-15m-12 6h16" stroke={gold}/><path d="M44 56h8" stroke={gold} strokeWidth="3"/><Glint x={77} y={25}/><Glint x={17} y={43} size={3}/></>,
  travel:<><path d="m15 62 18-22 10 13 11-17 24 26Z" fill="#dae4dc" stroke="none"/><rect x="22" y="32" width="34" height="35" rx="6" fill={blush}/><path d="M32 32v-8h14v8m-18 6v23m22-23v23" stroke={ink}/><path d="M30 68v3m18-3v3" strokeWidth="3"/><rect x="34" y="42" width="20" height="25" rx="3" fill={cream} transform="rotate(-10 34 42)"/><LoveMark x={39} y={47} scale={.3} fill={sage}/><path d="m52 24 12 4 13-13 4 2-9 16 5 5-2 3-9-4-6 7-3-2 4-10-11-5Z" fill="#e4d9ef"/><path d="M68 49q12 0 13-6" stroke={gold} strokeDasharray="2 4"/><Glint x={18} y={17} size={3}/></>,
  wedding:<><g transform="rotate(-15 34 40)"><path d="M26 20h17v23a8.5 8.5 0 0 1-17 0Z" fill={cream}/><path d="M27 33h15v10a7.5 7.5 0 0 1-15 0Z" fill="#e2bf8f" stroke="none"/><path d="M34.5 52v14m-8 0h16" stroke={gold} strokeWidth="2"/><path d="M29 24v11" stroke="white" strokeWidth="2.5"/></g><g transform="rotate(15 62 40)"><path d="M54 20h17v23a8.5 8.5 0 0 1-17 0Z" fill={cream}/><path d="M55 33h15v10a7.5 7.5 0 0 1-15 0Z" fill={blush} stroke="none"/><path d="M62.5 52v14m-8 0h16" stroke={gold} strokeWidth="2"/><path d="M57 24v11" stroke="white" strokeWidth="2.5"/></g><LoveMark x={43} y={7} scale={.34}/><path d="m44 23 4-4 4 4" stroke={gold}/><Glint x={19} y={31} size={3}/><Glint x={78} y={46}/></>
 };
 return <Art name={'occasion-'+kind} className="occasion-illustration"><ellipse cx="48" cy="71" rx="31" ry="3" fill="#e5d8ed" stroke="none"/><circle cx="48" cy="39" r="29" fill="#f4ecf8" stroke="none"/>{scenes[kind]||scenes.love}</Art>;
}

export function DecorationArtwork({kind}:{kind:string}){
 const shapes:Record<string,ReactNode>={
  moon:<><path d="M42 8A24 24 0 1 0 51 46 25 25 0 0 1 42 8Z" fill="#cabbdf"/><Glint x={43} y={30}/></>,
  hearts:<><LoveMark x={9} y={12} scale={1.25} fill={blush}/><LoveMark x={30} y={27} scale={.8}/><Glint x={48} y={13} size={3}/></>,
  stars:<><path d="m28 7 6 14 15 3-11 10 2 16-12-8-13 8 2-16L6 24l16-3Z" fill="#e1c697" stroke={gold}/><Glint x={49} y={10}/><Glint x={8} y={47} size={3}/></>,
  petals:<><path d="M30 50C8 44 6 22 22 12q21 16 8 38Z" fill={blush} stroke={rose}/><path d="M30 50c-5-17 5-31 23-30 1 16-6 28-23 30Z" fill="#bfcfbe" stroke="#94ad92"/><path d="m30 51-8-25m9 21 13-16" stroke={cream}/></>,
  fireflies:<><ellipse cx="21" cy="25" rx="10" ry="7" fill="#e5def2" transform="rotate(28 21 25)"/><ellipse cx="40" cy="25" rx="10" ry="7" fill="#dce9e0" transform="rotate(-28 40 25)"/><ellipse cx="30" cy="35" rx="7" ry="13" fill="#e5cd8d" stroke={gold}/><path d="M24 31h12m-11 6h10m-9-16-4-5m12 5 4-5" stroke={gold}/><Glint x={48} y={43} size={3}/><circle cx="14" cy="47" r="2" fill={gold} stroke="none"/></>,
  paperplanes:<><path d="m5 22 48-12-16 43-10-19Z" fill={cream} stroke={lavender}/><path d="m5 22 22 12L53 10 20 27m7 7-2 11 8-5" stroke={lavender}/><path d="M13 42q-3 12 9 13" stroke={rose} strokeDasharray="2 4"/></>
 };
 return <Art name={'decoration-'+kind} viewBox="0 0 60 60" className="decoration-illustration">{shapes[kind]||shapes.hearts}</Art>;
}
export function GameArtwork({kind}:{kind:string}){
 const shapes:Record<string,ReactNode>={
  memory:<><rect x="9" y="9" width="27" height="37" rx="5" fill="#e1d4ed" transform="rotate(-9 9 9)"/><rect x="23" y="16" width="27" height="37" rx="5" fill={cream}/><LoveMark x={27} y={26} scale={.58}/><path d="M29 46h15" stroke={gold}/><Glint x={47} y={8} size={3}/></>,
  connect:<><rect x="7" y="9" width="46" height="42" rx="8" fill="#d3e0d7" stroke="#86a591"/>{[0,1,2].flatMap(r=>[0,1,2].map(c=><circle key={r+'-'+c} cx={18+c*12} cy={20+r*11} r="4" fill={r===2||c===1?blush:cream} stroke="none"/>))}<LoveMark x={24} y={24} scale={.38}/></>,
  wheel:<><circle cx="29" cy="31" r="22" fill={blush}/><path d="M29 31V9a22 22 0 0 1 22 22Zm0 0v22A22 22 0 0 1 7 31Z" fill="#d9c9e9" stroke="none"/><path d="M29 9v44M7 31h44" stroke={cream} strokeWidth="2"/><circle cx="29" cy="31" r="7" fill={cream}/><LoveMark x={24} y={26} scale={.3}/><path d="m24 5 5 10 5-10Z" fill={gold} stroke={gold}/></>
 };
 return <Art name={'game-'+kind} viewBox="0 0 60 60" className="game-illustration">{shapes[kind]||shapes.memory}</Art>;
}
