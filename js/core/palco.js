/* =========================================================
   ACORDE - core/palco.js
   A mesa de ensaio: video, audio da voz, BPM e anotacoes juntos.

   O PROBLEMA QUE ESTE MODULO RESOLVE

   A ficha de uma musica estava partida em lugares diferentes, e nada andava
   junto:

     - o video do YouTube era um link que jogava para fora do app;
     - a faixa narrada (a voz que a pessoa gravou) tocava em um `<audio>` solto;
     - o BPM era um numero escrito num badge;
     - as anotacoes eram texto num campo de texto.

   Quem ensaia precisa das quatro coisas ao mesmo tempo. Tocando a faixa da
   voz, a pessoa quer ver o video na mesma posicao, ver o compasso, e saber o
   que acontece em cada momento. Com cada uma num controle separado, o
   trabalho de juntar tudo caia em quem devia estar tocando.

   A ESCOLHA DE NAO SINCRONIZAR COM O VIDEO

   Existe um YouTube Player API que daria para ler a posicao do video e casar
   com o audio. Nao e o que acontece aqui, por um motivo concreto: o video do
   YouTube carrega pela rede, e a gravacao da voz esta no aparelho. Os dois nao
   tem a mesma origem, entao nao tem o mesmo instante zero — sincronizar exigiria
   medir o atraso da rede a cada carregamento, o que falha em conexao ruim, e o
   resultado seria um silencio entre um e outro.

   Em vez disso a voz e o relogio. A pessoa grava falando no tempo certo — e
   por isso que o gravador insiste nisso — e quem toca segue a voz. O video
   entra junto, sem ser o dono do tempo. O mesmo principio que ja valia para o
   ensaio sem video, agora com o video tambem.

   QUANDO O VIDEO E O DONO DO TEMPO

   Quando nao ha gravacao da voz, o video assume: o app mede o tempo do video
   e a rolagem da cifra segue ele. A leitura da posicao usa a API oficial,
   carregada sob demanda, e a rolagem cai no relogio proprio se a API nao
   responder — que e o que acontece offline e em rede ruim.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;

  /* ------------------------------------------------------------
     O RELOGIO DA MESA

     Um unico lugar que sabe "agora estamos em X segundos". Todos os outros —
     a rolagem da cifra, o metronomo, a linha de anotacao que acende — escutam
     este. Ninguem tem relogio proprio: dois relogios num ensaio e o que produz
     a linha de acordes um compasso adiantada em relacao a voz.
     ------------------------------------------------------------ */
  function criarRelogio() {
    let tocando = false;
    let posicao = 0;          // segundos desde o comeco
    let ultimoQuadro = 0;     // o instante do ultimo passo
    let quadro = 0;           // identificador do quadro, para cancelar
    let relogio = 0;          // id do temporizador, no caminho sem quadro
    let duracao = 0;          // 0 = sem limite conhecido
    const inscritos = [];

    function avisar() {
      for (const f of inscritos.slice()) {
        try { f(posicao, tocando); } catch (e) { console.error('[Palco]', e); }
      }
    }

    /** O instante do relogio do aparelho, na mesma unidade nos dois casos. */
    function agora() {
      return global.performance ? global.performance.now() : Date.now();
    }

    /**
     * Um passo do relogio.
     *
     * A posicao vem do tempo REAL decorrido, nunca de um passo fixo. Um passo
     * fixo perde tempo sempre que o aparelho demora: um `+50ms` somado por
     * quadro, num aparelho que roda a 20 quadros por segundo, faz a rolagem
     * andar para a metade da velocidade real. Num ensaio, isso e a diferenca
     * entre a linha de acordes chegar junto com a voz e nao chegar.
     */
    function passo() {
      if (!tocando) return;
      const t = agora();
      posicao += (t - ultimoQuadro) / 1000;
      ultimoQuadro = t;
      if (duracao > 0 && posicao >= duracao) {
        posicao = duracao;
        tocando = false;
        parar();
        avisar();
        return;
      }
      avisar();
      agendar();
    }

    /**
     * Agenda o proximo passo.
     *
     * `requestAnimationFrame` e o certo: ele acompanha a tela e nao gasta
     * bateria com a aba em segundo plano. Mas ele NAO roda quando a aba esta
     * oculta — e no celular isso acontece o tempo todo: a pessoa troca de app
     * para responder alguem, volta, e encontra a rolagem parada no ponto em
     * que deixou. Como o relogio parou, o tempo do ensaio parou com ele.
     *
     * Por isso o passo e de 100 ms, e nao de um quadro: um passo tanho
     * continua funcionando com a aba oculta, e o custo e imperceptivel — sao
     * dez atualizacoes por segundo, e o que se repinta e uma linha de texto.
     */
    function agendar() {
      quadro = 0;
      relogio = global.setTimeout(passo, 100);
    }

    /** Cancela o passo agendado, qualquer que seja o caminho. */
    function parar() {
      if (quadro) { global.cancelAnimationFrame(quadro); quadro = 0; }
      if (relogio) { global.clearTimeout(relogio); relogio = 0; }
    }

    return {
      get tocando() { return tocando; },
      get posicao() { return posicao; },
      get duracao() { return duracao; },

      /**
       * Quem escuta. Devolve a funcao para cancelar — quem assina e sai da tela
       * no mesmo instante, sem isso o laco continua rodando em uma tela
       * fechada e a rolagem continua andando sem ninguem ver.
       */
      inscrever(f) {
        inscritos.push(f);
        return function () {
          const i = inscritos.indexOf(f);
          if (i >= 0) inscritos.splice(i, 1);
        };
      },

      /**
       * Comeca a correr.
       *
       * `dur` so e lido quando a duracao ainda nao foi conhecida. Passar um
       * valor novo a cada chamada faria a mesa aceitar qualquer duracao
       * declarada e nunca travar no fim — e o ensaio terminaria sem a rolagem
       * parar, que e o que acontece quando o app nao sabe a duracao da musica.
       *
       * `voltarAoZero` existe porque quem chama isto pode estar retomando. Sem
       * ele, voltar a tocar depois de pausar recomeçaria do comeco: quem pausou
       * na passagem e voltou ouviria o ensaio inteiro de novo.
       */
      iniciar(dur, voltarAoZero) {
        if (typeof dur === 'number' && dur > 0 && duracao <= 0) duracao = dur;
        if (voltarAoZero !== false) posicao = 0;
        if (tocando) return;
        tocando = true;
        ultimoQuadro = agora();
        avisar();
        agendar();
      },

      /** Para onde esta agora, sem parar. */
      pausar() {
        if (!tocando) return;
        tocando = false;
        parar();
        avisar();
      },

      /**
       * Pula para um ponto. E o que as anotacoes fazem ao serem clicadas.
       *
       * `ultimoQuadro` e reajustado ao mesmo tempo: sem isso, o proximo quadro
       * contaria como tempo passado o intervalo entre o pulo e o quadro — e a
       * rolagem andaria alguns segundos a mais do que devia num pulo de tres
       * segundos. O erro se repete a cada anotacao clicada.
       */
      irPara(segundos) {
        const t = Math.max(0, Number(segundos) || 0);
        posicao = duracao > 0 ? Math.min(t, duracao) : t;
        ultimoQuadro = agora();
        avisar();
      },

      /**
       * A duracao conhecida.
       *
       * Existe separada do construtor porque a duracao real so aparece depois
       * que o video responde — e e exatamente a partir dela que o pulo por uma
       * anotacao funciona. Sem isto, a mesa usava a duracao *estimada* da
       * rolagem da cifra: com uma cifra curta, o fim estimado era 0:05, e
       * clicar na anotacao "aos 0:32" jogava a mesa de volta para 0:05 sem
       * mover nada. O clico parecia quebrado.
       */
      informarDuracao(d) {
        const n = Number(d);
        if (isFinite(n) && n > 0) { duracao = n; return duracao; }
        return duracao;
      },
    };
  }

  /* ------------------------------------------------------------
     FORMATO DE TEMPO

     Mesma conta do gravador: "1:04". Uma unica funcao, porque dois lugares
     com duas contas diferentes produzem "1:04" e "01:04" na mesma tela.
     ------------------------------------------------------------ */
  function tempo(segundos) {
    const s = Math.max(0, Math.floor(Number(segundos) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const seg = s % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(seg).padStart(2, '0');
    return m + ':' + String(seg).padStart(2, '0');
  }

  /* ------------------------------------------------------------
     O YOUTUBE COMO RELOGIO (quando nao ha gravacao)

     A API oficial precisa de um script da propria Google. Carregar sempre
     custaria uma requisicao a mais para quem nunca abre o video, e o app
     funciona sem ela. Por isso so e carregada quando este modulo e usado, e a
     falha e absorvida: o relogio proprio assume.
     ------------------------------------------------------------ */
  let apiPronta = null;
  let apiFalhou = false;

  function carregarApi() {
    if (apiPronta) return apiPronta;
    if (apiFalhou) return Promise.resolve(null);
    apiPronta = new Promise(function (resolve) {
      // Se ja veio de outro lugar (o app inteiro usa a API), usa a que existe.
      if (global.YT && typeof global.YT.Player === 'function') { resolve(global.YT); return; }
      if (typeof global.YT === 'undefined') {
        const w = global;
        const anterior = w.onYouTubeIframeAPIReady;
        w.onYouTubeIframeAPIReady = function () {
          if (typeof anterior === 'function') anterior();
          resolve(w.YT || null);
        };
      }
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = function () { apiFalhou = true; resolve(null); };
      document.head.appendChild(s);
      // Se em seis segundos a API nao respondeu, o app para de esperar. Um
      // video carregado em rede ruim nao pode travar a tela de ensaio.
      setTimeout(function () { resolve(global.YT || null); }, 6000);
    });
    return apiPronta;
  }

  /* ------------------------------------------------------------
     O VOLUME

     A mesa de ensaio tem tres sons: o video, a voz de quem guia e o
     metronomo. Em cima do volume do aparelho, quem conduz o ensaio precisa
     escolher: voz alta e metronomo baixo, ou o contrario. Um controle de
     volume por fonte e o que torna os tres coexistirem.

     O player do YouTube entra pela propriedade `player`, e nao pelo
     construtor: a API do YouTube so responde segundos depois de a tela abrir,
     e um player guardado como argumento no momento da construcao seria
     `null` para sempre — o controle de volume do video apareceria na tela e
     nao faria nada.
     ------------------------------------------------------------ */
  function criarMistura(audioEl, player, padroes) {
    const v = Object.assign({ video: 100, voz: 100, metr: 70 }, padroes || {});
    let elAudio = audioEl;
    let yt = player || null;

    function fracao(x) { return Math.max(0, Math.min(1, Number(x) / 100)); }

    function aplicar() {
      // O video e o `iframe` antes de a API vir: sem a API nao ha como mudar o
      // volume por dentro, e mexer no atributo nao faria nada.
      if (yt && typeof yt.setVolume === 'function') {
        try { yt.setVolume(Math.round(fracao(v.video) * 100)); } catch (e) { /* ignora */ }
      }
      if (elAudio) elAudio.volume = fracao(v.voz);
      return v;
    }

    // O volume ja entra aplicado. Um `<audio>` nasce no volume maximo do
    // aparelho, entao uma mistura com a voz em 50 so valeria depois que a
    // pessoa mexesse no controle — e o primeiro toque da mesa sairia alto,
    // por cima da banda, exatamente o que o controle existe para evitar.
    aplicar();

    return {
      valores: v,
      /** Troca o player quando a API do YouTube responde. */
      definirPlayer(p) { yt = p || null; return aplicar(); },
      /** Troca o elemento de audio: quem chama `montarVS` recria o `<audio>`. */
      definirAudio(a) { elAudio = a || null; return aplicar(); },
      definir(qual, valor) { v[qual] = U.clamp(Number(valor) || 0, 0, 100); return aplicar(); },
      aplicar: aplicar,
    };
  }

  global.Palco = {
    criarRelogio: criarRelogio,
    tempo: tempo,
    criarMistura: criarMistura,
    carregarApi: carregarApi,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.Palco;
})(typeof window !== 'undefined' ? window : globalThis);