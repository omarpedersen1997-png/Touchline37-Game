// Presentation only: preserve legacy smoothing and authoritative physics.
export function motionBlend(version,legacyBlend){return version>=11?1:legacyBlend;}
export function detailPlayer(record,selected){return selected&&record.wanted&&record.high?record.high:record.low;}
export function ballSpinStep(version,{elapsed,tickDelta,paused=false}){return version>=11?(paused?0:Math.max(0,Math.min(.1,elapsed))*.24):tickDelta*.012;}
