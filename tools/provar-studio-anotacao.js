/* =========================================================
   ACORDE - tools/provar-studio-anotacao.js
   "Salvar no Clave" e "Salvar anotação" nao viraram a mesma coisa.

   Sabota `js/core/studio.js` e exige que a suite acuse cada uma. A mutacao
   entra no arquivo, e o arquivo volta dos bytes guardados em memoria,
   verificado byte a byte. Nao usa `git checkout`.

   MUTACOES QUE FICARAM DE FORA, E POR QUE

     - "a anotação volta toda apos o reload": o que o reload traz depende de o
       armazenamento ter sido gravado, e `M1` ja prova a gravacao. Um provador
       de reload mediria a mesma coisa de outro caminho, e a suite nao tem como
       recarregar a pagina.
     - "a segunda anotacao sobrescreve a primeira": `M2` recusa gravar quando
       nao ha rabisco; a soma de dois rabiscos e provada por `exportar` usar a
       base ja montada, e essa base nao e um campo que a suite consiga trocar.
     - "salvar aumenta a imagem": a suite nao compara bytes de imagem (o canvas
       falso nao codifica JPEG). O tamanho real foi medido no DOM, e o
       `Math.min` do teto esta la para que ninguem o reverta as cegas.

   Rodar: node tools/provar-studio-anotacao.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ } = require('./arquivos.js');

const ALVO = 'js/core/studio.js';
const SUITE = 'tools/test-studio-anotacao.js';

/* Cada substituicao cobre a expressao INTEIRA e deixa a marcacao no fim: um
   `//` no meio engoliria o fechamento e quebraria a sintaxe, e suite que nem
   roda nao prova comportamento. */
const MUTACOES = [
  {
    id: 'M1', nome: 'salvar a anotação não grava a imagem montada',
    de: /(\s*)m\.foto = p;\s*\r?\n(\s*)if \(escala\) gravarNaEscala/,
    para: '$1/* SABOTAGEM M1: compoe mas nao leva ao registro */\n$2if (escala) gravarNaEscala',
    espera: 'o registro recebeu uma imagem diferente',
  },
  {
    id: 'M2', nome: 'salvar a anotação sem rabisco mesmo assim',
    de: /if \(!pincel\.temAlgo\(\)\) \{\s*\r?\n\s*UI\.toast\('Desenhe algo na foto antes de salvar', \{ tipo: 'err' \}\);\s*\r?\n\s*return;\s*\r?\n\s*\}/,
    para: '/* SABOTAGEM M2: sem conferir se ha rabisco */',
    espera: 'e avisa que é erro, não sucesso',
  },
  {
    id: 'M3', nome: 'exportar anotação passa a gravar no registro',
    de: /(\s*)pincel\.exportar\(imgBase\)\.then\(function \(png\) \{\s*\r?\n(\s*)if \(!png\)/,
    para: '$1gravarNaMusica(musica, m, aoSalvar); /* SABOTAGEM M3: exportar grava */\n$1pincel.exportar(imgBase).then(function (png) {\n$2if (!png)',
    espera: 'exportar não escreve no Store',
  },
  {
    id: 'M4', nome: 'gravar num registro copiado',
    de: /gravarNaMusica\(musica, m, aoSalvar\);/,
    para: 'gravarNaMusica(Object.assign({}, musica), m, aoSalvar); /* SABOTAGEM M4: copia */',
    espera: 'o registro recebeu uma imagem diferente',
  },
  {
    id: 'M5', nome: 'gravar troca o id do registro',
    de: /if \(!musica\) return;\s*\r?\n(\s*)gravarCampos\(musica, dados\);/,
    para: "if (!musica) return;\n    musica.id = 'novo-' + Date.now(); /* SABOTAGEM M5: id novo */\n    gravarCampos(musica, dados);",
    espera: 'e o id da música não mudou',
  },
  {
    id: 'M6', nome: '"Limpar" volta a dizer que a música foi limpa',
    de: /UI\.toast\('Traços limpos nesta edição\. Nada é apagado da música até salvar\.', \{ tipo: 'ok', dur: 5200 \}\);/,
    para: "UI.toast('Anotações limpas', { tipo: 'ok' }); /* SABOTAGEM M6: mentira */",
    espera: 'e não afirma que a música foi limpa',
  },
  {
    id: 'M7', nome: 'EXCLUIDA: pela Agenda grava no registro da música, não no do evento',
    /* Nao entra na lista. Na Agenda, quem abre o Estúdio passa a música do
       evento como `musica` — `agenda.js:408` chama `Studio.abrir(m, base)`. O
       registro e o mesmo objeto que `escala.musicas[0]`, entao trocar uma
       gravacao pela outra produz o MESMO resultado observavel. A diferenca so
       apareceria com dois objetos distintos, o que o produto nao tem. Nao ha
       como provar a mutacao sem fabricar uma situacao que nao existe. */
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
console.log('\n=== o provador da anotação persistente ===');

const base = rodarSuite();
if (base.codigo !== 0) {
  console.log('  FALHA  a suite nao passa ANTES de qualquer mutacao');
  base.saida.split('\n').filter((l) => /FALHA|ROMPEU/.test(l)).slice(0, 8)
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
    console.log('  ok    ' + m.id + '  ' + m.nome.padEnd(52) + ' -> "' + m.espera + '"');
    provadas++;
  } else {
    console.log('  FALHA  ' + m.id + '  ' + m.nome.padEnd(52) + ' -> nao observavel (exit ' + r.codigo + ')');
    r.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 2)
      .forEach((l) => console.log('          a suite acusou: ' + l.trim().slice(0, 72)));
    invalidas++;
  }
}
console.log('');
console.log('  ' + provadas + '/' + vivos.length + ' mutacoes observaveis'
  + (fora ? ', ' + fora + ' excluida com justificativa' : '')
  + (invalidas ? ', ' + invalidas + ' problema(s)' : ''));
console.log('=================================================\n');
process.exit(provadas === vivos.length ? 0 : 1);