const numeric=['fps','frameMs','renderMs','drawCalls','triangles','resolutionScale','assetPack','textureSize','inputSamples','inputMeanMs','inputMaxMs'];
export function createMatchPerformanceLog(limit=60) {
 const samples=[];let resolution=null;
 return {
  resolution(plan){resolution={width:plan.width,height:plan.height,quality:plan.quality};},
  record(value,quality){
   const sample={quality};for(const field of numeric)if(Number.isFinite(value[field]))sample[field]=value[field];
   samples.push(sample);while(samples.length>Math.max(1,Math.min(300,limit)))samples.shift();
  },
  report(input){return {...(input?{input:{source:'DOM-input til forbrugt simulationsinput; ikke fysisk touch-/skærmlatens.',inputSamples:input.inputSamples,inputMeanMs:input.inputMeanMs,inputMaxMs:input.inputMaxMs}}:{}),kind:'touchline-performance',schema:1,source:'Denne enheds kampvisning; FPS er indsendte frames, ikke en garanti for skærmens opdateringsfrekvens.',resolution:resolution&&{...resolution},samples:samples.map(sample=>({...sample}))};}
 };
}
