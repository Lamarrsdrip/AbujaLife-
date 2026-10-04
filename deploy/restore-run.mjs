#!/usr/bin/env node
import path from 'node:path';
import {compose} from './config.mjs';
const arguments_=process.argv.slice(2);
if(arguments_.length!==3||arguments_[1]!=='--confirm'||arguments_[2]!=='abujalife_prod')throw new Error('Usage: node deploy/restore-run.mjs FILE.abjl.enc --confirm abujalife_prod. This replaces current game data.');
if(path.basename(arguments_[0])!==arguments_[0])throw new Error('Use an encrypted backup filename, not an arbitrary path.');
const running=compose(['ps','--status','running','--format','json','api'],{capture:true,deployed:true}).trim();
if(running&&running!=='[]')throw new Error('Stop the AbujaLife API service before restoring: docker compose stop api.');
compose(['--profile','ops','run','--rm','--no-deps','restore','node','deploy/restore.mjs','/backups/'+arguments_[0],'--confirm','abujalife_prod'],{deployed:true});
console.log('Database restore completed. Run privileged bootstrap/migration for the compatible release, then start API and verify health.');
