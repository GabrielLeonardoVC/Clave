/* =========================================================
   tools/provar-execucao.js
   O CONTROLADOR DA EXECUCAO ACUSA AS MUTACOES QUE ELE DIZ PROTEGER?

   A REGRA DO PROJETO, APLICADA AQUI

   "Regra que passa sem nada acusar e' um verificador que nunca olhou." As 65
   assercoes de `test-execucao.js` passaram durante rodadas em que o navegador
   ja mostrava tres barras empilhadas e um handle morto. Elas medem ESTADO;
   elas nao medem a responsabilidade do controlador sobre a folha — essa
   responsabilidade e' do navegador, e segue sem prova automatica.

   Este arquivo fecha a lacuna do lado que DA para fechar em Node: cada
   mutacao abaixo e' uma frase EXATA do arquivo alvo, aplicada no arquivo de
   verdade, com o `test-execucao` rodando como verificador. Se o codigo
   mutado passar, a regra que deveria impedir aquilo e' fraca, e a prova
   acusa a regra — nao o codigo.

   A MUTACAO "VS COMPARTILHADO" NAO EXISTE, E ISTO NAO E' UM BURACO

   A missao lista nove mutacoes e manda excluir a de "VS compartilhado" se nao
   houver observabilidade. Nao ha. `execucao.js` nao tem uma linha sobre voz ou
   som: ele nao importa o gravador, nao conhece o estado da gravacao e nao
   escreve nada de audio. O VS e' do `palco.js`, que continua sendo dono dele
   (medido na V5.15: transpor NAO existe no palco). Fabricar aqui uma prova de
   "VS compartilhado" exigiria um `palco` falso com audio falso para observar um
   comportamento que o controlador nao tem — seria medir uma lista de desejos,
   nao o produto. Fica fora, com o motivo escrito.

   A RESTAURACAO

   A mesma rede do `provar-guarda-vs`: copia antes, restauracao em `exit` e nos
   sinais, `uncaughtException`, e a conferencia byte a byte no fim. Um provador
   que deixa o codigo do produto mutado e' pior do que nao ter provador.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const VERIFICADOR = path.join(RAIZ, 'tools', 'test-execucao.js');
const ALVO = path.join(RAIZ, 'js', 'views', 'execucao.js');
const original = fs.readFileSync(ALVO, 'utf8');

const DIR = path.join(os.tmpdir(), 'clave-execucao-original');
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(path.join(DIR, 'execucao.js'), original, 'utf8');

let restaurado = false;
function restaurar() {
  if (restaurado) return;
  restaurado = true;
  try { fs.writeFileSync(ALVO, original, 'utf8'); } catch (e) { /* disco cheio */ }
  try {
    if (fs.readFileSync(ALVO, 'utf8') !== original) {
      fs.copyFileSync(path.join(DIR, 'execucao.js'), ALVO);
    }
  } catch (e) { /* a copia ficou no tmp */ }
}
process.on('exit', restaurar);
['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'].forEach((s) => process.on(s, function () {
  restaurar(); console.log('\n  ' + s + ' recebido. O controlador foi restaurado.'); process.exit(130);
}));
process.on('uncaughtException', function (e) {
  restaurar(); console.error('\n  excecao: ' + (e && e.stack ? e.stack : e)); process.exit(1);
});

/* Cada mutacao e' uma FRASE EXATA, com a quebra de linha do proprio arquivo. */
const MUTACOES = [
  {
    nome: 'M1 proxima() nao incrementa o indice',
    de: 'return mostrar(p.indice + 1);',
    para: 'return mostrar(p.indice);',
  },
  {
    nome: 'M2 anterior() nao decrementa o indice',
    de: 'return mostrar(p.indice - 1);',
    para: 'return mostrar(p.indice);',
  },
  {
    nome: 'M3 o limite inferior deixa o indice passar de zero',
    de: 'const i = Math.min(Math.max(0, sessao.indice), escala.musicas.length - 1);',
    para: 'const i = Math.min(Math.max(-99, sessao.indice), escala.musicas.length - 1);',
  },
  {
    nome: 'M4 o limite superior deixa o indice passar do fim',
    de: 'const i = Math.min(Math.max(0, sessao.indice), escala.musicas.length - 1);',
    para: 'const i = Math.min(Math.max(0, sessao.indice), escala.musicas.length + 99);',
  },
  {
    nome: 'M5 a renderizacao usa o indice anterior',
    de: '    sessao.indice = indice;\n    const p = partes();',
    para: '    sessao.indice = indice > 0 ? indice - 1 : 0;\n    const p = partes();',
  },
  {
    nome: 'M6 o transpose deixa de ser por musica (um numero so)',
    de: 'sessao.semisPorMusica[p.musica.id] = ((novo % 12) + 12) % 12;',
    para: "sessao.semisPorMusica['__umSo'] = ((novo % 12) + 12) % 12;",
  },
  {
    nome: 'M7 trocar de musica perde o semitom salvo',
    de: '    if (ultimaFolha && typeof ultimaFolha.close === \'function\') {',
    para: '    if (sessao) sessao.semisPorMusica = {};\n    if (ultimaFolha && typeof ultimaFolha.close === \'function\') {',
  },
  {
    nome: 'M8 a execucao ignora a ordem persistida',
    de: '    sessao = { escalaId: escala.id, indice: 0, semisPorMusica: {} };\n    return mostrar(0);',
    para: '    sessao = { escalaId: escala.id, indice: 0, semisPorMusica: {} };\n    return mostrar(escala.musicas.length - 1);',
  },
  {
    nome: 'M9 a musica orfa deixa de ser tratada',
    de: '    if (orfa(p.musica)) {',
    para: '    if (false && orfa(p.musica)) {',
    /* ESTA E' PROVADA NO NAVEGADOR, E O PORQUE ESTA AQUI DEVOLVE
     *
     * `test-execucao.js` afirma que a orfa e' DETECTADA: ele le `posicao().orfa`,
     * que chama `orfa()` de novo e nao passa pelo ramo de desenho. Desligar o
     * ramo `if (orfa(...))` nao muda nada naquele arquivo — a deteccao continua
     * verdadeira e a sequencia continua andando. Nao e' regra fraca: e' uma
     * responsabilidade que NAO EXISTE em Node.
     *
     * O que aquele ramo faz e' trocar a folha do palco por uma folha propria,
     * com o aviso e o botao "Tirar do repertorio". Isso e' DOM. A prova de M9
     * esta em `tools/guarda-execucao.js`, no navegador, e e' a unica forma
     * honesta de cobrir isto: fingir cobertura aqui seria um teste que passa
     * medindo o vazio. */
    foraDoEscopoNode: true,
  },
];

