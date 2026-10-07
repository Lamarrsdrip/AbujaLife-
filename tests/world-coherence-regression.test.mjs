import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCity} from '../app/world-city.js';
import {buildInterior} from '../app/world-interiors.js';
import {venueFor,venuesForDistrict} from '../src/shared/life.mjs';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('playable Abuja landmarks use spaced world blocks while the geographic map registry stays canonical',()=>{
  const scene=buildCity({profile:{district:'maitama'},place:{id:'maitama',name:'Maitama'},venues:venuesForDistrict('maitama'),id:'coherence'});
  const ids=['transcorp-hilton-hub','millennium-park-hub','inec-hq'];
  const points=ids.map(id=>scene.interactables.find(point=>point.id===id));
  assert.ok(points.every(Boolean),'Maitama landmark entrances must exist in the playable world');
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
    assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>500,`${ids[i]} and ${ids[j]} must not be jam-packed together`);
  }
  assert.ok(scene.width>8500,'new destinations extend the established free-roam quarter');
});

test('landmark interiors route by real activity instead of falling through to the restaurant room',()=>{
  const samples=[
    ['inec-hq','estate-office','INEC HEADQUARTERS'],
    ['airport-hub','estate-office','NNAMDI AZIKIWE INTERNATIONAL AIRPORT'],
    ['international-conference-centre','cinema','INTERNATIONAL CONFERENCE CENTRE'],
    ['jabi-lake-mall','furniture-store','JABI LAKE MALL'],
    ['national-stadium-hub','gym','MOSHOOD ABIOLA NATIONAL STADIUM'],
    ['transcorp-hilton-hub','hotel','TRANSCORP HILTON ABUJA'],
  ];
  for(const [id,template,label] of samples){
    const venue=venueFor(id);
    const scene=buildInterior({profile:{location:{kind:'venue',venue:id}},venue,id:`test-${id}`});
    assert.equal(scene.venueLayout?.template,template,id);
    assert.match(scene.art,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),id);
    assert.doesNotMatch(scene.art,/THE COURTYARD/i,`${id} must not use the restaurant fallback`);
    assert.ok(scene.interactables.some(point=>point.payload?.venueId===id||point.id==='door'),`${id} keeps venue-specific interactions`);
  }
});

test('Capital Palm Hotel exposes a hotel-purpose scene instead of a generic room identity',()=>{
  const id='hotel',venue=venueFor(id);
  const scene=buildInterior({profile:{location:{kind:'venue',venue:id}},venue,id:'test-capital-palm'});
  assert.equal(scene.venueLayout?.template,'hotel');
  assert.deepEqual(scene.venueLayout?.zones,['reception','lounge','guest-room','spa']);
  assert.match(scene.art,/CAPITAL PALM HOTEL/);
  assert.match(scene.art,/RECEPTION/);
});

test('phone destination handoff closes the handset before civic travel continues',async()=>{
  const bridge=await read('app/civic-travel-phone-bridge.js');
  const freeRoam=await read('app/world-free-roam.js');
  const index=await read('app/index.html');
  assert.match(bridge,/data-civic-travel/);
  assert.match(bridge,/data-ph-action=["']close["']/);
  assert.match(bridge,/capture:true/);
  assert.match(freeRoam,/import ['"]\.\/civic-travel-phone-bridge\.js['"]/);
  assert.doesNotMatch(index,/src=["']\/civic-travel-phone-bridge\.js["']/);
});

test('play-mode roof labels are smaller and collision-decluttered without changing Map UI',async()=>{
  const presentation=await read('app/world-presentation.js');
  const freeRoam=await read('app/world-free-roam.js');
  assert.match(presentation,/max-width:126px/);
  assert.match(presentation,/overlaps=/);
  assert.match(presentation,/shown>=limit/);
  assert.match(freeRoam,/polishWorldPresentation/);
  assert.doesNotMatch(presentation,/outside-city|game-map|map-marker/i);
});

test('city stats exclude hidden presence and never report all-time visits below registered residents',async()=>{
  const stats=await read('src/server/cityStats.mjs');
  assert.match(stats,/presenceVisible:\s*\{\s*\$ne:\s*false\s*\}/);
  assert.match(stats,/Math\.max\(totalPlayerCount,\s*trackedVisitsAllTime\)/);
});
