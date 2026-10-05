// Original synthesized club rhythm. No recordings, samples, or third-party songs.
export function createClubAudio({enabled=true,onState=()=>{},mode='club'}={}) {
  let context,master,timer,next=0,step=0,optedIn=false,active=false,disposed=false;
  function note(frequency,at,duration,type='sine',volume=.08,endFrequency){
    const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=type;
    oscillator.frequency.setValueAtTime(frequency,at);if(endFrequency)oscillator.frequency.exponentialRampToValueAtTime(endFrequency,at+duration);
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    oscillator.connect(gain);gain.connect(master);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};oscillator.start(at);oscillator.stop(at+duration+.01);
  }
  function schedule(){if(!active||!context||disposed)return;while(next<context.currentTime+.12){
    if(mode!=='club'){
      // A restrained, original Abuja ambience: a warm pad with occasional
      // bell-like city texture. It is intentionally sparse for mobile battery.
      const beat=step%16;
      if(beat===0)note(196,next,.52,'sine',.035,220);
      if(beat===6||beat===14)note(523.25,next,.12,'triangle',.018,659.25);
      if(beat===10)note(392,next,.16,'sine',.012,349.23);
      step++;next+=60/72/4;continue;
    }
    const beat=step%16;
    if(beat%4===0)note(125,next,.23,'sine',.3,42);
    if(beat===4||beat===12){note(195,next,.09,'triangle',.06);note(1420,next+.018,.055,'triangle',.03);}
    if(beat%2===0)note(7100,next,.025,'square',.012,3900);
    if([0,3,6,8,11,14].includes(beat)){const tones=[65.41,77.78,87.31,98];note(tones[Math.floor(step/16)%4],next,.18,'triangle',.085);}
    step++;next+=60/102/4;
  }}
  function sync(){const run=optedIn&&active&&!disposed;if(run){context.resume().catch(()=>{});next=context.currentTime+.04;if(!timer)timer=setInterval(schedule,25);}else{clearInterval(timer);timer=null;context?.suspend().catch(()=>{});}onState(run);}
  return {
    async toggle(){if(!enabled||disposed)return false;const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;
      if(!context){context=new Audio();master=context.createGain();master.gain.value=.48;master.connect(context.destination);}
      optedIn=!optedIn;if(optedIn)await context.resume();sync();return optedIn;
    },
    setActive(value){if(active===value)return;active=!!value;sync();},
    dispose(){disposed=true;clearInterval(timer);context?.close().catch(()=>{});}
  };
}
