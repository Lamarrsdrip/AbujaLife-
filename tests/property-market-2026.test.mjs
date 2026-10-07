import test from 'node:test';
import assert from 'node:assert/strict';
import { properties } from '../src/shared/catalogue.mjs';
import { ABUJA_ATLAS } from '../src/shared/atlas.mjs';
import { INVESTMENT_META, investmentPortfolio, normalizeInvestmentRecords } from '../src/shared/life.mjs';
import { buildInterior } from '../app/world-interiors.js';

const layouts=new Set(['garki-studio','lugbe-flat','gwarinpa-apartment','jabi-apartment','guzape-terrace','maitama-villa']);

test('Abuja property market has a broad unique location and home-type ladder',()=>{
  assert.ok(properties.length>=18&&properties.length<=30,properties.length);
  assert.equal(new Set(properties.map(p=>p.id)).size,properties.length);
  assert.ok(new Set(properties.map(p=>p.district)).size>=18);
  assert.ok(new Set(properties.map(p=>p.type)).size>=9);
  for(const id of ['garki-studio','lugbe-flat','gwarinpa-apartment','jabi-apartment','guzape-terrace','maitama-villa'])assert.ok(properties.some(p=>p.id===id),id);
  for(const district of ['mpape','dawaki','kubwa','lokogoma','gudu','durumi','galadimawa','wuye','utako','wuse-ii-a08','mabushi','jahi','kado','gaduwa','katampe','asokoro','katampe-extension'])assert.ok(properties.some(p=>p.district===district),district);
});

test('every property uses a real atlas district, maintained layout and safe game economy metadata',()=>{
  const districts=new Set(ABUJA_ATLAS.map(row=>row.id));
  for(const p of properties){
    assert.ok(districts.has(p.district),`${p.id} invalid district ${p.district}`);
    assert.ok(layouts.has(p.layoutId),`${p.id} invalid layout ${p.layoutId}`);
    assert.ok(Number.isInteger(p.tier)&&p.tier>=0&&p.tier<=5,p.id);
    assert.ok(Number.isSafeInteger(p.rent)&&p.rent>=0,p.id);
    assert.ok(Number.isSafeInteger(p.buy)&&p.buy>=0,p.id);
    assert.ok(Number.isSafeInteger(p.bills)&&p.bills>=0,p.id);
    assert.equal(p.price,p.buy);
    assert.equal(p.investmentIncome,Math.floor(p.buy*INVESTMENT_META.incomeBasisPoints/10000));
    assert.equal(p.investmentResale,Math.floor(p.buy*INVESTMENT_META.resaleBasisPoints/10000));
    assert.ok(p.name&&p.area&&p.type&&p.description&&p.tierLabel,p.id);
    assert.ok(Number.isInteger(p.bedrooms)&&p.bedrooms>=0,p.id);
    assert.ok(Number.isInteger(p.bathrooms)&&p.bathrooms>=1,p.id);
    assert.ok(Number.isFinite(p.areaM2)&&p.areaM2>=30,p.id);
    assert.ok(Array.isArray(p.features)&&p.features.length>=3,p.id);
    assert.equal(p.viewing?.free,true,p.id);
  }
});

test('all expanded properties resolve through the existing authored home renderer',()=>{
  for(const p of properties){
    const profile={id:`resident-${p.id}`,district:p.district,location:{kind:'home',district:p.district,venue:'home'},home:{propertyId:p.id,layoutId:p.layoutId,district:p.district,name:p.name,tenure:p.rent?'rent':'starter',starterVersion:1,furnishingPreset:p.tier>=1?'nepo-furnished':'lapo-basic'},inventory:[],storedFurniture:[],furnitureLayout:{},appearance:{}};
    const scene=buildInterior({profile,id:`property-${p.id}`});
    assert.ok(scene&&Number.isFinite(scene.width)&&scene.width>0,p.id);
    assert.ok(Number.isFinite(scene.height)&&scene.height>0,p.id);
    assert.ok(typeof scene.art==='string'&&scene.art.length>500,p.id);
    assert.ok(Array.isArray(scene.interactables)&&scene.interactables.length>0,p.id);
    assert.ok(scene.interactables.some(point=>point.action==='leave-home'),`${p.id} must remain playable`);
  }
});

test('investment portfolio counts only valid active non-primary investment records',()=>{
  const [first,second,primary]=['lugbe-flat','gwarinpa-apartment','garki-studio'].map(id=>properties.find(item=>item.id===id));
  const record=(property,boughtAt)=>({propertyId:property.id,boughtAt,lastCollectedAt:boughtAt,purchasePrice:property.buy,incomePerPeriod:property.investmentIncome,resaleValue:property.investmentResale});
  const profile={home:{propertyId:primary.id},ownedProperties:[first.id,second.id,primary.id,'removed-property'],propertyInvestments:{
    [first.id]:record(first,1000),[second.id]:record(second,2000),[primary.id]:record(primary,3000),
    'removed-property':{...record(first,4000),propertyId:'removed-property'},'bad-record':null,
  }};
  const portfolio=investmentPortfolio(profile,properties,2000+INVESTMENT_META.periodMs*3);
  assert.equal(portfolio.count,2);
  assert.equal(portfolio.purchaseValue,first.buy+second.buy);
  assert.equal(portfolio.resaleValue,first.investmentResale+second.investmentResale);
  assert.equal(portfolio.unclaimedRent,(first.investmentIncome+second.investmentIncome)*3);
  assert.deepEqual(Object.keys(normalizeInvestmentRecords(profile,properties)).sort(),[first.id,second.id].sort());
});
