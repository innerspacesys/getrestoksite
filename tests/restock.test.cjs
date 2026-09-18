/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
function load(file, mocks = {}) {
  const compiled = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("require", "module", "exports", code)(name => name in mocks ? mocks[name] : require(name), compiled, compiled.exports);
  return compiled.exports;
}
const stock = load("lib/inventory.ts");
const email = load("lib/notificationPreferences.ts");
const now = Date.UTC(2026, 8, 18, 14);
const stamp = ms => ({ toDate: () => new Date(ms), toMillis: () => ms });
const item = { createdAt: stamp(now - 7 * 86400000), daysLast: 10 };
test("existing supplies retain three-day warning and elapsed-day boundaries", () => {
  assert.equal(stock.daysRemaining(item, now - 1), 4);
  assert.equal(stock.daysRemaining(item, now), 3);
  assert.equal(stock.needsReorder(item, now), true);
  assert.equal(stock.stockLabel(item, now + 4 * 86400000), "1 day overdue");
});
test("custom windows including due-day-only are respected", () => {
  assert.equal(stock.needsReorder({ ...item, reminderDays: 0 }, now), false);
  assert.equal(stock.needsReorder({ ...item, reminderDays: 0 }, now + 3 * 86400000), true);
  assert.equal(stock.needsReorder({ ...item, reminderDays: 14 }, now - 5 * 86400000), true);
  assert.equal(stock.reminderWindow({ reminderDays: -1 }), 3);
});
test("ordered supplies pause reorder alerts without resetting their remaining stock", () => {
  assert.equal(stock.needsReorder({ ...item, orderStatus: "ordered" }, now), false);
  assert.equal(stock.daysRemaining({ ...item, orderStatus: "ordered" }, now), 3);
  assert.equal(stock.daysRemaining({ ...item, lastRestockedAt: stamp(now) }, now), 10);
  assert.equal(stock.needsReorder({ ...item, daysLast: NaN }, now), false);
  assert.equal(stock.daysRemaining({ daysLast: 4 }, now), null);
});
test("alternate recipients are trimmed and empty/invalid overrides fall back", () => {
  assert.equal(email.notificationRecipient({ email: "login@example.com", notificationEmail: " orders@example.com " }), "orders@example.com");
  assert.equal(email.notificationRecipient({ email: "login@example.com", notificationEmail: " " }), "login@example.com");
  assert.equal(email.notificationRecipient({ email: "login@example.com", notificationEmail: "invalid" }), "login@example.com");
  assert.equal(email.validEmail("one@example.com,other@example.com"), false);
});
test("digest escapes item names and includes vendor, location and review link", () => {
  const templates = load("lib/emailTemplates.ts");
  const result = templates.buildStockDigestEmail("Office <HQ>", [{ name: "<script>alert(1)</script>", daysLeft: -2, vendor: "Vendor", location: "Kitchen" }]);
  assert.ok(!result.html.includes("<script>"));
  assert.ok(result.html.includes("&lt;script&gt;"));
  assert.ok(result.text.includes("Kitchen"));
  assert.ok(result.text.includes("2 days overdue"));
  assert.ok(result.text.includes("/dashboard/restock"));
});
function database(seed) {
  const data = new Map(Object.entries(seed));
  const ref = path => ({ path, collection: name => ({ doc: id => ref(`${path}/${name}/${id || "event"}`) }), get: async () => ({ exists: data.has(path), data: () => data.get(path) }) });
  const db = { collection: name => ({ doc: id => ref(`${name}/${id}`) }), runTransaction: async fn => fn({ get: r => r.get(), update: (r, value) => data.set(r.path, { ...data.get(r.path), ...value }), create: (r, value) => data.set(r.path, value) }) };
  return { db, data, ref };
}
test("receiving preserves original creation date, records actor and rejects duplicate receive", async () => {
  const { db, data, ref } = database({ "organizations/org/items/paper": { name: "Paper", createdAt: stamp(now), daysLast: 10, orderStatus: "ordered" } });
  class ApiError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
  const route = load("app/api/items/activity/route.ts", {
    "@/lib/data/server": { Timestamp: { now: () => stamp(now + 86400000) }, FieldValue: { delete: () => null } },
    "@/lib/auth/server": { adminDb: db },
    "@/lib/apiAuth": { ApiError, apiError: e => Response.json({ error: e.message }, { status: e.status || 500 }), requireMember: async () => ({ uid: "user", user: { name: "Tester" }, orgRef: ref("organizations/org") }) },
  });
  const request = () => new Request("http://localhost/api/items/activity", { method: "POST", body: JSON.stringify({ itemId: "paper", action: "received", expectedStart: now }) });
  assert.equal((await route.POST(request())).status, 200);
  const changed = data.get("organizations/org/items/paper");
  assert.equal(changed.createdAt.toMillis(), now);
  assert.equal(changed.lastRestockedAt.toMillis(), now + 86400000);
  assert.equal(changed.orderStatus, "idle");
  assert.equal(data.get("organizations/org/items/paper/activity/event").actorName, "Tester");
  assert.equal((await route.POST(request())).status, 409);
  assert.equal((await route.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ itemId: "other-org/item", action: "ordered" }) }))).status, 400);
});
test("notification preferences reject invalid addresses and only update the caller", async () => {
  let saved;
  class ApiError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
  const route = load("app/api/notifications/preferences/route.ts", {
    "@/lib/notificationPreferences": email,
    "@/lib/apiAuth": { ApiError, apiError: e => Response.json({}, { status: e.status }), requireMember: async () => ({ userRef: { update: async data => { saved = data; } } }) },
  });
  const request = address => new Request("http://localhost", { method: "POST", body: JSON.stringify({ notificationEmail: address, emailNotifications: true, lowStockAlerts: true, email: "do-not-change@example.com" }) });
  assert.equal((await route.POST(request("bad"))).status, 400);
  assert.equal(saved, undefined);
  assert.equal((await route.POST(request(" orders@example.com "))).status, 200);
  assert.equal(saved.notificationEmail, "orders@example.com");
  assert.equal(saved.email, undefined);
});
test("new endpoints require valid sign-in and active membership", async () => {
  const { db } = database({ "users/user": { orgId: "org", disabled: true }, "organizations/org": { active: true } });
  const auth = load("lib/apiAuth.ts", { "@/lib/auth/server": { adminDb: db, adminAuth: { verifyIdToken: async () => ({ uid: "user" }) } } });
  await assert.rejects(auth.requireMember(new Request("http://localhost")), e => e.status === 401);
  await assert.rejects(auth.requireMember(new Request("http://localhost", { headers: { Authorization: "Bearer token" } })), e => e.status === 403);
});

