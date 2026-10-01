/* =========================================================
   ACORDE - views/cancao.js
   A pagina da musica: tudo sobre uma musica, num lugar so.

   Antes, a informacao de uma musica estava espalhada e parte dela nao estava
   em lugar nenhum. A cifra abria numa folha com o texto; as observacoes, a
   foto e o desenho viviam no Estudio, que so aparecia quando ja sabia a
   musica; o video era um botao que jogava para fora do app. Era possivel ter
   uma musica com anotacao e nao ter onde ve-la.

   Aqui cabe tudo: o video tocando, o compasso, a rolagem, o tom que se
   OUVE, a foto com o que voce desenhou por cima, e o que voce anotou.
   --------------------------------------------------------- */
(function (global) {
  'use strict';

  const V = global.Views || (global.Views = {});
  const U = global.Utils;
  const S = global.Store;
  const UI = global.UI;
  const R = global.Render;
  const M = global.Music;
  const Lk = global.Links;
  const Tuner = global.Tuner;
  const { el } = U;

  /* =======================================================
     O TOM QUE SE OUVE
     =======================================================
     A implementacao mora em Render, porque o botao e usado em varios lugares:
     a pagina da musica, a teoria, o circulo, a cifra. Uma copia em cada tela
     comeca a divergir no primeiro ajuste, e a divergencia aparece como "o
     tom soa diferente nesta tela", que e o tipo de defeito que faz a pessoa
     desconfiar do app inteiro. */

  function botaoTom(pc, modo, rotulo, opts) {
    return R.botaoTom(pc, modo, rotulo, opts);
  }

  /* =======================================================
     O VIDEO
     ======================================================= */

  /**
   * O cartao do YouTube.
   *
   * O video entra dentro do app, e nao como botao que joga para fora. Quem
   * esta ensaiando nao quer perder a cifra da tela para ver o clipe, e trocar
   * de aba no celular significa perder o que estava tocando.
   *
   * O `origin` vai no endereco porque o YouTube exige. Sem ele, o video abre
   * numa moldura de origem nula e some em metade dos navegadores.
   */
  function cartaoVideo(musica, cifra) {
    const fonte = musica && (musica.yt || musica.ytId);
    const titulo = (musica && musica.nome) || (cifra && cifra.titulo) || '';
    const artista = (musica && musica.artista) || (cifra && cifra.artista) || '';

    // So o video COLADO entra. Nao se adivinha qual gravacao e a certa pelo
    // titulo:errar aqui significa tocar a versao errada no meio do ensaio, e o
    // musician nao tem como saber de primeira. A busca fica logo abaixo, com o
    // nome ja escrito, para ele escolher.
    const id = Lk.extrairYouTubeId(fonte);

    const wrap = el('div', { class: 'vid-card' });

    if (id) {
      const iframe = el('iframe', {
        class: 'vid-frame',
        src: 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&modestbranding=1&playsinline=1',
        title: 'Video: ' + titulo,
        loading: 'lazy',
        referrerpolicy: 'strict-origin-when-cross-origin',
        allow: 'accelerometer; encrypted-media; picture-in-picture; clipboard-write',
        allowfullscreen: true,
      });
      wrap.appendChild(iframe);
      wrap.appendChild(el('div', { class: 'vid-pe' }, [
        el('span', { class: 'grow ellipsis' }, titulo),
        el('a', {
          class: 'vid-abrir', href: 'https://www.youtube.com/watch?v=' + id,
          target: '_blank', rel: 'noopener noreferrer', title: 'Abrir no YouTube',
        }, [el('i', { 'data-lucide': 'external-link' })]),
      ]));
      return wrap;
    }

    // Sem video: a busca, em vez de um buraco.
    wrap.appendChild(el('div', { class: 'vid-vazio' }, [
      el('i', { 'data-lucide': 'youtube', style: { width: '22px', height: '22px' } }),
      el('span', { class: 'fs-sm' }, 'Nenhum video colado nesta musica'),
      el('a', {
        class: 'btn btn-secondary btn-sm',
        href: Lk.buscaYouTube(titulo, artista), target: '_blank', rel: 'noopener noreferrer',
      }, [el('i', { 'data-lucide': 'search' }), 'Procurar no YouTube']),
    ]));
    return wrap;
  }

  /* =======================================================
     O COMPASSO JUNTO DA ROLAGEM
     ======================================================= */

  /**
   * Metronomo que acompanha a rolagem.
   *
   * Sao dois relogios que precisam andar juntos: o da rolagem, que diz qual
   * linha de acordes e a de agora, e o do metrônomo, que marca o tempo. Se
   * ficarem separados, a pessoa conta o compasso no ouvido enquanto olha a
   * linha errada — e perde a conta no segundo verso.
   *
   * Por isso o compasso NAO e um botao separado: ele entra na barra da
   * rolagem, com o andamento da musica, e anda junto.
   */
  function reguaCompasso(bpm, compasso) {
    const Metro = global.Metro;
    const wrap = el('div', { class: 'mbpm' });
    if (!Metro) return wrap;

    const mostrar = bpm ? bpm : 100;
    wrap.appendChild(el('button', {
      class: 'mbpm-btn', type: 'button', 'aria-label': 'Tocar o compasso',
      onclick: function () { Metro.alternar(); pintar(); },
    }, [el('i', { 'data-lucide': 'play' })]));

    const num = el('span', { class: 'mbpm-num' }, String(mostrar));
    wrap.appendChild(el('span', { class: 'mbpm-ajuste' }, [
      el('button', { type: 'button', 'aria-label': 'Diminuir andamento',
        onclick: function () { Metro.definir('bpm', U.clamp(Metro.METRONOME.bpm - 1, 20, 320)); pintar(); } }, '−'),
      num,
      el('button', { type: 'button', 'aria-label': 'Aumentar andamento',
        onclick: function () { Metro.definir('bpm', U.clamp(Metro.METRONOME.bpm + 1, 20, 320)); pintar(); } }, '+'),
    ]));
    wrap.appendChild(el('span', { class: 'mbpm-compasso' }, (compasso || '4/4')));
    wrap.appendChild(el('span', { class: 'fs-xs muted' }, 'bpm'));

    function pintar() {
      const tocando = Metro.METRONOME.tocando;
      const b = wrap.querySelector('.mbpm-btn');
      U.clear(b);
      b.appendChild(el('i', { 'data-lucide': tocando ? 'pause' : 'play' }));
      b.classList.toggle('ligado', !!tocando);
      num.textContent = String(Metro.METRONOME.bpm);
    }

    wrap.dataset.pintar = '1';
    // O estado do metrônomo muda fora daqui (atalho, outros lugares), entao a
    // pintura acompanha o intervalo dele e nao a cada evento.
    const timer = global.setInterval(pintar, 400);
    wrap.dataset.timer = String(timer);
    pintar();
    return wrap;
  }

  /* =======================================================
     AS ANOTACOES
     ======================================================= */

  /**
   * As observacoes da musica.
   *
   * Ficavam no modelo e nao apareciam em lugar nenhum. Uma anotacao que so
   * existe no armazenamento e nao e anotacao, e dado esquecido — a pessoa
   * escreve "ver a segunda vez mais lenta", fecha, e nao lembra mais.
   */
  function blocoObs(musica, escala) {
    const obs = String((musica && musica.obs) || '').trim();
    if (!obs) return null;
    return el('div', { class: 'obs-bloco' }, [
      el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'sticky-note' }), 'Observacoes']),
      el('pre', { class: 'obs-texto' }, obs),
      escala ? el('div', { class: 'fs-xs muted mt-1' }, 'de ' + escala.titulo + (escala.data ? ', ' + escala.data : '')) : null,
    ]);
  }

  /* =======================================================
     A FOTO E O DESENHO
     ======================================================= */

  function blocoFoto(musica, escala) {
    const foto = String((musica && musica.foto) || '').trim();
    const wrap = el('div', {});
    wrap.appendChild(el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'image' }), 'Foto e desenho']));
    if (!foto) {
      wrap.appendChild(el('p', { class: 'fs-sm muted' }, 'Sem foto anexada a esta musica.'));
    } else {
      const img = el('img', { class: 'foto-cheia', src: foto, alt: 'Foto da partitura' });
      wrap.appendChild(img);
      wrap.appendChild(el('p', { class: 'fs-xs muted' }, 'Abrir o Estudio para desenhar por cima.'));
    }
    wrap.appendChild(el('button', {
      class: 'btn btn-soft btn-sm mt-2',
      onclick: function () {
        if (!global.Studio || !musica) { UI.toast('Estudio indisponivel', { tipo: 'err' }); return; }
        document.querySelectorAll('.scrim').forEach(function (s) { s.click(); });
        setTimeout(function () { global.Studio.abrir(musica, escala); }, 240);
      },
    }, [el('i', { 'data-lucide': 'pen-tool' }), 'Abrir o Estudio']));
    return wrap;
  }

  /* =======================================================
     A PAGINA
     ======================================================= */

  function abrir(musica, escala, cifra) {
    const mus = musica || {};
    const cif = cifra || S.cifraPorId(mus.cifraId) || null;
    const titulo = mus.nome || (cif && cif.titulo) || 'Musica';
    const artista = mus.artista || (cif && cif.artista) || '';

    const corpo = el('div', { class: 'stack gap-4 song-page' });

    /* ---- cabecalho: os dados, com o tom que se ouve ---- */
    const detectado = M.detectKey((cif && cif.cifra) || '');
    const tomDeclarado = M.parseChord(String(mus.tom || (cif && cif.tom) || '').trim());

    // O titulo NAO e repetido aqui. O cabecalho da folha ja mostra nome e artista,
// e repetir os dois deixava a tela comecar com o mesmo texto duas vezes, uma
// na barra e outra logo abaixo — o que parece defeito, e e.
const cabecalho = el('div', { class: 'song-head' });

    // O tom que se ouve. Prioridade: o declarado na musica, o da cifra, e o
    // detectado pelo accordion. O declarado ganha porque quem escreveu sabe
    // melhor do que a analise estatistica.
    const tomUsado = tomDeclarado
      ? { pc: tomDeclarado.root, modo: tomDeclarado.quality === 'm' ? 'minor' : 'major', rotulo: tomDeclarado.text }
      : detectado
        ? { pc: detectado.pc, modo: detectado.mode, rotulo: M.noteName(detectado.pc, M.useFlatsFor(detectado.pc)) + (detectado.mode === 'minor' ? ' menor' : ' maior') }
        : null;

    if (tomUsado) {
      cabecalho.appendChild(el('div', { class: 'sh-tons' }, [
        botaoTom(tomUsado.pc, tomUsado.modo, tomUsado.rotulo, { oitava: 3 }),
        botaoTom(M.relativeMajor(tomUsado.pc), 'major',
          'relativo maior: ' + M.noteName(M.relativeMajor(tomUsado.pc), M.useFlatsFor(M.relativeMajor(tomUsado.pc))),
          { oitava: 3 }),
      ]));
    }
    corpo.appendChild(cabecalho);

    /* ---- os numeros ----
       O quarto numero ja foi a "Afinidade", que era o score interno do
       `detectKey` multiplicado por dez: 1087 nao diz nada para ninguem, e
       qualquer numero alto ali parece defeito. No lugar dele vai a checagem
       que serve: o tom que a pessoa escreveu bate com o tom que a cifra
       suggeste? Divergencia aqui significa que o campo do tom esta errado —
       e e exatamente o erro que faz o grupo inteiro tocar na tonalidade
       errada sem ninguem perceber. */
    const bpm = Number(mus.bpm || (cif && cif.bpm)) || 0;
    const acordeUnicos = cif ? new Set(M.extractChords(cif.cifra).map(function (x) { return x.text; })).size : 0;
    const batem = (tomUsado && detectado)
      ? (tomUsado.pc === detectado.pc && tomUsado.modo === detectado.mode)
      : null;

    corpo.appendChild(el('div', { class: 'numeros' }, [
      numero(bpm, 'BPM'),
      numero(cif ? M.extractChords(cif.cifra).length : 0, 'Acordes'),
      numero(acordeUnicos, 'Distintos'),
      checagem(batem),
    ]));

    /* ---- o video, tocando ---- */
    corpo.appendChild(cartaoVideo(mus, cif));

    /* ---- o compasso ---- */
    corpo.appendChild(el('div', {}, [
      el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'timer' }), 'Compasso']),
      reguaCompasso(bpm, mus.compasso || (cif && cif.compasso)),
    ]));

    /* ---- a letra e as observacoes ---- */
    const letra = String(mus.letra || (cif && cif.letra) || '').trim();
    if (letra) {
      corpo.appendChild(el('div', {}, [
        el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'align-left' }), 'Letra']),
        el('pre', { class: 'cifra-text lyric', style: { whiteSpace: 'pre-wrap' } }, letra),
      ]));
    }
    const obs = blocoObs(mus, escala);
    if (obs) corpo.appendChild(obs);

    /* ---- a rolagem ---- */
    if (cif && String(cif.cifra || '').trim()) {
      corpo.appendChild(el('div', {}, [
        el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'align-vertical-justify-center' }), 'Rolagem automatica']),
        R.painelRolagem(cif.cifra, {
          bpm: bpm || (cif.bpm),
          compasso: mus.compasso || cif.compasso,
          fator: cif.estudo && cif.estudo.velocidade ? cif.estudo.velocidade : 1,
          estudo: cif.estudo,
        }),
      ]));
    } else {
      corpo.appendChild(el('div', { class: 'card' }, [
        el('p', { class: 'fs-sm muted' }, 'Esta musica ainda nao tem cifra vinculada.'),
      ]));
    }

    /* ---- a foto ---- */
    corpo.appendChild(blocoFoto(mus, escala));

    /* ---- links ---- */
    const fontes = Lk.de(titulo, artista);
    if (fontes.length) {
      corpo.appendChild(el('div', {}, [
        el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'external-link' }), 'Onde mais achar']),
        el('div', { class: 'row gap-2 wrap' }, fontes.map(function (f) {
          return el('button', {
            class: 'st-link', style: { '--c': f.cor }, type: 'button', title: f.descricao,
            onclick: function () { Lk.abrir(f.id, titulo, artista); },
          }, [el('i', { 'data-lucide': f.icone }), el('span', {}, f.curto)]);
        })),
      ]));
    }

    const h = UI.sheet({
      title: titulo, sub: artista || 'Musica', wide: true, body: corpo,
      foot: [
        el('button', { class: 'btn btn-secondary', onclick: function () { h.close(); } }, 'Fechar'),
      ],
    });
    UI.icons(corpo);
    return h;
  }

  function numero(valor, rotulo) {
    const v = Number(valor) || 0;
    return el('div', {}, [
      el('div', { class: 'v' + (v === 0 ? ' zero' : '') }, String(v)),
      el('div', { class: 'k' }, rotulo),
    ]);
  }

  /**
   * A celula que confere o tom.
   *
   * `null` e o caso comum: nao ha cifra, ou nao ha tom declarado, e nao ha o
   * que comparar. Mostrar "0" ali seria inventar um erro que nao existe.
   */
  function checagem(batem) {
    if (batem === null) {
      return el('div', { title: 'Sem tom declarado para comparar' }, [
        el('div', { class: 'v zero' }, '—'),
        el('div', { class: 'k' }, 'Tom'),
      ]);
    }
    return el('div', { title: batem ? 'O tom declarado bate com a cifra' : 'O tom declarado NAO bate com a cifra' }, [
      el('div', { class: 'v chk ' + (batem ? 'ok' : 'ruim') }, batem ? 'ok' : '!'),
      el('div', { class: 'k' }, 'Tom'),
    ]);
  }

  V.cancao = { abrir: abrir, botaoTom: botaoTom, cartaoVideo: cartaoVideo };

  global.AcordMusica = V.cancao;
  if (typeof module !== 'undefined' && module.exports) module.exports = V.cancao;
})(typeof window !== 'undefined' ? window : globalThis);