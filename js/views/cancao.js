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
      const iframe = el('iframe', {
        class: 'vid-frame',
        src: 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&modestbranding=1&playsinline=1',
        title: 'Vídeo: ' + titulo,
        loading: 'lazy',
        referrerpolicy: 'strict-origin-when-cross-origin',
        allow: 'accelerometer; encrypted-media; picture-in-picture; clipboard-write; fullscreen',
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
      if (musica.vs) {
        // `audio`, e nao `áudio`. O acento na tag cria um elemento HTML
        // desconhecido em vez de um `<audio>`: o navegador aceita o elemento
        // em silencio, e ele nunca toca nem mostra os controles. O bloco
        // aparecia com o texto da passagem e um retangulo vazio onde deveria
        // estar o player — com o `tem` logo acima dizendo que havia gravacao.
        wrap.appendChild(el('audio', {
          class: 'vs-audio', src: musica.vs, controls: true, preload: 'metadata',
          'aria-label': 'Faixa narrada de ' + (musica.nome || 'esta música'),
        }));
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
            salvar();
            UI.toast('Gravação apagada. O texto da passagem continua.', { tipo: 'ok' });
          },
        }, [el('i', { 'data-lucide': 'trash-2' }), 'Apagar a gravação']) : null,
      ]));
    }

    /** Grava no evento e redesenha o bloco. */
    function salvar() {
      aoMudar();
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

    const dica = el('p', { class: 'fs-xs muted' },
      'Fale no ritmo: e a sua voz que marca o tempo. "Refrao em 1,2,3,4", '
      + '"virada da bateria, para tudo", "voltou" — na contagem, como você canta.');

    // `text`, e nao `textContent`: o construtor de elemento so conhece algumas
    // chaves para conteudo. Passando `textContent`, ele cria um atributo com
    // esse nome e o elemento fica vazio — sem erro e sem aviso. Foi o que
    // aconteceu: o relogio da gravacao aparecia como um retangulo vazio.
    const relogio = el('div', { class: 'vs-relogio', text: '0:00' });
    const barra = el('div', { class: 'vs-status' }, relogio);

    let fluxo = null;
    let conta = null;

    async function comecar() {
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
      dica.textContent = 'Gravando. Fale o que acontece em cada parte.';
      conta = setInterval(function () {
        relogio.textContent = Gravador.relogio(fluxo.segundos());
      }, 250);
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
      fluxo = null;
      musica.vs = saida.dataUrl;
      musica.vsSeg = saida.segundos;
      aoMudar();
      h.close();
      UI.toast('Faixa gravada — ' + Gravador.relogio(saida.segundos), { tipo: 'ok' });
    }

    /**
     * Solta o microfone e para o relogio. Pode ser chamada varias vezes — o
     * `onClose` dispara tambem depois de uma gravacao bem sucedida, quando ja
     * nao ha mais fluxo para soltar.
     */
    function limpar() {
      if (conta) { clearInterval(conta); conta = null; }
      if (fluxo) { fluxo.cancelar(); fluxo = null; }
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

    /* ---- a faixa narrada ---- */
    corpo.appendChild(blocoVS(mus, escala, function () {
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