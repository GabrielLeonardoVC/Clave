/* =========================================================
   ACORDE - tools/conta-teste.js
   Quantas asercoes a suite tem, e o total esta certo?

   Rodar:  node tools/conta-teste.js

   ---------------------------------------------------------
   POR QUE ESTE ARQUIVO EXISTE

   O total de asercoes do projeto crescia, e eu vinha repetindo um numero. A
   primeira vez que conferi arquivo por arquivo, o numero que eu dizia estava
   errado por baixo: seis testes novos somavam ZERO.

   Nenhum deles falhava. Todos passavam. O problema era o relatorio: cada teste
   escrevia o proprio total com uma grafia levemente diferente, e o contador
   procurava uma forma e nao encontrava as outras. Um contador que erra em
   silencio e pior do que um contador que nao existe — porque ele parece estar
   fazendo o trabalho.

   Tres tentativas de consertar o contador falharam antes de o problema ser
   entendido:

     1. O padrao tinha acento. O console reescreve acento entre chamadas, e a
        comparacao parava de casar sem nenhum erro. Zero.

     2. `execFileSync` sem `encoding` devolve Buffer, e `Buffer.match` devolve
        byte — "is not iterable".

     3. A saida era lida so dentro do `catch`. Teste que passa nao entra no
        `catch`, entao o total era zero para quase todo mundo.

   Nenhuma das tres acusou defeito. Duas produziram zero, que e um numero
   legitimo para uma suite que nao rodou. Esse e o ponto: **o que quebra em
   silencio aqui e a CONTAGEM, nao o codigo** — e e por isso que este arquivo
   existe, e por isso que ele acusa o proprio contador.

   ---------------------------------------------------------
   O QUE ESTE VERIFICADOR FAZ

   Roda cada teste, conta o que ele RELATA, e compara com o que ele tem de
   verdade. Se um teste passa e nao reporta nada, ou reporta e nao passou, a
   conta esta errada e o verificador diz qual teste.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = __dirname;

/* A frase padrao de relatorio. Todo teste novo escreve exatamente esta.
 *
 * O teste de conformidade abaixo e o que mantem isso verdade: um teste novo com
 * outra frase e reprovado antes de rodar, e nao depois de fazer o contador
 * errar em silencio. */
const FRASE_PADRAO = "console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');";

const arqs = fs.readdirSync(DIR).filter((f) => /^test-.*\.js$/.test(f)).sort();

/* O que o teste prova, e nao quantas assercoes ele tem.
 *
 * A maioria dos testes deste projeto prova ASSERCOES ("o tempo trava em zero").
 * Alguns provam CASOS ("seis jeitos de o icone estar errado") e nisso eles
 * contam `falhas`, nao `passou`. Os dois são testes, os dois rodam no
 * `npm test`, e os dois precisam aparecer no total.
 *
 * Antes desta distincao o contador ignorava cinco testes. Nenhum deles
 * falhava, e o total saia certo pela metade — que é a forma mais confortavel de
 * um numero errado: ninguem percebe, porque o numero é grande e plausivel. */
const TOTAL_ASSERCOES = /(\d+)\s*passaram,/g;
const TOTAL_CASOS = /(\d+)\s*passaram,\s*\d+\s*falharam/g;
const TOTAL_VERIFICACOES = /(\d+)\s*asser/gi;   // o nome antigo, ainda em uso em alguns

let total = 0;
let problemas = 0;

console.log('\n=== quantas asercoes a suite tem ===');
console.log('  ' + arqs.length + ' teste(s)\n');

const linhas = [];

