/* =========================================================
   tools/test-transposicao.js
   O TRANSPOSITOR CONTRA UMA TABELA QUE NAO VEIO DELE

   POR QUE AS REFERENCIAS ESTAO ESCRITAS A MAO

   Este arquivo nao usa `Music.transposeCifra` para decidir o que o resultado
   devia ser. Se usasse, os dois lados leriamos o mesmo erro e a comparacao
   seria circular: o teste passaria com o motor quebrado. Tudo abaixo vem da
   regra musical escrita a mao — `nova = ((original + n) % 12 + 12) % 12` — e
   nao da saida do motor. E o que torna a falha util: ela diz QUAL acorde esta
   errado, e nao apenas que alguma coisa mudou.

   POR QUE 49 DESLOCAMENTOS E NAO SO +2

   Cada token andar +2 prova que ele anda. Nao prova que ele anda SEMPRE, e o
   que quebra em uso de verdade e o meio: +7 num acorde com sustenido, -11
   num acorde com baixo, ida e volta num acorde que o motor nao conhece. Por
   isso cada um dos 97 passa por -24..+24 e e conferido em dois sentidos: a
   altura da fundamental E a altura do baixo.

   O baixo e conferido a parte porque foi o que sumiu numa regressao do regex:
   `C/E +2` chegou a sair `D`, sem o `/E`. Um teste que so olhasse a
   fundamental nao teria visto aquilo.

   O QUE ESTE ARQUIVO NAO PROVA, E POR QUE
     - Que `Amo` (verbo portugues, "eu amo") vira acorde. Isso acontece desde
       antes desta etapa e esta em BUGS-ABERTOS.md. Nao entra aqui porque um
       teste que falha sempre nao protege nada: o defeito precisa de teste
       proprio, feito quando for corrigido.
     - Que o timbre dos acordes soe como o nome diz. Numeros nao contam.
   ========================================================= */
'use strict';

const path = require('path');
const M = require(path.join(__dirname, '..', 'js', 'core', 'music.js'));

let passou = 0;
let falhou = 0;
const problemas = [];
const ok = (cond, titulo, detalhe) => {
  if (cond) { passou++; return true; }
  falhou++;
  problemas.push(titulo + (detalhe ? '  ->  ' + detalhe : ''));
  return false;
};
const secao = (t) => console.log('\n=== ' + t + ' ===');

