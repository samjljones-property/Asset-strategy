/* Asset Strategy lease engine v1: pure monthly lease-event calculations.
   All dates are ISO YYYY-MM-DD. No DOM or browser storage dependencies. */
(function(root){
'use strict';
const month=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d||'')))throw Error('Invalid ISO date: '+d);return Number(d.slice(0,4))*12+Number(d.slice(5,7))-1};
const iso=m=>String(Math.floor(m/12)).padStart(4,'0')+'-'+String(m%12+1).padStart(2,'0')+'-01';
const num=(x,label)=>{const n=Number(x??0);if(!Number.isFinite(n)||n<0)throw Error('Invalid '+label);return n};
const isOccupied=t=>!!(t.occupier&&String(t.occupier).toLowerCase()!=='vacant'&&Number(t.rent)>0);
function leaseEvents(tenancy,events=[],start,horizon){
 const first=month(start),length=num(horizon,'horizon');
 if(!Number.isInteger(length)||length>600)throw Error('Invalid horizon');
 const rent=Array(length).fill(0),cost=Array(length).fill(0),vacant=Array(length).fill(1),incentive=Array(length).fill(0),eventLog=[];
 const begin=tenancy.commencement?month(tenancy.commencement):-Infinity;
 const expiry=tenancy.expiry?month(tenancy.expiry):Infinity;
 if(isOccupied(tenancy))for(let i=0;i<length;i++){const m=first+i;if(m>=begin&&m<=expiry){rent[i]=num(tenancy.rent,'passing rent')/12;vacant[i]=0}}
 const sorted=events.slice().sort((a,b)=>month(a.date||a.eventDate||tenancy.expiry||start)-month(b.date||b.eventDate||tenancy.expiry||start));
 for(const e of sorted){
  const kind=e.action;
  if(kind==='hold')continue;
  const reference=kind==='break'?tenancy.breakDate:kind==='review'||kind==='regear'||kind==='surrender'?(e.eventDate||e.date):tenancy.expiry||start;
  if(!reference)throw Error(kind+' requires an event date');
  const base=month(reference)+(kind==='break'||kind==='renew'||(kind==='relet'&&tenancy.expiry)?1:0);
  const works=num(e.refurb,'refurb months'),voidMonths=num(e.void,'void months'),free=num(e.free,'rent-free months'),term=num(e.term??120,'lease term'),newRent=num(e.rent,'new rent'),fee=num(e.cost,'landlord costs');
  const overlap=e.overlap==='concurrent'?Math.max(works,voidMonths):works+voidMonths;
  const leaseStart=e.override&&e.date?month(e.date):base+(kind==='review'||kind==='regear'?0:overlap);
  if(!Number.isInteger(leaseStart)||!Number.isInteger(term)||!Number.isInteger(free))throw Error('Months must be whole numbers');
  const eventStart=kind==='review'||kind==='regear'?leaseStart:kind==='surrender'?month(reference):base;
  if(kind==='break'&&!tenancy.breakDate)throw Error('Break date missing');
  for(let i=0;i<length;i++){
   const m=first+i;
   if(m<eventStart)continue;
   if(kind==='review'){
    if(m<=expiry&&vacant[i]===0)rent[i]=newRent/12;
    continue;
   }
   if(m<leaseStart){rent[i]=0;vacant[i]=1;incentive[i]=0;continue}
   const elapsed=m-leaseStart,active=elapsed<term;
   rent[i]=active&&elapsed>=free?newRent/12:0;
   vacant[i]=active?0:1;
   incentive[i]=active&&elapsed<free?1:0;
  }
  const chargeMonth=kind==='review'?leaseStart:eventStart;
  if(chargeMonth>=first&&chargeMonth<first+length)cost[chargeMonth-first]+=fee;
  eventLog.push({action:kind,eventMonth:iso(base),leaseCommencement:iso(leaseStart),rentCommencement:iso(leaseStart+free),cost:fee});
 }
 return {rent,cost,vacant,incentive,eventLog};
}
function assetCashflow({tenancies,interventions={},scenario,start,months,operatingCost=0,assetValue=0,exitYield,saleFee=0,saleLegal=0}){
 const n=num(months,'hold months'),yieldRate=num(exitYield,'exit yield')/100;
 if(!Number.isInteger(n)||n<1||yieldRate<=0)throw Error('Invalid exit assumptions');
 const lines=tenancies.map((t,i)=>leaseEvents(t,interventions[i]||[],start,n+1));
 const rows=[{month:'Opening',rent:0,cost:0,exit:0,net:-num(assetValue,'asset value')}];
 for(let i=0;i<n;i++){
  const rent=lines.reduce((a,x)=>a+x.rent[i],0),cost=num(operatingCost,'operating cost')/12+lines.reduce((a,x)=>a+x.cost[i],0);
  const exit=i===n-1?(lines.reduce((a,x)=>a+x.rent[n],0)*12/yieldRate*(1-num(saleFee,'sale fee')/100)-num(saleLegal,'sale legal')):0;
  rows.push({month:iso(month(start)+i),rent,cost,exit,net:rent-cost+exit});
 }
 return {rows,lines,metrics:{totalRent:rows.reduce((a,x)=>a+x.rent,0),interventionCosts:lines.reduce((a,x)=>a+x.cost.slice(0,n).reduce((b,c)=>b+c,0),0),vacantUnitMonths:lines.reduce((a,x)=>a+x.vacant.slice(0,n).reduce((b,c)=>b+c,0),0),rentFreeUnitMonths:lines.reduce((a,x)=>a+x.incentive.slice(0,n).reduce((b,c)=>b+c,0),0),exitRent:lines.reduce((a,x)=>a+x.rent[n],0)*12}};
}
const api={leaseEvents,assetCashflow};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.AssetStrategyLeaseEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
