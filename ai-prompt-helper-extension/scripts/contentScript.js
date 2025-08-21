function findInput(){
  // ChatGPT
  let el = document.querySelector('textarea[data-testid="prompt-textarea"]')
        || document.querySelector('textarea[placeholder*="Message"]')
        || document.querySelector('form textarea');
  // DeepSeek / Kimi may use contenteditable or Slate editors
  let editable = document.querySelector('div[contenteditable="true"][data-slate-editor="true"]')
               || document.querySelector('div[contenteditable="true"]');
  return { textarea: el, editable };
}

function setTextareaValue(textarea, value){
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  nativeSetter.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function setEditableValue(editable, value){
  editable.focus();
  editable.textContent = value;
  editable.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

function trySend(){
  // Try common send buttons
  const buttons = [
    'button[data-testid="send-button"]',
    'button[aria-label="Send"]',
    'form button[type="submit"]',
    'button:has(svg[aria-hidden="true"])',
    'button[aria-label*="发送"],button:has(svg[aria-label*="Send"])'
  ];
  for(const sel of buttons){
    const btn = document.querySelector(sel);
    if(btn){ btn.click(); return true; }
  }
  // Fallback: Enter key
  const { textarea, editable } = findInput();
  const target = textarea || editable;
  if(!target) return false;
  const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true });
  target.dispatchEvent(ev);
  return true;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  if(msg?.type === 'insertPrompt'){
    const { textarea, editable } = findInput();
    try{
      if(textarea){ setTextareaValue(textarea, msg.text); textarea.focus(); }
      else if(editable){ setEditableValue(editable, msg.text); }
      if(msg.sendNow){ setTimeout(()=>{ trySend(); }, 80); }
      sendResponse && sendResponse({ ok: true });
    }catch(e){ sendResponse && sendResponse({ ok:false, error: String(e) }); }
  }
});