// Grid navigation and collision for the walkable/drivable world. Extracted from
// world-simulator.js so the same probe the player uses can be exercised by
// tests that drive every road of every district.
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

export function makeNavigation(scene,radius=10) {
  const step=26,cols=Math.ceil(scene.width/step),rows=Math.ceil(scene.height/step),blocked=new Uint8Array(cols*rows);
  // Obstacles are bucketed into coarse cells so a collision probe looks at the
  // handful of boxes near the point instead of every building in the city.
  // Only the large street scene is indexed; interiors keep a short obstacle list
  // that furniture editing mutates in place, so they always scan it directly.
  const cell=256,maxReach=Math.max(radius,40),buckets=new Map(),indexed=scene.obstacles.length>60,indexedCount=scene.obstacles.length;
  if(indexed)for(const o of scene.obstacles){
   const x0=Math.floor((o.x-maxReach)/cell),x1=Math.floor((o.x+o.w+maxReach)/cell),y0=Math.floor((o.y-maxReach)/cell),y1=Math.floor((o.y+o.h+maxReach)/cell);
   for(let gy=y0;gy<=y1;gy++)for(let gx=x0;gx<=x1;gx++){const k=gy*4096+gx;let list=buckets.get(k);if(!list)buckets.set(k,list=[]);list.push(o);}
  }
  const near=(x,y)=>buckets.get(Math.floor(y/cell)*4096+Math.floor(x/cell))||[];
  const contains=(x,y,r=radius)=>x<r+12||y<r+12||x>scene.width-r-12||y>scene.height-r-12||(indexed&&r<=maxReach&&scene.obstacles.length===indexedCount?near(x,y):scene.obstacles).some(o=>x>o.x-r&&x<o.x+o.w+r&&y>o.y-r&&y<o.y+o.h+r);
  for(let gy=0;gy<rows;gy++)for(let gx=0;gx<cols;gx++)blocked[gy*cols+gx]=contains((gx+.5)*step,(gy+.5)*step)?1:0;
  const free=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&!blocked[y*cols+x];
  const nearest=p=>{
    const ox=clamp(Math.floor(p.x/step),0,cols-1),oy=clamp(Math.floor(p.y/step),0,rows-1);
    if(free(ox,oy))return [ox,oy];
    for(let r=1;r<16;r++)for(let y=oy-r;y<=oy+r;y++)for(let x=ox-r;x<=ox+r;x++)if((Math.abs(x-ox)===r||Math.abs(y-oy)===r)&&free(x,y))return [x,y];
    return null;
  };
  const clear=(a,b)=>{const n=Math.ceil(distance(a,b)/10);for(let i=0;i<=n;i++)if(contains(a.x+(b.x-a.x)*i/(n||1),a.y+(b.y-a.y)*i/(n||1)))return false;return true;};
  const path=(start,end)=>{
    if(!contains(end.x,end.y)&&clear(start,end))return [{...end}];
    const from=nearest(start),to=nearest(end);if(!from||!to)return [];
    const startIndex=from[1]*cols+from[0],endIndex=to[1]*cols+to[0];
    // A* over the grid with a binary heap (a linear open list made long city
    // routes stall the frame for a noticeable fraction of a second).
    const scores=new Float64Array(cols*rows).fill(Infinity),parents=new Int32Array(cols*rows).fill(-1),closed=new Uint8Array(cols*rows);scores[startIndex]=0;
    const heuristic=i=>Math.hypot(i%cols-to[0],Math.floor(i/cols)-to[1]);let found=false;
    const heap=[],priority=[];
    const push=(index,f)=>{heap.push(index);priority.push(f);let i=heap.length-1;while(i>0){const up=(i-1)>>1;if(priority[up]<=priority[i])break;[heap[up],heap[i]]=[heap[i],heap[up]];[priority[up],priority[i]]=[priority[i],priority[up]];i=up;}};
    const pop=()=>{const top=heap[0],lastIndex=heap.pop(),lastF=priority.pop();if(heap.length){heap[0]=lastIndex;priority[0]=lastF;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<heap.length&&priority[l]<priority[m])m=l;if(r<heap.length&&priority[r]<priority[m])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];[priority[m],priority[i]]=[priority[i],priority[m]];i=m;}}return top;};
    push(startIndex,heuristic(startIndex));
    while(heap.length){const index=pop();if(closed[index])continue;if(index===endIndex){found=true;break;}closed[index]=1;const x=index%cols,y=Math.floor(index/cols);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=x+dx,ny=y+dy,ni=ny*cols+nx;if(!free(nx,ny)||closed[ni]||(dx&&dy&&(!free(x+dx,y)||!free(x,y+dy))))continue;const score=scores[index]+(dx&&dy?1.4142:1);if(score<scores[ni]){scores[ni]=score;parents[ni]=index;push(ni,score+heuristic(ni));}}
    }
    if(!found)return [];
    const result=[];for(let cursor=endIndex;cursor!==startIndex&&cursor!==-1;cursor=parents[cursor])result.push({x:(cursor%cols+.5)*step,y:(Math.floor(cursor/cols)+.5)*step});result.reverse();
    if(!contains(end.x,end.y)&&(!result.length||clear(result.at(-1),end)))result.push({...end});
    const smooth=[];let anchor=start;for(let i=0;i<result.length;){let j=result.length-1;while(j>i&&!clear(anchor,result[j]))j--;smooth.push(result[j]);anchor=result[j];i=j+1;}return smooth;
  };
  return {contains,clear,path,nearest,step};
}

