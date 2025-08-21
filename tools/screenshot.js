const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const root = path.resolve(__dirname, '..');
  const ext = path.join(root, 'ai-prompt-helper-extension');
  const out = path.join(ext, 'assets');
  const browser = await puppeteer.launch({ headless: 'new', args: [
    `--disable-extensions-except=${ext}`,
    `--load-extension=${ext}`
  ]});

  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 680, deviceScaleFactor: 2 });

  const popupUrl = 'file://' + path.join(ext, 'popup.html') + '?demo=1';
  const sideUrl = 'file://' + path.join(ext, 'sidepanel.html') + '?demo=1';
  const optionsUrl = 'file://' + path.join(ext, 'options.html') + '?demo=1';

  // popup home
  await page.goto(popupUrl, { waitUntil: 'load' });
  await page.waitForSelector('.cards');
  await page.screenshot({ path: path.join(out, 'popup-home.png') });

  // popup detail
  const first = await page.$('.cards .card');
  if (first) { await first.click(); await page.waitForSelector('#preview'); await page.screenshot({ path: path.join(out, 'popup-detail.png') }); }

  // options
  const options = await browser.newPage();
  await options.setViewport({ width: 880, height: 740, deviceScaleFactor: 2 });
  await options.goto(optionsUrl, { waitUntil: 'load' });
  await options.waitForSelector('#templateList');
  await options.screenshot({ path: path.join(out, 'options.png') });

  // sidepanel
  const side = await browser.newPage();
  await side.setViewport({ width: 420, height: 680, deviceScaleFactor: 2 });
  await side.goto(sideUrl, { waitUntil: 'load' });
  await side.waitForSelector('.cards');
  await side.screenshot({ path: path.join(out, 'sidepanel-home.png') });

  await browser.close();
})();