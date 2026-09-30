/* =========================================================
   ACORDE - core/tuner.js
   Afinador: matematica pura, sem Web Audio.
   Expõe window.Tuner.

   A separacao aqui nao e preciosismo. Pegar microfone, criar o AudioContext
   e medir a frequencia exigem um navegador com microfone autorizado, o que
   nao existe num runner de teste. A parte que decide "isto e um Sol-sharp e
   esta 14 cents acima" e pura conta, e essa e a parte que pode estar errada
   sem ninguem perceber: o afinador mostraria uma nota e o musico acreditaria.

   Por isso o calculo vem primeiro, testado, e a captacao entra em volta.
   --------------------------------------------------------- */
(function (global) {
  'use strict';

  // As 12 alturas em semitons a partir do Do. A ordem e a do circulo, e nao a
  // alfabetica: e assim que o musico pensa, e e o que faz o ponteiro andar
  // para o lado certo.
  const NOMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

  /** Converte para o que o app escreve: C, C#, D... e nao Dó, Dó# */
  const LETRAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /**
   * A4 = 440 Hz e o padrao. O afinador aceita outro por causa dos orquestras
   * e orquestras de cordas, que afinam em 442 ou 445.
   */
  const A4_PADRAO = 440;

  /**
   * Frequencia de uma nota. A escala e logaritmica, que e por isso que a
   * diferenca entre notas e um numero de cents e nao de Hertz.
   *
   *   12 semitons por octave, e 100 cents por semitom.
   */
  function notaParaHz(pc, oitava, refA4) {
    const ref = refA4 || A4_PADRAO;
    return ref * Math.pow(2, (pc - 9 + (oitava - 4) * 12) / 12);
  }

  /**
   * Converte uma frequencia na nota mais proxima.
   *
   * `cents` e o quanto a nota esta fora do centro: 0 e afinado, +50 e meio
   * caminho para a nota de cima, -50 para a de baixo. O sinal importa — e ele
   * que diz para o lado que acordar o cravelho.
   *
   * Devolve null abaixo de 20 Hz: abaixo disso nao ha nota musical, e o que
   * chega ali e ruido grave de ventilador, rumble ou o vento no microfone.
   */
  function hzParaNota(hz, refA4) {
    if (!hz || !isFinite(hz) || hz <= 20) return null;

    const ref = refA4 || A4_PADRAO;
    // Semitons acima do A4, fracionarios.
    const semitons = 12 * Math.log2(hz / ref);

    // Arredonda para a nota mais proxima.
    const inteiro = Math.round(semitons);
    const cents = Math.round((semitons - inteiro) * 100);

    // O A4 e o semitom 0; cada semitom abaixo e -1.
    const pc = mod12(inteiro + 9);
    const oitava = 4 + Math.floor((inteiro + 9) / 12);

    return {
      pc: pc,
      nome: LETRAS[pc],
      nomeLongo: NOMES[pc],
      oitava: oitava,
      cents: cents,
      hz: hz,
      exata: notaParaHz(pc, oitava, ref),
      // Terso a casa toda. Fora disso o "quase afinado" e mentira: quem esta a
      // meio tom de distancia nao esta afinando, esta na nota errada.
      perto: Math.abs(cents) <= 8,
    };
  }

  function mod12(n) {
    return ((n % 12) + 12) % 12;
  }

  /**
   * Mede a frequencia por autocorrelacao.
   *
   * A alternativa obvia seria o pico da transformada de Fourier, mas ela
   * resolve mal a nota grave do violao: a fundamental cai em poucas amostras
   * numa janela de 2048, e o que aparece mais alto e o segundo harmonico, dois
   * octaves acima. O afinador saltaria do Sol para o Sol duas oitavas acima,
   * que e o defeito classico de afinador barato.
   *
   * A autocorrelacao compara o sinal com ele mesmo deslocado e procura o
   * menor atraso que ainda se parece — que e exatamente o periodo. Custsa mais
   * que a Fourier, e e o que faz a nota grave funcionar.
   */
  function detectarHz(dados, taxaAmostragem) {
    const n = dados.length;
    if (n < 128) return 0;

    // Remove o nivel medio antes de comparar, senao a correlacao mede a
    // intensidade do microfone em vez do periodo.
    let soma = 0;
    for (let i = 0; i < n; i++) soma += dados[i];
    const media = soma / n;
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) buf[i] = dados[i] - media;

    // Energia minima para n�o devolver numero de ruido.
    let energia = 0;
    for (let i = 0; i < n; i++) energia += buf[i] * buf[i];
    if (energia < 1e-7) return 0;

    // Faixa util: de 27 Hz (Si grave) a 4200 Hz. Abaixo disso e ruido de
    // manipulacao; acima, o conteudo estourado de um microfone deeletronico.
    const minLag = Math.max(1, Math.floor(taxaAmostragem / 4200));
    const maxLag = Math.min(n - 1, Math.floor(taxaAmostragem / 27));

    let melhorLag = -1;
    let melhorCorr = 0;
    const corrs = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < n - lag; i++) corr += buf[i] * buf[i + lag];
      corr /= n - lag;
      corrs[lag] = corr;
      if (corr > melhorCorr) {
        melhorCorr = corr;
        melhorLag = lag;
      }
    }

    if (melhorLag < 0 || melhorCorr < 0.3) return 0;

    // ── A correcao que decide se o afinador funciona ──
    //
    // A correlacao vale quase o mesmo no periodo da nota e em qualquer
    // multiplo dele: um seno puro de 440 Hz correlaciona ~1,0 nos atrasos de
    // 100, 200 e 300 amostras. O maior valor, portanto, nao diz a frequencia:
    // qualquer multiplo ganha por margem, e a nota descia uma ou duas
    // oitavas sem reclamar. Foi o que o teste pegou — 440 Hz lido como 27 Hz.
    //
    // O periodo verdadeiro e o PRIMEIRO pico, e nao o maior. A busca vai do
    // atraso menor para o maior e para no primeiro maximo local que chegue
    // perto do melhor valor. Andar para tras a partir do maximo tambem
    // falhava: todo multiplo passa pelo limiar, e a busca ia ate o primeiro
    // deles, o mais curto — a nota subia de oitava.
    const LIMIAR = melhorCorr * 0.9;
    let escolhido = melhorLag;
    for (let lag = minLag + 1; lag < melhorLag; lag++) {
      const ePico = corrs[lag] > corrs[lag - 1] && corrs[lag] >= corrs[lag + 1];
      if (ePico && corrs[lag] >= LIMIAR) {
        escolhido = lag;
        break;
      }
    }

    return taxaAmostragem / escolhido;
  }

  /**
   * A media e o maximo dos ultimos valores, que e o que segura o visor quando
   * a mao treme. Media simples sozinha deixa o numero tremendo a ponto de
   * ficar ilegivel no palco.
   */
  function suavizar(historico, novo) {
    historico.push(novo);
    if (historico.length > 7) historico.shift();
    let soma = 0;
    for (const v of historico) soma += v;
    return soma / historico.length;
  }

  const Tuner = {
    NOMES: NOMES,
    LETRAS: LETRAS,
    A4_PADRAO: A4_PADRAO,
    notaParaHz: notaParaHz,
    hzParaNota: hzParaNota,
    detectarHz: detectarHz,
    suavizar: suavizar,
  };

  global.Tuner = Tuner;
  if (typeof module !== 'undefined' && module.exports) module.exports = Tuner;
})(typeof window !== 'undefined' ? window : globalThis);
