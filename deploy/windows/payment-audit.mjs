import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { configuration, apiEnvironment } from './runtime.mjs';

// Runs on the dedicated VPS. Credentials stay in the process and are never printed.
// Default mode is read/verify only; fulfillment requires an explicit --reconcile.
const config=configuration(process.argv.find(value=>value.startsWith('--root='))?.slice(7));
const current=JSON.parse(fs.readFileSync(path.join(config.state,'current.json'),'utf8'));
const release=path.join(config.releases,current.releaseId),require=createRequire(path.join(release,'package.json'));
const {MongoClient}=require('mongodb'),env=apiEnvironment(config),client=new MongoClient(env.MONGODB_URI);
await client.connect();
try {
  const db=client.db(config.database);
  const {MongoGameStore}=await import(pathToFileURL(path.join(release,'src/server/mongo/gameStore.mjs')));
  const {MongoAdminStore}=await import(pathToFileURL(path.join(release,'src/server/mongo/adminStore.mjs')));
  const {MongoPaymentStore}=await import(pathToFileURL(path.join(release,'src/server/mongo/paymentStore.mjs')));
  const store=new MongoGameStore({client,db}),admin=new MongoAdminStore({store});
  const payments=new MongoPaymentStore({store,admin,configKey:env.ABUJALIFE_CONFIG_KEY});
  for(const mode of ['test','live']) { const saved=await payments.config(mode);console.log(JSON.stringify({mode,configured:Boolean(saved?.secrets.secretKey),webhookConfigured:Boolean(saved?.secrets.webhookSecret),publicOrigin:saved?.publicOrigin || null})); }
  for(const collection of ['payment_orders','ad_orders','jackpot_deposit_orders']) {
    const reference=process.argv.find(value=>value.startsWith('--reference='))?.slice(12);
    const rows=await db.collection(collection).find(reference?{txRef:reference}:{status:{$in:['pending','creating','checkout_failed']}}).sort({createdAt:1}).limit(100).toArray();
    console.log(JSON.stringify({collection,pending:rows.length,revision:current.revision}));
    for(const row of rows) {
      const summary={collection,reference:row.txRef,amount:row.amount,credits:row.credits||null,mode:row.mode,status:row.status,createdAt:row.createdAt};
      try {
        const scope=collection==='ad_orders'?'ad-order:':collection==='jackpot_deposit_orders'?'jackpot-order:':'order:';
        const key=payments.decrypt(row.encryptedSecret,scope+row.txRef).secretKey;
        const response=await fetch('https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref='+encodeURIComponent(row.txRef),{headers:{authorization:`Bearer ${key}`},redirect:'error',signal:AbortSignal.timeout(20000)});
        const result=await response.json();
        if(!response.ok||result.status!=='success'){summary.errorCode='provider_unconfirmed';console.log(JSON.stringify(summary));continue;}
        const data=result.data;
        summary.providerStatus=data?.status;summary.transactionId=String(data?.id||'');
        summary.matches=data?.tx_ref===row.txRef&&data?.currency==='NGN'&&Number(data?.amount)===row.amount;
        summary.receipts=await db.collection(collection==='ad_orders'?'ad_receipts':collection==='jackpot_deposit_orders'?'jackpot_deposit_receipts':'payment_receipts').countDocuments({txRef:row.txRef});
        if(process.argv.includes('--reconcile')&&collection==='payment_orders'&&summary.matches&&data.status==='successful') {
          summary.balanceBefore=(await store.profile(row.residentId)).wallet;
          const proof=await payments.verifiedOrder(summary.transactionId,row.txRef);
          const result=await payments.creditVerified(proof,'provider-reconciliation');
          summary.reconciled=result.payment?.status;summary.replayed=result.replayed;
          summary.balanceAfter=(await store.profile(row.residentId)).wallet;
          summary.receiptsAfter=await db.collection('payment_receipts').countDocuments({txRef:row.txRef});
        }
      } catch(error) {summary.errorCode=error.code||'audit_failed';}
      console.log(JSON.stringify(summary));
    }
  }
} finally {await client.close();}
