// All gameplay modules share one bounded, temporary notification lane.
const queue=[];let timer=0,current=null;
function advance(){
 clearTimeout(timer);timer=0;
 const node=document.querySelector('#toast');if(!node){queue.length=0;current=null;return;}
 current=null;node.classList.remove('visible');document.body.classList.remove('hud-toast-active');
 if(queue.length&&document.querySelector('.world-resident-actions,.world-live-popover,.world-furniture-toolbar:not([hidden])')){timer=setTimeout(advance,500);return;}
 current=queue.shift()||null;
 document.body.classList.toggle('hud-toast-active',!!current);
 if(!current){node.classList.remove('visible');node.textContent='';return;}
 node.textContent=current;node.classList.add('visible');
 timer=setTimeout(advance,3500);
}
export function showGameToast(message){
 const text=String(message||'').trim();if(!text||text===current||queue.includes(text))return;
 if(queue.length>=3)queue.shift();queue.push(text);if(!current)advance();
}
export function clearGameToasts(){queue.length=0;current=null;clearTimeout(timer);timer=0;document.querySelector('#toast')?.classList.remove('visible');document.body.classList.remove('hud-toast-active');}
