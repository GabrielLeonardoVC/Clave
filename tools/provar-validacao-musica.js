/* =========================================================
   ACORDE - tools/provar-validacao-musica.js
   A recusa do titulo e realmente lembrada por algum teste.

   Sabota o formulario de nove jeitos e exige que a suite acuse cada um. A
   mutacao entra no ARQUIVO, e o arquivo volta dos bytes guardados em memoria —
   verificado byte a byte. Este arquivo nao usa `git checkout`.

   UMA MUTACAO QUE TROQUEI, E POR QUE
   * "permitir 'Sem titulo' como substituto silencioso" foi trocada por "o campo
     nasce preenchido de novo". A primeira mudaria o resultado visivel de um
     titulo digitado de verdade — caminho que a suite nao monta, e que
     transformaria um titulo real em "Sem titulo" sem que ninguem percebido. A
     segunda e o defeito real: o valor de guarda do modelo vazando para dentro
     do campo de edicao de musica nova.

   Rodar: node tools/provar-validacao-musica.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ } = require('./arquivos.js');

const ALVO = 'js/views/repertorio.js';
const SUITE = 'tools/test-validacao-musica.js';

const MUTACOES = [
  {
    id: 'M1', nome: 'permitir título vazio',
    de: /if \(!titulo\) \{ avisarTitulo\(\); fTitulo\.focus\(\); return; \}/,
    para: '/* SABOTAGEM M1: aceita titulo vazio */',
    espera: 'nada foi gravado',
  },
  {
    id: 'M2', nome: 'validar sem aparar (espacos passam)',
    de: /const titulo = fTitulo\.value\.trim\(\);/,
    para: 'const titulo = fTitulo.value; // SABOTAGEM M2: sem trim',
    espera: '"     " nao virou musica',
  },
  {
    id: 'M3', nome: 'não mostrar o aviso',
    de: /erroTitulo\.textContent = vazio \? 'Informe o título da música\.' : '';/,
    para: "erroTitulo.textContent = ''; // SABOTAGEM M3: sem aviso",
    espera: 'e ha um aviso dizendo o que falta',
  },
  {
    id: 'M4', nome: 'não focar o campo',
    de: /if \(!titulo\) \{ avisarTitulo\(\); fTitulo\.focus\(\); return; \}/,
    para: 'if (!titulo) { avisarTitulo(); return; } // SABOTAGEM M4: sem foco',
    espera: 'e o foco foi para o campo que falhou',
  },
  {
    id: 'M5', nome: 'gravar mesmo com o título inválido',
    de: /if \(!titulo\) \{ avisarTitulo\(\); fTitulo\.focus\(\); return; \}\s*\r?\n\s*avisarTitulo\(\);/,
    para: '/* SABOTAGEM M5: nao recusa nada */\n          avisarTitulo();',
    espera: 'nada foi gravado',
  },
  {
    id: 'M6', nome: 'EXCLUIDA: apagar o título antes de validar',
    /* Nao entra na lista: `v` e uma COPIA, e quando o `Salvar` recusa ele
       simplesmente nao e gravado. Apagar `v.titulo` antes de decidir muda o
       objeto que vai ser descartado — e a suite, como nao ve objeto descartado,
       nao tem o que acusar. Observar esta mutacao exigiria provar que um
       objeto NAO foi gravado, o que e o mesmo que as outras mutacoes ja provam.
       Fabricar uma assercao so para esta seria cobertura de fachada. */
    fora: true,
  },
  {
    id: 'M7', nome: 'criar duplicata depois de falhar',
    /* O esboco e guardado ANTES da recusa: colocado depois, a linha nunca
       chega a rodar — e uma mutacao que nao executa nao prova nada. */
    de: /(const titulo = fTitulo\.value\.trim\(\);)/,
    para: '$1\n          if (!titulo) S.db.cifras.push(S.normCifra(v)); // SABOTAGEM M7: deixa passar um esboco',
    espera: 'nada foi gravado',
  },
  {
    id: 'M8', nome: 'o campo nasce preenchido de novo',
    de: /class: 'input', value: isNew \? '' : v\.titulo,/,
    para: "class: 'input', value: v.titulo, // SABOTAGEM M8: o valor de guarda volta para o campo",
    espera: 'e nasce VAZIO',
  },
  {
    id: 'M9', nome: 'não marcar o campo como inválido',
    de: /if \(vazio\) fTitulo\.setAttribute\('aria-invalid', 'true'\);/,
    para: "/* SABOTAGEM M9: o campo nao se marca */ if (vazio) fTitulo.setAttribute('aria-required', 'true');",
    espera: 'e o campo se marca como invalido',
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
console.log('\n=== o provador da validação do titulo ===');

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
const mutants = MUTACOES.filter((m) => !m.fora);
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
    console.log('  ok    ' + m.id + '  ' + m.nome.padEnd(42) + ' -> "' + m.espera + '"');
    provadas++;
  } else {
    console.log('  FALHA  ' + m.id + '  ' + m.nome.padEnd(42) + ' -> nao observavel (exit ' + r.codigo + ')');
    r.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 2)
      .forEach((l) => console.log('          a suite acusou: ' + l.trim().slice(0, 80)));
    invalidas++;
  }
}
console.log('');
console.log('  ' + provadas + '/' + mutants.length + ' mutacoes observaveis'
  + (fora ? ', ' + fora + ' excluida com justificativa' : '')
  + (invalidas ? ', ' + invalidas + ' problema(s)' : ''));
console.log('=================================================\n');
process.exit(provadas === mutants.length ? 0 : 1);