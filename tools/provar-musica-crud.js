/* =========================================================
   ACORDE - tools/provar-musica-crud.js
   Cada parte do ciclo de vida de uma musica e realmente lembrada por algum teste.

   Este arquivo sabota o formulario e a exclusao de nove jeitos e exige que a
   suite acuse cada um. Um verificador que nunca falhou e um verificador que a
   pessoa ignora.

   A mutacao e aplicada NO ARQUIVO, conferida no disco, e o arquivo e restaurado
   a partir dos bytes guardados em memoria — verificado byte a byte. Este
   arquivo NAO usa `git checkout` para restaurar: aquele comando devolve o
   arquivo ao HEAD e descarta trabalho que ainda so existe na arvore de
   trabalho.

   UMA MUTACAO QUE TROQUEI, E POR QUE
   * a19 "nao atualizar o resultado depois de editar" virou "nao renormalizar o
     que foi salvo". A primeira mexeria em `recarregar()`, que so repinta a lista
     — e uma suite que mede o Store nao a veria nem errada nem certa. A segunda
     e a defeito real que esta suite existe para pegar: o formulario gravando
     fora dos limites que o proprio campo anuncia.

   Rodar: node tools/provar-musica-crud.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ } = require('./arquivos.js');

const ALVO = 'js/views/repertorio.js';
const SUITE = 'tools/test-musica-crud.js';

/* Expressoes regulares porque o repositorio usa CRLF. */
const MUTACOES = [
  {
    id: 'M1', nome: 'nao salvar a musica nova',
    de: /if \(isNew\) S\.db\.cifras\.unshift\(guardado\);/,
    /* O `else` do lado precisa sobreviver: sem o `if`, a mutacao vira erro de
       sintaxe e a suite morre no carregamento — o que e umdefeito de sintaxe de sintaxe, nao
       uma acusacao de comportamento. */
    para: 'if (isNew) { /* SABOTAGEM M1: a musica nova nunca entra */ }',
    espera: 'criar guarda exatamente uma musica a mais',
  },
  {
    id: 'M2', nome: 'trocar o ID ao editar',
    de: /(const guardado = S\.normCifra\(v\);)/,
    para: '$1\n          guardado.id = U.uid("cif"); // SABOTAGEM M2: id novo a cada edicao',
    /* Com o id trocado, a musica editada deixa de ser encontrada pelo id — e a
       edicao "some", que e a consequencia real de trocar o id em edicao. */
    espera: 'a mudanca de titulo foi guardada',
  },
  {
    id: 'M3', nome: 'editar a musica errada',
    de: /const i = S\.db\.cifras\.findIndex\(function \(x\) \{ return x\.id === guardado\.id; \}\);\s*\r?\n\s*if \(i >= 0\) S\.db\.cifras\[i\] = guardado;/,
    para: 'S.db.cifras[0] = guardado; // SABOTAGEM M3: grava sempre na primeira',
    espera: 'o titulo antigo nao sobrou em outra copia',
  },
  {
    id: 'M4', nome: 'perder a letra ao salvar',
    de: /v\.letra = fLetra\.value;/,
    para: "v.letra = ''; // SABOTAGEM M4: a letra vai embora",
    espera: 'a letra',
  },
  {
    id: 'M5', nome: 'excluir a musica errada',
    de: /const i = S\.db\.cifras\.findIndex\(function \(x\) \{ return x\.id === c\.id; \}\);\s*\r?\n\s*if \(i >= 0\) S\.db\.cifras\.splice\(i, 1\);/,
    para: 'if (S.db.cifras.length > 1) S.db.cifras.splice(0, 1); // SABOTAGEM M5: sempre a primeira',
    espera: 'a vitima sumiu',
  },
  {
    id: 'M6', nome: 'apagar mais de uma musica',
    de: /if \(i >= 0\) S\.db\.cifras\.splice\(i, 1\);/,
    para: 'if (i >= 0) { S.db.cifras.splice(i, 1); if (i > 0) S.db.cifras.splice(i - 1, 1); } // SABOTAGEM M6: leva a vizinha',
    espera: 'excluir tira exatamente uma',
  },
  {
    id: 'M7', nome: 'nao renormalizar o que foi salvo',
    de: /const guardado = S\.normCifra\(v\);/,
    para: 'const guardado = v; // SABOTAGEM M7: grava cru, fora dos limites do modelo',
    espera: 'BPM acima do maximo e guardado no maximo do modelo',
  },
  {
    id: 'M8', nome: 'corromper a cifra que o repertorio usa',
    de: /v\.cifra = fCifra\.value;/,
    para: "v.cifra = ''; // SABOTAGEM M8: a cifra vai embora",
    espera: 'e traz a cifra do catalogo',
  },
  {
    id: 'M9', nome: 'cancelar continua salvando',
    de: /el\('button', \{ class: 'btn btn-secondary', onclick: function \(\) \{ h\.close\(\); \} \}, 'Cancelar'\),/,
    para: "el('button', { class: 'btn btn-secondary', onclick: function () { /* SABOTAGEM M9: cancelar grava */ if (fTitulo.value.trim()) { var i9 = S.db.cifras.findIndex(function (x) { return x.titulo === v.titulo; }); if (i9 >= 0) S.db.cifras[i9].titulo = fTitulo.value.trim(); S.mudou('cifra'); } h.close(); } }, 'Cancelar'),",
    espera: 'e nao escreve no objeto que estava sendo editado',
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

console.log('\n=== o provador do ciclo de vida da musica ===');

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
    console.log('  ok    ' + m.id + '  ' + m.nome.padEnd(40) + ' -> "' + m.espera + '"');
    provadas++;
  } else {
    console.log('  FALHA  ' + m.id + '  ' + m.nome.padEnd(40) + ' -> nao observavel (exit ' + r.codigo + ')');
    r.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 3)
      .forEach((l) => console.log('          a suite acusou: ' + l.trim().slice(0, 82)));
    invalidas++;
  }
}

console.log('');
console.log('  ' + provadas + '/' + MUTACOES.length + ' mutacoes observaveis'
  + (invalidas ? ', ' + invalidas + ' problema(s)' : ''));
console.log('=================================================\n');

process.exit(provadas === MUTACOES.length ? 0 : 1);