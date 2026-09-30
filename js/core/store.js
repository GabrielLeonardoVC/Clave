/* =========================================================
   ACORDE - core/store.js
   Persistencia, modelo de dados e migracao.
   Expõe window.Store.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const STORAGE_KEY = 'acorde_v4';
  const SCHEMA = 4;
  const MAX_BYTES = 4.5 * 1024 * 1024;

  /* ---------------- modelo ----------------
     escalas: {id, data, hora, titulo, local, tipo, obs, status, musicas[]}
     musica:  {id, nome, artista, tom, bpm, compasso, categoria,
               responsavel, cifraId, yt, ytId, cf, foto, obs}
     cifra:   {id, titulo, artista, tom, bpm, compasso, categoria,
               tags[], letra, cifra}
  */
  function vazio() {
    return {
      version: SCHEMA,
      escalas: [],
      cifras: [],
      ajustes: {
        tema: 'auto',
        accent: 'ember',
        densidade: 'normal',
        fontsize: 'normal',
        motion: 'on',
        notificacoes: true,
        antecedenciaNotif: 120,
        usarAmoles: 'auto',
        inicioSemana: 0,
        autoLink: true,
        bpmPadrao: 100,
        compassoPadrao: 4,
        metroSom: 'click',
        metroVolume: 0.8,
        metroSubdivisao: 1,
        metroAcento: true,
      },
      meta: { criadoEm: Date.now(), atualizadoEm: Date.now() },
    };
  }

  let db = vazio();
  let listeners = [];
  let timer = null;
  let ultimoErro = null;

  function carregar() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { db = vazio(); return db; }
    if (!raw) { db = vazio(); return db; }
    try { db = migrar(JSON.parse(raw)); }
    catch (e) { console.error('[Store] dados corrompidos:', e); db = vazio(); }
    return db;
  }

  function migrar(d) {
    const base = vazio();
    if (!d || typeof d !== 'object') return base;
    // v1 antigo: { 'AAAA-MM-DD': [{id, titulo, musicas:[{nome,tom,yt,cf,foto}]}] }
    if (!d.escalas && !d.cifras) {
      const leg = [];
      Object.keys(d).forEach(function (data) {
        (Array.isArray(d[data]) ? d[data] : []).forEach(function (e) {
          leg.push(normEscala({
            id: e.id, data: data, titulo: e.titulo,
            musicas: (e.musicas || []).map(normMusica),
          }));
        });
      });
      base.escalas = leg;
      return base;
    }
    base.escalas = (Array.isArray(d.escalas) ? d.escalas : []).map(normEscala);
    base.cifras = (Array.isArray(d.cifras) ? d.cifras : []).map(normCifra);
    base.ajustes = Object.assign(base.ajustes, d.ajustes || {});
    base.meta = Object.assign(base.meta, d.meta || {});
    base.version = SCHEMA;
    return base;
  }

  /** Tipos de evento reconhecidos, na ordem em que aparecem nos filtros. */
  const TIPOS = ['missa', 'ensaio', 'show', 'outro'];

  /**
   * Tipos que o app usava antes, e o que cada um virou.
   *
   * Um evento ja salvo continua valendo: a traducao roda na leitura, e o que
   * volta a ser gravado ja sai no vocabulario novo. Sem ela, trocar a lista de
   * tipos teria o efeito colateral de apagar a distincao de todo mundo que ja
   * usava o app.
   */
  const TIPOS_ANTIGOS = {
    culto: 'missa',
    louvor: 'missa',
    missa: 'missa',
    ensaio: 'ensaio',
    rehearsal: 'show',
    show: 'show',
    outro: 'outro',
  };

  function normEscala(e) {
    e = e || {};
    // Tipos antigos viram os novos. Quem ja usava o app tem 'culto' e
    // 'rehearsal' gravados no armazenamento; sem esta traducao o evento cairia
    // no padrao e viraria 'outro', perdendo a cor e o icone sem avisar. A
    // traducao acontece na normalizacao, ou seja, na leitura — nao aqui, onde
    // o evento ja seria gravado de volta.
    const tipoLido = TIPOS_ANTIGOS[String(e.tipo || '').toLowerCase()] || String(e.tipo || '');
    return {
      id: e.id || U.uid('esc'),
      data: /^\d{4}-\d{2}-\d{2}$/.test(e.data) ? e.data : U.todayKey(),
      hora: /^\d{2}:\d{2}$/.test(e.hora || '') ? e.hora : '',
      titulo: String(e.titulo || 'Missa').slice(0, 120),
      local: String(e.local || '').slice(0, 160),
      tipo: TIPOS.indexOf(tipoLido) >= 0 ? tipoLido : 'missa',
      obs: String(e.obs || ''),
      status: ['rascunho', 'confirmada', 'tocada'].indexOf(e.status) >= 0 ? e.status : 'rascunho',
      musicas: (Array.isArray(e.musicas) ? e.musicas : []).map(normMusica),
      criadoEm: e.criadoEm || Date.now(),
      atualizadoEm: e.atualizadaEm || Date.now(),
    };
  }

  function normMusica(m) {
    m = m || {};
    return {
      id: m.id || U.uid('mus'),
      nome: String(m.nome || '').slice(0, 160),
      artista: String(m.artista || '').slice(0, 160),
      tom: String(m.tom || '').slice(0, 12),
      bpm: m.bpm ? U.clamp(parseInt(m.bpm, 10) || 0, 20, 320) : '',
      compasso: m.compasso || '',
      categoria: String(m.categoria || '').slice(0, 40),
      responsavel: String(m.responsavel || '').slice(0, 80),
      cifraId: m.cifraId || null,
      yt: String(m.yt || '').slice(0, 600),
      ytId: m.ytId || '',
      cf: String(m.cf || '').slice(0, 600),
      foto: m.foto || '',
      obs: String(m.obs || '').slice(0, 600),
    };
  }

  function normCifra(c) {
    c = c || {};
    return {
      id: c.id || U.uid('cif'),
      titulo: String(c.titulo || 'Sem titulo').slice(0, 160),
      artista: String(c.artista || '').slice(0, 160),
      tom: String(c.tom || '').slice(0, 12),
      bpm: c.bpm ? U.clamp(parseInt(c.bpm, 10) || 0, 20, 320) : '',
      compasso: c.compasso || '4/4',
      categoria: String(c.categoria || '').slice(0, 40),
      tags: Array.isArray(c.tags) ? c.tags.slice(0, 20).map(function (t) { return String(t).slice(0, 30); }) : [],
      letra: String(c.letra || ''),
      cifra: String(c.cifra || ''),
      criadoEm: c.criadoEm || Date.now(),
      atualizadoEm: Date.now(),
    };
  }

  function salvar() {
    db.meta.atualizadoEm = Date.now();
    try {
      const json = JSON.stringify(db);
      if (U.byteLen(json) > MAX_BYTES) {
        ultimoErro = 'cheio';
        try { localStorage.setItem(STORAGE_KEY, json); } catch (e) { /* ignora */ }
        emitir('cota', {});
        return false;
      }
      localStorage.setItem(STORAGE_KEY, json);
      ultimoErro = null;
      return true;
    } catch (e) {
      ultimoErro = (e && e.name === 'QuotaExceededError') ? 'cheio' : 'erro';
      emitir('erro', { err: e });
      return false;
    }
  }
  function salvarLogo() { clearTimeout(timer); timer = setTimeout(salvar, 300); }
  function gravar() { clearTimeout(timer); return salvar(); }

  function assinar(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }
  function emitir(tipo, payload) {
    listeners.slice().forEach(function (fn) {
      try { fn(tipo, payload, db); } catch (e) { console.error('[Store]', e); }
    });
  }
  function mudou(what) { salvarLogo(); emitir('mudou', { what: what || 'db' }); }

  function escalas() { return db.escalas; }
  function porData(data) {
    return db.escalas.filter(function (e) { return e.data === data; })
      .sort(function (a, b) { return (a.hora || '99:99').localeCompare(b.hora || '99:99'); });
  }
  function porId(id) { return db.escalas.find(function (e) { return e.id === id; }) || null; }
  function cmp(a, b) {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    return (a.hora || '').localeCompare(b.hora || '');
  }
  function proximas(limite) {
    const hoje = U.todayKey();
    return db.escalas.filter(function (e) { return e.data >= hoje; }).sort(cmp).slice(0, limite || 5);
  }
  function ultimas(limite) { return db.escalas.slice().sort(cmp).reverse().slice(0, limite || 20); }

  function cifras() { return db.cifras; }
  function cifraPorId(id) { return db.cifras.find(function (c) { return c.id === id; }) || null; }
  function filtrarCifras(opts) {
    opts = opts || {};
    const q = U.norm(opts.q || '');
    const tom = opts.tom || '';
    const cat = opts.categoria || '';
    const lista = db.cifras.filter(function (c) {
      if (tom && c.tom !== tom) return false;
      if (cat && c.categoria !== cat) return false;
      return true;
    });
    if (q) {
      // Busca tolerante a erro. Sem ela, digitar "prezoisa" no celular nao
      // acha "Preziosa" — e a troca de duas letras vizinhas e o erro mais
      // comum de dedo em tela deitada. A ordem passa a ser por relevancia,
      // que e o que a pessoa digitou; sem busca, continua por ultima edicao.
      if (global.Search) return global.Search.buscarItens(lista, q, 0);
    }
    return lista.slice().sort(function (a, b) { return (b.atualizadaEm || 0) - (a.atualizadaEm || 0); });
  }
  function categorias() {
    const s = new Set();
    db.cifras.forEach(function (c) { if (c.categoria) s.add(c.categoria); });
    db.escalas.forEach(function (e) { e.musicas.forEach(function (m) { if (m.categoria) s.add(m.categoria); }); });
    return Array.from(s).sort();
  }
  function tons() {
    const s = new Set();
    db.cifras.forEach(function (c) { if (c.tom) s.add(c.tom); });
    db.escalas.forEach(function (e) { e.musicas.forEach(function (m) { if (m.tom) s.add(m.tom); }); });
    return Array.from(s);
  }
  function metricas() {
    const hoje = U.todayKey();
    const futuras = db.escalas.filter(function (e) { return e.data >= hoje; });
    return {
      escalas: db.escalas.length,
      cifras: db.cifras.length,
      musicas: db.escalas.reduce(function (s, e) { return s + e.musicas.length; }, 0),
      proximas: futuras.length,
      confirmadas: db.escalas.filter(function (e) { return e.status === 'confirmada'; }).length,
      ensaios: db.escalas.filter(function (e) { return e.tipo === 'ensaio' || e.tipo === 'rehearsal'; }).length,
      porTom: db.escalas.reduce(function (m, e) {
        e.musicas.forEach(function (x) { if (x.tom) m[x.tom] = (m[x.tom] || 0) + 1; });
        return m;
      }, {}),
    };
  }

  function ajuste(k, padrao) {
    const v = db.ajustes[k];
    return v === undefined ? padrao : v;
  }
  function setAjuste(k, v) { db.ajustes[k] = v; mudou('ajustes'); }

  function exportar() {
    return JSON.stringify({
      app: 'Acorde', version: SCHEMA,
      exportadoEm: new Date().toISOString(),
      escalas: db.escalas, cifras: db.cifras, ajustes: db.ajustes,
    }, null, 2);
  }
  function importar(json, modo) {
    let d;
    try { d = typeof json === 'string' ? JSON.parse(json) : json; }
    catch (e) { throw new Error('Arquivo invalido: nao e um backup JSON valido.'); }
    if (!d || typeof d !== 'object') throw new Error('Arquivo invalido.');
    const inc = migrar(d);
    if (modo === 'substituir') {
      db = vazio();
      db.escalas = inc.escalas; db.cifras = inc.cifras;
      db.ajustes = Object.assign(db.ajustes, inc.ajustes);
    } else {
      const eids = new Set(db.escalas.map(function (e) { return e.id; }));
      inc.escalas.forEach(function (e) {
        if (eids.has(e.id)) return;
        if (db.escalas.some(function (x) { return x.data === e.data && x.titulo === e.titulo && x.hora === e.hora; })) return;
        eids.add(e.id); db.escalas.push(e);
      });
      const cids = new Set(db.cifras.map(function (c) { return c.id; }));
      inc.cifras.forEach(function (c) {
        if (cids.has(c.id)) return;
        if (db.cifras.some(function (x) { return x.titulo === c.titulo && x.artista === c.artista; })) return;
        cids.add(c.id); db.cifras.push(c);
      });
    }
    gravar();
    emitir('importou', { escalas: inc.escalas.length, cifras: inc.cifras.length });
    return { escalas: inc.escalas.length, cifras: inc.cifras.length, ok: true };
  }
  function apagar() {
    db = vazio();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignora */ }
    emitir('mudou', { what: 'reset' });
  }
  function storageInfo() {
    let used = 0;
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) used = U.byteLen(s); } catch (e) { /* ignora */ }
    return { used, limit: MAX_BYTES, pct: Math.min(100, Math.round((used / MAX_BYTES) * 100)) };
  }

  global.Store = {
    STORAGE_KEY, SCHEMA,
    carregar, salvar, salvarLogo, gravar, assinar, emitir, mudou,
    get db() { return db; }, vazio,
    escalas, porData, porId, proximas, ultimas, cmp,
    cifras, cifraPorId, filtrarCifras, categorias, tons,
    metricas, ajuste, setAjuste,
    exportar, importar, apagar, storageInfo,
    normEscala, normMusica, normCifra,
  };
})(typeof window !== 'undefined' ? window : globalThis);