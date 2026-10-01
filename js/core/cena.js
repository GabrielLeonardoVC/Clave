/* =========================================================
   ACORDE - core/cena.js
   O laco de desenho: um so lugar que decide quando renderizar.

   O QUE UM LOOP DE 3D ERRADO FAZ

   Renderizar a 60 quadros por segundo sem parar e o caminho mais curto para
   o celular ficar quente e a bateria acabar. Tres situacoes normais pioram:

     - a tela esta em segundo plano, e o app continua desenhando o que ninguem
       ve;
     - a cena esta parada, sem nada mudando, e mesmo assim o loop nao para;
     - a tela 3D foi fechada, e o `requestAnimationFrame` continua rodando
       apontando para um canvas que saiu do documento.

   Os tres somam: em tres minutos de ensaio, o aparelho que estava em 80% esta
   em 30%, sem nenhuma acao do usuario que explique.

   AS REGRAS DESTE LOOP

     - nada e desenhado quando a aba esta oculta;
     - quando nada muda, o loop para e volta a acordar sozinho na proxima
       mudanca;
     - fechar a tela cancela o quadro pendente;
     - `prefers-reduced-motion` e respeitado: sem rotacao continua, sem
       transicao de cor.

   A consequencia e o app poder ficar aberto a noite numa tela de ensaio sem
   gastar bateria, e a tela fechar sem deixar nada rodando.
   ========================================================= */
