import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const write=(file,content)=>fs.writeFileSync(path.join(root,file),content);

function replaceExact(source,search,replacement,label){
  const first=source.indexOf(search);
  if(first<0)throw new Error(`Missing target: ${label}`);
  if(source.indexOf(search,first+search.length)>=0)throw new Error(`Ambiguous target: ${label}`);
  return source.slice(0,first)+replacement+source.slice(first+search.length);
}

let life=read('src/shared/life.mjs');
life=replaceExact(
  life,
  "  const seconds = mode === 'walk' || !distance ? 1 : Math.min(14, Math.max(4, Math.round(distance / (mode === 'bus' ? 2.5 : 4))));",
  "  const seconds = mode === 'walk' || !distance ? 1 : 10 + Math.min(14, Math.max(4, Math.round(distance / (mode === 'bus' ? 2.5 : 4))));",
  'travel duration +10 seconds'
);
const venueStart=life.indexOf('export const VENUE_ACTIONS = [');
const venueEnd=life.indexOf('\n];\n\nconst venue =',venueStart);
if(venueStart<0||venueEnd<0)throw new Error('Could not locate VENUE_ACTIONS block');
const venueBlock=life.slice(venueStart,venueEnd);
const originalDurations=[...venueBlock.matchAll(/duration:\s*(\d+)/g)].map(match=>Number(match[1]));
if(originalDurations.length<25)throw new Error(`Expected venue activities, found ${originalDurations.length}`);
if(originalDurations.some(value=>value>=10))throw new Error(`Venue durations no longer match expected pre-upgrade values: ${originalDurations.join(',')}`);
const upgradedVenueBlock=venueBlock.replace(/duration:\s*(\d+)/g,(_,value)=>`duration: ${Number(value)+10}`);
life=life.slice(0,venueStart)+upgradedVenueBlock+life.slice(venueEnd);
life=replaceExact(life,"{ ...venue('club', 'Tokyo', 'Nightlife', 'A premium game club with a DJ floor and VIP lounge. A game interpretation of the name supplied by a player.'), kind: 'club', style: 'premium', settingSource: 'authored-game-scenery', nameSource: 'player-provided', pricesVerified: false },","{ ...venue('club', 'Tokyo', 'Nightlife', 'A late-night AbujaLife club built around a packed LED dance floor, live DJ booth, moving colour, VIP seating and a full bar.'), kind: 'club', style: 'premium', settingSource: 'authored-game-scenery', nameSource: 'player-provided', pricesVerified: false },",'Tokyo description');
life=replaceExact(life,"{ ...venue('club-cage', 'Cage', 'Nightlife', 'A high-energy game dance club with a drinks bar and music. A game interpretation of the name supplied by a player.'), kind: 'club', style: 'dance', districts: ['wuse-ii-a07'], settingSource: 'authored-game-scenery', nameSource: 'player-provided', pricesVerified: false },","{ ...venue('club-cage', 'Cage', 'Nightlife', 'A high-energy dance room with a packed floor, lighting rig, DJ sound, drinks bar and nonstop movement.'), kind: 'club', style: 'dance', districts: ['wuse-ii-a07'], settingSource: 'authored-game-scenery', nameSource: 'player-provided', pricesVerified: false },",'Cage description');
life=replaceExact(life,"{ ...venue('magic-city', 'Magic City', 'Nightlife', 'A game stage and lounge with evening entertainment and a VIP corner. A game interpretation of the name supplied by a player.'), kind: 'club', style: 'stage-lounge', districts: ['garki-ii'], settingSource: 'authored-game-scenery', nameSource: 'player-provided', pricesVerified: false },","{ ...venue('magic-city', 'Magic City', 'Nightlife', 'A vivid performance club with a lit stage, dancers, audience energy, lounge seating and a premium VIP corner.'), kind: 'club', style: 'stage-lounge', districts: ['garki-ii'], settingSource: 'authored-game-scenery', nameSource: 'player-provided', pricesVerified: false },",'Magic City description');
life=replaceExact(life,"{ ...venue('bear-barn', 'Bear Barn', 'Nightlife', 'A relaxed game bar and music lounge for drinks, small chops and conversation. A game interpretation of the name supplied by a player.'), kind: 'club', style: 'casual-bar', districts: ['jabi'], settingSource: 'authored-game-scenery', nameSource: 'player-provided', pricesVerified: false },","{ ...venue('bear-barn', 'Bear Barn', 'Nightlife', 'A warm late-night music bar with a busy counter, groups hanging out, small chops, conversation and a relaxed dance corner.'), kind: 'club', style: 'casual-bar', districts: ['jabi'], settingSource: 'authored-game-scenery', nameSource: 'player-provided', pricesVerified: false },",'Bear Barn description');
write('src/shared/life.mjs',life);

