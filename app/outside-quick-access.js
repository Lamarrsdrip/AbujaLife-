const QUICK_PLACES = [
  ['Clubs', 'club'],
  ['Food', 'restaurant'],
  ['Gym', 'gym'],
  ['Cinema', 'cinema'],
  ['Games', 'games'],
  ['Shops', 'market'],
];

function enhanceOutside(shell) {
  if (!shell || shell.dataset.quickPlaces === 'ready') return;
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
