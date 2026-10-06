/* =========================================================
   ACORDE - core/viva.js
   A mesa de ensaio sobrevive a um ensaio de verdade.

   O PROBLEMA

   A mesa e a tela mais bem construida do produto: video, voz gravada, BPM e
   anotacoes juntos, com a rolagem da cifra seguindo o mesmo tempo. E nenhuma
   delas sobrevive a duas horas de ensaio com o celular num suporte.

   O aparelho apaga a tela. Sem Wake Lock nao ha como pedir que nao apague, e o
   navegador nao avisa: a tela simplesmente escurece. O audio do YouTube
   continua, e o `setTimeout` que move a rolagem e suspenso — de modo que a
   rolagem da cifra, as anotacoes que acendem e o BPM param de acompanhar a
   musica. Quem esta tocando acorda o aparelho a cada meio minuto.

   Sao tres coisas que faltavam, todas do mesmo navegador:

     - Wake Lock, para a tela nao apagar;
     - tela cheia, para a cifra ocupar o aparelho inteiro;
     - `visibilitychange`, para saber que houve uma interrupcao.

   POR QUE UM MODULO E NAO TRES TRECHOS NO PALCO

   Porque as tres sao a MESMA coisa vistas de tres angulos: o estado de
   visibilidade do documento, e o que se faz em cada borda dele. Espalhadas
   pelo `palco.js` — que ja passa de mil e duzentas linhas e monta o DOM
   inteiro — virariam tres lugares para lembrar de tirar no fechamento, e o
   forgets o mais caro: um Wake Lock orfao segurando a tela acesa numa tela que
   ja nao existe.

   Aqui ha UM dono de cada recurso. Quem abre recebe um objeto; quem fecha
   chama `destruir()` e nao sobra referencia.

   O QUE ESTE NAO PROMETE

   Nao promete que a tela nunca apaga. O Wake Lock e um pedido, nao uma ordem:
   o aparelho economizador, a politica do sistema e o bloqueio manual do
   usuario nao pedem licenca a nenhum site, e nenhum site pode obrigar nenhum
   deles. Pedir e o maximo que um app web pode fazer, e e o maximo que este faz.

   Nao promete tela cheia automatica. O navegador exige um gesto, e pedido sem
   gesto e recusado sem erro. Aqui o pedido so acontece dentro de um clique, e
   se for recusado a mesa continua como estava.

   Nao promete que o ensaio continue tocando em segundo plano. Quando a aba
   some, o navegador congela os temporizadores e nao diz o que aconteceu. Este
   modulo NAO inventa o que aconteceu: congela o relogio no ultimo ponto
   conhecido e avisa que o tempo parou. Mentir seria pior — um relogio que
   corre sozinho na tela escura deixa a cifra pulando de um lugar para outro
   quando a pessoa volta.
   ========================================================= */
