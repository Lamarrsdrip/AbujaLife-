import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../app/admin.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
async function fixture(revenue,{inventoryStatus=200}={}){
 const root={innerHTML:'',querySelectorAll:()=>[]},dialog={innerHTML:''},calls=[];
 const payload={ok:inventoryStatus===200,summary:{total:207,occupied:1,reserved:2,available:204},plots:[{id:'plot-01',name:'Safe frontage',zoneId:'map-parcels',format:'ground-billboard',width:320,height:220,tier:'standard',available:false,campaign:{status:'active',title:'Local business <script>',residentId:'owner-123',endAt:1800000000000}}],revenue,...(inventoryStatus===200?{}:{error:'Administrator permission required.'})};
 const context=vm.createContext({Intl,URLSearchParams,addEventListener(){},document:{querySelector:selector=>selector==='#admin-app'?root:dialog},apiFetch:async path=>{calls.push(path);const result=path==='/api/admin/status'?{role:null,bootstrapConfigured:true}:payload;return{ok:path==='/api/admin/status'||inventoryStatus===200,status:path==='/api/admin/status'?200:inventoryStatus,json:async()=>result};}});
 await vm.runInContext(`(async()=>{${source}\nglobalThis.controls={advertising,shell,setAccess:value=>{access=value;}};})()`,context);
 const content={innerHTML:''};
 return{root,content,calls,...context.controls};
}
const revenue={currency:'NGN',basis:'verified-provider-receipts',gross:true,settlementVerified:false,live:{fulfilledNgn:720000,fulfilledPayments:3,paidUnfulfilledNgn:240000,paidUnfulfilledPayments:1},test:{fulfilledNgn:960000,fulfilledPayments:4,paidUnfulfilledNgn:480000,paidUnfulfilledPayments:2},gameNaira:900000000,unpaidCheckoutNgn:600000000};
function card(html,id){return html.match(new RegExp(`<article class="admin-card" data-ad-revenue="${id}">([\\s\\S]*?)</article>`))?.[1];}

test('admin inventory displays verified gross and paid awaiting activation separately for live and test modes',async()=>{
 const f=await fixture(revenue);await f.advertising(f.content);const html=f.content.innerHTML;
 assert.match(card(html,'live-fulfilled'),/Verified live gross receipts[\s\S]*₦720,000[\s\S]*3 fulfilled campaign payments/);
 assert.match(card(html,'live-awaiting'),/Live paid awaiting fulfillment[\s\S]*₦240,000[\s\S]*1 verified payment awaiting activation/);
 assert.match(card(html,'test-fulfilled'),/Test gross receipts[\s\S]*₦960,000[\s\S]*4 fulfilled test payments · no real revenue/);
 assert.match(card(html,'test-awaiting'),/Test paid awaiting fulfillment[\s\S]*₦480,000[\s\S]*2 test payments awaiting activation · no real revenue/);
 assert.match(html,/Merchant settlement is not verified/);
 assert.match(html,/gross receipts; fees and refunds are not deducted/);
 assert.match(html,/Unpaid checkouts and Game Naira are excluded/);
 assert.doesNotMatch(html,/₦900,000,000|₦600,000,000|net cash|net revenue/i);
 assert.match(html,/Safe frontage[\s\S]*320 × 220[\s\S]*Occupied[\s\S]*Local business &lt;script&gt;[\s\S]*owner-123/,'ownership and placement status remain intact and escaped');
 assert.deepEqual(f.calls,['/api/admin/status','/api/admin/ads/inventory'],'the existing inventory request supplies every total');
});

test('missing or incomplete verified revenue is shown as unavailable rather than a fabricated zero',async()=>{
 for(const value of [undefined,{...revenue,live:{fulfilledNgn:720000}},{...revenue,basis:'checkout-amounts'}]){
  const f=await fixture(value);await f.advertising(f.content);
  assert.match(f.content.innerHTML,/Verified revenue totals are unavailable/);
  assert.doesNotMatch(f.content.innerHTML,/data-ad-revenue=|₦0/);
  assert.match(f.content.innerHTML,/Safe frontage[\s\S]*owner-123/);
 }
});

test('advertising navigation retains the payments permission and server denial cannot show financial totals',async()=>{
 const f=await fixture(revenue,{inventoryStatus:403});
 f.setAccess({role:'moderator',permissions:['overview','moderation']});f.shell();
 assert.doesNotMatch(f.root.innerHTML,/data-admin-view="advertising"/);
 f.setAccess({role:'operator',permissions:['overview','payments']});f.shell();
 assert.match(f.root.innerHTML,/data-admin-view="advertising"/);
 await assert.rejects(f.advertising(f.content),/Administrator permission required/);
 assert.equal(f.content.innerHTML,'');
});
