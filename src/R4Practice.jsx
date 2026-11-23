import React,{useState} from 'react';
import ManualMatch from './ManualMatch.jsx';
import {createR4Practice} from './r4-practice.js';

export default function R4Practice({onClose}) {
  const [practice]=useState(createR4Practice);
  return <div className="app-shell game-console">
    <ManualMatch match={practice.match} now={practice.match.started} club="Prøvelund BK"
      clubStyle={{color:'lime',crest:'shield'}} practice={practice} onClose={onClose}/>
  </div>;
}
