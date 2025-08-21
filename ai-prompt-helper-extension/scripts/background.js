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
    setTimeout(async ()=>{
      try{
        await chrome.tabs.sendMessage(tab.id, { type: 'insertPrompt', text: msg.text, sendNow: true });
      }catch{}
    }, 1200);
    sendResponse && sendResponse({ ok: true });
  }
});