// Keep game input intact while preventing page pinch/gesture zoom where supported.
export function installPageViewport(target=document) {
  const preventGesture=event=>{if(event.cancelable)event.preventDefault();};
  const preventPinch=event=>{if(event.touches?.length>1&&event.cancelable)event.preventDefault();};
  target.addEventListener('gesturestart',preventGesture,{passive:false});
  target.addEventListener('gesturechange',preventGesture,{passive:false});
  target.addEventListener('touchmove',preventPinch,{passive:false});
  return ()=>{target.removeEventListener('gesturestart',preventGesture);target.removeEventListener('gesturechange',preventGesture);target.removeEventListener('touchmove',preventPinch);};
}
