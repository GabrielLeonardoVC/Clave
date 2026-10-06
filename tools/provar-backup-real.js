/* =========================================================
   ACORDE - tools/provar-backup-real.js
   O backup e lembrado por algum teste.

   Sabota `js/core/store.js` e exige que a suite acuse cada uma. A mutacao
   entra no arquivo, e o arquivo volta dos bytes guardados em memoria,
   verificado byte a byte. Nao usa `git checkout`.

   MUTACOES QUE FICARAM DE FORA, E POR QUE

     - "perder a foto anotada": a foto anotada NAO e um campo separado — e o
       mesmo campo `foto`, so que ja com o desenho dentro. Perder a foto e
       perder a foto anotada; as duas medem a mesma linha.
     - "importar pela metade": a suite sobe ate a seccao 11 e prova que ou as
       DUAS cifras do arquivo entram, ou o arquivo inteiro e recusado. Nao ha
       um terceiro caminho observavel para sabotar.
     - "misturar as modalidades": `modo` decide o ramo INTEIRO (`if`/`else`).
       Uma mutacao que fizesse mesclar virar substituir ja seria vista por
       qualquer uma das contagens de musicas.

   Rodar: node tools/provar-backup-real.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ } = require('./arquivos.js');

const ALVO = 'js/core/store.js';
const SUITE = 'tools/test-backup-real.js';

const MUTACOES = [
  {
    id: 'M1', nome: 'a exportação não leva as cifras',
    de: /escalas: db\.escalas, cifras: db\.cifras, ajustes: db\.ajustes,/,
    para: "escalas: db.escalas, cifras: [], ajustes: db.ajustes, /* SABOTAGEM M1 */",
    espera: 'contou 10 cifras',
  },
  {
    id: 'M2', nome: 'a exportação não leva as escalas',
    de: /escalas: db\.escalas, cifras: db\.cifras, ajustes: db\.ajustes,/,
    para: "escalas: [], cifras: db.cifras, ajustes: db.ajustes, /* SABOTAGEM M2 */",
    espera: 'e 1 escala',
  },
  {
    id: 'M3', nome: 'a exportação embaralha a ordem',
    de: /escalas: db\.escalas, cifras: db\.cifras, ajustes: db\.ajustes,/,
    para: "escalas: db.escalas, cifras: db.cifras.slice().reverse(), ajustes: db.ajustes, /* SABOTAGEM M3 */",
    espera: 'a ordem das cifras é a mesma',
  },
  {
    id: 'M4', nome: 'a exportação perde a foto',
    de: /      foto: normFoto\(c\.foto\),/,
    para: "      foto: '', /* SABOTAGEM M4: sem foto */",
    espera: 'a foto anotada e um campo so, e vai inteiro',
  },
  {
    id: 'M5', nome: 'a importação aceita arquivo sem dados',
    de: /if \(!temLista && !temLegado\) \{/,
    para: 'if (false) { /* SABOTAGEM M5: aceita qualquer coisa */',
    espera: 'array vazio — foi recusado',
  },
  {
    id: 'M6', nome: 'EXCLUIDA: substituir nao limpa o que ja estava',
    /* Nao entra na lista. Logo depois dela, `substituir` faz
       `db.escalas = unicosPorId(...)` e `db.cifras = unicosPorId(...)`, que ja
       sobrescrevem as DUAS listas inteiras. O `db = vazio()` antes delas so
       faria diferenca em `ajustes` — e a suite nao compara ajustes hoje. Uma
       mutacao aqui passaria sem dizer nada: cobertura de fachada. */
    fora: true,
  },
  {
    id: 'M7', nome: 'mesclar deixa entrar o mesmo registro duas vezes',
    de: /if \(cids\.has\(c\.id\)\) return;/,
    para: '/* SABOTAGEM M7: sem conferir o id */',
    espera: 'reenviar A nao duplicou',
  },
  {
    id: 'M10', nome: 'volta a descartar música por título + artista',
    de: /(\s*)if \(cids\.has\(c\.id\)\) return;\s*\r?\n(\s*)cids\.add\(c\.id\); db\.cifras\.push\(c\);/,
    para: '$1if (cids.has(c.id)) return;\n$2if (db.cifras.some(function (x) { return x.titulo === c.titulo && x.artista === c.artista; })) return; /* SABOTAGEM M10: a regra antiga */\n$2cids.add(c.id); db.cifras.push(c);',
    espera: 'o mesclar ficou com as DUAS',

    },
  {
    id: 'M8', nome: 'mesclar sobrescreve o que já estava',
    de: /cids\.add\(c\.id\); db\.cifras\.push\(c\);/,
    para: 'cids.add(c.id); db.cifras[0] = c; /* SABOTAGEM M8: sobrescreve */',
    espera: 'a musica que ja estava nao foi mexida',
  },
  {
    id: 'M9', nome: 'o arquivo repete id e as duas entram com a mesma chave',
    de: /      if \(r\.id && !vistos\.has\(r\.id\)\) \{/,
    para: '      if (true) { /* SABOTAGEM M9: nao renumera */',
    espera: 'os ids sao unicos',
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
    const s = execFileSync('node', [SUITE], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 40e6 });
    return { codigo: 0, saida: s };
  } catch (e) {
    return { codigo: e.status === undefined ? 1 : e.status, saida: (e.stdout || '') + (e.stderr || '') };
  }
}

const arqAbs = path.join(RAIZ, ALVO);
console.log('\n=== o provador do backup real ===');

const base = rodarSuite();
if (base.codigo !== 0) {
  console.log('  FALHA  a suite nao passa ANTES de qualquer mutacao');
  base.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 8)
    .forEach((l) => console.log('        ' + l.trim().slice(0, 96)));
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
    console.log('  ok    ' + m.id + '  ' + m.nome.padEnd(56) + ' -> "' + m.espera + '"');
    provadas++;
  } else {
    console.log('  FALHA  ' + m.id + '  ' + m.nome.padEnd(56) + ' -> nao observavel (exit ' + r.codigo + ')');
    r.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 2)
      .forEach((l) => console.log('          a suite acusou: ' + l.trim().slice(0, 70)));
    invalidas++;
  }
}
console.log('');
console.log('  ' + provadas + '/' + vivos.length + ' mutacoes observaveis'
  + (fora ? ', ' + fora + ' excluidas com justificativa' : '')
  + (invalidas ? ', ' + invalidas + ' problema(s)' : ''));
console.log('=================================================\n');
process.exit(provadas === vivos.length ? 0 : 1);