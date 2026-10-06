/* =========================================================
   tools/provar-quota-vs.js
   PROVADOR POR MUTACAO DAS REGRAS DE FALHA DE GRAVACAO

   POR QUE ESTE ARQUIVO EXISTE

   A regra do projeto e direta: um verificador que nunca acusa nada e pior que
   nenhum verificador, porque treina a pessoa a ignorar a regra. Estas regras de
   falha de gravacao nasceram de um defeito real — o toast verde "Faixa gravada"
   para um audio que o armazenamento tinha recusado — e a versao delas que
   escrevi primeiro PASSAVA com o defeito de volta no lugar.

   Duas razoes, ambas medidas:

     1. a regra do resultado lido procurava qualquer `ultimoErro(` numa janela
        de cerca de 7 KB entre o save e o toast — e cabia mais do que um deles;
     2. a regra da retentativa procurava o IDENTIFICADOR `pendenteDeSalvar`, que
        aparece na declaracao e em duas atribuicoes, de modo que apagar a guarda
        do botao nao derrubava nada.

   Este arquivo apaga cada protecao por vez e exige que a regra ACUSE. Se uma
   mutacao passar, o arquivo sai com codigo 1 — porque nesse caso a regra esta
   fraca e precisa ser reescrita antes de valer como prova.

   O QUE ESTE ARQUIVO NAO PROVA

   Nada sobre o comportamento real do navegador, sobre microfone, sobre
   permission, nem sobre o que acontece quando a cota e' atingida de verdade.
   Ele prova uma coisa so: que as regras do `check-ios` distinguem o codigo
   certo do codigo com o defeito.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ALVO = path.join(RAIZ, 'js', 'views', 'cancao.js');
const VERIFICADOR = path.join(RAIZ, 'tools', 'check-ios.js');
const orig = fs.readFileSync(ALVO, 'utf8');

/* ===========================================================
   A REDE DE SEGURANCA

   Este arquivo EDITA O CODIGO DO PRODUTO enquanto prova as regras. O `finally`
   cobre excecao lancada. Nao cobre o processo morto: Ctrl+C, SIGTERM, uma
   janela fechada, `taskkill`, uma tomada no meio.

   Sem isto, um provador interrompido deixava `cancao.js` mutado — e a rodada
   seguinte, que le o arquivo, herdava o defeito e nao saberia de onde veio. Um
   provador que corrompe o alvo e' pior do que nenhum: ele continua passando.

   Quatro camadas, da mais forte para a mais fraca:

     1. uma COPIA do original em disco, escrita ANTES da primeira mutacao;
     2. a restauracao repetida em `exit`, que o Node roda em saida normal,
        `process.exit()`, e lancamento de excecao nao tratada;
     3. os sinais que nao passam por `exit`: SIGINT, SIGTERM, SIGHUP;
     4. a restauracao normal, no fim de cada mutacao.

   E, depois de tudo, a conferencia byte a byte — porque uma rede que nunca foi
   testada nao e uma rede.
   =========================================================== */
const COPIA = path.join(os.tmpdir(), 'clave-cancao-original.js');
fs.writeFileSync(COPIA, orig, 'utf8');

let restaurado = false;
function restaurar() {
  if (restaurado) return;
  restaurado = true;
  try { fs.writeFileSync(ALVO, orig, 'utf8'); } catch (e) { /* disco cheio: a copia existe */ }
  /* Se a restauracao falhar, a copia em disco ainda pode salvar o dia. */
  try {
    const atual = fs.readFileSync(ALVO, 'utf8');
    if (atual !== orig) fs.copyFileSync(COPIA, ALVO);
  } catch (e) { /* nada a fazer aqui; a copia foi deixada em ${COPIA} */ }
}

process.on('exit', restaurar);
['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'].forEach(function (s) {
  process.on(s, function () {
    restaurar();
    console.log('\n  ' + s + ' recebido. O codigo do produto foi restaurado.');
    process.exit(130);
  });
});
process.on('uncaughtException', function (e) {
  restaurar();
  console.error('\n  excecao nao tratada: ' + (e && e.stack ? e.stack : e));
  console.error('  o codigo do produto foi restaurado.');
  process.exit(1);
});

