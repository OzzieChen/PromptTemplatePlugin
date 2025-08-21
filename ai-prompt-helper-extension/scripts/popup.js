import { loadTemplates, renderVariableFields, collectValues, buildPrompt, sendInsertMessage, detectSiteBadge } from './app.js';

const templateSelect = document.getElementById('templateSelect');
const fields = document.getElementById('variableFields');
const preview = document.getElementById('preview');
const insertBtn = document.getElementById('insertBtn');
const sendBtn = document.getElementById('sendBtn');
const openOptions = document.getElementById('openOptions');
const siteBadge = document.getElementById('siteBadge');

let templates = [];
let currentTemplate = null;

function updatePreview(){
  if(!currentTemplate) { preview.textContent=''; return; }
  const values = collectValues(fields);
  preview.textContent = buildPrompt(currentTemplate, values);
}

function mountTemplateOptions(){
  templateSelect.innerHTML = '';
  for(const t of templates){
    const opt = document.createElement('option');
    opt.value = t.id; opt.textContent = t.name; templateSelect.appendChild(opt);
  }
  currentTemplate = templates[0];
  templateSelect.value = currentTemplate?.id || '';
  renderVariableFields(fields, currentTemplate);
  fields.addEventListener('input', updatePreview, { passive: true });
  fields.addEventListener('change', updatePreview);
  updatePreview();
}

async function init(){
  templates = await loadTemplates();
  mountTemplateOptions();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  siteBadge.textContent = tab?.url ? detectSiteBadge(tab.url) : '通用';
}

insertBtn.addEventListener('click', async ()=>{
  const values = collectValues(fields);
  const text = buildPrompt(currentTemplate, values);
  await sendInsertMessage(text, false);
});

sendBtn.addEventListener('click', async ()=>{
  const values = collectValues(fields);
  const text = buildPrompt(currentTemplate, values);
  await sendInsertMessage(text, true);
});

templateSelect.addEventListener('change', ()=>{
  const id = templateSelect.value;
  currentTemplate = templates.find(t=>t.id===id);
  renderVariableFields(fields, currentTemplate);
  updatePreview();
});

openOptions.addEventListener('click', ()=>{
  chrome.runtime.openOptionsPage();
});

init();