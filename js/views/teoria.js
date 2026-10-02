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
  /* O braco comeca no que a pessoa escolheu em Ajustes.
   *
   * Antes esta linha era `inst: 'violão'`, com acento. O id do violao e
   * `'violao'`, sem: a busca caia no padrao por sorte e aparecia certo, e o
   * botao do instrumento selecionado nunca era marcado como ligado — a
   * pessoa apertava e nao via nada mudar. Nenhum dos dois sintomas aparece
   * em log nenhum. */
  const bracoEscolhido = (function () {
    const St = global.Store;
    const M = global.Music;
    if (!St || typeof St.ajuste !== 'function' || !M || typeof M.bracoPara !== 'function') {
      return null;
    }
    return M.bracoPara(St.ajuste('instrumento', 'violao'));
  })();
  let estAcorde = { root: 0, quality: '', inst: bracoEscolhido ? bracoEscolhido.id : 'violao' };
  let estEscala = { root: 0, scale: 'major', inst: bracoEscolhido ? bracoEscolhido.id : 'violao' };
  let estCifra = { texto: '', semis: 0 };

  /* O instrumento desta aba. E estado proprio, e nao `estAcorde.inst`, porque
   * as duas telas nao precisam concordar: em Acordes o instrumento escolhe
   * quais formas desenhar, e aqui ele escolhe o braco inteiro a mostrar. Se
   * compartilhassem, trocar de aba trocaria o braco de surpresa — e a pessoa
   * acharia que o app trocou o violao debaixo da mao dela. */
  let estInst = { inst: bracoEscolhido ? bracoEscolhido.id : 'violao' };

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
      ['circulo', 'Círculo', 'circle-dot'], ['transpor', 'Transpor', 'shuffle'],
      ['instrumento', 'Instrumento', 'guitar']];
    root.appendChild(el('div', { class: 'tabs' }, abas.map(function (a) {
      return el('button', { 'aria-selected': String(aba === a[0]), onclick: function () { aba = a[0]; recarregar(); } },
        [el('i', { 'data-lucide': a[2] }), a[1]]);
    })));
    const box = el('div', {});
    if (aba === 'acordes') box.appendChild(painelAcordes());
    else if (aba === 'escalas') box.appendChild(painelEscalas());
    else if (aba === 'circulo') box.appendChild(painelCirculo());
    else if (aba === 'instrumento') box.appendChild(painelInstrumento());
    else box.appendChild(painelTranspor());
    root.appendChild(box);
    UI.icons(root);
  }
  /** Solta os 3D desta pagina antes de trocar o conteudo.

   Cada traste ocupa um contexto WebGL, e o navegador entrega poucos. Trocar de
   acorde remonta a pagina inteira, entao sem isto cada troca deixaria um
   renderer pedido para sempre — e depois de algumas, o 3D deixaria de aparecer
   sem explicacao.

   A tela 3D tambem se guarda por conta propria (ela observa quando o no sai do
   documento). Esta chamada e a via rapida: nao espera o navegador avisar, e
   `destruir` e idempotente, entao as duas juntas nao quebram nada. */
  function soltarTraste(p) {
    if (!p || !p.querySelectorAll) return;
    const nos = p.querySelectorAll('.traste3d');
    for (const n of nos) {
      if (typeof n.destruir3d === 'function') {
        try { n.destruir3d(); } catch (e) { /* ja destruido */ }
      }
    }
  }

  function recarregar() {
    const p = document.getElementById('page-teoria');
    if (p && p.classList.contains('active')) {
      soltarTraste(p);
      render(p, {});
    }
  }

  /* =======================
     ACORDES
     ======================= */

