import fs from 'node:fs';

const edits = new Map();
function change(file, from, to) {
  if (!edits.has(file)) edits.set(file, []);
  edits.get(file).push([from, to]);
}

// The browser preview was still consuming the generated pre-scale catalogue.
// Bind it to the same authoritative playable catalogue as production so buying,
// resale and bootstrap-visible prices cannot drift again.
change('preview/runtime.mjs',
  "import data from './data.mjs';",
  "import data from './data.mjs';\nimport { catalog as authoritativeCatalog } from '../src/shared/catalogue.mjs';");
change('preview/runtime.mjs',
  "const catalog = publicData.catalog || [];",
  "const catalog = authoritativeCatalog;");
change('preview/runtime.mjs',
  "...clone(publicData), walletMeta:{...clone(WALLET_META),transferEnabled:false,topupMode:'preview',demoTopupEnabled:true},",
  "...clone(publicData), catalog:clone(catalog), walletMeta:{...clone(WALLET_META),transferEnabled:false,topupMode:'preview',demoTopupEnabled:true},");

// Economy tests: keep authored base metadata intact, but assert the playable
// catalogue's 10x prices and deliberately fund expensive vehicle coverage.
change('tests/economy.test.mjs',
  "f.store.topup(f.ada,{amount:2000000,idempotencyKey:key()});",
  "f.store.topup(f.ada,{amount:10000000,idempotencyKey:key()});");
change('tests/economy.test.mjs',
  "assert.equal(f.store.profile(f.ada).wallet,start-HOME_UPGRADES.reduce((sum,item)=>sum+item.price,0));",
  "const playableUpgradeCost=HOME_UPGRADES.reduce((sum,item)=>sum+catalog.find(listed=>listed.id===item.id).price,0);assert.equal(f.store.profile(f.ada).wallet,start-playableUpgradeCost);");

// Server-authoritative furniture prices/resale now come from the scaled catalogue.
change('tests/furniture-authority.test.mjs',
  "const bought=f.store.action(f.id,'purchase',payload);assert.equal(bought.profile.wallet,p.wallet-8000);",
  "const coffeePrice=catalog.find(item=>item.id==='coffee-table').price;const bought=f.store.action(f.id,'purchase',payload);assert.equal(bought.profile.wallet,p.wallet-coffeePrice);");
change('tests/furniture-authority.test.mjs',
  "assert.equal(sold.wallet,wallet+4000);",
  "assert.equal(sold.wallet,wallet+Math.floor(catalog.find(item=>item.id==='coffee-table').price/2));");

// UI catalogue test uses the same server catalogue instead of a legacy ₦2,300 stub.
change('tests/furniture-catalogue.test.mjs',
  "state.profile.inventory.push(payload.itemId); state.profile.storedFurniture.push(payload.itemId); state.profile.wallet -= 2300;",
  "state.profile.inventory.push(payload.itemId); state.profile.storedFurniture.push(payload.itemId); state.profile.wallet -= catalog.find(item=>item.id===payload.itemId).price;");
change('tests/furniture-catalogue.test.mjs',
  "assert.equal(f.state.profile.wallet, 97700);",
  "assert.equal(f.state.profile.wallet, 100000-catalog.find(item=>item.id==='plant').price);");
change('tests/furniture-catalogue.test.mjs',
  "assert.equal(f.state.profile.wallet, 109000);",
  "assert.equal(f.state.profile.wallet, 100000+Math.floor(catalog.find(item=>item.id==='sofa').price/2));");

// Core game purchase tests assert the new playable prices directly.
change('tests/game.test.mjs',
  "import { GameStore, jobs } from '../src/server/gameStore.mjs';",
  "import { GameStore, jobs, catalog } from '../src/server/gameStore.mjs';");
change('tests/game.test.mjs',
  "assert.equal(after.wallet,before.wallet-2300);",
  "assert.equal(after.wallet,before.wallet-catalog.find(item=>item.id==='plant').price);");
