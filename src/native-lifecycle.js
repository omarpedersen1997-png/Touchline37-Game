// Async native listener registration may finish after React unmount. Every
// late handle is removed, and an old getState cannot overwrite a newer event.
export function createNativeLifecycle(load,{onBack,onActive}={}){
 let disposed=false,revision=0;const handles=[];
 const keep=handle=>{if(disposed){try{Promise.resolve(handle?.remove()).catch(()=>{});}catch{}}else handles.push(handle);};
 const ready=Promise.resolve().then(load).then(async({App})=>{
  if(disposed)return;
  const listen=(name,callback)=>Promise.resolve().then(()=>App.addListener(name,callback)).then(keep).catch(()=>{});
  const back=listen('backButton',()=>{if(!disposed)try{Promise.resolve(onBack?.(App)).catch(()=>{});}catch{}});
  const active=listen('appStateChange',state=>{revision++;if(!disposed)onActive?.(state.isActive);});
  await Promise.all([back,active]);
  const at=revision;if(!disposed&&App.getState){const state=await App.getState();if(!disposed&&at===revision)onActive?.(state.isActive);}
 }).catch(()=>{});
 return{ready,dispose(){if(disposed)return;disposed=true;for(const h of handles.splice(0))try{Promise.resolve(h.remove()).catch(()=>{});}catch{}}};
}
