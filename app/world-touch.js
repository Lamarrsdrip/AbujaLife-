// Scene gestures own only scene pointers. Joystick, phone and catalogue controls
// retain their own handlers, and a completed drag can never become a walk tap.
export function bindWorldTouch({surface, enabled, orbit, placing, onStart, onItemDrag, onZoom, onChange}) {
  const pointers = new Map();
  const listeners = [];
  let gesture = null, suppressUntil = 0, pinchDistance = 0, pinchZoom = 1;
  const clock = () => performance.now();
  const listen = (node, type, fn, options) => {
    node.addEventListener(type, fn, options);
    listeners.push(() => node.removeEventListener(type, fn, options));
  };
  const gap = () => {
    const p = [...pointers.values()];
    return p.length < 2 ? 0 : Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y);
  };
  const capture = id => { try { surface.setPointerCapture(id); } catch {} };
  const preventTap = () => { suppressUntil = clock()+600; };
  const mark = value => { surface.dataset.worldGesture = value; };
  listen(surface, 'pointerdown', e => {
    if (!enabled() || (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2)) return;
    const time = clock();
    pointers.set(e.pointerId, {x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,time,dragged:false});
    if (pointers.size === 2) {
      e.preventDefault(); onStart(); orbit.stopMomentum();
      gesture = 'pinch'; pinchDistance = gap(); pinchZoom = orbit.getState().zoom;
      for (const id of pointers.keys()) capture(id);
      preventTap(); mark(gesture);
    }
  });
  listen(window, 'pointermove', e => {
    const previous = pointers.get(e.pointerId);
    if (!previous || !enabled()) return;
    const time = clock(), dt = Math.max(1/240, Math.min(.1, (time-previous.time)/1000));
    const next = {...previous,x:e.clientX,y:e.clientY,time};
    pointers.set(e.pointerId,next);
    if (pointers.size >= 2) {
      if (e.cancelable) e.preventDefault();
      if (pinchDistance > 0) onZoom(pinchZoom*gap()/pinchDistance);
      preventTap(); onChange(); return;
    }
    if (!next.dragged && Math.hypot(next.x-next.startX,next.y-next.startY) < 8) return;
    if (e.cancelable) e.preventDefault();
    if (!next.dragged) {
      next.dragged = true; gesture = placing() ? 'furniture' : 'orbit';
      onStart(); capture(e.pointerId); mark(gesture);
    }
    if (gesture === 'furniture') onItemDrag(e);
    else if (gesture === 'orbit') orbit.drag(next.x-previous.x,next.y-previous.y,dt);
    preventTap(); onChange();
  }, {passive:false});
  function release(e) {
    const pointer = pointers.get(e.pointerId);
    if (!pointer) return;
    const wasPinching = pointers.size >= 2;
    pointers.delete(e.pointerId);
    if (pointer.dragged || wasPinching) preventTap();
    if (wasPinching) {
      pinchDistance = 0;
      for (const p of pointers.values()) {
        p.startX=p.x; p.startY=p.y; p.dragged=false; p.time=clock();
      }
      gesture=null; orbit.stopMomentum();
    } else if (gesture === 'orbit') {
      if (e.type === 'pointercancel') orbit.stopMomentum(); else orbit.release();
    }
    if (!pointers.size) { gesture=null; mark('idle'); }
  }
  listen(window,'pointerup',release);
  listen(window,'pointercancel',release);
  listen(surface,'contextmenu',e => { if (enabled()) e.preventDefault(); });
  listen(surface,'wheel',e => {
    if (!enabled()) return;
    e.preventDefault(); orbit.stopMomentum();
    onZoom(orbit.getState().zoom*Math.exp(-Math.max(-160,Math.min(160,e.deltaY))*.002));
    preventTap(); onChange();
  },{passive:false});
  // Older Safari exposes gesture events instead of a second pointer.
  let safariZoom=1;
  listen(surface,'gesturestart',e => {
    if (!enabled()) return;
    e.preventDefault(); safariZoom=orbit.getState().zoom; orbit.stopMomentum(); onStart(); preventTap();
  },{passive:false});
  listen(surface,'gesturechange',e => {
    if (!enabled()) return;
    e.preventDefault();
    if (pointers.size<2 && Number.isFinite(e.scale)) onZoom(safariZoom*e.scale);
    preventTap(); onChange();
  },{passive:false});
  return {
    blocksClick: () => clock()<suppressUntil,
    dragging: () => pointers.size>0 && !!gesture,
    reset() { pointers.clear(); gesture=null; pinchDistance=0; orbit.stopMomentum(); mark('idle'); },
    dispose() { for (const remove of listeners) remove(); pointers.clear(); }
  };
}
