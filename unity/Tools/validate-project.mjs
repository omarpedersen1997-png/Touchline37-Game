import {readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=new URL('../TouchlineUnity/',import.meta.url),repo=new URL('../../',import.meta.url),evidence=new URL('../Evidence/',import.meta.url);
const read=path=>readFile(new URL(path,base),'utf8');
assert.match(await read('ProjectSettings/ProjectVersion.txt'),/6000\.6\.10f1 \(40e81493c67d\)/);
const packages=JSON.parse(await read('Packages/manifest.json'));assert.equal(packages.dependencies['com.unity.render-pipelines.universal'],'17.6.0');assert.equal(packages.dependencies['com.unity.inputsystem'],'1.20.1');
const guids=new Set(),files=[];
async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const url=new URL(entry.name+(entry.isDirectory()?'/':''),folder);if(entry.isDirectory())await walk(url);else files.push(url);}}
await walk(new URL('Assets/',base));
for(const file of files.filter(f=>!f.pathname.endsWith('.meta'))){const meta=await readFile(new URL(file.href+'.meta'),'utf8'),guid=meta.match(/guid: ([a-f0-9]{32})/)?.[1];assert(guid&&!guids.has(guid),file.pathname);guids.add(guid);}
const scene=await read('Assets/Touchline/Scenes/Touchline.unity'),scriptMeta=await read('Assets/Touchline/Runtime/TouchlineBootstrap.cs.meta');assert(scene.includes(scriptMeta.match(/guid: ([a-f0-9]+)/)[1]));
const transfer=JSON.parse(await readFile(new URL('asset-transfer.json',evidence),'utf8'));
for(const item of transfer.originalFiles){const bytes=await readFile(new URL(item.target,base));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);const original=await readFile(new URL(item.source,repo));assert(bytes.equals(original));}
for(const item of transfer.derivedFbx){const bytes=await readFile(new URL(item.target,base));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);}
const fbx=JSON.parse(await readFile(new URL('fbx-structure.json',evidence),'utf8'));assert.equal(fbx.results.length,5);assert(fbx.results.every(r=>r.readable&&r.uvMaps));
const core=JSON.parse(await readFile(new URL('core-tests.json',evidence),'utf8'));assert.equal(core.failed,0);assert(core.passed>=44);
const syntax=JSON.parse(await readFile(new URL('syntax-check.json',evidence),'utf8'));assert.equal(syntax.errors,0);
const runtimeSources=await Promise.all(files.filter(f=>f.pathname.includes('/Runtime/')&&f.pathname.endsWith('.cs')).map(f=>readFile(f,'utf8')));assert(!runtimeSources.some(s=>/HttpClient|UnityWebRequest|playtouchline\.dk|apiFetch/.test(s)),'Unity sandbox must have no production transport');
const frozen=JSON.parse(await read('Assets/Touchline/Resources/Touchline/golden-domain.json')).frozen;
for(const [path,sha]of Object.entries(frozen))assert.equal(createHash('sha256').update(await readFile(new URL(path,repo))).digest('hex'),sha);
const result={unityVersion:'6000.6.10f1',urp:'17.6.0',assetFiles:files.filter(f=>!f.pathname.endsWith('.meta')).length,originalAssetsByteEqual:transfer.originalFiles.length,derivedFbx:transfer.derivedFbx.length,uniqueFileGuids:guids.size,coreTests:core.passed,syntaxFiles:syntax.files,productionTransport:false,frozenDomainChecksums:true,unityEditorImportVerified:false,unityApkBuilt:false,physicalAndroidVerified:false};await writeFile(new URL('project-validation.json',evidence),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
