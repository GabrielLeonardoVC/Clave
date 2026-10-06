/* =========================================================
   tools/provar-tuner-bench.js
   O BENCHMARK DO TUNER AINDA PEGA REGRESSAO?

   POR QUE ESTE ARQUIVO EXISTE

   Na V5.17 o `test-tuner` falhava de forma intermitente: 5-6 ms num processo
   carregado, 1,6 ms isolado. A correcao foi NO BENCHMARK — aquecimento e o
   minimo de cinco rodadas — e o limite continuou em 2,5 ms.

   Isso cria um risco novo e obvio: um benchmark estabilizado pode ter ficado
   insensivel. Se o minimo de cinco rodadas filtra o ruido E a regressao, o
   teste passa com o tuner duas vezes mais lento e ninguem ve.

   Este arquivo fecha esse risco. Ele NAO confia no limite, e NAO procura a
   palavra "2,5" no codigo: ele mede os dois lados do mesmo benchmark.

   O QUE ELE FAZ

     1. mede o tuner como esta hoje;
     2. introduz uma PENALIDADE REAL no caminho medido — o mesmo `detectar`,
     duas vezes por chamada;
     3. mede de novo;
     4. exige que o baseline fique abaixo do limite e o mutado ACIMA dele.

   O criterio e' o TEMPO, nas duas pontas. Se a mutacao nao deixar o codigo mais
   lento, este arquivo falha — e ele falha porque o trabalho extra nao apareceu,
   nao porque uma string foi procurada.

   A MUTACAO E' REAL E EXECUTADA

   O `detectar` devolve a frequencia estimada. Chamar o corpo dele duas vezes e
   devolver a segunda consome o dobro do trabalho — e o resultado continua
   correto, porque a mesma entrada devolve a mesma resposta. Nao e' um no-op:
   e' o dobro do calculo, e o benchmark tem de sentir.

   A restauracao e' a mesma rede do `provar-quota-vs` e do `provar-guarda-vs`:
   copia antes, restauracao em `exit` e nos sinais, `uncaughtException`, e a
   conferencia byte a byte no fim.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ALVO = path.join(RAIZ, 'js', 'core', 'tuner.js');
const TESTE = path.join(RAIZ, 'tools', 'test-tuner.js');
const original = fs.readFileSync(ALVO, 'utf8');

const DIR = path.join(os.tmpdir(), 'clave-tuner-original');
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(path.join(DIR, 'tuner.js'), original, 'utf8');

let restaurado = false;
function restaurar() {
  if (restaurado) return;
  restaurado = true;
  try { fs.writeFileSync(ALVO, original, 'utf8'); } catch (e) { /* disco cheio */ }
  try {
    if (fs.readFileSync(ALVO, 'utf8') !== original) {
      fs.copyFileSync(path.join(DIR, 'tuner.js'), ALVO);
    }
  } catch (e) { /* a copia ficou no tmp */ }
}
process.on('exit', restaurar);
['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'].forEach((s) => process.on(s, function () {
  restaurar(); console.log('\n  ' + s + ' recebido. O tuner foi restaurado.'); process.exit(130);
}));
process.on('uncaughtException', function (e) {
  restaurar(); console.error('\n  excecao: ' + (e && e.stack ? e.stack : e)); process.exit(1);
});

const problemas = [];
let passou = 0; let falhou = 0;
const ok = (c, t, d) => {
  if (c) { passou++; console.log('  ok    ' + t + (d ? '  (' + d + ')' : '')); }
  else { falhou++; problemas.push(t); console.log('  FALHA ' + t + (d ? '  (' + d + ')' : '')); }
};

/* O mesmo estimador do `test-tuner`: aquecimento e minimo de cinco rodadas.
 * Usar o MESMO e' o que torna a comparacao justa — se o teste fosse burro, a
 * leitura daqui seria burra tambem, e o zero-um continuaria de pe. */
function medir() {
  delete require.cache[require.resolve(ALVO)];
  const T = require(ALVO);
  const TAXA = 48000; const N = 4096;
  const buf = new Float32Array(N);
  for (let i = 0; i < N; i++) buf[i] = Math.sin((2 * Math.PI * 440 * i) / TAXA) * 0.8;
  for (let w = 0; w < 5; w++) T.detectar(buf, TAXA);
  let melhor = Infinity;
  for (let r = 0; r < 5; r++) {
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) T.detectar(buf, TAXA);
    const rodada = (Date.now() - t0) / 20;
    if (rodada < melhor) melhor = rodada;
  }
  return melhor;
}

