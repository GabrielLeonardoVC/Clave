/* =========================================================
   tools/provar-guarda-vs.js
   PROVADOR POR MUTACAO DA PORTA DE SAIDA DO VS

   O PROBLEMA QUE ELE EXISTE PARA RESOLVER

   Na V5.9 as regras de `check-guarda-vs.js` nasceram de um defeito real, e seis
   de nove protecoes quebradas PASSARAM. As causas eram sempre a mesma, e vale
   registrar porque e' a falha de siempre:

     - procurar a PALAVRA (`aoFechar`) em vez da CONDICAO que a alcanca;
     - janela de 400 caracteres que pega o `close` do vizinho;
     - `pendenteDeSalvar = false` existe em varios lugares, e o que importa e'
       o que vem DEPOIS do `S.gravar()`;
     - tres mutacoes nem casaram com o codigo — os arquivos usam CRLF e ha um
       bloco de comentario entre o `aria-label` do X e o `onclick`.

   Nenhuma dessas era um problema do produto. Era problema da regra, e so a
   mutacao mostra isso.

   AS MUTACOES SAO REAIS

   Nenhuma mexe em comentario, em codigo morto, nem em linha que o programa nao
   executa. Todas quebram uma protecao que roda. Se uma passar, este arquivo
   sai com codigo 1 — e o numero de "cobertura" nao vale nada ate a regra ser
   reescrita.

   A REDE DE SEGURANCA

   Copia do original em disco ANTES da primeira mutacao, restauracao em `exit`,
   nos sinais e em `uncaughtException`, e a conferencia byte a byte no fim.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const VERIFICADOR = path.join(RAIZ, 'tools', 'check-guarda-vs.js');
const ALVOS = [
  path.join(RAIZ, 'js', 'core', 'ui.js'),
  path.join(RAIZ, 'js', 'views', 'palco.js'),
  path.join(RAIZ, 'js', 'views', 'cancao.js'),
];
const UI = ALVOS[0];
const PALCO = ALVOS[1];
const CANCAO = ALVOS[2];

const originais = {};
for (const a of ALVOS) originais[a] = fs.readFileSync(a, 'utf8');
const DIR = path.join(os.tmpdir(), 'clave-guarda-original');
fs.mkdirSync(DIR, { recursive: true });
for (const a of ALVOS) fs.writeFileSync(path.join(DIR, path.basename(a)), originais[a], 'utf8');

let restaurado = false;
function restaurar() {
  if (restaurado) return;
  restaurado = true;
  for (const a of ALVOS) {
    try { fs.writeFileSync(a, originais[a], 'utf8'); } catch (e) { /* disco cheio */ }
    try {
      if (fs.readFileSync(a, 'utf8') !== originais[a]) {
        fs.copyFileSync(path.join(DIR, path.basename(a)), a);
      }
    } catch (e) { /* a copia ficou no tmp */ }
  }
}
process.on('exit', restaurar);
['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'].forEach((s) => process.on(s, function () {
  restaurar(); console.log('\n  ' + s + ' recebido. O codigo do produto foi restaurado.'); process.exit(130);
}));
process.on('uncaughtException', function (e) {
  restaurar(); console.error('\n  excecao nao tratada: ' + (e && e.stack ? e.stack : e)); process.exit(1);
});

/* Cada mutacao e' uma FRASE EXATA do arquivo, com a quebra de linha do proprio
 * arquivo (CRLF). As tres que "nao casaram" na V5.9 erao exatamente isso, mais
 * o comentario no meio do X. */
