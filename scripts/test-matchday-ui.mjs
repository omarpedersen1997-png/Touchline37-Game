import {build} from 'esbuild';import {spawnSync} from 'node:child_process';
await build({entryPoints:['tests/matchday-ui.test.jsx'],outfile:'outputs/tests/matchday-ui.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const result=spawnSync(process.execPath,['outputs/tests/matchday-ui.mjs'],{stdio:'inherit'});process.exitCode=result.status??1;
