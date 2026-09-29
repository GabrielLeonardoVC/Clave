/* =========================================================
   Cifras e Escalas Pro — core/utils.js
   Utilitarios de DOM, datas, texto e formatacao.
   Expõe window.Utils.
   ========================================================= */
(function (global) {
  'use strict';

  /* ---------------- DOM ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === 'dataset') {
          for (const d in v) node.dataset[d] = v[d];
        } else node.setAttribute(k, v === true ? '' : v);
      }
    }
    (Array.isArray(children) ? children : children != null ? [children] : []).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number'
        ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  /** Escapa texto para uso seguro em innerHTML. */
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Delegacao de eventos: on(root, 'click', '.btn', handler) */
  function on(root, type, selector, handler) {
    root.addEventListener(type, (ev) => {
      const t = ev.target.closest(selector);
      if (t && root.contains(t)) handler(ev, t);
    });
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* ---------------- Datas ---------------- */
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
    'quinta-feira', 'sexta-feira', 'sábado'];
  const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  const pad = (n) => (n < 10 ? '0' + n : '' + n);

  /** Data local no formato YYYY-MM-DD (nunca UTC: evita bug de fuso). */
  function toKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  /** Converte 'YYYY-MM-DD' em Date local (meio-dia, evita DST). */
  function fromKey(key) {
    const p = String(key).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0, 0);
  }
  function todayKey() { return toKey(new Date()); }

  function addDays(d, n) {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
    r.setDate(r.getDate() + n);
    return r;
  }
  function addMonths(d, n) {
    const r = new Date(d.getFullYear(), d.getMonth() + n, 1, 12);
    // nao deixa pular de mes (31 de janeiro + 1 mes = 3 de marco)
    const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(d.getDate(), last));
    return r;
  }
  function startOfWeek(d, firstDay) {
    const f = firstDay === undefined ? 0 : firstDay;
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
    r.setDate(r.getDate() - ((r.getDay() - f + 7) % 7));
    return r;
  }
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }
  function diffDays(a, b) {
    const x = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 12);
    const y = new Date(b.getFullYear(), b.getMonth(), b.getDate(), 12);
    return Math.round((y - x) / 86400000);
  }
  /** '2026-09-29' -> '29/09/2026' */
  function fmtDate(key) {
    const p = String(key).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  /** '2026-09-29' -> 'Terça, 29 de setembro' */
  function fmtDateLong(key) {
    const d = fromKey(key);
    return capitalize(DIAS[d.getDay()]) + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
  }
  function fmtMonthYear(d) { return MESES[d.getMonth()] + ' de ' + d.getFullYear(); }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  /** '19:30' -> '19h30'; '19:00' -> '19h' */
  function fmtTime(hm) {
    if (!hm) return '';
    const p = String(hm).split(':');
    if (p.length < 2) return hm;
    return p[1] === '00' ? p[0] + 'h' : p[0] + 'h' + p[1];
  }
  /** '2026-09-29' -> 'hoje' | 'amanhã' | 'ontem' | '29 set' */
  function fmtRelativeDay(key) {
    const n = diffDays(new Date(), fromKey(key));
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    const d = fromKey(key);
    if (d.getFullYear() === new Date().getFullYear()) return d.getDate() + ' ' + MESES_CURTOS[d.getMonth()];
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2);
  }

  /* ---------------- Texto ---------------- */
  /** Normaliza para busca: minúsculo, sem acento. */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  /** Remove acentos mas mantém a caixa. */
  function deaccent(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function slug(s) {
    return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function titleCase(s) {
    return String(s || '').replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  }

  /** Debounce simples. */
  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), ms || 200);
    };
  }
  function throttle(fn, ms) {
    let last = 0, timer = null;
    return function () {
      const args = arguments, ctx = this, now = Date.now();
      const remain = ms - (now - last);
      if (remain <= 0) { last = now; fn.apply(ctx, args); }
      else if (!timer) {
        timer = setTimeout(() => { timer = null; last = Date.now(); fn.apply(ctx, args); }, remain);
      }
    };
  }

  /* ---------------- Diversos ---------------- */
  let idCounter = 0;
  function uid(prefix) {
    idCounter = (idCounter + 1) % 100000;
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + idCounter.toString(36)
      + Math.random().toString(36).slice(2, 6);
  }

  function clamp(n, min, max) { return n < min ? min : n > max ? max : n; }

  /** Deep clone simples (JSON puro — os dados do app sao JSON). */
  function clone(o) {
    return o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  }

  /** Agrupa elementos por chave. */
  function groupBy(arr, keyFn) {
    const out = {};
    arr.forEach((x) => {
      const k = keyFn(x);
      (out[k] = out[k] || []).push(x);
    });
    return out;
  }

  function sortBy(arr, fn, desc) {
    return arr.slice().sort((a, b) => {
      const x = fn(a), y = fn(b);
      const r = x < y ? -1 : x > y ? 1 : 0;
      return desc ? -r : r;
    });
  }

  /** Agrupa por dia mantendo ordem. */
  function groupByDate(arr) {
    return groupBy(arr, (x) => x.data);
  }

  /** Highlight de busca: devolve HTML seguro. */
  function highlight(text, query) {
    const t = esc(text);
    if (!query) return t;
    const q = norm(query).trim();
    if (!q) return t;
    // casa sem acento no texto original usando indices normalizados
    const normChars = deaccent(text);
    const lower = normChars.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx < 0) return t;
    // mapeia indices normalizados -> indices originais
    let map = [];
    let acc = '';
    for (let i = 0; i < text.length; i++) {
      const c = deaccent(text[i]);
      if (c) { acc += c.toLowerCase(); map.push(i); }
    }
    const at = acc.indexOf(q);
    if (at < 0) return t;
    const start = map[at];
    const end = map[at + q.length - 1] + 1;
    return esc(text.slice(0, start)) + '<mark>' + esc(text.slice(start, end)) + '</mark>'
      + esc(text.slice(end));
  }

  /** Copia texto para a area de transferencia (com fallback). */
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const ta = el('textarea', {
        value: text,
        style: { position: 'fixed', top: '-1000px', opacity: '0' },
      });
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy-failed'));
    });
  }

  /** Baixa um texto como arquivo. */
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  /** Lê um arquivo como texto. */
  function readFile(file, asDataURL) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      if (asDataURL) fr.readAsDataURL(file); else fr.readAsText(file);
    });
  }

  /**
   * Redimensiona e recomprime uma imagem para caber no localStorage.
   * Fotos de cifra em resolucao cheia estouram a cota em minutos.
   */
  function shrinkImage(dataUrl, maxW, quality) {
    maxW = maxW || 1100;
    quality = quality || 0.72;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) return resolve(dataUrl);
          if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const cx = cv.getContext('2d');
          cx.fillStyle = '#fff';
          cx.fillRect(0, 0, w, h);
          cx.drawImage(img, 0, 0, w, h);
          let out = '';
          try { out = cv.toDataURL('image/jpeg', quality); } catch (e) { out = ''; }
          resolve(out && out.length > 40 ? out : dataUrl);
        } catch (e) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  /** Tamanho legível de bytes. */
  function fmtBytes(b) {
    if (!b) return '0 KB';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
    return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i];
  }

  /** Abre link externo com validação (o app original falhava nisso). */
  function openLink(url) {
    if (!url) return false;
    let u = String(url).trim();
    if (!/^https?:\/\//i.test(u)) {
      // domínio sem protocolo:(prefixa https://
      if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) u = 'https://' + u;
      else return false;
    }
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      window.open(parsed.href, '_blank', 'noopener,noreferrer');
      return true;
    } catch (e) { return false; }
  }

  /** Link de busca no YouTube / CifraClub para uma música. */
  function searchLinks(nome, artista) {
    const q = encodeURIComponent([nome, artista].filter(Boolean).join(' '));
    return {
      youtube: 'https://www.youtube.com/results?search_query=' + q,
      cifraclub: 'https://www.cifraclub.com.br/busca.php?query=' + q,
      spotify: 'https://open.spotify.com/search/' + q,
    };
  }

  /** Duração aproximada de um texto de cifra (c. 2,5 palavras/segundo). */
  function estimateDuration(cifra) {
    if (!cifra) return 0;
    const lines = String(cifra).split('\n');
    let n = 0;
    lines.forEach((l) => { n += l.trim().split(/\s+/).filter(Boolean).length; });
    return Math.max(1, Math.round(n / 2.6));
  }

  /** Ratio de bytes da-string (aprox. UTF-16 -> UTF-8). */
  function byteLen(s) {
    return new Blob([s == null ? '' : String(s)]).size;
  }

  global.Utils = {
    $, $$, el, esc, on, clear,
    MESES, MESES_CURTOS, DIAS, DIAS_CURTOS, pad, toKey, fromKey, todayKey,
    addDays, addMonths, startOfWeek, isSameDay, diffDays,
    fmtDate, fmtDateLong, fmtMonthYear, fmtTime, fmtRelativeDay, capitalize,
    norm, deaccent, slug, titleCase, debounce, throttle,
    uid, clamp, clone, groupBy, groupByDate, sortBy, highlight,
    copy, download, readFile, shrinkImage, fmtBytes, openLink, searchLinks,
    estimateDuration, byteLen,
  };
})(typeof window !== 'undefined' ? window : globalThis);
