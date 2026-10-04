import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHomeDesign, readHomeDesign, DEFAULT_HOME_DESIGN, HOME_WALL_COLORS, HOME_FLOORS } from '../src/shared/home-design.mjs';

test('home styles preserve exact accepted geometry and create independent copies',()=>{
  const divider={id:'reading-nook',x:.1723456789,y:.5123456789,w:.21123456789,h:.01323456789};
  const input={wall:'sage',floor:'darkoak',partitions:[divider]};
  const saved=validateHomeDesign(input);
  assert.deepEqual(saved,input);
  saved.partitions[0].x=.3;
  assert.equal(input.partitions[0].x,.1723456789);
  assert.deepEqual(validateHomeDesign({}),DEFAULT_HOME_DESIGN);
  for(const wall of HOME_WALL_COLORS)for(const floor of HOME_FLOORS)assert.deepEqual(validateHomeDesign({wall:wall.id,floor:floor.id}),{wall:wall.id,floor:floor.id,partitions:[]});
});

test('malformed, unbounded and non-wall dividers cannot reach the renderer',()=>{
  const divider={id:'wall',x:.2,y:.3,w:.2,h:.02};
  for(const changes of [{x:-.1},{y:NaN},{w:Infinity},{h:'0.02'},{w:0},{x:.95},{w:1.1},{h:.2},{id:'<script>'}])assert.throws(()=>validateHomeDesign({partitions:[{...divider,...changes}]}));
  assert.throws(()=>validateHomeDesign({partitions:[divider,{...divider}]}),/own valid ID/);
  assert.equal(validateHomeDesign({partitions:Array.from({length:13},(_,i)=>({...divider,id:`wall-${i}`}))}).partitions.length,13);
  assert.throws(()=>validateHomeDesign({partitions:[{...divider,price:-1}]}));
  assert.throws(()=>validateHomeDesign({wall:'remote://texture'}));
  assert.throws(()=>validateHomeDesign({floor:'marble'}));
  assert.throws(()=>validateHomeDesign({wallet:99999}));
  assert.throws(()=>validateHomeDesign([]));
});

test('old homes and damaged local style data recover without changing the resident profile',()=>{
  const profile={home:{name:'Garki starter studio',roomStyle:{wall:'invalid'}},wallet:26000};
  const before=structuredClone(profile);
  assert.deepEqual(readHomeDesign(profile),DEFAULT_HOME_DESIGN);
  assert.deepEqual(profile,before);
  assert.deepEqual(readHomeDesign({home:{roomStyle:{wall:'ivory',floor:'tile',partitions:[]}}}),{wall:'ivory',floor:'tile',partitions:[]});
});
