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
 if(!Number.isInteger(length)||length>1200)throw Error('Invalid horizon');
 const rent=Array(length).fill(0),cost=Array(length).fill(0),vacant=Array(length).fill(1),incentive=Array(length).fill(0),eventLog=[];
 const begin=tenancy.commencement?month(tenancy.commencement):-Infinity;
 const expiry=tenancy.expiry?month(tenancy.expiry):Infinity;
 if(isOccupied(tenancy))for(let i=0;i<length;i++){const m=first+i;if(m>=begin&&m<=expiry){rent[i]=num(tenancy.rent,'passing rent')/12;vacant[i]=0}}
 const effectiveDate=e=>e.action==='break'?tenancy.breakDate||e.eventDate||e.date:e.action==='review'||e.action==='regear'||e.action==='surrender'||e.action==='removeBreak'?e.eventDate||e.date:e.eventDate||e.date||tenancy.expiry||start;
 const sorted=events.slice().sort((a,b)=>month(effectiveDate(a)||start)-month(effectiveDate(b)||start));
 let currentExpiry=expiry;
 let currentBreak=tenancy.breakDate?month(tenancy.breakDate):null;
 let currentCommencement=begin;
 for(const e of sorted){
  const kind=e.action;
  if(kind==='hold')continue;
  if(kind==='removeBreak'){if(currentBreak===null)throw Error('No contractual break to remove');const removed=iso(currentBreak);currentBreak=null;eventLog.push({action:kind,eventMonth:iso(month(e.eventDate||e.date||start)),removedBreak:removed});continue;}
  const reference=kind==='break'?(currentBreak===null?null:iso(currentBreak)):kind==='review'||kind==='regear'||kind==='surrender'?(e.eventDate||e.date):e.eventDate||e.date||(Number.isFinite(currentExpiry)?iso(currentExpiry):start);
  if(!reference)throw Error(kind+' requires an event date');
  if(kind==='break'&&currentBreak===null)throw Error('Cannot exercise a break without a current contractual break');
  const base=month(reference)+(kind==='break'||kind==='renew'||(kind==='relet'&&Number.isFinite(currentExpiry))?1:0);
  const works=num(e.refurb,'refurb months'),voidMonths=num(e.void,'void months'),free=num(e.free,'rent-free months'),term=num(e.term??120,'lease term'),newRent=num(e.rent,'new rent'),fee=num(e.cost,'landlord costs');
  const overlap=e.overlap==='concurrent'?Math.max(works,voidMonths):works+voidMonths;
  const leaseStart=e.override&&e.date?month(e.date):base+(kind==='review'||kind==='regear'?0:overlap);
  if(!Number.isInteger(leaseStart)||!Number.isInteger(term)||!Number.isInteger(free))throw Error('Months must be whole numbers');
  const eventStart=kind==='review'||kind==='regear'?leaseStart:kind==='surrender'?month(reference):base;
  if(kind==='break'&&currentBreak===null)throw Error('Break date missing');
  for(let i=0;i<length;i++){
   const m=first+i;
   if(m<eventStart)continue;
   if(kind==='review'){
    if(m<=currentExpiry&&vacant[i]===0)rent[i]=newRent/12;
    continue;
   }
   if(m<leaseStart){rent[i]=0;vacant[i]=1;incentive[i]=0;continue}
   const elapsed=m-leaseStart,active=elapsed<term;
   rent[i]=active&&elapsed>=free?newRent/12:0;
   vacant[i]=active?0:1;
   incentive[i]=active&&elapsed<free?1:0;
  }
  if(kind!=='review'){currentExpiry=kind==='surrender'?eventStart-1:leaseStart+term-1;currentCommencement=leaseStart;currentBreak=e.newBreakDate?month(e.newBreakDate):null;}
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
/* Unit yields, lease-sensitive term and reversion and attributable value effects. */
/* Monthly term-and-reversion DCF at the unit's capitalisation yield.
   ERV is a current annual market-rent assumption, with explicit reletting
   downtime, incentives and costs. No speculative rental growth is assumed. */
function termReversionValue({tenancy,events=[],start,exitMonths,capRate,erv,voidMonths=6,rentFreeMonths=6,relettingCost=0,valuationYears=30}){
 const n=num(exitMonths,'exit months'),years=num(valuationYears,'valuation years');
 if(!Number.isInteger(n)||!Number.isInteger(years)||years<1||years>50)throw Error('Invalid valuation horizon');
 const rate=Number(capRate)/100;if(!Number.isFinite(rate)||rate<=0||rate>=1)throw Error('Invalid valuation yield');
 const marketRent=num(erv??tenancy.erv,'ERV'),voidPeriod=num(voidMonths,'reletting void'),free=num(rentFreeMonths,'reletting rent free'),cost=num(relettingCost,'reletting costs');
 if(!Number.isInteger(voidPeriod)||!Number.isInteger(free))throw Error('Void and rent-free months must be integers');
 const length=n+years*12+1,first=month(start),exitMonth=first+n;
 const committed=events.filter(e=>{const effective=e.action==='break'?tenancy.breakDate||e.eventDate||e.date:e.eventDate||e.date||tenancy.expiry||start;return effective&&month(effective)<=exitMonth});
 const actual=leaseEvents(tenancy,committed,start,length);
 const security=leaseSecurity(tenancy,committed,iso(exitMonth));
 const leases=actual.eventLog.filter(e=>!['review','removeBreak'].includes(e.action));
 const latest=leases.length?leases[leases.length-1]:null;
 const latestEvent=committed.filter(e=>!['hold','review','removeBreak'].includes(e.action)).at(-1);
 const plannedExpiry=latest&&latestEvent?month(latest.leaseCommencement)+num(latestEvent.term??120,'lease term')-1:null;
 const end=plannedExpiry!==null?plannedExpiry:security.expiry?month(security.expiry):isOccupied(tenancy)?exitMonth+years*12:exitMonth-1;
 const breakAt=security.breakDate?month(security.breakDate):Infinity;
 const rollover=Math.max(exitMonth,Math.min(end,breakAt)+1);
 const committedLetting=latest&&month(latest.leaseCommencement)>=exitMonth&&plannedExpiry!==null;

 const discount=Math.pow(1+rate,1/12)-1;
 let pv=0,termValue=0,reversionValue=0,landlordCosts=0;
 for(let k=0;k<years*12;k++){
  const idx=n+k,m=first+idx,monthsFromRollover=m-rollover;
  const withinLease=m<rollover&&actual.vacant[idx]===0;
  let monthly=0;
  if(withinLease)monthly=actual.rent[idx];
  else if(committedLetting&&m<rollover){monthly=0}
  else if(monthsFromRollover>=0){
   if(monthsFromRollover===voidPeriod){monthly-=cost;landlordCosts+=cost/Math.pow(1+discount,k+1)}
   if(monthsFromRollover>=voidPeriod+free)monthly+=marketRent/12;
  }
  const present=monthly/Math.pow(1+discount,k+1);pv+=present;
  if(withinLease)termValue+=present;else reversionValue+=present;
 }
 /* Terminal perpetuity at the end of the explicit projection, assuming
    stabilised ERV and no further void or capital costs. */
 const terminal=marketRent/12/discount/Math.pow(1+discount,years*12);
 return {value:pv+terminal,termValue,reversionValue,terminalValue:terminal,landlordCosts,rolloverMonth:iso(rollover),securedMonths:security.securedMonths,method:'Monthly term and reversion DCF',assumptions:{erv:marketRent,voidMonths:voidPeriod,rentFreeMonths:free,relettingCost:cost,valuationYears:years,capRate}};
}
function unitValuations({tenancies,interventions={},start,exitMonths,unitYields={},globalShift=0,defaultYield}){
 const n=num(exitMonths,'exit months');
 if(!Number.isInteger(n)||n<1||n>600)throw Error('Invalid exit months');
 const shift=Number(globalShift);
 if(!Number.isFinite(shift))throw Error('Invalid global yield shift');
 const units=tenancies.map((t,i)=>{
  const assumptions=unitYields[t.id]||unitYields[i]||{};
  const base=Number(assumptions.baseYield??defaultYield);
  const adjustment=Number(assumptions.amAdjustment??0);
  const applied=base+adjustment+shift;
  if(!Number.isFinite(applied)||applied<=0||applied>100)throw Error('Invalid capitalisation yield for unit '+(t.unit||i));
  const line=leaseEvents(t,interventions[i]||[],start,n+1);
  const baseline=leaseEvents(t,[],start,n+1);
  const exitIncome=line.rent[n]*12,baselineIncome=baseline.rent[n]*12;
  const model=(withEvents,capRate)=>termReversionValue({tenancy:t,events:withEvents,start,exitMonths:n,capRate,erv:assumptions.erv??t.erv??t.rent,voidMonths:assumptions.voidMonths??6,rentFreeMonths:assumptions.rentFreeMonths??6,relettingCost:assumptions.relettingCost??0});
  const baselineValue=model([],base).value;
  const incomeOnlyValue=model(interventions[i]||[],base).value;
  const amValue=model(interventions[i]||[],base+adjustment).value;
  const finalValue=model(interventions[i]||[],applied).value;
  if(base+adjustment<=0)throw Error('Invalid AM yield for unit '+(t.unit||i));
  return {unitId:t.id??String(i),unit:t.unit||'Unit '+(i+1),baseYield:base,amAdjustment:adjustment,globalShift:shift,exitYield:applied,baselineIncome,exitIncome,baselineValue,incomeOnlyValue,amValue,finalValue,incomeEffect:incomeOnlyValue-baselineValue,amYieldEffect:amValue-incomeOnlyValue,marketEffect:finalValue-amValue,totalEffect:finalValue-baselineValue};
 });
 const total=key=>units.reduce((sum,u)=>sum+u[key],0);
 return {units,totals:{baselineValue:total('baselineValue'),incomeOnlyValue:total('incomeOnlyValue'),amValue:total('amValue'),finalValue:total('finalValue'),incomeEffect:total('incomeEffect'),amYieldEffect:total('amYieldEffect'),marketEffect:total('marketEffect'),totalEffect:total('totalEffect'),exitIncome:total('exitIncome')}};
}
/* Lease security is assessed independently of assumed cash-flow occupancy.
   An unexercised break remains a legal option unless explicitly removed. */
function leaseSecurity(tenancy,events=[],asOf){
 const date=month(asOf),expiry=tenancy.expiry?month(tenancy.expiry):null;
 let contractualExpiry=expiry,breakDate=tenancy.breakDate?month(tenancy.breakDate):null;
 const ordered=events.filter(e=>e.action==='removeBreak'||e.action==='regear'||e.action==='renew').slice().sort((a,b)=>month(a.eventDate||a.date||asOf)-month(b.eventDate||b.date||asOf));
 for(const e of ordered){const effective=month(e.eventDate||e.date||asOf);if(effective>date)continue;
 if(e.action==='removeBreak')breakDate=null;
 if(e.action==='regear'||e.action==='renew'){const term=num(e.term??120,'lease term');if(!Number.isInteger(term)||term<1)throw Error('Invalid lease term');contractualExpiry=effective+term-1;breakDate=e.newBreakDate?month(e.newBreakDate):null;}
 }
 const securedTo=breakDate!==null&&contractualExpiry!==null?Math.min(breakDate,contractualExpiry):breakDate??contractualExpiry;
 return {expiry:contractualExpiry===null?null:iso(contractualExpiry),breakDate:breakDate===null?null:iso(breakDate),securedMonths:securedTo===null?null:Math.max(0,securedTo-date+1)};
}
const api={leaseEvents,assetCashflow,unitValuations,leaseSecurity,termReversionValue};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.AssetStrategyLeaseEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
