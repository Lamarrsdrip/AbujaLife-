import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeAdCampaigns,mergeAdSnapshot,activeAdAt} from '../app/ad-state.js';
import {OKRIKA_HOUSE_CAMPAIGNS} from '../src/shared/okrika-house-ads.mjs';
const now=1000;
const houses=OKRIKA_HOUSE_CAMPAIGNS.map(c=>({...c,startAt:null,endAt:null}));
const manifest=rows=>rows.map(c=>({campaignId:c.campaignId,slotId:c.slotId}));

test('the real client retains all twenty distinct permanent house campaigns without payment references',()=>{
 assert.equal(mergeAdSnapshot(null,{active:houses,serverTime:now}).active.length,20);
 const initial=mergeAdCampaigns([],{active:houses,serverTime:now,housePlacements:manifest(houses)});
 assert.equal(initial.length,20);assert.equal(new Set(initial.map(c=>c.campaignId)).size,20);
 const paid={txRef:'paid',slots:['plot-01'],startAt:1,endAt:2000};
 const next=mergeAdCampaigns(initial,{active:[paid],serverTime:now,housePlacements:manifest(houses)});
 assert.equal(next.length,21);assert.equal(next[0].txRef,'paid');
 assert.equal(activeAdAt({...paid,endAt:null},now),false);
 assert.equal(activeAdAt({...houses[0],enabled:false},now),false);
});

test('viewport snapshots remove disabled and moved cached houses without reloading offscreen creatives',()=>{
 const moved={...houses[1],slotId:houses[2].slotId,slots:[houses[2].slotId]};
 const available=[moved,...houses.slice(3)];
 const result=mergeAdCampaigns(houses,{serverTime:now,housePlacements:manifest(available),active:[moved]});
 assert.equal(result.length,18);
 assert.equal(result.some(c=>c.id===houses[0].id),false);
 assert.equal(result.find(c=>c.id===moved.id).slotId,moved.slotId);
 assert.equal(result.some(c=>c.id===houses[2].id),false);
 assert.equal(mergeAdCampaigns(houses,{serverTime:now,housePlacements:[],active:[]}).length,0);
});

test('paid campaigns retain bounded viewport cache, expire, and replace creatives by authoritative identity',()=>{
 const paid={txRef:'paid',slots:['plot-01'],endAt:2000,imageDataUrl:'old'};
 assert.equal(mergeAdCampaigns([paid],{serverTime:now,active:[]}).length,1);
 assert.equal(mergeAdCampaigns([paid],{serverTime:2000,active:[]}).length,0);
 assert.equal(mergeAdCampaigns([paid],{serverTime:now,active:[{...paid,imageDataUrl:'new'}]})[0].imageDataUrl,'new');
 assert.equal(mergeAdCampaigns([],{serverTime:now,active:Array.from({length:300},(_,i)=>({...paid,txRef:`paid-${i}`}))}).length,240);
});

test('out-of-order viewport replies cannot resurrect a disabled campaign after newer admin settings',()=>{
 const newer={active:[],houseRevision:3,housePlacements:[]};
 const delayed={active:houses,houseRevision:2,housePlacements:manifest(houses),serverTime:now};
 const state=mergeAdSnapshot(newer,delayed);
 assert.equal(state.houseRevision,3);assert.equal(state.active.length,0);
});
