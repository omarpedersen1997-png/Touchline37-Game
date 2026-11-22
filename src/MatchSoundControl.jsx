import {isAppHidden,watchAppVisibility} from './app-visibility.js';
import {createGoalAudioObserver,createPhaseWhistleObserver} from './match-audio-feed.js';
import React,{useEffect,useRef,useState} from 'react';
import {Volume2,VolumeX} from 'lucide-react';
import {createMatchSound} from './match-sound.js';
import {localMatchStorage} from './manual-preferences.js';
export default function MatchSoundControl({goals=0,phase='waiting',controllerRef,goalWhistle=false}) {
 const sound=useRef(null),goalTracker=useRef(null),phaseTracker=useRef(null);
 goalTracker.current||=createGoalAudioObserver();phaseTracker.current||=createPhaseWhistleObserver(phase);
 const [enabled,setEnabled]=useState(()=>{let value=false;try{value=localMatchStorage()?.getItem('touchline:match-sound:v1')==='on';}catch{}return value;});
 useEffect(()=>{
  const audio=createMatchSound({storage:localMatchStorage()});sound.current=audio;if(controllerRef)controllerRef.current=audio;
  const unlock=()=>audio.unlock(),visibility=()=>{if(isAppHidden())audio.suspend();else audio.unlock();};
  document.addEventListener('pointerdown',unlock,true);document.addEventListener('keydown',unlock,true);const stopVisibility=watchAppVisibility(visibility);
  // The start button was pressed before this lazy-mounted controller existed.
  // Honour saved sound for that first kickoff, without autoplay on restoration
  // in a document that has not received any real user interaction yet.
  if(audio.enabled&&globalThis.navigator?.userActivation?.hasBeenActive)void audio.unlock();
  return()=>{document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);stopVisibility();audio.dispose();sound.current=null;if(controllerRef?.current===audio)controllerRef.current=null;};
 },[]);
 useEffect(()=>{goalTracker.current(sound.current,goals,phase,goalWhistle);},[goals,phase,goalWhistle]);
 useEffect(()=>{phaseTracker.current(sound.current,phase);},[phase]);
 return <button type="button" aria-label={enabled?'Slå kamplyd fra':'Slå kamplyd til'} aria-pressed={enabled} onClick={()=>setEnabled(sound.current?.toggle()||false)}>{enabled?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>;
}
