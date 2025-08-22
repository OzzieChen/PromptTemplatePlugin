
console.log('[PTS] background v2.4.8 up');
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
  // keep original executeScript path; add fallback to content script messaging if wrote is false
  const res = await execOnTab(tabId, [text, !!doSend], async (text, doSend)=>{
    const EDITABLE = [
      'textarea#prompt-textarea',
      'textarea[data-testid="prompt-textarea"]',
      'form textarea',
      'div[data-testid="composer"] textarea',
      'textarea[placeholder*="Message"]',
      'div[contenteditable="true"][role="textbox"]',
      '[role="textbox"]',
      'textarea'
    ];
    const SEND = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send"]',
      'button[aria-label="Send message"]',
      'button[aria-label*="发送"]',
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
    function clearDrafts(){
      try{
        const ls = window.localStorage;
        const keys = [];
        for(let i=0;i<ls.length;i++){
          const k = ls.key(i) || '';
          if(/(draft|input|composer|prompt|oai|chatgpt)/i.test(k)) keys.push(k);
        }
        keys.forEach(k=>ls.removeItem(k));
      }catch(e){}
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
    async function waitForComposer(ms=24000){
      const start=Date.now();
      return await new Promise((resolve)=>{
        const tick=()=>{
          const el=findEditable(document);
          if(el){ resolve(el); return; }
          if(Date.now()-start>ms){ resolve(null); return; }
          setTimeout(tick, 300);
        }; tick();
      });
    }
    const el = await waitForComposer(24000);
    const wrote = !!el && setNativeValueAndEvents(el, text);
    if(wrote){ clearDrafts(); }
    let sent = false;
    if(wrote && doSend){ await sleep(260); sent = await trySend(el); }
    return { ok: wrote || sent, wrote, sent };
  });
  if(res && (res.wrote || res.sent)) return res;
  // fallback: ask content script to handle
  try{
    const r = await new Promise((resolve)=>{
      chrome.tabs.sendMessage(tabId, { type:'FILL_AND_SEND', text, send:!!doSend }, (rr)=>resolve(rr||{ok:false}));
    });
    return r || { ok:false };
  }catch(e){ return res || { ok:false, error:String(e) }; }
}

async function ensureOpenAndInject(primary, text, doSend){
  try{
    const [active] = await chrome.tabs.query({ active:true, currentWindow:true });
    function hostGroupFromUrl(u){
      try{
        const h=new URL(u).host;
        if(h==='chatgpt.com' || h==='chat.openai.com') return 'chatgpt';
        if(h==='www.kimi.com' || h==='kimi.moonshot.cn') return 'kimi';
        if(h==='chat.deepseek.com') return 'deepseek';
        return h;
      }catch(e){ return ''; }
    }
    const sameEngine = (u1, u2) => hostGroupFromUrl(u1) === hostGroupFromUrl(u2);
    async function retryInject(tabId, tries=5, gap=600){
      for(let i=0;i<tries;i++){
        const r = await injectFlow(tabId, text, doSend);
        if(r && (r.wrote||r.sent)) return r;
        await new Promise(res=>setTimeout(res, gap));
      }
      return null;
    }
    if(active?.id && active?.url && sameEngine(active.url, primary)){
      const r = await retryInject(active.id, 5, 600);
      if(r && (r.wrote || r.sent)) return r;
    }
    // open new window or tab and inject with retries
    const openAndWait = () => new Promise((resolve)=>{
      const onReady = (tabId) => {
        let attempts = 0;
        const maxAttempts = 6;
        const tick = async () => {
          attempts++;
          const rr = await injectFlow(tabId, text, doSend);
          if(rr && (rr.wrote||rr.sent)){ resolve(rr); return; }
          if(attempts>=maxAttempts){ resolve(rr||{ok:false}); return; }
          setTimeout(tick, 800);
        };
        setTimeout(tick, 1200);
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
          const base1 = 'https://chatgpt.com';
          const base2 = 'https://chat.openai.com';
          const prim = temp ? temporary : regular;
          const primHost = new URL(prim).host;
          const altHost = primHost==='chatgpt.com' ? 'chat.openai.com' : 'chatgpt.com';
          const alt = prim.replace(primHost, altHost);
          candidates.push(prim);
          if(alt!==prim) candidates.push(alt);
          // also try regular counterpart if temp fails
          if(temp){
            const primReg = regular;
            const altReg = primReg.replace(new URL(primReg).host, altHost);
            if(!candidates.includes(primReg)) candidates.push(primReg);
            if(!candidates.includes(altReg)) candidates.push(altReg);
          }
        } else {
          candidates.push(temp ? temporary : regular);
        }
        let res=null;
        for(const url of candidates){ res = await ensureOpenAndInject(url, text, doSend); if(res && (res.wrote||res.sent)) break; }
        send(res && (res.wrote || res.sent) ? { ok:true, wrote:!!res.wrote, sent:!!res.sent } : { ok:false, error:'注入失败（未找到输入框或发送失败）' });
      }catch(e){ send({ok:false,error:String(e)}); }
    })(); return true;
  }
});
