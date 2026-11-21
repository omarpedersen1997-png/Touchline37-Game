import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='public/match-assets55',files=[];
for(const file of (await readdir(root)).sort()){
 if(file==='manifest.json')continue;
 const bytes=await readFile(root+'/'+file),item={file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 if(file.endsWith('.png')){item.width=bytes.readUInt32BE(16);item.height=bytes.readUInt32BE(20);}
 if(file.endsWith('.glb')){const j=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));item.meshes=j.meshes.length;item.triangles=j.meshes.reduce((s,m)=>s+m.primitives.reduce((s,p)=>s+(j.accessors[p.indices??p.attributes.POSITION].count/3),0),0);item.animations=(j.animations||[]).map(a=>a.name);item.skinned=!!j.skins?.length;}
 files.push(item);
}
await writeFile(root+'/manifest.json',JSON.stringify({version:55,license:'ASSETS.md',source:'Original assets plus attributed MakeHuman/CMU and Gregor Quendel recordings',files},null,2)+'\n');
console.log('Asset manifest:',files.length,'files,',files.reduce((n,f)=>n+f.bytes,0),'bytes');
