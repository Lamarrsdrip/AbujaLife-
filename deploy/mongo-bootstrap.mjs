#!/usr/bin/env node
import fs from 'node:fs';
import {MongoClient} from 'mongodb';
import {ensureMongoSchema, MONGO_COLLECTIONS, MONGO_APPEND_ONLY_COLLECTIONS} from '../src/server/mongo/database.mjs';
import {ensureMongoAdSchema} from '../src/server/mongo/adStore.mjs';
import {ensureMongoJackpotSchema, JACKPOT_COLLECTIONS, JACKPOT_APPEND_ONLY_COLLECTIONS} from '../src/server/mongo/jackpotSchema.mjs';
import {mongoCivicRuntimePrivileges, MONGO_CIVIC_COLLECTIONS} from '../src/server/mongo/civicSchema.mjs';

const database = process.env.MONGODB_DATABASE || 'abujalife_prod';
const host = process.env.MONGODB_HOST || 'mongo:27017';
const replicaSet = process.env.MONGODB_REPLICA_SET || 'abujalife';
if (database !== 'abujalife_prod' || replicaSet !== 'abujalife') throw new Error('Bootstrap is restricted to the isolated abujalife_prod database and abujalife replica set.');
const secretDirectory = process.env.ABUJALIFE_SECRETS_DIR || '/run/secrets';
const secret = name => fs.readFileSync(`${secretDirectory}/${name}`, 'utf8').trim();
const client = new MongoClient(`mongodb://abujalife_bootstrap:${encodeURIComponent(secret('mongo-root-password'))}@${host}/admin?authSource=admin&directConnection=true`, {serverSelectionTimeoutMS: 15000});
try {
  await client.connect();
  const admin = client.db('admin');
  try { await admin.command({replSetGetStatus: 1}); }
  catch (error) {
    if (error.code !== 94) throw error;
    await admin.command({replSetInitiate: {_id: replicaSet, members: [{_id: 0, host: 'mongo:27017'}]}});
  }
  let primary = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if ((await admin.command({hello: 1})).isWritablePrimary) { primary = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!primary) throw new Error('The private replica set did not elect a writable primary.');
  const db = client.db(database);
  await ensureMongoSchema(db);
  await ensureMongoAdSchema(db);
  await ensureMongoJackpotSchema(db);
  // Future privilege/schema expansion consumes the same explicit collection
  // contract as the server. No wildcard write or DDL privilege is granted.
  const privileges = MONGO_COLLECTIONS.map(collection => ({
    resource: {db: database, collection},
    actions: MONGO_APPEND_ONLY_COLLECTIONS.includes(collection) ? ['find','insert','listIndexes'] : collection === 'schema_versions' ? ['find','insert','remove','listIndexes'] : ['find','insert','update','remove','listIndexes']
  }));
  privileges.push(
    {resource:{db:database,collection:'ad_orders'},actions:['find','insert','update','remove','listIndexes']},
    {resource:{db:database,collection:'ad_slots'},actions:['find','insert','update','remove','listIndexes']},
    {resource:{db:database,collection:'ad_house_campaigns'},actions:['find','insert','update','listIndexes']},
    {resource:{db:database,collection:'ad_receipts'},actions:['find','insert','listIndexes']}
  );
  for (const collection of JACKPOT_COLLECTIONS) {
    privileges.push({
      resource: {db: database, collection},
      actions: JACKPOT_APPEND_ONLY_COLLECTIONS.includes(collection) ? ['find','insert','listIndexes'] : ['find','insert','update','remove','listIndexes']
    });
  }
  privileges.push(...mongoCivicRuntimePrivileges(database));
  const existingRole = await db.command({rolesInfo: 'abujalife_runtime'});
  await db.command({[existingRole.roles.length ? 'updateRole' : 'createRole']: 'abujalife_runtime', privileges, roles: []});
  // Full replica-set mongodump --oplog is an instance-level operation. On
  // MongoDB 8 it also reads config.transactions while opening the oplog
  // window, so the dedicated backup principal receives read-only access to
  // that internal metadata database and no application/Okrika writes.
  for (const [user, passwordFile, roles] of [['abujalife_app','mongo-app-password',[{role:'abujalife_runtime',db:database}]], ['abujalife_backup','mongo-backup-password',[{role:'backup',db:'admin'},{role:'read',db:'config'}]]]) {
    const existing = await db.command({usersInfo: user});
    await db.command({[existing.users.length ? 'updateUser' : 'createUser']: user, pwd: secret(passwordFile), roles});
  }
  console.log(JSON.stringify({ok:true,database,replicaSet,collections:MONGO_COLLECTIONS.length+3+JACKPOT_COLLECTIONS.length+MONGO_CIVIC_COLLECTIONS.length,ledger:'find/insert only',adReceipts:'find/insert only',jackpotLedger:'find/insert only',civic:'find/insert/update/remove/listIndexes',appDDL:false}));
} finally { await client.close(); }