let app=read('app/app.js');
app=replaceExact(
  app,
  "document.querySelector('#confirm-interaction').onclick=()=>{closeSheet();const complete=async()=>{if(await action(name))toast('A little better than before.');};if(cleanup?.animateActivity)cleanup.animateActivity(name==='relax'?'rest':name,({sleep:8,shower:6,relax:6,eat:5,exercise:8})[name]||5,complete);else complete();};",
  "document.querySelector('#confirm-interaction').onclick=()=>{closeSheet();const complete=async()=>{if(await action(name))toast('A little better than before.');};if(cleanup?.animateActivity)cleanup.animateActivity(name==='relax'?'rest':name,({sleep:18,shower:16,relax:16,eat:15,exercise:18})[name]||15,complete);else complete();};",
  'home activity duration +10 seconds'
);
app=replaceExact(
  app,
  "${closed?'The DJ is off duty; look around and come back for the night.':'The set is on.'}",
  "${closed?'House lights are up; explore the room and come back when the night starts.':'DJ live · dance floor active · lights moving.'}",
  'nightlife venue status copy'
);
write('app/app.js',app);

let interiors=read('app/world-interiors.js');
interiors=replaceExact(
  interiors,
  "    s.art.push(rect(63,145,1404,964,bear?`url(#${id}-darkoak)`:'#637779'));\n    wallSign(s,485,110,title,bear?'A GOOD EVENING · GOOD COMPANY':magic?'LIVE PERFORMANCE · LOUNGE':cage?'MUSIC · MOVEMENT':'THE LATE LOUNGE');",
  "    s.art.push(rect(63,145,1404,964,bear?`url(#${id}-darkoak)`:'#26353a'));\n    if(!bear){\n      s.art.push(rect(371,393,696,455,accent,18,'opacity=\".3\"'),rect(395,417,648,8,'#f7d6ff',4,'opacity=\".8\"'),rect(395,806,648,8,'#a8ecff',4,'opacity=\".8\"'));\n      for(let x=419;x<=1019;x+=120)s.art.push(line(x,430,x,790,x%240===179?'#ff8fd1':'#85dfff',3,'opacity=\".45\"'));\n      for(let y=454;y<=766;y+=78)s.art.push(line(410,y,1028,y,y%156===142?'#ccb0ff':'#ffd58a',3,'opacity=\".38\"'));\n    }\n    wallSign(s,485,110,title,bear?'A GOOD EVENING · GOOD COMPANY':magic?'LIVE PERFORMANCE · LOUNGE':cage?'MUSIC · MOVEMENT':'THE LATE LOUNGE');",
  'club dance floor visual energy'
);
interiors=replaceExact(
  interiors,
  "      s.pedestrians.push({x:741,y:208,toX:741,toY:208,stationary:true,activity:'social'},{x:537,y:722,toX:537,toY:722,stationary:true,activity:'social'},{x:1012,y:862,toX:1012,toY:862,stationary:true,activity:'social'});",
  "      s.pedestrians.push({x:741,y:208,toX:741,toY:208,stationary:true,activity:'social'},{x:537,y:722,toX:537,toY:722,stationary:true,activity:'social'},{x:1012,y:862,toX:1012,toY:862,stationary:true,activity:'social'},{x:823,y:704,toX:823,toY:704,stationary:true,activity:'social'},{x:1164,y:718,toX:1164,toY:718,stationary:true,activity:'dance'},{x:337,y:830,toX:337,toY:830,stationary:true,activity:'social'});",
  'Bear Barn crowd'
);
interiors=replaceExact(
  interiors,
  "        s.pedestrians.push({x:638,y:401,toX:638,toY:401,stationary:true,activity:'dance',elevation:36},{x:868,y:396,toX:868,toY:396,stationary:true,activity:'dance',elevation:36});",
  "        s.pedestrians.push({x:575,y:401,toX:575,toY:401,stationary:true,activity:'dance',elevation:36},{x:706,y:392,toX:706,toY:392,stationary:true,activity:'dance',elevation:36},{x:837,y:402,toX:837,toY:402,stationary:true,activity:'dance',elevation:36},{x:959,y:391,toX:959,toY:391,stationary:true,activity:'dance',elevation:36});",
  'Magic City stage performers'
);
interiors=replaceExact(
  interiors,
  "      s.pedestrians.push({x:510,y:722,toX:510,toY:722,stationary:true,activity:'dance'},{x:908,y:715,toX:908,toY:715,stationary:true,activity:'dance'},{x:740,y:610,toX:740,toY:610,stationary:true,activity:'dance'});",
  "      s.pedestrians.push({x:470,y:730,toX:470,toY:730,stationary:true,activity:'dance'},{x:585,y:635,toX:585,toY:635,stationary:true,activity:'dance'},{x:700,y:748,toX:700,toY:748,stationary:true,activity:'dance'},{x:817,y:622,toX:817,toY:622,stationary:true,activity:'dance'},{x:934,y:733,toX:934,toY:733,stationary:true,activity:'dance'},{x:611,y:822,toX:611,toY:822,stationary:true,activity:'social'},{x:883,y:824,toX:883,toY:824,stationary:true,activity:'social'});",
  'Tokyo and Cage dance floor crowd'
);
write('app/world-interiors.js',interiors);