function rodar() {
  try { execFileSync('node', [VERIFICADOR], { encoding: 'utf8', stdio: 'pipe' }); return 0; }
  catch (e) { return e.status === 0 ? 1 : e.status; }
}

/* O ALVO DO BUG DESTE ARQUIVO, NA PRIMEIRA RODADA
 *
 * A primeira versao escrevia `original.replace(m.de, m.para)` com o `de` em LF e
 * o arquivo em CRLF: a substituicao nao casava, o arquivo era gravado sem
 * mudanca nenhuma, o teste passava — e o prover acusou tres mutacoes de "escaparam"
 * que ele nunca aplicou. Duas delas (M5 e M8) sao detectadas normalmente.
 *
 * A LICAO, QUE E' O MOTIVO DESTA CONFERENCIA
 *
 * "escapou" e' uma affirmacao sobre o verificador, e ela so vale depois que a
 * mutacao entrou de verdade. Este agora aplica em LF e devolve em CRLF — uma
 * unica conversao, no lugar certo, em vez de duas conversoes em lugares
 * diferentes. A conferencia byte a byte no fim existe para pegar a proxima
 * versao desse mesmo erro. */
const ALVO_LF = original.replace(/\r\n/g, '\n');
const voltarCRLF = (t) => t.replace(/\n/g, '\r\n');

console.log('=== 0. SEM MUTACAO: o codigo bom tem de passar inteiro ===');
const base = rodar();
console.log('  exit=' + base + '  -> ' + (base === 0 ? 'PASSA (certo)' : '*** ACUSOU O CODIGO BOM ***'));

console.log('\n=== 1. CADA MUTACAO TEM DE SER ACUSADA ===');
let acusadas = 0; let escaparam = 0; let foraDoEscopo = 0;
const problemas = [];
if (base !== 0) problemas.push('o codigo bom foi acusado');

for (const m of MUTACOES) {
  if (m.foraDoEscopoNode) {
    console.log('  ' + m.nome.padEnd(52) + ' FORA DO ESCOPO DE NODE (provada no navegador)');
    foraDoEscopo++;
    continue;
  }
  if (ALVO_LF.indexOf(m.de) < 0) {
    console.log('  ' + m.nome.padEnd(52) + ' A FRASE NAO EXISTE (nao aplicou)');
    escaparam++; problemas.push(m.nome + ': a frase nao existe no arquivo');
    continue;
  }
  const mutado = voltarCRLF(ALVO_LF.replace(m.de, m.para));
  if (mutado === original) {
    console.log('  ' + m.nome.padEnd(52) + ' *** A MUTACAO NAO MUDOU NADA ***');
    escaparam++; problemas.push(m.nome + ': a substituicao nao mudou o arquivo');
    continue;
  }
  restaurado = false;
  fs.writeFileSync(ALVO, mutado, 'utf8');
  let codigo;
  try { codigo = rodar(); } finally { restaurar(); }
  if (codigo === 0) { escaparam++; problemas.push(m.nome + ': passou com o comportamento quebrado'); }
  else acusadas++;
  console.log('  ' + m.nome.padEnd(52) + ' exit=' + codigo + '  '
    + (codigo === 0 ? '*** ESCAPOU: REGRA FRACA ***' : 'ACUSOU'));
}

const voltou = fs.readFileSync(ALVO, 'utf8') === original;
console.log('\n=== 2. o controlador voltou inteiro: ' + (voltou ? 'SIM' : 'NAO') + ' ===');
if (!voltou) problemas.push('o controlador nao voltou ao original');
const fim = rodar();
console.log('  execucao final -> exit=' + fim + (fim === 0 ? ' (PASSA)' : ' (ACUSA)'));

console.log('\n' + '='.repeat(66));
console.log('  ' + acusadas + '/' + (MUTACOES.length - foraDoEscopo)
  + ' mutacoes detectadas em Node'
  + (escaparam ? '  *** ' + escaparam + ' ESCAPARAM ***' : ''));
console.log('  fora de escopo, com motivo: "VS compartilhado entre musicas"');
console.log('    -> `execucao.js` nao tem uma linha de audio, gravador ou VS.');
console.log('       O VS e\' do `palco.js`. Observar isso aqui exigiria um palco falso');
console.log('       com audio falso para medir um comportamento inexistente.');
if (problemas.length) {
  console.log('');
  for (const p of problemas) console.log('  - ' + p);
}
console.log('='.repeat(66) + '\n');
process.exit(problemas.length ? 1 : 0);