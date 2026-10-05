from pathlib import Path

path = Path('scripts/finish-live-city-integration.mjs')
s = path.read_text()
start = s.find("{\n const path='src/server/fastStartup.mjs';let s=read(path);")
end = s.find("\n\n{\n const path='app/living-city.js';let s=read(path);", start)
if start < 0 or end < 0:
    raise SystemExit('Could not locate fastStartup patch block')
replacement = r'''{
 const path='src/server/fastStartup.mjs';let s=read(path);
 const emotePattern=/  async function emote\(id,payload\)\{.*?\n  \}/s;
 const emoteReplacement=[
  "  async function emote(id,payload){",
  "    const emote=String(payload?.emote||'');if(!EMOTES.has(emote))throw Object.assign(new Error('Choose a supported reaction'),{status:400,code:'invalid_emote'});",
  "    const targetResidentId=typeof payload?.targetResidentId==='string'?payload.targetResidentId:null;",
  "    if(targetResidentId){if(targetResidentId===id)throw Object.assign(new Error('Choose another resident'),{status:400,code:'invalid_target'});const nearby=await store.presence.nearby(id);if(!nearby.some(person=>person.id===targetResidentId))throw Object.assign(new Error('That resident is no longer nearby'),{status:409,code:'resident_not_nearby'});}",
  "    const profile=await store.profile(id),event={residentId:id,targetResidentId,username:profile.username,displayName:profile.displayName,emote,createdAt:store.clock()};",
  "    await store.emitZone(id,'player-emote',event);return{ok:true,emote:event};",
  "  }"
 ].join('\\n');
 s=regexOne(s,emotePattern,emoteReplacement,'server verified emote target');write(path,s);
}'''
s = s[:start] + replacement + s[end:]
path.write_text(s)
print('Repaired fastStartup integration target.')
