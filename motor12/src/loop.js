import { PHASE, stepMatch } from './engine.js';
import { STEP, clamp } from './physics.js';

export function createMatchLoop(state){
  const previous=new Float32Array(47), scratch={};
  let remainder=0, last=null;
  const capture=()=>{
    let i=0;
    for(const team of state.teams)for(const p of team.players){previous[i++]=p.x;previous[i++]=p.y;}
    previous[44]=state.ball.x;previous[45]=state.ball.y;previous[46]=state.ball.z;
  };
  const reset=()=>{last=null;remainder=0;capture();};
  reset();
  return {previous,reset,advance(now,rate=1){
    if(last===null){last=now;return 1;}
    const elapsed=clamp((now-last)/1000,0,.1);
    last=now;
    remainder+=elapsed*rate;
    while(remainder>=STEP){
      capture();
      if(!stepMatch(state,scratch)){reset();return 1;}
      remainder-=STEP;
      if(state.phase!==PHASE.PLAYING&&state.phase!==PHASE.DEAD_BALL){reset();return 1;}
    }
    return remainder/STEP;
  }};
}
