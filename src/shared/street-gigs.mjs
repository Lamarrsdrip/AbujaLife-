// Street gigs: short paid jobs a resident physically carries out in the street
// (ride-hailing, parcel delivery, errands on foot). Rules are shared so the
// phone can explain them; every decision and payout is made by the server.
import { abujaTime } from './simulation.mjs';
import { VENUES, venueAvailable } from './life.mjs';
import { VEHICLE_PRICES } from './economy.mjs';

const SECOND = 1000, MINUTE = 60 * SECOND;
export const GIG_RULES = Object.freeze({
  version: 1,
  dailyLimit: 20,              // per Abuja day; keeps gigs a side income, not a farm
  offerMs: 2 * MINUTE,         // an unanswered offer lapses
  pickupMs: 6 * MINUTE,        // time allowed to reach the pick-up
  tripMs: 10 * MINUTE,         // time allowed to reach the drop-off
  minLegMs: 5 * SECOND,        // no leg of a real trip is faster than this
  cooldownMs: 10 * SECOND,     // between finishing one gig and the next offer
  abandonCooldownMs: 90 * SECOND,
  onTimeMs: 150 * SECOND,      // pick-up to drop-off inside this earns the tip
  onTimeTipBasisPoints: 1000,
  executiveVehiclePrice: 90_000_000,
  executiveBasisPoints: 2500,
  maxPlaces: 60,
  effort: Object.freeze({ onFoot: Object.freeze({ energy: 4, hunger: 3 }), driving: Object.freeze({ energy: 2, hunger: 2 }) }),
});
// [minimum, maximum] fare in game Naira, in ₦2,000 steps.
export const GIG_KINDS = Object.freeze({
  ride: Object.freeze({ id: 'ride', title: 'Ride request', needsVehicle: true, fare: [22_000, 46_000], verb: 'Pick up', drop: 'Drop off' }),
  delivery: Object.freeze({ id: 'delivery', title: 'Delivery run', needsVehicle: true, fare: [16_000, 34_000], verb: 'Collect', drop: 'Deliver' }),
  errand: Object.freeze({ id: 'errand', title: 'Errand on foot', needsVehicle: false, fare: [8_000, 16_000], verb: 'Collect', drop: 'Hand over' }),
});
export const GIG_ACTIONS = new Set(['gig-offer', 'gig-accept', 'gig-pickup', 'gig-complete', 'gig-cancel']);
export const GIG_MONEY_ACTIONS = new Set(['gig-complete']);
// Fictional customers. Common Nigerian given names only; no real person is implied.
export const GIG_CUSTOMERS = Object.freeze(['Amina', 'Chidi', 'Ngozi', 'Tunde', 'Halima', 'Emeka', 'Zainab', 'Ifeanyi', 'Bola', 'Musa', 'Kemi', 'Yakubu', 'Adaeze', 'Sani', 'Funke', 'Ibrahim', 'Chioma', 'Danjuma', 'Titi', 'Uche']);
const PARCELS = Object.freeze(['a food order', 'a boxed cake', 'tailored clothes', 'a phone for repair', 'office documents', 'a market order', 'pharmacy items', 'a fabric bundle']);

export class GigError extends Error {
  constructor(message, code = 'invalid_gig_action', status = 409) { super(message); this.code = code; this.status = status; }
}
const check = (value, message, code) => { if (!value) throw new GigError(message, code); };
const venueName = id => VENUES.find(venue => venue.id === id)?.name || String(id).replace(/[-_]+/g, ' ');

