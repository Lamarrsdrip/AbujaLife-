// Local presentation only. The world owns its animation loop and input routing.
import {WORLD_CAMERA,WORLD_ZOOM,clampWorldZoom,normalizeWorldOrientation} from './world-camera.js';

export const WORLD_ORBIT=Object.freeze({dragThreshold:8,yawPerPixel:.006,elevationPerPixel:.0035,
  maxYawVelocity:3.4,maxElevationVelocity:1.5,friction:6.2,easing:14,maxStep:.1});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const angleDelta=(from,to)=>normalizeWorldOrientation({yaw:to-from}).yaw;
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;

/**
 * Direct finger/mouse angles while dragging, then exponential deceleration.
 * All timing comes from the existing world loop; this module creates no RAF,
 * listeners or authoritative player state.
 */
export function createWorldOrbit(initial={}){
  const orientation=normalizeWorldOrientation(initial);
  let yaw=orientation.yaw,elevation=orientation.elevation,zoom=clampWorldZoom(initial.zoom);
  let targetYaw=yaw,targetElevation=elevation,targetZoom=zoom,yawVelocity=0,elevationVelocity=0;
  let dragging=false,easingOrientation=false,changed=true;
  const active=()=>dragging||Math.abs(yawVelocity)>.0001||Math.abs(elevationVelocity)>.0001||
    easingOrientation||Math.abs(targetZoom-zoom)>.0001;
  const state=()=>({...normalizeWorldOrientation({yaw,elevation}),zoom,targetZoom,dragging,active:active(),changed});
  const stopMomentum=()=>{dragging=false;yawVelocity=0;elevationVelocity=0;easingOrientation=false;targetYaw=yaw;targetElevation=elevation;return state();};
  const setOrientation=(next,{immediate=true}={})=>{
    const value=normalizeWorldOrientation({yaw:next?.yaw??yaw,elevation:next?.elevation??elevation});
    stopMomentum();targetYaw=yaw+angleDelta(yaw,value.yaw);targetElevation=value.elevation;
    if(immediate){changed=changed||Math.abs(targetYaw-yaw)>.000001||Math.abs(targetElevation-elevation)>.000001;yaw=targetYaw;elevation=targetElevation;}
    else easingOrientation=Math.abs(targetYaw-yaw)>.000001||Math.abs(targetElevation-elevation)>.000001;
    return state();
  };
  const setZoom=(next,{immediate=false}={})=>{
    targetZoom=clampWorldZoom(next);
    if(immediate){changed=changed||Math.abs(targetZoom-zoom)>.000001;zoom=targetZoom;}
    return state();
  };
  return {
    getState:state,
    drag(dx,dy,seconds=1/60){
      if(!Number.isFinite(dx)||!Number.isFinite(dy))return state();
      const dt=clamp(finite(seconds,1/60),.001,WORLD_ORBIT.maxStep);
      const yawChange=-clamp(dx,-1000,1000)*WORLD_ORBIT.yawPerPixel;
      const nextElevation=clamp(elevation+clamp(dy,-1000,1000)*WORLD_ORBIT.elevationPerPixel,WORLD_CAMERA.minElevation,WORLD_CAMERA.maxElevation);
      const elevationChange=nextElevation-elevation;
      yaw+=yawChange;elevation=nextElevation;targetYaw=yaw;targetElevation=elevation;
      // A bounded recent-motion estimate prevents a single coalesced pointer
      // packet or a rapid direction change from creating an excessive fling.
      yawVelocity=clamp(yawVelocity*.35+yawChange/dt*.65,-WORLD_ORBIT.maxYawVelocity,WORLD_ORBIT.maxYawVelocity);
      elevationVelocity=clamp(elevationVelocity*.35+elevationChange/dt*.65,-WORLD_ORBIT.maxElevationVelocity,WORLD_ORBIT.maxElevationVelocity);
      if(elevation===WORLD_CAMERA.minElevation||elevation===WORLD_CAMERA.maxElevation)elevationVelocity=0;
      dragging=true;easingOrientation=false;changed=changed||Math.abs(yawChange)>.000001||Math.abs(elevationChange)>.000001;
      return state();
    },
    release(){dragging=false;return state();},
    stopMomentum,
    setOrientation,
    setZoom,
    pinch(scale,baseZoom=targetZoom){if(!Number.isFinite(scale)||scale<=0)return state();const base=clampWorldZoom(finite(baseZoom,WORLD_ZOOM.default));return setZoom(clamp(base*scale,WORLD_ZOOM.min,WORLD_ZOOM.max));},
    reset({immediate=true}={}){setOrientation(WORLD_CAMERA,{immediate});setZoom(WORLD_ZOOM.default,{immediate});return state();},
    tick(seconds){
      const dt=clamp(finite(seconds),0,WORLD_ORBIT.maxStep),before={yaw,elevation,zoom},pending=changed;
      if(dt>0){
        if(dragging){
          // Holding a finger still consumes its recent velocity. Releasing a
          // stationary drag consequently leaves the camera stationary.
          const heldDecay=Math.exp(-8*dt);yawVelocity*=heldDecay;elevationVelocity*=heldDecay;
        }else if(easingOrientation){
          const ease=1-Math.exp(-WORLD_ORBIT.easing*dt);yaw+=(targetYaw-yaw)*ease;elevation+=(targetElevation-elevation)*ease;
          if(Math.abs(targetYaw-yaw)<.00001&&Math.abs(targetElevation-elevation)<.00001){yaw=targetYaw;elevation=targetElevation;easingOrientation=false;}
        }else{
          const decay=Math.exp(-WORLD_ORBIT.friction*dt),travel=(1-decay)/WORLD_ORBIT.friction;
          yaw+=yawVelocity*travel;elevation=clamp(elevation+elevationVelocity*travel,WORLD_CAMERA.minElevation,WORLD_CAMERA.maxElevation);
          yawVelocity*=decay;elevationVelocity*=decay;
          if(elevation===WORLD_CAMERA.minElevation||elevation===WORLD_CAMERA.maxElevation)elevationVelocity=0;
          if(Math.abs(yawVelocity)<.0001)yawVelocity=0;if(Math.abs(elevationVelocity)<.0001)elevationVelocity=0;
          targetYaw=yaw;targetElevation=elevation;
        }
        const zoomEase=1-Math.exp(-WORLD_ORBIT.easing*dt);zoom+=(targetZoom-zoom)*zoomEase;
        if(Math.abs(targetZoom-zoom)<.00001)zoom=targetZoom;
      }
      const updated=Math.abs(yaw-before.yaw)>.000001||Math.abs(elevation-before.elevation)>.000001||Math.abs(zoom-before.zoom)>.000001;
      changed=pending||updated;
      const result=state();changed=false;return result;
    }
  };
}
