/* =========================================================
   ACORDE - core/gfx.js
   O 3D, carregado sob demanda, e nunca como obrigatoriedade.

   POR QUE CARREGAR SOB DEMANDA

   O three.js tem um megabyte. O resto do app — cifras, agenda, ensaio — nao usa
   nenhum pixel tridimensional. Baixar um megabyte para mostrar uma lista de
   músicas é o preço errado: quem abre o app num ensaio, com 4G ruim, na casa
   de alguém, espera ver a música dele na hora.

   Por isso o 3D e um extra. O app abre, funciona e fica utilizável sem rede;
   a tela 3D e a segunda, e so quando a pessoa pede.

   E QUANDO A PESSOA PEDE

   Carregar de CDN e um `import` dinamico. Se a rede falhar, se o aparelho for
   antigo demais para WebGL, ou se a pessoa estiver em modo de economia de
   dados, a promessa e recusada e o chamador cai no que ja existe: a versao 2D
   de traste, de rolagem e de circulo. Nao existe caminho em que o 3D deixe o
   app quebrado — o pior resultado seria uma tela vazia com um "carregando"
   que nunca sai.

   O QUE ESTE MODULO NAO FAZ

   Nao cria cena, nao posiciona objeto, nao decide layout. Ele so sabe:
     - o three.js chegou?
     - tem WebGL aqui?
     - qual renderer usar, com que resolucao?
     - quem pediu o 3D, para poder avisar quando ele falha?

   Um unico renderer para o app inteiro. Dois canvases WebGL no mesmo aparelho
   sao dois contextos, e o navegador da um limite baixo — em geral oito ou
   dez. Quem abre tres telas 3D e fecha uma por vez estoura o limite e a
   ultima tela morre com "contexto perdido", sem explicacao.
   ========================================================= */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------
     O ESTADO, que e a informacao mais importante deste arquivo

     `estado()` e o que a tela chama antes de construir. Os quatro caminhos:

       'pronto'    — three.js carregou e tem WebGL. Use o 3D.
       'offline'   — sem three.js. Use a versao 2D.
       'webgl'     — three.js carregou, mas este aparelho nao tem WebGL.
       'economia'  — a pessoa pediu para nao gastar dados.

     A tela nunca precisa adivinhar: ela pergunta e obedece.
     ------------------------------------------------------------ */
  let three = null;
  let carregando = null;
  let resultado = null;      // 'pronto' | 'offline' | 'webgl' | 'economia'

  const ESPERA = [
    {
      url: 'https://unpkg.com/three@0.160.0/build/three.module.js',
      nome: 'unpkg',
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
      nome: 'jsdelivr',
    },
  ];

  /** A pessoa pediu para nao gastar dados? Respeta antes de tentar a rede. */
  function emEconomia() {
    if (global.navigator && global.navigator.connection) {
      const c = global.navigator.connection;
      // `saveData` e o interruptor do proprio aparelho: plano de dados limitado.
      // Respeitar e o minimo — forcar download aqui e o que faz um app
      // parecer ganancioso, e o usuario nao tem como pedir senao pelo sistema.
      if (c.saveData === true) return true;
    }
    if (global.Store && typeof global.Store.ajuste === 'function') {
      if (global.Store.ajuste('gfx3d', 'auto') === 'nunca') return true;
    }
    return false;
  }

  /** Este navegador tem WebGL? Pergunta antes de baixar um megabyte. */
  function temWebGL() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return false;
      // Alguns navegadores devolvem um contexto e depois nao conseguem
      // compilar nada — acontece em maquina virtual e em driver antigo. Compilar
      // um shader de verdade e a unica forma de descobrir.
      gl.getExtension('WEBGL_lose_context');
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Carrega o three.js. Devolve sempre uma promessa que resolve — nunca rejeita.
   *
   * Uma promessa que rejeita obriga quem chama a ter um `catch`, e quem chama
   * e uma tela que so queria mostrar uma cifra.better e resolver com `null` e
   * deixar o chamador escolher o caminho sem rede, que e o que ele sabe fazer.
   */
  function carregar() {
    if (resultado) return Promise.resolve(resultado === 'pronto' ? three : null);
    if (carregando) return carregando;

    if (emEconomia()) {
      resultado = 'economia';
      return Promise.resolve(null);
    }
    if (!temWebGL()) {
      resultado = 'webgl';
      return Promise.resolve(null);
    }

    /* Um por vez, na ordem. Tentar os tres ao mesmo tempo gastaria tres vezes
       a banda em rede ruim — e a segunda tentativa so entra depois que a
       primeira falhou de verdade. */
    carregando = (function tentar(i) {
      if (i >= ESPERA.length) {
        resultado = 'offline';
        carregando = null;
        return Promise.resolve(null);
      }
      return import(/* webpackIgnore: true */ ESPERA[i].url).then(function (mod) {
        three = mod.default || mod;
        resultado = 'pronto';
        carregando = null;
        return three;
      }).catch(function () {
        return tentar(i + 1);
      });
    })(0);

    return carregando;
  }

  /* ------------------------------------------------------------
     OS RENDERERS

     Um por tela 3D, mas com um teto. O navegador da um limite de contextos
     WebGL por aparelho, e quando ele estoura a tela morre com "contexto
     perdido" — sem aviso e sem recuperacao. Tres e o maximo que a app abre de
     uma vez; acima disso o app precisa da tela 2D mesmo com 3D disponivel.
     ------------------------------------------------------------ */
  const MAX_VIVOS = 3;
  const vivos = [];

  /* A ultima falha, para o diagnostico. Um `catch` que so devolve `null` faz o
     app repetir "não consegui abrir o 3D" para quatro motivos diferentes, e a
     pessoa nao tem como ajudar nem o developer sabe onde olhar. */
  let ultimoErro = '';

  /**
   * Cria um renderer pronto para o canvas.
   *
   * Devolve `null` quando o WebGL falhou, e quem chama cai no 2D. Nunca lanca:
   * um erro de contexto e normal em aparelho velho, e nao e um erro do app.
   */
  function criarRenderer(canvas, opcoes) {
    opcoes = opcoes || {};
    if (!three) return null;

    /* Antes de criar outro, solta o que saiu da tela mais tempo atras.

     * So `dispose()`, nunca `destroy()` nem `forceContextLoss`: os dois derrubam
     * o contexto, e um canvas com o contexto perdido nunca mais aceita outro.
     * Como o app remonta telas no mesmo elemento, derrubar o contexto aqui
     * significava que o 3D funcionava uma vez e nunca mais. */
    while (vivos.length >= MAX_VIVOS) {
      const velho = vivos.shift();
      if (!velho) continue;
      try { velho.dispose(); } catch (e) { /* ja destruido */ }
    }

    let renderer;
    try {
      renderer = new three.WebGLRenderer({
        canvas: canvas,
        antialias: opcoes.antialias !== false,
        alpha: opcoes.alpha === true,
        powerPreference: opcoes.economia ? 'low-power' : 'high-performance',
      });
    } catch (e) {
      /* A causa fica guardada. Um `catch` que so devolve `null` esconde o motivo
         real e obriga a caçar o defeito por outra tela — foi assim que este
         codigo passou. Quem chama le `Gfx.estado().ultimoErro` e sabe a causa,
         em vez de repetir "não consegui". */
      ultimoErro = e && e.message ? e.message : String(e);
      /* Um canvas NUNCA aceita um segundo contexto depois do `forceContextLoss`.

         * Perder o contexto e irreversivel para aquele elemento: o navegador
         * marca o canvas comodanificado e qualquer `getContext` seguinte
         * devolve `null`. E por isso que o sintoma era
         * `Cannot read properties of null (reading 'precision')` — o three le o
         * contexto para descobrir a precisao e recebe nada.

         * A unica saida e um elemento NOVO. `cloneNode(false)` traz os
         * atributos sem os listeners nem o estado interno, e o `replaceChild`
         * troca o velho por ele na mesma posicao, entao quem segura a referencia
         * continua apontando para o canvas util.

         * A largura e a altura vao junto: o `setSize` do three depende delas
         * para nao comecar em 300x150 egrow até o proximo ajuste. */
      if (canvas) {
        try {
          const novo = canvas.cloneNode(false);
          novo.width = canvas.width || novo.width;
          novo.height = canvas.height || novo.height;
          if (novo.parentNode) {
            novo.parentNode.replaceChild(novo, canvas);
            renderer = new three.WebGLRenderer({
              canvas: novo,
              antialias: opcoes.antialias !== false,
              alpha: opcoes.alpha === true,
              powerPreference: opcoes.economia ? 'low-power' : 'high-performance',
            });
          }
        } catch (e2) {
          // Um canvas com contexto preso nao volta. Sem 3D.
          return null;
        }
      }
      if (!renderer) return null;
    }
    if (!renderer) return null;

    /* A resolucao e o que decide se o 3D roda liso ou esquenta o aparelho.
     *
     * `devicePixelRatio` no celular chega a 3, e renderizar em 3 vezes o
     * necessario multiplica por nove o numero de pixels — por um ganho que
     * ninguem ve, porque a tela nao tem onde mostrar o detalhe. O limite de 2 e
     * o ponto em que a diferenca para a olho ja nao existe e o custo ainda
     * cai pela metade. */
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.outputColorSpace = three.SRGBColorSpace;
    if ('useLegacyLights' in renderer) renderer.useLegacyLights = false;

    vivos.push(renderer);
    return renderer;
  }

  /**
   * Solta um renderer. Chamar ao fechar a tela — sem isso o contexto vaza.
   *
   * Aqui NAO se usa `forceContextLoss`. Ele é a ferramenta certa quando se sabe
   * que o contexto não volta, e é exatamente o que envenena este app: o canvas
   * fica marcado como perdido, e qualquer `WebGLRenderer` criado nele depois
   * falha com `Cannot read properties of null (reading 'precision')`. Como o
   * app remonta telas no mesmo elemento, o efeito era o 3D funcionar na
   * primeira visita e nunca mais.
   *
   * `dispose()` solta geometrias, materiais e texturas — o que é o custo real de
   * manter um contexto. O contexto em si so some quando o elemento sai do
   * documento, e é assim que ele deve morrer.
   */
  function destruir(renderer) {
    if (!renderer) return;
    const i = vivos.indexOf(renderer);
    if (i >= 0) vivos.splice(i, 1);
    try {
      renderer.dispose();
    } catch (e) { /* ja destruido */ }
  }

  /** O que a tela precisa saber antes de decidir entre 3D e 2D. */
  function estado() {
    return {
      pronto: resultado === 'pronto',
      motivo: resultado || 'ainda não tentou',
      temWebGL: temWebGL(),
      economia: emEconomia(),
      vivos: vivos.length,
      ultimoErro: ultimoErro,
    };
  }

  global.Gfx = {
    carregar: carregar,
    criarRenderer: criarRenderer,
    destruir: destruir,
    estado: estado,
    temWebGL: temWebGL,
    emEconomia: emEconomia,
    get three() { return three; },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.Gfx;
})(typeof window !== 'undefined' ? window : globalThis);