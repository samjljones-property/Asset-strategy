const assert=require('node:assert/strict');
const lease=require('./lease-engine.js'),vp=require('./vp-programme.js');
const start='2027-01-01',tenancies=[
 {unit:'Floor 1',occupier:'Alpha',area:10000,rent:600000,erv:700000,commencement:'2020-01-01',expiry:'2028-06-30'},
 {unit:'Floor 2',occupier:'Beta',area:10000,rent:480000,erv:550000,commencement:'2020-01-01',expiry:'2029-06-30'}
];
const possession={0:{method:'surrender',date:'2027-10-01'},1:{method:'expiry'}};
const plan=vp.programme({tenancies,possession,start,worksMonths:12,annualEmptyRates:120000});
assert.equal(plan.blockVP,'2029-07-01');
assert.equal(plan.worksEnd,'2030-07-01');
const interventions={0:[{action:'surrender',eventDate:'2027-10-01',rent:0,void:0,free:0,term:120,cost:0}]};
const scenario=lease.assetCashflow({tenancies,interventions,start,months:60,assetValue:20000000,exitYield:6});
const baseline=lease.assetCashflow({tenancies,interventions:{},start,months:60,assetValue:20000000,exitYield:6});
const oct=9;
assert.equal(scenario.lines[0].rent[oct],0,'Surrender stops income');
assert.equal(scenario.lines[0].vacant[oct],1,'Surrender leaves vacant unit');
assert.equal(scenario.lines[1].rent[oct],40000,'Other tenancy rent is unchanged');
assert.equal(baseline.lines[0].rent[oct],50000,'Contractual base remains unchanged');
const block=30,share=.5,monthly=120000/12*share;
let applied=0;
for(let i=0;i<block;i++){for(let j=0;j<plan.units.length;j++){const u=plan.units[j],from=(Number(u.possessionMonth.slice(0,4))-2027)*12+Number(u.possessionMonth.slice(5,7))-1;if(i>=from&&scenario.lines[j].vacant[i]===1&&scenario.lines[j].rent[i]===0){scenario.rows[i+1].cost+=120000/12*u.areaShare;scenario.rows[i+1].net-=120000/12*u.areaShare;applied+=120000/12*u.areaShare}}}
assert.equal(applied,monthly*21,'21 months of early-vacant floor carrying cost');
for(const row of scenario.rows.slice(1))assert.ok(Math.abs(row.net-(row.rent-row.cost+row.exit))<.001,'Monthly cash flow reconciles');
assert.equal(scenario.rows[0].net,-20000000);
assert.ok(scenario.rows.slice(1).reduce((s,r)=>s+r.rent,0)<baseline.rows.slice(1).reduce((s,r)=>s+r.rent,0));

// Independent dated post-works letting check: 1 July 2030, six months rent-free,
// then £720,000 pa, with £36,000 letting costs charged in the letting commencement month.
const reletEvents={0:[...interventions[0],{action:'relet',eventDate:'2030-07-01',date:'2030-07-01',override:true,rent:720000,term:120,free:6,void:0,refurb:0,cost:36000}]};
const relet=lease.assetCashflow({tenancies,interventions:reletEvents,start,months:60,assetValue:20000000,exitYield:6});
assert.equal(relet.lines[0].rent[42],0,'First post-works month is rent free');
assert.equal(relet.lines[0].incentive[42],1,'Incentive flagged in commencement month');
assert.equal(relet.lines[0].rent[48],60000,'New rent starts after six free months');
assert.equal(relet.lines[0].cost[42],36000,'Letting fees charged to dated cash flow');
assert.equal(relet.metrics.exitRent,720000,'Exit income reflects new lease');
for(const row of relet.rows.slice(1))assert.ok(Math.abs(row.net-(row.rent-row.cost+row.exit))<.001,'Reletting cashflow reconciles');
console.log('PASS: staggered possession, surrender rent cessation, contractual baseline isolation, VP costs and monthly reconciliation');
