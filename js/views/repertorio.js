/* =========================================================
   ACORDE - views/repertorio.js
   Biblioteca central de cifras.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const S = global.Store;
  const UI = global.UI;
  const M = global.Music;
  const R = global.Render;
  const Lk = global.Links;
  const { el, $ } = U;
  const V = global.Views || (global.Views = {});

  let aba = 'minhas';
  let filtro = { q: '', tom: '', categoria: '' };

  function render(root, params) {
    if (params && params.aba) aba = params.aba;
    if (params && params.tom) { filtro.tom = params.tom; aba = 'minhas'; }
    if (params && params.importar) { aba = 'hinos'; setTimeout(function () { importarHino(params.importar); }, 90); }
    if (params && params.acao === 'colar') setTimeout(colar, 120);
    if (params && params.id) { const c = S.cifraPorId(params.id); if (c) setTimeout(function () { abrirCifra(c); }, 90); }

    U.clear(root);
    root.appendChild(el('div', { class: 'page-head' }, el('div', { class: 'row between' }, [
      el('div', {}, [el('h1', {}, 'Repertório'), el('div', { class: 'sub' }, 'Sua biblioteca de cifras')]),
      el('button', { class: 'btn btn-primary btn-sm', onclick: novo }, [el('i', { 'data-lucide': 'plus' }), 'Nova']),
    ])));

    root.appendChild(el('div', { class: 'tabs' }, [
      abaBtn('minhas', 'Minhas cifras', 'library'),
      abaBtn('hinos', 'Hinos base', 'book-open'),
    ]));

    root.appendChild(aba === 'minhas' ? painelMinhas() : painelHinos());
    UI.icons(root);
  }

  function abaBtn(id, label, ic) {
    const b = el('button', { 'aria-selected': String(aba === id), onclick: function () { aba = id; recarregar(); } },
      [el('i', { 'data-lucide': ic }), label]);
    return b;
  }
  function recarregar() {
    const p = document.getElementById('page-repertorio');
    if (p && p.classList.contains('active')) render(p, {});
  }

  /* =======================
     MINHAS CIFRAS
     ======================= */
  function painelMinhas() {
    const wrap = el('div', {});
    const busca = el('input', { class: 'input', value: filtro.q, placeholder: 'Buscar por titulo, artista ou letra...' });
    const limpar = el('button', { class: 'clear-btn', 'aria-label': 'Limpar' }, el('i', { 'data-lucide': 'x' }));
    const gi = el('div', { class: 'input-group' + (filtro.q ? ' has-value' : '') }, [el('i', { 'data-lucide': 'search' }), busca, limpar]);
    busca.addEventListener('input', U.debounce(function () {
      filtro.q = busca.value;
      gi.classList.toggle('has-value', !!busca.value);
      pintar();
    }, 150));
    limpar.addEventListener('click', function () { busca.value = ''; filtro.q = ''; gi.classList.remove('has-value'); pintar(); });
    wrap.appendChild(gi);

    const tons = S.tons().sort();
    const cats = S.categorias();
    if (tons.length || cats.length) {
      const chips = el('div', { class: 'chips chips-scroll mt-3' });
      chips.appendChild(el('button', {
        class: 'chip', 'aria-pressed': String(!filtro.tom && !filtro.categoria),
        onclick: function () { filtro.tom = ''; filtro.categoria = ''; recarregar(); },
      }, 'Todos'));
      tons.forEach(function (t) {
        chips.appendChild(el('button', { class: 'chip', 'aria-pressed': String(filtro.tom === t),
          onclick: function () { filtro.tom = filtro.tom === t ? '' : t; recarregar(); } }, t));
      });
      cats.forEach(function (c) {
        chips.appendChild(el('button', { class: 'chip', 'aria-pressed': String(filtro.categoria === c),
          onclick: function () { filtro.categoria = filtro.categoria === c ? '' : c; recarregar(); } }, c));
      });
      wrap.appendChild(chips);
    }

    const info = el('span', { class: 'fs-sm muted' });
    wrap.appendChild(el('div', { class: 'row between mt-4 mb-2' }, [
      info,
      el('div', { class: 'row gap-2' }, [
        el('button', { class: 'btn-icon sm', 'aria-label': 'Colar cifra', title: 'Colar cifra', onclick: colar },
          el('i', { 'data-lucide': 'clipboard-paste' })),
        el('button', { class: 'btn-icon sm', 'aria-label': 'Imprimir lista', title: 'Imprimir lista', onclick: imprimirLista },
          el('i', { 'data-lucide': 'printer' })),
      ]),
    ]));

    const box = el('div', {});
    wrap.appendChild(box);

    function pintar() {
      U.clear(box);
      const itens = S.filtrarCifras(filtro);
      const total = S.cifras().length;
      info.textContent = itens.length === total
        ? total + (total === 1 ? ' cifra' : ' cifras')
        : itens.length + ' de ' + total + ' cifras';
      if (!itens.length) {
        box.appendChild(UI.empty({
          icon: total ? 'search-x' : 'library',
          title: total ? 'Nada encontrado' : 'Repertório vazio',
          message: total ? 'Ajuste a busca ou os filtros.'
            : 'Guarde aqui as cifras que voce usa sempre. Depois e so puxar para qualquer escala.',
          action: total ? null : { label: 'Criar primeira cifra', icon: 'plus', onClick: novo },
        }));
        return;
      }
      const grid = el('div', { class: 'grid-auto-lg' });
      itens.forEach(function (c) { grid.appendChild(cartaoCifra(c)); });
      box.appendChild(grid);
      UI.icons(box);
    }
    pintar();
    return wrap;
  }

  function cartaoCifra(c) {
    return el('button', { class: 'song-card', onclick: function () { abrirCifra(c); } }, [
      el('div', { class: 'row between' }, [
        el('div', { class: 'grow', style: { minWidth: '0' } }, [
          el('div', { class: 'n' }, c.titulo),
          c.artista ? el('div', { class: 'a ellipsis' }, c.artista) : null,
        ]),
        el('i', { 'data-lucide': 'chevron-right', style: { width: '16px', height: '16px', color: 'var(--ink-4)', flex: 'none' } }),
      ]),
      el('div', { class: 'foot' }, [
        c.tom ? el('span', { class: 'badge badge-key' }, c.tom) : null,
        c.bpm ? el('span', { class: 'badge' }, c.bpm + ' bpm') : null,
        c.compasso && c.compasso !== '4/4' ? el('span', { class: 'badge' }, c.compasso) : null,
        c.categoria ? el('span', { class: 'badge badge-brand' }, c.categoria) : null,
      ]),
    ]);
  }

  /* =======================
     HINOS BASE
     ======================= */
  function painelHinos() {
    const wrap = el('div', {});
    const hinos = global.HINOS ? global.HINOS.list : [];
    wrap.appendChild(el('div', { class: 'card card-flat mb-3', style: { background: 'var(--brand-tint)', borderColor: 'transparent' } }, [
      el('div', { class: 'row gap-2' }, [
        el('i', { 'data-lucide': 'info', style: { width: '17px', height: '17px', color: 'var(--primary)', flex: 'none' } }),
        el('p', { class: 'fs-sm c-2' }, 'Cifras de referencia. Variam entre hinarios e congregacoes - confira e edite antes de usar. Ao importar, a cifra vira editavel no seu repertorio.'),
      ]),
    ]));
    if (!hinos.length) {
      wrap.appendChild(UI.empty({ icon: 'book-open', title: 'Nenhum hino carregado' }));
      return wrap;
    }
    const grid = el('div', { class: 'grid-auto-lg' });
    hinos.forEach(function (h) {
      grid.appendChild(el('button', { class: 'song-card', onclick: function () { abrirHino(h); } }, [
        el('div', { class: 'row between' }, [
          el('div', { class: 'grow', style: { minWidth: '0' } }, [
            el('div', { class: 'n' }, h.titulo),
            el('div', { class: 'a ellipsis' }, h.artista),
          ]),
          el('i', { 'data-lucide': 'chevron-right', style: { width: '16px', height: '16px', color: 'var(--ink-4)', flex: 'none' } }),
        ]),
        el('div', { class: 'foot' }, [
          h.tom ? el('span', { class: 'badge badge-key' }, h.tom) : null,
          h.bpm ? el('span', { class: 'badge' }, h.bpm + ' bpm') : null,
          el('span', { class: 'badge badge-brand' }, h.categoria),
        ]),
      ]));
    });
    wrap.appendChild(grid);
    UI.icons(wrap);
    return wrap;
  }

  function abrirHino(h) {
    UI.sheet({
      title: h.titulo, sub: h.artista,
      body: el('div', { class: 'stack gap-3' }, [
        el('div', { class: 'row gap-2 wrap' }, [
          h.tom ? el('span', { class: 'badge badge-key' }, h.tom) : null,
          h.bpm ? el('span', { class: 'badge' }, h.bpm + ' bpm') : null,
          h.compasso ? el('span', { class: 'badge' }, h.compasso) : null,
        ]),
        h.letra ? el('div', {}, [
          el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'align-left' }), 'Letra']),
          el('pre', { class: 'cifra-text lyric', style: { whiteSpace: 'pre-wrap' } }, h.letra),
        ]) : null,
        R.cifraBox(h.cifra),
      ]),
      foot: [
        el('button', { class: 'btn btn-secondary', onclick: function () { UI.closeAllSheets(); } }, 'Fechar'),
        el('button', { class: 'btn btn-primary', onclick: function () { UI.closeAllSheets(); importarHino(h.id); } },
          [el('i', { 'data-lucide': 'download' }), 'Importar']),
      ],
    });
  }

  function importarHino(id) {
    const h = global.HINOS && global.HINOS.byId(id);
    if (!h) return;
    const novo = S.normCifra({
      titulo: h.titulo, artista: h.artista, tom: h.tom, bpm: h.bpm,
      compasso: h.compasso, categoria: h.categoria, tags: h.tags,
      letra: h.letra, cifra: h.cifra,
    });
    S.db.cifras.unshift(novo);
    S.mudou('cifra');
    aba = 'minhas';
    recarregar();
    UI.toast('"' + h.titulo + '" importada', {
      tipo: 'ok',
      undo: function () {
        const i = S.db.cifras.findIndex(function (c) { return c.id === novo.id; });
        if (i >= 0) { S.db.cifras.splice(i, 1); S.mudou('cifra'); recarregar(); }
      },
    });
  }

  function imprimirLista() {
    const lista = S.filtrarCifras(filtro);
    if (!lista.length) { UI.toast('Nada para imprimir', { tipo: 'err' }); return; }
    UI.print(global.Print.folhaCifras(lista, 'Repertório'));
  }
  /* =======================
     VER / EDITAR CIFRA
     ======================= */
  function abrirCifra(c) {
    const v = Object.assign({}, c);
    const body = el('div', { class: 'stack gap-3' });
    const infoTom = el('div', {});

    function analisar() {
      U.clear(infoTom);
      if (!v.cifra.trim()) return;
      const k = M.detectKey(v.cifra);
      if (!k) return;
      infoTom.appendChild(el('div', { class: 'card card-flat', style: { background: 'var(--brand-tint)', borderColor: 'transparent' } }, [
        el('div', { class: 'row gap-2' }, [
          el('i', { 'data-lucide': 'key-round', style: { width: '16px', height: '16px', color: 'var(--primary)', flex: 'none' } }),
          el('span', { class: 'fs-sm' }, 'Tom detectado: ' + M.noteName(k.pc, M.useFlatsFor(k.pc)) + (k.mode === 'minor' ? ' menor' : ' maior')),
        ]),
      ]));
    }
    analisar();

    body.appendChild(el('div', { class: 'row gap-2 wrap' }, [
      v.tom ? el('span', { class: 'badge badge-key' }, v.tom) : null,
      v.bpm ? el('span', { class: 'badge' }, v.bpm + ' bpm') : null,
      v.compasso ? el('span', { class: 'badge' }, v.compasso) : null,
      v.categoria ? el('span', { class: 'badge badge-brand' }, v.categoria) : null,
    ]));
    body.appendChild(infoTom);
    if (v.letra) {
      body.appendChild(el('div', {}, [
        el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'align-left' }), 'Letra']),
        el('pre', { class: 'cifra-text lyric', style: { whiteSpace: 'pre-wrap' } }, v.letra),
      ]));
    }
    body.appendChild(R.cifraBox(v.cifra));

    const k = M.detectKey(v.cifra);
    if (k) {
      const analise = R.chordAnalysis(v.cifra, k.pc, k.mode);
      if (analise) body.appendChild(el('div', { class: 'mt-2' }, analise));
    }

    body.appendChild(el('div', { class: 'row gap-2 mt-4 wrap' }, [
      el('button', { class: 'btn btn-soft btn-sm', onclick: function () { dialogTranspor(c); } },
        [el('i', { 'data-lucide': 'shuffle' }), 'Transpor']),
      el('button', { class: 'btn btn-soft btn-sm', onclick: function () { U.copy(v.cifra).then(function () { UI.toast('Cifra copiada', { tipo: 'ok' }); }); } },
        [el('i', { 'data-lucide': 'copy' }), 'Copiar']),
      el('button', { class: 'btn btn-soft btn-sm', onclick: function () { UI.print(printCifra(c)); } },
        [el('i', { 'data-lucide': 'printer' }), 'Imprimir']),
    ]));

    // links externos
    body.appendChild(el('div', { class: 'row gap-2 mt-2 wrap' }, Lk.de(v.titulo, v.artista).map(function (f) {
      return el('button', { class: 'st-link', style: { '--c': f.cor }, title: f.descricao,
        onclick: function () { Lk.abrir(f.id, v.titulo, v.artista); } },
        [el('i', { 'data-lucide': f.icone }), el('span', {}, f.curto)]);
    })));

    const h = UI.sheet({
      title: c.titulo, sub: c.artista || 'Cifra', wide: true, body: body,
      foot: [
        el('button', { class: 'btn btn-danger', onclick: function () { confirmarExcluir(c, h); } },
          [el('i', { 'data-lucide': 'trash-2' }), 'Excluir']),
        el('button', { class: 'btn btn-secondary', onclick: function () { h.close(); } }, 'Fechar'),
        el('button', { class: 'btn btn-primary', onclick: function () { h.close(); editar(c); } },
          [el('i', { 'data-lucide': 'edit-3' }), 'Editar']),
      ],
    });
  }

  function printCifra(c) {
    let b = '<div class="ps-head"><h1>' + U.esc(c.titulo) + '</h1><div class="meta">' +
      U.esc([c.artista, c.tom, c.bpm ? c.bpm + ' bpm' : '', c.compasso].filter(Boolean).join('  -  ')) + '</div></div>';
    if (c.letra) b += '<div class="ps-sec"><h2>Letra</h2><div class="ps-song" style="white-space:pre-wrap">' + U.esc(c.letra) + '</div></div>';
    b += '<div class="ps-sec"><h2>Cifra</h2><div class="ps-cifra">' + U.esc(c.cifra) + '</div></div>';
    return b;
  }

  function confirmarExcluir(c, h) {
    UI.confirmar({
      title: 'Excluir cifra', danger: true, okText: 'Excluir',
      message: 'Excluir "' + c.titulo + '"? As escalas que ja a usaram continuam com a musica.',
    }).then(function (ok) {
      if (!ok) return;
      const i = S.db.cifras.findIndex(function (x) { return x.id === c.id; });
      if (i >= 0) S.db.cifras.splice(i, 1);
      S.mudou('cifra');
      if (h) h.close();
      UI.toast('Cifra excluida', { tipo: 'ok' });
      recarregar();
    });
  }

  function campo(label, control) { return el('div', { class: 'field' }, [el('label', { class: 'label' }, label), control]); }

  function novo(pre) { editar(null, pre); }

  function editar(c, pre) {
    const v = c ? Object.assign({}, c) : S.normCifra(pre || {});
    const isNew = !c;

    const fTitulo = el('input', { class: 'input', value: v.titulo, placeholder: 'Ex.: O Senhor e o Meu Pastor' });
    const fArtista = el('input', { class: 'input', value: v.artista, placeholder: 'Ex.: Claudio Bassés' });
    const fTom = R.selectTon({ value: v.tom, placeholder: 'Tom' });
    const fBpm = el('input', { class: 'input', type: 'number', min: '20', max: '320', value: v.bpm || '', placeholder: 'BPM' });
    const fComp = el('select', { class: 'select' }, global.Metro.COMPASSOS.map(function (c2) {
      return el('option', { value: c2.n, selected: (v.compasso || '4/4') === c2.n }, c2.n);
    }));
    const fCat = el('input', { class: 'input', value: v.categoria, placeholder: 'Ex.: Adoracao' });
    const fTags = el('input', { class: 'input', value: v.tags.join(', '), placeholder: 'Ex.: paz, consolo' });
    const fLetra = el('textarea', { class: 'textarea', placeholder: 'Cole a letra aqui (opcional)' });
    fLetra.value = v.letra;
    const fCifra = el('textarea', { class: 'textarea mono', style: { minHeight: '240px' }, placeholder: '[C]\nO Senhor e o meu pastor\nC        G\nNada me faltara\nAm   F   C' });
    fCifra.value = v.cifra;
    const status = el('div', { class: 'fs-sm muted mt-2' });

    function analisar() {
      U.clear(status);
      const txt = fCifra.value;
      if (!txt.trim()) return;
      const chords = M.extractChords(txt);
      if (!chords.length) { status.textContent = 'Nenhum acorde reconhecido ainda.'; return; }
      const k = M.detectKey(txt);
      const nomes = Array.from(new Set(chords.map(function (c) { return c.text; }))).join(' - ');
      const knome = k ? (M.noteName(k.pc, M.useFlatsFor(k.pc)) + (k.mode === 'minor' ? 'm' : '')) : '?';
      status.textContent = chords.length + ' acordes (' + nomes + ')' + (k ? '  -  tom sugerido: ' + knome : '');
    }
    fCifra.addEventListener('input', U.debounce(analisar, 300));
    analisar();

    const h = UI.sheet({
      title: isNew ? 'Nova cifra' : 'Editar cifra', wide: true,
      body: el('div', { class: 'stack gap-3' }, [
        campo('Titulo *', fTitulo), campo('Artista', fArtista),
        el('div', { class: 'grid-3' }, [campo('Tom', fTom), campo('BPM', fBpm), campo('Compasso', fComp)]),
        el('div', { class: 'grid-2' }, [campo('Categoria', fCat), campo('Tags', fTags)]),
        campo('Letra', fLetra),
        campo('Cifra', el('div', {}, [fCifra, status])),
      ]),
      foot: [
        el('button', { class: 'btn btn-secondary', onclick: function () { h.close(); } }, 'Cancelar'),
        el('button', { class: 'btn btn-success', onclick: function () {
          const titulo = fTitulo.value.trim();
          if (!titulo) { fTitulo.focus(); return; }
          v.titulo = titulo;
          v.artista = fArtista.value.trim();
          v.tom = fTom.value;
          v.bpm = fBpm.value ? parseInt(fBpm.value, 10) : '';
          v.compasso = fComp.value;
          v.categoria = fCat.value.trim();
          v.tags = fTags.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 20);
          v.letra = fLetra.value;
          v.cifra = fCifra.value;
          v.atualizadaEm = Date.now();
          if (isNew) S.db.cifras.unshift(v);
          else {
            const i = S.db.cifras.findIndex(function (x) { return x.id === v.id; });
            if (i >= 0) S.db.cifras[i] = v;
          }
          S.mudou('cifra');
          h.close();
          UI.toast(isNew ? 'Cifra salva' : 'Cifra atualizada', { tipo: 'ok' });
          recarregar();
        } }, [el('i', { 'data-lucide': 'check' }), 'Salvar']),
      ],
    });
    setTimeout(function () { fTitulo.focus(); }, 90);
  }

  function colar() {
    const ta = el('textarea', {
      class: 'textarea mono', style: { minHeight: '210px' },
      placeholder: 'Cole aqui a cifra (do Cifra Club, WhatsApp...)\n\nExemplo:\n[C]\nO Senhor e o meu pastor\nC        G\nNada me faltara',
    });
    const aviso = el('div', { class: 'fs-sm muted mt-2' });
    ta.addEventListener('input', U.debounce(function () {
      const txt = ta.value;
      if (!txt.trim()) { aviso.textContent = ''; return; }
      const chords = M.extractChords(txt);
      if (!chords.length) { aviso.textContent = 'Nao encontrei acordes. Confira a formatacao.'; return; }
      const k = M.detectKey(txt);
      const nomes = Array.from(new Set(chords.map(function (c) { return c.text; }))).join(' - ');
      const knome = k ? (M.noteName(k.pc, M.useFlatsFor(k.pc)) + (k.mode === 'minor' ? 'm' : '')) : '?';
      aviso.textContent = chords.length + ' acordes: ' + nomes + '  -  tom sugerido: ' + knome;
    }, 250));

    const h = UI.sheet({
      title: 'Colar cifra', sub: 'Cole o texto e eu identifico os acordes', wide: true,
      body: el('div', {}, [ta, aviso]),
      foot: [
        el('button', { class: 'btn btn-secondary', onclick: function () { h.close(); } }, 'Cancelar'),
        el('button', { class: 'btn btn-primary', onclick: function () {
          if (!ta.value.trim()) return;
          const k = M.detectKey(ta.value);
          h.close();
          editar(null, { cifra: ta.value, tom: k ? M.noteName(k.pc, M.useFlatsFor(k.pc)) : '' });
        } }, 'Continuar'),
      ],
    });
    setTimeout(function () { ta.focus(); }, 90);
  }

  /* =======================
     TRANSPOR
     ======================= */
  function dialogTranspor(c) {
    const original = c.cifra;
    let semis = 0;
    const saida = el('div', {});
    const alvo = el('div', { class: 'fs-sm muted mb-3' });
    const flatSel = el('select', { class: 'select', style: { width: 'auto' } }, [
      el('option', { value: 'auto' }, 'Bemois automatico'),
      el('option', { value: 'sharps' }, 'Usar oficiais'),
      el('option', { value: 'flats' }, 'Usar bemois'),
    ]);
    function flatPara(pc) {
      const modo = flatSel.value;
      if (modo === 'sharps') return false;
      if (modo === 'flats') return true;
      return M.useFlatsFor(pc);
    }
    function render() {
      const txt = M.transposeCifra(original, semis, flatPara(M.mod12(semis)));
      const k = M.detectKey(txt);
      const chords = M.extractChords(txt);
      U.clear(alvo); U.clear(saida);
      if (chords.length) {
        const nomes = Array.from(new Set(chords.map(function (x) { return x.text; }))).join(' - ');
        const knome = k ? (M.noteName(k.pc, M.useFlatsFor(k.pc)) + (k.mode === 'minor' ? 'm' : '')) : '?';
        alvo.textContent = 'Novo tom: ' + knome + '   -   acordes: ' + nomes;
      }
      saida.appendChild(R.cifraBox(txt));
      UI.icons(saida);
    }
    const bar = el('div', { class: 'semitone-bar mb-3' }, [
      el('button', { class: 'semitone', onclick: function () { semis -= 12; render(); } }, '-8'),
      el('button', { class: 'semitone', onclick: function () { semis -= 3; render(); } }, '-3'),
      el('button', { class: 'semitone', onclick: function () { semis--; render(); } }, '-1'),
      el('button', { class: 'semitone', onclick: function () { semis = 0; render(); } }, '0'),
      el('button', { class: 'semitone', onclick: function () { semis++; render(); } }, '+1'),
      el('button', { class: 'semitone', onclick: function () { semis += 3; render(); } }, '+3'),
      el('button', { class: 'semitone', onclick: function () { semis += 12; render(); } }, '+8'),
    ]);
    flatSel.addEventListener('change', render);

    const h = UI.sheet({
      title: 'Transpor', sub: c.titulo, wide: true,
      body: el('div', {}, [bar, alvo, flatSel, saida]),
      foot: [
        el('button', { class: 'btn btn-secondary', onclick: function () { h.close(); } }, 'Cancelar'),
        el('button', { class: 'btn btn-secondary', onclick: function () {
          U.copy(M.transposeCifra(original, semis, flatPara(M.mod12(semis))))
            .then(function () { UI.toast('Cifra transposta copiada', { tipo: 'ok' }); });
        } }, [el('i', { 'data-lucide': 'copy' }), 'Copiar']),
        el('button', { class: 'btn btn-primary', onclick: function () {
          const txt = M.transposeCifra(original, semis, flatPara(M.mod12(semis)));
          const k = M.detectKey(txt);
          h.close();
          editar(Object.assign({}, c, { cifra: txt, tom: k ? M.noteName(k.pc, M.useFlatsFor(k.pc)) : c.tom }));
        } }, [el('i', { 'data-lucide': 'check' }), 'Aplicar']),
      ],
    });
    render();
  }

  V.repertorio = { render: render, novo: novo, editar: editar, colar: colar, abrirCifra: abrirCifra, transpor: function () { dialogTranspor({ titulo: '', cifra: '' }); } };
})(typeof window !== 'undefined' ? window : globalThis);