test("daily digest authenticates cron, groups supplies, excludes pending orders and retries safely", async () => {
  const store = new Map();
  let sends = 0;
  let lastPayload;
  const ref = id => ({ get: async () => ({ exists: store.has(id), data: () => store.get(id) }), update: async patch => store.set(id, { ...store.get(id), ...patch }) , id });
  const eligible = { email: "login@example.com", notificationEmail: "supplies@example.com", orgId: "org" };
  const docs = values => ({ docs: values.map(([id, data]) => ({ id, data: () => data })) });
  const snapshots = {
    items: docs([["one", { name: "Paper", ...item }], ["two", { name: "Ink", ...item }], ["three", { name: "Pending", ...item, orderStatus: "ordered" }]]),
    vendors: docs([]), locations: docs([]),
  };
  const db = {
    collection: name => name === "users" ? { get: async () => docs([["user", eligible], ["disabled", { ...eligible, disabled: true }], ["optout", { ...eligible, lowStockAlerts: false }]]) }
      : name === "organizations" ? { doc: () => ({ get: async () => ({ data: () => ({ name: "Office", active: true }) }), collection: name => ({ get: async () => snapshots[name] }) }) }
      : { doc: ref },
    runTransaction: async fn => fn({ get: r => r.get(), create: (r, value) => store.set(r.id, value) }),
  };
  const route = load("app/api/cron/check-items/route.ts", {
    "@/lib/auth/server": { adminDb: db },
    "@/lib/data/server": { Timestamp: { now: () => stamp(now) } },
    "@/lib/inventory": { ...stock, needsReorder: i => stock.needsReorder(i, now), daysRemaining: i => stock.daysRemaining(i, now) },
    "@/lib/emailTemplates": load("lib/emailTemplates.ts"),
    "@/lib/email": { resolveNotificationEmail: email.notificationRecipient, sendEmail: async payload => { sends++; lastPayload = payload; } },
  });
  const previous = process.env.CRON_SECRET; process.env.CRON_SECRET = "test-secret";
  try {
    assert.equal((await route.GET(new Request("http://localhost"))).status, 401);
    const request = () => new Request("http://localhost", { headers: { Authorization: "Bearer test-secret" } });
    assert.equal((await route.GET(request())).status, 200);
    assert.equal(sends, 1);
    assert.equal(lastPayload.to, "supplies@example.com");
    assert.ok(lastPayload.text.includes("Paper") && lastPayload.text.includes("Ink"));
    assert.ok(!lastPayload.text.includes("Pending"));
    assert.ok(lastPayload.idempotencyKey.startsWith("digest-"));
    assert.equal((await route.GET(request())).status, 200);
    assert.equal(sends, 1);
  } finally { if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous; }
});
