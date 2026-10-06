/* =========================================================
   ACORDE - views/palco.js
   A MESA DE ENSAIO: video, audio da voz, BPM e anotacoes juntos.

   POR QUE UMA TELHA INTEIRA E NAO MAIS UM MENU

   Tudo o que quem ensaia precisa ver ao mesmo tempo cabe mal numa folha: o
   video ocupa a largura toda, a rolagem da cifra precisa de altura, e as
   anotacoes precisam ficar visiveis enquanto o video toca. Empilhados numa
   folha, cada um vira um bloco que se rola, e o trabalho de manter os tres no
   lugar volta para quem devia estar tocando.

   Aqui eles Dividem a tela por papel: video e imagem no topo, rolagem da cifra
   embaixo, e a faixa de controle com BPM e anotacoes entre os dois. O que
   precisa de atencao esta sempre visivel.

   O QUE ANDA JUNTO

     - o video do YouTube, com o audio no volume que a pessoa escolheu;
     - a faixa narrada, a voz que ela mesma gravou ("virada da bateria em
       1,2,3,4"), que e o que marca o tempo do ensaio;
     - o BPM, com o metronomo no volume escolhido;
     - a rolagem da cifra, que segue o mesmo tempo;
     - as anotacoes com hora, que acendem conforme passa e pulam o video
       quando clicadas.

   Quem manda no tempo e a voz gravada. Sem gravacao, quem manda e o video.
   Nunca o contrario: o relogio do aparelho nao sabe quando a banda entra.
   ========================================================= */
