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
  const Gravador = global.Gravador;
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
      /* A URL vem de `Lk.embedYouTube`, e nao e montada aqui.
       *
       * A versao anterior escrevia o endereco a mao:
       * `'/embed/' + id + '?...'`. Funcionava, porque `id` ja saiu validado do
       * `extrairYouTubeId` — mas perdia o `encodeURIComponent` que o helper
       * aplica, e criava um segundo lugar onde a regra do video mora. Duas
       * copias da mesma regra divergem no primeiro ajuste, e a divergencia
       * aparece como "o video abre em um lugar e nao no outro".
       *
       * O mesmo vale para o link de abrir: `urlYouTube` monta a URL de
       * visualizacao a partir do mesmo id, e sabe fazer isso para o link curto
       * tambem. */
      const iframe = el('iframe', {
        class: 'vid-frame',
        src: Lk.embedYouTube(id),
        title: 'Vídeo: ' + titulo,
        loading: 'lazy',
        referrerpolicy: 'strict-origin-when-cross-origin',
        allow: 'accelerometer; encrypted-media; picture-in-picture; clipboard-write; fullscreen',
      });
      wrap.appendChild(iframe);
      wrap.appendChild(el('div', { class: 'vid-pe' }, [
        el('span', { class: 'grow ellipsis' }, titulo),
        el('a', {
          class: 'vid-abrir', href: Lk.urlYouTube(fonte),
          target: '_blank', rel: 'noopener noreferrer', title: 'Abrir no YouTube',
        }, [el('i', { 'data-lucide': 'external-link' })]),
      ]));
      return wrap;
    }

    // Sem video: a busca, em vez de um buraco.
    wrap.appendChild(el('div', { class: 'vid-vazio' }, [
      el('i', { 'data-lucide': 'youtube', style: { width: '22px', height: '22px' } }),
      el('span', { class: 'fs-sm' }, 'Nenhum vídeo colado nesta música'),
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
  function reguaCompasso(bpm, compasso, folha) {
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
    /* O estado do metrônomo muda fora daqui (atalho, outros lugares), entao a
       pintura acompanha o intervalo dele e nao a cada evento.

       O intervalo e registrado na folha para morrer com ela. Sem isso, abrir a
       pagina da musica dez vezes no dia deixava dez timers de 400 ms pintando
       elementos que ja sairam da tela — trabalho que continua rodando, sem
       ninguem ver, e sem nenhuma pista de onde veio. */
    const timer = global.setInterval(pintar, 400);
    UI.limparNoClose(folha, timer);
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
      el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'sticky-note' }), 'Observações']),
      el('pre', { class: 'obs-texto' }, obs),
      escala ? el('div', { class: 'fs-xs muted mt-1' }, 'de ' + escala.titulo + (escala.data ? ', ' + escala.data : '')) : null,
    ]);
  }

  /* =======================================================
     A FOTO E O DESENHO
     ======================================================= */

  function blocoFoto(musica, escala, aoSalvar) {
    const foto = String((musica && musica.foto) || '').trim();
    const wrap = el('div', {});
    wrap.appendChild(el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'image' }), 'Foto e desenho']));
    if (!foto) {
      wrap.appendChild(el('p', { class: 'fs-sm muted' }, 'Sem foto anexada a esta música.'));
    } else {
      const img = el('img', { class: 'foto-cheia', src: foto, alt: 'Foto da partitura' });
      wrap.appendChild(img);
      wrap.appendChild(el('p', { class: 'fs-xs muted' }, 'Abrir o Estúdio para desenhar por cima.'));
    }
    wrap.appendChild(el('button', {
      class: 'btn btn-soft btn-sm mt-2',
      onclick: function () {
        if (!global.Studio || !musica) { UI.toast('Estúdio indisponível', { tipo: 'err' }); return; }
        document.querySelectorAll('.scrim').forEach(function (s) { s.click(); });
        setTimeout(function () { global.Studio.abrir(musica, escala, aoSalvar); }, 240);
      },
    }, [el('i', { 'data-lucide': 'pen-tool' }), 'Abrir o Estúdio']));
    return wrap;
  }

  /* =======================================================
     A PAGINA
     ======================================================= */

