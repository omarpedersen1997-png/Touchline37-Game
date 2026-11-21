import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
const output='outputs/tests/workspace-viewport.mjs';
await build({entryPoints:['tests/workspace-viewport.test.jsx'],bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.webp':'dataurl'},outfile:output});
const result=spawnSync(process.execPath,[output],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