export function gigDayCount(profile, now) {
  const key = abujaTime(now).dateKey;
  return profile.gigDays?.[key] || 0;
}
/** What the resident may see. Never includes anything the client could use to self-award. */
export function gigView(profile, now) {
  const gig = profile.gig, count = gigDayCount(profile, now);
  const active = gig && now < gig.expiresAt ? { id: gig.id, kind: gig.kind, state: gig.state, from: gig.from, to: gig.to, fromName: venueName(gig.from), toName: venueName(gig.to), fare: gig.fare, customer: gig.customer, cargo: gig.cargo || null, executive: gig.executive === true, expiresAt: gig.expiresAt, offeredAt: gig.offeredAt, pickedAt: gig.pickedAt || null } : null;
  return { gig: active, today: count, dailyLimit: GIG_RULES.dailyLimit, remaining: Math.max(0, GIG_RULES.dailyLimit - count), nextOfferAt: profile.gigCooldownUntil || 0, completed: profile.gigStats?.completed || 0, earned: profile.gigStats?.earned || 0, serverTime: now };
}

function eligiblePlaces(profile, requested) {
  const allowed = new Set(VENUES.filter(venue => venueAvailable(venue.id, profile.district)).map(venue => venue.id));
  const offered = Array.isArray(requested) ? requested.slice(0, GIG_RULES.maxPlaces).map(String) : [...allowed];
  return [...new Set(offered)].filter(id => allowed.has(id)).sort();
}
const onStreet = profile => profile.location?.kind === 'public' && !profile.activeTrip;

/**
 * Shared by both persistence stores inside their existing atomic operation.
 * Mutates `profile`; returns the public result plus ledger hints.
 */
