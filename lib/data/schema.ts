/* eslint-disable @typescript-eslint/no-explicit-any */
// Boundary for legacy Restok records; core fields live in relational columns.
export type Data = Record<string, any>;
export class Timestamp {
  constructor(private readonly value: number) {}
  static now() { return new Timestamp(Date.now()); }
  static fromDate(date: Date) { return new Timestamp(date.getTime()); }
  toDate() { return new Date(this.value); }
  toMillis() { return this.value; }
}
export const FieldValue = { delete: () => null, serverTimestamp: () => Timestamp.now() };
const definitions: Record<string, { table: string; fields: string[] }> = {
 organizations: { table: "organizations", fields: ["name","ownerId","plan","active","stripeCustomerId","stripeSubscriptionId","createdAt","canceledAt","scheduledDeletionAt","status","beta","manualPlanOverride","internalNotes"] },
 users: { table: "profiles", fields: ["authUserId","orgId","email","name","phone","role","disabled","accountStatus","internalAdmin","notificationEmail","emailNotifications","lowStockAlerts","createdAt","updatedAt","removedAt","deactivatedAt","reactivatedAt","scheduledDeletionAt","lastNotificationTestAt","authProvider","theme"] },
 vendors: { table: "vendors", fields: ["name","email","website","hasPhysicalStore","createdAt","updatedAt"] },
 locations: { table: "locations", fields: ["name","address","description","isDepartment","createdAt","updatedAt"] },
 items: { table: "items", fields: ["name","daysLast","reminderDays","vendorId","locationId","description","sku","createdByName","createdAt","lastRestockedAt","lastAlertSentAt","orderStatus","orderedAt","orderedByName","reorderMethod"] },
 activity: { table: "item_activity", fields: ["action","at","actorUid","actorName","previousStart","itemName"] },
 pendingSignups: { table: "pending_signups", fields: ["email","name","orgName","phone","plan","interval","googleUid","googleEmail","createdAt"] },
 passwordSetupTokens: { table: "password_setup_tokens", fields: ["uid","email","createdAt","expiresAt"] },
 auditLogs: { table: "audit_logs", fields: ["orgId","type","createdAt"] },
 notificationDeliveries: { table: "notification_deliveries", fields: ["to","subject","html","text","createdAt","sentAt"] },
};
export function column(field: string) { return field === "to" ? "recipient" : field.replace(/[A-Z]/g, char => `_${char.toLowerCase()}`); }
export function describe(path: string, document = false) {
 const parts = path.split("/");
 if (parts.some(part => !part || part === "." || part === "..")) throw new Error("Invalid record path");
 if (document) parts.pop();
 const name = parts.at(-1)!;
 const definition = definitions[name];
 if (!definition || !([1,3,5].includes(parts.length)) || parts.length > 1 && parts[0] !== "organizations" || parts.length === 5 && (parts[2] !== "items" || name !== "activity")) throw new Error("Unknown record collection");
 if (parts.length === 1 && ["items","vendors","locations","activity"].includes(name)) throw new Error("An organization is required");
 if (parts.length === 3 && !["items","vendors","locations"].includes(name)) throw new Error("Unknown organization collection");
 const scope: Data = parts.length > 1 ? { org_id: parts[1] } : {};
 if (parts.length === 5) scope.item_id = parts[3];
 return { ...definition, scope, name };
}
function encode(value: any): any {
 if (value instanceof Timestamp || value instanceof Date) return value instanceof Timestamp ? value.toDate().toISOString() : value.toISOString();
 if (Array.isArray(value)) return value.map(encode);
 if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).map(([k,v]) => [k,encode(v)]));
 return value;
}
export function toRow(path: string, data: Data) {
 const { fields } = describe(path, true);
 const row: Data = {}; const metadata: Data = {};
 for (const [key,value] of Object.entries(data)) {
   if (value === undefined) continue;
   if (fields.includes(key)) row[column(key)] = encode(value);
   else if (key !== "id" && !(key === "orgId" && path.startsWith("organizations/"))) metadata[key] = encode(value);
 }
 if (Object.keys(metadata).length) row.metadata = metadata;
 return row;
}
export function fromRow(path: string, row: Data): Data {
 const { fields, name } = describe(path, true);
 const data: Data = { ...row.metadata };
 for (const field of fields) {
   const value = row[column(field)];
   data[field] = value != null && (field.endsWith("At") || field === "at") ? Timestamp.fromDate(new Date(value)) : value;
 }
 if (name === "organizations") data.orgId = row.id;
 return data;
}
export type Filter = { field: string; op: "==" | "in" | "<="; value: any };
