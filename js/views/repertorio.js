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
  /* Quantas cifras ja foram desenhadas. Volta a 100 a cada filtro novo: quem
     filtra esta procurando do comeco, e recomecar de onde parou antes esconde
     justamente o que a pessoa esta procurando. */
  let mostrar = 100;

  function render(root, params) {
    if (params && params.aba) aba = params.aba;
    if (params && params.tom) { filtro.tom = params.tom; aba = 'minhas'; }
    if (params && params.importar) { aba = 'base'; setTimeout(function () { importarDaBase(params.importar); }, 90); }
    if (params && params.acao === 'colar') setTimeout(colar, 120);
    if (params && params.id) { const c = S.cifraPorId(params.id); if (c) setTimeout(function () { abrirCifra(c); }, 90); }

    U.clear(root);
    root.appendChild(el('div', { class: 'page-head' }, el('div', { class: 'row between' }, [
      el('div', {}, [el('h1', {}, 'Repertório'), el('div', { class: 'sub' }, 'Sua biblioteca de cifras')]),
      el('button', { class: 'btn btn-primary btn-sm', onclick: novo }, [el('i', { 'data-lucide': 'plus' }), 'Nova']),
    ])));

    root.appendChild(el('div', { class: 'tabs' }, [
      abaBtn('minhas', 'Minhas cifras', 'library'),
      abaBtn('base', 'Repertório pronto', 'book-open'),
    ]));

    root.appendChild(aba === 'minhas' ? painelMinhas() : painelBase());
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

  /** Recomeca a lista do principio. Para usar quando o filtro muda. */
  function recarregarDoInicio() {
    mostrar = POR_PAGINA;
    recarregar();
  }

  /* =======================
     MINHAS CIFRAS
     ======================= */
  function painelMinhas() {
    const wrap = el('div', {});
    const busca = el('input', { class: 'input', value: filtro.q, placeholder: 'Buscar por título, artista ou letra...' });
    const limpar = el('button', { class: 'clear-btn', 'aria-label': 'Limpar' }, el('i', { 'data-lucide': 'x' }));
    const gi = el('div', { class: 'input-group' + (filtro.q ? ' has-value' : '') }, [el('i', { 'data-lucide': 'search' }), busca, limpar]);
    busca.addEventListener('input', U.debounce(function () {
      filtro.q = busca.value;
      gi.classList.toggle('has-value', !!busca.value);
      // Filtrar recomeca a lista: quem digita esta procurando a cifra desde o
      // inicio, e recomecar de onde a rolagem parou esconderia o resultado.
      mostrar = POR_PAGINA;
      pintar();
    }, 150));
    limpar.addEventListener('click', function () {
      busca.value = ''; filtro.q = ''; gi.classList.remove('has-value');
      mostrar = POR_PAGINA;
      pintar();
    });
    wrap.appendChild(gi);

    const tons = S.tons().sort();
    const cats = S.categorias();
    if (tons.length || cats.length) {
      const chips = el('div', { class: 'chips chips-scroll mt-3' });
      chips.appendChild(el('button', {
        class: 'chip', 'aria-pressed': String(!filtro.tom && !filtro.categoria),
        onclick: function () { filtro.tom = ''; filtro.categoria = ''; recarregarDoInicio(); },
      }, 'Todos'));
      tons.forEach(function (t) {
        chips.appendChild(el('button', { class: 'chip', 'aria-pressed': String(filtro.tom === t),
          onclick: function () { filtro.tom = filtro.tom === t ? '' : t; recarregarDoInicio(); } }, t));
      });
      cats.forEach(function (c) {
        chips.appendChild(el('button', { class: 'chip', 'aria-pressed': String(filtro.categoria === c),
          onclick: function () { filtro.categoria = filtro.categoria === c ? '' : c; recarregarDoInicio(); } }, c));
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

    /**
     * Quantas cifras a tela desenha de uma vez.
     *
     * Medido: com 2.000 cifras, a lista inteira virava 24.607 nós no DOM e
     * 147.000 px de altura. No celular isso derruba o rolagem — e o pior não é
     * a lentidão, é que a pessoa precisa rolar por 2.000 itens para chegar na
     * 2.001ª, sem nenhuma ideia de quantas faltam.
     *
     * Cem por página. Abaixo disso a rolagem parece infinita; acima disso, quem
     * tem repertório grande passa a esperar o app desenhar para poder rolar.
     */
  const POR_PAGINA = 100;

  function pintar() {
      U.clear(box);
      const itens = S.filtrarCifras(filtro);
      const total = S.cifras().length;
      info.textContent = itens.length === total
        ? U.plural(total, 'cifra')
        : itens.length + ' de ' + U.plural(total, 'cifra');
      if (!itens.length) {
        box.appendChild(UI.empty({
          icon: total ? 'search-x' : 'library',
          title: total ? 'Nada encontrado' : 'Repertório vazio',
          message: total ? 'Ajuste a busca ou os filtros.'
            : 'Guarde aqui as cifras que você usa sempre. Depois é só puxar para qualquer escala.',
          action: total ? null : { label: 'Criar primeira cifra', icon: 'plus', onClick: novo },
        }));
        return;
      }

      /* A busca e a paginacao andam juntas: filtrar recomeca do principio, que
       * e o que a pessoa espera — quem filtra esta procurando do comeco. */
      const quantos = Math.min(itens.length, mostrar);
      const grid = el('div', { class: 'lista-cifras' });
      for (let i = 0; i < quantos; i++) grid.appendChild(cartaoCifra(itens[i]));
      box.appendChild(grid);

      /* O rodape da lista: quantas faltam e o botao que carrega. Sem ele, quem
       * tem 300 cifras so descobre que a lista acaba rolando ate o fim — e
       * rolar 300 itens na mao para descobrir que faltam mais e o que faz a
       * pessoa achar que o app perdeu as cifras. */
      if (quantos < itens.length) {
        const faltam = itens.length - quantos;
        box.appendChild(el('div', { class: 'lista-rodape' }, [
          el('button', { class: 'btn btn-secondary btn-block', onclick: function () {
            mostrar = Math.min(itens.length, mostrar + POR_PAGINA);
            pintar();
            // Volta ao topo da lista: carregar mais enquanto a pessoa esta
            // lendo a ultima linha visivel faz a lista pular embaixo do dedo.
            const topo = box.querySelector('.lista-cifras');
            if (topo) topo.scrollIntoView({ block: 'start', behavior: 'smooth' });
          } }, [el('i', { 'data-lucide': 'chevrons-down' }),
            'Carregar mais ' + Math.min(POR_PAGINA, faltam) + ' de ' + faltam + ' restantes']),
          el('div', { class: 'fs-xs muted center mt-2' },
            quantos + ' de ' + itens.length + ' cifras' + (itens.length !== total ? ' neste filtro' : '')),
        ]));
      }

      UI.icons(box);
    }
    pintar();
    return wrap;
  }

  /**
   * A ficha completa de cada item da lista.
   *
   * Antes o cartao mostrava titulo, artista e BPM. O resto da ficha — o video
   * do YouTube, a faixa narrada, as anotacoes com hora — existia no app mas
   * nao aparecia aqui. Quem montava o repertorio nao conseguia ver o que ja
   * tinha pronto: pegava a musica na ultima escala e so descobria entao que o
   * video estava salvo.
   *
   * Cada peca da ficha vira um icone. Sem icone, o que falta nao aparece; e
   * justamente o que falta que a pessoa precisa saber antes de levar o time.
   */
  function cartaoCifra(c) {
    const ficha = S.fichaDaCifra(c);
    return el('button', { class: 'song-card', onclick: function () { abrirCifra(c); } }, [
      // O tom vira coluna. Em uma lista, a coluna alinhada e o que permite
      // varrer os tons de relance — o que a grade de caixas nunca permite.
      // Sem tom, o espaco fica tracejado em vez de sumir: a coluna tem que
      // manter a mesma largura em todas as linhas, senao os tons desalinham.
      el('span', { class: 'tom-col' + (c.tom ? '' : ' vazio') }, c.tom || '?'),
      el('div', { class: 'meio' }, [
        el('div', { class: 'n' }, c.titulo),
        el('div', { class: 'sub' }, [
          el('span', { class: 'a' }, c.artista || '—'),
          el('span', { class: 'foot' }, [
            c.bpm ? el('span', { class: 'badge' }, c.bpm + ' bpm') : null,
            c.compasso && c.compasso !== '4/4' ? el('span', { class: 'badge' }, c.compasso) : null,
            c.categoria ? el('span', { class: 'badge badge-brand' }, c.categoria) : null,
          ]),
        ]),
        marcadoresDaFicha(ficha),
      ]),
    ]);
  }

  /**
   * Os icones do que a ficha ja tem.
   *
   * Nenhum e clicavel aqui: sao leitura. Clicar no cartao abre a ficha, e e o
   * que a pessoa quer ao tocar num item da lista.
   */
  function marcadoresDaFicha(f) {
    const marcas = [];
    if (f.ytId) marcas.push(['youtube', 'Vídeo do YouTube', '#FF0000']);
    if (f.vs) marcas.push(['audio-lines', 'Narração gravada', '']);
    if (f.foto) marcas.push(['image', 'Foto da cifra', '']);
    if (f.anotacoes && f.anotacoes.length) marcas.push(['list-music', U.plural(f.anotacoes.length, 'anotação'), '']);
    if (!marcas.length) return null;
    return el('div', { class: 'marcas' }, marcas.map(function (m) {
      return el('span', { class: 'marca', title: m[1], 'aria-label': m[1] },
        el('i', { 'data-lucide': m[0], style: m[2] ? { color: m[2] } : {} }));
    }));
  }

  /* =======================
     REPERTORIO PRONTO
     ======================= */
  function painelBase() {
    const wrap = el('div', {});
    const base = global.BASE ? global.BASE.list : [];
    wrap.appendChild(el('div', { class: 'card card-flat mb-3', style: { background: 'var(--brand-tint)', borderColor: 'transparent' } }, [
      el('div', { class: 'row gap-2' }, [
        el('i', { 'data-lucide': 'info', style: { width: '17px', height: '17px', color: 'var(--primary)', flex: 'none' } }),
        el('p', { class: 'fs-sm c-2' }, 'Cifras de referência para começar. Variam entre grupos e edições — confira e ajuste antes de usar. Ao importar, a cifra vem editável para o seu repertório.'),
      ]),
    ]));
    if (!base.length) {
      wrap.appendChild(UI.empty({ icon: 'book-open', title: 'Nenhuma cifra carregada' }));
      return wrap;
    }
    const grid = el('div', { class: 'lista-cifras' });
    base.forEach(function (h) {
      grid.appendChild(el('button', { class: 'song-card', onclick: function () { abrirDaBase(h); } }, [
        el('span', { class: 'tom-col' + (h.tom ? '' : ' vazio') }, h.tom || '?'),
        el('div', { class: 'meio' }, [
          el('div', { class: 'n' }, h.titulo),
          el('div', { class: 'sub' }, [
            el('span', { class: 'a' }, h.artista || '—'),
            el('span', { class: 'foot' }, [
              h.bpm ? el('span', { class: 'badge' }, h.bpm + ' bpm') : null,
              el('span', { class: 'badge badge-brand' }, h.categoria),
            ]),
          ]),
        ]),
      ]));
    });
    wrap.appendChild(grid);
    UI.icons(wrap);
    return wrap;
  }

  function abrirDaBase(h) {
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
        el('button', { class: 'btn btn-primary', onclick: function () { UI.closeAllSheets(); importarDaBase(h.id); } },
          [el('i', { 'data-lucide': 'download' }), 'Importar']),
      ],
    });
  }

  function importarDaBase(id) {
    const h = global.BASE && global.BASE.byId(id);
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
     A MESA DE ENSAIO A PARTIR DA CIFRA
     ======================= */
  function abrirMesaDeCifra(c) {
    const Mesa = global.Views && global.Views.palco;
    if (!Mesa || typeof Mesa.abrirDeCifra !== 'function') {
      UI.toast('Mesa de ensaio indisponível', { tipo: 'err' });
      return;
    }
    Mesa.abrirDeCifra(c);
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
        el('div', { class: 'row gap-2 wrap' }, [
          el('span', { class: 'fs-sm grow' }, 'Tom detectado: ' + M.noteName(k.pc, M.useFlatsFor(k.pc)) + (k.mode === 'minor' ? ' menor' : ' maior')),
          // Ouvir o tom detectado. Uma cifra diz o tom; ela nao faz o
          // ouvido aceitar. E e aqui que a duvida aparece: "esta musica e
          // em La menor mesmo?" so se responde ouvindo.
          R.botaoTom(k.pc, k.mode, null, { mini: true, oitava: 3 }),
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

    /* ---- o que a ficha ja tem, e o que falta ----
       Quem abre uma cifra pergunta "esta pronta para o ensaio?". A resposta
       esta no video, na narração e nas anotacoes — e nada disso aparecia.
       A lista mostra o que existe; o que falta vem logo abaixo, como acao. */
    const partes = [];
    if (v.ytId) partes.push('vídeo');
    if (v.vs) partes.push('narração gravada');
    if (v.foto) partes.push('foto');
    if (v.anotacoes && v.anotacoes.length) partes.push(U.plural(v.anotacoes.length, 'anotação'));
    body.appendChild(el('div', { class: 'fs-sm muted' },
      partes.length ? 'Pronto para o palco: ' + partes.join(' · ') : 'Nada gravado ainda: sem vídeo, narração ou anotações.'));
    if (v.letra) {
      body.appendChild(el('div', {}, [
        el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'align-left' }), 'Letra']),
        el('pre', { class: 'cifra-text lyric', style: { whiteSpace: 'pre-wrap' } }, v.letra),
      ]));
    }
    // A rolagem substitui a caixa solta: no celular, uma cifra inteira num
    // bloco so e um papel de parede. Com a janela rolavel, a linha que vem
    // fica sempre no mesmo lugar — e a diferenca entre acompanhar a musica e
    // procurar o proximo acorde com o olho.
    //
    // O estado de estudo e guardado por cifra. Esconder tres versos para
    // decorar, fechar o app e voltar e ver tudo de novo nao e um recurso.
    // A gravacao vai no objeto do STORE, e nao em `v`.
    //
    // `v` e uma copia rasa da cifra, feita para editar sem sujar o original.
    // Escrever nela parecia funcionar — a tela atualizava na hora — mas o
    // estado sumia ao fechar: a copia morre junto com a janela. O sintoma era
    // silencioso e o unico jeito de ver era fechar, reabrir e olhar.
    //
    // Pegar o objeto pelo id a cada gravacao evita ainda o outro erro: usar o
    // `c` da chamada e gravar num objeto que o store ja substituiu.
    function alvo() { return S.cifraPorId(c.id) || null; }
    function gravarEstudo(est) {
      const a = alvo();
      if (!a) return;
      a.estudo = S.normEstudo(est);
      S.mudou('cifra');
    }
    function gravarVelocidade(f) {
      const a = alvo();
      if (!a) return;
      a.estudo = Object.assign({}, S.normEstudo(a.estudo), { velocidade: f });
      S.mudou('cifra');
    }
    const rolagem = v.cifra.trim() ? R.painelRolagem(v.cifra, {
      bpm: v.bpm,
      compasso: v.compasso,
      fator: v.estudo && v.estudo.velocidade ? v.estudo.velocidade : 1,
      estudo: v.estudo,
      onEstudo: gravarEstudo,
      onEstudoVelocidade: gravarVelocidade,
    }) : null;
    if (rolagem) body.appendChild(rolagem); else body.appendChild(R.cifraBox(v.cifra));

    const k = M.detectKey(v.cifra);
    if (k) {
      const analise = R.chordAnalysis(v.cifra, k.pc, k.mode);
      if (analise) body.appendChild(el('div', { class: 'mt-2' }, analise));
    }

    /* ---- A MESA DE ENSAIO ----
       O botao que junta o que estava espalhado: o video, a voz que guia o
       ensaio, o compasso, a rolagem da cifra e as anotacoes com hora. E o que
       separa "a cifra esta salva" de "esta musica esta pronta para o palco".
       Sem ele, quem montava o ensaio tinha de abrir o Estúdio, o gravador e a
       agenda — tres telas — para juntar o que aqui esta na mesma.

       A folha fecha antes de abrir a mesa: as duas sao folhas, e duas folhas
       empilhadas significam que o fundo escuro de uma tapa a outra. */
    let h = null;
    body.appendChild(el('div', { class: 'card card-flat mt-3', style: { background: 'var(--brand-tint)', borderColor: 'transparent' } }, [
      el('div', { class: 'row between gap-2 wrap' }, [
        el('div', { class: 'grow', style: { minWidth: '0' } }, [
          el('div', { class: 'fs-sm fw-7' }, 'Mesa de ensaio'),
          el('div', { class: 'fs-xs muted' }, 'Vídeo, narração, compasso, cifra e anotações juntos'),
        ]),
        el('button', { class: 'btn btn-primary btn-sm', onclick: function () {
          h.close();
          abrirMesaDeCifra(c);
        } }, [el('i', { 'data-lucide': 'monitor-play' }), 'Abrir a mesa']),
      ]),
    ]));

    /* ---- a foto e o desenho ----
       *
       * A foto vivia so na pagina da musica (cancao.js). O efeito era que uma
       * cifra da biblioteca podia ter foto gravada, passar pelo upload, o
       * preview, a substituicao e a persistencia — e nao ter ONDE VER. Nem a
       * foto, nem o Estudio, que so existe junto dela. O registro tinha o
       * campo; a tela nao tinha nada com o campo.
       *
       * Aqui nao ha uma segunda implementacao da foto: o bloco e o de la,
       * publicada. Uma segunda copia aqui seria mais uma coisa para consertar
       * quando a foto mudar de lugar — e as duas ja teriam divergido.
       *
       * E o registro que entra aqui e o VERDEIRO, resolvido pelo id no
       * armazenamento. `v`, logo acima, e uma copia — existe so para desenhar
       * os campos. Passar `v` ao bloco faria o Estudio escrever num objeto que
       * ninguem persiste: a foto trocaria na tela e voltaria no proximo
       * carregamento, sem aviso nenhum. */
    const registro = (c && c.id && S.db.cifras.find(function (x) { return x.id === c.id; })) || c;
    if (registro && registro.foto && V.cancao && V.cancao.blocoFoto) {
      body.appendChild(V.cancao.blocoFoto(registro, null, function () { S.mudou('cifra'); }));
    }

    /* O documento aparece aqui como o que e: um arquivo guardado, que se abre
       fora. Nao ha visualizador proprio — o navegador ja sabe abrir PDF, e
       um quadro com `data:` nao e confiavel no celular. */
    if (c.doc) {
      body.appendChild(el('div', { class: 'field mt-4' }, [
        el('div', { class: 'label' }, 'Documento'),
        el('div', { class: 'row gap-2 between wrap' }, [
          el('div', { class: 'grow', style: { minWidth: '0' } }, [
            el('div', { class: 'fw-7 ellipsis' }, c.doc.nome),
            el('div', { class: 'fs-xs muted' },
              (c.doc.tipo === 'application/pdf' ? 'PDF' : 'Texto') + ' · '
              + U.fmtBytes(Math.round(c.doc.dados.length * 0.75))),
          ]),
          el('button', { class: 'btn btn-secondary btn-sm', onclick: function () {
            U.entregarArquivo(U.dataURLParaArquivo(c.doc.dados, c.doc.nome), c.doc.nome);
          } }, [el('i', { 'data-lucide': 'external-link' }), 'Abrir documento']),
        ]),
      ]));
    }
    body.appendChild(el('div', { class: 'row gap-2 mt-4 wrap' }, [
      el('button', { class: 'btn btn-soft btn-sm', onclick: function () { dialogTranspor(c); } },
        [el('i', { 'data-lucide': 'shuffle' }), 'Transpor']),
      el('button', { class: 'btn btn-soft btn-sm', onclick: function () { U.copy(v.cifra).then(function () { UI.toast('Cifra copiada', { tipo: 'ok' }); }); } },
        [el('i', { 'data-lucide': 'copy' }), 'Copiar']),
      el('button', { class: 'btn btn-soft btn-sm', onclick: function () { UI.print(printCifra(c)); } },
        [el('i', { 'data-lucide': 'printer' }), 'Imprimir']),
    ]));

    /* ---- os links externos ----
       Ficavam no fim da folha, depois da cifra inteira. Quem abre a ficha
       queria saber onde achar a letra e o video antes de ler os acordes — a
       lista de links era o que justificava a visita. Aqui fica no topo. */
    body.appendChild(el('div', { class: 'mt-3' }, [
      el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'link' }), 'Onde achar']),
      el('div', { class: 'row gap-2 wrap' }, Lk.de(v.titulo, v.artista).map(function (f) {
        return el('button', { class: 'st-link', style: { '--c': f.cor }, title: f.descricao,
          onclick: function () { Lk.abrir(f.id, v.titulo, v.artista); } },
          [el('i', { 'data-lucide': f.icone }), el('span', {}, f.curto)]);
      })),
    ]));

    h = UI.sheet({
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
      message: 'Excluir "' + c.titulo + '"? As escalas que já a usaram continuam com a música.',
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

    /* `isNew` tira o "Sem título" do campo.
     *
     * `normCifra` põe "Sem título" quando o titulo vem vazio — uma rede de
     * seguranca para um registro que chegou de fora, para que nada apareça sem
     * nome na biblioteca. Até aqui essa rede estava boa.
     *
     * O problema e que o FORMULARIO pegava esse valor de guarda e botava no
     * campo como se a pessoa tivesse digitado. Consequencia: o botao "Salvar" com o
     * titulo vazio NAO era recusado — havia "Sem título" no lugar — e a marca de
     * obrigatório era mentira: dava para guardar uma musica chamada "Sem
     * título" sem escrever nada.
     *
     * Numa musica nova o campo nasce VAZIO, com o exemplo no placeholder. Numa
     * musica que ja existe, o titulo guardado e valor de verdade e vai como
     * valor. O "Sem título" continua existindo em `normCifra` para o registro
     * importado, e as musicas antigas que o tem continuam com ele: nada aqui
     * apaga titulo de ninguem. */
    const fTitulo = el('input', {
      class: 'input', value: isNew ? '' : v.titulo,
      placeholder: 'Ex.: O Senhor e o Meu Pastor',
      'aria-required': 'true', 'aria-describedby': 'erro-titulo-cifra',
    });

    /* O aviso do titulo.
     *
     * Antes, deixar o titulo vazio e salvar nao fazia nada visivel: o formulario
     * ficava aberto e o foco ia para o campo, sem uma palavra. Para quem ve, o
     * botao simplesmente nao funcionava — e a unica forma de descobrir o motivo
     * era adivinhar.
     *
     * O aviso fica DEBAIXO do campo, e nao num `toast`: um aviso que some
     * sozinho ainda deixa a pessoa sem motivo assim que ela voltar os olhos
     * para o formulario. `role="alert"` e `aria-describedby` fazem o texto ser
     * lido com o campo, e nao so visto. */
    const erroTitulo = el('div', {
      class: 'fs-xs mt-1', id: 'erro-titulo-cifra', role: 'alert',
      style: { display: 'none', color: 'var(--danger-500)' },
    });
    function avisarTitulo() {
      const vazio = !fTitulo.value.trim();
      erroTitulo.textContent = vazio ? 'Informe o título da música.' : '';
      erroTitulo.style.display = vazio ? 'block' : 'none';
      if (vazio) fTitulo.setAttribute('aria-invalid', 'true');
      else fTitulo.removeAttribute('aria-invalid');
    }
    /* O aviso some assim que a pessoa corrige, sem precisar salvar de novo. */
    fTitulo.addEventListener('input', avisarTitulo);
    const fArtista = el('input', { class: 'input', value: v.artista, placeholder: 'Ex.: Claudio Bassés' });
    const fTom = R.selectTon({ value: v.tom, placeholder: 'Tom' });
    const fBpm = el('input', { class: 'input', type: 'number', min: '20', max: '320', value: v.bpm || '', placeholder: 'BPM' });
    const fComp = el('select', { class: 'select' }, global.Metro.COMPASSOS.map(function (c2) {
      return el('option', { value: c2.n, selected: (v.compasso || '4/4') === c2.n }, c2.n);
    }));
    const fCat = el('input', { class: 'input', value: v.categoria, placeholder: 'Ex.: Entrada' });
    const fTags = el('input', { class: 'input', value: v.tags.join(', '), placeholder: 'Ex.: paz, consolo' });
    const fLetra = el('textarea', { class: 'textarea', placeholder: 'Cole a letra aqui (opcional)' });
    fLetra.value = v.letra;
    const fCifra = el('textarea', { class: 'textarea mono', style: { minHeight: '240px' }, placeholder: '[C]\nO Senhor e o meu pastor\nC        G\nNada me faltara\nAm   F   C' });
    fCifra.value = v.cifra;
    const status = el('div', { class: 'fs-sm muted mt-2' });

    /* ---- a ficha do ensaio ----
       Antes estes campos viviam so dentro de uma escala, e so apareciam na tela
       da musica. Quem cadastrava a cifra no repertorio e depois a usava em
       varios eventos tinha de colar o video e gravar a naracao de novo em
       cada uma. Aqui eles fazem parte da cifra, e o que ja foi gravado e
       reaproveitado. */
    const fYt = el('input', { class: 'input', value: v.yt || '', placeholder: 'https://youtu.be/...' });
    const infoYt = el('div', { class: 'fs-xs muted mt-1' });
    function conferirYt() {
      const id = Lk.extrairYouTubeId(fYt.value.trim());
      U.clear(infoYt);
      if (!fYt.value.trim()) { infoYt.textContent = ''; return; }
      infoYt.textContent = id
        ? 'Vídeo reconhecido: ' + id
        : 'Não reconheci esse link. Aceita youtube.com/watch, youtu.be, /shorts ou /live.';
      fYt.style.borderColor = id ? '' : 'var(--danger-500)';
    }
    fYt.addEventListener('input', U.debounce(conferirYt, 350));
    conferirYt();

    const previewFoto = el('img', { class: 'pl-foto-preview' });
    let foto = v.foto || '';
    function pintarFoto() {
      U.clear(previewFoto);
      if (foto) { previewFoto.src = foto; previewFoto.style.display = 'block'; }
      else previewFoto.style.display = 'none';
    }
    pintarFoto();
    const arqFoto = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    arqFoto.addEventListener('change', function () {
      const a = arqFoto.files[0];
      if (!a) return;
      U.readFile(a, true).then(function (d) { return U.shrinkImage(d, 1400, 0.8); })
        .then(function (p) {
          // Vazio aqui e "nao deu para ler". Sem a conferencia, um arquivo
          // recusado viraria `src=""` — um retangulo quebrado, sem explicacao.
          if (!p) { UI.toast('Não deu para ler a imagem', { tipo: 'err' }); return; }
          foto = p; pintarFoto();
        })
        .catch(function () { UI.toast('Não deu para ler a imagem', { tipo: 'err' }); });

      arqDoc.addEventListener('change', function () {
        const a = arqDoc.files[0];
        if (!a) return;
        U.readFile(a, true).then(function (d) {
          /* Quem decide e o modelo, nao este campo. Aqui so se avisa, para a
             pessoa nao ficar com "anexou" e nada ter acontecido. */
          const guardado = S.normCifra({ doc: { nome: a.name, dados: d } }).doc;
          if (!guardado) {
            UI.toast('Só entram PDF e texto, até 1 MB', { tipo: 'err' });
            return;
          }
          doc = guardado; pintarDoc();
        });
    });
      });

    const infoNar = el('div', { class: 'fs-xs muted mt-1' },
      v.vs ? 'Narração gravada (' + global.Gravador.relogio(v.vsSeg) + '). Regrave na Mesa de ensaio.' : 'Você grava a narração na Mesa de ensaio.');

    function analisar() {
      U.clear(status);
      const txt = fCifra.value;
      if (!txt.trim()) return;
      const chords = M.extractChords(txt);
      if (!chords.length) { status.textContent = 'Nenhum acorde reconhecido ainda.'; return; }
      const k = M.detectKey(txt);
      const nomes = Array.from(new Set(chords.map(function (c) { return c.text; }))).join(' - ');
      const knome = k ? (M.noteName(k.pc, M.useFlatsFor(k.pc)) + (k.mode === 'minor' ? 'm' : '')) : '?';
      status.textContent = U.plural(chords.length, 'acorde') + ' (' + nomes + ')'
        + (k ? '  -  tom sugerido: ' + knome : '');
    }
    fCifra.addEventListener('input', U.debounce(analisar, 300));
    analisar();


    /* ---- o documento ----
    *
    * UM documento por musica, ao lado da foto, e pela mesma razao: a mesma
    * musica pode estar em varios repertorios. Aceita PDF e texto — os dois
    * que o navegador abre sozinho. O resto e recusado aqui E no modelo,
    * porque um `data:text/html` devolvido num quadro executa script na
    * origem do app.
    */
    let doc = v.doc || null;
    const infoDoc = el('div', { class: 'fs-sm' });
    function pintarDoc() {
    U.clear(infoDoc);
    if (!doc) {
    infoDoc.appendChild(el('span', { class: 'muted' }, 'Nenhum documento anexado.'));
    return;
    }
    infoDoc.appendChild(el('div', { class: 'row gap-2 between wrap' }, [
    el('div', { class: 'grow', style: { minWidth: '0' } }, [
    el('div', { class: 'fw-7 ellipsis' }, doc.nome),
    el('div', { class: 'fs-xs muted' },
    (doc.tipo === 'application/pdf' ? 'PDF' : 'Texto') + ' · '
    + U.fmtBytes(Math.round(doc.dados.length * 0.75))),
    ]),
    el('button', { class: 'btn btn-secondary btn-sm', onclick: function () {
    U.entregarArquivo(U.dataURLParaArquivo(doc.dados, doc.nome), doc.nome);
    } }, [el('i', { 'data-lucide': 'download' }), 'Abrir']),
    el('button', { class: 'btn btn-secondary btn-sm', onclick: function () {
    doc = null; pintarDoc();
    } }, [el('i', { 'data-lucide': 'x' }), 'Remover']),
    ]));
    }
    pintarDoc();
    const arqDoc = el('input', {
    type: 'file', accept: 'application/pdf,text/plain,.pdf,.txt', style: { display: 'none' },
    });

    const h = UI.sheet({
      title: isNew ? 'Nova cifra' : 'Editar cifra', wide: true,
      body: el('div', { class: 'stack gap-3' }, [
        el('div', { class: 'field' }, [
          el('label', { class: 'label' }, 'Título *'),
          fTitulo,
          erroTitulo,
        ]), campo('Artista', fArtista),
        el('div', { class: 'grid-3' }, [campo('Tom', fTom), campo('BPM', fBpm), campo('Compasso', fComp)]),
        el('div', { class: 'grid-2' }, [campo('Categoria', fCat), campo('Tags', fTags)]),
        campo('Letra', fLetra),
        campo('Cifra', el('div', {}, [fCifra, status])),
        el('div', { class: 'hr-label' }, 'Para o ensaio'),
        campo('Vídeo do YouTube', el('div', {}, [fYt, infoYt])),
        campo('Foto da cifra', el('div', { class: 'stack gap-2' }, [
        el('div', { class: 'field' }, [
          el('div', { class: 'label' }, 'Documento'),
          infoDoc,
          el('button', { class: 'btn btn-secondary btn-sm mt-2', onclick: function () { arqDoc.click(); } },
            [el('i', { 'data-lucide': 'paperclip' }), 'Anexar documento']),
        ]),
          previewFoto,
          el('div', { class: 'row gap-2' }, [
            el('button', { class: 'btn btn-secondary btn-sm', onclick: function () { arqFoto.click(); } },
              [el('i', { 'data-lucide': 'upload' }), foto ? 'Trocar foto' : 'Enviar foto']),
            foto ? el('button', { class: 'btn btn-ghost btn-sm', onclick: function () { foto = ''; pintarFoto(); } },
              [el('i', { 'data-lucide': 'trash-2' }), 'Remover']) : null,
          ].filter(Boolean)),
          arqFoto,
        ])),
        campo('Narração', infoNar),
      ]),
      foot: [
        el('button', { class: 'btn btn-secondary', onclick: function () { h.close(); } }, 'Cancelar'),
        el('button', { class: 'btn btn-success', onclick: function () {
          const titulo = fTitulo.value.trim();
          /* `trim` antes de decidir: "   " nao e um titulo, e sem o aparar o
             botao aceitaria tres espacos e guardaria uma musica invisivel na
             biblioteca. O mesmo `trim` ja e aplicado no valor gravado logo
             abaixo, entao aqui e na hora do corte o comportamento bate. */
          if (!titulo) { avisarTitulo(); fTitulo.focus(); return; }
          avisarTitulo();
          v.titulo = titulo;
          v.artista = fArtista.value.trim();
          v.tom = fTom.value;
          v.bpm = fBpm.value ? parseInt(fBpm.value, 10) : '';
          v.compasso = fComp.value;
          v.categoria = fCat.value.trim();
          v.tags = fTags.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 20);
          v.letra = fLetra.value;
          v.cifra = fCifra.value;

          /* ---- a ficha do ensaio ----
             O id do YouTube e extraido do link aqui, e nao ao gravar. O campo
             fica como a pessoa colou, que e o que ela reconhece depois; o id
             derivado e que a mesa usa para montar o video. Guardar so o id
             perderia o link original, que e o que permite trocar de gravacao
             depois sem colar tudo de novo. */
          v.yt = fYt.value.trim();
          v.ytId = Lk.extrairYouTubeId(v.yt);
          v.foto = foto;
    v.doc = doc;

          v.atualizadaEm = Date.now();

          /* ---- renormaliza ANTES de guardar ----
             *
             * Este formulario escreve os campos direto no objeto, e o objeto vai
             * cru para `S.db.cifras`. Nele, tres garantias que o modelo declara
             * simplesmente nao existem:
             *
             *   - o BPM respeita `min`/`max` — que este mesmo campo de entrada
             *     anuncia com os atributos `min="20" max="320"`. Sao atributos de
             *     `<input number>`, e atributo so e validado no envio de um
             *     `<form>`. O botao "Salvar" e um `onclick`, entao o navegador
             *     nunca checa: "9999" entrava e a mesa abria com 9999.
             *   - o titulo respeita 160 caracteres, o artista 160, a categoria
             *     40 e o tom 12. Um titulo de 240 era gravado com 240.
             *   - qualquer campo invalido que chegue por outro caminho
             *     (importacao, backup antigo) e recusado do mesmo jeito.
             *
             * `normCifra` e o unico lugar do projeto que declara esses limites,
             * e ele ja era chamado na CRIACAO — com os campos do formulario
             * ainda vazios, o que nao valia nada. Chama-lo aqui e o que faz a
             * edicao passar pelas mesmas garantias da criacao.
             *
             * E seguro para o resto do registro: renormalizar uma cifra ja
             * normalizada nao muda NENHUM campo — nem `vs`, nem `foto`, nem
             * `vsCap`, nem `anotacoes`, nem `estudo`, nem `id`, nem `criadoEm`.
             * Isso foi medido, e nao presumido. */
          const guardado = S.normCifra(v);

          if (isNew) S.db.cifras.unshift(guardado);
          else {
            const i = S.db.cifras.findIndex(function (x) { return x.id === guardado.id; });
            if (i >= 0) S.db.cifras[i] = guardado;
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
      if (!chords.length) { aviso.textContent = 'Não encontrei acordes. Confira a formatação.'; return; }
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
      el('option', { value: 'auto' }, 'Bemois automático'),
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
    // A barra e a mesma de Teoria, com passo de meio semitom.
    //
    // Antes eram sete botoes que SOMAVAM deslocamentos, mas rotulados como se
    // fossem valores absolutos: clicar em "+8" numa transposicao ja em +5
    // levava a +13, e o rotulo continuava dizendo +8. Duas vezes na mesma
    // tela — aqui e na barra de Teoria — o numero na tela e o numero que o
    // botao faz.
    const bar = R.transposeBar({
      valor: semis,
      onChange: function (v) { semis = v; render(); },
    });
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