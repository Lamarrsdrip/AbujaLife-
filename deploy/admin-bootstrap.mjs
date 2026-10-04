#!/usr/bin/env node
import fs from 'node:fs';
import {connectMongo} from '../src/server/mongo/database.mjs';
import {MongoGameStore} from '../src/server/mongo/gameStore.mjs';
import {MongoAdminStore} from '../src/server/mongo/adminStore.mjs';
const arguments_=process.argv.slice(2);
if(arguments_.length!==2||arguments_[0]!=='--username'||!/^[a-z0-9_]{3,24}$/i.test(arguments_[1]))throw new Error('Usage: node deploy/admin-bootstrap.mjs --username EXISTING_USERNAME');
const uri=process.env.MONGODB_URI||fs.readFileSync(process.env.MONGODB_URI_FILE||'/run/secrets/mongo-app-uri','utf8').trim();
const connection=await connectMongo({uri,database:process.env.MONGODB_DATABASE||'abujalife_prod',production:true});
try{
  const store=new MongoGameStore({...connection,production:true});
  const admin=new MongoAdminStore({store,bootstrapUsername:''});
  const username=arguments_[1].toLowerCase();
  const resident=await connection.db.collection('residents').findOne({username});
  if(!resident)throw new Error('Create the actual resident account first. No future username can claim this grant.');
  if(await admin.isSuspended(resident.id))throw new Error('Restore the suspended resident through the existing administrator before granting a role.');
  await store.transaction(async session=>{
    await admin.lockRoles(session);
    const prior=await connection.db.collection('admin_roles').findOne({residentId:resident.id},{session});
    await connection.db.collection('admin_roles').updateOne({residentId:resident.id},{$set:{role:'superadmin',assignedBy:'server-console',createdAt:store.clock()},$setOnInsert:{_id:resident.id,residentId:resident.id}},{upsert:true,session});
    await admin.record('server-console','bootstrap-admin',resident.id,{before:prior?.role||null,after:'superadmin',source:'explicit private server console; existing resident ID'},{session});
  });
  console.log(JSON.stringify({ok:true,username,role:'superadmin',adminUrl:'https://abujacity.life/admin/'}));
}finally{await connection.close();}
