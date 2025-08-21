export const STORAGE_KEYS = { templates: 'AI_PROMPT_HELPER_TEMPLATES_V1', settings: 'AI_PROMPT_HELPER_SETTINGS_V1', order: 'AI_PROMPT_HELPER_ORDER_V1' };

export const DefaultTemplates = [
  {
    id: 'formal_en',
    name: '书面材料英语',
    scene: 'formal_en',
    template:
`你是专业英文写作者。请将以下中文内容翻译为适用于汇报材料的正式、精炼英语。\n\n- 输入类别：{{类别}}\n- 要求：\n  1) 保持客观、正式、精炼；标题更短更有力，正文严谨清晰\n  2) 使用地道书面表达，避免口语化\n  3) 输出按类别分段展示，并用项目符号列出要点\n\n中文内容：\n{{中文内容}}\n\n请输出：\n- 英文标题（如类别为“标题”时）\n- 英文正文要点（如类别为“正文”时）\n- 关键表达简要说明（中英对照，帮助我理解）`,
    variables: [
      { key: '类别', label: '类别', type: 'select', options: ['标题','正文'], default: '正文' },
      { key: '中文内容', label: '中文内容', type: 'textarea' }
    ]
  },
  {
    id: 'spoken_en',
    name: '口语交流英语',
    scene: 'spoken_en',
    template:
`请将以下中文内容改写为地道的 {{场景}} 英语交流。\n\n- 语气：{{语气}}\n- 要求：简洁自然，符合母语者习惯，可适度润色\n- 额外说明：请附带中文解释（使用语境、关键词表达与替代表达）\n\n中文内容：\n{{中文内容}}\n\n请输出：\n1) 英文表达\n2) 中文解释（说明为何这样表达、注意语境/礼貌程度/常见替代说法）`,
    variables: [
      { key: '场景', label: '场景', type: 'select', options: ['WhatsApp','口语沟通','邮件简讯','会议快速回应'], default: 'WhatsApp' },
      { key: '语气', label: '语气', type: 'select', options: ['友好','专业','随意','谨慎'], default: '友好' },
      { key: '中文内容', label: '中文内容', type: 'textarea' }
    ]
  },
  {
    id: 'schedule',
    name: '设置提醒（ChatGPT）',
    scene: 'schedule',
    template:
`你是智能日程助手。请根据以下信息生成设置提醒/任务的指令，并在 ChatGPT 环境中直接执行：\n\n- 任务：{{任务}}\n- 提醒时间：{{时间}}\n- 时区：{{时区}}\n- 重要程度：{{重要程度}}\n\n如果可以，请确认已创建提醒；如无法真正创建，请给出替代方案（例如以待办形式跟进），并返回标准化的任务卡片文本供我保存。`,
    variables: [
      { key: '任务', label: '任务', type: 'text' },
      { key: '时间', label: '时间', type: 'text' },
      { key: '时区', label: '时区', type: 'select', options: ['Asia/Shanghai','UTC','America/Los_Angeles','Europe/London'], default: 'Asia/Shanghai' },
      { key: '重要程度', label: '重要程度', type: 'select', options: ['普通','重要','紧急'], default: '普通' }
    ]
  },
  {
    id: 'tech_cn',
    name: '技术理解（中文输出）',
    scene: 'tech_cn',
    template:
`请基于以下信息以中文回答问题，同时对关键术语以英文标注并附简短说明。输出需结构化：摘要、关键概念（术语+英文）、分步讲解、示例、常见坑、进一步阅读。\n\n- 技术主题：{{技术主题}}\n- 深度：{{深度}}\n- 受众：{{受众}}\n- 问题描述：\n{{问题描述}}`,
    variables: [
      { key: '技术主题', label: '技术主题', type: 'text' },
      { key: '深度', label: '深度', type: 'select', options: ['入门','标准','深入'], default: '标准' },
      { key: '受众', label: '受众', type: 'select', options: ['学生','工程师','经理'], default: '工程师' },
      { key: '问题描述', label: '问题描述', type: 'textarea' }
    ]
  }
];

export async function loadTemplates(){
  const sync = await chrome.storage.sync.get(STORAGE_KEYS.templates);
  const user = sync[STORAGE_KEYS.templates] || [];
  // Map by id; user overrides default by same id
  const byId = new Map();
  for(const t of DefaultTemplates){ byId.set(t.id, t); }
  for(const t of user){ byId.set(t.id, t); }
  const merged = Array.from(byId.values());
  // apply order
  const ord = await loadOrder();
  if(ord && ord.length){
    merged.sort((a,b)=>{
      const ia = ord.indexOf(a.id); const ib = ord.indexOf(b.id);
      return (ia<0?9999:ia) - (ib<0?9999:ib);
    });
  }
  return merged;
}

