/* =========================================================
   ACORDE - tools/provar-studio-persistencia.js
   O Estúdio lembra de gravar no registro certo, e so quando se pede.

   Sabota `js/core/studio.js` e exige que a suite acuse cada uma. A mutacao
   entra no arquivo, e o arquivo volta dos bytes guardados em memoria,
   verificado byte a byte. Nao usa `git checkout`.

   MUTACOES QUE FICARAM DE FORA, E POR QUE

     - "a anotação passa a substituir a foto": nao existe caminho hoje que
       faca isso, entao nao ha linha para sabotar. Mudar isso e uma decisao de
       produto, nao um defeito — e a V6.11 manda nao tomar.
     - "a foto some do backup": o backup serializa o armazenamento inteiro, e a
       suite da V6.9 ja prova que a foto o atravessa.

   Rodar: node tools/provar-studio-persistencia.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ } = require('./arquivos.js');

const ALVO = 'js/core/studio.js';
const SUITE = 'tools/test-studio-persistencia.js';

/* Todas as substituicoes cobrem a expressao INTEIRA e deixam a marcacao no
   fim. Uma marcacao no meio engolia o fechamento com o `//` e quebrava a
   sintaxe — e suite que nem roda nao prova comportamento. */
const MUTACOES = [
  {
    id: 'M1', nome: 'gravar numa cópia em vez do registro',
    de: /gravarCampos\(musica, dados\);/,
    para: 'gravarCampos(Object.assign({}, musica), dados); /* SABOTAGEM M1: copia */',
    espera: 'o BPM que a pessoa mexeu chegou ao registro',
  },
  {
    id: 'M2', nome: 'gravar sem chamar quem persiste',
    de: /if \(typeof aoSalvar === 'function'\) aoSalvar\(\);\s*\r?\n\s*else global\.Store\.mudou\('cifra'\);/,
    para: "/* SABOTAGEM M2: nao pede para ninguem guardar */",
    espera: 'e houve exatamente uma escrita no Store',
  },
  {
    id: 'M3', nome: 'trocar o id ao gravar',
    de: /if \(!musica\) return;\s*\r?\n\s*gravarCampos\(musica, dados\);/,
    para: "if (!musica) return;\n    musica.id = 'novo-' + Date.now(); /* SABOTAGEM M3: id novo */\n    gravarCampos(musica, dados);",
    espera: 'o id nao mudou',
  },
  {
    id: 'M4', nome: 'apagar os demais campos ao gravar',
    de: /CAMPOS_DO_ESTUDIO\.forEach\(function \(k\) \{\s*\r?\n\s*if \(dados\[k\]\) alvo\[k\] = dados\[k\];\s*\r?\n\s*\}\);/,
    para: "Object.keys(alvo).forEach(function (k) { if (k !== 'foto') delete alvo[k]; }); /* SABOTAGEM M4: limpa */",
    espera: 'o titulo ficou',
  },
  {
    id: 'M5', nome: 'a gravação não marca o evento como atualizado',
    de: /escala\.atualizadaEm = Date\.now\(\);/,
    para: '/* SABOTAGEM M5: o evento nao e marcado */',
    espera: 'o evento foi marcado como atualizado',
  },
  {
    id: 'M6', nome: 'EXCLUIDA: gravar sobrescreve campo que ficou vazio',
    /* Nao entra na lista. A guarda `if (dados[k])` existe para o caso de um
       campo virar vazio DENTRO do objeto de trabalho — e nao ha caminho publico
       que esvazie um: `m` e a copia do registro no momento de abrir, entao
       todo campo que o registro tem, `m` tem com o mesmo valor. Sem mutacao
       observavel, a unica forma de "provar" M6 seria escrever um campo na mao
       dentro da suite, o que faria o teste passar por construcao e nao medir
       nada. A guarda segue no codigo, e a suite mede o que ela protege de
       verdade: que a foto de uma musica sobrevive a uma gravacao que nao mexe
       nela. */
    fora: true,
  },
  {
    id: 'M7', nome: 'exportar anotação vira gravar no registro',
    de: /if \(!pincel \|\| !pincel\.temAlgo\(\)\) \{ UI\.toast\('Desenhe algo na foto antes de salvar', \{ tipo: 'err' \}\); return; \}/,
    para: "gravarNaMusica(musica, m, aoSalvar); /* SABOTAGEM M7: exportar grava */\n          if (!pincel || !pincel.temAlgo()) { UI.toast('Desenhe algo na foto antes de salvar', { tipo: 'err' }); return; }",
    espera: 'exportar nao escreveu no Store',
  },
  {
    id: 'M8', nome: 'gravar ao fechar a folha, sem pedir',
    de: /onClose: function \(\) \{\s*\r?\n\s*Metro\.parar\(\);/,
    para: "onClose: function () {\n        gravarNaMusica(musica, m, aoSalvar); /* SABOTAGEM M8: grava ao fechar */\n        Metro.parar();",
    espera: 'e nada foi escrito',
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
console.log('\n=== o provador da persistência do Estúdio ===');

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
  if (m.fora) {
    fora++;
    console.log('  --    ' + m.id + '  EXCLUIDA: ' + m.nome.replace('EXCLUIDA: ', ''));
    continue;
  }
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
    console.log('  ok    ' + m.id + '  ' + m.nome.padEnd(50) + ' -> "' + m.espera + '"');
    provadas++;
  } else {
    console.log('  FALHA  ' + m.id + '  ' + m.nome.padEnd(50) + ' -> nao observavel (exit ' + r.codigo + ')');
    r.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 2)
      .forEach((l) => console.log('          a suite acusou: ' + l.trim().slice(0, 74)));
    invalidas++;
  }
}
console.log('');
console.log('  ' + provadas + '/' + vivos.length + ' mutacoes observaveis'
  + (fora ? ', ' + fora + ' excluida com justificativa' : '')
  + (invalidas ? ', ' + invalidas + ' problema(s)' : ''));
console.log('=================================================\n');
process.exit(provadas === vivos.length ? 0 : 1);