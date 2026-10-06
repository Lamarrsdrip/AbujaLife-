const QUICK_PLACES = [
  ['Clubs', 'club'],
  ['Food', 'restaurant'],
  ['Gym', 'gym'],
  ['Cinema', 'cinema'],
  ['Games', 'games'],
  ['Shops', 'market'],
];

const safeExternalLink = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
};

const liveAdSpaces = () => new Map((globalThis.__ABJ_ADS__?.spaces || []).map(space => [space.id, space]));

function syncAdTiles(shell) {
  const spaces = liveAdSpaces();
  const interactivePlots = shell?.classList?.contains('outside-city-v3');
  shell?.querySelectorAll('.outside-ad-label').forEach(button => {
    button.dataset.defaultLabel ||= button.textContent || '';
    const key = button.dataset.destinationKey || '';
    const id = key.startsWith('ad:') ? key.slice(3) : '';
    const space = spaces.get(id);
    const creative = space?.ad?.imageDataUrl;
    const validCreative = typeof creative === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/i.test(creative);

    button.classList.toggle('is-live-ad', Boolean(validCreative));
    button.removeAttribute('data-ad-link');
    if (!validCreative) {
      button.replaceChildren(document.createTextNode(button.dataset.defaultLabel));
      if (interactivePlots) {
        button.removeAttribute('aria-hidden');
        button.tabIndex = 0;
        button.setAttribute('aria-label', `${button.dataset.defaultLabel}. Available advertising plot. Tap to view or buy.`);
      } else {
        button.setAttribute('aria-hidden', 'true');
        button.tabIndex = -1;
      }
      return;
    }

    const image = document.createElement('img');
    image.src = creative;
    image.alt = space.ad?.title ? `${space.ad.title} advertisement` : 'Advertisement';
    image.decoding = 'async';
    image.loading = 'eager';
    button.replaceChildren(image);
    button.removeAttribute('aria-hidden');
    button.tabIndex = 0;
    button.setAttribute('aria-label', image.alt);
    const link = safeExternalLink(space.ad?.link);
    if (link) button.dataset.adLink = link;
  });
}

function enhanceOutside(shell) {
  if (!shell || shell.dataset.quickPlaces === 'ready') {
    syncAdTiles(shell);
    return;
  }
  const directory = shell.querySelector('.outside-directory');
  const search = directory?.querySelector('input[type="search"]');
  if (!directory || !search) return;

  shell.dataset.quickPlaces = 'ready';
  const quick = document.createElement('nav');
  quick.className = 'outside-quick';
  quick.setAttribute('aria-label', 'Quick places');
  quick.innerHTML = QUICK_PLACES.map(([label, query]) =>
    `<button type="button" data-quick-place="${query}" aria-pressed="false">${label}</button>`
  ).join('');
  directory.prepend(quick);

  const sync = () => {
    const current = search.value.trim().toLowerCase();
    quick.querySelectorAll('[data-quick-place]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.quickPlace === current));
    });
  };

  quick.addEventListener('click', event => {
    const button = event.target.closest('[data-quick-place]');
    if (!button) return;
    search.value = button.dataset.quickPlace || '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    sync();
  });
  search.addEventListener('input', sync);

  shell.addEventListener('click', event => {
    const ad = event.target.closest('.outside-ad-label.is-live-ad');
    if (!ad) return;
    const link = safeExternalLink(ad.dataset.adLink);
    if (!link) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.open(link, '_blank', 'noopener,noreferrer');
  }, true);

  syncAdTiles(shell);
}

function scan(root = document) {
  root.querySelectorAll?.('.outside-city').forEach(enhanceOutside);
}

scan();
new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches?.('.outside-city')) enhanceOutside(node);
      scan(node);
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true });

addEventListener('abj:ads-updated', () => scan());