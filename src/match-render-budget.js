// Native-resolution Sharp keeps detail on the ball/controlled player while
// distant players use the same textured rig with fewer vertices. Explicit 4K
// retains full-team geometry and live shadows.
export function matchRenderBudget(version,quality){
 const focusedPlayers=version>=6&&['auto','sharp'].includes(quality);
 return{focusedPlayers,baseQuality:focusedPlayers?'auto':quality,liveShadows:quality==='4k'||version<6&&quality==='sharp'};
}
