import test from 'node:test';
import assert from 'node:assert/strict';
import { playableSceneKey } from '../app/scene-lifecycle.js';

const resident=()=>({profile:{id:'owner',onboardingComplete:true,district:'jabi',location:{kind:'home'},home:{propertyId:'a',layoutId:'jabi-apartment'},inventory:['sofa'],furnitureLayout:{sofa:{propertyId:'a',x:.4,y:.5}}}});
test('wallet and delayed realtime refreshes retain the same physical scene',()=>{
  const state=resident(),key=playableSceneKey('world',state);
  const refreshed=structuredClone(state);refreshed.profile.wallet=100;refreshed.profile.energy=50;
  refreshed.nearby=[{id:'guest',pose:{x:5,y:10}}];refreshed.serverTime=123;
  assert.equal(playableSceneKey('world',refreshed),key);
  assert.equal(playableSceneKey('world',structuredClone(refreshed)),key);
});
test('home placement, real travel, and accepted visits change the physical scene',()=>{
  const original=resident(),key=playableSceneKey('world',original);
  for(const mutate of [s=>s.profile.furnitureLayout.sofa.x=.6,s=>s.profile.home.propertyId='b',s=>s.profile.activeTrip={id:'trip'},s=>s.profile.location={kind:'venue',venueId:'inec'},s=>s.profile.vehiclePresence={itemId:'car',district:'jabi'}]){
    const state=structuredClone(original);mutate(state);assert.notEqual(playableSceneKey('world',state),key);
  }
  const visit=resident();visit.profile.location={kind:'visit',ownerId:'other'};
  visit.homeVisit={ownerHome:{home:{propertyId:'host'},inventory:[],furnitureLayout:{}}};
  const first=playableSceneKey('world',visit);visit.homeVisit.ownerHome.home.roomStyle={wall:'sage'};
  assert.notEqual(playableSceneKey('world',visit),first);
});
