/* =========================================================
   Cifras e Escalas Pro — core/render.js
   Blocos de visualização reutilizáveis: acordes, tablatura,
   círculo das quintas, escalas e cifras formatadas.
   Expõe window.Render.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const M = global.Music;
  const { el, esc } = U;

  /* =======================================================
     Chips de tom
     ======================================================= */
  const TONS_MAIORES = [
    { pc: 0, n: 'C' }, { pc: 2, n: 'D' }, { pc: 4, n: 'E' }, { pc: 5, n: 'F' },
    { pc: 7, n: 'G' }, { pc: 9, n: 'A' }, { pc: 11, n: 'B' },
    { pc: 10, n: 'Bb' }, { pc: 3, n: 'Eb' }, { pc: 8, n: 'Ab' },
    { pc: 6, n: 'F#' }, { pc: 1, n: 'Db' },
  ];

  function tomOptionsPc(maior) {
    if (maior === undefined || maior === null) {
      return TONS_MAIORES.slice();
    }
    const flat = M.useFlatsFor(maior);
    return TONS_MAIORES.map((t) => ({
      pc: t.pc, n: M.noteName(t.pc, flat) + (maior ? '' : 'm'),
    }));
  }

  function selectTon(opts) {
    opts = opts || {};
    const sel = el('select', { class: 'select', id: opts.id || 'sel-tom' });
    sel.appendChild(el('option', { value: '' }, opts.placeholder || 'Tom'));
    (opts.tons || TONS_MAIORES.map((t) => ({ pc: t.pc, n: t.n }))).forEach((t) => {
      sel.appendChild(el('option', { value: t.n, selected: opts.value === t.n }, t.n));
    });
    return sel;
  }

  /* =======================================================
     Grade de acordes (círculo de quintas opcional)
     ======================================================= */
  function chordGrid(pcs, opts) {
    opts = opts || {};
    const flat = opts.flat;
    const wrap = el('div', { class: 'chord-grid', style: { display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: opts.center ? 'center' : 'flex-start' } });
    pcs.forEach((pc) => {
      const nome = M.noteName(pc, flat);
      wrap.appendChild(el('button', {
        class: 'chip-acorde' + (opts.large ? ' big' : ''),
        onclick: () => opts.onClick && opts.onClick(pc, nome),
        'aria-label': 'Acorde de ' + nome,
      }, nome));
    });
    return wrap;
  }

  /* =======================================================
     Diagrama de acorde (fretboard horizontal)
     ======================================================= */
  function chordDiagram(frets, opts) {
    opts = opts || {};
    const capoAt = opts.capo || 0;
    const flat = opts.flat;
    const used = frets.map((f) => f).filter((f) => f >= 0);
    const minF = used.length ? Math.min.apply(null, used) : 0;
    const maxF = used.length ? Math.max.apply(null, used) : 0;
    // janela de até 5 trastes centrada na posição
    let start = Math.max(0, minF);
    if (maxF - start > 4) start = maxF - 4;
    const nut = start === 0;

    const table = el('table', { class: 'chord-visual', style: { borderCollapse: 'collapse' } });
    const thead = el('tr');
    thead.appendChild(el('td', { style: { width: '14px' } }));
    for (let i = 0; i <= 4; i++) {
      thead.appendChild(el('td', {
        style: { fontSize: '9px', color: 'var(--text-faint)', textAlign: 'center', paddingBottom: '2px' },
      }, String(start + i)));
    }
    table.appendChild(thead);
    const tbody = el('tbody');
    for (let s = 0; s < 6; s++) {
      const tr = el('tr');
      tr.appendChild(el('td', {
        style: { fontSize: '10px', color: 'var(--text-faint)', textAlign: 'right', paddingRight: '4px', fontFamily: 'var(--font-mono)' },
      }, M.STRING_LABELS[s]));
      for (let i = 0; i <= 4; i++) {
        const f = frets[s];
        const isFret = f === start + i;
        const isNut = nut && i === 0;
        const bg = isNut ? 'var(--text-2)' : 'transparent';
        tr.appendChild(el('td', {
          style: {
            position: 'relative', height: '24px', minWidth: '22px', textAlign: 'center',
            borderLeft: isNut ? '2px solid var(--text-2)' : '1px solid var(--border)',
            background: bg,
          },
        }, isFret ? el('span', {
          style: {
            position: 'absolute', inset: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: f < 0 ? 'transparent' : 'var(--primary)',
            color: '#fff', borderRadius: f < 0 ? '2px' : '50%',
            width: f < 0 ? '8px' : '18px', height: f < 0 ? '8px' : '18px', margin: 'auto',
            fontSize: '9px', fontWeight: '800', top: '3px',
          },
        }, f < 0 ? '' : (f - capoAt)) : ''));
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    const box = el('div', {
      style: {
        display: 'inline-block', background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)', padding: '6px 8px 4px', minWidth: '120px',
      },
    }, [
      el('div', { style: { fontSize: '11px', fontWeight: '800', textAlign: 'center', marginBottom: '2px', color: 'var(--text-2)' } },
        opts.title || ''),
      table,
    ]);
    return box;
  }

  /** Diagrama vertical clássico (estilo cifra impressa). */
  function chordDiagramVertical(frets, opts) {
    opts = opts || {};
    const used = frets.filter((f) => f >= 0);
    const minF = used.length ? Math.min.apply(null, used) : 0;
    const maxF = used.length ? Math.max.apply(null, used) : 0;
    let start = Math.max(0, minF);
    if (maxF - start > 4) start = maxF - 4;
    const nFrets = Math.max(1, maxF - start + 1);

    const wrap = el('div', {
      style: { display: 'inline-block', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 8px 6px' },
    });
    const head = el('div', { style: { display: 'flex', gap: '1px', marginBottom: '2px' } });
    const body = el('div', { style: { display: 'flex', gap: '1px' } });
    for (let s = 0; s < 6; s++) {
      const col = el('div', { style: { width: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center' } });
      // nó superior
      const nutRow = el('div', { style: { height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' } });
      if (start === 0) {
        nutRow.appendChild(el('div', { style: { width: '16px', height: '3px', background: 'var(--text-2)', borderRadius: '2px' } }));
      } else {
        nutRow.appendChild(el('div', { style: { fontSize: '8px', color: 'var(--text-faint)' } }, String(start)));
      }
      col.appendChild(nutRow);
      for (let i = 0; i < nFrets; i++) {
        const f = start + i;
        const isHit = frets[s] === f;
        const isMute = frets[s] < 0;
        const cell = el('div', {
          style: {
            height: '18px', width: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)',
            position: 'relative',
          },
        });
        if (isHit) cell.appendChild(el('div', {
          style: { width: '13px', height: '13px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: '8px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, String(f)));
        else if (isMute) cell.appendChild(el('div', {
          style: { width: '7px', height: '3px', background: 'var(--text-faint)', borderRadius: '2px' },
        }));
        col.appendChild(cell);
      }
      body.appendChild(col);
      head.appendChild(el('div', { style: { width: '18px', textAlign: 'center', fontSize: '8px', color: 'var(--text-faint)', fontWeight: '700' } },
        M.STRING_LABELS[s]));
    }
    wrap.appendChild(head);
    wrap.appendChild(body);
    return wrap;
  }

  /* =======================================================
     Fretboard de escala
     ======================================================= */
  function scaleFretboard(pcs, opts) {
    opts = opts || {};
    const flat = opts.flat;
    const nf = opts.frets || 12;
    const showAll = opts.showAll;
    const rootPc = opts.rootPc;
    const set = new Set(pcs.map((p) => M.mod12(p)));
    const wrap = el('div', { class: 'fret-wrap' });
    const board = el('div', { class: 'fretboard' });

    // números de traste no topo
    const nums = el('div', { class: 'fb-row' }, [el('div', { class: 'fb-string-label' })]);
    for (let f = 0; f < nf; f++) {
      nums.appendChild(el('div', {
        class: 'fb-fret' + (f === 0 ? ' first' : ''),
        style: { height: '16px' },
      }, el('span', { class: 'fb-num' }, String(f))));
    }
    board.appendChild(nums);

    for (let s = 0; s < 6; s++) {
      const row = el('div', { class: 'fb-row' }, [
        el('div', { class: 'fb-string-label' }, M.STRING_LABELS[s]),
      ]);
      const frets = el('div', { class: 'fb-frets' });
      for (let f = 0; f < nf; f++) {
        const pc = M.fretNote(s, f);
        const inScale = set.has(pc);
        const isRoot = pc === M.mod12(rootPc);
        const cell = el('div', {
          class: 'fb-fret' + (f === 0 ? ' first' : '') + (inScale ? ' on' : ''),
        });
        if (inScale || showAll) {
          const cls = isRoot ? 'fb-dot root' : 'fb-dot dim';
          cell.appendChild(el('div', { class: cls }, showAll || isRoot ? M.noteName(pc, flat) : ''));
        }
        frets.appendChild(cell);
      }
      row.appendChild(frets);
      board.appendChild(row);
    }
    wrap.appendChild(board);
    return wrap;
  }

  /* =======================================================
     Teclado (piano) de escala
     ======================================================= */
  /**
   * Teclado de duas oitavas com as notas da escala destacadas.
   * As teclas pretas ficam entre os pares de teclas brancas, como no
   * piano real (5 por oitava: depois de C, D, F, G e A).
   */
  function scaleKeyboard(pcs, opts) {
    opts = opts || {};
    const flat = opts.flat;
    const rootPc = M.mod12(opts.rootPc);
    const set = new Set(pcs.map((p) => M.mod12(p)));
    const octaves = opts.octaves || 2;
    const rootOffset = M.mod12(rootPc);
    const totalWhite = octaves * 7;

    const wrap = el('div', { class: 'kb-wrap' });
    const kb = el('div', { class: 'kb' });
    kb.style.minWidth = (totalWhite * 26) + 'px';

    const brancas = [];
    const pretas = [];

    for (let o = 0; o < octaves; o++) {
      for (let w = 0; w < 7; w++) {
        const idx = o * 7 + w;
        const pc = M.mod12(rootOffset + [0, 2, 4, 5, 7, 9, 11][w]);
        brancas.push(el('button', {
          class: 'kb-key white' + (set.has(pc) ? ' in' : '') + (pc === rootPc ? ' root' : ''),
          style: { left: (idx / totalWhite) * 100 + '%', width: (100 / totalWhite) + '%' },
          title: M.noteName(pc, flat),
          onclick: () => opts.onNote && opts.onNote(pc),
        }, [el('span', { class: 'kb-lab' }, M.noteName(pc, flat))]));

        // teclas pretas existem depois de C, D, F, G e A (nao depois de E e B)
        if (w === 0 || w === 1 || w === 3 || w === 4 || w === 5) {
          const bpc = M.mod12(pc + 1);
          pretas.push(el('button', {
            class: 'kb-key black' + (set.has(bpc) ? ' in' : ''),
            style: { left: ((idx + 1) / totalWhite) * 100 + '%', width: (100 / totalWhite) + '%' },
            title: M.noteName(bpc, flat),
            onclick: () => opts.onNote && opts.onNote(bpc),
          }, [el('span', { class: 'kb-lab' }, M.noteName(bpc, flat))]));
        }
      }
    }

    // brancas primeiro (ficam embaixo), pretas por cima
    brancas.forEach((k) => kb.appendChild(k));
    pretas.forEach((k) => kb.appendChild(k));
    wrap.appendChild(kb);

    wrap.appendChild(el('div', { class: 'scale-legend mt-3' }, [
      el('span', {}, [el('span', { class: 'sw', style: { background: 'var(--primary)' } }), 'Tônica']),
      el('span', {}, [el('span', { class: 'sw', style: { background: 'color-mix(in srgb, var(--gold-500) 45%, transparent)' } }), 'Nota da escala']),
      el('span', {}, [el('span', { class: 'sw', style: { background: 'var(--surface-3)', border: '1px solid var(--border)' } }), 'Fora da escala']),
    ]));

    return wrap;
  }

  /* =======================================================
     Círculo das quintas (SVG)
     ======================================================= */
  function circleOfFifths(opts) {
    opts = opts || {};
    const size = 340, cx = size / 2, cy = size / 2;
    const rOuter = 148, rInner = 96;
    const flat = opts.flat;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('class', 'circle-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Círculo das quintas');

    const center = document.createElementNS(svgNS, 'circle');
    center.setAttribute('cx', cx); center.setAttribute('cy', cy);
    center.setAttribute('r', String(rInner - 4));
    center.setAttribute('fill', 'var(--surface-2)');
    center.setAttribute('stroke', 'var(--border)');
    svg.appendChild(center);

    const ct = document.createElementNS(svgNS, 'text');
    ct.setAttribute('x', String(cx)); ct.setAttribute('y', String(cy - 4));
    ct.setAttribute('text-anchor', 'middle');
    ct.setAttribute('font-size', '17');
    ct.setAttribute('fill', 'var(--text)');
    ct.textContent = 'Tonalidades';
    svg.appendChild(ct);
    const cs = document.createElementNS(svgNS, 'text');
    cs.setAttribute('x', String(cx)); cs.setAttribute('y', String(cy + 16));
    cs.setAttribute('text-anchor', 'middle');
    cs.setAttribute('font-size', '11');
    cs.setAttribute('fill', 'var(--text-faint)');
    cs.textContent = 'relativas no centro';
    svg.appendChild(cs);

    M.CIRCLE.forEach((pc, i) => {
      const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const a1 = { x: cx + Math.cos(ang) * rInner, y: cy + Math.sin(ang) * rInner };
      const a2 = { x: cx + Math.cos(ang) * rOuter, y: cy + Math.sin(ang) * rOuter };
      const am = { x: cx + Math.cos(ang) * ((rInner + rOuter) / 2), y: cy + Math.sin(ang) * ((rInner + rOuter) / 2) };

      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'seg' + (opts.selected === pc ? ' on' : ''));
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', M.noteName(pc, flat) + ' maior e ' + M.noteName(M.relativeMinor(pc), flat) + ' menor');
      if (opts.onClick) {
        g.style.cursor = 'pointer';
        g.addEventListener('click', () => opts.onClick(pc));
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onClick(pc); } });
      }

      const majorArc = document.createElementNS(svgNS, 'path');
      majorArc.setAttribute('d', arcPath(cx, cy, rInner, rOuter, ang - Math.PI / 12 + 0.02, ang + Math.PI / 12 - 0.02));
      majorArc.setAttribute('fill', opts.selected === pc ? 'var(--primary)' : (M.useFlatsFor(pc) ? 'color-mix(in srgb, var(--primary) 8%, var(--surface))' : 'var(--surface)'));
      majorArc.setAttribute('stroke', 'var(--border)');
      g.appendChild(majorArc);

      const majT = document.createElementNS(svgNS, 'text');
      majT.setAttribute('x', String(am.x)); majT.setAttribute('y', String(am.y));
      majT.setAttribute('text-anchor', 'middle'); majT.setAttribute('dominant-baseline', 'middle');
      majT.setAttribute('font-size', '13');
      majT.setAttribute('fill', opts.selected === pc ? '#fff' : 'var(--text)');
      majT.textContent = M.noteName(pc, flat);
      g.appendChild(majT);

      svg.appendChild(g);

      // setor da relativa menor
      const ang2 = ang + Math.PI / 12;
      const b1 = { x: cx + Math.cos(ang2) * (rInner - 26), y: cy + Math.sin(ang2) * (rInner - 26) };
      const b2 = { x: cx + Math.cos(ang2) * (rInner - 4), y: cy + Math.sin(ang2) * (rInner - 4) };
      const g2 = document.createElementNS(svgNS, 'g');
      const minArc = document.createElementNS(svgNS, 'path');
      minArc.setAttribute('d', arcPath(cx, cy, rInner - 26, rInner - 2, ang2 - 0.14, ang2 + 0.14));
      minArc.setAttribute('fill', M.useFlatsFor(M.relativeMinor(pc)) ? 'color-mix(in srgb, var(--gold-500) 12%, var(--surface))' : 'var(--surface-2)');
      minArc.setAttribute('stroke', 'var(--border)');
      g2.appendChild(minArc);
      const minT = document.createElementNS(svgNS, 'text');
      minT.setAttribute('x', String((b1.x + b2.x) / 2));
      minT.setAttribute('y', String((b1.y + b2.y) / 2));
      minT.setAttribute('text-anchor', 'middle'); minT.setAttribute('dominant-baseline', 'middle');
      minT.setAttribute('font-size', '10');
      minT.setAttribute('fill', 'var(--text-soft)');
      minT.setAttribute('font-weight', '700');
      minT.textContent = M.noteName(M.relativeMinor(pc), flat) + 'm';
      g2.appendChild(minT);
      svg.appendChild(g2);
    });

    function arcPath(cx, cy, r1, r2, a1, a2) {
      const p = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      const [x1, y1] = p(r1, a1), [x2, y2] = p(r1, a2);
      const [x3, y3] = p(r2, a2), [x4, y4] = p(r2, a1);
      return `M ${x1} ${y1} A ${r1} ${r1} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${r2} ${r2} 0 0 0 ${x4} ${y4} Z`;
    }

    const wrap = el('div', { class: 'circle-wrap' }, svg);
    return wrap;
  }

  /* =======================================================
     Cifra formatada (linhas de acordes + letra)
     ======================================================= */
  function cifraBox(cifra, opts) {
    opts = opts || {};
    const wrap = el('div', { class: 'cifra-box' });
    if (!cifra || !String(cifra).trim()) {
      wrap.appendChild(el('p', { class: 'fs-sm muted center', style: { padding: '20px 0' } },
        'Sem cifra. Use “Colar cifra” ou adicione a letra e os acordes.'));
      return wrap;
    }
    const pre = el('pre', { class: 'cifra-text' });
    const lines = String(cifra).replace(/\r\n?/g, '\n').split('\n');
    lines.forEach((ln, i) => {
      if (i > 0) pre.appendChild(document.createTextNode('\n'));
      const kd = M.keyDirective(ln);
      if (kd && !M.isChordLine(ln)) {
        const s = el('span', { class: 'sec' }, '[' + esc(ln.trim().slice(1, -1)) + ']');
        pre.appendChild(s);
        return;
      }
      // colore acordes
      const toks = M.tokenizeLine(ln, M.isChordLine(ln));
      toks.forEach((t) => {
        if (t.type === 'chord') pre.appendChild(el('span', { class: 'ch' }, t.v));
        else pre.appendChild(document.createTextNode(t.v));
      });
    });
    wrap.appendChild(pre);
    return wrap;
  }

  /** Cifra em duas colunas (linha de acordes alinhada com a letra). */
  function cifraAligned(cifra, opts) {
    opts = opts || {};
    const wrap = el('div', { class: 'cifra-box' });
    const lines = String(cifra || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const ln = lines[i];
      if (!ln.trim()) { out.push(el('div', { style: { height: '10px' } })); i++; continue; }
      if (M.isSectionLine(ln) && !M.isChordLine(ln)) {
        out.push(el('div', { class: 'sec', style: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--gold-500)', fontWeight: '700', margin: '8px 0 4px' } },
          ln.trim()));
        i++; continue;
      }
      if (M.isChordLine(ln)) {
        const chordRow = el('pre', { class: 'cifra-text', style: { margin: '0' } });
        M.tokenizeLine(ln, true).forEach((t) => {
          if (t.type === 'chord') chordRow.appendChild(el('span', { class: 'ch' }, t.v));
          else chordRow.appendChild(document.createTextNode(t.v));
        });
        out.push(chordRow);
        i++;
        // se a próxima linha for letra, alinha embaixo
        const prox = lines[i];
        if (prox && prox.trim() && !M.isChordLine(prox) && !M.isSectionLine(prox)) {
          out.push(el('pre', { class: 'cifra-text lyric', style: { margin: '0 0 10px' } }, prox));
          i++;
        } else {
          out.push(el('div', { style: { height: '8px' } }));
        }
        continue;
      }
      out.push(el('pre', { class: 'cifra-text lyric', style: { margin: '0 0 6px' } }, ln));
      i++;
    }
    out.forEach((n) => wrap.appendChild(n));
    return wrap;
  }

  /* =======================================================
     Tabela de acordes presentes + graus
     ======================================================= */
  function chordAnalysis(cifra, keyPc, mode) {
    const chords = M.extractChords(cifra);
    if (!chords.length) return null;
    const scale = mode === 'minor' ? 'minor' : 'major';
    const analise = M.analyzeChords(chords, keyPc, scale);
    const flat = M.useFlatsFor(keyPc);
    // agrupa por fundamental mantendo ordem
    const rows = [];
    analise.forEach((a, i) => {
      rows.push(el('tr', {}, [
        el('td', { class: 'cname' }, M.formatChord(a.root, chords[i].quality, chords[i].bass, flat)),
        el('td', { class: 'cdeg' }, a.degree),
        el('td', { class: 'muted fs-sm' }, M.scaleChords(keyPc, scale, flat)
          .find((s) => s.pc === a.root) ? '' : M.closestTerm(keyPc, a.root)),
      ]));
    });
    const table = el('table', { class: 'chord-table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, 'Acorde'), el('th', {}, 'Grau'), el('th', {}, 'Função'),
      ])),
      el('tbody', {}, rows),
    ]);
    return el('div', {}, [
      el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'git-branch' }), 'Acordes da cifra']),
      table,
    ]);
  }

  /* =======================================================
     Cartão de estatística
     ======================================================= */
  function statCard(opts) {
    return el('div', { class: 'stat' + (opts.color ? ' c-' + opts.color : '') }, [
      el('i', { class: 'ico', 'data-lucide': opts.icon || 'activity' }),
      el('div', { class: 'v' }, String(opts.value)),
      el('div', { class: 'k' }, opts.label),
    ]);
  }

  global.Render = {
    TONS_MAIORES, tomOptionsPc, selectTon,
    chordGrid, chordDiagram, chordDiagramVertical,
    scaleFretboard, scaleKeyboard, circleOfFifths,
    cifraBox, cifraAligned, chordAnalysis, statCard,
  };
})(typeof window !== 'undefined' ? window : globalThis);
