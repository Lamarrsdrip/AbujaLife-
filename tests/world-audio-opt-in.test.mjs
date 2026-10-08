import test from 'node:test';
import assert from 'node:assert/strict';
import { createClubAudio } from '../app/world-audio.js';

class FakeAudioContext {
  constructor(){this.currentTime=0;this.destination={};this.state='suspended';}
  createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
  createOscillator(){return{frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(){},stop(){}};}
  async resume(){this.state='running';}
  async suspend(){this.state='suspended';}
  async close(){this.state='closed';}
}

test('audio opt-in stays enabled while playback is paused and can be switched off',async()=>{
  const original=globalThis.AudioContext,states=[];globalThis.AudioContext=FakeAudioContext;
  try{
    const audio=createClubAudio({onState:state=>states.push(state)});
    assert.equal(await audio.toggle(),true);
    assert.deepEqual(states.at(-1),{enabled:true,playing:false});
    audio.setActive(true);
    assert.deepEqual(states.at(-1),{enabled:true,playing:true});
    audio.setActive(false);
    assert.deepEqual(states.at(-1),{enabled:true,playing:false});
    assert.equal(await audio.toggle(),false);
    assert.deepEqual(states.at(-1),{enabled:false,playing:false});
    audio.dispose();
  }finally{if(original===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=original;}
});

test('audio stays off when the browser has no Web Audio support',async()=>{
  const original=globalThis.AudioContext,states=[];delete globalThis.AudioContext;
  try{
    const audio=createClubAudio({onState:state=>states.push(state)});
    assert.equal(await audio.toggle(),false);
    assert.deepEqual(states,[]);
    audio.dispose();
  }finally{if(original!==undefined)globalThis.AudioContext=original;}
});
