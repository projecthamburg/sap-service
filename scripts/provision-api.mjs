import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
if(!process.env.CLOUDFLARE_API_TOKEN)try{process.loadEnvFile('.env');}catch{}
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw new Error('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID securely before provisioning.');
async function cf(path,options={}) {
  const response=await fetch(`https://api.cloudflare.com/client/v4${path}`,{...options,headers:{Authorization:`Bearer ${token}`,...(options.body&&!(options.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...options.headers}});
  const data=await response.json();if(!response.ok||data.success===false)throw new Error(`Cloudflare request failed (${response.status}): ${data.errors?.map(e=>e.message).join('; ')||path}`);return data.result;
}
const base=`/accounts/${account}`,service='sap-service-api',bucket='sap-service-private-files';
const databases=await cf(`${base}/d1/database?per_page=100`);
let db=databases.find(d=>d.name==='sap-service-requests');
if(!db)db=await cf(`${base}/d1/database`,{method:'POST',body:JSON.stringify({name:'sap-service-requests'})});
const sql=await readFile('api/schema.sql','utf8');
await cf(`${base}/d1/database/${db.uuid}/query`,{method:'POST',body:JSON.stringify({sql})});
try{await cf(`${base}/r2/buckets/${bucket}`);}catch(error){if(!/404/.test(error.message))throw error;await cf(`${base}/r2/buckets`,{method:'POST',body:JSON.stringify({name:bucket,locationHint:'enam'})});}
// Keep files private: no public bucket URL and no unauthenticated retrieval route.
const form=new FormData();
const bindings=[{type:'d1',name:'DB',id:db.uuid},{type:'r2_bucket',name:'FILES',bucket_name:bucket},{type:'plain_text',name:'ALLOWED_ORIGINS',text:process.env.SAP_ALLOWED_ORIGINS||'https://projecthamburg.github.io,http://127.0.0.1:4173'},{type:'secret_text',name:'RATE_SALT',text:process.env.SAP_RATE_SALT||randomBytes(32).toString('hex')}];
let admin=process.env.SAP_ADMIN_TOKEN;
if(!admin) {
  // A local deployment keeps the generated admin token in an ignored private file.
  // CI must receive a durable token via a repository secret.
  if(process.env.CI)throw new Error('SAP_ADMIN_TOKEN must be configured as a repository secret for CI.');
  admin=randomBytes(32).toString('hex');await mkdir('.local',{recursive:true});await writeFile('.local/api-admin-token',admin+'\n',{mode:0o600});
}
bindings.push({type:'secret_text',name:'ADMIN_TOKEN',text:admin});
for(const [key,name] of [['RESEND_API_KEY','RESEND_API_KEY'],['SAP_NOTIFICATION_FROM','NOTIFICATION_FROM'],['SAP_NOTIFICATION_TO','NOTIFICATION_TO'],['TURNSTILE_SECRET_KEY','TURNSTILE_SECRET_KEY']])if(process.env[key])bindings.push({type:key.includes('KEY')?'secret_text':'plain_text',name,...(key.includes('KEY')?{text:process.env[key]}:{text:process.env[key]})});
form.set('metadata',new Blob([JSON.stringify({main_module:'worker.js',compatibility_date:'2026-01-01',bindings})],{type:'application/json'}));
form.set('worker.js',new Blob([await readFile('api/worker.js','utf8')],{type:'application/javascript+module'}),'worker.js');
await cf(`${base}/workers/scripts/${service}`,{method:'PUT',body:form});
await cf(`${base}/workers/scripts/${service}/subdomain`,{method:'POST',body:JSON.stringify({enabled:true})});
await cf(`${base}/workers/scripts/${service}/schedules`,{method:'PUT',body:JSON.stringify([{cron:'0 5 * * *'}])});
const subdomain=await cf(`${base}/workers/subdomain`),url=`https://${service}.${subdomain.subdomain}.workers.dev`;
const response=await fetch(`${url}/health`);if(!response.ok)throw new Error('Deployed API health check failed.');
const health=await response.json();if(!health.forms)throw new Error('Private storage bindings are unavailable.');
const siteConfig=JSON.parse(await readFile('public/site-config.json','utf8'));siteConfig.apiUrl=url;
if(process.env.TURNSTILE_SITE_KEY)siteConfig.turnstileSiteKey=process.env.TURNSTILE_SITE_KEY;
await writeFile('public/site-config.json',JSON.stringify(siteConfig,null,2)+'\n');
console.log(`Private form service deployed and health checked: ${url}`);
console.log('Rebuild and publish GitHub Pages to enable direct submissions.');