(function (global) {
  'use strict';

  /**
   * Cria um laco de desenho.
   *
   * Devolve um objeto com:
   *   - `acordar()`  — redesenha (chame apos mudar a cena);
   *   - `acordarA cada` nao existe: quem precisa de animacao continua pede.
   *   - `parar()`    — cancela o quadro pendente;
   *   - `destruir()` — para e solta o renderer.
   */
  function criarCena(renderer, cena, camera, opcoes) {
    opcoes = opcoes || {};
    const desenhar = typeof opcoes.desenhar === 'function' ? opcoes.desenhar : null;
    const aoRedimensionar = typeof opcoes.aoRedimensionar === 'function' ? opcoes.aoRedimensionar : null;
    const canvas = renderer && renderer.domElement ? renderer.domElement : null;

    let quadro = 0;
    let vivo = true;
    let precisaRedesenhar = true;
    let ultimoDesenho = 0;

    /* O intervalo minimo entre dois desenhos, em milissegundos.
     *
     * 30 por segundo e o ponto em que movimento continuo ainda parece
     * continuo e o custo cai pela metade. Uma camera girando a 30 quadros por
     * segundo nao parece robotica; a 15 parece. */
    const MINIMO_MS = opcoes.intervaloMs || 33;

    function cabecalho() {
      const agora = performance.now();
      if (agora - ultimoDesenho < MINIMO_MS) return false;
      return true;
    }

    function passo() {
      quadro = 0;
      if (!vivo) return;
      if (document.visibilityState === 'hidden') return;
      if (!cabecalho()) { quadro = requestAnimationFrame(passo); return; }
      ultimoDesenho = performance.now();
      try {
        if (desenhar) desenhar();
        renderer.render(cena, camera);
      } catch (e) {
        /* Um erro no desenho nao pode derrubar o laco para sempre: ele ficaria
           tentando a cada quadro, queimando bateria, com o erro invisivel.
           Parar e deixar a tela 2D aparecer e melhor. */
        vivo = false;
        if (opcoes.aoErrar) opcoes.aoErrar(e);
        return;
      }
      // O pedido foi atendido. Sem esta linha o `precisaRedesenhar` ficava
      // ligado para sempre — ele nasce verdadeiro e so o `parar()` desligava —
      // e a condicao abaixo nunca era falsa. O resultado era o oposto do que
      // este arquivo promete: 2 mil chamadas de desenho por segundo numa tela
      // parada, com o aparelho esquentando e a bateria descendo sem ninguem
      // tocar em nada.
      precisaRedesenhar = false;
      // So a animacao continua mantem o loop de pe. Quem precisa de mais um
      // quadro chama `acordar()` de dentro do `desenhar` (e o violao faz isso
      // enquanto uma nota esta pulsando).
      if (opcoes.animacaoContinua) {
        quadro = requestAnimationFrame(passo);
      }
    }

    /** Acorda o loop para um desenho. */
    function acordar() {
      precisaRedesenhar = true;
      if (!vivo || quadro) return;
      if (document.visibilityState === 'hidden') return;
      quadro = requestAnimationFrame(passo);
    }

    /** Animacao continua: desenha sempre que o loop esta acordado. */
    function animar() {
      opcoes.animacaoContinua = true;
      acordar();
    }

    /** Para de animar, sem destruir. O proximo `acordar()` redesenha. */
    function parar() {
      opcoes.animacaoContinua = false;
      precisaRedesenhar = false;
      if (quadro) cancelAnimationFrame(quadro);
      quadro = 0;
    }

    function destruir() {
      vivo = false;
      if (quadro) cancelAnimationFrame(quadro);
      quadro = 0;
      if (global.Gfx) global.Gfx.destruir(renderer);
    }

    /** O canvas combinou com o tamanho disponivel? */
    function ajustar() {
      if (!canvas || !canvas.parentElement) return;
      const pai = canvas.parentElement;
      const l = pai.clientWidth;
      const a = pai.clientHeight;
      if (!l || !a) return;
      // O tamanho e o que define quantos pixels o aparelho tem que pintar.
      // Renderizar um canvas de 4000 px numa caixa de 300 e trabalho jogado
      // fora — e o que faz o 3D "engasgar" em aparelho fraco sem motivo
      // aparente.
      renderer.setSize(l, a, false);
      camera.aspect = l / a;
      camera.updateProjectionMatrix();
      precisaRedesenhar = true;
      if (aoRedimensionar) aoRedimensionar(l, a);
    }

    ajustar();

    /* Voltar para a aba redesenha na hora. Sem isto, quem deixa o celular no
       bolso e volta encontra a tela 3D congelada na posicao antiga, e parece
       que o app travou. */
    function aoVoltar() {
      if (document.visibilityState !== 'visible') return;
      ajustar();
      /* E o `acordar()` que importa, e ele estava faltando.
       *
       * Enquanto a aba esta oculta, `passo()` volta sem reagendar — e o certo,
       * e o que economiza bateria. So que isso mata o laco de vez: nao ha
       * quadro na fila, e `ajustar()` so levanta a bandeira `precisaRedesenhar`,
       * sem pedir quadro nenhum. Quem deixava o celular no bolso voltava para
       * uma tela 3D congelada na posicao antiga, com o laco morto e nada no
       * codigo indicando erro — o comentario logo acima prometia exatamente o
       * contrario do que acontecia.
       *
       * Quem volta a tela precisa de um desenho. E um so: depois deste, o laco
       * volta a parar sozinho, como deve. */
      acordar();
    }
    document.addEventListener('visibilitychange', aoVoltar);
    global.addEventListener('resize', ajustar);
    global.addEventListener('orientationchange', ajustar);

    acordar();

    return {
      acordar: acordar,
      animar: animar,
      parar: parar,
      ajustar: ajustar,
      destruir: function () {
        document.removeEventListener('visibilitychange', aoVoltar);
        global.removeEventListener('resize', ajustar);
        global.removeEventListener('orientationchange', ajustar);
        destruir();
      },
      get vivo() { return vivo; },
    };
  }

  /**
   * O que a pessoa pediu sobre movimento.
   *
   * Tres estados, e o do meio e o mais importante:
   *   - 'sistema': respeita o aparelho;
   *   - 'reduzido': sem rotacao e sem transicao;
   *   - 'cheio':   tudo, mesmo respeitando o aparelho quando ele pede menos.
   */
  function movimentoDesejado() {
    const sistemaReduz = global.matchMedia
      && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sistemaReduz) return false;
    if (global.Store && typeof global.Store.ajuste === 'function') {
      return global.Store.ajuste('motion', 'on') !== 'off';
    }
    return true;
  }

  global.Cena = {
    criar: criarCena,
    movimentoDesejado: movimentoDesejado,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.Cena;
})(typeof window !== 'undefined' ? window : globalThis);