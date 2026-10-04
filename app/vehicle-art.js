import { VEHICLE_COLORS } from '../src/shared/vehicles.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
let illustrationId = 0;

export const vehicleColorHex = colorId => VEHICLE_COLORS.find(color => color.id === colorId)?.hex || '#a5afb5';

/** Original showroom artwork. Model names describe game vehicles, never licensed brand artwork. */
export function vehicleIllustration(item = {}, colorId = item.defaultColor) {
  const id = `vehicle-art-${++illustrationId}`;
  const paint = VEHICLE_COLORS.find(color => color.id === colorId)?.hex || item.colour || '#a5afb5';
  const colorName = VEHICLE_COLORS.find(color => color.id === colorId)?.name || 'Custom paint';
  const style = item.bodyStyle || (item.id?.includes('suv') ? 'suv' : item.id?.includes('hatchback') ? 'hatchback' : 'sedan');
  const boxy = ['offroad','gwagon'].includes(style), suv = style === 'suv', hatch = style === 'hatchback';
  const modern = Number(item.year || 2024) >= 2020;
  const mercedes = /mercedes/i.test(item.brand || item.name || ''), bmw = /bmw/i.test(item.brand || item.name || '');
  const wheelY = boxy || suv ? 109 : 111, wheelR = boxy || suv ? 20 : 18;
  const front = boxy ? 222 : 232, rear = 69;
  const outline = boxy
    ? 'M43 102V53q0-9 9-9h114q7 0 12 7l18 27h38q12 0 17 10l6 11v21H44Z'
    : suv
      ? 'M34 105 43 76 78 70l25-29h71q11 0 18 11l19 25 29 9q14 5 19 16v19H34Z'
      : hatch
        ? 'M36 105 46 78l28-8 29-30h47q13 0 24 13l20 23 45 12q17 4 22 17v17H34Z'
        : 'M28 106q5-16 21-20l29-7 34-31q7-6 19-6h41q10 0 18 8l29 29 38 9q12 4 15 17v16H28Z';
  const glass = boxy
    ? '<path d="M53 52h51v30H53Zm58 0h48l20 30h-68Z"/><path d="M57 57h43v4H57Zm58 0h42l4 5h-46Z" class="vehicle-glass-shine"/>'
    : suv
      ? '<path d="m61 77 23-28h29v29Zm59-29h48l20 30h-68Zm75 9 14 20h-14Z"/><path d="m86 52 21 0-18 23H67Zm39 0h39l4 6h-43Z" class="vehicle-glass-shine"/>'
      : hatch
        ? '<path d="m82 76 25-28h25v29Zm57-28h9q10 0 17 9l16 20h-42Z"/><path d="m110 51 15 0-18 23H89Zm35 0h7l9 7h-16Z" class="vehicle-glass-shine"/>'
        : '<path d="m86 77 29-27h27v28Zm63-27h22q7 0 13 7l21 21h-56Z"/><path d="m119 53 17 0-21 22H96Zm35 0h16l6 5h-22Z" class="vehicle-glass-shine"/>';
  const wheel = x => `<g transform="translate(${x} ${wheelY})"><circle r="${wheelR+3}" fill="#172329"/><circle r="${wheelR}" fill="url(#${id}-tire)"/><circle r="${wheelR-6}" fill="#9da8ad"/><circle r="${wheelR-8}" fill="#34444c"/>${Array.from({length:5},(_,i)=>`<path d="m-2-10 4 0 1 7-3 3-3-3Z" fill="#d7dce0" transform="rotate(${i*72})"/>`).join('')}<circle r="3" fill="#dbe1e1"/><circle r="${wheelR-1}" fill="none" stroke="#46535a" stroke-width="1"/></g>`;
  const grille = mercedes
    ? '<path d="M247 94h15v15h-15Z" fill="#18262b"/><path d="M250 96v11m4-11v11m4-11v11" stroke="#cad3d4" stroke-width="1.3"/>'
    : bmw
      ? '<path d="M247 95h6v12h-6Zm8 0h6v12h-6Z" fill="#17242c" stroke="#aebfc3" stroke-width="1"/>'
      : '<path d="M247 97h15v10h-15Z" fill="#27383d"/><path d="M249 100h11m-11 3h11" stroke="#9ab0b6" stroke-width="1"/>';
  return `<svg class="vehicle-illustration ph-product-illustration" viewBox="0 0 300 160" role="img" aria-label="${esc(item.name || 'Vehicle')} in ${esc(colorName)}" data-vehicle-body="${esc(style)}" data-vehicle-color="${esc(colorId || '')}"><defs><linearGradient id="${id}-paint" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#fff" stop-opacity=".42"/><stop offset=".34" stop-color="${paint}"/><stop offset=".75" stop-color="${paint}"/><stop offset="1" stop-color="#081b25" stop-opacity=".65"/></linearGradient><linearGradient id="${id}-glass" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#526d7b"/><stop offset="1" stop-color="#172b36"/></linearGradient><radialGradient id="${id}-tire"><stop stop-color="#3c474c"/><stop offset="1" stop-color="#0f171c"/></radialGradient></defs><ellipse cx="149" cy="136" rx="127" ry="8" fill="#183c44" opacity=".12"/><path d="${outline}" fill="${paint}" stroke="#172c35" stroke-opacity=".4" stroke-width="1.5"/><path d="${outline}" fill="url(#${id}-paint)"/><g fill="url(#${id}-glass)" stroke="#3f525b" stroke-width="2">${glass}</g><g fill="none" stroke="#29404b" stroke-opacity=".5" stroke-width="1"><path d="M${boxy?107:hatch?135:146} 82v31m${boxy?70:hatch?51:64}-31v31M46 91l194 1M41 118h217"/><path d="M91 97h18m49 0h15" stroke="#e3e9e9" stroke-width="2.6" stroke-linecap="round"/></g><path d="M187 78h14q6 0 6 5v6h-19Z" fill="${paint}" stroke="#52636b" stroke-width="1"/><path d="M191 80h13" stroke="#ffffff" opacity=".45"/><path d="m${modern?236:233} 89 24 4-2 6h-19Z" fill="#eff5de" stroke="#afbac0" stroke-width="1"/><path d="M${modern?242:241} 93h14" stroke="#fff" stroke-width="2"/><path d="M33 96h11v9H31Z" fill="#923e3d"/><path d="M31 98h10" stroke="#ef8c78" stroke-width="2"/>${grille}<path d="M252 112h13v5h-13Z" fill="#0b2027"/><path d="M128 121h57" stroke="#c0ced0" stroke-width="2" opacity=".6"/>${boxy?'<path d="M45 49V39h121v6M72 88v26M108 85v29M177 87v27" fill="none" stroke="#1d303a" stroke-width="2"/><path d="M38 55h7v39h-7Z" fill="#203138"/><circle cx="43" cy="79" r="15" fill="#1d2b32" stroke="#46555c" stroke-width="3"/>':suv?'<path d="M104 38h67" stroke="#4c5a60" stroke-width="3"/><path d="M111 37v-5m51 5v-5" stroke="#4c5a60" stroke-width="2"/>':''}${wheel(rear)}${wheel(front)}<style>.vehicle-glass-shine{fill:#c0d4d9;opacity:.28;stroke:none}</style></svg>`;
}
