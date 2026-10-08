export const PHONE_SIZE = Object.freeze({ width: 390, height: 823, caption: 50 });

export function fitPhoneViewport({ width, height, top = 0, left = 0, safeTop = 0, safeBottom = 0 }) {
  const inset = 12, usableWidth = Math.max(1, width - inset * 2), usableHeight = Math.max(1, height - safeTop - safeBottom - inset * 2);
  const scale = Math.min(1, usableWidth / PHONE_SIZE.width, usableHeight / (PHONE_SIZE.height + PHONE_SIZE.caption));
  return { top, left, width, height, scale, x: width / 2, y: safeTop + inset + (usableHeight - (PHONE_SIZE.height + PHONE_SIZE.caption) * scale) / 2 + (PHONE_SIZE.caption + PHONE_SIZE.height / 2) * scale };
}

// One viewport owner for every phone app/input. Layout stays at physical device
// dimensions; only the complete handset's transform changes with the keyboard.
export function createPhoneViewport(root) {
  let savedScroll = null, frame = null;
  const update = () => {
    frame = null;
    if (root.hidden) return;
    const vv = window.visualViewport, style = getComputedStyle(root);
    const box = fitPhoneViewport({ width: vv?.width || window.innerWidth, height: vv?.height || window.innerHeight, top: vv?.offsetTop || 0, left: vv?.offsetLeft || 0, safeTop: parseFloat(style.paddingTop) || 0, safeBottom: parseFloat(style.paddingBottom) || 0 });
    for (const key of ['top', 'left', 'width', 'height', 'x', 'y']) root.style.setProperty(`--ph-viewport-${key}`, `${box[key]}px`);
    root.style.setProperty('--ph-device-scale', String(box.scale));
    const typing = root.contains(document.activeElement) && document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
    root.classList.toggle('phone-keyboard-open', Boolean(typing && box.height < window.innerHeight - 100));
  };
  const schedule = () => { if (frame === null) frame = requestAnimationFrame(update); };
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  root.addEventListener('focusin', schedule); root.addEventListener('focusout', schedule);
  return {
    update,
    lock() { if (savedScroll) return; savedScroll = { x: window.scrollX, y: window.scrollY }; document.body.style.setProperty('--ph-page-scroll', `${-savedScroll.y}px`); document.body.classList.add('phone-is-open'); update(); },
    unlock() { if (!savedScroll) return; const position = savedScroll; savedScroll = null; document.body.classList.remove('phone-is-open'); document.body.style.removeProperty('--ph-page-scroll'); window.scrollTo(position.x, position.y); },
    dispose() { this.unlock(); if (frame !== null) cancelAnimationFrame(frame); window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); window.removeEventListener('orientationchange', schedule); root.removeEventListener('focusin', schedule); root.removeEventListener('focusout', schedule); }
  };
}
