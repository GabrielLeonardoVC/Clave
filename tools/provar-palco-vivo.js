/* =========================================================
   ACORDE - tools/provar-palco-vivo.js
   Cada parte da mesa viva e realmente lembrada por algum teste.

   Um verificador que nunca falhou e um verificador que a pessoa ignora. Este
   arquivo quebra a mesa viva de nove jeitos, roda a suite e exige que ela
   acuse cada um. Se um destes nao e observado, ou o teste nao mede o que
   diz medir, ou a parte nao e necessaria — e nos dois casos o teste e
   estava dando uma seguranca que nao existe.

   A mutacao e sempre aplicada em COPIA DE MEMORIA, e o arquivo restaurado
   depois. Um provador que deixa o arquivo quebrado quando um teste lanca ou
   o processo e interrompido e pior do que nao existir.

   Rodar: node tools/provar-palco-vivo.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ } = require('./arquivos.js');

const VIVA = 'js/core/viva.js';
const RELOGIO = 'js/core/palco.js';
const SUITE = 'tools/test-palco-vivo.js';

/* Cada mutacao: onde, o texto exato, e o que ela substitui.
   Os alvos sao expressoes regulares porque o repositorio usa CRLF: um texto
   exato casaria numa execucao e nao na seguinte, e um provador que as vezes
   aplica a mutacao e as vezes nao e pior que um que nunca aplica. */