/* =======================================================
     A PLACA DO ACORDE
     Nome, notas e som, no topo da pagina.

     A placa e clicavel e toca o acorde inteiro. Tocar as tres notas e a acao
     mais util de quem esta aprendendo a forma: da para ouvir se o que voce
     Dedilha e o que voce ouve, e comparar. Antes so existia ouvir a
     fundamental e a sua relativa menor, o que responde outra pergunta.
     ======================================================= */
  function placaDoAcorde(nome, info, flat) {
    const placa = el('button', {
      class: 'acorde-placa', type: 'button',
      'aria-label': 'Ouvir o acorde ' + nome,
      title: 'Ouvir ' + nome,
    });

    placa.appendChild(el('div', { class: 'ap-nome' }, nome));
    placa.appendChild(el('div', { class: 'ap-sub' }, info.full));

    const pills = el('div', { class: 'ap-notas' });
    info.notes.forEach(function (pc, k) {
      pills.appendChild(el('span', { class: 'ap-nota' + (k === 0 ? ' raiz' : '') },
        M.noteName(pc, flat)));
    });
    placa.appendChild(pills);

    placa.appendChild(el('span', { class: 'ap-ouvir' },
      [el('i', { 'data-lucide': 'volume-2' })]));

    placa.addEventListener('click', function () {
      const A = global.Nota;
      if (!A || typeof A.tocarAcorde !== 'function') {
        UI.toast('Áudio indisponível neste navegador', { tipo: 'err' });
        return;
      }
      const Tuner = global.Tuner;
      if (!Tuner || typeof Tuner.notaParaHz !== 'function') return;

      // A fundamental na oitava 3 e as demais na 4. Todas na mesma oitava
      // formam um aglomerado abafado; a fundamental na 3 e as outras na 4 dao
      // a abertura que se ouve num violao.
      const hz = info.notes.map(function (pc, k) {
        return Tuner.notaParaHz(pc, k === 0 ? 3 : 4);
      }).filter(Boolean);
      if (!hz.length) return;

      A.tocarAcorde(hz, { duracao: 2.4, volume: 0.16, espalhar: 0.02 });
      placa.classList.add('tocando');
      global.setTimeout(function () { placa.classList.remove('tocando'); }, 2500);
    });

    return placa;
  }

  /* =======================================================
     O DEDILHADO, EM DUAS LINHAS ALINHADAS

     A linha solta "E A D G B E  x 3 2 0 1 0" e pequena demais e esmaecida
     demais para quem esta aprendendo. Em duas linhas, os traste ficam embaixo
     das cordas correspondentes — que e como se le um dedilhado escrito.
     ======================================================= */
  function dedilhado(frets, labels) {
    const box = el('div', { class: 'dedilhado' });
    box.appendChild(el('div', { class: 'ded-linha' },
      labels.map(function (l) { return el('span', {}, l); })));
    box.appendChild(el('div', { class: 'ded-linha ded-nums' },
      frets.map(function (f) {
        return el('span', { class: f < 0 ? 'mudo' : '' }, f < 0 ? 'x' : String(f));
      })));
    return box;
  }

  function painelAcordes() {
    const wrap = el('div', {});
    const flat = M.useFlatsFor(estAcorde.root);
    const nome = M.formatChord(estAcorde.root, estAcorde.quality, null, flat);
    const info = M.chordInfo(estAcorde.root, estAcorde.quality, flat);
    const I = M.instrumento(estAcorde.inst);

    /* ---- a placa, no topo ---- */
    // As notas do acorde ficavam no FIM, depois de cinco diagramas — a 1700px
    // de rolagem. E a primeira duvida de quem esta aprendendo.
    wrap.appendChild(placaDoAcorde(nome, info, flat));

    /* ---- a fundamental ---- */
    wrap.appendChild(el('div', { class: 'section-title mt-4' },
      [el('i', { 'data-lucide': 'key-round' }), 'Fundamental']));

    // O seletor e o de Render, o mesmo que a Escalas usa. Uma copia por tela
    // comeca a divergir no primeiro ajuste, e a divergencia aparece como
    // "o seletor e diferente nesta tela" — o tipo de defeito que faz a pessoa
    // desconfiar do app inteiro.
    wrap.appendChild(R.seletorDeTons({
      pc: estAcorde.root,
      aoEscolher: function (pc) { estAcorde.root = pc; recarregar(); },
    }));

    /* ---- ouvir a fundamental e a relativa menor ---- */
    // Escolher um tom no seletor e so um numero; ouvir e saber qual e. E o que
    // responde "este acorde e maior ou menor", que e a duvida de quem esta
    // aprendendo. A placa ja toca o acorde inteiro; estes dois respondem a
    // outra pergunta — qual e a tonica, e qual e a sua menor.
    wrap.appendChild(el('div', { class: 'row gap-2 wrap mb-4' }, [
      R.botaoTom(estAcorde.root, 'major',
        M.noteName(estAcorde.root, flat) + ' maior', { oitava: 3 }),
      R.botaoTom(M.relativeMinor(estAcorde.root), 'minor',
        'menor: ' + M.noteName(M.relativeMinor(estAcorde.root), flat), { oitava: 3 }),
    ]));

    /* ---- a qualidade ---- */
    wrap.appendChild(el('div', { class: 'section-title' },
      [el('i', { 'data-lucide': 'layers' }), 'Qualidade']));
    const qual = el('div', { class: 'chips mb-4' });
    QUALIDADES.forEach(function (q) {
      qual.appendChild(el('button', {
        class: 'chip', 'aria-pressed': String(estAcorde.quality === q.q),
        onclick: function () { estAcorde.quality = q.q; recarregar(); },
      }, q.nome));
    });
    wrap.appendChild(qual);

    /* ---- o instrumento ---- */
    // Fica acima dos desenhos, e nao escondido em ajustes: o desenho so faz
    // sentido junto com o numero de cordas. Trocar para ukulele e ver as formas
    // sumirem para quatro e o app explicando o por que.
    wrap.appendChild(el('div', { class: 'section-title' },
      [el('i', { 'data-lucide': 'guitar' }), 'Instrumento']));
    const insts = el('div', { class: 'chips mb-4' });
    M.INSTRUMENTOS.forEach(function (it) {
      insts.appendChild(el('button', {
        class: 'chip', 'aria-pressed': String(estAcorde.inst === it.id),
        onclick: function () { estAcorde.inst = it.id; recarregar(); },
      }, it.nome + ' · ' + it.cordas + ' cordas'));
    });
    wrap.appendChild(insts);

    /* ---- as formas ---- */
    const formas = M.instrumentShapes(estAcorde.inst, estAcorde.root, estAcorde.quality, { limit: 6 });

    if (formas.length) {
      wrap.appendChild(el('div', { class: 'section-title mt-5' }, [
        el('i', { 'data-lucide': 'guitar' }), 'Formas no ' + I.nome.toLowerCase(),
      ]));
      const g = el('div', { class: 'row gap-3 wrap' });
      formas.forEach(function (f, k) {
        g.appendChild(el('div', { class: 'forma' }, [
          el('div', { class: 'forma-titulo' }, k === 0 ? 'Principal' : 'Alt ' + k),
          // Sem `title`: o proprio desenho ja desenha um titulo dentro do
          // quadro, e o do cartao logo acima. Os dois juntos davam "PRINCIPAL"
          // duas vezes seguidas, uma em cima da outra — e parece defeito.
          R.chordDiagram(f, { labels: I.labels }),
          dedilhado(f, I.labels),
        ]));
      });
      wrap.appendChild(g);

      /* O desenho principal, no violao de verdade.
       *
       * Os cartoes acima mostram a forma de cima, que e como o papel mostra.
       * Este mostra a forma no braco, do angulo de quem esta com o violao na
       * coxa — e cada anel marca o traste de um dedo, na corda em que ele vai.
       *
       * A diferenca nao e de visual. Os cartoes dizem "qui esta o desenho"; este
       * diz "e aqui, nesta corda, neste traste", que e a informacao que a mao
       * usa. E tocar cada nota e o jeito mais rapido de descobrir se o dedo
       * foi para a casa certa. */
      wrap.appendChild(el('div', { class: 'section-title mt-5' }, [
        el('i', { 'data-lucide': 'move-3d' }), 'No braço, do seu ângulo',
      ]));
      wrap.appendChild(global.Views.traste3d.mostrar({
        pcs: [],
        rootPc: estAcorde.root,
        flat: M.useFlatsFor(estAcorde.root),
        frets: 12,
        inst: estAcorde.inst,
        // So a primeira forma: os aneis de seis desenhos ao mesmo tempo
        // transformam o braco num xadrez, e a pessoa nao sabe qual é o
        // principal. A escolha fica nos cartoes acima.
        acordes: [{ pc: estAcorde.root, quality: estAcorde.quality }],
        aoTocar: function (pc, dur) {
          if (!global.Nota) return;
          // A frequencia pode vir nula (sem `Tuner`, sem audio): tocar `null`
          // levanta erro dentro do `Nota` e derruba o som inteiro.
          const hz = global.Views.traste3d.frequenciaDe(pc);
          if (hz) global.Nota.tocarNota(hz, dur);
        },
      }));
    } else {
      wrap.appendChild(el('div', { class: 'card mt-4' },
        el('p', { class: 'fs-sm muted' },
          'Nenhuma forma encontrada para este acorde neste instrumento.')));
    }

    /* ---- as notas ---- */
    wrap.appendChild(el('div', { class: 'section-title mt-5' },
      [el('i', { 'data-lucide': 'music' }), 'Notas']));
    const pills = el('div', { class: 'note-ring' });
    info.notes.forEach(function (pc, k) {
      pills.appendChild(el('span', { class: 'note-pill' + (k === 0 ? ' root' : '') },
        M.noteName(pc, flat) + (k === 0 ? ' (1a)' : '')));
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
    wrap.appendChild(R.seletorDeTons({
      pc: estEscala.root,
      aoEscolher: function (pc) { estEscala.root = pc; recarregar(); },
    }));

    // Aqui a tonica e o que se vai ouvir ao longo da escala, entao o botao
    // toca a tonica e a dominante: sao as duas que definem o campo harmonico.
    // So a tonica faz a escala maior soar como uma sequencia solta, sem para
    // onde resolver.
    wrap.appendChild(el('div', { class: 'row gap-2 wrap mb-4' }, [
      R.botaoTom(estEscala.root, 'major',
        'tônica: ' + M.noteName(estEscala.root, flat), { oitava: 3 }),
      R.botaoTom(M.mod12(estEscala.root + 7), 'major',
        'dominante: ' + M.noteName(M.mod12(estEscala.root + 7), flat), { oitava: 3 }),
    ]));

    // Ouvir a escala inteira. O botao de tom responde "qual e a tonica";
    // este responde "como e essa escala", que e outra pergunta.
    //
    // O intervalo entre as notas e o que faz uma escala parecer escala. Oito
    // notas ao mesmo tempo seriam um acorde grande, nao uma escala.
    wrap.appendChild(el('div', { class: 'row gap-2 wrap mb-4' }, [
      // O rotulo e "Ouvir a escala", e nao o nome do modo: o nome do modo ja
      // esta no chip selecionado logo acima. Um botao escrito "Maior" nao diz
      // o que ele faz nem que e clicavel — e era a duvida que ele existe para
      // responder.
      R.botaoEscala(notas, 'Ouvir a escala', { oitava: 3, passo: 0.3 }),
    ]));

    wrap.appendChild(el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'waves' }), 'Escala / modo']));
    const chips = el('div', { class: 'chips mb-4' });
    Object.keys(M.SCALES).forEach(function (k) {
      chips.appendChild(el('button', { class: 'chip', 'aria-pressed': String(estEscala.scale === k),
        onclick: function () { estEscala.scale = k; recarregar(); } }, M.SCALES[k].name));
    });
    wrap.appendChild(chips);

    // O instrumento decide o fretboard logo abaixo: a escala e a mesma, mas
    // ela aparece no braco de quem vai tocar.
    wrap.appendChild(el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'guitar' }), 'No braço de']));
    const insts = el('div', { class: 'chips mb-4' });
    M.INSTRUMENTOS.forEach(function (it) {
      insts.appendChild(el('button', {
        class: 'chip', 'aria-pressed': String(estEscala.inst === it.id),
        onclick: function () { estEscala.inst = it.id; recarregar(); },
      }, it.nome));
    });
    wrap.appendChild(insts);

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

    /* O traste.

     Este era um `scaleFretboard` — o desenho 2D, de vista de cima. Continua
     aqui, como reserva e como versao para quem esta olhando o papel: a tela
     abaixo monta os dois e deixa o 3D ocupar o lugar quando ele carrega.

     O que muda e o que a pessoa pode fazer: girar para o angulo em que esta
     segurando o violao, e tocar a nota em vez de so ve-la. Ver o desenho de
     cima ensina o desenho; ver do lado do proprio braço ensina onde o dedo
     vai. */
    wrap.appendChild(el('div', { class: 'section-title mt-5' }, [el('i', { 'data-lucide': 'guitar' }), 'No violão']));
    wrap.appendChild(global.Views.traste3d.mostrar({
      pcs: notas,
      rootPc: estEscala.root,
      flat: flat,
      frets: 12,
      showAll: true,
      inst: estEscala.inst,
      // A escala nao e um desenho: nao ha dedos a marcar. Os aneis aparecem
      // na aba de acordes, onde ha um desenho a ensinar.
      acordes: [],
    }));

    wrap.appendChild(el('div', { class: 'section-title mt-5' }, [el('i', { 'data-lucide': 'piano' }), 'No piano']));
    wrap.appendChild(R.scaleKeyboard(notas, { rootPc: estEscala.root, flat: flat, octaves: 2 }));
    return wrap;
  }

  /* =======================
     CIRCULO DAS QUINTAS
     ======================= */
