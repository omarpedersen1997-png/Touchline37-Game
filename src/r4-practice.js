import * as r4 from '../shared/football-engine11-r4.js';
import * as r5 from '../shared/football-engine11-r5.js';
import * as r6 from '../shared/football-engine11-r6.js';

// Practice lives only for the mounted component. Neither match recording nor
// preferences share storage with account-backed matches.
export function createR4Practice(epoch = Date.now(), {revision=4,surface='dry'} = {}) {
  const rules=revision===6?r6:revision===5?r5:r4;
  const {DURATION_MS,INPUT_COUNT,ENGINE_REVISION:engineRevision}=rules;
  const id='r'+engineRevision;
  const values = new Map();
  const storage = {
    key(index) { return [...values.keys()][index] ?? null; },
    get length() { return values.size; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key,value) { values.set(key,String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const match = {
    id:id+'-practice-'+epoch, started:epoch, ends:epoch+DURATION_MS, opponent:'Havneby IF', home:0, away:0,
    manual:{
      version:11, seed:'touchline-'+id+'-'+epoch, duration:DURATION_MS, inputCount:INPUT_COUNT,
      expiresAt:epoch+DURATION_MS, config:{matchVersion:11,engineRevision,...(engineRevision>=5?{surface}:{}),homeRating:65,awayRating:61,formation:'4-3-3',stadiumStage:2},
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
