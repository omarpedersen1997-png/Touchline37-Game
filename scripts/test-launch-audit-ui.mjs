import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
await build({loader:{'.webp':'dataurl'},entryPoints:['tests/launch-audit-ui.test.jsx'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'outputs/tests/launch-audit-ui.mjs'});
const result=spawnSync(process.execPath,['outputs/tests/launch-audit-ui.mjs'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
