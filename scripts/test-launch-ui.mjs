import{build}from'esbuild';import{spawnSync}from'node:child_process';
for(const[name,web]of[['launch-ui',false],['web-navigation',false],['web-navigation',true]]){
 const output=`outputs/tests/${name}-${web?'web':'native'}.mjs`;
 await build({loader:{'.webp':'dataurl'},entryPoints:[`tests/${name}.test.jsx`],bundle:true,platform:'node',format:'esm',packages:'external',define:{__WEB_GAME__:JSON.stringify(web)},outfile:output});
 const r=spawnSync(process.execPath,[output],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
}
