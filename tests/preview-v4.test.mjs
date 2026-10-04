// Tests the real browser adapter through intercepted fetch without launching a GPU.
// Only app startup is omitted; every game mutation uses the actual adapter API.
// LEGACY_SAVE was captured from the pre-origin adapter initializer for migration.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { jobs } from "../src/server/gameStore.mjs";
import { VENUES, actionsForVenue } from "../src/shared/life.mjs";
const repo = fileURLToPath(new URL("../", import.meta.url));
const source = fs.readFileSync(`${repo}/preview/runtime.mjs`, "utf8");
async function bundle(source2) {
  return (await build({ stdin: { contents: source2.replace("await import('../app/app.js');", "globalThis.__adapterReady=true;"), resolveDir: `${repo}/preview`, sourcefile: "preview/runtime.mjs" }, bundle: true, write: false, format: "iife", platform: "browser", target: "es2022" })).outputFiles[0].text;
}
const code = await bundle(source);
function fixture({ storage = /* @__PURE__ */ new Map(), time = "2026-10-05T09:00:00Z", random = [1, 0], source: source2 = code } = {}) {
  let now = Date.parse(time), calls = 0;
  class ClockDate extends Date {
    constructor(...args) {
      super(...args.length ? args : [now]);
    }
    static now() {
      return now;
    }
  }
  const events = new EventTarget();
  const context = vm.createContext({ Date: ClockDate, localStorage: { getItem: (key2) => storage.get(key2) || null, setItem: (key2, value) => storage.set(key2, value) }, document: { documentElement: { dataset: {} } }, location: new URL("https://preview.test/"), crypto: { randomUUID: () => crypto.randomUUID(), getRandomValues: (value) => {
    calls++;
    if (random.length) value[0] = random.shift();
    else crypto.webcrypto.getRandomValues(value);
    return value;
  } }, structuredClone, URL, Request, Response, Event, EventTarget, MessageEvent, DOMException, Blob, atob, btoa, queueMicrotask, addEventListener: events.addEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events), fetch: async () => {
    throw new Error("External network was not authorized by this preview test");
  } });
  context.location.reload = () => {
  };
  vm.runInContext(source2, context);
  async function request(route, body, expected = 200) {
    const response = await context.fetch(`https://preview.test${route}`, body === void 0 ? {} : { method: "POST", body: JSON.stringify(body) }), data = await response.json();
    assert.equal(response.status, expected, JSON.stringify(data));
    return data;
  }
  return { request, storage, reset: () => context.dispatchEvent(new Event("abujalife:reset-preview")), get randomCalls() {
    return calls;
  }, at: (time2) => {
    now = Date.parse(time2);
  }, advance: (ms) => {
    now += ms;
  }, now: () => now, action: (action, payload = {}, status = 200) => request("/api/action", { action, payload }, status) };
}
const key = () => crypto.randomUUID();
const LEGACY_SAVE = { "version": 1, "profile": { "id": "browser-preview", "username": "preview_resident", "displayName": "Preview resident", "appearance": { "skinTone": "brown", "face": "oval", "body": "regular", "hair": "crop", "facialHair": "none", "presentation": "neutral", "top": "forest", "bottom": "charcoal", "shoes": "white", "accessory": "none" }, "wallet": 26e3, "energy": 82, "hunger": 72, "hygiene": 88, "social": 58, "fun": 64, "stress": 12, "mood": 76, "reputation": 0, "district": "garki-i", "location": { "kind": "home", "district": "garki-i", "venue": "home" }, "home": { "propertyId": "garki-studio", "name": "Garki starter studio", "district": "garki-i", "tenure": "starter" }, "job": null, "careerLevel": 1, "skills": {}, "inventory": [], "ownedProperties": [], "onboardingComplete": false, "lifeGoal": "explore", "drivingVehicle": null, "furnitureLayout": {}, "storedFurniture": [], "propertyInvestments": {}, "vehicleColors": {}, "gambleHistory": [], "lastGambleRound": null, "settings": { "presenceVisible": false, "allowInvites": false, "soundEnabled": true }, "activeTrip": null, "activeShift": null, "completedShifts": 0, "nextShiftAt": 0, "lastActionAt": 17911908e5, "billsPaidAt": 17911908e5, "rentPaidAt": 17911908e5, "createdAt": 17911908e5 }, "challenge": null, "completedChallenges": {}, "economyOperations": {}, "notifications": [{ "id": "ec887fb3-d011-4b73-8abb-c8bcb0350d8c", "kind": "preview", "title": "Your browser preview", "body": "Explore on your own. Progress saves in this browser; public multiplayer is unavailable.", "link": "home", "createdAt": 17911908e5, "readAt": null }], "transactions": [{ "id": "3b414b96-7a98-4f29-9f9c-719a7b29653a", "amount": 26e3, "reason": "Preview starting balance", "createdAt": 17911908e5 }] };
async function travel(f, district) {
  const p = (await f.request("/api/bootstrap")).profile;
  if (p.location.kind === "home") await f.action("leave-home");
  if (p.location.kind === "venue") await f.action("exit-venue");
  const result = await f.action("travel", { district, mode: "bus" });
  f.advance(result.trip.seconds * 1e3);
  return f.action("arrive", { tripId: result.trip.id });
}
async function complete(f) {
  const { challenge } = await f.action("start-shift");
  f.advance(2e3);
  const answers = jobs[challenge.jobId].tasks.map((task) => ({ taskId: task.id, optionId: task.answer }));
  return f.action("complete-shift", { challengeId: challenge.id, answers });
}
await test("WebCrypto rejection sampling and one-time durable origins", async () => {
  const f = fixture({ random: [1, 4294967295, 0] }), state = await f.request("/api/bootstrap");
  assert.equal(f.randomCalls, 3);
  assert.equal(state.profile.origin.id, "lapo");
  assert.equal(state.profile.wallet, 1e5);
  assert.equal(state.profile.home.district, "lugbe");
  assert.equal(state.profile.home.layoutId, "garki-studio");
  assert.equal(state.properties.at(-1).id, state.profile.home.propertyId);
  assert.equal(state.venues.length, 19);
  assert.equal(state.clock.timeZone, "Africa/Lagos");
  assert.equal(state.weather.verified, false);
  assert.equal(state.weather.source, "seasonal-simulation");
  await f.request("/api/profile", { origin: { id: "nepo" }, wallet: 1e9, home: { district: "maitama" } });
  const second = fixture({ storage: f.storage, random: [0, 2] });
  assert.deepEqual((await second.request("/api/bootstrap")).profile.origin, state.profile.origin);
  assert.equal(second.randomCalls, 0);
  const nepo = await fixture({ random: [0, 2] }).request("/api/bootstrap");
  assert.equal(nepo.profile.origin.id, "nepo");
  assert.equal(nepo.profile.wallet, 1e6);
  assert.equal(nepo.profile.home.district, "maitama");
  assert.ok(nepo.profile.ownedProperties.includes(nepo.profile.home.propertyId));
});
await test("consenting loan borrowing, repayment and reload-safe idempotency", async () => {
  const f = fixture(), payload = { amount: 1e5, consent: true, consentVersion: "game-loan-v1", idempotencyKey: key() };
  assert.equal((await f.action("borrow-loan", { ...payload, consent: false }, 400)).code, "loan_consent_required");
  const borrowed = await f.action("borrow-loan", payload);
  assert.equal(borrowed.profile.wallet, 2e5);
  assert.equal(borrowed.loan.fee, 5e3);
  assert.equal(borrowed.loan.outstanding, 105e3);
  const partial = { loanId: borrowed.loan.id, amount: 3e4, idempotencyKey: key() };
  await f.action("repay-loan", partial);
  const reopened = fixture({ storage: f.storage });
  assert.equal((await reopened.action("borrow-loan", payload)).replayed, true);
  assert.equal((await reopened.action("repay-loan", partial)).replayed, true);
  assert.equal((await reopened.request("/api/wallet")).profile.wallet, 17e4);
  assert.equal((await reopened.request("/api/wallet")).loans[0].outstanding, 75e3);
  const before = await reopened.request("/api/wallet");
  await reopened.action("repay-loan", { ...partial, amount: 75001, idempotencyKey: key() }, 400);
  assert.deepEqual(await reopened.request("/api/wallet"), before);
  await reopened.action("repay-loan", { loanId: borrowed.loan.id, amount: 75e3, idempotencyKey: key() });
  assert.equal((await reopened.request("/api/wallet")).loans[0].outstanding, 0);
});
await test("uncapped game funds and rent, exact overflow rollback, vehicle/dice ownership", async () => {
  const f = fixture({ random: [1, 0, 0] }), funds = { amount: 25e7, idempotencyKey: key() };
  await f.request("/api/wallet/topup", funds);
  assert.equal((await f.request("/api/wallet/topup", funds)).replayed, true);
  assert.equal((await f.request("/api/wallet")).profile.wallet, 2501e5);
  const overflow = { amount: Number.MAX_SAFE_INTEGER, idempotencyKey: key() }, before = await f.request("/api/wallet");
  assert.equal((await f.request("/api/wallet/topup", overflow, 409)).code, "numeric_limit");
  assert.deepEqual(await f.request("/api/wallet"), before);
  const bought = await f.action("purchase", { itemId: "compact-car", color: "blue", idempotencyKey: key() });
  assert.equal(bought.profile.vehicleColors["compact-car"], "blue");
  await f.action("buy-investment", { propertyId: "lugbe-flat", idempotencyKey: key() });
  f.advance(6e4 * 1e3);
  const collected = await f.action("collect-rent", { propertyId: "lugbe-flat", idempotencyKey: key() });
  assert.equal(collected.income.amount, 56e4);
  await f.action("leave-home");
  await f.action("enter-venue", { venueId: "games-lounge" });
  const round = await f.action("play-dice", { stake: 1e7, choice: "low", idempotencyKey: key() });
  assert.equal(round.round.stake, 1e7);
  assert.equal(round.round.die, 1);
  assert.equal(round.round.payout, 2e7);
});
await test("two real-calendar shifts, cross-job quota, persisted day reset and expiry", async () => {
  const f = fixture();
  await f.action("take-job", { jobId: "bank-teller" });
  await travel(f, "central-area");
  const morning = await complete(f);
  assert.equal(morning.workSchedule.completedToday, 1);
  f.advance(2e4);
  assert.equal((await f.action("start-shift", {}, 409)).code, "shift_slot_completed");
  await f.action("take-job", { jobId: "junior-dev" });
  await travel(f, "wuse-ii-a07");
  assert.equal((await f.action("start-shift", {}, 409)).code, "shift_slot_completed");
  await f.action("take-job", { jobId: "bank-teller" });
  await travel(f, "central-area");
  f.at("2026-10-05T11:00:00Z");
  const afternoon = await complete(f);
  assert.equal(afternoon.workSchedule.completedToday, 2);
  f.advance(2e4);
  assert.equal((await f.action("start-shift", {}, 409)).code, "daily_shift_limit");
  const reopened = fixture({ storage: f.storage, time: "2026-10-05T12:00:00Z" });
  assert.equal((await reopened.action("start-shift", {}, 409)).code, "daily_shift_limit");
  reopened.at("2026-10-06T07:00:00Z");
  const { challenge } = await reopened.action("start-shift");
  reopened.at("2026-10-06T11:00:00Z");
  assert.equal((await reopened.action("complete-shift", { challengeId: challenge.id, answers: jobs["bank-teller"].tasks.map((task) => ({ taskId: task.id, optionId: task.answer })) }, 409)).code, "shift_expired");
  const homeTrip = await reopened.action("return-home", { mode: "bus" });
  reopened.advance(homeTrip.trip.seconds * 1e3);
  await reopened.action("arrive", { tripId: homeTrip.trip.id });
  await reopened.action("sleep");
  await travel(reopened, "central-area");
  assert.equal((await reopened.action("start-shift")).challenge.slotId, "afternoon");
  const weekend = fixture({ time: "2026-10-03T09:00:00Z" });
  await weekend.action("take-job", { jobId: "bank-teller" });
  await travel(weekend, "central-area");
  assert.equal((await weekend.action("start-shift", { now: Date.parse("2026-10-05T09:00:00Z") }, 409)).code, "workplace_closed");
});
await test("all four clubs permit daytime entry, reject forged clocks and enforce night closing", async () => {
  for (const id of ["club", "club-cage", "magic-city", "bear-barn"]) {
    const f = fixture({ time: "2026-10-09T12:00:00Z" }), venue = VENUES.find((v) => v.id === id);
    await travel(f, venue.districts?.[0] || "lugbe");
    await f.action("enter-venue", { venueId: id });
    const action = actionsForVenue(id)[0], before = (await f.request("/api/wallet")).profile.wallet;
    assert.equal((await f.action("venue-action", { activityId: action.id, now: Date.parse("2026-10-09T19:00:00Z") }, 409)).code, "venue_closed");
    assert.equal((await f.request("/api/wallet")).profile.wallet, before);
    f.at("2026-10-09T19:00:00Z");
    const paid = await f.action("venue-action", { activityId: action.id, cost: -1 });
    assert.equal(paid.profile.wallet, before - action.cost);
    f.at("2026-10-10T01:00:00Z");
    assert.equal((await f.action("venue-action", { activityId: action.id }, 409)).code, "venue_closed");
  }
});
await test("home editor route validation and persistent styling use the personal layout", async () => {
  const f = fixture(), roomStyle = { wall: "sage", floor: "tile", partitions: [] };
  await f.action("design-home", { roomStyle });
  const saved = await fixture({ storage: f.storage }).request("/api/bootstrap");
  assert.deepEqual(saved.profile.home.roomStyle, roomStyle);
  assert.equal(saved.profile.home.layoutId, "garki-studio");
  assert.equal((await f.action("design-home", { roomStyle: { wall: "bad", floor: "tile", partitions: [] } }, 400)).ok, false);
  const blocked = await f.action("design-home", {
    roomStyle: { ...roomStyle, partitions: [{ id: "blocked-entrance", x: .4, y: .9, w: .2, h: .02 }] }
  }, 400);
  assert.equal(blocked.code, "home_route_blocked");
  assert.deepEqual((await f.request("/api/bootstrap")).profile.home.roomStyle, roomStyle);
  await f.action("leave-home");
  assert.match((await f.action("design-home", { roomStyle }, 400)).error, /Go home/);
});
await test("local social content is genuine, paginated, replay-safe and expires exactly after 24 hours", async () => {
  const f = fixture(), payload = { text: "My home", kind: "post", idempotencyKey: key() }, post = await f.request("/api/social/posts", payload);
  assert.equal(post.post.userId, "browser-preview");
  assert.equal(post.post.resident.online, false);
  assert.equal((await f.request("/api/social/posts", payload)).replayed, true);
  assert.equal((await f.request("/api/social/feed")).posts.length, 1);
  assert.equal((await f.request(`/api/social/posts/${post.post.id}/like`, {})).post.likes, 1);
  assert.equal((await f.request(`/api/social/posts/${post.post.id}/like`, {})).post.likes, 0);
  const comment = { text: "A real local comment", idempotencyKey: key() };
  await f.request(`/api/social/posts/${post.post.id}/comments`, comment);
  const reopened = fixture({ storage: f.storage });
  assert.equal((await reopened.request(`/api/social/posts/${post.post.id}/comments`, comment)).replayed, true);
  assert.equal((await reopened.request(`/api/social/posts/${post.post.id}/comments`)).comments.length, 1);
  for (let i = 0; i < 2; i++) await f.request("/api/social/posts", { text: `Extra post ${i}`, kind: "post", idempotencyKey: key() });
  const page = await f.request("/api/social/feed?limit=2");
  assert.equal(page.posts.length, 2);
  assert.ok(page.nextCursor);
  assert.equal((await f.request(`/api/social/feed?limit=2&cursor=${encodeURIComponent(page.nextCursor)}`)).posts.length, 1);
  const status = await f.request("/api/social/posts", { text: "For today", kind: "status", idempotencyKey: key() });
  assert.equal((await f.request("/api/social/statuses")).statuses.length, 1);
  f.advance(864e5);
  assert.equal((await f.request("/api/social/statuses")).statuses.length, 0);
  assert.equal((await f.request(`/api/social/posts/${status.post.id}/like`, {}, 404)).code, "post_unavailable");
  await f.request(`/api/social/posts/${post.post.id}/delete`, {});
  assert.equal((await f.request(`/api/social/posts/${post.post.id}/delete`, {})).replayed, true);
  assert.equal((await f.request(`/api/social/posts/${post.post.id}/comments`, void 0, 404)).code, "post_unavailable");
  assert.equal((await f.request("/api/social/posts", { text: "bad", kind: "post", imageDataUrl: "data:image/svg+xml;base64,PHN2Zz4=", idempotencyKey: key() }, 400)).code, "invalid_image");
});
await test("preview empty directory/visits and unavailable payment/admin APIs never fabricate peers", async () => {
  const f = fixture();
  assert.deepEqual((await f.request("/api/residents?q=anybody")).people, []);
  const visits = await f.request("/api/home/visits");
  assert.deepEqual(visits.requests, []);
  assert.deepEqual(visits.visitors, []);
  assert.equal(visits.visit, null);
  await f.request("/api/home/visits/request", { ownerId: "imaginary" }, 503);
  assert.equal((await f.request("/api/payments/config")).enabled, false);
  await f.request("/api/payments/checkout", { amount: 1e3 }, 503);
  await f.request("/api/admin/status", void 0, 403);
  assert.equal((await f.request("/api/bootstrap")).people.length, 0);
  assert.equal((await f.request("/api/bootstrap")).admin.role, null);
});
await test("legacy adapter saves retain money/home and remain origin-free until Start fresh", async () => {
  const storage = /* @__PURE__ */ new Map([["abujalife.browser-preview.v1", JSON.stringify(LEGACY_SAVE)]]), before = LEGACY_SAVE;
  assert.equal(before.profile.wallet, 26e3);
  const upgraded = fixture({ storage }), after = await upgraded.request("/api/bootstrap");
  assert.equal(after.profile.wallet, before.profile.wallet);
  assert.deepEqual(after.profile.home, before.profile.home);
  assert.equal(after.profile.origin, null);
  const bought = await upgraded.action("purchase", { itemId: "plant" });
  assert.equal(bought.profile.wallet, 23700);
  const again = await fixture({ storage }).request("/api/bootstrap");
  assert.equal(again.profile.wallet, 23700);
  assert.ok(again.profile.inventory.includes("plant"));
  assert.equal(again.profile.origin, null);
  upgraded.reset();
  const fresh = await upgraded.request("/api/bootstrap");
  assert.equal(fresh.profile.origin.id, "lapo");
  assert.equal(fresh.profile.wallet, 1e5);
  assert.deepEqual(fresh.profile.inventory, []);
});
