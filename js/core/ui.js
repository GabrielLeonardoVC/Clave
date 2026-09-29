/* =========================================================
   Cifras e Escalas Pro — core/ui.js
   Toasts, modais/sheets, confirmação, ícones, tema.
   Expõe window.UI.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const { el, esc } = U;

  /* ---------------- Ícones ---------------- */
  function icons(root) {
    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      try { global.lucide.createIcons({ nameAttr: 'data-lucide', ...(root ? { attrs: {} } : {}) }); }
      catch (e) { /* ignora */ }
    }
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, opts) {
    opts = opts || {};
    const host = document.getElementById('toast-host');
    if (!host) return;
    const tipo = opts.tipo || 'info';
    const iconName = tipo === 'ok' ? 'check-circle-2' : tipo === 'err' ? 'alert-circle' : 'info';
    const node = el('div', { class: 'toast ' + tipo, role: 'status' }, [
      el('i', { 'data-lucide': iconName }),
      el('span', { class: 'grow' }, msg),
    ]);
    if (opts.undo) {
      node.appendChild(el('button', {
        class: 'undo',
        onclick: () => { close(); opts.undo(); },
      }, 'Desfazer'));
    }
    host.appendChild(node);
    icons(node);
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      node.classList.add('out');
      setTimeout(() => node.remove(), 220);
    }
    const dur = opts.dur || (opts.undo ? 6000 : tipo === 'err' ? 5000 : 2800);
    const t = setTimeout(close, dur);
    node.addEventListener('click', (e) => {
      if (e.target.closest('.undo')) return;
      clearTimeout(t); close();
    });
    return close;
  }

  /* ---------------- Sheet / Modal ---------------- */
  let sheetStack = [];

  /**
   * Abre um sheet (mobile) / modal (desktop).
   * opts: {title, sub, body(Node|string), foot[Node], wide, onClose, dismissible}
   * Retorna {close, node}
   */
  function sheet(opts) {
    opts = opts || {};
    const scrim = el('div', { class: 'scrim' });
    const bodyNode = el('div', { class: 'sheet-body' + (opts.flush ? ' flush' : '') });
    if (opts.body) {
      if (typeof opts.body === 'string') bodyNode.innerHTML = opts.body;
      else bodyNode.appendChild(opts.body);
    }
    const panel = el('div', { class: 'sheet' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' }, [
      el('div', { class: 'sheet-grip' }),
      opts.title ? el('div', { class: 'sheet-head' }, [
        el('div', { class: 'grow' }, [
          el('h3', {}, opts.title),
          opts.sub ? el('div', { class: 'sub' }, opts.sub) : null,
        ]),
        el('button', {
          class: 'btn-icon', 'aria-label': 'Fechar',
          onclick: () => close(),
        }, el('i', { 'data-lucide': 'x' })),
      ]) : null,
      bodyNode,
      opts.foot && opts.foot.length ? el('div', { class: 'sheet-foot' }, opts.foot) : null,
    ]);
    scrim.appendChild(panel);

    function close() {
      const i = sheetStack.indexOf(handle);
      if (i >= 0) sheetStack.splice(i, 1);
      scrim.style.animation = 'fadeIn .15s reverse';
      setTimeout(() => scrim.remove(), 140);
      document.removeEventListener('keydown', onKey);
      if (opts.onClose) opts.onClose();
    }
    function onKey(ev) {
      if (ev.key === 'Escape' && opts.dismissible !== false) {
        // fecha só o topo da pilha
        if (sheetStack[sheetStack.length - 1] === handle) { ev.stopPropagation(); close(); }
      }
    }

    scrim.addEventListener('click', (ev) => {
      if (ev.target === scrim && opts.dismissible !== false) close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(scrim);

    const handle = { close, node: panel, body: bodyNode, scrim };
    sheetStack.push(handle);
    icons(panel);
    // foca o primeiro campo, se houver
    const first = panel.querySelector('input:not([type=hidden]), textarea, select, .btn-primary');
    if (first && opts.autofocus !== false && window.matchMedia('(min-width: 900px)').matches) {
      setTimeout(() => first.focus(), 60);
    }
    return handle;
  }

  function closeAllSheets() {
    sheetStack.slice().forEach((h) => h.close());
  }

  /* ---------------- Confirmação ---------------- */
  /** Substitui window.confirm. resolve(true/false). */
  function confirmar(opts) {
    if (typeof opts === 'string') opts = { message: opts };
    opts = opts || {};
    return new Promise((resolve) => {
      let done = false;
      function finish(v) { if (done) return; done = true; h.close(); resolve(v); }
      const h = sheet({
        title: opts.title || 'Confirmar',
        body: el('p', { class: 'fs-md', style: { lineHeight: '1.5' } }, opts.message || ''),
        foot: [
          el('button', { class: 'btn btn-secondary', onclick: () => finish(false) },
            opts.cancelText || 'Cancelar'),
          el('button', {
            class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'),
            onclick: () => finish(true),
          }, opts.okText || 'Confirmar'),
        ],
        onClose: () => finish(false),
      });
      setTimeout(() => {
        const b = h.node.querySelector('.sheet-foot .btn:last-child');
        if (b) b.focus();
      }, 60);
    });
  }

  /* ---------------- Prompt ---------------- */
  /** Sheet com um campo. resolve(valor | null). */
  function prompt(opts) {
    if (typeof opts === 'string') opts = { title: opts };
    opts = opts || {};
    return new Promise((resolve) => {
      let done = false;
      const input = el(opts.multiline ? 'textarea' : 'input', {
        class: opts.multiline ? 'textarea' : 'input',
        placeholder: opts.placeholder || '',
        value: opts.value || '',
      });
      function finish(v) { if (done) return; done = true; h.close(); resolve(v); }
      const body = el('div', {}, [
        opts.message ? el('p', { class: 'fs-sm muted mb-3' }, opts.message) : null,
        opts.label ? el('label', { class: 'label' }, opts.label) : null,
        input,
      ]);
      const h = sheet({
        title: opts.title || 'Digite',
        body,
        foot: [
          el('button', { class: 'btn btn-secondary', onclick: () => finish(null) }, 'Cancelar'),
          el('button', { class: 'btn btn-primary', onclick: () => finish(input.value.trim()) },
            opts.okText || 'Salvar'),
        ],
        onClose: () => finish(null),
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !opts.multiline) { e.preventDefault(); finish(input.value.trim()); }
      });
      setTimeout(() => input.focus(), 80);
    });
  }

  /* ---------------- Estado vazio ---------------- */
  function empty(opts) {
    return el('div', { class: 'empty' }, [
      el('div', { class: 'ico' }, el('i', { 'data-lucide': opts.icon || 'inbox' })),
      el('h4', {}, opts.title || 'Nada por aqui'),
      opts.message ? el('p', {}, opts.message) : null,
      opts.action ? el('button', {
        class: 'btn btn-primary', onclick: opts.action.onClick,
      }, [el('i', { 'data-lucide': opts.action.icon || 'plus' }), opts.action.label]) : null,
    ]);
  }

  /* ---------------- Indicador de imagem ---------------- */
  function openImage(src, opts) {
    opts = opts || {};
    const modal = document.getElementById('img-modal');
    const img = document.getElementById('img-modal-img');
    if (!modal || !img) return;
    img.src = src;
    modal.style.display = 'flex';
    function close() { modal.style.display = 'none'; img.src = ''; }
    modal.onclick = close;
    const bar = modal.querySelector('.bar');
    if (bar) {
      bar.innerHTML = '';
      if (opts.onDelete) {
        bar.appendChild(el('button', {
          class: 'btn-icon danger', 'aria-label': 'Remover imagem', onclick: () => {
            close(); opts.onDelete();
          },
        }, el('i', { 'data-lucide': 'trash-2' })));
      }
      bar.appendChild(el('button', {
        class: 'btn-icon', 'aria-label': 'Fechar', onclick: close,
      }, el('i', { 'data-lucide': 'x' })));
    }
    icons(modal);
  }

  /* ---------------- Tema ---------------- */
  function applyTheme(tema) {
    const t = tema || 'auto';
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    const escuro = t === 'dark' || (t === 'auto'
      && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (meta) meta.setAttribute('content', escuro ? '#080b14' : '#f4f6fb');
    document.querySelectorAll('[data-theme-btn]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.themeBtn === t));
    });
  }

  function cycleTheme(atual) {
    const ordem = ['auto', 'light', 'dark'];
    const i = ordem.indexOf(atual);
    return ordem[(i + 1) % ordem.length];
  }

  /* ---------------- Vibração (feedback tátil) ---------------- */
  function buzz(ms) {
    if (global.Store && global.Store.ajuste('vibrar', true) === false) return;
    if (navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) { /* ignora */ } }
  }

  /* ---------------- Impressão ---------------- */
  function print(html) {
    const area = document.getElementById('print-area');
    if (!area) return;
    area.innerHTML = html;
    const done = () => { area.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { window.print(); setTimeout(done, 1500); }, 60);
  }

  global.UI = {
    icons, toast, sheet, closeAllSheets, confirmar, prompt,
    empty, openImage, applyTheme, cycleTheme, buzz, print,
  };
})(typeof window !== 'undefined' ? window : globalThis);
