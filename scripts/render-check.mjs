// Non-browser rendering check. Does not claim visual or interaction QA.
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const temp=await mkdtemp(path.join(tmpdir(),'lovekoala-render-'));
try{const outfile=path.join(temp,'check.mjs');await build({entryPoints:['tests/render-check.tsx'],outfile,bundle:true,platform:'node',format:'esm',jsx:'automatic',logLevel:'error',external:['node:*'],banner:{js:"import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"}});await import(outfile);}finally{await rm(temp,{recursive:true,force:true});}
