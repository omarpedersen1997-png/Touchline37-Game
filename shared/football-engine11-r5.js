import * as base from './football-engine11-r4.js';
import { isR5Command } from './football-r5-dynamics.js';

export { ARCADE_VERSION, INPUT_MS, STEP_MS, FIELD,
  stepArcade, passTarget, directionMask
} from './football-engine11-r4.js';

export const ENGINE_REVISION = 5;
export const INPUT_COUNT=base.R5_INPUT_COUNT;
export const DURATION_MS=INPUT_COUNT*base.INPUT_MS;
export function createArcade(seed, config) {
  return base.createVersionedArcade(seed, config, ENGINE_REVISION);
}
export function validateMask(mask) {
  return isR5Command(mask) || base.validateMask(mask);
}
export const encodeInputs=inputs=>base.encodeInputs(inputs,validateMask,INPUT_COUNT);
export const decodeInputs=packet=>base.decodeInputs(packet,validateMask,INPUT_COUNT);
export function replayArcade(seed, config, inputs) {
  if (inputs.length !== INPUT_COUNT) throw Error('Ufuldstændigt kampforløb.');
  const state = createArcade(seed, config);
  for (const input of inputs) base.stepArcade(state, input);
  return state;
}
