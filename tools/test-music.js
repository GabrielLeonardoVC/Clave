/* Testes de regressao do motor de teoria musical.
   Rodar:  node tools/test-music.js                              */
const M = require('../js/core/music.js');

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log((ok ? '  ok   ' : '  FALHA') + '  ' + label +
    (ok ? '' : '  -> obtido "' + actual + '", esperado "' + expected + '"'));
}
function ok(cond, label) { eq(cond ? 'sim' : 'nao', 'sim', label); }

console.log('\n=== 1. Formas de acorde aceitas ===');
['C', 'Cm', 'CM', 'CM7', 'Cm7', 'Cmaj7', 'Cmin7', 'Cdim', 'Cdim7', 'C°', 'C°7', 'Co7',
  'Cm7b5', 'Cø7', 'Csus', 'Csus2', 'Csus4', 'C7sus4', 'Cadd9', 'Cadd2', 'C6', 'Cm6',
  'C6/9', 'C9', 'Cmaj9', 'Cm9', 'Cm11', 'C13', 'Caug', 'C+', 'C5', 'C-', 'C-7', 'C/D',
  'Bbmaj7/D', 'F#m7b5', 'Bb', 'C#dim7', 'Abm7', 'Gmaj13', 'Ebm7b5', 'D7sus2', 'A#m9',
  'CmM7'].forEach((c) => ok(!!M.parseChord(c), 'parseia "' + c + '"'));

console.log('\n=== 2. Palavras em portugues NAO viram acorde ===');
['faltara', 'Senhor', 'maior', 'ai', 'nota', 'amor', 'coracao', 'amar', 'idade', 'sede',
  'todo', 'gente', 'tarde', 'fazer', 'vida', 'calma', 'dias', 'deus', 'alma', 'salmo',
  'canto', 'monte', 'vento', 'forca', 'graca', 'obra', 'maria'].forEach(
  (w) => ok(!M.parseChord(w), '"' + w + '" nao e acorde'));
// palavras que o regex aceitaria, mas a lista de palavras doit Barrar
['e', 'a', 'o', 'as', 'de', 'da', 'que', 'me', 'te', 'se', 'um', 'uma', 'meu', 'tua',
  'voce', 'ele', 'ela', 'nao', 'sim'].forEach(
  (w) => ok(!M.isChordWord(w), 'tokenizador trata "' + w + '" como letra'));

console.log('\n=== 3. Semantica das qualidades ===');
[['', ''], ['m', 'm'], ['M7', 'maj7'], ['m7', 'm7'], ['min7', 'm7'], ['maj7', 'maj7'],
  ['maj9', 'maj9'], ['dim7', 'dim7'], ['°', 'dim'], ['ø', 'm7b5'], ['+', 'aug'],
  ['6/9', '6/9'], ['sus', 'sus4'], ['sus4', 'sus4'], ['-', 'm'], ['-7', '7'],
  ['7sus4', '7sus4'], ['m7b5', 'm7b5'], ['add9', 'add9'], ['13', '13'],
  ['9', '9']].forEach(([i, e]) => eq(M.matchQuality(i), e, 'sufixo "' + i + '"'));

console.log('\n=== 4. Notas de cada acorde (teoria) ===');
[['C', 4], ['Cm', 3], ['C7', 10], ['Cmaj7', 11], ['Cm7', 10], ['Cdim', 3],
  ['Cm7b5', 3], ['Csus4', 5], ['Csus2', 2], ['Cadd9', 2], ['C6', 9],
  ['Cdim7', 3], ['Caug', 4]].forEach(([ch, thirdIc]) => {
  const p = M.parseChord(ch);
  const info = M.chordInfo(p.root, p.quality);
  const thirdPc = M.mod12(p.root + thirdIc);
  ok(info.notes.indexOf(thirdPc) >= 0,
    ch + ' contem a 3a (' + M.noteName(thirdPc, false) + ') -> ' + info.labels.join(' '));
});
// a 5a tem de estar presente nas tríades terças menores
['C', 'Cm', 'C7', 'Cmaj7', 'Cm7'].forEach((ch) => {
  const p = M.parseChord(ch);
  const info = M.chordInfo(p.root, p.quality);
  ok(info.notes.indexOf(M.mod12(p.root + 7)) >= 0,
    ch + ' contem a 5a (G) -> ' + info.labels.join(' '));
});

console.log('\n=== 5. Transposicao ===');
eq(M.transposeLine('Am   F   C/G', 2, false), 'Bm   G   D/A', 'Am F C/G +2 semitons');
eq(M.transposeLine('C  G  Am  F', -1, true), 'B  Gb  Abm  E', 'C G Am F -1 com bemois');
eq(M.transposeLine('C  G  Am  F', 2, false), 'D  A  Bm  G', 'C G Am F +2');
eq(M.transposeLine('[C]', 2, false), '[D]', 'diretiva de tom [C] +2');
eq(M.transposeLine('O Senhor e o meu pastor', 5, false),
  'O Senhor e o meu pastor', 'letra nao e alterada');
eq(M.transposeLine('Nada me faltara, Senhor', 5, false),
  'Nada me faltara, Senhor', 'letra com palavras perigosas intacta');

console.log('\n=== 6. Extracao de acordes ===');
eq(M.extractChords('C        G\nO Senhor e o meu pastor').map((c) => c.text).join(' '),
  'C G', 'acordes em linha de letra');
eq(M.extractChords('Nada me faltara, Senhor\nAm   F   C/G').map((c) => c.text).join(' '),
  'Am F C/G', 'baixo preservado em C/G');
eq(M.extractChords('C     G/B     Am      F\nO Senhor').map((c) => c.text).join(' '),
  'C G/B Am F', 'acorde com baixo G/B');

console.log('\n=== 7. Deteccao de tom (cifras realistas) ===');
function keyName(cifra) {
  const k = M.detectKey(cifra);
  if (!k) return 'nenhum';
  return M.noteName(k.pc, M.useFlatsFor(k.pc)) + (k.mode === 'minor' ? 'm' : '');
}
const KEY_CASES = [
  ['[C]\nO Senhor e o meu pastor\nC        G\nNada me faltara\nAm   F   C/G\nNada me faltara', 'C'],
  ['[G]\nAmazing grace how sweet the sound\nG         C\nThat saved a wretch like me\nG   C  G', 'G'],
  ['[Am]\nHa algo que somente tu sabes fazer\nAm      Dm\nNao me ressuscitara\nF   C   Am\nMais um motivo pra te adorar', 'Am'],
  ['[F]\nA           F#\nLouvor a ti\nBb   C   F\nPai', 'F'],
  ['[D]\nA         A\nSantos os que andam\nD   G   D\nNa fé', 'D'],
  ['[E]\nE       B/C#\nMeus dois olhos\nA       E\nQuerem te ver', 'E'],
  ['[Bb]\nBb      F/A\nPai eu te amo\nGm   Eb   Bb\nPai', 'Bb'],
  ['[Dm]\nDm            Gm\nNo tempo do meu\nBb         C\nSo tu me podes dar', 'Dm'],
  ['[Em]\nEm       C\nQuando o sol se ponha\nG       D\nMe lembra de ti', 'Em'],
  ['[A]\nA        D/F#\nSenhor eu te amo\nBm      E7\nCom todo o meu coracao', 'A'],
];
KEY_CASES.forEach(([c, e]) => eq(keyName(c), e, 'detecta "' + e + '"'));

// progressoes ambiguas: o tom declarado entre colchetes deve ganhar
[['[Em]\nEm   C   G   D', 'Em'],
  ['[Am]\nAm   F   C   G', 'Am'],
  ['[C]\nC   G   Am   F', 'C']].forEach(([c, e]) =>
  eq(keyName(c), e, 'tom declarado vence a ambiguidade de "' + e + '"'));

console.log('\n=== 8. Graus romanos ===');
const maj = (r, q) => ({ root: r, quality: q || '' });
const min = (r, q) => ({ root: r, quality: q || 'm' });
eq(M.analyzeChords([maj(0), min(9), maj(7), maj(5)], 0, 'major')
  .map((a) => a.degree).join(' '), 'I vi V IV', 'I-vi-V-IV em C maior');
eq(M.analyzeChords([min(9), min(4), maj(5), maj(7)], 9, 'minor')
  .map((a) => a.degree).join(' '), 'i v VI VII', 'i-v-VI-VII em A menor (todos menores/maiores explicitos)');
eq(M.analyzeChords([min(9), maj(4), maj(5), maj(7)], 9, 'minor')
  .map((a) => a.degree).join(' '), 'i V VI VII', 'E maior em Am conta como dominante harmonica');
eq(M.analyzeChords([maj(0), maj(7), maj(5)], 0, 'major')
  .map((a) => a.degree).join(' '), 'I V IV', 'I-V-IV em C maior');
eq(M.analyzeChords([min(2), maj(7), min(9)], 0, 'major')
  .map((a) => a.degree).join(' '), 'ii V vi', '2a e 6a ficam minusculas');
