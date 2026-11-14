import{createHash}from'node:crypto';
import{readFile,realpath}from'node:fs/promises';
import{basename,dirname,resolve,sep}from'node:path';
import{fileURLToPath,pathToFileURL}from'node:url';
import{inflateSync}from'node:zlib';
import{is4KSiteCapture,siteCapturePolicy}from'../shared/site-capture-policy.js';

const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Uint32Array.from({length:256},(_,value)=>{for(let i=0;i<8;i++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
function crc32(bytes){let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return(value^0xffffffff)>>>0;}

export function imageCaptureDimensions(bytes){
 if(!Buffer.isBuffer(bytes))bytes=Buffer.from(bytes);
 if(bytes.subarray(0,8).equals(pngSignature)){
  let width=0,height=0,channels=0,ended=false,offset=8;const pieces=[];
  while(offset+12<=bytes.length){
   const size=bytes.readUInt32BE(offset),end=offset+12+size;if(end>bytes.length)throw Error('Truncated PNG chunk.');
   const type=bytes.toString('ascii',offset+4,offset+8),body=bytes.subarray(offset+8,offset+8+size);
   if(crc32(bytes.subarray(offset+4,offset+8+size))!==bytes.readUInt32BE(offset+8+size))throw Error('PNG checksum is invalid.');
   if(offset===8&&type!=='IHDR')throw Error('PNG header is missing.');
   if(type==='IHDR'){
    if(width||size!==13)throw Error('Invalid PNG header.');
    width=body.readUInt32BE(0);height=body.readUInt32BE(4);
    channels=({0:1,2:3,3:1,4:2,6:4})[body[9]];
    if(!width||!height||width>16384||height>16384||body[8]!==8||!channels||body[10]!==0||body[11]!==0||body[12]!==0)throw Error('Capture PNG must be a non-interlaced 8-bit image.');
   }else if(type==='IDAT')pieces.push(body);
   else if(type==='IEND'){if(size!==0||end!==bytes.length)throw Error('Invalid PNG end.');ended=true;break;}
   offset=end;
  }
  if(!ended||!pieces.length)throw Error('PNG image data is incomplete.');
  const expected=(width*channels+1)*height;
  if(expected>256*1024*1024)throw Error('Screenshot pixel data is too large.');
  const pixels=inflateSync(Buffer.concat(pieces),{maxOutputLength:expected+1});
  if(pixels.length!==expected)throw Error('PNG pixel dimensions do not match its image data.');
  const stride=width*channels+1;for(let row=0;row<height;row++)if(pixels[row*stride]>4)throw Error('PNG scanline filter is invalid.');
  return{width,height,contentType:'image/png'};
 }
 if(bytes[0]===255&&bytes[1]===216){
  let offset=2,dimensions=null;
  while(offset+4<=bytes.length){
   if(bytes[offset++]!==255)throw Error('Invalid JPEG marker.');
   while(bytes[offset]===255)offset++;
   const marker=bytes[offset++];
   if(marker===0xda){if(!dimensions||bytes.at(-2)!==255||bytes.at(-1)!==217)throw Error('JPEG image data is incomplete.');return{...dimensions,contentType:'image/jpeg'};}
   if(marker===0xd9)break;
   if(marker===0x01||marker>=0xd0&&marker<=0xd7)continue;
   const size=bytes.readUInt16BE(offset);if(size<2||offset+size>bytes.length)throw Error('Truncated JPEG segment.');
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
    if(size<8)throw Error('JPEG dimensions are missing.');
    dimensions={height:bytes.readUInt16BE(offset+3),width:bytes.readUInt16BE(offset+5)};
   }
   offset+=size;
  }
  throw Error('JPEG capture is incomplete.');
 }
 throw Error('Screenshot must contain genuine PNG or JPEG image data.');
}

// Normal builds fail closed by returning no captures. Release checks opt into
// strict mode, so missing/stale captures can never silently ship as current.
export async function loadVerifiedSiteCaptures({root=projectRoot,manifestPath='release/site-captures.json',releasePath='release/downloads/current.json',strict=false,requireCaptures=false}={}){
 let manifest=null;const fail=message=>{if(strict&&(requireCaptures||manifest?.required===true))throw Error('Website screenshots: '+message);return{screenshots:[],assets:{},errors:[message]};};
 try{
  manifest=JSON.parse(await readFile(resolve(root,manifestPath),'utf8'));
  const release=JSON.parse(await readFile(resolve(root,releasePath),'utf8')),policy=siteCapturePolicy(manifest,release);
  if(!policy.valid)return fail(policy.reason);
  if(typeof release.apk!=='string'||basename(release.apk)!==release.apk||!release.apk.endsWith('.apk'))return fail('Current APK filename is invalid.');
  const apk=await readFile(resolve(root,'release/downloads',release.apk));
  if(digest(apk)!==release.sha256)return fail('The signed APK file differs from current release metadata.');
  const captureRoot=await realpath(resolve(root,'assets/site/captures')),assets={},screenshots=[];
  for(const item of policy.screenshots){
   const file=await realpath(resolve(captureRoot,basename(item.src)));
   if(!file.startsWith(captureRoot+sep))return fail(`Screenshot ${item.id} resolves outside the capture directory.`);
   const bytes=await readFile(file);if(bytes.length>64*1024*1024)return fail(`Screenshot ${item.id} is too large.`);
   const actual=imageCaptureDimensions(bytes),png=item.src.endsWith('.png');
   if((png?'image/png':'image/jpeg')!==actual.contentType)return fail(`Screenshot ${item.id} file type does not match its extension.`);
   if(!is4KSiteCapture(actual.width,actual.height)||actual.width!==item.width||actual.height!==item.height)return fail(`Screenshot ${item.id} does not contain its claimed original 4K dimensions.`);
   const sha256=digest(bytes);if(item.sha256&&sha256!==item.sha256)return fail(`Screenshot ${item.id} checksum differs; capture it again or verify the original file.`);
   assets[item.src]={bytes,contentType:actual.contentType,sha256};
   screenshots.push({...item,sha256});
  }
  return{screenshots,assets,errors:[]};
 }catch(error){if(strict&&(requireCaptures||manifest?.required===true)&&error.message.startsWith('Website screenshots: '))throw error;return fail(error.message);}
}
export const verifySiteCaptures=loadVerifiedSiteCaptures;

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2),rootFlag=args.indexOf('--root');
 try{
  const result=await loadVerifiedSiteCaptures({root:rootFlag>=0?resolve(args[rootFlag+1]||'.'):projectRoot,strict:args.includes('--strict')||args.includes('--require-captures'),requireCaptures:args.includes('--require-captures')});
  if(result.errors.length)console.log('Website screenshots hidden: '+result.errors.join(' '));
  else console.log(`Verified ${result.screenshots.length} original 4K website screenshots for the current APK.`);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
