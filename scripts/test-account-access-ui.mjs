import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
for(const [name,testBuild] of [['account-access-ui',false],['account-access-compiled',true]]){
 const output=`outputs/tests/${name}.mjs`;
 await build({entryPoints:[`tests/${name}.test.jsx`],bundle:true,platform:'node',format:'esm',packages:'external',define:{__TOUCHLINE_TEST_APP__:JSON.stringify(testBuild)},outfile:output});
 const result=spawnSync(process.execPath,[output],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
