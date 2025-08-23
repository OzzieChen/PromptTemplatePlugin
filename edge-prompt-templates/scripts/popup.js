
// v2.4.10.5 - perf + focus tab + temp logic; scripts/popup.js
(function(){
  console.log('[PTS] popup v2.4.10.5 up');

  function $(s){ return document.querySelector(s); }
  function toast(msg){ const el=$('#toast'); if(!el) return; el.textContent=msg||''; el.classList.add('show'); setTimeout(()=>{ el.classList.remove('show'); el.textContent=''; }, 1600); }

  function wrapChromeStore(raw){
    if(!raw) return null;
    return {
      get(obj){ return new Promise(res=>{ try{ raw.get(obj, (data)=>res(data||{})); }catch(e){ console.warn('storage.get fail',e); res(obj||{}); } }); },
      set(obj){ return new Promise(res=>{ try{ raw.set(obj, ()=>res(true)); }catch(e){ console.warn('storage.set fail',e); res(false); } }); },
      remove(keys){ return new Promise(res=>{ try{ raw.remove(keys, ()=>res(true)); }catch(e){ console.warn('storage.remove fail',e); res(false); } }); }
    };
  }
  function makeLocalStore(ns){
    return {
      async get(keys){ const raw=localStorage.getItem(ns)||'{}'; const obj=JSON.parse(raw);
        if(typeof keys==='string'){ return {[keys]:obj[keys]}; }
        if(Array.isArray(keys)){ const out={}; keys.forEach(k=>out[k]=obj[k]); return out; }
        if(typeof keys==='object'){ const out={}; for(const k in keys){ out[k]=obj[k]??keys[k]; } return out; }
        return obj; },
      async set(items){ const raw=localStorage.getItem(ns)||'{}'; const obj=JSON.parse(raw); Object.assign(obj, items); localStorage.setItem(ns, JSON.stringify(obj)); return true; },
      async remove(keys){ const raw=localStorage.getItem(ns)||'{}'; const obj=JSON.parse(raw); ([]).concat(keys).forEach(k=>delete obj[k]); localStorage.setItem(ns, JSON.stringify(obj)); return true; }
    };
  }
  const storage = wrapChromeStore(chrome.storage?.local) || makeLocalStore('__pts__');
  const LAST_KEY='__last_view__';
  const SETTINGS_KEY='__settings__';
  const DEFAULT_SETTINGS = { provider:'chatgpt', regularURL:'https://chatgpt.com', temporaryURL:'https://chatgpt.com/?temporary-chat=true', theme:'system' };

  const ui = {
    gallery: $('#galleryView'), search: $('#search'), newBtn: $('#newBtn'), settingsBtn: $('#settingsBtn'),
    cards: $('#cards'), openSide: $('#openSidePanel'), reset: $('#resetDefaults'),
    edit: $('#editView'), back1: $('#back1'), name: $('#name'), content: $('#content'), save: $('#save'), cancel: $('#cancel'),
    delBtn: $('#del'), pills: $('#pills'), addField: $('#addField'), fieldsDesigner: $('#fieldsDesigner'),
    importCode: $('#importCode'), importArea: $('#importArea'), importText: $('#importText'), parseImport: $('#parseImport'), cancelImport: $('#cancelImport'), importHelp: $('#importHelp'),
    fill: $('#fillView'), back2: $('#back2'), title: $('#fillTitle'), inputs: $('#inputs'), preview: $('#preview'),
    copy: $('#copy'), insert: $('#insert'), send: $('#send'), clear: $('#clear'), tmpChat: $('#tmpChat'),
    settings: $('#settingsView'), back3: $('#back3'), provider: $('#provider'), backendRegular: $('#backendRegular'), backendTemporary: $('#backendTemporary'), theme: $('#theme'),
    saveSettings: $('#saveSettings'), resetSettings: $('#resetSettings'), toast: $('#toast')
  };

  let state={ templates:[], activeId:null, values:{}, mode:'gallery' };
  let settings = { ...DEFAULT_SETTINGS };
  let dirty=false;

  function applyTheme(){ const root=document.documentElement; const t=settings?.theme||'system'; if(t==='system'){ root.removeAttribute('data-theme'); } else { root.setAttribute('data-theme', t); } }
  function escHTML(s){
    const map={ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" };
    return String(s??'').replace(/[&<>"']/g, ch => map[ch]);
  }

  function embeddedDefaults(){
    return [
      {"id":"tpl-formal-writing","name":"书面材料英语（标题/正文 分场景）","content":"【任务】\n请将以下中文内容翻译为正式、精炼、用于汇报材料的英语。根据文本类型（{{type}}：Title/Body）采用不同精炼程度：\n- 若为 Title：给出3个精炼标题候选（尽量短、信息密度高、避免口语化）。\n- 若为 Body：以分点（1-3层级）方式精炼呈现，句式紧凑、动宾清晰、避免冗词。\n\n【输入】\n---\n{{source_text}}\n---\n\n【偏好】\n- 读者：{{audience}}（如 Senior Leadership/Stakeholders/Engineers）\n- 英语变体：{{english_variant}}（默认 American English）\n- 术语：保留行业术语并保持一致性（{{domain}}）\n\n【输出格式】\n1) Refined {{type}}（主版本）\n2) Alternative versions（2个）\n3) Notes（简要说明选择的措辞与取舍）","fields":[
        {"key":"type","label":"文本类型","type":"select","options":["Title","Body"],"allowCustom":true,"default":"Body","required":true},
        {"key":"audience","label":"读者类型","type":"select","options":["Senior Leadership","Stakeholders","Engineers"],"allowCustom":true,"default":"Senior Leadership"},
        {"key":"english_variant","label":"英语变体","type":"select","options":["American English","British English"],"allowCustom":false,"default":"American English"},
        {"key":"domain","label":"术语领域","type":"select","options":["Cloud","AI","Networking","Database"],"allowCustom":true,"default":"Cloud"},
        {"key":"source_text","label":"中文原文","type":"textarea","placeholder":"在此粘贴/输入中文正文…","required":true}
      ],"tmpChat":false},
      {"id":"tpl-conversation","name":"口语/即时沟通英语（含用法讲解）","content":"【任务】\n将以下中文转为地道、自然的英语表达，适合{{channel}}。\n- 若关系为 上级：请在措辞中保持尊重与主动性。\n- 若关系为 客户：请聚焦清晰、礼貌与交付承诺。\n\n【输入】\n---\n{{source_text}}\n---\n\n【偏好】\n- 英语变体：{{english_variant}}（默认 American English）\n- 关系：{{relationship}}（如 同事/客户/供应商/上级/朋友）\n\n【输出格式】\n1) English A / B / C\n2) 中文说明（使用场景、语气、常见搭配/替换表达）\n3) Mini phrasebook（3–5条可复用表达）","fields":[
        {"key":"channel","label":"沟通渠道","type":"select","options":["WhatsApp","口语沟通","邮件简讯"],"allowCustom":true,"default":"WhatsApp","required":true},
        {"key":"relationship","label":"关系类型","type":"select","options":["同事","客户","供应商","上级","朋友"],"allowCustom":true,"default":"同事"},
        {"key":"english_variant","label":"英语变体","type":"select","options":["American English","British English"],"allowCustom":false,"default":"American English"},
        {"key":"source_text","label":"中文原文","type":"textarea","placeholder":"要表达的中文内容，例如给同事的请假说明…","required":true}
      ],"tmpChat":false},
      {"id":"tpl-schedule","name":"设置提醒（ChatGPT 任务调度）","content":"你是一个能创建定时任务的助手。请根据下述信息，为我创建/更新一个提醒任务：\n【任务标题】{{title}}\n【提醒内容】{{reminder_message}}\n【时间/频率】{{schedule_human}}\n\n【如果你具备任务调度能力】\n- 请创建一个任务，并使用如下配置：\nTitle: {{title}}\nPrompt: Tell me to {{reminder_message}}\nSchedule (VEVENT):\nBEGIN:VEVENT\nRRULE:{{rrule}}\nEND:VEVENT\n\n【如果当前环境不支持自动创建任务】\n- 请输出一个 .ics 片段（VEVENT），并附中文说明手动导入日历的步骤。","fields":[
        {"key":"title","label":"任务标题","type":"text","placeholder":"如：每日站会提醒（可留空）"},
        {"key":"reminder_message","label":"提醒内容","type":"text","placeholder":"如：在 9:30 提醒我开始每日站会","required":true},
        {"key":"schedule_human","label":"时间/频率（自然语言）","type":"text","placeholder":"如：工作日每天 9:25 或 每周一 10:00","required":true},
        {"key":"rrule","label":"RRULE（高级，可留空）","type":"text","placeholder":"如：FREQ=WEEKLY;BYDAY=MO;BYHOUR=10;BYMINUTE=0"}
      ],"tmpChat":false},
      {"id":"tpl-tech-understanding","name":"技术理解与问题拆解（中文输出 + 术语英注）","content":"【目标】\n围绕我提供的问题，生成**中文**技术解析 + 解题路线图。遇到关键术语请使用**英文术语**并在首次出现时用括号标注，如：一致性（**consistency**）。\n\n【问题】\n{{problem_statement}}\n\n【上下文（可选）】\n- 领域：{{domain}}\n- 环境：{{environment}}\n- 现象：{{expected_vs_observed}}\n- 约束：{{constraints}}\n- 受众：{{audience}}\n\n【输出结构】\n1) TL;DR（≤5行要点）\n2) 概念图谱（关键概念/组件/数据流；可用列表或 ASCII/mermaid）\n3) 原理解析（先宏观，再微观，必要处举例）\n4) 解题步骤（可操作的检查/验证清单）\n5) 结合{{environment}}与{{constraints}}的具体建议\n6) 延伸阅读（官方/权威优先）\n\n【语言策略】\n- 最终输出语言：**中文**；术语首次出现时附英文（加粗）。","fields":[
        {"key":"problem_statement","label":"问题（中文）","type":"textarea","placeholder":"请粘贴你遇到的技术问题、上下文、错误日志片段…","required":true},
        {"key":"domain","label":"领域","type":"select","options":["Cloud","AI","Networking","Database","Security"],"allowCustom":true,"default":"Cloud"},
        {"key":"environment","label":"环境","type":"text","placeholder":"如：K8s on AKS, Istio 1.22, Region: East Asia"},
        {"key":"expected_vs_observed","label":"现象","type":"text","placeholder":"预期 vs 实际现象（可要点列出）"},
        {"key":"constraints","label":"约束","type":"text","placeholder":"如：只能读权限/无公网/必须零停机等"},
        {"key":"audience","label":"受众","type":"select","options":["初学者","中级工程师","架构师"],"allowCustom":true,"default":"中级工程师"}
      ],"tmpChat":false}
    ];
  }

  async function load(){
    try{
      const got = await storage.get({ templates:null, [SETTINGS_KEY]:DEFAULT_SETTINGS, [LAST_KEY]:null });
      const defs = embeddedDefaults();
      const tpl = Array.isArray(got.templates) && got.templates.length ? got.templates : defs;
      state.templates = tpl;
      settings = got[SETTINGS_KEY] ? got[SETTINGS_KEY] : { ...DEFAULT_SETTINGS };
      applyTheme();
    }catch(e){
      console.error('[PTS] load failed, using embedded defaults', e);
      state.templates = embeddedDefaults();
      settings = { ...DEFAULT_SETTINGS };
      applyTheme();
    }
  }
  function save(){ return storage.set({ templates: state.templates }); }
  function saveSettings(){ return storage.set({ [SETTINGS_KEY]: settings }); }
  async function saveLast(){ try{ await storage.set({ [LAST_KEY]: { activeId:state.activeId, mode:state.mode, values:state.values } }); }catch(e){} }
  async function loadLast(){ try{ const obj=await storage.get(LAST_KEY); return obj[LAST_KEY]||null; }catch(e){ return null; } }

  function setMode(m){
    state.mode=m;
    const g=$('#galleryView'), e=$('#editView'), f=$('#fillView'), s=$('#settingsView');
    if(g) g.classList.toggle('hidden', m!=='gallery');
    if(e) e.classList.toggle('hidden', m!=='edit');
    if(f) f.classList.toggle('hidden', m!=='fill');
    if(s) s.classList.toggle('hidden', m!=='settings');
    saveLast();
  }

  function placeholdersIn(text){ const set=new Set(); const re=/{{\s*([a-zA-Z0-9_]+)\s*}}/g; let m; while((m=re.exec(text||''))!==null) set.add(m[1]); return [...set]; }
  function renderPills(){ const p=$('#pills'); if(!p) return; const ph=placeholdersIn($('#content').value); p.innerHTML=ph.length?ph.map(k=>`<span class="pill">${k}</span>`).join(''):''; }

  function select(id){
    const t=state.templates.find(x=>x.id===id); if(!t) return;
    state.activeId=id; if($('#name')) $('#name').value=t.name||''; if($('#content')) $('#content').value=t.content||''; renderPills(); renderFieldsDesigner(); saveLast();
  }

  function renderGallery(){
    const cards=$('#cards'); if(!cards) return;
    const q=($('#search')?.value||'').trim().toLowerCase();
    const list=state.templates.filter(t=>!q||(t.name?.toLowerCase().includes(q)||t.content?.toLowerCase().includes(q)));
    cards.innerHTML='';
    if(!list.length){ cards.innerHTML='<div class="small">暂无模板，点击“新建”或右下角“恢复预置模板”。</div>'; return; }
    list.forEach(t=>{
      const card=document.createElement('div'); card.className='card clickable'; card.setAttribute('draggable','true'); card.dataset.id=t.id;
      card.innerHTML=`<h3>${escHTML(t.name||'(未命名)')}</h3><div class="small" style="margin-top:6px;"><a class="link" data-edit>编辑</a> · <a class="link" data-del>删除</a></div>`;
      card.addEventListener('click',(e)=>{ if(e.target.dataset.edit!==undefined||e.target.dataset.del!==undefined) return; select(t.id); openFill(true); });
      card.querySelector('[data-edit]').addEventListener('click',(e)=>{ e.stopPropagation(); select(t.id); openEdit(); });
      card.querySelector('[data-del]').addEventListener('click',async(e)=>{ e.stopPropagation(); if(confirm(`删除模板 “${t.name||'(未命名)'}”？`)){ await del(t.id); toast('已删除'); renderGallery(); }});
      cards.appendChild(card);
    });
  }

  function openEdit(){ dirty=false; setMode('edit'); }
  function openFill(keepValues){
    setMode('fill');
    const t=state.templates.find(x=>x.id===state.activeId)||{};
    if($('#fillTitle')) $('#fillTitle').textContent=t.name||'';
    if(!keepValues) state.values={};
    const inputs=$('#inputs'); if(inputs) inputs.innerHTML='';
    const fields = Array.isArray(t.fields)?t.fields:placeholdersIn(t.content).map(k=>({key:k,label:k,type:'text'}));
    fields.forEach(f=>{
      const row=document.createElement('div'); row.className='row' + (f.type==='textarea'?' ta':'');
      const lab=document.createElement('label'); lab.className='small'; lab.textContent=(f.label||f.key)+(f.required?' *':'');
      let control=null; const initial=(state.values[f.key]!=null)?state.values[f.key]:(f.default||'');
      if(f.type==='select'){
        const wrap=document.createElement('div'); wrap.className='select-wrap';
        const sel=document.createElement('select'); sel.className='control';
        const opts=Array.isArray(f.options)?f.options.slice():[];
        const initialVal=(initial||(f.default||(opts[0]||'')));
        opts.forEach(o=>{ const op=document.createElement('option'); op.value=o; op.textContent=o; sel.appendChild(op); });
        if(f.allowCustom){
          const sep=document.createElement('option'); sep.disabled=true; sep.textContent='──────────'; sel.appendChild(sep);
          const customOpt=document.createElement('option'); customOpt.value='__custom__'; customOpt.textContent='自定义…'; sel.appendChild(customOpt);
          const custom=document.createElement('input'); custom.className='control custom-input'; custom.type='text'; custom.placeholder='自定义…';
          wrap.appendChild(sel); wrap.appendChild(custom);
          sel.value = opts.includes(initialVal) ? initialVal : (initial ? '__custom__' : (opts[0]||''));
          if(sel.value==='__custom__'){ wrap.classList.add('active'); custom.value = initial; }
          function sync(){ if(sel.value==='__custom__'){ wrap.classList.add('active'); state.values[f.key]=custom.value.trim(); } else { wrap.classList.remove('active'); state.values[f.key]=sel.value; } updatePreview(); saveLast(); }
          sel.addEventListener('change', ()=>{ if(sel.value==='__custom__'){ wrap.classList.add('active'); custom.focus(); } sync(); });
          custom.addEventListener('input', sync);
        } else {
          wrap.appendChild(sel);
          sel.value = opts.includes(initialVal) ? initialVal : (opts[0]||'');
          sel.addEventListener('change', ()=>{ state.values[f.key]=sel.value; updatePreview(); saveLast(); });
        }
        control=wrap; state.values[f.key]=(f.allowCustom && sel.value==='__custom__')?initial:sel.value;
      }else if(f.type==='textarea'){
        const ta=document.createElement('textarea'); ta.className='control'; ta.placeholder=(f.placeholder||f.label||f.key); ta.value=initial;
        ta.addEventListener('input',()=>{ state.values[f.key]=ta.value; updatePreview(); saveLast(); });
        control=ta; state.values[f.key]=initial;
      }else{
        const inp=document.createElement('input'); inp.className='control'; inp.type='text'; inp.placeholder=(f.placeholder||f.label||f.key); inp.value=initial;
        inp.addEventListener('input',()=>{ state.values[f.key]=inp.value; updatePreview(); saveLast(); });
        control=inp; state.values[f.key]=initial;
      }
      row.appendChild(lab); row.appendChild(control); inputs.appendChild(row);
    });
    if($('#tmpChat')){ $('#tmpChat').checked=!!t.tmpChat; $('#tmpChat').onchange=()=>{ t.tmpChat=!!$('#tmpChat').checked; save(); }; }
    updatePreview(); saveLast();
  }

  function _escReg(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function computeFinalValues(){
    const t=state.templates.find(x=>x.id===state.activeId)||{};
    const fields=Array.isArray(t.fields)?t.fields:[];
    const vals={...state.values};
    fields.forEach(f=>{
      const cur=(vals[f.key]??'').toString().trim();
      if(!cur){
        if(f.type==='select' && Array.isArray(f.options) && f.options.length){ vals[f.key]=f.default||f.options[0]; }
        else if(typeof f.default==='string' && f.default){ vals[f.key]=f.default; }
        else vals[f.key]='';
      }
    });
    return vals;
  }
  function replaceByFields(text, fields, vals){
    let out=text||'';
    fields.forEach(f=>{ const re=new RegExp('{{\\s*'+_escReg(f.key)+'\\s*}}','g'); out=out.replace(re, (vals[f.key]??'')); });
    out = out.replace(/{{\s*[a-zA-Z0-9_]+\s*}}/g,''); return out;
  }
  function compressOptions(text){ return text.replace(/（([^）]*?)：[^）]*?）/g,'（$1）').replace(/\(([^)]*?):[^)]*?\)/g,'($1)'); }
  function renderPreview(){ const t=state.templates.find(x=>x.id===state.activeId)||{}; const fields=Array.isArray(t.fields)?t.fields:[]; const vals=computeFinalValues(); return compressOptions(replaceByFields(t.content, fields, vals)); }
  function renderFinal(){
    const t=state.templates.find(x=>x.id===state.activeId)||{}; const fields=Array.isArray(t.fields)?t.fields:[]; const vals=computeFinalValues();
    let out=replaceByFields(t.content, fields, vals);
    const lines=out.split('\n').map(l=>l);
    const typeVal=(vals.type||'').trim(); const relVal=(vals.relationship||'').trim();
    const filtered=lines.filter(line=>{
      const m=line.match(/^\s*[-•\u2022]?\s*若(关系)?为\s*(\S+)\s*[：:]/);
      if(!m) return true;
      const target = m[1]?relVal:typeVal; const val=m[2];
      return target && target===val;
    }).map(line=> line.replace(/^\s*[-•\u2022]?\s*若(关系)?为\s*\S+\s*[：:]/,'— '));
    const env=(vals.environment||'').trim(), cons=(vals.constraints||'').trim();
    let out2 = filtered.map(ln=>{
      if(/结合.*与.*的具体建议/.test(ln)){
        if(!env && !cons) return '';
        if(env && cons) return ln.replace(/结合.*与.*的具体建议/, `结合${env}与${cons}的具体建议`);
        if(env) return ln.replace(/结合.*与.*的具体建议/, `结合${env}的具体建议`);
        if(cons) return ln.replace(/结合.*与.*的具体建议/, `结合${cons}的具体建议`);
      }
      return ln;
    }).filter(Boolean).join('\n');
    out2=out2.replace(/{{\s*[^}]+\s*}}/g,'').replace(/\n{3,}/g,'\n\n').trim();
    return compressOptions(out2);
  }
  function updatePreview(){ if($('#preview')) $('#preview').value=renderPreview(); }
  function validateRequired(){
    const t=state.templates.find(x=>x.id===state.activeId)||{}; const fields=Array.isArray(t.fields)?t.fields:[]; const vals=computeFinalValues();
    const miss=fields.filter(f=>f.required).filter(f=>!vals[f.key]||!String(vals[f.key]).trim());
    if(miss.length){ throw new Error('必填项未填写：'+miss.map(f=>f.label||f.key).join('、')); }
    const final=renderFinal(); if(!final.trim()) throw new Error('生成结果为空，请检查模板或输入。');
  }
  async function del(id){ state.templates=state.templates.filter(t=>t.id!==id); await save(); }

  function safeSendMessage(payload, cb){
    try{
      if(!chrome?.runtime?.id){ cb && cb({ ok:false, error:'扩展未就绪' }); return; }
      chrome.runtime.sendMessage(payload, (res)=>{
        if(chrome.runtime.lastError){ cb && cb({ ok:false, error:chrome.runtime.lastError.message }); return; }
        cb && cb(res||{ ok:false });
      });
    }catch(e){ cb && cb({ ok:false, error:String(e) }); }
  }

  function onCopyOrInsert(act){
    try{
      validateRequired();
      let txt=renderFinal(); if(!txt.trim()) txt=renderPreview();
      const t=state.templates.find(x=>x.id===state.activeId)||{};
      const urls={ regular: settings.regularURL, temporary: settings.temporaryURL };
      if(act==='copy'){ navigator.clipboard.writeText(txt).then(()=>toast('已复制')); }
      else{
        toast('处理中…');
        safeSendMessage({ type:'INJECT_TO_CHATGPT', text:txt, send:(act==='send'), tmp:!!t.tmpChat, urls }, (res)=>{
          if(res?.ok){
            if(act==='send'){
              if(res.sent) toast(t.tmpChat?'已新开会话并发送':'已发送');
              else if(res.wrote) toast('已插入，但发送按钮不可用');
              else toast('注入失败（未找到输入框）');
            }else{ toast(res.wrote ? '已插入' : '注入失败（未找到输入框）'); }
          } else { toast(res?.error || '注入失败'); }
        });
      }
    }catch(e){ toast(e.message||String(e)); }
  }

  function renderFieldsDesigner(){
    const root=$('#fieldsDesigner'); if(!root) return;
    const t=state.templates.find(x=>x.id===state.activeId)||{}; const fields=Array.isArray(t.fields)?t.fields:[];
    root.innerHTML='';
    fields.forEach((f,idx)=>{
      const blk=document.createElement('div'); blk.className='field-block';
      const head=document.createElement('div'); head.className='field-head';
      const cap=document.createElement('div'); cap.className='cap'; cap.textContent='字段 '+(idx+1);
      const right=document.createElement('div'); right.className='right'; const del=document.createElement('button'); del.textContent='删除'; right.appendChild(del);
      head.appendChild(cap); head.appendChild(right); blk.appendChild(head);

      const mk = (label, html, role) => { const it=document.createElement('div'); it.className='field-item'; if(role) it.dataset.role=role; it.innerHTML=`<div class="sublabel">${label}</div>${html}`; return it; };
      const rowKey = mk('参数名', '<input data-k="key" class="control" type="text" placeholder="key（用于 {{key}} ）">');
      const rowLabel = mk('字段名称', '<input data-k="label" class="control" type="text" placeholder="显示名称（中文）">');
      const rowType = mk('字段类型', '<select data-k="type" class="control"><option value="text">Text</option><option value="textarea">Textarea</option><option value="select">Select</option></select>');
      const rowOptions = mk('候选项（逗号分隔，仅 Select）', '<input data-k="options" class="control" type="text" placeholder="如：Title, Body">', 'options');
      const rowDefault = mk('默认值（仅 Select）', '<input data-k="default" class="control" type="text" placeholder="默认值（可留空）">', 'default');
      const rowPlaceholder = mk('提示词（仅 Text/Textarea）', '<input data-k="placeholder" class="control" type="text" placeholder="如：在此输入…">', 'placeholder');
      const rowFlags = mk('开关', '<div class="field-flags"><label class="small"><input data-k="allowCustom" type="checkbox"> 允许自定义</label><label class="small"><input data-k="required" type="checkbox"> 必填</label></div>');

      blk.appendChild(rowKey);
      blk.appendChild(rowLabel);
      blk.appendChild(rowType);
      blk.appendChild(rowOptions);
      blk.appendChild(rowDefault);
      blk.appendChild(rowPlaceholder);
      blk.appendChild(rowFlags);

      // set initial values
      blk.querySelector('[data-k="key"]').value=f.key||'';
      blk.querySelector('[data-k="label"]').value=f.label||'';
      blk.querySelector('[data-k="type"]').value=f.type||'text';
      blk.querySelector('[data-k="options"]').value=Array.isArray(f.options)?f.options.join(','):'';
      blk.querySelector('[data-k="default"]').value=(f.default??'');
      blk.querySelector('[data-k="placeholder"]').value=(f.placeholder??'');
      blk.querySelector('[data-k="allowCustom"]').checked=!!f.allowCustom;
      blk.querySelector('[data-k="required"]').checked=!!f.required;

      function updateVisibility(){
        const curType = blk.querySelector('[data-k="type"]').value;
        const showSelect = (curType==='select');
        const showTextual = (curType==='text' || curType==='textarea');
        rowOptions.style.display = showSelect ? '' : 'none';
        rowDefault.style.display = showSelect ? '' : 'none';
        rowPlaceholder.style.display = showTextual ? '' : 'none';
      }

      function writeBack(){
        const rows=Array.from(document.querySelectorAll('.field-block'));
        const list=rows.map(r=>{
          const get=(k)=>r.querySelector(`[data-k="${k}"]`);
          const type=get('type').value;
          const field={ key:(get('key').value||'').trim(), label:(get('label').value||'').trim(), type, placeholder:(get('placeholder').value||'').trim(), allowCustom:!!get('allowCustom').checked, required:!!get('required').checked };
          if(type==='select'){ const optStr=(get('options').value||'').trim(); field.options=optStr?optStr.split(',').map(s=>s.trim()).filter(Boolean):[]; field.default=(get('default').value||'').trim(); }
          return field;
        });
        const t0=state.templates.find(x=>x.id===state.activeId); if(!t0) return; t0.fields=list; dirty=true;
      }
      blk.querySelectorAll('[data-k]').forEach(el=>{ el.addEventListener('input', writeBack); el.addEventListener('change', writeBack); });
      blk.querySelector('[data-k="type"]').addEventListener('change', ()=>{ updateVisibility(); writeBack(); });
      del.addEventListener('click', ()=>{ const t0=state.templates.find(x=>x.id===state.activeId); if(!t0) return; t0.fields.splice(idx,1); save().then(()=>{ renderFieldsDesigner(); toast('已删除字段'); }); });

      updateVisibility();
      root.appendChild(blk);
    });
  }
  function collectFields(){
    const rows=Array.from(document.querySelectorAll('.field-block'));
    return rows.map(r=>{
      const get=(k)=>r.querySelector(`[data-k="${k}"]`);
      const type=get('type').value;
      const field={ key:(get('key').value||'').trim(), label:(get('label').value||'').trim(), type, placeholder:(get('placeholder').value||'').trim(), allowCustom:!!get('allowCustom').checked, required:!!get('required').checked };
      if(type==='select'){ const optStr=(get('options').value||'').trim(); field.options=optStr?optStr.split(',').map(s=>s.trim()).filter(Boolean):[]; field.default=(get('default').value||'').trim(); }
      return field;
    });
  }

  function wire(){
    $('#search')?.addEventListener('input', ()=>{ renderGallery(); saveLast(); });
    $('#newBtn')?.addEventListener('click', ()=>{ const t={ id:crypto.randomUUID(), name:'', content:'', fields:[], tmpChat:false, createdAt:Date.now() }; state.templates.unshift(t); state.activeId=t.id; save().then(()=>{ select(t.id); openEdit(); }); });
    $('#settingsBtn')?.addEventListener('click', ()=>{ $('#provider').value=settings.provider; $('#backendRegular').value=settings.regularURL||''; $('#backendTemporary').value=settings.temporaryURL||''; $('#theme').value=settings.theme||'system'; setMode('settings'); });
    $('#back1')?.addEventListener('click', ()=>{ if(dirty){ if(confirm('是否保存当前更改？')){ $('#save')?.click(); return; } } setMode('gallery'); renderGallery(); });
    $('#back2')?.addEventListener('click', ()=>{ setMode('gallery'); renderGallery(); });
    $('#back3')?.addEventListener('click', ()=>{ setMode('gallery'); renderGallery(); });
    $('#save')?.addEventListener('click', async ()=>{
      const name=$('#name').value.trim(), content=$('#content').value;
      if(!name||!content){ toast('名称与内容均必填'); return; }
      const fields=collectFields();
      if(state.activeId){ const idx=state.templates.findIndex(t=>t.id===state.activeId);
        if(idx>=0){ state.templates[idx].name=name; state.templates[idx].content=content; state.templates[idx].fields=fields; state.templates[idx].createdAt=Date.now(); }
      }else{ state.templates.unshift({ id:crypto.randomUUID(), name, content, fields, tmpChat:false, createdAt:Date.now() }); state.activeId=state.templates[0].id; }
      await save(); dirty=false; openFill(true);
    });
    $('#cancel')?.addEventListener('click', ()=>{ if(dirty){ if(!confirm('放弃未保存的修改？')) return; } select(state.activeId); openFill(true); });
    $('#del')?.addEventListener('click', ()=>{ if(state.activeId&&confirm('删除此模板？')){ (async()=>{ await del(state.activeId); renderGallery(); setMode('gallery'); })(); }});
    $('#content')?.addEventListener('input', ()=>{ dirty=true; renderPills(); });
    $('#addField')?.addEventListener('click', ()=>{ const t=state.templates.find(x=>x.id===state.activeId); if(!t) return; t.fields.push({ key:'field_'+(t.fields.length+1), label:'字段'+(t.fields.length+1), type:'text', placeholder:'在此输入…', allowCustom:false, required:false }); dirty=true; renderFieldsDesigner(); });
    $('#importCode')?.addEventListener('click', ()=>{ $('#importArea')?.classList.remove('hidden'); $('#importActions')?.classList.remove('hidden'); });
    $('#importHelp')?.addEventListener('click', ()=>{ const sample={"name":"新场景","content":"【任务】\n请处理：{{thing}}\n【输入】\n{{input}}\n【输出】\n...","fields":[{"key":"thing","label":"事项","type":"select","options":["A","B","C"],"default":"A","allowCustom":true,"required":true},{"key":"input","label":"输入内容","type":"textarea","placeholder":"在此粘贴…"}]}; navigator.clipboard.writeText(JSON.stringify(sample,null,2)); toast('已复制示例 JSON'); });
    $('#parseImport')?.addEventListener('click', ()=>{ try{ const raw=($('#importText').value||''); const obj=JSON.parse(raw.replace(/\bTrue\b/g,'true').replace(/\bFalse\b/g,'false')); $('#name').value=obj.name||''; $('#content').value=obj.content||''; renderPills(); const t=state.templates.find(x=>x.id===state.activeId); if(!t) return; t.fields=Array.isArray(obj.fields)?obj.fields:[]; renderFieldsDesigner(); toast('已填充导入内容'); }catch(e){ toast('解析失败：'+e.message); } });
    $('#cancelImport')?.addEventListener('click', ()=>{ $('#importArea')?.classList.add('hidden'); $('#importActions')?.classList.add('hidden'); const ta=$('#importText'); if(ta) ta.value=''; });
    $('#copy')?.addEventListener('click', ()=>onCopyOrInsert('copy'));
    $('#insert')?.addEventListener('click', ()=>onCopyOrInsert('insert'));
    $('#send')?.addEventListener('click', ()=>onCopyOrInsert('send'));
    $('#clear')?.addEventListener('click', ()=>{ state.values={}; openFill(false); });
    $('#openSidePanel')?.addEventListener('click', ()=>{ 
      safeSendMessage({ type:'OPEN_SIDE_PANEL' }, (res)=>{
        if(!res?.ok){ toast(res?.error||'无法打开侧边栏'); }
      });
    });
    $('#resetDefaults')?.addEventListener('click', async ()=>{ if(confirm('将清空当前模板并恢复预置模板，是否继续？')){ await storage.set({ templates:null, [LAST_KEY]:null }); location.reload(); } });
    $('#provider')?.addEventListener('change', ()=>{ const p=$('#provider').value; const map={chatgpt:{regularURL:'https://chatgpt.com',temporaryURL:'https://chatgpt.com/?temporary-chat=true'},kimi:{regularURL:'https://www.kimi.com',temporaryURL:'https://www.kimi.com'},deepseek:{regularURL:'https://chat.deepseek.com',temporaryURL:'https://chat.deepseek.com'}}; $('#backendRegular').value=map[p].regularURL; $('#backendTemporary').value=map[p].temporaryURL; });
    $('#saveSettings')?.addEventListener('click', async ()=>{ settings.provider=$('#provider').value; const map={chatgpt:{regularURL:'https://chatgpt.com',temporaryURL:'https://chatgpt.com/?temporary-chat=true'},kimi:{regularURL:'https://www.kimi.com',temporaryURL:'https://www.kimi.com'},deepseek:{regularURL:'https://chat.deepseek.com',temporaryURL:'https://chat.deepseek.com'}}; const preset=map[settings.provider]||map.chatgpt; settings.regularURL=("#backendRegular" in window?$('#backendRegular').value:'')||$('#backendRegular').value; settings.regularURL=(settings.regularURL||'').trim()||preset.regularURL; settings.temporaryURL=(('#backendTemporary' in window?$('#backendTemporary').value:'')||$('#backendTemporary').value||'').trim()||preset.temporaryURL; settings.theme=$('#theme').value||'system'; await storage.set({ [SETTINGS_KEY]:settings }); applyTheme(); toast('已保存设置'); });
    $('#resetSettings')?.addEventListener('click', async ()=>{ settings={ ...DEFAULT_SETTINGS }; $('#provider').value=settings.provider; $('#backendRegular').value=settings.regularURL; $('#backendTemporary').value=settings.temporaryURL; $('#theme').value=settings.theme; await storage.set({ [SETTINGS_KEY]:settings }); const root=document.documentElement; root.removeAttribute('data-theme'); toast('已恢复默认'); });
  }

  async function init(){
    try{
      await load(); renderGallery(); wire();
      const last=await loadLast();
      if(last && last.activeId && state.templates.some(t=>t.id===last.activeId)){
        state.activeId=last.activeId; state.values=last.values||{};
        if(last.mode==='edit'){ select(state.activeId); openEdit(); }
        else if(last.mode==='fill'){ select(state.activeId); openFill(true); }
        else setMode('gallery');
      }
    }catch(e){
      console.error('[PTS] init fatal', e);
      state.templates = embeddedDefaults();
      renderGallery(); wire();
    }
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