eq(M.analyzeChords([maj(11, '7')], 0, 'major').map((a) => a.degree).join(' '),
  'VII7', 'B7 em C maior e um acorde emprestado (grau 7 com 7a maior)');
eq(M.analyzeChords([min(5, 'm7b5')], 0, 'major').map((a) => a.degree).join(' '),
  'iv\u00F8', 'meio-diminuto no 4o grau');
eq(M.analyzeChords([maj(1)], 0, 'major').map((a) => a.degree).join(' '),
  '\u266DII', 'acorde fora da escala (Db) recebe bemol');
eq(M.analyzeChords([maj(2, 'm')], 0, 'major').map((a) => a.degree).join(' '),
  'ii', 'Dm em C maior e o 2o grau');
eq(M.analyzeChords([min(9), maj(4, '7')], 9, 'minor').map((a) => a.degree).join(' '),
  'i V7', 'dominante harmonica em tom menor');

console.log('\n=== 9. Escalas ===');
eq(M.scaleNames(0, 'major', false).join(' '), 'C D E F G A B', 'maior de Do');
eq(M.scaleNames(9, 'minor', false).join(' '), 'A B C D E F G', 'menor de La');
eq(M.scaleNames(0, 'pentMinor', false).join(' '), 'C D# F G A#', 'pentatonica menor de Do');
eq(M.scaleNames(0, 'pentMinor', true).join(' '), 'C Eb F G Bb', 'pentatonica menor (bemois)');
eq(M.scaleChords(0, 'major', false).map((c) => c.name).join(' '),
  'C Dm Em F G Am Bdim', 'acordes da maior de Do');
eq(M.scaleChords(0, 'minor', true).map((c) => c.name).join(' '),
  'Cm Ddim Eb Fm Gm Ab Bb', 'acordes da menor natural de Do');
eq(M.scaleChords(0, 'harmonic', true).map((c) => c.name).join(' '),
  'Cm Ddim Ebaug Fm G Ab Bdim', 'acordes da menor harmonica de Do');
eq(M.scaleChords(0, 'melodic', true).map((c) => c.name).join(' '),
  'Cm Dm Ebaug F G Adim Bdim', 'acordes da menor melodica de Do');
eq(M.closestTerm(0, 7), 'Dominante', 'Sol e dominante de Do');

console.log('\n=== 10. Circulo das quintas ===');
eq(M.relativeMinor(0), 9, 'relativa menor de C = A');
eq(M.relativeMajor(9), 0, 'relativa maior de A = C');
eq(M.sharpsCount(0), 0, 'C nao tem alteracoes');
eq(M.sharpsCount(7), 1, 'G tem 1 alteracao');
eq(M.sharpsCount(10), 2, 'D tem 2 alteracoes');
eq(M.sharpsCount(5), 1, 'F tem 1 bemol');
eq(M.useFlatsFor(5), true, 'F usa bemois');
eq(M.useFlatsFor(0), false, 'C usa oficiais');
eq(M.useFlatsFor(10), true, 'Bb usa bemois');
eq(M.useFlatsFor(7), false, 'G usa oficiais');

console.log('\n=== 11. Guitarra: formas canonicas ===');
const CANON = {
  C: ['x 3 2 0 1 0'], Am: ['x 0 2 2 1 0'], G: ['3 2 0 0 0 3'],
  F: ['1 3 3 2 1 1', 'x 8 10 10 10 8'], E: ['0 2 2 1 0 0'],
  D: ['x x 0 2 3 2', 'x 5 7 7 7 5'], A: ['x 0 2 2 2 0'],
  Em: ['0 2 2 0 0 0'], Dm: ['x x 0 2 3 1'], B7: ['x 2 1 2 0 2'],
  C7: ['x 3 2 3 1 0'], 'F#m': ['2 4 4 2 2 2'],
  Bb: ['x 1 3 3 1 1', 'x 1 3 3 3 1'], D7: ['x x 0 2 1 2', 'x x 0 0 2 2'],
  Gmaj7: ['3 2 0 0 0 2', '3 5 4 3 3 3'], Em7: ['0 2 0 0 0 0'],
  Cm7: ['x 3 5 5 4 3', 'x 3 5 3 4 3'], Cmaj7: ['x 3 2 0 0 0', 'x 3 5 4 5 3'],
  Gsus4: ['3 3 5 5 3 3'], Dm7: ['x x 0 2 1 1', 'x x 0 0 2 1'],
  Asus2: ['x 0 2 2 0 0'], Bdim: ['x 2 0 x 0 1', 'x 2 3 4 3 x'],
  Bdim7: ['x 2 0 1 0 1'], 'C#m': ['x 4 6 6 5 4'], Eb: ['x 6 8 8 8 6'],
  G7: ['3 2 0 0 0 1'], Ab: ['4 6 6 5 4 4'], Ebm: ['x 6 8 8 7 6'],
  Fmaj7: ['1 0 2 2 1 1', '1 0 3 2 1 0'], Bbmaj7: ['x 1 3 2 3 1', 'x 1 3 2 1 0'],
  Bdim7: ['x 2 0 1 0 1'], Gsus4: ['3 3 5 5 3 3'], Emaj7: ['0 x 1 1 0 0', '0 2 2 1 4 0'],
  Dmaj7: ['x x 0 2 2 2'], Amaj7: ['x 0 2 1 2 0'], Cadd9: ['x 3 0 0 1 0', 'x 3 2 0 3 0'],
};
Object.keys(CANON).forEach((ch) => {
  const p = M.parseChord(ch);
  const lista = M.guitarShapes(p.root, p.quality, { maxFret: 12, limit: 6 })
    .map((s) => s.map((f) => (f < 0 ? 'x' : f)).join(' '));
  ok(lista.some((g) => CANON[ch].indexOf(g) >= 0),
    ch + ' -> ' + (lista[0] || 'nenhuma'));
});

console.log('\n=== 12. Guitarra: coerencia_intervalos ===');
let badShape = 0, totalShape = 0, semForma = 0;
Object.keys(CANON).forEach((ch) => {
  const p = M.parseChord(ch);
  const shapes = M.guitarShapes(p.root, p.quality, { maxFret: 12, limit: 6 });
  if (!shapes.length) { semForma++; console.log('       SEM FORMA: ' + ch); return; }
  const info = M.chordInfo(p.root, p.quality);
  shapes.forEach((sh) => {
    totalShape++;
    const played = sh.map((f, i) => (f < 0 ? null : M.fretNote(i, f)));
    const set = played.filter((x) => x !== null);
    const problems = [];
    if (set.indexOf(p.root) < 0) problems.push('sem fundamental');
    if (set.indexOf(info.notes[1]) < 0) problems.push('sem 3a');
    if (set.some((x) => info.notes.indexOf(x) < 0)) problems.push('nota fora do acorde');
    const firstIdx = sh.findIndex((f) => f >= 0);
    if (M.fretNote(firstIdx, sh[firstIdx]) !== p.root) problems.push('baixo nao e a fundamental');
    if (problems.length) {
      badShape++;
      if (badShape <= 6) {
        console.log('       ' + ch + ' [' + sh.join('-') + ']: ' + problems.join(', '));
      }
    }
  });
});
eq(badShape, 0, 'todas as posicoes sao coerentes (' + totalShape + ' verificadas)');
eq(semForma, 0, 'todo acorde da lista tem pelo menos 1 posicao');

console.log('\n=== 13. Idempotencia ===');
const t1 = 'Am   F   C/G';
eq(M.transposeLine(M.transposeLine(t1, 5, false), -5, false), t1,
  'transpor +5 e depois -5 volta ao original');
eq(M.transposeCifra(t1, 12, false), t1, 'transpor 12 semitons nao muda nada');
eq(M.transposeCifra('[C]\nAm   F   C/G', 12, false), '[C]\nAm   F   C/G',
  'cifra inteira volta ao original em 12 semitons');

console.log('\n=== 14. Desempenho ===');
const t0 = Date.now();
for (let i = 0; i < 60; i++) {
  const ch = ['C', 'Am', 'G7', 'Fmaj7', 'Bdim7', 'C#m7b5', 'Eb', 'D7sus4'][i % 8];
  const p = M.parseChord(ch);
  M.guitarShapes(p.root, p.quality, { maxFret: 15, limit: 8 });
}
const dt = Date.now() - t0;
ok(dt < 4000, '60 geracoes de posicoes em ' + dt + 'ms (limite 4000ms)');