export function applyGigAction(profile, action, payload = {}, { now, randomInt }) {
  const p = profile;
  check(GIG_ACTIONS.has(action), 'Unknown gig action.', 'invalid_gig_action');
  check(typeof randomInt === 'function', 'Gigs need server randomness.', 'storage_incomplete');
  if (p.gig && now >= p.gig.expiresAt) {
    // A lapsed pick-up or trip counts as abandoned only once the customer was on board.
    if (p.gig.state === 'onboard') { p.reputation = Math.max(0, (p.reputation || 0) - 1); p.gigCooldownUntil = now + GIG_RULES.abandonCooldownMs; }
    p.gig = null;
  }
  const dateKey = abujaTime(now).dateKey;
  p.gigDays = { [dateKey]: p.gigDays?.[dateKey] || 0 };
  const result = (extra = {}) => ({ gigs: gigView(p, now), ...extra });

  if (action === 'gig-offer') {
    check(onStreet(p), 'Head out onto the street to take gigs.', 'gig_not_on_street');
    check(!p.gig || p.gig.state === 'offered', 'Finish your current gig first.', 'gig_in_progress');
    check(now >= (p.gigCooldownUntil || 0), 'Give it a moment before the next request.', 'gig_cooldown');
    check(p.gigDays[dateKey] < GIG_RULES.dailyLimit, 'You have done a full day of gigs. Requests return tomorrow.', 'gig_daily_limit');
    const places = eligiblePlaces(p, payload.places);
    check(places.length >= 2, 'There are no requests on this street right now.', 'gig_no_places');
    const driving = Boolean(p.drivingVehicle), kinds = driving ? ['ride', 'ride', 'delivery'] : ['errand'];
    const kind = GIG_KINDS[kinds[randomInt(0, kinds.length)]], from = places[randomInt(0, places.length)];
    const rest = places.filter(id => id !== from), to = rest[randomInt(0, rest.length)];
    const steps = (kind.fare[1] - kind.fare[0]) / 2000, base = kind.fare[0] + randomInt(0, steps + 1) * 2000;
    const executive = kind.id === 'ride' && (VEHICLE_PRICES[p.drivingVehicle] || 0) >= GIG_RULES.executiveVehiclePrice;
    const fare = executive ? base + Math.floor(base * GIG_RULES.executiveBasisPoints / 10000) : base;
    p.gig = { id: `gig_${now.toString(36)}_${randomInt(0, 0x7fffffff).toString(36)}`, kind: kind.id, state: 'offered', from, to, fare, executive,
      customer: GIG_CUSTOMERS[randomInt(0, GIG_CUSTOMERS.length)], cargo: kind.id === 'ride' ? null : PARCELS[randomInt(0, PARCELS.length)],
      vehicleId: kind.needsVehicle ? p.drivingVehicle : null, district: p.district, offeredAt: now, expiresAt: now + GIG_RULES.offerMs };
    return result();
  }
  const gig = p.gig;
  if (action === 'gig-cancel') {
    if (gig?.state === 'onboard') { p.reputation = Math.max(0, (p.reputation || 0) - 1); p.gigCooldownUntil = now + GIG_RULES.abandonCooldownMs; }
    p.gig = null;
    return result({ cancelled: Boolean(gig) });
  }
  check(gig, 'That request is no longer available.', 'gig_expired');
  check(payload.gigId === gig.id, 'That request is no longer available.', 'gig_expired');
  check(onStreet(p) && p.district === gig.district, 'Go back to the street where this gig started.', 'gig_not_on_street');
  const kind = GIG_KINDS[gig.kind];
  const vehicleReady = () => check(!kind.needsVehicle || (p.drivingVehicle && p.drivingVehicle === gig.vehicleId), 'Get back behind the wheel of the car you accepted this with.', 'gig_vehicle_required');

  if (action === 'gig-accept') {
    check(gig.state === 'offered', 'You already accepted this gig.', 'gig_state');
    vehicleReady();
    gig.state = 'accepted'; gig.acceptedAt = now; gig.expiresAt = now + GIG_RULES.pickupMs;
    return result();
  }
  if (action === 'gig-pickup') {
    check(gig.state === 'accepted', 'This gig is not waiting for a pick-up.', 'gig_state');
    vehicleReady();
    check(now - gig.acceptedAt >= GIG_RULES.minLegMs, 'You are not at the pick-up yet.', 'gig_too_fast');
    gig.state = 'onboard'; gig.pickedAt = now; gig.expiresAt = now + GIG_RULES.tripMs;
    return result();
  }
  // gig-complete
  check(gig.state === 'onboard', 'Collect before you drop off.', 'gig_state');
  vehicleReady();
  check(now - gig.pickedAt >= GIG_RULES.minLegMs, 'You are not at the drop-off yet.', 'gig_too_fast');
  check(p.gigDays[dateKey] < GIG_RULES.dailyLimit, 'You have done a full day of gigs. Requests return tomorrow.', 'gig_daily_limit');
  const onTime = now - gig.pickedAt <= GIG_RULES.onTimeMs, tip = onTime ? Math.floor(gig.fare * GIG_RULES.onTimeTipBasisPoints / 10000) : 0, paid = gig.fare + tip;
  check(Number.isSafeInteger(p.wallet + paid), 'This payout cannot be represented as exact whole Naira.', 'numeric_limit');
  p.wallet += paid;
  p.gigDays[dateKey] += 1;
  p.gigStats = { completed: (p.gigStats?.completed || 0) + 1, earned: (p.gigStats?.earned || 0) + paid };
  p.reputation = (p.reputation || 0) + 1;
  // Work takes something out of you: a little energy and appetite per trip, more on foot.
  const tired = gig.kind === 'errand' ? GIG_RULES.effort.onFoot : GIG_RULES.effort.driving;
  if (Number.isFinite(p.energy)) p.energy = Math.max(0, p.energy - tired.energy);
  if (Number.isFinite(p.hunger)) p.hunger = Math.max(0, p.hunger - tired.hunger);
  if (gig.kind === 'ride' && Number.isFinite(p.social)) p.social = Math.min(100, p.social + 2);
  p.gigCooldownUntil = now + GIG_RULES.cooldownMs;
  p.gig = null;
  const label = gig.kind === 'ride' ? 'Ride fare' : gig.kind === 'delivery' ? 'Delivery fee' : 'Errand fee';
  return result({ payout: { gigId: gig.id, kind: gig.kind, fare: gig.fare, tip, paid, onTime, from: gig.from, to: gig.to }, ledgerReason: `${label} · ${venueName(gig.from)} to ${venueName(gig.to)}`, ledgerType: 'JOB_INCOME' });
}
