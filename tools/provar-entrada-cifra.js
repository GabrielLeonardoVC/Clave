/* =========================================================
   ACORDE - tools/provar-entrada-cifra.js
   A distincao entre "criar uma cifra" e "abrir as minhas" e mesmo lembrada
   por algum teste.

   Um verificador que nunca falhou e um verificador que a pessoa ignora. Este
   arquivo quebra a regua da Home de sete jeitos e exige que a suite acuse cada
   um.

   A mutacao e aplicada NO ARQUIVO, conferida no disco, e o arquivo e restaurado
   a partir dos bytes guardados em memoria — verificado byte a byte depois. Um
   provador que deixa o produto quebrado quando um teste lanca e pior do que nao
   existir. Por isso este arquivo NAO usa `git checkout` para restaurar: um
   comando que devolve o arquivo ao HEAD descarta o trabalho que ainda esta
   apenas na arvore de trabalho, e foi assim que uma etapa anterior perdeu
   alteracao nenhuma.

   O QUE NAO ENTRA AQUI

   Mutacao de layout — "o rotulo cabe", "a faixa quebra em duas linhas", "a
   area de toque e grande". Nada disso e observavel em Node: e do navegador, e
   foi medido la, numa caixa de 390px, com o numero anotado no CSS. Fabricar
   uma mutacao de CSS para parecer que essa parte tambem esta coberta seria
   cobertura de fachada.

   Rodar: node tools/provar-entrada-cifra.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ } = require('./arquivos.js');

const ALVO = 'js/views/hoje.js';
const SUITE = 'tools/test-entrada-cifra.js';

/* Alvos em expressao regular porque o repositorio usa CRLF: um texto exato
   casaria numa execucao e nao na seguinte, e um provador que as vezes aplica a
   mutacao e as vezes nao e pior do que um que nunca aplica. */
const MUTACOES = [
  {
    id: 'M1', nome: '"Nova cifra" abre a biblioteca',
    de: /rapido\('music-4', 'Nova cifra', 'green', function \(\) \{ V\.repertorio && V\.repertorio\.novo\(\); \}\)/,
    para: "rapido('library', 'Nova cifra', 'green', function () { global.App.ir('repertorio'); /* SABOTAGEM M1 */ })",
    espera: 'e e a criacao de cifra',
  },
  {
    id: 'M2', nome: '"Minhas cifras" abre a criacao',
    de: /rapido\('library', 'Minhas cifras', '', function \(\) \{ global\.App\.ir\('repertorio'\); \}\)/,
    para: "rapido('music-4', 'Minhas cifras', '', function () { V.repertorio && V.repertorio.novo(); /* SABOTAGEM M2 */ })",
    espera: 'e vai para a rota da biblioteca',
  },
  {
    id: 'M3', nome: 'o botao novo nao tem destino',
    de: /rapido\('library', 'Minhas cifras', '', function \(\) \{ global\.App\.ir\('repertorio'\); \}\)/,
    para: "rapido('library', 'Minhas cifras', '', function () { /* SABOTAGEM M3 */ })",
    espera: 'clicar navega UMA vez',
  },
  {
    id: 'M4', nome: 'os dois vao para o mesmo lugar',
    de: /rapido\('library', 'Minhas cifras', '', function \(\) \{ global\.App\.ir\('repertorio'\); \}\)/,
    para: "rapido('library', 'Minhas cifras', '', function () { V.repertorio && V.repertorio.novo(); /* SABOTAGEM M4 */ })",
    espera: 'e nao abre o formulario de criacao',
  },
  {
    id: 'M5', nome: 'o rotulo volta a prometer demais',
    de: /rapido\('music-4', 'Nova cifra', 'green'/,
    para: "rapido('music-4', 'Cifra', 'green' /* SABOTAGEM M5 */",
    espera: 'e o antigo "Cifra" nao esta mais la',
  },
  {
    id: 'M6', nome: 'a cedilha de "Braco" some de novo',
    de: /rapido\('guitar', 'Braço', ''/,
    para: "rapido('guitar', 'Braco', '' /* SABOTAGEM M6 */",
    espera: 'e "Braço" esta escrito com cedilha',
  },
  {
    id: 'M7', nome: 'o atalho vira duplicata',
    de: /(rapido\('library', 'Minhas cifras', '', function \(\) \{ global\.App\.ir\('repertorio'\); \}\),)/,
    para: '$1\n      rapido(\'library\', \'Minhas cifras\', \'\', function () { global.App.ir(\'repertorio\'); /* SABOTAGEM M7 */ }),',
    espera: 'nao ha botao repetido na regua',
  },
];

let pendente = null;

function restaurar() {
  if (!pendente) return;
  const p = pendente;
  pendente = null;
  try { fs.writeFileSync(p.arqAbs, p.orig); } catch (e) { /* nada a fazer */ }
}

process.on('exit', restaurar);
process.on('SIGINT', function () { restaurar(); process.exit(130); });
process.on('SIGTERM', function () { restaurar(); process.exit(143); });
process.on('uncaughtException', function (e) { restaurar(); throw e; });

function rodarSuite() {
  try {
    const s = execFileSync('node', [SUITE], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 20e6 });
    return { codigo: 0, saida: s };
  } catch (e) {
    return { codigo: e.status === undefined ? 1 : e.status, saida: (e.stdout || '') + (e.stderr || '') };
  }
}

const arqAbs = path.join(RAIZ, ALVO);

console.log('\n=== o provador da entrada de cifras ===');

const base = rodarSuite();
if (base.codigo !== 0) {
  console.log('  FALHA  a suite nao passa ANTES de qualquer mutacao');
  base.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 6)
    .forEach((l) => console.log('        ' + l.trim()));
  console.log('=================================================\n');
  process.exit(1);
}
console.log('  ok    a suite passa sem nenhuma mutacao');

