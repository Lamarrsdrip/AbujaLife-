import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInterior} from '../app/world-interiors.js';

function profile({propertyId='guzape-terrace',otherProperty='jabi-apartment'}={}){
  return{
    id:'resident-furnished',district:'guzape',location:{kind:'home',district:'guzape',venue:'home'},
    home:{propertyId,district:'guzape',name:'Guzape terrace',starterVersion:1,furnishingPreset:'nepo-furnished',purchaseFurnishedPropertyId:propertyId},
    inventory:['bed','sofa','dining-table','fridge','tv','wardrobe','coffee-table','floor-lamp'],storedFurniture:[],appearance:{},
    furnitureLayout:{
      bed:{x:.18,y:.22,rotation:0,propertyId},sofa:{x:.48,y:.55,rotation:0,propertyId},'dining-table':{x:.65,y:.38,rotation:0,propertyId},
      fridge:{x:.81,y:.24,rotation:0,propertyId},tv:{x:.54,y:.42,rotation:0,propertyId},wardrobe:{x:.28,y:.2,rotation:0,propertyId},
      'coffee-table':{x:.51,y:.58,rotation:0,propertyId},'floor-lamp':{x:.39,y:.58,rotation:0,propertyId},
      plant:{x:.7,y:.7,rotation:0,propertyId:otherProperty}
    }
  };
}

test('purchased furnished home renders one resident-owned furnishing source, not authored duplicates underneath',()=>{
  const p=profile(),scene=buildInterior({profile:p,id:'purchased-furnished-home'});
  assert.equal(scene.homeFurnishingSource,'resident-owned-property-package');
  assert.match(scene.subtitle,/resident-owned package/i);
  const items=(scene.items||scene.furniturePlacements||[]).filter(item=>item.itemId);
  const rendered=items.map(item=>item.itemId);
  for(const item of ['bed','sofa','dining-table','fridge','tv','wardrobe','coffee-table','floor-lamp'])assert.ok(rendered.filter(id=>id===item).length<=1,`${item} duplicated`);
  assert.equal(rendered.includes('plant'),false,'old-home furniture leaked into current home');
});

test('returning to a property restores the same property-scoped placements without cloning them',()=>{
  const p=profile(),first=buildInterior({profile:p,id:'home-first'}),second=buildInterior({profile:structuredClone(p),id:'home-return'});
  const compact=scene=>(scene.items||scene.furniturePlacements||[]).filter(item=>item.itemId).map(item=>[item.itemId,item.x,item.y,item.rotation||0,item.propertyId||null]).sort((a,b)=>a[0].localeCompare(b[0]));
  assert.deepEqual(compact(second),compact(first));
});