change('tests/game.test.mjs',
  "assert.equal(bought.wallet,before.wallet-12000);",
  "assert.equal(bought.wallet,before.wallet-catalog.find(item=>item.id==='traditional-set').price);");

// New-origin tests use the requested ₦100m/₦10m starts and scaled furniture.
change('tests/home-start.test.mjs',
  "assert.equal(p.origin.id,originId);assert.equal(p.wallet,nepo?1000000:100000);",
  "assert.equal(p.origin.id,originId);assert.equal(p.wallet,nepo?100000000:10000000);");
change('tests/home-start.test.mjs',
  "assert.equal(bought.wallet,before.wallet-2300);assert.deepEqual(bought.inventory,['plant']);",
  "assert.equal(bought.wallet,before.wallet-catalog.find(item=>item.id==='plant').price);assert.deepEqual(bought.inventory,['plant']);");
change('tests/home-start.test.mjs',
  "assert.equal(f.store.profile(f.id).home.furnishingPreset,'lapo-basic');assert.equal(f.store.profile(f.id).wallet,before.wallet-2300);",
  "assert.equal(f.store.profile(f.id).home.furnishingPreset,'lapo-basic');assert.equal(f.store.profile(f.id).wallet,before.wallet-catalog.find(item=>item.id==='plant').price);");
change('tests/home-start.test.mjs',
  "assert.deepEqual(saved.inventory,[...server.inventory,'plant']);assert.equal(saved.wallet,server.wallet-2300);assert.equal(reloaded.randomCalls,0);",
  "assert.deepEqual(saved.inventory,[...server.inventory,'plant']);assert.equal(saved.wallet,server.wallet-catalog.find(item=>item.id==='plant').price);assert.equal(reloaded.randomCalls,0);");

// HTTP persistence keeps exact new server debit.
change('tests/http.test.mjs',
  "assert.equal(purchase.data.profile.wallet,ada.startingWallet-2300);",
  "assert.equal(purchase.data.profile.wallet,ada.startingWallet-23000);");
change('tests/http.test.mjs',
  "assert.equal(state.data.profile.wallet,ada.startingWallet-2300);",
  "assert.equal(state.data.profile.wallet,ada.startingWallet-23000);");

// Life tests preserve affordability/security intent under the richer starting economy.
change('tests/life.test.mjs',
  "assert.throws(() => store.action(id, 'purchase', { itemId: 'compact-car', price: 0 }), /need more/);",
  "assert.throws(() => store.action(id, 'purchase', { itemId: 'mercedes-g63', price: 0 }), /need more/);");
change('tests/life.test.mjs',
  "assert.equal(bought.wallet, earned.profile.wallet - 28000);",
  "assert.equal(bought.wallet, earned.profile.wallet - catalog.find(item => item.id === 'used-hatchback').price);");
change('tests/life.test.mjs',
  "assert.equal(catalog.find(item => item.id === 'compact-car').price, 240000);",
  "assert.equal(catalog.find(item => item.id === 'compact-car').price, 2400000);");
change('tests/life.test.mjs',
  "assert.equal(f.store.profile(f.id).wallet, starting - 4200);",
  "assert.equal(f.store.profile(f.id).wallet, starting - catalog.find(item => item.id === 'dining-table').price);");

// Chat transfer tests use the new Lapo starting balance, while transfer amount stays ₦1,000.
change('tests/phone-inbox.test.mjs',
  "assert.equal(f.store.profile(f.b).wallet,100000);",
  "assert.equal(f.store.profile(f.b).wallet,10000000);");
change('tests/phone-inbox.test.mjs',
  "assert.equal(f.store.profile(f.b).wallet,101000);",
  "assert.equal(f.store.profile(f.b).wallet,10001000);");
// There are two independent transfer scenarios with the same old expected value.
change('tests/phone-inbox.test.mjs',
  "assert.equal(f.store.profile(f.b).wallet,101000);",
  "assert.equal(f.store.profile(f.b).wallet,10001000);");

