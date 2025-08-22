
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
      'textarea[data-testid="prompt-textarea"]',
      'div[data-testid="composer"] textarea',
      'textarea[placeholder*="Message"]',
      'div[contenteditable="true"][role="textbox"]',
      '[role="textbox"]',
      'textarea'
    ];
    const SEND = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send"]',
      'button[aria-label*="发送"]',
      'button[type="submit"]',
      'form button:not([disabled])'
    ];
    function findEditable(root){
      const visited=new Set();
      function dfs(node){
        if(!node || visited.has(node)) return null;
        visited.add(node);
        for(const sel of EDITABLE){ try{ const el=node.querySelector?.(sel); if(el) return el; }catch(e){} }
        const all=node.querySelectorAll?node.querySelectorAll('*'):[];
        for(const n of all){
          if(n.shadowRoot){ const e=dfs(n.shadowRoot); if(e) return e; }
          if(n.tagName==='IFRAME'){ try{ const e=dfs(n.contentDocument); if(e) return e; }catch(e){} }
        }
        return null;
      }
      return dfs(root||document);
    }
    function setValue(el, val){
      if(!el) return false;
      const tag=(el.tagName||'').toLowerCase();
      if(tag==='textarea'){ el.focus(); el.value=val; el.dispatchEvent(new Event('input',{bubbles:true})); return true; }
      if(el.getAttribute && el.getAttribute('contenteditable')==='true'){
        el.focus(); document.execCommand('selectAll', false, null); document.execCommand('insertText', false, val); return true;
      }
      try{ el.focus(); el.textContent=val; el.dispatchEvent(new Event('input',{bubbles:true})); return true; }catch(e){} return false;
    }
    function trySend(inputEl){
      const docs=[document];
      document.querySelectorAll('iframe').forEach(ifr=>{ try{ if(ifr.contentDocument) docs.push(ifr.contentDocument); }catch(e){} });
      for(const doc of docs){
        const sels = SEND.slice();
        for(const sel of sels){
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
        const k={key:'Enter',code:'Enter',which:13,keyCode:13,bubbles:true};
        (inputEl||document.activeElement)?.dispatchEvent(new KeyboardEvent('keydown', k));
        (inputEl||document.activeElement)?.dispatchEvent(new KeyboardEvent('keypress', k));
        (inputEl||document.activeElement)?.dispatchEvent(new KeyboardEvent('keyup', k));
        return true;
      }catch(e){} return false;
    }
    async function waitForComposer(ms=20000){
      const start=Date.now();
      return await new Promise((resolve)=>{
        const tick=()=>{
          const el=findEditable(document) || document.activeElement;
          if(el){ resolve(el); return; }
          if(Date.now()-start>ms){ resolve(null); return; }
          setTimeout(tick, 250);
        }; tick();
      });
    }
    const el = await waitForComposer(20000);
    const wrote = !!el && setValue(el, text);
    let sent = false;
    if(wrote && doSend){ sent = trySend(el); }
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
    if(active?.id && active?.url && sameEngine(active.url, primary)){
      const r = await injectFlow(active.id, text, doSend);
      if(r && (r.wrote || r.sent)) return r;
    }
    // open new window or tab and inject
    const openAndWait = () => new Promise((resolve)=>{
      const onReady = (tabId) => {
        const handler = async (tabIdUpdated, info) => {
          if(tabIdUpdated !== tabId || info.status !== 'complete') return;
          chrome.tabs.onUpdated.removeListener(handler);
          setTimeout(async ()=>{ const rr = await injectFlow(tabId, text, doSend); resolve(rr || { ok:false }); }, 1200);
        };
        chrome.tabs.onUpdated.addListener(handler);
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
        const primary = temp ? temporary : regular;
        const res = await ensureOpenAndInject(primary, text, doSend);
        send(res && (res.wrote || res.sent) ? { ok:true, wrote:!!res.wrote, sent:!!res.sent } : { ok:false, error:'注入失败（未找到输入框或发送失败）' });
      }catch(e){ send({ok:false,error:String(e)}); }
    })(); return true;
  }
});