function oTestePassa() {
  try { execFileSync('node', [TESTE], { encoding: 'utf8', stdio: 'pipe' }); return true; }
  catch (e) { return false; }
}

console.log('=== 1. BASELINE: o tuner como esta hoje ===');
restaurado = false;
const base = medir();
const basePassa = oTestePassa();
console.log('  tempo medido ..... ' + base.toFixed(2) + ' ms (limite 2,5)');
console.log('  o teste passa .... ' + (basePassa ? 'sim' : 'NAO'));
ok(base < 2.5, 'o baseline fica abaixo do limite', base.toFixed(2) + ' ms');
ok(basePassa, 'e o arquivo de teste aprova o codigo como esta');

/* ---- A MUTACAO: o dobro do trabalho no caminho medido ---- */
console.log('\n=== 2. MUTACAO: o corpo do `detectar` passa a rodar duas vezes ===');

/* A mutacao e' sobre a FUNCAO exportada, e nao sobre um trecho solto: e' o
 * caminho que o benchmark mede que precisa ficar mais caro. */
/* A MUTACAO: trabalho caro DENTRO do caminho medido, sem mudar a resposta.
 *
 * A primeira versao desta prova trocava `detectar` por uma funcao que se
 * chamava de novo — o dobro do trabalho, porem RECURSIVO: a mutacao nao deixava
 * o tuner lento, deixava-o quebrado. E um benchmark quebrado nao prova nada:
 * o teste reprovaria por uma razao que nada tem com performance, e eu
 * reportaria "a prova passou" tendo medido um estouro de pilha.
 *
 * Aqui a penalidade e' aritmetica pura dentro do corpo, descartada logo em
 * seguida: o `detectar` devolve exatamente o que devolvia antes, e so demora
 * mais. E' o "trabalho claramente custoso dentro da operacao medida" que a
 * propria missao lista como aceitavel. */
const m = /(const cheio = preparar\(dados\);)/.exec(original);
if (!m) {
  console.log('  *** nao achei o ponto de entrada da medicao — a prova nao pode rodar ***');
  process.exit(1);
}
const penalidade = m[0] + '\n' +
  '    { let p = 0; for (let q = 0; q < 200000; q++) p += Math.sqrt(q); if (p < 0) return nada; }';
const mutado = original.replace(m[0], penalidade);
if (mutado === original) {
  console.log('  *** a mutacao nao aplicou ***');
  process.exit(1);
}

restaurado = false;
fs.writeFileSync(ALVO, mutado, 'utf8');
let mutadoMs; let mutadoPassa;
try {
  mutadoMs = medir();
  mutadoPassa = oTestePassa();
} catch (e) {
  console.log('  *** o codigo mutado quebrou: ' + (e && e.message) + ' ***');
  mutadoMs = NaN; mutadoPassa = true;
}
restaurar();

console.log('  tempo medido ..... ' + (isNaN(mutadoMs) ? '(quebrou)' : mutadoMs.toFixed(2) + ' ms'));
console.log('  o teste passa .... ' + (mutadoPassa ? 'sim' : 'NAO'));
ok(!isNaN(mutadoMs) && mutadoMs > 2.5,
  'o codigo mutado estoura o limite', isNaN(mutadoMs) ? 'quebrou' : mutadoMs.toFixed(2) + ' ms');
ok(mutadoPassa === false,
  'e o arquivo de teste REPROVA o codigo mutado',
  'o teste passou com o tuner duas vezes mais lento');
ok(mutadoMs > base * 1.4,
  'o mutado e' + 'ao menos 40% mais lento que o baseline',
  base.toFixed(2) + ' -> ' + (isNaN(mutadoMs) ? '?' : mutadoMs.toFixed(2)) + ' ms');

/* ---- O CODIGO VOLTOU? ---- */
const voltou = fs.readFileSync(ALVO, 'utf8') === original;
console.log('\n=== 3. o tuner voltou inteiro: ' + (voltou ? 'SIM' : 'NAO') + ' ===');
if (!voltou) problemas.push('o tuner nao voltou ao original');
const depois = oTestePassa();
console.log('  execucao final do teste .... ' + (depois ? 'PASSA (certo)' : 'ACUSA'));

console.log('\n' + '='.repeat(62));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  Um benchmark estavel que nao sente regressao e um teste de decoracao.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(62) + '\n');
process.exit(falhou ? 1 : 0);