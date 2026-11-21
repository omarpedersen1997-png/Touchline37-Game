import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
export const MATCH_ASSET_ROOT='/match-assets55';
export async function packageMatchAssets(destination){
 const source=resolve('public'+MATCH_ASSET_ROOT),manifest=JSON.parse(await readFile(resolve(source,'manifest.json'),'utf8'));
 // Structural/hash guards are intentional; binary download size is not a failure.
 for(const item of manifest.files){
  if(!/^(?!.*\.\.)[a-zA-Z0-9][a-zA-Z0-9.-]+$/.test(item.file))throw Error('Ugyldig assetsti');
  const bytes=await readFile(resolve(source,item.file));
  if(bytes.length!==item.bytes||createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Asset checksum mismatch: '+item.file);
 }
 const target=resolve(destination,'.'+MATCH_ASSET_ROOT);await mkdir(dirname(target),{recursive:true});await cp(source,target,{recursive:true});
 return {root:MATCH_ASSET_ROOT,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0),files:manifest.files,license:manifest.license};
}
if(process.argv[1]?.endsWith('package-match-assets.mjs'))console.log(JSON.stringify(await packageMatchAssets(process.argv[2]||'.dev-data/android-web/public')));
