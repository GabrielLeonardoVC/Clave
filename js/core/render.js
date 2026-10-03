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
  // A ordem e por quinta, nao alfabetica: C G D A E B F. Para quem toca, e
  // a ordem que importa — cada tonalidade e um traste acima na mesma corda.
  // A alfabetica (C D E F G A B) obriga a contar de traste na cabeca, que e
  // exatamente o trabalho que a teoria deveria estar fazendo.
  const TONS_MAIORES = [
    { pc: 0, n: 'C' }, { pc: 7, n: 'G' }, { pc: 2, n: 'D' }, { pc: 9, n: 'A' },
    { pc: 4, n: 'E' }, { pc: 11, n: 'B' }, { pc: 5, n: 'F' },
    { pc: 6, n: 'F#' }, { pc: 10, n: 'Bb' }, { pc: 3, n: 'Eb' },
    { pc: 8, n: 'Ab' }, { pc: 1, n: 'Db' },
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
    const wrap = el('div', { class: 'chord-grid' + (opts.center ? ' centro' : '') });
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
    // O desenho tinha 6 cordas fixas e so os rotulos do violao. Um ukulele de
    // 4 cordas desenhado com 6 linhas mostraria duas cordas que nao existem,
    // e o traste de cada linha estaria na posicao errada. O numero de cordas
    // vem do proprio desenho; os rotulos, do instrumento, com queda para o
    // violao quando o chamador nao diz nada.
    const rotulos = (opts.labels && opts.labels.length === frets.length)
      ? opts.labels
      : M.STRING_LABELS;
    const nC = frets.length;
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
        style: { fontSize: '0.5625rem', color: 'var(--text-faint)', textAlign: 'center', paddingBottom: '2px' },
      }, String(start + i)));
    }
    table.appendChild(thead);
    const tbody = el('tbody');
    for (let s = 0; s < nC; s++) {
      const tr = el('tr');
      tr.appendChild(el('td', {
        style: { fontSize: '0.625rem', color: 'var(--text-faint)', textAlign: 'right', paddingRight: '4px', fontFamily: 'var(--font-mono)' },
      }, rotulos[s] || ''));
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
            fontSize: '0.5625rem', fontWeight: '800', top: '3px',
          },
        }, f < 0 ? '' : (f - capoAt)) : ''));
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    const box = el('div', {
      style: {
        display: 'inline-block', background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-1)', padding: '6px 8px 4px', minWidth: '120px',
      },
    }, [
      el('div', { style: { fontSize: '0.6875rem', fontWeight: '800', textAlign: 'center', marginBottom: '2px', color: 'var(--text-2)' } },
        opts.title || ''),
      table,
    ]);
    return box;
  }

  /** Diagrama vertical clássico (estilo cifra impressa). */
  function chordDiagramVertical(frets, opts) {
    opts = opts || {};
    const rotulos = (opts.labels && opts.labels.length === frets.length)
      ? opts.labels
      : M.STRING_LABELS;
    const nC = frets.length;
    const used = frets.filter((f) => f >= 0);
    const minF = used.length ? Math.min.apply(null, used) : 0;
    const maxF = used.length ? Math.max.apply(null, used) : 0;
    let start = Math.max(0, minF);
    if (maxF - start > 4) start = maxF - 4;
    const nFrets = Math.max(1, maxF - start + 1);

    const wrap = el('div', {
      style: { display: 'inline-block', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-1)', padding: '10px 8px 6px' },
    });
    const head = el('div', { style: { display: 'flex', gap: '1px', marginBottom: '2px' } });
    const body = el('div', { style: { display: 'flex', gap: '1px' } });
    for (let s = 0; s < nC; s++) {
      const col = el('div', { style: { width: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center' } });
      // nó superior
      const nutRow = el('div', { style: { height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' } });
      if (start === 0) {
        nutRow.appendChild(el('div', { style: { width: '16px', height: '3px', background: 'var(--text-2)', borderRadius: '2px' } }));
      } else {
        nutRow.appendChild(el('div', { style: { fontSize: '0.5rem', color: 'var(--text-faint)' } }, String(start)));
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
          style: { width: '13px', height: '13px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: '0.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, String(f)));
        else if (isMute) cell.appendChild(el('div', {
          style: { width: '7px', height: '3px', background: 'var(--text-faint)', borderRadius: '2px' },
        }));
        col.appendChild(cell);
      }
      body.appendChild(col);
      head.appendChild(el('div', { style: { width: '18px', textAlign: 'center', fontSize: '0.5rem', color: 'var(--text-faint)', fontWeight: '700' } },
        rotulos[s] || ''));
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
    // Sem instrumento, o fretboard e o do violao. A escala de um ukulele
    // desenhada em 6 cordas mostraria duas linhas que o instrumento nao tem,
    // com notas misplaced por conta disso.
    const inst = opts.inst ? M.instrumento(opts.inst) : null;
    const rotulos = inst ? inst.labels : M.STRING_LABELS;
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

    for (let s = 0; s < rotulos.length; s++) {
      const row = el('div', { class: 'fb-row' }, [
        el('div', { class: 'fb-string-label' }, rotulos[s]),
      ]);
      const frets = el('div', { class: 'fb-frets' });
      for (let f = 0; f < nf; f++) {
        const pc = M.fretNote(s, f, inst);
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
      el('span', {}, [el('span', { class: 'sw', style: { background: 'color-mix(in srgb, var(--warn-500) 45%, transparent)' } }), 'Nota da escala']),
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
      minArc.setAttribute('fill', M.useFlatsFor(M.relativeMinor(pc)) ? 'color-mix(in srgb, var(--warn-500) 12%, var(--surface))' : 'var(--surface-2)');
      minArc.setAttribute('stroke', 'var(--border)');
      g2.appendChild(minArc);
      const minT = document.createElementNS(svgNS, 'text');
      minT.setAttribute('x', String((b1.x + b2.x) / 2));
      minT.setAttribute('y', String((b1.y + b2.y) / 2));
      minT.setAttribute('text-anchor', 'middle'); minT.setAttribute('dominant-baseline', 'middle');
      minT.setAttribute('font-size', '10');
      minT.setAttribute('fill', 'var(--text-light)');
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
        out.push(el('div', { class: 'sec', style: { fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--warn-500)', fontWeight: '700', margin: '8px 0 4px' } },
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

  /**
 * O painel de rolagem: o visualizador mais os controles.
 *
 * A velocidade e um controle de verdade, e nao um detalhe: o roteiro estima o
 * tempo pelo andamento declarado, mas uma cifra nao tem partitura ritmica, e
 * a estimativa erra. Quem esta com a musica aberta ao lado corrige no
 * controle — e por isso que ele fica visivel enquanto toca, e nao escondido
 * num menu.
 */
function painelRolagem(cifra, opts) {
  opts = opts || {};
  const prog = el('div', { class: 'cs-progresso' }, el('i'));
  const tempo = el('div', { class: 'cs-tempo' }, '');
  const play = el('button', { class: 'cs-play', 'aria-label': 'Rolar a cifra' },
    el('i', { 'data-lucide': 'play' }));

  let scroller = null;
  let indiceAcorde = 0;

  /* ---- estado de estudo ----
     Estudar cifra e decorar pedaco por pedaco. A divisao em trechos vem do
     proprio texto — as linhas entre colchetes — porque descobrir na hora,
     contando linhas na mao, erra. */
  const blocos = M.blocosDeCifra(cifra);
  // O estado vem de fora quando existe — quem abre a cifra ja sabe o que
  // estava decorando. `onEstudo` devolve cada mudanca para quem quiser
  // guardar; sem ele o painel funciona igual, so que nao persiste.
  const inicial = (global.Store && global.Store.normEstudo)
    ? global.Store.normEstudo(opts.estudo)
    : { ocultos: [], soAcordes: false, velocidade: 1 };
  const ocultos = new Set(inicial.ocultos.filter(function (i) { return i < blocos.length; }));
  let soAcordes = inicial.soAcordes;
  let fatorAtual = inicial.velocidade;
  let gravouEstado = false;

  /** Grava uma vez por mudanca real, e nao a cada repintura. */
  function changed() {
    if (gravouEstado || !opts.onEstudo) return;
    gravouEstado = true;
    opts.onEstudo({ ocultos: Array.from(ocultos).sort(function (a, b) { return a - b; }), soAcordes: soAcordes, velocidade: fatorAtual });
    gravouEstado = false;
  }

  /** A cifra como ela deve aparecer com os trechos escondidos e o filtro. */
  function cifraVisivel() {
    const todas = String(cifra == null ? '' : cifra).replace(/\r\n?/g, '\n').split('\n');
    const saida = [];
    for (let i = 0; i < todas.length; i++) {
      if (ocultos.has(blocoDe(i))) continue;
      const ln = todas[i];
      if (!soAcordes) { saida.push(ln); continue; }
      // O titulo do trecho sobrevive ao filtro: sem ele a pessoa perde a
      // referencia de qual verso esta vendo.
      if (M.isSectionLine(ln)) { saida.push(ln); continue; }
      // O respiro tambem. Apagar a linha em branco junto com a letra juntoaria
      // dois versos e quebraria a leitura da cifra.
      if (!ln.trim()) { saida.push(ln); continue; }
      const so = M.apenasAcordes(ln);
      if (so !== null) saida.push(so);
    }
    return saida.join('\n');
  }
  function blocoDe(linha) {
    for (let i = 0; i < blocos.length; i++) {
      if (linha >= blocos[i].linhaInicio && linha <= blocos[i].linhaFim) return i;
    }
    return -1;
  }

  const fita = el('div', { class: 'est-fita' });
  const estResumo = el('div', { class: 'est-resumo' });

  function pintarFita() {
    U.clear(fita);
    if (!blocos.length) return;
    blocos.forEach(function (b, i) {
      const escondido = ocultos.has(i);
      fita.appendChild(el('button', {
        class: 'est-pedaco' + (escondido ? ' fora' : '') + (b.semTitulo ? ' anonimo' : ''),
        'aria-pressed': String(escondido),
        onclick: function () {
          if (ocultos.has(i)) ocultos.delete(i); else ocultos.add(i);
          reconstruir();
        },
      }, [
        el('span', { class: 'est-pedaco-nome' }, b.titulo),
        el('span', { class: 'est-pedaco-qtd' }, b.nLinhas + (b.nLinhas === 1 ? ' linha' : ' linhas')),
        el('i', { 'data-lucide': escondido ? 'eye-off' : 'eye' }),
      ]));
    });

    U.clear(estResumo);
    const total = blocos.length;
    const guardados = ocultos.size;
    if (guardados > 0) {
      estResumo.appendChild(el('span', { class: 'est-badge' },
        guardados + ' de ' + total + (total === 1 ? ' trecho escondido' : ' trechos escondidos')));
    }
    if (total > 0 && guardados === total) {
      estResumo.appendChild(el('span', { class: 'est-aviso' },
        'Cifra inteira escondida. Toque num trecho para ver.'));
    }
  }

  // A funcao precisa ter nome, e nao ser anonima: `reconstruir` cria
  // um scroller novo e precisa entregar a MESMA atualizacao de progresso.
  // Passando uma funcao nova, a barra ficaria congelada depois de esconder um
  // trecho — e congelada, sem dar erro nenhum.
  function aoProgredir(p, i, roteiro) {
    prog.firstChild.style.width = Math.round(p * 100) + '%';
    // A linha atual raramente e uma de acorde (pode ser um respiro), e o
    // contador e sobre os acordes. Contar linhas mostraria "12 de 14" para uma
    // cifra que so tem 9 mudancas.
    const n = roteiro.linhas.filter((r) => r.tipo === M.TIPO_LINHA.ACORDE).length;
    const ate = roteiro.linhas.slice(0, i + 1).filter((r) => r.tipo === M.TIPO_LINHA.ACORDE).length;
    tempo.textContent = n ? (ate + '/' + n) : (roteiro.bpm + ' bpm');
  }

  const vel = el('input', {
    type: 'range', min: '0.5', max: '3', step: '0.25', value: String(fatorAtual),
    'aria-label': 'Velocidade da rolagem',
  });
  const velNum = el('span', { class: 'cs-tempo' }, fatorAtual.toFixed(2).replace('.', ',') + 'x');
  vel.addEventListener('input', function () {
    fatorAtual = Number(vel.value) > 0 ? Number(vel.value) : 1;
    scroller.definirVelocidade(fatorAtual);
    velNum.textContent = fatorAtual.toFixed(2).replace('.', ',') + 'x';
    // Arrastar o controle dispara dezenas de eventos; gravar em cada um
    // inundaria o "mudou" do store e gravaria no disco sem parar.
    if (opts.onEstudoVelocidade) {
      clearTimeout(velTimer);
      velTimer = setTimeout(function () {
        opts.onEstudoVelocidade(fatorAtual);
      }, 400);
    } else {
      changed();
    }
  });
  let velTimer = null;

  scroller = cifraScroller(cifra, {
    bpm: opts.bpm,
    compasso: opts.compasso,
    fator: fatorAtual,
    onProgress: aoProgredir,
  });

  function pintarBotao() {
    const tocando = scroller.getEstado().tocando;
    U.clear(play);
    play.appendChild(el('i', { 'data-lucide': tocando ? 'pause' : 'play' }));
    play.setAttribute('aria-label', tocando ? 'Parar a rolagem' : 'Rolar a cifra');
  }

  play.addEventListener('click', function () {
    const st = scroller.getEstado();
    if (st.tocando) { scroller.parar(); }
    else if (!scroller.reproduzir()) { UI.toast('Esta cifra não tem linhas de acordes para rolar', { tipo: 'err' }); }
    pintarBotao();
    if (globalThis.UI && globalThis.UI.icons) globalThis.UI.icons(play);
  });

  // O progresso vem do laco de rolagem, que corre por quadro. Nao ha
  // temporizador aqui: um intervalo de 250 ms para atualizar a barra deixaria
  // o movimento aos saltos, que e justo o que a barra existe para evitar.

  const barra = el('div', { class: 'cs-barra' }, [play, prog, tempo]);

  /**
   * Refaz a cifra visivel do zero.
   *
   * Esconder um trecho nao pode ser so apagar as linhas da tela: o roteiro de
   * rolagem contaria o tempo de um verso que ninguem ve, e o mostrador
   * "3/9" mentiria. Por isso o roteiro e refeito sobre o que sobrou.
   */
  function reconstruir() {
    const estadoAntes = scroller.getEstado();
    const posicaoAntes = estadoAntes.indice;
    const totalAntes = estadoAntes.total || 1;
    const fracao = posicaoAntes / totalAntes;

    const nova = cifraScroller(cifraVisivel(), {
      bpm: opts.bpm, compasso: opts.compasso, fator: fatorAtual,
      onProgress: aoProgredir,
    });
    scroller.parar();
    raiz.replaceChild(nova, scroller);
    scroller = nova;
    scroller.definirVelocidade(fatorAtual);

    // Volta para a mesma proporcao da cifra, e nao para a mesma linha: esconder
    // linhas muda os indices, e pular para a linha 12 de uma cifra que agora
    // tem 6 deixaria o visor no fim.
    const alvo = Math.round(fracao * scroller.getEstado().total);
    scroller.destacar(Math.max(0, Math.min(scroller.getEstado().total, alvo)));

    pintarFita();
    pintarBotao();
    changed();
    if (globalThis.UI && globalThis.UI.icons) globalThis.UI.icons(raiz);
  }

  const btnSoAcordes = el('button', {
    class: 'est-toggle' + (soAcordes ? ' ligado' : ''),
    'aria-pressed': String(soAcordes),
    onclick: function () {
      soAcordes = !soAcordes;
      btnSoAcordes.setAttribute('aria-pressed', String(soAcordes));
      btnSoAcordes.classList.toggle('ligado', soAcordes);
      reconstruir();
    },
  }, [el('i', { 'data-lucide': 'music' }), el('span', {}, 'só acordes')]);

  const btnTodos = el('button', {
    class: 'est-btn',
    onclick: function () {
      if (!ocultos.size) return;
      ocultos.clear();
      reconstruir();
    },
  }, [el('i', { 'data-lucide': 'rotate-ccw' }), el('span', {}, 'mostrar tudo')]);

  const raiz = el('div', { class: 'stack gap-3' }, [
    el('div', { class: 'est-topo' }, [btnSoAcordes, btnTodos, estResumo]),
    el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'layers' }), 'Trechos']),
    fita,
    scroller,
    barra,
    el('div', { class: 'cs-velocidade' }, [el('span', {}, 'velocidade'), vel, velNum]),
  ]);

  pintarFita();
  /**
    * Delegar para o scroller.
    *
    * O painel e a scroller com uma barra de controles em volta. Quem chama o
    * painel espera achar o mesmo que a scroller oferece — e nao e o que
    * acontecia: `painelRolagem(...)` devolvia um objeto com um unico metodo,
    * `destroy`. A tela da mesa de ensaio perguntava `linhaNoTempo` e recebia
    * `undefined`, entao a rolagem ficava parada na primeira linha enquanto o
    * relogio corria. Sem erro, sem aviso — so a cifra parada.
    *
    * Delegar por lista mantem o painel como o que e: a scroller mais os
    * controles. Um metodo novo na scroller nao precisa ser lembrado aqui.
    */
  ['reproduzir', 'parar', 'destacar', 'irParaAcorde', 'definirVelocidade',
    'getEstado', 'linhaNoTempo', 'duracaoTotal'].forEach(function (nome) {
    raiz[nome] = function () {
      if (typeof scroller[nome] !== 'function') return undefined;
      return scroller[nome].apply(scroller, arguments);
    };
  });
  raiz.destroy = function () { scroller.parar(); };
  return raiz;
}

/* =======================================================
     ROLAGEM AUTOMATICA
     ======================================================= */

  /**
   * A cifra que rola, linha a linha.
   *
   * `cifraBox` joga o texto inteiro num unico `<pre>` separado por `\n`. Serve
   * para ler, mas nao serve para rolar: nao ha como saber onde a linha 7
   * esta na tela nem ilumina-la quando ela chega. Aqui cada linha e um
   * elemento proprio, com o indice guardado — e o que permite rolar ate la e
   * acender o acorde na hora.
   *
   * A rolagem segue o roteiro de `Music.roteiroDeRolagem`: uma parada por
   * linha de acordes, mais rapida em secao e respiro. O tempo vem do
   * andamento da musica, corrigido pela velocidade que a pessoa escolhe.
   */
  function cifraScroller(cifra, opts) {
    opts = opts || {};
    const roteiro = M.roteiroDeRolagem(cifra, { bpm: opts.bpm, compasso: opts.compasso, fator: opts.fator });

    const viewport = el('div', { class: 'cs-viewport' });
    const trilha = el('div', { class: 'cs-trilha' });
    viewport.appendChild(trilha);

    if (!cifra || !String(cifra).trim()) {
      viewport.appendChild(el('p', { class: 'fs-sm muted center', style: { padding: '18px' } },
        'Sem cifra para rolar.'));
      const vazio = el('div', { class: 'cs' }, [viewport]);
      vazio.getEstado = function () { return { tocando: false, indice: 0, progresso: 0, total: 0 }; };
      vazio.reproduzir = function () {};
      vazio.parar = function () {};
      vazio.destacar = function () {};
      vazio.definirVelocidade = function () {};
      return vazio;
    }

    const linhasTxt = String(cifra).replace(/\r\n?/g, '\n').split('\n');
    const elementos = [];
    linhasTxt.forEach(function (ln, i) {
      const linhaEl = el('div', { class: 'cs-linha cs-' + tipoClasse(roteiro.linhas[i] ? roteiro.linhas[i].tipo : 'letra') });
      linhaEl.dataset.linha = String(i);
      if (roteiro.linhas[i] && roteiro.linhas[i].tipo === 'secao') {
        linhaEl.appendChild(el('span', { class: 'sec' }, '[' + esc(ln.trim().slice(1, -1)) + ']'));
      } else {
        M.tokenizeLine(ln, M.isChordLine(ln)).forEach(function (t) {
          if (t.type === 'chord') linhaEl.appendChild(el('span', { class: 'ch' }, t.v));
          else linhaEl.appendChild(document.createTextNode(t.v));
        });
      }
      trilha.appendChild(linhaEl);
      elementos.push(linhaEl);
    });

/* ---- estado e laco ---- */
    let raf = null;
    let indice = 0;
    let progresso = 0;   // 0..1 dentro da linha atual
    let decorrido = 0;   // ms ja gastos na linha atual
    let marca = null;    // instante do quadro anterior
    let fator = roteiro.fator;
    let noFim = false;

    function parar() {
      if (raf) { global.cancelAnimationFrame(raf); raf = null; }
      // A barra fica no ponto em que parou, e nao volta a zero. Zerar ao
      // pausar tira a referencia do compasso justo quando a pessoa parou
      // para olhar a letra.
    }

    function pintar() {
      elementos.forEach(function (e, i) {
        e.classList.toggle('atual', i === indice);
        e.classList.toggle('passou', i < indice);
      });
      const elAtual = elementos[indice];
      if (elAtual) {
        // A linha fica a um terco do alto: com a cifra inteira na tela, a
        // linha que importa e a do meio, nao a primeira. Rolar ate o topo a
        // cada troca deixaria o olho subir e descer sem parar.
        //
        // A posicao e medida pelos retangulos, e nao por offsetTop. offsetTop
        // e relativo ao offsetParent, e a janela de rolagem nao e posicionada
        // — entao ele media a partir do dialogo inteiro, incluindo o
        // cabecalho. O erro era constante, e a linha acabava passando acima da
        // janela conforme a cifra crescia: media 174 px fora da vista.
        const vr = viewport.getBoundingClientRect();
        const ar = elAtual.getBoundingClientRect();
        const deslocamento = ar.top - vr.top;
        const alvo = viewport.scrollTop + deslocamento
          - viewport.clientHeight / 3 + elAtual.offsetHeight / 2;
        viewport.scrollTo({ top: Math.max(0, Math.round(alvo)), behavior: 'auto' });
      }
      if (opts.onProgress) opts.onProgress(progresso, indice, roteiro);
    }

    /**
     * O laco corre por quadro, e nao por temporizador.
     *
     * Com setTimeout a linha so mudava no fim da espera, e a barra de
     * progresso ficava parada em zero durante toda a parada — um indicador
     * que nunca anda e pior do que nenhum. Por quadro o tempo dentro da
     * linha corre continuo, que e o que deixa ver o compasso passar.
     *
     * A duracao de cada linha vem do roteiro, ja corrigida pela velocidade.
     */
    function quadro(agora) {
      const passo = roteiro.linhas[indice];
      const ms = Math.max(120, Math.round(passo.ms / fator));
      if (marca == null) marca = agora;
      decorrido += agora - marca;
      marca = agora;
      // Um quadro perdido (aba em segundo plano) traz um salto grande. Sem
      // este teto, voltar para a aba pulava varias linhas de uma vez.
      if (decorrido > ms * 3) decorrido = ms;
      progresso = Math.min(1, decorrido / ms);
      if (opts.onProgress) opts.onProgress(progresso, indice, roteiro);

      if (decorrido >= ms) {
        decorrido = 0;
        progresso = 0;
        if (indice >= elementos.length - 1) {
          noFim = true;
          parar();
          pintar();
          if (opts.onFim) opts.onFim();
          return;
        }
        indice++;
        pintar();
      }
      raf = global.requestAnimationFrame(quadro);
    }

    const raiz = el('div', { class: 'cs' }, [viewport]);

    raiz.reproduzir = function () {
      if (roteiro.totalAcordes <= 0) return false;
      parar();
      noFim = false;
      if (indice >= elementos.length - 1) { indice = 0; decorrido = 0; progresso = 0; marca = null; }
      pintar();
      marca = null;
      raf = global.requestAnimationFrame(quadro);
      return true;
    };
    raiz.parar = function () { parar(); };
    raiz.destacar = function (i) {
      parar();
      indice = Math.max(0, Math.min(elementos.length - 1, i | 0));
      decorrido = 0;
      progresso = 0;
      marca = null;
      pintar();
    };
    raiz.irParaAcorde = function (n) {
      const alvos = roteiro.linhas.filter((r) => r.tipo === 'acorde');
      if (!alvos.length) return;
      raiz.destacar(alvos[Math.max(0, Math.min(alvos.length - 1, n | 0))].indice);
    };
    raiz.definirVelocidade = function (f) {
      const n = Number(f);
      fator = isFinite(n) && n > 0 ? n : 1;
    };
    raiz.getEstado = function () {
      return {
        tocando: !!raf,
        noFim: noFim,
        indice: indice,
        progresso: progresso,
        total: roteiro.totalAcordes,
        bpm: roteiro.bpm,
        msPorLinha: roteiro.msCheia,
        msCheia: Math.max(120, Math.round(roteiro.msCheia / fator)),
      };
    };

    /**
     * A linha que esta tocando num instante dado.
     *
     * Existe para o palco: quando quem conduz o ensaio e o video ou a voz que
     * marca o tempo, a rolagem deixa de ter relogio proprio e passa a seguir
     * esse tempo. Para isso ela precisa saber "em quantos segundos comeca a
     * linha N" — e a resposta esta no roteiro, que ja sabe quanto tempo cada
     * linha dura.
     *
     * Sem este metodo, a unica forma de casar os dois e contar as linhas de
     * fora, e um meio-tempo de erro no calculo faz a rolagem entrar meio
     * compasso adiantada — que e justamente o defeito que a rolagem existe para
     * evitar.
     */
    raiz.linhaNoTempo = function (segundos) {
      const t = Math.max(0, Number(segundos) || 0) * 1000;
      const ms = Math.max(120, roteiro.msCheia / fator);
      const i = Math.min(elementos.length - 1, Math.floor(t / ms));
      return Math.max(0, i);
    };

    /** O tempo total do roteiro, em segundos. Serve para saber quando acaba. */
    raiz.duracaoTotal = function () {
      const ms = Math.max(120, roteiro.msCheia / fator);
      return (elementos.length * ms) / 1000;
    };

    pintar();
    return raiz;
  }

  function tipoClasse(tipo) {
    if (tipo === M.TIPO_LINHA.ACORDE) return 'acorde';
    if (tipo === M.TIPO_LINHA.SECAO) return 'secao';
    if (tipo === M.TIPO_LINHA.VAZIA) return 'respiro';
    return 'letra';
  }

  /**
   * O botao que OUVE um tom.
   *
   * E a peca que responde "por que eu toco isso?". Uma cifra diz o tom; ela nao
   * faz o ouvido aceitar. Quem esta com a corda na mao precisa ouvir o alvo ao
   * lado do que a corda esta dando, e um quarto de tom de diferenca nao se
   * resolve lendo, so ouvindo.
   *
   * Toca a tonica E a sua quinta. A quinta da corpo: so a tonica e fina demais
   * para servir de referencia, e faz a corda parecer errada quando o que esta
   * errado e o timbre. E o oposto do que se faz ao ensinar a forma de um
   * acorde, onde a quinta distrai.
   *
   * `mini` e so o icone, para encostar num texto que ja diz o tom.
   */
  function botaoTom(pc, modo, rotulo, opts) {
    opts = opts || {};
    const p = M.mod12(pc);
    const nome = rotulo || (M.noteName(p, M.useFlatsFor(p)) + (modo === 'minor' ? ' menor' : ' maior'));
    const mini = !!opts.mini;
    const botao = el('button', {
      class: 'tom-btn' + (mini ? ' mini' : ''), type: 'button',
      'aria-label': 'Ouvir o tom ' + nome,
      title: 'Ouvir ' + nome,
    });

    if (!mini) botao.appendChild(el('span', { class: 'tom-btn-nome' }, nome));
    botao.appendChild(el('i', { 'data-lucide': 'volume-2' }));

    let relogio = null;
    botao.addEventListener('click', function () {
      const A = global.Nota;
      if (!A || typeof A.tocarAcorde !== 'function') {
        if (global.UI && global.UI.toast) global.UI.toast('Áudio indisponível neste navegador', { tipo: 'err' });
        return;
      }
      // Cortar o que ainda estava soando: dois tons juntos nao ajudam ninguem a
      // decidir, e o que fica tocando depois e o que a pessoa vai lembrar.
      if (relogio) global.clearTimeout(relogio);
      A.parar();

      const Tuner = global.Tuner;
      if (!Tuner || typeof Tuner.notaParaHz !== 'function') {
        if (global.UI && global.UI.toast) global.UI.toast('Sintese indisponível', { tipo: 'err' });
        return;
      }
      const oitava = opts.oitava || 3;
      const hzTonica = Tuner.notaParaHz(p, oitava);
      const hzQuinta = Tuner.notaParaHz(M.mod12(p + 7), oitava);
      if (!hzTonica) return;

      const notas = opts.quinta === false ? [hzTonica] : [hzTonica, hzQuinta];
      A.tocarAcorde(notas, { duracao: opts.duracao || 2.2, volume: 0.2, espalhar: 0.02 });

      botao.classList.add('tocando');
      relogio = global.setTimeout(function () { botao.classList.remove('tocando'); }, 2300);
    });

    return botao;
  }

  /**
   * Uma linha "Tom: Am" com o botao de som ao lado.
   *
   * E o formato que cabe onde ja existe um texto com o tom: a cifra aberta, o
   * cabecalho da teoria. Nao e uma segunda informacao — e a mesma informacao
   * com uma forma de conferir em vez de apenas ler.
   */
  function linhaComTom(pc, modo, prefixo, opts) {
    opts = opts || {};
    const p = M.mod12(pc);
    const nome = M.noteName(p, M.useFlatsFor(p)) + (modo === 'minor' ? ' menor' : ' maior');
    return el('div', { class: 'tom-com-ouvir' }, [
      el('span', {}, (prefixo || 'Tom: ') + nome),
      botaoTom(p, modo, null, Object.assign({ mini: true }, opts)),
    ]);
  }

/* =======================================================
     O SELETOR DE TONALIDADES
     =======================================================

     Vive aqui, e nao em cada tela, porque a Acordes e a Escalas precisam do
     mesmo seletor. Uma copia por tela comeca a divergir no primeiro ajuste — e a
     divergencia aparece como "o seletor e diferente nesta tela", que e o tipo
     de defeito que faz a pessoa desconfiar do app inteiro.

     Sao DOIS estados, e nao um:

       - as sete tonalidades sem accidental, sempre a vista;
       - as cinco com accidental, so quando o acorde escolhido precisa delas.

     Doze botoes para sete notas e ruido, e o ultimo caia sozinho numa segunda
     linha, o que parece defeito de layout. Porem, esconder as accidentais e
     perigoso: se o acorde escolhido tem accidental e elas nao aparecem, a
     pessoa nao ve o que esta selecionado. Por isso a segunda fileira aparece
     justamente quando e necessaria.
   ======================================================= */

/** As cinco com accidental, por valor de semitons. */
const TONS_COM_ACCIDENTE = [6, 10, 3, 8, 1];   // F#, Bb, Eb, Ab, Db

/**
 * O seletor.
 *
 * `pc` e a tonalidade escolhida. `aoEscolher` recebe o novo valor. `rotulo`
 * opcional, para quando o seletor precisa de um texto em cima.
 */
function seletorDeTons(opts) {
  opts = opts || {};
  const pc = M.mod12(opts.pc || 0);
  const aoEscolher = opts.aoEscolher || function () {};
  const box = el('div', { class: 'seletor-tons' });

  function fileira(lista) {
    const linha = el('div', { class: 'key-picker mb-2' });
    lista.forEach(function (t) {
      linha.appendChild(el('button', {
        class: 'key-cell', type: 'button',
        'aria-pressed': String(pc === t.pc),
        onclick: function () { aoEscolher(t.pc); },
      }, M.noteName(t.pc, M.useFlatsFor(t.pc))));
    });
    return linha;
  }

  const principais = TONS_MAIORES.filter(function (t) {
    return TONS_COM_ACCIDENTE.indexOf(t.pc) < 0;
  });
  const acidentais = TONS_MAIORES.filter(function (t) {
    return TONS_COM_ACCIDENTE.indexOf(t.pc) >= 0;
  });

  box.appendChild(fileira(principais));

  // A fileira extra so quando a escolhida precisa dela. Sem isto, quem escolhe
  // um tom com bemol deixa de ver a propria selecao.
  if (TONS_COM_ACCIDENTE.indexOf(pc) >= 0) {
    box.appendChild(el('div', { class: 'label st-acc-titulo' }, 'Com accidental'));
    box.appendChild(fileira(acidentais));
  }

  return box;
}

/* =======================================================
     OUVIR A ESCALA INTEIRA

     O botao de tom toca a tonica e a dominante. Isso responde "qual e a
     tonica", que nao e a mesma pergunta que "como e essa escala".

     Faltava tocar a escala. E o que faz uma escala parecer escala nao e o
     conjunto das notas: e o intervalo entre elas. Oito notas ao mesmo tempo sao
     um acorde grande, nao uma escala.
   ======================================================= */

/**
 * O botao que toca a escala ascendente.
 *
 * `notas` e a lista de semitons da escala (a saida de `scaleNotes`, com
 * octaves ja separadas).
 */
/* =======================================================
     OUVIR A ESCALA INTEIRA

     O botao de tom toca a tonica e a dominante. Isso responde "qual e a
     tonica", que nao e a mesma pergunta que "como e essa escala".

     O que faz uma escala parecer escala nao e o conjunto das notas: e o
     intervalo entre elas. Oito notas ao mesmo tempo sao um acorde grande, e nao
     uma escala.

     Clicar de novo interrompe. E o botao volta ao normal na hora, e nao quando
     o relogio do fim da sequencia passa — senao fica escrito "Parar" com o
     som ja cortado.
     ======================================================= */
  function botaoEscala(notas, rotulo, opts) {
    opts = opts || {};
    const Tuner = global.Tuner;
    const A = global.Nota;
    const textoParado = rotulo || 'Ouvir a escala';

    const botao = el('button', {
      class: 'botao-escala', type: 'button',
      'aria-label': 'Ouvir a escala',
    });

    let relogio = null;
    let tocando = false;

    /* Pinta o botao no estado em que ele esta.
       Fatorado porque o texto aparecia em tres lugares e ja tinha divergido
       uma vez: o clique de interromper deixava "Parar" na tela depois do som
       cortado. */
    function marcar(ligado) {
      U.clear(botao);
      botao.appendChild(el('i', { 'data-lucide': ligado ? 'square' : 'play' }));
      botao.appendChild(el('span', {}, ligado ? 'Parar' : textoParado));
      botao.classList.toggle('tocando', ligado);
      tocando = ligado;
    }

    marcar(false);

    botao.addEventListener('click', function () {
      if (!A || typeof A.tocarSequencia !== 'function') {
        if (global.UI && global.UI.toast) global.UI.toast('Áudio indisponível', { tipo: 'err' });
        return;
      }

      if (tocando) {
        // `A.parar()` e nao `parar()`: `parar` e uma funcao de audio.js e nao
        // esta no escopo deste arquivo. Escrever `parar()` produzia um
        // ReferenceError no segundo clique — a escala tocava e nao havia como
        // interromper sem trocar de aba.
        A.parar();
        if (relogio) clearTimeout(relogio);
        marcar(false);
        return;
      }

      if (!Tuner || typeof Tuner.notaParaHz !== 'function') return;

      const oitava = opts.oitava == null ? 3 : opts.oitava;
      const hz = [];
      for (let i = 0; i < notas.length; i++) {
        // A lista pode vir como semitons simples (0..11) ou ja com a oitava
        // somada. Um valor acima de 11 indica que o laço passou da oitava.
        const bruto = notas[i];
        const oct = Math.floor(bruto / 12);
        const h = Tuner.notaParaHz(M.mod12(bruto), oitava + oct);
        if (h) hz.push(h);
      }
      if (!hz.length) return;

      const passo = opts.passo || 0.3;
      A.parar();
      A.tocarSequencia(hz, {
        passo: passo,
        duracao: opts.duracao || 0.42,
        volume: opts.volume == null ? 0.19 : opts.volume,
      });

      marcar(true);

      // O relogio cobre a sequencia inteira mais um respiro. Nada mais confiavel
      // do que a propria duracao calculada.
      if (relogio) clearTimeout(relogio);
      relogio = setTimeout(function () {
        tocando = false;
        marcar(false);
      }, hz.length * passo * 1000 + 700);
    });

    return botao;
  }


  global.Render = {
    TONS_MAIORES, tomOptionsPc, selectTon,
    chordGrid, chordDiagram, chordDiagramVertical,
    scaleFretboard, scaleKeyboard, circleOfFifths,
    cifraBox, cifraAligned, chordAnalysis, statCard,
    transposeBar, numeroBr, botaoTom, linhaComTom,
    seletorDeTons, botaoEscala, TONS_COM_ACCIDENTE,
    cifraScroller, painelRolagem, tipoClasse,
  };

  /** "3,5" e "+3" e "-0,5": casas decimais viram virgula, como se escreve. */
  function numeroBr(semis) {
    const s = Math.abs(semis);
    const txt = (s % 1 === 0 ? String(s) : s.toFixed(1)).replace('.', ',');
    return (semis > 0 ? '+' : semis < 0 ? '−' : '') + txt;
  }

  /**
   * A barra de transposicao.
   *
   * A barra anterior era sete botoes com os rotulos mentindo: o botao "-8"
   * somava doze semitons, e o "+8" tambem. Quem clicava "-8" achava que tinha
   * descido meio tom e tinha descido uma oitava. Um rotulo que nao corresponde
   * ao que o botao faz e pior do que nao ter rotulo.
   *
   * Aqui o passo e de meio semitom, e o rotulo e sempre o valor: -0,5 soma
   * meio, +12 soma doze.
   *
   * Sobre o meio semitom: ele e um quarto de tom, e nenhum nome de acorde o
   * representa. O motor arredonda para a nota mais proxima, e a linha de cents
   * diz o quanto afinar para fora — que e a parte que o musician realmente
   * precisa quando o meio tom e um afino de corda, e nao uma tecla do piano.
   */
  function transposeBar(opts) {
    opts = opts || {};
    const min = opts.min == null ? -12 : opts.min;
    const max = opts.max == null ? 12 : opts.max;
    const passo = opts.passo == null ? 0.5 : opts.passo;
    let valor = opts.valor || 0;
    const onChange = opts.onChange || function () {};

    const readout = el('div', { class: 'tb-leitura' });
    const avisoCents = el('div', { class: 'tb-cents' });
    const slider = el('input', {
      type: 'range', class: 'tb-slider',
      min: String(min), max: String(max), step: String(passo), value: String(valor),
      'aria-label': 'Transpor em semitons',
    });
    slider.addEventListener('input', function () {
      valor = Number(slider.value);
      pintar();
      onChange(valor);
    });

    // A ordem e a ordem do mostrador: negativo, zero, positivo. Os passos finos
// entram dos dois lados do zero, e nao agrupados — btnoc de +0,5 na esquerda
    // do 0 faz o usuario achar que o sinal do botao esta errado.
    const passos = [-12, -6, -3, -1, -passo, 0, passo, 1, 3, 6, 12]
      .filter(function (v, i, a) { return v >= min && v <= max && a.indexOf(v) === i; });

    const botoes = passos.map(function (p) {
      const b = el('button', {
        class: 'semitone', 'aria-pressed': 'false',
        onclick: function () { valor = p; slider.value = String(p); pintar(); onChange(p); },
      }, p === 0 ? '0' : numeroBr(p));
      b.dataset.passo = String(p);
      return b;
    });

    function pintar() {
      const cents = M.centsDeDesvio(valor);
      U.clear(readout);
      readout.appendChild(el('span', { class: 'tb-valor' + (valor === 0 ? ' zero' : '') }, numeroBr(valor)));
      readout.appendChild(el('span', { class: 'tb-un' }, valor === 0 || Math.abs(valor) === 1 ? 'semitom' : 'semitons'));

      // O aviso de cents so aparece quando ha mesmo um quarto de tom pedido.
      // Fora do zero e dos inteiros, esta vazio: um aviso sempre visivel vira
      // ruido, e ruido e o que faz a pessoa parar de ler os avisos.
      U.clear(avisoCents);
      if (cents !== 0) {
        avisoCents.appendChild(el('span', { class: 'tb-cents-num' }, Math.abs(cents) + ' cents'));
        avisoCents.appendChild(el('span', {},
          cents > 0 ? ' acima do inteiro — afine ' + cents + ' cents para baixo' : ' abaixo do inteiro — afine ' + Math.abs(cents) + ' cents para cima'));
      }

      botoes.forEach(function (b) {
        b.setAttribute('aria-pressed', String(Number(b.dataset.passo) === valor));
      });
      slider.value = String(valor);
    }

    const linha = el('div', { class: 'semitone-bar' }, botoes);
    const raiz = el('div', { class: 'tb' }, [
      el('div', { class: 'tb-topo' }, [readout]),
      slider,
      avisoCents,
      linha,
    ]);
    pintar();
    raiz.setValor = function (v) { valor = v; pintar(); };
    raiz.getValor = function () { return valor; };
    return raiz;
  }
})(typeof window !== 'undefined' ? window : globalThis);
