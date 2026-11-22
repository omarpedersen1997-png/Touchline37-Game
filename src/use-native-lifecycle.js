import {useEffect,useRef} from 'react';
import {createNativeLifecycle} from './native-lifecycle.js';
import {setNativeAppActive} from './app-visibility.js';
export function useNativeLifecycle(enabled,onBack){
 const current=useRef(onBack);current.current=onBack;
 useEffect(()=>{
  if(!enabled)return;
  const lifecycle=createNativeLifecycle(()=>import('@capacitor/app'),{onBack:app=>current.current(app),onActive:setNativeAppActive});
  return()=>lifecycle.dispose();
 },[enabled]);
}
