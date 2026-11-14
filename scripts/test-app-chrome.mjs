import{build}from'esbuild';import{spawnSync}from'node:child_process';
await build({loader:{'.webp':'dataurl'},entryPoints:['tests/app-chrome.test.jsx'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'outputs/tests/app-chrome.mjs'});const result=spawnSync(process.execPath,['outputs/tests/app-chrome.mjs'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
