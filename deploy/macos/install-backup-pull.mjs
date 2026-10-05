import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
if(process.platform!=='darwin') throw new Error('This backup pull scheduler is for the authorized Mac.');
const directory=path.join(os.homedir(),'AbujaLife-backups'),label='life.abujacity.backup-pull';
fs.mkdirSync(directory,{recursive:true,mode:0o700}); fs.chmodSync(directory,0o700);
const script=path.join(directory,'pull-backups.mjs');fs.copyFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'pull-backups.mjs'),script);fs.chmodSync(script,0o600);
const agents=path.join(os.homedir(),'Library/LaunchAgents');fs.mkdirSync(agents,{recursive:true});
const xml=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const plist=path.join(agents,label+'.plist');
fs.writeFileSync(plist,`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(script)}</string><string>${xml(directory)}</string></array>
<key>StartInterval</key><integer>21600</integer><key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>${xml(path.join(directory,'pull.stdout.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(directory,'pull.stderr.log'))}</string>
</dict></plist>\n`,{mode:0o600});
spawnSync('/bin/launchctl',['bootout',`gui/${process.getuid()}/${label}`],{stdio:'ignore'});
const result=spawnSync('/bin/launchctl',['bootstrap',`gui/${process.getuid()}`,plist],{stdio:'inherit'});
if(result.status!==0)throw new Error('LaunchAgent could not be registered.');
console.log(JSON.stringify({ok:true,label,directory,schedule:'Every six hours while the Mac is logged in, awake and online; also runs at login.',retentionDays:30}));