console.log('\n=== 15. Regressao: baixo com acidente ===');
// O baixo vinha do regex como um grupo so, letra junto com o acidente, e esse
// grupo era passado a pcFromAccidental como se fosse so a letra. A busca na
// tabela devolvia undefined, o undefined virava NaN, e a cifra saia impressa
// com a palavra "undefined" no lugar da nota.
eq(M.parseChord('F#/A#').bass, 10, 'F#/A# le o baixo A# (e nao NaN)');
eq(M.parseChord('F#/Ab').bass, 8, 'F#/Ab le o baixo Ab');
eq(M.parseChord('C#m7b5/E#').bass, 5, 'C#m7b5/E# le o baixo E#');
eq(M.parseChord('C/G').bass, 7, 'C/G continua lendo o baixo G');
eq(M.parseChord('Bbmaj7/D').bass, 2, 'Bbmaj7/D continua lendo o baixo D');
ok(!/undefined|NaN/.test(M.transposeCifra('[F#]\nF#/A#    C#m7b5/E#', 2, false)),
  'transpor acorde com baixo acentuado nao escreve "undefined"');
eq(M.transposeCifra('[F#]\nF#/A#', 2, false), '[G#]\nG#/C',
  'baixo acentuado transpode pelo intervalo (A# +2 = C), e a diretiva de tom tambem');

console.log('\n=== 16. Regressao: um acorde por vez ===');
// isChordLine exigia dois acordes na linha, o que descartava o formato de
// Quem usa escreve um acorde por vez. O formato e comum, e ele era descartado
// inteiro: a musica nao transpunha e saia no tom original, sem aviso.
ok(M.isChordLine('C'), 'linha so com C e linha de acordes');
ok(M.isChordLine('C/G'), 'linha so com C/G e linha de acordes');
ok(M.isChordLine('Bbmaj7'), 'linha so com Bbmaj7 e linha de acordes');
['a', 'e', 'em'].forEach((c) => ok(M.isChordLine(c.toUpperCase()),
  'linha so com ' + c.toUpperCase() + ' e linha de acordes (palavra que tambem e acorde)'));
ok(!M.isChordLine('A minha alma'), '"A minha alma" continua sendo letra');
ok(!M.isChordLine('E o Senhor'), '"E o Senhor" continua sendo letra');
ok(!M.isChordLine('Ao meu lado'), '"Ao meu lado" continua sendo letra');
ok(!M.isChordLine('Amém'), '"Amém" continua sendo letra');
eq(M.transposeCifra('[C]\nC\nO Senhor e o meu pastor\n\nG\nNada me faltara', 2, false),
  '[D]\nD\nO Senhor e o meu pastor\n\nA\nNada me faltara',
  'cifra de um acorde por vez transpoe, com a letra intacta');
eq(M.transposeCifra('[C]\nB7', 2, false), '[D]\nC#7', 'acorde so com B7 transpoe');
eq(M.transposeCifra('[C]\nB7\nFalsa', 2, false), '[D]\nC#7\nFalsa',
  '"Falsa" e palavra, e continua palavra depois de transpor');

console.log('\n=== 17. Regressao: acorde que tambem e palavra ===');
// A, E e Em estao na lista de palavras portuguesas e, por isso, ficavam
// parados a cada transposicao — sem erro, sem aviso. A progressao saia errada:
//     Em  C  G  D  +2  ->  Em  D  A  E
// A linha inteira ja foi reconhecida como linha de acordes; reavaliar token
// por token dentro dela jogava fora essa decisao.
eq(M.transposeCifra('[C]\nEm   C   G   D', 2, false), '[D]\nF#m   D   A   E',
  'Em no meio da progressao transpoe');
eq(M.transposeCifra('[C]\nA   E   D', 2, false), '[D]\nB   F#   E',
  'A e E no meio da progressao transpoem');
eq(M.transposeCifra('[C]\nE   A   D', 2, false), '[D]\nF#   B   E',
  'E e A no meio da progressao transpoem');
eq(M.transposeCifra('[C]\nC   Em   Am', 2, false), '[D]\nD   F#m   Bm',
  'Em entre dois acordes transpoe');
eq(M.transposeCifra('[C]\nA', 2, false), '[D]\nB', 'linha so com A transpoe para B');
eq(M.transposeCifra('[C]\nE', 2, false), '[D]\nF#', 'linha so com E transpoe para F#');
eq(M.transposeCifra('[C]\nEm', 2, false), '[D]\nF#m', 'linha so com Em transpoe para F#m');
// O outro lado: a letra nao pode virar acorde por causa disso.
eq(M.transposeCifra('[C]\nA glória do Senhor', 2, false), '[D]\nA glória do Senhor',
  '"A gloria do Senhor" continua letra, com o A intacto');
eq(M.transposeCifra('[C]\nEm tua mão', 2, false), '[D]\nEm tua mão',
  '"Em tua mao" continua letra');

console.log('\n=== 18. Transposicao por grau ===');
// Reatribui os graus da escala em vez de aplicar um numero fixo de semitons.
// O caso que motiva: Do maior e La menor tem a mesma armadura, entao nao sao
// transposicao uma da outra. Levando por 9 semitons, o Am de Do vira F#, e o
// certo em La menor e C. Nao existe numero de semitons que acerte os dois.
const cGraus = '[C]\nC        G\nO Senhor e o meu pastor\nAm       F\nC         G\n';

// Só os acordes, sem a grade. A coluna de cada acorde muda de lugar quando o
// nome fica mais curto ou mais longo — C vira Am e ocupa duas casas —, e isso
// é característica do transpositor, igual ao que já fazia transposeLine. O que
// importa aqui é qual acorde foi escolhido, e não onde ele caiu.
function acordesDe(cifra) {
  return cifra.split('\n')
    .filter(function (l) { return l.trim() && !/O Senhor/.test(l); })
    .map(function (l) { return l.replace(/^\[[^\]]+\]\s*/, '').trim().split(/\s+/).join(' '); })
    .filter(function (l) { return l; })
    .join(' | ');
}
function tomDe(cifra) {
  const m = /^\[([^\]]+)\]/.exec(cifra);
  return m ? m[1] : '';
}

eq(acordesDe(M.transposeCifraPorGrau(cGraus, 7, 'major')), 'G D | Em C | G D',
  'Do maior -> Sol maior reatribui os graus');
eq(acordesDe(M.transposeCifraPorGrau(cGraus, 9, 'minor')), 'Am Em | F Dm | Am Em',
  'Do maior -> La menor: o Am vira F, e nao F#');
eq(acordesDe(M.transposeCifraPorGrau(cGraus, 2, 'minor')), 'Dm Am | Bb Gm | Dm Am',
  'Re menor escreve o sexto grau com bemol (Bb), e nao A#');
eq(acordesDe(M.transposeCifraPorGrau(cGraus, 4, 'minor')), 'Em Bm | C Am | Em Bm',
  'Mi menor escreve o sexto grau sem accidental');
eq(acordesDe(M.transposeCifraPorGrau(cGraus, 7, 'minor')), 'Gm Dm | Eb Cm | Gm Dm',
  'Sol menor: o i e o v menores, e os graus com bemol');
eq(acordesDe(M.transposeCifraPorGrau(cGraus, 5, 'major')), 'F C | Dm Bb | F C',
  'Do maior -> Fa maior');

// A armadura e do tom, nao da tonica sozinha: Re menor tem bemol, Re maior nao.
eq(tomDe(M.transposeCifraPorGrau(cGraus, 2, 'minor')), 'Dm', 'a diretiva vira o tom pedido');
eq(tomDe(M.transposeCifraPorGrau(cGraus, 9, 'minor')), 'Am', 'diretiva de menor leva o m');

// Inversao preservada: o que se mantem e o baixo, e nao a nota.
eq(acordesDe(M.transposeCifraPorGrau('[C]\nC/G', 7, 'major')), 'G/D',
  'C/G em Do -> Sol vira G/D, com a quinta no baixo');
// Acorde emprestado: nao e diatonico na origem, mas e na de destino, e a
// funcao dele e justamente estar ali. C#m7b5 e o setimo grau de Re maior, e
// F#dim e o terceiro.
eq(acordesDe(M.transposeCifraPorGrau('[C]\nF#7   C#7', 7, 'major')), 'F#7 G#7',
  'F#7 fica F#7 em Sol maior, em vez de virar C#7');
eq(acordesDe(M.transposeCifraPorGrau('[C]\nC#m7b5', 2, 'major')), 'C#m7b5',
  'acorde diatonico no destino fica onde esta');

// Estranho dos dois lados: desloca e mantem a qualidade escrita. Eb nao esta
// em Do maior nem em Re maior, nem como quinta de nenhum grau dos dois, entao
// nao ha grau que possa ser transportado.
eq(acordesDe(M.transposeCifraPorGrau('[C]\nEbmaj7', 2, 'major')), 'Fmaj7',
  'acorde strangerio desloca e mantem a qualidade');