// Browser preview mirrors production origin balances and the same 10x item economy.
change('tests/preview-v4.test.mjs',
  "assert.equal(state.profile.wallet, 1e5);",
  "assert.equal(state.profile.wallet, 1e7);");
change('tests/preview-v4.test.mjs',
  "assert.equal(nepo.profile.wallet, 1e6);",
  "assert.equal(nepo.profile.wallet, 1e8);");
change('tests/preview-v4.test.mjs',
  "assert.equal(borrowed.profile.wallet, 2e5);",
  "assert.equal(borrowed.profile.wallet, 101e5);");
change('tests/preview-v4.test.mjs',
  "assert.equal((await reopened.request(\"/api/wallet\")).profile.wallet, 17e4);",
  "assert.equal((await reopened.request(\"/api/wallet\")).profile.wallet, 1007e4);");
change('tests/preview-v4.test.mjs',
  "assert.equal((await f.request(\"/api/wallet\")).profile.wallet, 2501e5);",
  "assert.equal((await f.request(\"/api/wallet\")).profile.wallet, 260e6);");
change('tests/preview-v4.test.mjs',
  "assert.equal(bought.profile.wallet, 23700);",
  "assert.equal(bought.profile.wallet, 3000);");
change('tests/preview-v4.test.mjs',
  "assert.equal(again.profile.wallet, 23700);",
  "assert.equal(again.profile.wallet, 3000);");
change('tests/preview-v4.test.mjs',
  "assert.equal(fresh.profile.wallet, 1e5);",
  "assert.equal(fresh.profile.wallet, 1e7);");

// Resale remains exactly half of the authoritative scaled purchase price.
for (const [from,to] of [
  ['assert.equal(result.sale.amount,1150);','assert.equal(result.sale.amount,11500);'],
  ['assert.equal(result.profile.wallet,before.wallet+1150);','assert.equal(result.profile.wallet,before.wallet+11500);'],
  ['assert.equal(repeated.profile.wallet,before.wallet+1150);','assert.equal(repeated.profile.wallet,before.wallet+11500);'],
  ['assert.equal(f.store.profile(f.id).wallet,before.wallet+1150);','assert.equal(f.store.profile(f.id).wallet,before.wallet+11500);'],
  ['assert.equal(result.sale.amount,6000);','assert.equal(result.sale.amount,60000);'],
  ['assert.equal(result.profile.wallet,before+6000);','assert.equal(result.profile.wallet,before+60000);'],
  ['assert.equal(result.sale.amount,14000);','assert.equal(result.sale.amount,140000);'],
  ["assert.equal(sell(f,'plant','resale_trip_key').sale.amount,1150);","assert.equal(sell(f,'plant','resale_trip_key').sale.amount,11500);"],
  ['retry.wallet-=1150;','retry.wallet-=11500;'],
  ['assert.equal(bought.profile.wallet,before-8000);','assert.equal(bought.profile.wallet,before-80000);'],
  ['assert.equal(result.sale.amount,1150);assert.equal(result.profile.wallet,before+1150);','assert.equal(result.sale.amount,11500);assert.equal(result.profile.wallet,before+11500);'],
  ['assert.equal(replay.profile.wallet,before+1150);','assert.equal(replay.profile.wallet,before+11500);'],
  ["assert.equal(outfit.profile.appearance.top,'forest');assert.equal(outfit.sale.amount,6000);","assert.equal(outfit.profile.appearance.top,'forest');assert.equal(outfit.sale.amount,60000);"],
  ["assert.equal(sold.sale.amount,14000);","assert.equal(sold.sale.amount,140000);"],
]) change('tests/resale.test.mjs',from,to);

let replacements = 0;
for (const [file, rules] of edits) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [from, to] of rules) {
    if (!source.includes(from)) throw new Error(`Expected stale assertion not found in ${file}: ${from}`);
    source = source.replace(from, to);
    replacements++;
  }
  fs.writeFileSync(file, source);
}
console.log(`Rebased ${replacements} economy/runtime assumptions across ${edits.size} files.`);
