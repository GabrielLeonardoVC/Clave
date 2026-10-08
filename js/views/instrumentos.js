/* =========================================================
   ACORDE - views/instrumentos.js
   Instrumentos virtuais: cordas, teclados, percussao, sinos.
   ========================================================= */
(function (global) {
  'use strict';
  const U = global.Utils;
  const M = global.Music;
  const R = global.Render;
  const UI = global.UI;
  const { el } = U;
  const V = global.Views || (global.Views = {});

  let instAtual = 'violao';
  let view3d = null;

  function render(root, params) {
    if (params && params.inst) instAtual = params.inst;
    U.clear(root);

    root.appendChild(el('div', { class: 'page-head' }, [
      el('h1', {}, 'Instrumentos'),
      el('div', { class: 'sub' }, 'Toque, visualize e estude cada instrumento'),
    ]));

    /* ---- seletor de instrumento ---- */
    const selWrap = el('div', { class: 'card mb-4' });
    selWrap.appendChild(el('div', { class: 'section-title' }, [
      el('i', { 'data-lucide': 'music' }), 'Selecione o instrumento'
    ]));

    const grid = el('div', { class: 'grid-auto gap-3' });
    M.INSTRUMENTOS.forEach(function (inst) {
      const ativo = inst.id === instAtual;
      const card = el('button', {
        class: 'card card-tap' + (ativo ? ' on' : ''),
        'aria-pressed': String(ativo),
        onclick: function () { instAtual = inst.id; recarregar(); },
        style: { minHeight: '90px', textAlign: 'left' },
      }, [
        el('div', { class: 'row gap-2' }, [
          el('i', {
            'data-lucide': iconeDoInst(inst),
            style: { width: '28px', height: '28px', color: 'var(--primary)', flex: 'none' },
          }),
          el('div', { class: 'grow' }, [
            el('div', { class: 'fw-7' }, inst.nome),
            el('div', { class: 'fs-xs muted' },
              inst.tipo === 'cordas' ? (inst.cordas + ' cordas, ' + inst.trastes + ' trastes, ' + inst.afinacao)
                : inst.tipo === 'teclado' ? (inst.oitavas + ' oitavas')
                  : inst.tipo === 'percussao' ? (inst.familia === 'bateria' ? 'Kit completo'
                    : inst.familia === 'sequenciador' ? '16 passos'
                      : inst.familia === 'sinos' ? '2 oitavas cromáticas'
                        : '2.5 oitavas')
                  : ''),
          ]),
        ]),
      ]);
      grid.appendChild(card);
    });
    selWrap.appendChild(grid);
    root.appendChild(selWrap);

    /* ---- visualização do instrumento ---- */
    const inst = M.instrumento(instAtual);
    const box = el('div', { class: 'card' });
    box.id = 'instrumento-view';
    root.appendChild(box);

    /* Delega para a visualização apropriada */
    if (inst.tipo === 'cordas') {
      montarCordas(box, inst);
    } else if (inst.tipo === 'teclado') {
      montarTeclado(box, inst);
    } else if (inst.tipo === 'percussao') {
      montarPercussao(box, inst);
    }

    UI.icons(root);
  }

  function recarregar() {
    const p = document.getElementById('page-instrumentos');
    if (p && p.classList.contains('active')) render(p, {});
  }

  /* =======================================================
     INSTRUMENTOS DE CORDAS (braço 3D + cordas soltas)
     ======================================================= */
  function montarCordas(wrap, inst) {
    const flat = M.useFlatsFor(0);

    wrap.appendChild(el('div', { class: 'section-title' },
      [el('i', { 'data-lucide': 'guitar' }), inst.nome + ' em 3D']
    ));

    const trastes = Math.min(24, inst.trastes || 12);
    const g = global.Violao3D && global.Violao3D.GEOMETRIA
      ? global.Violao3D.GEOMETRIA[inst.id] : null;
    const temTraste = !g || g.trastes !== false;

    wrap.appendChild(global.Views.traste3d.mostrar({
      pcs: [],
      rootPc: 0,
      flat: flat,
      frets: trastes,
      inst: inst.id,
      rotulo: 'Traste',
      acordes: [],
      aoTocar: function (pc, dur) {
        if (!global.Nota) return;
        const hz = global.Views.traste3d.frequenciaDe(pc);
        if (hz) global.Nota.tocarNota(hz, dur, { instrumento: inst.id });
      },
    }));

    /* ---- cordas soltas ---- */
    wrap.appendChild(el('div', { class: 'section-title mt-5' },
      [el('i', { 'data-lucide': 'music' }), 'Cordas soltas']
    ));
    const cordas = el('div', { class: 'note-ring' });
    inst.openPc.forEach(function (pc, i) {
      const hz = hzDaCorda(inst, i);
      const b = el('button', {
        class: 'note-pill', type: 'button',
        onclick: function () { if (hz && global.Nota) global.Nota.tocarNota(hz, 2.2, { instrumento: inst.id }); },
      }, M.noteName(pc, flat) + ' · ' + Math.round(hz || 0) + ' Hz');
      if (i === 0) b.classList.add('root');
      cordas.appendChild(b);
    });
    wrap.appendChild(cordas);
    wrap.appendChild(el('p', { class: 'fs-xs muted mt-2' },
      inst.cordas + (inst.cordas === 1 ? ' corda' : ' cordas')
      + ', afinação ' + inst.afinacao.toLowerCase() + '. '
      + 'O número ao lado de cada nota é a frequência real daquela corda.'));
  }

  /* =======================================================
     INSTRUMENTOS DE TECLADO (piano, sintetizador)
     ======================================================= */
  function montarTeclado(wrap, inst) {
    const flat = M.useFlatsFor(0);
    const oitavas = inst.oitavas || 7;
    const notaCentral = inst.notaCentral || 60;

    wrap.appendChild(el('div', { class: 'section-title' },
      [el('i', { 'data-lucide': 'piano' }), inst.nome]
    ));

    /* Controles */
    const controles = el('div', { class: 'row gap-3 wrap mb-4' });
    const oitavaSel = el('select', { class: 'select', style: { maxWidth: '160px' } });
    for (let o = 1; o <= oitavas; o++) {
      oitavaSel.appendChild(el('option', { value: String(o), selected: o === Math.ceil(oitavas / 2) ? 'selected' : null }, 'Oitava ' + o));
    }
    controles.appendChild(el('label', { class: 'label' }, 'Oitava'));
    controles.appendChild(oitavaSel);

    const modoSel = el('select', { class: 'select', style: { maxWidth: '180px' } });
    ['cromatica', 'maior', 'menor', 'pentatonica', 'blues'].forEach(function (m) {
      modoSel.appendChild(el('option', { value: m }, m.charAt(0).toUpperCase() + m.slice(1)));
    });
    controles.appendChild(el('label', { class: 'label' }, 'Modo'));
    controles.appendChild(modoSel);

    const rootSel = el('select', { class: 'select', style: { maxWidth: '120px' } });
    ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].forEach(function (n) {
      rootSel.appendChild(el('option', { value: n }, n));
    });
    controles.appendChild(el('label', { class: 'label' }, 'Tônica'));
    controles.appendChild(rootSel);

    wrap.appendChild(controles);

    /* Teclado visual - usa o Render existente */
    const tecladoWrap = el('div', { style: { minHeight: '120px' } });
    wrap.appendChild(tecladoWrap);

    function atualizarTeclado() {
      U.clear(tecladoWrap);
      const oitava = parseInt(oitavaSel.value, 10);
      const modo = modoSel.value;
      const root = notaParaPc(rootSel.value);

      let notas = [];
      if (modo === 'cromatica') {
        for (let i = 0; i < 12; i++) notas.push(mod12(root + i));
      } else {
        const escala = M.SCALES[modo === 'maior' ? 'major' : modo === 'menor' ? 'minor' : modo === 'pentatonica' ? 'pentatonic' : 'blues'];
        if (escala) {
          escala.iv.forEach(function (iv) { notas.push(mod12(root + iv)); });
        }
      }

      tecladoWrap.appendChild(R.scaleKeyboard(notas, {
        rootPc: root,
        flat: false,
        octaves: 1,
        startOctave: oitava - 1,
        aoTocar: function (pc, dur) {
          if (!global.Nota) return;
          const hz = global.Tuner.notaParaHz(pc, oitava - 1);
          if (hz) global.Nota.tocarNota(hz, dur, { instrumento: instAtual });
        },
        destacar: notas,
      }));
      UI.icons(tecladoWrap);
    }

    oitavaSel.addEventListener('change', atualizarTeclado);
    modoSel.addEventListener('change', atualizarTeclado);
    rootSel.addEventListener('change', atualizarTeclado);
    atualizarTeclado();

    /* ---- notas (somente para referência) ---- */
    wrap.appendChild(el('div', { class: 'section-title mt-5' },
      [el('i', { 'data-lucide': 'music' }), 'Notas desta oitava']
    ));
    const notas = el('div', { class: 'note-ring' });
    for (let i = 0; i < 12; i++) {
      const pc = mod12(notaParaPc(rootSel.value) + i);
      const oitava = parseInt(oitavaSel.value, 10) - 1;
      const hz = global.Tuner && typeof global.Tuner.notaParaHz === 'function'
        ? global.Tuner.notaParaHz(pc, oitava) : 0;
      const b = el('button', {
        class: 'note-pill', type: 'button',
        onclick: function () { if (hz && global.Nota) global.Nota.tocarNota(hz, 1.5, { instrumento: instAtual }); },
      }, M.noteName(pc, flat) + (hz ? ' · ' + Math.round(hz) + ' Hz' : ''));
      notas.appendChild(b);
    }
    wrap.appendChild(notas);
  }

  /* =======================================================
     INSTRUMENTOS DE PERCUSSÃO (bateria, caixa, sinos, xilofone)
     ======================================================= */
  function montarPercussao(wrap, inst) {
    const flat = M.useFlatsFor(0);

    wrap.appendChild(el('div', { class: 'section-title' },
      [el('i', { 'data-lucide': iconeDoInst(inst) }), inst.nome]
    ));

    if (inst.familia === 'bateria' || inst.familia === 'sequenciador') {
      montarKitPercussao(wrap, inst);
    } else if (inst.familia === 'sinos' || inst.familia === 'laminas') {
      montarNotasCromaticas(wrap, inst);
    }
  }

  function montarKitPercussao(wrap, inst) {
    const pecas = inst.pecas || [];
    const grid = el('div', { class: 'grid-auto gap-2' });

    pecas.forEach(function (peca) {
      const b = el('button', {
        class: 'card card-tap', type: 'button', style: { minHeight: '80px' },
        onclick: function () {
          if (!global.Nota) return;
          const hz = global.Tuner && typeof global.Tuner.notaParaHz === 'function'
            ? global.Tuner.notaParaHz(peca.pc % 12, Math.floor(peca.midi / 12) - 1)
            : 0;
          if (hz) global.Nota.tocarNota(hz, 1.0, { instrumento: inst.id, peca: peca.id });
        },
      }, [
        el('div', { class: 'fw-7' }, peca.nome),
        el('div', { class: 'fs-xs muted' }, 'MIDI ' + peca.midi),
      ]);
      b.style.background = peca.cor || 'transparent';
      grid.appendChild(b);
    });
    wrap.appendChild(grid);

    /* Sequenciador para caixa de ritmos */
    if (inst.familia === 'sequenciador') {
      wrap.appendChild(el('div', { class: 'section-title mt-5' },
        [el('i', { 'data-lucide': 'repeat' }), 'Sequenciador']
      ));
      montarSequenciador(wrap, inst);
    }
  }

  function montarSequenciador(wrap, inst) {
    const passos = inst.passos || 16;
    const pecas = inst.pecas || [];
    const estado = {};
    pecas.forEach(function (p) { estado[p.id] = new Array(passos).fill(false); });

    const container = el('div', { class: 'sequenciador-container', style: { padding: '8px', borderRadius: '8px', background: 'var(--surface)' } });
    const header = el('div', { class: 'row gap-2', style: { marginBottom: '8px' } });
    header.appendChild(el('div', { style: { minWidth: '80px', fontWeight: '600', fontSize: '0.75rem', color: 'var(--ink-4)' } }, 'Peça'));
    for (let i = 0; i < passos; i++) {
      header.appendChild(el('div', { style: { width: '28px', textAlign: 'center', fontSize: '0.625rem', color: (i + 1) % 4 === 0 ? 'var(--primary)' : 'var(--ink-4)' } }, String(i + 1)));
    }
    container.appendChild(header);

    pecas.forEach(function (peca) {
      const linha = el('div', { class: 'row gap-2', style: { marginTop: '4px' } });
      linha.appendChild(el('div', { style: { minWidth: '80px', fontWeight: '500', fontSize: '0.75rem' } },
        el('button', {
          class: 'note-pill', type: 'button', style: { background: peca.cor, minWidth: '80px', textAlign: 'left' },
          onclick: function () {
            if (!global.Nota) return;
            const hz = global.Tuner && typeof global.Tuner.notaParaHz === 'function'
              ? global.Tuner.notaParaHz(peca.pc % 12, Math.floor(peca.midi / 12) - 1)
              : 0;
            if (hz) global.Nota.tocarNota(hz, 0.5, { instrumento: inst.id, peca: peca.id });
          },
        }, peca.nome)
      ));
      for (let i = 0; i < passos; i++) {
        const ativo = estado[peca.id][i];
        const btn = el('button', {
          type: 'button',
          style: {
            width: '28px', height: '28px', borderRadius: '4px',
            background: ativo ? peca.cor : 'var(--surface-2)',
            border: '1px solid ' + (ativo ? peca.cor : 'var(--border)'),
            transition: 'all 0.1s',
          },
          onclick: function () {
            estado[peca.id][i] = !estado[peca.id][i];
            btn.style.background = estado[peca.id][i] ? peca.cor : 'var(--surface-2)';
            btn.style.borderColor = estado[peca.id][i] ? peca.cor : 'var(--border)';
          },
        });
        linha.appendChild(btn);
      }
      container.appendChild(linha);
    });
    wrap.appendChild(container);

    /* Controles do sequenciador */
    const ctrl = el('div', { class: 'row gap-2 wrap mt-3' });
    let tocando = false, intervalo = null, passoAtual = 0;

    const btnPlay = el('button', { class: 'btn btn-primary', onclick: togglePlay },
      [el('i', { 'data-lucide': 'play' }), 'Tocar']);
    ctrl.appendChild(btnPlay);

    const bpmInput = el('input', { type: 'number', class: 'input', min: '40', max: '240', value: String(inst.bpmPadrao || 120), style: { width: '80px' } });
    ctrl.appendChild(el('label', { class: 'label' }, 'BPM'));
    ctrl.appendChild(bpmInput);

    const btnLimpar = el('button', { class: 'btn btn-secondary', onclick: limpar },
      [el('i', { 'data-lucide': 'trash-2' }), 'Limpar']);
    ctrl.appendChild(btnLimpar);
    wrap.appendChild(ctrl);

    function togglePlay() {
      tocando = !tocando;
      U.clear(btnPlay);
      btnPlay.appendChild(el('i', { 'data-lucide': tocando ? 'pause' : 'play' }));
      btnPlay.appendChild(el('span', {}, tocando ? 'Pausar' : 'Tocar'));
      UI.icons(btnPlay);

      if (tocando) {
        const bpm = parseInt(bpmInput.value, 10) || 120;
        const ms = 60000 / bpm / 4; // semicolcheias
        passoAtual = 0;
        if (intervalo) clearTimeout(intervalo);
        function loop() {
          tocarPasso();
          if (tocando) intervalo = setTimeout(loop, ms);
        }
        intervalo = setTimeout(loop, ms);
      } else {
        if (intervalo) clearTimeout(intervalo);
        intervalo = null;
      }
    }

    function tocarPasso() {
      pecas.forEach(function (peca) {
        if (estado[peca.id][passoAtual]) {
          if (!global.Nota) return;
          const hz = global.Tuner && typeof global.Tuner.notaParaHz === 'function'
            ? global.Tuner.notaParaHz(peca.pc % 12, Math.floor(peca.midi / 12) - 1)
            : 0;
          if (hz) global.Nota.tocarNota(hz, 0.2, { instrumento: inst.id, peca: peca.id });
        }
      });
      /* Highlight visual */
      document.querySelectorAll('.sequenciador-container button[style*="width: 28px"]').forEach(function (btn, idx) {
        const pIdx = Math.floor(idx / passos);
        const sIdx = idx % passos;
        if (sIdx === passoAtual) {
          btn.style.boxShadow = '0 0 0 2px var(--primary)';
          btn.style.transform = 'scale(1.1)';
        } else {
          btn.style.boxShadow = '';
          btn.style.transform = '';
        }
      });
      passoAtual = (passoAtual + 1) % passos;
    }

    function limpar() {
      pecas.forEach(function (p) { estado[p.id].fill(false); });
      document.querySelectorAll('.sequenciador-container button[style*="width: 28px"]').forEach(function (b) {
        b.style.background = 'var(--surface-2)';
        b.style.borderColor = 'var(--border)';
      });
    }
  }

  function montarNotasCromaticas(wrap, inst) {
    const notas = inst.notas || [];
    const corBase = inst.corBase || 'var(--primary)';
    const flat = M.useFlatsFor(0);
    const grid = el('div', { class: 'note-ring' });

    notas.forEach(function (midi) {
      const pc = midi % 12;
      const oitava = Math.floor(midi / 12) - 1;
      const hz = global.Tuner && typeof global.Tuner.notaParaHz === 'function'
        ? global.Tuner.notaParaHz(pc, oitava) : 0;
      const b = el('button', {
        class: 'note-pill', type: 'button',
        style: { background: corBase, color: '#111' },
        onclick: function () { if (hz && global.Nota) global.Nota.tocarNota(hz, 2.5, { instrumento: inst.id }); },
      }, M.noteName(pc, flat) + (hz ? ' · ' + Math.round(hz) + ' Hz' : ''));
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
    wrap.appendChild(el('p', { class: 'fs-xs muted mt-2' },
      'Clique em cada nota para ouvir. ' + notas.length + ' notas, '
      + (inst.familia === 'sinos' ? 'som de sino com decaimento longo' : 'som de lâmina de madeira')));
  }

  /* =======================================================
     UTILIDADES
     ======================================================= */
  function iconeDoInst(inst) {
    switch (inst.tipo) {
      case 'cordas': return inst.familia === 'arco' ? 'fiddle' : 'guitar';
      case 'teclado': return 'piano';
      case 'percussao':
        if (inst.familia === 'bateria') return 'drum';
        if (inst.familia === 'sequenciador') return 'grid';
        if (inst.familia === 'sinos') return 'bell';
        return 'drum-stick';
      default: return 'music';
    }
  }

  function hzDaCorda(I, i) {
    const Tuner = global.Tuner;
    if (!Tuner || typeof Tuner.notaParaHz !== 'function') return null;
    const midi = I.openMidi && I.openMidi[i];
    if (typeof midi !== 'number') return null;
    return Tuner.notaParaHz(I.openPc[i], Math.floor(midi / 12) - 1);
  }

  /** Converte nome de nota (ex.: "C", "Db", "F#") para pitch class (0-11). */
  function notaParaPc(nome) {
    if (!nome) return 0;
    const m = /^([A-Ga-g])([#b]{0,2})/.exec(String(nome).trim());
    if (!m) return 0;
    return M.pcFromAccidental(m[1].toUpperCase(), m[2] || '');
  }

  function mod12(n) { return ((n % 12) + 12) % 12; }

  V.instrumentos = { render: render, abrir: function (inst) { instAtual = inst || 'violao'; V.instrumentos.render(document.getElementById('page-instrumentos'), {}); } };
})(typeof window !== 'undefined' ? window : globalThis);