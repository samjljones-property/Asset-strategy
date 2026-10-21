/* Pure agency fee rules: rates are percentage points, not decimals. */
(function(root){
'use strict';
function agencyFee({transaction,ratePct,annualNewRent,price}){
 if(!['letting','sale','purchase'].includes(transaction))throw Error('Unsupported agency transaction');
 if(!Number.isFinite(ratePct)||ratePct<0)throw Error('Agency rate must be a non-negative percentage');
 const base=transaction==='letting'?annualNewRent:price;
 if(!Number.isFinite(base)||base<0)throw Error('Agency fee base must be non-negative');
 return Math.round(base*ratePct)/100;
}
const api={agencyFee};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.AssetAgencyFees=api;
})(typeof globalThis!=='undefined'?globalThis:this);
