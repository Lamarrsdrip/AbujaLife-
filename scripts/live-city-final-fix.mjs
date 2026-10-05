import fs from 'node:fs';

function replaceOnce(path,before,after,label){
  const source=fs.readFileSync(path,'utf8');
  const first=source.indexOf(before);
  if(first<0)throw new Error(`Missing ${label} in ${path}`);
  if(source.indexOf(before,first+before.length)>=0)throw new Error(`Ambiguous ${label} in ${path}`);
  fs.writeFileSync(path,source.slice(0,first)+after+source.slice(first+before.length));
}

replaceOnce(
  'app/app.js',
  "if(residentAction==='visit'){await api('/api/home-visits/requests',{method:'POST',body:{residentId:resident.id}});toast('Visit request sent.');return;}",
  "if(residentAction==='visit'){await api('/api/home/visits/request',{method:'POST',body:{residentId:resident.id,idempotencyKey:crypto.randomUUID()}});toast('Visit request sent.');return;}",
  'existing home-visit route wiring',
);

replaceOnce(
  'src/server/production-http.mjs',
  "const pose={x:raw.x,y:raw.y,angle:raw.angle,moving:raw.moving===true,driving:raw.driving===true},zone=(await store.zone(id));",
  "const allowedActivities=new Set(['walk','exercise','eat','dance','social','rest','sit','shop','watch','pray','groom','shower']),activity=typeof raw.activity==='string'&&allowedActivities.has(raw.activity)?raw.activity:null;const pose={x:raw.x,y:raw.y,angle:raw.angle,moving:raw.moving===true,driving:raw.driving===true,...(activity?{activity}:{})},zone=(await store.zone(id));",
  'presence activity propagation',
);

for(const file of ['.github/workflows/live-city-final-fix.yml','scripts/live-city-final-fix.mjs']){
  try{fs.unlinkSync(file);}catch(error){if(error.code!=='ENOENT')throw error;}
}
console.log('Applied final living-city contract fixes and removed temporary patch files.');
