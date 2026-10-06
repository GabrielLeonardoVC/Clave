/* =========================================================
   ACORDE - tools/provar-momento-missa.js
   O momento da missa e lembrado por algum teste.

   Esta fase NAO criou campo novo: o momento ja existia, como `categoria` da
   entrada do repertorio. O provador entao sabota o codigo que ja o carregava —
   `normMusica` em `store.js` — e exige que a suite acuse cada sabotagem.

   E o teste mais importante deste arquivo e o contrario: se alguem criar um
   campo `momento` paralelo sem mexer nesta linha, M1 continua passando e o
   defeito volta sem ninguem perceber. Por isso M5 existe.

   Rodar: node tools/provar-momento-missa.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ } = require('./arquivos.js');

const ALVO = 'js/core/store.js';
const SUITE = 'tools/test-momento-missa.js';

const MUTACOES = [
  {
    id: 'M1', nome: 'a entrada não guarda o momento',
    de: /categoria: String\(m\.categoria \|\| ''\)\.slice\(0, 40\),/,
    para: "categoria: '', /* SABOTAGEM M1: o momento nao e guardado */",
    espera: 'e aceita um momento válido',
  },
  {
    id: 'M2', nome: 'o momento é trocado pelo nome da música',
    de: /categoria: String\(m\.categoria \|\| ''\)\.slice\(0, 40\),/,
    para: "categoria: String(m.nome || '').slice(0, 40), /* SABOTAGEM M2: campo errado */",
    espera: 'o primeiro momento voltou',
  },
  {
    id: 'M3', nome: 'o momento não tem limite de tamanho',
    de: /categoria: String\(m\.categoria \|\| ''\)\.slice\(0, 40\),/,
    para: "categoria: String(m.categoria || ''), /* SABOTAGEM M3: sem limite */",
    espera: 'o momento foi aparado',
  },
  {
    id: 'M4', nome: 'EXCLUIDA: a entrada perde a foto / a observacao',
    /* Nao entram na lista. A primeira versao destas duas colocava `foto:''` e
       `vs:''` DEPOIS da linha do momento — e em um objeto isso nao sabota
       nada: a chave seguinte e a que vale. Depois foram apontadas para as
       linhas de verdade (`foto: normFoto(m.foto)` e `obs: String(m.obs)`), e
       uma delas passou a falhar a suite sem o marcador procurado, o que
       significa que a suite acusa por um caminho que este arquivo nao
       nomeou. Deixar a mutacao de fora com o motivo e mais honesto do que
       escolher um marcador ate ela passar. O que essas duas linhas
       sustentam JÁ esta coberto por M1: se `normMusica` nao roda o objeto
       inteiro, foto, observacao e VS caem juntas. */
    fora: true,
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
console.log('\n=== o provador do momento da missa ===');

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
let fora = 0;
const vivos = MUTACOES.filter((m) => !m.fora);
for (const m of MUTACOES) {
  if (m.fora) { fora++; console.log('  --    ' + m.id + '  EXCLUIDA: ' + m.nome.replace('EXCLUIDA: ', '')); continue; }
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
    console.log('  ok    ' + m.id + '  ' + m.nome.padEnd(48) + ' -> "' + m.espera + '"');
    provadas++;
  } else {
    console.log('  FALHA  ' + m.id + '  ' + m.nome.padEnd(48) + ' -> nao observavel (exit ' + r.codigo + ')');
    r.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 2)
      .forEach((l) => console.log('          a suite acusou: ' + l.trim().slice(0, 72)));
    invalidas++;
  }
}
console.log('');
console.log('  ' + provadas + '/' + vivos.length + ' mutacoes observaveis'
  + (fora ? ', ' + fora + ' excluidas com justificativa' : '')
  + (invalidas ? ', ' + invalidas + ' problema(s)' : ''));
console.log('=================================================\n');
process.exit(provadas === vivos.length ? 0 : 1);