(function (global) {
  'use strict';

  /**
   * Cria o dono dos recursos de "mesa viva".
   *
   * `opcoes`:
   *   alvo        elemento que entra em tela cheia (a folha da mesa, e nao o
   *               `.palco`: em tela cheia do conteudo o botao de fechar
   *               ficaria fora da tela e a pessoa so sairia com Esc)
   *   aoFicar     chamado quando o documento fica oculto
   *   aoVoltar    chamado quando volta, com `true` quando houve interrupcao
   *               em que o relogio ficou parado
   *   emMudanca   chamado sempre que o estado muda, para quem pinta a interface
   *
   * Devolve sempre um objeto. Sem nenhuma das duas APIs, esse objeto funciona
   * e diz que nao suporta — que e o que a interface precisa para nao prometer
   * o que nao pode cumprir.
   */
  function criar(opcoes) {
    opcoes = opcoes || {};
    const doc = opcoes.document || global.document;
    const nav = opcoes.navigator || global.navigator;

    // Quem guarda o handle do Wake Lock. `null` e "nao tenho".
    let sentinela = null;
    // Verdadeiro enquanto o pedido esta em voo, para que dois cliques rapidos
    // nao virem dois Wake Locks. A promessa e o unico lugar onde isto mora.
    let pedindo = false;
    // A mesa esta aberta? Enquanto nao, nada e adquirido nem reexigido.
    let aberto = false;
    // Houve uma interrupcao em que o relogio ficou parado.
    let interrompido = false;
    // O navegador recusou o pedido. NAO e a pessoa recusando: nao existe botao
    // para recusar, e inventar essa figura esconderia o motivo verdadeiro — a
    // pagina nao estava visivel, ou o aparelho esta economizando bateria.
    let recusado = false;

    function aoMudar() {
      if (typeof opcoes.emMudanca === 'function') {
        try { opcoes.emMudanca(estado()); } catch (e) { /* quem pinta nao derruba a mesa */ }
      }
    }

    function estado() {
      return {
        suportaAcender: podeAcender(),
        acendendo: !!sentinela,
        pedido: pedindo,
        recusado: recusado,
        suportaTelaCheia: podeTelaCheia(),
        telaCheia: emTelaCheia(),
        interrompido: interrompido,
        aberto: aberto,
      };
    }

    /* ---------------------------------------------------------
       ACENDER A TELA
       --------------------------------------------------------- */

    function podeAcender() {
      // Wake Lock e so em contexto seguro. `isSecureContext` e false em
      // `http://` comum, e ai o navegador nem expoe `navigator.wakeLock`.
      return !!(nav && nav.wakeLock && typeof nav.wakeLock.request === 'function');
    }

    /**
     * Pede a tela acesa.
     *
     * Devolve uma promessa, mas a interface nunca depende dela: quem chama
     * normalmente nao espera, e o estado muda pelo `emMudanca`. A promessa
     * existe para o teste poder observar, e para a recusa nao virar
     * `unhandledrejection` — uma promessa rejeitada e nao tratada aparece
     * como erro no console, e ai parece defeito do app quando e o navegador
     * recusando.
     */
    function acender() {
      if (!podeAcender()) return Promise.resolve(false);
      if (sentinela) return Promise.resolve(true);
      if (pedindo) return Promise.resolve(false);
      // Recusado uma vez, so se tenta de novo numa CHAMADA nova a `acender` — seja
      // reabrindo a mesa, seja voltando de uma ocultacao. E o que impede o
      // pedido de virar um laco contra um navegador que esta recusando.
      recusado = false;
      pedindo = true;
      aoMudar();

      let p;
      try {
        p = nav.wakeLock.request('screen');
      } catch (e) {
        // `request` e assincrono; um erro sincrono aqui e do navegador recusando.
        pedindo = false;
        recusado = true;
        aoMudar();
        return Promise.resolve(false);
      }
      if (!p || typeof p.then !== 'function') {
        pedindo = false;
        recusado = true;
        aoMudar();
        return Promise.resolve(false);
      }
      return p.then(function (s) {
        // O pedido pode ter chegado depois da mesa fechar, ou depois de outro
        // pedido ter ganhado. Guardar um handle que ninguem pediu e como
        // segurar a tela acesa numa tela fechada.
        if (!aberto || sentinela) {
          if (s && typeof s.release === 'function') {
            try { s.release(); } catch (e) { /* ja saiu */ }
          }
          pedindo = false;
          return false;
        }
        sentinela = s;
        pedindo = false;
        // O navegador solta o handle sozinho quando a aba some. Ouvir o
        // `release` mantem o estado verdadeiro em vez de mentir "acesa" para
        // uma tela que ja apagou.
        if (s && typeof s.addEventListener === 'function') {
          s.addEventListener('release', function () {
            if (sentinela === s) sentinela = null;
            aoMudar();
          });
        }
        aoMudar();
        return true;
      }, function () {
        // Recusado. A mesa continua funcionando; so nao ha protecao.
        pedindo = false;
        sentinela = null;
        recusado = true;
        aoMudar();
        return false;
      });
    }

    /**
     * Solta o handle. Idempotente.
     *
     * Nao mexe em `pedindo`: um pedido em voo tem o seu proprio desfecho, e
     * quando a promessa responde ela ve que `sentinela` ja e nulo e solta o
     * handle que chegou tarde. Zerar `pedindo` aqui abriria a porta para um
     * segundo pedido enquanto o primeiro ainda nao respondeu.
     */
    function apagar() {
      const s = sentinela;
      sentinela = null;
      if (s && typeof s.release === 'function') {
        try { s.release(); } catch (e) { /* ja saiu */ }
      }
    }

    /* ---------------------------------------------------------
       TELA CHEIA
       --------------------------------------------------------- */

    function elementoTelaCheia() {
      if (!doc) return null;
      return doc.fullscreenElement || doc.webkitFullscreenElement || null;
    }

    function emTelaCheia() {
      return !!elementoTelaCheia();
    }

    function podeTelaCheia() {
      if (!doc) return false;
      if (typeof doc.fullscreenEnabled === 'boolean') return doc.fullscreenEnabled;
      if (typeof doc.webkitFullscreenEnabled === 'boolean') return doc.webkitFullscreenEnabled;
      // Sem `enabled`, a existencia do metodo ainda diz se ha o que chamar.
      const alvo = (opcoes.alvo || (doc.documentElement));
      return !!(alvo && typeof (alvo.requestFullscreen || alvo.webkitRequestFullscreen) === 'function');
    }

    /**
     * Pede tela cheia. So dentro de um gesto — o navegador recusa sem ele.
     *
     * Nunca chamada sozinha: quem chama e o `onclick` de um botao. Pedir no
     * carregamento da mesa seria recusado sem erro nenhum, e o fracasso
     * silencioso e pior do que a ausencia do recurso.
     */
    function pedirTelaCheia() {
      const alvo = opcoes.alvo;
      if (!alvo) return Promise.resolve(false);
      if (!podeTelaCheia()) return Promise.resolve(false);
      const metodo = typeof alvo.requestFullscreen === 'function'
        ? alvo.requestFullscreen
        : alvo.webkitRequestFullscreen;
      if (typeof metodo !== 'function') return Promise.resolve(false);
      let p;
      try {
        // O prefixo `webkit` nao recebe argumento; o padrao aceita e ignora.
        p = metodo.call(alvo);
      } catch (e) {
        return Promise.resolve(false);
      }
      if (!p || typeof p.then !== 'function') return Promise.resolve(false);
      // Recusa nao e erro do app: o navegador pode negar. A mesa segue como
      // estava, e o `fullscreenchange` simplesmente nao vem.
      return p.then(function () { return true; }, function () { return false; });
    }

    function sairTelaCheia() {
      const sair = doc && (doc.exitFullscreen || doc.webkitExitFullscreen);
      if (typeof sair !== 'function') return Promise.resolve(false);
      if (!emTelaCheia()) return Promise.resolve(false);
      let p;
      try { p = sair.call(doc); } catch (e) { return Promise.resolve(false); }
      if (!p || typeof p.then !== 'function') return Promise.resolve(false);
      return p.then(function () { return true; }, function () { return false; });
    }

    function aoMudarTelaCheia() {
      // O navegador pode ter saido de tela cheia por Esc, por Tab ou por gesto
      // do sistema. Nao se forca a volta: quem saiu, saiu.
      aoMudar();
    }

    /* ---------------------------------------------------------
       INTERRUPCAO
       --------------------------------------------------------- */

    function aoVisibilidade() {
      if (!doc) return;
      if (doc.visibilityState === 'hidden') {
        interrompido = true;
        if (typeof opcoes.aoFicar === 'function') {
          try { opcoes.aoFicar(); } catch (e) { /* o relogio nao pode derrubar a mesa */ }
        }
        // O handle ja foi solto pelo navegador ao esconder a aba; soltar aqui
        // tambem evita deixar um handle morto apontando para uma tela apagada.
        apagar();
        aoMudar();
        return;
      }
      // Voltou.
      const houve = interrompido;
      interrompido = false;
      if (typeof opcoes.aoVoltar === 'function') {
        try { opcoes.aoVoltar(houve); } catch (e) { /* idem */ }
      }
      // Reexigir a tela acesa. O navegador revoga o handle a cada ocultacao,
      // entao sem isto a protecao valeria so ate a primeira interrupcao — e o
      // ensaio longo e justamente o caso que mais importa.
      if (aberto && !recusado) acender();
      aoMudar();
    }

    /* ---------------------------------------------------------
       CICLO DE VIDA
       --------------------------------------------------------- */

    function abrir() {
      if (aberto) return estado();
      aberto = true;
      interrompido = false;
      if (doc && typeof doc.addEventListener === 'function') {
        doc.addEventListener('visibilitychange', aoVisibilidade);
        doc.addEventListener('fullscreenchange', aoMudarTelaCheia);
        doc.addEventListener('webkitfullscreenchange', aoMudarTelaCheia);
      }
      if (podeAcender()) acender();
      aoMudar();
      return estado();
    }

    function destruir() {
      if (!aberto) return;
      aberto = false;
      apagar();
      if (doc && typeof doc.removeEventListener === 'function') {
        doc.removeEventListener('visibilitychange', aoVisibilidade);
        doc.removeEventListener('fullscreenchange', aoMudarTelaCheia);
        doc.removeEventListener('webkitfullscreenchange', aoMudarTelaCheia);
      }
      interrompido = false;
      aoMudar();
    }

    return {
      abrir: abrir,
      destruir: destruir,
      acender: acender,
      apagar: apagar,
      pedirTelaCheia: pedirTelaCheia,
      sairTelaCheia: sairTelaCheia,
      alternarTelaCheia: function () {
        return emTelaCheia() ? sairTelaCheia() : pedirTelaCheia();
      },
      estado: estado,
      emTelaCheia: emTelaCheia,
      podeAcender: podeAcender,
      podeTelaCheia: podeTelaCheia,
      interrompido: function () { return interrompido; },
    };
  }

  global.Viva = { criar: criar };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.Viva;
})(typeof window !== 'undefined' ? window : globalThis);