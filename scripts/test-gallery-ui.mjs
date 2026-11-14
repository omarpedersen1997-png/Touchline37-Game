import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
const output='outputs/tests/gallery-ui.mjs';
await build({loader:{'.webp':'dataurl'},entryPoints:['tests/gallery-ui.test.jsx'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:output});
const result=spawnSync(process.execPath,[output],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
