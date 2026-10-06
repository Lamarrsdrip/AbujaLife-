// Play-mode presentation rules are deliberately separate from the geographic Map.
// The simulator owns building geometry/collisions; this layer only keeps roof names
// readable on a small phone viewport without turning the city into a wall of cards.
let styleInstalled=false;

function installStyle(){
  if(styleInstalled||typeof document==='undefined')return;
  styleInstalled=true;
  const style=document.createElement('style');
  style.dataset.abujalifeWorldPresentation='';
  style.textContent=`
    .world-roof-name{
      max-width:148px!important;
      min-height:31px!important;
      padding:5px 8px!important;
      border-radius:9px!important;
      font-size:9.5px!important;
      line-height:1.14!important;
      letter-spacing:.01em!important;
      box-shadow:0 5px 14px #06251c24!important;
    }
    .world-roof-name[data-world-declutter="1"]{display:none!important}
    @media(max-width:600px){
      .world-roof-name{
        max-width:126px!important;
        min-height:28px!important;
        padding:4px 7px!important;
        border-radius:8px!important;
        font-size:8.5px!important;
      }
    }
  `;
  document.head.append(style);
}

const overlaps=(a,b,gap=5)=>!(a.right+gap<b.left||a.left-gap>b.right||a.bottom+gap<b.top||a.top-gap>b.bottom);

export function polishWorldPresentation(container){
  installStyle();
  if(!container||container.dataset.sceneKind!=='public')return ()=>{};
  let frame=0,stopped=false,last=0;
  const tick=now=>{
    if(stopped)return;
    frame=requestAnimationFrame(tick);
    if(now-last<110)return;
    last=now;
    const buttons=[...container.querySelectorAll('.world-roof-name')];
    if(!buttons.length)return;
    for(const button of buttons)button.dataset.worldDeclutter='0';
    const root=container.getBoundingClientRect(),limit=root.width<=600?8:14;
    const candidates=buttons.filter(button=>!button.hidden).map(button=>({
      button,
      rect:button.getBoundingClientRect(),
      priority:(button.dataset.roofBuilding==='home'?100000:0)+button.getBoundingClientRect().bottom,
    })).filter(item=>item.rect.width>0&&item.rect.height>0).sort((a,b)=>b.priority-a.priority);
    const placed=[];
    let shown=0;
    for(const item of candidates){
      const collides=placed.some(rect=>overlaps(item.rect,rect));
      const outside=item.rect.right<root.left+12||item.rect.left>root.right-12||item.rect.bottom<root.top+100||item.rect.top>root.bottom-128;
      if(outside||collides||shown>=limit){item.button.dataset.worldDeclutter='1';continue;}
      placed.push(item.rect);shown++;
    }
  };
  frame=requestAnimationFrame(tick);
  return ()=>{stopped=true;cancelAnimationFrame(frame);};
}
