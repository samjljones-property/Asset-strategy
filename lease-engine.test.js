const assert=require('node:assert/strict');
const {leaseEvents,assetCashflow,leaseSecurity,termReversionValue,unitValuations}=require('./lease-engine.js');
const t={unit:'A',occupier:'Tenant',rent:120000,expiry:'2027-12-31',breakDate:'2027-06-30'};
const start='2027-01-01';
const baseline=leaseEvents(t,[],start,36);
assert.equal(baseline.rent[0],10000);assert.equal(baseline.rent[12],0);
const relet=leaseEvents(t,[{action:'relet',refurb:3,void:6,free:6,term:120,rent:240000,cost:20000}],start,36);
assert.equal(relet.eventLog[0].leaseCommencement,'2028-10-01');
assert.equal(relet.eventLog[0].rentCommencement,'2029-04-01');
assert.equal(relet.rent[21],0);assert.equal(relet.rent[27],20000);
assert.equal(relet.cost[12],20000);
const overlap=leaseEvents(t,[{action:'relet',refurb:3,void:6,overlap:'concurrent',free:0,term:120,rent:240000}],start,36);
assert.equal(overlap.eventLog[0].leaseCommencement,'2028-07-01');
const review=leaseEvents(t,[{action:'review',eventDate:'2027-07-01',rent:144000}],start,24);
assert.equal(review.rent[5],10000);assert.equal(review.rent[6],12000);assert.equal(review.rent[12],0);
const broken=leaseEvents(t,[{action:'break',refurb:0,void:3,free:3,term:120,rent:180000}],start,24);
assert.equal(broken.rent[6],0);assert.equal(broken.rent[12],15000);
const app=assetCashflow({tenancies:[t],interventions:{0:[{action:'relet',refurb:3,void:6,free:6,term:120,rent:240000,cost:20000}]},start,months:36,assetValue:2000000,exitYield:6});
assert.equal(app.metrics.interventionCosts,20000);assert.equal(app.metrics.exitRent,240000);
console.log('Lease-engine tests passed');

const successive=leaseEvents(t,[{action:'review',eventDate:'2027-07-01',rent:144000},{action:'relet',refurb:0,void:3,free:2,term:24,rent:180000,cost:12000}],start,48);
assert.equal(successive.rent[6],12000);
assert.equal(successive.rent[12],0);
assert.equal(successive.rent[17],15000);
assert.equal(successive.rent[39],0);
assert.equal(successive.cost[12],12000);
const vacant={unit:'B',occupier:'Vacant',rent:0,erv:100000};
const letting=leaseEvents(vacant,[{action:'relet',refurb:0,void:2,free:1,term:12,rent:120000}],start,24);
assert.equal(letting.rent[0],0);
assert.equal(letting.rent[3],10000);
assert.equal(letting.rent[14],0);
console.log('Additional lease sequencing tests passed');

const secured={unit:'Secure',occupier:'Tenant',rent:120000,erv:150000,expiry:'2035-12-31',breakDate:'2029-12-31'};
const noAction=leaseSecurity(secured,[],'2027-01-01');
const noBreak=leaseSecurity(secured,[{action:'removeBreak',eventDate:'2027-06-01'}],'2027-07-01');
assert.equal(noAction.securedMonths,36);
assert.equal(noBreak.securedMonths,102);
assert.equal(noBreak.breakDate,null);
assert.throws(()=>leaseEvents(secured,[{action:'removeBreak',eventDate:'2027-06-01'},{action:'break',rent:150000,term:120}],start,60));
const valueInputs={tenancy:secured,start:'2027-01-01',exitMonths:12,capRate:6,voidMonths:6,rentFreeMonths:6};
const original=termReversionValue({...valueInputs,events:[]});
const extended=termReversionValue({...valueInputs,events:[{action:'removeBreak',eventDate:'2027-06-01'}]});
assert.ok(Number.isFinite(original.value));
assert.ok(Number.isFinite(extended.value));
assert.notEqual(original.rolloverMonth,extended.rolloverMonth);
const unitModel=unitValuations({tenancies:[secured],interventions:{0:[{action:'removeBreak',eventDate:'2027-06-01'}]},start:'2027-01-01',exitMonths:12,defaultYield:6,unitYields:{0:{baseYield:6,amAdjustment:-0.5,voidMonths:6,rentFreeMonths:6}},globalShift:0.25});
assert.equal(unitModel.units[0].exitYield,5.75);
assert.ok(Math.abs(unitModel.totals.incomeEffect+unitModel.totals.amYieldEffect+unitModel.totals.marketEffect-unitModel.totals.totalEffect)<0.01);
assert.throws(()=>unitValuations({tenancies:[secured],start:'2027-01-01',exitMonths:12,defaultYield:0}));
console.log('Lease security and unit valuation regression tests passed');

