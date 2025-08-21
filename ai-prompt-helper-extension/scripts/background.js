chrome.runtime.onInstalled.addListener(()=>{
  // Placeholder for future initialization or migrations
});

// Optionally set per-site side panel defaults in future
// chrome.sidePanel.setOptions({ enabled: true, path: 'sidepanel.html' });

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse)=>{
  async function injectViaScripting(tabId, text, sendNow){
    const attempt = async () => {
      const [{ result } = {}] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (payload)=>{
          const text = payload.text;
          function findInput(){
            let el = document.querySelector('textarea[data-testid="prompt-textarea"]')
                  || document.querySelector('textarea[placeholder*="Message"]')
                  || document.querySelector('form textarea');
            let editable = document.querySelector('div[contenteditable="true"][data-slate-editor="true"]')
                         || document.querySelector('div[contenteditable="true"]');
            return { textarea: el, editable };
          }
          function setTextareaValue(textarea, value){
            const d = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
            d && d.set.call(textarea, value);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
          function setEditableValue(editable, value){
            editable.focus();
            editable.textContent = value;
            editable.dispatchEvent(new InputEvent('input', { bubbles: true }));
          }
          function trySend(){
            const sels = [
              'button[data-testid="send-button"]',
              'button[aria-label="Send"]',
              'form button[type="submit"]',
              'button:has(svg[aria-hidden="true"])',
              'button[aria-label*="发送"]'
            ];
            for(const s of sels){ const b = document.querySelector(s); if(b){ b.click(); return true; } }
            const { textarea, editable } = findInput();
            const t = textarea || editable; if(!t) return false;
            const ev = new KeyboardEvent('keydown',{key:'Enter',code:'Enter',which:13,keyCode:13,bubbles:true});
            t.dispatchEvent(ev); return true;
          }
          const { textarea, editable } = findInput();
          if(textarea){ setTextareaValue(textarea, text); textarea.focus(); if(payload.sendNow) trySend(); return { ok:true, via:'textarea' }; }
          if(editable){ setEditableValue(editable, text); if(payload.sendNow) trySend(); return { ok:true, via:'editable' }; }
          return { ok:false, reason:'no-input' };
        },
        args: [{ text, sendNow }]
      }).catch(()=>[{}]);
      return result || { ok:false };
    };
    for(let i=0;i<20;i++){
      const r = await attempt();
      if(r && r.ok) return true;
      await new Promise(r=>setTimeout(r,600));
    }
    return false;
  }
  if(msg?.type === 'sendToTempChat'){
    const url = 'https://chatgpt.com/?temporary-chat=true';
    const tab = await chrome.tabs.create({ url, active: true });
    const ok = await injectViaScripting(tab.id, msg.text, true);
    sendResponse && sendResponse({ ok: true });
  }
  if(msg?.type === 'openPanelWindow'){
    const url = chrome.runtime.getURL('sidepanel.html');
    await chrome.windows.create({ url, type: 'popup', width: 420, height: 680 });
    sendResponse && sendResponse({ ok: true });
  }
  if(msg?.type === 'openProviderAndInsert'){
    const { text, sendNow, provider, tempChat } = msg;
    let url = '';
    if(provider==='chatgpt'){
      url = tempChat ? 'https://chatgpt.com/?temporary-chat=true' : 'https://chatgpt.com/';
    } else if(provider==='kimi'){
      url = 'https://kimi.moonshot.cn/';
    } else if(provider==='deepseek'){
      url = 'https://chat.deepseek.com/';
    }
    const tab = await chrome.tabs.create({ url, active: true });
    const ok = await injectViaScripting(tab.id, text, !!sendNow);
    return { ok };
  }
});