/** O INSTRUMENTO INTEIRO, EM 3D
   *
   * Por que esta tela existe.
   *
   * O violão em 3D já era desenhado, e funcionava: aparecia no fim da aba de
   * acordes, embaixo de seis cartões de forma, só depois de escolher um acorde e
   * rolar a tela até o fim. Isso é quase o mesmo que não ter — o que importa
   * para quem toca não é "o 3D existe", é "quando eu chego no ensaio, o braço
   * está na minha frente em dois toques".
   *
   * Aqui o braço inteiro aparece logo de cara, com o número de trastes que o
   * instrumento de verdade tem (`INSTRUMENTOS[].trastes`: o violão tem 22, o
   * ukulele 12) e não um número escolhido só porque enquadrava na tela. E o
   * violino entra sem trastes, porque a tabela diz que não tem — um violino com
   * trastes marcados parece errado para quem sabe, do mesmo jeito que parece
   * certo para quem nunca viu um.
   *
   * O tom e a qualidade vêm de `estAcorde`, o MESMO estado da aba de acordes. É
   * de propósito: quem estava olhando um acorde e toca aqui continua vendo o
   * mesmo acorde. Um estado novo seria uma segunda verdade sobre a mesma coisa,
   * e as duas divergiriam assim que a pessoa trocasse de aba.
   */
