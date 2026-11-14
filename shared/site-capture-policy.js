// Only original captures bound to the current APK may appear on the website.
// The Node verification helper also reads the real image bytes and dimensions.
export const SITE_CAPTURE_MIN_LONG_EDGE=3840;
export const SITE_CAPTURE_MIN_SHORT_EDGE=2160;
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const route=value=>typeof value==='string'&&/^\/assets\/captures\/[a-z0-9][a-z0-9._-]{0,100}\.(?:png|jpe?g)$/.test(value);
const label=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max;
export function is4KSiteCapture(width,height){
 return Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width<=16384&&height<=16384&&Math.max(width,height)>=SITE_CAPTURE_MIN_LONG_EDGE&&Math.min(width,height)>=SITE_CAPTURE_MIN_SHORT_EDGE;
}
export function siteCapturePolicy(manifest,release){
 const fail=reason=>({valid:false,reason,screenshots:[]});
 if(!manifest||manifest.schemaVersion!==1)return fail('Capture manifest must use schemaVersion 1.');
 if(!release||!Number.isSafeInteger(release.versionCode)||!sha(release.sha256))return fail('Current APK release metadata is invalid.');
 if(manifest.versionCode!==release.versionCode)return fail(`Screenshots must be recaptured for APK build ${release.versionCode}.`);
 if(!sha(manifest.apkSha256)||manifest.apkSha256!==release.sha256)return fail('Screenshots belong to a different APK checksum; capture the current signed APK again.');
 if(!Array.isArray(manifest.screenshots)||manifest.screenshots.length<1||manifest.screenshots.length>8)return fail('Provide between 1 and 8 original 4K screenshots.');
 const ids=new Set(),paths=new Set(),screenshots=[];
 for(const item of manifest.screenshots){
  if(!item||typeof item!=='object'||typeof item.id!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(item.id)||ids.has(item.id))return fail('Each screenshot needs a unique simple id.');
  if(!route(item.src)||paths.has(item.src))return fail('Each screenshot needs a unique PNG/JPEG path under /assets/captures/.');
  if(!is4KSiteCapture(item.width,item.height))return fail(`Screenshot ${item.id} must be at least 3840 × 2160 (landscape or portrait), without upscaling.`);
  if(!label(item.title,100)||!label(item.description,500)||!label(item.alt,300))return fail(`Screenshot ${item.id} needs a title, description and accessible alternative text.`);
  if(item.sha256!==undefined&&!sha(item.sha256))return fail(`Screenshot ${item.id} has an invalid SHA-256 checksum.`);
  ids.add(item.id);paths.add(item.src);
  screenshots.push({id:item.id,src:item.src,title:item.title.trim(),description:item.description.trim(),alt:item.alt.trim(),width:item.width,height:item.height,...(item.sha256?{sha256:item.sha256}:{})});
 }
 return{valid:true,reason:null,screenshots};
}
