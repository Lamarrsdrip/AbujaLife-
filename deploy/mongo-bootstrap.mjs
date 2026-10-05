import {MongoClient} from 'mongodb';
import {DATABASE,secret} from './mongo-ops.mjs';
import {MONGO_COLLECTIONS,MONGO_APPEND_ONLY_COLLECTIONS,ensureMongoSchema} from '../src/server/mongo/database.mjs';
import {ensureMongoAdSchema,AD_COLLECTIONS,AD_APPEND_ONLY_COLLECTIONS} from '../src/server/mongo/adStore.mjs';
import {JACKPOT_COLLECTIONS,JACKPOT_APPEND_ONLY_COLLECTIONS,ensureMongoJackpotSchema} from '../src/server/mongo/jackpotSchema.mjs';

const database=process.env.MONGODB_DATABASE||DATABASE,replicaSet=process.env.MONGODB_REPLICA_SET||'abujalife';
if(database!==DATABASE||replicaSet!=='abujalife')throw new Error('Bootstrap is restricted to the dedicated abujalife production database and replica set.');
const host=process.env.MONGODB_HOST||'mongo:27017';
if(!/^(mongo|localhost|127\.0\.0\.1):\d+$/.test(host))throw new Error('Bootstrap requires the dedicated private Mongo service or local integration endpoint.');
const rootUri=`mongodb://abujalife_bootstrap:${encodeURIComponent(secret('mongo-root-password'))}@${host}/admin?authSource=admin&replicaSet=${replicaSet}&directConnection=true`;
const client=new MongoClient(rootUri,{serverSelectionTimeoutMS:15000});
try{
  await client.connect();
  const admin=client.db('admin'),hello=await admin.command({hello:1});
  if(hello.setName!==replicaSet||!hello.isWritablePrimary)throw new Error('Refusing to bootstrap a different MongoDB instance.');
  const db=client.db(database);
  await ensureMongoSchema(db);await ensureMongoAdSchema(db);await ensureMongoJackpotSchema(db);
  const privileges=[];
  for(const collection of MONGO_COLLECTIONS){
    privileges.push({resource:{db:database,collection},actions:MONGO_APPEND_ONLY_COLLECTIONS.includes(collection)?['find','insert','listIndexes']:collection==='schema_versions'?['find','insert','remove','listIndexes']:['find','insert','update','remove','listIndexes']});
  }
  for(const collection of AD_COLLECTIONS){
    privileges.push({resource:{db:database,collection},actions:AD_APPEND_ONLY_COLLECTIONS.includes(collection)?['find','insert','listIndexes']:['find','insert','update','remove','listIndexes']});
  }
  for(const collection of JACKPOT_COLLECTIONS){
    privileges.push({
      resource: {db: database, collection},
      actions: JACKPOT_APPEND_ONLY_COLLECTIONS.includes(collection) ? ['find','insert','listIndexes'] : ['find','insert','update','remove','listIndexes']
    });
  }
  const existingRole = await db.command({rolesInfo: 'abujalife_runtime'});
  await db.command({[existingRole.roles.length ? 'updateRole' : 'createRole']: 'abujalife_runtime', privileges, roles: []});
  // Backups are full replica-set dumps so MongoDB can capture an oplog-consistent
  // point in time without fsync-locking live gameplay. MongoDB's built-in
  // backup@admin role is intentionally used here instead of a hand-maintained
  // privilege clone: mongodump also reads internal namespaces such as
  // config.transactions when establishing the oplog window. This account is
  // still isolated to AbujaLife's dedicated Mongo service on its own port;
  // Okrika runs in a separate MongoDB instance.
  for (const [user, passwordFile, role, roleDb] of [['abujalife_app','mongo-app-password','abujalife_runtime',database], ['abujalife_backup','mongo-backup-password','backup','admin']]) {
    const existing = await db.command({usersInfo: user});
    await db.command({[existing.users.length ? 'updateUser' : 'createUser']: user, pwd: secret(passwordFile), roles: [{role,db:roleDb}]});
  }
  console.log(JSON.stringify({ok:true,database,replicaSet,collections:MONGO_COLLECTIONS.length+3+JACKPOT_COLLECTIONS.length,ledger:'find/insert only',adReceipts:'find/insert only',jackpotLedger:'find/insert only',appDDL:false,backupRole:'backup@admin'}));
} finally { await client.close(); }
