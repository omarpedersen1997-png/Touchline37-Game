// Scoreboard codes are deliberate abbreviations; the accessible title retains
// the full club name. Never truncate a word with an ellipsis in the live HUD.
export function clubCode(name='') {
 const parts=String(name).trim().split(/\s+/).filter(Boolean);
 const clean=value=>value.replace(/[^\p{L}\p{N}]/gu,'');
 const words=parts.map(clean).filter(Boolean);
 if(!words.length)return 'TL';
 if(words.length===1)return words[0].slice(0,3).toLocaleUpperCase('da-DK');
 const first=words[0].slice(0,2),last=words.at(-1).slice(0,2);
 return (first+last).toLocaleUpperCase('da-DK');
}
