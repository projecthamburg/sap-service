import test from "node:test";
import assert from "node:assert/strict";
import { createOutbox, queuedNotification, outboxKey } from "../api/outbox.mjs";
import { notificationEmail, sendNotification } from "../api/notifications.mjs";
process.env.NOTIFICATIONS_ENABLED="true";
process.env.NOTIFICATION_FROM="Project Hamburg <info@projecthamburg.com>";
process.env.NOTIFICATION_TO="info@projecthamburg.com";
process.env.SITE_URL="https://projecthamburg.github.io/sap-service/";
const record = () => ({pk:"SAP-A-0123456789AB",kind:"application",status:"received",expiresAt:Math.floor(Date.now()/1000)+86400,
  files:[{name:"cv.pdf"}],payload:{name:'<script>bad()</script>',email:"qa@example.com",city:"Montréal",regions:"Montréal",availability:["0-0"],language:"fr"}});
function fixture(send) {
  let time=Date.now(), failPersistence=false;
  const source=record(), rows=new Map([[source.pk,source]]);
  const job=queuedNotification(source,time); rows.set(job.pk,job);
  const conditional=()=>Object.assign(new Error("Condition"),{name:"ConditionalCheckFailedException"});
  const db={async send(command) {
    const i=command.input,type=command.constructor.name;
    if(type==="GetCommand")return {Item:structuredClone(rows.get(i.Key.pk))};
    if(type==="DeleteCommand"){rows.delete(i.Key.pk);return {};}
    if(type==="QueryCommand")return {Items:[...rows.values()].filter(r=>r.recordType===i.ExpressionAttributeValues[":type"]&&r.createdAt<=i.ExpressionAttributeValues[":now"]).slice(0,i.Limit)};
    if(type==="UpdateCommand"){
      const r=rows.get(i.Key.pk),v=i.ExpressionAttributeValues;
      if(!r||r.recordType!==v[":type"]||r.createdAt>v[":now"]||r.expiresAt<=v[":epoch"])throw conditional();
      Object.assign(r,{status:v[":processing"],createdAt:v[":leaseEnd"],leaseToken:v[":lease"],firstAttemptAt:r.firstAttemptAt||v[":now"],attempts:r.attempts+1});return {Attributes:structuredClone(r)};
    }
    if(type==="TransactWriteCommand"){
      if(failPersistence){failPersistence=false;throw Error("temporary database failure");}
      const [q,s]=i.TransactItems.map(x=>x.Update),row=rows.get(q.Key.pk),submission=rows.get(s.Key.pk);
      if(!row||row.leaseToken!==q.ExpressionAttributeValues[":lease"]||submission?.status!=="received")throw conditional();
      const v=q.ExpressionAttributeValues;Object.assign(row,{status:v[":state"],recordType:v[":type"],createdAt:v[":due"]});delete row.leaseToken;
      submission.notification=structuredClone(s.ExpressionAttributeValues[":notification"]);return {};
    }
    throw Error(type);
  }};
  const outbox=createOutbox({db,table:"private-test",readRecord:async key=>rows.get(key),send,clock:()=>time});
  return {outbox,rows,source,job,advance:n=>time+=n,failNextPersistence:()=>failPersistence=true};
}
test("test submissions never queue mail and email envelopes are frozen, escaped and private",()=>{
  const r=record();assert.equal(queuedNotification({...r,isTest:true}),null);
  const job=queuedNotification(r);const original=job.email.html;r.payload.name="changed";
  assert.equal(job.email.html,original);assert.ok(original.includes("&lt;script&gt;"));assert.ok(!original.includes("<script>"));
  assert.match(original,/#\/fr\/inbox/);assert.ok(!original.includes("X-Amz-"));assert.deepEqual(job.email.to,["info@projecthamburg.com"]);
});
test("temporary email failure persists a retry and eventual provider acceptance",async()=>{
  const calls=[];const f=fixture(async(body,key)=>{calls.push({body:structuredClone(body),key});if(calls.length===1)throw Error("notification_provider_503");return {id:"email-accepted"};});
  assert.deepEqual(await f.outbox.runJob(f.job.pk),{retrying:true,failed:false});
  assert.equal(f.source.status,"received");assert.equal(f.source.notification.state,"retrying");
  assert.equal((await f.outbox.runJob(f.job.pk)).skipped,true);
  f.advance(31000);assert.equal((await f.outbox.processBatch()).results[0].sent,true);
  assert.deepEqual(calls[0],calls[1]);assert.equal(f.source.notification.emailId,"email-accepted");
  assert.equal((await f.outbox.runJob(f.job.pk)).skipped,true);assert.equal(calls.length,2);
});
test("concurrent workers claim only one email",async()=>{
  let sends=0;const f=fixture(async()=>{sends++;return {id:"one"};});
  await Promise.all([f.outbox.runJob(f.job.pk),f.outbox.runJob(f.job.pk)]);assert.equal(sends,1);
});
test("provider acceptance followed by database failure retries the same frozen request and key",async()=>{
  const keys=new Set(),calls=[];const f=fixture(async(body,key)=>{keys.add(key);calls.push(JSON.stringify(body));return {id:"stable-provider-id"};});
  f.failNextPersistence();await assert.rejects(f.outbox.runJob(f.job.pk),/database failure/);
  f.advance(61000);assert.equal((await f.outbox.runJob(f.job.pk)).sent,true);
  assert.equal(keys.size,1);assert.equal(calls[0],calls[1]);assert.equal(f.source.notification.emailId,"stable-provider-id");
});
test("repeated failure stops automatically while retaining the received submission",async()=>{
  const f=fixture(async()=>{throw Error("notification_provider_429");});
  for(let i=0;i<6;i++){await f.outbox.runJob(f.job.pk);f.advance(3600001);}
  assert.equal(f.source.status,"received");assert.equal(f.source.notification.state,"failed");
  assert.equal((await f.outbox.processBatch()).processed,0);
});
test("deleted or test-marked source records cannot trigger an email",async()=>{
  let sends=0;const f=fixture(async()=>{sends++;return {id:"none"};});f.source.isTest=true;
  assert.equal((await f.outbox.runJob(f.job.pk)).skipped,true);assert.equal(sends,0);assert.ok(!f.rows.has(outboxKey(f.source.pk)));
});
test("uncertain sends cannot be retried beyond the provider idempotency window",async()=>{
  let sends=0;const f=fixture(async()=>{sends++;throw Error("network problem");});await f.outbox.runJob(f.job.pk);f.advance(21*3600000);
  assert.equal((await f.outbox.runJob(f.job.pk)).failed,true);assert.equal(sends,1);
});
test("provider failures do not retain response bodies or API keys",async t=>{
  process.env.RESEND_API_KEY="synthetic-key";
  t.mock.method(globalThis,"fetch",async(url,options)=>{
    assert.equal(url,"https://api.resend.com/emails");assert.equal(options.headers["Idempotency-Key"],"stable-key");
    return {ok:false,status:503,text:async()=>"sensitive body"};
  });
  await assert.rejects(sendNotification(notificationEmail(record()),"stable-key"),/^Error: notification_provider_503$/);
});