function painelInstrumento() {
    const wrap = el('div', {});
    const I = M.instrumento(estInst.inst) || M.INSTRUMENTOS[0];
    const flat = M.useFlatsFor(estAcorde.root);

    wrap.appendChild(el('div', { class: 'card' }, [
      el('p', { class: 'fs-sm muted' },
        'O ' + I.nome.toLowerCase() + ' inteiro, do cabo ao fim da escala. '
        + 'Toque numa corda para ouvir a nota.'),
    ]));

    /* ---- o instrumento ---- */
    wrap.appendChild(el('div', { class: 'section-title mt-4' },
      [el('i', { 'data-lucide': 'guitar' }), 'Instrumento']));
    const insts = el('div', { class: 'chips mb-4' });
    M.INSTRUMENTOS.forEach(function (it) {
      insts.appendChild(el('button', {
        class: 'chip', 'aria-pressed': String(estInst.inst === it.id),
        onclick: function () { estInst.inst = it.id; recarregar(); },
      }, it.nome + ' · ' + it.cordas + ' cordas'));
    });
    wrap.appendChild(insts);

    /* ---- o tom e a qualidade ---- */
    // O mesmo seletor da aba de acordes, pelo mesmo motivo: dois seletores de
    // tom no mesmo app sao dois lugares para a resposta divergir.
    wrap.appendChild(R.seletorDeTons({
      pc: estAcorde.root,
      aoEscolher: function (pc) { estAcorde.root = pc; recarregar(); },
    }));
    const qual = el('div', { class: 'chips mb-4' });
    QUALIDADES.forEach(function (q) {
      qual.appendChild(el('button', {
        class: 'chip', 'aria-pressed': String(estAcorde.quality === q.q),
        onclick: function () { estAcorde.quality = q.q; recarregar(); },
      }, q.nome));
    });
    wrap.appendChild(qual);

    /* ---- o braço inteiro ---- */
    /* O número de trastes vem do instrumento, e `criar` limita a 24. Nenhum dos
     * seis chega a 24, e o limite existe para que um instrumento futuro com 30
     * trastes seja desenhado ate onde o motor alcanca, em vez de o numero ser
     * cortado para caber na tela e parecer outro instrumento. */
    const trastes = Math.min(24, I.trastes || 12);
    const g = global.Violao3D && global.Violao3D.GEOMETRIA
      ? global.Violao3D.GEOMETRIA[I.id] : null;
    const temTraste = !g || g.trastes !== false;

    wrap.appendChild(el('div', { class: 'section-title mt-4' }, [
      el('i', { 'data-lucide': 'move-3d' }),
      I.nome + ' em 3D · ' + trastes + (trastes === 1 ? ' traste' : ' trastes')
        + (temTraste ? '' : ', sem traste como no ' + I.nome.toLowerCase() + ' de verdade'),
    ]));

    wrap.appendChild(global.Views.traste3d.mostrar({
      pcs: [],
      rootPc: estAcorde.root,
      flat: flat,
      frets: trastes,
      inst: estInst.inst,
      rotulo: 'Traste',
      acordes: [{ pc: estAcorde.root, quality: estAcorde.quality }],
      aoTocar: function (pc, dur) {
        if (!global.Nota) return;
        const hz = global.Views.traste3d.frequenciaDe(pc);
        if (hz) global.Nota.tocarNota(hz, dur);
      },
    }));

    /* ---- as cordas soltas ----
     * A afinação é a primeira coisa que se perde quando o aparelho estraga ou
     * muda de dono, e a primeira dúvida de quem está começando. Ouvir a
     * afinação no lugar — sem precisar saber qual tom chamar de "certo" — é o
     * que resolve. */
    wrap.appendChild(el('div', { class: 'section-title mt-5' }, [
      el('i', { 'data-lucide': 'music' }), 'Cordas soltas',
    ]));
    const cordas = el('div', { class: 'note-ring' });
    I.openPc.forEach(function (pc, i) {
      const hz = hzDaCorda(I, i);
      const b = el('button', {
        class: 'note-pill', type: 'button',
        onclick: function () { if (hz && global.Nota) global.Nota.tocarNota(hz, 2.2); },
      }, M.noteName(pc, flat) + ' · ' + Math.round(hz || 0) + ' Hz');
      if (i === 0) b.classList.add('root');
      cordas.appendChild(b);
    });
    wrap.appendChild(cordas);
    wrap.appendChild(el('p', { class: 'd mt-2' },
      I.cordas + (I.cordas === 1 ? ' corda' : ' cordas')
      + ', afinação ' + I.afinacao.toLowerCase() + '. '
      + 'O número ao lado de cada nota é a frequência real daquela corda.'));

    return wrap;
  }

  /** A frequência de uma corda solta, na oitava em que ela soa.
   *
   * `notaParaHz` recebe a classe e a oitava, e a frequência de uma corda não
   * sai da classe sozinha: a corda mais grave de um violão (Mi2, 82 Hz) e a
   * mais aguda (Mi4, 330 Hz) são a MESMA classe. Por isso a oitava vem de
   * `openMidi`, que é a parte dos dados que guarda a altura e não só o nome. */
  function hzDaCorda(I, i) {
    const Tuner = global.Tuner;
    if (!Tuner || typeof Tuner.notaParaHz !== 'function') return null;
    const midi = I.openMidi && I.openMidi[i];
    if (typeof midi !== 'number') return null;
    return Tuner.notaParaHz(I.openPc[i], Math.floor(midi / 12) - 1);
  }

  function painelCirculo() {
    const wrap = el('div', {});
    let selPc = estEscala.root;
    function montar() {
      U.clear(wrap);
      wrap.appendChild(R.circleOfFifths({ selected: selPc, onClick: function (pc) { selPc = pc; estEscala.root = pc; montar(); UI.icons(wrap); } }));
      const flat = M.useFlatsFor(selPc);
      const relM = M.relativeMinor(selPc);
      // As alteracoes sao NOMEADAS, nao so contadas.
      //
      // A coluna maior mostrava sempre o sinal de susteno, inclusive em Fa e
      // Sib, que pedem bemol. E "2 alteracoes" nao serve para nada: o que a
      // pessoa precisa antes de pegar o instrumento e quais notas.
      const armA = M.armadura(selPc, 'major');
      const armB = M.armadura(relM, 'minor');
      wrap.appendChild(el('div', { class: 'card' }, el('div', { class: 'row gap-3 between wrap' }, [
        el('div', { style: { textAlign: 'center', flex: '1 1 110px' } }, [
          el('div', { class: 'fs-lg fw-8 mono', style: { color: 'var(--primary)' } }, M.noteName(selPc, flat)),
          el('div', { class: 'fs-xs muted' }, armA.texto),
        ]),
        el('div', { style: { textAlign: 'center', flex: '1 1 110px' } }, [
          el('div', { class: 'fs-lg fw-8 mono', style: { color: 'var(--brand-500)' } }, M.noteName(relM, flat) + 'm'),
          el('div', { class: 'fs-xs muted' }, armB.texto),
        ]),
        el('div', { style: { flex: '1 1 200px' } }, [
          el('div', { class: 'fs-xs muted mb-1' }, 'Escala maior'),
          el('div', { class: 'fs-sm mono' }, M.scaleNames(selPc, 'major', flat).join(' ')),
          el('div', { class: 'fs-xs muted mt-2 mb-1' }, 'Escala menor relativa'),
          el('div', { class: 'fs-sm mono' }, M.scaleNames(relM, 'minor', M.useFlatsFor(relM)).join(' ')),
        ]),
      ])));
      // Ouvir o par escolhido. A roda e um mapa; o som e a confirmacao.
      wrap.appendChild(el('div', { class: 'row gap-2 wrap mb-3' }, [
        R.botaoTom(selPc, 'major', M.noteName(selPc, flat) + ' maior', { oitava: 3 }),
        R.botaoTom(relM, 'minor', M.noteName(relM, flat) + ' menor', { oitava: 3 }),
      ]));
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
      const desl = estCifra.semis === 0 ? 'tom original'
        : R.numeroBr(estCifra.semis) + (Math.abs(estCifra.semis) === 1 ? ' semitom' : ' semitons');
      info.textContent = (k ? 'Original: ' + M.noteName(k.pc, M.useFlatsFor(k.pc)) + (k.mode === 'minor' ? 'm' : '') : '?') +
        '   -   ' + desl + (k2 ? '   -   Resultado: ' + M.noteName(k2.pc, M.useFlatsFor(k2.pc)) + (k2.mode === 'minor' ? 'm' : '') : '');
      saida.appendChild(R.cifraBox(res));
      UI.icons(saida);
    }
    ta.addEventListener('input', U.debounce(render, 300));

    const bar = R.transposeBar({
      valor: estCifra.semis,
      onChange: function (v) { estCifra.semis = v; render(); },
    });

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
      } }, [el('i', { 'data-lucide': 'save' }), 'Salvar no repertório']),
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
      title: 'Metrônomo', sub: 'continua tocando com o vídeo rodando',
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
          el('div', { class: 'field' }, [el('label', { class: 'label' }, 'Divisão'), selSub]),
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
    // A entrada que faltava: o 3D do instrumento inteiro, em um toque, sem
    // passar por nenhum acorde.
    instrumento: function () { aba = 'instrumento'; ir(); },
    metronome: abrirMetronomo,
  };
  function ir() {
    const p = document.getElementById('page-teoria');
    if (p && p.classList.contains('active')) render(p, {});
    else global.App.ir('teoria', { aba: aba });
  }
})(typeof window !== 'undefined' ? window : globalThis);