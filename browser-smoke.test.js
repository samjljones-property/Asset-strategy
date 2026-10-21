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
  await page.locator('#loaddemo').click();
  await page.waitForFunction(()=>document.querySelector('#dash-asset')?.textContent?.includes('Seven-unit'));
  await page.locator('.tab[data-tab="overview"]').click();
  assert.equal(await page.locator('#ic-summary').count(),1,'Investment committee summary missing');
  await page.locator('.tab[data-tab="tenancies"]').click();
  await page.locator('#addtenancy').click();
  assert.ok(await page.locator('#unit-target option').count()>0,'Unit selector did not populate');
  assert.equal(await page.locator('#unit-base-yield').count(),1);
  assert.equal(await page.locator('#unit-reversion-void').count(),1);
  await page.locator('#unit-base-yield').fill('6.25');
  await page.locator('#unit-yield-adjust').fill('-0.5');
  await page.locator('#unit-global-shift').fill('0.25');
  await page.locator('#unit-yield-save').click();
  assert.equal(await page.locator('#unit-base-yield').inputValue(),'6.25');
  assert.deepEqual(errors,[],'Browser JavaScript errors');
  console.log('Browser smoke tests passed: startup, navigation, tenancy, yield controls');
 }finally{await browser.close();server.close()}
})().catch(err=>{console.error(err);server.close();process.exitCode=1});
