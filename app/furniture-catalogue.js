import { systemResaleValue } from '../src/shared/life.mjs';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const money = value => new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(Number(value) || 0);
const itemsFrom = catalogue => Array.isArray(catalogue) ? catalogue : Object.entries(catalogue || {}).map(([id, item]) => ({ id, ...item }));
const closeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>';

export const FURNITURE_CATEGORIES = Object.freeze([
  { id: 'living', label: 'Living room' }, { id: 'bedroom', label: 'Bedroom' },
  { id: 'kitchen', label: 'Kitchen' }, { id: 'bathroom', label: 'Bathroom' },
  { id: 'electronics', label: 'Electronics' }, { id: 'decoration', label: 'Decoration' },
  { id: 'lighting', label: 'Lighting' }, { id: 'outdoor', label: 'Outdoor' },
  { id: 'luxury', label: 'Luxury' }
].map(category => Object.freeze(category)));

// Departments describe actual server-catalogue pieces. They never define a
// price, grant an item or turn a marketplace listing into owned furniture.
const departments = Object.freeze({
  'lounge-chair': ['living'], sofa: ['living'], 'premium-sofa': ['living', 'luxury'],
  bookshelf: ['living', 'decoration'], 'library-shelf': ['living', 'decoration'],
  'work-desk': ['living'], 'office-chair': ['living'], 'coffee-table': ['living'],
  'accent-chair': ['living'], bed: ['bedroom'], 'king-bed': ['bedroom', 'luxury'],
  wardrobe: ['bedroom'], 'bedside-table': ['bedroom'], 'storage-drawers': ['bedroom'],
  'full-length-mirror': ['bedroom', 'bathroom', 'decoration'], 'shoe-rack': ['bedroom'],
  'dining-table': ['kitchen'], fridge: ['kitchen', 'electronics'],
  'kitchen-unit': ['kitchen'], microwave: ['kitchen', 'electronics'],
  'bar-cart': ['kitchen', 'luxury'], 'washing-machine': ['bathroom', 'electronics'],
  tv: ['electronics'], 'portable-ac': ['electronics'], 'power-inverter': ['electronics'],
  'standing-fan': ['electronics'], 'gaming-console': ['electronics', 'luxury'],
  'music-speaker': ['electronics'], plant: ['decoration'], 'tall-plant': ['decoration', 'outdoor'],
  rug: ['decoration'], 'large-rug': ['decoration'], 'art-piece': ['decoration', 'luxury'],
  'floor-lamp': ['lighting'], 'table-lamp': ['lighting'], 'balcony-bench': ['outdoor'], 'pool-table': ['luxury'],
  'ceramic-vase': ['decoration'], succulent: ['decoration', 'outdoor'], 'book-stack': ['decoration']
});
const useLabels = Object.freeze({bed:'Sleep', 'king-bed':'Sleep', sofa:'Relax', 'premium-sofa':'Relax', 'lounge-chair':'Relax', 'accent-chair':'Relax', tv:'Watch TV', 'gaming-console':'Play', fridge:'Eat', 'kitchen-unit':'Eat', 'dining-table':'Eat', wardrobe:'Change outfit'});

export function furnitureCategories(item) {
  if (item?.category !== 'furniture') return [];
  return [...(departments[item.id] || ['decoration'])];
}

export function furnitureOwnership(profile, itemId, worldState) {
  if (!profile?.inventory?.includes(itemId)) return 'unowned';
  if (profile.storedFurniture?.includes(itemId) || worldState?.stored?.includes(itemId)) return 'stored';
  if (profile.furnitureLayout?.[itemId] || worldState?.placed?.includes(itemId)) return 'placed';
  return 'owned';
}

export function furnitureCatalogueItems(state, { category = 'all', filter = 'all', worldState } = {}) {
  return itemsFrom(state?.catalog).filter(item => {
    if (item.category !== 'furniture') return false;
    if (category !== 'all' && !furnitureCategories(item).includes(category)) return false;
    const ownership = furnitureOwnership(state.profile, item.id, worldState);
    return filter === 'owned' ? ownership !== 'unowned' : filter === 'stored' ? ownership === 'stored' : true;
  });
}

