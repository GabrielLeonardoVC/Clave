/* =========================================================
   ACORDE - views/hoje.js
   Painel: proximo evento, atalhos, resumo, avisos.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const S = global.Store;
  const UI = global.UI;
  const R = global.Render;
  const { el, $ } = U;
  const V = global.Views || (global.Views = {});

  function render(root, params) {
    U.clear(root);
    const m = S.metricas();
    const hoje = U.todayKey();
    const prox = S.proximas(4);
    const hojeEv = S.porData(hoje);

    /* ---- faixa principal ---- */
    if (prox.length) {
      const p = prox[0];
      const d = U.diffDays(new Date(), U.fromKey(p.data));
      const quando = d === 0 ? 'HOJE' : d === 1 ? 'AMANHÃ' : U.fmtRelativeDay(p.data).toUpperCase();
      root.appendChild(el('button', {
        class: 'hero w-full', style: { textAlign: 'left', cursor: 'pointer' },
        onclick: function () { global.App.ir('agenda', { data: p.data, abrir: p.id }); },
      }, [
        el('div', { class: 'k' }, 'PRÓXIMO · ' + quando),
        el('div', { class: 't' }, p.titulo + (p.hora ? ' · ' + U.fmtTime(p.hora) : '')),
        el('div', { class: 'm' }, [
          U.fmtDateLong(p.data),
          p.local ? ' · ' + p.local : '',
          ' · ' + p.musicas.length + (p.musicas.length === 1 ? ' música' : ' músicas'),
        ].join('')),
        el('div', { class: 'cta' }, el('div', { class: 'btn' }, [
          el('i', { 'data-lucide': p.musicas.length ? 'play' : 'arrow-right' }),
          p.musicas.length ? 'Abrir o ensaio' : 'Abrir escala',
        ])),
      ]));
    } else {
      root.appendChild(el('div', { class: 'hero' }, [
        el('div', { class: 'k' }, 'BEM-VINDO AO ACORDE'),
        el('div', { class: 't' }, 'Monte seu primeiro ensaio'),
        el('div', { class: 'm' }, 'Escolha a data, arraste as músicas e mande pro time.'),
        el('div', { class: 'cta' }, el('button', { class: 'btn', onclick: function () { global.App.ir('agenda', { nova: true }); } },
          [el('i', { 'data-lucide': 'plus' }), 'Criar escala'])),
      ]));
    }

    /* ---- ações rápidas ---- */
    root.appendChild(el('div', { class: 'mt-5' }, el('div', { class: 'quick-grid' }, [
      rapido('calendar-plus', 'Novo ensaio', 'gold', function () { global.App.ir('agenda', { nova: true }); }),
      rapido('music-4', 'Nova cifra', 'green', function () { V.repertorio && V.repertorio.novo(); }),
      rapido('play-circle', 'Estúdio', 'blue', abrirUltimoEstudio),
      rapido('clipboard-paste', 'Colar', '', function () { V.repertorio && V.repertorio.colar(); }),
    ])));

    /* ---- estatísticas ---- */
    root.appendChild(el('div', { class: 'mt-5' }, el('div', { class: 'grid-auto' }, [
      R.statCard({ icon: 'calendar-check', value: m.proximas, label: 'Próximos', color: 'brand' }),
      R.statCard({ icon: 'file-music', value: m.cifras, label: 'Cifras', color: 'gold' }),
      R.statCard({ icon: 'list-music', value: m.musicas, label: 'Músicas', color: 'ok' }),
      R.statCard({ icon: 'users', value: m.ensaios, label: 'Ensaios', color: 'violet' }),
    ])));

    /* ---- hoje ---- */
    if (hojeEv.length) {
      root.appendChild(titulo('sun', 'Hoje'));
      const box = el('div', { class: 'card' });
      hojeEv.forEach(function (e) { box.appendChild(linhaEvento(e)); });
      root.appendChild(box);
    }

    /* ---- próximos ---- */
    if (prox.length) {
      root.appendChild(titulo('clock', 'Próximos eventos'));
      const box = el('div', { class: 'card' });
      prox.slice(0, 4).forEach(function (e) { box.appendChild(linhaEvento(e)); });
      root.appendChild(box);
    }

    /* ---- ensaios da semana ---- */
    const semana = S.escalas().filter(function (e) {
      const d = U.diffDays(new Date(), U.fromKey(e.data));
      return d >= 0 && d <= 6;
    });
    if (semana.length) {
      root.appendChild(titulo('calendar-range', 'Esta semana'));
      const box = el('div', { class: 'card' });
      U.sortBy(semana, function (e) { return e.data + (e.hora || ''); }).forEach(function (e) { box.appendChild(linhaEvento(e)); });
      root.appendChild(box);
    }

    /* ---- tons mais tocados ---- */
    const tons = Object.keys(m.porTom).sort(function (a, b) { return m.porTom[b] - m.porTom[a]; }).slice(0, 8);
    if (tons.length) {
      root.appendChild(titulo('music-2', 'Tons que você mais toca'));
      root.appendChild(el('div', { class: 'chips' }, tons.map(function (t) {
        return el('button', { class: 'chip', onclick: function () { global.App.ir('repertorio', { tom: t }); } },
          t + ' · ' + m.porTom[t]);
      })));
    }

    /* ---- ferramentas ---- */
    root.appendChild(titulo('wrench', 'Ferramentas'));
    root.appendChild(el('div', { class: 'grid-auto-lg' }, [
      cartao('timer', 'Metrônomo', 'BPM, compasso e tap', function () { V.teoria && V.teoria.metronome(); }),
      cartao('shuffle', 'Transpor', 'Mude o tom de qualquer cifra', function () { V.teoria && V.teoria.transpor(); }),
      cartao('guitar', 'Acordes', 'Formas no violão', function () { V.teoria && V.teoria.acordes(); }),
      cartao('circle-dot', 'Círculo das quintas', 'Tons e relativas', function () { V.teoria && V.teoria.circulo(); }),
    ]));

    /* ---- armazenamento ---- */
    const info = S.storageInfo();
    if (info.pct > 55) {
      root.appendChild(el('div', { class: 'card mt-4' }, [
        el('div', { class: 'row between mb-2' }, [
          el('span', { class: 'fs-sm fw-7' }, 'Armazenamento'),
          el('span', { class: 'fs-xs muted' }, U.fmtBytes(info.used) + ' · ' + info.pct + '%'),
        ]),
        el('div', { class: 'progress' + (info.pct > 85 ? ' danger' : info.pct > 70 ? ' warn' : '') },
          el('i', { style: { width: Math.min(100, info.pct) + '%' } })),
        info.pct > 80 ? el('p', { class: 'fs-xs muted mt-2' }, 'Faça backup em Ajustes e tire fotos pesadas.') : null,
      ]));
    }

    UI.icons(root);
  }

  function titulo(icon, txt) { return el('div', { class: 'section-title mt-5' }, [el('i', { 'data-lucide': icon }), txt]); }

  function rapido(icon, label, cls, onclick) {
    return el('button', { class: 'quick ' + cls, onclick: onclick }, [
      el('div', { class: 'ic' }, el('i', { 'data-lucide': icon })),
      el('span', {}, label),
    ]);
  }

  function cartao(icon, titulo, sub, onclick) {
    return el('button', { class: 'song-card', onclick: onclick }, [
      el('div', { class: 'row gap-3' }, [
        el('div', { class: 'avatar' }, el('i', { 'data-lucide': icon, style: { width: '17px', height: '17px' } })),
        el('div', { class: 'grow', style: { textAlign: 'left', minWidth: '0' } }, [
          el('div', { class: 'n' }, titulo),
          el('div', { class: 'a' }, sub),
        ]),
        el('i', { 'data-lucide': 'chevron-right', style: { width: '16px', height: '16px', color: 'var(--ink-4)', flex: 'none' } }),
      ]),
    ]);
  }

  function linhaEvento(e) {
    const d = U.diffDays(new Date(), U.fromKey(e.data));
    // O icone acompanha o tipo, e e musical de proposito: um icone de
    // templado na linha do tempo empurra o app para um lugar que ele nao ocupa.
    const ic = e.tipo === 'ensaio' ? 'users' : e.tipo === 'show' ? 'mic' : e.tipo === 'outro' ? 'star' : 'music';
    return el('button', { class: 'list-item tap', style: { width: '100%', textAlign: 'left' }, onclick: function () { global.App.ir('agenda', { data: e.data, abrir: e.id }); } }, [
      el('div', { class: 'avatar' + (d === 0 ? ' gold' : '') }, el('i', { 'data-lucide': ic, style: { width: '17px', height: '17px' } })),
      el('div', { class: 'grow', style: { minWidth: '0' } }, [
        el('div', { class: 'fs-md fw-7 ellipsis' }, e.titulo),
        el('div', { class: 'fs-xs muted ellipsis' }, [
          U.fmtRelativeDay(e.data) + (e.hora ? ' ' + U.fmtTime(e.hora) : ''),
          ' · ' + e.musicas.length + (e.musicas.length === 1 ? ' música' : ' músicas'),
          e.status === 'confirmada' ? ' · confirmada' : '',
        ].join('')),
      ]),
      e.status === 'confirmada'
        ? el('i', { 'data-lucide': 'check-circle-2', style: { width: '16px', height: '16px', color: 'var(--signal-600)', flex: 'none' } })
        : el('i', { 'data-lucide': 'chevron-right', style: { width: '16px', height: '16px', color: 'var(--ink-4)', flex: 'none' } }),
    ]);
  }

  function abrirUltimoEstudio() {
    const ult = S.ultimas(1)[0];
    if (ult && ult.musicas.length) global.Studio.abrir(ult.musicas[0], ult);
    else UI.toast('Abra uma escala com músicas primeiro', { tipo: 'err' });
  }

  V.hoje = { render: render };
  V.home = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
