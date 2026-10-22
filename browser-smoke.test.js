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
  for(const tab of ['tenancies','property','overview','sensitivities','cashflows']){
   await page.locator('.tab[data-tab="'+tab+'"]').click();
   assert.ok(await page.locator('#'+tab).evaluate(el=>el.classList.contains('active')),'Navigation failed: '+tab);
  }
  await page.locator('.tab[data-tab="dashboard"]').click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('details.workspace-details summary').click();
  await page.locator('#loaddemo').click();
  await page.waitForFunction(()=>document.querySelector('#dash-asset')?.textContent?.includes('Seven-unit'));
  await page.locator('.tab[data-tab="overview"]').click();
  assert.equal(await page.locator('#ic-summary').count(),1,'Investment committee summary missing');
  await page.locator('.tab[data-tab="options"]').click();
  assert.ok((await page.locator('#options .section-intro h2').innerText()).includes('Scenarios'));
  const before=await page.locator('[data-strategy-card]').count();
  await page.locator('#scenario-advanced > summary').click();
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
  await page.locator('#unit-base-yield').fill('6.25');
  await page.locator('#unit-yield-adjust').fill('-0.5');
  await page.locator('#unit-global-shift').fill('0.25');
  await page.locator('#unit-yield-rationale').fill('Illustrative analyst judgement; independent comparable evidence required.');
  await page.locator('#unit-yield-save').click();
  assert.equal(await page.locator('#unit-base-yield').inputValue(),'6.25');
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
