/** Stable audit categories across storage backends; balances always remain virtual game Naira. */
export function economyTransactionType(action,{itemId,activityId}={},catalogue=[]){
  if(action==='purchase')return catalogue.find(item=>item.id===itemId)?.category==='vehicle'?'CAR_PURCHASE':'ITEM_PURCHASE';
  if(action==='venue-action')return /hotel|stay/.test(activityId||'')?'HOTEL_PAYMENT':'ACTIVITY_PAYMENT';
  return ({'starting_balance':'STARTING_MONEY','borrow-loan':'LOAN','repay-loan':'LOAN_REPAYMENT','buy-investment':'PROPERTY_PURCHASE','collect-rent':'BUSINESS_INCOME','sell-investment':'PROPERTY_SALE','complete-shift':'JOB_INCOME','transfer-naira':'TRANSFER','demo-topup':'GAME_TOPUP','verified-payment':'PAYMENT_TOPUP','play-dice':'GAME_DICE','eat':'ACTIVITY_PAYMENT','cinema':'ACTIVITY_PAYMENT','hangout':'ACTIVITY_PAYMENT','exercise':'ACTIVITY_PAYMENT','travel':'TRANSPORT_PAYMENT','return-home':'TRANSPORT_PAYMENT','pay-bills':'HOME_SERVICE_PAYMENT','paint-vehicle':'CAR_UPGRADE','sell-item':'ITEM_SALE'})[action]||'OTHER_GAME_INCOME';
}
