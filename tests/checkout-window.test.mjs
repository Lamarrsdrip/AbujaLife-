import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../app/checkout-window.js',import.meta.url),'utf8');
function browser(){
  const assigned=[],opened=[],nativeResult={native:true};
  const window={location:{assign:url=>assigned.push(url)},open(...args){opened.push(args);return nativeResult;}};
  runInNewContext(source,{window});
  return {window,assigned,opened,nativeResult};
}
test('Safari checkout pre-open hands an HTTPS checkout URL to the current tab',()=>{
  const {window,assigned,opened}=browser();
  const handoff=window.open('about:blank','_blank');
  assert.equal(handoff.opener,null);assert.equal(handoff.closed,false);
  handoff.location.replace('https://checkout.flutterwave.com/v3/hosted/example');
  assert.deepEqual(assigned,['https://checkout.flutterwave.com/v3/hosted/example']);
  assert.deepEqual(opened,[]);
});
test('failed or cancelled checkout cannot redirect and unsafe URLs are refused',()=>{
  const {window,assigned}=browser();
  const handoff=window.open('about:blank','_blank');
  for(const url of ['javascript:alert(1)','data:text/html,hello','http://checkout.example','//checkout.example',null])handoff.location.replace(url);
  assert.deepEqual(assigned,[]);
  handoff.close();assert.equal(handoff.closed,true);
  handoff.location.replace('https://checkout.flutterwave.com/v3/hosted/example');
  assert.deepEqual(assigned,[]);
});
test('advertiser links and named OAuth windows keep native click behavior',()=>{
  const {window,opened,nativeResult}=browser();
  assert.equal(window.open('https://okrika.store/','_blank','noopener,noreferrer'),nativeResult);
  assert.equal(window.open('https://auth.example/','abujalife-x-oauth','popup,width=560'),nativeResult);
  assert.deepEqual(opened,[['https://okrika.store/','_blank','noopener,noreferrer'],['https://auth.example/','abujalife-x-oauth','popup,width=560']]);
});
