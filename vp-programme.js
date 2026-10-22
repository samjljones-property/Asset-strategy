(function(root){'use strict';
function m(d){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d||'')))throw Error('Invalid date: '+d);return Number(d.slice(0,4))*12+Number(d.slice(5,7))-1}
function iso(n){return String(Math.floor(n/12)).padStart(4,'0')+'-'+String(n%12+1).padStart(2,'0')+'-01'}
function positive(v,label){const n=Number(v??0);if(!Number.isFinite(n)||n<0)throw Error('Invalid '+label);return n}
function programme({tenancies=[],possession={},start,overrideDate,worksMonths=0,annualEmptyRates=0,annualIrrecoverableSC=0,annualSecurity=0,annualInsurance=0}){
const first=m(start),works=positive(worksMonths,'works months');if(!Number.isInteger(works))throw Error('Works duration must be whole months');
const units=tenancies.map((t,i)=>{const id=t.id??String(i),choice=possession[id]||possession[i]||{},method=choice.method||'expiry';let date;
if(method==='vacant')date=start;
else if(method==='break')date=t.breakDate;
else if(['surrender','relocation','regear'].includes(method))date=choice.date;
else if(method==='expiry')date=t.expiry;
else throw Error('Unknown possession method: '+method);
if(!date)throw Error('Missing possession date for '+(t.unit||id));
const dateMonth=m(date)+(['expiry','break'].includes(method)?1:0);
if(dateMonth<first)throw Error('Possession before appraisal start for '+(t.unit||id));
return {id,unit:t.unit||String(id),method,possessionMonth:iso(dateMonth),monthIndex:dateMonth};});
const natural=Math.max(first,...units.map(u=>u.monthIndex)),block=overrideDate?m(overrideDate):natural;
if(block<natural)throw Error('Block VP cannot precede possession of every unit');
const annual=positive(annualEmptyRates,'empty rates')+positive(annualIrrecoverableSC,'service charge')+positive(annualSecurity,'security')+positive(annualInsurance,'insurance');
const areas=tenancies.map(t=>positive(t.area,'unit area')),total=areas.reduce((a,b)=>a+b,0);
const details=units.map((u,i)=>{const share=total?areas[i]/total:units.length?1/units.length:0,months=block-u.monthIndex;return {...u,vacantMonths:months,areaShare:share,carryingCost:annual/12*share*months};});
return {calculatedBlockVP:iso(natural),blockVP:iso(block),worksStart:iso(block),worksEnd:iso(block+works),worksMonths:works,units:details,carryingCost:details.reduce((a,u)=>a+u.carryingCost,0),monthlyWholeBuildingCarry:annual/12};}
const api={programme};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.AssetStrategyVP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
