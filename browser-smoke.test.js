const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=__dirname;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const name=pathname==='/'?'index.html':pathname.slice(1);const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(err,buf)=>{if(err){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(buf)})});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#globalstatus').count(),1);
  assert.ok(!(await page.locator('#globalstatus').innerText()).includes('Calculation error'),'Application startup failed');
  const singleLet=await page.evaluate(()=>{const id=Object.keys(state.options)[0],o=state.options[id],old={mode:o.exitValueMode,value:o.manualExitValue,rationale:o.exitValueRationale};const was=state.tenancies;state.tenancies=[];o.exitValueMode='manual';o.manualExitValue=42000000;o.exitValueRationale='Illustrative sale evidence';const result=calc(id),last=result.flows.at(-1),expected=42000000*(1-(Number(o.saleFee)||0)/100)-(Number(o.saleLegal)||0);o.exitValueMode=old.mode;o.manualExitValue=old.value;o.exitValueRationale=old.rationale;state.tenancies=was;return {gross:result.gross,terminal:last.exit,expected}});
  assert.equal(singleLet.gross,42000000,'Single-let appraisal must honour manual exit value');
  assert.ok(Math.abs(singleLet.terminal-singleLet.expected)<0.01,'Single-let terminal cash flow must reconcile');
  for(const tab of ['tenancies','property','overview','sensitivities','cashflows']){
   await page.locator('.tab[data-tab="'+tab+'"]').click();
   assert.ok(await page.locator('#'+tab).evaluate(el=>el.classList.contains('active')),'Navigation failed: '+tab);
  }
  await page.locator('.tab[data-tab="dashboard"]').click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('details.workspace-details summary').click();
  await page.locator('#loaddemo').click();

  await page.waitForFunction(()=>document.querySelector('#dash-asset')?.textContent?.includes('Seven-unit'));
  const csvRoundTrip=await page.evaluate(()=>{const before=JSON.stringify(state.tenancies),csv=[['unit','occupier','area','rent','erv','commencement','expiry','breakDate','reviewDate'].join(','),'Test Suite,Example Occupier,1000,50000,60000,2026-01-01,2031-01-01,,'].join('\n');const n=importTenancyCSV(csv);const imported=state.tenancies.at(-1);state.tenancies=JSON.parse(before);buildForms();render();return {count:n,unit:imported?.unit,occupier:imported?.occupier,rent:imported?.rent,restored:JSON.stringify(state.tenancies)===before}});
  assert.equal(csvRoundTrip.count,1,'CSV import must load one row');
  assert.equal(csvRoundTrip.unit,'Test Suite');
  assert.equal(csvRoundTrip.occupier,'Example Occupier');
  assert.equal(Number(csvRoundTrip.rent),50000);
  assert.ok(csvRoundTrip.restored,'CSV test must restore the demonstration tenancy register');
  const three=await page.evaluate(()=>{const ids=Object.keys(state.options),data=ids.map(id=>{const c=calc(id),model=engineModel(id);return {id,name:state.options[id].name,irr:c.irr,npv:c.npv,exit:c.gross,monthly:c.flows.length,terminal:c.flows.at(-1).exit,actions:Object.values(state.interventions[id]||{}).flat().length,engineExit:model.rows.at(-1).exit}});return {tenancies:state.tenancies.length,ids,data}});
  assert.equal(three.tenancies,7,'Demo must contain seven tenancies');
  assert.equal(three.data.length,3,'Demo must provide three independently comparable strategies');
  assert.ok(three.data.every(x=>x.monthly===61),'Every 60-month scenario must produce opening plus 60 monthly cash flows');
  assert.ok(three.data.every(x=>Number.isFinite(x.npv)&&Number.isFinite(x.exit)),'All demonstration scenarios must return finite valuations');
  assert.ok(three.data.every(x=>Math.abs(x.terminal-x.engineExit)<0.01),'Scenario cash flows must match engine terminal values');
  assert.ok(three.data.some(x=>x.actions>0),'Demonstration must include asset-management interventions');
  assert.ok(new Set(three.data.map(x=>Math.round(x.npv))).size>1,'Independent strategies must produce distinguishable appraisals');
  await page.locator('.tab[data-tab="overview"]').click();
  assert.equal(await page.locator('#ic-summary').count(),1,'Investment committee summary missing');
  await page.locator('.tab[data-tab="options"]').click();
  assert.ok((await page.locator('#options .section-intro h2').innerText()).includes('Scenarios'));
  await page.locator('#scenario-advanced > summary').click();
  assert.equal(await page.locator('[data-exit-mode]').count(),Object.keys(await page.evaluate(()=>state.options)).length,'Every scenario needs an exit valuation selector');
  const first=page.locator('[data-exit-mode]').first();await first.selectOption('manual');
  await page.locator('[data-exit-value]').first().fill('80000000');
  assert.ok((await page.evaluate(()=>validate())).some(x=>x.includes('manual exit value')),'Manual override without rationale must fail validation');
  await page.locator('[data-exit-rationale]').first().fill('Indicative buyer proposal, subject to due diligence');
  const check=await page.evaluate(()=>{const id=Object.keys(state.options)[0];return {mode:state.options[id].exitValueMode,value:state.options[id].manualExitValue,rationale:state.options[id].exitValueRationale,errors:validate()}});
  assert.equal(check.mode,'manual');assert.equal(check.value,80000000);assert.ok(check.rationale.includes('buyer proposal'));
  assert.ok(!check.errors.some(x=>x.includes('manual exit value')),'Valid override should pass input checks');
  const reconciled=await page.evaluate(()=>{const id=Object.keys(state.options)[0],o=state.options[id],m=engineModel(id),c=calc(id),terminal=c.flows.at(-1),aggregate=m.exitReconciliation.aggregate;return {gross:c.gross,selected:m.exitReconciliation.selected,manual:m.exitReconciliation.manual,aggregate,terminal:terminal.exit,expectedNet:80000000*(1-(Number(o.saleFee)||0)/100)-(Number(o.saleLegal)||0),report:document.querySelector('#ic-summary')?.textContent||'',npv:c.npv}});
  assert.equal(reconciled.gross,80000000,'Reported gross exit must match override');
  assert.equal(reconciled.selected,80000000,'Engine must use selected manual value');
  assert.equal(reconciled.manual,true);
  assert.ok(Math.abs(reconciled.terminal-reconciled.expectedNet)<0.01,'Cash flow exit must reconcile after disposal costs');
  assert.ok(reconciled.report.includes('Exit valuation reconciliation'),'Committee report must disclose exit valuation basis');
  assert.ok(reconciled.report.includes('Indicative buyer proposal'),'Committee report must disclose override rationale');
  await first.selectOption('aggregate');

  const before=await page.locator('[data-strategy-card]').count();
  await page.locator('[data-duplicate]').first().click();
  assert.equal(await page.locator('[data-strategy-card]').count(),before+1,'Scenario duplication failed');
  const isolation=await page.evaluate(()=>{const ids=Object.keys(state.options);const source=ids[0],copy=ids[ids.length-1];const original=JSON.stringify(state.interventions?.[source]||{});state.interventions[copy]=state.interventions[copy]||{};state.interventions[copy][0]=[{action:'review',eventDate:'2028-01-01',rent:999999}];return JSON.stringify(state.interventions?.[source]||{})===original});
  assert.ok(isolation,'Duplicated scenario changed original unit actions');
  const persisted=await page.evaluate(()=>{const ids=Object.keys(state.options),copy=ids[ids.length-1];state.vpProgrammes=state.vpProgrammes||{};state.vpProgrammes[copy]={possession:{0:{method:'surrender',date:'2028-01-01'}},worksMonths:3,refurbishmentCost:125000,annualEmptyRates:24000};persist();return {copy,count:ids.length}});
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('[data-strategy-card]').count(),persisted.count,'Scenario count not restored on reload');
  const restored=await page.evaluate(copy=>({vp:state.vpProgrammes?.[copy],name:state.options?.[copy]?.name}),persisted.copy);
  assert.equal(restored.vp?.refurbishmentCost,125000,'VP refurbishment budget not persisted');
  assert.equal(restored.vp?.possession?.[0]?.date,'2028-01-01','VP possession date not persisted');
  assert.ok(restored.name,'Duplicated scenario name lost on reload');
  // Persistence checks deliberately insert synthetic events and a VP plan.
  // Remove those fixtures before validating investment outputs: a dated review
  // without an actual lease agreement is not a commercially valid business plan.
  await page.evaluate(copy=>{
    delete state.interventions[copy][0];
    delete state.vpProgrammes[copy];
    persist();render();
  },persisted.copy);
  assert.deepEqual(await page.evaluate(()=>validate()),[],'Demo should be valid after synthetic persistence fixtures are removed');


  await page.locator('.tab[data-tab="tenancies"]').click();
  assert.equal(await page.locator('#unit-target option').count(),7,'Demonstration must contain seven units');
  // A unit action entered under one scenario must not leak into another.
  const scoped=await page.evaluate(()=>{
    const ids=Object.keys(state.options),unit='0';
    const before=JSON.stringify(state.interventions?.[ids[1]]?.[unit]||[]);
    state.interventions[ids[0]]=state.interventions[ids[0]]||{};
    const prior=state.interventions[ids[0]][unit];
    state.interventions[ids[0]][unit]=[{action:'review',eventDate:'2028-01-01',rent:987654}];
    const isolated=JSON.stringify(state.interventions?.[ids[1]]?.[unit]||[])===before;
    if(prior===undefined)delete state.interventions[ids[0]][unit];else state.interventions[ids[0]][unit]=prior;
    return isolated;
  });
  assert.ok(scoped,'Unit assumptions leaked between scenarios');
  assert.equal(await page.locator('#scenario-unit-matrix tbody tr').count(),7,'Scenario unit matrix must show every unit');

  assert.ok((await page.locator('#scenario-context').innerText()).includes('Editing'),'Scenario context is not visible');
  await page.locator('#scenario-compare').click();
  assert.ok(await page.locator('#overview').evaluate(el=>el.classList.contains('active')),'Scenario comparison navigation failed');
  await page.locator('.tab[data-tab="tenancies"]').click();
  assert.equal(await page.locator('#unit-base-yield').count(),1);
  assert.equal(await page.locator('#unit-reversion-void').count(),1);
  const otherScenariosBefore=await page.evaluate(()=>{const selected=document.getElementById('unit-scenario').value;return Object.fromEntries(Object.keys(state.options).filter(id=>id!==selected).map(id=>[id,{yields:state.unitYields?.[id]||{},shift:state.marketShifts?.[id]??0,actions:state.interventions?.[id]||{}}]))});
  await page.locator('#unit-base-yield').fill('6.25');
  await page.locator('#unit-yield-adjust').fill('-0.5');
  await page.locator('#unit-global-shift').fill('0.25');
  await page.locator('#unit-yield-rationale').fill('Illustrative analyst judgement; independent comparable evidence required.');
  await page.locator('#unit-yield-save').click();
  assert.equal(await page.locator('#unit-base-yield').inputValue(),'6.25');
  const otherScenariosAfter=await page.evaluate(()=>{const selected=document.getElementById('unit-scenario').value;return Object.fromEntries(Object.keys(state.options).filter(id=>id!==selected).map(id=>[id,{yields:state.unitYields?.[id]||{},shift:state.marketShifts?.[id]??0,actions:state.interventions?.[id]||{}}]))});
  assert.deepEqual(otherScenariosAfter,otherScenariosBefore,'Saving unit yields must not change other scenarios');
  const savedDraft=await page.evaluate(()=>JSON.parse(JSON.stringify({options:state.options,tenancies:state.tenancies,interventions:state.interventions,unitYields:state.unitYields,marketShifts:state.marketShifts})));
  await page.reload({waitUntil:'networkidle'});
  const restoredDraft=await page.evaluate(()=>JSON.parse(JSON.stringify({options:state.options,tenancies:state.tenancies,interventions:state.interventions,unitYields:state.unitYields,marketShifts:state.marketShifts})));
  assert.deepEqual(restoredDraft,savedDraft,'Seven-unit scenario assumptions must survive a browser reload');
  await page.locator('.tab[data-tab="overview"]').click();
  const reportText=(await page.locator('#ic-summary').innerText()).trim();
  if(reportText.length<=100){const diagnosis=await page.evaluate(()=>({validation:validate(),status:document.getElementById('globalstatus')?.textContent,messages:document.getElementById('messages')?.textContent,scenarioIds:Object.keys(state.options),report:document.getElementById('ic-summary')?.textContent}));throw new Error('Committee report incomplete: '+JSON.stringify({reportText,diagnosis,errors}));}
  assert.ok(!(await page.locator('#globalstatus').innerText()).includes('Calculation error'),'Scenario changes caused calculation error');
  const reportDownload=page.waitForEvent('download');
  await page.locator('#ic-export').click();
  assert.ok((await reportDownload).suggestedFilename().endsWith('.html'),'Committee report did not download');
  assert.deepEqual(errors,[],'Browser JavaScript errors');
  console.log('Browser smoke tests passed: startup, navigation, tenancy, yield controls');
 }finally{await browser.close();server.close()}
})().catch(err=>{console.error(err);server.close();process.exitCode=1});