const MUTACOES = [
  {
    nome: 'M1 o guarda nunca e\' alcancado (false && ...)',
    arquivo: UI,
    de: 'if (!forcado && opts.aoFechar) {',
    para: 'if (false && !forcado && opts.aoFechar) {',
  },
  {
    nome: 'M2 o X fecha sem passar pelo guarda',
    arquivo: UI,
    de: 'onclick: () => close(),',
    para: 'onclick: () => semGuarda(),',
  },
  {
    nome: 'M3 o Escape fecha sem passar pelo guarda',
    arquivo: UI,
    de: 'if (sheetStack[sheetStack.length - 1] === handle) { ev.stopPropagation(); close(); }',
    para: 'if (sheetStack[sheetStack.length - 1] === handle) { ev.stopPropagation(); semGuarda(); }',
  },
  {
    nome: 'M4 closeAllSheets ignora o veto e fecha a pilha toda',
    arquivo: UI,
    de: 'if (resposta === false || (resposta && typeof resposta.then === \'function\')) break;',
    para: '/* mutado: nao para no veto */',
  },
  {
    nome: 'M5 o descarte esvazia so a ficha local (o bug do V5.8)',
    arquivo: PALCO,
    de: "salvarFicha({ vs: '', vsSeg: 0 });",
    para: '/* mutado: esqueceu a Store */',
  },
  {
    nome: 'M6 a retentativa reabre o microfone',
    arquivo: PALCO,
    de: 'if (pendenteDeSalvar) {\r\n          salvarFicha({ vs: f.vs, vsSeg: f.vsSeg, vsTexto: f.vsTexto });',
    para: 'if (pendenteDeSalvar) {\r\n          Gravador.iniciar();\r\n          salvarFicha({ vs: f.vs, vsSeg: f.vsSeg, vsTexto: f.vsTexto });',
  },
  {
    nome: 'M7 a pendencia e\' limpa antes do save responder',
    arquivo: PALCO,
    de: "pendenteDeSalvar = false;\r\n          dicaFalha.textContent = '';\r\n          resetar();",
    para: "dicaFalha.textContent = '';\r\n          resetar();",
  },
  {
    nome: 'M8 o beforeunload fica registrado para sempre',
    arquivo: PALCO,
    de: "global.removeEventListener('beforeunload', avisaAntesDeSair);",
    para: '/* mutado: listener vazado */',
  },
  {
    nome: 'M9 o cancao.js perde o diálogo de saida',
    arquivo: CANCAO,
    de: 'aoFechar: function () { return perguntarAoSair(); },',
    para: '/* mutado: sem guarda */',
  },
];

function rodar() {
  try { execFileSync('node', [VERIFICADOR], { encoding: 'utf8' }); return 0; }
  catch (e) { return e.status === 0 ? 1 : e.status; }
}

console.log('=== SEM MUTACAO: o codigo bom tem de passar inteiro ===');
const base = rodar();
console.log('  exit=' + base + '  -> ' + (base === 0 ? 'PASSA (certo)' : '*** ACUSOU O CODIGO BOM ***'));

console.log('\n=== CADA MUTACAO TEM DE SER ACUSADA ===');
let acusadas = 0; let escaparam = 0;
const problemas = [];
if (base !== 0) problemas.push('o codigo bom foi acusado');

for (const m of MUTACOES) {
  const texto = originais[m.arquivo];
  if (texto.indexOf(m.de) < 0) {
    console.log('  ' + m.nome.padEnd(54) + ' A FRASE NAO EXISTE (mutacao nao aplicou)');
    escaparam++; problemas.push(m.nome + ': a frase nao existe no arquivo');
    continue;
  }
  const mutado = texto.replace(m.de, m.para);
  restaurado = false;
  fs.writeFileSync(m.arquivo, mutado, 'utf8');
  let codigo;
  try { codigo = rodar(); } finally { restaurar(); }
  if (codigo === 0) { escaparam++; problemas.push(m.nome + ': passou com a protecao quebrada'); }
  else acusadas++;
  console.log('  ' + m.nome.padEnd(54) + ' exit=' + codigo + '  '
    + (codigo === 0 ? '*** ESCAPOU: REGRA FRACA ***' : 'ACUSOU'));
}

let voltou = true;
for (const a of ALVOS) if (fs.readFileSync(a, 'utf8') !== originais[a]) voltou = false;
console.log('\n=== os tres arquivos voltaram inteiros: ' + (voltou ? 'SIM' : 'NAO') + ' ===');
if (!voltou) problemas.push('o codigo do produto nao voltou ao original');
const fim = rodar();
console.log('  execucao final -> exit=' + fim + (fim === 0 ? ' (PASSA)' : ' (ACUSA)'));

console.log('\n' + '='.repeat(62));
console.log('  ' + acusadas + ' de ' + MUTACOES.length + ' mutacoes acusadas, ' + escaparam + ' escaparam');
if (problemas.length) {
  console.log('\n  Cobertura que nao acusa nao e cobertura:');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(62) + '\n');
process.exit(problemas.length ? 1 : 0);