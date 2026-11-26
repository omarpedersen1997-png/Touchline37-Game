export function matchAudio(){
  let audio, enabled=false;
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
