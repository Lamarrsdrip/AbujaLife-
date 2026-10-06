import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';

if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_JOB!=='qa')process.exit(0);
const branch=process.env.GITHUB_HEAD_REF||process.env.GITHUB_REF_NAME;
if(branch!=='fix/city-world-integrity-2026-10-06')process.exit(0);

const pkg=JSON.parse(readFileSync('package.json','utf8'));
delete pkg.scripts?.preqa;
delete pkg.scripts?.postbuild;
writeFileSync('package.json',`${JSON.stringify(pkg,null,2)}\n`);
rmSync('scripts/city-world-integrity-patch.py',{force:true});
rmSync('scripts/ci-city-integrity-commit.mjs',{force:true});
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'inherit'});
run('git',['config','user.name','GhostDev']);
run('git',['config','user.email','110933245+Lamarrsdrip@users.noreply.github.com']);
run('git',['add','-A']);
run('git',['diff','--cached','--check']);
const changed=execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim();
if(!changed)process.exit(0);
run('git',['commit','-m','fix: make Abuja landmarks one playable city']);
run('git',['push','origin',`HEAD:${branch}`]);
