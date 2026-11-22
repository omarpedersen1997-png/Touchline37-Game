let nativeActive=true;
export function isAppHidden(document=globalThis.document){return !nativeActive||!!document?.hidden;}
export function setNativeAppActive(active,document=globalThis.document){
 const next=active!==false;if(next===nativeActive)return false;nativeActive=next;
 document?.dispatchEvent(new Event('touchline:visibility'));return true;
}
export function watchAppVisibility(callback,document=globalThis.document){
 let previous=isAppHidden(document);const notify=event=>{const current=isAppHidden(document);if(current===previous)return;previous=current;callback(event);};
 document?.addEventListener('visibilitychange',notify);document?.addEventListener('touchline:visibility',notify);
 return()=>{document?.removeEventListener('visibilitychange',notify);document?.removeEventListener('touchline:visibility',notify);};
}
