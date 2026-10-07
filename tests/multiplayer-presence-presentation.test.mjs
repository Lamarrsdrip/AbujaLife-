import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {streetPresenceMode,streetResidentSnapshot} from '../app/world-presence.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('public World uses tag-only multiplayer while homes and buildings keep resident avatars',()=>{
  assert.equal(streetPresenceMode({location:{kind:'public'}}),true);
  assert.equal(streetPresenceMode({}),true);
  assert.equal(streetPresenceMode({location:{kind:'home'}}),false);
  assert.equal(streetPresenceMode({location:{kind:'visit'}}),false);
  assert.equal(streetPresenceMode({location:{kind:'venue',venue:'hotel'}}),false);
  assert.equal(streetPresenceMode({activeTrip:{id:'trip-1'},location:{kind:'public'}}),false);
});

test('street tag snapshot is real online presence only, excludes self and remains bounded',()=>{
  const people=Array.from({length:65},(_,i)=>({id:`r${i}`,username:`resident${i}`,online:true,pose:{x:100+i,y:200+i}}));
  people.push({id:'self',username:'me',online:true,pose:{x:1,y:1}});
  people.push({id:'offline',username:'offline',online:false,pose:{x:2,y:2}});
  people.push({id:'nopose',username:'nopose',online:true});
  const result=streetResidentSnapshot(people,'self');
  assert.equal(result.length,50);
  assert.equal(result.some(person=>person.id==='self'),false);
  assert.equal(result.some(person=>person.id==='offline'),false);
  assert.ok(result.every(person=>Number.isFinite(person.pose.x)&&Number.isFinite(person.pose.y)));
});

test('free-roam adapter removes remote bodies only on streets and preserves realtime tag updates',async()=>{
  const source=await read('app/world-free-roam.js');
  assert.match(source,/streetPresenceMode\(profile\)/);
  assert.match(source,/tagsOnly\?\{\.\.\.options,people:\[\]\}:options/);
  assert.match(source,/streetPresence\?\.updateResidents\(next\)/);
  assert.match(source,/simulatorUpdateResidents\?\.\(\[\]\)/);
  assert.match(source,/streetPresence\?\.updateResidentPose\(data\)/);
  assert.match(source,/resident-avatars/);
});

test('street layer contains names and online markers only; interior simulator still owns full people',async()=>{
  const presence=await read('app/world-presence.js');
  const simulator=await read('app/world-simulator.js');
  assert.match(presence,/world-street-resident-tag/);
  assert.match(presence,/live resident nearby/);
  assert.doesNotMatch(presence,/movingResident|createCharacterModel|resident-avatar/);
  assert.match(simulator,/\$\{movingResident\(person\.appearance\)\}/);
  assert.match(simulator,/online-resident-label/);
});
