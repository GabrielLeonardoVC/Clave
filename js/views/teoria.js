/* =========================================================
   ACORDE - views/teoria.js
   Acordes, escalas, circulo e metronomo.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const S = global.Store;
  const UI = global.UI;
  const M = global.Music;
  const R = global.Render;
  const Metro = global.Metro;
  const { el, $ } = U;
  const V = global.Views || (global.Views = {});

  let aba = 'acordes';
  let estAcorde = { root: 0, quality: '' };
  let estEscala = { root: 0, scale: 'major' };
  let estCifra = { texto: '', semis: 0 };

  const QUALIDADES = [
    { q: '', nome: 'Maior' }, { q: 'm', nome: 'Menor' }, { q: '7', nome: 'Dominante 7' },
    { q: 'maj7', nome: 'Maior 7' }, { q: 'm7', nome: 'Menor 7' }, { q: 'sus2', nome: 'Sus 2' },
    { q: 'sus4', nome: 'Sus 4' }, { q: 'm7b5', nome: 'Meio-dim.' }, { q: 'dim7', nome: 'Diminuto 7' },
    { q: 'aug', nome: 'Aumentado' }, { q: 'add9', nome: 'Add 9' }, { q: '6', nome: 'Maior 6' },
    { q: '9', nome: 'Dominante 9' }, { q: 'm9', nome: 'Menor 9' },
  ];

  function render(root, params) {
    if (params && params.aba) aba = params.aba;
    if (params && params.acao === 'transpor') aba = 'transpor';
    U.clear(root);
    root.appendChild(el('div', { class: 'page-head' }, [
      el('h1', {}, 'Teoria'),
      el('div', { class: 'sub' }, 'Acordes, escalas e o que você precisa na hora'),
    ]));
    const abas = [['acordes', 'Acordes', 'music-2'], ['escalas', 'Escalas', 'waves'],
      ['circulo', 'Círculo', 'circle-dot'], ['transpor', 'Transpor', 'shuffle']];
    root.appendChild(el('div', { class: 'tabs' }, abas.map(function (a) {
      return el('button', { 'aria-selected': String(aba === a[0]), onclick: function () { aba = a[0]; recarregar(); } },
        [el('i', { 'data-lucide': a[2] }), a[1]]);
    })));
    const box = el('div', {});
    if (aba === 'acordes') box.appendChild(painelAcordes());
    else if (aba === 'escalas') box.appendChild(painelEscalas());
    else if (aba === 'circulo') box.appendChild(painelCirculo());
    else box.appendChild(painelTranspor());
    root.appendChild(box);
    UI.icons(root);
  }
  function recarregar() {
    const p = document.getElementById('page-teoria');
    if (p && p.classList.contains('active')) render(p, {});
  }

  /* =======================
     ACORDES
     ======================= */
  function painelAcordes() {
    const wrap = el('div', {});
    wrap.appendChild(el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'key-round' }), 'Fundamental']));
    const fund = el('div', { class: 'key-picker mb-4' });
    R.TONS_MAIORES.forEach(function (t) {
      fund.appendChild(el('button', {
        class: 'key-cell', 'aria-pressed': String(estAcorde.root === t.pc),
        onclick: function () { estAcorde.root = t.pc; recarregar(); },
      }, M.noteName(t.pc, M.useFlatsFor(t.pc))));
    });
    wrap.appendChild(fund);

    wrap.appendChild(el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'layers' }), 'Qualidade']));
    const qual = el('div', { class: 'chips mb-4' });
    QUALIDADES.forEach(function (q) {
      qual.appendChild(el('button', { class: 'chip', 'aria-pressed': String(estAcorde.quality === q.q),
        onclick: function () { estAcorde.quality = q.q; recarregar(); } }, q.nome));
    });
    wrap.appendChild(qual);

    const nome = M.formatChord(estAcorde.root, estAcorde.quality, null, M.useFlatsFor(estAcorde.root));
    const info = M.chordInfo(estAcorde.root, estAcorde.quality, M.useFlatsFor(estAcorde.root));
    const formas = M.guitarShapes(estAcorde.root, estAcorde.quality, { maxFret: 15, limit: 6 });

    wrap.appendChild(el('div', { class: 'theory-card' }, [
      el('div', { class: 'big-key' }, nome),
      el('div', { class: 'big-scale' }, info.full + '  -  ' + info.labels.join(' - ')),
    ]));

    if (formas.length) {
      wrap.appendChild(el('div', { class: 'section-title mt-5' }, [el('i', { 'data-lucide': 'guitar' }), 'Formas no violão']));
      const g = el('div', { class: 'row gap-3 wrap' });
      formas.forEach(function (f, i) {
        g.appendChild(el('div', { class: 'stack gap-1', style: { alignItems: 'center' } }, [
          R.chordDiagram(f, { title: i === 0 ? 'Principal' : 'Alt ' + i }),
          el('div', { class: 'fs-xs muted mono' }, f.map(function (x) { return x < 0 ? 'x' : x; }).join(' ')),
        ]));
      });
      wrap.appendChild(g);
    }

    wrap.appendChild(el('div', { class: 'section-title mt-5' }, [el('i', { 'data-lucide': 'music' }), 'Notas']));
    const pills = el('div', { class: 'note-ring' });
    info.notes.forEach(function (pc, i) {
      pills.appendChild(el('span', { class: 'note-pill' + (i === 0 ? ' root' : '') },
        M.noteName(pc, M.useFlatsFor(estAcorde.root)) + (i === 0 ? ' (1a)' : '')));
    });
    wrap.appendChild(pills);
    return wrap;
  }

  /* =======================
     ESCALAS
     ======================= */
  function painelEscalas() {
    const wrap = el('div', {});
    const flat = M.useFlatsFor(estEscala.root);
    const notas = M.scaleNotes(estEscala.root, estEscala.scale, flat);
    const sc = M.SCALES[estEscala.scale];

    wrap.appendChild(el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'key-round' }), 'Tônica']));
    const fund = el('div', { class: 'key-picker mb-4' });
    R.TONS_MAIORES.forEach(function (t) {
      fund.appendChild(el('button', { class: 'key-cell', 'aria-pressed': String(estEscala.root === t.pc),
        onclick: function () { estEscala.root = t.pc; recarregar(); } }, M.noteName(t.pc, M.useFlatsFor(t.pc))));
    });
    wrap.appendChild(fund);

    wrap.appendChild(el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'waves' }), 'Escala / modo']));
    const chips = el('div', { class: 'chips mb-4' });
    Object.keys(M.SCALES).forEach(function (k) {
      chips.appendChild(el('button', { class: 'chip', 'aria-pressed': String(estEscala.scale === k),
        onclick: function () { estEscala.scale = k; recarregar(); } }, M.SCALES[k].name));
    });
    wrap.appendChild(chips);

    const menor = ['minor', 'harmonic', 'melodic', 'phrygian', 'aeolian', 'locrian'].indexOf(estEscala.scale) >= 0;
    const nome = M.noteName(estEscala.root, flat) + (menor ? ' ' + sc.short : '');
    wrap.appendChild(el('div', { class: 'theory-card' }, [
      el('div', { class: 'big-key' }, nome),
      el('div', { class: 'big-scale' }, sc.name),
      el('div', { class: 'note-ring' }, notas.map(function (pc, i) {
        return el('span', { class: 'note-pill' + (i === 0 ? ' root' : ''), title: sc.degrees[i] || '' }, M.noteName(pc, flat));
      })),
    ]));

    wrap.appendChild(el('div', { class: 'section-title mt-5' }, [el('i', { 'data-lucide': 'music-2' }), 'Acordes de cada grau']));
    const grade = el('div', { class: 'grid-auto' });
    M.scaleChords(estEscala.root, estEscala.scale, flat).forEach(function (c) {
      grade.appendChild(el('button', {
        class: 'card card-tap', style: { textAlign: 'center', padding: '12px' },
        onclick: function () {
          estAcorde.root = c.pc;
          estAcorde.quality = c.quality === 'm' ? 'm' : c.quality === 'dim' ? 'dim7' : c.quality === 'aug' ? 'aug' : '';
          aba = 'acordes'; recarregar();
        },
      }, [
        el('div', { class: 'fs-lg fw-8 mono', style: { color: 'var(--primary)' } }, c.name),
        el('div', { class: 'fs-xs muted' }, 'Grau ' + c.degree),
      ]));
    });
    wrap.appendChild(grade);

    wrap.appendChild(el('div', { class: 'section-title mt-5' }, [el('i', { 'data-lucide': 'guitar' }), 'No violão']));
    wrap.appendChild(R.scaleFretboard(notas, { rootPc: estEscala.root, flat: flat, frets: 12, showAll: true }));

    wrap.appendChild(el('div', { class: 'section-title mt-5' }, [el('i', { 'data-lucide': 'piano' }), 'No piano']));
    wrap.appendChild(R.scaleKeyboard(notas, { rootPc: estEscala.root, flat: flat, octaves: 2 }));
    return wrap;
  }

  /* =======================
     CIRCULO DAS QUINTAS
     ======================= */
  function painelCirculo() {
    const wrap = el('div', {});
    let selPc = estEscala.root;
    function montar() {
      U.clear(wrap);
      wrap.appendChild(R.circleOfFifths({ selected: selPc, onClick: function (pc) { selPc = pc; estEscala.root = pc; montar(); UI.icons(wrap); } }));
      const flat = M.useFlatsFor(selPc);
      const relM = M.relativeMinor(selPc);
      const nA = M.sharpsCount(selPc);
      const nB = M.sharpsCount(relM);
      wrap.appendChild(el('div', { class: 'card' }, el('div', { class: 'row gap-3 between wrap' }, [
        el('div', { style: { textAlign: 'center', flex: '1 1 110px' } }, [
          el('div', { class: 'fs-lg fw-8 mono', style: { color: 'var(--primary)' } }, M.noteName(selPc, flat)),
          el('div', { class: 'fs-xs muted' }, nA === 0 ? 'sem alteracoes' : nA + (nA === 1 ? ' alteracao' : ' alteracoes') + ' (♯)'),
        ]),
        el('div', { style: { textAlign: 'center', flex: '1 1 110px' } }, [
          el('div', { class: 'fs-lg fw-8 mono', style: { color: 'var(--brand-500)' } }, M.noteName(relM, flat) + 'm'),
          el('div', { class: 'fs-xs muted' }, nB === 0 ? 'sem alteracoes' : nB + (nB === 1 ? ' alteracao' : ' alteracoes') + (M.useFlatsFor(relM) ? ' (♭)' : ' (♯)')),
        ]),
        el('div', { style: { flex: '1 1 200px' } }, [
          el('div', { class: 'fs-xs muted mb-1' }, 'Escala maior'),
          el('div', { class: 'fs-sm mono' }, M.scaleNames(selPc, 'major', flat).join(' ')),
          el('div', { class: 'fs-xs muted mt-2 mb-1' }, 'Escala menor relativa'),
          el('div', { class: 'fs-sm mono' }, M.scaleNames(relM, 'minor', M.useFlatsFor(relM)).join(' ')),
        ]),
      ])));
      wrap.appendChild(el('div', { class: 'card mt-3' }, [
        el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'music-2' }), 'Acordes de ' + M.noteName(relM, M.useFlatsFor(relM)) + 'm']),
        el('div', { class: 'row gap-2 wrap' }, M.scaleChords(relM, 'minor', M.useFlatsFor(relM)).map(function (c) {
          return el('span', { class: 'chip-acorde', title: c.degree }, c.name);
        })),
      ]));
    }
    montar();
    return wrap;
  }

  /* =======================
     TRANSPOR
     ======================= */
  function painelTranspor() {
    const wrap = el('div', {});
    const ta = el('textarea', {
      class: 'textarea mono', style: { minHeight: '150px' },
      placeholder: 'Cole aqui a cifra para transpor...\n\nExemplo:\n[C]\nO Senhor e o meu pastor\nC        G\nNada me faltara',
    });
    ta.value = estCifra.texto;
    const info = el('div', { class: 'fs-sm muted mb-3' });
    const saida = el('div', { class: 'mt-3' });

    function flatPara(pc) {
      const modo = S.ajuste('usarAmoles', 'auto');
      if (modo === 'sharps') return false;
      if (modo === 'flats') return true;
      return M.useFlatsFor(pc);
    }
    function render() {
      estCifra.texto = ta.value;
      U.clear(saida); U.clear(info);
      const txt = ta.value;
      if (!txt.trim()) { info.textContent = 'Cole uma cifra acima.'; return; }
      const chords = M.extractChords(txt);
      if (!chords.length) { info.textContent = 'Nenhum acorde reconhecido.'; return; }
      const res = M.transposeCifra(txt, estCifra.semis, flatPara(M.mod12(estCifra.semis)));
      const k = M.detectKey(txt);
      const k2 = M.detectKey(res);
      const desl = estCifra.semis === 0 ? 'tom original' : (estCifra.semis > 0 ? '+' : '') + estCifra.semis + (Math.abs(estCifra.semis) === 1 ? ' semitom' : ' semitons');
      info.textContent = (k ? 'Original: ' + M.noteName(k.pc, M.useFlatsFor(k.pc)) + (k.mode === 'minor' ? 'm' : '') : '?') +
        '   -   ' + desl + (k2 ? '   -   Resultado: ' + M.noteName(k2.pc, M.useFlatsFor(k2.pc)) + (k2.mode === 'minor' ? 'm' : '') : '');
      saida.appendChild(R.cifraBox(res));
      UI.icons(saida);
    }
    ta.addEventListener('input', U.debounce(render, 300));

    const bar = el('div', { class: 'semitone-bar my-3' }, [
      el('button', { class: 'semitone', onclick: function () { estCifra.semis -= 12; render(); } }, '-8'),
      el('button', { class: 'semitone', onclick: function () { estCifra.semis -= 3; render(); } }, '-3'),
      el('button', { class: 'semitone', onclick: function () { estCifra.semis--; render(); } }, '-1'),
      el('button', { class: 'semitone', onclick: function () { estCifra.semis = 0; render(); } }, '0'),
      el('button', { class: 'semitone', onclick: function () { estCifra.semis++; render(); } }, '+1'),
      el('button', { class: 'semitone', onclick: function () { estCifra.semis += 3; render(); } }, '+3'),
      el('button', { class: 'semitone', onclick: function () { estCifra.semis += 12; render(); } }, '+8'),
    ]);

    wrap.appendChild(el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'clipboard-paste' }), 'Sua cifra']));
    wrap.appendChild(ta);
    wrap.appendChild(bar);
    wrap.appendChild(info);
    wrap.appendChild(saida);
    wrap.appendChild(el('div', { class: 'row gap-2 mt-4 wrap' }, [
      el('button', { class: 'btn btn-secondary btn-sm', onclick: function () {
        U.copy(M.transposeCifra(ta.value, estCifra.semis, flatPara(M.mod12(estCifra.semis))))
          .then(function () { UI.toast('Copiado', { tipo: 'ok' }); });
      } }, [el('i', { 'data-lucide': 'copy' }), 'Copiar resultado']),
      el('button', { class: 'btn btn-secondary btn-sm', onclick: function () {
        V.repertorio.editar(null, { cifra: M.transposeCifra(ta.value, estCifra.semis, flatPara(M.mod12(estCifra.semis))) });
      } }, [el('i', { 'data-lucide': 'save' }), 'Salvar no repertorio']),
      el('button', { class: 'btn btn-ghost btn-sm', onclick: function () { ta.value = ''; estCifra.texto = ''; estCifra.semis = 0; render(); } },
        [el('i', { 'data-lucide': 'x' }), 'Limpar']),
    ]));
    render();
    return wrap;
  }
  /* =======================
     METRONOMO SOLTO
     ======================= */
  function abrirMetronomo() {
    Metro.aplicar({
      bpm: S.ajuste('bpmPadrao', 100), som: S.ajuste('metroSom', 'click'),
      volume: S.ajuste('metroVolume', 0.8), subdivisao: S.ajuste('metroSubdivisao', 1),
      acento: S.ajuste('metroAcento', true),
    });
    const dots = el('div', { class: 'st-dots' });
    const n = Math.min(8, Metro.METRONOME.compasso);
    for (let i = 0; i < n; i++) dots.appendChild(el('i', { class: i === 0 ? 'accent' : '' }));

    const bpm = el('div', { class: 'st-bpm' }, String(Metro.METRONOME.bpm));
    const sub = el('div', { class: 'st-sub' }, Metro.METRONOME.compasso + '/4');

    const btn = el('button', {
      class: 'st-play', 'aria-label': 'Tocar',
      onclick: function () {
        const t = Metro.alternar();
        btn.classList.toggle('on', t);
        U.clear(btn);
        btn.appendChild(el('i', { 'data-lucide': t ? 'pause' : 'play' }));
        UI.icons(btn);
      },
    }, el('i', { 'data-lucide': 'play' }));

    function mover(d) {
      Metro.definir('bpm', U.clamp(Metro.METRONOME.bpm + d, 20, 320));
      bpm.textContent = String(Metro.METRONOME.bpm);
      S.setAjuste('bpmPadrao', Metro.METRONOME.bpm);
    }

    const selSom = el('select', { class: 'select' }, [
      el('option', { value: 'click', selected: Metro.METRONOME.som === 'click' }, 'Click'),
      el('option', { value: 'wood', selected: Metro.METRONOME.som === 'wood' }, 'Madeira'),
      el('option', { value: 'bell', selected: Metro.METRONOME.som === 'bell' }, 'Sino'),
      el('option', { value: 'digital', selected: Metro.METRONOME.som === 'digital' }, 'Digital'),
    ]);
    selSom.addEventListener('change', function () { Metro.definir('som', selSom.value); S.setAjuste('metroSom', selSom.value); });

    const selSub = el('select', { class: 'select' }, [
      el('option', { value: '1', selected: Metro.METRONOME.subdivisao === 1 }, 'Colcheia'),
      el('option', { value: '2', selected: Metro.METRONOME.subdivisao === 2 }, 'Semicolcheia'),
    ]);
    selSub.addEventListener('change', function () { Metro.definir('subdivisao', +selSub.value); S.setAjuste('metroSubdivisao', +selSub.value); });

    const ant = el('div', { class: 'mt-3' },
      (function () {
        const out = el('div', { class: 'fs-xs muted mb-1' }, 'Antecedencia do lembrete: ' + S.ajuste('antecedenciaNotif', 120) + ' min');
        const inp = el('input', { type: 'range', min: '15', max: '1440', step: '15', value: String(S.ajuste('antecedenciaNotif', 120)),
          oninput: function (e) { out.textContent = 'Antecedencia do lembrete: ' + e.target.value + ' min'; S.setAjuste('antecedenciaNotif', +e.target.value); } });
        return el('div', {}, [out, inp]);
      })());

    const onBeatAntigo = Metro.METRONOME.onBeat;
    Metro.METRONOME.onBeat = function (b) {
      for (let i = 0; i < dots.children.length; i++) dots.children[i].classList.toggle('on', i === b);
    };

    const h = UI.sheet({
      title: 'Metrônomo', sub: 'continua tocando com o video rodando',
      body: el('div', { class: 'stack gap-3' }, [
        el('div', { class: 'st-metro' }, [
          dots,
          el('div', { class: 'st-metro-mid' }, [btn, el('div', {}, [bpm, sub])]),
          el('div', { class: 'st-metro-side' }, [
            el('button', { class: 'st-mini', 'aria-label': 'Menos', onclick: function () { mover(-1); } }, el('i', { 'data-lucide': 'minus' })),
            el('button', { class: 'st-mini', 'aria-label': 'Mais', onclick: function () { mover(1); } }, el('i', { 'data-lucide': 'plus' })),
            el('button', { class: 'st-mini', 'aria-label': 'Tap tempo', onclick: function () {
              const b = Metro.tapTempo();
              if (b) { bpm.textContent = String(b); S.setAjuste('bpmPadrao', b); UI.buzz(12); }
            } }, el('span', { class: 'st-tap' }, 'TAP')),
          ]),
        ]),
        el('div', { class: 'grid-2' }, [
          el('div', { class: 'field' }, [el('label', { class: 'label' }, 'Som'), selSom]),
          el('div', { class: 'field' }, [el('label', { class: 'label' }, 'Divisao'), selSub]),
        ]),
        el('div', { class: 'field' }, [el('label', { class: 'label' }, 'Compasso'),
          el('div', { class: 'chips' }, Metro.COMPASSOS.map(function (c) {
            const b = el('button', { class: 'chip', 'aria-pressed': String(Metro.METRONOME.compasso === c.v) },
              c.n);
            b.addEventListener('click', function () {
              Metro.definir('compasso', c.v);
              U.$$('.chips .chip', h.node).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
              b.setAttribute('aria-pressed', 'true');
              U.clear(dots);
              for (let i = 0; i < c.v; i++) dots.appendChild(el('i', { class: i === 0 ? 'accent' : '' }));
              sub.textContent = c.n;
            });
            return b;
          }))]),
        ant,
      ]),
      foot: [
        el('button', { class: 'btn btn-secondary', onclick: function () { Metro.parar(); h.close(); Metro.METRONOME.onBeat = onBeatAntigo; } }, 'Fechar'),
        el('button', { class: 'btn btn-primary', onclick: function () { h.close(); } }, 'Pronto'),
      ],
      onClose: function () { Metro.parar(); Metro.METRONOME.onBeat = onBeatAntigo; },
    });

    UI.icons(h.node);
  }

  V.teoria = {
    render: render,
    transpor: function () { aba = 'transpor'; ir(); },
    acordes: function () { aba = 'acordes'; ir(); },
    escalas: function () { aba = 'escalas'; ir(); },
    circulo: function () { aba = 'circulo'; ir(); },
    metronome: abrirMetronomo,
  };
  function ir() {
    const p = document.getElementById('page-teoria');
    if (p && p.classList.contains('active')) render(p, {});
    else global.App.ir('teoria', { aba: aba });
  }
})(typeof window !== 'undefined' ? window : globalThis);