/* eslint-disable @typescript-eslint/no-require-imports */
/* Private, read-only source backup. Never commit the output directory. */
const fs = require("node:fs/promises");
const path = require("node:path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
function encode(value) {
  if (value === null || value === undefined) return value ?? null;
  if (value.toDate && value.toMillis) return { __type: "timestamp", value: value.toDate().toISOString() };
  if (value instanceof Date) return { __type: "timestamp", value: value.toISOString() };
  if (Buffer.isBuffer(value)) return { __type: "bytes", value: value.toString("base64") };
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === "object") {
    if (value.path && value.firestore) return { __type: "reference", value: value.path };
    if (typeof value.latitude === "number") return { __type: "geopoint", latitude: value.latitude, longitude: value.longitude };
    return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,encode(v)]));
  }
  return value;
}
(async () => {
  initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") }) });
  const db = getFirestore();
  const documents = [];
  async function walk(collection) {
    for (const doc of (await collection.get()).docs) {
      documents.push({ path: doc.ref.path, data: encode(doc.data()) });
      for (const child of await doc.ref.listCollections()) await walk(child);
    }
  }
  for (const collection of await db.listCollections()) await walk(collection);
  const users = []; let pageToken;
  do { const page = await getAuth().listUsers(1000, pageToken); users.push(...page.users.map(user => user.toJSON())); pageToken = page.pageToken; } while (pageToken);
  const directory = path.join(".migration-backups", new Date().toISOString().replace(/[:.]/g,"-"));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory,"firebase.json"), JSON.stringify({ projectId: process.env.FIREBASE_PROJECT_ID, exportedAt: new Date().toISOString(), documents, users }, null, 2));
  const counts = {}; for (const doc of documents) { const pattern = doc.path.split("/").map((part,i) => i % 2 ? "{id}" : part).join("/"); counts[pattern] = (counts[pattern] || 0) + 1; }
  const fields = {}; for (const doc of documents) { const pattern = doc.path.split("/").filter((_,i) => i % 2 === 0).join("/"); fields[pattern] = [...new Set([...(fields[pattern] || []),...Object.keys(doc.data)])].sort(); }
  console.log(JSON.stringify({ backup: directory, authUsers: users.length, providers: [...new Set(users.flatMap(u => (u.providerData || []).map(p => p.providerId)))], counts, fields }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
