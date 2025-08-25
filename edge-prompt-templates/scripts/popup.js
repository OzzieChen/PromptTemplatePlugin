
// v2.11.2.1 - provider grid alignment + panel sync; scripts/popup.js
(function(){
  console.log('[PTS] popup v2.12.1.4 up');

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
  const VALUES_KEY='__values_by_tpl__';
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

  let state={ templates:[], activeId:null, values:{}, valuesByTpl:{}, mode:'gallery' };
  let settings = { ...DEFAULT_SETTINGS };
  let dirty=false;
  let draggingId=null;

  function applyTheme(){ const root=document.documentElement; const t=settings?.theme||'system'; if(t==='system'){ root.removeAttribute('data-theme'); } else { root.setAttribute('data-theme', t); } }
  function escHTML(s){
    const map={ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" };
    return String(s??'').replace(/[&<>"']/g, ch => map[ch]);
  }

  function embeddedDefaults(){
    return [
      {"id":"tpl-formal-writing","name":"英语翻译（书面）","content":"【任务】\n将以下中文内容翻译为正式、精炼的英语，严格贴合所选场景与类型。\n- 场景：{{scene}}\n- 类型：{{type}}（“标题”→仅输出高质量标题候选；“正文”→用条理清晰的分点表达）\n- 英语变体：{{english_variant}}\n- 术语领域：{{domain}}（术语前后一致）\n\n【输入】\n---\n{{source_text}}\n---\n\n【输出】\n1) 主版本（严格符合 {{scene}} 场景下，作为 {{type}} 的书面英语翻译）\n2) 可选替代版本（2 个）\n3) 说明（简述措辞取舍与风格选择）","fields":[
        {"key":"type","label":"类型","type":"select","options":["标题","正文"],"allowCustom":false,"default":"标题","required":true},
        {"key":"scene","label":"场景","type":"select","options":["PPT书面材料","正式邮件","IM沟通"],"allowCustom":true,"default":"PPT书面材料"},
        {"key":"english_variant","label":"英语变体","type":"select","options":["American English","British English"],"allowCustom":false,"default":"American English"},
        {"key":"domain","label":"术语领域","type":"select","options":["云计算","AI","生活场景（如酒店）"],"allowCustom":true,"default":"云计算"},
        {"key":"source_text","label":"中文原文","type":"textarea","placeholder":"在此粘贴/输入中文正文…","required":true}
      ],"tmpChat":false},
      {"id":"tpl-conversation","name":"英语翻译（口语）","content":"【任务】\n将以下中文改写为地道、自然的口语英语，确保语气与用词贴合：\n- 场景：{{scene}}\n- 关系类型：{{relationship}}\n- 英语变体：{{english_variant}}\n\n【输入】\n---\n{{source_text}}\n---\n\n【输出】\n1) 英语表达 A / B / C（分别给出不同风格或语气，但均符合上述场景/关系/变体）\n2) 中文要点（说明使用场景、语气建议、常见替代表达）\n3) Mini phrasebook（3–5 条可复用表达，便于迁移使用）","fields":[
        {"key":"scene","label":"场景","type":"select","options":["日常交流","IM沟通","邮件简讯"],"allowCustom":true,"default":"日常交流","required":false},
        {"key":"relationship","label":"关系类型","type":"select","options":["同事","客户","供应商（酒店、餐馆等）"],"allowCustom":true,"default":"同事"},
        {"key":"english_variant","label":"英语变体","type":"select","options":["American English","British English"],"allowCustom":false,"default":"American English"},
        {"key":"source_text","label":"中文原文","type":"textarea","placeholder":"要表达的中文内容，例如说明、致谢、请求…","required":true}
      ],"tmpChat":false},
      {"id":"tpl-tech-learning","name":"技术点学习","content":"【目标】\n围绕“技术点描述”进行分层讲解，帮助不同了解程度的读者建立正确的认知与心智模型。\n\n【技术点】\n{{topic}}\n\n【要求】\n- 领域：{{domain}}\n- 当前了解程度：{{level}}（据此控制深度/比喻/案例）\n\n【输出结构】\n1) TL;DR（≤5 行关键要点）\n2) 核心概念与名词解释（避免堆术语）\n3) 工作原理/数据流/组件关系（可用列表或简图）\n4) 实例/对比（结合 {{domain}} 的常见场景）\n5) 学习路径与实践建议（从{{level}}出发）\n6) 推荐资料（官方/权威优先）","fields":[
        {"key":"topic","label":"技术点描述","type":"textarea","placeholder":"请输入要学习的技术点…","required":true},
        {"key":"domain","label":"领域","type":"select","options":["云计算","AI","数据库","大数据"],"allowCustom":true,"default":"云计算"},
        {"key":"level","label":"了解程度","type":"select","options":["完全不了解","有基础了解","熟练理解","领域专家"],"allowCustom":true,"default":"有基础了解"}
      ],"tmpChat":false},
      {"id":"tpl-tech-troubleshooting","name":"问题处理","content":"【任务】\n基于下述信息输出可操作的中文排障方案与结论说明。遇到关键术语请附英文（首次出现时）。\n\n【问题】\n{{problem}}\n\n【上下文】\n- 领域：{{domain}}\n- 环境：{{environment}}\n- 预期/实际：{{expected_vs_observed}}\n- 约束：{{constraints}}\n- 受众：{{audience}}\n\n【输出结构】\n1) TL;DR（≤5 行）\n2) 根因假设与验证路径（按优先级）\n3) 详细排障步骤（命令/日志/指标，含预计结果）\n4) 结合 {{environment}} 与 {{constraints}} 的注意事项\n5) 对不同受众的表述建议（例如给客户/领导/工程师）","fields":[
        {"key":"problem","label":"问题描述","type":"textarea","placeholder":"请描述遇到的问题、上下文、错误信息…","required":true},
        {"key":"domain","label":"领域","type":"select","options":["云计算","AI","数据库","大数据"],"allowCustom":true,"default":"云计算"},
        {"key":"environment","label":"环境","type":"text","placeholder":"如：K8s on AKS, Istio 1.22, Region: East Asia"},
        {"key":"expected_vs_observed","label":"预期现象","type":"text","placeholder":"预期 vs 实际现象（可要点列出）"},
        {"key":"constraints","label":"约束","type":"text","placeholder":"如：只能读权限/无公网/必须零停机等"},
        {"key":"audience","label":"受众","type":"select","options":["初学者","中级工程师","高级架构师","客户答复"],"allowCustom":true,"default":"中级工程师"}
      ],"tmpChat":false},
      {"id":"tpl-english-comprehension","name":"英语理解","content":"【目标】\n帮助用户深入理解一段英语（单词/短语/句子/长难句），根据原文复杂度自适应输出。\n\n【英语原文】\n{{source_en}}\n\n【输出】\n- 若为单词/短语：给出中文释义、常见搭配与例句（≥3），区分词性/语境差异。\n- 若为普通句子：中文翻译 + 关键语法点简析（时态/从句/搭配）。\n- 若为长难句：中文翻译 + 句法树式拆解（主干/从句/修饰）+ 关键语法说明。\n- 常用表达：总结 5–8 条可迁移的表达或模式。\n- 学习建议：如何在相似语境下表达。","fields":[
        {"key":"source_en","label":"英语原文","type":"textarea","placeholder":"粘贴需要理解的英文单词/短语/句子…","required":true}
      ],"tmpChat":false}
    ];
  }

  async function load(){
    try{
      const got = await storage.get({ templates:null, [SETTINGS_KEY]:DEFAULT_SETTINGS, [LAST_KEY]:null, [VALUES_KEY]:{} });
      const defs = embeddedDefaults();
      const tpl = Array.isArray(got.templates) && got.templates.length ? got.templates : defs;
      state.templates = tpl;
      settings = got[SETTINGS_KEY] ? got[SETTINGS_KEY] : { ...DEFAULT_SETTINGS };
      state.valuesByTpl = got[VALUES_KEY] || {};
      applyTheme();
    }catch(e){
      console.error('[PTS] load failed, using embedded defaults', e);
      state.templates = embeddedDefaults();
      settings = { ...DEFAULT_SETTINGS };
      state.valuesByTpl = {};
      applyTheme();
    }
  }
  function save(){ return storage.set({ templates: state.templates }); }
  function saveSettings(){ return storage.set({ [SETTINGS_KEY]: settings }); }
  function saveValuesByTpl(){ try{ return storage.set({ [VALUES_KEY]: state.valuesByTpl }); }catch(e){ return Promise.resolve(false); } }
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
      card.querySelector('[data-del]').addEventListener('click',async(e)=>{ e.stopPropagation(); const ok = await showConfirm(`删除模板 “${t.name||'(未命名)'}”？`,`删除`,`取消`); if(ok){ await del(t.id); toast('已删除'); renderGallery(); }});

      // drag & drop sorting
      card.addEventListener('dragstart',(e)=>{
        draggingId = t.id;
        try{ e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed='move'; }catch(err){}
      });
      card.addEventListener('dragover',(e)=>{ e.preventDefault(); try{ e.dataTransfer.dropEffect='move'; }catch(err){} });
      card.addEventListener('drop',(e)=>{
        e.preventDefault();
        const fromId = draggingId || ((()=>{ try{ return e.dataTransfer.getData('text/plain'); }catch(err){ return ''; }})());
        const toId = t.id;
        draggingId = null;
        if(!fromId || !toId || fromId===toId) return;
        const arr = state.templates.slice();
        const fromIdx = arr.findIndex(x=>x.id===fromId);
        const toIdx = arr.findIndex(x=>x.id===toId);
        if(fromIdx<0 || toIdx<0) return;
        const [moved] = arr.splice(fromIdx,1);
        arr.splice(toIdx,0,moved);
        state.templates = arr;
        save().then(()=>{ renderGallery(); toast('已排序'); saveLast(); });
      });
      cards.appendChild(card);
    });
  }

  function openEdit(){ dirty=false; setMode('edit'); }
  function openFill(keepValues){
    setMode('fill');
    const t=state.templates.find(x=>x.id===state.activeId)||{};
    if($('#fillTitle')) $('#fillTitle').textContent=t.name||'';
    if(!keepValues){ state.values={}; }
    else { state.values = state.valuesByTpl[state.activeId] ? { ...state.valuesByTpl[state.activeId] } : {}; }
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
          function sync(){ if(sel.value==='__custom__'){ wrap.classList.add('active'); state.values[f.key]=custom.value.trim(); } else { wrap.classList.remove('active'); state.values[f.key]=sel.value; } state.valuesByTpl[state.activeId] = { ...state.values }; saveValuesByTpl(); updatePreview(); saveLast(); }
          sel.addEventListener('change', ()=>{ if(sel.value==='__custom__'){ wrap.classList.add('active'); custom.focus(); } sync(); });
          custom.addEventListener('input', sync);
        } else {
          wrap.appendChild(sel);
          sel.value = opts.includes(initialVal) ? initialVal : (opts[0]||'');
          sel.addEventListener('change', ()=>{ state.values[f.key]=sel.value; state.valuesByTpl[state.activeId] = { ...state.values }; saveValuesByTpl(); updatePreview(); saveLast(); });
        }
        control=wrap; state.values[f.key]=(f.allowCustom && sel.value==='__custom__')?initial:sel.value; state.valuesByTpl[state.activeId] = { ...state.values }; saveValuesByTpl();
      }else if(f.type==='textarea'){
        const ta=document.createElement('textarea'); ta.className='control'; ta.placeholder=(f.placeholder||f.label||f.key); ta.value=initial;
        ta.addEventListener('input',()=>{ state.values[f.key]=ta.value; state.valuesByTpl[state.activeId] = { ...state.values }; saveValuesByTpl(); updatePreview(); saveLast(); });
        control=ta; state.values[f.key]=initial; state.valuesByTpl[state.activeId] = { ...state.values }; saveValuesByTpl();
      }else{
        const inp=document.createElement('input'); inp.className='control'; inp.type='text'; inp.placeholder=(f.placeholder||f.label||f.key); inp.value=initial;
        inp.addEventListener('input',()=>{ state.values[f.key]=inp.value; state.valuesByTpl[state.activeId] = { ...state.values }; saveValuesByTpl(); updatePreview(); saveLast(); });
        control=inp; state.values[f.key]=initial; state.valuesByTpl[state.activeId] = { ...state.values }; saveValuesByTpl();
      }
      row.appendChild(lab); row.appendChild(control); inputs.appendChild(row);
    });
    if($('#tmpChat')){ $('#tmpChat').checked=!!t.tmpChat; $('#tmpChat').onchange=()=>{ t.tmpChat=!!$('#tmpChat').checked; save(); }; }
    const tmpRow=document.getElementById('tmpRow');
    if(tmpRow){
      const pv=(settings?.provider)||'chatgpt';
      const showTmp = (pv==='chatgpt') || (pv==='custom' && (settings?.temporaryURL||'').trim());
      tmpRow.style.display = showTmp ? '' : 'none';
    }
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
    const filtered = (typeVal || relVal)
      ? lines.filter(line=>{
          const m=line.match(/^\s*[-•\u2022]?\s*若(关系)?为\s*(\S+)\s*[：:]/);
          if(!m) return true;
          const target = m[1]?relVal:typeVal; const val=m[2];
          return target && target===val;
        }).map(line=> line.replace(/^\s*[-•\u2022]?\s*若(关系)?为\s*\S+\s*[：:]/,'— '))
      : lines;
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

  function showConfirm(message, okText, cancelText){
    return new Promise(resolve=>{
      try{
        const overlay=document.createElement('div');
        overlay.className='overlay show';
        overlay.id='__pts_confirm_overlay__';
        const modal=document.createElement('div');
        modal.className='modal';
        modal.innerHTML = `\n        <h3 style="margin:0 0 8px 0;font-size:16px">提示</h3>\n        <div class="body" style="margin-top:8px">${message||''}</div>\n        <div class="actions" style="margin-top:12px;display:flex;gap:10px;justify-content:flex-end;align-items:center">\n          <button id="__pts_confirm_cancel__">${cancelText||'取消'}</button>\n          <button id="__pts_confirm_ok__" class="primary">${okText||'确定'}</button>\n        </div>\n      `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        const cleanup=()=>{ try{ document.body.removeChild(overlay); }catch(e){} };
        const onOk=()=>{ cleanup(); resolve(true); };
        const onCancel=()=>{ cleanup(); resolve(false); };
        modal.querySelector('#__pts_confirm_ok__')?.addEventListener('click', onOk);
        modal.querySelector('#__pts_confirm_cancel__')?.addEventListener('click', onCancel);
        overlay.addEventListener('click', (e)=>{ if(e.target===overlay) onCancel(); });
        function onKey(e){ if(e.key==='Escape'){ document.removeEventListener('keydown', onKey); onCancel(); } }
        document.addEventListener('keydown', onKey);
      }catch(e){ resolve(window.confirm(message||'')===true); }
    });
  }

  function wire(){
    $('#search')?.addEventListener('input', ()=>{ renderGallery(); saveLast(); });
    $('#newBtn')?.addEventListener('click', ()=>{ const t={ id:crypto.randomUUID(), name:'', content:'', fields:[], tmpChat:false, createdAt:Date.now() }; state.templates.unshift(t); state.activeId=t.id; save().then(()=>{ select(t.id); openEdit(); }); });
    $('#settingsBtn')?.addEventListener('click', ()=>{ 
      setMode('settings');
      try{ typeof applyProviderSelection==='function' && applyProviderSelection(settings.provider||'chatgpt'); }catch(e){}
      const isCustom = (settings.provider==='custom');
      if($('#backendRegular')) $('#backendRegular').value = isCustom ? (settings.regularURL||'') : '';
      if($('#backendTemporary')) $('#backendTemporary').value = isCustom ? (settings.temporaryURL||'') : '';
      const tick=document.getElementById('providerCustomTick'); if(tick) tick.style.display = isCustom ? 'inline-flex' : 'none';
      if($('#theme')) $('#theme').value = settings.theme || 'system';
      try{ window.__settingsPrevSnapshot__ = JSON.parse(JSON.stringify(settings)); }catch(e){ window.__settingsPrevSnapshot__ = { ...settings }; }
    });
    $('#back1')?.addEventListener('click', async ()=>{ if(dirty){ const ok = await showConfirm('是否保存当前更改？','保存','不保存'); if(ok){ $('#save')?.click(); return; } } setMode('gallery'); renderGallery(); });
    $('#back3')?.addEventListener('click', async ()=>{
      const prev = window.__settingsPrevSnapshot__ || { ...settings };
      const cur = {
        provider: settings.provider,
        regularURL: (settings.provider==='custom') ? ($('#backendRegular')?.value||'').trim() : settings.regularURL,
        temporaryURL: (settings.provider==='custom') ? ($('#backendTemporary')?.value||'').trim() : settings.temporaryURL,
        theme: ($('#theme')?.value||settings.theme)
      };
      const hasChanges = (prev.provider!==settings.provider) || (prev.theme!==cur.theme) || (prev.regularURL!==cur.regularURL) || (prev.temporaryURL!==cur.temporaryURL);
      if(settings.provider==='custom' && !cur.regularURL){
        showConfirm('缺少必填项：常规会话 URL。确认放弃并返回？','放弃','取消').then(ok=>{
          if(!ok){ return; }
          // restore previous snapshot and exit settings
          settings = { ...prev };
          if($('#backendRegular')) $('#backendRegular').value = '';
          if($('#backendTemporary')) $('#backendTemporary').value = '';
          setMode('gallery'); renderGallery();
        });
        return;
      }
      if(hasChanges){
        const ok = await showConfirm('是否保存更改？','保存','不保存');
        if(ok){
          if(settings.provider==='custom'){
            settings.regularURL = cur.regularURL;
            settings.temporaryURL = cur.temporaryURL;
          }
          settings.theme = cur.theme;
          saveSettings().then(()=>{ applyTheme(); setMode('gallery'); renderGallery(); });
        } else {
          // discard UI edits, restore previous snapshot
          settings = { ...prev };
          setMode('gallery'); renderGallery();
        }
        return;
      }
      setMode('gallery'); renderGallery();
    });
    $('#back2')?.addEventListener('click', ()=>{ setMode('gallery'); renderGallery(); });
    $('#save')?.addEventListener('click', async ()=>{
      const name=$('#name').value.trim(), content=$('#content').value;
      if(!name||!content){ toast('名称与内容均必填'); return; }
      const fields=collectFields();
      if(state.activeId){ const idx=state.templates.findIndex(t=>t.id===state.activeId);
        if(idx>=0){ state.templates[idx].name=name; state.templates[idx].content=content; state.templates[idx].fields=fields; state.templates[idx].createdAt=Date.now(); }
      }else{ state.templates.unshift({ id:crypto.randomUUID(), name, content, fields, tmpChat:false, createdAt:Date.now() }); state.activeId=state.templates[0].id; }
      await save(); dirty=false; openFill(true);
    });
    $('#cancel')?.addEventListener('click', async ()=>{ if(dirty){ const ok = await showConfirm('放弃未保存的修改？','放弃','取消'); if(!ok) return; } select(state.activeId); openFill(true); });
    $('#del')?.addEventListener('click', async ()=>{ if(state.activeId){ const ok = await showConfirm('删除此模板？','删除','取消'); if(ok){ await del(state.activeId); renderGallery(); setMode('gallery'); } }});
    $('#content')?.addEventListener('input', ()=>{ dirty=true; renderPills(); });
    $('#addField')?.addEventListener('click', ()=>{ const t=state.templates.find(x=>x.id===state.activeId); if(!t) return; t.fields.push({ key:'field_'+(t.fields.length+1), label:'字段'+(t.fields.length+1), type:'text', placeholder:'在此输入…', allowCustom:false, required:false }); dirty=true; renderFieldsDesigner(); });

    // New import modal
    const overlay=$('#importOverlay');
    const container = document.querySelector('.container');
    const openImport=()=>{
      if(!overlay) return;
      overlay.classList.add('show');
      overlay.setAttribute('aria-hidden','false');
      container?.setAttribute('inert','');
      setTimeout(()=>{ try{ $('#modalImportText')?.focus(); }catch(e){} }, 0);
    };
    const closeImport=()=>{
      if(!overlay) return;
      overlay.classList.remove('show');
      overlay.setAttribute('aria-hidden','true');
      container?.removeAttribute('inert');
      const ta=$('#modalImportText'); if(ta) ta.value='';
    };
    $('#openImportModal')?.addEventListener('click', openImport);
    $('#modalCancel')?.addEventListener('click', closeImport);
    $('#modalParse')?.addEventListener('click', ()=>{
      try{
        const raw=($('#modalImportText').value||'');
        const obj=JSON.parse(raw.replace(/\bTrue\b/g,'true').replace(/\bFalse\b/g,'false'));
        $('#name').value=obj.name||'';
        $('#content').value=obj.content||'';
        renderPills();
        const t=state.templates.find(x=>x.id===state.activeId); if(t){ t.fields=Array.isArray(obj.fields)?obj.fields:[]; renderFieldsDesigner(); }
        toast('已填充导入内容');
        closeImport();
      }catch(e){ toast('解析失败：'+(e.message||e)); }
    });
    $('#modalHelp')?.addEventListener('click', ()=>{
      const sample={
        name:"新场景（请改为你的场景名称）",
        content:
"【说明】\n这是一个 Prompt 模板文件，用于在扩展中作为“内容模板”。\n- content 字段是整体提示词正文，支持 {{key}} 占位符；\n- fields 数组定义了可填参数（类型、标签、默认值等）；\n- 支持的类型：text（单行文本）/ textarea（多行文本）/ select（下拉选项，支持 options 与 default）；\n\n【任务】\n请处理：{{thing}}\n【输入】\n主题：{{title}}\n正文：{{input}}\n【输出】\n……（在此描述你希望模型输出的结构）\n\n【注意】\n- 若需要条件分支，可在 content 用自然语言标注，例如“若为 X：…”。\n- 解析后可在插件中“插入/插入并发送”。",
        fields:[
          { key:"thing", label:"事项", type:"select", options:["A","B","C"], default:"A", allowCustom:true, required:true },
          { key:"title", label:"主题标题", type:"text", placeholder:"一句话主题", required:false },
          { key:"input", label:"输入内容", type:"textarea", placeholder:"在此粘贴…", required:true }
        ]
      };
      navigator.clipboard.writeText(JSON.stringify(sample, null, 2)).then(()=>{
        const helpEl = document.getElementById('modalHelp');
        if(helpEl){ helpEl.setAttribute('title','复制样例代码'); }
        toast('已复制样例代码：可直接发给 ChatGPT 生成你的模板');
      }).catch(()=> toast('复制失败'));
    });

    $('#copy')?.addEventListener('click', ()=>onCopyOrInsert('copy'));
    $('#insert')?.addEventListener('click', ()=>onCopyOrInsert('insert'));
    $('#send')?.addEventListener('click', ()=>onCopyOrInsert('send'));
    $('#clear')?.addEventListener('click', ()=>{ state.values={}; openFill(false); });
    $('#openSidePanel')?.addEventListener('click', ()=>{ 
      safeSendMessage({ type:'OPEN_SIDE_PANEL' }, (res)=>{
        if(!res?.ok){ toast(res?.error||'无法打开侧边栏'); }
      });
    });
    $('#resetDefaults')?.addEventListener('click', async ()=>{ const ok = await showConfirm('将清空当前模板并恢复预置模板，是否继续？','继续','取消'); if(ok){ await storage.set({ templates:null, [LAST_KEY]:null }); location.reload(); } });
    // Provider cards
    const providerMap = {
      chatgpt: { regularURL:'https://chatgpt.com', temporaryURL:'https://chatgpt.com/?temporary-chat=true' },
      kimi: { regularURL:'https://www.kimi.com', temporaryURL:'https://www.kimi.com' },
      deepseek: { regularURL:'https://chat.deepseek.com', temporaryURL:'https://chat.deepseek.com' },
      perplexity: { regularURL:'https://www.perplexity.ai', temporaryURL:'https://www.perplexity.ai' }
    };
    function applyProviderSelection(pv){
      const cards = Array.from(document.querySelectorAll('.provider-card'));
      cards.forEach(c=> c.classList.toggle('active', c.dataset.pv===pv));
      if(pv==='custom'){
        $('#customUrlRows')?.classList.remove('hidden');
        const tick=document.getElementById('providerCustomTick'); if(tick) tick.style.display='inline-flex';
      }else{
        $('#customUrlRows')?.classList.add('hidden');
        const tick=document.getElementById('providerCustomTick'); if(tick) tick.style.display='none';
        const preset = providerMap[pv]||providerMap.chatgpt;
        settings.regularURL = preset.regularURL;
        settings.temporaryURL = preset.temporaryURL;
      }
      settings.provider = pv;
    }
    const cardsRoot = $('#providerCards');
    if(cardsRoot){
      cardsRoot.addEventListener('click',(e)=>{
        const btn = e.target.closest('.provider-card');
        if(!btn) return;
        applyProviderSelection(btn.dataset.pv);
        const tmpRow=document.getElementById('tmpRow');
        if(tmpRow){ const pv=btn.dataset.pv; const showTmp = (pv==='chatgpt') || (pv==='custom' && (settings?.temporaryURL||'').trim()); tmpRow.style.display = showTmp ? '' : 'none'; }
      });
      // init selection
      applyProviderSelection(settings.provider||'chatgpt');
    }
    $('#providerCustomLink')?.addEventListener('click', ()=> applyProviderSelection('custom'));
    $('#saveSettings')?.addEventListener('click', async ()=>{
      if(settings.provider==='custom'){
        settings.regularURL = ($('#backendRegular').value||'').trim();
        settings.temporaryURL = ($('#backendTemporary').value||'').trim();
      }
      settings.theme=$('#theme').value||'system';
      await storage.set({ [SETTINGS_KEY]:settings });
      // update tmp toggle visibility
      const tmpRow=document.getElementById('tmpRow');
      if(tmpRow){ const pv=settings.provider; const showTmp = (pv==='chatgpt') || (pv==='custom' && (settings?.temporaryURL||'').trim()); tmpRow.style.display = showTmp ? '' : 'none'; }
      try{ window.__settingsPrevSnapshot__ = JSON.parse(JSON.stringify(settings)); }catch(e){ window.__settingsPrevSnapshot__ = { ...settings }; }
      applyTheme(); toast('已保存设置');
    });
    $('#resetSettings')?.addEventListener('click', async ()=>{ 
      settings={ ...DEFAULT_SETTINGS }; 
      await storage.set({ [SETTINGS_KEY]:settings }); 
      try{ typeof applyProviderSelection==='function' && applyProviderSelection(settings.provider||'chatgpt'); }catch(e){}
      if($('#backendRegular')) $('#backendRegular').value='';
      if($('#backendTemporary')) $('#backendTemporary').value='';
      if($('#theme')) $('#theme').value=settings.theme;
      const root=document.documentElement; root.removeAttribute('data-theme'); 
      toast('已恢复默认'); 
    });
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
