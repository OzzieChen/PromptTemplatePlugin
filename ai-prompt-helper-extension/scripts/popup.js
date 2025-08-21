import { loadTemplates, renderVariableFields, collectValues, buildPrompt, sendInsertMessage, detectSiteBadge, saveOrder, loadSettings, sendToTemporaryChat } from './app.js';

const siteBadge = document.getElementById('siteBadge');
const openOptions = document.getElementById('openOptions');
const openSettings = document.getElementById('openSettings');

const viewHome = document.getElementById('view-home');
const viewDetail = document.getElementById('view-detail');
const cards = document.getElementById('cards');

const tplName = document.getElementById('tplName');
const fields = document.getElementById('variableFields');
const preview = document.getElementById('preview');
const backBtn = document.getElementById('backBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const insertBtn = document.getElementById('insertBtn');
const sendBtn = document.getElementById('sendBtn');
const tempChat = document.getElementById('tempChat');

let templates = [];
let currentTemplate = null;

function goHome(){
  viewHome.style.display = 'block';
  viewDetail.style.display = 'none';
}

function goDetail(t){
  currentTemplate = t;
  tplName.textContent = t.name;
  renderVariableFields(fields, t);
  updatePreview();
  viewHome.style.display = 'none';
  viewDetail.style.display = 'block';
}

function updatePreview(){
  if(!currentTemplate) { preview.textContent=''; return; }
  const values = collectValues(fields);
  preview.textContent = buildPrompt(currentTemplate, values);
}

function mountCards(){
  cards.innerHTML = '';
  for(const t of templates){
    const card = document.createElement('div');
    card.className = 'card interactive';
    card.draggable = true;
    card.innerHTML = `<div class="row" style="justify-content:space-between"><div class="handle">⋮⋮</div><div class="badge">${t.scene}</div></div><div class="card-title">${t.name}</div><div class="card-sub">点击进入详情</div>`;
    card.addEventListener('click', (e)=>{
      if(e.target.closest('.handle')) return; // ignore drag handle click
      goDetail(t);
    });
    card.addEventListener('dragstart', (e)=>{
      e.dataTransfer.setData('text/plain', t.id);
    });
    card.addEventListener('dragover', (e)=>{ e.preventDefault(); card.style.borderColor = '#c7d2fe'; });
    card.addEventListener('dragleave', ()=>{ card.style.borderColor = 'var(--border)'; });
    card.addEventListener('drop', async (e)=>{
      e.preventDefault(); card.style.borderColor = 'var(--border)';
      const fromId = e.dataTransfer.getData('text/plain');
      const toId = t.id;
      const fromIdx = templates.findIndex(x=>x.id===fromId);
      const toIdx = templates.findIndex(x=>x.id===toId);
      if(fromIdx<0 || toIdx<0 || fromIdx===toIdx) return;
      const moved = templates.splice(fromIdx,1)[0];
      templates.splice(toIdx,0,moved);
      cards.insertBefore(cards.children[fromIdx], cards.children[toIdx]);
      await saveOrder(templates.map(x=>x.id));
    });
    cards.appendChild(card);
  }
}

async function init(){
  templates = await loadTemplates();
  mountCards();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  siteBadge.textContent = tab?.url ? detectSiteBadge(tab.url) : '通用';
  fields.addEventListener('input', updatePreview, { passive: true });
  fields.addEventListener('change', updatePreview);
}

backBtn.addEventListener('click', ()=>{ goHome(); });
clearBtn.addEventListener('click', ()=>{ fields.querySelectorAll('input,textarea,select').forEach(el=>{ if(el.tagName==='SELECT'){ el.selectedIndex=0; } else { el.value=''; } }); updatePreview(); });
copyBtn.addEventListener('click', async ()=>{ await navigator.clipboard.writeText(preview.textContent || ''); });
insertBtn.addEventListener('click', async ()=>{ const values = collectValues(fields); const text = buildPrompt(currentTemplate, values); await sendInsertMessage(text, false); });
sendBtn.addEventListener('click', async ()=>{
  const values = collectValues(fields); const text = buildPrompt(currentTemplate, values);
  const settings = await loadSettings();
  // temporary chat for ChatGPT only
  if(tempChat.checked){
    await sendToTemporaryChat(text);
  } else {
    await sendInsertMessage(text, true);
  }
});

openOptions.addEventListener('click', ()=>{ chrome.runtime.openOptionsPage(); });
openSettings.addEventListener('click', ()=>{ chrome.runtime.openOptionsPage(); });

init();