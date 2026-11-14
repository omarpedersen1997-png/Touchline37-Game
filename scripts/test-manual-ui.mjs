import{build}from'esbuild';import{spawnSync}from'node:child_process';
await build({loader:{'.webp':'dataurl'},entryPoints:['tests/manual-ui.test.jsx'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'outputs/tests/manual-ui.mjs'});
const result=spawnSync(process.execPath,['outputs/tests/manual-ui.mjs'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