let world=read('app/world-3d.js');
world=replaceExact(
  world,
  "  const isClub=venue?.kind==='club'||['club','club-cage','magic-city','bear-barn'].includes(venue?.id);\n  const indoors=kind==='home'||kind==='visit'||kind==='venue'&&!['park','jabi-lake'].includes(venue?.id);",
  `  const isClub=venue?.kind==='club'||['club','club-cage','magic-city','bear-barn'].includes(venue?.id);\n  const indoors=kind==='home'||kind==='visit'||kind==='venue'&&!['park','jabi-lake'].includes(venue?.id);\n  const clubPalette=venue?.id==='club-cage'?['#42ddff','#8e72ff','#ff4d9d','#78f0b0']:venue?.id==='magic-city'?['#ff63ca','#bd8bff','#ffd36c','#70d8ff']:venue?.id==='bear-barn'?['#ffb35d','#d97683','#82a58f','#f0d28e']:['#ff43ad','#5ce2ff','#b27cff','#ffc95f'];\n  const clubColors=clubPalette.map(value=>new THREE.Color(value));\n  const clubLights=[];\n  if(isClub){\n    const lightCount=mobile?2:4;\n    for(let i=0;i<lightCount;i++){const light=new THREE.PointLight(clubPalette[i%clubPalette.length],0,mobile?430:560,2);light.castShadow=false;scene.add(light);clubLights.push(light);}\n  }`,
  'nightclub dynamic light rig'
);
world=replaceExact(
  world,
  "      sun.color.set(indoors?'#ffe7c3':night?'#a6bdea':daylight<.3?'#edbf91':'#fff5e4');rim.intensity=indoors?.68:night?.52:.6;\n      rain.visible=!indoors&&weather?.condition==='rain';",
  `      sun.color.set(indoors?'#ffe7c3':night?'#a6bdea':daylight<.3?'#edbf91':'#fff5e4');rim.intensity=indoors?.68:night?.52:.6;\n      if(isClub){\n        const partyOn=Boolean(clubOpen),clubTime=Number(time)||0;\n        renderer.toneMappingExposure=partyOn?1.16:1.04;\n        clubLights.forEach((light,i)=>{\n          light.visible=partyOn;if(!partyOn)return;\n          const phase=(clubTime*.34+i*.83)%clubColors.length,index=Math.floor(phase),mix=phase-index;\n          light.color.copy(clubColors[index]).lerp(clubColors[(index+1)%clubColors.length],mix);\n          light.intensity=(mobile?3.2:4.8)*(0.78+Math.sin(clubTime*3.1+i*1.7)*.22);\n          light.position.set(765+Math.sin(clubTime*.72+i*2.05)*430,205+Math.sin(clubTime*1.45+i)*55,(585+Math.cos(clubTime*.88+i*1.31)*285)/DEPTH);\n        });\n        rim.color.set(partyOn?clubPalette[1]:'#ceddec');\n      }else renderer.toneMappingExposure=1.1;\n      rain.visible=!indoors&&weather?.condition==='rain';`,
  'animate nightclub lights'
);
write('app/world-3d.js',world);