function modelMarkup(item) {
  return `<span class="furnish-model" data-product-model="${escapeHTML(item.id)}" data-product-name="${escapeHTML(item.name)}"><svg class="furnish-model-placeholder" viewBox="0 0 96 64" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m17 39 31-16 31 16-31 16zM17 39v9l31 15 31-15v-9M48 55v8"/><path d="m30 32 18-9 18 9M30 32v9l18 9 18-9v-9" opacity=".45"/></svg></span>`;
}

export function renderFurnitureCatalogue(state, { category = 'all', filter = 'all', worldState, busy = false, error = '' } = {}) {
  const pieces = furnitureCatalogueItems(state, { category, filter, worldState });
  return `<section class="furnish-catalogue-panel" role="dialog" aria-modal="false" aria-labelledby="furnish-catalogue-title">
    <header class="furnish-catalogue-heading"><div><span>Your home, your taste</span><h2 id="furnish-catalogue-title">The catalogue</h2></div><div class="furnish-catalogue-heading-actions"><small>Naira balance <strong>₦${money(state?.profile?.wallet)}</strong></small><button type="button" data-furnish-action="close" class="furnish-close" aria-label="Close furniture catalogue">${closeIcon}</button></div></header>
    <nav class="furnish-departments" aria-label="Furniture departments">${[{ id: 'all', label: 'All pieces' }, ...FURNITURE_CATEGORIES].map(department => `<button type="button" data-furnish-category="${department.id}" aria-pressed="${category === department.id}">${department.label}</button>`).join('')}</nav>
    <div class="furnish-filter-row" role="group" aria-label="Furniture ownership"><div>${[['all', 'Shop'], ['owned', 'My pieces'], ['stored', 'Stored']].map(([id, label]) => `<button type="button" data-furnish-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join('')}</div><span>${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}</span></div>
    <div class="furnish-catalogue-grid">${pieces.map(item => {
      const ownership = furnitureOwnership(state.profile, item.id, worldState), owned = ownership !== 'unowned';
      const label = !owned ? 'Buy & place' : ownership === 'placed' ? 'Move' : 'Place';
      const affordable = owned || Number(state.profile?.wallet) >= Number(item.price);
      return `<button type="button" class="furnish-piece ${owned ? 'is-owned' : ''}" data-furnish-select="${escapeHTML(item.id)}" ${busy || !affordable ? 'disabled' : ''} aria-label="${escapeHTML(`${label} ${item.name}${owned ? '' : ` for ₦${money(item.price)}`}`)}">${modelMarkup(item)}<span class="furnish-piece-title">${escapeHTML(item.name)}</span><span class="furnish-piece-price">${owned ? ownership === 'stored' ? 'In storage' : 'Yours' : `₦${money(item.price)}`}</span><span class="furnish-piece-cta">${label}<b aria-hidden="true">↗</b></span></button>`;
    }).join('') || `<p class="furnish-empty">${filter === 'stored' ? 'Your stored pieces will be here. Bring them back whenever you like.' : filter === 'owned' ? 'Your first pieces are waiting. Choose something from the shop.' : 'Choose another department to find your next piece.'}</p>`}</div>
    <p class="furnish-error" role="status" aria-live="polite">${escapeHTML(error)}</p>
  </section>`;
}

export function renderFurnitureControls(state, item, { mode = 'item', busy = false, error = '', useLabel = '' } = {}) {
  const placement = state.profile?.furnitureLayout?.[item.id], stored = furnitureOwnership(state.profile, item.id) === 'stored';
  const sell = mode === 'sale', resale = systemResaleValue(item);
  const controls = sell
    ? `<p class="furnish-sale-note">The system pays <strong>₦${money(resale)}</strong>. This piece leaves your home and inventory.</p><div class="furnish-item-actions"><button type="button" data-furnish-action="back" ${busy ? 'disabled' : ''}>Keep it</button><button type="button" data-furnish-action="confirm-sell" class="furnish-primary" ${busy ? 'disabled' : ''}>${busy ? 'Selling…' : `Sell · ₦${money(resale)}`}</button></div>`
    : `<div class="furnish-item-actions"><button type="button" data-furnish-action="move" class="furnish-primary" ${busy ? 'disabled' : ''}>${stored ? 'Place' : 'Move'}</button><button type="button" data-furnish-action="rotate" ${busy ? 'disabled' : ''}>Rotate ↻</button><button type="button" data-furnish-action="store" ${busy || stored ? 'disabled' : ''}>${stored ? 'Stored' : 'Store'}</button><button type="button" data-furnish-action="sell" ${busy ? 'disabled' : ''}>Sell</button></div>`;
  return `<section class="furnish-item-panel" role="dialog" aria-modal="false" aria-labelledby="furnish-item-title"><div class="furnish-item-heading">${modelMarkup(item)}<div><span>${stored ? 'Safely in storage' : placement ? 'Your placed piece' : 'Your own piece'}</span><h2 id="furnish-item-title">${escapeHTML(item.name)}</h2></div>${!sell && !stored && useLabel ? `<button type="button" data-furnish-action="use" class="furnish-use" aria-label="${escapeHTML(useLabel)}" ${busy ? 'disabled' : ''}>Use</button>` : ''}<button type="button" data-furnish-action="close" class="furnish-close" aria-label="Close furniture controls">${closeIcon}</button></div>${controls}<p class="furnish-error" role="status" aria-live="polite">${escapeHTML(error)}</p></section>`;
}

export function createFurnitureCatalogue({ root, getState, mutate, onSelect, onUpdate, getFurnitureState, toast, enhancePreviews, onClose, onUse } = {}) {
  const ownRoot = !root;
  if (!root) {
    root = document.createElement('div');
    root.className = 'furnish-catalogue-root';
    document.body.append(root);
  } else root.classList.add('furnish-catalogue-root');
  root.hidden = true;
  let opened = false, category = 'all', filter = 'all', mode = 'catalogue', selectedId = null, busy = false, error = '', priorFocus;
  const intents = new Map();
  const state = () => getState?.() || {};
  const decorate = () => state().profile?.location?.kind === 'home' && !state().profile?.visitingHome;
  const itemFor = id => itemsFrom(state().catalog).find(item => item.id === id && item.category === 'furniture');
  function render() {
    if (!opened) return;
    const snapshot = state();
    const item = itemFor(selectedId);
    if (mode !== 'catalogue' && (!item || furnitureOwnership(snapshot.profile, selectedId) === 'unowned')) {
      mode = 'catalogue'; selectedId = null;
    }
    const scroll = root.querySelector('.furnish-catalogue-grid')?.scrollTop || 0;
    const departmentScroll = root.querySelector('.furnish-departments')?.scrollLeft || 0;
    root.innerHTML = mode === 'catalogue'
      ? renderFurnitureCatalogue(snapshot, { category, filter, worldState: getFurnitureState?.(), busy, error })
      : renderFurnitureControls(snapshot, item, { mode, busy, error, useLabel: onUse ? useLabels[item.id] : '' });
    const grid = root.querySelector('.furnish-catalogue-grid');
    if (grid) grid.scrollTop = scroll;
    const departmentRow = root.querySelector('.furnish-departments');
    if (departmentRow) departmentRow.scrollLeft = departmentScroll;
    enhancePreviews?.(root);
  }
  function close({ restoreFocus = true } = {}) {
    if (!opened) return;
    opened = false; root.hidden = true; root.innerHTML = ''; error = ''; mode = 'catalogue'; selectedId = null;
    if (restoreFocus && priorFocus?.isConnected) priorFocus.focus({ preventScroll: true });
    onClose?.();
  }
  function open({ itemId = null, category: requestedCategory } = {}) {
    if (!decorate()) { toast?.('Arrange pieces inside your own home.'); return false; }
    if (itemId && furnitureOwnership(state().profile, itemId) !== 'unowned') return select(itemId);
    if (requestedCategory && ['all', ...FURNITURE_CATEGORIES.map(value => value.id)].includes(requestedCategory)) category = requestedCategory;
    priorFocus = globalThis.document?.activeElement;
    opened = true; mode = 'catalogue'; selectedId = null; error = ''; root.hidden = false; render();
    root.querySelector('.furnish-close')?.focus({ preventScroll: true });
    return true;
  }
  function showItem(itemId) {
    if (!decorate() || !itemFor(itemId) || furnitureOwnership(state().profile, itemId) === 'unowned') return false;
    priorFocus = globalThis.document?.activeElement;
    opened = true; selectedId = itemId; mode = 'item'; error = ''; root.hidden = false; render();
    return true;
  }
  async function write(action, itemId) {
    const signature = `${action}:${itemId}`;
    let key = intents.get(signature);
    if (!key) { key = crypto.randomUUID(); intents.set(signature, key); }
    busy = true; error = ''; render();
    try {
      const result = await mutate?.(action, { itemId, idempotencyKey: key });
      if (!result) throw new Error('That change was not confirmed. Please try again.');
      intents.delete(signature);
      // A successful purchase remains a purchase even if a later bootstrap
      // request fails. Ownership is read again, never manufactured locally.
      if (onUpdate) { try { await onUpdate(result); } catch { toast?.('Your change was saved. Reconnect to refresh your home.'); } }
      return result;
    } catch (caught) {
      error = caught?.message || 'Please try again.';
      toast?.(error);
      return null;
    } finally { busy = false; if (opened) render(); }
  }
  async function select(itemId, options = {}) {
    if (busy || !decorate()) return false;
    const item = itemFor(itemId);
    if (!item) return false;
    if (furnitureOwnership(state().profile, itemId) === 'unowned') {
      if (Number(state().profile?.wallet) < Number(item.price)) { toast?.('Add game funds or choose a piece within your balance.'); return false; }
      if (!await write('purchase', itemId)) return false;
    }
    if (!decorate() || furnitureOwnership(state().profile, itemId) === 'unowned') {
      toast?.('Your purchase is saved. Reopen your home when connected to arrange it.');
      return false;
    }
    close({ restoreFocus: false });
    return (await onSelect?.(itemId, options)) !== false;
  }
  async function edit(action, itemId = selectedId) {
    if (busy || !decorate() || !itemFor(itemId) || furnitureOwnership(state().profile, itemId) === 'unowned') return false;
    if (action === 'move') return select(itemId);
    if (action === 'use' && onUse && useLabels[itemId]) { close({ restoreFocus: false }); return (await onUse(itemId)) !== false; }
    if (action === 'rotate') {
      const rotation = Number(state().profile.furnitureLayout?.[itemId]?.rotation) || 0;
      return select(itemId, { rotation: (rotation + 90) % 360 });
    }
    if (action === 'sell') { selectedId = itemId; mode = 'sale'; error = ''; opened = true; root.hidden = false; render(); return true; }
    if (action === 'back') { mode = 'item'; error = ''; render(); return true; }
    if (action === 'store') {
      if (furnitureOwnership(state().profile, itemId) === 'stored') return true;
      if (!await write('store-furniture', itemId)) return false;
      toast?.('Stored safely. Place it again whenever you like.');
      if (opened) { mode = 'item'; render(); }
      return true;
    }
    if (action === 'confirm-sell' && opened && mode === 'sale' && selectedId === itemId) {
      const result = await write('sell-item', itemId);
      if (!result) return false;
      close();
      toast?.(`Sold. ₦${money(result.sale?.amount ?? systemResaleValue(itemFor(itemId)))} added to your Naira balance.`);
      return true;
    }
    return false;
  }
  function click(event) {
    const target = event.target;
    const action = target.closest('[data-furnish-action]')?.dataset.furnishAction;
    if (action === 'close') { close(); return; }
    if (busy) return;
    const department = target.closest('[data-furnish-category]')?.dataset.furnishCategory;
    if (department) {
      category = department;
      const grid = root.querySelector('.furnish-catalogue-grid'); if (grid) grid.scrollTop = 0;
      render();
      const control = root.querySelector(`[data-furnish-category="${department}"]`);
      control?.focus({ preventScroll: true }); control?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
    const ownershipFilter = target.closest('[data-furnish-filter]')?.dataset.furnishFilter;
    if (ownershipFilter) {
      filter = ownershipFilter;
      const grid = root.querySelector('.furnish-catalogue-grid'); if (grid) grid.scrollTop = 0;
      render(); root.querySelector(`[data-furnish-filter="${ownershipFilter}"]`)?.focus({ preventScroll: true });
      return;
    }
    const itemId = target.closest('[data-furnish-select]')?.dataset.furnishSelect;
    if (itemId) { void select(itemId); return; }
    if (action) void edit(action);
  }
  function key(event) {
    if (!opened) return;
    if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); close(); }
    // Controls have their own keyboard interaction. A focused Shop button must
    // not also walk a character through the room with the same key press.
    if (/^(?:Arrow(?:Left|Right|Up|Down)|[wasde]| )$/i.test(event.key)) event.stopPropagation();
  }
  root.addEventListener('click', click);
  root.addEventListener('keydown', key);
  return {
    open, showItem, close, select, edit, refresh: render, isOpen: () => opened,
    destroy() { close(); root.removeEventListener('click', click); root.removeEventListener('keydown', key); if (ownRoot) root.remove(); }
  };
}
