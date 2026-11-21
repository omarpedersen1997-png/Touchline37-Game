// Separate download size from startup work and actual hosting constraints.
// There is deliberately no APK or total match-resource hard size limit.
export const SIZE_POLICY=Object.freeze({
 apk:Object.freeze({hardLimitBytes:null,reviewAtBytes:25*1024*1024}),
 initialJavaScript:Object.freeze({hardLimitBytes:1_200_000}),
 allJavaScript:Object.freeze({hardLimitBytes:null,reviewAtBytes:4*1024*1024}),
 worker:Object.freeze({documentedLimitBytes:10*1024*1024,limitVerified:false,warnAtBytes:9_000_000,failAtBytes:9_400_000})
});
export function assessClientSize({apkBytes,initialJavaScriptBytes,allJavaScriptBytes}={}){
 const errors=[],warnings=[];
 for(const [key,value]of Object.entries({apk:apkBytes,initialJavaScript:initialJavaScriptBytes,allJavaScript:allJavaScriptBytes})){
  if(value===undefined)continue;
  if(!Number.isFinite(value)||value<0){errors.push({key,reason:'invalid-size'});continue;}
  const budget=SIZE_POLICY[key];
  if(budget.hardLimitBytes!==null&&budget.hardLimitBytes!==undefined&&value>=budget.hardLimitBytes)errors.push({key,bytes:value,reason:'startup-work'});
  if(budget.reviewAtBytes&&value>=budget.reviewAtBytes)warnings.push({key,bytes:value,reason:'review-download-or-lazy-loading'});
 }
 return {errors,warnings};
}
