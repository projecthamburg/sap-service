/** Private companion service for the static GitHub Pages website.
 * Secrets are Worker bindings; no credential is compiled into the public website.
 * R2 objects remain private. Admin retrieval requires a bearer token.
 */
const MAX_BODY=26*1024*1024,MAX_TOTAL=25*1024*1024;
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export function corsHeaders(origin,allowed) {
  return origin&&allowed.split(',').map(v=>v.trim()).includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600',Vary:'Origin'}:null;
}
export function validatePayload(payload,kind) {
  if(!payload||typeof payload!=='object'||payload.consent!==true||payload.website)return 'Consent and a valid request are required.';
  const name=kind==='quote'?payload.contact?.name:payload.name,email=kind==='quote'?payload.contact?.email:payload.email;
  if(typeof name!=='string'||!name.trim()||name.length>200)return 'A name is required.';
  if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||/[\r\n]/.test(email))return 'A valid email is required.';
  if(JSON.stringify(payload).length>100000)return 'The request is too large.';
  if(!['en','fr'].includes(payload.language))return 'A supported language is required.';
  if(kind==='quote'&&(!payload.estimate||!Array.isArray(payload.estimate.scope?.phases)||!payload.estimate.scope.phases.length))return 'A cleaning scope is required.';
  if(kind==='application') {
    if(!payload.city?.trim()||!payload.phone?.trim()||!payload.regions?.trim()||!payload.languages?.trim())return 'Please complete the required application fields.';
    if(!Array.isArray(payload.availability)||payload.availability.some(v=>typeof v!=='string'||!/^[0-6]-[0-3]$/.test(v)))return 'Invalid availability.';
    if(!payload.availability.length&&!payload.hours?.trim())return 'Availability is required.';
  }
  return null;
}
export async function validateAttachment(file,kind) {
  if(!file||typeof file.name!=='string'||typeof file.arrayBuffer!=='function'||!file.size)return false;
  if(file.size>(kind==='application'?5:10)*1024*1024)return false;
  const ext=file.name.split('.').pop().toLowerCase(),bytes=new Uint8Array(await file.slice(0,Math.min(file.size,512)).arrayBuffer());
  const starts=(...values)=>values.every((v,i)=>bytes[i]===v);
  if(ext==='pdf')return (!file.type||file.type==='application/pdf')&&new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
  if(kind==='application'&&ext==='docx') {
    if(file.type&&!['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip'].includes(file.type))return false;
    if(!starts(0x50,0x4b,0x03,0x04))return false;
    const directory=new TextDecoder('latin1').decode(await file.arrayBuffer());return directory.includes('[Content_Types].xml')&&directory.includes('word/document.xml');
  }
  if(kind==='application')return false;
  if(['jpg','jpeg'].includes(ext))return (!file.type||file.type==='image/jpeg')&&starts(0xff,0xd8,0xff);
  if(ext==='png')return (!file.type||file.type==='image/png')&&starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a);
  if(ext==='webp')return (!file.type||file.type==='image/webp')&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
  return false;
}
async function boundedBody(request) {
  if(Number(request.headers.get('content-length'))>MAX_BODY)throw new RangeError('Body limit');
  const reader=request.body?.getReader();if(!reader)throw new Error('Empty body');
  let length=0;const chunks=[];
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_BODY){await reader.cancel();throw new RangeError('Body limit');}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')||''},body:bytes}).formData();
}
async function rateLimit(request,env) {
  const period=Math.floor(Date.now()/900000),ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${env.RATE_SALT}:${period}:${ip}`));
  const key=Array.from(new Uint8Array(hash)).map(v=>v.toString(16).padStart(2,'0')).join('');
  const row=await env.DB.prepare('INSERT INTO request_limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,(period+2)*900).first();
  return row.count<=8;
}
async function authorized(request,env) {
  const expected=env.ADMIN_TOKEN||'',got=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
  if(!expected||expected.length<32||got.length!==expected.length)return false;
  const a=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(expected))),b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(got)));
  let different=0;for(let i=0;i<a.length;i++)different|=a[i]^b[i];return different===0;
}
async function notify(env,id,kind,payload) {
  if(!env.RESEND_API_KEY||!env.NOTIFICATION_FROM||!env.NOTIFICATION_TO)return;
  const name=kind==='quote'?payload.contact.name:payload.name,email=kind==='quote'?payload.contact.email:payload.email;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.NOTIFICATION_FROM,to:[env.NOTIFICATION_TO],reply_to:email,subject:`SAP — ${kind==='quote'?'Quotation request':'Job application'} — ${id}`,text:`A new SAP ${kind} submission was received.\n\nReference: ${id}\nName: ${name}\nEmail: ${email}\n\nRetrieve the submission and private attachments through the authenticated SAP service.\nDo not reply with unnecessary sensitive information.`})});
  if(!response.ok)console.warn('Notification unavailable; submission retained.',response.status);
}
export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url),origin=request.headers.get('Origin')||'',cors=corsHeaders(origin,env.ALLOWED_ORIGINS||'');
    if(request.method==='OPTIONS')return cors?new Response(null,{status:204,headers:cors}):json({error:'Origin not allowed.'},403);
    if(url.pathname==='/health'&&request.method==='GET')return json({service:'sap-service',status:'ok',forms:Boolean(env.DB&&env.FILES)},200,cors||{});
    if(url.pathname.startsWith('/admin/')) {
      if(!await authorized(request,env))return json({error:'Unauthorized.'},401);
      if(request.method!=='GET')return json({error:'Method not allowed.'},405);
      if(url.pathname==='/admin/submissions') {
        const rows=await env.DB.prepare('SELECT id,kind,created_at,expires_at,payload,attachments FROM submissions ORDER BY created_at DESC LIMIT 100').all();return json({submissions:rows.results});
      }
      if(url.pathname.startsWith('/admin/files/')) {
        const key=decodeURIComponent(url.pathname.slice('/admin/files/'.length));if(!/^(?:quote|application)\/SAP-[A-Z0-9-]+\/[a-zA-Z0-9.-]+$/.test(key))return json({error:'Invalid key.'},400);
        const object=await env.FILES.get(key);if(!object)return json({error:'Not found.'},404);
        return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${key.split('/').pop()}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
      }
      return json({error:'Not found.'},404);
    }
    if(!cors)return json({error:'Origin not allowed.'},403);
    const kind=url.pathname==='/v1/quote'?'quote':url.pathname==='/v1/application'?'application':null;
    if(!kind)return json({error:'Not found.'},404,cors);
    if(request.method!=='POST')return json({error:'Method not allowed.'},405,cors);
    if(!env.DB||!env.FILES)return json({error:'Submission service unavailable.'},503,cors);
    try {
      if(!await rateLimit(request,env))return json({error:'Please wait before sending another request.'},429,{'Retry-After':'900',...cors});
      const form=await boundedBody(request),raw=form.get('payload');
      if(typeof raw!=='string'||raw.length>100000)return json({error:'Invalid payload.'},400,cors);
      let payload;try{payload=JSON.parse(raw);}catch{return json({error:'Invalid payload.'},400,cors);}
      const error=validatePayload(payload,kind);if(error)return json({error},400,cors);
      if(env.TURNSTILE_SECRET_KEY) {
        const check=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:payload.turnstileToken||'',remoteip:request.headers.get('CF-Connecting-IP')})});
        const result=await check.json();if(!result.success)return json({error:'Please complete the verification.'},400,cors);
      }
      delete payload.turnstileToken;delete payload.website;
      const files=form.getAll('files');
      if(files.length>(kind==='application'?1:6)||(kind==='application'&&files.length!==1)||files.reduce((n,f)=>n+(f.size||0),0)>MAX_TOTAL)return json({error:'Too many files or total size exceeds 25 MB.'},400,cors);
      for(const file of files)if(!await validateAttachment(file,kind))return json({error:'A file is invalid or exceeds the size limit.'},400,cors);
      const id=`SAP-${kind==='quote'?'Q':'A'}-${crypto.randomUUID().slice(0,8).toUpperCase()}`,attachments=[],created=new Date(),expiry=new Date(created.getTime()+90*86400000);
      try {
        for(let i=0;i<files.length;i++) {
          const file=files[i],safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-150),key=`${kind}/${id}/${i+1}-${safe}`;
          await env.FILES.put(key,file.stream(),{httpMetadata:{contentType:'application/octet-stream'},customMetadata:{reference:id,expires:expiry.toISOString()}});
          attachments.push({key,name:file.name.slice(0,200),size:file.size,type:file.type});
        }
        await env.DB.prepare('INSERT INTO submissions (id,kind,created_at,expires_at,payload,attachments) VALUES (?,?,?,?,?,?)').bind(id,kind,created.toISOString(),expiry.toISOString(),JSON.stringify(payload),JSON.stringify(attachments)).run();
      }catch(error){for(const attachment of attachments)await env.FILES.delete(attachment.key).catch(()=>{});throw error;}
      ctx.waitUntil(notify(env,id,kind,payload).catch(()=>console.warn('Notification unavailable; submission retained.')));
      return json({reference:id,receivedAt:created.toISOString()},201,cors);
    }catch(error){return json({error:error instanceof RangeError?'Files exceed the total size limit.':'We could not receive the request. Please try again.'},error instanceof RangeError?413:500,cors);}
  },
  async scheduled(_controller,env) {
    const now=new Date().toISOString();
    const expired=await env.DB.prepare('SELECT id,attachments FROM submissions WHERE expires_at<? LIMIT 100').bind(now).all();
    for(const row of expired.results){for(const file of JSON.parse(row.attachments))await env.FILES.delete(file.key);await env.DB.prepare('DELETE FROM submissions WHERE id=?').bind(row.id).run();}
    await env.DB.prepare('DELETE FROM request_limits WHERE expires<?').bind(Math.floor(Date.now()/1000)).run();
  }
};