/* Cada mutacao remove UMA protecao. A coluna `espera` nao e conferida aqui — o
 * que interessa e o codigo de saida: acusou ou nao. */
const MUTACOES = [
  {
    nome: 'M1 o retorno do save e ignorado (o defeito original)',
    de: /const erro = typeof S\.ultimoErro === 'function' \? S\.ultimoErro\(\) : null;\r?\n(\s*)const naoSalvou = erro === 'cheio' \|\| erro === 'erro';/,
    para: '/* mutado: o resultado foi descartado */$1const naoSalvou = false;',
  },
  {
    nome: 'M2 o botao volta a gravar por cima do audio',
    de: /if \(pendenteDeSalvar\) \{ tentarSalvar\(\); return; \}\r?\n\s*/,
    para: '',
  },
  {
    nome: 'M3 nenhuma frase diz que nao salvou',
    de: /NÃO foi salva|Não foi salva|nao foi salva/g,
    para: 'ficou gravada',
  },
  {
    nome: 'M4 a retentativa le o erro ANTES do save',
    de: /function tentarSalvar\(\) \{\r?\n(\s*)aoMudar\(\);\r?\n(\s*)const erro = typeof S\.ultimoErro === 'function' \? S\.ultimoErro\(\) : null;/,
    para: 'function tentarSalvar() {\n$1const erro = S.ultimoErro();   // mutado: lido ANTES\n$1aoMudar();',
  },
];

function rodarVerificador() {
  try {
    execFileSync('node', [VERIFICADOR], { encoding: 'utf8' });
    return 0;
  } catch (e) {
    return e.status === 0 ? 1 : e.status;
  }
}

function restoring(fn) {
  try { fn(); } finally { fs.writeFileSync(ALVO, orig, 'utf8'); }
}

let acusouCerto = 0;
let escapou = 0;
const problemas = [];

console.log('=== SEM MUTACAO: o codigo bom tem de passar inteiro ===');
const base = rodarVerificador();
console.log('  exit=' + base + '  -> ' + (base === 0 ? 'PASSA (certo)' : '*** ACUSOU O CODIGO BOM ***'));
if (base !== 0) problemas.push('o codigo bom foi acusado');

console.log('\n=== CADA MUTACAO TEM DE SER ACUSADA ===');
for (const m of MUTACOES) {
  const mutado = orig.replace(m.de, m.para);
  if (mutado === orig) {
    console.log('  ' + m.nome.padEnd(48) + ' A REGRA NAO APLICOU (nada mudou)');
    escapou++;
    problemas.push(m.nome + ': a regra nao casa com o codigo');
    continue;
  }
  let codigo;
  restoring(() => { fs.writeFileSync(ALVO, mutado, 'utf8'); codigo = rodarVerificador(); });
  if (codigo === 0) {
    escapou++;
    problemas.push(m.nome + ': a regra passou com o defeito');
  }
  acusouCerto++;
  console.log('  ' + m.nome.padEnd(48) + ' exit=' + codigo + '  '
    + (codigo === 0 ? '*** PASSOU: REGRA FRACA ***' : 'ACUSOU (a regra ve)'));
}

/* O arquivo tem de voltar exatamente como estava. Um provador que deixa o
 * codigo mutado e' pior do que nenhum provador: a rodada seguinte CONFIA nele. */
const voltou = fs.readFileSync(ALVO, 'utf8') === orig;
console.log('\n=== o codigo voltou inteiro: ' + (voltou ? 'SIM' : 'NAO') + ' ===');
if (!voltou) problemas.push('o arquivo nao voltou ao estado original');

console.log('\n' + '='.repeat(58));
console.log('  ' + acusouCerto + ' de ' + MUTACOES.length + ' mutacoes acusadas, ' + escapou + ' escaparam');
if (problemas.length) {
  console.log('\n  Uma regra que passa com o defeito nao e prova: e decoracao.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(58) + '\n');
process.exit(problemas.length ? 1 : 0);