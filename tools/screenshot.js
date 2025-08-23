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
    style.innerHTML = `*{ font-family: "Noto Sans CJK SC", "Noto Sans CJK", "Noto Sans SC", "WenQuanYi Zen Hei", "PingFang SC", "Microsoft YaHei UI", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif !important; }`;
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

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox','--lang=zh-CN,zh'] });
  const page = await browser.newPage();

  const fileUrl = 'file://' + path.resolve(__dirname, '..', 'edge-prompt-templates', 'popup.html');

  const tmp = name => ({ light: path.join(assetsDir, `${name}-light.png`), dark: path.join(assetsDir, `${name}-dark.png`), out: path.join(assetsDir, `${name}.png`) });
  const home = tmp('home-popup');
  const detail = tmp('detail-popup');
  const edit = tmp('edit-popup');
  const imp = tmp('edit-import-popup');
  const settings = tmp('settings-popup');

  await captureVariant(page, fileUrl, 'light', { home: home.light, detail: detail.light, edit: edit.light, import: imp.light, settings: settings.light });
  await captureVariant(page, fileUrl, 'dark', { home: home.dark, detail: detail.dark, edit: edit.dark, import: imp.dark, settings: settings.dark });

  await stitchSideBySide(home.light, home.dark, home.out);
  await stitchSideBySide(detail.light, detail.dark, detail.out);
  await stitchSideBySide(edit.light, edit.dark, edit.out);
  await stitchSideBySide(imp.light, imp.dark, imp.out);
  await stitchSideBySide(settings.light, settings.dark, settings.out);

  await browser.close();
  console.log('Popup screenshots saved to', assetsDir);
})();