/* =========================================================
     A FAIXA NARRADA

     A voz que a pessoa gravou guiando o ensaio: "refrão em 1, 2, 3, 4",
     "virada da bateria, e para tudo".

     Fica junto do video, do andamento e do tom — e nao numa tela a parte,
     porque e a mesma coisa que eles: o que a pessoa precisa na hora de tocar.
     =========================================================== */
  function blocoVS(musica, escala, aoMudar) {
    const wrap = el('div', { class: 'vs-bloco' });

    /*
     * O bloco se redesenha depois de cada mudanca, em vez de confiar que quem
     * chamou vai redesenhar a pagina.
     *
     * Sem isto, gravar funcionava e a tela nao mudava: a folha da gravacao
     * fechava, o audio estava salvo, e a pagina continuava mostrando "Gravar a
     * faixa" como se nada tivesse acontecido. A pessoa gravaria de novo, e de
     * novo, ate achar que o microfone estava com defeito. E o pior: o app
     * estava certo e parecia errado — o pior tipo de defeito.
     *
     * Quem redesenha e o proprio bloco, sobre o proprio espaco. Nada mais
     * precisa saber disso: a folha da gravacao, o apagamento e a edicao do texto
     * gravam, gravam de novo, e o bloco aparece no estado certo.
     */
    function montar() {
      U.clear(wrap);
      const tem = !!(musica.vs || musica.vsTexto);

      wrap.appendChild(el('div', { class: 'section-title' }, [
        el('i', { 'data-lucide': 'mic' }), 'Faixa narrada',
      ]));

      if (!tem) {
        wrap.appendChild(el('p', { class: 'fs-sm muted' },
          'Grave a própria voz dizendo o que acontece em cada parte — '
          + 'refrão, virada, volta. A faixa toca junto enquanto você toca.'));
        wrap.appendChild(botaoGravarVS(musica, salvar));
        return;
      }

      /* ---- o audio ---- */
      let player = null;
      if (musica.vs) {
        // `audio`, e nao `áudio`. O acento na tag cria um elemento HTML
        // desconhecido em vez de um `<audio>`: o navegador aceita o elemento
        // em silencio, e ele nunca toca nem mostra os controles. O bloco
        // aparecia com o texto da passagem e um retangulo vazio onde deveria
        // estar o player — com o `tem` logo acima dizendo que havia gravacao.
        player = el('audio', {
          class: 'vs-audio', src: musica.vs, controls: true, preload: 'metadata',
          'aria-label': 'Faixa narrada de ' + (musica.nome || 'esta música'),
        });
        wrap.appendChild(player);
      }

      /* ---- os capitulos ----
       *
       * Onde comeca cada parte. Quem ensaia sozinho chega na parte dois de uma
       * faixa de tres minutos sem ter com quem combinar o tempo, e recomeca do
       * zero — que e o que torna a gravacao inutil depois da primeira vez.
       *
       * O indice e um botao por capitulo, e o botao e o proprio audio: nao ha
       * relogio para marcar a nada, e o tempo sai do player. */
      const caps = S.normVsCapitulos(musica.vsCap);
      if (caps.length && player) {
        wrap.appendChild(el('label', { class: 'label mt-3' }, 'Ir para'));
        wrap.appendChild(el('div', { class: 'vs-cap' }, caps.map(function (c) {
          return el('button', {
            class: 'vs-cap-btn', type: 'button',
            /* O tempo esta no rotulo, e nao so no `title`: quem navega por
             * teclado ou leitor de tela precisa ouvir para onde vai, e so o
             * `title` nao e lido de forma confiavel.
             *
             * O nome vem primeiro, como na fala. "Entrada solo, 0:08" e o que a
             * pessoa diria; "0:08, entrada solo" comeca no numero e obriga a
             * traduzir antes de entender. */
            'aria-label': c.texto + ', ' + Gravador.relogio(c.t),
            title: Gravador.relogio(c.t) + ' — ' + c.texto,
            onclick: function () {
              // Voltar ao inicio antes de buscar: sem isto, um capitulo com o
              // tempo exato fica colado no anterior e o play nao anda.
              player.currentTime = Math.max(0, c.t - 0.05);
              player.play().catch(function () { /* o navegador pode negar; o tempo ja foi posto */ });
            },
          }, [
            el('span', { class: 'vs-cap-t' }, Gravador.relogio(c.t)),
            el('span', { class: 'vs-cap-n' }, c.texto),
          ]);
        })));
      }

      /* ---- o texto da passagem ---- */
      // O texto e o que permite ler sem dar play, e o que a pessoa ve enquanto
      // a faixa toca de fundo.
      const texto = el('textarea', {
        class: 'textarea vs-texto', rows: '4',
        placeholder: 'O que você fala. Ex.: "Refrao em 1,2,3,4. Virada da bateria, para tudo em 1,2,3,4. Voltou."',
      });
      texto.value = musica.vsTexto || '';
      texto.addEventListener('change', function () {
        musica.vsTexto = texto.value;
        salvar();
      });
      wrap.appendChild(el('label', { class: 'label mt-2' }, 'A passagem'));
      wrap.appendChild(texto);

      const meta = [];
      if (musica.vsSeg) meta.push(Gravador.relogio(musica.vsSeg));
      if (musica.vs) meta.push(Math.round(Gravador.tamanhoDe(musica.vs) / 1024) + ' KB');
      wrap.appendChild(el('div', { class: 'row gap-2 mt-2 wrap' }, [
        meta.length ? el('span', { class: 'badge' }, meta.join(' · ')) : null,
        // O rotulo segue o que existe. Depois de apagar a gravacao sobra o
        // texto, e o bloco precisa oferecer a gravacao de novo — senao a pessoa
        // ficava presa num estado sem audio e sem botao para gravar.
        botaoGravarVS(musica, salvar, musica.vs ? 'Regravar' : 'Gravar a faixa'),
        musica.vs ? el('button', {
          class: 'btn btn-secondary btn-sm',
          onclick: function () {
            musica.vs = '';
            musica.vsSeg = 0;
            /* Os capitulos vao junto com o audio que os marcava.
             *
             * Deixa-los seria pior que um defeito: os botoes continuariam
             * apontando para tempos de um audio que nao existe mais, e clicar
             * neles nao faria nada. A pessoa veria um indice de seis partes de
             * uma faixa apagada, e pensaria que o app perdeu a gravacao outra
             * vez. Sao duas linhas e evitam um estado que so existe no bug. */
            musica.vsCap = [];
            salvar();
            UI.toast('Gravação apagada. O texto da passagem continua.', { tipo: 'ok' });
          },
        }, [el('i', { 'data-lucide': 'trash-2' }), 'Apagar a gravação']) : null,
      ]));
    }

    /** Grava no evento e redesenha o bloco.
     *
     * `aoMudar` recebe a ficha — a mesma que o bloco leu. Sem isso, quem chamou
     * nao tem como saber o que mudou: ele abriu a tela com a musica da escala,
     * que nao tem a gravacao, e a ficha que tem esta e um objeto separado.
     * Gravar nela e nada: o audio seria perdido ao fechar a folha. */
    function salvar() {
      aoMudar(musica);
      montar();
    }

    montar();
    return wrap;
  }

  /* ===========================================================
     GRAVAR

     Antes de pedir o microfone, a pessoa ve o que vai acontecer. O navegador
     mostra a propria janela de permissao logo depois, e a duplicidade e
     proposital: a do navegador diz "queremos usar o microfone" e nao explica
     para que serve, nem o que acontece com o que for gravado.

     Um app que explica antes de pedir ganha o direito de pedir. Um que pede
     sem explicar ensina a pessoa a aceitar tudo, e no dia em que precisar
     mesmo de uma permissao, ela nao vai ler mais.
     =========================================================== */
  function botaoGravarVS(musica, aoMudar, rotulo) {
    return el('button', {
      class: 'btn btn-soft btn-sm mt-2',
      onclick: function () { folhaGravarVS(musica, aoMudar); },
    }, [el('i', { 'data-lucide': 'mic' }), rotulo || 'Gravar a faixa']);
  }

  function folhaGravarVS(musica, aoMudar) {
    const disp = Gravador.disponivel();
    if (!disp.ok) { UI.toast(disp.motivo, { tipo: 'err' }); return; }

    const corpo = el('div', { class: 'stack gap-3' });

    corpo.appendChild(el('p', { class: 'fs-sm' }, [
      el('strong', {}, 'O que o navegador vai pedir: '),
      'acesso ao microfone, só enquanto a gravação estiver aberta.',
    ]));

    corpo.appendChild(el('div', { class: 'aviso-perm' }, [
      el('div', { class: 'linha' }, [
        el('i', { 'data-lucide': 'smartphone' }),
        el('span', {}, 'Fica no aparelho. Não há servidor, não há upload, e nada sai sem você mandar.'),
      ]),
      el('div', { class: 'linha' }, [
        el('i', { 'data-lucide': 'trash-2' }),
        el('span', {}, 'Você pode apagar a qualquer momento, aqui ou em Ajustes.'),
      ]),
    ]));

    /* ESPAÇO ANTES DE GRAVAR, E NÃO DEPOIS
     *
     * A pessoa abre esta folha, segura o celular por três minutos falando, e
     * só descobre que não coube quando a gravação já foi feita e o áudio
     * some. O aviso de espaço cheio existe — mas chega tarde, e depois do
     * trabalho.
     *
     * Aqui a pessoa vê quanto sobra, em segundos de áudio, antes de apertar
     * qualquer coisa. É a mesma conta que o `salvar` vai fazer: quatro
     * caracteres guardados por três de áudio.
     *
     * O texto muda com o estado, e o estado não é porcentagem arbitrária:
     * "normal" com mais de um terço livre, "atenção" com pouco, "cheio" quando
     * nem 30 segundos cabem — que é a gravação mais curta que serve para
     * alguma coisa. */
    const espaco = S.espacoParaGravacao ? S.espacoParaGravacao() : null;
    if (espaco) {
      const minutos = Math.floor(espaco.segundosQueCabem / 60);
      const segundos = espaco.segundosQueCabem % 60;
      const duracao = minutos ? minutos + ' min ' + segundos + ' s' : segundos + ' s';
      if (espaco.estado === 'cheio') {
        corpo.appendChild(el('div', { class: 'aviso-perm', role: 'alert' }, [
          el('div', { class: 'linha' }, [
            el('i', { 'data-lucide': 'hard-drive' }),
            el('span', {}, 'O espaço do Clave está cheio. Apague uma gravação antiga em Ajustes '
              + 'antes de gravar — senão esta gravação não vai caber.'),
          ]),
        ]));
      } else if (espaco.estado === 'atencao') {
        corpo.appendChild(el('p', { class: 'fs-xs muted' },
          'Cabe agora cerca de ' + duracao + ' de gravação. Apagar uma gravação antiga '
          + 'libera espaço em Ajustes.'));
      } else {
        corpo.appendChild(el('p', { class: 'fs-xs muted' },
          'Espaço para gravações: cerca de ' + duracao + '.'));
      }
    }

    const dica = el('p', { class: 'fs-xs muted' },
      'Fale no ritmo: e a sua voz que marca o tempo. "Refrao em 1,2,3,4", '
      + '"virada da bateria, para tudo", "voltou" — na contagem, como você canta.');

    // `text`, e nao `textContent`: o construtor de elemento so conhece algumas
    // chaves para conteudo. Passando `textContent`, ele cria um atributo com
    // esse nome e o elemento fica vazio — sem erro e sem aviso. Foi o que
    // aconteceu: o relogio da gravacao aparecia como um retangulo vazio.
    const relogio = el('div', { class: 'vs-relogio', text: '0:00' });
    const barra = el('div', { class: 'vs-status' }, relogio);

    /* ---- os capitulos, marcados enquanto se fala ----
     *
     * Dois cliques e um nome. E o que a pessoa precisa: enquanto grava, o
     * microfone esta aberto e a voz esta ocupada, e digitar seria pior do que
     * nao ter o indice.
     *
     * As variacoes ficam aqui fora da montagem porque precisam sobreviver ao
     * redesenho do bloco: a gravacao acontece numa folha, e o bloco se redesenha
     * depois. Se ficassem dentro, cada redesenhe perderia os capitulos que a
     * pessoa ja tinha marcado. */
    let capitulos = S.normVsCapitulos(musica.vsCap);
    let fluxo = null;
    let conta = null;

    /* A gravação que o armazenamento recusou.
     *
     * Sem isto, o botão depois de uma falha ficava com o texto "Tentar salvar
     * de novo" e, ao ser apertado, chamava `comecar()` — abria o microfone e
     * GRAVAVA POR CIMA dos três minutos que a pessoa acabara de falar. O texto
     * prometia uma coisa e o botão fazia outra, e a segunda era a que apagava
     * o trabalho.
     *
     * Com o sinalizador, o botão sabe que há áudio esperando: ele tenta salvar
     * de novo em vez de gravar de novo. E `musica.vs` — que já recebeu o áudio
     * — é o que se tenta gravar. Nada precisa ser copiado nem guardado duas
     * vezes. */
    let pendenteDeSalvar = false;

    /* O aviso fica no painel, e nao dentro da lista.
     *
     * A lista e reescrita a cada capitulo marcado — `U.clear` e remontagem.
     * Com o aviso dentro dela, marcar um capitulo o apagaria e reescreveria
     * junto, e a pessoa veria o texto piscar a cada clique. */
    const avisoCaps = el('span', { class: 'fs-xs muted' },
      'Marque as partes para pular direto para elas depois.');
    const listaCaps = el('div', { class: 'vs-cap-lista' });
    const entradaCap = el('input', {
      class: 'input', type: 'text', maxlength: '60',
      placeholder: 'Nome da parte. Ex.: Refrão',
      'aria-label': 'Nome do capítulo',
    });

    function desenharCaps() {
      /* O aviso so existe enquanto nao ha capitulo. Depois que o primeiro entra,
       * a lista fala por si e o aviso seria ruido. */
      avisoCaps.style.display = capitulos.length ? 'none' : '';

      U.clear(listaCaps);
      if (!capitulos.length) return;
      listaCaps.appendChild(el('div', { class: 'vs-cap-lista' }, capitulos.map(function (c, i) {
        return el('span', { class: 'vs-cap-pill' }, [
          el('span', { class: 'vs-cap-t' }, Gravador.relogio(c.t)),
          el('span', { class: 'vs-cap-n' }, c.texto),
          el('button', {
            class: 'vs-cap-x', type: 'button',
            'aria-label': 'Tirar o capítulo ' + c.texto,
            title: 'Tirar',
            onclick: function () {
              capitulos.splice(i, 1);
              desenharCaps();
            },
          }, '×'),
        ]);
      })));
    }

    /** Marca um capitulo no tempo de agora. */
    function marcar() {
      const texto = entradaCap.value.trim();
      if (!texto) {
        UI.toast('Dê um nome para a parte', { tipo: 'warn', dur: 2500 });
        return;
      }
      if (!fluxo) return;
      capitulos = S.normVsCapitulos(capitulos.concat([{ t: fluxo.segundos(), texto: texto }]));
      entradaCap.value = '';
      desenharCaps();
      relogio.classList.add('pulsa');
      global.setTimeout(function () { relogio.classList.remove('pulsa'); }, 260);
    }

    const botaoMarcar = el('button', {
      class: 'btn btn-secondary', type: 'button', onclick: marcar,
    }, [el('i', { 'data-lucide': 'bookmark-plus' }), 'Marcar aqui']);

    /* O Enter marca. Quem segura o aparelho com uma mao e fala com a outra
     * encontra o Enter mais rapido do que o botao — e marcar e uma acao que se
     * repete dezenas de vezes numa gravacao de tres minutos. */
    entradaCap.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      marcar();
    });

    const painelCaps = el('div', { class: 'vs-cap-painel' }, [
      el('label', { class: 'label' }, 'Onde começa cada parte'),
      el('div', { class: 'row gap-2' }, [entradaCap, botaoMarcar]),
      avisoCaps,
      listaCaps,
    ]);
    desenharCaps();

    /**
     * Tenta gravar de novo o audio que ja esta em `musica.vs`.
     *
     * Nao ha microfone aqui: o audio ja foi capturado e convertido em data URL.
     * O que falta e o armazenamento aceitar — e a pessoa resolve isso apagando
     * uma gravacao antiga e voltando para apertar o botao.
     *
     * `ultimoErro` e lido DEPOIS do `aoMudar`, nunca antes: e o proprio save que
     * o define. Ler antes seria olhar o erro da tentativa anterior e dizer que
     * deu certo quando nao deu — que e exatamente o defeito que esta rodada
     * conserta. */
    function tentarSalvar() {
      aoMudar();
      const erro = typeof S.ultimoErro === 'function' ? S.ultimoErro() : null;
      if (erro === 'cheio' || erro === 'erro') {
        /* `aoMudar` chama `montar()`, que redesenha o bloco e joga fora o `dica`
         * e o `rotuloGravar` que esta folha está segurando. Escrever neles aqui
         * seria escrever em nós soltos: o texto novo nunca apareceria, e o
         * código pareceria funcionar. A folha continua aberta por causa do
         * `return`, que é o que importa — o aviso vai pelo toast. */
        UI.toast('A gravação continua sem ser salva. O espaço do Clave ainda não cabe: '
          + 'apague uma gravação antiga em Ajustes e volte aqui.',
        { tipo: 'err', dur: 6000 });
        return;
      }
      pendenteDeSalvar = false;
      h.close();
      /* `byteLen` e não `length`: o áudio é base64 (ASCII, um byte por
       * caractere), mas a diferença entre contar caracteres e contar bytes é
       * exatamente o tipo de coisa que fica errada quando alguém copia a linha. */
      UI.toast('Faixa gravada e guardada — ' + U.fmtBytes(U.byteLen(musica.vs)) + '.',
        { tipo: 'ok' });
    }

    /* A MESMA PERGUNTA DO `palco.js`, com a MESMA ordem de acoes.
 *
 * Deliberadamente nao extraida para um modulo comum: as duas folhas nao
 * compartilham estado, e um helper que recebe a folha, o sinalizador e a
 * funcao de retentativa acabaria com quatro parametros e nenhuma garantia de
 * que as duas evoluem juntas. O texto e o mesmo porque a situacao e a mesma —
 * e porque dois dialogos diferentes para o mesmo problema fariam a pessoa
 * duvidar de qual deles vale. */
    function perguntarAoSair() {
      if (!pendenteDeSalvar) return true;
      return UI.confirmar({
        title: 'A gravação ainda não foi salva',
        message: 'Ela está só nesta tela. Se você sair agora, pode perdê-la. '
          + 'Você pode tentar salvar de novo, fazer um backup para não perder, '
          + 'ou sair e descartar.',
        acoes: [
          { texto: 'Tentar salvar de novo', valor: 'salvar', classe: 'btn-primary' },
          { texto: 'Fazer backup', valor: 'backup', classe: 'btn-secondary' },
          { texto: 'Continuar aqui', valor: 'continuar', classe: 'btn-secondary' },
          { texto: 'Sair e descartar', valor: 'descartar', classe: 'btn-danger' },
        ],
      }).then(function (resposta) {
        if (resposta === 'continuar' || resposta === false) return false;
        if (resposta === 'descartar') {
          musica.vs = ''; musica.vsSeg = 0;
          pendenteDeSalvar = false;
          h.semGuarda();
          return true;
        }
        if (resposta === 'backup') {
          try {
            const nome = 'clave-backup-' + new Date().toISOString().slice(0, 10) + '.json';
            Utils.download(nome, S.exportar(), 'application/json');
            pendenteDeSalvar = false;
            h.semGuarda();
            return true;
          } catch (e) { return false; }
        }
        tentarSalvar();
        return false;
      });
    }

    const avisaAntesDeSair = function (ev) {
      if (!pendenteDeSalvar) return undefined;
      ev.preventDefault();
      ev.returnValue = '';
      return '';
    };
    global.addEventListener('beforeunload', avisaAntesDeSair);

    async function comecar() {
      /* HA UM AUDIO ESPERANDO: tente salvar, NAO grave por cima.
       *
       * Este era o furo do meu proprio conserto. O botão dizia "Tentar salvar
       * de novo" e, com o microfone livre, caia em `comecar()` — abria o
       * microfone e gravava por cima dos três minutos que a pessoa acabara de
       * falar. O aviso estava certo e o botão mentia. */
      if (pendenteDeSalvar) { tentarSalvar(); return; }
      try {
        fluxo = await Gravador.iniciar();
      } catch (e) {
        const nome = e && e.name;
        UI.toast(
          nome === 'NotAllowedError' ? 'Permissão negada. Libere o microfone nas configurações do navegador.'
            : nome === 'NotFoundError' ? 'Não achei microfone neste aparelho.'
              : (e && e.message) || 'Não deu para gravar',
          { tipo: 'err', dur: 5500 });
        return;
      }
      relogio.textContent = '0:00';
      relogio.classList.add('vivo');
      rotuloGravar.textContent = 'Parar';
      /* Os capitulos acumulados de uma gravacao anterior nao valem para esta.
       *
       * Sem esta linha, quem reescrevia a faixa via o indice antigo, marcado no
       * audio antigo: os botoes pulavam para tempos que nao batiam com o que
       * estava tocando. A pessoa marcava "refrão" no meio de um solo e ouvia o
       * intro — e a conclusão natural seria que o indice estava quebrado. */
      capitulos = [];
      entradaCap.value = '';
      desenharCaps();
      dica.textContent = 'Gravando. Fale o que acontece, e marque as partes se quiser pular direto.';
      conta = setInterval(function () {
        relogio.textContent = Gravador.relogio(fluxo.segundos());
      }, 250);
      entradaCap.focus();
    }

    async function terminar() {
      if (!fluxo) return;
      if (conta) { clearInterval(conta); conta = null; }
      relogio.classList.remove('vivo');
      let saida;
      try {
        saida = await fluxo.parar();
      } catch (e) {
        // O microfone ja foi solto dentro de `parar()`, antes de o erro subir.
        // Aqui so se devolve a folha ao estado de "pronto para tentar de novo" —
        // deixar o botao em "Parar" com nada gravando seria pior que a falha.
        fluxo = null;
        rotuloGravar.textContent = 'Gravar';
        dica.textContent = 'Fale no ritmo: e a sua voz que marca o tempo. ' +
          '"Refrao em 1,2,3,4", "virada da bateria, para tudo", "voltou".';
        UI.toast((e && e.message) || 'Não deu para ler a gravação', { tipo: 'err' });
        return;
      }
      /* Um capitulo marcado depois do fim da faixa nao tem onde levar.
       *
       * Acontece quando a pessoa aperta "Parar" com o indice ainda em edicao:
       * o ultimo capitulo ficaria em 2:58 numa faixa de 2:40, e o botao pularia
       * para o fim. Um indice com um tempo impossivel e pior do que um indice
       * sem aquela ultima parte — e a parte que a pessoa acabou de marcar foi
       * a que mais importava. */
      const total = saida.segundos;
      const validos = capitulos.filter(function (c) { return c.t <= total + 0.5; });
      const perdidos = capitulos.length - validos.length;

      fluxo = null;
      musica.vs = saida.dataUrl;
      musica.vsSeg = saida.segundos;
      musica.vsCap = S.normVsCapitulos(validos);
      aoMudar();

      /* O save foi tentado e o RESULTADO não foi olhado.
       *
       * `aoMudar` chama `Store.gravar()`, que devolve `false` e marca
       * `ultimoErro` como 'cheio' quando o armazenamento recusa — mas ninguém
       * lia esse retorno. A folha fechava e o toast dizia "Faixa gravada", em
       * verde, para uma gravação que existia só na memória.
       *
       * Quem perde não é o app: é a pessoa, que falou três minutos, viu "gravo",
       * e só descobria que o áudio não estava ali ao fechar a tela. E o pior
       * não é a perda — é o aviso verde dizendo que deu certo.
       *
       * A correção é olhar o retorno. O áudio continua em memória e a folha
       * continua aberta, para a pessoa apagar uma gravação antiga e tentar de
       * novo sem perder os três minutos que acabou de gravar. */
      const erro = typeof S.ultimoErro === 'function' ? S.ultimoErro() : null;
      const naoSalvou = erro === 'cheio' || erro === 'erro';

      if (naoSalvou) {
        const cheio = erro === 'cheio';
        pendenteDeSalvar = true;
        rotuloGravar.textContent = 'Tentar salvar de novo';
        /* O texto diz a verdade sobre o botão E sobre a tela.
         *
         * A pessoa precisa saber duas coisas: que os três minutos estão aqui
         * agora, e que sair desta tela os leva junto. Sem a segunda, o aviso
         * vira isca — e uma isca que custa uma gravação. */
        dica.textContent = cheio
          ? 'O espaço do Clave está cheio e esta faixa NÃO foi salva. Ela continua aqui enquanto esta tela estiver aberta: faça backup em Ajustes para guardar, ou apague uma gravação antiga e aperte "Tentar salvar de novo".'
          : 'Esta faixa NÃO foi salva, mas continua aqui enquanto esta tela estiver aberta. Aperte "Tentar salvar de novo" para tentar de novo.';
        /* O botão oferece a saída segura: o backup do Clave é montado a partir do
         * estado EM MEMÓRIA, então ele leva esta gravação junto — inclusive
         * quando ela não coube no armazenamento. É o que transforma "saiu da
         * tela e perdeu tudo" em "saiu da tela e guardou". */
        UI.toast(cheio
          ? 'A gravação ficou pronta, mas NÃO foi salva: o espaço do Clave está cheio. Faça backup antes de sair daqui.'
          : 'A gravação ficou pronta, mas não foi salva agora.',
        { tipo: 'err', dur: 9000, acao: function () { global.App.ir('ajustes'); }, acaoTexto: 'Fazer backup' });
        return;   /* a folha NÃO fecha: o áudio está aqui e a pessoa precisa dele */
      }

      pendenteDeSalvar = false;
      h.close();
      UI.toast(
        'Faixa gravada — ' + Gravador.relogio(total)
        + (musica.vsCap.length ? ' com ' + U.plural(musica.vsCap.length, 'capítulo') : '')
        + (perdidos ? ' · ' + U.plural(perdidos, 'marca fora do fim', 'marcas fora do fim')
          + ' descartada' + (perdidos > 1 ? 's' : '') : ''),
        { tipo: 'ok', dur: perdidos ? 6500 : 4000 });
    }

    /**
     * Solta o microfone e para o relogio. Pode ser chamada varias vezes — o
     * `onClose` dispara tambem depois de uma gravacao bem sucedida, quando ja
     * nao ha mais fluxo para soltar.
     */
    function limpar() {
      if (conta) { clearInterval(conta); conta = null; }
      if (fluxo) { fluxo.cancelar(); fluxo = null; }
      /* Sem isto, fechar a folha deixava `fluxo` apontando para uma gravacao
       * cancelada, e `marcar` — que so age quando `fluxo` existe — continuaria
       * achando que estava gravando. Não dava erro: o capitulo era criado com
       * `segundos()` de um fluxo morto, e ficava em 0. */
      fluxo = null;
      /* O `beforeunload` sai junto com a folha. Registrado e nunca removido,
       * ele perguntaria "tem gravacao nao salva?" para sempre — inclusive
       * depois de a gravacao estar salva. Listener vazado e' aviso que mente. */
      global.removeEventListener('beforeunload', avisaAntesDeSair);
    }

    // O rotulo fica num `span` proprio para poder virar "Parar" sem levar o
    // icone junto. Trocar o `textContent` do botao inteiro apagaria o icone no
    // meio da gravacao — o botao mudaria de conteudo bem no instante em que a
    // pessoa esta mais atlhe a ele.
    const rotuloGravar = el('span', {}, 'Gravar');
    const bGravar = el('button', { class: 'btn btn-primary grow' },
      [el('i', { 'data-lucide': 'mic' }), rotuloGravar]);

    bGravar.addEventListener('click', function () {
      if (fluxo) terminar();
      else comecar();
    });

    corpo.appendChild(dica);
    corpo.appendChild(barra);
    corpo.appendChild(painelCaps);
    corpo.appendChild(el('div', { class: 'row gap-2' }, [
      bGravar,
      el('button', {
        class: 'btn btn-secondary',
        onclick: function () { h.close(); },
      }, 'Cancelar'),
    ]));

    const h = UI.sheet({
      title: 'Gravar a faixa narrada', sub: musica.nome || '', body: corpo,
      foot: [],
      // Sem isto, fechar a folha pelo X, pelo fundo ou pelo Escape no meio da
      // gravacao deixaria o microfone aberto: o indicador do aparelho continua
      // aceso, a bateria continua consumindo e, em alguns aparelhos, o
      // microfone fica travado para outro uso ate a aba fechar.
      onClose: limpar,
        /* O MESMO PORTAO DE SAIDA DO `palco.js`
         *
         * As duas implementacoes de gravacao nao sao iguais — uma tem capitulos
         * e a outra nao — mas a pergunta e a mesma, e a resposta tem de ser a
         * mesma: existe audio em memoria que o armazenamento recusou? Se sim,
         * perguntar antes de deixar a folha morrer.
         *
         * Sem isto, o `cancao.js` continuaria sendo um caminho que perde
         * gravacao em silencio enquanto o `palco.js` pergunta. Duas respostas
         * diferentes para o mesmo defeito e a forma mais eficiente de deixar
         * alguem perder dados. */
        aoFechar: function () { return perguntarAoSair(); },
    });
    UI.icons(corpo);
    return h;
  }

  /**
   * Devolve a musica ao evento e avisa que mudou.
   *
   * Este e o caminho de reserva: so e usado quando a pagina foi aberta sem um
   * `aoSalvar`. Ver `persistir`.
   */
  function guardarMusica(escala, musica) {
    if (!escala || !musica) return;
    const lista = escala.musicas || (escala.musicas = []);
    const i = lista.findIndex(function (m) { return m.id === musica.id; });
    if (i >= 0) lista[i] = musica; else lista.push(musica);
    escala.atualizadaEm = Date.now();
    S.mudou('escala');
  }

  /**
   * Salva a musica depois de uma mudanca.
   *
   * A pagina da musica NAO sabe como a musica chegou nela, e isso importa. A
   * agenda abre a pagina sobre um rascunho — uma copia do evento, que so vai
   * para o banco quando a pessoa aperta "Salvar" no evento. Escrever direto no
   * `S.db.escalas` a partir daqui seemingly funcionaria e perderia tudo: o
   * rascunho sobrescreve o banco no `salvar`, e a gravacao some.
   *
   * Por isso quem abre e quem decide: a agenda passa `aoSalvar`, e ele chama o
   * `salvar` de la, que ja sabe reescrever o rascunho inteiro. Sem `aoSalvar`
   * (musica aberta por outro caminho) resta a gravacao direta.
   */
  function persistir(escala, musica, aoSalvar) {
    if (typeof aoSalvar === 'function') { aoSalvar(); return; }
    guardarMusica(escala, musica);
  }

  function abrir(musica, escala, cifra, aoSalvar) {
    const mus = musica || {};
    const cif = cifra || S.cifraPorId(mus.cifraId) || null;
    const titulo = mus.nome || (cif && cif.titulo) || 'Música';
    const artista = mus.artista || (cif && cif.artista) || '';

    const corpo = el('div', { class: 'stack gap-4 song-page' });

    /* A folha existe desde aqui, antes de ser preenchida.
     *
     * O corpo monta um intervalo para o metrônomo, e esse intervalo precisa
     * morrer quando a folha fechar. Para se registrar nela, a folha precisa
     * ja existir — e ela so existe depois de `UI.sheet`, que recebe o corpo
     * pronto. Declarando `let h` antes e atribuindo depois, o `reguaCompasso`
     * consegue registrar e o `close` continua fechando a folha. */
    let h = null;

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
      reguaCompasso(bpm, mus.compasso || (cif && cif.compasso), h),
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
        el('p', { class: 'fs-sm muted' }, 'Esta música ainda não tem cifra vinculada.'),
      ]));
    }

    /* ---- a faixa narrada ----
     *
     * `mus` sozinho NAO tem a gravacao. Quem cadastrou a musica no repertorio,
     * gravou a faixa, e depois montou a escala, deixou a gravacao na CIFRA — e
     * a musica da escala so aponta para ela por `cifraId`.
     *
     * Passar `mus` direto aqui mostrava "Gravar a faixa" mesmo com quatro
     * capitulos e dois minutos de audio guardados na cifra. O bloco estava
     * certo e a tela mentia, que e a pior combinacao: a pessoa gravaria de novo
     * por causa de um campo que estava no lugar certo e nao foi lido.
     *
     * A ficha junta os dois, com a precedencia que o resto da tela ja usa. */
    /* ---- a faixa narrada ----
     *
     * `mus` sozinho NAO tem a gravacao. Quem cadastrou a musica no repertorio,
     * gravou a faixa, e depois montou a escala, deixou a gravacao na CIFRA — e
     * a musica da escala so aponta para ela por `cifraId`.
     *
     * Passar `mus` direto mostrava "Gravar a faixa" mesmo com quatro capitulos e
     * dois minutos de audio guardados na cifra. O bloco estava certo e a tela
     * mentia — a pior combinacao: a pessoa gravaria de novo por causa de um
     * campo que estava no lugar certo e nao foi lido.
     *
     * E o inverso: gravar em `mus` sem levar a ficha junto perderia a gravacao,
     * porque `persistir` reescreve a musica da escala. Por isso o bloco le a
     * ficha e devolve ela no `aoMudar` — quem chamou e quem decide onde ela
     * vai parar, como em todo o resto da tela. */
    const ficha = S.fichaDe(mus);
    corpo.appendChild(blocoVS(ficha, escala, function (f) {
      const mudou = f || {};
      /* A ficha e a fonte da verdade depois de mudar, e o rascunho da escala
       * precisa receber o que nela mudou — senao `persistir` reescreve a musica
       * com o audio velho e a gravacao desta sessao desaparece. */
      if (typeof mudou.vs !== 'undefined') mus.vs = mudou.vs;
      if (typeof mudou.vsTexto !== 'undefined') mus.vsTexto = mudou.vsTexto;
      if (typeof mudou.vsSeg !== 'undefined') mus.vsSeg = mudou.vsSeg;
      if (typeof mudou.vsCap !== 'undefined') mus.vsCap = mudou.vsCap;
      if (mus.vs !== undefined || mudou.vs) mus.vs = mudou.vs;
      if (mus.vsTexto !== undefined || mudou.vsTexto) mus.vsTexto = mudou.vsTexto;
      if (mus.vsSeg !== undefined || mudou.vsSeg) mus.vsSeg = mudou.vsSeg;
      if (mus.vsCap !== undefined || mudou.vsCap) mus.vsCap = mudou.vsCap;
      persistir(escala, mus, aoSalvar);
    }));

    /* ---- a foto ---- */
    corpo.appendChild(blocoFoto(mus, escala, aoSalvar));

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

    /* A folha e criada com o corpo ja montado. */
    h = UI.sheet({
      title: titulo, sub: artista || 'Música', wide: true, body: corpo,
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