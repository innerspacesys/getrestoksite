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

class ApiError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const authMocks = { ApiError, apiError: error => Response.json({ error: error.message }, { status: error.status || 500 }) };
function recoveryFixture({ role = "owner", disabled = false, subs, sessions = [] } = {}) {
  const updates = []; const checkouts = []; const portals = [];
  const org = { stripeCustomerId: "cus_existing", plan: "pro", active: false };
  const previous = { id: "sub_old", status: "canceled", items: { data: [{ quantity: 1, price: { id: "price_previous", active: true, recurring: {} } }] } };
  const stripe = {
    subscriptions: { list: async () => ({ data: subs || [previous], has_more: false }) },
    billingPortal: { sessions: { create: async input => { portals.push(input); return { url: "https://stripe.test/portal" }; } } },
    checkout: { sessions: { list: async () => ({ data: sessions }), create: async (input, options) => {
      checkouts.push({ input, options }); return { url: "https://stripe.test/checkout" };
    } } },
  };
  const db = { collection: name => ({ doc: id => ({ get: async () => ({ data: () => name === "users" ? { orgId: "existing", role, disabled } : org }), id }) }),
    runTransaction: async fn => fn({ get: async () => ({ data: () => org }), update: (...args) => updates.push(args) }) };
  const route = load("app/api/stripe/resubscribe/route.ts", {
    stripe: { default: function () { return stripe; } },
    "@/lib/auth/server": { adminDb: db, adminAuth: { verifyIdToken: async () => ({ uid: "owner" }) } },
    "@/lib/apiAuth": authMocks,
  });
  return { route, checkouts, portals, updates };
}
const request = () => new Request("https://restok.test/api/stripe/resubscribe", { method: "POST", headers: { authorization: "Bearer test" }, body: JSON.stringify({ orgId: "attacker_selected_org" }) });
process.env.STRIPE_SECRET_KEY ||= "test_not_a_real_key";
test("canceled workspace checks out using existing customer and authenticated organization", async () => {
  const f = recoveryFixture();
  assert.equal((await f.route.POST(request())).status, 200);
  assert.equal(f.checkouts.length, 1);
  assert.equal(f.checkouts[0].input.customer, "cus_existing");
  assert.equal(f.checkouts[0].input.metadata.restok_recovery_org, "existing");
  assert.equal(f.checkouts[0].input.line_items[0].price, "price_previous");
  assert.equal(f.updates.length, 0, "access must not be restored before Stripe confirms");
});
test("members, disabled admins and anonymous callers cannot start billing recovery", async () => {
  for (const options of [{ role: "member" }, { role: "admin", disabled: true }]) {
    const f = recoveryFixture(options);
    assert.equal((await f.route.POST(request())).status, 403);
    assert.equal(f.checkouts.length, 0);
  }
  assert.equal((await recoveryFixture().route.POST(new Request("https://restok.test", { method: "POST" }))).status, 401);
});
test("existing live and unpaid subscriptions go to portal without a second subscription", async () => {
  for (const status of ["active", "past_due", "unpaid", "paused", "incomplete"]) {
    const f = recoveryFixture({ subs: [{ status }] });
    assert.equal((await f.route.POST(request())).status, 200);
    assert.equal(f.checkouts.length, 0);
    assert.equal(f.portals.length, 1);
  }
});
test("repeat recovery reuses the open Checkout session", async () => {
  const f = recoveryFixture({ sessions: [{ id: "cs_open", status: "open", url: "https://stripe.test/existing", metadata: { restok_recovery_org: "existing" } }] });
  const res = await f.route.POST(request());
  assert.equal((await res.json()).url, "https://stripe.test/existing");
  assert.equal(f.checkouts.length, 0);
});
function quickAddFixture({ loseResponse = false, reject = false } = {}) {
  const saved = new Map(); let insertCalls = 0;
  const client = { from: () => ({
    insert: async records => {
      insertCalls++;
      if (reject || records.some(row => saved.has(row.id))) return { error: { message: "Insert rejected" } };
      records.forEach(row => saved.set(row.id, row));
      return { error: loseResponse ? { message: "Response lost" } : null };
    },
    select: () => ({ eq: () => ({ in: async (_, ids) => ({ data: ids.flatMap(id => saved.has(id) ? [saved.get(id)] : []), error: null }) }) }),
  }) };
  return { saved, calls: () => insertCalls, ...load("lib/quickAdd.ts", { "@/lib/supabase/client": { getSupabase: () => client } }) };
}
const rows = [{ id: "paper-id", name: "Paper", daysLast: 30 }, { id: "coffee-id", name: "Coffee", daysLast: 20 }];
test("Quick Add sends the entire batch in one insert and surfaces rejection", async () => {
  const f = quickAddFixture({ reject: true });
  await assert.rejects(f.saveQuickAdd("org", rows, "Tester"), /Insert rejected/);
  assert.equal(f.calls(), 1);
  assert.equal(f.saved.size, 0);
});
test("Quick Add verifies a lost success response and retries without duplicate items", async () => {
  const f = quickAddFixture({ loseResponse: true });
  await f.saveQuickAdd("org", rows, "Tester");
  await f.saveQuickAdd("org", rows, "Tester");
  assert.equal(f.saved.size, 2);
  assert.deepEqual([...f.saved.values()].map(row => row.name), ["Paper", "Coffee"]);
});
test("recovery webhook restores existing workspace without creating accounts", async () => {
  const writes = [];
  const event = { type: "checkout.session.completed", data: { object: {
    metadata: { restok_recovery_org: "org" }, customer: "cus_existing", subscription: "sub_new",
  } } };
  const route = load("app/api/stripe/webhook/route.ts", {
    "next/server": { NextResponse: Response },
    stripe: { default: function () { return { webhooks: { constructEvent: () => event }, subscriptions: { retrieve: async () => ({ id: "sub_new", status: "active" }) } }; } },
    "@/lib/auth/server": { adminAuth: {}, adminDb: { collection: name => {
      assert.equal(name, "organizations"); return { doc: id => { assert.equal(id, "org"); return {
        get: async () => ({ data: () => ({ stripeCustomerId: "cus_existing" }) }), update: async data => writes.push(data),
      }; } };
    } } },
    "@/lib/data/server": {}, "@/lib/email": {}, "@/lib/emailTemplates": {},
  });
  process.env.STRIPE_WEBHOOK_SECRET ||= "test_webhook";
  const res = await route.POST(new Request("https://restok.test", { method: "POST", headers: { "stripe-signature": "test" }, body: "{}" }));
  assert.equal(res.status, 200);
  assert.deepEqual(writes, [{ active: true, stripeSubscriptionId: "sub_new", canceledAt: null, scheduledDeletionAt: null }]);
});

