/* Adapter between scenario plans and lease cash flows. */
(function(root){
'use strict';
function adapt(model,id){
 const scenario=model.scenarios.find(s=>s.id===id);
 if(!scenario)throw Error('Unknown scenario');
 const tenancies=model.asset.units.map(u=>{const l=model.asset.leases.find(x=>x.unitId===u.id)||{};return {id:u.id,unit:u.name,occupier:l.tenant||'Vacant',rent:l.passingRent||0,erv:l.erv||0,commencement:l.commencement||'',expiry:l.expiry||'',breakDate:l.breakDates?.[0]||''}});return {scenario,asset:model.asset,tenancies};
}
const api={adapt};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.AssetScenarioAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this);
