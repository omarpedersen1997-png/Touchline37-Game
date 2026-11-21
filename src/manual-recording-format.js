// This checksum detects accidental local corruption. The server still replays
// and validates every input; this is not a signature or an anti-cheat system.
export function recordingChecksum(value) {
 let hash=2166136261;
 for(const character of JSON.stringify(value))hash=Math.imul(hash^character.codePointAt(0),16777619);
 return (hash>>>0).toString(16).padStart(8,'0');
}
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export function recordingIdentity(match) {
 return JSON.stringify(canonical({version:match.manual.version||match.manual.config?.matchVersion||1,seed:match.manual.seed,config:match.manual.config}));
}
export function sealRecording(record,match) {
 const content={...record,saveSchema:1,rulesIdentity:recordingIdentity(match)};
 return {...content,checksum:recordingChecksum(content)};
}
export function recordingMatches(saved,match) {
 if(!saved||saved.saveSchema===undefined)return true; // Existing recordings migrate on the next save.
 if(saved.saveSchema!==1||saved.rulesIdentity!==recordingIdentity(match))return false;
 const {checksum,...content}=saved;
 return checksum===recordingChecksum(content);
}
export function recordingBackup(match,record) {
 return {kind:'touchline-match-recording',schema:1,matchId:match.id,started:match.started,ends:match.ends,manual:match.manual,record};
}