(function (global) {
  'use strict';

  const V = global.Views || (global.Views = {});
  const U = global.Utils;
  const S = global.Store;
  const UI = global.UI;
  const R = global.Render;
  const M = global.Music;
  const Lk = global.Links;
  const P = global.Palco;
  const Gravador = global.Gravador;
  const { el } = U;

  let relogio = null;      // o relogio da sessao atual
  let cancelarInscricao = null;
  /* O laco que le a posicao do video fica no escopo do modulo, e nao dentro de
     `abrir`, porque `encerrar` precisa alcanca-lo. Sendo local, fechar a mesa
     cancelava o relogio mas nao este temporizador — e ele continuava rodando
     numa tela fechada. */
  let quadroFollow = 0;
  /* O dono dos recursos que mantem a mesa viva: tela acesa, tela cheia e o que
     fazer quando o documento some. Vive no escopo do modulo, e nao dentro de
     `abrir`, pelo mesmo motivo de `quadroFollow`: e `encerrar` que precisa
     alcanca-lo. Sendo local, fechar a mesa deixaria um Wake Lock apontando
     para uma tela que ja nao existe. */
  let viva = null;

  /* =======================================================
     ENTRADA

     Abre a mesa de uma musica. Aceita as duas formas que o app tem:
     uma musica de uma escala (com a ficha montada) ou uma cifra solta do
     repertorio.
     ======================================================= */
  function abrir(ficha, opcoes) {
    opcoes = opcoes || {};
    const f = ficha || {};

    // Uma sessao por vez. Se a pessoa abre outra musica sem fechar esta, o
    // relogio antigo continuaria mandando na rolagem antiga, que saiu da tela
    // mas continua no documento.
    encerrar();

    relogio = P.criarRelogio();

    const corpo = el('div', { class: 'palco' });
    const estado = {
      ficha: f,
      player: null,
      audio: null,
      rolagem: null,
      tocando: false,
      linhaAtual: -1,
    };

    /* ---------------------------------------------------------
       O CABECALHO: o que e esta musica, e o botao que comeca tudo
       --------------------------------------------------------- */
    const botaoComecar = el('button', { class: 'pl-start', type: 'button', 'aria-label': 'Começar o ensaio' },
      [el('i', { 'data-lucide': 'play' }), el('span', {}, 'Começar')]);

    /* O botao de tela cheia.
     *
     * Ele existe mesmo onde a API nao existe, e ai fica desabilitado com o
     * motivo no `title`. Um botao que desaparece e pior que um botao que
     * explica: quem procura a opcao e nao a acha acha que o app nao tem.
     *
     * O pedido so acontece aqui, dentro do clique. Pedir no `abrir` seria
     * recusado sem erro — o navegador exige gesto — e a mesa ficaria sem tela
     * cheia sem nenhum aviso, que e o resultado que ninguem sabe corrigir. */
    const botaoTelaCheia = el('button', {
      class: 'pl-cheia', type: 'button',
      'aria-label': 'Entrar em tela cheia', title: 'Entrar em tela cheia',
      onclick: function () {
        if (!viva) return;
        viva.alternarTelaCheia();
      },
    }, el('i', { 'data-lucide': 'maximize' }));

    const cabecalho = el('div', { class: 'pl-head' }, [
      el('div', { class: 'grow', style: { minWidth: '0' } }, [
        el('h2', { class: 'pl-titulo' }, f.titulo || 'Sem título'),
        el('div', { class: 'pl-sub' }, [
          f.artista || (f.escalaTitulo ? f.escalaTitulo : ''),
          f.escalaHora ? U.fmtTime(f.escalaHora) : '',
        ].filter(Boolean).join('  ·  ') || 'Sem artista'),
      ]),
      el('div', { class: 'pl-head-botoes' }, [
        botaoTelaCheia,
        botaoComecar,
      ]),
    ]);
    corpo.appendChild(cabecalho);

    /* ---------------------------------------------------------
       O VIDEO
       --------------------------------------------------------- */
    const moldura = el('div', { class: 'pl-video-caixa' });

    /* A foto da cifra. Vira a `src` da imagem, e o lugar para desenhar em
       cima no Estúdio. */
    let alvoFoto = f.foto || '';

    /* O video da mesa: o id do YouTube, ou vazio quando o que esta na tela e a
       foto. Declarado aqui, antes de `mostrarVideo` — a atribuicao acontece na
       propria declaracao e a variavel precisa existir. */
    let destinoVideo = f.ytId || '';

    const semNada = el('div', { class: 'pl-video-vazio' }, [
      el('i', { 'data-lucide': 'youtube', style: { width: '26px', height: '26px' } }),
      el('p', { class: 'fs-sm' }, 'Sem vídeo nem foto nesta música'),
      el('div', { class: 'row gap-2 wrap', style: { justifyContent: 'center' } }, [
        el('button', { class: 'btn btn-soft btn-sm', onclick: pedirVideo },
          [el('i', { 'data-lucide': 'link' }), 'Colar link do YouTube']),
        el('button', { class: 'btn btn-secondary btn-sm', onclick: pedirFoto },
          [el('i', { 'data-lucide': 'image' }), 'Enviar foto da cifra']),
      ]),
    ]);

    function mostrarFoto() {
      destinoVideo = '';
      U.clear(moldura);
      moldura.appendChild(el('img', { class: 'pl-foto', src: alvoFoto, alt: 'Cifra de ' + f.titulo }));
    }

    function mostrarVideo(id) {
      destinoVideo = id;
      U.clear(moldura);
      const holder = el('div', { class: 'pl-video-holder' });
      moldura.appendChild(holder);
      montarPlayer(holder, id);
    }

    if (f.ytId) mostrarVideo(f.ytId);
    else if (alvoFoto) mostrarFoto();
    else moldura.appendChild(semNada);

    function montarPlayer(holder, id) {
      // Primeiro o iframe simples: ele ja mostra o video e ja funciona sem
      // script nenhum. A API so entra depois, para dar play, pausar e ler o
      // tempo — e se nao vier, o video continua tocando com os controles
      // proprios do YouTube. A mesa nao depende de a API carregar.
      const iframe = el('iframe', {
        src: Lk.embedYouTube(id, { autoplay: false }),
        title: 'Vídeo: ' + f.titulo,
        // `allow` sozinho. O atributo `allowfullscreen` e o jeito antigo e o
        // navegador avisa no console que o `allow` tem precedencia — e o
        // aviso some do jeito que o app ja usava.
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        referrerpolicy: 'strict-origin-when-cross-origin',
      });
      holder.appendChild(iframe);

      P.carregarApi().then(function (YT) {
        // `holder.isConnected` confere se a folha ainda esta aberta. Sem esta
        // verificacao, fechar a mesa no meio do carregamento deixava um
        // Player apontando para um iframe ja removido — e o `playVideo()`
        // depois disso jogava um erro em uma tela que nao existe mais.
        if (!YT || !holder.isConnected) return;
        try {
          estado.player = new YT.Player(iframe, {
            events: {
              /**
               * Os metodos do Player so existem DEPOIS deste aviso.
               *
               * Sem o `onReady`, `new YT.Player(...)` devolve um objeto que tem
               * `playVideo` como `undefined` — nao como metodo, e nao como
               * funcao que falha: simplesmente nao existe. E o pior jeito de
               * falhar: o video aparece e toca, entao parece funcionar; e o app
               * nunca consegue dar play, ler o tempo nem mudar o volume. O
               * "Começar" silenciosamente nao comeca nada, e a rolagem fica
               * parada em 0:00 enquanto o video passa.
               */
              onReady: function (ev) {
                const alvo = ev && ev.target ? ev.target : estado.player;
                estado.player = alvo;
                mistura.definirPlayer(alvo);
                // A duracao real do video e o teto correto do relogio: e o que
                // faz a barra ter o tamanho certo e o que faz a rolagem parar
                // no fim da musica, e nao antes.
                if (typeof alvo.getDuration === 'function') {
                  try {
                    const d = alvo.getDuration();
                    if (isFinite(d) && d > 0) {
                      estado.duracaoDoVideo = d;
                      relogio.informarDuracao(d);
                    }
                  } catch (e) { /* o video ainda nao sabe a propria duracao */ }
                }
                pintar();
              },
              onError: function () {
                // Codigo 2 = Parametro invalido, 5 = HTML5 error, 100 = nao
                // encontrado, 101/150 = nao reproduzivel. Nenhum deles e
                // corrigivel pelo app; o que importa e nao travar a mesa.
                estado.player = null;
                mistura.definirPlayer(null);
              },
            },
          });
        } catch (e) {
          // Sem API o video segue com os controles do YouTube. O unico
          // recurso que se perde e o botao de dar play daqui.
          estado.player = null;
        }
      });
    }

    function pedirVideo() {
      UI.prompt({
        title: 'Link do YouTube',
        message: 'Aceita youtube.com/watch, youtu.be, /shorts, /live ou só o código do vídeo.',
        placeholder: 'https://youtu.be/...', value: f.yt || '',
      }).then(function (v) {
        if (!v) return;
        const id = Lk.extrairYouTubeId(v);
        if (!id) { UI.toast('Não reconheci esse link. É do YouTube?', { tipo: 'err' }); return; }
        f.yt = v; f.ytId = id;
        salvarFicha({ yt: v, ytId: id });
        mostrarVideo(id);
        pintar();
        UI.toast('Vídeo carregado', { tipo: 'ok' });
      });
    }

    function pedirFoto() {
      const arq = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
      document.body.appendChild(arq);
      arq.addEventListener('change', function () {
        const a = arq.files[0];
        document.body.removeChild(arq);
        if (!a) return;
        U.readFile(a, true)
          .then(function (d) { return U.shrinkImage(d, 1400, 0.8); })
          .then(function (p) {
            // Vazio aqui e "nao deu para ler". Sem esta conferencia, a mesa
            // recebia `src=""` e mostrava um retangulo quebrado onde deveria
            // estar a partitura.
            if (!p) { UI.toast('Não deu para ler a imagem', { tipo: 'err' }); return; }
            f.foto = p; alvoFoto = p;
            salvarFicha({ foto: p });
            mostrarFoto();
            UI.toast('Foto anexada', { tipo: 'ok' });
          })
          .catch(function () { UI.toast('Não deu para ler a imagem', { tipo: 'err' }); });
      });
      arq.click();
    }

    corpo.appendChild(moldura);

    /* ---------------------------------------------------------
       A MISTURA DE VOLUME

       Declarada antes da faixa narrada porque e a faixa que a alimenta: o
       `<audio>` da voz entra na mistura no mesmo instante em que e criado. Na
       ordem contraria, a primeira gravacao ficaria sem volume nenhum — o
       controle existiria e nao mexeria no audio.
       --------------------------------------------------------- */
    const mistura = P.criarMistura(null, null, { video: 100, voz: 100, metr: 60 });

    /* ---------------------------------------------------------
       A FAIXA NARRADA — a voz que guia o ensaio

       O elemento `<audio>` nasce invisivel: quem ouve a voz de quem guia e o
       video com os controles do YouTube, e dois controles de audio na mesma
       tela fazem a pessoa se perguntar qual dos dois ela deveria tocar. O
       botao "Começar" toca os dois juntos.
       --------------------------------------------------------- */
    const blocoVS = el('div', { class: 'pl-vs' });
    corpo.appendChild(blocoVS);

    let audioVS = null;

    /* ESTA GRAVAÇÃO ESTÁ NO DISCO, OU SÓ NESTA FOLHA?
     *
     * `f.vs` respondia as duas perguntas com o mesmo campo. Depois de uma
     * recusa de cota, `salvarFicha` tinha colocado o audio no objeto da Store,
     * o armazenamento recusou a escrita — e `f.vs` continuava preenchido. A
     * mesa abria, `montarVS` via no mesmo ramo de sempre e escrevia "Narração
     * gravada", com so o botão de regravar. A tela afirmava uma coisa que o
     * armazenamento nao tinha aceito, e a pessoa ficava sem caminho para tentar
     * salvar, para descartar, ou para tentar de novo.
     *
     * A pergunta certa nao e "o campo esta cheio?", e "o disco tem isto?".
     * Por isso a resposta sai de `localStorage` e nao de um sinalizador: um
     * sinalizador seria uma segunda verdade para manter em dia, e duas
     * verdades sempre divergem na hora que importa.
     *
     * Se a leitura falhar, a resposta e' "salvo". Nao inventar alarme: quem
     * mostra "so nesta tela" sem evidencia esta gritando com a pessoa errada,
     * e o custo de avisar a toa e' maior que o de nao avisar. */
    function vsEstaSalvo() {
      try {
        const cru = JSON.parse(localStorage.getItem(S.STORAGE_KEY) || 'null');
        if (!cru) return !f.vs;
        if (f.cifraId) {
          const c = (cru.cifras || []).filter(function (x) { return x.id === f.cifraId; })[0];
          return !!(c && c.vs);
        }
        if (f.escalaId) {
          const esc = (cru.escalas || []).filter(function (x) { return x.id === f.escalaId; })[0];
          if (esc) {
            const m = (esc.musicas || []).filter(function (x) { return x.id === f.musicaId; })[0];
            return !!(m && m.vs);
          }
        }
      } catch (e) { /* leitura impossivel: sem alarme */ }
      return !f.vs;
    }

    /* Salva o audio que ja esta em memoria, sem tocar no microfone.
     *
     * Mesma regra da retentativa dentro da folha de gravacao: quem pede o
     * microfone de novo nao recupera nada, cobra minutos de voz e apaga o que
     * deu trabalho. Aqui so a escrita acontece. */
    function tentarSalvarNaMesa() {
      salvarFicha({ vs: f.vs, vsSeg: f.vsSeg, vsTexto: f.vsTexto });
      S.gravar();
      const erro = S.ultimoErro();
      if (erro === 'cheio' || erro === 'erro') {
        UI.toast(erro === 'cheio'
          ? 'A narração continua sem ser salva: o espaço do Clave está cheio. Apague uma gravação antiga em Ajustes.'
          : 'A narração continua sem ser salva agora.',
        { tipo: 'err', dur: 6000, acao: function () { if (global.App) global.App.ir('ajustes'); }, acaoTexto: 'Abrir Ajustes' });
        return false;
      }
      UI.toast('Narração salva — ' + Gravador.tamanhoDe(f.vs) + '.', { tipo: 'ok' });
      return true;
    }

    function montarVS() {
      U.clear(blocoVS);
      const voz = f.vs ? String(f.vs) : '';
      const soNaMemoria = !!voz && !vsEstaSalvo();

      if (soNaMemoria) {
        /* O estado verdadeiro: existe audio, e ele NAO esta guardado.
         *
         * As acoesoffered sao as tres que fazem sentido aqui — salvar, ouvir o
         * que se gravou, e descartar. Regravar WOULD erase the audio not saved,
         * entao ela nao aparece: seria o jeito mais rapido de perder tres
         * minutos de voz, e a pessoa nao teria como saber. */
        audioVS = el('audio', { src: voz, preload: 'metadata', class: 'sr-only' });
        blocoVS.appendChild(audioVS);
        mistura.definirAudio(audioVS);
        blocoVS.appendChild(el('div', { class: 'pl-vs-topo' }, [
          el('i', { 'data-lucide': 'triangle-alert', style: { width: '17px', height: '17px', color: 'var(--warn-500)' } }),
          el('span', { class: 'fs-sm fw-7 grow' }, 'Narração só nesta tela'),
          el('span', { class: 'fs-xs muted' }, P.tempo(f.vsSeg)),
        ]));
        blocoVS.appendChild(el('p', { class: 'fs-xs muted mt-1' },
          'Não foi possível guardar esta narração. Ela some se você sair sem salvar — '
          + 'um backup leva embora ela não caiba.'));
        blocoVS.appendChild(el('div', { class: 'row gap-2 wrap mt-2' }, [
          el('button', {
            class: 'btn btn-primary btn-sm', onclick: function () {
              if (tentarSalvarNaMesa()) montarVS();
            },
          }, [el('i', { 'data-lucide': 'save' }), 'Tentar salvar']),
          el('button', {
            class: 'btn btn-soft btn-sm', onclick: function () {
              const nome = 'clave-backup-' + new Date().toISOString().slice(0, 10) + '.json';
              try {
                Utils.download(nome, S.exportar(), 'application/json');
                UI.toast('Backup feito — a narração está no arquivo baixado.', { tipo: 'ok' });
              } catch (e) {
                UI.toast('Não consegui fazer o backup agora.', { tipo: 'err' });
              }
            },
          }, [el('i', { 'data-lucide': 'download' }), 'Fazer backup']),
          el('button', {
            class: 'btn btn-secondary btn-sm', onclick: function () {
              /* Passa por `salvarFicha` como o dialogo: o objeto da Store
               * precisa esquecer o audio junto, senao a mesa que reabrir
               * mostra a mesma narracao que a pessoa acabou de descartar. */
              f.vs = ''; f.vsSeg = 0;
              salvarFicha({ vs: '', vsSeg: 0 });
              S.gravar();
              montarVS();
              UI.toast('Narração descartada.', { tipo: 'ok' });
            },
          }, [el('i', { 'data-lucide': 'trash-2' }), 'Descartar']),
        ]));
        return;
      }

      if (!voz) {
        blocoVS.appendChild(el('div', { class: 'row gap-2 wrap' }, [
          el('i', { 'data-lucide': 'mic', style: { width: '17px', height: '17px', color: 'var(--ink-4)' } }),
          el('span', { class: 'fs-sm muted grow' }, 'Sem narração gravada. Você pode gravar a sua.'),
          el('button', { class: 'btn btn-soft btn-sm', onclick: gravarVoz },
            [el('i', { 'data-lucide': 'mic' }), 'Gravar a narração']),
        ]));
        audioVS = null;
        mistura.definirAudio(null);
        return;
      }
      audioVS = el('audio', { src: voz, preload: 'metadata', class: 'sr-only' });
      /* O `<audio>` precisa estar NO documento para tocar. Um elemento criado e
         nunca anexado fica sem contexto de reproducao: `play()` e recusado e o
         `currentTime` nao anda. Por isso ele entra na folha — invisivel, pelo
         `sr-only`, mas presente. Sem este `appendChild`, a narração aparecia na
         tela com o texto e a duração, e o botão "Começar" tocava só a
         rolagem: o app mostrava uma gravação que ele não conseguia ouvir. */
      blocoVS.appendChild(audioVS);
      mistura.definirAudio(audioVS);
      blocoVS.appendChild(el('div', { class: 'pl-vs-topo' }, [
        el('i', { 'data-lucide': 'audio-lines', style: { width: '17px', height: '17px', color: 'var(--primary)' } }),
        el('span', { class: 'fs-sm fw-7 grow' }, 'Narração gravada'),
        el('span', { class: 'fs-xs muted' }, P.tempo(f.vsSeg)),
        el('button', { class: 'btn-icon sm', 'aria-label': 'Regravar narração', title: 'Regravar', onclick: gravarVoz },
          el('i', { 'data-lucide': 'refresh-cw' })),
      ]));

      /* ---- os capitulos ----
       *
       * E AQUI que eles servem. Na Mesa de ensaio a pessoa esta com o violao na
       * coxa e a faixa tocando de fundo, e ela precisa ir de um ponto a outro
       * sem parar o ensaio: e a unica tela em que o indice é realmente usado.
       *
       * Aqui o botao nao da play — quem toca é a metrônoma, e isso quebraria o
       * que ela mantem. Ele busca o audio na narração e deixa a metrônima
       * correr. E se a narração estiver sem som, ele recomeça do zero. */
      const caps = S.normVsCapitulos(f.vsCap);
      if (caps.length) {
        blocoVS.appendChild(el('div', { class: 'row gap-2 wrap mt-2' }, caps.map(function (c) {
          return el('button', {
            class: 'vs-cap-btn', type: 'button',
            'aria-label': c.texto + ', ' + Gravador.relogio(c.t),
            title: Gravador.relogio(c.t) + ' — ' + c.texto,
            onclick: function () {
              /* O pulo e para um pouco ANTES do capitulo.
               *
               * Clicar "Virada" em 1:36 e cair exatamente em 1:36 funciona na
               * teoria. Na pratica, quem ouviu ate la esta em 1:36,2 — e a
               * metrônima, que so anda para a frente, fica parada: o tempo
               * procurado ja passou. Voltar meio segundo resolve, e o ouvido nao
               * nota meio segundo de repeticao.
               *
               * E o audio da narração volta junto, pela mesma razao: se ele
               * fica em 1:36,2 e o relogio vai para 1:35,5, as duas vozes
               * discordam do tempo, e a metrônima deixa de governar a mesa.
               *
               * A busca tem que ser incondicional — `if (currentTime < t)` era
               * o jeito obvio de escrever e o jeito errado: quem pulou para tras
               * ficaria preso no tempo velho. */
              const t = Math.max(0, c.t - 0.5);
              audioVS.currentTime = t;
              relogio.irPara(t);
            },
          }, [
            el('span', { class: 'vs-cap-t' }, Gravador.relogio(c.t)),
            el('span', { class: 'vs-cap-n' }, c.texto),
          ]);
        })));
      }

      if (f.vsTexto) {
        blocoVS.appendChild(el('div', { class: 'pl-vs-texto' }, f.vsTexto));
      }
    }
    montarVS();

    function gravarVoz() {
      const disp = Gravador.disponivel();
      if (!disp.ok) { UI.toast(disp.motivo, { tipo: 'err' }); return; }
      const aviso = el('div', { class: 'aviso-perm' }, [
        el('div', { class: 'linha' }, [
          el('i', { 'data-lucide': 'smartphone' }),
          el('span', {}, 'O navegador vai pedir o microfone. A gravação fica só neste aparelho.'),
        ]),
      ]);
      const relogioGrav = el('div', { class: 'vs-relogio', text: '0:00' });
      const status = el('div', { class: 'vs-status' }, relogioGrav);
      const area = el('textarea', {
        class: 'textarea vs-texto', rows: '3',
        placeholder: 'O que você fala. Ex.: "Refrão em 1,2,3,4. Virada da bateria, para tudo em 1,2,3,4."',
      });
      area.value = f.vsTexto || '';

      let fluxo = null;
      let conta = null;
      /* Onde o aviso de "nao salvou" aparece.
       *
       * O toast some em uns segundos. Esta frase fica enquanto a folha estiver
       * aberta, que e' quanto tempo o audio continua ali. Se a unica aviso
       * fosse o toast, bastava a pessoa desviar o olho por um instante para o
       * verde "Narração salva" ser a ultima coisa que ela viu. */
      const dicaFalha = el('p', { class: 'fs-xs muted' }, '');
      /* A gravacao que o armazenamento recusou. Ver a nota no ramal de
       * retentativa, abaixo: sem este sinalizador, o botao regrava por cima. */
      let pendenteDeSalvar = false;
      const btnGravar = el('button', { class: 'btn btn-primary' }, [el('i', { 'data-lucide': 'mic' }), 'Gravar']);

      btnGravar.addEventListener('click', function () {
        if (fluxo) {
          fluxo.parar().then(function (r) {
            clearInterval(conta);
            f.vs = r.dataUrl; f.vsSeg = Math.round(r.segundos);
            f.vsTexto = area.value;
            salvarFicha({ vs: r.dataUrl, vsSeg: f.vsSeg, vsTexto: f.vsTexto });

            /* O MESMO DEFEITO QUE A V5.6 CORRIGIU NO CANCAO, AINDA VIVO AQUI
             *
             * Esta e a gravacao que a pessoa ALCANCA: musica -> Abrir a mesa ->
             * "Gravar a narração". O caminho corrigido na rodada anterior ficava
             * no `cancao.js`, atras de um bloco que so aparece depois de uma
             * gravacao existir. Duas implementacoes, uma delas nunca corrigida,
             * e a errada e a que a pessoa usa.
             *
             * O codigo antigo era:
             *
             *     salvarFicha(...);              // o resultado, descartado
             *     UI.toast('Narração salva');    // verde, sempre
             *     h.close();                     // e a folha fechava
             *
             * Quando o armazenamento recusa, `f.vs` fica so na memoria, o
             * armazenamento nao tem o audio, e a pessoa recebe "Narração
             * salva" em verde. Sai da tela e o audio some — tendo sido dito que
             * estava guardado.
             *
             * `salvarFicha` usa `S.mudou()`, que e' adiado: no fim da linha o
             * save ainda NAO aconteceu, e o `ultimoErro` seria o da tentativa
             * anterior. Por isso o `S.gravar()` explicito logo abaixo — ele
             * força a escrita agora e devolve a verdade. Sem ele, esta
             * verificacao seria uma leitura de resultado velho, que e'
             * exatamente o tipo de meia-solucao que engana. */
            S.gravar();
            const erro = S.ultimoErro();

            if (erro === 'cheio' || erro === 'erro') {
              const cheio = erro === 'cheio';
              /* A folha fica ABERTA. O audio esta em `f.vs` agora, e e o que a
               * pessoa precisa para nao perder tres minutos de voz. */
              pendenteDeSalvar = true;
              dicaFalha.textContent = cheio
                ? 'O espaço do Clave está cheio e esta narração NÃO foi salva. Ela continua aqui enquanto esta folha estiver aberta: faça backup em Ajustes para guardar, ou apague uma gravação antiga e grave de novo.'
                : 'Esta narração NÃO foi salva, mas continua aqui enquanto esta folha estiver aberta.';
              UI.toast(cheio
                ? 'A narração ficou pronta, mas NÃO foi salva: o espaço do Clave está cheio. Faça backup antes de sair daqui.'
                : 'A narração ficou pronta, mas não foi salva agora.',
              { tipo: 'err', dur: 9000, acao: function () { if (global.App) global.App.ir('ajustes'); }, acaoTexto: 'Fazer backup' });
              resetar();   /* o botao passa a dizer "Tentar salvar de novo" */
              return;   /* a folha NAO fecha */
            }

            pendenteDeSalvar = false;
            montarVS();
            UI.toast('Narração salva', { tipo: 'ok' });
            h.close();
          }).catch(function (e) {
            UI.toast((e && e.message) || 'Não deu para gravar', { tipo: 'err' });
          });
          fluxo = null;
          clearInterval(conta);
          /* O BOTAO DIZIA "Parar" COM NADA GRAVANDO.
           *
           * A linha original escrevia ' Parar' no fim do `parar()` — em sucesso
           * E em falha. Com `fluxo` ja nulo, apertar esse "Parar" caia no ramo
           * de gravar de novo: o microfone abria e a voz da pessoa era gravada
           * por cima dos tres minutos que acabavam de ficar sem espaco. O
           * rotulo dizia uma coisa e o botao fazia a outra.
           *
           * `resetar()` vive AQUI, dentro do `then`, e nao depois dele: fora do
           * `then`, ele rodava na hora da CHAMADA, com a promessa ainda em
           * andamento e `pendenteDeSalvar` ainda falso. O botao voltava para
           * "Gravar" mesmo depois da recusa — e a retentativa, que existe, ficava
           * inalcancavel. A ordem do `quando` importa tanto quanto a ordem do
           * `onde`. */
          fluxo = null;
          clearInterval(conta);
          resetar();
          return;
        }

        function resetar() {
          U.clear(btnGravar);
          const esperando = pendenteDeSalvar;
          btnGravar.appendChild(el('i', { 'data-lucide': esperando ? 'save' : 'mic' }));
          btnGravar.appendChild(document.createTextNode(
            esperando ? ' Tentar salvar de novo' : ' Gravar'));
          btnGravar.className = esperando ? 'btn btn-primary' : 'btn btn-secondary';
        }
        /* HA UM AUDIO ESPERANDO: SALVAR, NAO GRAVAR DE NOVO.
         *
         * Depois de uma recusa, `f.vs` tem a narração e nada no armazenamento.
         * Abrir o microfone de novo não recupera nada: apaga o trabalho da
         * pessoa e ainda cobra minutos de voz. O que resolve é tentar o save
         * outra vez — e a pessoa resolve o motivo antes, apagando uma gravação
         * antiga em Ajustes.
         *
         * É a MESMA distinção que a folha do `cancao.js` faz, pelo mesmo
         * motivo: dois caminhos de gravação precisam da mesma resposta ao mesmo
         * defeito. */
        if (pendenteDeSalvar) {
          salvarFicha({ vs: f.vs, vsSeg: f.vsSeg, vsTexto: f.vsTexto });
          S.gravar();
          const erro2 = S.ultimoErro();
          if (erro2 === 'cheio' || erro2 === 'erro') {
            dicaFalha.textContent = erro2 === 'cheio'
              ? 'Ainda não coube. Apague uma gravação antiga em Ajustes e aperte "Tentar salvar de novo" — esta narração continua aqui.'
              : 'Ainda não salvou. Aperte "Tentar salvar de novo".';
            UI.toast('A narração continua sem ser salva: o espaço do Clave ainda não cabe.',
              { tipo: 'err', dur: 6000 });
            return;
          }
          pendenteDeSalvar = false;
          dicaFalha.textContent = '';
          resetar();
          montarVS();
          UI.toast('Narração salva — ' + Gravador.tamanhoDe(f.vs) + '.', { tipo: 'ok' });
          h.close();
          return;
        }
        Gravador.iniciar().then(function (fl) {
          fluxo = fl;
          U.clear(btnGravar);
          btnGravar.appendChild(el('i', { 'data-lucide': 'square' }));
          btnGravar.appendChild(document.createTextNode(' Parar'));
          btnGravar.className = 'btn btn-danger';
          conta = setInterval(function () {
            relogioGrav.textContent = P.tempo(fl.segundos());
          }, 250);
        }).catch(function (e) {
          const n = e && e.name;
          UI.toast(n === 'NotAllowedError' ? 'Permissão negada. Libere o microfone nas configurações.'
            : n === 'NotFoundError' ? 'Não achei microfone neste aparelho.'
              : (e && e.message) || 'Não deu para gravar', { tipo: 'err', dur: 5500 });
        });
      });

      /* ================================================================
       A PERGUNTA QUANDO A GRAVACAO AINDA NAO ESTA SALVA

       Quatro respostas, e nao duas. Quem responde "sim" a "sair?" pode querer
       salvar, pode querer fazer backup, e pode estar dispossto a perder. Uma
       confirmacao de sim ou nao obrigaria a escolher entre salvar e sair — e o
       backup, que e a acao que nao perde nada, ficaria fora da conversa.

       A ordem e o argumento: salvar, preservar, e so no fim descartar. Quem
       perde trabalho costuma precisar chegar ate o fim da lista para fazer
       isso, e isso e proposital — nao e acidente de layout.
       ================================================================ */
    function perguntarAoSair() {
      if (!pendenteDeSalvar) return true;      /* nada em risco: sai direto */
      return UI.confirmar({
        title: 'A narração ainda não foi salva',
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
        if (resposta === 'continuar' || resposta === false) return false;   /* fica */
        if (resposta === 'descartar') {
          /* Descarte EXPLICITO, e no objeto certo.
           *
           * A primeira versao fazia `f.vs = ''` e achava que tinha descartado.
           * Nao tinha: `salvarFicha` escreve no objeto da Store
           * (`Object.assign`), e `f` e' a ficha local. O `Store` continuava com
           * os 27 KB de audio — a tela seguinte abriria a mesa, `montarVS`
           * leria o mesmo campo, e a narracao "descartada" voltaria inteira.
           *
           * Descartar e' tambem uma ESCRITA: precisa passar por `salvarFicha`,
           * senao os dois lados divergem e um deles volta a mentir. E por isso
           * ela ignora a recusa de cota — apagar e' sempre possivel. */
          f.vs = ''; f.vsSeg = 0;
          salvarFicha({ vs: '', vsSeg: 0 });
          S.gravar();
          pendenteDeSalvar = false;
          dicaFalha.textContent = '';
          resetar();
          h.semGuarda();
          return true;
        }
        if (resposta === 'backup') {
          /* O backup e' feito ANTES de qualquer fechamento, e so entao a folha
           * sai. O `exportar()` le o estado em memoria, entao o audio que nao
           * coube no armazenamento vai junto — e e por isso que este botao
           * existe: e a acao que NAO perde nada. */
          try {
            const conteudo = S.exportar();
            /* `download` e' (filename, content, mime) — o NOME primeiro. A
             * chamada anterior passava o JSON como nome, e o arquivo baixado
             * chamava-se "{" e nao ".json": um backup que nem o sistema
             * operacional reconhece. */
            const nome = 'clave-backup-' + new Date().toISOString().slice(0, 10) + '.json';
            Utils.download(nome, conteudo, 'application/json');
            pendenteDeSalvar = false;
            dicaFalha.textContent = 'Backup feito — a narração está no arquivo baixado.';
            h.semGuarda();
            return true;
          } catch (e) {
            dicaFalha.textContent = 'Não consegui fazer o backup agora. Tente de novo.';
            return false;
          }
        }
        /* 'salvar': tenta o MESMO audio, sem reabrir o microfone. */
        if (btnGravar) btnGravar.click();
        return false;   /* a folha fica ate o save responder */
      });
    }

    /* PROTEÇÃO CONTRA RECARREGAR E FECHAR A ABA (FASE 10)
     *
     * O `beforeunload` e' a unica defesa contra o F5 e contra o dedo acidental
     * na barra do navegador. Ele nao garante nada: o navegador mostra uma frase
     * sua, a pessoa pode sair sem ler, e em alguns navegadores o `returnValue`
     * e' ignorado. Por isso o texto daqui NAO promete nada — ele existe para dar
     * chance, e o que garante mesmo e o backup. */
    const avisaAntesDeSair = function (ev) {
      if (!pendenteDeSalvar) return undefined;
      ev.preventDefault();
      ev.returnValue = '';
      return '';
    };
    global.addEventListener('beforeunload', avisaAntesDeSair);

    const h = UI.sheet({
        title: 'Gravar a narração', sub: 'a voz que guia o ensaio',
        body: el('div', { class: 'stack gap-3' }, [aviso, status, dicaFalha, area]),
        /* O PORTAO DE SAIDA
         *
         * Toda gravacao nao salva e um trabalho que existe na tela e em nenhum
         * outro lugar. `pendenteDeSalvar` e a condicao: existe audio em
         * memoria que o armazenamento recusou. Nao ha segundo sistema para
         * isto — e o mesmo sinalizador que decide se o botao diz "Tentar
         * salvar de novo".
         *
         * O guarda entra em `UI.sheet`, que e o unico portao de saida. Por
         * isso cobre X, Escape, backdrop, `closeAllSheets()` e qualquer botao
         * que chame `h.close()` — sem que este arquivo precise saber quais
         * existem. */
        aoFechar: function () { return perguntarAoSair(); },
        foot: [
          el('button', { class: 'btn btn-secondary', onclick: function () { if (fluxo) { fluxo.cancelar(); clearInterval(conta); } h.close(); } }, 'Cancelar'),
          btnGravar,
        ],
        onClose: function () {
          /* O `beforeunload` sai junto com a folha.
           *
           * Registrado uma vez e nunca removido, ele ficaria asking "tem
           * gravacao nao salva?" para sempre — inclusive depois de a gravacao
           * estar salva, porque a propria variavel `pendenteDeSalvar` e' da
           * folha que ja morreu. Listener vazado e' aviso que mente. */
          global.removeEventListener('beforeunload', avisaAntesDeSair);
          if (fluxo) { try { fluxo.cancelar(); } catch (e) { /* ja parou */ } clearInterval(conta); }
        },
      });
    }

    /* ---------------------------------------------------------
       A ROLAGEM DA CIFRA
       --------------------------------------------------------- */
    if (String(f.cifra || '').trim()) {
      estado.rolagem = R.painelRolagem(f.cifra, {
        bpm: f.bpm,
        compasso: f.compasso,
        fator: 1,
      });
      corpo.appendChild(estado.rolagem);
    } else {
      corpo.appendChild(el('div', { class: 'pl-rolagem-vazia' }, [
        el('i', { 'data-lucide': 'music-2', style: { width: '22px', height: '22px' } }),
        el('p', { class: 'fs-sm' }, 'Esta música ainda não tem cifra vinculada'),
      ]));
    }

    /* ---------------------------------------------------------
       AS ANOTAÇÕES COM HORA
       --------------------------------------------------------- */
    const blocoAnot = el('div', {});
    corpo.appendChild(blocoAnot);

    const listaAnot = el('div', { class: 'pl-anot-lista' });
    let itensAnot = [];

    function montarAnotacoes() {
      U.clear(blocoAnot);
      blocoAnot.appendChild(el('div', { class: 'row between mb-2' }, [
        el('div', { class: 'section-title', style: { marginBottom: '0' } },
          [el('i', { 'data-lucide': 'list-music' }), 'Anotações']),
        el('button', { class: 'btn btn-soft btn-sm', onclick: novaAnotacao },
          [el('i', { 'data-lucide': 'plus' }), 'Anotar']),
      ]));

      itensAnot = (f.anotacoes || []).slice();
      if (!itensAnot.length) {
        blocoAnot.appendChild(el('p', { class: 'fs-sm muted' },
          'Marque os momentos: "aos 1:32 a bateria entra". Clicar na anotação pula o vídeo para lá.'));
        return;
      }
      U.clear(listaAnot);
      itensAnot.forEach(function (a, i) {
        /* A linha e um `div` com papel de botao, e nao um `<button>`.
         * Motivo: o botao de apagar precisa ficar DENTRO da linha, e um botao
         * dentro de botao e HTML invalido — o navegador fecha o de fora no
         * primeiro `</button>`. O resultado era silencioso e grave: a linha
         * deixava de ser clicavel, entao clicar na anotacao nao pulava o
         * video, e o botao de apagar acabava como um botao solto na tela.
         *
         * O papel e o foco continuam igualmente acessiveis pelo teclado. */
        const linha = el('div', {
          class: 'pl-anot-item', role: 'button', tabindex: '0',
          'aria-label': 'Pular para ' + P.tempo(a.t) + ': ' + a.texto,
          onclick: function () { pularPara(a.t); },
          onkeydown: function (ev) {
            if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pularPara(a.t); }
          },
        }, [
          el('span', { class: 'pl-anot-t' }, P.tempo(a.t)),
          el('span', { class: 'pl-anot-texto grow' }, a.texto),
          el('button', {
            class: 'btn-icon sm', 'aria-label': 'Apagar anotação', title: 'Apagar',
            onclick: function (ev) {
              ev.stopPropagation();
              removerAnotacao(i);
            },
          }, el('i', { 'data-lucide': 'x' })),
        ]);
        listaAnot.appendChild(linha);
      });
      blocoAnot.appendChild(listaAnot);
    }
    montarAnotacoes();

    function novaAnotacao() {
      const t = el('input', { class: 'input mono', placeholder: 'mm:ss', value: P.tempo(relogio.posicao) });
      const txt = el('input', { class: 'input', placeholder: 'O que acontece aqui' });
      const h = UI.sheet({
        title: 'Nova anotação',
        body: el('div', { class: 'stack gap-3' }, [
          el('p', { class: 'fs-sm muted' }, 'O tempo pode ser colado como 1:32. A anotação acende quando a música chegar aí.'),
          campo('Tempo', t), campo('O que acontece', txt),
        ]),
        foot: [
          el('button', { class: 'btn btn-secondary', onclick: function () { h.close(); } }, 'Cancelar'),
          el('button', { class: 'btn btn-primary', onclick: function () {
            const texto = txt.value.trim();
            if (!texto) { txt.focus(); return; }
            const seg = segundosDoTexto(t.value);
            f.anotacoes = (f.anotacoes || []).concat([{ id: U.uid('anot'), t: seg, texto: texto }]);
            salvarFicha({ anotacoes: f.anotacoes });
            montarAnotacoes();
            h.close();
          } }, [el('i', { 'data-lucide': 'check' }), 'Salvar']),
        ],
      });
      setTimeout(function () { txt.focus(); }, 80);
    }

    function removerAnotacao(i) {
      const nova = (f.anotacoes || []).filter(function (_, j) { return j !== i; });
      f.anotacoes = nova;
      salvarFicha({ anotacoes: nova });
      montarAnotacoes();
    }

    function campo(label, control) {
      return el('div', { class: 'field' }, [el('label', { class: 'label' }, label), control]);
    }

    /* ---------------------------------------------------------
       OS CONTROLES DE VOLUME

       A mistura ja existe desde a faixa narrada. Aqui so entram os controles,
       que leem e escrevem nela.
       --------------------------------------------------------- */

    const controles = el('div', { class: 'pl-controles' });
    const relogioTxt = el('span', { class: 'pl-relogio' }, '0:00');
    /* A barra so vale quando ha duracao conhecida. Sem ela, um cursor que anda
       sozinho sobre uma linha sem medida induz a pessoa a procurar um tempo
       que o app nao tem — e a barra parada seria melhor. */
    const barra = el('input', { class: 'pl-barra', type: 'range', min: '0', max: '1000', value: '0',
      'aria-label': 'Posição do ensaio' });
    function pintarBarra(pos) {
      const dur = duracaoEnsaio();
      barra.style.display = dur > 0 ? '' : 'none';
      if (dur > 0) barra.value = String(Math.round(Math.min(1, pos / dur) * 1000));
    }
    pintarBarra(0);
    barra.addEventListener('input', function () {
      const frac = Number(barra.value) / 1000;
      const dur = duracaoEnsaio();
      if (dur > 0) pularPara(frac * dur);
    });

    controles.appendChild(el('div', { class: 'pl-controle-linha' }, [
      botaoComecar,
      relogioTxt,
      el('div', { class: 'grow' }, barra),
      el('div', { class: 'row gap-1' }, [
        campoVolume('video', 'Vídeo'),
        campoVolume('voz', 'Voz'),
        campoVolume('metr', 'Compasso'),
      ]),
    ]));

    function campoVolume(qual, rotulo) {
      const r = el('input', {
        type: 'range', class: 'pl-vol', min: '0', max: '100',
        value: String(mistura.valores[qual]), 'aria-label': 'Volume do ' + rotulo,
        title: rotulo,
      });
      r.addEventListener('input', function () {
        mistura.definir(qual, r.value);
        if (qual === 'metr' && global.Metro) {
          global.Metro.definir('volume', Number(r.value) / 100);
        }
        if (qual === 'voz' && audioVS) mistura.aplicar();
      });
      return el('label', { class: 'pl-vol-caixa', title: rotulo }, [
        el('i', { 'data-lucide': qual === 'video' ? 'youtube' : qual === 'voz' ? 'audio-lines' : 'timer' }),
        r,
      ]);
    }

    corpo.appendChild(controles);
    // O campo do BPM fica ao lado do compasso e da rolagem, que e onde o olho
    // ja esta.
    const blocoBpm = el('div', { class: 'pl-bpm' });
    corpo.appendChild(blocoBpm);
    montarBpm();

    function montarBpm() {
      U.clear(blocoBpm);
      const Metro = global.Metro;
      const num = el('span', { class: 'mbpm-num' }, String(f.bpm || 100));
      /* O metrônomo e ajustado ao abrir a mesa, e nao so quando o botao
       * "Começar" e apertado. Sem isto, a tela mostrava 122 bpm e o
       * metrônomo marcava 100 — o valor global do app. Quem regula no
       * andamento da musica e ouve outro, e o corpo inteiro sai do compasso
       * sem nenhuma pista do motivo.
       *
       * O compasso tambem: o motor guarda em numero, e a cifra em texto. */
      if (Metro && f.bpm) {
        Metro.aplicar({
          bpm: f.bpm,
          compasso: String(f.compasso || '4/4').split('/')[0],
          som: S.ajuste('metroSom', 'click'),
          volume: mistura.valores.metr / 100,
          subdivisao: S.ajuste('metroSubdivisao', 1),
          acento: S.ajuste('metroAcento', true),
        });
      }
      const btn = el('button', { class: 'mbpm-btn', type: 'button', 'aria-label': 'Tocar o compasso',
        onclick: function () {
          if (!Metro) return;
          Metro.alternar();
          U.clear(btn);
          btn.appendChild(el('i', { 'data-lucide': Metro.METRONOME.tocando ? 'square' : 'play' }));
        } }, el('i', { 'data-lucide': 'play' }));
      blocoBpm.appendChild(btn);
      blocoBpm.appendChild(el('span', { class: 'mbpm-ajuste' }, [
        el('button', { type: 'button', 'aria-label': 'Diminuir andamento',
          onclick: function () { moverBpm(-1); } }, '−'),
        num,
        el('button', { type: 'button', 'aria-label': 'Aumentar andamento',
          onclick: function () { moverBpm(1); } }, '+'),
      ]));
      blocoBpm.appendChild(el('span', { class: 'mbpm-compasso' }, f.compasso || '4/4'));
      blocoBpm.appendChild(el('span', { class: 'fs-xs muted' }, 'bpm'));

      function moverBpm(d) {
        f.bpm = U.clamp((Number(f.bpm) || 100) + d, 20, 320);
        num.textContent = String(f.bpm);
        if (Metro) Metro.definir('bpm', f.bpm);
        salvarFicha({ bpm: f.bpm });
        // A rolagem usa o andamento para saber quanto tempo dura a linha. A
        // ficha ja foi montada com o BPM antigo, entao o roteiro precisa ser
        // refeito — sem isto, mudar o andamento mudava o numero na tela e o
        // metrônomo, e a cifra continuava andando no tempo anterior.
        if (estado.rolagem && estado.rolagem.definirVelocidade) {
          estado.rolagem.definirVelocidade(1);
          estado.rolagem = R.painelRolagem(f.cifra, { bpm: f.bpm, compasso: f.compasso, fator: 1 });
          const antiga = corpo.querySelector('.cs');
          if (antiga) {
            const nova = estado.rolagem;
            antiga.parentNode.replaceChild(nova, antiga);
            estado.linhaAtual = -1;
          }
        }
      }
    }

    /* ---------------------------------------------------------
       O RELOGIO DA SESSAO

       A duracao do ensaio e a da gravacao da voz, quando existe — e e exata,
       porque a pessoa sabe quanto falou. Sem gravacao, e a do video, quando o
       YouTube responde.

       Sem nenhum dos dois, nao ha duracao nenhuma: o relogio fica sem teto.
       E o certo. A alternativa — usar o tamanho da cifra como se fosse a
       duracao — quebrava o feature mais importante da mesa: com uma cifra de
       seis linhas, o fim estimado era cinco segundos, e clicar numa anotacao
       "aos 0:32" era jogado de volta para 0:05. O clico pareceria quebrado,
       e a anotacao mais importante da musica seria a impossivel de usar.
       --------------------------------------------------------- */
    function duracaoEnsaio() {
      if (f.vsSeg) return f.vsSeg;
      if (estado.duracaoDoVideo) return estado.duracaoDoVideo;
      return 0;   // sem teto conhecido
    }

    cancelarInscricao = relogio.inscrever(function (pos, tocando) {
      relogioTxt.textContent = P.tempo(pos);
      pintarBarra(pos);

      // A rolagem segue o mesmo tempo do relogio.
      if (estado.rolagem && estado.rolagem.linhaNoTempo) {
        const linha = estado.rolagem.linhaNoTempo(pos);
        if (linha !== estado.linhaAtual) {
          estado.linhaAtual = linha;
          // `destacar` para o laco proprio do scroller; aqui quem manda e o
          // relogio da mesa.
          estado.rolagem.destacar(linha);
        }
      }

      // A anotacao que esta passando acende.
      const linhaAnot = listaAnot.children;
      for (let i = 0; i < linhaAnot.length; i++) {
        const t = Number(itensAnot[i] ? itensAnot[i].t : -1);
        const passou = t >= 0 && pos >= t && pos < t + 6;
        linhaAnot[i].classList.toggle('agora', passou);
      }

      if (!tocando && estado.tocando === 'tocando') {
        estado.tocando = false;
        U.clear(botaoComecar);
        botaoComecar.appendChild(el('i', { 'data-lucide': 'play' }));
        botaoComecar.appendChild(document.createTextNode(' Começar'));
      }
    });

    botaoComecar.addEventListener('click', function () {
      if (estado.tocando === 'tocando') { parar(); return; }
      comecar();
    });

    /** Repinta o que depende do tempo. */
    function pintar() {
      relogio.irPara(relogio.posicao);
    }

    function comecar() {
      const temVoz = !!audioVS;
      const temVideo = !!estado.player;
      // Quem pausou no meio da passagem e voltou a tocar continua de onde
      // parou. Recomecar do zero so quando nunca comecou — e o que o botao
      // "Começar" promete.
      const jaPausou = estado.tocando === 'pausado';
      estado.tocando = 'tocando';

      if (temVoz && audioVS) {
        if (!jaPausou) audioVS.currentTime = 0;
        audioVS.play().catch(function () {
          UI.toast('Não consegui tocar a narração. Toque no vídeo para liberar o áudio.', { tipo: 'err', dur: 5000 });
        });
        relogio.iniciar(f.vsSeg || 0, !jaPausou);
        // O video entra junto, mas sem mandar no tempo: quem guia e a voz.
        if (temVideo) {
          try { estado.player.playVideo(); } catch (e) { /* o video tem controle proprio */ }
        }
      } else if (temVideo) {
        // Sem gravacao, quem manda no tempo e o video: o relogio da mesa
        // acompanha a posicao dele.
        try { estado.player.playVideo(); } catch (e) { /* o video tem controle proprio */ }
        seguirVideo();
      } else {
        // Sem video e sem voz, o relogio proprio roda sem teto conhecido: com
        // o texto so, ninguem sabe quanto tempo a musica leva.
        relogio.iniciar(duracaoEnsaio(), !jaPausou);
      }

      if (global.Metro && f.bpm) {
        global.Metro.aplicar({
          bpm: f.bpm, som: S.ajuste('metroSom', 'click'),
          volume: mistura.valores.metr / 100,
          subdivisao: S.ajuste('metroSubdivisao', 1),
          acento: S.ajuste('metroAcento', true),
        });
        global.Metro.iniciar();
      }

      U.clear(botaoComecar);
      botaoComecar.appendChild(el('i', { 'data-lucide': 'square' }));
      botaoComecar.appendChild(document.createTextNode(' Parar'));
    }

    function parar() {
      if (audioVS) { audioVS.pause(); }
      if (estado.player && typeof estado.player.pauseVideo === 'function') {
        try { estado.player.pauseVideo(); } catch (e) { /* ignora */ }
      }
      relogio.pausar();
      pararSeguirVideo();
      if (global.Metro) global.Metro.parar();
      // "pausado" e nao "parado": distingue voltar a ouvir da mesma passagem de
      // comecar o ensaio de novo. O relogio guarda a posicao; quem decide o
      // que fazer com ela e `comecar`.
      estado.tocando = 'pausado';
      U.clear(botaoComecar);
      botaoComecar.appendChild(el('i', { 'data-lucide': 'play' }));
      botaoComecar.appendChild(document.createTextNode(' Continuar'));
    }

    /* O video manda no relogio quando nao ha narração: a cada passo, a posicao
       dele vira a posicao da mesa.

       O laco para quando a mesa nao esta tocando — e nao quando o video para.
       Sao coisas diferentes: quem pausa a mesa antes de o video terminar nao
       pode deixar um laco de leitura de tempo rodando em segundo plano.

       O passo e um temporizador, e nao `requestAnimationFrame`, por causa do
       mesmo motivo do relogio: com a aba oculta — o estado normal de quem
       trocou de app no meio do ensaio — o quadro para de vir, e a mesa
       pararia de acompanhar o video. Ler a posicao de um video e uma operacao
       barata e que nao precisa de sessenta vezes por segundo.

       A API do YouTube nem sempre fica pronta: ela depende de script de
       terceiro, de cookies e de rede, e nenhuma dessas coisas se garante num
       ensaio. Quando ela nao responde, este laco NAO fica parado esperando —
       assume o tempo com o relogio proprio, que e a mesma estimativa que a
       rolagem da cifra ja usa. A mesa funciona nos dois casos; o que se perde
       sem a API e o video tocar junto, e o app avisa. */
    let semResposta = 0;
    function seguirVideo() {
      quadroFollow = 0;
      if (estado.tocando !== 'tocando' || !estado.player) return;
      if (typeof estado.player.getCurrentTime === 'function') {
        const t = estado.player.getCurrentTime();
        if (typeof t === 'number' && isFinite(t) && t > 0) {
          semResposta = 0;
          relogio.irPara(t);
          quadroFollow = global.setTimeout(seguirVideo, 250);
          return;
        }
      }
      // O player existe mas nao devolve posicao. Depois de tres segundos sem
      // uma unica resposta, e o relogio que assume.
      semResposta++;
      if (semResposta > 12) {
        estado.videoSemControle = true;
        // Sem teto conhecido, o relogio roda livre. Com teto, roda ate ele.
        relogio.iniciar(duracaoEnsaio(), false);
        avisoVideo();
        return;
      }
      quadroFollow = global.setTimeout(seguirVideo, 250);
    }

    /** Diz que o video entrou sem controle, e o que a pessoa pode fazer. */
    function avisoVideo() {
      if (estado.avisouVideo) return;
      estado.avisouVideo = true;
      UI.toast('O vídeo entrou sem controle aqui. Ele toca com os botões dele; a cifra, as anotações e o compasso seguem no tempo.',
        { tipo: 'info', dur: 7000 });
    }

    function pararSeguirVideo() {
      if (quadroFollow) global.clearTimeout(quadroFollow);
      quadroFollow = 0;
      semResposta = 0;
    }

    function pularPara(segundos) {
      const t = Math.max(0, Number(segundos) || 0);
      if (audioVS) audioVS.currentTime = t;
      if (estado.player && typeof estado.player.seekTo === 'function') {
        try { estado.player.seekTo(t, true); } catch (e) { /* ignora */ }
      }
      relogio.irPara(t);
      if (estado.tocando !== 'tocando') {
        // Pular com a mesa parada leva a rolagem junto, sem comecar a tocar.
        if (estado.rolagem && estado.rolagem.linhaNoTempo) {
          estado.linhaAtual = estado.rolagem.linhaNoTempo(t);
          estado.rolagem.destacar(estado.linhaAtual);
        }
      }
    }

    /* ---------------------------------------------------------
       GRAVAR A FICHA
       --------------------------------------------------------- */
    function salvarFicha(campos) {
      if (f.musicaId) {
        // Vem de uma escala: grava na musica da escala.
        const esc = S.porId(f.escalaId);
        if (!esc) return;
        const m = esc.musicas.find(function (x) { return x.id === f.musicaId; });
        if (!m) return;
        Object.assign(m, campos);
        S.mudou('escala');
        return;
      }
      // Vem do repertorio: grava na cifra.
      const c = f.cifraId ? S.cifraPorId(f.cifraId) : null;
      if (!c) return;
      Object.assign(c, campos);
      S.mudou('cifra');
    }

    /* ---------------------------------------------------------
       A FOLHA
       --------------------------------------------------------- */
    const h = UI.sheet({
      title: 'Mesa de ensaio',
      sub: f.titulo,
      wide: true,
      body: corpo,
      onClose: encerrar,
    });

    /* A folha em tela cheia perde a moldura e o limite de largura. A classe e
       *posta* aqui, e nao no `emMudanca`, porque quem muda e o navegador: o
       `fullscreenchange` chega quando a tela entra ou sai, inclusive quando a
       saida foi por Esc ou por gesto do sistema — e nesse caso ninguem do app
       pediu nada. */
    function marcarTelaCheia(ligada) {
      if (!h || !h.node) return;
      h.node.classList.toggle('viva-cheia', !!ligada);
    }

    /* ---------------------------------------------------------
       A MESA VIVA

       Entra depois da folha existir, porque e a folha que entra em tela cheia:
       em tela cheia so do `corpo`, o cabecalho da folha — e com ele o botao de
       fechar — ficariam fora da tela, e a pessoa so sairia com Esc.
       --------------------------------------------------------- */
    const Viva = global.Viva;
    if (Viva && typeof Viva.criar === 'function') {
      viva = Viva.criar({
        alvo: h.node,
        /* O relogio para no ultimo ponto conhecido. */
        aoFicar: function () { if (relogio) relogio.congelar(); },
        aoVoltar: function (houve) {
          if (!relogio) return;
          relogio.degelar(houve);
          /* O tempo que passou com a tela apagada nao e reconstruivel: o
             navegador nao conta o que aconteceu com a aba oculta. Dizer isto
             e melhor que fingir que o ensaio seguiu — um relogio que corre
             sozinho na tela escura faz a cifra pular de um lugar para outro
             quando a pessoa volta. */
          if (houve && estado.tocando === 'tocando') {
            UI.toast('O tempo parou enquanto a tela estava apagada', { tipo: 'info' });
          }
          pintar();
        },
        emMudanca: function (e) {
          /* O estado da tela cheia vem do navegador, nunca da promessa do
             pedido: se o pedido foi recusado, `emMudanca` nunca ve `true` e
             o botao continua dizendo o que e verdade. */
          marcarTelaCheia(e.telaCheia);
          if (!botaoTelaCheia) return;
          botaoTelaCheia.classList.toggle('ligado', !!e.telaCheia);
          /* O rotulo descreve a ACAO de agora, nao o estado: "Entrar em tela cheia"
             enquanto esta fora, "Sair da tela cheia" enquanto esta dentro. Um
             rotulo que nomeia o estado ("Tela cheia") obriga quem le com tela
             de leitor a adivinhar se o botao entra ou sai. O `title` anda
             junto para o mouse; os dois nascem no mesmo lugar de proposito,
             porque dois rotulos que secontradizem sao pior que um so. */
          const acao = e.telaCheia ? 'Sair da tela cheia' : 'Entrar em tela cheia';
          botaoTelaCheia.setAttribute('aria-label', acao);
          botaoTelaCheia.title = acao;
          const marca = e.telaCheia ? 'minimize' : 'maximize';
          if (botaoTelaCheia.dataset.estado !== marca) {
            botaoTelaCheia.dataset.estado = marca;
            U.clear(botaoTelaCheia);
            botaoTelaCheia.appendChild(el('i', { 'data-lucide': marca }));
            UI.icons(botaoTelaCheia);
          }
          if (!e.suportaTelaCheia) {
            botaoTelaCheia.disabled = true;
            botaoTelaCheia.title = 'Este navegador não tem tela cheia';
          }
        },
      });
      viva.abrir();
    } else {
      /* Sem o modulo nao ha quem atenda o clique, e o botao ficaria ali,
         ativo, sem fazer nada — a pior forma de desabilitar: parece quebra.
         Ele se desliga e diz por que, que e o que o comentario acima promete. */
      botaoTelaCheia.disabled = true;
      botaoTelaCheia.title = 'Tela cheia indisponível nesta instalação';
    }

    UI.icons(corpo);
    return h;
  }

  /** Encerra a sessao: para o relogio e o video, e solta quem escutava. */
  function encerrar() {
    if (cancelarInscricao) { cancelarInscricao(); cancelarInscricao = null; }
    /* A mesa viva e a primeira a sair: ela solta o Wake Lock e tira os
       ouvintes de visibilidade e de tela cheia. Fechar a folha deixando um
       handle de tela acesa vivo significa continuar com a tela do aparelho
       ligada depois de a tela do app ter sumido. */
    if (viva) { viva.destruir(); viva = null; }
    if (relogio) { relogio.pausar(); relogio = null; }
    // O laco que le a posicao do video e um temporizador. Sem este
    // cancelamento, fechar a mesa no meio do ensaio deixaria ele rodando: o
    // video sai do documento e `getCurrentTime` passa a devolver 0, entao o
    // laco continua puxando a rolagem para o comeco, sozinho, numa tela
    // fechada.
    if (quadroFollow) { global.clearTimeout(quadroFollow); quadroFollow = 0; }
  }

  /** "1:32" ou "92" -> segundos. Devolve 0 para o que nao da para ler. */
  function segundosDoTexto(s) {
    const t = String(s || '').trim();
    if (!t) return 0;
    if (t.indexOf(':') >= 0) {
      const p = t.split(':').map(function (n) { return parseInt(n, 10) || 0; });
      if (p.length === 2) return U.clamp(p[0] * 60 + p[1], 0, 3600);
      if (p.length === 3) return U.clamp(p[0] * 3600 + p[1] * 60 + p[2], 0, 3600);
      return 0;
    }
    return U.clamp(parseInt(t, 10) || 0, 0, 3600);
  }

  /** Abre a mesa de uma musica de uma escala. */
  function abrirDeMusica(escala, musica) {
    return abrir(S.fichaDe(musica, escala));
  }

  /** Abre a mesa de uma cifra do repertorio. */
  function abrirDeCifra(cifra) {
    const f = S.fichaDaCifra(cifra);
    f.cifraId = cifra.id;
    return abrir(f);
  }

  V.palco = {
    abrir: abrir,
    abrirDeMusica: abrirDeMusica,
    abrirDeCifra: abrirDeCifra,
    segundosDoTexto: segundosDoTexto,
  };
  global.PalcoView = V.palco;

  if (typeof module !== 'undefined' && module.exports) module.exports = V.palco;
})(typeof window !== 'undefined' ? window : globalThis);