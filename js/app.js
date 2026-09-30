/* =========================================================
   ACORDE - app.js
   Rotas, navegacao, personalizacao e boot.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const S = global.Store;
  const UI = global.UI;
  const { el, $ } = U;

  const ROTAS = [
    { id: 'hoje', titulo: 'Hoje', sub: 'escalas e ensaio', icon: 'sun', mobile: true },
    { id: 'agenda', titulo: 'Agenda', sub: 'ensaios e missas', icon: 'calendar-days', mobile: true },
    { id: 'repertorio', titulo: 'Repertório', sub: 'cifras', icon: 'library', mobile: true },
    { id: 'teoria', titulo: 'Teoria', sub: 'acordes e escalas', icon: 'graduation-cap', mobile: true },
    { id: 'ajustes', titulo: 'Ajustes', sub: 'dados e mais', icon: 'settings', mobile: false },
  ];

  let rotaAtual = 'hoje';
  const vistas = global.Views || (global.Views = {});

  function rota(id) {
    return ROTAS.find(function (r) { return r.id === id; }) || ROTAS[0];
  }

  function ir(id, params) {
    const r = rota(id);
    rotaAtual = id;
    U.$$('.page').forEach(function (p) { p.classList.remove('active'); });
    const page = document.getElementById('page-' + id);
    if (page) page.classList.add('active');
    marcar(r);
    const v = vistas[id];
    if (v && typeof v.render === 'function') {
      try { v.render(page, params || {}); }
      catch (e) { console.error('[Acorde] erro ao renderizar ' + id + ':', e); }
    }
    global.scrollTo(0, 0);
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignora */ }
  }

  function marcar(r) {
    ['#bottomnav button', '#drawer-host .drawer-item'].forEach(function (sel) {
      U.$$(sel).forEach(function (b) {
        if (b.dataset.rota === rotaAtual) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
    });
    const s = $('#page-sub');
    if (s) s.textContent = r.sub;
  }

  function montarNav() {
    const bn = $('#bottomnav');
    U.clear(bn);
    ROTAS.filter(function (r) { return r.mobile; }).forEach(function (r) {
      bn.appendChild(el('button', { 'data-rota': r.id, 'aria-label': r.titulo, onclick: function () { ir(r.id); } },
        [el('i', { 'data-lucide': r.icon }), el('span', {}, r.titulo)]));
    });
    bn.appendChild(el('button', { 'aria-label': 'Mais', onclick: abrirDrawer },
      [el('i', { 'data-lucide': 'ellipsis' }), el('span', {}, 'Mais')]));
    UI.icons(bn);
  }

  function abrirDrawer() {
    const host = $('#drawer-host');
    U.clear(host);
    const drawer = el('div', { class: 'drawer', onclick: function (e) { if (e.target === drawer) fechar(); } });
    const painel = el('div', { class: 'drawer-panel' });
    painel.appendChild(el('h4', {}, 'Navegar'));
    ROTAS.forEach(function (r) {
      painel.appendChild(el('button', { class: 'drawer-item', 'data-rota': r.id, onclick: function () { fechar(); ir(r.id); } },
        [el('i', { 'data-lucide': r.icon }), el('span', { class: 'grow' }, r.titulo)]));
    });
    painel.appendChild(el('h4', {}, 'Ferramentas'));
    painel.appendChild(el('button', { class: 'drawer-item', onclick: function () { fechar(); vistas.repertorio.colar(); } },
      [el('i', { 'data-lucide': 'clipboard-paste' }), el('span', { class: 'grow' }, 'Colar cifra')]));
    painel.appendChild(el('button', { class: 'drawer-item', onclick: function () { fechar(); vistas.teoria.transpor(); } },
      [el('i', { 'data-lucide': 'shuffle' }), el('span', { class: 'grow' }, 'Transpor')]));
    painel.appendChild(el('button', { class: 'drawer-item', onclick: function () { fechar(); vistas.teoria.metronome(); } },
      [el('i', { 'data-lucide': 'timer' }), el('span', { class: 'grow' }, 'Metrônomo')]));
    painel.appendChild(el('h4', {}, 'Ajuda'));
    painel.appendChild(el('button', { class: 'drawer-item', onclick: function () { fechar(); sobre(); } },
      [el('i', { 'data-lucide': 'info' }), el('span', { class: 'grow' }, 'Sobre o Acorde')]));
    painel.appendChild(el('button', { class: 'drawer-item', onclick: function () { fechar(); atalhos(); } },
      [el('i', { 'data-lucide': 'keyboard' }), el('span', { class: 'grow' }, 'Atalhos')]));
    drawer.appendChild(painel);
    host.appendChild(drawer);
    UI.icons(drawer);
    function fechar() { U.clear(host); }
  }

  /* =======================
     TEMA / PERSONALIZACAO
     ======================= */
  function aplicarTema() {
    const tema = S.ajuste('tema', 'auto');
    document.documentElement.setAttribute('data-theme', tema);
    document.documentElement.setAttribute('data-accent', S.ajuste('accent', 'ember'));
    document.documentElement.setAttribute('data-density', S.ajuste('densidade', 'normal'));
    document.documentElement.setAttribute('data-fontsize', S.ajuste('fontsize', 'normal'));
    document.documentElement.setAttribute('data-motion', S.ajuste('motion', 'on'));

    const escuro = tema === 'dark' || (tema === 'auto' && global.matchMedia
      && global.matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', escuro ? '#12100E' : '#F5F1E9');

    const btn = $('#btn-theme');
    if (btn) {
      U.clear(btn);
      btn.appendChild(el('i', { 'data-lucide': tema === 'dark' ? 'moon' : tema === 'light' ? 'sun' : 'sun-moon' }));
      btn.title = 'Tema: ' + (tema === 'auto' ? 'automatico' : tema === 'dark' ? 'escuro' : 'claro');
    }
    UI.icons(btn);

    if (global.Metro) {
      global.Metro.aplicar({
        bpm: S.ajuste('bpmPadrao', 100),
        som: S.ajuste('metroSom', 'click'),
        volume: S.ajuste('metroVolume', 0.8),
        subdivisao: S.ajuste('metroSubdivisao', 1),
        acento: S.ajuste('metroAcento', true),
      });
    }
  }

  function cicloTema() {
    const novo = UI.cycleTheme(S.ajuste('tema', 'auto'));
    S.setAjuste('tema', novo);
    aplicarTema();
    UI.toast('Tema: ' + (novo === 'auto' ? 'automatico' : novo === 'dark' ? 'escuro' : 'claro'), { tipo: 'ok' });
  }
  /* =======================
     BUSCA GLOBAL
     ======================= */
  function busca() {
    const input = el('input', { class: 'input', placeholder: 'Buscar musica, artista, evento ou tag...', autocomplete: 'off' });
    const res = el('div', { class: 'mt-3' });

    function montar() {
      U.clear(res);
      const q = U.norm(input.value.trim());
      if (!q) {
        res.appendChild(UI.empty({ icon: 'search', title: 'Buscar em tudo',
          message: 'Cifras salvas, hinos, musicas usadas nas escalas e nomes de evento.' }));
        return;
      }
      const Search = global.Search;
      // Com o modulo de busca carregado, a busca global passa a tolerar erro de
      // digitacao. Sem ele, cai no substring exato de sempre — o app abre sem
      // erro, so que a busca volta a ser burra.
      const tem = function (s) {
        if (Search) return Search.casaCom(s, q);
        return U.norm(s).indexOf(q) >= 0;
      };
      const achar = function (itens, take) {
        if (Search) return Search.buscarItens(itens, q, take);
        return itens.filter(function (i) { return tem(i._texto); }).slice(0, take || 0);
      };
      const cifras = achar(S.cifras().map(function (c) {
        return { titulo: c.titulo, artista: c.artista, categoria: c.categoria, tags: c.tags, tom: c.tom, _ref: c };
      }), 6).map(function (r) { return r._ref; });
      const hinos = achar((global.HINOS ? global.HINOS.list : []).map(function (h) {
        return { titulo: h.titulo, artista: h.artista, _texto: h.titulo + ' ' + h.artista, _ref: h };
      }), 5).map(function (r) { return r._ref; });
      const musicas = [];
      const porMusica = Search ? Search.buscar(S.escalas().reduce(function (acc, e) {
        e.musicas.forEach(function (m) { acc.push({ nome: m.nome, tom: m.tom, _ref: { m: m, e: e } }); });
        return acc;
      }, []), q, { limit: 7, incluirLetra: false }) : [];
      if (Search) {
        porMusica.forEach(function (r) { musicas.push(r.item._ref); });
      } else {
        S.escalas().forEach(function (e) {
          e.musicas.forEach(function (m) { if (tem(m.nome)) musicas.push({ m: m, e: e }); });
        });
        musicas.length = Math.min(musicas.length, 7);
      }
      const eventos = achar(S.escalas().map(function (e) {
        return { titulo: e.titulo, _texto: e.titulo + ' ' + (e.local || ''), _ref: e };
      }), 5).map(function (r) { return r._ref; });

      if (cifras.length) secao('Cifras', cifras.map(function (c) {
        return linha('file-music', c.titulo, c.artista || c.tom, function () { h.close(); ir('repertorio', { id: c.id }); });
      }));
      if (hinos.length) secao('Hinos', hinos.map(function (h) {
        return linha('book-open', h.titulo, h.artista, function () { h.close(); ir('repertorio', { aba: 'hinos', importar: h.id }); });
      }));
      if (musicas.length) secao('Musicas em escalas', musicas.slice(0, 7).map(function (x) {
        return linha('music', x.m.nome, U.fmtDate(x.e.data) + ' - ' + x.e.titulo, function () { h.close(); ir('agenda', { data: x.e.data, abrir: x.e.id }); });
      }));
      if (eventos.length) secao('Eventos', eventos.map(function (e) {
        return linha('calendar-days', e.titulo, U.fmtDate(e.data), function () { h.close(); ir('agenda', { data: e.data, abrir: e.id }); });
      }));
      if (!cifras.length && !hinos.length && !musicas.length && !eventos.length) {
        res.appendChild(UI.empty({ icon: 'search-x', title: 'Nada encontrado', message: 'Tente outro termo.' }));
      }
    }
    function secao(titulo, itens) {
      res.appendChild(el('div', { class: 'hr-label' }, titulo));
      const l = el('div', { class: 'list' });
      itens.forEach(function (it) {
        l.appendChild(el('button', { class: 'list-item tap', style: { width: '100%', textAlign: 'left' }, onclick: it.go }, [
          el('div', { class: 'avatar' }, el('i', { 'data-lucide': it.icon, style: { width: '17px', height: '17px' } })),
          el('div', { class: 'grow', style: { minWidth: '0' } }, [
            el('div', { class: 'fs-md fw-7 ellipsis' }, it.title),
            it.sub ? el('div', { class: 'fs-xs muted ellipsis' }, it.sub) : null,
          ]),
          el('i', { 'data-lucide': 'chevron-right', style: { width: '16px', height: '16px', color: 'var(--ink-4)' } }),
        ]));
      });
      res.appendChild(l);
    }
    function linha(icon, title, sub, go) { return { icon: icon, title: title, sub: sub, go: go }; }

    const h = UI.sheet({ title: 'Buscar', body: el('div', {}, [input, res]) });
    input.addEventListener('input', U.debounce(montar, 130));
    montar();
    setTimeout(function () { input.focus(); }, 80);
  }

  /* =======================
     SOBRE
     ======================= */
  function sobre() {
    UI.sheet({
      title: 'acorde', sub: 'escalas, cifras e ensaio',
      body: el('div', { class: 'stack gap-3' }, [
        el('div', { class: 'row gap-3' }, [
          el('img', { src: 'assets/logo.svg', width: '46', height: '46', alt: '' }),
          el('p', { class: 'fs-sm c-2' }, 'A mesa de trabalho de quem toca: monte a escala, decore a cifra no estudio e chegue no ensaio com o time junto.'),
        ]),
        el('div', { class: 'hr-label' }, 'O que ele faz'),
        feature([
          ['calendar-days', 'Agenda com ensaios, missas e shows, varios no mesmo dia'],
          ['library', 'Repertorio central: cadastre uma vez, use em qualquer escala'],
          ['play-circle', 'Estudio: video do YouTube + foto da cifra lado a lado'],
          ['pen-tool', 'Desenhe por cima da foto (marca, seta, apaga)'],
          ['timer', 'Metronomo independente - continua com o video rodando'],
          ['shuffle', 'Transposicao de tom e de cifra inteira'],
          ['link', 'Busca correta no Cifra Club, Letras.mus.br e YouTube'],
          ['share-2', 'Manda no WhatsApp, exporta .ics, imprime'],
          ['bell', 'Lembrete antes de cada ensaio e culto'],
        ]),
        el('div', { class: 'hr-label' }, 'Privacidade'),
        el('p', { class: 'fs-sm c-3' }, 'Tudo fica salvo no seu aparelho. Nada vai para servidor nenhum.'),
        el('div', { class: 'hr-label' }, 'Aviso'),
        el('p', { class: 'fs-sm c-3' }, 'As cifras de hinos sao referencia e variam por hinario. Confira e edite a sua versao.'),
      ]),
      foot: [el('button', { class: 'btn btn-primary', onclick: function () { UI.closeAllSheets(); } }, 'Fechar')],
    });
    function feature(itens) {
      return el('div', { class: 'list' }, itens.map(function (it) {
        return el('div', { class: 'list-item' }, [
          el('i', { 'data-lucide': it[0], style: { width: '18px', height: '18px', color: 'var(--primary)' } }),
          el('span', { class: 'fs-sm' }, it[1]),
        ]);
      }));
    }
  }

  function atalhos() {
    const lista = [
      ['1 - 5', 'Hoje, Agenda, Repertorio, Teoria, Ajustes'],
      ['/', 'Buscar em tudo'],
      ['N', 'Novo evento'],
      ['M', 'Nova cifra'],
      ['E', 'Abrir o estudio da ultima escala'],
      ['T', 'Alternar tema'],
      ['Esc', 'Fechar janelas'],
      ['?', 'Esta ajuda'],
    ];
    UI.sheet({
      title: 'Atalhos de teclado',
      body: el('table', { class: 'chord-table' }, [el('tbody', {}, lista.map(function (a) {
        return el('tr', {}, [el('td', { class: 'cdeg', style: { width: '80px' } }, a[0]), el('td', {}, a[1])]);
      }))]),
      foot: [el('button', { class: 'btn btn-primary', onclick: function () { UI.closeAllSheets(); } }, 'Fechar')],
    });
  }

  /* =======================
     ATALHOS DE TECLADO
     ======================= */
  function aoTeclar(ev) {
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || ev.target.isContentEditable) return;
    const k = ev.key;
    if (k === 'Escape') { UI.closeAllSheets(); U.clear($('#drawer-host')); return; }
    if (k >= '1' && k <= '5') { const r = ROTAS[+k - 1]; if (r) { ev.preventDefault(); ir(r.id); } return; }
    if (k === '/') { ev.preventDefault(); busca(); }
    else if (k === '?') { ev.preventDefault(); atalhos(); }
    else if (k === 't' || k === 'T') cicloTema();
    else if (k === 'n' || k === 'N') { ev.preventDefault(); ir('agenda', { nova: true }); }
    else if (k === 'm' || k === 'M') { ev.preventDefault(); if (vistas.repertorio) vistas.repertorio.novo(); }
    else if (k === 'e' || k === 'E') {
      ev.preventDefault();
      const ult = S.ultimas(1)[0];
      if (ult && ult.musicas.length) global.Studio.abrir(ult.musicas[0], ult);
      else UI.toast('Abra uma escala com musicas primeiro', { tipo: 'err' });
    }
  }

  /* =======================
     BOOT
     ======================= */
  let avisouCota = false;
  function vigiarCota() {
    if (avisouCota) return;
    const info = S.storageInfo();
    if (info.pct >= 85) {
      avisouCota = true;
      UI.toast('Armazenamento cheio (' + info.pct + '%). Faca backup em Ajustes.', { tipo: 'err', dur: 9000 });
    }
  }

  function iniciar() {
    S.carregar();
    montarNav();
    aplicarTema();

    $('#btn-search').addEventListener('click', busca);
    $('#btn-theme').addEventListener('click', cicloTema);
    document.addEventListener('keydown', aoTeclar);

    S.assinar(function (tipo) {
      if (tipo === 'mudou' || tipo === 'importou') { aplicarTema(); vigiarCota(); }
    });

    if (global.matchMedia) {
      const mq = global.matchMedia('(prefers-color-scheme: dark)');
      const aoMudar = function () { if (S.ajuste('tema', 'auto') === 'auto') aplicarTema(); };
      if (mq.addEventListener) mq.addEventListener('change', aoMudar);
      else if (mq.addListener) mq.addListener(aoMudar);
    }

    const hash = (location.hash || '').replace('#', '');
    ir(ROTAS.some(function (r) { return r.id === hash; }) ? hash : 'hoje');
    global.addEventListener('hashchange', function () {
      const h = (location.hash || '').replace('#', '');
      if (h && h !== rotaAtual) ir(h);
    });

    const boot = $('#boot');
    if (boot) {
      boot.style.transition = 'opacity .25s';
      boot.style.opacity = '0';
      setTimeout(function () { boot.remove(); }, 260);
    }

    UI.icons(document.body);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* opcional */ });
    }
    vigiarCota();

    if (global.Notify) {
      global.Notify.iniciar();
      setTimeout(function () { global.Notify.avisoInterno(); }, 2400);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  global.App = { ir: ir, busca: busca, sobre: sobre, atalhos: atalhos, cicloTema: cicloTema, aplicarTema: aplicarTema, ROTAS: ROTAS };
})(typeof window !== 'undefined' ? window : globalThis);