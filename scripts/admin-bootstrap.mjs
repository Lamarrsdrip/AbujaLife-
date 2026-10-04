#!/usr/bin/env node
import { GameStore } from '../src/server/gameStore.mjs';
import { AdminStore } from '../src/server/adminStore.mjs';

const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--username'||!/^[a-z0-9_]{3,24}$/i.test(args[1]||'')){
  console.error('Usage: node scripts/admin-bootstrap.mjs --username EXISTING_RESIDENT_USERNAME');
  console.error('Run on the server console with the same ABUJALIFE_DATA_DIR as the game. It grants an existing resident super-administrator access; it never creates an account.');
  process.exitCode=2;
}else{
  const store=new GameStore();
  try{
    const admin=new AdminStore({store,bootstrapUsername:''});
    const resident=store.get('SELECT id,username FROM residents WHERE username=?',args[1].toLowerCase());
    if(!resident)throw new Error('That resident does not exist. Create and sign in to the resident account before running this command.');
    if(admin.isSuspended(resident.id))throw new Error('Restore this resident through the existing administrator before granting a role.');
    const old=store.get('SELECT role FROM admin_roles WHERE resident_id=?',resident.id)?.role||null;
    store.transaction(()=>{
      store.run("INSERT INTO admin_roles VALUES(?,'superadmin','server-console',?) ON CONFLICT(resident_id) DO UPDATE SET role=excluded.role,assigned_by=excluded.assigned_by,created_at=excluded.created_at",resident.id,store.clock());
      admin.record('server-console','bootstrap-admin',resident.id,{before:old,after:'superadmin',source:'explicit server console command; existing resident ID'});
    });
    console.log(JSON.stringify({ok:true,username:resident.username,role:'superadmin',adminPath:'/admin.html'}));
  }catch(error){console.error(error.message);process.exitCode=1;}finally{store.close();}
}
