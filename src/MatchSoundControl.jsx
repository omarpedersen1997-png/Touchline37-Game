import React,{useEffect,useRef,useState} from 'react';
import {Volume2,VolumeX} from 'lucide-react';
import {createMatchSound} from './match-sound.js';
import {localMatchStorage} from './manual-preferences.js';
export default function MatchSoundControl({goals=0}) {
 const sound=useRef(null),seen=useRef(null);
 const [enabled,setEnabled]=useState(()=>{let value=false;try{value=localMatchStorage()?.getItem('touchline:match-sound:v1')==='on';}catch{}return value;});
 useEffect(()=>{
  const audio=createMatchSound({storage:localMatchStorage()});sound.current=audio;
  const unlock=()=>audio.unlock(),visibility=()=>{if(document.hidden)audio.suspend();};
  document.addEventListener('pointerdown',unlock,true);document.addEventListener('keydown',unlock,true);document.addEventListener('visibilitychange',visibility);
  return()=>{document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);document.removeEventListener('visibilitychange',visibility);audio.dispose();sound.current=null;};
 },[]);
 useEffect(()=>{if(seen.current!==null&&goals>seen.current)sound.current?.goal();seen.current=goals;},[goals]);
 return <button type="button" aria-label={enabled?'Slå mållyd fra':'Slå mållyd til'} aria-pressed={enabled} onClick={()=>setEnabled(sound.current?.toggle()||false)}>{enabled?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>;
}
