import React from 'react';
import {Clock3,Gamepad2,Play} from 'lucide-react';

export default function MatchModeChoices({onSimulate,onManual,disabled=false,manualDisabled=false,simulationSeconds=36,simulationLabel='Simulér kamp',manualLabel='Spil selv i 3D',label='Vælg kampform',personal=false,manualHint=''}){
 return <div className="match-mode-block"><div className="match-mode-choices" role="group" aria-label={label}>
  <button type="button" className="match-mode-option simulation" data-match-mode="simulation" disabled={disabled} onClick={onSimulate}><span className="match-mode-icon"><Play size={20}/></span><span className="match-mode-copy"><strong>{simulationLabel}</strong><span>{personal?'Din spiller · automatisk':'11 mod 11 · automatisk'}</span><small><Clock3 size={13}/>{simulationSeconds} sekunder</small></span></button>
  <button type="button" className="match-mode-option manual" data-match-mode="manual" disabled={disabled||manualDisabled} onClick={onManual}><span className="match-mode-icon"><Gamepad2 size={22}/></span><span className="match-mode-copy"><strong>{manualLabel}</strong><span>{personal?'11 mod 11 · styr din spiller':'11 mod 11 · styr holdet'}</span><small><Clock3 size={13}/>2 × 2 minutter</small></span></button>
 </div>{manualDisabled&&manualHint&&<p className="match-mode-availability" role="status">{manualHint}</p>}</div>;
}
