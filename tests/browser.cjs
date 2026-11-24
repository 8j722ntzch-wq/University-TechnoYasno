const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const slug = 'lenovo-ideapad-slim-3-15';
async function run(browser, device, viewport) {
  const ctx = await browser.newContext({viewport,locale:'ru-RU',deviceScaleFactor:1});
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
  const go=route=>page.goto(base+route);
  const content=async selector=>(await page.locator(selector).innerText()).replace(/\s/g,'');
  async function shot(name){
    await page.evaluate(async()=>{
      window.scrollTo(0,0);
      await document.fonts.ready;
      await Promise.all([...document.images].filter(img=>img.getBoundingClientRect().top<innerHeight).map(img=>img.decode()));
    });
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflows viewport');
    await page.screenshot({path:'screenshots/'+device+'-'+name+'.png',animations:'disabled'});
  }
  try{
    await go('/');
    assert.equal(await page.locator('.cats .cat:visible').count(),5);
    await shot('01-home');
    const search=page.getByRole('combobox',{name:'Поиск техники'});
    await search.fill('demo001');
    await page.getByRole('option').first().waitFor();
    assert.equal(await page.getByRole('option').count(),1);
    await search.press('ArrowDown');await search.press('Enter');
    await page.waitForURL('**/product/'+slug+'/');
    await shot('03-product');
    await page.locator('[data-action="add"][data-id="'+slug+'"]').first().click();
    await page.locator('nav a[href="/cart/"]:visible').first().click();
    await page.locator('.cartitem').waitFor();
    assert.equal(await content('.grand strong'),'1709BYN');
    await page.locator('[value="pickup"]').check();
    assert.equal(await content('.grand strong'),'1699BYN');
    await page.locator('[value="courier"]').check();
    await shot('04-cart');
    await page.getByRole('link',{name:'Перейти к оформлению'}).click();
    await page.locator('#fill').click();
    await shot('05-checkout');
    await page.getByRole('button',{name:'Подтвердить заказ'}).click();
    await page.locator('.receipt').waitFor();
    assert.equal(await content('.receipt .grand strong'),'1709BYN');
    assert.match(await content('.receipt'),/TY-[0-9A-F]{8}/);
    console.log(device,'PASS поиск → товар → корзина → гостевой заказ');
    await go('/finder/');
    await page.locator('.recommend').first().waitFor();
    await page.locator('.finder-group').first().locator('label').nth(1).click();
    await page.getByRole('button',{name:'Показать подходящие модели'}).click();
    await shot('06-finder');
    const choices=page.locator('.recommend [data-action="compare"]');
    await choices.nth(0).click();await choices.nth(1).click();
    await page.getByRole('link',{name:'Открыть сравнение'}).click();
    await page.locator('#diff').waitFor();
    assert.equal(await page.locator('.compareproduct').count(),2);
    await shot('07-compare');
    const all=await page.locator('tbody tr').count();
    await page.locator('#diff').check();
    assert.ok(await page.locator('tbody tr').count()<all);
    console.log(device,'PASS подбор → две модели → сравнение различий');
    await go('/about/showroom/');await shot('09-showroom');
    await page.getByRole('link',{name:'Выбрать товар для резерва'}).click();
    await shot('02-catalog');
    await page.locator('.card .name').first().click();
    await page.locator('[data-reserve]').first().click();
    await page.locator('#reserve select').selectOption({index:1});
    await page.getByRole('button',{name:'Подтвердить резерв'}).click();
    assert.match(await content('#modalbody'),/Резервподтверждён.*11:00/s);
    console.log(device,'PASS шоурум → товар → время → подтверждение резерва');
    await go('/business/');await shot('08-business');
    await page.locator('[data-kit]').first().click();
    assert.ok(await page.locator('textarea[name=need]').inputValue());
    for(const [key,val] of Object.entries({org:'Демо',person:'Тест',contact:'demo@example.test',seats:'5'}))await page.locator('#proposal [name='+key+']').fill(val);
    await page.locator('#proposal input[type=checkbox]').check();
    await page.locator('#proposal button').click();
    assert.match(await content('#bstatus'),/запроспринят/);
    assert.deepEqual(errors,[]);
    console.log(device,'PASS комплект → запрос КП → подтверждение');
  }finally{await ctx.close()}
}
(async()=>{
  await fs.mkdir('screenshots',{recursive:true});
  const browser=await chromium.launch({channel:'chrome'});
  try{
    for(const [device,viewport] of Object.entries({desktop:{width:1440,height:900},mobile:{width:390,height:844}}))await run(browser,device,viewport);
  }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