export async function saveTemplates(templates){
  await chrome.storage.sync.set({ [STORAGE_KEYS.templates]: templates });
}

export async function loadOrder(){
  const sync = await chrome.storage.sync.get(STORAGE_KEYS.order);
  return sync[STORAGE_KEYS.order] || [];
}

export async function saveOrder(order){
  await chrome.storage.sync.set({ [STORAGE_KEYS.order]: order });
}

export function detectSiteBadge(url){
  try{
    const u = new URL(url || location.href);
    if(/openai\.com|chatgpt\.com|chatgpt/.test(u.hostname)) return 'ChatGPT';
    if(/kimi|moonshot/.test(u.hostname)) return 'Kimi';
    if(/deepseek/.test(u.hostname)) return 'DeepSeek';
    return '通用';
  }catch{ return '通用'; }
}

export function renderVariableFields(container, template){
  container.innerHTML = '';
  if(!template) return;
  for(const v of template.variables){
    const wrap = document.createElement('div');
    wrap.className = 'row';
    const label = document.createElement('label');
    label.textContent = v.label;
    wrap.appendChild(label);

    const fieldWrap = document.createElement('div');
    fieldWrap.style.width = '100%';

    if(v.type === 'textarea'){
      const ta = document.createElement('textarea');
      ta.dataset.key = v.key;
      ta.placeholder = `请输入${v.label}`;
      fieldWrap.appendChild(ta);
    } else if(v.type === 'select'){
      const select = document.createElement('select');
      select.dataset.key = v.key;
      const opts = (v.options || []).slice();
      if(v.default && !opts.includes(v.default)) opts.unshift(v.default);
      for(const opt of opts){
        const o = document.createElement('option'); o.value = opt; o.textContent = opt; select.appendChild(o);
      }
      const customVal = '__custom__';
      const customOpt = document.createElement('option'); customOpt.value = customVal; customOpt.textContent = '自定义…'; select.appendChild(customOpt);
      if(v.default){ select.value = v.default; }
      const customInput = document.createElement('input');
      customInput.type = 'text'; customInput.placeholder = `自定义${v.label}`; customInput.style.display='none'; customInput.dataset.key = v.key + '__custom';
      select.addEventListener('change',()=>{ customInput.style.display = select.value===customVal ? 'block':'none';});
      fieldWrap.appendChild(select);
      fieldWrap.appendChild(customInput);
    } else {
      const input = document.createElement('input');
      input.type = 'text'; input.dataset.key = v.key; input.placeholder = `请输入${v.label}`;
      fieldWrap.appendChild(input);
    }

    wrap.appendChild(fieldWrap);
    container.appendChild(wrap);
  }
}

export function collectValues(container){
  const values = {};
  const fields = container.querySelectorAll('input, textarea, select');
  fields.forEach(el=>{
    const key = el.dataset.key; if(!key) return;
    if(el.tagName === 'SELECT'){
      const custom = container.querySelector(`input[data-key="${key}__custom"]`);
      if(el.value === '__custom__' && custom && custom.value){ values[key] = custom.value; }
      else { values[key] = el.value; }
    } else {
      values[key] = el.value;
    }
  });
  return values;
}

export function buildPrompt(template, values){
  let text = template.template;
  for(const v of template.variables){
    const val = (values[v.key] ?? '').toString();
    text = text.replaceAll(`{{${v.key}}}`, val);
  }
  return text;
}

export async function sendInsertMessage(promptText, sendNow){
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if(!tab || !tab.id) return;
  await chrome.tabs.sendMessage(tab.id, { type: 'insertPrompt', text: promptText, sendNow: !!sendNow });
}

export async function sendToTemporaryChat(promptText){
  await chrome.runtime.sendMessage({ type: 'sendToTempChat', text: promptText });
}

export async function loadSettings(){
  const sync = await chrome.storage.sync.get(STORAGE_KEYS.settings);
  return sync[STORAGE_KEYS.settings] || { provider: 'chatgpt', preferChatGPTDomain: 'chatgpt.com', model: 'gpt-4o', autoSend: false, theme: 'system' };
}

export async function saveSettings(settings){
  await chrome.storage.sync.set({ [STORAGE_KEYS.settings]: settings });
}