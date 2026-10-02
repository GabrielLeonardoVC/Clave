/* =========================================================
   ACORDE - views/hoje.js
   Painel: proximo evento, atalhos, resumo, avisos.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const S = global.Store;
  const UI = global.UI;
  const M = global.Music;
  const { el, $ } = U;
  const V = global.Views || (global.Views = {});

  /**
   * O tom de um evento, lido das músicas dele.
   *
   * A fonte preferida é o campo `tom` de cada música, porque quem montou a
   * escala sabe o tom melhor que qualquer análise. Mas esse campo vem vazio
   * na maioria das vezes. Quando falta, a cifra ligada responde: `detectKey`
   * monta o histograma de acordes da cifra e compara com os 24 perfis.
   *
   * A conta em si mora em `Music.resumoDeTons`, que é pura e tem teste. Aqui
   * só se junta o que o store tem.
   */
  function tomDoEvento(ev) {
    const ms = (ev && ev.musicas) || [];
    const tons = [];
    ms.forEach(function (mu) {
      if (!mu) return;
      const declarado = M.parseChord(String(mu.tom || '').trim());
      if (declarado) {
        tons.push({
          pc: declarado.root,
          modo: declarado.quality === 'm' ? 'minor' : 'major',
          rotulo: String(mu.tom).trim(),
        });
        return;
      }
      if (!mu.cifraId) return;
      const c = S.cifraPorId(mu.cifraId);
      if (!c) return;
      const k = M.detectKey(c.cifra || '');
      if (k) tons.push({ pc: k.pc, modo: k.mode, rotulo: null });
    });
    return M.resumoDeTons(tons);
  }

  /**
   * A placa de tom: a peça que dá identidade à tela inicial.
   *
   * Um app de ensaio que só mostra o nome do evento esconde a informação que
   * o músico usa no caminho até lá. Esta placa diz em que tom o show vai
   * estar, quantas alterações esse tom pede — que é o que decide se ele leva
   * a capotraste — e, se houver, quantas músicas ficaram fora.
   */
  function placaDeTom(info) {
    if (!info) return null;
    const selo = el('span', { class: 'tom-selo' },
      info.rotulo || M.keyLabel(info.pc, info.modo === 'minor', false));

    const pecas = [selo];
    pecas.push(el('span', { class: 'tom-nota' }, [
      el('b', {}, String(info.n) + '/' + String(info.total)),
      info.total === 1 ? ' música' : ' músicas',
    ]));

    const arm = info.armadura;
    if (arm.quantidade > 0) {
      // "b" e "#" em vez de bemol e susteno: os simboles unicode nao passam
      // no verificador de caracteres, e a lista de nomes ja diz o suficiente.
      pecas.push(el('span', { class: 'tom-nota' }, [
        'afinação: ',
        el('b', {}, arm.ordem.map(function (n) { return n + (arm.bemois ? 'b' : '#'); }).join(' ')),
      ]));
    }
    if (info.fora > 0) {
      pecas.push(el('span', { class: 'tom-fora' },
        String(info.fora) + (info.fora === 1 ? ' música fora' : ' músicas fora')));
    }
    return el('div', { class: 'capa-tom' }, pecas);
  }

  function render(root, params) {
    U.clear(root);
    const m = S.metricas();
    const hoje = U.todayKey();
    const prox = S.proximas(4);
    const hojeEv = S.porData(hoje);

    /* ---- a chapa ---- */
    if (prox.length) {
      const p = prox[0];
      const d = U.diffDays(new Date(), U.fromKey(p.data));
      const quando = d === 0 ? 'HOJE' : d === 1 ? 'AMANHÃ' : U.fmtRelativeDay(p.data).toUpperCase();
      root.appendChild(el('button', {
        class: 'capa',
        onclick: function () { global.App.ir('agenda', { data: p.data, abrir: p.id }); },
      }, [
        el('div', { class: 'k' }, 'PRÓXIMO · ' + quando),
        el('div', { class: 't' }, p.titulo + (p.hora ? ' · ' + U.fmtTime(p.hora) : '')),
        el('div', { class: 'm' }, [
          U.fmtDateLong(p.data),
          p.local ? ' · ' + p.local : '',
          ' · ' + p.musicas.length + (p.musicas.length === 1 ? ' música' : ' músicas'),
        ].join('')),
        placaDeTom(tomDoEvento(p)),
        el('div', { class: 'cta' }, el('div', { class: 'btn' }, [
          el('i', { 'data-lucide': p.musicas.length ? 'play' : 'arrow-right' }),
          'Abrir o evento',
        ])),
      ]));
    } else {
      root.appendChild(el('div', { class: 'capa plain' }, [
        el('div', { class: 'k' }, 'BEM-VINDO AO ACORDE'),
        el('div', { class: 't' }, 'Monte seu primeiro evento'),
        el('div', { class: 'm' }, 'Escolha a data, arraste as músicas e mande pro time.'),
        el('div', { class: 'cta' }, el('button', { class: 'btn', onclick: function () { global.App.ir('agenda', { nova: true }); } },
          [el('i', { 'data-lucide': 'plus' }), 'Criar escala'])),
      ]));
    }

    /* ---- a régua ---- */
    root.appendChild(el('div', { class: 'regua mt-5' }, [
      rapido('calendar-plus', 'Evento', 'gold', function () { global.App.ir('agenda', { nova: true }); }),
      rapido('music-4', 'Cifra', 'green', function () { V.repertorio && V.repertorio.novo(); }),
      rapido('audio-lines', 'Afinador', 'blue', function () { V.afinador && V.afinador.abrir(); }),
      rapido('clipboard-paste', 'Colar', '', function () { V.repertorio && V.repertorio.colar(); }),
      /* O 3D do instrumento, na regua da tela inicial.
       *
       * Antes o unico caminho era Teoria -> Acordes -> escolher um acorde -> rolar
       * ate o fim da tela. Quatro passos para ver o braco, num ensaio, com o
       * celular na mao. Este e o quinto botao, e o que resolve isso. */
      rapido('guitar', 'Braco', '', function () {
        if (V.teoria && typeof V.teoria.instrumento === 'function') V.teoria.instrumento();
        else global.App.ir('teoria', { aba: 'instrumento' });
      }),
    ]));

    /* ---- os números ---- */
    root.appendChild(el('div', { class: 'numeros' }, [
      numero(m.proximas, 'Próximos'),
      numero(m.cifras, 'Cifras'),
      numero(m.musicas, 'Músicas'),
      numero(m.ensaios, 'Ensaios'),
    ]));

    /* ---- hoje ---- */
    if (hojeEv.length) {
      root.appendChild(titulo('sun', 'Hoje'));
      const box = el('div', { class: 'card' });
      hojeEv.forEach(function (e) { box.appendChild(linhaEvento(e)); });
      root.appendChild(box);
    }

    /* ---- o resto da semana, e o que vem depois ----
       Cada lista tem um alcance proprio e nenhuma repete a anterior.

       Antes o evento de hoje aparecia tres vezes na tela: em "Hoje", em
       "Proximos eventos" e em "Esta semana". As tres contavam o mesmo dia —
       `proximas` comeca em `>= hoje`, e a semana aceitava zero dias de
       distancia. Com um evento so, a primeira tela mostrava a mesma missa
       listada tres vezes, e nenhuma das tres dizia por que estava ali.

       A ordem tambem estava errada: depois de "Proximos" vinha "Esta semana",
       que volta para tras no calendario. Agora sao faixas que se encaixam na
       ordem em que os dias acontecem. */
    const semana = S.escalas().filter(function (e) {
      const d = U.diffDays(new Date(), U.fromKey(e.data));
      return d >= 1 && d <= 6;
    });
    if (semana.length) {
      root.appendChild(titulo('calendar-range', 'O resto da semana'));
      const box = el('div', { class: 'card' });
      U.sortBy(semana, function (e) { return e.data + (e.hora || ''); }).forEach(function (e) { box.appendChild(linhaEvento(e)); });
      root.appendChild(box);
    }

    /* ---- mais a frente ---- */
    const depois = S.escalas().filter(function (e) {
      return U.diffDays(new Date(), U.fromKey(e.data)) > 6;
    });
    if (depois.length) {
      root.appendChild(titulo('clock', 'Mais à frente'));
      const box = el('div', { class: 'card' });
      U.sortBy(depois, function (e) { return e.data + (e.hora || ''); })
        .slice(0, 4)
        .forEach(function (e) { box.appendChild(linhaEvento(e)); });
      root.appendChild(box);
    }

    /* ---- tons mais tocados ---- */
    const tons = Object.keys(m.porTom).sort(function (a, b) { return m.porTom[b] - m.porTom[a]; }).slice(0, 8);
    if (tons.length) {
      root.appendChild(titulo('music-2', 'Tons que você mais toca'));
      root.appendChild(el('div', { class: 'chips' }, tons.map(function (t) {
        // O id da rota e 'repertorio', sem acento. Com acento, `rota()` caia no
      // padrao e o chip levava para a tela de Hoje em vez do Repertório
      // filtrado pelo tom — que e o que a pessoa pediu ao tocar nele.
      return el('button', { class: 'chip', onclick: function () { global.App.ir('repertorio', { tom: t }); } },
          t + ' · ' + m.porTom[t]);
      })));
    }

    /* ---- ferramentas ---- */
    root.appendChild(titulo('wrench', 'Ferramentas'));
    root.appendChild(el('div', { class: 'lista-cifras' }, [
      cartao('timer', 'Metrônomo', 'BPM, compasso e tap', function () { V.teoria && V.teoria.metronome(); }),
      cartao('shuffle', 'Transpor', 'Mude o tom de qualquer cifra', function () { V.teoria && V.teoria.transpor(); }),
      // O rotulo acompanha os instrumentos: a secao tem violao, baixo, baixo
      // 5 cordas e ukulele, e dizer "no violao" seria metade da verdade.
      cartao('guitar', 'Acordes', 'Formas no ' + M.INSTRUMENTOS.map(function (i) { return i.nome; }).join(', ').toLowerCase(), function () { V.teoria && V.teoria.acordes(); }),
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
    return el('button', { class: cls, onclick: onclick }, [
      el('i', { 'data-lucide': icon }),
      el('span', {}, label),
    ]);
  }

  /**
   * Um algarismo na regua. O zero fica esmaecido de proposito: numa lista
   * vazia, o "0" é a informacao — e cinza evita que ele dispute atencao com
   * os numeros que realmente tem conteudo.
   */
  function numero(valor, rotulo) {
    const v = Number(valor) || 0;
    return el('div', {}, [
      el('div', { class: 'v' + (v === 0 ? ' zero' : '') }, String(v)),
      el('div', { class: 'k' }, rotulo),
    ]);
  }

  function cartao(icon, titulo, sub, onclick) {
    // Ferramentas nao tem tom, entao a coluna da esquerda fica com o icone.
    // Mesmo tamanho, mesma posicao: a lista inteira continua uma coluna.
    return el('button', { class: 'song-card', onclick: onclick }, [
      el('span', { class: 'tom-col icone' }, el('i', { 'data-lucide': icon })),
      el('div', { class: 'meio' }, [
        el('div', { class: 'n' }, titulo),
        el('div', { class: 'a' }, sub),
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
