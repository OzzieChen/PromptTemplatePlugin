
console.log('[PTS] background v2.11.1 up');
function execOnTab(tabId, args, func){
  return new Promise((resolve)=>{
    try{
      chrome.scripting.executeScript({ target:{tabId}, world:'MAIN', args, func }, (res)=>{
        if(chrome.runtime.lastError){ resolve({ok:false, error:chrome.runtime.lastError.message}); return; }
        try{ const r = res && res[0] ? res[0].result : null; resolve(r || { ok:false }); }
        catch(e){ resolve({ ok:false, error:String(e) }); }
      });
    }catch(e){ resolve({ ok:false, error:String(e) }); }
  });
}
async function injectFlow(tabId, text, doSend){
  const res = await execOnTab(tabId, [text, !!doSend], async (text, doSend)=>{
    const EDITABLE = [
      'textarea#prompt-textarea',
      'textarea[data-testid="prompt-textarea"]',
      'form textarea',
      'div[data-testid="composer"] textarea',
      'div[data-testid="prompt-textarea"]',
      'textarea[placeholder*="Message"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      '[role="textbox"]',
      'textarea',
      'input[type="text"]',
      'input[type="search"]'
    ];
    const SEND = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send"]',
      'button[aria-label="Send message"]',
      'button[aria-label*="发送"]',
      'button[aria-label*="送出"]',
      'button[aria-label*="发送消息"]',
      'button[aria-label*="send" i]',
      'button[type="submit"]',
      'form button:not([disabled])'
    ];
    function findEditable(root){
      const visited=new Set();
      function dfs(node){
        if(!node || visited.has(node)) return null;
        visited.add(node);
        for(const sel of EDITABLE){ try{ const el=node.querySelector?.(sel); if(el && el.offsetParent!==null) return el; }catch(e){} }
        const all=node.querySelectorAll?node.querySelectorAll('*'):[];
        for(const n of all){
          if(n.shadowRoot){ const e=dfs(n.shadowRoot); if(e) return e; }
          if(n.tagName==='IFRAME'){ try{ const e=dfs(n.contentDocument); if(e) return e; }catch(e){} }
        }
        return null;
      }
      return dfs(root||document);
    }
    function isEditable(el){
      if(!el) return false;
      const tag=(el.tagName||'').toLowerCase();
      if(tag==='textarea' || tag==='input') return true;
      if(el.getAttribute && el.getAttribute('contenteditable')==='true') return true;
      return false;
    }
    function setNativeValueAndEvents(el, val){
      if(!el) return false;
      const tag=(el.tagName||'').toLowerCase();
      try{
        if(tag==='textarea' || tag==='input'){
          el.dispatchEvent(new InputEvent('beforeinput', { bubbles:true, inputType:'insertFromPaste', data:val }));
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set
            || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
          if(setter){ setter.call(el, val); }
          else { el.value = val; }
          el.focus();
          el.dispatchEvent(new InputEvent('input', { bubbles:true, data:val }));
          el.dispatchEvent(new Event('change', { bubbles:true }));
          return true;
        }
        if(el.getAttribute && el.getAttribute('contenteditable')==='true'){
          el.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, val);
          el.dispatchEvent(new Event('input', { bubbles:true }));
          el.dispatchEvent(new Event('change', { bubbles:true }));
          return true;
        }
        return false;
      }catch(e){ return false; }
    }
    function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
    async function trySend(inputEl){
      const docs=[document];
      document.querySelectorAll('iframe').forEach(ifr=>{ try{ if(ifr.contentDocument) docs.push(ifr.contentDocument); }catch(e){} });
      for(const doc of docs){
        for(const sel of SEND){
          try{
            const btn=doc.querySelector(sel);
            if(btn && !btn.disabled){ btn.click(); return true; }
            const nodes=doc.querySelectorAll('*');
            for(const n of nodes){
              if(n.shadowRoot){
                const sb=n.shadowRoot.querySelector(sel);
                if(sb && !sb.disabled){ sb.click(); return true; }
              }
            }
          }catch(e){}
        }
      }
      try{
        inputEl?.focus();
        const k={key:'Enter',code:'Enter',which:13,keyCode:13,bubbles:true};
        (inputEl||document.activeElement)?.dispatchEvent(new KeyboardEvent('keydown', k));
        (inputEl||document.activeElement)?.dispatchEvent(new KeyboardEvent('keypress', k));
        (inputEl||document.activeElement)?.dispatchEvent(new KeyboardEvent('keyup', k));
        if(inputEl && inputEl.form){ inputEl.form.requestSubmit?.(); inputEl.form.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })); }
        return true;
      }catch(e){}
      return false;
    }
    async function waitForComposer(ms=30000){
      const start=Date.now();
      return await new Promise((resolve)=>{
        const tick=()=>{
          const found=findEditable(document);
          const el = found || (document.activeElement && isEditable(document.activeElement) ? document.activeElement : null);
          if(el){ resolve(el); return; }
          if(Date.now()-start>ms){ resolve(null); return; }
          setTimeout(tick, 300);
        }; setTimeout(tick, 300);
      });
    }
    const el = await waitForComposer(30000);
    const wrote = !!el && setNativeValueAndEvents(el, text);
    let sent = false;
    if(wrote && doSend){ await sleep(300); sent = await trySend(el); }
    return { ok: wrote || sent, wrote, sent };
  });
  if(res && (res.wrote || res.sent)) return res;
  // guarded content-script fallback
  try{
    const t = await new Promise((resolve)=>{ try{ chrome.tabs.get(tabId, (tab)=>resolve(tab||null)); }catch(e){ resolve(null); } });
    const okHost = t?.url && /^(https:\/\/)(chatgpt\.com|chat\.openai\.com|www\.kimi\.com|kimi\.moonshot\.cn|chat\.deepseek\.com)\//.test(t.url);
    if(!okHost) return res || { ok:false };
    const r = await new Promise((resolve)=>{
      try{
        chrome.tabs.sendMessage(tabId, { type:'FILL_AND_SEND', text, send:!!doSend }, (rr)=>{
          if(chrome.runtime.lastError){ resolve({ ok:false }); return; }
          resolve(rr||{ ok:false });
        });
      }catch(e){ resolve({ ok:false }); }
    });
    return r || { ok:false };
  }catch(e){ return res || { ok:false, error:String(e) }; }
}

