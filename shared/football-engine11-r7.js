import { createVersionedArcade, stepArcade } from './football-engine11-r4.js';
import { INPUT_COUNT } from './football-engine11-r5.js';

export { ARCADE_VERSION, INPUT_MS, STEP_MS, DURATION_MS, FIELD, INPUT_COUNT,
  stepArcade, passTarget, directionMask, validateMask, encodeInputs, decodeInputs
} from './football-engine11-r5.js';

export const ENGINE_REVISION = 7;
export const createArcade = (seed, config) => createVersionedArcade(seed, config, ENGINE_REVISION);

export function replayArcade(seed, config, inputs) {
  if (inputs.length !== INPUT_COUNT) throw Error('Ufuldstændigt kampforløb.');
  const state = createArcade(seed, config);
  for (const input of inputs) stepArcade(state, input);
  return state;
}
