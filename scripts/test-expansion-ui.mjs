import{build}from'esbuild';
import{spawnSync}from'node:child_process';
for(const name of['expansion-ui','universe-ui','competition-ui','europe-ui','player-career-ui','player-journey-ui','refresh-ui','website-refresh-ui','game-sections-ui']){
 await build({loader:{'.webp':'dataurl'},entryPoints:[`tests/${name}.test.jsx`],bundle:true,platform:'node',format:'esm',packages:'external',outfile:`outputs/tests/${name}.mjs`});
 const result=spawnSync(process.execPath,[`outputs/tests/${name}.mjs`],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
