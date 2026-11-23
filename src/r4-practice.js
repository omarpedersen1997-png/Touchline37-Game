import * as rules from '../shared/football-engine11-r4.js';
const {DURATION_MS,INPUT_COUNT}=rules;

// Practice lives only for the mounted component. Neither match recording nor
// preferences share storage with account-backed matches.
export function createR4Practice(epoch = Date.now()) {
  const values = new Map();
  const storage = {
    key(index) { return [...values.keys()][index] ?? null; },
    get length() { return values.size; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key,value) { values.set(key,String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const match = {
    id:'r4-practice-'+epoch, started:epoch, ends:epoch+DURATION_MS, opponent:'Havneby IF', home:0, away:0,
    manual:{
      version:11, seed:'touchline-r4-'+epoch, duration:DURATION_MS, inputCount:INPUT_COUNT,
      expiresAt:epoch+DURATION_MS, config:{matchVersion:11,engineRevision:4,homeRating:65,awayRating:61,formation:'4-3-3',stadiumStage:2},
    },
  };
  let elapsed=0,last=null,paused=true;
  function advance(at) {
    if (last!==null && !paused) elapsed+=Math.max(0, at-last);
    last=at;
    return match.started+elapsed;
  }
  return {
    match,storage,rules,
    now:advance,
    pause(value,at) { if (value!==paused) {advance(at);paused=value;} },
  };
}
