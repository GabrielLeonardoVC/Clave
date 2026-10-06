/* =========================================================
   tools/provar-musica.js
   Prova que o `test-musica` pega o que ele diz pegar.

   POR QUE UM PROVADOR DESTE ARQUIVO

   O `test-musica` foi escrito DEPOIS de encontrar defeito: a escala saia com
   a letra errada e o rotulo do grau mentia sobre a qualidade. Um teste que
   acha bug na primeira execucao merece desconfianca ate aprovado — pode ter
   achado por sorte, e um teste que passa sempre nao prova nada.

   Cada mutacao abaixo desfaz UMA LINHA do motor e o teste tem de reclamar.
   Sem essa etapa, "113 asercoes passaram" e so um numero.

   A MUTACAO MAIS IMPORTANTE E A PRIMEIRA

   `iv.length !== 7` e o que separa a regra das sete letras das demais
   escalas. A primeira versao desta funcao aceitava qualquer contagem e
   aplicava a regra das 7 letras na pentatonica, que tem 5 notas — e o
   resultado tinha as alturas erradas. O proprio teste pegou isso. As demais
   mutacoes confirmam que o resto do caminho continua sendo conferido.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const MUSIC = path.join(RAIZ, 'js', 'core', 'music.js');
const TESTE = path.join(__dirname, 'test-musica.js');
/* As duas suites sao as duas portas do mesmo motor: uma mede a grafia da
 * escala, a outra mede o parser de acorde. Uma mutacao pode ser pego por
 * qualquer uma das duas, e nao importa qual avisou — importa que alguma
 * avise. E por isso que a falha e procurada nas duas. */
const TESTE2 = path.join(__dirname, 'test-acordes.js');

const original = fs.readFileSync(MUSIC, 'utf8');

const MUTACOES = [
  {
    nome: 'a regra das 7 letras passou a valer para toda escala',
    de: 'if (iv.length !== 7) {',
    para: 'if (false) {',
    quebra: 'a pentatonica e o blues passam a subir uma letra por grau e saem com a altura errada',
  },
  {
    nome: 'o grau parou de subir a letra da tonica',
    de: 'const letra = LETRAS[(inicio + g) % 7];',
    para: 'const letra = LETRAS[g % 7];',
    quebra: 'a menor de Do comeca em C mas anda de A para cima, e as letras sao de outro tom',
  },
  {
    nome: 'a tonica deixou de importar',
    de: 'const nomeDaTonica = opts.tonica || noteName(pc, useFlatsFor(pc));',
    para: "const nomeDaTonica = opts.tonica || 'C';",
    quebra: 'toda escala e escrita a partir da letra C, e F maior vira Fbbbb maior',
  },
  {
    nome: 'o rotulo do grau voltou a mentir',
    de: "if (qualidade === 'm') return numeral.toLowerCase();",
    para: "if (false) return numeral.toLowerCase();",
    quebra: '"Grau II" volta para cima de Dm, e o numero passa a afirmar o que nao e',
  },
  {
    nome: 'a qualidade desconhecida voltou a se dizer conhecida',
    de: "conhecido: q !== '?',",
    para: 'conhecido: true,',
    quebra: 'a pentatonica volta a chamar C de maior, sem a escala ter terceira',
  },

  /* As regras de grafia numerica do parser. Cada uma delas existia para
   * consertar um silencio: o sufixo nao casava, voltava vazio, e vazio e
   * maior. A mutacao nao "quebra" o codigo — ela faz o parser voltar a
   * aceitar o silencio, que e o jeito mais perigoso de falhar. */
  {
    nome: 'o "4" numerico voltou a virar tríade maior',
    de: ".replace(/^4$/, 'sus4')",
    para: ".replace(/^ZZZ$/, 'sus4')",
    quebra: '"C4" volta a soar como C maior, e o acidente continua sendo C',
  },
  {
    nome: 'o "0" numerico voltou a virar tríade maior',
    de: ".replace(/^0$/, 'dim')",
    para: ".replace(/^ZZZ$/, 'dim')",
    quebra: '"C0" volta a soar como C maior em vez de diminuto',
  },
  {
    nome: 'o "2" numerico voltou a virar tríade maior',
    de: ".replace(/^2$/, 'sus2')",
    para: ".replace(/^ZZZ$/, 'sus2')",
    quebra: '"C2" volta a soar como C maior em vez de suspensa de segunda',
  },
  {
    nome: 'o "5+" voltou a virar tríade maior',
    de: ".replace(/^5aug$/, 'aug')",
    para: ".replace(/^ZZZ$/, 'aug')",
    quebra: '"C5+" volta a soar como C maior em vez de aumentado',
  },
  {
    nome: 'o travessão antes do b5 deixou de ser lido',
    de: "s = s.replace(/-5b5$/, '7b5');",
    para: "s = s.replace(/ZZZ$/, '7b5');",
    quebra: '"Cm-5b5" volta a soar como C maior em vez de meio-diminuto',
  },
  {
    nome: 'a extensao com barra voltou a ser engolida',
    de: "s = s.replace(/^7\\/(9|11|13)$/, '$1')",
    para: "s = s.replace(/^ZZZ$/, '$1')",
    quebra: '"C7/9" volta a virar C maior, e o accordionista toca a coisa errada',
  },
  {
    nome: 'o "6/9" foi engolido pela regra da extensao',
    de: "s = s.replace(/^7\\/(9|11|13)$/, '$1')",
    para: "s = s.replace(/^(\\d)\\/(9|11|13)$/, '$1')",
    quebra: '"C6/9" perde a sexta e vira C9, que e outro acorde',
  },

  /* O ULTIMO BUG DO PARSER: sufixo desconhecido virando maior, e o preco
   * being paid by transposeLine, que reconstruía o nome do acorde. */
  {
    nome: 'o sinal de sufixo desconhecido sumiu',
    de: "const conhecido = !(sufixo !== '' && quality === '');",
    para: "const conhecido = true;",
    quebra: '"C69" volta a ser tratado como maior conhecido, e o 69 some ao transpor',
  },
  {
    nome: 'a transposicao voltou a descartar o sufixo desconhecido',
    de: 'if (chord.conhecido === false) {',
    para: 'if (false) {',
    quebra: '"C69" transpondo +2 volta a virar "D": o texto do acorde se perde na tela',
  },
  {
    nome: 'o titulo de tom com lixo voltou a virar maior',
    de: 'if (c && c.conhecido === false) return null;',
    para: 'if (false) return null;',
    quebra: '"[C999]" volta a ser lido como Do maior, e a cifra toda e transposta por um tom inventado',
  },
  {
    nome: 'o transpor por grau voltou a contornar a guarda',
    de: 'if (c.conhecido === false) {',
    para: 'if (false) {',
    quebra: 'no transpor por grau, "C69" volta a ser reharmonizado como se fosse conhecido',
  },
];

