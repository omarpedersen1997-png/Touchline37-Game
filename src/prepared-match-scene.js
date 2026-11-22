// Single-owner handoff. Cancellation or a mismatched profile disposes the
// hidden canvas; a claimed scene belongs exclusively to ManualMatch.
export function createPreparedScenePool(){
 let generation=0,entry=null;
 const release=value=>{if(!value)return;try{value.scene.dispose();}catch{}try{value.host.remove();}catch{}};
 return{
  async prepare(key,create,{current=()=>true}={}){
   const own=++generation;release(entry);entry=null;const value=await create();
   if(own!==generation||!current()){release(value);return false;}
   entry={...value,key};return true;
  },
  take(key,host,options){
   const value=entry;entry=null;if(!value)return null;
   if(value.key!==key||typeof value.scene.rehost!=='function'){release(value);return null;}
   try{value.scene.rehost(host,options);value.host.remove();return value.scene;}catch{release(value);return null;}
  },
  clear(){generation++;const value=entry;entry=null;release(value);},
  get ready(){return!!entry;}
 };
}
export function preparedSceneKey({version=11,revision=3,quality='auto',color='lime',pattern='classic',stage=1}){
 return[version,revision,quality,color,pattern,version>=5?0:stage].join('|');
}
export const preparedMatchScenes=createPreparedScenePool();