const seven=[
 ['Ground Floor','Harbour Coffee Ltd',286000,338000,'2033-05-31','2028-05-31'],
 ['First Floor','Northbridge Consulting LLP',672000,784000,'2032-12-31','2027-12-31'],
 ['Second Floor','Meridian Technology Ltd',702000,810000,'2034-03-31','2029-03-31'],
 ['Third Floor','Westfield Legal Partners',682500,787500,'2031-08-31',null],
 ['Fourth Floor','Atlas Design Studio Ltd',588000,735000,'2035-12-31','2030-12-31'],
 ['Fifth Floor','Orchard Capital Advisors Ltd',707000,808000,'2038-09-30','2028-09-30'],
 ['Sixth Floor','Vacant',0,690000,null,null]
].map((r,i)=>({id:String(i),unit:r[0],occupier:r[1],rent:r[2],erv:r[3],expiry:r[4],breakDate:r[5]}));
assert.equal(seven.reduce((sum,x)=>sum+x.rent,0),3637500);
assert.equal(seven.reduce((sum,x)=>sum+x.erv,0),4952500);
const sevenBaseline=unitValuations({tenancies:seven,start:'2026-11-01',exitMonths:60,defaultYield:6.25});
assert.equal(sevenBaseline.units.length,7);
assert.ok(Math.abs(sevenBaseline.totals.finalValue-sevenBaseline.units.reduce((sum,x)=>sum+x.finalValue,0))<0.01);
assert.ok(sevenBaseline.units[6].finalValue>0,'Vacant unit has ERV reversion value');
assert.ok(sevenBaseline.units[3].finalValue>0,'Expired lease has ERV reversion value');
assert.equal(sevenBaseline.totals.exitIncome,2955000);
assert.ok(Math.abs(sevenBaseline.totals.finalValue-76691812.54694094)<0.01);
const proposed=unitValuations({tenancies:seven,interventions:{1:[{action:'regear',eventDate:'2027-06-01',rent:735000,free:6,term:120,cost:25000}]},start:'2026-11-01',exitMonths:60,defaultYield:6.25,unitYields:{1:{baseYield:6.25,amAdjustment:-0.25}}});
assert.ok(Math.abs(proposed.totals.totalEffect-(proposed.totals.finalValue-proposed.totals.baselineValue))<0.01);
assert.ok(proposed.units[1].finalValue!==sevenBaseline.units[1].finalValue);
assert.equal(proposed.units[0].finalValue,sevenBaseline.units[0].finalValue);
console.log('Seven-unit reference portfolio regression tests passed');

assert.ok(sevenBaseline.units[6].finalValue>10000000);
assert.ok(termReversionValue({tenancy:seven[6],start:'2026-11-01',exitMonths:300,capRate:6.25}).value>10000000);

const expiredAtExit=termReversionValue({tenancy:seven[3],start:'2026-11-01',exitMonths:60,capRate:6.25});
assert.equal(expiredAtExit.rolloverMonth,'2031-11-01');
assert.ok(expiredAtExit.value>0);

const chainedLease={unit:'Sequence',occupier:'Tenant',rent:120000,erv:180000,expiry:'2027-12-31',breakDate:'2027-06-30'};
const chained=leaseEvents(chainedLease,[
 {action:'review',eventDate:'2029-01-01',rent:192000},
 {action:'regear',eventDate:'2027-04-01',rent:144000,term:60,free:2},
 {action:'review',eventDate:'2028-01-01',rent:168000}
],'2027-01-01',72);
assert.equal(chained.rent[0],10000);
assert.equal(chained.rent[3],0);
assert.equal(chained.rent[5],12000);
assert.equal(chained.rent[12],14000);
assert.equal(chained.rent[24],16000);
assert.equal(chained.rent[63],0);
assert.equal(chained.eventLog.map(x=>x.action).join(','),'regear,review,review');
const removedBreak=leaseEvents(chainedLease,[
 {action:'removeBreak',eventDate:'2027-02-01'},
 {action:'regear',eventDate:'2027-04-01',rent:144000,term:60}
],'2027-01-01',24);
assert.equal(removedBreak.eventLog[0].action,'removeBreak');
assert.throws(()=>leaseEvents(chainedLease,[
 {action:'removeBreak',eventDate:'2027-02-01'},
 {action:'break',rent:180000,term:60}
],'2027-01-01',24));
console.log('Chained lease-event chronology tests passed');

const newLettingUnit={unit:'Empty',occupier:'Vacant',rent:0,erv:240000};
const valuationBase=termReversionValue({tenancy:newLettingUnit,start:'2027-01-01',exitMonths:12,capRate:6});
const valuationLet=termReversionValue({tenancy:newLettingUnit,events:[{action:'relet',eventDate:'2027-01-01',refurb:0,void:3,free:6,term:120,rent:240000}],start:'2027-01-01',exitMonths:12,capRate:6});
assert.ok(valuationLet.value>valuationBase.value,'Completed letting should increase value by removing assumed reletting void and incentive');
assert.equal(valuationLet.rolloverMonth,'2037-04-01');
const valuationFuture=termReversionValue({tenancy:newLettingUnit,events:[{action:'relet',eventDate:'2030-01-01',void:3,free:6,term:120,rent:240000}],start:'2027-01-01',exitMonths:12,capRate:6});
assert.equal(valuationFuture.value,valuationBase.value,'Uncommitted future intervention must not affect current exit valuation');
console.log('New letting exit valuation tests passed');
