// Original Touchline monogram: a forward T beside a pitch touchline.
// The same vector paths drive the website, favicon and native launcher artwork.
export const BRAND_MARK={
 background:'#0b141d',accent:'#c3f85c',border:'#405447',
 t:'M14 15H55L51.5 26H38L30 51H18L26 26H10.5Z',
 line:'M49 35V50H38'
};
export function touchlineMarkSvg({size=64,background=BRAND_MARK.background}={}){
 const edge=Number.isFinite(Number(size))?Math.max(16,Math.round(Number(size))):64;
 // All callers use the fixed palette. A supplied CSS colour cannot add markup.
 const safeBackground=/^#[0-9a-f]{3,8}$/i.test(background)?background:BRAND_MARK.background;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${edge}" height="${edge}" viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="15" fill="${safeBackground}" stroke="${BRAND_MARK.border}" stroke-width="1.5"/><path d="${BRAND_MARK.t}" fill="${BRAND_MARK.accent}"/><path d="${BRAND_MARK.line}" fill="none" stroke="${BRAND_MARK.accent}" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"/></svg>`;
}