let character=read('app/world-character.js');
character=replaceExact(
  character,
  "  }else if(activity.name==='dance'){\n    rig.body.position.y=Math.abs(beat)*3.4;rig.body.rotation.z=Math.sin(t*3)*.11;rig.torso.rotation.y=Math.sin(t*3)*.2;\n    rig.arms.forEach((a,i)=>{a.shoulder.rotation.z=(i?1:-1)*(.48+Math.sin(t*4+i)*.3);a.shoulder.rotation.x=Math.sin(t*4+i*2)*.35;a.elbow.rotation.x=-.7;});\n    rig.legs.forEach((l,i)=>{l.upper.rotation.x=Math.sin(t*5+i*Math.PI)*.28;l.knee.rotation.x=Math.max(0,Math.sin(t*5+i*Math.PI))*.5;});",
  "  }else if(activity.name==='dance'){\n    const bounce=(Math.sin(t*6.2)+1)*.5,sway=Math.sin(t*2.7),step=Math.sin(t*4.8);\n    rig.body.position.y=bounce*4.6;rig.body.rotation.z=sway*.16;rig.body.rotation.y=Math.sin(t*1.75)*.1;rig.torso.rotation.y=-sway*.3;rig.head.rotation.y=Math.sin(t*2.1+.7)*.13;\n    rig.arms.forEach((a,i)=>{const side=i?1:-1;a.shoulder.rotation.z=side*(.58+Math.sin(t*4.15+i*1.7)*.38);a.shoulder.rotation.x=Math.sin(t*3.6+i*2.2)*.46;a.elbow.rotation.x=-.82+Math.sin(t*5.1+i)*.2;});\n    rig.legs.forEach((l,i)=>{const leg=Math.sin(t*4.8+i*Math.PI);l.upper.rotation.x=leg*.36;l.upper.rotation.z=(i?1:-1)*step*.08;l.knee.rotation.x=Math.max(0,leg)*.62;});",
  'richer dance animation'
);
write('app/world-character.js',character);

let sw=read('app/sw.js');
sw=replaceExact(sw,"const CACHE='abujalife-outside-native-v13';","const CACHE='abujalife-outside-native-v14';",'PWA cache revision');
write('app/sw.js',sw);

write('tests/activity-nightlife-upgrade.test.mjs',`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { VENUE_ACTIONS, travelPricing } from '../src/shared/life.mjs';\n\nconst app=fs.readFileSync(new URL('../app/app.js',import.meta.url),'utf8');\nconst interiors=fs.readFileSync(new URL('../app/world-interiors.js',import.meta.url),'utf8');\nconst world3d=fs.readFileSync(new URL('../app/world-3d.js',import.meta.url),'utf8');\nconst character=fs.readFileSync(new URL('../app/world-character.js',import.meta.url),'utf8');\n\ntest('every authored venue activity is ten seconds longer',()=>{\n  assert.ok(VENUE_ACTIONS.length>=25);\n  assert.ok(VENUE_ACTIONS.every(activity=>activity.duration>=14),VENUE_ACTIONS.map(a=>\`${'${'}a.id}:${'${'}a.duration}\`).join(','));\n  assert.equal(VENUE_ACTIONS.find(a=>a.id==='gym-workout')?.duration,18);\n  assert.equal(VENUE_ACTIONS.find(a=>a.id==='club-dance')?.duration,18);\n  assert.equal(VENUE_ACTIONS.find(a=>a.id==='tokyo-vip')?.duration,17);\n});\n\ntest('real travel and driving get another ten seconds',()=>{\n  const quote=travelPricing({id:'a',commute:35},{id:'b',commute:35},'car');\n  assert.ok(quote.seconds>=14&&quote.seconds<=24,\`unexpected car journey ${'${'}quote.seconds}s\`);\n});\n\ntest('home activities are also ten seconds longer',()=>{\n  assert.match(app,/sleep:18,shower:16,relax:16,eat:15,exercise:18/);\n  assert.match(app,/\|\|15,complete/);\n});\n\ntest('nightclubs have denser crowds, active dance motion and dynamic colour lighting',()=>{\n  assert.match(interiors,/activity:'dance'.*activity:'dance'.*activity:'dance'/s);\n  assert.match(interiors,/club dance floor crowd/);\n  assert.match(world3d,/const clubLights=\[\]/);\n  assert.match(world3d,/new THREE\.PointLight/);\n  assert.match(world3d,/renderer\.toneMappingExposure=partyOn\?1\.16:1\.04/);\n  assert.match(character,/const bounce=.*sway=.*step=/);\n});\n`);
