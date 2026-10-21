/* Strategy-first domain model. Pure functions; no DOM, persistence or finance engine dependencies. */
(function(root){
'use strict';
const clone=value=>JSON.parse(JSON.stringify(value));
const uid=(prefix,index)=>prefix+'-'+String(index+1);
function migrateLegacy(data){
 if(!data||typeof data!=='object')throw Error('Invalid case');
 if(data.schemaVersion===2)return clone(data);
 const tenancies=Array.isArray(data.tenancies)?data.tenancies:[];
 const units=tenancies.map((t,i)=>({id:String(t.id??uid('unit',i)),name:t.unit||'Unit '+(i+1),area:Number(t.area)||0}));
 const leases=tenancies.map((t,i)=>({id:uid('lease',i),unitId:units[i].id,tenant:t.occupier||'',passingRent:Number(t.rent)||0,erv:Number(t.erv)||0,commencement:t.commencement||'',expiry:t.expiry||'',breakDates:t.breakDate?[t.breakDate]:[],reviews:t.reviewDate?[t.reviewDate]:[],legacy:clone(t)}));
 const ids=Object.keys(data.options||{});
 const scenarios=ids.map((id,index)=>{
  const opt=data.options[id],plans={};
  for(const [i,unit] of units.entries()){
   const raw=data.interventions?.[id]?.[i]??data.interventions?.[id]?.[unit.id]??[];
   const events=Array.isArray(raw)?raw:raw?[raw]:[];
   const y=data.unitYields?.[id]?.[i]??data.unitYields?.[id]?.[unit.id]??{};
   plans[unit.id]={intent:events.length?'Active management':'Contractual hold',rationale:'',objectiveIds:[],actions:events.map((e,j)=>({id:uid('action',j),type:e.action||'hold',effectiveDate:e.eventDate||e.date||'',parameters:clone(e),evidenceIds:[],dependencies:[],executionRisk:'Unassessed'})),yieldAssumptions:clone(y)};
  }
  return {id,name:opt.name||'Scenario '+(index+1),objective:opt.description||'',status:'Draft',horizonMonths:Number(opt.exitMonths)||null,exit:{method:opt.type==='disposal'?'Disposal':'Whole-asset exit',defaultYield:Number(opt.exitYield)||null,disposalCosts:{saleFee:Number(opt.saleFee)||0,saleLegal:Number(opt.saleLegal)||0},marketShift:Number(data.marketShifts?.[id])||0},unitPlans:plans,sharedAssumptions:{},decision:{commercialCase:'',risks:[],alternatives:[],implementation:[],recommendationStatus:'Not assessed'},legacyOption:clone(opt)};
 });
 return {schemaVersion:2,asset:{id:data.assetId||'',name:data.name||'',valuationDate:data.start||'',openingValue:Number(data.value)||0,units,leases,operatingCosts:Number(data.costs)||0,evidence:[]},mandate:{name:data.fundId||'',style:data.risk||'',objectives:[],hurdle:Number(data.hurdle)||null,holdMonths:Number(data.months)||null,capitalBudget:Number(data.capacity)||0,incomeFloor:null,riskTolerance:'Not assessed',constraints:[],assetThesis:data.strategy||'',exitThesis:''},scenarios,metadata:{sourceVersion:1,legacyCase:clone(data)}};
}
function duplicateScenario(model,id,newId,newName){
 if(model.schemaVersion!==2)throw Error('Expected version 2');
 if(model.scenarios.some(s=>s.id===newId))throw Error('Scenario ID already exists');
 const source=model.scenarios.find(s=>s.id===id);
 if(!source)throw Error('Unknown scenario');
 const next=clone(model),copy=clone(source);copy.id=newId;copy.name=newName||source.name+' — Alternative';copy.status='Draft';copy.decision.recommendationStatus='Not assessed';
 for(const [unitId,plan] of Object.entries(copy.unitPlans))plan.actions.forEach((a,i)=>{a.id=newId+'-'+unitId+'-action-'+(i+1)});
 next.scenarios.push(copy);return next;
}
function assessScenario(model,id){
 const scenario=model.scenarios.find(s=>s.id===id);if(!scenario)throw Error('Unknown scenario');
 const issues=[];
 for(const unit of model.asset.units){
  const plan=scenario.unitPlans[unit.id];if(!plan){issues.push(unit.name+': missing unit plan');continue}
  if(!plan.rationale&&plan.actions.length)issues.push(unit.name+': management rationale required');
  if(plan.actions.length&&!plan.objectiveIds.length)issues.push(unit.name+': actions not linked to mandate objectives');
  if(!plan.yieldAssumptions?.reviewed||!String(plan.yieldAssumptions.rationale||'').trim())issues.push(unit.name+': yield judgement unreviewed');
 }
 if(!model.mandate.objectives.length)issues.push('Investment mandate objectives not defined');
 if(!model.mandate.assetThesis)issues.push('Asset thesis not recorded');
 return {status:issues.length?'Provisional':'Ready for professional review',issues};
}
const api={migrateLegacy,duplicateScenario,assessScenario};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.AssetStrategyDomain=api;
})(typeof globalThis!=='undefined'?globalThis:this);
