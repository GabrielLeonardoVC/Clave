/* =========================================================
   ACORDE - core/audio.js
   Tocar uma nota. Um unico som, o suficiente para afinar.

   Este modulo existe porque dois botoes do app prometiam tocar um som e nao
   faziam nada: chamavam `global.Audio.tocarNota`, e nao havia este modulo
   nenhum. A interface aparecia, o botao respondia, e o silencio era a resposta.

   O que ele NAO e: um sintetizador. Uma nota so, com envelope, para ninguem
   clicar e levar um estalo no ouvido. Um piano de cola em 60 Hz seria bonito e
   nao ajudaria ninguem a saber se a corda esta afinada.

   Por que isso importa no app: quem esta com o violo na coxa precisa ouvir o
   tom CERTO e o tom que a corda esta dando, lado a lado. Uma nota pura e longa
   faz isso. Um arranjo com quinta e oitava faz a corda parecer mais afinada do
   que esta, porque a quinta mascara o desvio.
   --------------------------------------------------------- */
(function (global) {
  'use strict';

  const U = global.Utils;
  const T = global.Timbre;
  /* --------------------------------------------------------------
     VOZES TOCANDO

     Um acorde de seis notas com dez parciais cada sao sessenta osciladores ao
     mesmo tempo. Num celular isso nao e "um acorde", e o app comecando a
     engasgar no meio do ensaio.

     O `timbre.js` reduz os parciais quando ha muitas vozes, mas ele so sabe
     quantas ha se alguem contar. E este e o alguem. Sem esta contagem o
     `timbre.js` receberia sempre 1 e tocaria o arranjo inteiro como se fosse
     uma nota so — que e o jeito mais bonito de o aparelho travar. */
  let vozes = 0;

  /**
   * O instrumento que a pessoa escolheu em Ajustes, ou `null`.
   *
   * O `Store` e lido aqui, e nao carregado no topo, por dois motivos: o
   * `audio.js` pode ser carregado antes do `store.js`, e a escolha muda em
   * tempo de uso. Se a tela de ajustes mudar o instrumento no meio de um
   * ensaio, a proxima nota ja sai no instrumento novo.
   *
   * E se o Store nao existir — o `audio.js` funcionando sozinho, num teste —
   * isto devolve `null`, e o app cai no tom puro, que nunca quebra.
   */
  function instrumentoDaPessoa() {
    const St = global.Store;
    if (!St || typeof St.ajuste !== 'function') return null;
    const id = St.ajuste('instrumento', '');
    return typeof id === 'string' && id ? id : null;
  }

  /** Quantas notas ainda estao soando. */
  function vozesSoando() {
    return vozes;
  }

  /** Soma uma voz e solta quando a nota acaba de verdade. */
  function contarVoz(nota) {
    vozes++;
    const solta = function () { if (vozes > 0) vozes--; };
    const lista = nota && nota.osciladores;
    // O ultimo oscilador criado e o ultimo a parar, entao e nele que o
    // `onended` conta. Se a nota nao tem nenhum, ela nunca chegou a soar.
    const ultimo = lista && lista.length ? lista[lista.length - 1].osc : null;
    if (ultimo) ultimo.onended = solta;
    else solta();
    return nota;
  }

  /**
   * O contexto so nasce depois do primeiro toque.
   *
   * Nao e descuido: os navegadores criam um AudioContext em `suspended` e o
   * recusam a tocar ate haver um gesto do usuario. Construir no carregamento da
   * pagina deixaria o app mudo ate a primeira interacao — e a pessoa acharia
   * que o botao quebrou.
   */
  let ctx = null;

  function contexto() {
    if (ctx) {
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* o navegador negou */ } }
      return ctx;
    }
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    return ctx;
  }

  /**
   * Uma nota.
   *
   * O envelope tem ataque curtinho e liberacao longa. Sem o ataque, o comeco e
   * um degrau e o fim e um corte — os dois estalao. Uma corda de violao tem
   * justamente esse ataque de poucos milissegundos, e reproduzi-lo e o que faz
   * o ouvido acreditar no timbre.
   *
   * `atraso` existe para o acorde: cada nota comeca um pouco depois da outra,
   * e nao todas no mesmo instante.
   */
  function tocarNota(hz, duracao, opts) {
    opts = opts || {};
    const c = contexto();
    if (!c) return null;

    const f = Number(hz);
    if (!isFinite(f) || f < 20 || f > 15000) return null;

    const seg = U.clamp(Number(duracao) || 1.2, 0.08, 20);
    const volume = opts.volume == null ? 0.22 : U.clamp(Number(opts.volume), 0, 1);
    if (volume <= 0) return null;

    /* QUANDO PEDE INSTRUMENTO, O CAMINHO E OUTRO. O `timbre.js` monta um
     * oscilador por harmonico, cada um com o seu decaimento, e o resultado soa
     * como o instrumento em vez de como um sinal de gerador.
     *
     * Sem `instrumento`, continua o caminho de baixo: UM oscilador, tom puro.
     * Isso nao e resto de codigo antigo, e uma decisao. Para afinar, o ouvido
     * precisa de um tom limpo e longo; um violao com harmonicos no meio faz a
     * corda parecer mais afinada do que esta. Por isso o afinador nunca pede
     * instrumento — o resto do app so pede quando a nota e para ornamentar o
     * que ja esta na tela. */
    /* O INSTRUMENTO DA PESSOA, a nao ser que ela peça o tom puro.
     *
     * Quem tem violao quer ouvir violao. Nao faz sentido obrigar cada tela a
     * lembrar de passar o instrumento: basta uma delas esquecer e o som volta
     * a ser um triangulo, sem ninguem notar.
     *
     * E `puro: true` existe porque duas telas PRECISAM do tom puro: o
     * afinador e a emergencia. La o tom e a referencia, e um violao com
     * harmonicos no meio faz a corda parecer mais afinada do que esta. */
    const escolhido = opts.puro === true ? null
      : (opts.instrumento || instrumentoDaPessoa());

    if (escolhido && T && typeof T.tocarNo === 'function') {
      const montada = T.tocarNo(c, f, seg, volume, {
        instrumento: escolhido,
        traste: opts.traste,
        atraso: opts.atraso,
        vozesAtivas: vozesSoando(),
      });
      if (montada) {
        montada.hz = f;
        montada.volume = volume;
        montada.instrumento = escolhido;
        contarVoz(montada);
      }
      return montada;
    }

    const timbre = opts.timbre === 'quadrada' ? 'square'
      : opts.timbre === 'seno' ? 'sine'
        : opts.timbre === 'serrilhado' ? 'sawtooth' : 'triangle';

    const atraso = Math.max(0, Number(opts.atraso) || 0);
    const inicio = c.currentTime + atraso;
    const ataque = Math.min(0.012, seg * 0.12);
    const corpo = seg * 0.5;
    const fim = inicio + seg;

    const osc = c.createOscillator();
    osc.type = timbre;
    osc.frequency.setValueAtTime(f, inicio);

    const ganho = c.createGain();
    // exponentialRampToValueAtTime nao aceita zero, e um ganho exatamente zero
    // deixa o no preso. Por isso o piso e 0.0001.
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(volume, inicio + ataque);
    ganho.gain.exponentialRampToValueAtTime(volume * 0.5, inicio + ataque + corpo);
    ganho.gain.exponentialRampToValueAtTime(0.0001, fim);

    osc.connect(ganho);
    ganho.connect(c.destination);
    osc.start(inicio);
    osc.stop(fim + 0.02);

    // Nao deixa o no pendurado. Dez osciladores parados e o primeiro sinal
    // de que o celular esta aquecendo.
    osc.onended = function () {
      try { osc.disconnect(); ganho.disconnect(); } catch (e) { /* ja saiu */ }
    };

    return { osc: osc, ganho: ganho, hz: f, inicio: inicio, fim: fim, timbre: timbre, volume: volume };
  }

  /**
   * Varias notas em conjunto.
   *
   * `espalhar` e o intervalo entre uma e outra, em segundos. Tocar todas no
   * mesmo instante produz um acorde "batido", duro e sem brilho. Separadas por
   * alguns milissegundos, soa como dedilhagem — que e como o proprio musico
   * faria com o mesmo acorde.
   *
   * Devolve as notas criadas, na ordem pedida, para quem quiser mexer nelas.
   */
  function tocarAcorde(hzs, opts) {
    opts = opts || {};
    const lista = (Array.isArray(hzs) ? hzs : [hzs])
      .map(Number)
      .filter(function (f) { return isFinite(f) && f >= 20 && f <= 15000; });
    if (!lista.length) return [];

    const espalhar = Math.max(0, Math.min(0.05, Number(opts.espalhar == null ? 0.014 : opts.espalhar)));
    const duracao = opts.duracao == null ? 1.4 : opts.duracao;
    const notas = [];
    for (let i = 0; i < lista.length; i++) {
      const n = tocarNota(lista[i], duracao, {
        volume: opts.volume,
        timbre: opts.timbre,
        instrumento: opts.instrumento,
        traste: opts.traste,
        atraso: i * espalhar,
      });
      if (n) notas.push(n);
    }
    return notas;
  }

  /**
   * Varias notas, uma depois da outra.
   *
   * O que faltava para poder OUVIR uma escala. Tocar as notas ao mesmo tempo
   * toca um acorde — e uma escala e uma sequencia: o que faz uma escala
   * parecer escala e o intervalo entre as notas, nao o conjunto delas. Sem
   * isto, a unica forma de ouvir uma escala era ouvir oito notas juntas, que
   * nao e a mesma coisa.
   *
   * O intervalo e fixo por nota, e nao a duracao: uma nota longa com pausa
   * curta embala; uma nota curta com pausa proporcional nao embala. Por isso o
   * `atraso` cresce por indice, e nao o `atraso` que cresce e a duracao.
   *
   * `notas` pode ser um numero de frequencias ou de pares [hz, atrasoExtra] —
   * o segundo uso e quando um acorde precisa de uma nota fora do compasso.
   */
  function tocarSequencia(hzs, opts) {
    opts = opts || {};
    const passo = Math.max(0.05, Math.min(2, Number(opts.passo == null ? 0.32 : opts.passo)));
    const duracao = opts.duracao == null ? Math.min(passo * 1.6, 1.6) : opts.duracao;
    const lista = (Array.isArray(hzs) ? hzs : [hzs]).map((x) => {
      if (Array.isArray(x)) return { hz: Number(x[0]), extra: Number(x[1]) || 0 };
      return { hz: Number(x), extra: 0 };
    }).filter((x) => isFinite(x.hz) && x.hz >= 20 && x.hz <= 15000);

    if (!lista.length) return [];
    const criadas = lista.map(function (n, i) {
      return tocarNota(n.hz, duracao, {
        volume: opts.volume,
        timbre: opts.timbre,
        atraso: i * passo + n.extra,
      });
    }).filter(Boolean);

    // Devolve tambem o instante em que a sequencia termina, para quem quiser
    // desligar o botao no fim em vez de num relogio fixo.
    const termino = criadas.length
      ? criadas[criadas.length - 1].fim
      : 0;
    return criadas;
  }

  /** Corta tudo. Usado ao trocar de tela, para o som nao vazar entre elas. */
  function parar() {
    if (!ctx) return;
    try { ctx.close(); } catch (e) { /* ja fechado */ }
    ctx = null;
  }

  const Audio = {
    tocarNota: tocarNota,
    tocarAcorde: tocarAcorde,
    tocarSequencia: tocarSequencia,
    parar: parar,
    contexto: contexto,
    estado: function () { return ctx ? ctx.state : 'nenhum'; },
  };

  /* O modulo publica como `Nota`, e nao como `Audio`.
   *
   * `window.Audio` ja e uma coisa do navegador: o CONSTRUTOR de `<audio>`, que
   * existe em qualquer pagina. Publicar aqui com esse nome apagava o construtor
   * de todo o mundo que carregasse o app, e `new Audio()` — que qualquer
   * biblioteca, navegador ou script da pagina usa — passaria a receber um
   * objeto com `tocarNota` em vez de um elemento de audio.
   *
   * No app em si quase nao aparecia: so o Estúdio cria audio, e usa o construtor
   * antes deste arquivo carregar. Mas o dano e para fora, e o dano nao tem
   * aviso nenhum — e o tipo de coisa que so aparece quando outra pessoa usa o
   * mesmo codigo. */
  global.Nota = Audio;
  if (typeof module !== 'undefined' && module.exports) module.exports = Audio;
})(typeof window !== 'undefined' ? window : globalThis);