// Keep game input intact while preventing page pinch/gesture zoom where supported.
export function installPageViewport(target=document) {
  const win=target.defaultView||globalThis;
  const viewport=win.visualViewport;
  let frame=0;
  const measure=()=>{
    frame=0;
    if(viewport&&viewport.scale!==1)return;
    target.documentElement.style.setProperty('--game-viewport-height',`${viewport?.height||win.innerHeight}px`);
    target.documentElement.style.setProperty('--game-viewport-top',`${viewport?.offsetTop||0}px`);
  };
  const resize=()=>{if(!frame)frame=win.requestAnimationFrame(measure);};
  measure();
  win.addEventListener('resize',resize,{passive:true});
  viewport?.addEventListener('resize',resize,{passive:true});
  viewport?.addEventListener('scroll',resize,{passive:true});
  const preventGesture=event=>{if(event.cancelable)event.preventDefault();};
  const preventPinch=event=>{if(event.touches?.length>1&&event.cancelable)event.preventDefault();};
  target.addEventListener('gesturestart',preventGesture,{passive:false});
  target.addEventListener('gesturechange',preventGesture,{passive:false});
  target.addEventListener('touchmove',preventPinch,{passive:false});
  return ()=>{win.cancelAnimationFrame(frame);win.removeEventListener('resize',resize);viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);target.removeEventListener('gesturestart',preventGesture);target.removeEventListener('gesturechange',preventGesture);target.removeEventListener('touchmove',preventPinch);};
}