function hostGroupFromUrl(u){
  try{
    const h=new URL(u).host;
    if(h==='chatgpt.com' || h==='chat.openai.com') return 'chatgpt';
    if(h==='www.kimi.com' || h==='kimi.moonshot.cn') return 'kimi';
    if(h==='chat.deepseek.com') return 'deepseek';
    return h;
  }catch(e){ return ''; }
}
function sameEngine(u1, u2){ return hostGroupFromUrl(u1) === hostGroupFromUrl(u2); }
function isTemporaryUrl(u){
  try{
    const url = new URL(u);
    const grp = hostGroupFromUrl(u);
    if(grp==='chatgpt') return url.searchParams.get('temporary-chat') === 'true';
    return false;
  }catch(e){ return false; }
}
async function ensureOpenAndInject(primary, text, doSend, preferTemporary){
  try{
    async function retryInject(tabId, tries=4, gap=500){
      for(let i=0;i<tries;i++){
        const r = await injectFlow(tabId, text, doSend);
        if(r && (r.wrote||r.sent)) return r;
        await new Promise(res=>setTimeout(res, gap));
      }
      return null;
    }
    // Prefer existing tabs first, respecting temporary preference
    try{
      const allTabs = await chrome.tabs.query({});
      const lastWin = await chrome.windows.getLastFocused({ populate:false }).catch(()=>null);
      const tabsSameEngine = allTabs.filter(t=> t.url && sameEngine(t.url, primary));
      const tempTabs = tabsSameEngine.filter(t=> isTemporaryUrl(t.url));
      const regTabs = tabsSameEngine.filter(t=> !isTemporaryUrl(t.url));
      const order = preferTemporary ? [...tempTabs, ...regTabs] : [...regTabs, ...tempTabs];
      order.sort((a,b)=>{
        const aL = (lastWin && a.windowId===lastWin.id) ? 1:0;
        const bL = (lastWin && b.windowId===lastWin.id) ? 1:0;
        const aA = a.active ? 1:0; const bA = b.active ? 1:0;
        return (bL - aL) || (bA - aA) || 0;
      });
      for(const t of order){
        if(preferTemporary && !isTemporaryUrl(t.url)) break; // do not inject regular when temp requested
        try{ await chrome.windows.update(t.windowId, { focused:true }); }catch(e){}
        try{ await chrome.tabs.update(t.id, { active:true }); }catch(e){}
        const r = await retryInject(t.id, 4, 500);
        if(r && (r.wrote||r.sent)) return r;
      }
    }catch(e){}
    // open new window or tab and inject with retries to the requested primary URL
    const openAndWait = () => new Promise((resolve)=>{
      const onReady = (tabId) => {
        let attempts = 0;
        const maxAttempts = 6;
        const tick = async () => {
          attempts++;
          const rr = await injectFlow(tabId, text, doSend);
          if(rr && (rr.wrote||rr.sent)){ resolve(rr); return; }
          if(attempts>=maxAttempts){ resolve(rr||{ok:false}); return; }
          setTimeout(tick, 700);
        };
        setTimeout(tick, 900);
      };
      const fallbackToTab = () => {
        chrome.tabs.create({ url: primary, active: true }, (nt)=>{ if(nt?.id) onReady(nt.id); else resolve({ ok:false, error:'无法创建标签页' }); });
      };
      try{
        if(chrome.windows?.create){
          chrome.windows.create({ url: primary, focused: true, type: 'normal', populate: true }, (win)=>{
            if(chrome.runtime.lastError || !win){ fallbackToTab(); return; }
            const tab = (win.tabs && win.tabs[0]) ? win.tabs[0] : null;
            if(tab?.id) onReady(tab.id); else fallbackToTab();
          });
        } else { fallbackToTab(); }
      }catch(e){ fallbackToTab(); }
    });
    return await openAndWait();
  }catch(e){ return { ok:false, error:String(e) }; }
}
chrome.runtime.onMessage.addListener((m, s, send)=>{
  if(m?.type==='OPEN_SIDE_PANEL'){
    (async ()=>{
      try{
        const [t]=await chrome.tabs.query({active:true,currentWindow:true});
        if(chrome.sidePanel?.open && t?.id){ await chrome.sidePanel.open({tabId:t.id}); send({ok:true}); }
        else{ chrome.windows.create({url:chrome.runtime.getURL('panel.html'), type:'popup', width:560, height:780}, ()=>send({ok:true, fallback:true})); }
      }catch(e){ send({ok:false,error:String(e)}); }
    })(); return true;
  }
  if(m?.type==='INJECT_TO_CHATGPT'){
    (async ()=>{
      try{
        const text = m.text||''; const doSend = !!m.send; const temp = !!m.tmp;
        const urls = m.urls || {};
        let regular = urls.regular || 'https://chatgpt.com';
        let temporary = urls.temporary || 'https://chatgpt.com/?temporary-chat=true';
        const isChatgptGroup = (u)=>{ try{ const h=new URL(u).host; return (h==='chatgpt.com'||h==='chat.openai.com'); }catch(e){ return false; } };
        const candidates = [];
        if(isChatgptGroup(regular)){
          const prim = temp ? temporary : regular;
          const primHost = new URL(prim).host;
          const altHost = primHost==='chatgpt.com' ? 'chat.openai.com' : 'chatgpt.com';
          const alt = prim.replace(primHost, altHost);
          candidates.push(prim);
          if(alt!==prim) candidates.push(alt);
          if(temp){
            const regPrim = regular;
            const regAlt = regPrim.replace(new URL(regPrim).host, altHost);
            if(!candidates.includes(regPrim)) candidates.push(regPrim);
            if(!candidates.includes(regAlt)) candidates.push(regAlt);
          }
        } else {
          candidates.push(temp ? temporary : regular);
        }
        let res=null;
        for(const url of candidates){
          const preferTemp = temp && isChatgptGroup(url);
          res = await ensureOpenAndInject(url, text, doSend, preferTemp);
          if(res && (res.wrote||res.sent)) break;
        }
        send(res && (res.wrote || res.sent) ? { ok:true, wrote:!!res.wrote, sent:!!res.sent } : { ok:false, error:'注入失败（未找到输入框或发送失败）' });
      }catch(e){ send({ok:false,error:String(e)}); }
    })(); return true;
  }
});
