import{build}from'esbuild';import{spawnSync}from'node:child_process';import{readFileSync}from'node:fs';
const release=JSON.parse(readFileSync('dev/test-release.json'));
await build({entryPoints:['tests/polish-ui.test.jsx'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'outputs/tests/polish-ui.mjs',define:{__TOUCHLINE_TEST_APP__:'true',__TOUCHLINE_BUILD_VERSION__:JSON.stringify(release.versionName),__TOUCHLINE_BUILD_NUMBER__:String(release.versionCode)}});
const result=spawnSync(process.execPath,['outputs/tests/polish-ui.mjs'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
