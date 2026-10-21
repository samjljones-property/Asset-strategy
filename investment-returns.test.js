const assert=require('node:assert/strict');const {npv,irr,analyse}=require('./investment-returns.js');const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,a+' differs from '+b);
near(npv([-100,110],Math.pow(1.1,12)-1),0);
near(irr([-100,110]),Math.pow(1.1,12)-1);
near(irr([-100,0,121]),Math.pow(1.1,6)-1);
near(npv([-100,0,121],Math.pow(1.1,6)-1),0);
assert.equal(irr([-100,-20,-30]),null);
assert.equal(analyse([{net:-100},{net:110}],0).netProfit,10);
assert.throws(()=>npv([1,2],-1),/Invalid discount/);
console.log('Investment returns regression tests passed');