import React from'react';
import{ChevronRight}from'lucide-react';
export default function LiveMatchBanner({match,minute,onWatch,covered=false}){
 if(!match)return null;
 return <button type="button" className="live-match-banner" onClick={onWatch} aria-label={`Åbn livekamp mod ${match.opponent}, ${match.manual?'spil selv':minute+' minutter, '+match.home+'–'+match.away}`} aria-hidden={covered||undefined} tabIndex={covered?-1:0}><span className="live-banner-clock"><i className="live-dot"/>LIVE · {minute}′</span><b>{match.manual?'SPIL SELV':`${match.home}–${match.away}`}</b><span>{match.manual?'Fortsæt':'Se kampen'}<ChevronRight size={15}/></span></button>
}
