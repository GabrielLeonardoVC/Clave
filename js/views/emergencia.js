/* =========================================================
   ACORDE - views/emergencia.js
   O botao de emergencia: o que se precisa na hora, num toque.

   A ideia e uma unica pergunta, feita quando a pessoa precisa e nao antes:
   "qual tom?". Quem esta no palco com a corda fora ja sabe que o problema e
   tom, e nao quer caçar em quatro telas diferentes. A folha responde com um
   conversor que da para OUVIR, e com uma busca que pergunta ONDE procurar.

   Por que ficar ao lado da lupa e do tema, e nao dentro do "Mais": o "Mais" e
   para o que se usa com calma. Isto e para o que se usa com aeductible.
   ========================================================= */
(function (global) {
  'use strict';

  const V = global.Views || (global.Views = {});
  const U = global.Utils;
  const UI = global.UI;
  const M = global.Music;
  const Tuner = global.Tuner;
  const { el } = U;

  /**
   * Onde procurar uma musica.
   *
   * A ordem importa e nao e alfabetica. Cifra Club primeiro porque e o que
   * tem a cifra pronta, que e o que se quer ao ensaiar. YouTube segundo
   * porque e o video. Letras terceiro porque e a letra. InArtist em quarto
   * porque acha tab que ninguem tem em gravacao. E o Google no fim, para o
   * que nenhum dos quatro achou.
   */
  const FONTES = [
    { id: 'cifraclub', nome: 'Cifra Club', icone: 'music', desc: 'A cifra pronta' },
    { id: 'youtube', nome: 'YouTube', icone: 'youtube', desc: 'O vídeo da gravação' },
    { id: 'letras', nome: 'Letras', icone: 'file-text', desc: 'A letra completa' },
    { id: 'inartist', nome: 'InArtist', icone: 'disc-3', desc: 'Tabs e cifras em PDF' },
    { id: 'livre', nome: 'Google', icone: 'globe', desc: 'Buscar em qualquer lugar' },
  ];

  /** O endereco de cada fonte, com o termo ja escapado. */
  function urlDe(id, termo) {
    const q = String(termo || '').trim();
    if (!q) return '';
    // O Cifra Club e o Letras usam "+" entre as palavras no proprio endereco
    // (/acervo/titulo+artista.html). EncodeURIComponent entregaria %20, que
    // funciona em parte das paginas e falha em outras.
    const comMais = q.split(/\s+/).map(encodeURIComponent).join('+');
    switch (id) {
      case 'cifraclub': return 'https://www.cifraclub.com.br/acervo/' + comMais + '.html';
      case 'youtube': return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
      case 'letras': return 'https://www.letras.mus.br/busca/' + comMais;
      case 'inartist': return 'https://www.inartist.com.br/busca?q=' + encodeURIComponent(q);
      default: return 'https://www.google.com/search?q=' + encodeURIComponent(q + ' cifra letra');
    }
  }

  /* =======================================================
     CONVERSOR DE TOM
     ======================================================= */

  /**
   * Le "Am", "A-", "C#", "Bb", "F#m7" e devolve a tonica e o modo.
   *
   * So a tonica e o modo interessam para converter. A extensao ("m7", "sus4")
   * e problema da cifra, nao do tom — quem converte de Am para C quer saber
   * quantos tons, nao reescrever o acorde.
   */
  function parseTon(texto) {
    const t = String(texto == null ? '' : texto).trim();
    if (!t) return null;
    const m = /^([A-Ga-g])\s*([#b]{0,2})\s*(m|min)?/i.exec(t);
    if (!m) return null;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
    if (base === undefined) return null;
    const sinal = m[2] ? (m[2].indexOf('#') >= 0 ? 1 : -1) : 0;
    const menor = !!m[3];
    const nome = m[1].toUpperCase() + (sinal === 1 ? '#' : sinal === -1 ? 'b' : '') + (menor ? 'm' : '');
    return { pc: M.mod12(base + sinal), modo: menor ? 'minor' : 'major', rotulo: nome };
  }

  /**
   * Quantos tons e quantos cents de uma tonica ate outra.
   *
   * O numero de cents e o que decide o que a pessoa faz com a informacao: meio
   * tom e capotraste, um quarto de tom e cravelha. So o numero de tons deixa
   * essa distincao implicita, e e a distincao que importa no palco.
   */
  function diferenca(origem, destino) {
    // A diferenca com sinal vem primeiro; reducir para 0..11 antes estouraria
    // o sinal e o tritone nao cancelaria na volta: de Do para Fa susteno daria
    // +6, e de Fa susteno para Do tambem +6, mandando para o lado errado.
    const bruto = destino - origem;
    let semitons = bruto;
    if (bruto > 6) semitons = bruto - 12;   // mais curto descendo
    if (bruto < -6) semitons = bruto + 12;  // mais curto subindo
    const cents = Math.round(semitons * 100);
    const plural = Math.abs(semitons) === 1 ? ' tom' : ' tons';
    return {
      semitons: semitons,
      cents: cents,
      mesmo: semitons === 0,
      paraCima: semitons > 0,
      texto: semitons === 0
        ? 'mesmo tom'
        : (semitons > 0 ? '+' : '') + semitons + plural + '  (' + (cents > 0 ? '+' : '') + cents + ' cents)',
      dica: semitons === 0 ? ''
        : semitons < 0 ? 'Afine para baixo, ' + Math.abs(cents) + ' cents.'
          : 'Afine para cima, ' + cents + ' cents.',
    };
  }

  /** Toca uma nota para conferir se o tom alvo e mesmo este. */
  function ouvirTonica(pc, modo) {
    const A = global.Nota;
    if (!A || typeof A.tocarNota !== 'function') { UI.toast('Áudio indisponível', { tipo: 'err' }); return false; }
    const oitava = modo === 'minor' ? 3 : 4;
    const hz = Tuner && Tuner.notaParaHz ? Tuner.notaParaHz(M.mod12(pc), oitava) : null;
    if (!hz) return false;
    // A quinta junto, para dar corpo. Sem ela a nota e fina demais para
    // afinar contra, e a corda parece desafinada por causa do timbre.
    // `puro`: aqui o tom e a referencia que a pessoa compara com a corda.
    // Um violao com harmonicos no meio faz a corda parecer mais afinada do
    // que esta — que e justamente o erro que a tela existe para corrigir.
    A.tocarNota(hz, 1.6, { volume: 0.24, puro: true });
    return true;
  }

  function conversor() {
    const wrap = el('div', { class: 'emg-bloco' });
    const saida = el('div', { class: 'emg-saida' });

    const entrada = el('input', {
      class: 'input', placeholder: 'Ex.: Am', maxlength: '6',
      autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
      'aria-label': 'Tônica de origem',
    });
    const alvo = el('input', {
      class: 'input', placeholder: 'Ex.: C', maxlength: '6',
      autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
      'aria-label': 'Tônica desejada',
    });

    function calcular() {
      const a = parseTon(entrada.value);
      const b = parseTon(alvo.value);
      U.clear(saida);

      if (!a && !b) {
        saida.appendChild(el('p', { class: 'fs-xs muted' },
          'Digite a tônica de origem e a que você quer tocar.'));
        return;
      }
      if (!a) { saida.appendChild(el('p', { class: 'fs-xs muted' }, 'A tônica de origem não foi entendida.')); return; }
      if (!b) { saida.appendChild(el('p', { class: 'fs-xs muted' }, 'A tônica desejada não foi entendida.')); return; }

      const d = diferenca(a.pc, b.pc);
      saida.appendChild(el('div', { class: 'emg-resultado' + (d.mesmo ? ' igual' : '') }, [
        el('div', { class: 'emg-grande' }, a.rotulo + '  >  ' + b.rotulo),
        el('div', { class: 'emg-sub' }, d.texto),
        d.dica ? el('div', { class: 'fs-xs muted mt-1' }, d.dica) : null,
      ]));
      saida.appendChild(el('button', {
        class: 'btn btn-secondary btn-sm mt-3',
        onclick: function () {
          if (!ouvirTonica(b.pc, b.modo)) UI.toast('Não foi possível tocar aqui', { tipo: 'err' });
        },
      }, [el('i', { 'data-lucide': 'volume-2' }), 'Ouvir ' + b.rotulo]));
    }

    [entrada, alvo].forEach(function (campo) {
      campo.addEventListener('input', U.debounce(calcular, 120));
      campo.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); calcular(); }
      });
    });

    wrap.appendChild(el('div', { class: 'row gap-2' }, [
      el('div', { class: 'grow' }, [el('label', { class: 'label' }, 'Está em'), entrada]),
      el('div', { class: 'grow' }, [el('label', { class: 'label' }, 'Quer tocar em'), alvo]),
    ]));
    wrap.appendChild(saida);

    // Atalho por tom: num teclado de celular, acertar o susteno digitando "#"
    // e o que faz a pessoa desistir.
    const rapido = el('div', { class: 'chips mt-3' });
    ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].forEach(function (t) {
      rapido.appendChild(el('button', {
        class: 'chip', type: 'button',
        onclick: function () {
          if (!entrada.value) entrada.value = t; else alvo.value = t;
          calcular();
        },
      }, t));
    });
    wrap.appendChild(el('label', { class: 'label mt-3' }, 'Ou toque o tom'));
    wrap.appendChild(rapido);

    return wrap;
  }

  /* =======================================================
     BUSCA
     ======================================================= */

  function busca() {
    const wrap = el('div', { class: 'emg-bloco' });
    const campo = el('input', {
      class: 'input', placeholder: 'Ex.: Evidencias Titans',
      autocomplete: 'off', 'aria-label': 'O que procurar',
    });
    const lista = el('div', { class: 'emg-fontes' });
    let termo = '';

    function pintar() {
      U.clear(lista);
      if (!termo) {
        lista.appendChild(el('p', { class: 'fs-xs muted' },
          'Escreva o nome e o app pergunta onde você quer procurar.'));
        return;
      }
      lista.appendChild(el('label', { class: 'label mt-2' }, 'Onde procurar "' + termo + '"?'));
      FONTES.forEach(function (f) {
        lista.appendChild(el('a', {
          class: 'emg-fonte', href: urlDe(f.id, termo), target: '_blank', rel: 'noopener noreferrer',
        }, [
          el('i', { 'data-lucide': f.icone }),
          el('div', { class: 'grow', style: { minWidth: '0' } }, [
            el('div', { class: 'n' }, f.nome),
            el('div', { class: 'a' }, f.desc),
          ]),
          el('i', { 'data-lucide': 'external-link' }),
        ]));
      });
    }

    campo.addEventListener('input', U.debounce(function () {
      termo = campo.value.trim();
      pintar();
    }, 160));

    wrap.appendChild(el('label', { class: 'label' }, 'O que você procura?'));
    wrap.appendChild(campo);
    wrap.appendChild(lista);
    pintar();
    return wrap;
  }

  function abrir() {
    const corpo = el('div', { class: 'stack gap-4' }, [
      el('div', {}, [
        el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'audio-lines' }), 'Conversor de tom']),
        conversor(),
      ]),
      el('div', {}, [
        el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'search' }), 'Pesquisar']),
        busca(),
      ]),
      el('div', {}, [
        el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'audio-lines' }), 'Afinador']),
        el('button', {
          class: 'btn btn-secondary btn-block',
          onclick: function () {
            document.querySelectorAll('.scrim').forEach(function (s) { s.click(); });
            setTimeout(function () { V.afinador && V.afinador.abrir(); }, 220);
          },
        }, [el('i', { 'data-lucide': 'audio-lines' }), 'Abrir o afinador']),
      ]),
    ]);

    const h = UI.sheet({ title: 'Emergência', sub: 'tom, busca e afinador', wide: true, body: corpo });
    UI.icons(corpo);
    const primeiro = corpo.querySelector('input');
    if (primeiro) setTimeout(function () { primeiro.focus(); }, 140);
    return h;
  }

  V.emergencia = {
    abrir: abrir,
    FONTES: FONTES,
    urlDe: urlDe,
    diferenca: diferenca,
    parseTon: parseTon,
  };

  global.AcordEmergencia = V.emergencia;
  // Sem isto, nenhum teste alcanca o conversor: o resto do app so aparece no
  // navegador, e o calculo de quantos tons e exatamente o que nao pode ficar
  // sem verificacao.
  if (typeof module !== 'undefined' && module.exports) module.exports = V.emergencia;
})(typeof window !== 'undefined' ? window : globalThis);