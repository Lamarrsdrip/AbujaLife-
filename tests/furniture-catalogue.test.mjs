import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/shared/catalogue.mjs';
import {
  FURNITURE_CATEGORIES, furnitureCatalogueItems, furnitureCategories,
  furnitureOwnership, renderFurnitureCatalogue, createFurnitureCatalogue
} from '../app/furniture-catalogue.js';

class Root {
  constructor() { this.classList = { add() {} }; this.listeners = new Map(); this.innerHTML = ''; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  removeEventListener(name, callback) { if (this.listeners.get(name) === callback) this.listeners.delete(name); }
  querySelector() { return null; }
}

function fixture({ inventory = [], storedFurniture = [], furnitureLayout = {}, wallet = 100000 } = {}, options = {}) {
  const state = { catalog, profile: { id: 'resident', location: { kind: 'home' }, inventory: [...inventory], storedFurniture: [...storedFurniture], furnitureLayout: structuredClone(furnitureLayout), wallet } };
  const root = new Root(), writes = [], selections = [], messages = [];
  const controller = createFurnitureCatalogue({
    root, getState: () => state,
    mutate: async (action, payload) => {
      writes.push({ action, ...payload });
      if (options.mutate) return options.mutate(action, payload, state, writes);
      const item = catalog.find(item => item.id === payload.itemId);
      if (action === 'purchase') { state.profile.wallet -= item.price; state.profile.inventory.push(item.id); state.profile.storedFurniture.push(item.id); return { profile: state.profile }; }
      if (action === 'store-furniture') { delete state.profile.furnitureLayout[item.id]; state.profile.storedFurniture.push(item.id); return { profile: state.profile }; }
      if (action === 'sell-item') { state.profile.inventory = state.profile.inventory.filter(id => id !== item.id); delete state.profile.furnitureLayout[item.id]; state.profile.storedFurniture = state.profile.storedFurniture.filter(id => id !== item.id); const amount = Math.floor(item.price / 2); state.profile.wallet += amount; return { profile: state.profile, sale: { amount } }; }
      throw new Error('Unexpected action');
    },
    onSelect: (itemId, arrangement) => { selections.push({ itemId, ...arrangement }); return true; },
    toast: message => messages.push(message),
    ...options.controller
  });
  return { state, root, writes, selections, messages, controller };
}

test('every requested department contains genuine catalogue pieces with unchanged server prices', () => {
  const before = JSON.stringify(catalog), state = { catalog, profile: { inventory: [] } };
  assert.equal(FURNITURE_CATEGORIES.length, 9);
  for (const category of FURNITURE_CATEGORIES) {
    const pieces = furnitureCatalogueItems(state, { category: category.id });
    assert.ok(pieces.length, category.label);
    assert.ok(pieces.every(item => item.category === 'furniture' && catalog.includes(item)));
  }
  assert.equal(furnitureCatalogueItems(state).length, catalog.filter(item => item.category === 'furniture').length);
  assert.deepEqual(furnitureCategories(catalog.find(item => item.id === 'king-bed')), ['bedroom', 'luxury']);
  assert.deepEqual(furnitureCategories(catalog.find(item => item.category === 'vehicle')), []);
  assert.equal(JSON.stringify(catalog), before);
});

test('owned and stored filters rely on inventory, so a stray client layout does not imply ownership', () => {
  const profile = { inventory: ['sofa', 'bed'], storedFurniture: ['bed'], furnitureLayout: { sofa: { x: .4, y: .6 }, plant: { x: .2, y: .2 } } };
  const state = { catalog, profile };
  assert.equal(furnitureOwnership(profile, 'plant'), 'unowned');
  assert.deepEqual(furnitureCatalogueItems(state, { filter: 'owned' }).map(item => item.id).sort(), ['bed', 'sofa']);
  assert.deepEqual(furnitureCatalogueItems(state, { filter: 'stored' }).map(item => item.id), ['bed']);
  assert.equal(furnitureOwnership(profile, 'bed'), 'stored');
  assert.equal(furnitureOwnership(profile, 'sofa'), 'placed');
});

test('catalogue safely renders backend labels and a nonmodal panel without presenting foreign goods', () => {
  const state = { catalog: [{ id: 'safe-id', name: '<img src=x onerror=alert(1)>', category: 'furniture', price: 7500 }, { id: 'car', name: 'A car', category: 'vehicle', price: 1 }], profile: { wallet: 10000, inventory: [] } };
  const html = renderFurnitureCatalogue(state);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /aria-modal="false"/);
  assert.match(html, /₦7,500/);
  assert.match(html, /Buy &amp; place.*?for ₦7,500/);
  assert.doesNotMatch(html, /data-furnish-select="car"/);
});

