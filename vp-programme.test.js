const assert=require('node:assert/strict');const {programme}=require('./vp-programme.js');
const base={start:'2026-01-01',tenancies:[{id:'a',unit:'A',area:100,expiry:'2027-06-30'},{id:'b',unit:'B',area:200,expiry:'2028-06-30'}],worksMonths:12,annualEmptyRates:36000};
const p=programme(base);assert.equal(p.blockVP,'2028-07-01');assert.equal(p.worksEnd,'2029-07-01');assert.equal(p.units[0].vacantMonths,12);assert.equal(p.carryingCost,12000);
const q=programme({...base,possession:{b:{method:'surrender',date:'2027-10-01'}}});assert.equal(q.blockVP,'2027-10-01');
assert.throws(()=>programme({...base,overrideDate:'2027-01-01'}));console.log('VP programme tests passed');
