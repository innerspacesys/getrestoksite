"use client";
import { getSupabase } from "@/lib/supabase/client";
import { column, describe, fromRow, toRow, Timestamp, type Data, type Filter } from "./schema";
export const db = {};
export type Ref = { id: string; path: string; kind: "document" | "collection"; filters: Filter[] };
export function collection(_db: typeof db, ...parts: string[]): Ref { return { id: parts.at(-1)!, path: parts.join("/"), kind: "collection", filters: [] }; }
export function doc(_db: typeof db, ...parts: string[]): Ref & { kind: "document" } { return { id: parts.at(-1)!, path: parts.join("/"), kind: "document", filters: [] }; }
export function where(field: string, op: Filter["op"], value: unknown): Filter { return { field, op, value }; }
export function query(ref: Ref, ...filters: Filter[]): Ref { return { ...ref, filters }; }
export function serverTimestamp() { return Timestamp.now(); }
function selection(ref: Ref) {
 const spec = describe(ref.path, ref.kind === "document");
 let q = getSupabase().from(spec.table).select("*");
 for (const [key,value] of Object.entries(spec.scope)) q = q.eq(key,value);
 if (ref.kind === "document") q = q.eq("id",ref.path.split("/").at(-1)!);
 for (const filter of ref.filters) {
  if (!spec.fields.includes(filter.field)) throw new Error("Unsupported query field");
  q = filter.op === "in" ? q.in(column(filter.field),filter.value) : filter.op === "<=" ? q.lte(column(filter.field),filter.value) : q.eq(column(filter.field),filter.value);
 }
 return q;
}
function snapshot(path: string, row?: Data) {
 return { id: path.split("/").at(-1)!, ref: doc(db,path), exists: () => Boolean(row), data: (): Data => row ? fromRow(path,row) : {} };
}
export async function getDoc(ref: Ref) {
 const { data,error } = await selection(ref).maybeSingle(); if (error) throw error;
 return snapshot(ref.path,data || undefined);
}
export async function getDocs(ref: Ref) {
 const { data,error } = await selection(ref); if (error) throw error;
 const docs = (data || []).map(row => snapshot(`${ref.path}/${row.id}`,row));
 return { docs, empty: !docs.length, size: docs.length, forEach: (callback: (doc: ReturnType<typeof snapshot>) => void) => docs.forEach(callback) };
}
export async function addDoc(ref: Ref, data: Data) {
 const id = crypto.randomUUID(); const path = `${ref.path}/${id}`; const spec = describe(path,true);
 const { error } = await getSupabase().from(spec.table).insert({ id,...spec.scope,...toRow(path,data) });
 if (error) throw error; return doc(db,path);
}
export async function updateDoc(ref: Ref, data: Data) {
 const spec = describe(ref.path,true); const row = toRow(ref.path,data);
 // Client writes are restricted to known columns. No arbitrary metadata patching.
 if (row.metadata) throw new Error("Unsupported client field");
 let q = getSupabase().from(spec.table).update(row).eq("id",ref.path.split("/").at(-1)!);
 for (const [key,value] of Object.entries(spec.scope)) q = q.eq(key,value);
 const { data: changed,error } = await q.select("id"); if (error) throw error;
 if (!changed?.length) throw new Error("Record unavailable or permission denied");
}
export async function deleteDoc(ref: Ref) {
 const spec = describe(ref.path,true);
 let q = getSupabase().from(spec.table).delete().eq("id",ref.path.split("/").at(-1)!);
 for (const [key,value] of Object.entries(spec.scope)) q = q.eq(key,value);
 const { error } = await q; if (error) throw error;
}
export function onSnapshot(ref: Ref & { kind: "document" }, callback: (snap: Awaited<ReturnType<typeof getDoc>>) => void): () => void;
export function onSnapshot(ref: Ref, callback: (snap: Awaited<ReturnType<typeof getDocs>> & Awaited<ReturnType<typeof getDoc>>) => void): () => void;
export function onSnapshot(ref: Ref, callback: (snap: never) => void) {
 const client = getSupabase(); const spec = describe(ref.path,ref.kind === "document");
 let closed = false; let running = false; let again = false;
 const refresh = async () => {
   if (running) { again = true; return; } running = true;
   do { again = false; try { const value = ref.kind === "document" ? await getDoc(ref) : await getDocs(ref); if (!closed) callback(value as never); } catch (error) { if (!closed) console.error("Workspace subscription failed",error); } } while (again && !closed);
   running = false;
 };
 const channel = client.channel(`restok-${crypto.randomUUID()}`).on("postgres_changes", { event: "*", schema: "public", table: spec.table }, () => void refresh()).subscribe(status => { if (status === "SUBSCRIBED") void refresh(); });
 void refresh(); const timer = window.setInterval(refresh,30000); window.addEventListener("focus",refresh);
 return () => { closed = true; clearInterval(timer); window.removeEventListener("focus",refresh); void client.removeChannel(channel); };
}
