import test from 'node:test';
import assert from 'node:assert/strict';
import {abujaTime,jobSchedule,clubSchedule,seasonalWeather} from '../src/shared/simulation.mjs';
const at=s=>Date.parse(s+'+01:00');
test('Abuja calendar rolls over at UTC 23:00 with a real clock',()=>{
 const t=abujaTime(Date.parse('2026-10-04T23:15:00Z'));
 assert.equal(t.dateKey,'2026-10-05');assert.equal(t.hour,0);assert.equal(t.minute,15);assert.equal(t.dayName,'Monday');assert.equal(t.isNight,true);
 assert.equal(abujaTime(at('2026-10-05T12:00:00')).isNight,false);
});
test('Office shifts obey weekdays and exact opening boundaries',()=>{
 assert.equal(jobSchedule('bank-teller',{},at('2026-10-04T12:00:00')).canStart,false);
 assert.equal(jobSchedule('junior-dev',{},at('2026-10-05T07:59:59')).canStart,false);
 assert.equal(jobSchedule('junior-dev',{},at('2026-10-05T08:00:00')).availableSlot,'morning');
 assert.equal(jobSchedule('junior-dev',{},at('2026-10-05T12:00:00')).availableSlot,'afternoon');
 assert.equal(jobSchedule('junior-dev',{},at('2026-10-05T17:00:00')).canStart,false);
});
test('Two daily shifts and slot completion apply across careers and reset on the Lagos date',()=>{
 const p={workDays:{'2026-10-05':{completed:1,slots:['morning']}}};
 assert.equal(jobSchedule('bank-teller',p,at('2026-10-05T10:00:00')).canStart,false);
 assert.equal(jobSchedule('bank-teller',p,at('2026-10-05T13:00:00')).availableSlot,'afternoon');
 p.workDays['2026-10-05']={completed:2,slots:['morning','afternoon']};
 assert.equal(jobSchedule('restaurant-host',p,at('2026-10-05T19:00:00')).remainingToday,0);
 assert.equal(jobSchedule('bank-teller',p,at('2026-10-06T09:00:00')).remainingToday,2);
});
test('Restaurant shifts include weekends while office next availability skips Sunday',()=>{
 assert.equal(jobSchedule('restaurant-host',{},at('2026-10-04T20:00:00')).canStart,true);
 assert.equal(jobSchedule('bank-teller',{},at('2026-10-04T20:00:00')).nextAvailableAt,at('2026-10-05T08:00:00'));
});
test('Club nights cross midnight and end at exactly 02:00; daytime visits remain allowed',()=>{
 assert.equal(clubSchedule(at('2026-10-02T20:00:00')).isOpen,true);
 assert.equal(clubSchedule(at('2026-10-03T01:59:59')).isOpen,true);
 assert.equal(clubSchedule(at('2026-10-03T02:00:00')).isOpen,false);
 assert.equal(clubSchedule(at('2026-10-04T01:00:00')).isOpen,true);
 assert.equal(clubSchedule(at('2026-10-05T01:00:00')).isOpen,false);
 assert.equal(clubSchedule(at('2026-10-05T12:00:00')).canEnter,true);
});
test('Seasonal atmosphere is deterministic and explicitly not live weather',()=>{
 const t=at('2026-08-02T16:00:00'),w=seasonalWeather(t);assert.deepEqual(w,seasonalWeather(t));assert.equal(w.verified,false);assert.equal(w.source,'seasonal-simulation');assert.match(w.label,/game weather/);
});

import {buildInterior,homeDesignPreservesRoutes} from '../app/world-interiors.js';
test('A bespoke origin home uses its authored layout and keeps every room accessible after decoration',()=>{
 const profile={home:{propertyId:'origin-home-resident',layoutId:'garki-studio',name:'Family home'},location:{kind:'home'},inventory:[]};
 const safe={wall:'sage',floor:'tile',partitions:[{id:'side',x:.7,y:.78,w:.02,h:.12}]};
 assert.equal(homeDesignPreservesRoutes(profile,safe),true);
 const scene=buildInterior({profile:{...profile,home:{...profile.home,roomStyle:safe}}});
 assert.equal(scene.width,1120);assert.equal(scene.title,'Family home');assert.equal(scene.floorMaterial,'tile');assert.equal(scene.walls.at(-1).id,'side');
 assert.equal(homeDesignPreservesRoutes(profile,{...safe,partitions:[{id:'blocks-bed',x:.08,y:.12,w:.2,h:.02}]}),false);
 assert.equal(homeDesignPreservesRoutes(profile,{...safe,partitions:[{id:'trap',x:0,y:.55,w:.8,h:.025}]}),false);
});
