
console.log('[PTS] content v2.4.8 up');
chrome.runtime.onMessage.addListener((m, s, send) => {
  if (m?.type !== 'FILL_AND_SEND') return;
  const text = m.text || '', doSend = !!m.send;
  const EDITABLE = [
    'textarea[data-testid="prompt-textarea"]',
    'div[data-testid="composer"] textarea',
    'textarea[placeholder*="Message"]',
    'div[contenteditable="true"][role="textbox"]',
    '[role="textbox"]',
    'textarea'
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
  function setV(el, val) {
    if (!el) return false;
    const t = el.tagName?.toLowerCase();
    if (t === 'textarea') { el.focus(); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); return true; }
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
      el.focus(); document.execCommand('selectAll', false, null); document.execCommand('insertText', false, val); return true;
    }
    return false;
  }
  const el = findInTree(document);
  const wrote = setV(el, text);
  if (wrote) {
    try {
      const ls = window.localStorage;
      const toRemove = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i) || '';
        if (/(draft|input|composer|prompt)/i.test(k)) toRemove.push(k);
      }
      toRemove.forEach(k => ls.removeItem(k));
    } catch (e) {}
  }
  let sent = false;
  if (wrote && doSend) {
    setTimeout(() => {
      const btn = document.querySelector('button[aria-label="Send"],button[data-testid="send-button"],button[type="submit"]');
      if (btn && !btn.disabled) { btn.click(); sent = true; }
      else {
        const o = { key:'Enter', code:'Enter', which:13, keyCode:13, bubbles:true };
        (el||document.activeElement)?.dispatchEvent(new KeyboardEvent('keydown', o));
        (el||document.activeElement)?.dispatchEvent(new KeyboardEvent('keypress', o));
        (el||document.activeElement)?.dispatchEvent(new KeyboardEvent('keyup', o));
        sent = true;
      }
      try{ send && send({ ok: !!wrote, wrote: !!wrote, sent: !!sent }); }catch(e){}
    }, 300);
    return true;
  }
  try{ send && send({ ok: !!wrote, wrote: !!wrote, sent: !!sent }); }catch(e){}
  return true;
});
