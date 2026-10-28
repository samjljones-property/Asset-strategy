/* Pure financing and equity analytics. Cash flows in GBP, monthly periods.
   rows[0] is opening investment; rows[1..n] are monthly unlevered net flows.
   Debt is interest-only, with bullet repayment in final period.
   No browser dependencies. */
(function(root){
'use strict';
function finite(v,name){const x=Number(v);if(!Number.isFinite(x))throw Error('Invalid '+name);return x;}
function npv(flows,annualRate){const r=finite(annualRate,'discount rate');if(r<=-1)throw Error('Invalid discount rate');return flows.reduce((s,c,i)=>s+c/Math.pow(1+r,i/12),0);}
function irr(flows){if(!flows.some(x=>x<0)||!flows.some(x=>x>0))return null;let low=-0.9999,high=1;const f=r=>npv(flows,r);while(f(high)>0&&high<1e6)high=high*2+1;if(f(low)*f(high)>0)return null;for(let i=0;i<180;i++){const mid=(low+high)/2;if(f(mid)>0)low=mid;else high=mid;}return (low+high)/2;}
function analyse({rows,loan=0,annualInterestRate=0,arrangementFeeRate=0,unleveredHurdle=0.08,equityHurdle=0.12}){
 if(!Array.isArray(rows)||rows.length<2)throw Error('Monthly cash flows required');
 const property=rows.map((r,i)=>finite(r.net,'net cash flow '+i));
 if(property[0]>=0)throw Error('Opening investment must be negative');
 const debt=finite(loan,'loan'),rate=finite(annualInterestRate,'interest rate'),feeRate=finite(arrangementFeeRate,'arrangement fee');
 if(debt<0||rate<0||feeRate<0||debt>-property[0])throw Error('Invalid financing assumptions');
 const interest=debt*rate/12,fee=debt*feeRate;
 const equity=property.map((cf,i)=>i===0?cf+debt-fee:cf-interest-(i===property.length-1?debt:0));
 const annualIncome=rows.slice(1).map(r=>finite(r.rent??0,'rent')-finite(r.cost??0,'cost'));
 const icr=annualIncome.map(v=>interest>0?v/interest:null);
 const exit=finite(rows[rows.length-1].exit??0,'exit proceeds');
 const openingEquity=-equity[0];
 const exitLtv=exit>0?debt/exit:null;
 const equityMultiple=openingEquity>0?equity.slice(1).reduce((a,b)=>a+b,0)/openingEquity:null;
 return {property:{irr:irr(property),npv:npv(property,unleveredHurdle)},equity:{cashflows:equity,initialEquity:openingEquity,irr:irr(equity),npv:npv(equity,equityHurdle),npvToEquity:openingEquity?npv(equity,equityHurdle)/openingEquity:null,multiple:equityMultiple},debt:{openingBalance:debt,monthlyInterest:interest,arrangementFee:fee,bulletRepayment:debt,interestCover:icr,exitLtv,exitRepaymentHeadroom:exit-debt,exitRepaymentCovered:exit>=debt},assumptions:{unleveredHurdle,equityHurdle}};
}
const api={analyse,npv,irr};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.AssetStrategyCapitalEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
