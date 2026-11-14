export class ClubStyleError extends Error{}
export const CLUB_STYLE_DEFAULTS=Object.freeze({color:'lime',pattern:'classic',crest:'shield',motto:'Én klub. Én drøm.'});
const choices={color:['lime','teal','blue','orange'],pattern:['classic','stripe','hoop'],crest:['shield','round','diamond']};
const validMotto=value=>typeof value==='string'&&value.trim().length<=48&&!/[\p{Cc}\p{Cf}<>]/u.test(value);

// Reads are pure so rendering a legacy save never writes new fields into it.
export function clubStyle(s){
 const saved=s?.clubStyle;
 return Object.fromEntries(Object.entries(CLUB_STYLE_DEFAULTS).map(([key,fallback])=>[key,key==='motto'?(validMotto(saved?.motto)?saved.motto.trim():fallback):(choices[key].includes(saved?.[key])?saved[key]:fallback)]));
}

export function styleAction(s,a){
 if(a.type!=='club-style')return false;
 const style=a.style;
 if(!style||typeof style!=='object'||Array.isArray(style)||Object.keys(style).some(key=>!Object.hasOwn(CLUB_STYLE_DEFAULTS,key)))throw new ClubStyleError('Vælg en gyldig klubstil.');
 for(const [key,values]of Object.entries(choices))if(!values.includes(style[key]))throw new ClubStyleError('Vælg en gyldig farve, trøje og klubmærke.');
 if(!validMotto(style.motto))throw new ClubStyleError('Klubbens motto må højst have 48 tegn og må ikke indeholde skjulte tegn eller HTML.');
 s.clubStyle={color:style.color,pattern:style.pattern,crest:style.crest,motto:style.motto.trim()};
 return true;
}
