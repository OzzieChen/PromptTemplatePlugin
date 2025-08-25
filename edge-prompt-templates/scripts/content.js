
console.log('[PTS] content v2.12.1.4 up');
chrome.runtime.onMessage.addListener((m, s, send) => {
  if (m?.type !== 'FILL_AND_SEND') return;
  const text = m.text || '', doSend = !!m.send;
  const EDITABLE = [
    'textarea#prompt-textarea',
    'textarea[data-testid="prompt-textarea"]',
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
  function findInTree(doc) {
    const visited = new Set();
    function q(root) {
      if (!root || visited.has(root)) return null;
      visited.add(root);
      for (const sel of EDITABLE) { const el = root.querySelector?.(sel); if (el) return el; }
      const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
      for (const n of all) {
        if (n.shadowRoot) { const el = q(n.shadowRoot); if (el) return el; }
        if (n.tagName === 'IFRAME') { try { const idoc = n.contentDocument; const el = q(idoc); if (el) return el; } catch (e) {} }
      }
      return null;
    }
    return q(doc || document);
  }
  function isEditable(el){
    if(!el) return false;
    const t = el.tagName?.toLowerCase();
    if(t === 'textarea' || t === 'input') return true;
    if(el.getAttribute && el.getAttribute('contenteditable') === 'true') return true;
    return false;
  }
  function setV(el, val) {
    if (!el) return false;
    const t = el.tagName?.toLowerCase();
    if (t === 'textarea' || t === 'input') { el.focus(); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); return true; }
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
      el.focus(); document.execCommand('selectAll', false, null); document.execCommand('insertText', false, val); return true;
    }
    return false;
  }
  const found = findInTree(document);
  const target = found || (isEditable(document.activeElement) ? document.activeElement : null);
  const wrote = setV(target, text);
  let sent = false;
  if (wrote && doSend) {
    setTimeout(() => {
      const btn = document.querySelector('button[data-testid="send-button"],button[aria-label="Send"],button[aria-label="Send message"],button[aria-label*="发送"],button[aria-label*="送出"],button[aria-label*="发送消息"],button[type="submit"]');
      if (btn && !btn.disabled) { btn.click(); sent = true; }
      else {
        const o = { key:'Enter', code:'Enter', which:13, keyCode:13, bubbles:true };
        (target||document.activeElement)?.dispatchEvent(new KeyboardEvent('keydown', o));
        (target||document.activeElement)?.dispatchEvent(new KeyboardEvent('keypress', o));
        (target||document.activeElement)?.dispatchEvent(new KeyboardEvent('keyup', o));
        sent = true;
      }
      try{ send && send({ ok: !!wrote, wrote: !!wrote, sent: !!sent }); }catch(e){}
    }, 300);
    return true;
  }
  try{ send && send({ ok: !!wrote, wrote: !!wrote, sent: !!sent }); }catch(e){}
  return true;
});
