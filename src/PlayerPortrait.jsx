import React from 'react';
export function portraitIndex(key){let hash=2166136261;for(const ch of String(key??'player')){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0)%6;}
export default function PlayerPortrait({playerKey,label,className=''}){const index=portraitIndex(playerKey);return <span className={'game-player-portrait '+className} role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true} style={{backgroundPosition:`${index%3*50}% ${index<3?0:100}%`}}/>}
