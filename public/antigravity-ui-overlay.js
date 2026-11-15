(function initAntigravityOverlay() {
  if (typeof window === 'undefined' || window.__AGY_OVERLAY_ACTIVE__) return;
  window.__AGY_OVERLAY_ACTIVE__ = true;

  let inspectMode = false;
  let selectedElement = null;

  // Create isolated Shadow DOM UI so app CSS never breaks the inspector
  const host = document.createElement('div');
  host.id = 'agy-inspector-host';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      .toolbar {
        position: fixed; bottom: 16px; right: 16px; z-index: 999999;
        background: #0f172a; color: #f8fafc; padding: 12px;
        border-radius: 10px; font-family: system-ui, sans-serif;
        box-shadow: 0 10px 25px rgba(0,0,0,0.4); width: 320px;
        border: 1px solid #334155;
      }
      .row { display: flex; gap: 8px; margin-top: 8px; }
      button {
        cursor: pointer; border: none; border-radius: 6px;
        padding: 6px 12px; font-weight: 600; font-size: 13px;
      }
      .btn-primary { background: #ea580c; color: white; flex: 1; }
      .btn-danger { background: #ef4444; color: white; }
      .btn-toggle { background: #1e293b; color: #cbd5e1; border: 1px solid #475569; width: 100%; }
      .btn-toggle.active { background: #22c55e; color: #052e16; border-color: #22c55e; }
      textarea {
        width: 100%; box-sizing: border-box; margin-top: 8px;
        background: #1e293b; color: white; border: 1px solid #475569;
        border-radius: 6px; padding: 8px; font-size: 13px; resize: vertical;
      }
      .meta { font-size: 11px; color: #94a3b8; margin-top: 6px; word-break: break-all; }
    </style>
    <div class="toolbar">
      <button id="toggleBtn" class="btn-toggle">🎯 Pick UI Element (Off)</button>
      <div id="targetMeta" class="meta">No element selected</div>
      <textarea id="promptInput" rows="3" placeholder="Describe the UI change..."></textarea>
      <div class="row">
        <button id="sendBtn" class="btn-primary">Apply in CLI</button>
        <button id="doneBtn" class="btn-danger">Finish Session</button>
      </div>
    </div>
  `;

  const toggleBtn = shadow.getElementById('toggleBtn');
  const targetMeta = shadow.getElementById('targetMeta');
  const promptInput = shadow.getElementById('promptInput');
  const sendBtn = shadow.getElementById('sendBtn');
  const doneBtn = shadow.getElementById('doneBtn');

  function getCssSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.dataset && el.dataset.testid) return `[data-testid="${el.dataset.testid}"]`;
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.body) {
      let selector = el.nodeName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (classes) selector += `.${classes}`;
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  toggleBtn.addEventListener('click', () => {
    inspectMode = !inspectMode;
    toggleBtn.classList.toggle('active', inspectMode);
    toggleBtn.textContent = inspectMode ? '🎯 Click Any Element...' : '🎯 Pick UI Element (Off)';
  });

  document.addEventListener('click', (e) => {
    if (!inspectMode) return;
    if (e.composedPath().includes(host)) return;

    e.preventDefault();
    e.stopPropagation();

    selectedElement = {
      selector: getCssSelector(e.target),
      tagName: e.target.tagName ? e.target.tagName.toLowerCase() : '',
      textSnippet: (e.target.innerText || '').slice(0, 80).trim(),
      componentHint: e.target.getAttribute('data-component') || e.target.closest('[data-component]')?.getAttribute('data-component') || null,
      outerHTMLSnippet: (e.target.outerHTML || '').slice(0, 300)
    };

    inspectMode = false;
    toggleBtn.classList.remove('active');
    toggleBtn.textContent = '🎯 Pick UI Element (Off)';
    targetMeta.textContent = `Selected: ${selectedElement.selector}`;
    promptInput.focus();
  }, true);

  sendBtn.addEventListener('click', async () => {
    const instruction = promptInput.value.trim();
    if (!selectedElement || !instruction) {
      targetMeta.textContent = '⚠️ Select an element and enter instructions first.';
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending to Agent...';

    try {
      const endpoint = '/__agy_ui_bridge/select';
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'pending',
          timestamp: Date.now(),
          element: selectedElement,
          instruction
        })
      });

      promptInput.value = '';
      sendBtn.disabled = false;
      sendBtn.textContent = 'Apply in CLI';
      targetMeta.textContent = '✅ Sent! Agent is updating the UI...';
    } catch (err) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Apply in CLI';
      targetMeta.textContent = `⚠️ Error: ${err.message}`;
    }
  });

  doneBtn.addEventListener('click', async () => {
    try {
      await fetch('/__agy_ui_bridge/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done', timestamp: Date.now() })
      });
      targetMeta.textContent = '🛑 Session closed.';
    } catch (err) {
      targetMeta.textContent = `⚠️ Error: ${err.message}`;
    }
  });
})();
