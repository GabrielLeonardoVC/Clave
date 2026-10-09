/* =========================================================
   Cifras e Escalas Pro — core/music.js
   Motor de teoria musical: notas, acordes, transposição,
   escalas, graus, círculo das quintas, voicer de guitarra.
   Sem dependências. Expõe window.Music.
   ========================================================= */
(function (global) {
  'use strict';

  /* =======================================================
     1. NOTAS
     ======================================================= */
  const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_NAMES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const PRETTY      = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const SOLFEGE     = ['Dó', 'Dó♯', 'Ré', 'Ré♯', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Sol♯', 'Lá', 'Lá♯', 'Si'];
  const LETTER_PC   = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  const mod12 = (n) => ((n % 12) + 12) % 12;

  function noteName(pc, flat) { return (flat ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)]; }
  function notePretty(pc, flat) { return (flat ? FLAT_NAMES : PRETTY)[mod12(pc)]; }
  function noteSolfege(pc) { return SOLFEGE[mod12(pc)]; }

  function pcFromAccidental(letter, acc) {
    // Letra fora da tabela nao e erro de sintaxe, e erro de chamada. Deixar
    // passar devolve undefined, que na conta seguinte vira NaN, e o NaN caminha
    // pela cifra inteira ate aparecer escrito como "undefined" na tela. O regex
    // ja garante A-G nos dois chamadores; este guard e a rede de seguranca
    // para o proximo que chamar daqui.
    let n = LETTER_PC[letter];
    if (n === undefined) return null;
    if (!acc) return n;
    for (const ch of acc) {
      if (ch === '#' || ch === '\u266f') n += 1;
      else if (ch === 'b' || ch === '\u266d') n -= 1;
    }
    return mod12(n);
  }

  /* =======================================================
     1b. GRAFIA — QUAL NOME A NOTA TEM

     POR QUE ESTA PARTE EXISTE

     `noteName(pc, flat)` acima responde "como se escreve o SOM", e essa
     pergunta tem duas respostas legitimas: o semitom 1 e C# e Db ao mesmo
     tempo. O que decide entre elas nao e o som, e o CONTEXTO.

     A regra da teoria, que e a mesma em qualquer manual de leitura
     musical, tem tres passos:

       1. PRENDE-SE A TONICA. A escala parte da letra que o músico leu.
       2. CADA GRAU SOBE UMA LETRA. C-D-E-F-G-A-B-C. Uma letra por grau,
          sempre. Nenhuma letra se repete dentro da escala.
       3. O ACIDENTE E O QUE SOBRAR. Depois que a letra esta marcada, o
          acidente nao se escolhe: ele e o que faz aquela letra cair
          exatamente na altura pedida.

     Sem o passo 2, a escala de Sol maior com bemóis sai "G A B C D E Gb" —
     e ai esta o defeito: sol maior nao tem Gb, tem F#. O som estava certo e
     a letra errada, que e o pior tipo de erro musical, porque o musico le
     "Gb", afina Gb e sobe meio tom.

     COMO SE ESCOLHE A LETRA DA TONICA

     Quando o mesmo semitom tem dois nomes, a teoria manda usar o que
     precisa de MENOS acidenteais. Entre 7 sustenidos (Dó sustenido maior) e
     5 bemóis (Ré bemol maior), vence Ré bemol. E no empate, vence o bemol,
     porque e o que existe de verdade na pratica.

     Isso aqui e o que `useFlatsFor` tenta fazer pelo circulo das quintas, e
     funciona para as tonalidades maiores de um lado e de outro do circulo —
     mas a regra do circulo e uma regra de TONALIDADE MAIOR. Ela nao
     descreve menor, nem dorio, nem locrio. Por isso `useFlatsFor` continua
     valendo para nome de acorde, que e o uso que ele tem, e a grafia das
     escalas passou a ser derivada daqui.
     ======================================================= */
  const LETRAS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const PC_DA_LETRA = [0, 2, 4, 5, 7, 9, 11];
  const SIMBOLO_ACCIDENTE = {
    '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##',
  };

  /**
   * Quantos Tons uma LETRA precisa de deslocamento para cair em `pc`.
   *
   * A conta e a distancia entre a letra e o semitom pedido, trazida para a
   * faixa de um meio tom: -1 e bemol, +1 e sustenido. O `while` existe porque
   * B e semitom 11 e a letra seguinte (C) e semitom 0: a distancia crua seria
   * +11, e o que o musica ve e -1.
   */
  function acentoDaLetra(pc, letra) {
    const i = LETRAS.indexOf(letra);
    if (i < 0) return null;
    let d = mod12(pc) - PC_DA_LETRA[i];
    if (d > 6) d -= 12;
    if (d < -6) d += 12;
    return d;
  }

  /** Escreve uma letra com o acidente pedido: "F" + 1 vira "F#". */
  function letraComAcidente(letra, acento) {
    const s = SIMBOLO_ACCIDENTE[String(acento)];
    return s === undefined ? letra : letra + s;
  }

  /** Quantos accidentais uma escala inteira gasta com a tonica `letra`. */
  function custoDaEscala(pc, iv, letra) {
    const primeiro = LETRAS.indexOf(letra);
    let soma = 0;
    for (let g = 0; g < iv.length; g++) {
      const letraGrau = LETRAS[(primeiro + g) % 7];
      const a = acentoDaLetra(mod12(pc + iv[g]), letraGrau);
      /* Um acidente fora de -2..+2 significa que o par letra/altura nao
       * pertence a nenhum tom de verdade — e o sinal de que a tônica escolhida
       * nao serve para esta escala. A conta soma 99 para nao ganhar. */
      if (a === null || a < -2 || a > 2) return 99;
      soma += Math.abs(a);
    }
    return soma;
  }

  /**
   * A letra da tônica que esta musical correta para `pc` nesta escala.
   *
   * Testa as 7 letras e fica com a que gasta menos acidenteais; no empate,
   * com a de bemol. É a regra de "use o menor numero de alteracoes", com o
   * desempate que a pratica musical usa.
   */
  function letraDaTonica(pc, iv) {
    let melhor = null;
    let melhorCusto = Infinity;
    let melhorBemol = false;
    for (const letra of LETRAS) {
      const custo = custoDaEscala(pc, iv, letra);
      if (custo === 99) continue;
      const bemol = acentoDaLetra(pc, letra) < 0;
      if (custo < melhorCusto || (custo === melhorCusto && bemol && !melhorBemol)) {
        melhor = letra; melhorCusto = custo; melhorBemol = bemol;
      }
    }
    return melhor || 'C';
  }

  /**
   * A GRAVIA de uma escala, com uma letra por grau.
   *
   * Devolve um objeto por grau com o nome escrito, a letra, o acidente e a
   * classe de altura. Quem so quiser os nomes usa `nomesDaEscala`.
   *
   * `opts.tonica` fixa a letra da tônica quando o chamador sabe qual é — por
   * exemplo quando a pessoa digitou "Db" e não "C#". Sem isso, a letra é
   * escolhida por `letraDaTonica`.
   *
   * Escala com mais de 7 notas (cromática, por exemplo) NÃO cabe na regra das
   * 7 letras: são 12 notas e só 7 letras. Nesses casos a função desiste e
   * devolve a grafia simples por sustenido ou bemol, que é a única que
   * funciona sem repetir letra.
   */
  function escalaComGravacao(rootPc, scaleKey, opts) {
    opts = opts || {};
    const sc = SCALES[scaleKey] || SCALES.major;
    const iv = sc.iv;
    const pc = mod12(rootPc);
    /* A regra das sete letras é das escalas de sete notas, e SÓ delas.
     *
     * Numa pentatônica maior os graus são 1 2 3 5 6, e as letras que a
     * prática usa pulam: a de F# pentatônica maior é F# A# C# E G#. Se a
     * função subisse uma letra por grau sairia F# G# A# B C#, que tem as
     * alturas erradas — e o teste de altura lê cada nome de volta e pega.
     *
     * Por isso o desvio vale para QUALQUER contagem diferente de sete, e não
     * só para as maiores que sete. Nessas escalas volta a grafia simples por
     * sustenido ou bemol, que é a convenção de grau de escala (1, 2, b3, b5)
     * e é o que o app já mostrava. */
    if (iv.length !== 7) {
      const flat = opts.flat === undefined ? useFlatsFor(pc) : !!opts.flat;
      return iv.map(function (i) {
        const p = mod12(pc + i);
        return { pc: p, letra: null, acento: null, nome: noteName(p, flat) };
      });
    }
    /* A letra da tônica tem de ser a MESMA LETRA do nome que a tela mostra.
     *
     * Sem esta amarração o app se contradiz: o seletor de tons chama o semitom
     * 6 de "F#" (porque o círculo o põe do lado dos sustenidos) e a escala,
     * escolhida pela regra dos menos accidentais, sairia "Gb Ab Bb Cb Db Eb F".
     * Duas letras para o mesmo tom, na mesma tela, é pior que o defeito que
     * esta função corrige.
     *
     * A letra sai do próprio nome canônico — a primeira letra de "F#" é F, e a
     * de "Db" é D. A partir dai tudo o mais e consequência: os graus sobem uma
     * letra e o acidente é o que sobrar. */
    const nomeDaTonica = opts.tonica || noteName(pc, useFlatsFor(pc));
    const letra0 = LETRAS.indexOf(nomeDaTonica.charAt(0));
    const inicio = letra0 < 0 ? 0 : letra0;
    return iv.map(function (i, g) {
      const letra = LETRAS[(inicio + g) % 7];
      const p = mod12(pc + i);
      const acento = acentoDaLetra(p, letra);
      return {
        pc: p,
        letra: letra,
        acento: acento,
        nome: letraComAcidente(letra, acento),
      };
    });
  }

  /** Só os nomes, na grafia correta. Equivalente a `scaleNames`, e certo. */
  function nomesDaEscala(rootPc, scaleKey, opts) {
    return escalaComGravacao(rootPc, scaleKey, opts).map((g) => g.nome);
  }

  /**
   * Escolhe a grafia de UM acorde isolado.
   *
   * Um acorde fora de contexto não tem grafia certa: F# e Gb são o mesmo som e
   * os dois nomes são legítimos. A regra que decide é a mesma do tom: se o
   * acorde pertence a alguma tonalidade cujo lado do círculo prefere bemóis,
   * escreve com bemol. `notaDeAcorde` deixa isso explícito para quem quiser
   * a outra escolha.
   */
  function nomeDeAcorde(pc, contextoPc) {
    const flat = contextoPc === undefined || contextoPc === null
      ? useFlatsFor(pc)
      : useFlatsFor(mod12(contextoPc));
    return noteName(mod12(pc), flat);
  }

  /* =======================================================
     2. QUALIDADES DE ACORDE
     ======================================================= */
  const QUALITIES = {
    '':      { iv: [0, 4, 7],           label: '',      full: 'Maior' },
    'maj':   { iv: [0, 4, 7],           label: '',      full: 'Maior' },
    'M':     { iv: [0, 4, 7],           label: '',      full: 'Maior' },
    'm':     { iv: [0, 3, 7],           label: 'm',     full: 'Menor' },
    'min':   { iv: [0, 3, 7],           label: 'm',     full: 'Menor' },
    'mi':    { iv: [0, 3, 7],           label: 'm',     full: 'Menor' },
    'dim':   { iv: [0, 3, 6],           label: 'dim',   full: 'Diminuto' },
    'o':     { iv: [0, 3, 6],           label: 'dim',   full: 'Diminuto' },
    'aug':   { iv: [0, 4, 8],           label: 'aug',   full: 'Aumentado' },
    '+':     { iv: [0, 4, 8],           label: 'aug',   full: 'Aumentado' },
    '5':     { iv: [0, 7],              label: '5',     full: 'Quinta (power)' },
    '6':     { iv: [0, 4, 7, 9],        label: '6',     full: 'Maior com 6ª' },
    'm6':    { iv: [0, 3, 7, 9],        label: 'm6',    full: 'Menor com 6ª' },
    '7':     { iv: [0, 4, 7, 10],       label: '7',     full: 'Dominante 7' },
    'maj7':  { iv: [0, 4, 7, 11],       label: 'maj7',  full: 'Maior com 7ª maior' },
    'M7':    { iv: [0, 4, 7, 11],       label: 'maj7',  full: 'Maior com 7ª maior' },
    '7M':    { iv: [0, 4, 7, 11],       label: 'maj7',  full: 'Maior com 7ª maior' },
    '\u0394':    { iv: [0, 4, 7],           label: '',      full: 'Maior' },
    '\u03947':   { iv: [0, 4, 7, 11],       label: 'maj7',  full: 'Maior com 7ª maior' },
    'm7':    { iv: [0, 3, 7, 10],       label: 'm7',    full: 'Menor com 7ª menor' },
    'mmaj7': { iv: [0, 3, 7, 11],       label: 'mMaj7', full: 'Menor com 7ª maior' },
    'mM7':   { iv: [0, 3, 7, 11],       label: 'mMaj7', full: 'Menor com 7ª maior' },
    'dim7':  { iv: [0, 3, 6, 9],        label: 'dim7',  full: 'Diminuto com 7' },
    'o7':    { iv: [0, 3, 6, 9],        label: 'dim7',  full: 'Diminuto com 7' },
    'm7b5':  { iv: [0, 3, 6, 10],       label: 'm7b5',  full: 'Meio-diminuto' },
    '\u00F8':    { iv: [0, 3, 6, 10],       label: 'm7b5',  full: 'Meio-diminuto' },
    '\u00F87':   { iv: [0, 3, 6, 10],       label: 'm7b5',  full: 'Meio-diminuto' },
    'sus2':  { iv: [0, 2, 7],           label: 'sus2',  full: 'Suspenso 2' },
    'sus4':  { iv: [0, 5, 7],           label: 'sus4',  full: 'Suspenso 4' },
    'sus':   { iv: [0, 5, 7],           label: 'sus4',  full: 'Suspenso 4' },
    '7sus4': { iv: [0, 5, 7, 10],       label: '7sus4', full: 'Dominante suspensa 4' },
    'add9':  { iv: [0, 2, 4, 7],        label: 'add9',  full: 'Maior add9' },
    'add2':  { iv: [0, 2, 4, 7],        label: 'add2',  full: 'Maior add2' },
    '6/9':   { iv: [0, 2, 4, 7, 9],     label: '6/9',   full: 'Maior 6/9' },
    'madd9': { iv: [0, 2, 3, 7],        label: 'madd9', full: 'Menor add9' },
    '9':     { iv: [0, 2, 4, 7, 10],    label: '9',     full: 'Dominante 9' },
    'maj9':  { iv: [0, 2, 4, 7, 11],    label: 'maj9',  full: 'Maior 9' },
    'm9':    { iv: [0, 2, 3, 7, 10],    label: 'm9',    full: 'Menor 9' },
    '11':    { iv: [0, 2, 5, 7, 10],    label: '11',    full: 'Dominante 11' },
    'm11':   { iv: [0, 2, 3, 5, 7, 10], label: 'm11',   full: 'Menor 11' },
    '13':    { iv: [0, 2, 4, 7, 9, 10], label: '13',    full: 'Dominante 13' },
    'maj13': { iv: [0, 2, 4, 7, 9, 11], label: 'maj13', full: 'Maior 13' },
  };

  // chaves de qualidade ordenadas do mais longo pro mais curto
  // chaves de qualidade ordenadas do mais longo pro mais curto
  const QUALITY_KEYS = Object.keys(QUALITIES)
    .filter((k) => k !== '' && k !== 'M')
    .sort((a, b) => b.length - a.length);

  /**
   * Normaliza o sufixo de um acorde e devolve uma chave de QUALITIES.
   * Distingue "m" (menor) de "M" (maior) e entende as grafias mais
   * comuns em cifras: min, -, dim/o, grau, o com slash, +, Delta, add9, sus4.
   */
  function matchQuality(raw) {
    let s = String(raw == null ? '' : raw);
    s = s.replace(/[\s.\u00b7]/g, '');
    if (!s) return '';

    // 1) simbolos -> palavras
    s = s.replace(/\u0394\s*7/g, 'maj7').replace(/\u0394/g, 'maj');
    s = s.replace(/\u00f8\s*7/g, 'm7b5').replace(/\u00f8/g, 'm7b5');
    s = s.replace(/\u00b0\s*7/g, 'dim7').replace(/\u00b0/g, 'dim');
    s = s.replace(/\*/g, 'dim');
    s = s.replace(/\+/g, 'aug');
    s = s.replace(/[\u2013\u2014\u2212]/g, '-');

    // 2) "minor"/"min"/"mi" -> menor (antes de qualquer regra com "m")
    s = s.replace(/^min(?!or)/i, 'm').replace(/^mi(?!n|aj)/i, 'm');

    // 3) "M" maiusculo = maior :  CM7 -> Cmaj7 , CM -> C
    if (s[0] === 'M') s = 'maj' + s.slice(1);

    // 4) travessao:  C-7 -> C7   |   C- -> Cm
    s = s.replace(/^-(?=\d)/, '').replace(/^-/, 'm');

    // 5) palavras completas
    s = s.replace(/^major/i, 'maj')
      .replace(/^min(?!or)/i, 'm')
      .replace(/^dim(inished)?/i, 'dim')
      .replace(/^aug(mented)?/i, 'aug')
      .replace(/^sus(pended)?/i, 'sus')
      .replace(/^add(ed)?/i, 'add');
    s = s.replace(/^o7$/, 'dim7').replace(/^o(?=\d|$)/, 'dim');
    // "sus" sem numero = sus4 (convenção universal)
    s = s.replace(/^sus$/, 'sus4');

    /* =======================================================
       5b. AS GRAFIA NUMERICA

       O QUE ESTE BLOCO CORRIGE, E POR QUE ELE EXISTE

       Antes desta regra, qualquer sufixo que o motor nao conhecesse voltava
       como vazio — e vazio significa "maior". O efeito era o pior tipo de
       defeito musical: NAO ERA ERRO, era acorde errado, e o musiciano ouvia
       e acreditava.

         "C4"  virava C maior      (C4 e C sus 4)
         "C0"  virava C maior      (C0 e C diminuto)
         "C2"  virava C maior      (C2 e C sus 2)
         "C7/9" virava C maior     (o /9 era engolido pela regra de extensao)

       O caso do "C7/9" e o mais traiçoeiro, porque o padrao do proprio motor
       aceita barra como separador de extensao e nao fazia nada com ela: o
       sufixo chegava inteiro, "7/9", nao casava com nada e voltava vazio.

       POR QUE "0", "4" E "2" ESTAVO LIVRES

       Nenhuma das tres existe como chave em QUALITIES, entao nenhum acorde do
       mundo estava usando esses sufixos com outro sentido. "5" ja era quinta
       e continua sendo; e o precedente do caso: o motor ja tratava o numero
       como nome de qualidade, so nao tinha o caso "4".

       A ancora ^...$ e o que impede dano colateral. "C4/4" continua nao
       sendo acorde, porque o sufixo inteiro "4/4" nao casa com /^4$/ — e
       assim um compasso escrito ao lado de uma letra nao vira acorde sozinho.

       O que NAO esta aqui de proposito: nenhuma regra que aceite texto
       desconhecido como maior. Aceitar "Cxyz" como C maior continua sendo o
       comportamento antigo, e o teste musical mede e declara esse limite.
       ======================================================= */

    /* extensao com barra: "C7/9" e o mesmo acorde que "C9".
     *
     * O primeiro digito e 7 e SO 7 de proposito. "C6/9" e um acorde de verdade
     * — maior com sexta e nona, [0,2,4,7,9] — e ele tem nome proprio em
     * QUALITIES. Uma regra que aceptasse qualquer digito antes da barra
     * transformava "C6/9" em "C9", que e outro acorde, e perdia a sexta. */
    s = s.replace(/^7\/(9|11|13)$/, '$1')
      .replace(/^7\/5$/, '7')
      .replace(/^7\/3$/, '7')
      .replace(/^7\/4$/, '7sus4');

    // numero solto: 0 = diminuto, 4 = suspensa de 4, 2 = suspensa de 2
    s = s.replace(/^0$/, 'dim')
      .replace(/^4$/, 'sus4')
      .replace(/^2$/, 'sus2');

    // "C5+" e o quinta Aumentada; o "+" acima ja virou a palavra "aug"
    s = s.replace(/^5aug$/, 'aug');

    // "Cm-5b5" e "Cm-5(b5)": o travessao antes do 5 marca a quinta baixa
    s = s.replace(/-5b5$/, '7b5');

    /* ORDEM "m7M" DO ONSONG — GRAFIA DO CIFRA CLUB, AGORA ACEITA
     *
     * O padrao do Cifra Club documenta `Cm7M` como menor com setima maior —
     * os mesmos intervalos de `CmM7`, que o motor ja conhece. Existia aqui uma
     * regra que negava essa grafia, de decisao de produto antiga; o objetivo do
     * projeto agora e compatibilidade com o Cifra Club, entao ela vale.
     *
     * A conversao vem ANTES do `toLowerCase`: em caixa baixa `m7M` e `m7` sao
     * a mesma coisa e o M do maior se perderia. Por isso o M volta em
     * maiuscula — e a chave `mM7` do vocabulario de qualidades. */
    s = s.replace(/^m(\d+)M$/, 'mM$1');

    s = s.toLowerCase();
    if (!s) return '';
    if (s === 'm') return 'm';
    if (s === 'maj') return 'maj';

    // 6) correspondencia exata, com distinguecao de CAIXA
    //    (necessaria: "m7" = menor com 7, "M7" = maior com 7)
    for (const k of QUALITY_KEYS) if (k === s) return k;
    for (const k of QUALITY_KEYS) if (k.toLowerCase() === s) return k;
    // 7) igual ao 6, mas exigindo que o sufixo INTEIRO tenha sido consumido.
    //    Sem essa exigencia o motor truncava: "m7(5-)" casava com "m7" e
    //    o "(5-)" sumia, virando Dm7 — que e meio-diminuto virando menor com 7,
    //    outro acorde e outro som, sem nenhum aviso. O sufixo que sobra nao cabe
    //    em nenhuma qualidade conhecida: entao o honesto e devolver vazio, e quem
    //    reconstroi o nome devolve o texto como estava, movendo so a fundamental.
    for (const k of QUALITY_KEYS) {
      if (k.length >= 2 && s.startsWith(k) && s.slice(k.length) === '') return k;
    }
    for (const k of QUALITY_KEYS) {
      if (k.length >= 2 && s.toLowerCase().startsWith(k.toLowerCase())
        && s.length === k.length) return k;
    }
    return '';
  }

  /**
   * Formato de acorde aceito:
   *   fundamental + alteracao + qualidade (ordem livre) + extensao "/9" + baixo "/D"
   */
  /**
   * Sufixo de qualidade aceito. E' deliberadamente restrito a formas
   * reais de acorde, para que palavras como "faltara" (F + "altara")
   * ou "maior" (M + "aior") NAO sejam interpretadas como acordes.
   */
  /* ==========================================================
     A GRAMATICA DO ACORDE, E O QUE DELA SE PODE MEDIR

     Isto aqui foi medido, nao presumido. Contra a lista de tokens do padrao de
     cifragem do Cifra Club, o padrao antigo reconhecia 19 de 97. Os outros 78
     NAO ERAM ACORDES para o motor: o `transposeLine` os deixava inteiros, sem
     nem mexer na fundamental.

     O caso grave e silencioso. Numa linha com `Cm7  C7(9)` - setima menor
     colada, setima com nona entre parenteses, as duas grafias do mesmo par de
     acorde - a saida era `Dm7  C7(9)`. O primeiro subiu dois semitons e o
     segundo ficou em C: nenhum aviso, nenhuma excecao, e a progressao muda de
     tom no meio da linha. Quem esta tocando so percebe quando ja cantou errado.

     A causa e uma so: o padrao antigo NAO ACEITAVA PARENTESES. E o padrao do
     Cifra Club usa parenteses justamente nas formas mais comuns depois da
     setima: `Cm7(5-)`, `C7M(5+)`, `C7(9)`, `C7(11)`, `C6(9/11+)` e
     `C7(5-/9)`. Sem eles no padrao, `parseChord` devolvia nulo e o token
     ficava intacto.

     A correcao NAO e inventar um transpositor concorrente nem um dicionario
     novo de acordes. E fazer o padrao RECONHECER a forma escrita; o resto
     acontece pelo caminho que o proprio arquivo ja tinha e que ja era o
     certo: sufixo que o motor nao sabe nomear volta como estava, e so a
     fundamental e o baixo andam. `Cm7(5-)` vira `Dm7(5-)` - o acorde certo,
     na grafia que a pessoa escreveu.
     ========================================================== */
  const ACC = '[#b\u266f\u266d]';
  const NOTA = '[A-Ga-g]';
  /* um "grau" do Cifra Club: 9, 11+, 13-, 4+ */
  const GRAU = '\\d{1,2}[+-]?';
  /* extensao: o primeiro numero colado, os seguintes entre parenteses e
     separados por barra. O proprio Cifra Club manda escrever `C6(9/11+)`. */
  /* alteracao DEPOIS do parentese: `C5(9)-`, escrita do jeito que o proprio
     Cifra Club usa. Sem esta linha o token nao casava e a fundamental nao
     andava — o mesmo defeito silencioso que os parenteses tinham. */
  const FORA = '[+-]?';
  const PAREN = '(?:\\((?:' + GRAU + '|[b#]5)(?:\\/(?:' + GRAU + '|[b#]5))*\\))?';
  /* uma peca do miolo. A ordem das alternativas importa: `maj` antes de `m`,
     `min` antes de `mi`, para o mais longo vencer. */
  const PECA = '(?:maj|Maj|min|mi|dim|aug|add|sus|m|M|\u00b0|\u00ba|\u00f8|\u0394|[+*\\-]|\\d{1,2}[+-]?|[b#]5)';
  /* `Maj` com M maiusculo entrou aqui por um motivo concreto: e o rotulo que
     * QUALITIES da a qualidade `mM7`, e o motor precisa conseguir RELER o que
     * ele proprio imprime. Sem o `Maj`, `Cm7M` virava `DmMaj7` na transposicao,
     * esse texto nao casava de novo, e a ida e volta devolvia o mesmo acorde
     * deslocado. Um motor que nao le a propria saida perde a qualidade do acorde
     * assim que a cifra passa pelo armazenamento. */
  /* `m7M`, `m5-` e `6-` alternam letra e numero. O padrao antigo exigia todas
     as letras antes de todos os numeros, e por isso nao casava com nenhum
     deles. Daqui a razao de o miolo ser uma repeticao de pecas, e nao
     letra-depois-numero. */
  /* O "o" DE DIMINUTO SO VALE LOGO DEPOIS DA RAIZ.
     *
     * `Co` e `Co7` sao diminuto — e o projeto usa os dois. Dentro de PECA o
     * "o" solto quebrava o verbo "Amo": `m` e `o` viravam duas pecas e a
     * palavra virava acorde, com a fundamental movida e virando "Bmo".
     *
     * A diferenca nao e o "o", e a POSICAO dele. Diminuto vem antes de tudo
     * (`Co`, `Co7`); depois de `m` nao existe diminuto nenhum. Por isso ele sai
     * de PECA e vira marcador proprio, logo apos a raiz. Isso e regra de
     * GRAMATICA, e nao lista de palavras proibidas: `Amo` deixa de ter forma de
     * acorde, `Co7` continua valendo, e `Am` nao foi tocado.
     */
  const CHORD_RE = new RegExp(
    '^(' + NOTA + ')(' + ACC + '{0,2})((?:o)?' + PECA + '{0,6}'
    + '(?:\\/(?:\\d{1,2}[+-]?|[b#]5))*' + PAREN + FORA + ')'
    + '(?:\\/(' + NOTA + ACC + '{0,2}))?$'
  );

  /* ==========================================================
     O NUCLE DO TOKEN, SEM COMER O PARENTESE DO ACORDE

     Este era o ultimo obstaculo, e ele nao estava no regex: estava no
     tokenizer.

     Toda a deteccao de acorde comeca com `replace(/[)"\]...+$/, "")`, para
     tirar a pontuacao que gruda no acorde — "(Am)" e "Am," sao o mesmo acorde.
     Com `Cm7(5-)`, aquele `replace` arranco o `)` que FECHA o acorde e o
     token virou `Cm7(5-`. O regex, corretamente, nao casou com o parenteese
     desbalanceado; o token deixou de ser acorde; e a linha inteira saiu sem
     transpor. Sem aviso nenhum.

     A correcao e tentar o token INTEIRO antes de tirar pontuacao. Se ele
     casar como esta, ele e' o acorde — e o `)` final pertence a ele. Se nao
     casar, ai sim a pontuacao de borda e' pontuacao, e o caminho antigo
     continua igual. Nenhuma palavra de letra passa a ser acorde: o token
     inteiro so vale quando o proprio `parseChord` reconhece.
     ========================================================== */
  function nucleoDeToken(raw) {
    if (!raw) return '';
    if (parseChord(raw)) return raw;
    const semBorda = String(raw)
      .replace(/^[("'][]+/, '')
      .replace(/[)"'\],.!?;:]+$/, '');
    return semBorda && parseChord(semBorda) ? semBorda : String(raw);
  }
  /** Converte um token de acorde. Retorna null se não for acorde. */
  function parseChord(token) {
    if (token == null) return null;
    const s = String(token).trim();
    /* ORDEM "m7M" (OnSong) — DECISAO DE PRODUTO, MANTIDA DE PROPÓSITO
     *
     * A gramatica nova passou a aceitar `m7M`, porque `m`, `7` e `M` sao tres
     * pecas legadas e o padrao e uma repeticao delas. O que acontece com um
     * acorde assim e' o caminho honesto: fica desconhecido, a fundamental anda
     * e o texto volta como estava — `Cm7M` vira `Dm7M`, e o "M" nao vira maior.
     * Ou seja: o medo que motivou a regra antiga (qualidade desconhecida virar
     * maior) nao acontece.
     *
     * Mesmo assim, este projeto adotou `CmM7` como a grafia de `mM7`, e o
     * `tools/test-acordes.js` registra isso como decisao, nao como acidente.
     * Mudar isso e mudanca de produto: quem escreve `Cm7M` numa cifra para
     * ensaio esta escrevendo do jeito do OnSong, e aceitar a grafia e util.
     * Nao aceito, e nao troco o teste para dar verde. A regra volta aqui, com
     * o conflito anotado: o padrao do Cifra Club (a fonte da missao) lista
     * `Cm7M` como valido, entao esta decisao merece uma conversa com quem
     * decide, e nao uma alteracao silenciosa feita por mim. */
    /* ORDEM "m7M" DO ONSONG — AGORA ACEITA
     *
     * O padrao de cifragem do Cifra Club documenta `Cm7M` como "menor com
     * 7M", os mesmos intervalos de `CmM7`. Havia aqui uma regra que negava
     * a grafia, por decisao de produto antiga; o objetivo do projeto agora e
     * compatibilidade com o Cifra Club, entao ela passa a valer.
     *
     * A conversao e feita ANTES do `toLowerCase`, porque em caixa baixa
     * `m7M` e `m7` viram a mesma coisa e o `M` do maior se perderia. Por isso
     * o `M` e devolvido em maiuscula, que e a chave `mM7` do vocabulario. */
    if (!s || s.length > 24) return null; /* 24 e o limite real: `C7(9/11+/13-)` tem 13 caracteres e o proprio padrao do Cifra Club usa exatamente essa forma. Com 12, o acorde era recusado antes de ser olhado. */
    const m = CHORD_RE.exec(s);
    if (!m) return null;
    const root = pcFromAccidental(m[1].toUpperCase(), m[2]);
    const sufixo = m[3] || '';
    const quality = matchQuality(sufixo);
    /* O baixo vem do regex como um grupo so, letra junto com o acidente. Passar
     * o grupo inteiro como se fosse so a letra fazia a busca na tabela de
     * letras devolver undefined, e o undefined virava NaN na conta. Daí um
     * acorde como "F#/A#" ter o baixo lido como NaN e a cifra impressa sair
     * com a palavra "undefined" no lugar da nota. A letra e o acidente sao
     * separados aqui, como ja era feito com a fundamental. */
    const bass = m[4] ? pcFromAccidental(m[4][0].toUpperCase(), m[4].slice(1)) : null;

    /* =======================================================
       SUFIXO QUE O MOTOR NAO CONHECE

       `matchQuality` devolve vazio em dois casos que nao podem ser confundidos:

         "C"     -> vazio, e tríade maior. É a resposta certa.
         "C69"   -> vazio, e o motor NÃO sabe o que é 69. A resposta seria
                     outra coisa, e não "maior".

       O texto "69" é uma grafia usada de verdade para C6/9, e "C10", "C44" e
       "C4/4" chegam do mesmo jeito: o padrão do regex diz que a forma é de um
       acorde, e a lista de qualidades não tem a entrada. Sem esta distinção,
       o app affirmava uma certeza que não tinha — e o preço era caro, porque
       `transposeLine` reconstrói o nome do acorde a partir da qualidade: o
       "69" sumia e C6/9 virava D maior na hora de transpor.

       Então: a qualidade continua vazia, para não quebrar nenhum consumidor
       que compara com '', mas `conhecido` diz a verdade. Quem reconstrói o
       nome olha este sinal e devolve o texto como estava, movendo só a
       fundamental — que é o que se sabe fazer com honestidade.
       ======================================================= */
    const conhecido = !(sufixo !== '' && quality === '');

    return { root, quality, bass, text: s, sufixo: sufixo, conhecido: conhecido };
  }

  function formatChord(rootPc, quality, bassPc, flat) {
    const q = QUALITIES[QUALITIES[quality] ? quality : ''] || QUALITIES[''];
    let s = noteName(rootPc, flat) + q.label;
    if (bassPc !== null && bassPc !== undefined) s += '/' + noteName(bassPc, flat);
    return s;
  }

  /** Formata um acorde ja parseado, deslocando fundamental e baixo.
   *
   * Este e o caminho que reconstrói o nome do acorde ao transpor, e ele e
   * quem perdia o sufixo: com "C69", a qualidade vinha vazia, `formatChord`
   * escrevia "C", e o 69 sumia. A pessoa escrevia C6/9 e recebia D maior — sem
   * erro, sem aviso, e o acorde errado na hora de tocar.
   *
   * Com sufixo desconhecido, o que se sabe fazer e mover a FUNDAMENTAL e
   * devolver o texto como estava. "C69" vira "D69": o nome segue honesto sobre
   * o que o app não sabe, e o músico continua vendo o acorde que escreveu.
   * Preferi isso a recusar o acorde: recusar faria a linha inteira virar letra,
   * e o sufixo sobreviver intacto é melhor do que o texto sumir. */
  function formatChordTransposed(chord, semis, flat) {
    if (!chord) return '';
    const bass = chord.bass === null || chord.bass === undefined ? null : mod12(chord.bass + semis);
    if (chord.conhecido === false) {
      let s = noteName(mod12(chord.root + semis), flat) + (chord.sufixo || '');
      if (bass !== null) s += '/' + noteName(bass, flat);
      return s;
    }
    return formatChord(mod12(chord.root + semis), chord.quality, bass, flat);
  }

  function chordInfo(rootPc, quality, flat) {
    const key = QUALITIES[quality] ? quality : '';
    const q = QUALITIES[key];
    return {
      name: formatChord(rootPc, key, null, flat),
      notes: q.iv.map((i) => mod12(rootPc + i)),
      labels: q.iv.map((i) => noteName(mod12(rootPc + i), flat)),
      full: q.full,
    };
  }

  /* =======================================================
     3. CIFRA — LINHAS DE ACORDES E TRANSPOSIÇÃO
     ======================================================= */

  /**
   * Palavras da lingua portuguesa que comecam com letra de nota e
   * seriam confundidas com acordes por um parser ingenuo.
   * "Senhor" -> S, "maior" -> M, "nota" -> N, "ai" -> A, "e" -> E...
   */
  const PT_STOPWORDS = new Set([
    'e', 'a', 'o', 'as', 'os', 'da', 'do', 'de', 'em', 'no', 'na', 'nos', 'nas',
    'um', 'uma', 'unos', 'umas', 'me', 'te', 'se', 'que', 'para', 'pra', 'pro',
    'por', 'com', 'sem', 'sob', 'sobre', 'ate', 'e', 'ou', 'mas', 'mais', 'mas',
    'foi', 'era', 'sao', 'sou', 'voce', 'ele', 'ela', 'nos', 'tua', 'teu', 'teus',
    'minha', 'meu', 'nosso', 'nossa', 'dele', 'dela', 'nos', 'eis', 'ai', 'assim',
    'entao', 'ja', 'la', 'aqui', 'ali', 'ele', 'sabe', 'saber', 'pode', 'poder',
    'santo', 'santa', 'santo', 'fazer', 'ha', 'ele', 'nos', 'sua', 'suas', 'tem',
    'ver', 'vai', 'vao', 'sempre', 'sempre', 'senhor', 'senhora', 'maior', 'maior',
    'nota', 'nossa', 'noticia', 'momento', 'minimo', 'amor', 'amigos', 'amiga',
    'ele', 'cada', 'caminho', 'chama', 'chega', 'chega', 'antes', 'anoitecer',
    'sede', 'sede', 'ter', 'sempre', 'santo', 'noite', 'nome', 'nordeste',
    'nascer', 'nasce', 'maneira', 'mil', 'mim', 'muitos', 'muitas', 'mesmo',
    'momento', 'mãe', 'mae', 'mundo', 'muito', 'muitos', 'matar', 'mar',
    'mar', 'maravilhoso', 'maiores', 'mas', 'medo', 'medida', 'melhor',
    'in', 'noite', 'na', 'nas', 'o', 'os', 'ou', 'pa', 'par', 'parte', 'passo',
    'passar', 'pai', 'paz', 'pedra', 'perto', 'pode', 'podem', 'por', 'porque',
    'povo', 'pra', 'pra', 'primeiro', 'proprio', 'proprio', 'pai', 'peito',
    'seguro', 'segunda', 'seja', 'sempre', 'sendo', 'ser', 'sem', 'sempre',
    'setembro', 'silencio', 'sombra', 'sonho', 'sonhos', 'sozinho', 'sol',
    'sua', 'subir', 'superior', 'ta', 'tal', 'tambem', 'tampouco', 'te',
    'tempo', 'tem', 'tempo', 'tento', 'ter', 'terra', 'teu', 'teus', 'teve',
    'tipo', 'to', 'todo', 'todos', 'todas', 'toda', 'tom', 'trabalho', 'trem',
    'tres', 'tudo', 'ultima', 'um', 'uma', 'umas', 'uns', 'vai', 'vao', 'vem',
    'vendo', 'ver', 'verdade', 'vez', 'viu', 'viva', 'viver', 'voce', 'vos',

    // ── Colisoes com nota que faltavam ──
    // Acrescentadas palavra por palavra depois de comparar esta lista com a de
    // outro motor que roda em TypeScript. "ao" e o caso grave: casa com o
    // padrao de acorde como A + o (diminuto), e "Ao Senhor" em uma linha so
    // seria lido como o acorde de La diminuto. As outras sao palavras curtas
    // que o padrao tambem aceita e que, sozinhas na linha, deviam ser letra.
    //
    // "b" ficou de fora de proposito: B e um acorde de verdade, e uma linha de
    // cifra so com "B" e legitima. O risco oposto — uma linha de letra que
    // seja a letra B sozinha — nao acontece em letra de musica.
    'ao', 'aos', 'à', 'às', 'ás', 'das', 'dos', 'é', 'aí', 'lá', 'ai',
    'sol', 'fa', 'mi', 're', 'si', 'dó', 'fá', 'ré', 'ti', 'lá',
  ]);

  /**
   * As unicas palavras da lista que tambem sao acordes de verdade.
   *
   * "a" e artigo, "e" e conjuncao, "em" e preposicao — e ao mesmo tempo A, E e
   * Em, tres dos acordes mais usados do repertorio brasileiro. Nao ha como
   * decidir olhando so o token: a cifra "A / Eu te adoro" usa A como acorde, e
   * uma frase de letra comecada por "E" nao forma uma linha inteira.
   *
   * Sao os tres casos, medidos um a um contra a lista: as demais palavras que
   * casam com o padrao de acorde ("ao", "as", "ai") nao formam acorde, porque
   * a letra depois da nota nao e uma qualidade valida. Este trio e a exceptions
   * que fecha o caso sem afrouxar a protecao para o resto.
   */
  const ACORDES_SOZINHOS = new Set(['a', 'e', 'em']);

  /** True se a palavra (minuscula) e' um acorde legitimo, e nao prosa. */
  function isChordWord(word) {
    if (!word) return false;
    const w = word.toLowerCase();
    if (PT_STOPWORDS.has(w)) return false;
    return !!parseChord(word);
  }

  /**
   * Divide uma linha em blocos: {type:'chord'|'text', v}
   * Um token so vira acorde se: (a) casa com a forma de acorde,
   * (b) esta' separado por espaco/pipe/barramento nas pontas, e
   * (c) NAO e' uma palavra comum em portugues.
   */
  /** Reconhece um token como acorde ignorando a lista de palavras PT. */
  function looksLikeChord(tok) {
    return !!parseChord(tok);
  }

  /**
   * Tokeniza reconhecendo acordes com mais folga dentro de linhas
   * que JA sao de acordes. Numa linha como "A       E", as letras
   * soltas sao acordes (a lista de palavras PT so vale para
   * decidir se a linha e' de letra).
   */
  function tokenizeLine(line, chordContext) {
    const toks = [];
    // O espaco entre os acordes FAZ PARTE da cifra: e ele que alinha o
    // acordo com a silaba da letra abaixo. Um padrao /\S+/ — que so casa
    // trechos sem espaco — descarta esse alinhamento, e a linha inteira
    // colapsa para "C G". O desenho deixa de ser legivel: o acorde para de
    // dizer qual palavra ele cobre.
    //
    // A transposicao nunca teve o problema, porque `transposeLine` reconstroi
    // o espacamento por conta propria. Era so a exibicao que perdia.
    const re = /\s+|\S+/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const raw = m[0];
      // Espaco em branco e um token de texto, e nada mais. Sem este ramo o
      // bloco de baixo tentaria interpretar "   " como acorde.
      if (!/\S/.test(raw)) {
        toks.push({ type: 'text', v: raw, espaco: true });
        continue;
      }
      // 1) o token inteiro ja e' um acorde? (ex.: "C/G", "Bbmaj7/D", "Am")
      const whole = nucleoDeToken(raw);
      if (whole && (isChordWord(whole) || (chordContext && looksLikeChord(whole)))) {
        toks.push({ type: 'chord', v: raw, chord: parseChord(whole) });
        continue;
      }
      // 2) caso contrario, quebra por pipes/barras de compasso e tenta cada parte
      const parts = raw.split(/([|;,])/);
      let buf = '';
      for (const p of parts) {
        if (/^[|;,]$/.test(p)) {
          if (buf) { toks.push(mkTok(buf)); buf = ''; }
          toks.push({ type: 'text', v: p });
        } else {
          buf += p;
        }
      }
      if (buf) toks.push(mkTok(buf));
    }
    function mkTok(word) {
      const core = word.replace(/^[("'[]+/, '').replace(/[)"'\],.!?;:]+$/, '');
      if (core && (isChordWord(core) || (chordContext && looksLikeChord(core)))) {
        return { type: 'chord', v: word, chord: parseChord(core) };
      }
      return { type: 'text', v: word };
    }
    return toks;
  }

  /**
   * Uma linha e' "de acordes" quando contem >= 2 acordes isolados e
   * a maioria dos tokens nao-espaco sao acordes. Isso evita que uma
   * frase de letra com palavras como "ai" ou "e" seja confundida.
   */
  function isChordLine(line) {
    if (!line || !line.trim()) return false;
    const toks = tokenizeLine(line, true).filter((t) => t.v.trim() !== '');
    if (!toks.length) return false;
    const chords = toks.filter((t) => t.type === 'chord');
    if (chords.length < 2) {
      // Quem canta escreve um acorde por vez, cada um na sua linha. Exigir
      // dois descartava esse formato inteiro, e o efeito era o pior possivel:
      // a musica nao transpunha e saia no tom original, sem aviso nenhum.
      //
      // A pergunta que separa as duas coisas nao e "quantos acordes tem", e
      // "ha palavra de verdade na linha". Por isso a linha e reconferida na
      // passada restritiva, onde palavra que colide com nota (a, e, do) conta
      // como letra. Linha so com "A" e artigo; linha so com "C" e o acorde.
      if (chords.length !== 1 || toks.length !== 1) return false;
      const restritiva = tokenizeLine(line, false).filter((t) => t.v.trim() !== '');
      if (restritiva.length !== 1 || restritiva[0].type !== 'chord') {
        // Ultimo caso: o token e palavra e acorde ao mesmo tempo (A, E, Em).
        const unico = toks[0].v
          .replace(/^[("'[]+/, '')
          .replace(/[)"'\],.!?;:]+$/, '')
          .toLowerCase();
        if (!ACORDES_SOZINHOS.has(unico) || !parseChord(unico)) return false;
      }
    }
    return chords.length >= Math.ceil(toks.length * 0.6);
  }

  /** Detecta secao entre colchetes: [Verso 1], [C], [Intro] */
  function isSectionLine(line) {
    const t = line.trim();
    if (!t) return false;
    return /^\[.*\]$/.test(t) || /^=+\s*\S+.*$/.test(t) || /^_{3,}$/.test(t);
  }
  function sectionLabel(line) {
    const t = line.trim();
    const m = /^\[(.*)\]$/.exec(t);
    if (m) return m[1];
    const m2 = /^=+\s*(.*?)\s*=*$/.exec(t);
    if (m2) return m2[1];
    return t.replace(/^_+$/, '');
  }
  /** Diretiva de tom entre colchetes: [C], [Am], [F#m] */
  function keyDirective(line) {
    const t = line.trim();
    const m = /^\[([^\]]{1,6})\]$/.exec(t);
    if (!m) return null;
    const c = parseChord(m[1]);
    /* Um titulo de tom que o motor não entende não vira tom maior. "[C999]"
     * é lixo digitado, e tratar como Do maior faria a cifra inteira ser
     * transposta a partir de um tom inventado. Sem tom, a linha é só linha. */
    if (c && c.conhecido === false) return null;
    return c;
  }

  /**
 * Meios semitons nao existem como nota.
 *
 * 0,5 semitom e um quarto de tom, e nenhum nome de acorde o representa: nao ha
 * letra para ele. Sem arredondar, `mod12(9 + 3.5)` devolveria 0.5 e
 * `noteName(0.5)` nao saberia o que escrever — a saida viraria "undefined" no
 * meio da cifra, que e o pior defeito possivel num app de cifras: silencioso.
 *
 * Entao o motor arredonda para a nota mais proxima, e quem pediu o meio
 * semitom recebe de volta os cents exatos do desvio, para poder afinar o
 * instrumento no tom certo.
 */
function arredondarSemitons(semis) {
  const n = Number(semis);
  if (!isFinite(n)) return 0;
  return Math.round(n);
}

/**
 * Os cents do meio semitom pedido: 50 para 0,5, -50 para -0,5.
 *
 * A parte fracionaria e medida contra o inteiro TRUNCADO, nao arredondado.
 * Importa porque o arredondamento e o que decide a nota final: pedindo +3,5
 * o app entrega +4, e a nota que vai soar esta 50 cents acima do +3 que se
 * esperava. Truncar devolve +50 — "meio semitom acima do inteiro" — que e a
 * leitura de quem esta afinando, e nao a conta interna do motor.
 */
function centsDeDesvio(semis) {
  const n = Number(semis);
  if (!isFinite(n)) return 0;
  const frac = n - Math.trunc(n);
  // Acima de meio semitom, o inteiro mais proximo ja e o seguinte, e o sinal
  // inverte: 0,7 arredonda para 1, que esta 30 cents ACIMA do pedido. Sem
  // esta virada, -0,9 passaria de 50 cents — e um desvio de 90 cents nao
  // existe.
  if (frac > 0.5) return Math.round((frac - 1) * 100);
  if (frac < -0.5) return Math.round((frac + 1) * 100);
  return Math.round(frac * 100);
}

/* =======================================================
   1b. ROTEIRO DE ROLAGEM
   =======================================================
   O roteiro da rolagem automatica: quais linhas a cifra atravessa, e quanto
   tempo a rolagem para em cada uma.

   O que separa um scroll que funciona de um scroll inutil e a DURACAO de cada
   parada. Rolar a velocidade constante da a sensacao de um texto passando, e o
   musico nao sabe quando mudar de acorde. Parar em cada linha de acordes e
   pular as estruturais rapido e o que faz a tela virar partitura.

   E um chute honesto: uma cifra nao tem partitura ritmica, entao nao ha como
   saber quando a musica realmente vira. O app estima pelo andamento e deixa
   a pessoa corrigir com o controle de velocidade — e a estimativa e
   declarada como estimativa, nao vendida como sincronizacao. */

const TIPO_LINHA = { ACORDE: 'acorde', SECAO: 'secao', VAZIA: 'vazia', LETRA: 'letra' };

/**
 * Constroi o roteiro.
 *
 * `fator` e a correcao manual de velocidade: 1 e o andamento declarado, 2 e o
 * dobro do tempo. `bpm` e `compasso` sao os da musica, quando existem.
 */
function roteiroDeRolagem(cifra, opts) {
  opts = opts || {};
  const bpmBruto = parseInt(opts.bpm, 10);
  const bpm = isFinite(bpmBruto) && bpmBruto >= 30 && bpmBruto <= 300 ? bpmBruto : 96;
  const compasso = String(opts.compasso || '4/4');
  const partes = compasso.split('/');
  const numBruto = parseInt(partes[0], 10);
  const numerador = isFinite(numBruto) && numBruto >= 1 && numBruto <= 12 ? numBruto : 4;
  const fBruto = Number(opts.fator);
  const fator = isFinite(fBruto) && fBruto > 0 ? fBruto : 1;

  const msPorBatida = 60000 / bpm;
  // Meia barra por linha de acordes: em 4/4 a 120 bpm dá 1 s por linha, que e
  // a densidade media de uma linha de cifra cantada. E um meio-tempo, nao um
  // compasso inteiro — compasso inteiro passaria dev demais para quem esta
  // aprendendo o texto.
  const msCheia = msPorBatida * (numerador / 2) * fator;

  const linhas = String(cifra == null ? '' : cifra).replace(/\r\n?/g, '\n').split('\n');
  const roteiro = [];
  for (let i = 0; i < linhas.length; i++) {
    const ln = linhas[i];
    let tipo;
    if (!ln.trim()) tipo = TIPO_LINHA.VAZIA;
    // A secao vem ANTES da linha de acordes, e a ordem importa. Uma linha
    // entre colchetes e cabecalho, nunca fila de acordes — mas "[C]" passa
    // nas duas verificacoes, porque "C" esta na lista de acordes sozinhos e
    // `isChordLine` nao olha os colchetes. Testando o acorde primeiro, o
    // titulo de tom virava uma parada de meio compasso, e a rolagem gastava
    // um tempo inteiro parado no "[C]" do topo.
    else if (isSectionLine(ln)) tipo = TIPO_LINHA.SECAO;
    else if (isChordLine(ln)) tipo = TIPO_LINHA.ACORDE;
    else tipo = TIPO_LINHA.LETRA;

    // Uma secao ou um respiro nao e uma mudanca de acorde: passa rapido por
    // cima, senao o silencio entre os versos vira uma parada longa e o
    // musico perde o compasso.
    const ms = tipo === TIPO_LINHA.ACORDE ? msCheia
      : tipo === TIPO_LINHA.LETRA ? msCheia * 0.75
        : msCheia * 0.4;

    roteiro.push({ indice: i, tipo: tipo, ms: Math.max(120, Math.round(ms)) });
  }
  return {
    bpm: bpm,
    compasso: compasso,
    numerador: numerador,
    fator: fator,
    msPorBatida: msPorBatida,
    msCheia: Math.max(120, Math.round(msCheia)),
    linhas: roteiro,
    // So as linhas de acordes mudam de acorde: e o que a barra de progresso
    // conta, e o que o botao de pular usa.
    totalAcordes: roteiro.filter((r) => r.tipo === TIPO_LINHA.ACORDE).length,
    duracaoMs: roteiro.reduce((s, r) => s + r.ms, 0),
  };
}

/* =======================================================
   1c. TRECHOS DA CIFRA
   =======================================================
   Estudar cifra e decorar pedaco por pedaco. Para isso o app precisa saber
   onde acaba um verso e comeca o outro — e a informacao ja esta na propria
   cifra, nas linhas entre colchetes. Descobrir na hora, contando linhas na
   mao, seria erro garantido, e um trecho errado esconde a musica errada. */

const SEM_TITULO = 'Inicio';

/**
 * Divide a cifra em trechos, um por secao.
 *
 * O trecho sem titulo existe porque muita cifra comeca direto no acorde, sem
 * "[Intro]" — e essas linhas precisam entrar em algum lugar. O nome usado e a
 * diretiva de tom quando ela existe (`[C]`, `[Am]`), que e exatamente a
 * informacao que o musician le na primeira linha; sem diretiva, um rotulo
 * neutro.
 *
 * Uma secao imediatamente seguida de outra produz um trecho vazio, e isso e
 * mantido de proposito: se o app escondesse o titulo do segundo verso junto
 * com o primeiro, a pessoa veria "[Refrao] [Refrao 2]" fundidos e nao saberia
 * qual estava vendo.
 */
function blocosDeCifra(cifra) {
  const linhas = String(cifra == null ? '' : cifra).replace(/\r\n?/g, '\n').split('\n');
  if (!linhas.some((l) => l.trim())) return [];

  const blocos = [];
  let atual = null;

  function abrir(titulo, semTitulo, indice) {
    atual = {
      titulo: titulo,
      semTitulo: semTitulo,
      indice: indice,
      linhaInicio: indice,
      linhaFim: indice,
      nLinhas: 0,
    };
    blocos.push(atual);
    return atual;
  }

  for (let i = 0; i < linhas.length; i++) {
    const ln = linhas[i];
    if (isSectionLine(ln)) {
      // O titulo e o miolo dos colchetes, com os espacos de fora aparados.
      // A diretiva de tom ([C], [Am]) tambem passa por secao, e serve de nome.
      const titulo = sectionLabel(ln).trim() || SEM_TITULO;
      abrir(titulo, false, i);
      continue;
    }
    if (!atual) {
      // Primeira linha com conteudo, ainda sem titulo: procura a diretiva de
      // tom mais abaixo para dar um nome de verdade a esse trecho.
      let nome = SEM_TITULO;
      for (let j = i; j < linhas.length; j++) {
        const kd = keyDirective(linhas[j]);
        if (kd) { nome = kd.text; break; }
        if (isSectionLine(linhas[j])) break;
      }
      abrir(nome, true, i);
    }
    atual.linhaFim = i;
    atual.nLinhas++;
  }
  return blocos;
}

/**
 * A linha sem letra: so as colunas de acordes, no lugar original.
 *
 * Descascar a letra e diferente de apagar a linha. "Am    F  em nenhum dia"
 * passa em `isChordLine` — tem dois acordes, e a regra so conta os — entao um
 * filtro que apenas descarta "linhas que nao sao de acordes" mantem a letra
 * inteira, que e o oposto do que se pediu.
 *
 * O detalhe que faz isso funcionar e a capitalizacao. Em contexto de acordes
 * qualquer fragmento vira acorde: "em" vira Em menor, "e" vira Mi, "ai" vira
 * La com susteno. E por isso que `isChordLine` precisa de uma segunda passada
 * restritiva. Aqui a regra e mais simples e mais confiavel: **acorde se
 * escreve com letra maiuscula, palavra em portugues se escreve minuscula**.
 * "Em" e o acorde; "em" e a preposicao.
 *
 * Devolve null quando sobra nenhum acorde: ai a linha era letra. Os espacos
 * entre os tokens sao preservados de proposito — sem eles as colunas
 * colapsam, que foi o defeito que a tokenizacao tinha.
 */
function apenasAcordes(linha) {
  const toks = tokenizeLine(linha, true);
  const partes = [];
  let nAcordes = 0;
  for (const t of toks) {
    if (t.espaco) { partes.push(t.v); continue; }
    if (t.type !== 'chord') continue;
    // A pontuacao em volta do acorde nao conta: "[C]", "(Am)" e "Am" sao o
    // mesmo acorde. O que decide e a primeira letra do miolo.
    const miolo = String(t.v).replace(/^[("'[]+/, '');
    if (!/^[A-Z]/.test(miolo)) continue;
    nAcordes++;
    partes.push(t.v);
  }
  return nAcordes ? partes.join('') : null;
}

/** Transpoe UMA linha de texto, trocando so os tokens de acorde. */
  function transposeLine(line, semis, flat, emLinhaDeAcordes) {
    if (!line) return line;
    semis = arredondarSemitons(semis);
    const kd = keyDirective(line);
    if (kd) return '[' + formatChord(mod12(kd.root + semis), kd.quality, null, flat) + ']';

    // Numa linha que ja foi reconhecida como linha de acordes, todo token que
    // e um acorde vale como acorde, e a lista de palavras nao entra.
    //
    // Sem isto, A, E e Em ficavam parados a cada transposicao — sao palavra em
    // portugues, mas tambem tres dos acordes mais usados — e a progressao
    // saia errada sem nenhum aviso:
    //
    //     Em  C  G  D   +2  ->  Em  D  A  E
    //     A   E  D       +2  ->  A   E  E
    //
    // A decisao de "esta linha e de acordes" ja foi tomada com a linha inteira
    // a vista. Reavaliar token por token aqui e jogar fora essa decisao.
    const eAcorde = emLinhaDeAcordes
      ? function (t) { return !!parseChord(t); }
      : isChordWord;

    // percorre os mesmos tokens, reconstruindo a linha
    const re = /\S+/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      out += line.slice(last, m.index);
      const raw = m[0];
      // o token inteiro e' um acorde? (preserva o baixo em "C/G")
      const whole = nucleoDeToken(raw);
      if (whole && eAcorde(whole)) {
        const c = parseChord(whole);
        out += raw.replace(whole, formatChordTransposed(c, semis, flat));
      } else {
        // caso contrario, quebra por pipes/barras de compasso
        out += raw.split(/([|;,])/).map((seg) => {
          if (/^[|;,]$/.test(seg)) return seg;
          const core = seg.replace(/^[("'[]+/, '').replace(/[)"'\],.!?;:]+$/, '');
          if (core && eAcorde(core)) {
            return seg.replace(core, formatChordTransposed(parseChord(core), semis, flat));
          }
          return seg;
        }).join('');
      }
      last = m.index + raw.length;
    }
    out += line.slice(last);
    return out;
  }

  /**
   * Transpõe uma cifra inteira.
   * Regras:
   *  - Linhas entre colchetes ([C], [Verso 1]) são preservadas;
   *    diretivas de tom são transpostas.
   *  - Linhas de acordes (>=2 acordes) são transpostas integralmente.
   *  - Demais linhas (letra) NÃO são tocadas, exceto acordes isolados
   *    que claramente formam progressão (>=2 acordes na linha).
   */
  function transposeCifra(text, semis, flat) {
    semis = arredondarSemitons(semis);
    if (!semis) return String(text == null ? '' : text);
    /* Default para flat: se não informado, usa preferência do tom de destino */
    if (flat === undefined) flat = useFlatsFor(mod12(semis));
    return String(text == null ? '' : text)
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => {
        if (!line.trim()) return line;
        if (isSectionLine(line) && !isChordLine(line)) return line;
        if (isChordLine(line)) return transposeLine(line, semis, flat, true);
        // linha mista: só troca se contiver >= 2 acordes
        const count = tokenizeLine(line).filter((t) => t.type === 'chord').length;
        if (count >= 2) return transposeLine(line, semis, flat);
        return line;
      })
      .join('\n');
  }

  /* =======================================================
     TRANSPOSICAO POR GRAU
     ======================================================= */

  // Semitons acima da tonica, por grau, em maior e menor.
  const GRAUS_MAIOR = [0, 2, 4, 5, 7, 9, 11];
  const GRAUS_MENOR = [0, 2, 3, 5, 7, 8, 11];

  // Tríade que se forma em cada grau, na grafia que se imprime. Maior nao leva
  // sufixo: ninguem escreve "Cmaj" numa cifra.
  const QUALIDADE_POR_GRAU_MAIOR = ['', 'm', 'm', '', '', 'm', 'dim'];
  const QUALIDADE_POR_GRAU_MENOR = ['m', 'dim', '', 'm', 'm', '', ''];

  /**
   * Em que grau da escala esta uma fundamental, ou -1 se nao pertence.
   *
   * A dominante conta como o mesmo grau, e a quinta abaixo tambem. Sem isso, uma
   * progressao que cai na dominante de repente vira "nao diatonica" e o acorde
   * perde a funcao que cumpre.
   */
  function grauDe(pc, tonica, modo) {
    const graus = modo === 'minor' ? GRAUS_MENOR : GRAUS_MAIOR;
    for (let i = 0; i < 7; i++) if (mod12(tonica + graus[i]) === pc) return i;
    for (let i = 0; i < 7; i++) {
      const deste = mod12(tonica + graus[i]);
      if (deste === mod12(pc + 7) || deste === mod12(pc - 5)) return i;
    }
    return -1;
  }

  function transposeLinePorGrau(line, origemPc, origemModo, destinoPc, destinoModo, reserva) {
    if (!line) return line;
    const kd = keyDirective(line);
    if (kd) {
      // A diretiva de tom vira o tom de destino pedido.
      const pref = useFlatsFor(destinoModo === 'minor' ? mod12(destinoPc + 3) : destinoPc);
      return '[' + formatChord(destinoPc, destinoModo === 'minor' ? 'm' : '', null, pref) + ']';
    }
    if (!isChordLine(line)) return line;

    const graus = destinoModo === 'minor' ? GRAUS_MENOR : GRAUS_MAIOR;
    const qualidades = destinoModo === 'minor' ? QUALIDADE_POR_GRAU_MENOR : QUALIDADE_POR_GRAU_MAIOR;
    // A armadura e do tom, e nao da tonica sozinha. Re menor tem um bemol,
    // enquanto Re maior nao tem nenhum: deciding so pela tonica, o sexto grau
    // de Re menor saia "A#" em vez de "Bb", que e como o musico le a cifra.
    // O relativo maior de uma menor esta tres semitons acima, e e ele que
    // carrega a mesma armadura.
    const pref = useFlatsFor(destinoModo === 'minor' ? mod12(destinoPc + 3) : destinoPc);

    const trocar = function (raw) {
      const core = nucleoDeToken(raw);
      if (!core) return raw;
      const c = parseChord(core);
      if (!c) return raw;

      /* Sufixo que o motor não conhece não pode ser "harmonizado" nem
       * "rebatido" como um acorde conhecido: os dois caminhos de baixo
       * reconstruem o nome a partir da qualidade, e o texto se perde. Um
       * "C69" passaria a ser D maior, que é outro acorde e soa outro.
       *
       * O caminho honesto é o ultimo dos tres — o que desloca a fundamental e
       * devolve o texto como estava. Ele já existe e já foi corrigido; aqui
       * basta não contorná-lo. */
      if (c.conhecido === false) {
        return raw.replace(core, formatChordTransposed(c, reserva, pref));
      }

      const indice = grauDe(c.root, origemPc, origemModo);
      let novo;

      if (indice >= 0) {
        // Diatonico na origem: o grau e transportado, e a qualidade vem do
        // grau de destino, para o acorde fazer sentido na nova tonalidade.
        // O terceiro grau de La menor e menor, e nao maior.
        // O baixo viaja pelo mesmo intervalo, e e o que preserva a inversao:
        // C/G em Do maior vira G/D em Sol maior, com a quinta no baixo nos dois.
        const novoRoot = mod12(destinoPc + graus[indice]);
        const temBaixo = c.bass !== null && c.bass !== undefined;
        const baixo = temBaixo ? mod12(c.bass + semitonsEntre(c.root, novoRoot)) : null;
        novo = formatChord(novoRoot, qualidades[indice], baixo, pref);
      } else if (grauDe(c.root, destinoPc, destinoModo) >= 0) {
        // Nao e diatonico na origem, mas e na de destino. E o caso do F#7:
        // emprestado em Do maior e sexto grau legitimo em Sol maior.
        // Transportar por semitons viraria C#7 e jogaria fora a funcao.
        // Aqui a fundamental e a qualidade ficam como o musico escreveu.
        novo = formatChord(c.root, c.quality, c.bass, pref);
      } else {
        // Estrangeiro dos dois lados: desloca e mantem a qualidade escrita.
        novo = formatChordTransposed(c, reserva, pref);
      }
      return raw.replace(core, novo);
    };

    const re = /\S+/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      out += line.slice(last, m.index);
      const raw = m[0];
      out += raw.split(/([|;,])/).map((seg) => {
        if (/^[|;,]$/.test(seg)) return seg;
        return trocar(seg);
      }).join('');
      last = m.index + raw.length;
    }
    return out + line.slice(last);
  }

  /** Quantos semitons separam duas alturas, pelo caminho mais curto. */
  function semitonsEntre(de, para) {
    const bruto = mod12(para - de);
    return bruto > 6 ? bruto - 12 : bruto;
  }

  /**
   * Transpoe reatribuindo os graus, e nao aplicando um numero fixo de semitons.
   *
   * Isto so importa quando origem e destino tem modos diferentes ou estao a
   * mais de uma quinta de distancia — e e o caso comum: levar uma musica de
   * Do maior para La menor.
   *
   * A razao e que duas tonalidades com a mesma armadura NAO sao transposicao
   * uma da outra. De Do maior para La menor, um deslocamento fixo de 9
   * semitons leva o acorde de Do para La, mas leva o Am de Do para F#, e o
   * certo em La menor e C. Nao existe numero de semitons que acerte os dois,
   * porque os graus nao coincidem. So a reatribuicao acerta.
   */
  function transposeCifraPorGrau(text, destinoPc, destinoModo) {
    const bruto = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
    if (!bruto.trim()) return bruto;
    const origem = detectKey(bruto);
    const destino = mod12(destinoPc);
    if (semitonsEntre(origem.pc, destino) === 0 && origem.mode === (destinoModo || 'major')) {
      return bruto;
    }
    const reserva = semitonsEntre(origem.pc, destino);
    return bruto
      .split('\n')
      .map(function (linha) {
        if (!linha.trim()) return linha;
        if (isSectionLine(linha) && !isChordLine(linha)) return linha;
        return transposeLinePorGrau(linha, origem.pc, origem.mode, destino, destinoModo || 'major', reserva);
      })
      .join('\n');
  }

  /** Acordes em progressão: [{text, root, quality, count}] */
  function extractChords(cifra) {
    const lines = String(cifra || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      if (isSectionLine(line) && !isChordLine(line)) continue;
      // dentro de uma linha de acordes, ate letras soltas valem
      const ctx = isChordLine(line);
      for (const t of tokenizeLine(line, ctx)) {
        if (t.type !== 'chord') continue;
        out.push({
          text: t.v,
          root: t.chord.root,
          quality: t.chord.quality,
          bass: t.chord.bass,
        });
      }
    }
    return out;
  }

  /* =======================================================
     PERFIS TONAIS (Krumhansl-Schmuckler) + refinamento
     ======================================================= */
  // Perfil de alvo: peso de cada grau da escala (tonica = 1.0)
  const KS_MAJOR = [1.00, 0.42, 0.45, 0.51, 0.53, 0.32, 0.21];
  const KS_MINOR = [1.00, 0.50, 0.34, 0.48, 0.58, 0.30, 0.38];
  // Correlacao de Pearson
  function pearson(a, b) {
    const n = a.length;
    let sa = 0, sb = 0;
    for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
    const ma = sa / n, mb = sb / n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
      const x = a[i] - ma, y = b[i] - mb;
      num += x * y; da += x * x; db += y * y;
    }
    const den = Math.sqrt(da * db);
    return den ? num / den : 0;
  }
  // histogramas de altura relativa a uma tonica candidata
  function profileFor(chords, tonicPc, mode) {
    const hist = new Array(12).fill(0);
    for (const c of chords) {
      const q = QUALITIES[QUALITIES[c.quality] ? c.quality : ''];
      // tríades pesam 1.0; acordes com 7ª/9ª pesam um pouco menos
      const w = q.iv.length <= 3 ? 1 : 0.7;
      // fundamental
      hist[mod12(c.root - tonicPc)] += w;
      // 3a: evidencia de modo maior ou menor
      hist[mod12(c.root - tonicPc + q.iv[1])] += w * 0.8;
      // 5ª
      hist[mod12(c.root - tonicPc + q.iv[2])] += w * 0.7;
      if (q.iv.length >= 4) hist[mod12(c.root - tonicPc + q.iv[3])] += w * 0.5;
    }
    // alinha ao perfil do modo: índice i da escala => intervalo iv[i]
    const iv = SCALES[mode].iv;
    const target = iv.map((d) => (mode === 'major' ? KS_MAJOR : KS_MINOR)[iv.indexOf(d)]);
    return { hist, target, iv };
  }

  const _keyCache = new Map();
  /**
   * Detecta o tom (pc + modo) de uma cifra combinando:
   *  1) correlação com o perfil tonal de cada um dos 24 tons
   *  2) bônus se tônica/dominante/subdominante aparecem como fundamentais
   *  3) preferência pela tônica declarada entre colchetes ([C], [Am])
   */
  function detectKey(cifra) {
    if (!cifra) return null;
    if (_keyCache.has(cifra)) return _keyCache.get(cifra);

    const chords = extractChords(cifra);
    if (!chords.length) { _keyCache.set(cifra, null); return null; }

    // tom declarado explicitamente entre colchetes: [C], [Am], [F#m]
    let declared = null;
    const lines = String(cifra).replace(/\r\n?/g, '\n').split('\n');
    for (const ln of lines) {
      const m = /^\s*\[([^\]]{1,6})\]\s*$/.exec(ln);
      if (!m) continue;
      const c = parseChord(m[1]);
      // so conta se for mesmo uma referencia de tom (ex.: [C], [Am])
      if (c && QUALITIES[QUALITIES[c.quality] ? c.quality : ''].iv.length <= 4) {
        declared = c;
        break;
      }
    }
    const declaredMode = declared && declared.quality === 'm' ? 'minor' : 'major';

    let best = null, bestScore = -Infinity;
    for (let pc = 0; pc < 12; pc++) {
      for (const mode of ['major', 'minor']) {
        const { hist, iv, target } = profileFor(chords, pc, mode);
        // correlaciona o histograma (12 posições) contra o perfil (7 graus)
        const corrHist = [];
        const corrTgt = [];
        for (let d = 0; d < 12; d++) {
          const idx = iv.indexOf(d);
          corrHist.push(hist[d]);
          corrTgt.push(idx >= 0 ? target[idx] : 0);
        }
        let score = pearson(corrHist, corrTgt) * 100;

        // bônus estrutural
        for (const c of chords) {
          const d = mod12(c.root - pc);
          const idx = iv.indexOf(d);
          if (idx === 0) score += 3;                 // tônica
          else if (idx === 4) score += 2.2;           // dominante
          else if (idx === 3) score += 1.6;           // subdominante
          else if (idx === 5) score += 1.0;           // relativo
          else if (idx === 6) score += 0.7;
          else if (idx === 1) score += (mode === 'minor' ? 0.8 : -0.8); // bII
          else score -= 2.2;                          // fora da escala
        }
        // 3a menor presente + tonica como fundamental = evidencia de menor
        if (mode === 'minor') {
          const hasTonicChord = chords.some((c) => c.root === pc);
          if (!hasTonicChord) score -= 1.5;
        }
        // tom declarado entre colchetes ([C], [Am]) e' autoritativo:
        // quem escreve a cifra sabe melhor do que o palpite estatistico.
        if (declared) {
          if (declared.root !== pc) continue;
          score += declaredMode === mode ? 1000 : -1000;
        }
        if (score > bestScore) { bestScore = score; best = { pc, mode }; }
      }
    }
    const res = best ? { pc: best.pc, mode: best.mode, score: Math.round(bestScore * 10) / 10 } : null;
    _keyCache.set(cifra, res);
    return res;
  }

  /** Análise de graus romanos de uma sequência de acordes. */
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  /**
   * Análise de graus romanos de uma sequência de acordes.
   * A posição do grau vem da escala; a CAIXA vem da qualidade real
   * do acorde tocado (maior = maiúscula, menor = minúscula), que é
   * como a análise romano-numérica funciona na prática.
   * Exceção: em modo menor, uma tríade maior sobre o 5º grau é
   * rotulada "V" (dominante harmônica), que e' como se lê na prática.
   */
  function analyzeChords(chordList, keyPc, scaleKey) {
    const sc = SCALES[scaleKey] || SCALES.major;
    const scaleIv = sc.iv;
    const n = scaleIv.length;
    const isMinorMode = scaleKey === 'minor' || scaleKey === 'harmonic' || scaleKey === 'melodic';
    const flat = useFlatsFor(keyPc);

    return chordList.map((c) => {
      const rootPc = typeof c === 'number' ? c : c.root;
      const quality = typeof c === 'number' ? '' : (c.quality || '');
      const q = QUALITIES[QUALITIES[quality] ? quality : ''];

      // ---- grau na escala ----
      const diff = mod12(rootPc - keyPc);
      let bestI = 0, bestD = 0, bestAbs = 99;

      // a grafia do acorde decide como ler um acorde "meio tom fora":
      // Db se le como bemol do II, F# como sustenido do IV.
      const txt = (typeof c === 'number' || !c.text) ? '' : String(c.text);
      const nSharp = (txt.match(/#/g) || []).length;
      const nFlat = (txt.match(/b/g) || []).length;
      const preferFlat = nFlat >= nSharp;

      // 1) casamento exato
      let exact = -1;
      for (let i = 0; i < n; i++) {
        if (scaleIv[i] === diff) { exact = i; break; }
      }
      if (exact >= 0) {
        bestI = exact; bestD = 0; bestAbs = 0;
      } else {
        // 2) candidatos a meio tom
        const cands = [];
        for (let i = 0; i < n; i++) {
          let d = mod12(diff - scaleIv[i]);
          if (d > 6) d -= 12;
          cands.push({ i, d, abs: Math.abs(d) });
        }
        const minAbs = Math.min.apply(null, cands.map((x) => x.abs));
        const tied = cands.filter((x) => x.abs === minAbs);
        let pick = tied[0];
        if (tied.length > 1) {
          // entre os candidatos empatados, respeita a grafia
          pick = preferFlat
            ? (tied.filter((x) => x.d === -1)[0] || tied[0])
            : (tied.filter((x) => x.d === 1)[0] || tied[0]);
        }
        bestI = pick.i; bestD = pick.d; bestAbs = pick.abs;
      }

      // numeral do grau + alteracao
      let numeral = n === 7 ? ROMAN[bestI] : String(bestI + 1);
      if (bestD === 1) numeral = '\u266F' + numeral;
      else if (bestD === -1) numeral = '\u266D' + numeral;

      // qualidade real do acorde -> caixa e sufixo
      const isMinorChord = q.iv[1] !== undefined && mod12(q.iv[1]) === 3;
      const isDimChord = mod12(q.iv[1]) === 3 && mod12(q.iv[2]) === 6;
      const isAugChord = mod12(q.iv[2]) === 8;
      const has7 = q.iv.length >= 4;
      const seventhIc = has7 ? mod12(q.iv[3]) : null;
      const isHalfDim = isDimChord && seventhIc === 10;

      let label;
      if (isDimChord) {
        label = numeral.toLowerCase() + (isHalfDim ? '\u00F8' : (has7 ? '\u00B07' : '\u00B0'));
      } else if (isMinorChord) {
        label = numeral.toLowerCase() + (has7 ? (seventhIc === 11 ? 'mMaj7' : 'm7') : '');
      } else if (isAugChord) {
        label = numeral + (has7 ? '+7' : '+');
      } else {
        // dominante harmonica em tom menor
        if (isMinorMode && n === 7 && bestI === 4 && bestD === 0) {
          label = 'V' + (has7 ? (seventhIc === 10 ? '7' : seventhIc === 11 ? 'maj7' : '7') : '');
        } else {
          label = numeral + (has7 ? (seventhIc === 10 ? '7' : seventhIc === 11 ? 'maj7' : '7') : '');
        }
      }

      return {
        root: rootPc,
        degree: label,
        triad: triadFor(scaleIv, bestI),
        chordName: formatChord(rootPc, quality || '', null, flat),
        scaleRoot: mod12(keyPc + scaleIv[bestI]),
        outOfScale: bestAbs > 0,
      };
    });
  }

  /* =======================================================
     4. ESCALAS
     ======================================================= */
  const SCALES = {
    major:      { iv: [0, 2, 4, 5, 7, 9, 11],    name: 'Maior (Jônio)',            short: 'Maior',   degrees: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] },
    minor:      { iv: [0, 2, 3, 5, 7, 8, 10],    name: 'Menor natural (Eólio)',    short: 'Menor',   degrees: ['i', 'ii', 'III', 'iv', 'v', 'VI', 'VII'] },
    harmonic:   { iv: [0, 2, 3, 5, 7, 8, 11],    name: 'Menor harmônica',           short: 'Harmônica', degrees: ['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°'] },
    melodic:    { iv: [0, 2, 3, 5, 7, 9, 11],    name: 'Menor melódica (asc.)',     short: 'Melódica',  degrees: ['i', 'ii', 'III+', 'IV', 'V', 'VI', 'vii°'] },
    dorian:     { iv: [0, 2, 3, 5, 7, 9, 10],    name: 'Dórico',                    short: 'Dórico',   degrees: ['I', 'II', 'III', 'IV', 'V', 'vi', 'vii'] },
    phrygian:   { iv: [0, 1, 3, 5, 7, 8, 10],    name: 'Frígio',                    short: 'Frígio',   degrees: ['i', 'II', 'III', 'iv', 'v°', 'VI', 'vii'] },
    lydian:     { iv: [0, 2, 4, 6, 7, 9, 11],    name: 'Lídio',                     short: 'Lídio',    degrees: ['I', 'II', '♯III°', 'IV', 'V', 'VI', 'vii'] },
    mixolydian: { iv: [0, 2, 4, 5, 7, 9, 10],    name: 'Mixolídio',                 short: 'Mixolídio', degrees: ['I', 'II', 'III', 'IV', 'V', 'vi', 'vii°'] },
    aeolian:    { iv: [0, 2, 3, 5, 7, 8, 10],    name: 'Eólio (menor natural)',     short: 'Eólio',    degrees: ['i', 'II', 'III', 'iv', 'v', 'VI', 'VII'] },
    locrian:    { iv: [0, 1, 3, 5, 6, 8, 10],    name: 'Lócrio',                    short: 'Lócrio',   degrees: ['i°', 'II', 'III', 'iv°', 'v°', 'VI°', 'vii°'] },
    pentMajor:  { iv: [0, 2, 4, 7, 9],           name: 'Pentatônica maior',         short: 'Pentatônica maior', degrees: ['1', '2', '3', '5', '6'] },
    pentMinor:  { iv: [0, 3, 5, 7, 10],          name: 'Pentatônica menor',         short: 'Pentatônica menor', degrees: ['1', '♭3', '4', '5', '♭7'] },
    blues:      { iv: [0, 3, 5, 6, 7, 10],       name: 'Blues',                     short: 'Blues',    degrees: ['1', '♭3', '4', '♭5', '5', '♭7'] },
    wholeTone:  { iv: [0, 2, 4, 6, 8, 10],       name: 'Tons inteiros',             short: 'Tons inteiros', degrees: ['1', '2', '3', '♯4', '♯5', '♭7'] },
    diminished: { iv: [0, 2, 3, 5, 6, 8, 9, 11], name: 'Diminuta (tom-meio-tom)',    short: 'Diminuta', degrees: ['1', '2', '♭3', '3', '♯4', '5', '♭6', '♭7'] },
    chromatic:  { iv: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], name: 'Cromática', short: 'Cromática', degrees: ['1','2','3','4','5','6','7','8','9','10','11','12'] },
  };

  /** Qualidade da tríade que nasce sobre o grau `i` da escala. */
  function triadFor(scaleIv, i) {
    const n = scaleIv.length;
    const k = ((i % n) + n) % n;
    const root = scaleIv[k];
    const third = scaleIv[(k + 2) % n] + (k + 2 >= n ? 12 : 0);
    const fifth = scaleIv[(k + 4) % n] + (k + 4 >= n ? 12 : 0);
    const t = mod12(third - root);
    const f = mod12(fifth - root);
    if (t === 4 && f === 7) return '';
    if (t === 3 && f === 7) return 'm';
    if (t === 3 && f === 6) return 'dim';
    if (t === 4 && f === 8) return 'aug';
    return '?';
  }

  function scaleNotes(rootPc, scaleKey, flat) {
    const sc = SCALES[scaleKey] || SCALES.major;
    return sc.iv.map((i) => mod12(rootPc + i));
  }
  /* Os nomes da escala.
   *
   * Passando um BOOLEANO no terceiro argumento, o comportamento e o de sempre:
   * `noteName` de cada classe com bemol ou sustenido do jeito que se pediu.
   * Quem dependia desse caminho continua dependendo.
   *
   * Sem o terceiro argumento — ou com um objeto — a grafia vem do contexto, e
   * e a que a teoria manda. E o caminho que a tela usa depois da correcao: com
   * o booleano, a menor de Do saia "C D D# F G G# A#", com duas letras
   * repetidas e nenhum acorde da menor natural. */
  function scaleNames(rootPc, scaleKey, opts) {
    if (typeof opts === 'boolean') {
      return scaleNotes(rootPc, scaleKey, opts).map((pc) => noteName(pc, opts));
    }
    return nomesDaEscala(rootPc, scaleKey,
      (opts && typeof opts === 'object') ? opts : undefined);
  }
  /**
   * O rótulo do grau, com a caixa que a qualidade real pede.
   *
   *.Numeral romano maiúsculo é tríade MAIOR e minúsculo é menor: é a
   * convenção de escrita, e é o que o músico lê. Um "II" em cima de um acorde
   * menor não é disagreement de estilo — está affirmando que o acorde é maior,
   * e está errado.
   *
   * A caixa vem da qualidade que `triadFor` calculou a partir dos INTERVALOS,
   * e não de um texto escrito à mão. Foi exatamente esse texto que produzia
   * "Grau II" em cima de Dm, "Grau III" em cima de Em e "Grau VI" em cima de
   * Am — as três_accountsvendo maior em Do. O motor sabia a verdade o tempo
   * todo; só o rótulo mentia.
   *
   * `analyzeChords` já fazia essa conta do mesmo jeito, olhando os intervalos do
   * próprio acorde. Aqui a fonte é a tríade montada sobre o grau.
   */
  function rotuloDoGrau(indice, qualidade, sc) {
    const heptatonica = sc.iv.length === 7;
    /* Escala com outra contagem de notas não tem numeral romano: os rótulos do
     * quadro ("1", "♭3", "♭5") são GRAUS DA ESCALA, e dizem outra coisa — que
     * nota da escala é aquela. Não são função harmônica, então não têm caixa
     * para escolher, e não se mexem. */
    if (!heptatonica) return sc.degrees[indice] || String(indice + 1);
    const numeral = ROMAN[indice % 7];
    if (qualidade === 'm') return numeral.toLowerCase();
    if (qualidade === 'dim') return numeral.toLowerCase() + '°';
    if (qualidade === 'aug') return numeral + '+';
    return numeral;
  }

  function scaleChords(rootPc, scaleKey, opts) {
    const sc = SCALES[scaleKey] || SCALES.major;
    const pc0 = mod12(rootPc);
    /* A assinatura antiga passing um booleano — `scaleChords(pc, escala, flat)`
     * — continua valendo, e é o que a tela e os testes usam. Quem passa objeto
     * recebe a grafia por contexto; quem passa `true`/`false` recebe bemol ou
     * sustenido do jeito antigo, sem mudança de comportamento. */
    const flatAntigo = typeof opts === 'boolean' ? opts : undefined;
    const graf = escalaComGravacao(pc0, scaleKey,
      (opts && typeof opts === 'object') ? opts : undefined);
    const out = [];
    for (let i = 0; i < sc.iv.length; i++) {
      const pc = mod12(pc0 + sc.iv[i]);
      const q = triadFor(sc.iv, i);
      /* O nome da fundamental é a MESMA letra que a nota desse grau na escala
       * acima. Por isso o acorde de Dó menor na tela de menor harmônica de Dó
       * sai "Ebmaj" e não "D#maj": a escala acima mostra Eb, e o acorde não
       * pode responder D#. */
      const fundamental = flatAntigo !== undefined
        ? noteName(pc, flatAntigo)
        : (graf[i] && graf[i].nome) || noteName(pc, useFlatsFor(pc0));
      const sufixo = q === 'm' ? 'm' : q === 'dim' ? 'dim' : q === 'aug' ? 'aug' : '';
      /* `triadFor` devolve '?' quando a nota não é uma tríade — o que acontece
       * nas escalas sem terça, como a pentatônica e o blues. Escrever "C" ali
       * está inventando uma qualidade que a escala não tem. O nome sai SEM
       * sufixo e `conhecido:false` avisa quem for mostrar. */
      out.push({
        degree: rotuloDoGrau(i, q, sc),
        pc,
        quality: q,
        conhecido: q !== '?',
        nome: graf[i] ? graf[i].nome : null,
        name: fundamental + sufixo,
      });
    }
    return out;
  }
  const TERMS = {
    0: 'Tônica', 1: 'Supertônica (♭♭)', 2: 'Supertônica', 3: 'Supertônica (♭)',
    4: 'Medianta', 5: 'Subdominante', 6: 'Subdominante (♭)', 7: 'Dominante',
    8: 'Superdominante (♭)', 9: 'Superdominante', 10: 'Subtônica (♭)', 11: 'Subtônica',
  };
  function closestTerm(rootPc, pc) { return TERMS[mod12(pc - rootPc)] || '—'; }

  /* =======================================================
     5. CÍRCULO DAS QUINTAS
     ======================================================= */
  const CIRCLE = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
  const circleIndexOf = (pc) => CIRCLE.indexOf(mod12(pc));
  const relativeMinor = (pc) => mod12(pc + 9);
  const relativeMajor = (pc) => mod12(pc + 3);
  /** Numero de alteracoes na armadura: positivo = oficiais, negativo = bemois. */
  function sharpsCount(pc) {
    const i = circleIndexOf(pc);
    return i <= 6 ? i : 12 - i;
  }
  /** A tônica fica no lado "das quintas" que pede bemóis? */
  const useFlatsFor = (pc) => circleIndexOf(pc) > 6;

  // Ordem em que as alteracoes entram na armadura. São as duas escalas
  // longas do círculo das quintas, e a ordem importa: é ela que diz qual
  // nota aparece primeiro, que é o que se vê na clave.
  const ORDEM_SUS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  const ORDEM_BEM = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

  /* Os tons menores NAO andam pelo mesmo lado do circulo que os maiores,
   * e e este o defeito que a funcao tinha.
   *
   * A conta antiga pegava o relativo maior e perguntava ao circulo. Para a
   * maioria dos tons menores isso da certo por coincidencia: o relativo de
   * Re menor e Fa maior, que esta do lado dos bemois, e o relativo de Mi
   * menor e Sol maior, do lado dos sustenos. Para DOIS nao da:
   *
   *   Mi menor  -> relativo Sol sustenido -> circulo diz 6 SUSTENOS
   *                o certo e 6 bemois (Sol bemol maior)
   *   La menor  -> relativo Si maior     -> circulo diz 5 SUSTENOS
   *                o certo e 7 bemois (Dobemol maior)
   *
   * O QUE O MUSICO SOFRE COM ISSO. A altura e a mesma — seis sustenos e seis
   * bemóis dão as mesmas teclas. A LETRA nao e. Ele abre Mi menor e le
   * "F C G D A E": le sustenido num tom que a partitura inteiro escreve com
   * bemol. Toda nota com uma seta na mao, toda digitacao ao contrario. E
   * esse e o tipo de erro que nao aparece como nota errada — aparece como
   * "o app escreve diferente do meu warmup", que e o jeito mais caro de
   * perder a confiança de quem toca.
   *
   * A CONTA CERTA. A armadura de um menor nao vem do relativo: vem do
   * proprio nome do menor, andando por quintas a partir de La, que e o
   * unico menor sem alteracao. Cada quinto acima soma um acidente.
   *
   *   dos sustenos: La E Si Fa sustenido Do sustenido Sol sustenido
   *                  Re sustenido La sustenido
   *   dos bemois:    La Re Sol Do Fa Si bemol Mi bemol La bemol
   *
   * Sao duas listas de sete, e nao uma so porque o circulo tem dois lados.
   * Tres classes de altura aparecem nas DUAS: as enarmonicas do Fa sustenido
   * e do Sol sustenido. Nesses casos vence o nome com bemol, que e o que o
   * proprio app escreve para 3, 8 e 10 — o mesmo criterio de grafia que
   * `useFlatsFor` ja usa em todo o resto, entao tom e acorde falam a mesma
   * lingua. */
  const MENOR_SUS = [9, 4, 11, 6, 1, 8, 3, 10];   /* La E Si Fa# Do# Sol# Re# La# */
  const MENOR_BEM = [9, 2, 7, 0, 5, 10, 3, 8];    /* La Re Sol Do Fa Bb Eb Ab */

  /** A armadura do tom menor `pc`, e de que lado. Null se nao ha nome. */
  function armaduraMenor(pc) {
    /* O bemol primeiro: nos enarmonicos (3, 8, 10) e o bemol que vale, porque
     * e o nome que o app escreve. */
    const b = MENOR_BEM.indexOf(pc);
    if (b >= 0) return { q: b, bem: true };
    const s = MENOR_SUS.indexOf(pc);
    if (s >= 0) return { q: s, bem: false };
    return null;
  }
  /**
   * A armadura de um tom: quantas alterações, se são sustenos ou bemóis, e
   * quais.
   *
   * Para um tom menor, a conta é feita no relativo maior. Ré menor tem um
   * bemol — o mesmo de Fá maior, que é seu relativo. Calcular direto sobre a
   * tônica menor daria 2 sustenos, que é a armadura de Ré maior, e o app
   * pediria para afinar meio tom acima do que a peça pede.
   */
  function armadura(pc, modo) {
    const maior = modo === 'minor' ? relativeMajor(pc) : mod12(pc);
    /* O menor tem conta propria. Sem ela, os dois lados do circulo discordam
     * do nome do menor justamente onde o relativo cai em F#/Gb — Mi menor e
     * La menor, que sao os dois mais usados de todos. */
    const menor = modo === 'minor' ? armaduraMenor(mod12(pc)) : null;
    const q = menor ? menor.q : sharpsCount(maior);
    const bem = menor ? menor.bem : useFlatsFor(maior);
    /* Tom sem alteracao nao tem lado nenhum, e dizer que tem e o tipo de
     * coisa que faz a mesma tela mostrar duas coisas para o mesmo tom: o
     * mesmo La maior e La menor com nomes de lados opostos. Sem acidente
     * nao existe susteno nem bemol, entao o campo vai sempre para o
     * mesmo lado. E o texto ja sai "sem alteracoes" pelas duas vias. */
    const bemFinal = q === 0 ? false : bem;
    const ordemFinal = (bemFinal ? ORDEM_BEM : ORDEM_SUS).slice(0, q);
    /* O sinal nao vem de `sharpsCount`: ele devolve a MAGNITUDE e sempre
     * positiva. O lado do circulo e que diz se a alteracao e susteno ou
     * bemol — por isso que Do sustenido aparece aqui como Reb com 5 bemois,
     * e nao com 7. O mesmo vale para o menor, que tem lista propria acima. */
    const ordem = ordemFinal;
    let texto;
    if (q === 0) texto = 'sem alteracoes';
    else texto = q + (bemFinal ? (q > 1 ? ' bemois' : ' bemol') : (q > 1 ? ' sustenos' : ' susteno')) + (ordem.length ? ' · ' + ordem.join(' ') : '');
return { quantidade: q, bemois: bemFinal, ordem: ordem, texto: texto, relativo: maior };
  }

  /**
   * Resume a tonalidade de um conjunto de músicas.
   *
   * A pergunta que o músico faz ao abrir a escala não é "qual o tom de cada
   * música", é "em que tom eu vou tocar e tem alguém fora". Por isso o
   * resultado sai do tom mais frequente, com a contagem do que sobrou — as
   * músicas em outro tom viram um aviso, não uma segunda linha de texto.
   *
   * Empate vai para o primeiro encontrado: com dois tons igualmente
   * presentes, a resposta é a ordem do repertório, e isso é estável entre
   * uma renderização e outra. Um aviso que muda de texto a cada toque é pior
   * que um aviso mínimo.
   */
  function resumoDeTons(lista) {
    if (!lista || !lista.length) return null;
    const conta = new Map();
    for (const t of lista) {
      if (!t || typeof t.pc !== 'number' || !isFinite(t.pc)) continue;
      const modo = t.modo === 'minor' ? 'minor' : 'major';
      const id = mod12(t.pc) + '/' + modo;
      const atual = conta.get(id);
      if (atual) atual.n++;
      else conta.set(id, { pc: mod12(t.pc), modo: modo, n: 1, rotulo: t.rotulo || null });
    }
    if (!conta.size) return null;

    let melhor = null;
    conta.forEach(function (v) { if (!melhor || v.n > melhor.n) melhor = v; });

    return {
      pc: melhor.pc,
      modo: melhor.modo,
      rotulo: melhor.rotulo || keyLabel(melhor.pc, melhor.modo === 'minor', useFlatsFor(armadura(melhor.pc, melhor.modo).relativo)),
      n: melhor.n,
      total: lista.length,
      fora: lista.length - melhor.n,
      distintos: conta.size,
      armadura: armadura(melhor.pc, melhor.modo),
    };
  }

  /* =======================================================
     6. GUITARRA — afinacao, formas canonicas e busca
     ======================================================= */
  const TUNING = [40, 45, 50, 55, 59, 64];      // E2 A2 D3 G3 B3 E4 (MIDI)
  const OPEN_PC = [4, 9, 2, 7, 11, 4];          // pc das cordas abertas
  const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'E'];

  /**
   * Formas canonicas (sistema CAGED) por qualidade.
   * Cada forma traz a fundamental no traste 0 da corda de referencia;
   * somando a mesma quantidade de trastes obtem-se a forma correta em
   * qualquer tom. Sao as posicoes que os guitarristas realmente usam.
   *   cordas: 1=E(6a) 2=A(5a) 3=D(4a) 4=G(3a) 5=B(2a) 6=E(1a)
   *   -1 = corda muda
   */
  const SHAPE_TEMPLATES = {
    '':     { E: [0, 2, 2, 1, 0, 0], A: [-1, 0, 2, 2, 2, 0], D: [-1, -1, 0, 2, 3, 2] },
    'm':    { E: [0, 2, 2, 0, 0, 0], A: [-1, 0, 2, 2, 1, 0], D: [-1, -1, 0, 2, 3, 1] },
    '7':    { E: [0, 2, 0, 1, 0, 0], A: [-1, 0, 2, 0, 2, 0], D: [-1, -1, 0, 0, 2, 2] },
    'm7':   { E: [0, 2, 0, 0, 0, 0], A: [-1, 0, 2, 0, 1, 0], D: [-1, -1, 0, 0, 2, 1] },
    'maj7': { E: [0, 2, 1, 0, 0, 0], A: [-1, 0, 2, 1, 2, 0], D: [-1, -1, 0, 2, 2, 2] },
    'sus4': { E: [0, 2, 2, 2, 0, 0], A: [-1, 0, 2, 2, 3, 0], D: [-1, -1, 0, 2, 4, 2] },
  };
  /**
   * Formas abertas canonicas que nao vem do CAGED.
   * Chave = "<pc da fundamental>:<qualidade>"
   */
  // Lista (nao objeto) para evitar chaves duplicadas acidentais.
  // root = pc da fundamental, q = chave em QUALITIES, shape = trastes
  const SHAPE_OPEN = [
    { root: 0, q: '', shape: [-1, 3, 2, 0, 1, 0] },          // C
    { root: 7, q: '', shape: [3, 2, 0, 0, 0, 3] },            // G
    { root: 7, q: '7', shape: [3, 2, 0, 0, 0, 1] },           // G7
    { root: 7, q: 'sus4', shape: [3, 3, 5, 5, 3, 3] },       // Gsus4
    { root: 0, q: '7', shape: [-1, 3, 2, 3, 1, 0] },          // C7
    { root: 11, q: '7', shape: [-1, 2, 1, 2, 0, 2] },        // B7
    { root: 2, q: 'm7', shape: [-1, -1, 0, 2, 1, 1] },       // Dm7
    { root: 9, q: 'sus2', shape: [-1, 0, 2, 2, 0, 0] },      // Asus2
    { root: 11, q: 'dim', shape: [-1, 2, 0, -1, 0, 1] },     // Bdim
    { root: 11, q: 'dim7', shape: [-1, 2, 0, 1, 0, 1] },     // Bdim7
    { root: 3, q: 'm', shape: [-1, 6, 8, 8, 7, 6] },         // Ebm
    { root: 0, q: 'm7', shape: [-1, 3, 5, 3, 4, 3] },        // Cm7
    { root: 10, q: 'maj7', shape: [-1, 1, 3, 2, 1, 0] },     // Bbmaj7
    { root: 5, q: 'maj7', shape: [-1, 0, 0, 0, 0, 0] },      // Fmaj7
  ];

  /**
 * Os instrumentos com trastes que o app conhece.
 *
 * `openPc` e o pitch class da corda ABERTA, na ordem da corda mais grave
 * para a mais aguda — a mesma convencao de `OPEN_PC` do violao, e por isso
 * que o indice 0 e sempre a nota mais grave do desenho.
 *
 * `tríade` marca os instrumentos onde um acorde de 3 notas ja e a resposta
 * certa. No violao uma tríade de 3 notas e quase sempre um arranjo ruim: ha
 * corda sobrando, e vale mais uma 4ª. No baixo as cordas sao 4 e o acorde se
 * esgota antes — exigir 4 notas la faria o app nao achar quase nada.
 */
const INSTRUMENTOS = [
  { id: 'violao', nome: 'Violão', afinacao: 'Padrão', cordas: 6, trastes: 22,
    openPc: [4, 9, 2, 7, 11, 4], openMidi: [40, 45, 50, 55, 59, 64], labels: ['E', 'A', 'D', 'G', 'B', 'E'],
    tipo: 'cordas', familia: 'dedilhado' },
  { id: 'baixo', nome: 'Baixo', afinacao: 'Padrão', cordas: 4, trastes: 20, triade: true,
    openPc: [4, 9, 2, 7], openMidi: [28, 33, 38, 43], labels: ['E', 'A', 'D', 'G'],
    tipo: 'cordas', familia: 'dedilhado' },
  { id: 'baixo5', nome: 'Baixo 5 cordas', afinacao: 'Padrão', cordas: 5, trastes: 20, triade: true,
    openPc: [11, 4, 9, 2, 7], openMidi: [23, 28, 33, 38, 43], labels: ['B', 'E', 'A', 'D', 'G'],
    tipo: 'cordas', familia: 'dedilhado' },
  { id: 'cavaquinho', nome: 'Cavaquinho', afinacao: 'DGBD', cordas: 4, trastes: 16,
    openPc: [2, 7, 11, 2], openMidi: [62, 67, 71, 74], labels: ['D', 'G', 'B', 'D'],
    tipo: 'cordas', familia: 'dedilhado' },
  { id: 'violino', nome: 'Violino', afinacao: 'Padrão', cordas: 4, trastes: 0, triade: true,
    openPc: [7, 2, 9, 4], openMidi: [55, 62, 69, 76], labels: ['G', 'D', 'A', 'E'],
    tipo: 'cordas', familia: 'arco', semTrastes: true },
  { id: 'ukulele', nome: 'Ukulele', afinacao: 'Solastro', cordas: 4, trastes: 12,
    openPc: [7, 0, 4, 9], openMidi: [55, 60, 64, 69], labels: ['G', 'C', 'E', 'A'],
    tipo: 'cordas', familia: 'dedilhado' },
  /* NOVOS INSTRUMENTOS — V6.17
   *
   * Piano, Sintetizador, Bateria, Caixa de ritmos, Sinos, Xilofone.
   * Nao sao cordas: nao tem traste, nao tem braco. O campo `tipo` e `familia`
   * permite que a UI decida como desenhar (teclado, grade, sinos, etc.). */
  { id: 'piano', nome: 'Piano', afinacao: 'Temperado', cordas: 0, trastes: 0,
    openPc: [], openMidi: [], labels: [],
    tipo: 'teclado', familia: 'percussao-martelo', oitavas: 7, notaCentral: 60 },
  { id: 'sintetizador', nome: 'Sintetizador', afinacao: 'Temperado', cordas: 0, trastes: 0,
    openPc: [], openMidi: [], labels: [],
    tipo: 'teclado', familia: 'eletronico', oitavas: 5, notaCentral: 60 },
  { id: 'bateria', nome: 'Bateria', afinacao: 'Indefinida', cordas: 0, trastes: 0,
    openPc: [], openMidi: [], labels: [],
    tipo: 'percussao', familia: 'bateria',
    pecas: [
      { id: 'bumbo', nome: 'Bumbo', pc: 36, midi: 36, cor: '#222' },
      { id: 'caixa', nome: 'Caixa', pc: 38, midi: 38, cor: '#ccc' },
      { id: 'chimbal-fechado', nome: 'Chimbal fechado', pc: 42, midi: 42, cor: '#8b7' },
      { id: 'chimbal-aberto', nome: 'Chimbal aberto', pc: 46, midi: 46, cor: '#9c8' },
      { id: 'tom-alto', nome: 'Tom alto', pc: 48, midi: 48, cor: '#c63' },
      { id: 'tom-medio', nome: 'Tom médio', pc: 45, midi: 45, cor: '#b52' },
      { id: 'tom-baixo', nome: 'Tom baixo', pc: 43, midi: 43, cor: '#a41' },
      { id: 'prato-crash', nome: 'Prato crash', pc: 49, midi: 49, cor: '#d9c' },
      { id: 'prato-ride', nome: 'Prato ride', pc: 51, midi: 51, cor: '#daa' },
    ] },
  { id: 'caixa-ritmos', nome: 'Caixa de ritmos', afinacao: 'Programavel', cordas: 0, trastes: 0,
    openPc: [], openMidi: [], labels: [],
    tipo: 'percussao', familia: 'sequenciador',
    passos: 16, bpmPadrao: 120,
    pecas: [
      { id: 'bd', nome: 'Bumbo', midi: 36, cor: '#222' },
      { id: 'sd', nome: 'Caixa', midi: 38, cor: '#ccc' },
      { id: 'ch', nome: 'Chimbal', midi: 42, cor: '#8b7' },
      { id: 'oh', nome: 'Chimbal aberto', midi: 46, cor: '#9c8' },
      { id: 't1', nome: 'Tom 1', midi: 48, cor: '#c63' },
      { id: 't2', nome: 'Tom 2', midi: 45, cor: '#b52' },
      { id: 't3', nome: 'Tom 3', midi: 43, cor: '#a41' },
      { id: 'cp', nome: 'Palmas', midi: 39, cor: '#996' },
    ] },
  { id: 'sinos', nome: 'Jogo de sinos', afinacao: 'Temperado', cordas: 0, trastes: 0,
    openPc: [], openMidi: [], labels: [],
    tipo: 'percussao', familia: 'sinos',
    notas: [60,62,64,65,67,69,71,72,74,76,77,79,81,83,84], /* C4..C6 cromático */
    corBase: '#ffd700' },
  { id: 'xilofone', nome: 'Xilofone', afinacao: 'Temperado', cordas: 0, trastes: 0,
    openPc: [], openMidi: [], labels: [],
    tipo: 'percussao', familia: 'laminas',
    notas: [60,62,64,65,67,69,71,72,74,76,77,79,81,83,84,86,88], /* C4..A5 */
    corBase: '#8b4513' },
];
const INSTRUMENTO_PADRAO = INSTRUMENTOS[0];

/**
 * Normaliza um nome de instrumento para comparar.
 *
 * Sem acento e sem caixa: "violão", "Violão" e "VIOLAO" sao o mesmo
 * instrumento. Escrever o acento errado num id nao pode trocar a tela sem ninguem
 * perceber — ver `instrumento()`.
 */
function chaveDeInstrumento(id) {
  return String(id == null ? '' : id)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Acha o instrumento pelo id, com queda para o violao. */
function instrumento(id) {
  const alvo = chaveDeInstrumento(id);
  for (const i of INSTRUMENTOS) if (chaveDeInstrumento(i.id) === alvo) return i;
  return INSTRUMENTO_PADRAO;
}

/** O id canonico de um nome de instrumento, ou null se nao existir. */
function idDeInstrumento(nome) {
  const alvo = chaveDeInstrumento(nome);
  if (!alvo) return null;
  for (const i of INSTRUMENTOS) if (chaveDeInstrumento(i.id) === alvo) return i.id;
  return null;
}

/**
 * O braco de um timbre escolhido, ou `null` quando o timbre nao tem braco.
 *
 * Quem escolhe "Teclado" em Ajustes nao tem trastes para desenhar. Devolver o
 * violao aqui seria inventar um instrumento que a pessoa nao tem.
 */
function bracoPara(timbreId) {
  const T = global.Timbre;
  const braco = T && typeof T.bracoDe === 'function' ? T.bracoDe(timbreId) : null;
  if (!braco) return null;
  const achado = idDeInstrumento(braco);
  return achado ? instrumento(achado) : null;
}

/** O mesmo instrumento, ou o padrao quando o argumento nao serve. */
function instrumentoOuPadrao(inst) {
  if (!inst) return INSTRUMENTO_PADRAO;
  return Array.isArray(inst.openPc) ? inst : INSTRUMENTO_PADRAO;
}

/** Verifica se um voicing (array de trastes) forma o acorde pedido. */
  function validateVoicing(frets, rootPc, quality, inst) {
    const I = instrumentoOuPadrao(inst);
    const openPc = I.openPc;
    const n = openPc.length;
    const q = QUALITIES[QUALITIES[quality] ? quality : ''];
    const want = new Set(q.iv.map((i) => mod12(rootPc + i)));
    const played = [];
    for (let i = 0; i < n; i++) {
      if (frets[i] < 0) continue;
      const pc = mod12(openPc[i] + frets[i]);
      played.push({ pc, string: i, fret: frets[i] });
    }
    if (played.length < 3) return null;
    const set = new Set(played.map((p) => p.pc));
    // obrigatorio: fundamental e 3a
    if (!set.has(mod12(rootPc))) return null;
    if (!set.has(mod12(rootPc + (q.iv[1] !== undefined ? q.iv[1] : 4)))) return null;
    // evita voicings com so 3 notas quando cabem mais
    if (!I.triade && played.length < 4 && q.iv.length <= 3) return null;
    // 5a: obrigatoria em tríades; em acordes com 7ª a forma aberta
    // classica (C7 = x 3 2 3 1 0) dispensa o Sol.
    if (q.iv.length === 3 && !set.has(mod12(rootPc + q.iv[2]))) return null;
    // 7a, se o acorde tem 7a
    if (q.iv.length >= 4 && !set.has(mod12(rootPc + q.iv[3]))) return null;
    // nada fora do acorde
    for (const p of played) if (!want.has(p.pc)) return null;
    // a nota mais grave precisa ser a fundamental
    const first = played[0];
    if (first.pc !== mod12(rootPc)) return null;
    // pegada util
    const fs = played.map((p) => p.fret);
    const span = Math.max.apply(null, fs) - Math.min.apply(null, fs);
    // A mao alcanca uma oitava no baixo sem esforço; no violao, um treste e
    // um alongamento, e a regra dos 4 trastes e o que separa uma forma
    // jogavel de um desenho de papel.
    if (span > (I.triade ? 7 : 4)) return null;
    return played;
  }

  /**
   * Pontua um voicing (maior = melhor), imitando a preferencia de um
   * guitarrista: posicao aberta, pegada curta, poucas cordas mudas e
   * sem a "bolha" na 4a corda.
   */
  function scoreVoicing(frets, rootPc, quality, inst) {
    const I = instrumentoOuPadrao(inst);
    const openPc = I.openPc;
    const n = openPc.length;
    const q = QUALITIES[QUALITIES[quality] ? quality : ''];
    const fs = [];
    let mutes = 0;
    for (let i = 0; i < n; i++) {
      if (frets[i] >= 0) fs.push(frets[i]); else mutes++;
    }
    const minF = Math.min.apply(null, fs);
    const span = Math.max.apply(null, fs) - minF;
    const isMinorChord = (q.iv[1] !== undefined ? q.iv[1] : 4) === 3;

    let score = 100;
    score -= minF * 6;      // posicao aberta e' a preferida
    score -= span * 7;      // pegada curta e' mais facil
    score -= mutes * 5;     // cordas mudas atrapalham
    score += fs.length * 2; // mais cordas = timbre mais cheio
    // A "bolha" e um caso do violao: na 3a corda, a nota uma 4a acima da
    // fundamental (D) ou a propria fundamental (C) formigam sob os dedos.
    // Nao ha equivalente no ukulele, e no baixo o desenho e outro. Testar a
    // corda 3 fora do violao penaliza um acorde que estava correto.
    if (!I.triade && frets[2] >= 0) {
      const b = mod12(openPc[2] + frets[2]) - mod12(rootPc);
      if (isMinorChord && b === 7) score -= 16;
      if (!isMinorChord && b === 0) score -= 16;
    }
    return score;
  }

  /**
   * Posicoes de guitarra para um acorde.
   * 1) tenta as formas CAGED (resultados canonicos e sempre corretos)
   * 2) completa com formas abertas especiais
   * 3) se a qualidade nao tiver forma CAGED, usa a busca por trastes
   */
  function guitarShapes(rootPc, quality, opts) {
    opts = opts || {};
    const maxFret = opts.maxFret == null ? 15 : opts.maxFret;
    const limit = opts.limit || 8;
    const key = QUALITIES[quality] ? quality : '';
    const root = mod12(rootPc);

    const results = [];
    const seen = new Set();
    const add = (frets, bonus) => {
      const f = frets.slice();
      if (f.some((x) => x > maxFret)) return;
      if (!validateVoicing(f, root, key)) return;
      const id = f.join(',');
      if (seen.has(id)) return;
      seen.add(id);
      results.push({ v: f, score: scoreVoicing(f, root, key) + (bonus || 0) });
    };

    // 1) formas abertas canonicas PRIMEIRO: sao as mais tocadas e
    //    precisam do bonus antes que o CAGED registre a mesma forma
    SHAPE_OPEN.forEach((o) => {
      if (mod12(o.root) !== root || o.q !== key) return;
      add(o.shape.slice(), 40);
    });

    // 2) formas CAGED
    const tpl = SHAPE_TEMPLATES[key];
    if (tpl) {
      ['E', 'A', 'D'].forEach((form) => {
        const base = tpl[form];
        if (!base) return;
        for (let r = 0; r <= maxFret; r++) add(base.map((f) => (f < 0 ? -1 : f + r)));
      });
    }

    // 3) busca por trastes (completa o que falta)
    if (results.length < limit) {
      searchShapes(root, key, maxFret, 60000).forEach((f) => {
        const id = f.join(',');
        if (seen.has(id)) return;
        if (!validateVoicing(f, root, key)) return;
        seen.add(id);
        results.push({ v: f, score: scoreVoicing(f, root, key) - 15 }); // leve desvantagem
      });
    }

    results.sort((a, b) => b.score - a.score);
    const out = [];
    const outSeen = new Set();
    for (const r of results) {
      if (out.length >= limit) break;
      const id = r.v.join(',');
      if (outSeen.has(id)) continue;
      outSeen.add(id);
      out.push(r.v);
    }
    return out;
  }

  /**
   * Formas de um acorde em qualquer instrumento com trastes.
   *
   * O violao tem um caminho privilegiado: as formas CAGED e as abertas
   * canonicas, que sao as posicoes que o Algarve realmente usa. Nenhum outro
   * instrumento tem esse conjunto — nao existe CAGED de ukulele, e as
   * "abertas canonicas" de baixo sao outra coisa. Inventar equivalentes
   * seria inventar musica que ninguem toca.
   *
   * Entao os outros instrumentos vao direto para a busca por trastes, que
   * nao depende de nenhuma tradicao: ela varre o braco e devolve o que
   * realmente forma o acorde. O resultado e menos sleek e sempre correto.
   *
   * Para o violao, delega a `guitarShapes` — as formas especiais entram com
   * bonus e a busca so completa o que faltou.
   */
  function instrumentShapes(inst, rootPc, quality, opts) {
    opts = opts || {};
    const I = instrumentoOuPadrao(typeof inst === 'string' ? instrumento(inst) : inst);
    const root = mod12(rootPc);
    const key = QUALITIES[quality] ? quality : '';
    const maxFret = opts.maxFret == null ? I.trastes : opts.maxFret;
    const limit = opts.limit || 6;

    if (I.id === INSTRUMENTO_PADRAO.id) return guitarShapes(root, key, opts);

    const seen = new Set();
    const out = [];
    for (const f of searchShapes(root, key, maxFret, opts.budget || 200000, I)) {
      const id = f.join(',');
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(f);
      if (out.length >= limit) break;
    }
    return out;
  }

  /** Busca exaustiva por trastes (usada como complemento). */
  function searchShapes(rootPc, quality, maxFret, budget, inst) {
    const I = instrumentoOuPadrao(inst);
    const openPc = I.openPc;
    const nc = openPc.length;
    const q = QUALITIES[QUALITIES[quality] ? quality : ''];
    const wantSet = new Set(q.iv.map((i) => mod12(rootPc + i)));
    const found = [];
    const seen = new Set();
    let left = budget || 60000;

    const roots = [];
    for (let s = 0; s < nc; s++) {
      for (let f = 0; f <= maxFret; f++) {
        if (mod12(openPc[s] + f) === mod12(rootPc)) roots.push({ s, f });
      }
    }
    roots.sort((a, b) => a.f - b.f || b.s - a.s);

    for (const r of roots) {
      if (found.length >= 24 || left <= 0) break;
      const lo = Math.max(0, r.f - 3), hi = r.f + 3;
      const opts = [];
      for (let s = 0; s < nc; s++) {
        const arr = [];
        const fs = [0];
        for (let f = lo; f <= hi; f++) if (f > 0) fs.push(f);
        for (const f of fs) {
          if (f > maxFret) continue;
          if (wantSet.has(mod12(openPc[s] + f))) arr.push(f);
        }
        opts.push(arr);
      }
      if (opts[r.s].indexOf(r.f) === -1) continue;
      const cur = new Array(nc).fill(-1);
      cur[r.s] = r.f;
      let best = null;
      (function rec(s) {
        if (left-- <= 0) return;
        if (s === nc) {
          const played = validateVoicing(cur, rootPc, quality, I);
          if (played) {
            const sc = scoreVoicing(cur, rootPc, quality, I);
            if (!best || sc > best.score) best = { v: cur.slice(), score: sc };
          }
          return;
        }
        if (s === r.s) return rec(s + 1);
        cur[s] = -1; rec(s + 1);
        for (const f of opts[s]) { cur[s] = f; rec(s + 1); }
        cur[s] = -1;
      })(0);
      if (best) {
        const id = best.v.join(',');
        if (!seen.has(id)) { seen.add(id); found.push(best.v); }
      }
    }
    return found;
  }

  /** Nota (pc) de uma corda/traste. */
  function fretNote(stringIdx, fret, inst) {
    const I = instrumentoOuPadrao(inst);
    return mod12(I.openPc[stringIdx] + fret);
  }
  /** Nome da nota de uma corda/traste, ja formatado. */
  function fretNoteName(stringIdx, fret, flat, inst) {
    const I = instrumentoOuPadrao(inst);
    return noteName(mod12(I.openPc[stringIdx] + fret), flat);
  }
  /** Trastes onde a nota aparece na 6a corda. */
  function fretsForNote(pc, maxFret) {
    const out = [];
    for (let f = 0; f <= (maxFret || 15); f++) {
      if (fretNote(5, f) === mod12(pc)) out.push(f);
    }
    return out;
  }
  /** Diferenca de trastes entre duas notas na MESMA corda. */
  function fretDelta(fromPc, toPc) {
    return mod12(toPc - fromPc);
  }

  /** Rotulo de tom: 0 + false => "C" ; 9 + true => "Am" */
  function keyLabel(pc, minor, flat) {
    return noteName(pc, flat) + (minor ? 'm' : '');
  }
  /** Nome do modo em portugues. */
  function modeName(mode) {
    return mode === 'minor' ? 'menor' : 'maior';
  }

  /* =======================================================
     API
     ======================================================= */
  const Music = {
    // notas
    LETTER_PC, SHARP_NAMES, FLAT_NAMES, PRETTY, SOLFEGE,
    mod12, noteName, notePretty, noteSolfege, pcFromAccidental,
    // grafia por contexto
    LETRAS, PC_DA_LETRA, acentoDaLetra, letraComAcidente,
    letraDaTonica, escalaComGravacao, nomesDaEscala, nomeDeAcorde,
    // acordes
    QUALITIES, parseChord, formatChord, chordInfo, matchQuality, isChordWord, PT_STOPWORDS,
    // cifra
    tokenizeLine, isChordLine, isSectionLine, sectionLabel, keyDirective,
    transposeLine, transposeCifra, transposeCifraPorGrau, semitonsEntre, grauDe,
    arredondarSemitons, centsDeDesvio,
    TIPO_LINHA, roteiroDeRolagem, blocosDeCifra, SEM_TITULO, apenasAcordes,
    extractChords, detectKey, analyzeChords,
    // escalas
    SCALES, triadFor, scaleNotes, scaleNames, scaleChords, closestTerm,
    // círculo
    CIRCLE, circleIndexOf, relativeMinor, relativeMajor, sharpsCount, useFlatsFor,
    ORDEM_SUS, ORDEM_BEM, armadura, resumoDeTons,
    // guitarra
    TUNING, OPEN_PC, STRING_LABELS, guitarShapes, fretNote, fretNoteName, fretsForNote, fretDelta,
    INSTRUMENTOS, INSTRUMENTO_PADRAO, instrumento, idDeInstrumento, chaveDeInstrumento,
    bracoPara, instrumentShapes, validateVoicing,
    // tons
    keyLabel, modeName,
  };

  global.Music = Music;
  if (typeof module !== 'undefined' && module.exports) module.exports = Music;
})(typeof window !== 'undefined' ? window : globalThis);

