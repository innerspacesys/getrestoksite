/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const ts = require("typescript");
const compiled = { exports: {} };
new Function("exports",ts.transpileModule(fs.readFileSync("lib/data/schema.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(compiled.exports);
const {describe,toRow,Timestamp} = compiled.exports;
const quote = name => `"${name.replace(/"/g,'""')}"`;
function normalize(value) {
 if(value instanceof Date)return value.toISOString();
 if(Array.isArray(value))return value.map(normalize);
 if(value && typeof value === "object")return Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalize(value[key])]));
 return value;
}
function prepared(document) {
 const spec=describe(document.path,true),data=revive(document.data);
 for (const field of spec.fields) {
  if ((field.endsWith("At") || field === "at") && typeof data[field] === "number") data[field] = Timestamp.fromDate(new Date(data[field]));
 }
 delete data.password;delete data.passwordHash;
 const row=toRow(document.path,data);
 if(spec.name === "passwordSetupTokens" && !row.expires_at)row.expires_at=new Date(0).toISOString();
 return row;
}
function revive(value) {
 if(value?.__type === "timestamp")return Timestamp.fromDate(new Date(value.value));
 if(Array.isArray(value))return value.map(revive);
 if(value && typeof value === "object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,revive(v)]));
 return value;
}
async function upsert(db,table,row,keys) {
 const entries=Object.entries(row);const updates=entries.filter(([key])=>!keys.includes(key)).map(([key])=>`${quote(key)}=excluded.${quote(key)}`);
 await db.query(`insert into public.${quote(table)} (${entries.map(([k])=>quote(k)).join(",")}) values (${entries.map((_,i)=>`$${i+1}`).join(",")}) on conflict (${keys.map(quote).join(",")}) ${updates.length ? `do update set ${updates.join(",")}` : "do nothing"}`,entries.map(([,v])=>v));
}
(async()=>{
 const mode=process.argv[2];const apply=process.argv.includes("--apply");
 const target=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(target!=="https://zzronpsjosajfxutnfzp.supabase.co")throw Error("Unexpected target project");
 const targetDb=new URL(process.env.SUPABASE_DB_URL);
 if(!targetDb.hostname.includes("zzronpsjosajfxutnfzp")&&!decodeURIComponent(targetDb.username).includes("zzronpsjosajfxutnfzp"))throw Error("Database connection must target the requested project");
 if(!["schema","import","verify"].includes(mode))throw Error("Use schema --apply, import <backup/firebase.json> --apply, or verify <backup/firebase.json>");
 if(mode!=="verify"&&!apply)throw Error("Mutation requires --apply");
 const db=new Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});await db.connect();
 try{
 if(mode==="schema"){
  const existing=await db.query("select tablename from pg_tables where schemaname='public'");
  if(existing.rows.length)throw Error("Target already has public tables. Review migrations before applying.");
  for (const file of fs.readdirSync("supabase/migrations").filter(file=>file.endsWith(".sql")).sort()) {
   await db.query(fs.readFileSync(path.join("supabase/migrations",file),"utf8"));
  }
  console.log("Schema applied with row-level security enabled.");return;
 }
 const backupPath=path.resolve(process.argv[3]);
 if(!backupPath.startsWith(path.resolve(".migration-backups")+path.sep))throw Error("Use a private backup under .migration-backups");
 const source=JSON.parse(fs.readFileSync(backupPath,"utf8"));
 if(!source.documents || !source.users)throw Error("Invalid backup");
 if(mode==="verify"){
  const results=[];
  for(const table of ["organizations","profiles","items","vendors","locations","item_activity","pending_signups","password_setup_tokens","audit_logs","notification_deliveries"]){
   const count=await db.query(`select count(*)::int as count from public.${quote(table)}`);results.push({table,count:count.rows[0].count});
  }
  const mapping=await db.query("select count(*)::int as count from migration_private.auth_mapping");
  const archive=await db.query("select count(*)::int as count from migration_private.source_documents");
  if(mapping.rows[0].count!==source.users.length || archive.rows[0].count!==source.documents.length)throw Error("Backup/import counts do not match");
  for(const document of source.documents){
   const spec=describe(document.path,true),id=document.path.split("/").at(-1);const keys={id,...spec.scope};
   const result=await db.query(`select * from public.${quote(spec.table)} where ${Object.keys(keys).map((k,i)=>`${quote(k)}=$${i+1}`).join(" and ")}`,Object.values(keys));
   if(result.rows.length!==1)throw Error(`Missing imported record: ${document.path}`);
   const expected=prepared(document);
   if(spec.name === "users") {
    const sourceUser=source.users.find(user=>user.uid===id);
    expected.internal_admin=document.data.internalAdmin===true || sourceUser?.customClaims?.internalAdmin===true;
    expected.disabled=document.data.disabled===true || sourceUser?.disabled===true;
   }
   for(const [field,value] of Object.entries(expected)) {
    if(JSON.stringify(normalize(result.rows[0][field]))!==JSON.stringify(normalize(value)))throw Error(`Imported field mismatch: ${document.path} (${field})`);
   }
   const archived=await db.query("select payload from migration_private.source_documents where path=$1",[document.path]);
   if(JSON.stringify(normalize(archived.rows[0]?.payload))!==JSON.stringify(normalize(document.data)))throw Error("Private source archive mismatch");
  }
  const linked=await db.query("select count(*)::int as count from migration_private.auth_mapping m join public.profiles p on p.id=m.firebase_uid and p.auth_user_id=m.supabase_uid");
  if(linked.rows[0].count!==source.users.length)throw Error("Some migrated accounts lack linked profiles");
  console.log(JSON.stringify({verified:true,authAccounts:mapping.rows[0].count,archivedDocuments:archive.rows[0].count,tables:results},null,2));return;
 }
 const admin=createClient(target,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const existing=[];let page=1;
 while(true){const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});if(error)throw error;existing.push(...data.users);if(data.users.length<1000)break;page++;}
 const ids=new Map();
 for(const user of source.users){
  if(!user.email)throw Error("An account has no email; manual migration is required");
  let match=existing.find(candidate=>candidate.app_metadata.restok_uid===user.uid);
  if(!match){
   if(existing.some(candidate=>candidate.email?.toLowerCase()===user.email.toLowerCase()))throw Error("An unrelated target account uses a source email; stop for review");
   const profile=source.documents.find(doc=>doc.path===`users/${user.uid}`)?.data;
   const {data,error}=await admin.auth.admin.createUser({email:user.email,password:crypto.randomBytes(32).toString("base64url"),email_confirm:Boolean(user.emailVerified),ban_duration:user.disabled?"876000h":undefined,user_metadata:{display_name:user.displayName||profile?.name||""},app_metadata:{restok_uid:user.uid,internalAdmin:user.customClaims?.internalAdmin===true||profile?.internalAdmin===true,migrated_from_firebase:true}});
   if(error)throw error;match=data.user;
  }
  ids.set(user.uid,match.id);
  await db.query("insert into migration_private.auth_mapping(firebase_uid,supabase_uid,needs_password_reset) values($1,$2,$3) on conflict(firebase_uid) do update set supabase_uid=excluded.supabase_uid",[user.uid,match.id,(user.providerData||[]).some(provider=>provider.providerId==="password")]);
 }
 const rank={organizations:0,users:1,vendors:2,locations:3,items:4,activity:5,pendingSignups:6,passwordSetupTokens:7,auditLogs:8,notificationDeliveries:9};
 const documents=source.documents.slice().sort((a,b)=>rank[describe(a.path,true).name]-rank[describe(b.path,true).name]);
 await db.query("begin");
 try{
  // Auth may create its default UUID profile before admin app metadata is applied.
  // Remove only the empty, automatically created profiles for these imported accounts.
  for (const [legacyId, authId] of ids) {
   if (legacyId !== authId) {
    await db.query("delete from public.profiles where id=$1 and auth_user_id=$1::uuid and org_id is null",[authId]);
   }
   if (!source.documents.some(document => document.path === `users/${legacyId}`)) {
    const user = source.users.find(user => user.uid === legacyId);
    await upsert(db,"profiles",{id:legacyId,auth_user_id:authId,email:user.email,name:user.displayName || "",disabled:Boolean(user.disabled),internal_admin:user.customClaims?.internalAdmin === true},["id"]);
   }
  }
  for(const document of documents){
   await db.query("insert into migration_private.source_documents(path,payload) values($1,$2) on conflict(path) do update set payload=excluded.payload",[document.path,document.data]);
   const spec=describe(document.path,true),id=document.path.split("/").at(-1),data=revive(document.data);
   for (const field of spec.fields) {
    if ((field.endsWith("At") || field === "at") && typeof data[field] === "number") data[field] = Timestamp.fromDate(new Date(data[field]));
   }
   // Retired signup password fields stay only in the private source backup, never in public tables.
   delete data.password;delete data.passwordHash;
   const row={id,...spec.scope,...toRow(document.path,data)};
   if (spec.name === "passwordSetupTokens" && !row.expires_at) row.expires_at = new Date(0).toISOString();
   if(spec.name==="users"){
    row.auth_user_id=ids.get(id)||null;
    const user=source.users.find(user=>user.uid===id);
    row.internal_admin=data.internalAdmin===true||user?.customClaims?.internalAdmin===true;
    row.disabled=data.disabled===true||user?.disabled===true;
   }
   await upsert(db,spec.table,row,Object.keys({id,...spec.scope}));
  }
  await db.query("commit");
 }catch(error){await db.query("rollback");throw error;}
 console.log(JSON.stringify({imported:true,authAccounts:ids.size,sourceDocuments:documents.length,profilesWithoutLogin:documents.filter(d=>d.path.startsWith("users/")&&!ids.has(d.path.split("/")[1])).length}));
 }finally{await db.end();}
})().catch(error=>{console.error(error.message);process.exitCode=1});
