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

console.log('\n=================================================');
console.log('  ' + pass + ' passaram, ' + fail + ' falharam');
console.log('=================================================\n');
process.exit(fail ? 1 : 0);
