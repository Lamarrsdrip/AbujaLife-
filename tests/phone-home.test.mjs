import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneAppPages, phonePageIndex, renderPhoneHome, bindPhoneHome } from '../app/phone-home.js';

test('launcher keeps every app reachable on bounded pages without mutating app order', () => {
  const apps = Array.from({ length: 20 }, (_, index) => [`app-${index}`, `App ${index}`, 'green']);
  const pages = phoneAppPages(apps);
  assert.deepEqual(pages.map(page => page.length), [8, 8, 4]);
  assert.deepEqual(pages.flat(), apps);
  pages[0].pop();
  assert.equal(apps.length, 20);
  assert.deepEqual(phoneAppPages([]), [[]]);
});

test('rendered pages have one widget row, a separate pinned dock and accessible navigation', () => {
  const apps = Array.from({ length: 20 }, (_, index) => [`app-${index}`, `App ${index}`, 'green']);
  const html = renderPhoneHome({
    apps, page: 1, widgets: '<div class="qa-widgets">Current area and balance</div>',
    dock: '<button data-app="messages">Messages</button>',
    renderApp: id => `<button data-app="${id}">${id}</button>`
  });
  assert.equal((html.match(/data-phone-page="/g) || []).length, 3);
  assert.equal((html.match(/class="qa-widgets"/g) || []).length, 1);
  for (const [id] of apps) assert.equal((html.match(new RegExp(`data-app="${id}"`, 'g')) || []).length, 1);
  assert.match(html, /data-phone-page-go="1"[^>]*aria-current="page"/);
  assert.match(html, /aria-label="Next app page"/);
  assert.match(html, /aria-label="Favorite apps"/);
  assert.match(html, /aria-live="polite"/);
});

class Element {
  constructor(props = {}) { Object.assign(this, { handlers: new Map(), attrs: {}, disabled: false, dataset: {} }, props); }
  addEventListener(type, handler) { this.handlers.set(type, handler); }
  removeEventListener(type, handler) { if (this.handlers.get(type) === handler) this.handlers.delete(type); }
  setAttribute(name, value) { this.attrs[name] = value; }
  removeAttribute(name) { delete this.attrs[name]; }
  closest(selector) {
    return selector === '[data-phone-page-go]' && this.dataset.phonePageGo !== undefined || selector === '[data-phone-page-step]' && this.dataset.phonePageStep !== undefined ? this : null;
  }
}

function launcher() {
  const pages = [0, 1, 2].map(index => new Element({ offsetLeft: index * 280 }));
  const dots = pages.map((_, index) => new Element({ dataset: { phonePageGo: String(index) } }));
  const previous = new Element({ dataset: { phonePageStep: '-1' } });
  const next = new Element({ dataset: { phonePageStep: '1' } });
  const announcement = new Element();
  const viewport = new Element({
    clientWidth: 280, scrollLeft: 0,
    querySelectorAll: () => pages,
    scrollTo(options) { this.scrollOptions = options; this.scrollLeft = options.left; }
  });
  const pagination = new Element({
    querySelectorAll: () => dots,
    querySelector: selector => selector.includes('"-1"') ? previous : selector.includes('"1"') ? next : announcement,
    contains: target => [...dots, previous, next].includes(target)
  });
  const root = { querySelector: selector => selector === '.ph-home-pages' ? viewport : pagination };
  return { root, viewport, pagination, pages, dots, previous, next, announcement };
}

test('native horizontal scroll updates the active page and only the visible page is keyboard reachable', () => {
  const dom = launcher(), visited = [];
  const paging = bindPhoneHome(dom.root, { page: 1, onPageChange: index => visited.push(index) });
  assert.equal(dom.viewport.scrollLeft, 280);
  assert.deepEqual(dom.pages.map(page => page.inert), [true, false, true]);
  dom.viewport.scrollLeft = 560;
  dom.viewport.handlers.get('scroll')();
  assert.equal(paging.getPage(), 2);
  assert.equal(dom.dots[2].attrs['aria-current'], 'page');
  assert.equal(dom.next.disabled, true);
  assert.equal(dom.announcement.textContent, 'App page 3 of 3');
  assert.deepEqual(visited, [1, 2]);
  paging.destroy();
  assert.equal(dom.viewport.handlers.size, 0);
  assert.equal(dom.pagination.handlers.size, 0);
});

test('page controls and keyboard navigation respect bounds and preserve the selected page across remounts', () => {
  const dom = launcher();
  const paging = bindPhoneHome(dom.root);
  dom.pagination.handlers.get('click')({ target: dom.next });
  assert.equal(paging.getPage(), 1);
  assert.equal(dom.viewport.scrollOptions.left, 280);
  dom.pagination.handlers.get('click')({ target: dom.dots[2] });
  assert.equal(paging.getPage(), 2);
  let prevented = false;
  dom.viewport.handlers.get('keydown')({ key: 'ArrowRight', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(paging.getPage(), 2);
  dom.viewport.handlers.get('keydown')({ key: 'ArrowLeft', preventDefault() {} });
  assert.equal(paging.getPage(), 1);
  const saved = paging.getPage();
  paging.destroy();
  const remount = launcher();
  const restored = bindPhoneHome(remount.root, { page: saved });
  assert.equal(restored.getPage(), 1);
  assert.equal(remount.viewport.scrollLeft, 280);
  assert.equal(phonePageIndex(-50, 3), 0);
  assert.equal(phonePageIndex(99, 3), 2);
  assert.equal(bindPhoneHome({ querySelector: () => null }), null);
});
