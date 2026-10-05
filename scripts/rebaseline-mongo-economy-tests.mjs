import fs from 'node:fs';

const edits=new Map();
function change(file,from,to){if(!edits.has(file))edits.set(file,[]);edits.get(file).push([from,to]);}

// Mongo core: same invariants, new Lapo/Nepo starting balances.
for(const [from,to] of [
  ['assert.equal(p.wallet,100000);','assert.equal(p.wallet,10000000);'],
  ['assert.equal((await other.profile(p.id)).wallet,100000);','assert.equal((await other.profile(p.id)).wallet,10000000);'],
  ['assert.equal(n.wallet,1000000);','assert.equal(n.wallet,100000000);'],
  ['assert.equal(preserved.wallet,100000);','assert.equal(preserved.wallet,10000000);'],
  ['assert.equal((await f.store.profile(id)).wallet,95000);','assert.equal((await f.store.profile(id)).wallet,9995000);'],
  ['assert.equal((await f.store.profile(f.bello.residentId)).wallet,105000);','assert.equal((await f.store.profile(f.bello.residentId)).wallet,10005000);'],
  ['amount:60000,idempotencyKey:key()','amount:6000000,idempotencyKey:key()'],
  ['assert.equal((await f.store.profile(id)).wallet,40000);','assert.equal((await f.store.profile(id)).wallet,4000000);'],
  ['assert.equal((await f.store.profile(target)).wallet,160000);','assert.equal((await f.store.profile(target)).wallet,16000000);'],
  ['assert.equal(ledger.reduce((sum,row)=>sum+row.amount,0),200000);','assert.equal(ledger.reduce((sum,row)=>sum+row.amount,0),20000000);'],
  ['amount:40001,idempotencyKey:key()','amount:4000001,idempotencyKey:key()'],
  ['assert.equal(results[0].profile.wallet,100000-item.price);','assert.equal(results[0].profile.wallet,10000000-item.price);'],
  ['assert.equal(p.wallet,100000-item.price-car.price);','assert.equal(p.wallet,10000000-item.price-car.price);'],
  ['assert.equal(investment.profile.wallet,1000000-property.buy);','assert.equal(investment.profile.wallet,100000000-property.buy);'],
  ['assert.equal(won.profile.wallet,100500);','assert.equal(won.profile.wallet,10000500);'],
  ['assert.equal(lost.profile.wallet,100000);','assert.equal(lost.profile.wallet,10000000);'],
  ['assert.equal(replay.profile.wallet,100000);','assert.equal(replay.profile.wallet,10000000);'],
  ['assert.equal((await f.store.profile(sender)).wallet,97500);','assert.equal((await f.store.profile(sender)).wallet,9997500);'],
  ['assert.equal((await f.store.profile(target)).wallet,102500);','assert.equal((await f.store.profile(target)).wallet,10002500);'],
  ['assert.equal((await f.store.profile(sender)).wallet,98300);','assert.equal((await f.store.profile(sender)).wallet,9998300);'],
  ['assert.equal((await f.store.profile(target)).wallet,101700);','assert.equal((await f.store.profile(target)).wallet,10001700);'],
]) change('tests/mongo-core.integration.mjs',from,to);

// Mongo furniture: 10x authoritative item price while retaining idempotency,
// immutable ledger, geometry and resale assertions.
for(const [from,to] of [
  ['result.profile.wallet===92000','result.profile.wallet===9920000'],
  ["amount:-8000}),1","amount:-80000}),1"],
  ['assert.equal(replay.profile.wallet,92000);','assert.equal(replay.profile.wallet,9920000);'],
  ['assert.equal((await f.store.profile(f.guestId)).wallet,100000);','assert.equal((await f.store.profile(f.guestId)).wallet,10000000);'],
  ['assert.equal(sold.profile.wallet,before.wallet+4000);','assert.equal(sold.profile.wallet,before.wallet+40000);'],
  ["amount:4000}),1","amount:40000}),1"],
]) change('tests/mongo-furniture.integration.mjs',from,to);

// Mongo social transfer: preserve the exact transfer delta and make the
// insufficient-funds probe genuinely unaffordable at the new Lapo balance.
for(const [from,to] of [
  ['assert.equal((await f.game.profile(sender)).wallet,99500);','assert.equal((await f.game.profile(sender)).wallet,9999500);'],
  ['assert.equal((await f.game.profile(recipient)).wallet,100500);','assert.equal((await f.game.profile(recipient)).wallet,10000500);'],
  ['amount:1000000,idempotencyKey:key()','amount:10000000,idempotencyKey:key()'],
]) change('tests/mongo-social.integration.mjs',from,to);

// Disposable production API must assert the same 10x server-authoritative item
// price as every other runtime. The old expectation still assumed a ₦2,300 plant.
change('tests/production-integration.mjs',
  "assert.equal(action.data.profile.wallet,before.wallet-2300);",
  "assert.equal(action.data.profile.wallet,before.wallet-23000);");

let replacements=0;
for(const [file,rules] of edits){
  let source=fs.readFileSync(file,'utf8');
  for(const [from,to] of rules){
    if(!source.includes(from))throw new Error(`Expected stale Mongo assertion not found in ${file}: ${from}`);
    source=source.replace(from,to);replacements++;
  }
  fs.writeFileSync(file,source);
}
console.log(`Rebased ${replacements} Mongo/production economy assertions across ${edits.size} integration files.`);
