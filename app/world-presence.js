// Share genuine poses, including stationary players, without overlapping writes.
export function createWorldPresencePublisher({read,send,clock=Date.now,idleMs=15000}) {
  let pending=false,last=null;
  async function publish() {
    const snapshot=read();
    if(!snapshot?.key||!snapshot.pose||pending)return false;
    const {key,pose}=snapshot,now=clock(),before=last?.pose;
    const changed=!last||last.key!==key||!before||pose.moving!==before.moving||
      pose.driving!==before.driving||pose.activity!==before.activity||
      Math.abs((pose.angle||0)-(before.angle||0))>.02||
      Math.hypot(pose.x-before.x,pose.y-before.y)>=1;
    if(!changed&&now-last.at<idleMs)return false;
    pending=true;
    try{await send({...pose});last={key,pose:{...pose},at:clock()};return true;}
    catch{return false;}
    finally{pending=false;}
  }
  return {publish};
}
