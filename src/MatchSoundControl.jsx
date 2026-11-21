import {createGoalSoundTracker} from './match-audio-feed.js';
import React,{useEffect,useRef,useState} from 'react';
import {Volume2,VolumeX} from 'lucide-react';
import {createMatchSound} from './match-sound.js';
import {localMatchStorage} from './manual-preferences.js';
export default function MatchSoundControl({goals=0,phase='waiting',controllerRef}) {
 const sound=useRef(null),goalTracker=useRef(null),seenPhase=useRef(phase);
 goalTracker.current||=createGoalSoundTracker();
 const [enabled,setEnabled]=useState(()=>{let value=false;try{value=localMatchStorage()?.getItem('touchline:match-sound:v1')==='on';}catch{}return value;});
 useEffect(()=>{
  const audio=createMatchSound({storage:localMatchStorage()});sound.current=audio;if(controllerRef)controllerRef.current=audio;
  const unlock=()=>audio.unlock(),visibility=()=>{if(document.hidden)audio.suspend();};
  document.addEventListener('pointerdown',unlock,true);document.addEventListener('keydown',unlock,true);document.addEventListener('visibilitychange',visibility);
  return()=>{document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);document.removeEventListener('visibilitychange',visibility);audio.dispose();sound.current=null;if(controllerRef?.current===audio)controllerRef.current=null;};
 },[]);
 useEffect(()=>{if(goalTracker.current(goals,phase)){sound.current?.goal();sound.current?.crowd();}},[goals,phase]);
 useEffect(()=>{if(phase!==seenPhase.current){if(phase==='halftime'||phase==='finished')sound.current?.whistle(phase);else if(seenPhase.current==='kickoff'&&(phase==='first'||phase==='second'))sound.current?.whistle('kickoff');}seenPhase.current=phase;},[phase]);
 return <button type="button" aria-label={enabled?'Slå kamplyd fra':'Slå kamplyd til'} aria-pressed={enabled} onClick={()=>setEnabled(sound.current?.toggle()||false)}>{enabled?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>;
}
