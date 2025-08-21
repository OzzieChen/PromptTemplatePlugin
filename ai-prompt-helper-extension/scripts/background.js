chrome.runtime.onInstalled.addListener(()=>{
  // Placeholder for future initialization or migrations
});

// Optionally set per-site side panel defaults in future
// chrome.sidePanel.setOptions({ enabled: true, path: 'sidepanel.html' });

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse)=>{
  if(msg?.type === 'sendToTempChat'){
    const url = 'https://chatgpt.com/?temporary-chat=true';
    const tab = await chrome.tabs.create({ url, active: true });
    // Wait briefly, then inject text via messaging when content script is ready
    const tryInsert = async () => {
      try{ await chrome.tabs.sendMessage(tab.id, { type: 'insertPrompt', text: msg.text, sendNow: true }); return true; }catch{ return false; }
    };
    let ok = false; for(let i=0;i<8;i++){ ok = await tryInsert(); if(ok) break; await new Promise(r=>setTimeout(r, 500)); }
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
    const tryInsert = async () => {
      try{ await chrome.tabs.sendMessage(tab.id, { type: 'insertPrompt', text, sendNow: !!sendNow }); return true; }catch{ return false; }
    };
    let ok=false; for(let i=0;i<10;i++){ ok=await tryInsert(); if(ok) break; await new Promise(r=>setTimeout(r,600)); }
    return { ok };
  }
});