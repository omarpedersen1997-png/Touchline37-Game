// Shared by scene setup and evidence tests. Ambient fill no longer washes the
// PBR fabric/skin flat. A single unshadowed rim light costs no extra draw pass.
export const MATCH_LIGHTING=Object.freeze({
 exposure:.98,background:0x78939e,fogNear:90,fogFar:300,sky:0xdce9f5,ground:0x435345,ambient:1.05,
 key:0xfff0db,keyIntensity:3.05,rim:0xc0d9f5,rimIntensity:.6,
 pitchLight:0xa7c895,pitchDark:0x779f68,normalStrength:.2,kitRoughness:.78
});
