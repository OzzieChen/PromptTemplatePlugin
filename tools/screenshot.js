const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

async function waitForCards(page){
  await page.waitForSelector('#cards');
  await page.waitForFunction(() => (document.querySelectorAll('#cards .card').length > 0));
}

async function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

(async () => {
  const assetsDir = path.resolve(__dirname, '..', 'assets');
  await ensureDir(assetsDir);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  await page.addInitScript(() => {
    // Minimal stub to avoid runtime errors; storage left undefined to trigger local fallback
    window.chrome = {
      runtime: { id: 'dev-stub', sendMessage: (payload, cb) => { try { cb && cb({ ok:false }); } catch(e){} } },
      sidePanel: { open: async () => {} }
    };
  });

  const fileUrl = 'file://' + path.resolve(__dirname, '..', 'edge-prompt-templates', 'panel.html');

  // Home (Gallery)
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  await page.goto(fileUrl, { waitUntil: 'load' });
  await waitForCards(page);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(assetsDir, 'home.png') });

  // Detail (Fill view)
  await page.click('#cards .card');
  await page.waitForSelector('#fillView:not(.hidden)');
  await page.waitForTimeout(200);
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
  await page.screenshot({ path: path.join(assetsDir, 'detail.png') });

  // Back to gallery to click edit link
  await page.click('#back2');
  await waitForCards(page);
  await page.click('#cards .card [data-edit]');
  await page.waitForSelector('#editView:not(.hidden)');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(assetsDir, 'edit.png') });

  // Settings view
  await page.click('#back1');
  await waitForCards(page);
  await page.click('#settingsBtn');
  await page.waitForSelector('#settingsView:not(.hidden)');
  await page.setViewport({ width: 1000, height: 760, deviceScaleFactor: 1 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(assetsDir, 'settings.png') });

  await browser.close();
  console.log('Screenshots saved to', assetsDir);
})();