// Propriedades que nao podem quebrar.
[7, 9, 2, 4, 5, 10, 0, 3].forEach(function (pc) {
  ['major', 'minor'].forEach(function (modo) {
    const t = M.transposeCifraPorGrau(cGraus, pc, modo);
    eq(/Cb|E#|Fb|B#|##|bb/.test(t), false, pc + ' ' + modo + ' nunca produz duplo acidente');
    eq(t.indexOf('O Senhor e o meu pastor') > 0, true, pc + ' ' + modo + ' preserva a letra');
  });
});
// Ida e volta pelo mesmo caminho devolve a cifra original.
eq(acordesDe(M.transposeCifraPorGrau(M.transposeCifraPorGrau(cGraus, 9, 'minor'), 0, 'major')),
  acordesDe(cGraus), 'La menor -> Do maior devolve os acordes originais');

/* =======================================================
   ARMADURA E RESUMO DE TONS
   A placa de tom da tela inicial depende disto. Um erro aqui nao quebra a
   pagina: mostra "2 sustenos" para um tom que nao tem nenhum, e o musico
   desafina a corda antes de comecar.
   ======================================================= */
console.log('\n=== ARMADURA: tom maior ===');
eq(M.armadura(0, 'major').quantidade, 0, 'Do maior nao tem alteracao');
eq(M.armadura(5, 'major').bemois, true, 'Fa maior tem bemol');
eq(M.armadura(5, 'major').quantidade, 1, 'Fa maior tem 1 bemol');
eq(M.armadura(10, 'major').quantidade, 2, 'Sib maior tem 2 bemois');
eq(M.armadura(7, 'major').quantidade, 1, 'Sol maior tem 1 susteno');
eq(M.armadura(9, 'major').quantidade, 3, 'La maior tem 3 sustenos');
eq(M.armadura(1, 'major').quantidade, 5, 'Dost susteno entra pelo lado do Reb: 5 bemois');
eq(M.armadura(1, 'major').bemois, true, 'e sao bemois, pela convencao do circulo');
eq(M.armadura(11, 'major').quantidade, 5, 'Si maior tem 5 sustenos');

console.log('\n=== ARMADURA: a ordem das alteracoes ===');
eq(M.armadura(9, 'major').ordem.join(''), 'FCG', 'La maior: F, C, G');
eq(M.armadura(10, 'major').ordem.join(''), 'BE', 'Sib maior: B, E');
eq(M.armadura(5, 'major').ordem.join(''), 'B', 'Fa maior: B');
eq(M.armadura(0, 'major').ordem.join(''), '', 'Do maior: nenhuma alteracao');
// A convencao do app passa de 6 horas no circulo e escreve com bemois, entao
// o maior numero de alteracoes e 6, e 7 sustenos nao aparece.
{
  const qs = [];
  for (let pc = 0; pc < 12; pc++) qs.push(M.armadura(pc, 'major').quantidade);
  eq(qs.slice().sort((a, b) => a - b).join(''), '011223344556',
    'as 12 armaduras de maior dao 0 a 6, com cada par de enarmonicos igual');
  eq(qs.indexOf(7) < 0, true, 'nenhuma armadura passa de 6 alteracoes');
}

console.log("\n=== ARMADURA: o menor tem conta propria ===");
/* Este ponto e o que mais da errado, e a regra que vale NAO e a do relativo
 * maior.
 *
 * O que e verdade: a armadura de um menor tem o mesmo NUMERO de alteracoes
 * que a do seu relativo maior. Re menor tem 1 bemol, o mesmo de Fa maior. Isso
 * segue de a tonica do menor estar uma terceira menor acima do relativo.
 *
 * O que NAO e verdade: que as duas sejam escritas do mesmo jeito. O relativo de
 * Mi menor e Sol sustenido maior, que tem 6 SUSTENOS; mas o nome de Mi menor
 * e de um tom que se escreve com BEMOL, e a armadura do Mi menor sao 6 bemois.
 * O mesmo para La menor: o relativo e Si maior (5 sustenos), e a armadura do
 * La menor sao 7 bemois, porque o par enarmonico de verdade do La menor nao e
 * Si maior e sim Dobemol maior.
 *
 * A altura e a mesma em todos esses casos. A LETRA e que nao e, e e a letra que
 * o musico le. A versao anterior deste teste afirmava "todo menor tem a mesma
 * armadura do seu relativo maior" e passava, porque a conta errada do motor
 * satisfazia a regra falsa. Regra que concorda com o defeito nao protege nada:
 * ela so trava o erro no lugar. As tabelas de referencia estao em
 * tools/test-teoria.js, escritas a mao. */
eq(M.armadura(2, "minor").quantidade, 1, "Re menor tem 1 bemol, nao 2 sustenos");
eq(M.armadura(2, "minor").bemois, true, "e o bemol vem do Fa maior");
eq(M.armadura(9, "minor").quantidade, 0, "La menor nao tem alteracao");
eq(M.armadura(4, "minor").quantidade, 1, "Mi menor tem 1 susteno");
eq(M.armadura(0, "minor").quantidade, 3, "Do menor tem 3 bemois");
eq(M.armadura(0, "minor").bemois, true, "e vem do Mib maior");
eq(M.armadura(7, "minor").quantidade, 2, "Sol menor tem 2 bemois");
eq(M.armadura(11, "minor").quantidade, 2, "Si menor tem 2 sustenos");

/* Os DOZE, com o lado junto. E esta a tabela que pega o defeito. */
var ARM_MENOR = [
  [0, 3, true], [1, 4, false], [2, 1, true], [3, 6, true], [4, 1, false],
  [5, 4, true], [6, 3, false], [7, 2, true], [8, 7, true], [9, 0, false],
  [10, 5, true], [11, 2, false],
];
var NOMES12 = "C Db D Eb E F Gb G Ab A Bb B".split(" ");
ARM_MENOR.forEach(function (linha) {
  var a = M.armadura(linha[0], "minor");
  var unidade = linha[1] === 0
    ? " sem alteracao"
    : (linha[2] ? " bemois" : " sustenos");
  eq(a.quantidade, linha[1],
    NOMES12[linha[0]] + " menor: " + linha[1] + unidade, a.quantidade);
  eq(a.bemois, linha[2], NOMES12[linha[0]] + " menor fica do lado certo");
});

/* O NUMERO bate com o do relativo maior em onze das doze classes. A que
 * escapa e a classe 8, La menor: o relativo de La menor e Si maior, que tem 5
 * sustenos, e o La menor tem 7 bemois. A diferenca NAO e erro de conta: e o
 * par enarmonico, que so se resolve com a letra da tonica. */
(function () {
  var fora = [];
  for (var pc = 0; pc < 12; pc++) {
    var rel = M.relativeMajor(pc);
    if (M.armadura(pc, "minor").quantidade !== M.armadura(rel, "major").quantidade) {
      fora.push(NOMES12[pc]);
    }
  }
  eq(fora.join(", "), "Ab",
    "o unico menor cuja quantidade nao bate com o relativo maior e o La menor");
}());

/* E o LADO bate em dez das doze. As duas que escapam sao justamente as duas em
 * que o relativo cai do outro lado do circulo: Mi menor (relativo Sol sustenido
 * maior) e La menor (relativo Si maior). Sao as duas mais usadas de todas, e
 * as duas que a conta antiga exibia ao contrario. */
(function () {
  var fora = [];
  for (var pc = 0; pc < 12; pc++) {
    var rel = M.relativeMajor(pc);
    var a = M.armadura(pc, "minor");
    var b = M.armadura(rel, "major");
    if (a.quantidade > 0 && a.bemois !== b.bemois) fora.push(NOMES12[pc]);
  }
  eq(fora.join(", "), "Eb, Ab",
    "os unicos menores que discordam do LADO do relativo sao Mi menor e La menor");
}());

console.log('\n=== RESUMO DE TONS: o tom do show ===');
const lista = [
  { pc: 9, modo: 'minor', rotulo: 'Am' },
  { pc: 9, modo: 'minor', rotulo: 'Am' },
  { pc: 9, modo: 'minor', rotulo: 'Am' },
  { pc: 2, modo: 'minor', rotulo: 'Bm' },
  { pc: 5, modo: 'major', rotulo: 'C' },
];
const res = M.resumoDeTons(lista);
eq(res.pc, 9, 'o tom mais frequente vence');
eq(res.modo, 'minor', 'e o modo dele');
eq(res.n, 3, 'tres musicas no tom escolhido');
eq(res.total, 5, 'cinco musicas no total');
eq(res.fora, 2, 'duas fora do tom');
eq(res.distintos, 3, 'tres tons distintos');
eq(res.armadura.quantidade, 0, 'La menor nao pede alteracao');
eq(res.rotulo, 'Am', 'o rotulo vem da propria musica');

console.log('\n=== RESUMO DE TONS: casos de borda ===');
eq(M.resumoDeTons([]), null, 'lista vazia nao devolve nada');
eq(M.resumoDeTons(null), null, 'nulo nao quebra');
eq(M.resumoDeTons([{ pc: 9, modo: 'minor' }]).fora, 0, 'uma musica so: zero fora');
eq(M.resumoDeTons([{ pc: 9, modo: 'minor' }, { pc: 0, modo: 'major' }]).fora, 1, 'empate: a segunda fica fora');
// Empate precisa ser estavel: a mesma lista tem de dar a mesma resposta.
eq(M.resumoDeTons([{ pc: 9 }, { pc: 0 }]).pc, 9, 'empate vai para o primeiro da lista');
eq(M.resumoDeTons([{ pc: 0 }, { pc: 9 }]).pc, 0, 'e o primeiro de novo, nao o maior');
// pc fora de 0..11 (dado sujo vindo do armazenamento) nao pode explodir.
eq(M.resumoDeTons([{ pc: 21, modo: 'major' }]).pc, 9, 'pc fora da faixa da a volta ao tom');
eq(M.resumoDeTons([{ pc: NaN }]), null, 'pc invalido e ignorado');
eq(M.resumoDeTons([{ pc: -3, modo: 'minor' }]).pc, 9, 'pc negativo da a volta ao tom');
// Modo desconhecido cai em maior, nao em undefined.
eq(M.resumoDeTons([{ pc: 0, modo: 'meio-tom' }]).modo, 'major', 'modo desconhecido vira maior');
// Todos diferentes: nao ha "fora" util, mas nao pode quebrar.
eq(M.resumoDeTons([{ pc: 0 }, { pc: 1 }, { pc: 2 }, { pc: 3 }]).n, 1, 'com tudo diferente, o maior bloco tem 1');

/* =======================================================
   INSTRUMENTOS
   Um gerador de formas que devolve basura e pior do que um que nao devolve
   nada: o desenho aparecer errado faz o usuario achar que o acorde e aquilo.
   Por isso cada forma devolvida e conferida nota a nota contra o acorde.
   ======================================================= */
console.log('\n=== INSTRUMENTOS: a tabela ===');
/* A contagem era 4 e foi conferida como 4 durante anos. Ela falhou quando
 * entraram o cavaquinho e o violino — e a contagem e a unica coisa aqui que
 * precisa mudar quando um instrumento entra, o que faz dela a verificacao que
 * mais-protecteda de ter valor.
 *
 * O que interessa nao e o numero: e que cada instrumento TEM timbre. Uma
 * verificacao de contagem protege contra o oposto do que parece — ela impede
 * de adicionar, e nao impede de adicionar errado. O `test-escolha` cobre o
 * caso que importa. */
eq(M.INSTRUMENTOS.filter(function (i) { return i.tipo === 'cordas'; }).length, 6, 'seis instrumentos de cordas (com braco)');
eq(M.INSTRUMENTO_PADRAO.id, 'violao', 'o padrao e o violao');
eq(M.instrumento('baixo').cordas, 4, 'baixo tem 4 cordas');
eq(M.instrumento('ukulele').cordas, 4, 'ukulele tem 4 cordas');
eq(M.instrumento('inexistente').id, 'violao', 'instrumento desconhecido cai no violao');
eq(M.instrumento(null).id, 'violao', 'instrumento nulo cai no violao');

console.log('\n=== INSTRUMENTOS: afinacoes ===');
// E A D G B E, de baixo para cima
eq(M.instrumento('violao').openPc.join(','), '4,9,2,7,11,4', 'violao em EADGBE');
eq(M.instrumento('baixo').openPc.join(','), '4,9,2,7', 'baixo em EADG');
eq(M.instrumento('baixo5').openPc.join(','), '11,4,9,2,7', 'baixo 5 cordas em BEADG');
eq(M.instrumento('ukulele').openPc.join(','), '7,0,4,9', 'ukulele em GCEA');
// O indice 0 e sempre a corda mais grave. E a convencao de que validateVoicing
// depende para exigir a fundamental na voz mais baixa. O MIDI e a prova: as
// cordas tem de subir de altura, e nao apenas de classe.
[['violao', 40, 64], ['baixo', 28, 43], ['baixo5', 23, 43], ['ukulele', 55, 69]].forEach(([id, maisGrave, maisAguda]) => {
  const I = M.instrumento(id);
  const sobe = I.openMidi.every((m, i) => i === 0 || m > I.openMidi[i - 1]);
  eq(sobe, true, id + ': as cordas sobem de altura, da mais grave para a mais aguda');
  eq(I.openMidi[0], maisGrave, id + ': comeca em ' + maisGrave);
  eq(I.openMidi[I.openMidi.length - 1], maisAguda, id + ': termina em ' + maisAguda);
  // openPc tem de ser derivavel do MIDI, senao a busca desenha a nota errada.
  eq(I.openPc.map((p, i) => p === I.openMidi[i] % 12).every((x) => x), true,
    id + ': openPc bate com openMidi');
  ok(I.openPc.length === I.labels.length, id + ': afinacao e rotulos tem o mesmo tamanho');
  ok(I.openPc.length === I.cordas, id + ': openPc tem uma entrada por corda');
  ok(I.openMidi.length === I.cordas, id + ': openMidi tem uma entrada por corda');
});
eq(M.instrumento('ukulele').labels.join(''), 'GCEA', 'rotulos do ukulele em GCEA');
eq(M.instrumento('violao').labels[0] + M.instrumento('violao').labels[5], 'EE', 'violao comeca e termina no Mi');

console.log('\n=== INSTRUMENTOS: formas que tocam o acorde certo ===');
// O teste que vale: para cada instrumento, cada acorde, cada forma devolvida
// tem de ser o acorde pedido — e nada alem dele.
const QUALIDADES_TESTE = ['', 'm', '7', 'm7', 'maj7', 'dim', 'aug', 'sus4', 'sus2'];
let formasChutadas = 0, formasRuins = 0, instrumentosSemForma = [];
M.INSTRUMENTOS.filter(function (i) { return i.tipo === 'cordas'; }).forEach(function (I) {
  let achouAlguma = false;
  for (let pc = 0; pc < 12; pc++) {
    for (const q of QUALIDADES_TESTE) {
      let formas;
      try {
        formas = M.instrumentShapes(I, pc, q, { maxFret: I.trastes, limit: 3 });
      } catch (e) {
        formasRuins++;
        ok(false, I.id + ' lancou em ' + M.noteName(pc) + ' ' + (q || 'maior') + ': ' + e.message);
        continue;
      }
      if (!formas || !formas.length) continue;
      achouAlguma = true;
      // `iv` fica em QUALITIES; chordInfo devolve as notas ja nomeadas.
      const iv = M.QUALITIES[q].iv;
      const quer = new Set(iv.map((i) => (pc + i) % 12));
      formas.forEach(function (f) {
        formasChutadas++;
        eq(f.length, I.cordas, I.id + ': forma tem uma entrada por corda');
        const pcTocadas = [];
        f.forEach((fr, i) => {
          if (fr < 0) return;
          ok(fr >= 0 && fr <= I.trastes, I.id + ': traste ' + fr + ' dentro do braco');
          const npc = (I.openPc[i] + fr) % 12;
          if (!quer.has(npc)) {
            formasRuins++;
            ok(false, I.id + ': ' + M.noteName(pc) + ' ' + (q || 'maior') +
              ' tem nota fora do acorde em ' + I.labels[i] + ' (traste ' + fr + ' = ' + M.noteName(npc) + ')');
          }
          pcTocadas.push(npc);
        });
        // precisa soar: pelo menos 3 notas, com fundamental e 3a.
        const distintas = new Set(pcTocadas);
        ok(distintas.size >= 3, I.id + ': a forma tem ao menos 3 notas distintas');
        ok(distintas.has(pc % 12), I.id + ': a forma tem a fundamental');
        ok(distintas.has((pc + (iv[1] !== undefined ? iv[1] : 4)) % 12),
          I.id + ': a forma tem a 3a');
        // a voz mais grave e a fundamental: e a regra que o validateVoicing
        // exige e que a busca precisa respeitar.
        const primeira = pcTocadas[0];
        ok(primeira === pc % 12, I.id + ': a voz mais grave e a fundamental');
      });
    }
  }
  if (!achouAlguma) instrumentosSemForma.push(I.id);
});
eq(formasRuins, 0, 'nenhuma forma com nota fora do acorde');
eq(formasChutadas > 400, true, 'a busca achou ' + formasChutadas + ' formas para conferir');
eq(instrumentosSemForma.join(','), '', 'todo instrumento achou forma para os acordes comuns');

console.log('\n=== INSTRUMENTOS: instrumentShapes delega ao violao ===');
// O violao tem de continuar devolvendo as mesmas formas de antes, incluindo as
// canonicas. E o que garante que a generalizacao nao mexeu no que ja funcionava.
const gC = M.instrumentShapes('violao', 0, '', { maxFret: 15, limit: 6 });
const gC2 = M.guitarShapes(0, '', { maxFret: 15, limit: 6 });
eq(gC.join('|'), gC2.join('|'), 'violao pelo id e pela funcao devolvem o mesmo');
// O C aberto canonico (x 3 2 0 1 0) tem de continuar na lista, com bonus 40.
ok(gC.some((f) => f.join(' ') === '-1 3 2 0 1 0'), 'o C aberto canonico continua na lista');
// O Sol aberto canonico (3 2 0 0 0 3) e do tom SOL, nao do C — e a forma
// aberta do violao, com bonus 40, entao tem de aparecer em pc 7.
const gG = M.guitarShapes(7, '', { maxFret: 15, limit: 6 });
eq(gG[0].join(' '), '3 2 0 0 0 3', 'o Sol aberto canonico vem primeiro em Sol');
ok(M.instrumentShapes('violao', 7, '', { maxFret: 15, limit: 6 })[0].join(' ') === '3 2 0 0 0 3',
  'e o caminho generico do violao tambem respeita as canonicas');

console.log('\n=== INSTRUMENTOS: entradas invalidas ===');
eq(M.instrumentShapes('violao', 99, '', {}).length > 0, true, 'fundamental fora de 0..11 da a volta');
eq(M.instrumentShapes(null, 0, '', {}).length > 0, true, 'instrumento nulo usa o violao');
eq(M.instrumentShapes({ openPc: 'lixo' }, 0, '', {}).length > 0, true, 'instrumento invalido usa o violao');

// Uma qualidade que nao existe nao vira acorde inventado: o motor cai para o
// maior, que e o comportamento que o violao ja tinha. O importante e que
// todos os instrumentos caiam para a MESMA coisa — se so um deles caisse, o
// mesmo acorde apareceria de dois jeitos dependendo do instrumento escolhido.
eq(M.instrumentShapes('baixo', 0, 'nao-existe', { limit: 1 })[0].join(' '),
  M.instrumentShapes('baixo', 0, '', { limit: 1 })[0].join(' '),
  'baixo: qualidade inventada cai no maior, igual ao maior mesmo');
eq(M.instrumentShapes('ukulele', 0, 'nao-existe', { limit: 1 })[0].join(' '),
  M.instrumentShapes('ukulele', 0, '', { limit: 1 })[0].join(' '),
  'ukulele: qualidade inventada cai no maior, igual ao maior mesmo');
eq(M.instrumentShapes('violao', 0, 'nao-existe', { limit: 1 })[0].join(' '),
  M.instrumentShapes('violao', 0, '', { limit: 1 })[0].join(' '),
  'violao: qualidade inventada cai no maior, como sempre fez');
// E o maior inventado ainda tem de ser um acorde de verdade: nada de nota
// fora, e com a fundamental na voz mais grave.
{
  const I = M.instrumento('baixo');
  const f = M.instrumentShapes('baixo', 0, 'nao-existe', { limit: 1 })[0];
  const quer = new Set([0, 4, 7]); // C, E, G
  eq(f.every((fr, i) => fr < 0 || quer.has((I.openPc[i] + fr) % 12)), true,
    'e a forma gerada para o maior e mesmo o maior');
}

/* =======================================================
   MEIO SEMITOM — a fronteira que o controle de 0,5 em 0,5 cria
   =======================================================
   Meio semitom e quarto de tom, e nao ha nome de acorde para ele. Sem
   tratamento, o motor calcularia um pitch class fracionario e escreveria
   "undefined" no meio da cifra. E o tipo de defeito que nao da erro: o app
   abre normal e a pessoa so percebe depois de cantar errado. */
console.log('\n=== MEIO SEMITOM: arredonda em vez de quebrar ===');
eq(M.arredondarSemitons(0), 0, 'zero fica zero');
eq(M.arredondarSemitons(3), 3, 'inteiro passa reto');
eq(M.arredondarSemitons(3.5), 4, '3,5 sobe para 4');
eq(M.arredondarSemitons(-3.5), -3, 'menos 3,5 sobe para menos 3');
eq(M.arredondarSemitons(2.4), 2, '2,4 desce para 2');
eq(M.arredondarSemitons(2.6), 3, '2,6 sobe para 3');
eq(M.arredondarSemitons('3'), 3, 'texto numerico funciona');
eq(M.arredondarSemitons(NaN), 0, 'NaN vira zero');
eq(M.arredondarSemitons(Infinity), 0, 'infinito vira zero');
eq(M.arredondarSemitons(undefined), 0, 'indefinido vira zero');
eq(M.arredondarSemitons(null), 0, 'nulo vira zero');
eq(M.arredondarSemitons('lixo'), 0, 'texto nao numerico vira zero');

console.log('\n=== MEIO SEMITOM: os cents do desvio ===');
eq(M.centsDeDesvio(0), 0, 'sem desvio, zero cents');
eq(M.centsDeDesvio(3), 0, 'inteiro nao tem desvio');
eq(M.centsDeDesvio(3.5), 50, '3,5 semitons sao 50 cents');
eq(M.centsDeDesvio(-3.5), -50, 'menos 3,5 sao menos 50 cents');
eq(M.centsDeDesvio(2.25), 25, '2,25 sao 25 cents');
eq(M.centsDeDesvio(0.7), -30, '0,7 arredonda para 1: 30 cents acima do pedido');
eq(M.centsDeDesvio(-0.7), 30, 'menos 0,7 arredonda para -1: 30 cents abaixo do pedido');
eq(M.centsDeDesvio(-0.9), 10, 'menos 0,9 nao gera 90 cents');
eq(M.centsDeDesvio(0.9), -10, '0,9 tambem nao gera 90 cents');
eq(M.centsDeDesvio(NaN), 0, 'NaN nao gera cents');
// O desvio nunca passa de meio semitom: e a definicao dele.
{
  let pior = 0;
  for (let i = -240; i <= 240; i++) {
    const c = Math.abs(M.centsDeDesvio(i / 10));
    if (c > pior) pior = c;
  }
  eq(pior, 50, 'o desvio nunca passa de 50 cents');
}

console.log('\n=== MEIO SEMITOM: a cifra nao estraga ===');
const meio = '[C]\nC  G  Am  F';
// Nenhum destes pode conter "undefined", "NaN" ou "0.5".
[0.5, 1.5, 2.5, -0.5, -1.5, 3.7, -3.7].forEach(function (s) {
  const t = M.transposeCifra(meio, s, false);
  ok(!/undefined|NaN|0\.5|\.5/.test(t), 'meio semitom ' + s + ' nao escreve nada estranho');
  ok(/\[/.test(t), 'meio semitom ' + s + ' preserva a diretiva de tom');
});
// E o resultado tem de ser identico ao do inteiro arredondado.
[0.5, 1.5, 2.5, -0.5, -1.5, 3.7].forEach(function (s) {
  eq(M.transposeCifra(meio, s, false), M.transposeCifra(meio, M.arredondarSemitons(s), false),
    'meio semitom ' + s + ' da o mesmo resultado que ' + M.arredondarSemitons(s));
});
// Um quarto de tom acima do C tem de soar como C# (semitom acima), e nao C.
eq(M.transposeCifra('C', 0.5, false), M.transposeCifra('C', 1, false),
  'meio semitom acima arredonda para o proximo semitom');
eq(M.transposeCifra('C', -0.5, false), M.transposeCifra('C', 0, false),
  'meio semitom abaixo arredonda para o semitom');
eq(M.transposeCifra(meio, 0.4, false), meio, '0,4 arredonda para zero e devolve a cifra intacta');
eq(M.transposeCifra(meio, NaN, false), meio, 'NaN devolve a cifra intacta');
eq(M.transposeCifra(meio, 'x', false), meio, 'entrada nao numerica devolve a cifra intacta');
// transposeLine tambem, que e chamada direto em outros lugares.
eq(M.transposeLine('C G', 2.5, false), M.transposeLine('C G', 3, false), 'transposeLine tambem arredonda');
eq(/undefined|NaN/.test(M.transposeLine('C G', 0.5, false)), false, 'transposeLine nao escreve undefined');

/* =======================================================
   ROTEIRO DE ROLAGEM
   O que separa um scroll que serve de um scroll inutil e a duracao de cada
   parada. Rolar na velocidade constante da a sensacao de texto passando, e o
   musico nao sabe quando mudar de acorde.
   ======================================================= */
console.log('\n=== ROTEIRO: classifica cada linha ===');
const cifraRolagem = '[C]\n\n[Verso 1]\nC       G\nAm      F\n\nC       G\nF       G\n\n[Refrão]\nF       C\nG       C';
const r0 = M.roteiroDeRolagem(cifraRolagem, { bpm: 120, compasso: '4/4' });
eq(r0.linhas.length, 12, 'o roteiro tem uma entrada por linha da cifra');
eq(r0.linhas[0].tipo, 'secao', 'linha [C] e secao, nao linha de acordes');
eq(r0.linhas[1].tipo, 'vazia', 'linha em branco e respiro');
eq(r0.linhas[2].tipo, 'secao', '[Verso 1] e secao');
eq(r0.linhas[3].tipo, 'acorde', 'linha de acordes e acorde');
eq(r0.linhas[4].tipo, 'acorde', 'outra linha de acordes');
// os indices batem com a posicao na cifra original
eq(r0.linhas.map((r) => r.indice).join(','), '0,1,2,3,4,5,6,7,8,9,10,11',
  'cada entrada guarda o indice da linha original');
eq(r0.totalAcordes, 6, 'seis linhas de acordes — o [C] do topo e secao, nao acorde');

console.log('\n=== ROTEIRO: a duracao de cada parada ===');
// 120 bpm em 4/4 -> 500 ms por batida, meia barra -> 1000 ms por linha.
eq(r0.msPorBatida, 500, 'a 120 bpm a batida dura 500 ms');
eq(r0.msCheia, 1000, 'meia barra de 4/4 a 120 bpm sao 1000 ms');
const tAcorde = r0.linhas.find((r) => r.tipo === 'acorde');
const tSecao = r0.linhas.find((r) => r.tipo === 'secao');
const tVazia = r0.linhas.find((r) => r.tipo === 'vazia');
eq(tAcorde.ms, 1000, 'linha de acordes para pela barra cheia');
ok(tSecao.ms < tAcorde.ms, 'secao passa mais rapido que a linha de acordes (' + tSecao.ms + ' < ' + tAcorde.ms + ')');
ok(tVazia.ms < tAcorde.ms, 'respiro tambem passa mais rapido (' + tVazia.ms + ' < ' + tAcorde.ms + ')');
// Nenhum parada pode ser tao curta que pisca, nem tao longa que trava.
eq(r0.linhas.every((r) => r.ms >= 120 && r.ms <= 20000), true, 'toda parada fica entre 120 ms e 20 s');
eq(r0.duracaoMs, r0.linhas.reduce((s, r) => s + r.ms, 0), 'a duracao total e a soma das paradas');

console.log('\n=== ROTEIRO: o andamento muda o ritmo ===');
eq(M.roteiroDeRolagem(cifraRolagem, { bpm: 60 }).msCheia, 2000, 'a 60 bpm a linha dura o dobro');
eq(M.roteiroDeRolagem(cifraRolagem, { bpm: 240 }).msCheia, 500, 'a 240 bpm a linha dura a metade');
eq(M.roteiroDeRolagem(cifraRolagem, { bpm: 120, compasso: '3/4' }).msCheia, 750, 'em 3/4 a linha encurta');
eq(M.roteiroDeRolagem(cifraRolagem, { bpm: 120, compasso: '6/8' }).msCheia, 1500, 'em 6/8 a linha alonga');
// Mais BPM = menos tempo. E a unica relacao que importa. O percurso fica
// dentro da faixa valida: acima de 300 o motor cai no padrao de 96, e um
// bpm alto "aumentaria" o tempo — o que seria a queda funcionando, nao uma
// falha de monotonicidade.
{
  let ok2 = true;
  for (let a = 30; a < 300; a += 15) {
    for (let b = a + 15; b <= 300; b += 15) {
      if (M.roteiroDeRolagem('C', { bpm: a }).msCheia <= M.roteiroDeRolagem('C', { bpm: b }).msCheia) ok2 = false;
    }
  }
  eq(ok2, true, 'mais BPM nunca aumenta o tempo de parada');
}

console.log('\n=== ROTEIRO: o fator de velocidade ===');
eq(M.roteiroDeRolagem(cifraRolagem, { bpm: 120, fator: 2 }).msCheia, 2000, 'fator 2 dobra o tempo');
eq(M.roteiroDeRolagem(cifraRolagem, { bpm: 120, fator: 0.5 }).msCheia, 500, 'fator meio corta pela metade');
eq(M.roteiroDeRolagem(cifraRolagem, { bpm: 120, fator: 0 }).fator, 1, 'fator zero nao trava a rolagem');
eq(M.roteiroDeRolagem(cifraRolagem, { bpm: 120, fator: -3 }).fator, 1, 'fator negativo nao trava a rolagem');
eq(M.roteiroDeRolagem(cifraRolagem, { bpm: 120, fator: 'lixo' }).fator, 1, 'fator nao numerico nao trava a rolagem');

console.log('\n=== ROTEIRO: entradas invalidas ===');
// Uma cifra sem andamento e o caso comum: a maioria nunca preenche o bpm.
eq(M.roteiroDeRolagem('C  G').bpm, 96, 'sem bpm, assume 96 — andamento de marcha');
eq(M.roteiroDeRolagem('C  G', { bpm: 'lixo' }).bpm, 96, 'bpm nao numerico assume 96');
eq(M.roteiroDeRolagem('C  G', { bpm: 0 }).bpm, 96, 'bpm zero assume 96');
eq(M.roteiroDeRolagem('C  G', { bpm: -50 }).bpm, 96, 'bpm negativo assume 96');
eq(M.roteiroDeRolagem('C  G', { bpm: 5000 }).bpm, 96, 'bpm absurdo assume 96');
eq(M.roteiroDeRolagem('C  G', { compasso: 'lixo' }).numerador, 4, 'compasso invalido assume 4/4');
eq(M.roteiroDeRolagem('C  G', { compasso: '' }).numerador, 4, 'compasso vazio assume 4/4');
eq(M.roteiroDeRolagem('C  G', { compasso: '99/4' }).numerador, 4, 'numerador absurdo assume 4');
// Uma cifra vazia nao pode quebrar o app na hora de abrir a musica.
eq(M.roteiroDeRolagem('').linhas.length, 1, 'cifra vazia devolve uma linha so');
eq(M.roteiroDeRolagem('').totalAcordes, 0, 'cifra vazia nao tem acordes');
eq(M.roteiroDeRolagem(null).linhas.length, 1, 'cifra nula nao quebra');
eq(M.roteiroDeRolagem(undefined).totalAcordes, 0, 'cifra indefinida nao quebra');
// Letra pura sem acorde: nao e rolavel, e o app precisa saber disso.
eq(M.roteiroDeRolagem('O Senhor e o meu pastor\nNada me faltara').totalAcordes, 0,
  'letra sem acorde nao tem linha rolavel');
eq(M.roteiroDeRolagem('O Senhor e o meu pastor').linhas[0].tipo, 'letra', 'a linha de letra e do tipo letra');

/* =======================================================
   ESPACAMENTO DA CIFRA
   O espaco entre os acordes e parte do formato: e ele que alinha o acordo
   com a silaba da letra. Perder o espaco nao "limpa" a linha: destroi o
   desenho.
   ======================================================= */
console.log('\n=== ESPACAMENTO: o desenho sobrevive a tokenizacao ===');
const juntar = (toks) => toks.map((t) => t.v).join('');
eq(juntar(M.tokenizeLine('C            G', true)), 'C            G',
  'os espacos entre dois acordes continuam la');
eq(juntar(M.tokenizeLine('Am           F', true)), 'Am           F',
  'o alinhamento de uma linha de dois acordes se mantem');
eq(juntar(M.tokenizeLine('   C', true)), '   C', 'o espaco da frente da linha nao e comido');
eq(juntar(M.tokenizeLine('C   ', true)), 'C   ', 'o espaco do fim da linha nao e comido');
eq(juntar(M.tokenizeLine('C', true)), 'C', 'sem espaco nenhum, a linha fica igual');
// tres acordes com espacos diferentes: as colunas batem
eq(juntar(M.tokenizeLine('C       G       Am', true)), 'C       G       Am', 'tres acordes alinhados');
// espaco de tabulacao
eq(juntar(M.tokenizeLine('C\t\tG', true)), 'C\t\tG', 'tabulacao tambem sobrevive');

console.log('\n=== ESPACAMENTO: o que continua funcionando ===');
// O acord detection nao pode ter piorado por causa dos tokens de espaco.
eq(M.tokenizeLine('C            G', true).filter((t) => t.type === 'chord').length, 2,
  'ainda sao dois acordes, e nao tres com um espaco no meio');
eq(M.tokenizeLine('C            G', true).filter((t) => t.espaco).length, 1,
  'o espaco e um token so');
eq(M.tokenizeLine('C     G', true).filter((t) => t.type === 'chord' && t.chord).length, 2,
  'os dois acordes ainda trazem o acorde analisado');
// Uma linha de letra nao pode virar linha de acordes por causa dos espacos.
eq(M.isChordLine('O Senhor e o meu pastor'), false, 'letra continua nao sendo linha de acordes');
eq(M.isChordLine('C            G'), true, 'linha de acordes continua sendo reconhecida');
eq(M.extractChords('C     G     Am').length, 3, 'extractChords ignora os espacos, como antes');
// Barra de compasso entre acordes
eq(juntar(M.tokenizeLine('C    |    G', true)).indexOf('|') > 0, true, 'a barra de compasso continua no lugar');

/* =======================================================
   TRECHOS DA CIFRA — a base do modo de estudo
   =======================================================
   Estudar cifra e decorar pedaco por pedaco. Para isso o app precisa saber
   onde acaba um verso e comeca o outro — e isso e uma informacao que a cifra
   ja traz, nas linhas entre colchetes. Descobrir na hora, contando linhas na
   mao, seria erro garantido. */
console.log('\n=== TRECHOS: a divisao segue as secoes ===');
const cifraTrechos = ['[C]',
  'C            G',
  'Am           F',
  '',
  '[Verso 1]',
  'C            G',
  'F            G',
  '',
  '[Refrao]',
  'F            C',
  'G       C    F',
  '',
  '[Ponte]',
  'Am           F',
  'C            G'].join('\n');
const bt = M.blocosDeCifra(cifraTrechos);
eq(bt.length, 4, 'quatro trechos: antes do primeiro titulo, verso, refrão e ponte');
eq(bt[1].titulo, 'Verso 1', 'o segundo trecho e o Verso 1');
eq(bt[2].titulo, 'Refrao', 'o terceiro e o Refrao');
eq(bt[3].titulo, 'Ponte', 'o quarto e a Ponte');
// O trecho sem titulo usa a diretiva de tom, que e o que a cifra declara.
eq(bt[0].titulo, 'C', 'o primeiro trecho usa a diretiva de tom como nome');
eq(bt[0].semTitulo, false, 'e conta como titulo dado, nao como trecho anonimo');
eq(bt[1].semTitulo, false, 'os trechos com titulo nao sao marcados assim');

console.log('\n=== TRECHOS: as linhas de cada trecho ===');
eq(bt[1].linhaInicio, 4, 'o Verso 1 comeca na linha 4');
eq(bt[1].linhaFim, 7, 'e termina na linha 7 (a linha em branco antes do Refrao)');
eq(bt[3].linhaFim, 14, 'a Ponte termina na ultima linha');
// Nenhuma linha pode ficar fora de algum trecho, nem ser contada duas vezes.
{
  const cobertas = [];
  bt.forEach((b) => { for (let i = b.linhaInicio; i <= b.linhaFim; i++) cobertas.push(i); });
  const todas = cifraTrechos.split('\n').map((_, i) => i);
  eq(cobertas.slice().sort((a, b) => a - b).join(','), todas.join(','),
    'as linhas de todos os trechos, juntas, dao a cifra inteira sem repetir nem faltar');
}
eq(bt.map((b) => b.nLinhas).join(','), '3,3,3,2', 'a contagem de linhas de cada trecho');

console.log('\n=== TRECHOS: casos de borda ===');
eq(M.blocosDeCifra('').length, 0, 'cifra vazia nao tem trechos');
eq(M.blocosDeCifra(null).length, 0, 'cifra nula nao quebra');
eq(M.blocosDeCifra('C  G').length, 1, 'cifra sem nenhuma secao e um trecho so');
eq(M.blocosDeCifra('C  G')[0].titulo, 'Inicio', 'e o trecho sem titulo ganha um nome legivel');
eq(M.blocosDeCifra('C  G')[0].semTitulo, true, 'e ele e marcado como anonimo');
// Secoes seguidas: a do meio fica vazia, e e assim que deve ser. O conteudo
// depois de um titulo pertence a esse titulo — "[B] / C  G" e um trecho so,
// nao um trecho B vazio e um trecho anonimo com o acorde.
{
  const b2 = M.blocosDeCifra('[A]\n[B]\nC  G');
  eq(b2.length, 2, 'um titulo seguido de conteudo e um trecho so');
  eq(b2[0].nLinhas, 0, 'o primeiro titulo, sem nada embaixo, fica vazio');
  eq(b2[1].titulo, 'B', 'e o acorde pertence ao titulo seguinte, nao a um trecho anonimo');
  eq(b2[1].nLinhas, 1, 'com uma linha de conteudo');
}
// Tres titulos seguidos: o do meio fica vazio, e e o caso que o teste do
// app precisa acertar para nao esconder dois versos como se fossem um.
{
  const b3 = M.blocosDeCifra('[Refrao]\n[Refrao 2]\nC  G');
  eq(b3.length, 2, 'tres titulos seguidos dao dois trechos');
  eq(b3[0].nLinhas, 0, 'o Refrao, sem conteudo, fica vazio');
  eq(b3[1].titulo, 'Refrao 2', 'e o conteudo fica no segundo Refrao');
}
// Um titulo sem colchetes tambem vale.
eq(M.blocosDeCifra('= Refrao =\nC  G')[0].titulo, 'Refrao', 'o titulo com sinal de igual tambem vale');
// O sublinhado sozinho e secao, mas "___ Texto ___" nao e: `isSectionLine`
// aceita so uma linha de sublinhados. Este teste registra o limite em vez de
// fingir que o formato existe — mudar isso mexeria no detector compartilhado
// com o resto do app.
eq(M.blocosDeCifra('____\nC  G')[0].nLinhas, 1, 'uma linha de sublinhados e secao');
eq(M.blocosDeCifra('___ Introducao ___\nC  G')[0].titulo, 'Inicio',
  'sublinhado com texto no meio NAO e secao, e o texto vira letra comum');
// Espaco em volta do titulo nao vira parte do nome.
eq(M.blocosDeCifra('[  Solo  ]\nC  G')[0].titulo, 'Solo', 'o titulo e aparado dos espacos');
// Diretoiva de tom e titulo ao mesmo tempo: a diretiva nao deve virar o titulo.
eq(M.blocosDeCifra('[Dm]\nC  G')[0].titulo, 'Dm', 'a diretiva de tom serve de titulo');
eq(M.blocosDeCifra('[Dm]\nC  G')[0].semTitulo, false, 'e conta como titulo dado');

/* =======================================================
   SO ACORDES — descascar a letra sem mexer no desenho
   ======================================================= */
console.log('\n=== SO ACORDES: a letra some, o desenho fica ===');
// Os espacos ENTRE as palavras da letra tambem sobrevem, e por isso a
// comparacao ignora a direita. Eles nao aparecem na tela, e apaga-los
// deslocaria as colunas de tudo que vier depois.
eq(M.apenasAcordes('C            G        O Senhor e o meu pastor').trimEnd(),
  'C            G',
  'linha mista fica so com os acordes, na posicao original');
eq(M.apenasAcordes('Am           F        em nenhum dia').trimEnd(),
  'Am           F',
  'segunda linha mista tambem');
eq(/Senhor|pastor|nenhum/.test(M.apenasAcordes('C   G   O Senhor e o meu pastor')), false,
  'nenhuma palavra da letra sobra');
// A linha e mista E passa em isChordLine — e por isso que o filtro antigo nao
// a pegava.
eq(M.isChordLine('Am           F        em nenhum dia'), true,
  'a linha mista passa como linha de acordes (por isso o filtro antigo falhava)');
// Alineamento preservado: a posicao da coluna de acordes nao anda.
{
  const mista = 'C            G        O Senhor e o meu pastor';
  const so = M.apenasAcordes(mista);
  const posC = mista.indexOf('C'), posG = mista.indexOf('G');
  eq(so.indexOf('C') === posC, true, 'o primeiro acorde continua na coluna original');
  eq(so.indexOf('G') === posG, true, 'o segundo tambem');
  eq(/Senhor|pastor/.test(so), false, 'e a letra foi embora');
}
// So os espacos sobram quando a letra comeca antes dos acordes.
eq(/^\s*G\s*$/.test(M.apenasAcordes('        G        la la la')), true,
  'letra antes do acorde: sobra o acorde e o espaco, no lugar');

console.log('\n=== SO ACORDES: o que nao tem acorde desaparece ===');
eq(M.apenasAcordes('O Senhor e o meu pastor'), null, 'letra pura devolve nada');
eq(M.apenasAcordes('seculo'), null, 'palavra solta devolve nada');
eq(M.apenasAcordes(''), null, 'linha vazia devolve nada');
eq(M.apenasAcordes('   '), null, 'linha so com espacos devolve nada');
// A capitalizacao e o que separa a letra do acorde. Sem ela, "em" virava Em
// menor e "e" virava Mi, e o filtro devolveria a letra que devia esconder.
eq(M.apenasAcordes('Am  em  nenhum  dia'), 'Am      ', 'a preposicao "em" nao vira Em');
eq(M.apenasAcordes('e  ai  nao  era'), null, '"e" e "ai" tambem nao viram acordes');
eq(M.apenasAcordes('Em  ai  nao  era'), 'Em      ', 'mas "Em" maiusculo e o acorde mesmo');
// O titulo da secao nao passa por aqui: quem chama decide, porque um titulo
// sem texto ficaria invisivel e a pessoa perderia a referencia do trecho.
eq(M.apenasAcordes('[Verso 1]'), null, 'o titulo de secao e decidido por quem chama');
eq(M.apenasAcordes('[C]'), '[C]', 'a diretiva de tom, com letra maiuscula, sobrevive');

console.log('\n=================================================');
console.log('  ' + pass + ' passaram, ' + fail + ' falharam');
console.log('=================================================\n');
process.exit(fail ? 1 : 0);
