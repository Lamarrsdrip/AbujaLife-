// One details sheet for every advert in the city: a street billboard, a Map board, or an empty board for sale.
const IMAGE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function safeAdLink(url) { try { const parsed = new URL(String(url || '')); return parsed.protocol === 'https:' ? parsed.href : null; } catch { return null; } }

/** Pure view model, so the sheet never renders anything an advertiser did not get approved. */
export function adDetailsModel(ad) {
  if (!ad) return { vacant: true, eyebrow: 'BILLBOARD SPACE', title: 'Your business here', sponsor: '', body: 'This board is open. Put your brand in front of everyone walking and driving through Abuja.', image: null, link: null, cta: '', contact: '' };
  const link = safeAdLink(ad.link), title = String(ad.title || ad.sponsor || 'Sponsored').slice(0, 80), house = ad.campaignType === 'house';
  let host = ''; try { host = link ? new URL(link).hostname.replace(/^www\./, '') : ''; } catch { host = ''; }
  return { vacant: false, eyebrow: house ? 'ABUJALIFE' : 'SPONSORED', title, sponsor: String(ad.sponsor && ad.sponsor !== title ? ad.sponsor : '').slice(0, 80), body: String(ad.body || ad.description || '').slice(0, 400),
    image: IMAGE.test(String(ad.imageDataUrl || '')) ? ad.imageDataUrl : null, link, cta: String(ad.cta || (host ? `Visit ${host}` : `Visit ${title}`)).slice(0, 48), contact: house ? [ad.domain, ad.email].filter(Boolean).join(' · ') : host };
}

let layer = null, restoreFocus = null;
export function closeAdDetails() { if (!layer) return; layer.remove(); layer = null; document.body.classList.remove('ad-details-open'); removeEventListener('keydown', onKey); try { restoreFocus?.focus?.({ preventScroll: true }); } catch { /* the opener may be gone */ } restoreFocus = null; }
function onKey(event) { if (event.key === 'Escape') closeAdDetails(); }

export function openAdDetails(ad, { source = 'street' } = {}) {
  if (typeof document === 'undefined') return null;
  closeAdDetails();
  const view = adDetailsModel(ad); restoreFocus = document.activeElement;
  layer = document.createElement('div'); layer.className = 'ad-details-layer'; layer.dataset.adSource = source;
  layer.innerHTML = `<section class="ad-details" role="dialog" aria-modal="true" aria-labelledby="ad-details-title"><button type="button" class="ad-details-close" data-ad-details="close" aria-label="Close advert">×</button>${view.image ? `<div class="ad-details-creative"><img src="${view.image}" alt="${esc(view.title)} advert"></div>` : `<div class="ad-details-creative is-empty" aria-hidden="true"><span>${view.vacant ? 'ADVERTISE HERE' : esc(view.title)}</span></div>`}<div class="ad-details-body"><span class="ad-details-eyebrow">${esc(view.eyebrow)}</span><h2 id="ad-details-title">${esc(view.title)}</h2>${view.sponsor ? `<p class="ad-details-sponsor">by ${esc(view.sponsor)}</p>` : ''}${view.body ? `<p class="ad-details-copy">${esc(view.body)}</p>` : ''}${view.contact ? `<small class="ad-details-contact">${esc(view.contact)}</small>` : ''}<div class="ad-details-actions">${view.link ? `<a class="ad-details-visit" href="${esc(view.link)}" target="_blank" rel="noopener noreferrer sponsored">${esc(view.cta)} ↗</a>` : ''}<button type="button" class="ad-details-advertise${view.link ? '' : ' is-primary'}" data-ad-details="advertise">${view.vacant ? 'Advertise on this board' : 'Advertise in Abuja'}</button></div></div></section>`;
  layer.addEventListener('click', event => {
    const action = event.target.closest('[data-ad-details]')?.dataset.adDetails;
    if (action === 'advertise') { closeAdDetails(); dispatchEvent(new CustomEvent('abj:open-ad-studio', { detail: { kind: 'plot' } })); return; }
    if (action === 'close' || event.target === layer) closeAdDetails();
  });
  document.body.append(layer); document.body.classList.add('ad-details-open'); addEventListener('keydown', onKey);
  layer.querySelector('.ad-details-close').focus({ preventScroll: true });
  return layer;
}
