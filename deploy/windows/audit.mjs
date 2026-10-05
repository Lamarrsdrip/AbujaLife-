import assert from 'node:assert/strict';
import {MongoClient} from 'mongodb';
import {MONGO_COLLECTIONS,MONGO_APPEND_ONLY_COLLECTIONS} from '../../src/server/mongo/database.mjs';
import {configuration,mongoUri,safeCode} from './runtime.mjs';
const config=configuration();
const admin=new MongoClient(mongoUri(config,'abujalife_bootstrap','mongo-root-password','admin'));
const app=new MongoClient(mongoUri(config));
const anonymous=new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true');
async function denied(operation){await assert.rejects(operation,error=>error.code===13);}
try {
  await admin.connect();await app.connect();await anonymous.connect();
  const options=await admin.db('admin').command({getCmdLineOpts:1}),hello=await admin.db('admin').command({hello:1});
  assert.equal(options.parsed.security.authorization,'enabled');
  assert.equal(options.parsed.net.bindIp,'127.0.0.1');assert.equal(options.parsed.net.port,27017);
  assert.equal(hello.setName,'abujalife');assert.equal(hello.isWritablePrimary,true);
  const db=admin.db('abujalife_prod'),names=(await db.listCollections().toArray()).map(row=>row.name);
  let indexes=0,uniqueIndexes=0,ttlIndexes=0;
  for(const name of MONGO_COLLECTIONS){assert.ok(names.includes(name),name);const rows=await db.collection(name).listIndexes().toArray();indexes+=rows.length;uniqueIndexes+=rows.filter(row=>row.unique).length;ttlIndexes+=rows.filter(row=>row.expireAfterSeconds!==undefined).length;}
  await denied(()=>anonymous.db(config.database).collection('users').findOne({}));
  await denied(()=>app.db('okrika').collection('users').findOne({}));
  await denied(()=>app.db(config.database).createCollection('qa_forbidden_ddl'));
  for(const name of MONGO_APPEND_ONLY_COLLECTIONS){await denied(()=>app.db(config.database).collection(name).updateOne({_id:'qa_nonexistent'},{$set:{qa:true}}));await denied(()=>app.db(config.database).collection(name).deleteOne({_id:'qa_nonexistent'}));}
  console.log(JSON.stringify({ok:true,database:config.database,authentication:'enabled',binding:'127.0.0.1',mongoPort:27017,replicaSet:hello.setName,primary:true,collections:MONGO_COLLECTIONS.length,indexes,uniqueIndexes,ttlIndexes,appendOnlyCollections:MONGO_APPEND_ONLY_COLLECTIONS.length,appCrossDatabaseAccess:'denied',anonymousDataAccess:'denied',appDDL:'denied',cacheSizeGB:options.parsed.storage.wiredTiger.engineConfig.cacheSizeGB}));
}catch(error){console.error(JSON.stringify({ok:false,code:safeCode(error),audit:'failed'}));process.exitCode=1;}
finally{await Promise.allSettled([admin.close(),app.close(),anonymous.close()]);}
