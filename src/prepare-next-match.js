import {matchAssetRoot} from './match-asset-config.js';
import {preparedMatchScenes,preparedSceneKey} from './prepared-match-scene.js';
import {readMatchPreferences} from './manual-preferences.js';
import {CLUB_COLORS} from './ClubStudio.jsx';
import {isAppHidden} from './app-visibility.js';

export async function prepareNextMatchGraphics(module,{version,style,stage=1,current=()=>true,document:doc=globalThis.document}={}){
 const {quality}=readMatchPreferences(undefined,version),rich=version===11&&!!matchAssetRoot;
 preparedMatchScenes.clear();
 await module.prepareMatchSceneAssets({version,quality,engineRevision:rich?3:1});
 if(!rich||quality==='simple'||!current())return;
 const key=preparedSceneKey({version,quality,color:style?.color,pattern:style?.pattern,stage});
 await preparedMatchScenes.prepare(key,async()=>{
  const host=doc.createElement('div');host.dataset.touchlinePrewarm='preparing';host.setAttribute('aria-hidden','true');host.inert=true;
  Object.assign(host.style,{position:'fixed',inset:'0',opacity:'0',pointerEvents:'none',zIndex:'-1'});doc.body.appendChild(host);
  let scene;
  try{
   const {createArcade}=await import('../shared/arcade.js');
   if(!current()){host.remove();return{host,scene:{dispose(){}}};}
   const state=createArcade('graphics-preparation',{matchVersion:11,engineRevision:3,homeRating:50,awayRating:50});
   scene=module.createMatchScene(host,{version,quality,initialState:state,field:state.field,players:11,stage,pattern:style?.pattern,color:CLUB_COLORS[style?.color||'lime'],getMatchTime:()=>0});
   await scene.prepare?.();scene.render(state,'broadcast',true);host.dataset.touchlinePrewarm='ready';return{host,scene};
  }catch(error){scene?.dispose();host.remove();throw error;}
 },{current});
 // Never send the match-creation request while the app is off screen.
 if(isAppHidden(doc)){preparedMatchScenes.clear();throw Error('Kampen er ikke startet. Vend tilbage og prøv igen.');}
}
