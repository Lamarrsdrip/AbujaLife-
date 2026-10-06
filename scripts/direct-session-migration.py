from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


# Production HTTP: one canonical session runtime inside the real dispatcher.
p = Path('src/server/production-http.mjs')
text = p.read_text()
text = replace_once(
    text,
    "import { GameError } from './errors.mjs';\n",
    "import { GameError } from './errors.mjs';\nimport { createSessionRuntime } from './sessionRuntime.mjs';\n",
    'production import',
)
pattern = re.compile(r"  async function publicBootstrap\(\{startup=false\}=\{\}\)\{.*?\n  const server=http\.createServer\(async\(req,res\)=>\{", re.S)
replacement = """  async function publicBootstrap(){const now=store.clock();return{authenticated:false,atlas:ABUJA_ATLAS,councils:AREA_COUNCILS,landmarks:LANDMARKS,atlasMeta:ATLAS_META,jobs:store.publicJobs(),catalog,properties,events:[],transportModes,appearanceOptions,activities,venues:VENUES,venueActions:VENUE_ACTIONS,lifeGoals:LIFE_GOALS,economyMeta:ECONOMY_META,walletMeta:{...WALLET_META,topupMode:'flutterwave',demoTopupEnabled:false},investmentMeta:INVESTMENT_META,diceMeta:DICE_META,vehicleColors:VEHICLE_COLORS,homeUpgrades:HOME_UPGRADES,payments:await payments.publicConfig(),serverTime:now,clock:abujaTime(now),weather:seasonalWeather(now),clubSchedule:clubSchedule(now)};}
  async function bootstrap(id){const publicState=await publicBootstrap();if(!id)return publicState;await social.reconcileVisits(id);const [base,visits,zone,adminState]=await Promise.all([store.bootstrap(id),social.visitState(id),store.zone(id),admin.status(id)]);return{...publicState,...base,nearby:(base.nearby||[]).map(person=>({...person,pose:poses.get(person.id)?.zone===zone?poses.get(person.id).pose:null})),properties:base.properties||properties,workSchedules:Object.fromEntries(Object.keys(store.publicJobs()).map(key=>[key,jobSchedule(key,base.profile,store.clock())])),homeVisit:visits.visit,homeVisitRequests:visits.requests,homeVisitors:visits.visitors,admin:adminState};}
  const sessionRuntime=createSessionRuntime({store,admin,social,corsOrigins,publicWebUrl,secureCookies:true,log});
  const server=http.createServer(async(req,res)=>{
    if(await sessionRuntime.handle(req,res))return;"""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'production bootstrap block: expected one match, found {count}')
text = replace_once(
    text,
    "if(pathname==='/api/bootstrap'&&method==='GET')return json(res,200,await bootstrap(id,{startup:url.searchParams.get('startup')==='1'}));",
    "if(pathname==='/api/bootstrap'&&method==='GET')return json(res,200,await bootstrap(id));",
    'production bootstrap route',
)
for old, label in [
    ("      if(pathname==='/api/auth/register'&&method==='POST'){rateLimit(req,'auth',12);fail((await currentPublicSettings()).registrationOpen,'Registration is temporarily paused',503);const {startup,...credentials}=await readBody(req),session=await store.register(credentials);setSession(res,session.token);log('signup',{requestId});return json(res,201,await bootstrap(session.residentId,{startup:startup===true}));}\n", 'production register'),
    ("      if(pathname==='/api/auth/login'&&method==='POST'){rateLimit(req,'auth',12);const {startup,...credentials}=await readBody(req),session=await store.login(credentials);if(await admin.isSuspended(session.residentId)){await store.logout(session.token);throw new GameError('This account is suspended',403,'account_suspended');}setSession(res,session.token);log('login',{requestId});return json(res,200,await bootstrap(session.residentId,{startup:startup===true}));}\n", 'production login'),
    ("      if(pathname==='/api/auth/logout'&&method==='POST'){await readBody(req);await store.logout(token);setSession(res,'');if(id){for(const[stream,client]of clients)if(client.token===token)stream.end();if(!byUser.has(id))lastSeen.delete(id);await broadcastPresence(id);}return json(res,200,{ok:true,authenticated:false});}\n", 'production logout'),
]:
    text = replace_once(text, old, '', label)