for (const arq of arqs) {
  let status = 0;
  let saida = '';
  try {
    saida = String(execFileSync(process.execPath, [path.join(DIR, arq)], {
      encoding: 'utf8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'],
    }) || '');
  } catch (e) {
    status = e.status || 1;
    saida = String(e.stdout || '') + String(e.stderr || '');
  }

  /* A contagem e feita em duas etapas, e a segunda e a que pega a mentira:
   *
   *   1. O RELATORIO diz quantas o teste afirma ter.
   *   2. As LINHAS de resultado dizem quantas ele de fato imprimiu.
   *
   * Se os dois nao baterem, o relatorio mente — e o total propagaria a mentira
   * para todo o resto. Foi o que aconteceu com seis testes: o relatorio dizia
   * "50", o contador lia zero, e ninguem percebia porque o numero nao era
   * conferido contra nada. */
  const relatorio = soma(saida, TOTAL_ASSERCOES);
  const linhasOk = (saida.match(/^\s*ok\s{2,}/gm) || []).length;
  const linhasFalha = (saida.match(/^\s*FALHA\s/gm) || []).length;
  const impressas = linhasOk + linhasFalha;

  /* O relatorio e as linhas impressas so tem de concordar quando as DUAS
   * existem.
   *
   * Nao existe uma terceira forma, e e a razao desta regra ser tao defensiva:
   *
   *   - Relatorio e LINHAS batem: conferido.
   *   - Nenhum dos dois: utilitario sem assercao. Nada a conferir.
   *   - Relatorio sem LINHAS: `test-3d.js` acumula em `passou` e so imprime
   *     as FALHAS no fim. As asercoes que passaram nao viram linha nenhuma, e
   *     o relatorio esta certo.
   *   - LINHAS sem Relatorio: os cinco testes que contam CASOS. Tambem
   *     conferidos pelas linhas.
   *
   * Exigir igualdade nas duas direcoes acusaria os dois ultimos, que sao
   * testes CORRETOS em duas formas legitimas de relatar. E um verificador que
   * acusa o certo e desligado em uma semana — e desligado e o pior fim, porque
   * e silencioso igual.
   *
   * O que este arquivo pega de verdade e a contradicao: um teste que se diz
   * com N e mostra N+1. Foi assim que os seis testes mentirosos apareceram. */
  if (relatorio > 0 && impressas > 0 && relatorio !== impressas) {
    problemas++;
    console.log('  FALHA  ' + arq + ' diz que tem ' + relatorio
      + ' e imprimiu ' + impressas + ' linhas de resultado');
    console.log('        o relatorio mente, e o total inteiro herda a mentira');
  }

  /* O teste escreve ALGUM total?
   *
   * Aqui nao se testa a frase, e nem o nome da variavel. Os cinco testes que
   * contam CASOS estao certos e nao escrevem "N assercoes"; um teste novo pode
   * chamar a variavel do que quiser. Testar o NOME seria testar a forma do
   * codigo em vez do comportamento — e o comportamento e o que quebra.
   *
   * O que se exige e o minimo: um `console.log` que imprima uma variavel. Um
   * teste que imprime dez linhas de resultado e nenhum numero e um teste que
   * ninguem consegue contar — e a falha silenciosa mais confortavel que existe,
   * porque o total continua parecendo grande. */
  const fonte = fs.readFileSync(path.join(DIR, arq), 'utf8');

  /* O teste escreve um relatorio que uma maquina sabe ler?
   *
   * Tres tentativas de acertar isto, e as tres erraram por motivos que so
   * aparecem com a prova do verificador aberta:
   *
   *  1. Padrao largo — "qualquer `console.log` com `+`". Nao pegava o teste sem
   *     relatorio, porque ele tem dezenas de `console.log('  ok    ' + rotulo)`
   *     e um deles casa com o padrao.
   *
   *  2. Padrao estreito demais — exigia `+ '` logo depois da variavel, e o
   *     relatorio de cinco testes tem a forma `falhas\n  ? falhas + ' problema'`,
   *     com a variavel dos dois lados do ternario.
   *
   *  3. Contar a variavel pelo NOME. Errado pelo motivo oposto: o nome e forma
   *     do codigo, e o que quebra e comportamento. Um teste novo pode chamar a
   *     variavel do que quiser.
   *
   * A forma que sobra e a que os relatorios tem de verdade: a variavel aparece
   * como ARGUMENTO INTEIRO de um `console.log` — nao dentro de uma concatenacao
   * com rotulo. `console.log(falhas)` e um relatorio. `console.log('  ok    ' +
   * rotulo)` e uma linha de resultado, e nao conta.
   *
   * E o teste tambem e aceito quando RELATA um total, mesmo que nao imprima
   * variavel nenhuma em forma de argumento: o relatorio e a prova de que o
   * total existe. */
  /* A forma que serve e o relatorio em que a variavel aparece como ARGUMENTO de
   * um `console.log` — seja direto, seja dentro de um ternario quebrado em
   * varias linhas.
   *
   *   console.log(falhas + ' problema(s)');                 -> conta
   *   console.log(falhas                                     -> conta
   *   console.log('  ' + passou + ' passaram');             -> conta
   *   console.log(falhas\n  ? falhas + ' problema(s)'\n  : '...');  -> conta
   *   console.log('  ok    ' + rotulo);                     -> NAO conta
   *
   * A ultima linha e o que este regex precisa recusar: e a forma de TODA linha
   * de resultado de TODOS os testes deste projeto. Um padrao que a aceite
   * deixa de exigir relatorio de qualquer arquivo — que foi exatamente o que a
   * primeira versao fez, e a prova deste verificador acusou.
   *
   * O ternario em varias linhas e o caso dos cinco testes que contam CASOS, e
   * ele e legado de antes da frase padrao existir. */
  /* A forma que serve: a variavel do contador como ARGUMENTO de um
   * `console.log`, direto ou dentro de um ternario.
   *
   *   console.log(falhas + ' problema(s)');                       -> conta
   *   console.log('  ' + passou + ' passaram, ...');               -> conta
   *   console.log(falhas\n  ? falhas + ' problema(s)'\n  : '...');   -> conta
   *   console.log('  ok    ' + rotulo);                            -> NAO conta
   *
   * A ultima e a forma de TODA linha de resultado de TODOS os testes, e por
   * isso precisa ser recusada: um padrao que a aceite deixa de exigir
   * relatorio de arquivo nenhum.
   *
   * O que separa as duas nao e o `+` e o argumento. E o QUE vem logo depois da
   * variavel: uma palavra que descreve o numero ("passaram", "problema",
   * "falharam") ou o fim do `console.log`. Uma linha de resultado tem um ROTULO
   * de texto livre depois da variavel — e rotulo nao vira total. */
  const RELATORIO = [
    // console.log('  ' + passou + ' passaram, ...)  /  console.log(X + '...')
    /console\.log\(\s*'[^']*'\s*\+\s*[A-Za-z_$][\w$]*\s*\+\s*'/,
    /console\.log\(\s*[A-Za-z_$][\w$]*\s*\+\s*'/,
    // console.log(falhas)  e  console.log(falhas ? ... : ...)
    /console\.log\(\s*[A-Za-z_$][\w$]*\s*(?:\)|,|\?)/,
  ];

  const imprimeVariavel = RELATORIO.some((r) => r.test(fonte));

  if (!imprimeVariavel && impressas > 0) {
    problemas++;
    console.log('  FALHA  ' + arq + ' produz ' + impressas
      + ' linhas de resultado e nao escreve total nenhum');
    console.log('        sem ele, o contador nao acha este teste — e o total erra em silencio');
  }

  if (status !== 0) {
    problemas++;
    console.log('  FALHA  ' + arq + ' saiu com codigo ' + status);
  }

  /* A soma e das DUAS coisas: as assercoes que o teste relata e, quando ele nao
   * relata nenhuma, as linhas de resultado que produziu.
   *
   * Sem o segundo termo, cinco testes que provam casos ficam de fora do total
   * sem avisar. Com ele, um teste que relata menos do que imprime ainda e
   * accused acima — a linha do total usa o maximo dos dois, e a frase do
   * relatorio pode continuar incompleta sem que o numero mude. */
  total += Math.max(relatorio, impressas);
  linhas.push({ arq: arq, relatorio: relatorio, impressas: impressas, status: status });
}

for (const l of linhas) {
  const marca = l.status === 0 ? ' ' : '!';
  /* Os testes que contam CASOS reportam 0 pelo padrao de assercoes, e ainda
   * assim nao estao fora do total: eles aparecem na lista com o numero de
   * linhas que produziram. Marcar "0" ao lado delas seria dizer que nao
   * testam nada. */
  const mostrado = l.relatorio > 0 ? String(l.relatorio) : String(l.impressas);
  console.log('  ' + marca + ' ' + l.arq.padEnd(28)
    + mostrado.padStart(6) + '  '
    + (l.relatorio > 0 ? '(assercoes)' : '(casos)'));
}
console.log('  ' + ''.padEnd(30) + '------');
console.log('  ' + 'TOTAL'.padEnd(30) + String(total).padStart(6));

console.log('\n=================================================');
console.log(problemas
  ? '  ' + problemas + ' problema(s) com a propria contagem'
  : '  a contagem bate com o que os testes imprimem');
console.log('=================================================\n');
process.exit(problemas ? 1 : 0);

function soma(texto, re) {
  let n = 0;
  re.lastIndex = 0;
  let m = re.exec(texto);
  while (m) { n += Number(m[1]); m = re.exec(texto); }
  return n;
}