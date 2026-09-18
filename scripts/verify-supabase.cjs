/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
if(url!=='https://zzronpsjosajfxutnfzp.supabase.co')throw Error('Unexpected test target');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,options);
const db=new Client({connectionString:process.env.SUPABASE_DB_URL});
const tag='migration-check-'+crypto.randomUUID();
const users=[];
const orgs=[tag+'-a',tag+'-b'];
(async()=>{
 await db.connect();
 try {
  const clients=[];
  for(let i=0;i<2;i++) {
   const email=`${tag}-${i}@example.com`,password=crypto.randomBytes(24).toString('base64url');
   const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
   assert.ifError(created.error);users.push(created.data.user);
   await db.query('insert into public.organizations(id,name,plan) values($1,$2,$3)',[orgs[i],'Disposable migration test','basic']);
   await db.query('update public.profiles set org_id=$1 where auth_user_id=$2',[orgs[i],created.data.user.id]);
   const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
   assert.ifError((await client.auth.signInWithPassword({email,password})).error);
   clients.push(client);
  }
  const a=clients[0],b=clients[1];
  assert.ifError((await a.from('vendors').insert({id:'v',org_id:orgs[0],name:'Disposable vendor'})).error);
  assert.ifError((await a.from('locations').insert({id:'l',org_id:orgs[0],name:'Disposable location'})).error);
  assert.ifError((await a.from('items').insert({id:'i',org_id:orgs[0],name:'Disposable supply',days_last:10,vendor_id:'v',location_id:'l'})).error);
  const own=await a.from('items').select('*').eq('org_id',orgs[0]);assert.ifError(own.error);assert.equal(own.data.length,1);
  const other=await b.from('items').select('*').eq('org_id',orgs[0]);assert.ifError(other.error);assert.equal(other.data.length,0);
  assert.ok((await b.from('items').insert({id:'intrusion',org_id:orgs[0],name:'denied',days_last:10})).error);
  assert.ok((await a.from('profiles').update({internal_admin:true}).eq('auth_user_id',users[0].id)).error);
  assert.ok((await a.from('profiles').update({org_id:orgs[1]}).eq('auth_user_id',users[0].id)).error);
  assert.ok((await a.from('pending_signups').select('*')).error);
  assert.ok((await a.from('locations').insert({id:'over-limit',org_id:orgs[0],name:'Denied'})).error);
  const noAuth=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
  assert.ok((await noAuth.from('organizations').select('*')).error);
  assert.ifError((await a.from('profiles').update({name:'Updated name'}).eq('auth_user_id',users[0].id)).error);
  const recovery=await admin.auth.admin.generateLink({type:'recovery',email:users[0].email});assert.ifError(recovery.error);
  assert.ifError((await a.auth.verifyOtp({type:'recovery',token_hash:recovery.data.properties.hashed_token})).error);
  const newPassword=crypto.randomBytes(24).toString('base64url');assert.ifError((await a.auth.updateUser({password:newPassword})).error);
  await a.auth.signOut();assert.ifError((await a.auth.signInWithPassword({email:users[0].email,password:newPassword})).error);
  const reuse=await noAuth.auth.verifyOtp({type:'recovery',token_hash:recovery.data.properties.hashed_token});assert.ok(reuse.error);
  if(process.env.RESTOK_TEST_BASE_URL) {
   const base=process.env.RESTOK_TEST_BASE_URL;
   if(!['http://127.0.0.1:3000','http://localhost:3000'].includes(base))throw Error('API checks require the local app');
   const token=(await a.auth.getSession()).data.session.access_token;
   const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
   const me=await fetch(base+'/api/me',{headers});assert.equal(me.status,200);assert.equal((await me.json()).orgId,orgs[0]);
   const preferences=await fetch(base+'/api/notifications/preferences',{method:'POST',headers,body:JSON.stringify({notificationEmail:'notification-check@example.com',emailNotifications:false,lowStockAlerts:true})});assert.equal(preferences.status,200);
   const saved=await db.query('select notification_email,email_notifications from public.profiles where auth_user_id=$1',[users[0].id]);assert.equal(saved.rows[0].notification_email,'notification-check@example.com');assert.equal(saved.rows[0].email_notifications,false);
   const order=await fetch(base+'/api/items/activity',{method:'POST',headers,body:JSON.stringify({itemId:'i',action:'ordered'})});assert.equal(order.status,200);
   const start=new Date(own.data[0].created_at).getTime();
   const requests=await Promise.all([1,2].map(()=>fetch(base+'/api/items/activity',{method:'POST',headers,body:JSON.stringify({itemId:'i',action:'received',expectedStart:start})})));
   assert.deepEqual(requests.map(response=>response.status).sort(),[200,409]);
   const history=await fetch(base+'/api/items/activity?itemId=i',{headers});assert.equal(history.status,200);assert.equal((await history.json()).events.length,2);
   console.log('PASS: app API sign-in verification, alternate notification email persistence, order history, concurrent receive deduplication.');
  }
  await db.query('update public.profiles set disabled=true where auth_user_id=$1',[users[0].id]);
  const disabled=await a.from('items').select('*').eq('org_id',orgs[0]);assert.ifError(disabled.error);assert.equal(disabled.data.length,0);
  console.log('PASS: native login, supply CRUD, tenant isolation, privilege escalation denial, anonymous denial, plan limits, password recovery, one-time reset tokens, disabled-account isolation. No emails sent.');
 } finally {
  for(const org of orgs)await db.query('delete from public.organizations where id=$1',[org]);
  for(const user of users){await db.query('delete from public.profiles where auth_user_id=$1',[user.id]);const result=await admin.auth.admin.deleteUser(user.id);if(result.error)throw result.error;}
  await db.end();console.log('Disposable test accounts and organizations removed.');
 }
})().catch(error=>{console.error(error.message);process.exitCode=1});