profile_pattern = re.compile(r"        if\(pathname==='/api/profile'&&method==='POST'\)\{.*?\n        \}\n        if\(pathname==='/api/wallet'", re.S)
profile_replacement = """        if(pathname==='/api/profile'&&method==='POST'){
          const profile=await store.updateProfile(id,body);
          await social.reconcileVisits(id);await broadcastPresence(id);return json(res,200,{ok:true,profile});
        }
        if(pathname==='/api/wallet'"""
text, count = profile_pattern.subn(profile_replacement, text, count=1)
if count != 1:
    raise SystemExit(f'production profile startup branch: expected one match, found {count}')
anchor = 'server.store=store;'
if anchor not in text:
    raise SystemExit('production server property anchor missing')
text = text.replace(anchor, 'server.sessionRuntime=sessionRuntime;' + anchor, 1)
p.write_text(text)


# Local HTTP: same direct dispatcher, no old login/register/logout implementation.
p = Path('src/server/http.mjs')
text = p.read_text()
text = replace_once(
    text,
    "import { AdminStore } from './adminStore.mjs';\n",
    "import { AdminStore } from './adminStore.mjs';\nimport { createSessionRuntime } from './sessionRuntime.mjs';\n",
    'local import',
)
text = replace_once(
    text,
    "  const server=http.createServer(async(req,res)=>{\n    try{",
    "  const sessionOrigin=options.publicWebUrl||'http://localhost';\n  const sessionRuntime=createSessionRuntime({store,admin,social,corsOrigins:options.corsOrigins||[sessionOrigin],publicWebUrl:sessionOrigin,secureCookies:false});\n  const server=http.createServer(async(req,res)=>{\n    if(await sessionRuntime.handle(req,res))return;\n    try{",
    'local dispatcher',
)
for old, label in [
    ("      if(pathname==='/api/auth/register'&&method==='POST'){if(!admin.publicSettings().registrationOpen)throw new GameError('New registration is currently paused.',503);rateLimit(req,'auth',12);const session=await store.register(await readBody(req));setSession(res,req,session.token);return json(res,201,bootstrap(session.residentId));}\n", 'local register'),
    ("      if(pathname==='/api/auth/login'&&method==='POST'){rateLimit(req,'auth',12);const session=await store.login(await readBody(req));if(admin.isSuspended(session.residentId)){store.logout(session.token);throw new GameError('This account is suspended. Contact the game administrator.',403,'account_suspended');}setSession(res,req,session.token);return json(res,200,bootstrap(session.residentId));}\n", 'local login'),
    ("      if(pathname==='/api/auth/logout'&&method==='POST'){await readBody(req);store.logout(token);setSession(res,req,'');if(id){for(const [stream,client] of clients)if(client.token===token)stream.end();if(![...clients.values()].some(client=>client.id===id))lastSeen.delete(id);broadcastPresence(id);}return json(res,200,{ok:true,authenticated:false});}\n", 'local logout'),
]:
    text = replace_once(text, old, '', label)
anchor = 'server.store=store;'
if anchor not in text:
    raise SystemExit('local server property anchor missing')
text = text.replace(anchor, 'server.sessionRuntime=sessionRuntime;' + anchor, 1)
p.write_text(text)


# Production composition no longer wraps the request listener for auth.
p = Path('src/server/production.mjs')
text = p.read_text()
text = replace_once(text, "import { attachSessionRuntime } from './sessionRuntime.mjs';\n", '', 'production composition import')
text = replace_once(
    text,
    "    const sessionRuntime=attachSessionRuntime(server,{store,admin,social,corsOrigins:config.corsOrigins,publicWebUrl:config.publicWebUrl,secureCookies:true,log});\n",
    "    const sessionRuntime=server.sessionRuntime;\n",
    'production composition attach',
)
p.write_text(text)


# Local launcher passes origin into createServer; no auth wrapper.
p = Path('scripts/dev.mjs')
text = p.read_text()
text = replace_once(text, "import { attachSessionRuntime } from '../src/server/sessionRuntime.mjs';\n", '', 'dev wrapper import')
text = replace_once(
    text,
    "const port = Number(process.env.PORT || 8787);\nconst server = createServer({production:process.argv.includes('--prod')});\nconst localOrigin=`http://localhost:${port}`;\nattachSessionRuntime(server,{store:server.store,admin:server.admin,social:server.social,corsOrigins:[localOrigin],publicWebUrl:localOrigin,secureCookies:false});\n",
    "const port = Number(process.env.PORT || 8787);\nconst localOrigin=`http://localhost:${port}`;\nconst server = createServer({production:process.argv.includes('--prod'),publicWebUrl:localOrigin,corsOrigins:[localOrigin]});\n",
    'dev wrapper call',
)
p.write_text(text)


