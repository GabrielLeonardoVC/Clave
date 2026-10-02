/* =========================================================
   ACORDE - js/core/timbre.js
   Como cada instrumento soa.

   POR QUE ESTE ARQUIVO EXISTE

   O `audio.js` toca UMA nota com UM oscilador. Isso foi escolha, e a escolha
   esta certa para o que ele faz: para afinar, o ouvido precisa de um tom puro
   e longo, e um arranjo com quinta e oitava faz a corda parecer mais afinada do
   que esta. Um violao soa bonito e atrapalha o afinador. Nao se mexe no
   `audio.js` para isso.

   O que faltava era o outro lado: quando o app toca uma escala, um acorde ou um
   arranjo, a pessoa ouve um sinal de gerador. Um triangulo nao e um violao em
   lugar nenhum, e quem toca sabe disso antes de olhar a tela.

   QUATRO COISAS QUE FAZEM UM ACOSTICO PARECER ACUSTICO

   1. O ESPECTRO. Nao existe "a frequencia do violao": existem a fundamental e
      os harmonicos, cada um com seu volume. Um violao tem o segundo e o
      terceiro bem presentes e o sexto quase sumido. Um baixo quase nao tem
      harmonico acima do terceiro. Um ukulele e mais claro e tem mais parcial.

   2. OS PARCIAIS AGUANTAM TEMPOS DIFERENTES. E o detalhe que mais denuncia um
      instrumento sintetico. Uma corda pinçada perde o brilho antes de perder o
      tom: o sexto harmonico some no primeiro segundo, e a fundamental ainda
      esta la depois de dez. Num sintetizador com envelope igual para tudo, o
      som fica parado no tempo — e o ouvido le isso como "eletronico" antes de
      qualquer nome.

   3. O CORPO. Uma corda solta nao e o instrumento: o que sai e a corda mais a
      caixa de ressonancia. O violao tem um pico por volta de 100 Hz e outro
      perto de 200; o ukulele e menor e tem o pico mais alto. Sem isso, dois
      instrumentos com o mesmo espectro soam identicos.

   4. O FRETE MUDA O TIMBRE. Corda mais curta e mais rigida: o parcial mais
      alto ganha e a corda morre mais depressa. E por isso que a mesma nota no
      traste 12 e no traste 2 nao soa igual, e e por isso que uma escala soada
      na posicao aberta soa diferente da mesma escala na primeira posicao.

   O QUE ESTE ARQUIVO NAO FAZ

   Nao carrega amostra nenhuma. Nao ha arquivo de audio no app inteiro, e isso
   e deliberado: amostra pesa, e um app que promete funcionar sem servidor nao
   pode depender de baixar megabytes na primeira vez. Aqui tudo e matematica —
   e o peso e zero, em qualquer aparelho, offline.
   ========================================================= */
