export function matchAudio(){
  let audio,crowd,enabled=false;
  const voices=new Set();
  return {
    async enable(value){
      enabled=value;
      if(!enabled){for(const tone of voices){try{tone.stop();}catch{}}return;}
      try {
        if(!audio){const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(Context)audio=new Context();}
        await audio?.resume();
      }catch{}
    },
    whistle(kind){
      if(!enabled||audio?.state!=='running'||document.hidden)return;
      if(kind==='goal'||kind==='kickoff'){
        if(!crowd){
          crowd=audio.createBuffer(1,audio.sampleRate,audio.sampleRate);
          const samples=crowd.getChannelData(0);let previous=0;
          for(let i=0;i<samples.length;i++){previous=.88*previous+.12*(Math.random()*2-1);samples[i]=previous;}
        }
        const noise=audio.createBufferSource(),gain=audio.createGain(),filter=audio.createBiquadFilter();
        noise.buffer=crowd;noise.loop=true;filter.type='bandpass';filter.frequency.value=780;filter.Q.value=.55;
        const t=audio.currentTime,duration=kind==='goal'?1.7:.75;
        gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(kind==='goal'?.32:.12,t+.21);
        gain.gain.exponentialRampToValueAtTime(.001,t+duration);
        noise.connect(filter);filter.connect(gain);gain.connect(audio.destination);voices.add(noise);
        noise.onended=()=>{voices.delete(noise);noise.disconnect();filter.disconnect();gain.disconnect();};
        noise.start(t);noise.stop(t+duration);
      }
      const series=kind==='full'?[0,.15,.33]:kind==='goal'?[0,.16]:[0];
      for(const offset of series){
        const start=audio.currentTime+offset+.018, stop=start+.17;
        const tone=audio.createOscillator(), gain=audio.createGain();
        tone.type='sine';tone.frequency.setValueAtTime(2360,start);
        tone.frequency.linearRampToValueAtTime(2870,start+.045);
        tone.frequency.linearRampToValueAtTime(2540,stop);
        gain.gain.setValueAtTime(.0001,start);
        gain.gain.exponentialRampToValueAtTime(.075,start+.024);
        gain.gain.exponentialRampToValueAtTime(.0001,stop);
        tone.connect(gain);gain.connect(audio.destination);
        if(voices.size>=6)break;
        voices.add(tone);
        tone.onended=()=>{voices.delete(tone);tone.disconnect();gain.disconnect();};
        tone.start(start);tone.stop(stop);
      }
    }
  };
}