let provadas = 0;
let invalidas = 0;

for (const m of MUTACOES) {
  const orig = fs.readFileSync(arqAbs);
  const txt = orig.toString('utf8');

  if (!m.de.test(txt)) {
    console.log('  ??    ' + m.id + '  alvo nao encontrado em ' + ALVO + ' — mutacao invalida');
    invalidas++;
    continue;
  }
  const trocado = txt.replace(m.de, m.para);
  if (trocado === txt) {
    console.log('  ??    ' + m.id + '  o replace nao mudou nada — mutacao invalida');
    invalidas++;
    continue;
  }

  pendente = { arqAbs: arqAbs, orig: orig };
  fs.writeFileSync(arqAbs, trocado);

  /* A marcacao tem de estar NO ARQUIVO. Um provador que acredita que aplicou
     mede o original e conclui que o trecho nao e necessario — a conclusao mais
     cara que existe aqui. */
  if (fs.readFileSync(arqAbs, 'utf8').indexOf('SABOTAGEM ' + m.id) < 0) {
    console.log('  ??    ' + m.id + '  a marcacao nao esta no arquivo — mutacao nao aplicada de verdade');
    restaurar();
    invalidas++;
    continue;
  }

  const r = rodarSuite();
  restaurar();

  if (!fs.readFileSync(arqAbs).equals(orig)) {
    console.log('  FALHA  ' + m.id + '  o arquivo NAO voltou ao estado original');
    invalidas++;
    continue;
  }

  const acusou = r.codigo !== 0 && r.saida.indexOf('FALHA  ' + m.espera) >= 0;
  if (acusou) {
    console.log('  ok    ' + m.id + '  ' + m.nome.padEnd(38) + ' -> "' + m.espera + '"');
    provadas++;
  } else {
    console.log('  FALHA  ' + m.id + '  ' + m.nome.padEnd(38) + ' -> nao observavel (exit ' + r.codigo + ')');
    r.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 3)
      .forEach((l) => console.log('          a suite acusou: ' + l.trim().slice(0, 84)));
    invalidas++;
  }
}

console.log('');
console.log('  ' + provadas + '/' + MUTACOES.length + ' mutacoes observaveis'
  + (invalidas ? ', ' + invalidas + ' problema(s)' : ''));
console.log('=================================================\n');

process.exit(provadas === MUTACOES.length ? 0 : 1);