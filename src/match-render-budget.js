// Native-resolution Sharp keeps detail on the ball/controlled player while
// distant players use the same textured rig with fewer vertices. Explicit 4K
// retains full-team geometry and live shadows.
export function matchRenderBudget(version,quality){
 const focusedPlayers=version>=6&&['auto','sharp'].includes(quality);
 const automatic=quality==='auto'||!quality,adaptive=version>=11&&automatic;
 return{focusedPlayers,baseQuality:focusedPlayers?'auto':quality,liveShadows:quality==='4k'||version<6&&quality==='sharp',
  // Auto already supersamples up to 1.5 CSS pixels. Avoid an additional MSAA
  // framebuffer in the new mobile profile; explicit Sharp/4K retain MSAA.
  antialias:!adaptive,powerPreference:'high-performance',targetFps:adaptive?60:30};
}
