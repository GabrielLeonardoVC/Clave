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

    s = s.toLowerCase();
    if (!s) return '';
    if (s === 'm') return 'm';
    if (s === 'maj') return 'maj';

    // 6) correspondencia exata, com distinguecao de CAIXA
    //    (necessaria: "m7" = menor com 7, "M7" = maior com 7)
    for (const k of QUALITY_KEYS) if (k === s) return k;
    for (const k of QUALITY_KEYS) if (k.toLowerCase() === s) return k;
    // 7) prefixo mais longo possivel (ex.: "sus4", "7sus4", "m7b5")
    for (const k of QUALITY_KEYS) if (s.startsWith(k) && k.length >= 2) return k;
    for (const k of QUALITY_KEYS) if (s.startsWith(k.toLowerCase()) && k.length >= 2) return k;
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
  const QUAL_PART = '(?:maj|min|mi|m|dim|aug|sus|add|o|\\u00b0|\\u00f8|\\u0394|M|[+*\\-])';
  const CHORD_RE = new RegExp(
    '^([A-Ga-g])([#b\\u266f\\u266d]{0,2})' +
    '(' +
      '\\d?' +                       // "7sus4": cifra antes da palavra
      QUAL_PART + '{0,2}' +          // até 2 palavras: m, maj, sus, 7sus, mmaj...
      '\\d{0,2}(?:b5)?' +            // 7, 9, 13, 7b5 (meio-diminuto)
      '(?:\\/(?:9|11|13|5|3|4))?' +  // extensões: 6/9
    ')' +
    '(?:\\/([A-Ga-g][#b\\u266f\\u266d]{0,2}))?$'
  );

  /** Converte um token de acorde. Retorna null se não for acorde. */
  function parseChord(token) {
    if (token == null) return null;
    const s = String(token).trim();
    if (!s || s.length > 12) return null;
    const m = CHORD_RE.exec(s);
    if (!m) return null;
    const root = pcFromAccidental(m[1].toUpperCase(), m[2]);
    const quality = matchQuality(m[3]);
    // O baixo vem do regex como um grupo so, letra junto com o acidente. Passar
    // o grupo inteiro como se fosse so a letra fazia a busca na tabela de
    // letras devolver undefined, e o undefined virava NaN na conta. Daí um
    // acorde como "F#/A#" ter o baixo lido como NaN e a cifra impressa sair
    // com a palavra "undefined" no lugar da nota. A letra e o acidente sao
    // separados aqui, como ja era feito com a fundamental.
    const bass = m[4] ? pcFromAccidental(m[4][0].toUpperCase(), m[4].slice(1)) : null;
    return { root, quality, bass, text: s };
  }

  function formatChord(rootPc, quality, bassPc, flat) {
    const q = QUALITIES[QUALITIES[quality] ? quality : ''] || QUALITIES[''];
    let s = noteName(rootPc, flat) + q.label;
    if (bassPc !== null && bassPc !== undefined) s += '/' + noteName(bassPc, flat);
    return s;
  }

  /** Formata um acorde ja parseado, deslocando fundamental e baixo. */
  function formatChordTransposed(chord, semis, flat) {
    return formatChord(
      mod12(chord.root + semis),
      chord.quality,
      chord.bass === null || chord.bass === undefined ? null : mod12(chord.bass + semis),
      flat
    );
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
    // Comparadas uma a uma com a lista do CifraCeleste. "ao" e o caso grave:
    // casa com o padrao de acorde como A + o (diminuto), e "Ao Senhor" em uma
    // linha so seria lido como o acorde de La diminuto. As outras sao palavras
    // curtas que o padrao tambem aceita e que, sozinhas na linha, deviam ser
    // letra.
    //
    // "b" ficou de fora de proposito: B e um acorde de verdade, e uma linha de
    // hino so com "B" e legitima. O risco oposto — uma linha de letra que seja
    // a letra B sozinha — nao acontece em letra de hinario.
    'ao', 'aos', 'à', 'às', 'ás', 'das', 'dos', 'é', 'aí', 'lá', 'ai',
    'sol', 'fa', 'mi', 're', 'si', 'dó', 'fá', 'ré', 'ti', 'lá',
  ]);

  /**
   * As unicas palavras da lista que tambem sao acordes de verdade.
   *
   * "a" e artigo, "e" e conjuncao, "em" e preposicao — e ao mesmo tempo A, E e
   * Em, tres dos acordes mais usados do repertorio brasileiro. Nao ha como
   * decidir olhando so o token: o hino "A / Eu te adoro" usa A como acorde, e
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
    const re = /\S+/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const raw = m[0];
      // 1) o token inteiro ja e' um acorde? (ex.: "C/G", "Bbmaj7/D", "Am")
      const whole = raw.replace(/^[("'[]+/, '').replace(/[)"'\],.!?;:]+$/, '');
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
      // Hinario se escreve com um acorde por vez, cada um na sua linha. Exigir
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
    return parseChord(m[1]);
  }

  /** Transpoe UMA linha de texto, trocando so os tokens de acorde. */
  function transposeLine(line, semis, flat, emLinhaDeAcordes) {
    if (!line) return line;
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
      const whole = raw.replace(/^[("'[]+/, '').replace(/[)"'\],.!?;:]+$/, '');
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
    if (!semis) return String(text == null ? '' : text);
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
      const core = raw.replace(/^[("'[]+/, '').replace(/[)"'\],.!?;:]+$/, '');
      if (!core) return raw;
      const c = parseChord(core);
      if (!c) return raw;

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
  function scaleNames(rootPc, scaleKey, flat) {
    return scaleNotes(rootPc, scaleKey, flat).map((pc) => noteName(pc, flat));
  }
  function scaleChords(rootPc, scaleKey, flat) {
    const sc = SCALES[scaleKey] || SCALES.major;
    const out = [];
    for (let i = 0; i < sc.iv.length; i++) {
      const pc = mod12(rootPc + sc.iv[i]);
      const q = triadFor(sc.iv, i);
      out.push({
        degree: sc.degrees[i] || String(i + 1),
        pc,
        quality: q,
        name: formatChord(pc, q === 'm' ? 'm' : q === 'dim' ? 'dim' : q === 'aug' ? 'aug' : '', null, flat),
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

  /** Verifica se um voicing (array de trastes) forma o acorde pedido. */
  function validateVoicing(frets, rootPc, quality) {
    const q = QUALITIES[QUALITIES[quality] ? quality : ''];
    const want = new Set(q.iv.map((i) => mod12(rootPc + i)));
    const played = [];
    for (let i = 0; i < 6; i++) {
      if (frets[i] < 0) continue;
      const pc = mod12(OPEN_PC[i] + frets[i]);
      played.push({ pc, string: i, fret: frets[i] });
    }
    if (played.length < 3) return null;
    const set = new Set(played.map((p) => p.pc));
    // obrigatorio: fundamental e 3a
    if (!set.has(mod12(rootPc))) return null;
    if (!set.has(mod12(rootPc + (q.iv[1] !== undefined ? q.iv[1] : 4)))) return null;
    // evita voicings com so 3 notas quando cabem mais
    if (played.length < 4 && q.iv.length <= 3) return null;
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
    if (span > 4) return null;
    return played;
  }

  /**
   * Pontua um voicing (maior = melhor), imitando a preferencia de um
   * guitarrista: posicao aberta, pegada curta, poucas cordas mudas e
   * sem a "bolha" na 4a corda.
   */
  function scoreVoicing(frets, rootPc, quality) {
    const q = QUALITIES[QUALITIES[quality] ? quality : ''];
    const fs = [];
    let mutes = 0;
    for (let i = 0; i < 6; i++) {
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
    // bolha na 4a corda (3a)
    if (frets[2] >= 0) {
      const b = mod12(OPEN_PC[2] + frets[2]) - mod12(rootPc);
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

  /** Busca exaustiva por trastes (usada como complemento). */
  function searchShapes(rootPc, quality, maxFret, budget) {
    const q = QUALITIES[QUALITIES[quality] ? quality : ''];
    const wantSet = new Set(q.iv.map((i) => mod12(rootPc + i)));
    const found = [];
    const seen = new Set();
    let left = budget || 60000;

    const roots = [];
    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= maxFret; f++) {
        if (mod12(OPEN_PC[s] + f) === mod12(rootPc)) roots.push({ s, f });
      }
    }
    roots.sort((a, b) => a.f - b.f || b.s - a.s);

    for (const r of roots) {
      if (found.length >= 24 || left <= 0) break;
      const lo = Math.max(0, r.f - 3), hi = r.f + 3;
      const opts = [];
      for (let s = 0; s < 6; s++) {
        const arr = [];
        const fs = [0];
        for (let f = lo; f <= hi; f++) if (f > 0) fs.push(f);
        for (const f of fs) {
          if (f > maxFret) continue;
          if (wantSet.has(mod12(OPEN_PC[s] + f))) arr.push(f);
        }
        opts.push(arr);
      }
      if (opts[r.s].indexOf(r.f) === -1) continue;
      const cur = new Array(6).fill(-1);
      cur[r.s] = r.f;
      let best = null;
      (function rec(s) {
        if (left-- <= 0) return;
        if (s === 6) {
          const played = validateVoicing(cur, rootPc, quality);
          if (played) {
            const sc = scoreVoicing(cur, rootPc, quality);
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
  function fretNote(stringIdx, fret) {
    return mod12(OPEN_PC[stringIdx] + fret);
  }
  /** Nome da nota de uma corda/traste, ja formatado. */
  function fretNoteName(stringIdx, fret, flat) {
    return noteName(mod12(OPEN_PC[stringIdx] + fret), flat);
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
    // acordes
    QUALITIES, parseChord, formatChord, chordInfo, matchQuality, isChordWord, PT_STOPWORDS,
    // cifra
    tokenizeLine, isChordLine, isSectionLine, sectionLabel, keyDirective,
    transposeLine, transposeCifra, transposeCifraPorGrau, semitonsEntre, grauDe,
    extractChords, detectKey, analyzeChords,
    // escalas
    SCALES, triadFor, scaleNotes, scaleNames, scaleChords, closestTerm,
    // círculo
    CIRCLE, circleIndexOf, relativeMinor, relativeMajor, sharpsCount, useFlatsFor,
    // guitarra
    TUNING, OPEN_PC, STRING_LABELS, guitarShapes, fretNote, fretNoteName, fretsForNote, fretDelta,
    // tons
    keyLabel, modeName,
  };

  global.Music = Music;
  if (typeof module !== 'undefined' && module.exports) module.exports = Music;
})(typeof window !== 'undefined' ? window : globalThis);

