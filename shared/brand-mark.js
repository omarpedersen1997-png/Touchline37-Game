// Touchline monogram: the top bar is the touchline, the stem is the halfway
// line and the ring is the centre circle. One white mark on a signal-red tile.
// The same vector data drives the website, favicon and native launcher artwork.
export const BRAND_MARK={
 background:'#cb2620',accent:'#fffdf8',border:'#cb2620',
 t:'M11 13H53V22H35.5V53H28.5V22H11Z',
 ring:{cx:32,cy:38,r:11,width:3},
 // Tile-coloured clearance so the circle stops short of the halfway line.
 gap:'M25.8 24H38.2V52H25.8Z'
};
export function touchlineMarkSvg({size=64,background=BRAND_MARK.background}={}){
 const edge=Number.isFinite(Number(size))?Math.max(16,Math.round(Number(size))):64;
 // All callers use the fixed palette. A supplied CSS colour cannot add markup.
 const safeBackground=/^#[0-9a-f]{3,8}$/i.test(background)?background:BRAND_MARK.background;
 const{cx,cy,r,width}=BRAND_MARK.ring;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${edge}" height="${edge}" viewBox="0 0 64 64"><rect width="64" height="64" rx="13" fill="${safeBackground}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${BRAND_MARK.accent}" stroke-width="${width}"/><path d="${BRAND_MARK.gap}" fill="${safeBackground}"/><path d="${BRAND_MARK.t}" fill="${BRAND_MARK.accent}"/></svg>`;
}
