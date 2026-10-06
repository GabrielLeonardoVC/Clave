/* =========================================================
   ACORDE - tools/provar-foto-cifra.js
   A recusa da foto e realmente lembrada por algum teste.

   Sabota `normFoto` (e a linha que a chama em `normCifra`) e exige que a suite
   acuse cada uma. A mutacao entra no ARQUIVO, e o arquivo volta dos bytes
   guardados em memoria — verificado byte a byte. Nao usa `git checkout`.

   MUTACOES QUE FICARAM DE FORA, E POR QUE

     - "perder a foto ao remover" (`foto: ''` virando `undefined`): `normCifra`
       sempre devolve string, e a suite ja prova que a remocao deixa `''` com o
       titulo e o bpm intactos. Uma segunda prova seria a mesma.
     - "anotacao persistida": o Estudio NAO grava a anotacao na cifra — entrega
       um arquivo ao sistema (`studio.js:395`, `U.entregarArquivo`). Nao ha
       linha para sabotar, porque nao existe esse caminho. E um achado, nao uma
       mutacao.
     - "duplicar anotacao": pelo mesmo motivo.

   Rodar: node tools/provar-foto-cifra.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ } = require('./arquivos.js');

const ALVO = 'js/core/store.js';
const SUITE = 'tools/test-foto-cifra.js';

const MUTACOES = [
  {
    id: 'M1', nome: 'aceitar qualquer data URL',
    de: /if \(!FOTOS_OK\.test\(s\)\) return '';/,
    para: '/* SABOTAGEM M1: sem conferencia de tipo */',
    espera: 'um texto foi recusado e a foto ficou vazia',
  },
  {
    id: 'M2', nome: 'aceitar SVG (documento com script)',
    de: /const FOTOS_OK = \/\^data:image\\\/\(png\|jpeg\|jpg\|webp\|gif\);base64,\/i;/,
    para: "const FOTOS_OK = /^data:image\\/(png|jpeg|jpg|webp|gif|svg\\+xml);base64,/i; // SABOTAGEM M2",
    espera: 'um SVG com script foi recusado e a foto ficou vazia',
  },
  {
    id: 'M3', nome: 'tirar o teto de 3 MB',
    de: /return s\.length > 3000000 \? '' : s;/,
    para: 'return s; // SABOTAGEM M3: sem teto',
    espera: 'uma foto acima de 3 MB e recusada, e nao truncada',
  },
  {
    id: 'M4', nome: 'devolver o arquivo recusado em vez de vazio',
    de: /if \(!FOTOS_OK\.test\(s\)\) return '';/,
    para: "if (!FOTOS_OK.test(s)) return s; // SABOTAGEM M4: passa o que devia recusar",
    espera: 'um texto foi recusado e a foto ficou vazia',
  },
  {
    id: 'M5', nome: 'truncar o que excede, em vez de recusar',
    de: /return s\.length > 3000000 \? '' : s;/,
    para: 'return s.length > 3000000 ? s.slice(0, 40) : s; // SABOTAGEM M5: trunca',
    espera: 'uma foto acima de 3 MB e recusada, e nao truncada',
  },
  {
    id: 'M6', nome: 'deixar de guardar a foto',
    de: /foto: normFoto\(c\.foto\),/,
    para: "foto: '', // SABOTAGEM M6: a foto nunca e guardada",
    espera: 'foto jpeg foi guardada',
  },
  {
    id: 'M7', nome: 'guardar outra foto no lugar da verdadeira',
    de: /foto: normFoto\(c\.foto\),/,
    para: "foto: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', // SABOTAGEM M7: foto trocada",
    espera: 'foto jpeg foi guardada',
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
console.log('\n=== o provador do contrato da foto ===');

const base = rodarSuite();
if (base.codigo !== 0) {
  console.log('  FALHA  a suite nao passa ANTES de qualquer mutacao');
  base.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 8)
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
    console.log('  ??    ' + m.id + '  alvo nao encontrado — mutacao invalida');
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
  if (fs.readFileSync(arqAbs, 'utf8').indexOf('SABOTAGEM ' + m.id) < 0) {
    console.log('  ??    ' + m.id + '  a marcacao nao esta no arquivo — nao aplicada de verdade');
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
    console.log('  ok    ' + m.id + '  ' + m.nome.padEnd(44) + ' -> "' + m.espera + '"');
    provadas++;
  } else {
    console.log('  FALHA  ' + m.id + '  ' + m.nome.padEnd(44) + ' -> nao observavel (exit ' + r.codigo + ')');
    r.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 2)
      .forEach((l) => console.log('          a suite acusou: ' + l.trim().slice(0, 78)));
    invalidas++;
  }
}
console.log('');
console.log('  ' + provadas + '/' + MUTACOES.length + ' mutacoes observaveis'
  + (invalidas ? ', ' + invalidas + ' problema(s)' : ''));
console.log('=================================================\n');
process.exit(provadas === MUTACOES.length ? 0 : 1);