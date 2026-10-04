import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const ENV_FILE=path.resolve(process.env.ABUJALIFE_DEPLOY_ENV_FILE||path.join(ROOT,'deploy/.env'));
export function configuration(){
  const configured={};
  for(const line of fs.readFileSync(ENV_FILE,'utf8').split(/\r?\n/)){
    const match=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(match)configured[match[1]]=match[2];
  }
  return {...configured,...process.env};
}
export function releaseStateDirectory(value=configuration()){
  return path.resolve(value.ABUJALIFE_RELEASE_STATE_DIR||path.join(path.dirname(value.ABUJALIFE_SECRETS_DIR||path.join(ROOT,'deploy/.secrets')),'releases'));
}
export function deployedEnvironment(value=configuration()){
  const file=path.join(releaseStateDirectory(value),'current.json');
  if(!fs.existsSync(file))return {};
  if(!fs.lstatSync(file).isFile())throw new Error('The recorded release must be a regular file.');
  const recorded=JSON.parse(fs.readFileSync(file,'utf8')),result={};
  for(const type of ['API','OPS','MONGO']){
    const name='ABUJALIFE_'+type+'_IMAGE',image=recorded.environment?.[name];
    if(typeof image!=='string'||!new RegExp('^abujalife-'+type.toLowerCase()+':[a-f0-9]{12}-[a-f0-9]{12}$').test(image))throw new Error('The recorded release has an invalid '+type+' image.');
    result[name]=image;
  }
  const port=Number(recorded.environment?.ABUJALIFE_API_LOOPBACK_PORT);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('The recorded release has an invalid API port.');
  result.ABUJALIFE_API_LOOPBACK_PORT=String(port);
  return result;
}
export function compose(arguments_,{capture=false,environment={},deployed=false}={}){
  const value=configuration();
  return execFileSync('docker',['compose','--project-name',value.ABUJALIFE_PROJECT_NAME||'abujalife-prod','--env-file',ENV_FILE,'-f',path.join(ROOT,'deploy/compose.yml'),...arguments_],{cwd:ROOT,env:{...value,...(deployed?deployedEnvironment(value):{}),...environment},encoding:'utf8',stdio:capture?['ignore','pipe','pipe']:'inherit'});
}
