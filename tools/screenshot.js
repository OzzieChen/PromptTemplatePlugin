const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

async function waitForCards(page){
  await page.waitForSelector('#cards');
  await page.waitForFunction(() => (document.querySelectorAll('#cards .card').length > 0));
}

function sleep(ms){ return new Promise(res=>setTimeout(res, ms)); }

async function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function captureVariant(page, fileUrl, theme, tmpNames){
  await page.emulateTimezone('Asia/Shanghai');
  try { await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' }); } catch(e){}
  await page.evaluateOnNewDocument(() => {
    document.documentElement.setAttribute('lang','zh-CN');
    const style = document.createElement('style');
    style.innerHTML = `*{ font-family: "PingFang SC", "PingFang", "-apple-system", "Noto Sans SC", "Noto Sans CJK SC", "Noto Sans CJK", "WenQuanYi Zen Hei", "Microsoft YaHei UI", system-ui, Segoe UI, Roboto, Arial, sans-serif !important; }`;
    document.documentElement.appendChild(style);
    window.chrome = {
      runtime: { id: 'dev-stub', sendMessage: (payload, cb) => { try { cb && cb({ ok:false }); } catch(e){} } },
      sidePanel: { open: async () => {} }
    };
  });

  await page.setViewport({ width: 560, height: 860, deviceScaleFactor: 1 });
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  await page.evaluate((t)=>{ try{ localStorage.setItem('__pts__', JSON.stringify({ '__settings__': { provider:'chatgpt', theme:t, regularURL:'', temporaryURL:'' } })); }catch(e){} }, theme);
  await page.reload({ waitUntil: 'networkidle0' });
  await waitForCards(page);
  await sleep(400);
  await page.screenshot({ path: tmpNames.home });

  await page.click('#cards .card');
  await page.waitForSelector('#fillView:not(.hidden)');
  await page.setViewport({ width: 560, height: 980, deviceScaleFactor: 1 });
  await sleep(400);
  await page.screenshot({ path: tmpNames.detail });

  await page.click('#back2');
  await waitForCards(page);
  await page.click('#cards .card [data-edit]');
  await page.waitForSelector('#editView:not(.hidden)');
  await page.setViewport({ width: 560, height: 980, deviceScaleFactor: 1 });
  await sleep(400);
  await page.screenshot({ path: tmpNames.edit });

  await page.waitForSelector('#openImportModal');
  await page.evaluate(() => { const btn = document.querySelector('#openImportModal'); if(btn) btn.click(); });
  await page.waitForSelector('#importOverlay.show');
  await sleep(200);
  await page.screenshot({ path: tmpNames.import });

  await page.click('#modalCancel');
  await page.waitForFunction(() => !document.querySelector('#importOverlay')?.classList.contains('show'));

  await page.click('#back1');
  await waitForCards(page);
  await page.click('#settingsBtn');
  await page.waitForSelector('#settingsView:not(.hidden)');
  await page.setViewport({ width: 560, height: 900, deviceScaleFactor: 1 });
  await sleep(400);
  await page.screenshot({ path: tmpNames.settings });
}

async function stitchSideBySide(leftPath, rightPath, outPath){
  const left = sharp(leftPath);
  const right = sharp(rightPath);
  const lMeta = await left.metadata();
  const rMeta = await right.metadata();
  const height = Math.max(lMeta.height||0, rMeta.height||0);
  const leftResized = await left.extend({ top:0, bottom: (height - (lMeta.height||0)) }).toBuffer();
  const rightResized = await right.extend({ top:0, bottom: (height - (rMeta.height||0)) }).toBuffer();
  const composite = await sharp({ create: { width: (lMeta.width||0)+(rMeta.width||0), height, channels: 3, background: '#ffffff' } })
    .composite([
      { input: leftResized, top: 0, left: 0 },
      { input: rightResized, top: 0, left: (lMeta.width||0) }
    ])
    .png()
    .toFile(outPath);
  return composite;
}

(async () => {
  const assetsDir = path.resolve(__dirname, '..', 'assets');
  await ensureDir(assetsDir);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  await page.emulateTimezone('Asia/Shanghai');
  try { await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' }); } catch(e){}

  await page.evaluateOnNewDocument(() => {
    const style = document.createElement('style');
    style.innerHTML = `*{ font-family: "PingFang SC", "Noto Sans SC", -apple-system, Segoe UI, Roboto, Arial, sans-serif !important; }`;
    document.documentElement.appendChild(style);
    window.chrome = {
      runtime: { id: 'dev-stub', sendMessage: (payload, cb) => { try { cb && cb({ ok:false }); } catch(e){} } },
      sidePanel: { open: async () => {} }
    };
  });

  const fileUrl = 'file://' + path.resolve(__dirname, '..', 'edge-prompt-templates', 'popup.html');

  async function capturePopupPair(name, width, height){
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await waitForCards(page);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme','light'));
    await sleep(200);
    await page.screenshot({ path: path.join(assetsDir, name+'-light.png') });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme','dark'));
    await sleep(200);
    await page.screenshot({ path: path.join(assetsDir, name+'-dark.png') });
  }

  // home
  await capturePopupPair('home-popup', 560, 860);

  // detail
  await page.setViewport({ width: 560, height: 980, deviceScaleFactor: 1 });
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
  await waitForCards(page);
  await page.click('#cards .card');
  await page.waitForSelector('#fillView:not(.hidden)');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme','light'));
  await sleep(200);
  await page.screenshot({ path: path.join(assetsDir, 'detail-popup-light.png') });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme','dark'));
  await sleep(200);
  await page.screenshot({ path: path.join(assetsDir, 'detail-popup-dark.png') });

  // edit
  await page.click('#back2');
  await waitForCards(page);
  await page.click('#cards .card [data-edit]');
  await page.waitForSelector('#editView:not(.hidden)');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme','light'));
  await sleep(200);
  await page.screenshot({ path: path.join(assetsDir, 'edit-popup-light.png') });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme','dark'));
  await sleep(200);
  await page.screenshot({ path: path.join(assetsDir, 'edit-popup-dark.png') });

  // settings
  await page.click('#back1');
  await waitForCards(page);
  await page.click('#settingsBtn');
  await page.waitForSelector('#settingsView:not(.hidden)');
  await page.setViewport({ width: 560, height: 900, deviceScaleFactor: 1 });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme','light'));
  await sleep(200);
  await page.screenshot({ path: path.join(assetsDir, 'settings-popup-light.png') });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme','dark'));
  await sleep(200);
  await page.screenshot({ path: path.join(assetsDir, 'settings-popup-dark.png') });

  await browser.close();
  console.log('Popup screenshots (light/dark) saved to', assetsDir);
})();