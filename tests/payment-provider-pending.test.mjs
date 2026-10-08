import test from 'node:test';
import assert from 'node:assert/strict';
import {MongoPaymentStore} from '../src/server/mongo/paymentStore.mjs';

const reference='/v3/transactions/verify_by_reference?tx_ref=abjl_qa_pending';
function fixture({status=400,message='No transaction was found for this reference',dataStatus='error',data=null}={}) {
  const events=[];
  const payments=new MongoPaymentStore({store:{db:{},economyOperation(){throw new Error('Provider lookup must not mutate money');},clock:()=>1000},admin:{},log:(event,fields)=>events.push({event,...fields}),fetchImpl:async()=>({status,ok:status>=200&&status<300,json:async()=>({status:dataStatus,message,data})})});
  return {payments,events};
}

test('unpaid reference is pending without a provider-failure event or wallet mutation',async()=>{
  for(const status of [400,404]){
    const {payments,events}=fixture({status});
    await assert.rejects(payments.provider(reference,'fixture-key'),error=>error.code==='payment_pending'&&error.status===409);
    assert.deepEqual(events,[]);
  }
});

test('provider authorization and checkout creation failures remain genuine failures',async()=>{
  for(const [path,message] of [[reference,'Invalid authorization key'],['/v3/payments','No transaction was found for this reference']]){
    const {payments,events}=fixture({message});
    await assert.rejects(payments.provider(path,'fixture-key'),error=>error.code==='provider_rejected');
    assert.equal(events[0]?.event,'payment_failure');
  }
});

test('successful provider facts are returned unchanged for independent verification',async()=>{
  const data={id:123,tx_ref:'abjl_qa_pending',amount:2000,currency:'NGN',status:'successful'};
  const {payments,events}=fixture({status:200,dataStatus:'success',data});
  assert.deepEqual(await payments.provider(reference,'fixture-key'),data);
  assert.deepEqual(events,[]);
});

test('pending background reconciliation keeps its durable order and bounded next check',async()=>{
  let claimed=false,saved;const events=[];
  const row={_id:'abjl_qa_pending',txRef:'abjl_qa_pending',createdAt:1,reconcileAttempts:2};
  const collection={findOneAndUpdate:async()=>claimed?null:(claimed=true,row),updateOne:async(_filter,update)=>{saved=update.$set;}};
  const payments=new MongoPaymentStore({store:{db:{collection:()=>collection},economyOperation(){throw new Error('No payment is completed');},clock:()=>1_000_000},admin:{},log:(event,fields)=>events.push({event,...fields})});
  payments.reconciliationOwners=new Map([['ad_orders',{statuses:['pending'],fulfill:async()=>{const error=new Error('No transaction');error.code='payment_pending';const {GameError}=await import('../src/server/errors.mjs');throw new GameError('No transaction',409,'payment_pending');}}]]);
  const result=await payments.reconcilePending();
  assert.equal(result.length,1);assert.equal(result[0].code,'payment_pending');
  assert.equal(saved.lastError,'payment_pending');assert.ok(saved.nextReconcileAt>1_000_000);
  assert.equal(events[0].event,'payment_reconciliation_waiting');
  assert.equal(saved.status,undefined,'pending orders must remain recoverable by later verification/webhook');
});