# Wrapper API itself is removed; there is nothing left to attach later.
p = Path('src/server/sessionRuntime.mjs')
text = p.read_text()
pattern = re.compile(r"\nexport function attachSessionRuntime\(server,options=\{\}\)\{.*?\n\}\s*$", re.S)
text, count = pattern.subn('\n', text, count=1)
if count != 1:
    raise SystemExit(f'attachSessionRuntime removal: expected one match, found {count}')
p.write_text(text)


# Canonical runtime tests use the real local dispatcher directly.
p = Path('tests/session-runtime.test.mjs')
text = p.read_text()
text = replace_once(text, "import {attachSessionRuntime} from '../src/server/sessionRuntime.mjs';\n", '', 'session test import')
text = replace_once(
    text,
    " const server=createServer({dataDir});\n attachSessionRuntime(server,{store:server.store,admin:server.admin,social:server.social,corsOrigins:['http://localhost'],publicWebUrl:'http://localhost',secureCookies:false});\n",
    " const server=createServer({dataDir,publicWebUrl:'http://localhost',corsOrigins:['http://localhost']});\n",
    'session test fixture',
)
text = text.replace(
    "test('legacy startup stack is physically absent and normal runtimes only attach sessionRuntime'",
    "test('legacy startup stack is physically absent and both HTTP servers dispatch one sessionRuntime directly'",
    1,
)
text = replace_once(
    text,
    " assert.match(runtimeText,/attachSessionRuntime/);assert.match(production,/attachLiveActions/);assert.doesNotMatch(runtimeText,/attachCoreEntry|attachEntryBootstrap|attachFastStartup|coreEntry\\.mjs|entryBootstrap\\.mjs|fastStartup\\.mjs/);",
    " assert.doesNotMatch(runtimeText,/attachSessionRuntime/);assert.match(production,/attachLiveActions/);assert.doesNotMatch(runtimeText,/attachCoreEntry|attachEntryBootstrap|attachFastStartup|coreEntry\\.mjs|entryBootstrap\\.mjs|fastStartup\\.mjs/);",
    'session architecture assertion',
)
text = replace_once(
    text,
    " const [dev,production,client,auth,app,integration]=await Promise.all(['scripts/dev.mjs','src/server/production.mjs','app/api-client.js','app/auth-session.js','app/app.js','tests/production-integration.mjs'].map(file=>fs.readFile(file,'utf8')));",
    " const [dev,production,localHttp,productionHttp,sessionSource,client,auth,app,integration]=await Promise.all(['scripts/dev.mjs','src/server/production.mjs','src/server/http.mjs','src/server/production-http.mjs','src/server/sessionRuntime.mjs','app/api-client.js','app/auth-session.js','app/app.js','tests/production-integration.mjs'].map(file=>fs.readFile(file,'utf8')));",
    'session architecture file set',
)
text = replace_once(
    text,
    " const clientText=`${client}\\n${auth}\\n${app}`;",
    " const serverText=`${localHttp}\\n${productionHttp}`;assert.match(localHttp,/sessionRuntime\\.handle\\(req,res\\)/);assert.match(productionHttp,/sessionRuntime\\.handle\\(req,res\\)/);assert.doesNotMatch(sessionSource,/attachSessionRuntime/);assert.doesNotMatch(serverText,/bootstrap\\(session\\.residentId|\\{startup,\\.\\.\\.credentials\\}|startup:url\\.searchParams|get\\('startup'\\)|startup===true/);\n const clientText=`${client}\\n${auth}\\n${app}`;",
    'session architecture direct dispatch assertion',
)
p.write_text(text)


# Production integration must explicitly assert the canonical contract.
p = Path('tests/production-integration.mjs')
text = p.read_text()
if "request('/api/entry'" not in text or 'login.data.entry,true' not in text:
    raise SystemExit('production integration canonical entry assertions missing')

print('direct session migration prepared')
