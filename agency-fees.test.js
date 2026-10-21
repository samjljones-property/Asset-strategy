const assert=require('node:assert/strict');
const {agencyFee}=require('./agency-fees.js');
assert.equal(agencyFee({transaction:'letting',annualNewRent:750000,ratePct:10}),75000);
assert.equal(agencyFee({transaction:'sale',price:30000000,ratePct:1}),300000);
assert.equal(agencyFee({transaction:'purchase',price:30000000,ratePct:0.75}),225000);
assert.equal(agencyFee({transaction:'letting',annualNewRent:750000,ratePct:0}),0);
assert.throws(()=>agencyFee({transaction:'letting',annualNewRent:750000,ratePct:-1}));
assert.throws(()=>agencyFee({transaction:'sale',price:undefined,ratePct:1}));
console.log('Agency fee tests passed');
