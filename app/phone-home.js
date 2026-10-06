// The launcher uses native scrolling, so horizontal swipes never intercept chat.
export const PHONE_APPS_PER_PAGE = 8;

export function phoneAppPages(apps) {
  const pages = [];
  for (let offset = 0; offset < apps.length; offset += PHONE_APPS_PER_PAGE) {
    pages.push(apps.slice(offset, offset + PHONE_APPS_PER_PAGE));
  }
  return pages.length ? pages : [[]];
}

export function phonePageIndex(page, count) {
  return Math.min(Math.max(0, count - 1), Math.max(0, Math.round(Number(page) || 0)));
}

export function renderPhoneHome({ apps, renderApp, widgets = '', dock = '', page = 0 }) {
  const pages = phoneAppPages(apps), current = phonePageIndex(page, pages.length);
  return `<div class="ph-home-content ph-home-paged">
    <div class="ph-home-pages" role="region" aria-label="Phone app pages" aria-roledescription="carousel" tabindex="0">
      ${pages.map((items, index) => `<section class="ph-home-page" data-phone-page="${index}" role="group" aria-roledescription="slide" aria-label="App page ${index + 1} of ${pages.length}">
        ${index === 0 ? widgets : `<div class="ph-page-heading"><small>YOUR LIFE, CONNECTED</small><strong>${index === 1 ? 'More of your city' : 'Your space online'}</strong><span>Swipe to explore your phone</span></div>`}
        <div class="ph-app-grid">${items.map(app => renderApp(...app)).join('')}</div>
      </section>`).join('')}
    </div>
    <nav class="ph-home-pagination" aria-label="Choose an app page">
      <button type="button" class="ph-page-arrow" data-phone-page-step="-1" aria-label="Previous app page" ${current === 0 ? 'disabled' : ''}>‹</button>
      <div class="ph-home-page-dots">${pages.map((_, index) => `<button type="button" class="ph-home-page-dot" data-phone-page-go="${index}" aria-label="App page ${index + 1} of ${pages.length}" ${index === current ? 'aria-current="page"' : ''}><i aria-hidden="true"></i></button>`).join('')}</div>
      <button type="button" class="ph-page-arrow" data-phone-page-step="1" aria-label="Next app page" ${current === pages.length - 1 ? 'disabled' : ''}>›</button>
      <span class="ph-page-announcement" aria-live="polite" aria-atomic="true">App page ${current + 1} of ${pages.length}</span>
    </nav>
    <div class="ph-dock" aria-label="Favorite apps">${dock}</div>
  </div>`;
}

export function bindPhoneHome(root, { page = 0, onPageChange = () => {} } = {}) {
  const viewport = root.querySelector('.ph-home-pages');
  if (!viewport) return null;
  const pages = [...viewport.querySelectorAll('[data-phone-page]')];
  const pagination = root.querySelector('.ph-home-pagination');
  const dots = [...pagination.querySelectorAll('[data-phone-page-go]')];
  const previous = pagination.querySelector('[data-phone-page-step="-1"]');
  const next = pagination.querySelector('[data-phone-page-step="1"]');
  const announcement = pagination.querySelector('.ph-page-announcement');
  const scheduleFrame = globalThis.requestAnimationFrame?.bind(globalThis) || (callback => globalThis.setTimeout(callback, 0));
  const cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis) || (handle => globalThis.clearTimeout(handle));
  let current = phonePageIndex(page, pages.length), scrollFrame = 0;

  function sync(index) {
    current = phonePageIndex(index, pages.length);
    for (let i = 0; i < dots.length; i++) {
      if (i === current) dots[i].setAttribute('aria-current', 'page');
      else dots[i].removeAttribute('aria-current');
      // Off-screen apps must not trap keyboard or screen-reader navigation.
      pages[i].inert = i !== current;
    }
    previous.disabled = current === 0;
    next.disabled = current === pages.length - 1;
    announcement.textContent = `App page ${current + 1} of ${pages.length}`;
    onPageChange(current);
  }

  function pageOffset(index) {return pages[index].offsetLeft - pages[0].offsetLeft;}
  function nearestPage() {
    let index=0,best=Infinity;
    for(let i=0;i<pages.length;i++){
      const gap=Math.abs(viewport.scrollLeft-pageOffset(i));
      if(gap<best){best=gap;index=i;}
    }
    return index;
  }

  function go(index) {
    const target = phonePageIndex(index, pages.length);
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollTo({ left: pageOffset(target), behavior: reducedMotion ? 'instant' : 'smooth' });
    sync(target);
  }

  function onScroll() {
    if(scrollFrame)return;
    scrollFrame=scheduleFrame(()=>{scrollFrame=0;sync(nearestPage());});
  }

  function onClick(event) {
    const dot = event.target.closest('[data-phone-page-go]');
    const arrow = event.target.closest('[data-phone-page-step]');
    if (dot && pagination.contains(dot)) go(Number(dot.dataset.phonePageGo));
    else if (arrow && pagination.contains(arrow) && !arrow.disabled) go(current + Number(arrow.dataset.phonePageStep));
  }

  function onKey(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    go(current + (event.key === 'ArrowLeft' ? -1 : 1));
  }

  viewport.scrollLeft = pageOffset(current);
  sync(current);
  viewport.addEventListener('scroll', onScroll, { passive: true });
  viewport.addEventListener('keydown', onKey);
  pagination.addEventListener('click', onClick);
  return {
    getPage: () => current,
    destroy() {
      if(scrollFrame)cancelFrame(scrollFrame);
      viewport.removeEventListener('scroll', onScroll);
      viewport.removeEventListener('keydown', onKey);
      pagination.removeEventListener('click', onClick);
    }
  };
}
