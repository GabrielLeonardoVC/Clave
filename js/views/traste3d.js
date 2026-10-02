/* =========================================================
   ACORDE - views/traste3d.js
   A tela do traste em 3D, com a 2D de reserva.

   A REGRA QUE ESTA TELA EXISTE PARA CUMPRIR

   O 3D e um extra. Quem nao tem rede, quem tem aparelho velho, quem pediu
   economia de dados ou simplesmente nao quer girar nada ve o traste 2D que ja
   existia — que e a versao certa para quem esta olhando de cima.

   Isso significa que esta tela TEM de saber responder "o 3D deu?" antes de
   mostrar qualquer coisa. E e por isso que ela comeca sempre com o 2D no
   lugar: o 2D aparece primeiro, e o 3D substitui quando e possivel. O
   inverso — mostrar um "carregando" e torcer — deixaria quem esta sem rede
   olhando para um espaco vazio a cada visita.

   A tela tambem respeita o aparelho: em modo de movimento reduzido, o violao
   aparece ja enquadrado e sem girar. Uma cena que se move sozinha e um
   problema para quem sente enjoo com movimento — e o app nao pode aggravate um
   sintoma que a pessoa ja tem.
   ========================================================= */
(function (global) {
  'use strict';

  const V = global.Views || (global.Views = {});
  const U = global.Utils;
  const M = global.Music;
  const R = global.Render;
  const UI = global.UI;
  const { el } = U;

  /**
   * O traste — em 3D quando der, em 2D quando nao der.
   *
   * `opts`:
   *     pcs, rootPc, flat, frets, showAll, inst  — os mesmos do `scaleFretboard`
   *     acordes   [{ pc, quality }]  para os aneis do desenho
   *     aoTocar   (pc, duracao)      o que fazer com a nota tocada
   *     compacto  true               para caber em menos espaco
   */
  function mostrar(opts) {
    opts = opts || {};
    const wrap = el('div', { class: 'traste3d' });

    /* O 2D entra primeiro, sempre. Se o 3D vier, ele substitui; se nao vier,
       ninguem percebe que o 3D foi tentado. */
    const plano = el('div', { class: 'traste3d-plano' });
    plano.appendChild(R.scaleFretboard(opts.pcs || [], {
      rootPc: opts.rootPc,
      flat: opts.flat,
      frets: opts.frets || 12,
      showAll: opts.showAll,
      inst: opts.inst,
    }));
    wrap.appendChild(plano);

    const aviso = el('div', { class: 'traste3d-aviso' });
    const caixa = el('div', { class: 'traste3d-caixa' });
    wrap.appendChild(caixa);
    wrap.appendChild(aviso);

    let cena3d = null;
    let laco = null;
    let destruido = false;

    /* ---------------------------------------------------------------
       A SAÍDA, VIGIADA

       Um contexto WebGL e caro e o navegador entrega um numero pequeno deles.
       Quando o app remonta a tela — trocar de acorde, trocar de aba, sair da
       rota — o no antigo e descartado sem aviso. Se o renderer nao for
       destruido junto, ele continua "vivo" para sempre: medido, o contador
       chegava a tres Contextos e nao voltava, e o 3D passava a depender de o
       `Gfx` reciclar o mais antigo por conta propria. O sintoma e o pior
       possivel: o 3D funciona, some, funciona de novo, e a pessoa nao sabe
       por que.

       Duas saidas, e as duas importam:

         - ESTA, que e a geral. Um observador nota quando o no sai do
           documento e destroi tudo. Nao depende de ninguem lembrar: a proxima
           tela que montar um traste herda o cuidado de graca.

         - A destruicao explicita de quem remonta a tela, que e mais rapida e
           nao espera o navegador avisar.
       --------------------------------------------------------------- */
    let observador = null;
    let observadorDePagina = null;
    let veioConectado = false;
    let veioAtiva = false;

    /** O no ainda esta na pagina? */
    function naPagina(no) {
      if (!no) return false;
      if (typeof no.isConnected === 'boolean') return no.isConnected;
      // Sem `isConnected`: sobe ate a raiz procurando um pai com `nodeType`.
      let p = no;
      while (p) {
        if (p.nodeType === 9) return true;     // documento
        p = p.parentNode;
      }
      return false;
    }

    function paginaAtiva() {
      // Fora de uma pagina nao ha a que obedecer, e o app tem telas que nao
      // usam o embrulho `.page`.
      const p = wrap.closest && wrap.closest('.page');
      if (!p) return true;
      return p.classList.contains('active');
    }

    /** Prende a segunda vigia na pagina que contem o traste.

     * So pode ser depois que o no foi anexado. `mostrar()` devolve o `wrap`, e
     * quem chama e que o coloca na tela: no instante em que a vigia comeca, o no
     * ainda nao tem pai, `closest('.page')` devolve `null`, e a vigia da pagina
     * nunca chegaria a existir. Era o que acontecia — o traste do primeiro
     * carregamento nunca era destruido ao sair da rota, e sobrava um contexto
     * WebGL pedido para sempre. */
    function prenderNaPagina() {
      if (observadorDePagina) return;
      const pagina = wrap.closest ? wrap.closest('.page') : null;
      if (!pagina) return;
      try {
        observadorDePagina = new MutationObserver(function () {
          if (destruido) return;
          marcarEstado();
          if (veioAtiva && !paginaAtiva()) destruir();
        });
        observadorDePagina.observe(pagina, { attributes: true, attributeFilter: ['class'] });
      } catch (e) {
        observadorDePagina = null;
      }
    }

    /** Anota em que estado a tela ja esteve. */
    function marcarEstado() {
      if (naPagina(wrap)) veioConectado = true;
      if (paginaAtiva()) veioAtiva = true;
      if (veioConectado) prenderNaPagina();
    }

    function vigiarSaida() {
      if (typeof MutationObserver !== 'function') return;
      if (!global.document || !global.document.documentElement) return;

      try {
        /* A PRIMEIRA VIGIA: o no saiu do documento?

           Acontece quando a tela e remontada e o antigo e descartado sem aviso.
           E a que cobre quem descarta o no sem saber que ele era caro. */
        observador = new MutationObserver(function () {
          if (destruido) return;
          marcarEstado();
          if (!naPagina(wrap) && veioConectado) destruir();
        });
        observador.observe(global.document.documentElement, { childList: true, subtree: true });
        marcarEstado();
      } catch (e) {
        // Sem observador, a saida continua dependendo de quem desmonta. Nao e
        // motivo para nao mostrar o 3D.
        observador = null;
        observadorDePagina = null;
      }
    }

    /* ------------------------------------------------------------------
       A CARGA

       Ela nao trava a tela. O 2D ja esta na tela enquanto o megabyte do
       three.js baixa, e so quando ele chega e cria o renderer que o 3D entra.
       ------------------------------------------------------------------ */
    if (global.Gfx && typeof global.Gfx.carregar === 'function') {
      Promise.resolve(global.Gfx.carregar()).then(function (three) {
        if (destruido) return;
        if (!three) {
          // Sem three.js: o aviso explica o motivo. Quem nao le o aviso ve
          // o traste 2D funcionando, e basta.
          const e = global.Gfx.estado();
          aviso.textContent = motivoCurto(e);
          aviso.classList.add('visivel');
          return;
        }
        try {
          montar3d(three);
        } catch (err) {
          /* Este `catch` e a ultima rede, e ela precisa deixar rastro. Um
             aviso que so diz "não consegui" e o mesmo aviso para quatro
             causas diferentes — e foi assim que este defeito passou: o
             developer via a tela quebrada e nenhuma pista do motivo. */
          if (global.console && console.error) console.error('[traste3d] montagem falhou:', err);

          /* E precisa devolver o 2D.
           *
           * A montagem esconde o plano (o 2D) assim que o 3D entra, na linha
           * `plano.style.display = 'none'`. Se ALGO DEPOIS disso falha — a cena,
           * os ouvintes de toque, a camera — o `catch` avisava e nada mais.
           *
           * O resultado era uma tela que mostrava "Não consegui abrir o 3D. O
           * traste acima funciona igual." e NAO TINHA NADA ACIMA: o 2D estava
           * escondido e o canvas nunca desenhou. O aviso dizia a verdade ao
           * contrario, que e a pior forma de mentir.
           *
           * O `aoErrar` do laco ja sabia disso e devolvia o plano. Aqui faltava
           * a mesma metade. */
          try {
            if (laco) { laco.destruir(); laco = null; }
            if (cena3d) { cena3d.dispose(); cena3d = null; }
          } catch (e2) { /* ja destruido */ }
          if (caixa) { try { caixa.remove(); } catch (e3) { /* ja saiu */ } }
          wrap.classList.remove('tem-3d');
          plano.style.display = '';
          aviso.textContent = 'Não consegui abrir o 3D. O traste acima funciona igual.';
          aviso.classList.add('visivel');
        }
      });
    } else {
      aviso.textContent = motivoCurto({});
      aviso.classList.add('visivel');
    }

    function motivoCurto(e) {
      if (e && e.economia) return 'O 3D foi desligado para economizar dados. O traste acima mostra a mesma coisa.';
      if (e && !e.temWebGL) return 'Este aparelho não tem 3D. O traste acima mostra a mesma coisa.';
      if (e && e.motivo === 'offline') return 'Sem internet, o 3D não carregou. O traste acima mostra a mesma coisa.';
      return 'O 3D está carregando…';
    }

    /* ------------------------------------------------------------------
       A MONTAGEM
       ------------------------------------------------------------------ */
    function montar3d(three) {
      const canvas = el('canvas', { class: 'traste3d-canvas', 'aria-hidden': 'true' });
      caixa.appendChild(canvas);

      const renderer = global.Gfx.criarRenderer(canvas, { antialias: true });
      if (!renderer) {
        aviso.textContent = 'Este aparelho não conseguiu abrir o 3D. O traste acima mostra a mesma coisa.';
        aviso.classList.add('visivel');
        caixa.remove();
        return;
      }

      const optsViolao = {
        pcs: opts.pcs || [],
        rootPc: opts.rootPc,
        flat: opts.flat,
        frets: opts.frets || 12,
        inst: opts.inst,
        acordes: opts.acordes || [],
        ouvir: function (pc, dur) {
          if (typeof opts.aoTocar === 'function') opts.aoTocar(pc, dur);
          else if (global.Nota) {
            const hz = frequenciaDe(pc);
            if (hz) global.Nota.tocarNota(hz, dur || 1.6);
          }
        },
      };

      /* `Violao3D`, com o D maiusculo — o mesmo nome que o modulo publica. A
       diferenca de uma letra nao dava erro de sintaxe nem aviso nenhum: o
       `catch` pegava um `undefined` e a tela caia no 2D com "não consegui abrir
       o 3D". Um nome global escrito duas vezes com maiuscula diferente e o
       defeito mais barato e mais caro de achar ao mesmo tempo. */
    const Fabrica = global.Violao3D;
    if (!Fabrica || typeof Fabrica.criar !== 'function') {
      global.Gfx.destruir(renderer);
      aviso.textContent = 'O 3D não está disponível nesta tela. O traste acima mostra a mesma coisa.';
      aviso.classList.add('visivel');
      caixa.remove();
      return;
    }

    const v3 = Fabrica.criar(optsViolao);
      if (!v3) {
        global.Gfx.destruir(renderer);
        aviso.textContent = 'Não consegui montar o violão 3D. O traste acima mostra a mesma coisa.';
        aviso.classList.add('visivel');
        caixa.remove();
        return;
      }
      /* O resto da montagem nao pode falhar em silencio. Qualquer erro aqui
         deixaria o canvas vazio e o traste 2D escondido — a tela ficaria com
         um espaco em branco e nenhum aviso, que e o pior resultado possivel. */
      try {

      /* O 2D sai de cena agora que o 3D entrou. Nao fica escondido atras: sair
         de vez e o que garante que so uma versao das duas esteja viva — e um
         traste 2D escondido continuaria ocupando espaco e exigindo desenho. */
      plano.style.display = 'none';
      wrap.classList.add('tem-3d');

      const mover = global.Cena && global.Cena.movimentoDesejado();
      if (!mover) {
        /* Sem movimento: ja entra enquadrado, e no angulo de quem segura, que
         * e o util. O `true` e o que resolve isso em um passo so — sem ele a
         * travessia aconteceria quadro a quadro, que e justamente o movimento
         * que a pessoa pediu para nao ter. */
        v3.girarPara('segurando', true);
      }

      laco = global.Cena.criar(renderer, v3.cena, v3.camera, {
        /* `ajustarAngulo` roda SEMPRE, mesmo sem movimento pedido. Ele nao gira
         * nada por si so: aplica a inercia que o arasto deixou e a trava que o
         * botao escolheu, e para quando nao ha mais nenhum dos dois.
         *
         * O `if (mover)` que estava aqui era um erro com dois defeitos ao mesmo
         * tempo. Sem movimento, o arraste deixava uma velocidade que NINGUEM
         * decayava — e a cena, que devolve `true` enquanto ha velocidade, ficava
         * pedindo quadro para sempre. O resultado era o oposto do que o
         * movimento reduzido deve fazer: 30 quadros por segundo, o aparelho
         * inteiro, com a tela parada e ninguem tocando. */
        aoRedimensionar: function () { v3.ajustarAngulo(); },
        animacaoContinua: false,
        desenhar: function () {
          v3.ajustarAngulo();
          // A propria cena devolve `true` quando ainda ha pulso a desenhar, ou
          // quando a camera ainda esta em transicao. E assim que o brilho da
          // nota que esta soando nao depende de um timer que fica rodando
          // depois da nota acabar, e a travessia para um angulo chega ao fim.
          if (v3.desenhar() && laco) laco.acordar();
        },
        aoErrar: function () {
          // Um erro no desenho parou o laco. O 3D e um extra: o certo e voltar
          // ao traste 2D, que ja estava montado e so precisa reaparecer.
          //
          // `voltarAo2D` e a MESMA funcao que trata a perda de contexto. Duas
          // metades de "voltar ao 2D" divergem no primeiro ajuste, e a divergencia
          // aparece como "as vezes volta, as vezes nao" — que e impossivel de
          // depurar e impossivel de explicar para quem usa.
          voltarAo2D('O 3D parou aqui. O traste acima mostra a mesma coisa.');
        },
      });

      v3.ligarDesenho(function () { if (laco) laco.acordar(); });

      /* ---- a PERDA DO CONTEXTO ----
       *
       * O contexto WebGL morre sem aviso em aparelho de verdade. O driver da GPU
       * reinicia, a tela entra em economia, o celular esquenta, o navegador
       * descarta o contexto para recuperar memoria. O app nao fez nada de
       * errado e mesmo assim o canvas fica preto para o resto da tela.
       *
       * Num ensaio isso e o pior defeito possivel: a pessoa mexe no traste para
       * achar o tom, o violao simplesmente desaparece, e nao ha aviso nem
       * retorno. A unica saida honesta e devolver o 2D, que ja esta desenhado e
       * diz a mesma coisa.
       *
       * Nao ha o que remontar: quando o contexto morre, os objetos que ele
       * segurava morrem junto. Voltar ao 3D exigiria reconstruir a cena inteira,
       * e essa e uma decisao de produto, nao uma correcao de emergencia. O
       * certo agora e a pessoa poder ver o traste.
       */
      if (canvas.addEventListener) {
        canvas.addEventListener('webglcontextlost', function (ev) {
          /* Sem `preventDefault`, o navegador nao tenta recuperar — e o padrao
           * e deixar morrer. Aqui a gente assume a morte e avisa. */
          if (ev && ev.preventDefault) ev.preventDefault();
          voltarAo2D('O 3D foi desligado pelo aparelho. O traste acima mostra a mesma coisa.');
        }, false);
      }

      /** Desliga o 3D e devolve o traste 2D, com a frase que explica o motivo. */
      function voltarAo2D(frase) {
        if (destruido) return;
        try {
          if (laco) { laco.parar(); laco.destruir(); laco = null; }
          if (cena3d) { cena3d.dispose(); cena3d = null; }
        } catch (e) { /* ja destruido */ }
        /* O renderer e solto aqui, e nao so pelo `laco`.
         *
         * `laco.destruir()` tambem solta o renderer — mas so quando o laco
         * chegou a existir. Se a falha foi ANTES disso (a cena nao subiu, os
         * ouvintes de toque quebraram), o renderer ja foi criado, ja esta
         * contando no teto do `Gfx`, e nao tem laco para levar junto. Sem esta
         * linha, o contexto ficava pedido com a tela ja mostrando o 2D.
         *
         * `Gfx.destruir` e idempotente: chamar duas vezes nao faz mal. */
        try { global.Gfx.destruir(renderer); } catch (e) { /* ja destruido */ }
        try { caixa.remove(); } catch (e) { /* ja saiu */ }
        wrap.classList.remove('tem-3d');
        plano.style.display = '';
        aviso.textContent = frase;
        aviso.classList.add('visivel');
      }

      /* ---- o toque ----
         Arrastar gira; tocar numa corda toca. O dois no mesmo dedo: um arrasto
         com movimento vertical pequeno e parada de poucos pixels e um toque, e
         nao o contrario. Sem esse limite, quem quisesse girar acabava tocando
         nota a cada dedo. */
      let arrasto = null;
      let andou = 0;

      function pontoDe(ev) {
        return ev.touches && ev.touches[0] ? ev.touches[0] : ev;
      }

      function comecar(ev) {
        const p = pontoDe(ev);
        arrasto = { x: p.clientX, y: p.clientY };
        andou = 0;
        canvas.style.touchAction = 'none';
      }

      function moverPonto(ev) {
        if (!arrasto) return;
        const p = pontoDe(ev);
        const dx = p.clientX - arrasto.x;
        const dy = p.clientY - arrasto.y;
        andou += Math.abs(dx) + Math.abs(dy);
        v3.aoArrastar(dx, dy);
        arrasto.x = p.clientX;
        arrasto.y = p.clientY;
        if (laco) laco.acordar();
      }

      function soltarPonto(ev) {
        if (!arrasto) return;
        arrasto = null;
        // Um toque que nao andou e uma nota pedida. O limite e pequeno de
        // proposito: quem quer girar move o dedo, e quem quer tocar bate nele
        // sem mover — como se faz no instrumento.
        if (andou < 9 && ev.changedTouches) {
          const alvo = v3.alvoEm(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY, canvas);
          if (alvo) v3.tocar(alvo.pc, 1.6);
        } else if (andou < 9) {
          const alvo = v3.alvoEm(ev.clientX, ev.clientY, canvas);
          if (alvo) v3.tocar(alvo.pc, 1.6);
        }
      }

      canvas.addEventListener('touchstart', comecar, { passive: true });
      canvas.addEventListener('touchmove', moverPonto, { passive: true });
      canvas.addEventListener('touchend', soltarPonto, { passive: true });
      canvas.addEventListener('mousedown', comecar);
      canvas.addEventListener('mousemove', function (ev) { if (arrasto) moverPonto(ev); });
      canvas.addEventListener('mouseup', soltarPonto);
      canvas.addEventListener('mouseleave', function () { arrasto = null; v3.soltar(); });

      /* ---- os botoes de vista ----
         Girar com o dedo e bom, mas quem esta com as duas maos ocupadas usa
         isto. Tres botoes, tres angulos em que alguem realmente olha. */
      /* Qual botao esta ligado.
       *
       * Sem isto os tres botoes eram iguais para quem usa leitor de tela: nao
       * havia `aria-pressed` em nenhum, e a unica pista de onde a camera
       * estava era o desenho. A vista inicial e a de `segurando` (a chamada
       * `girarPara('segurando')` acima), e e ela que precisa comecar marcada —
       * tres `aria-pressed` falsos e pior que nenhum, porque announce que
       * nada esta escolhido quando um esta.
       *
       * `vistaAtual` e declarado ANTES de `vistas`, e nao depois. Os botoes sao
       * construidos dentro do literal que cria `vistas`, e cada um deles le
       * `vistaAtual` enquanto se constroi: declarado depois, o `let` estaria
       * ainda na zona morta e a tela do 3D cairia num `ReferenceError` — um
       * erro que so apareceria com o three carregado, nunca nos testes. */
      let vistaAtual = 'segurando';
      const botoesDeVista = [];
      /* Só `setAttribute`, e nada de `classList`.
       *
       * A marcação da vista é o atributo `aria-pressed`, e o CSS tira o
       * destaque DELE (`.traste3d-vistas [aria-pressed="true"]`). Uma classe
       * seria uma segunda cópia do mesmo estado, com o risco de as duas
       * divergirem — e dependeria de `classList.toggle`, que os DOMs de teste
       * deste projeto não têm todos: com ele, a tela do 3D caía no "não
       * consegui abrir" num navegador de verdade que funciona. */
      function marcarVistas() {
        botoesDeVista.forEach(function (par) {
          par.botao.setAttribute('aria-pressed', String(par.nome === vistaAtual));
        });
      }

      const vistas = el('div', { class: 'traste3d-vistas' }, [
        botao('De cima', 'de cima'),
        botao('Segurando', 'segurando'),
        botao('De lado', 'de lado'),
      ]);

      function botao(rotulo, nome) {
        /* A referência ao botao fica guardada, e `marcarVistas` percorre a
         * lista. A primeira versao procurava os botoes com
         * `vistas.querySelectorAll`, o que e uma consulta ao DOM para chegar em
         * botoes que ESTA funcao acabou de criar e que ela ja tem na mao. */
        const b = el('button', { class: 'btn btn-secondary btn-sm', type: 'button',
          'aria-pressed': String(nome === vistaAtual),
          onclick: function () {
            // `!mover` vai direto: quem pediu para nao ter movimento nao deve
            // ver o violao atravessando o caminho todo, nem que sejam 30
            // quadros de uma vez.
            vistaAtual = nome;
            marcarVistas();
            v3.girarPara(nome, !mover);
            if (laco) laco.acordar();
          } }, rotulo);
        botoesDeVista.push({ botao: b, nome: nome });
        return b;
      }
      marcarVistas();
      caixa.appendChild(vistas);

      /* ---- a dica ---- */
      const dica = el('div', { class: 'traste3d-dica' },
        mover ? 'Arraste para girar · toque numa nota para ouvir'
              : 'Toque numa nota para ouvir');
      caixa.appendChild(dica);

      UI.icons(wrap);
      cena3d = v3;
      } catch (erro) {
        /* Um erro depois do violao montado deixa a tela pela metade: o 2D ja
           estava escondido e o 3D ainda nao desenha. O unico resultado aceitavel
           e voltar ao estado anterior — o traste 2D — e dizer o que houve. */
        try {
          if (laco) { laco.destruir(); laco = null; }
          if (cena3d) { cena3d.dispose(); cena3d = null; }
        } catch (e) { /* ja destruido */ }
        wrap.classList.remove('tem-3d');
        plano.style.display = '';
        if (caixa.parentNode) caixa.remove();
        aviso.textContent = 'O 3D não abriu aqui. O traste acima mostra a mesma coisa.';
        aviso.classList.add('visivel');
        if (global.console && console.error) console.error('[traste3d]', erro);
      }
    }

    /* ------------------------------------------------------------------
       A LIMPEZA

       Fechar a folha tem que soltar o laco, o renderer e as geometrias. Sem
       isto, abrir e fechar a tela vinte vezes deixa vinte contextos WebGL
       pedidos ao navegador — e o app deixa de abrir 3D sem explicacao.
       ------------------------------------------------------------------ */
    function destruir() {
      // Idempotente: quem chama e o observador E quem remonta a tela, e os dois
      // podem acertar o mesmo instante. Sem esta guarda, o segundo chamada
      // entraria em `cena3d` ja nulo — e `dispose()` duas vezes no three deixa
      // geometrias com conteudo invalido, que so aparece como tela preta.
      if (destruido) return;
      destruido = true;

      if (observador) {
        try { observador.disconnect(); } catch (e) { /* ja desconectado */ }
        observador = null;
      }
      if (observadorDePagina) {
        try { observadorDePagina.disconnect(); } catch (e) { /* ja desconectado */ }
        observadorDePagina = null;
      }
      if (laco) {
        laco.destruir();
        laco = null;
      }
      if (cena3d) {
        cena3d.dispose();
        cena3d = null;
      }
    }

    vigiarSaida();
    wrap.destruir3d = destruir;
    return wrap;
  }

  /**
   * A frequencia de uma nota, para o `Nota` tocar.
   *
   * Delega ao `Tuner`, e nao calcula aqui. A conta anterior era
   * `440 * 2^((pc + 9) / 12)` e estava com o sinal trocado: dava 740 Hz para o
   * dó onde o `Tuner` da 261,6 Hz. O resultado era o 3D tocar a nota errada —
   * e o defeito nao aparecia em lugar nenhum, porque nenhuma das telas com
   * audio mostra o nome da nota que esta soando. Um traste 3D afinado com a
   * nota errada e pior que um traste 2D sem som: parece funcionar.
   *
   * Uma conta so, e a do `Tuner`, que e o mesmo que o afinador e o teclado
   * usam. E por isso que a oitava e a 4: onde o A4 mora.
   */
  function frequenciaDe(pc) {
    if (global.Tuner && typeof global.Tuner.notaParaHz === 'function') {
      return global.Tuner.notaParaHz(M.mod12(pc), 4);
    }
    return null;
  }

  V.traste3d = { mostrar: mostrar, frequenciaDe: frequenciaDe };
  global.Traste3D = V.traste3d;

  if (typeof module !== 'undefined' && module.exports) module.exports = V.traste3d;
})(typeof window !== 'undefined' ? window : globalThis);