test('a failed or lost purchase keeps its retry key and cannot start placing or change balances locally', async () => {
  const f = fixture({}, { mutate: async (_action, payload, state, writes) => {
    if (writes.length === 1) throw new Error('Connection interrupted');
    state.profile.inventory.push(payload.itemId); state.profile.storedFurniture.push(payload.itemId); state.profile.wallet -= catalog.find(item=>item.id===payload.itemId).price;
    return { profile: state.profile };
  } });
  f.controller.open();
  assert.equal(await f.controller.select('plant'), false);
  assert.equal(f.state.profile.wallet, 100000);
  assert.deepEqual(f.state.profile.inventory, []);
  assert.deepEqual(f.selections, []);
  assert.equal(f.controller.isOpen(), true);
  assert.equal(await f.controller.select('plant'), true);
  assert.equal(f.writes[0].idempotencyKey, f.writes[1].idempotencyKey);
  assert.equal(f.writes[0].action, 'purchase');
  assert.equal(f.state.profile.wallet, 100000-catalog.find(item=>item.id==='plant').price);
  assert.deepEqual(f.selections, [{ itemId: 'plant' }]);
  assert.equal(f.controller.isOpen(), false);
});

test('stored furniture goes straight back to placement without buying it twice', async () => {
  const f = fixture({ inventory: ['sofa'], storedFurniture: ['sofa'] });
  assert.equal(await f.controller.open({ itemId: 'sofa' }), true);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.selections, [{ itemId: 'sofa' }]);
  assert.equal(f.state.profile.wallet, 100000);
});

test('rotating existing furniture begins a provisional edit without persisting a rotation or charging', async () => {
  const f = fixture({ inventory: ['sofa'], furnitureLayout: { sofa: { x: .4, y: .6, rotation: 270 } } });
  f.controller.showItem('sofa');
  assert.equal(await f.controller.edit('rotate'), true);
  assert.deepEqual(f.selections, [{ itemId: 'sofa', rotation: 0 }]);
  assert.equal(f.state.profile.furnitureLayout.sofa.rotation, 270);
  assert.equal(f.writes.length, 0);
});

test('Store retains ownership, and Sell requires a visible confirmation before one server buyback', async () => {
  const f = fixture({ inventory: ['sofa'], furnitureLayout: { sofa: { x: .4, y: .6, rotation: 0 } } });
  f.controller.showItem('sofa');
  assert.equal(await f.controller.edit('store'), true);
  assert.ok(f.state.profile.inventory.includes('sofa'));
  assert.ok(f.state.profile.storedFurniture.includes('sofa'));
  assert.equal(f.state.profile.furnitureLayout.sofa, undefined);
  assert.equal(f.state.profile.wallet, 100000);
  assert.equal(await f.controller.edit('confirm-sell'), false);
  assert.equal(await f.controller.edit('sell'), true);
  assert.equal(f.writes.length, 1);
  assert.match(f.root.innerHTML, /data-furnish-action="confirm-sell"/);
  f.controller.close();
  assert.equal(await f.controller.edit('confirm-sell', 'sofa'), false);
  f.controller.showItem('sofa'); await f.controller.edit('sell');
  assert.equal(await f.controller.edit('confirm-sell'), true);
  assert.equal(f.state.profile.wallet, 100000+Math.floor(catalog.find(item=>item.id==='sofa').price/2));
  assert.ok(!f.state.profile.inventory.includes('sofa'));
  assert.deepEqual(f.writes.map(write => write.action), ['store-furniture', 'sell-item']);
  assert.equal(f.controller.isOpen(), false);
});

test('unowned, unknown and visited-home furniture cannot invoke edit or purchase callbacks', async () => {
  const f = fixture();
  assert.equal(f.controller.showItem('sofa'), false);
  assert.equal(await f.controller.edit('store', 'sofa'), false);
  assert.equal(await f.controller.select('not-a-server-item'), false);
  f.state.profile.location.kind = 'visit';
  assert.equal(f.controller.open(), false);
  assert.equal(await f.controller.select('plant'), false);
  assert.equal(f.writes.length, 0);
});

test('a completed purchase whose refreshed state is unavailable never fakes owned furniture', async () => {
  const f = fixture({}, { mutate: async () => ({ purchaseId: 'stored-server-side' }) });
  f.controller.open();
  assert.equal(await f.controller.select('plant'), false);
  assert.equal(f.state.profile.wallet, 100000);
  assert.equal(f.state.profile.inventory.length, 0);
  assert.equal(f.selections.length, 0);
  assert.ok(f.messages.some(message => message.includes('purchase is saved')));
});
