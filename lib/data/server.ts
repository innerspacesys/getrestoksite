import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/lib/supabase/admin";
import { describe, column, toRow, fromRow, type Data, type Filter } from "./schema";
export { Timestamp, FieldValue } from "./schema";
const quote = (name: string) => `"${name.replace(/"/g,'""')}"`;
class Snapshot {
 constructor(public ref: Document, private row?: Data) {}
 get id() { return this.ref.path.split("/").at(-1)!; }
 get exists() { return Boolean(this.row); }
 data(): Data | undefined { return this.row ? fromRow(this.ref.path,this.row) : undefined; }
}
export class Document {
 constructor(public path: string, private client?: PoolClient) { describe(path,true); }
 get id() { return this.path.split("/").at(-1)!; }
 collection(name: string) { return new Collection(`${this.path}/${name}`,this.client); }
 private executor() { return this.client || getPool(); }
 private keys() { return { id: this.id, ...describe(this.path,true).scope }; }
 async get() {
   if (this.client) await this.client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[this.path]);
   const spec = describe(this.path,true); const entries = Object.entries(this.keys());
   const result = await this.executor().query(`select * from public.${quote(spec.table)} where ${entries.map(([k],i) => `${quote(k)}=$${i+1}`).join(" and ")}${this.client ? " for update" : ""}`,entries.map(([,v])=>v));
   return new Snapshot(this,result.rows[0]);
 }
 async set(data: Data, options?: { merge?: boolean }) {
   const spec = describe(this.path,true); const row = { ...this.keys(), ...toRow(this.path,data) };
   const entries = Object.entries(row); const keys = Object.keys(this.keys());
   const updates = entries.filter(([key]) => !keys.includes(key)).map(([key]) => key === "metadata" && options?.merge ? `metadata=${quote(spec.table)}.metadata || excluded.metadata` : `${quote(key)}=excluded.${quote(key)}`);
   const conflict = keys.map(quote).join(",");
   await this.executor().query(`insert into public.${quote(spec.table)} (${entries.map(([k])=>quote(k)).join(",")}) values (${entries.map((_,i)=>`$${i+1}`).join(",")}) on conflict (${conflict}) ${updates.length ? `do update set ${updates.join(",")}` : "do nothing"}`,entries.map(([,v])=>v));
 }
 async create(data: Data) {
   const spec = describe(this.path,true); const entries = Object.entries({ ...this.keys(),...toRow(this.path,data) });
   await this.executor().query(`insert into public.${quote(spec.table)} (${entries.map(([k])=>quote(k)).join(",")}) values (${entries.map((_,i)=>`$${i+1}`).join(",")})`,entries.map(([,v])=>v));
 }
 async update(data: Data) {
   const spec = describe(this.path,true); const entries = Object.entries(toRow(this.path,data)); if (!entries.length) return;
   const keys = Object.entries(this.keys());
   const sets = entries.map(([key],i)=>key === "metadata" ? `metadata=metadata || $${i+1}::jsonb` : `${quote(key)}=$${i+1}`);
   const result = await this.executor().query(`update public.${quote(spec.table)} set ${sets.join(",")} where ${keys.map(([k],i)=>`${quote(k)}=$${entries.length+i+1}`).join(" and ")}`, [...entries,...keys].map(([,v])=>v));
   if (!result.rowCount) throw new Error("Record does not exist");
 }
 async delete() {
   const spec = describe(this.path,true); const keys = Object.entries(this.keys());
   await this.executor().query(`delete from public.${quote(spec.table)} where ${keys.map(([k],i)=>`${quote(k)}=$${i+1}`).join(" and ")}`,keys.map(([,v])=>v));
 }
}
class QuerySnapshot extends Snapshot {
 data(): Data { return super.data()!; }
}
class Collection {
 constructor(public path: string, private client?: PoolClient, private filters: Filter[] = [], private sort?: { field: string; direction: "asc" | "desc" }, private maximum?: number) { describe(path); }
 doc(id: string = randomUUID()) { if (id.includes("/")) throw new Error("Invalid record id"); return new Document(`${this.path}/${id}`,this.client); }
 async add(data: Data) { const ref = this.doc(); await ref.create(data); return ref; }
 where(field: string, op: Filter["op"], value: unknown) { return new Collection(this.path,this.client,[...this.filters,{field,op,value}],this.sort,this.maximum); }
 orderBy(field: string,direction: "asc" | "desc" = "asc") { return new Collection(this.path,this.client,this.filters,{field,direction},this.maximum); }
 limit(maximum: number) { return new Collection(this.path,this.client,this.filters,this.sort,maximum); }
 async get() {
   const spec = describe(this.path); const values: unknown[] = []; const conditions: string[] = [];
   for (const [key,value] of Object.entries(spec.scope)) { values.push(value); conditions.push(`${quote(key)}=$${values.length}`); }
   for (const filter of this.filters) {
     if (!spec.fields.includes(filter.field)) throw new Error(`Unsupported filter: ${filter.field}`);
     values.push(filter.value);
     conditions.push(`${quote(column(filter.field))}${filter.op === "in" ? `=any($${values.length})` : `${filter.op === "==" ? "=" : "<="}$${values.length}`}`);
   }
   if (this.sort && !spec.fields.includes(this.sort.field)) throw new Error("Unsupported sort");
   const sql = `select * from public.${quote(spec.table)}${conditions.length ? ` where ${conditions.join(" and ")}` : ""}${this.sort ? ` order by ${quote(column(this.sort.field))} ${this.sort.direction}` : ""}${this.maximum ? ` limit ${Math.max(1,Math.trunc(this.maximum))}` : ""}`;
   const result = await (this.client || getPool()).query(sql,values);
   const docs = result.rows.map(row=>new QuerySnapshot(this.doc(row.id),row));
   return { docs, empty: !docs.length, size: docs.length };
 }
}
export const adminDb = {
 doc: (path: string) => new Document(path),
 collection: (path: string) => new Collection(path),
 async runTransaction<T>(callback: (transaction: { get(ref: Document): Promise<Snapshot>; update(ref: Document,data: Data): void; create(ref: Document,data: Data): void }) => Promise<T>): Promise<T> {
   const client = await getPool().connect();
   try {
     await client.query("begin");
     const writes: Array<() => Promise<void>> = [];
     const value = await callback({ get: ref=>new Document(ref.path,client).get(), update: (ref,data)=>{writes.push(()=>new Document(ref.path,client).update(data));}, create: (ref,data)=>{writes.push(()=>new Document(ref.path,client).create(data));} });
     for (const write of writes) await write();
     await client.query("commit"); return value;
   } catch(error) { await client.query("rollback"); throw error; }
   finally { client.release(); }
 }
};
