/* Adapter between scenario plans and lease cash flows. */
(function(root){
'use strict';
function adapt(model,id){
 if(model?.schemaVersion!==2)throw Error('Version 2 case required');const scenario=model.scenarios.find(s=>s.id===id);
 if(!scenario)throw Error('Unknown scenario');
 const tenancies=model.asset.units.map(u=>{const l=model.asset.leases.find(x=>x.unitId===u.id)||{};return {id:u.id,unit:u.name,occupier:l.tenant||'Vacant',rent:l.passingRent||0,erv:l.erv||0,commencement:l.commencement||'',expiry:l.expiry||'',breakDate:l.breakDates?.[0]||''}});const actionMap={hold:'hold',regear:'regear',rentReview:'review',removeBreak:'removeBreak',relet:'relet',renew:'renew',surrender:'surrender'};const interventions={};model.asset.units.forEach((u,i)=>{interventions[i]=(scenario.unitPlans?.[u.id]?.actions||[]).map(a=>{const type=actionMap[a.type];if(!type)throw Error('Unsupported action '+a.type);const p=a.parameters||{};if(type!=='hold'&&!a.effectiveDate)throw Error('Action date required');const rent=Number(p.rent??0);if(['regear','relet','review','renew'].includes(type)&&p.rent==null)throw Error('Proposed rent required');const fee=rent*Number(p.lettingFeePct??0)/100;const cost=Number(p.cost??0)+Number(p.legalFees??0)+Number(p.refurbCost??0)+fee;if([rent,Number(p.lettingFeePct??0),cost].some(x=>!Number.isFinite(x)||x<0))throw Error('Invalid costs, agency percentage or rent');return {action:type,eventDate:a.effectiveDate,rent,term:p.term??120,free:p.free??0,void:p.void??0,refurb:p.refurbMonths??0,cost}})});const months=Number(scenario.horizonMonths??model.mandate.holdMonths);const exitYield=Number(scenario.exit?.defaultYield);if(!Number.isInteger(months)||months<1)throw Error('Valid hold months required');if(!Number.isFinite(exitYield)||exitYield<=0)throw Error('Exit yield required');return {scenario,asset:model.asset,tenancies,interventions,engineInput:{tenancies,interventions,scenario:id,start:model.asset.valuationDate,months,assetValue:model.asset.openingValue,operatingCost:model.asset.operatingCosts||0,exitYield,saleFee:scenario.exit?.disposalCosts?.saleFee||0,saleLegal:scenario.exit?.disposalCosts?.saleLegal||0}};
}
const api={adapt};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.AssetScenarioAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this);
