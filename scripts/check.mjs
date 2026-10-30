import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
let failed=false;const fail=message=>{failed=true;console.error(message);};
for(const dir of ['src','scripts','api']) {
  for(const file of await readdir(dir))if(/\.(?:mjs|js)$/.test(file)) {
    const result=spawnSync(process.execPath,['--check',join(dir,file)],{encoding:'utf8'});
    if(result.status!==0)fail(result.stderr);
  }
}
const forbidden=/^(?:\.env(?:\..*)?|appednix|\.git|\.openchrome|api|tests|scripts|docs)$/;
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(forbidden.test(entry.name))fail(`Private path in public build: ${path}`);if(entry.isDirectory())await scan(path);else if(/\.(?:js|html|json|css|txt|xml|svg)$/.test(path)){const text=await readFile(path,'utf8');if(/(?:sk-proj-[a-zA-Z0-9_-]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA )?PRIVATE KEY-----)/.test(text))fail(`Credential pattern in ${path}`);}}}
try{await scan('dist');}catch(error){if(error.code!=='ENOENT')throw error;}
if(failed)process.exitCode=1;else console.log('JavaScript syntax and public build credential checks passed.');
