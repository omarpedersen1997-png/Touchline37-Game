import React,{useState} from 'react';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import matchCover from '../assets/game/matchday-cover.webp';
import ManualMatch from './ManualMatch.jsx';
import {createR4Practice} from './r4-practice.js';

export default function R4Practice({onClose}) {
  const [practice,setPractice]=useState(null);
  const begin=surface=>setPractice(createR4Practice(Date.now(),{revision:5,surface}));
  return <div className="app-shell game-console">
    {practice?<ManualMatch match={practice.match} now={practice.match.started} club="Prøvelund BK"
      clubStyle={{color:'lime',crest:'shield'}} practice={practice} onClose={onClose}/>
    :<main className="match-test-entry" aria-labelledby="test-match-title">
      <img className="match-test-cover" src={matchCover} alt="" decoding="async" width={1440} height={810}/>
      <button type="button" className="match-test-back" onClick={onClose}><ArrowLeft size={18}/> Tilbage</button>
      <div>
        <p className="eyebrow">MOTOR 11 · R5</p>
        <h1 id="test-match-title">Kampdag<span>.</span></h1>
        <p>Prøvelund BK mod Havneby IF. Vælg baneforhold for at gå til afspark.</p>
        <div className="match-test-actions">
          <button type="button" className="primary" onClick={()=>begin('dry')}>Spil på tør bane <ArrowUpRight size={18}/></button>
          <button type="button" onClick={()=>begin('wet')}>Spil på våd bane <ArrowUpRight size={18}/></button>
        </div>
      </div>
    </main>}
  </div>;
}
