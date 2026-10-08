import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeAdCampaigns,mergeAdSnapshot,activeAdAt} from '../app/ad-state.js';
const now=1000;

test('full advertising snapshots are authoritative and contain no invented campaigns',()=>{
 const paid={txRef:'paid',slots:['plot-01'],startAt:1,endAt:2000,imageDataUrl:'paid'};
 const platform={txRef:'abjl_ad_admin_1',slots:['ad:city-frontage:10:10'],startAt:1,endAt:253402300799999,imageDataUrl:'platform',platform:true,billing:false};
 const state=mergeAdSnapshot(null,{pricing:{amount:2000},active:[paid,platform],serverTime:now});
 assert.equal(state.active.length,2);assert.equal(state.active[0].txRef,'paid');assert.equal(state.active[1].billing,false);
 assert.equal(mergeAdSnapshot(state,{pricing:{amount:2000},active:[],serverTime:now}).active.length,0);
});

test('bounded viewport snapshots retain offscreen campaigns but replace matching creatives',()=>{
 const paid={txRef:'paid',slots:['plot-01'],startAt:1,endAt:2000,imageDataUrl:'old'};
 assert.equal(mergeAdCampaigns([paid],{serverTime:now,active:[]}).length,1);
 assert.equal(mergeAdCampaigns([paid],{serverTime:now,active:[{...paid,imageDataUrl:'new'}]})[0].imageDataUrl,'new');
});

test('campaigns expire by server time and permanent data requires an explicit permanent flag',()=>{
 const paid={txRef:'paid',slots:['plot-01'],startAt:1,endAt:2000};
 assert.equal(activeAdAt(paid,now),true);assert.equal(activeAdAt(paid,2000),false);
 assert.equal(activeAdAt({...paid,endAt:null},now),false);
 assert.equal(activeAdAt({...paid,endAt:null,permanent:true},now),true);
});

test('campaign cache stays bounded',()=>{
 const base={slots:['plot-01'],startAt:1,endAt:2000};
 const result=mergeAdCampaigns([],{serverTime:now,active:Array.from({length:300},(_,i)=>({...base,txRef:`paid-${i}`}))});
 assert.equal(result.length,240);
});
