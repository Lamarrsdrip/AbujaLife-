// City Story lives above the virtual phone. When one of its destination buttons
// hands control back to the world, close the phone through its own public UI
// action first so the handset cannot remain rendered over INEC/EFCC/court travel.
if(typeof document!=='undefined'){
  const phoneRoot=document.querySelector('#phone-root');
  document.addEventListener('click',event=>{
    const target=typeof Element!=='undefined'&&event.target instanceof Element?event.target.closest('[data-civic-travel]'):null;
    if(!target)return;
    phoneRoot?.querySelector('[data-ph-action="close"]')?.click();
  },{capture:true});
}
