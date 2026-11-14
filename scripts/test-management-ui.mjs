import{build}from'esbuild';
await build({loader:{'.webp':'dataurl'},entryPoints:['tests/management-ui.test.jsx'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'outputs/tests/management-ui.mjs'});
await import('../outputs/tests/management-ui.mjs');
