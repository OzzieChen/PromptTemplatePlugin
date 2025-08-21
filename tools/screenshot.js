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
  try { await page.waitForSelector('.cards .card', { timeout: 5000 }); } catch {
    await page.evaluate(() => {
      const cards = document.getElementById('cards');
      if (cards && !cards.querySelector('.card')) {
        const names = ['书面材料英语','口语交流英语','设置提醒','技术理解（中文输出）'];
        names.forEach(name => {
          const d = document.createElement('div');
          d.className = 'card interactive';
          d.innerHTML = `<div class="row" style="justify-content:space-between;align-items:center"><div class="card-title">${name}</div><div class="handle">⋮⋮</div></div><div class="row inline-actions" style="justify-content:flex-start"><button class="link">编辑</button><button class="link">删除</button></div>`;
          cards.appendChild(d);
        });
      }
    });
  }
  await page.screenshot({ path: path.join(out, 'popup-home.png') });

  // popup detail
  const first = await page.$('.cards .card');
  if (first) { await first.click(); await page.waitForSelector('#preview'); await page.screenshot({ path: path.join(out, 'popup-detail.png') }); }

  // popup create view (embedded)
  const create = await browser.newPage();
  await create.setViewport({ width: 420, height: 680, deviceScaleFactor: 2 });
  await create.goto(popupUrl, { waitUntil: 'load' });
  await create.evaluate(()=>{
    const home = document.getElementById('view-home');
    const detail = document.getElementById('view-detail');
    const createV = document.getElementById('view-create');
    if(home) home.style.display='none'; if(detail) detail.style.display='none'; if(createV) createV.style.display='block';
  });
  await create.waitForSelector('#c_name');
  await create.screenshot({ path: path.join(out, 'popup-create.png') });

  // popup settings view (embedded)
  const settings = await browser.newPage();
  await settings.setViewport({ width: 420, height: 680, deviceScaleFactor: 2 });
  await settings.goto(popupUrl, { waitUntil: 'load' });
  await settings.evaluate(()=>{
    const home = document.getElementById('view-home');
    const detail = document.getElementById('view-detail');
    const s = document.getElementById('view-settings');
    if(home) home.style.display='none'; if(detail) detail.style.display='none'; if(s) s.style.display='block';
  });
  await settings.waitForSelector('#s_provider');
  await settings.screenshot({ path: path.join(out, 'popup-settings.png') });

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
  try { await side.waitForSelector('.cards .card', { timeout: 5000 }); } catch {
    await side.evaluate(() => {
      const cards = document.getElementById('cards');
      if (cards && !cards.querySelector('.card')) {
        const names = ['书面材料英语','口语交流英语','设置提醒','技术理解（中文输出）'];
        names.forEach(name => {
          const d = document.createElement('div');
          d.className = 'card interactive';
          d.innerHTML = `<div class=\"row\" style=\"justify-content:space-between;align-items:center\"><div class=\"card-title\">${name}</div><div class=\"handle\">⋮⋮</div></div><div class=\"row inline-actions\" style=\"justify-content:flex-start\"><button class=\"link\">编辑</button><button class=\"link\">删除</button></div>`;
          cards.appendChild(d);
        });
      }
    });
  }
  await side.screenshot({ path: path.join(out, 'sidepanel-home.png') });

  await browser.close();
})();