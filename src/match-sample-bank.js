// Local files only. Decoding is lazy after sound opt-in; buffers are reused.
export function createMatchSampleBank(context,{base,output,allowed,fetcher=globalThis.fetch}={}){
 const buffers=new Map(),voices=new Set(),abort=new AbortController();let disposed=false,loading=null,ambience=null;
 const names=['ambience','crowd-goal','crowd-chance','kick-soft','kick-hard','woodwork','net','whistle'];
 const stopAll=()=>{for(const voice of [...voices]){try{voice.stop();}catch{}voice.onended?.();}ambience=null;};
 function play(name,{gain=.3,at=context.currentTime,loop=false}={}){
  if(disposed||!allowed()||!buffers.has(name)||voices.size>=8||context.state!=='running')return false;
  let clean;
  try{const source=context.createBufferSource(),volume=context.createGain();let ended=false;source.buffer=buffers.get(name);source.loop=loop;volume.gain.value=gain;source.connect(volume);volume.connect(output);voices.add(source);clean=()=>{if(ended)return;ended=true;voices.delete(source);source.disconnect();volume.disconnect();if(ambience===source)ambience=null;};source.onended=clean;source.start(at);if(loop)ambience=source;return true;}catch{clean?.();return false;}
 }
 return {load(){
  if(loading||disposed)return loading||Promise.resolve();
  loading=Promise.all(names.map(async name=>{try{const response=await fetcher(`${base}/${name}.wav`,{signal:abort.signal,credentials:'same-origin'});if(!response.ok)throw Error('Audio asset unavailable');const buffer=await context.decodeAudioData(await response.arrayBuffer());if(!disposed)buffers.set(name,buffer);}catch{/* Old oscillator fallback stays usable, without an unhandled rejection. */}}));return loading;
 },play,ambient(){if(!ambience)return play('ambience',{gain:.12,loop:true});return true;},stopAll,
 dispose(){if(disposed)return;disposed=true;abort.abort();stopAll();buffers.clear();},get decoded(){return buffers.size;},get voices(){return voices.size;}};
}