(function (global) {
  'use strict';

  /* --------------------------------------------------------------
     OS MODELOS

     `parciais` e a amplitude de cada harmonico, do fundamental para cima. A
     serie de um instrumento real cai com o numero do harmonico, e o quao rapido
     e o que diferencia um do outro.

     `ressonancias` e o corpo: pares de frequencia e ganho, aplicados ao
     espectro. Um violao tem o pico grave por volta de 100 Hz (a caixa, por
     baixo da boca) e o segundo perto de 200 Hz (o tampo). Um ukulele e menor
     e por isso o pico sobe.

     `atacante` e quanto som de raspagem entra no comeco — o ruido do dedao
     tocando a corda. E breve e e o que separa "pinçou" de "surgiu do nada".

     `tauBase` e quanto tempo a fundamental leva para cair a um terco. Os
     harmonicos caem mais depressa, com o fator guardado em `cai`.
     -------------------------------------------------------------- */
  const MODELOS = {
    violao: {
      braco: 'violao',
      nome: 'Violão',
      // Queda suave: a caixa de ressonancia segura os medios, e o sexto
      // harmonico ainda da para ouvir numa nota baixa.
      parciais: [1, 0.62, 0.44, 0.28, 0.18, 0.115, 0.07, 0.045, 0.03, 0.02],
      // O primeiro cai devagar, o segundo e o terceiro bem menos: e a corda
      // ficando escura com o tempo, que e o que o ouvido reconhece.
      cai: [1, 0.52, 0.40, 0.30, 0.24, 0.19, 0.15, 0.12, 0.10, 0.08],
      ressonancias: [[96, 2.1], [196, 1.55], [430, 1.15]],
      tauBase: 3.4,
      ataque: 0.0045,
      atacante: 0.055,
      oitavasAte: 10,
      brilhoTraste: 0.9,
    },

    violaoClassico: {
      nome: 'Violão de nylon',
      /* O mesmo braco do violao, com corda de nylon. Sao duas escolhas que
       * parecem separadas — o instrumento e o som — e nao sao: quem tem um
       * violao de nylon tem o mesmo braco de quem tem um de aco. Por isso o
       * timbre e a escolha unica, e ele e que diz qual braco usar. */
      braco: 'violao',
      // Corda de nylon: fundamental mais presente, medios mais cheios, agudo
      // mais macio que o acustico de corda de aço. O(popular) e essa
      // diferenca que da a sensacao de "violao de boa qualidade".
      parciais: [1, 0.58, 0.40, 0.27, 0.19, 0.13, 0.085, 0.055, 0.035, 0.022],
      cai: [1, 0.55, 0.43, 0.33, 0.26, 0.21, 0.17, 0.14, 0.11, 0.09],
      ressonancias: [[104, 1.85], [210, 1.45], [460, 1.2]],
      tauBase: 3.0,
      ataque: 0.0035,
      atacante: 0.04,
      oitavasAte: 9,
      brilhoTraste: 0.4,
    },

    baixo: {
      braco: 'baixo',
      nome: 'Baixo',
      // Corda grossa e longa: quase nada acima do terceiro harmonico. E o que
      // faz o baixo ser o baixo — o quinto e o sexto praticamente nao existem,
      // e por isso ele some debaixo de um arranjo.
      parciais: [1, 0.42, 0.18, 0.09, 0.05, 0.028, 0.015, 0.008],
      cai: [1, 0.60, 0.42, 0.30, 0.22, 0.16, 0.12, 0.09],
      ressonancias: [[62, 2.4], [180, 1.3]],
      tauBase: 2.8,
      ataque: 0.006,
      atacante: 0.05,
      oitavasAte: 7,
      brilhoTraste: 0.7,
    },

    baixo5: {
      braco: 'baixo5',
      nome: 'Baixo 5 cordas',
      /* A corda a mais nao e so "mais uma": ela alonga a escala whole. Um
       * baixo de 5 cordas tem uma corda de 31 Hz, e corda grave precisa
       * vibrar mais tempo para aparecer. Por isso o decaimento e maior que no
       * baixo de 4, e o parcial grave pesa um pouco mais. */
      parciais: [1, 0.44, 0.19, 0.095, 0.052, 0.030, 0.017, 0.009],
      cai: [1, 0.62, 0.44, 0.32, 0.23, 0.17, 0.13, 0.09],
      ressonancias: [[58, 2.3], [165, 1.25]],
      tauBase: 3.1,
      ataque: 0.0065,
      atacante: 0.05,
      oitavasAte: 7,
      brilhoTraste: 0.75,
    },

    ukulele: {
      braco: 'ukulele',
      nome: 'Ukulele',
      // Corda fina e caixa pequena: pico de corpo alto e decaimento rapido. E
      // o instrumento mais "estourado" da lista, e de proposito.
      parciais: [1, 0.55, 0.46, 0.34, 0.24, 0.16, 0.11, 0.07, 0.045, 0.03],
      cai: [1, 0.48, 0.34, 0.24, 0.17, 0.12, 0.09, 0.07, 0.05, 0.04],
      ressonancias: [[168, 2.2], [330, 1.6], [640, 1.2]],
      tauBase: 1.5,
      ataque: 0.003,
      atacante: 0.07,
      oitavasAte: 10,
      brilhoTraste: 0.5,
    },

    violino: {
      braco: 'violino',
      nome: 'Violino',
      // Corda da mais aguda e arco, nao pinca. Por isso o ataque e longo e o
      // espectro e riquissimo: e o arco que alimenta os harmonicos, e nao a
      // corda. Um violino com ataque de 4 ms soa como um ukulele afinado.
      parciais: [1, 0.78, 0.60, 0.48, 0.40, 0.32, 0.26, 0.21, 0.17, 0.13, 0.10, 0.08],
      cai: [1, 0.72, 0.62, 0.54, 0.47, 0.41, 0.36, 0.31, 0.27, 0.23, 0.20, 0.17],
      ressonancias: [[275, 2.0], [460, 1.7], [1400, 1.25]],
      tauBase: 2.2,
      ataque: 0.085,
      atacante: 0.12,
      oitavasAte: 12,
      brilhoTraste: 0.3,
    },

    cavaquinho: {
      braco: 'cavaquinho',
      nome: 'Cavaquinho',
      // Mesma afinacao do ukulele, timbre proprio: a caixa de rosewood e o
      // braco de nylon dao um medio a mais e um agudo menos "estourado".
      parciais: [1, 0.60, 0.42, 0.30, 0.21, 0.14, 0.095, 0.065, 0.045, 0.03],
      cai: [1, 0.53, 0.39, 0.30, 0.23, 0.18, 0.14, 0.11, 0.09, 0.07],
      ressonancias: [[140, 2.0], [300, 1.6], [700, 1.15]],
      tauBase: 2.0,
      ataque: 0.0035,
      atacante: 0.06,
      oitavasAte: 10,
      brilhoTraste: 0.45,
    },

    piano: {
      nome: 'Teclado',
      /* Sem braco, e isso e uma RESPOSTA e nao uma falta.
       *
       * Um teclado nao tem cordas nem trastes. Desenhar um braco de violao para
       * quem escolheu "Teclado" seria inventar um instrumento que a pessoa nao
       * tem — e ela so descobriria isso depois de olhar a tela.
       *
       * As telas que precisam de braco leem este campo e dizem que nao ha, em
       * vez de mostrar a coisa errada em silencio.
       *
       * Um comentario mal fechado aqui engoliu o `nome` deste timbre uma vez, e
       * o arquivo passou na verificacao de sintaxe a semana toda: `nome` ficava
       * DENTRO do comentario, entao o modelo existia, os parciais existiam, e o
       * timbre aparecia sem nome na lista. Foi o `test-escolha` que achou, com
       * uma verificacao de tres linhas. Sintaxe valida nao e codigo correto. */
      braco: null,
      // Nao e corda: e um martelo batendo numa placa sobre uma base de madeira.
      // Por isso o decaimento e EXTREMAMENTE rapido e o ataque e curtissimo com
      // muito parcial — o "brilho" do teclado estourado e a marca dele.
      parciais: [1, 0.78, 0.52, 0.40, 0.31, 0.24, 0.19, 0.15, 0.12, 0.095, 0.075, 0.06],
      cai: [1, 0.78, 0.62, 0.50, 0.40, 0.33, 0.27, 0.22, 0.18, 0.15, 0.12, 0.10],
      ressonancias: [[220, 1.5], [1200, 1.3]],
      tauBase: 1.7,
      ataque: 0.0022,
      atacante: 0.09,
      oitavasAte: 12,
      brilhoTraste: 0.25,
    },

    sintetizador: {
      braco: null,
      nome: 'Sintetizador',
      /* Existe para tocar e nao aparece na lista: ninguem tem um sintetizador
       * na coxa. Sem este campo o modelo funciona, passa em todos os testes,
       * e ninguem nunca chega nele — o tipo de codigo morto que passa limpo. */
      noPique: true,
      // Aqui os parciais duram IGUAIS, e nao e uma falha do modelo: e o que
      // define o instrumento. Um pad e feito para nao mudar de cor.
      parciais: [1, 0.5, 0.33, 0.25, 0.2, 0.166, 0.14, 0.125, 0.11, 0.1],
      cai: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      ressonancias: [],
      tauBase: 2.4,
      ataque: 0.02,
      atacante: 0,
      oitavasAte: 10,
      brilhoTraste: 0,
    },
  };

  /** O modelo de um instrumento, com queda para o violao. */
  function modeloDe(id) {
    if (!id) return MODELOS.violao;
    const m = MODELOS[String(id)];
    return m || MODELOS.violao;
  }

  /** Todos os timbres, inclusive os que nao aparecem na lista. */
  function ids() {
    return Object.keys(MODELOS);
  }

  /**
   * Os timbres que a pessoa pode escolher em Ajustes.
   *
   * A lista e separada da lista de todos de proposito: sao coisas diferentes.
   * Um timbre que ninguem pode escolher e codigo que passa em todos os
   * testes, funciona perfeitamente e nunca e exercitado — e o que da a
   * sensacao de que a tela esta certa enquanto um botao nao faz nada.
   */
  function noPique() {
    return Object.keys(MODELOS).filter(function (id) { return !MODELOS[id].noPique; });
  }

  /** O nome que aparece na lista, para o id que vier. */
  function nomeDe(id) {
    const m = modeloDe(id);
    return m.nome;
  }

  /**
   * Qual braco este timbre usa, ou `null` quando nao tem braco.
   *
   * O timbre e a escolha unica da pessoa — nao ha "instrumento" e "som" em
   * Settings. Mas violao de nylon e o mesmo braco do violao de aco, e
   * teclado nao tem braco nenhum. Por isso o timbre e que carrega essa
   * resposta, e as telas leem aqui em vez de adivinhar. */
  function bracoDe(id) {
    const m = MODELOS[String(id)];
    return m ? (m.braco || null) : null;
  }

  /**
   * O espectro de uma nota: lista de parciais com frequencia, amplitude e
   * tempo de decaimento.
   *
   * E esta funcao que contem a fisica, e ela e pura: entra frequencia e
   * traste, saem numeros. Por isso ela pode ser testada sem navegador e sem
   * AudioContext — que e a unica forma de provar que o timbre esta certo.
   *
   * Devolve `[{n, hz, amp, tau}]`, ja ordenado e ja com o que nao cabe na
   * faixa inutil removido.
   */
  function espectro(hz, idInstrumento, opts) {
    opts = opts || {};
    const M = modeloDe(idInstrumento);
    const f = Number(hz);
    if (!isFinite(f) || f <= 0) return [];

    /* O TRASTE. Corda mais curta e mais rigida: o parcial mais alto ganha, e a
     * corda morre mais depressa. A fisica e a mesma do timbre: uma corda curta
     * tem menos massa por unidade de comprimento, entao os modos de ordem
     * alta custam menos energia.
     *
     * O efeito so aparece nos parciais mais altos: mudar o brilho do segundo
     * harmonico mudaria a quinta, e a quinta nao muda de timbre quando voce
     * encurta a corda. Por isso o expoente cresce com o numero do parcial. */
    const traste = U_clamp(Number(opts.traste) || 0, 0, 24);
    const brilho = (M.brilhoTraste || 0) * (traste / 24);

    /* Onde cada ressonancia do corpo age. Uma ressonancia e um pico largo em
     * torno de uma frequencia; quanto mais perto o parcial esta do pico, mais
     * ele volta. A largura e de uma oitava, que e a largura tipica de uma
     * caixa. */
    const ganhoDoCorpo = function (freq) {
      let g = 1;
      for (const r of M.ressonancias) {
        const f0 = r[0];
        const g0 = r[1];
        // A uma oitava do centro, o ganho extra ja e metade. E o que faz o
        // corpo dar cor sem domar a corda.
        const dist = Math.abs(Math.log2(freq / f0));
        g += (g0 - 1) * Math.pow(0.5, dist * 3);
      }
      return g;
    };

    const saida = [];
    const teto = Number(opts.tetoHz) || 4800;
    for (let i = 0; i < M.parciais.length; i++) {
      const n = i + 1;
      const fh = f * n;
      if (fh > teto) break;              // acima disso nao se ouve no celular
      if (fh > 18000) break;             // acima disso nao existe no Nyquist

      const brilhoParcial = Math.pow(1 + brilho * 0.55, Math.min(n - 1, 6));
      let amp = M.parciais[i] * brilhoParcial * ganhoDoCorpo(fh);
      if (!(amp > 0)) continue;

      // O tempo decai mais com o numero do parcial, e com o traste tambem:
      // corda curta morre antes.
      const tau = M.tauBase * M.cai[i] * (1 - brilho * 0.45);
      saida.push({ n: n, hz: fh, amp: amp, tau: Math.max(0.05, tau) });
    }

    // Normaliza para que o volume pedido seja o volume total. Sem isso, um
    // instrumento com mais parciais tocaria mais alto — e o baixo tem poucos,
    // entao ele sumiria no arranjo sem ninguem mexer no volume.
    let soma = 0;
    for (const p of saida) soma += p.amp;
    if (soma > 0) {
      for (const p of saida) p.amp /= soma;
    }
    return saida;
  }

  /* Um clamp proprio, para este arquivo nao depender de nada. */
  function U_clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /**
   * Quantos parciais cabem, dado quantas vozes ja estao tocando.
   *
   * Isto existe por causa do iPhone. Um acorde de seis notas com dez parciais
   * cada um sao sessenta osciladores ao mesmo tempo — e num celular isso nao e
   * "um acorde", e o app comecando a engasgar no meio do ensaio.
   *
   * A regra e simples e honesta: quanto mais vozes, menos parciais. O timbre
   * degrada; o app nao trava. Perder um pouco de brilho e infinitamente melhor
   * que perder o tempo.
   */
  const parciaisPorVoz = function (vozesAtivas) {
    if (!(vozesAtivas > 0)) return 10;
    if (vozesAtivas <= 1) return 10;
    if (vozesAtivas <= 3) return 6;
    if (vozesAtivas <= 6) return 4;
    if (vozesAtivas <= 10) return 3;
    return 2;
  };

  /* --------------------------------------------------------------
     O SINTETIZADOR

     Aqui a matematica vira som. Um oscilador por parcial, cada um com o seu
     envelope de decaimento — e o que faz o timbre ficar vivo em vez de parado.

     Decaimento exponencial em vez de reta: corda real nao cai em linha reta.
     O que se ouve e a primeira, rapido no comeco e lenta depois, do nada — e isso e
     exponencial. Uma rampa linear soa como um instrumento eletronico de
    nome.

     E o `setTargetAtTime` com constante de tempo, e nao
     `exponentialRampToValueAtTime`: o primeiro descreve uma curva que se
     aproxima de zero sem nunca chegar, que e exatamente o que uma corda faz.
     O segundo precisa de um valor final, e fazer a corda chegar a zero e
     mentira — corda que zera, para de soar.
     -------------------------------------------------------------- */

  /** Toca uma nota com o timbre de um instrumento. */
  function tocarNo(c, hz, duracao, volume, opts) {
    opts = opts || {};
    const M = modeloDe(opts.instrumento);
    const inicial = c.currentTime + (Number(opts.atraso) || 0);
    const seg = Math.max(0.08, Math.min(20, Number(duracao) || 1.2));

    const todos = espectro(hz, opts.instrumento, { traste: opts.traste });
    if (!todos.length) return null;

    /* Quantos parciais cada voz pode ter, dado quantas ja estao tocando. */
    const quantos = Math.min(todos.length, parciaisPorVoz(opts.vozesAtivas || 1));

    const saida = c.createGain();
    saida.gain.value = 1;
    // Uma saida geral por nota, e nao por parcial: e o que permite cortar a
    // nota inteira de uma vez, sem ficaroscando oscilador por oscilador.
    saida.connect(opts.destino || c.destination);

    const ataque = Math.min(M.ataque, seg * 0.35);
    const oscs = [];

    for (let i = 0; i < quantos; i++) {
      const p = todos[i];
      if (!(p.amp > 0.0005)) continue;

      const osc = c.createOscillator();
      osc.type = 'sine';          // o partial JA e a onda; um saw aqui seria outro timbre
      osc.frequency.setValueAtTime(p.hz, inicial);

      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, inicial);
      g.gain.exponentialRampToValueAtTime(p.amp * volume, inicial + ataque);

      /* O decaimento de cada parcial. `tau` e a constante de tempo: depois de
       * `tau` segundos o parcial caiu para 1/e do que era. Como o `cai` do
       * modelo diminui com o numero do harmonico, os parciais altos somem
       * primeiro — e o brilho escurece enquanto o tom fica. */
      const tau = Math.max(0.04, Math.min(p.tau, seg * 1.6));
      g.gain.setTargetAtTime(0.0001, inicial + ataque, tau);

      osc.connect(g);
      g.connect(saida);
      const fim = inicial + seg;
      osc.start(inicial);
      osc.stop(fim + 0.05);
      oscs.push({ osc: osc, ganho: g });
    }

    /* O RASPAGEM DO ATAQUE. O ruido do dedao ou da palheta tocando a corda e
     * breve e e o que separa "pinçou" de "surgiu do nada". Sem ele, ate um
     * sintetizador bom soa como um filtro girando. */
    if (M.atacante > 0 && opts.atacante !== false) {
      try {
        const dur = Math.min(M.atacante, ataque * 8, seg * 0.4);
        const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
        const dados = buf.getChannelData(0);
        for (let k = 0; k < dados.length; k++) {
          // Ruido com queda: comeca forte e some, como um toque de palheta.
          dados[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / dados.length, 3);
        }
        const ruido = c.createBufferSource();
        ruido.buffer = buf;
        const filtro = c.createBiquadFilter();
        filtro.type = 'bandpass';
        // A raspagem mora onde a corda esta: perto da fundamental, nao no agudo.
        filtro.frequency.setValueAtTime(Math.min(4200, Math.max(220, hz * 2.4)), inicial);
        filtro.Q.value = 0.9;
        const gr = c.createGain();
        gr.gain.value = M.atacante * volume * 0.5;
        ruido.connect(filtro);
        filtro.connect(gr);
        gr.connect(saida);
        ruido.start(inicial);
        ruido.stop(inicial + dur + 0.02);
      } catch (e) { /* aparelho sem createBuffer: a nota toca sem raspagem */ }
    }

    return {
      saida: saida,
      osciladores: oscs,
      inicio: inicial,
      fim: inicial + seg,
    };
  }

  const Timbre = {
    MODELOS: MODELOS,
    modeloDe: modeloDe,
    ids: ids,
    noPique: noPique,
    nomeDe: nomeDe,
    bracoDe: bracoDe,
    espectro: espectro,
    parciaisPorVoz: parciaisPorVoz,
    tocarNo: tocarNo,
  };

  global.Timbre = Timbre;
  if (typeof module !== 'undefined' && module.exports) module.exports = Timbre;
})(typeof window !== 'undefined' ? window : globalThis);
