import { loadTemplates, renderVariableFields, collectValues, buildPrompt, sendInsertMessage, saveOrder, loadSettings, sendToTemporaryChat } from './app.js';
const createTpl = document.getElementById('createTpl');
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
const toast = document.getElementById('toast');
const openPanelWindow = document.getElementById('openPanelWindow');

let templates = [];
let currentTemplate = null;

function goHome(){ viewHome.style.display = 'block'; viewDetail.style.display = 'none'; }
function goDetail(t){ currentTemplate = t; tplName.textContent=t.name; renderVariableFields(fields,t); updatePreview(); viewHome.style.display='none'; viewDetail.style.display='block'; }

function updatePreview(){
  if(!currentTemplate) { preview.textContent=''; return; }
  const values = collectValues(fields);
  preview.textContent = buildPrompt(currentTemplate, values);
}

function mountCards(){
  cards.innerHTML='';
  for(const t of templates){
    const card = document.createElement('div');
    card.className = 'card interactive';
    card.draggable = true;
    card.innerHTML = `<div class=\"row\" style=\"justify-content:space-between\"><div class=\"handle\">⋮⋮</div><div class=\"badge\">${t.scene}</div></div><div class=\"card-title\">${t.name}</div><div class=\"row\" style=\"justify-content:flex-end\"><button class=\"button ghost btn-edit\">编辑</button><button class=\"button ghost btn-delete\">删除</button></div>`;
    card.addEventListener('click', (e)=>{ if(e.target.closest('.handle')) return; if(e.target.closest('.btn-edit')){ chrome.runtime.openOptionsPage(); return; } if(e.target.closest('.btn-delete')){ return; } goDetail(t); });
    card.addEventListener('dragstart', (e)=>{ e.dataTransfer.setData('text/plain', t.id); });
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

function showToast(text){ toast.textContent=text; toast.style.display='block'; clearTimeout(showToast._t); showToast._t=setTimeout(()=>{ toast.style.display='none'; },2000); }

async function init(){
  templates = await loadTemplates();
  mountCards();
  fields.addEventListener('input', updatePreview, { passive: true });
  fields.addEventListener('change', updatePreview);
}

backBtn.addEventListener('click', ()=>{ goHome(); });
clearBtn.addEventListener('click', ()=>{ fields.querySelectorAll('input,textarea,select').forEach(el=>{ if(el.tagName==='SELECT'){ el.selectedIndex=0; } else { el.value=''; } }); updatePreview(); });
copyBtn.addEventListener('click', async ()=>{ await navigator.clipboard.writeText(preview.textContent || ''); showToast('已复制'); });
insertBtn.addEventListener('click', async ()=>{ const values = collectValues(fields); const text = buildPrompt(currentTemplate, values); try{ await sendInsertMessage(text, false); showToast('已插入'); }catch{ showToast('插入失败'); }});
sendBtn.addEventListener('click', async ()=>{
  const values = collectValues(fields); const text = buildPrompt(currentTemplate, values);
  const settings = await loadSettings();
  if(tempChat.checked){ try{ await sendToTemporaryChat(text); showToast('已发送到临时对话'); }catch{ showToast('发送失败'); } } else { try{ await sendInsertMessage(text, true); showToast('已注入并发送'); }catch{ showToast('发送失败'); } }
});

createTpl.addEventListener('click', ()=>{ chrome.runtime.openOptionsPage(); });
openSettings.addEventListener('click', ()=>{ chrome.runtime.openOptionsPage(); });
openPanelWindow.addEventListener('click', ()=>{ chrome.runtime.sendMessage({ type: 'openPanelWindow' }); });

init();