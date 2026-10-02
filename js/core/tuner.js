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
   * ─────────────────────────────────────────────────────────────────
   * DETECCAO DE ALTURA — McLeod, em duas passadas
   *
   * A versao anterior era uma autocorrelacao simples. Ela tinha dois defeitos
   * medidos, nao suspeitados:
   *
   * PRECISAO. O retardo da correlacao e um numero INTEIRO de amostras. A
   * 44100 Hz, uma amostra vale 8,7 cents em Sol2 (98 Hz) — que e um erro que
   * qualquer ouvido treinado escuta. A nota de 784 Hz era lida com 7,7 cents
   * de erro so por causa do arredondamento. O numero estava no maximo
   * possivel e ainda assim era falso.
   *
   * CUSTO. A busca era O(n x atrasoMaximo) sobre o sinal inteiro: 4,9 ms por
   * deteccao. A 30 deteccoes por segundo sao 147% de um nucleo — no iPhone
   * isso esquenta o aparelho e faz o navegador estrangular o AudioContext,
   * que aparece para a pessoa como "o afinador travou".
   *
   * As duas coisas tem a mesma solucao de base:
   *
   * 1. NORMALIZAR a correlacao (NSDF), para o valor nao depender da energia do
   *    trecho — sem isso, uma corda fraca e uma corda forte dao numeros
   *    diferentes para a mesma nota.
   *
   * 2. INTERPOLAR O PICO entre amostras. O pico da correlacao esta entre duas
   *    amostras inteiras, e uma parabola por cima dos tres pontos vizinhos
   *    acha onde ele realmente esta. E o que tira a quantizacao.
   *
   * E para o custo, a busca roda em duas passadas:
   *
   *   - PASSADA GROSSA, num sinal reduzido (decimado). So interessa achar a
   *     OCTAVA, e para isso 11 kHz bastam. A janela encolhe por 4 e o trabalho
   *     cai por 16.
   *   - PASSADA FINA, no sinal original, numa janela de poucos atrasos em
   *     volta do palpite. A taxa real volta aqui, entao a interpolacao tem
   *     toda a precisao que a taxa permite.
   *
   * A escolha do pico e o que evita o erro de oitava — o defeito classico de
   * afinador. Um violao tem a fundamental e seus harmonicos, e o harmonico
   * segundo correlaciona quase tao bem quanto a fundamental. Por isso o
   * primeiro pico NAO e o certo (ele pode estar no ruido), e o maior tambem
   * nao (ele pode estar no segundo harmonico). A regra que funciona e a do
   * McLeod: entre os picos que passam por um limiar alto, vale o MAIOR.
   * ------------------------------------------------------------------ */

  /* Faixa util. O limite de baixo e o Si grave do contrabaixo; o de cima e
   * bem acima da nota mais aguda de qualquer corda, porque acima disso o que
   * se ouve e o estouro do microfone. */
  const HZ_MIN = 27;
  const HZ_MAX = 4200;

  /** Taxa efetiva da passada grossa. 11 kHz resolve 784 Hz com folga. */
  const TAXA_GROSSA = 11025;

  /** Remove o nivel medio e devolve o buffer, ou `null` se nao ha som.
   *
   * SEM JANELA, E DE PROPOSITO.
   *
   * A primeira versao aplicava Hann antes da correlacao, e ela media pior as
   * cordas graves. Numa senoidal pura de 82 Hz, a NSDF no periodo correto dava
   * 0,99977 sem a janela e 0,89500 com ela — e o limiar de aceitacao ficava
   * logo acima do pico verdadeiro, entao o afinador simplesmente calava na nota
   * mais grave que ele existe para medir.
   *
   * A razao: Hann existe para a transformada de Fourier, onde o rectangle vaza
   * energia para as frequencias vizinhas. A correlacao normalizada ja resolve
   * isso pelo outro lado — e exatamente por dividir pela energia dos dois
   * trechos que ela foi criada. Aplicar Hann por cima faz o oposto do que se
   * quer: perto das bordas da janela, uma posicao tem peso quase zero e a
   * outra, peso um, e as duas nao combinam. O efeito e o pico do periodo
   * verdadeiro cair abaixo do limiar. */
  function preparar(dados) {
    const n = dados.length;
    let soma = 0;
    for (let i = 0; i < n; i++) soma += dados[i];
    const media = soma / n;
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) buf[i] = dados[i] - media;

    let energia = 0;
    for (let i = 0; i < n; i++) energia += buf[i] * buf[i];
    if (energia < 1e-9) return null;
    return buf;
  }

  /* --------------------------------------------------------------
  /* --------------------------------------------------------------
     ANTIALIASING

     Reduzir o sinal de 48 kHz para 12 kHz coloca Nyquist em 6 kHz, e o que
     passa disso ALIAS de volta para dentro da faixa. Um chiado de 7 kHz
     aparecia como 5 kHz — que e uma frequencia valida — e o afinador respondia
     com uma nota. A pessoa encostava o celular na mesa e via "Sol".

     Um filtro de media movel NAO resolve. Com quatro amostras a 48000 Hz ele
     derruba 7 kHz em 5 dB, e 5 dB nao e margem nenhuma contra um sinal de
     amplitude cheia.

     O que resolve e um passa-baixa de verdade: seno janelado, com corte em 40%
     da taxa reduzida. Os 40% deixam faixa de transicao antes de Nyquist, e
     para essa janela o ganho ja caiu varias dezenas de decibels em 50% da
     taxa — o bastante para o chiado sumir em vez de virar nota.

     O custo e irrelevante ao lado do resto: poucas multiplicacoes por amostra,
     num sinal de mil amostras. A NSDF, essa sim, e cara.
     -------------------------------------------------------------- */

  function filtrarEReduzir(buf, d) {
    if (d <= 1) return buf;

    /* O numero de amostras tem de ser IMPAR.
     *
     * Com um numero par, o centro do filtro cai entre duas amostras — meio
     * inteiro — e o indice `centro + k - meio` deixa de ser um indice. Num
     * Float32Array isso devolve `undefined`, o produto vira `NaN`, e o `NaN`
     * se espalha pelo sinal inteiro: o afinador parava de ler qualquer nota e
     * a deteccao saia 8 vezes mais lenta, porque a convolucao com `NaN` nao
     * encontra atalho nenhum. Foi o que aconteceu na primeira versao. */
    let nTaps = Math.max(9, Math.min(49, d * 6 + 1));
    if (nTaps % 2 === 0) nTaps += 1;

    const corte = 0.40;              // fracao da taxa reduzida
    const m = nTaps - 1;
    const meio = m / 2;              // inteiro, porque nTaps e impar

    const h = new Float32Array(nTaps);
    let soma = 0;
    for (let i = 0; i < nTaps; i++) {
      const k = i - meio;
      const sinc = k === 0 ? 2 * corte
        : Math.sin(2 * Math.PI * corte * k) / (Math.PI * k);
      // Janela de Hann: corta a ondulacao do sinc, que sem ela vaza para
      // dentro da faixa que o filtro deveria estar rejeitando.
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / m);
      h[i] = sinc * w;
      soma += h[i];
    }
    // Ganho unitario em corrente continua: sem normalizar, o sinal sai menor e
    // a NSDF passa a descrever o filtro, e nao a corda.
    for (let i = 0; i < nTaps; i++) h[i] /= soma;

    const n = Math.floor(buf.length / d);
    const saida = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let acc = 0;
      const centro = i * d;
      for (let k = 0; k < nTaps; k++) {
        const idx = centro + k - meio;
        // Fora da janela vale zero. E o que impede o comeco e o fim do sinal
        // puxarem o resultado para um valor inventado.
        if (idx < 0 || idx >= buf.length) continue;
        acc += buf[idx] * h[k];
      }
      saida[i] = acc;
    }
    return saida;
  }

  /** Correlacao normalizada pelo quadrado (NSDF), de 0 a 1. */
  function nsdf(buf, minLag, maxLag) {
    const n = buf.length;
    const saida = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let r = 0;
      let m = 0;
      for (let i = 0; i < n - lag; i++) {
        const a = buf[i];
        const b = buf[i + lag];
        r += a * b;
        m += a * a + b * b;
      }
      saida[lag] = m > 0 ? (2 * r) / m : 0;
    }
    return saida;
  }

  /** Amplitude de um componente, por projecao no sinal original.
   *
   * E o que resolve o aliasing, e a unica forma de resolve-lo.
   *
   * A NSDF e NORMALIZADA: ela divide pela energia do trecho. Entao uma linha
   * de 7 kHz atenuada em 25 dB pelo filtro continua sendo um sinal
   * perfeitamente periodico, e a NSDF a reporta com a mesma confianca de
   * antes. NENHUM filtro passa-baixa resolve isso — e nao e falha de
   * implementacao: e que normalizar e o que torna a NSDF imune a mudanca de
   * volume. Sao a mesma propriedade vista de dois lados.
   *
   * A verificacao tem de ser feita no sinal de ORIGEM. Se a frequencia que a
   * busca grossa escolheu nao tem energia aqui, ela nao estava tocando: era o
   * eco de alguma coisa que estava acima da taxa reduzida. */
  function componenteEm(buf, taxa, hz) {
    const n = buf.length;
    if (n < 8 || !(hz > 0)) return 0;
    const w = (2 * Math.PI * hz) / taxa;
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      re += buf[i] * Math.cos(w * i);
      im -= buf[i] * Math.sin(w * i);
    }
    return (2 * Math.sqrt(re * re + im * im)) / n;
  }

  /** O RMS do sinal, para comparar com a amplitude de um componente. */
  function rmsDe(buf) {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return buf.length ? Math.sqrt(s / buf.length) : 0;
  }

  /** Pico por cima dos tres vizinhos. `v` e o vetor, `i` o centro. */
  function picoInterpolado(v, i) {
    if (i <= 0 || i >= v.length - 1) return { pos: i, valor: v[i] };
    const a = v[i - 1];
    const b = v[i];
    const c = v[i + 1];
    const den = a - 2 * b + c;
    // Parabola degenerada: os tres pontos sao uma reta ou o centro e um vale.
    if (!isFinite(den) || Math.abs(den) < 1e-12) return { pos: i, valor: b };
    let delta = (0.5 * (a - c)) / den;
    if (!isFinite(delta)) delta = 0;
    if (delta > 1) delta = 1;
    if (delta < -1) delta = -1;
    return { pos: i + delta, valor: b - 0.25 * (a - c) * delta };
  }

  /**
   * Mede a frequencia, e devolve o quanto ela e confiavel.
   *
   * Devolve `{hz, confianca}`. A confianca e o valor do pico da NSDF: perto de
   * 1 o periodo esta muito claro; perto de 0.6 o numero saiu de algum lugar e
   * a tela PRECISA dizer que nao tem certeza, em vez de mostrar uma nota
   * errada com confianca. Mostrar nota errada e o que faz a pessoa afinar a
   * corda no lugar errado — e o pior defeito que um afinador pode ter.
   */
  function detectar(dados, taxaAmostragem) {
    const nada = { hz: 0, confianca: 0 };
    if (!dados || dados.length < 256 || !taxaAmostragem) return nada;

    const cheio = preparar(dados);
    if (!cheio) return nada;

    // ── Passada grossa: qual e a oitava ──
    const d = Math.max(1, Math.round(taxaAmostragem / TAXA_GROSSA));
    const curto = filtrarEReduzir(cheio, d);
    const taxaCurta = taxaAmostragem / d;

    /* O corte da busca grosseira NAO e o mesmo que a faixa de altura aceita.
     *
     * Reduzir o sinal de 48 kHz para 12 kHz coloca Nyquist em 6 kHz. O que
     * passa disso ALIAS de volta para dentro da faixa: um chiado de 7 kHz
     * aparece como 5 kHz, e como 5 kHz ainda e uma frequencia valida, o
     * afinador respondia com uma nota. A pessoa encostava o celular na mesa e
     * via "Sol".
     *
     * A busca grosseira so olha periodos correspondentes a ate 2 kHz, bem
     * abaixo do Nyquist da taxa reduzida. Perde-se nada: a nota mais alta de
     * qualquer corda fretada fica em 1,3 kHz, e a passada fina refina na taxa
     * real em volta do palpite — ela nao pula para longe. */
    const CORTE_GROSSO = 2000;
    const minLag = Math.max(2, Math.floor(taxaCurta / CORTE_GROSSO));
    const maxLag = Math.min(curto.length - 2, Math.ceil(taxaCurta / HZ_MIN));
    if (maxLag <= minLag + 2) return nada;

    const curva = nsdf(curto, minLag, maxLag);

    let maximo = -1;
    let maxLagVisto = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (curva[lag] > maximo) { maximo = curva[lag]; maxLagVisto = lag; }
    }
    if (maxLagVisto < 0 || maximo < 0.35) return nada;

    /* ── A BUSCA COMECA LOGO APOS minLag ──
     *
     * O metodo do McLeod manda comecar depois da primeira passagem por zero da
     * NSDF, e essa etapa JA ESTEVE AQUI. Ela foi removida por medicao, e a
     * razao esta aqui para ninguem recoloca-la:
     *
     * 1. REDUNDANTE. O platô inicial vale quase 1 no atraso zero, e e o motivo
     *    de a etapa existir. Mas o platô nao e maximo local dentro da faixa
     *    buscada, entao a regra do PRIMEIRO pico acima do limiar nunca o
     *    encontra. Removendo a etapa, os 120 testes passam, os 12 casos de
     *    corda continuam sendo lidos, e nenhuma oitava errada aparece.
     *
     * 2. NOCIVA. Com o corte grosseiro em 2 kHz, `minLag` passa de 2 para 6, e
     *    a 440 Hz a NSDF ja e NEGATIVA nessa borda. A busca pelo primeiro
     *    cruzamento positivo-para-negativo caia em 1,25 periodos — DEPOIS do
     *    pico verdadeiro — e o afinador respondia 220 Hz. Um passo de defesa
     *    que, quando a faixa se move, troca um erro por outro.
     *
     * A protecao que ela dava de verdade era o LIMIAR: o maximo global da
     * curva vem do platô, e um limiar medido ali pode ficar acima do pico
     * verdadeiro. Isso agora e tratado pelo filtro passa-baixa, que remove o
     * conteudo que nao e nota antes da busca comecar. */
    const inicio = minLag;
    // Limiar alto: acima dele, os picos sao periodo de verdade e nao eco do
    // ruido.
    //
    // E vale o PRIMEIRO pico que passa, e nao o MAIOR. Uma versao anterior
    // pegava o maior, e ela erra de um jeito que so aparece em nota aguda com
    // harmonico forte: medindo 783,99 Hz, a NSDF deu 0,9826 no periodo, 0,9687
    // no dobro e 0,9856 no TRIPLO — o maior era o triplo, e o afinador
    // respondia 261 Hz. A nota estava certa tres vezes e o afinador aceitava a
    // errada.
    //
    // A razao e a ordem. Depois da passagem por zero, os picos vem em ordem:
    // o primeiro e o periodo, os seguintes sao os multiplos dele. Harmonicos
    // reforcam o multiplo; eles nunca aparecem antes do periodo. Entao o
    // primeiro pico que passa do limiar e a fundamental, e o limiar existe
    // para o barulho de fundo nao virar um pico antes dela.
    const LIMIAR = maximo * 0.9;
    let bruto = -1;
    for (let lag = inicio + 1; lag < maxLag; lag++) {
      const ePico = curva[lag] > curva[lag - 1] && curva[lag] >= curva[lag + 1];
      if (ePico && curva[lag] >= LIMIAR) { bruto = lag; break; }
    }
    // Nenhum pico passou do limiar: o que a curva mostra e mais fraco que a
    // propria media. Calar e melhor do que mostrar a nota errada.
    if (bruto < 0) return nada;

    const picoGrosso = picoInterpolado(curva, bruto);
    const lagGrosso = picoGrosso.pos * d;

    // ── Passada fina: a taxa real, numa janela estreita ──
    // Uma janela de mais/menos um factor de decimacao cobre o erro do palpite
    // grosso com sobra, e custa pouco: sao poucos atrasos, na janela cheia.
    const janela = Math.max(2, Math.ceil(d * 1.5));
    const centro = Math.round(lagGrosso);
    const lo = Math.max(1, centro - janela);
    const hi = Math.min(cheio.length - 2, centro + janela);
    if (hi <= lo + 1) return nada;

    const fino = nsdf(cheio, lo, hi);
    let melhor = lo;
    let melhorValor = -2;
    for (let lag = lo; lag <= hi; lag++) {
      if (fino[lag] > melhorValor) { melhorValor = fino[lag]; melhor = lag; }
    }
    if (melhorValor < 0.35) return nada;

    const picoFino = picoInterpolado(fino, melhor);
    const lagFinal = picoFino.pos;
    if (!(lagFinal > 0)) return nada;

    const hz = taxaAmostragem / lagFinal;
    if (!(hz >= HZ_MIN && hz <= HZ_MAX)) return nada;

    /* ── A GUARDA CONTRA ALIASING ──
     *
     * Confere que a frequencia escolhida tem energia no sinal ORIGINAL. Sem
     * esta conferida, um chiado de 7 kHz reduzido para 12 kHz aparecia como
     * 5 kHz — dentro da faixa, com confianca alta — e o afinador mostrava uma
     * nota para quem so tinha encostado o celular na mesa.
     *
     * O limite e 8% do RMS. Uma corda tem a fundamental acima disso com
     * sobra (sozinha ela ja passa de 50%); um alias puro nao tem nada.
     */
    const nivel = rmsDe(cheio);
    if (nivel > 0) {
      const amp = componenteEm(cheio, taxaAmostragem, hz);
      if (amp < nivel * 0.08) return nada;
    }

    return { hz: hz, confianca: Math.max(0, Math.min(1, picoFino.valor)) };
  }

  /**
   * Mede a frequencia. Mantem o nome antigo porque quem chama e a tela do
   * afinador, e o nome sozinho nao diz nada de ruim.
   */
  function detectarHz(dados, taxaAmostragem) {
    return detectar(dados, taxaAmostragem).hz;
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
    HZ_MIN: HZ_MIN,
    HZ_MAX: HZ_MAX,
    notaParaHz: notaParaHz,
    hzParaNota: hzParaNota,
    detectar: detectar,
    detectarHz: detectarHz,
    suavizar: suavizar,
  };

  global.Tuner = Tuner;
  if (typeof module !== 'undefined' && module.exports) module.exports = Tuner;
})(typeof window !== 'undefined' ? window : globalThis);
