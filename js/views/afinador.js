/* =========================================================
   ACORDE - views/afinador.js
   O afinador.

   O visor e um cursor, e nao um numero. Quem esta afinando olha para o
   instrumento, nao para a tela — um numero exige leitura, e leitura exige tirar
   o olho. O cursor diz a unica coisa que importa: para que lado, e o tanto.
   --------------------------------------------------------- */
(function (global) {
  'use strict';

  const V = global.Views || (global.Views = {});
  const U = global.Utils;
  const M = global.Music;
  const T = global.Tuner;
  const S = global.Store;
  const el = U.el;

  // Faixa do cursor, em cents. Terna e pequena: o instrumentista ve o
  // movimento, e nao o numero.
  const CERCA = 50;

  /**
   * Converte um desvio em cents na posicao horizontal do cursor, de -1 a 1.
   * Com o grafico em 4,60 px, o percurso total e 460 px.
   */
  function posicaoDoCursor(cents) {
    return Math.max(-1, Math.min(1, cents / CERCA));
  }

  function afinador(raiz, fechar) {
    const wrap = el('div', { class: 'afinador' });

    // ── Estado da captura ──
    let ctx = null;
    let stream = null;
    let raf = null;
    let histHz = [];
    let histConf = [];
    let ultimoDesenhado = 0;
    let refA4 = 440;

    // Elementos que o laco de audio redesenha.
    const notaEl = el('div', { class: 'af-nota' }, '—');
    const centsEl = el('div', { class: 'af-cents' }, '');
    const cursor = el('div', { class: 'af-cursor' });
    const hzEl = el('div', { class: 'af-hz' }, '');
    const estadoEl = el('div', { class: 'af-estado' }, 'Toque no botão para liberar o microfone');

    const trilha = el('div', { class: 'af-trilha' }, [
      el('div', { class: 'af-marca af-meio' }),
      cursor,
    ]);
    // As marcas de referencia: onde fica cada nota vizinha.
    [-50, 0, 50].forEach(function (c) {
      const m = el('div', { class: 'af-marca' + (c === 0 ? ' af-centro' : ''), style: { left: ((c / CERCA + 1) * 50) + '%' } });
      trilha.appendChild(m);
    });

    // ── Ligar e desligar ──
    async function ligar() {
      if (ctx) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        estadoEl.textContent = 'Este navegador não da acesso ao microfone.';
        return;
      }
      try {
          // Eco cancelado e supressao de ruido atrapalham aqui: o navegador trata
      // a corda como o que nao deve ficar, e a nota desaparece junto. So o
        // automatico.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch (e) {
        estadoEl.textContent = 'Microfone bloqueado. Libere nas permissoes do site.';
        return;
      }
      ctx = new (global.AudioContext || global.webkitAudioContext)();
      const fonte = ctx.createMediaStreamSource(stream);
      const analisador = ctx.createAnalyser();
      analisador.fftSize = 4096;
      analisador.smoothingTimeConstant = 0;
      fonte.connect(analisador);

      const dados = new Float32Array(analisador.fftSize);
      estadoEl.textContent = 'Ouvindo. Cante ou toque a nota.';

      function laco() {
        analisador.getFloatTimeDomainData(dados);
        const leitura = T.detectar(dados, ctx.sampleRate);
        if (leitura.hz > 0) {
          histHz.push(leitura.hz);
          histConf.push(leitura.confianca);
          if (histHz.length > 5) { histHz.shift(); histConf.shift(); }
        }
        desenhar();
        raf = global.requestAnimationFrame(laco);
      }
      laco();

      botao.textContent = 'Desligar';
      botao.className = 'btn btn-secondary btn-block';
    }

    function desligar() {
      if (raf) global.cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      if (ctx && ctx.close) ctx.close();
      ctx = null; stream = null; raf = null; histHz = []; histConf = [];
      notaEl.textContent = '—';
      centsEl.textContent = '';
      hzEl.textContent = '';
      cursor.style.transform = 'translateX(-50%)';
      estadoEl.textContent = 'Microfone desligado.';
      botao.textContent = 'Ligar o microfone';
      botao.className = 'btn btn-primary btn-block';
    }

    // ── Desenhar ──
    function desenhar() {
      // Limitar para ~20 quadros por segundo: a 60 Hz o numero fica ilegivel
      // e a bateria do celular dura menos.
      const agora = global.performance.now();
      if (agora - ultimoDesenhado < 50) return;
      ultimoDesenhado = agora;

      if (!histHz.length) return;
      const hz = T.suavizar(histHz.slice(), histHz[histHz.length - 1]);
      const conf = histConf.length ? T.suavizar(histConf.slice(), histConf[histConf.length - 1]) : 0;
      const lido = T.hzParaNota(hz, refA4);
      if (!lido) return;

      /* ── QUANDO NAO TEM CERTEZA, DIZ QUE NAO TEM ──
      *
      * O pior defeito de um afinador nao e ler errado: e ler errado COM
      * CONFIANCA. A pessoa ve "Sol", gira a cravelha, e afina a corda no lugar
      * errado — e so descobre no palco, com a banda tocando.
      *
      * Por isso a deteccao devolve confianca, e por isso ela manda aqui. Abaixo
      * do limite, a tela mostra que esta ouvindo mas nao arrisca o nome da nota.
      * A pessoa sabe que precisa de mais som; ela nao sabe qual nota tocar.
      *
      * O limite e 0,72. Uma corda limpa passa de 0,90; um chiado fica perto de
      * zero. O espaco entre os dois e largo de proposito — e melhor hesitar
      * numa nota boa do que afirmar uma nota errada. */
      const incerta = conf < 0.72;

      notaEl.textContent = incerta ? '—' : lido.nome;
      notaEl.className = 'af-nota' + (incerta ? '' : (lido.perto ? ' afinado' : ''));
      centsEl.textContent = incerta
        ? 'não tenho certeza — toque mais perto do microfone'
        : (lido.perto ? 'afinado' : (lido.cents > 0 ? lido.cents + ' cents acima' : Math.abs(lido.cents) + ' cents abaixo'));

      hzEl.textContent = lido.hz.toFixed(1) + ' Hz';
      cursor.style.transform = incerta
        ? 'translateX(-50%)'
        : 'translateX(calc(-50% + ' + (posicaoDoCursor(lido.cents) * 50) + '%))';
    }

    // ── A4 ajustavel ──
    const selA4 = el('select', { class: 'select', 'aria-label': 'Lá de referência' },
      [435, 438, 440, 442, 445].map(function (v) {
        return el('option', { value: String(v), selected: v === 440 }, v + ' Hz');
      }));
    selA4.addEventListener('change', function () { refA4 = Number(selA4.value) || 440; });

    const botao = el('button', { class: 'btn btn-primary btn-block', onclick: function () { ctx ? desligar() : ligar(); } },
      'Ligar o microfone');

    // ── Guia de corda ──
    const GUIA = [
      { inst: 'Violão', nota: 'Mi2', pc: 4, oit: 2 },
      { inst: 'Violão', nota: 'La2', pc: 9, oit: 2 },
      { inst: 'Violão', nota: 'Re3', pc: 2, oit: 3 },
      { inst: 'Violão', nota: 'Sol3', pc: 7, oit: 3 },
      { inst: 'Violão', nota: 'Si3', pc: 11, oit: 3 },
      { inst: 'Violão', nota: 'Mi4', pc: 4, oit: 4 },
    ];
    const guia = el('div', { class: 'af-guia' },
      GUIA.map(function (g) {
        return el('button', {
          class: 'af-guia-nota',
          onclick: function () {
            // Toca a nota de referencia, para a pessoa ter com o que comparar.
            if (!global.Nota) return;
            const hz = T.notaParaHz(g.pc, g.oit, refA4);
            global.Nota.tocarNota ? global.Nota.tocarNota(hz, 1.2, { puro: true }) : global.Nota.tocarAcorde([hz], { duracao: 1.2 });
          },
          title: g.inst + ' — ' + g.nota,
        }, [
          el('span', { class: 'af-guia-nome' }, g.nota),
          el('span', { class: 'af-guia-hz' }, Math.round(T.notaParaHz(g.pc, g.oit, refA4)) + ' Hz'),
        ]);
      }));

    wrap.appendChild(el('div', { class: 'af-visor' }, [
      notaEl,
      centsEl,
      el('div', { class: 'af-trilha-caixa' }, [trilha]),
      hzEl,
    ]));
    wrap.appendChild(el('div', { class: 'af-acao' }, [botao]));
    wrap.appendChild(el('div', { class: 'row gap-2 mt-3' }, [
      el('div', { class: 'grow' }, [
        el('label', { class: 'label' }, 'Lá de referência'),
        selA4,
      ]),
    ]));
    wrap.appendChild(el('div', { class: 'section-title mt-4' }, [
      el('i', { 'data-lucide': 'music' }), 'Violão — cordas soltas',
    ]));
    wrap.appendChild(guia);
    wrap.appendChild(estadoEl);

    global.UI.icons(wrap);
    return wrap;
  }

  function abrir() {
    const h = global.UI.sheet({ title: 'Afinador', sub: 'Toque a corda e espere o cursor parar', body: el('div', {}), wide: true });
    h.body.appendChild(afinador(null, function () { h.close(); }));
    global.UI.icons(h.body);
    return h;
  }

  V.afinador = { abrir: abrir, afinador: afinador };

  global.AcordAfinador = V.afinador;
})(typeof window !== 'undefined' ? window : globalThis);
