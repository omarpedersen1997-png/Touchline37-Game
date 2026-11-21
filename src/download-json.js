import {Capacitor,registerPlugin} from '@capacitor/core';
const NativeExport=registerPlugin('TouchlineExport');
export async function downloadJson(data,name,{native=Capacitor.getPlatform()==='android',exporter=NativeExport,doc=globalThis.document,urls=globalThis.URL,timer=globalThis.setTimeout}={}) {
 const content=JSON.stringify(data);
 if(!content||new TextEncoder().encode(content).length>1048576)throw Error('Filen er for stor til eksport.');
 const filename=String(name).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100)+'.json';
 if(native)return exporter.saveJson({filename,content});
 const url=urls.createObjectURL(new Blob([content],{type:'application/json'}));
 try{const link=doc.createElement('a');link.href=url;link.download=filename;link.click();}finally{timer(()=>urls.revokeObjectURL(url),1000);}
 return {saved:true};
}
