/* =========================================================
   tools/provar-id-unico.js
   Prova que o `test-id-unico` pega o que ele diz pegar.

   Este teste foi escrito depois de um BUG ABERTO que ele proprio achou — a
   importacao no modo `substituir` aceitava `{"cifras": {}}` e trocava o
   repertorio inteiro por uma lista vazia. Um teste que acha bug na primeira
   execucao merece desconfianca ate aprovado: pode ter encontrado por sorte.

   Por isso as mutacoes abaixo desfazem cada uma das CINCO garantias, uma linha
   por vez:

     1. a deduplicacao volta a ser um "aceita e segue" — repassa o id repetido;
     2. a deduplicacao vira "descarta o duplicado" — que tambem e perda de dado,
        por um motivo oposto e igualmente silencioso;
     3. o guard do arquivo malformado some — e o repertorio volta a poder ser
        apagado por um `{"cifras": {}}`;
     4. o guard passa a recusar o backup v1, que e backup de verdade;
     5. a deduplicacao passa a renumerar a PRIMEIRA ocorrencia — o caminho
        oposto: nenhum id se repete, e toda ficha de ensaio perde o alvo.

   A mutacao 2 e a que mais importa para este arquivo: e a versao "aparentemente
   mais segura" da mesma correcao, e ela tambem apaga silencio.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const STORE = path.join(RAIZ, 'js', 'core', 'store.js');
const TESTE = path.join(__dirname, 'test-id-unico.js');
const IMPOR = path.join(__dirname, 'test-importacao.js');

const original = fs.readFileSync(STORE, 'utf8');

/* Este provador ESCREVE no store.js. Se ele morrer no meio — um tempo limite, um
   Ctrl+C, qualquer coisa — a mutacao fica no arquivo de verdade e o proximo
   `npm run verificar` vai medir um codigo que ninguem editou. Isso ja aconteceu
   nesta sessao com outro provador, e a correcao foi a mesma: devolver o arquivo
   em `exit`, em excecao e em sinal, e nao so na linha do fim.
   *
   * A comparacao antes de gravar e o que torna isto seguro: restaurar duas
   * vezes nao estraga nada, porque na segunda o arquivo ja esta igual ao
   * original e a escrita e pulada. Uma flag mutavel daria o mesmo resultado e
   * daria trabalho para manter em dia com os tres pontos de saida abaixo. */
function restaurar() {
  try {
    if (fs.readFileSync(STORE, 'utf8') !== original) {
      fs.writeFileSync(STORE, original, 'utf8');
    }
  } catch (e) { /* nada a fazer: o arquivo esta fechado ou o disco sumiu */ }
}
process.on('exit', restaurar);
process.on('uncaughtException', function (e) { restaurar(); console.error(e); process.exit(1); });
[ 'SIGINT', 'SIGTERM', 'SIGHUP' ].forEach(function (sig) {
  process.on(sig, function () { restaurar(); process.exit(130); });
});

const MUTACOES = [
  {
    nome: 'a deduplicacao foi removida',
    de: '      db.escalas = unicosPorId(inc.escalas, \'esc\'); db.cifras = unicosPorId(inc.cifras, \'cif\');',
    para: '      db.escalas = inc.escalas; db.cifras = inc.cifras;',
    quebra: 'duas cifras com o mesmo id voltam a entrar, e a segunda fica sem porta',
  },
  {
    nome: 'a deduplicacao virou "descarta o duplicado"',
    de: '      const copia = Object.assign({}, r);',
    para: '      return r; const copia = Object.assign({}, r);',
    quebra: 'silencia igual, pelo motivo oposto: a cifra e apagada em vez de ficar sem porta',
  },
  {
    nome: 'o guard do arquivo malformado sumiu',
    de: "    if (!temLista && !temLegado) {",
    para: "    if (false) {",
    quebra: 'volta a apagar o repertorio inteiro ao restaurar um arquivo estragado',
  },
  {
    nome: 'o guard passou a recusar backup legitimo',
    de: '    const temLegado = chavesLegadas.length > 0',
    para: '    const temLegado = false && chavesLegadas.length > 0',
    quebra: 'o backup v1, que nao tem as chaves `escalas` nem `cifras`, deixa de importar',
  },
  {
    nome: 'a deduplicacao passou a renumerar a primeira, e nao a segunda',
    de: '      if (r.id && !vistos.has(r.id)) {',
    para: '      if (false && r.id && !vistos.has(r.id)) {',
    quebra: 'todo registro recebe id novo, e toda ficha de ensaio aponta para o nada',
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

let falhas = 0;
console.log('\n=== o teste de id unico pega a garantia quebrada? ===\n');

for (const m of MUTACOES) {
  if (original.indexOf(m.de) < 0) {
    console.log('  FALHA ' + m.nome);
    console.log('          nao achei a linha: ' + JSON.stringify(m.de.slice(0, 56)));
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

  fs.writeFileSync(STORE, modificado, 'utf8');

  // O teste novo e o de importacao: um pode acusar e o outro nao.
  const rNovo = rodar(TESTE);
  const rAntigo = rodar(IMPOR);
  const acusou = /FALHA/.test(rNovo.saida) || /FALHA/.test(rAntigo.saida);

  fs.writeFileSync(STORE, original, 'utf8');

  if (/SyntaxError/.test(rNovo.saida + rAntigo.saida)) {
    console.log('  FALHA ' + m.nome);
    console.log('          o teste QUEBROU em vez de reprovar');
    falhas++;
    continue;
  }

  console.log((acusou ? '  ok    ' : '  FALHA ') + m.nome);
  if (!acusou) {
    console.log('          passou com a garantia quebrada');
    console.log('          ' + m.quebra);
    falhas++;
  } else {
    const linhas = (rNovo.saida + rAntigo.saida).split('\n').filter((l) => /FALHA/.test(l));
    const primeira = linhas.find((l) => /id|repertorio|cifra|recusad|escalas/.test(l)) || linhas[0];
    if (primeira) console.log('          ' + primeira.trim().slice(0, 92));
  }
}

fs.writeFileSync(STORE, original, 'utf8');
const voltou = fs.readFileSync(STORE, 'utf8') === original;
console.log('\n  ' + (voltou ? 'ok    ' : 'FALHA ') + 'o store.js voltou ao estado original');
if (!voltou) falhas++;

for (const [nome, arq] of [['test-id-unico.js', TESTE], ['test-importacao.js', IMPOR]]) {
  const limpo = rodar(arq);
  const passou = !limpo.caiu && !/FALHA/.test(limpo.saida);
  console.log((passou ? '  ok    ' : '  FALHA ') + 'e ' + nome + ' passa sem nenhum defeito');
  if (!passou) falhas++;
}

console.log('\n  ' + (MUTACOES.length + 3 - falhas) + ' de ' + (MUTACOES.length + 3)
  + ' se comportaram como deviam');
process.exit(falhas ? 1 : 0);