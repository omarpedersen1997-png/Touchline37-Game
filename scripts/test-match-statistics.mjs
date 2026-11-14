import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
await build({entryPoints:['tests/match-statistics.test.jsx'],bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},outfile:'outputs/tests/match-statistics.mjs'});
const result=spawnSync(process.execPath,['outputs/tests/match-statistics.mjs'],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