function rodar(arquivo) {
  try {
    const saida = execFileSync(process.execPath, [arquivo], { encoding: 'utf8', cwd: RAIZ, timeout: 180000 });
    return { saida: saida, caiu: false };
  } catch (e) {
    return { saida: (e.stdout || '') + (e.stderr || ''), caiu: true };
  }
}

/* Este provador ESCREVE no music.js. Se ele morrer no meio — um tempo limite,
 * um Ctrl+C — a mutacao fica no arquivo de verdade e o proximo `npm run
 * verificar` mede um codigo que ninguem editou. Por isso a restauracao
 * acontece em `exit`, em excecao e em sinal, e nao so no fim.
 *
 * A comparacao antes de gravar e o que torna isto seguro: restaurar duas
 * vezes nao estraga nada, porque na segunda o arquivo ja esta igual ao
 * original e a escrita e pulada. */
function restaurar() {
  try {
    if (fs.readFileSync(MUSIC, 'utf8') !== original) fs.writeFileSync(MUSIC, original, 'utf8');
  } catch (e) { /* nada a fazer: o arquivo esta fechado ou o disco sumiu */ }
}
process.on('exit', restaurar);
process.on('uncaughtException', function (e) { restaurar(); console.error(e); process.exit(1); });
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(function (sig) {
  process.on(sig, function () { restaurar(); process.exit(130); });
});

let falhas = 0;
console.log('\n=== o teste musical pega a garantia quebrada? ===\n');

for (const m of MUTACOES) {
  if (original.indexOf(m.de) < 0) {
    console.log('  FALHA ' + m.nome);
    console.log('          nao achei a linha: ' + JSON.stringify(m.de.slice(0, 52)));
    falhas++;
    continue;
  }
  if (original.split(m.de).length - 1 > 1) {
    console.log('  FALHA ' + m.nome);
    console.log('          a linha aparece mais de uma vez, e a mutacao seria ambigua');
    falhas++;
    continue;
  }

  const modificado = original.split(m.de).join(m.para);
  if (modificado === original) {
    console.log('  FALHA ' + m.nome);
    console.log('          a troca nao mudou nada');
    falhas++;
    continue;
  }

  fs.writeFileSync(MUSIC, modificado, 'utf8');

  const r = rodar(TESTE);
  const r2 = rodar(TESTE2);

  fs.writeFileSync(MUSIC, original, 'utf8');

  const tudo = r.saida;
  if (/SyntaxError|ReferenceError|TypeError/.test(tudo + r2.saida)) {
    console.log('  FALHA ' + m.nome);
    console.log('          o teste QUEBROU em vez de reprovar');
    console.log('          ' + (tudo.split('\n').filter((l) => /Error/.test(l))[0] || '').trim().slice(0, 88));
    falhas++;
    continue;
  }

  const acusou = /FALHA/.test(tudo) || /FALHA/.test(r2.saida);
  console.log((acusou ? '  ok    ' : '  FALHA ') + m.nome);
  if (!acusou) {
    console.log('          passou com a garantia quebrada');
    console.log('          ' + m.quebra);
    falhas++;
  } else {
    const linhas = tudo.split('\n').filter((l) => /FALHA/.test(l));
    const primeira = linhas.find((l) => /letra|altura|tonica|rotulo|maior|conhecid/i.test(l)) || linhas[0];
    if (primeira) console.log('          ' + primeira.trim().slice(0, 92));
  }
}

restaurar();
const voltou = fs.readFileSync(MUSIC, 'utf8') === original;
console.log('\n  ' + (voltou ? 'ok    ' : 'FALHA ') + 'o music.js voltou ao estado original');
if (!voltou) falhas++;

const limpo = rodar(TESTE);
const limpo2 = rodar(TESTE2);
const passou = !limpo.caiu && !limpo2.caiu && !/FALHA/.test(limpo.saida + limpo2.saida);
console.log((passou ? '  ok    ' : '  FALHA ') + 'e as duas suites passam sem nenhum defeito');
if (!passou) falhas++;

console.log('\n  ' + (MUTACOES.length + 2 - falhas) + ' de ' + (MUTACOES.length + 2)
  + ' se comportaram como deviam');
process.exit(falhas ? 1 : 0);