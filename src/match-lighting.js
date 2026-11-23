// Shared by scene setup and evidence tests. Ambient fill no longer washes the
// PBR fabric/skin flat. A single unshadowed rim light costs no extra draw pass.
export const MATCH_LIGHTING=Object.freeze({
 exposure:.98,background:0x78939e,fogNear:90,fogFar:300,sky:0xdce9f5,ground:0x435345,ambient:1.05,
 key:0xfff0db,keyIntensity:3.05,rim:0xc0d9f5,rimIntensity:.6,
 pitchLight:0xa7c895,pitchDark:0x779f68,normalStrength:.2,kitRoughness:.78
});

// R6 presentation only. The same number of lights, no extra lighting pass.
export const MATCH_NIGHT_LIGHTING=Object.freeze({
 ...MATCH_LIGHTING,
 exposure:.94,background:0x223844,fogNear:70,fogFar:230,
 sky:0xd3e4f8,ground:0x354638,ambient:.96,
 key:0xfff1dd,keyIntensity:3.05,rim:0xaacafa,rimIntensity:.76,
 pitchLight:0xbdd7ad,pitchDark:0x92ae87,
});