function webhookFixture(eventType, eventSubscription, currentId, subscriptions) {
  const writes = [];
  const ref = { update: async data => writes.push(data) };
  const route = load("app/api/stripe/webhook/route.ts", {
    "next/server": { NextResponse: Response },
    stripe: { default: function () { return {
      webhooks: { constructEvent: () => ({ type: eventType, data: { object: eventSubscription } }) },
      subscriptions: { retrieve: async id => subscriptions[id] },
    }; } },
    "@/lib/auth/server": { adminDb: { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ empty: false, docs: [{ ref, data: () => ({ stripeSubscriptionId: currentId }) }] }) }) }) }) } },
    "@/lib/data/server": { Timestamp: { now: () => "now" } }, "@/lib/email": {}, "@/lib/emailTemplates": {},
  });
  return { writes, run: () => route.POST(new Request("https://restok.test", { method: "POST", headers: { "stripe-signature": "test" }, body: "{}" })) };
}
test("late cancellation and update events from the old subscription cannot revoke restored access", async () => {
  for (const event of ["customer.subscription.deleted", "customer.subscription.updated"]) {
    const old = { id: "old", customer: "cus", status: "canceled", items: { data: [{ price: { id: "price", nickname: "pro" } }] } };
    const f = webhookFixture(event, old, "new", { old, new: { status: "active" } });
    assert.equal((await f.run()).status, 200);
    assert.equal(f.writes.length, 0);
  }
});
test("plan changes after recovery use the current price, not stale recovery metadata", async () => {
  process.env.STRIPE_MONTHLY_PREMIUM_PRICE_ID = "price_premium_test";
  const sub = { id: "new", customer: "cus", status: "active",
    metadata: { restok_plan: "pro", restok_price: "price_old" },
    items: { data: [{ price: { id: "price_premium_test" } }] } };
  const f = webhookFixture("customer.subscription.updated", sub, "new", { new: sub });
  assert.equal((await f.run()).status, 200);
  assert.equal(f.writes[0].plan, "premium");
  assert.equal(f.writes[0].active, true);
});
