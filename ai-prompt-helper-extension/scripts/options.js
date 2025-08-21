import { STORAGE_KEYS, loadTemplates, saveTemplates } from './app.js';

const list = document.getElementById('templateList');
const nameInput = document.getElementById('tplName');
const sceneInput = document.getElementById('tplScene');
const bodyInput = document.getElementById('tplBody');
const varKey = document.getElementById('varKey');
const varLabel = document.getElementById('varLabel');
const varType = document.getElementById('varType');
const varOptions = document.getElementById('varOptions');
const addVarBtn = document.getElementById('addVar');
const varList = document.getElementById('varList');
const saveTplBtn = document.getElementById('saveTpl');

let templates = [];
let newVars = [];

function renderList(){
  list.innerHTML = '';
  for(const t of templates){
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `<div><strong>${t.name}</strong><div class="subtle">ID: ${t.id} / 场景: ${t.scene}</div></div>`;
    const actions = document.createElement('div'); actions.style.display='flex'; actions.style.gap='8px';
    const del = document.createElement('button'); del.className='button ghost'; del.textContent='删除';
    del.addEventListener('click', async ()=>{
      templates = templates.filter(x=>x.id!==t.id);
      await saveTemplates(templates);
      renderList();
    });
    actions.appendChild(del);
    row.appendChild(actions);
    list.appendChild(row);
  }
}

function renderNewVars(){
  varList.innerHTML = '';
  for(const v of newVars){
    const el = document.createElement('div'); el.className='kv';
    el.textContent = `${v.label} (${v.key}) - ${v.type}${v.type==='select' ? ' ['+(v.options||[]).join(',')+']':''}`;
    varList.appendChild(el);
  }
}

addVarBtn.addEventListener('click', ()=>{
  if(!varKey.value || !varLabel.value) return;
  const v = { key: varKey.value.trim(), label: varLabel.value.trim(), type: varType.value };
  if(v.type==='select'){
    v.options = varOptions.value.split(',').map(s=>s.trim()).filter(Boolean);
  }
  newVars.push(v);
  varKey.value = ''; varLabel.value = ''; varOptions.value = '';
  renderNewVars();
});

saveTplBtn.addEventListener('click', async ()=>{
  if(!nameInput.value || !bodyInput.value) return;
  const id = nameInput.value.trim().toLowerCase().replace(/[^a-z0-9_\-]+/g,'_');
  const tpl = { id, name: nameInput.value.trim(), scene: sceneInput.value, template: bodyInput.value, variables: newVars.slice() };
  const existsIdx = templates.findIndex(t=>t.id===id);
  if(existsIdx>=0) templates.splice(existsIdx,1,tpl); else templates.push(tpl);
  await saveTemplates(templates);
  // reset form
  nameInput.value=''; bodyInput.value=''; newVars=[]; renderNewVars();
  renderList();
});

async function init(){
  templates = await loadTemplates();
  renderList();
}

init();