const MUTACOES = [
  {
    id: 'M1', nome: 'nao pedir Wake Lock ao abrir',
    arq: VIVA,
    de: /if \(podeAcender\(\)\) acender\(\);/,
    para: '/* SABOTAGEM M1: nada pede a tela acesa */',
    /* O teste afirma que ABRIR adquire, sem ninguem pedir. Uma versao que so
       conferiria depois de um `acender()` explicito passaria com esta
       mutacao — e mediria a chamada do teste, nao a mesa. */
    espera: 'abrir a mesa ja pede a tela acesa',
  },
  {
    id: 'M2', nome: 'nao soltar o Wake Lock ao fechar',
    arq: VIVA,
    de: /(aberto = false;\s*\r?\n\s*)apagar\(\);/,
    para: '$1/* SABOTAGEM M2: o handle fica vivo depois do fechamento */',
    espera: 'fechar a mesa solta o Wake Lock',
  },
  {
    id: 'M3', nome: 'nao reacender ao voltar da ocultacao',
    arq: VIVA,
    de: /if \(aberto && !recusado\) acender\(\);/,
    para: '/* SABOTAGEM M3: sem reaquecimento */',
    espera: 'ao voltar, a tela e reacendida',
  },
  {
    id: 'M4', nome: 'ignorar o fullscreenchange',
    arq: VIVA,
    de: /(function aoMudarTelaCheia\(\) \{[\s\S]{0,220}?\n\s*)aoMudar\(\);/,
    para: '$1/* SABOTAGEM M4: o evento chega e e ignorado */',
    espera: 'quem pinta a interface foi avisado das duas bordas',
  },
  {
    id: 'M5', nome: 'usar estado guardado em vez do documento',
    arq: VIVA,
    de: /function emTelaCheia\(\) \{\s*\r?\n\s*return !!elementoTelaCheia\(\);/,
    para: 'function emTelaCheia() {\n      return false;   // SABOTAGEM M5: nunca le o documento',
    espera: 'o `fullscreenchange` confirma a entrada',
  },
  {
    id: 'M6', nome: 'nao tratar visibilitychange',
    arq: VIVA,
    de: /doc\.addEventListener\('visibilitychange', aoVisibilidade\);/,
    para: '/* SABOTAGEM M6: sem ouvinte de visibilidade */',
    espera: 'ao ocultar, o handle e solto',
  },
  {
    id: 'M7', nome: 'usar o tempo antigo depois de voltar',
    arq: RELOGIO,
    de: /(congelado = false;\s*\r?\n\s*)ultimoQuadro = agora\(\);/,
    para: '$1/* SABOTAGEM M7: o intervalo oculto entra na conta */',
    espera: 'e volta a contar o tempo de verdade',
  },
  {
    id: 'M8', nome: 'duplicar o ouvinte de visibilidade',
    arq: VIVA,
    de: /if \(aberto\) return estado\(\);/,
    para: '/* SABOTAGEM M8: sem guarda — abrir de novo duplica o ouvinte */',
    espera: 'tres `abrir` nao criam tres ouvintes de visibilidade',
  },
  {
    id: 'M9', nome: 'nao tirar o ouvinte ao fechar',
    arq: VIVA,
    de: /doc\.removeEventListener\('visibilitychange', aoVisibilidade\);/,
    para: '/* SABOTAGEM M9: o ouvinte fica */',
    espera: 'destruir tira o ouvinte de visibilidade',
  },
];

/* O arquivo que esta modificado AGORA. Se o processo morrer no meio, ele tem
   de voltar sozinho — um arquivo de produto quebrado no disco e o pior
   resultado que um provador pode deixar. */
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

function originalDe(rel) {
  return fs.readFileSync(path.join(RAIZ, rel));
}

console.log('\n=== o provador da mesa viva ===');

/* --- 1. a linha de base precisa passar --- */
const base = rodarSuite();
if (base.codigo !== 0) {
  console.log('  FALHA  a suite nao passa ANTES de qualquer mutacao');
  base.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 6)
    .forEach((l) => console.log('        ' + l.trim()));
  console.log('=================================================\n');
  process.exit(1);
}
console.log('  ok    a suite passa sem nenhuma mutacao');

/* --- 2. uma por uma --- */
let provadas = 0;
let invalidas = 0;

for (const m of MUTACOES) {
  const arqAbs = path.join(RAIZ, m.arq);
  const orig = originalDe(m.arq);
  const txt = orig.toString('utf8');

  if (!m.de.test(txt)) {
    console.log('  ??    ' + m.id + '  alvo nao encontrado em ' + m.arq + ' — mutacao invalida');
    invalidas++;
    continue;
  }

  const trocado = txt.replace(m.de, m.para);
  if (trocado === txt) {
    console.log('  ??    ' + m.id + '  o replace nao mudou nada — mutacao invalida');
    invalidas++;
    continue;
  }

  pendente = { arq: m, arqAbs: arqAbs, orig: orig };
  fs.writeFileSync(arqAbs, trocado);

  // A mutacao tem de estar NO ARQUIVO, e nao so na intencao. Um provador que
  // acredita que aplicou mede o arquivo original e conclui que a parte e
  // desnecessaria — a conclusao mais cara que existe aqui.
  const noDisco = fs.readFileSync(arqAbs, 'utf8');
  if (noDisco.indexOf('SABOTAGEM ' + m.id) < 0) {
    console.log('  ??    ' + m.id + '  a marcacao nao esta no arquivo — mutacao nao aplicada de verdade');
    restaurar();
    invalidas++;
    continue;
  }

  const r = rodarSuite();
  restaurar();

  // restauracao conferida: o arquivo tem de voltar ao conteudo original
  const depois = fs.readFileSync(arqAbs);
  const restaurou = depois.equals(orig);
  if (!restaurou) {
    console.log('  FALHA  ' + m.id + '  o arquivo NAO voltou ao estado original');
    invalidas++;
    continue;
  }

  const acusou = r.codigo !== 0 && r.saida.indexOf('FALHA  ' + m.espera) >= 0;
  if (acusou) {
    console.log('  ok    ' + m.id + '  ' + m.nome.padEnd(42) + ' -> "' + m.espera + '"');
    provadas++;
  } else {
    console.log('  FALHA  ' + m.id + '  ' + m.nome.padEnd(42)
      + ' -> nao observavel (exit ' + r.codigo + ')');
    r.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 3)
      .forEach((l) => console.log('          a suite acusou: ' + l.trim().slice(0, 88)));
    invalidas++;
  }
}

console.log('');
console.log('  ' + provadas + '/' + MUTACOES.length + ' mutacoes observaveis'
  + (invalidas ? ', ' + invalidas + ' problema(s)' : ''));
console.log('=================================================\n');

process.exit(provadas === MUTACOES.length ? 0 : 1);