/* ---- a unica verdade desta tabela: altura da nota, em semitons ---- */
const SEMITOM = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const altura = (nome) => {
  const m = /^([A-G])([#b]?)$/.exec(nome);
  if (!m) return null;
  const base = SEMITOM[m[1]];
  return (((base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)) % 12) + 12) % 12;
};
const fundamental = (tok) => String(tok).trim().match(/^([A-G][#b]?)/)[1];
/* O BAIXO SO E O `/` QUE ESTA FORA DO PARENTESE.
 *
 * Em `Cm7(5-/9)` a barra separa extcoes — 5- e 9 — e nao fundamental de
 * baixo. Cortar no ultimo `/` dava `9)`, que nao e nota nenhuma, e o teste
 * acusava 1.274 falhas de "o baixo nao voltou" num acorde que nao tem baixo.
 * A regra e simples: some primeiro com o que esta entre parenteses, e so
 * depois procure a barra. */
const foraDosParentese = (tok) => String(tok).trim().replace(/\([^)]*\)/g, '');
const baixo = (tok) => {
  const partes = foraDosParentese(tok).split('/');
  if (partes.length < 2) return null;
  const ultimo = partes[partes.length - 1].trim();
  /* `C/E` tem baixo E; `C6/9` e sexta com nona, e nao tem baixo nenhum.
     A barra so e baixo quando depois dela vem uma LETRA de nota. E a mesma
     distincao que o regex do motor faz, e o mesmo erro aparecia aqui: o
     teste acusava 49 falhas de "o baixo nao voltou" em `C6/9`, que nao tem
     baixo para voltar. */
  return /^[A-G][#b]?$/.test(ultimo) ? ultimo : null;
};
const alturaDaParte = (p) => (p ? altura(p) : null);
/* a letra pode virar enarmonia; o que nao pode e a altura */
const moveu = (antes, depois, semis) =>
  alturaDaParte(fundamental(depois))
  === ((alturaDaParte(fundamental(antes)) + semis) % 12 + 12) % 12;

/* ============================================================ */
secao('1. os casos do enunciado da etapa');

const CASOS = [
  ['C', 2, 'D'], ['Am', 2, 'Bm'], ['G', 2, 'A'], ['Em', 2, 'F#m'],
  ['C', -2, null], ['F#m', -2, 'Em'],
  ['C/E', 2, 'D/F#'], ['D/F#', 2, 'E/G#'], ['Bb/D', 2, 'C/E'], ['G/B', -2, 'F/A'],
];
for (const caso of CASOS) {
  const entrada = caso[0];
  const semis = caso[1];
  const esperado = caso[2];
  const linha = entrada + '  ' + entrada;
  const saida = M.transposeCifra(linha, semis, false).split(/\s+/)[0];

  ok(moveu(entrada, saida, semis),
    'altura da fundamental: ' + entrada + ' ' + (semis >= 0 ? '+' : '') + semis,
    'saiu ' + saida);
  if (baixo(entrada)) {
    ok(alturaDaParte(baixo(saida))
      === ((alturaDaParte(baixo(entrada)) + semis) % 12 + 12) % 12,
      'altura do baixo: ' + entrada + ' ' + (semis >= 0 ? '+' : '') + semis,
      'saiu ' + saida);
  }
  if (esperado) {
    ok(saida === esperado, 'nome impresso: ' + entrada + ' -> ' + esperado, 'saiu ' + saida);
  }
}

/* ============================================================ */
secao('2. padrao de cifragem do Cifra Club');

const CIFRA_CLUB = [
  'C', 'Cm', 'C5+', 'Cm5-', 'C7', 'C7M', 'Cm7', 'Cm7M', 'Cm7(5-)', 'Cº',
  'C7M(5+)', 'C7(5+)', 'C2', 'C4', 'C2-', 'C4+', 'C5', 'C5(9)-',
  'C7(2)', 'C7(4)', 'C7(2-)', 'C7(4+)', 'C7M(2)', 'C7M(4)',
  'C6', 'Cm6', 'C5+(6)', 'C6-', 'Cm6-', 'Cm5-(6-)',
  'C9', 'Cm9', 'C5+(9)', 'Cm5-(9)', 'C9-', 'Cm9-', 'C5+(9-)', 'Cm5-(9-)',
  'C11', 'Cm11', 'C11+', 'Cm11+', 'Cm11-', 'C5+(11)', 'Cm5-(11)', 'C11-',
  'C7(9)', 'C7M(9)', 'Cm7(9)', 'Cm7M(9)', 'Cm7(5-/9)', 'Cº9', 'C7M(5+/9)',
  'C7(5+/9)', 'C7(9-)', 'C7M(9-)', 'Cm7(9-)', 'Cm7M(9-)', 'Cm7(5-/9-)',
  'C7M(5+/9-)', 'C7(5+/9-)', 'C7(9+)', 'C7M(9+)', 'C7M(5+/9+)', 'C7(5+/9+)',
  'C7(11)', 'C7M(11)', 'Cm7(11)', 'Cm7M(11)', 'Cm7(5-/11)', 'C7M(5+/11)',
  'C7(11+)', 'C7(11-)', 'C7M(11-)', 'Cm11-',
  'C7(13)', 'C7M(13)', 'Cm7(13)', 'Cm7M(13)', 'Cm7(5-/13)', 'C7M(5+/13)',
  'C7(13-)', 'C7M(13-)', 'Cm7(13-)',
  'C6(9/11+)', 'C7(9/11+/13-)', 'C7(5-/11)', 'C7(4/9)', 'C7(4/9-)',
  'C7(4+/9)', 'C7(2/11)', 'C7(2-/11)', 'C7(2-/11+)', 'C7(4/13)', 'C7(2/13)',
  'C7(4-/13)', 'C7(2-/13-)', 'Cm7b5', 'C6/9',
];
/* este projeto decidiu, com razao registrada, que a ordem do OnSong nao e
   acorde. Fica de fora do laudo de "deveria andar" e tem verificacao propria. */
const NAO_ACORDE = ['Cm7M'];
const TOTAL_MOVEM = CIFRA_CLUB.length - NAO_ACORDE.length;

const semPartes = (t) => String(t).trim()
  .replace(/^[A-G][#b]?/, '')
  .replace(/\/[A-G][#b]?$/, '');

for (const tok of CIFRA_CLUB) {
  if (NAO_ACORDE.indexOf(tok) >= 0) continue;
  const saida = M.transposeCifra(tok + '  ' + tok, 2, false).split(/\s+/)[0];
  ok(moveu(tok, saida, 2), 'Cifra Club: ' + tok + ' sobe 2 semitons', 'saiu ' + saida);

  /* O motor pode normalizar a grafia do acorde que CONHECE — `C5+` vira
     `Daug`, `C7M` vira `Dmaj7`, `C2` vira `Dsus2`. Sao o mesmo acorde escrito
     de outro jeito, e o enunciado permite a mudanca desde que testada. Entao:
     conhecido -> compara o CONTEUDO (os intervalos); desconhecido -> compara o
     TEXTO, porque ali nao ha nome canonico e um caractere perdido seria outro
     acorde. */
  const antes = M.parseChord(tok);
  const depois = M.parseChord(saida);
  if (antes && depois && antes.conhecido && depois.conhecido) {
    const relA = M.chordInfo(antes.root, antes.quality, false).notes
      .map((x) => (x - antes.root + 12) % 12).sort((x, y) => x - y);
    const relD = M.chordInfo(depois.root, depois.quality, false).notes
      .map((x) => (x - depois.root + 12) % 12).sort((x, y) => x - y);
    ok(JSON.stringify(relA) === JSON.stringify(relD),
      'Cifra Club: ' + tok + ' guarda os mesmos intervalos depois de andar',
      JSON.stringify(relA) + ' -> ' + JSON.stringify(relD));
  } else {
    ok(semPartes(saida) === semPartes(tok),
      'Cifra Club: o sufixo de ' + tok + ' volta inteiro (motor nao conhece)',
      '"' + semPartes(tok) + '" virou "' + semPartes(saida) + '"');
  }
}

for (const tok of NAO_ACORDE) {
  ok(M.parseChord(tok) === null, 'ordem do OnSong: ' + tok + ' continua nao sendo acorde');
  ok(M.transposeCifra(tok + '  ' + tok, 2, false) === tok + '  ' + tok,
    'ordem do OnSong: ' + tok + ' fica intacta, como antes');
}

/* ============================================================ */
secao('3. reversibilidade e propriedades');

const ALVOS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
  'Cm', 'G7', 'F#m', 'Bb', 'Am7', 'C/E', 'G/B', 'D7M', 'C7', 'Dm7', 'Cm7b5', 'C6/9'];

let reversiveis = 0;
let idas = 0;
for (const base of ALVOS) {
  for (let n = -24; n <= 24; n++) {
    const ida = M.transposeCifra(base, n, false);
    const volta = M.transposeCifra(ida, -n, false);
    idas++;
    if (alturaDaParte(fundamental(volta)) === alturaDaParte(fundamental(base))) reversiveis++;
    else ok(false, 'reversivel: ' + base + ' ' + n + ' -> ' + ida + ' -> ' + volta);
  }
}
ok(reversiveis === idas, '+n seguido de -n recupera a altura em -24..+24', reversiveis + ' de ' + idas);

let preserva12 = 0;
for (const b of ALVOS) if (moveu(b, M.transposeCifra(b, 12, false), 12)) preserva12++;
ok(preserva12 === ALVOS.length, '+12 preserva a classe de altura', preserva12 + ' de ' + ALVOS.length);

let iguais = 0;
for (const b of ALVOS) if (M.transposeCifra(b, 0, false) === b) iguais++;
ok(iguais === ALVOS.length, '0 semitons nao altera nada', iguais + ' de ' + ALVOS.length);

let passoOK = 0;
for (const b of ALVOS) {
  let p = b;
  for (let i = 0; i < 12; i++) p = M.transposeCifra(p, 1, false);
  if (alturaDaParte(fundamental(p)) === alturaDaParte(fundamental(M.transposeCifra(b, 12, false)))) passoOK++;
}
ok(passoOK === ALVOS.length, '+1 doze vezes equivale a +12', passoOK + ' de ' + ALVOS.length);

let baixoOK = 0;
let baixoTotal = 0;
for (const tok of ['C/E', 'G/B', 'D/F#', 'Bb/D', 'Am/G', 'F/C']) {
  for (const n of [-5, -2, -1, 1, 2, 3, 5, 7]) {
    baixoTotal++;
    const saida = M.transposeCifra(tok + '  ' + tok, n, false).split(/\s+/)[0];
    const bE = alturaDaParte(baixo(tok));
    const bS = alturaDaParte(baixo(saida));
    if (bS !== null && bE !== null && ((bS - bE + 12) % 12) === ((n % 12) + 12) % 12) baixoOK++;
    else ok(false, 'o baixo de ' + tok + ' ' + n + ' andou', 'saiu ' + saida);
  }
}
ok(baixoOK === baixoTotal, 'o baixo tambem e transposto', baixoOK + ' de ' + baixoTotal);

/* ============================================================ */
secao('4. letra, tablatura e alinhamento');

const INTOCAVEIS = [
  ['Amazing grace how sweet the sound', 'verso sem nenhum acorde'],
  ['', 'linha vazia'],
  ['    ', 'linha so com espaco'],
  ['e|--0--2--0--|', 'tablatura de viola'],
  ['B|--1--3--1--|  ai', 'tablatura com letra'],
];
for (const bloco of INTOCAVEIS) {
  ok(M.transposeCifra(bloco[0], 2, false) === bloco[0], 'intocavel: ' + bloco[1],
    JSON.stringify(M.transposeCifra(bloco[0], 2, false)));
}

const ALINHADO = 'C        Amor\nAmor     e vida';
const larguras = (t) => t.split('\n').map((l) => l.length).join(',');
ok(larguras(M.transposeCifra(ALINHADO, 2, false)) === larguras(ALINHADO),
  'o espacamento que alinha o acorde com a letra e preservado',
  larguras(ALINHADO) + ' virou ' + larguras(M.transposeCifra(ALINHADO, 2, false)));

for (const p of ['maior', 'amor', 'faltara', 'Amor', 'devo', 'Aqui', 'beleza']) {
  ok(M.transposeCifra(p + '  ' + p, 2, false).split(/\s+/)[0] === p,
    'palavra intacta: ' + JSON.stringify(p), 'saiu ' + M.transposeCifra(p + '  ' + p, 2, false));
}

ok(M.transposeCifra('C   Amor', 2, false) === 'C   Amor', 'linha mista com 1 acorde fica');
ok(M.transposeCifra('C       Amor G', 2, false).indexOf('D') === 0,
  'linha mista com 2 acordes transpoe', M.transposeCifra('C       Amor G', 2, false));
ok(M.transposeCifra('| C      G  | Am |', 2, false) === '| D      A  | Bm |',
  'acordes entre barras de compasso tambem transpoem',
  M.transposeCifra('| C      G  | Am |', 2, false));
ok(M.transposeCifra('[C]', 2, false) === '[D]', 'a diretiva de tom e transposta',
  M.transposeCifra('[C]', 2, false));

/* ============================================================ */
secao('5. os 97 tokens em -24..+24, ida e volta');

const INTERVALO = [
  -24, -23, -22, -21, -20, -19, -18, -17, -16, -15, -14, -13,
  -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1,
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
];

let conferidos = 0;
let foraDoLugar = 0;
const foraDetalhe = [];

for (const tok of CIFRA_CLUB) {
  if (NAO_ACORDE.indexOf(tok) >= 0) continue;
  for (const n of INTERVALO) {
    const linha = tok + '  ' + tok;
    const ida = M.transposeCifra(linha, n, false).split(/\s+/)[0];
    const volta = M.transposeCifra(ida + '  ' + ida, -n, false).split(/\s+/)[0];

    /* Ida de +n e volta de -n tem de terminar NA MESMA altura. Comparar com
       `moveu(tok, volta, -n)` estaria errado: aquilo pergunta se `volta` vale
       `tok - n`, e nao `tok`. A primeira versao deste teste fez essa conta e
       acusou 5.586 falhas num motor que estava certo — `C -23 -> C# -> C`
       e o exemplo do proprio laudo. */
    conferidos += 2;
    if (alturaDaParte(fundamental(volta)) !== alturaDaParte(fundamental(tok))) {
      foraDoLugar++;
      if (foraDetalhe.length < 10) {
        foraDetalhe.push(tok + ' ' + n + ' -> ' + ida + ' -> ' + volta);
      }
    }

    if (baixo(tok)) {
      const bAntes = alturaDaParte(baixo(tok));
      const bDepois = alturaDaParte(baixo(volta));
      if (bDepois !== null && ((bDepois - bAntes + 12) % 12) === 0) {
        /* o baixo voltou: conta como conferido */
      } else {
        foraDoLugar++;
        if (foraDetalhe.length < 10) foraDetalhe.push('baixo de ' + tok + ' ' + n + ': ' + volta);
      }
    }
  }
}
ok(foraDoLugar === 0,
  'os 97 tokens voltam a altura original em 49 deslocamentos, fundamental e baixo',
  conferidos + ' conferidos, ' + foraDoLugar + ' fora do lugar: ' + foraDetalhe.join(' | '));

let p12ok = 0;
let zeroOk = 0;
for (const tok of CIFRA_CLUB) {
  if (NAO_ACORDE.indexOf(tok) >= 0) continue;
  const linha = tok + '  ' + tok;
  if (moveu(tok, M.transposeCifra(linha, 12, false), 12)) p12ok++;
  if (M.transposeCifra(linha, 0, false) === linha) zeroOk++;
}
ok(p12ok === TOTAL_MOVEM, '+12 preserva a classe em todos os tokens',
  p12ok + ' de ' + TOTAL_MOVEM);
ok(zeroOk === TOTAL_MOVEM, '0 semitons nao altera nenhum dos tokens',
  zeroOk + ' de ' + TOTAL_MOVEM);

/* ============================================================ */
secao('6. baixo: casos fixos e o exemplo do plano');

const INVERSOES = [
  ['C/E', 2, 'D/F#'],
  ['C/G', 5, 'F/C'],
  ['D/F#', 2, 'E/G#'],
  ['Bb/D', 2, 'C/E'],
  ['G/B', -2, 'F/A'],
  ['Am/G', 2, 'Bm/A'],
  ['Cm7/G', 2, 'Dm7/A'],
];
for (const inv of INVERSOES) {
  const saida = M.transposeCifra(inv[0] + '  ' + inv[0], inv[1], false).split(/\s+/)[0];
  ok(saida === inv[2],
    'inversao: ' + inv[0] + ' ' + (inv[1] >= 0 ? '+' : '') + inv[1] + ' -> ' + inv[2],
    'saiu ' + saida);
}

/* ============================================================ */
console.log('\n' + '='.repeat(66));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  PROBLEMAS:');
  problemas.forEach((p) => console.log('   - ' + p));
}
console.log('='.repeat(66) + '\n');
process.exit(falhou ? 1 : 0);