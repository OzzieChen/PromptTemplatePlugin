const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

async function waitForCards(page){
  await page.waitForSelector('#cards');
  await page.waitForFunction(() => (document.querySelectorAll('#cards .card').length > 0));
}

function sleep(ms){ return new Promise(res=>setTimeout(res, ms)); }

async function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

(async () => {
  const assetsDir = path.resolve(__dirname, '..', 'assets');
  await ensureDir(assetsDir);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox','--lang=zh-CN,zh'] });
  const page = await browser.newPage();

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

  const fileUrl = 'file://' + path.resolve(__dirname, '..', 'edge-prompt-templates', 'popup.html');

  await page.setViewport({ width: 560, height: 860, deviceScaleFactor: 1 });
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  await waitForCards(page);
  await sleep(400);
  await page.screenshot({ path: path.join(assetsDir, 'home-popup.png') });

  await page.click('#cards .card');
  await page.waitForSelector('#fillView:not(.hidden)');
  await page.setViewport({ width: 560, height: 980, deviceScaleFactor: 1 });
  await sleep(400);
  await page.screenshot({ path: path.join(assetsDir, 'detail-popup.png') });

  await page.click('#back2');
  await waitForCards(page);
  await page.click('#cards .card [data-edit]');
  await page.waitForSelector('#editView:not(.hidden)');
  await page.setViewport({ width: 560, height: 980, deviceScaleFactor: 1 });
  await sleep(400);
  await page.screenshot({ path: path.join(assetsDir, 'edit-popup.png') });

  await page.click('#back1');
  await waitForCards(page);
  await page.click('#settingsBtn');
  await page.waitForSelector('#settingsView:not(.hidden)');
  await page.setViewport({ width: 560, height: 900, deviceScaleFactor: 1 });
  await sleep(400);
  await page.screenshot({ path: path.join(assetsDir, 'settings-popup.png') });

  await browser.close();
  console.log('Popup screenshots saved to', assetsDir);
})();