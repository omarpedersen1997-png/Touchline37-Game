// Shared by scene setup and evidence tests. Ambient fill no longer washes the
// PBR fabric/skin flat. A single unshadowed rim light costs no extra draw pass.
export const MATCH_LIGHTING=Object.freeze({
 exposure:1.04,sky:0xdce9f5,ground:0x435345,ambient:1.25,
 key:0xfff0db,keyIntensity:2.6,rim:0xc0d9f5,rimIntensity:.65,
 pitchLight:0x86a86a,pitchDark:0x75975d,normalStrength:.16
});
