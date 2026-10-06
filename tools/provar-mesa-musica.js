/* =========================================================
   ACORDE - tools/provar-mesa-musica.js
   O caminho da musica ate a mesa e mesmo lembrado por algum teste.

   Um verificador que nunca falhou e um verificador que a pessoa ignora. Este
   arquivo sabotar de nove jeitos o trecho que abre a mesa a partir da tela da
   musica, roda a suite e exige que ela acuse cada um.

   A mutacao e aplicada NO ARQUIVO, verificada no disco, e o arquivo e
   restaurado — e a restauracao e conferida byte a byte. Um provador que deixa
   o produto quebrado quando um teste lanca e pior do que nao existir.

   As mutacoes sao escolhidas para serem OBSERVAVEIS: cada uma aponta para uma
   asercao que existe na suite. Nenhuma foi escolhida por parecer importante.

   Rodar: node tools/provar-mesa-musica.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ } = require('./arquivos.js');

const ALVO = 'js/views/cancao.js';
const SUITE = 'tools/test-mesa-musica.js';

/* Os alvos sao expressoes regulares porque o repositorio usa CRLF: um texto
   exato casaria numa execucao e nao na seguinte, e um provador que as vezes
   aplica a mutacao e as vezes nao e pior do que um que nunca aplica. */
const MUTACOES = [
  {
    id: 'M1', nome: 'nao chamar o palco',
    de: /MesaDeEnsaio\.abrirDeMusica\(escala, mus\);/,
    para: '/* SABOTAGEM M1: o botao nao abre nada */',
    espera: 'clicar chama o palco UMA vez',
  },
  {
    id: 'M2', nome: 'passar a escala no lugar da musica',
    de: /MesaDeEnsaio\.abrirDeMusica\(escala, mus\);/,
    para: 'MesaDeEnsaio.abrirDeMusica(mus, escala); // SABOTAGEM M2: trocados',
    espera: 'o palco recebe a MUSICA CERTA, por identidade',
  },
  {
    id: 'M3', nome: 'passar a ficha em vez da musica',
    de: /MesaDeEnsaio\.abrirDeMusica\(escala, mus\);/,
    para: 'MesaDeEnsaio.abrirDeMusica(escala, S.fichaDe(mus, escala)); // SABOTAGEM M3: objeto errado',
    espera: 'o palco recebe a MUSICA CERTA, por identidade',
  },
  {
    id: 'M4', nome: 'criar sessao de repertorio',
    de: /(const temMesa = !!)/,
    para: 'if (escala) { escala.indice = 0; escala.musicas.push(mus); S.mudou(\'escala\'); } // SABOTAGEM M4\n    const temMesa = !!',
    espera: 'a ordem do repertorio nao muda',
  },
  {
    id: 'M5', nome: 'escrever no Store ao abrir',
    de: /(corpo\.appendChild\(cabecalho\);)/,
    para: "S.mudou('escala'); S.mudou('cifra'); // SABOTAGEM M5: escrita na navegacao\n    $1",
    espera: 'abrir a pagina nao pede gravacao ao Store (nenhum S.mudou)',
  },
  {
    id: 'M6', nome: 'guardar uma transposicao na musica',
    de: /(MesaDeEnsaio\.abrirDeMusica\(escala, mus\);)/,
    para: 'mus.tom = M.transposeCifra(mus.tom, 1); // SABOTAGEM M6: suja o original\n          $1',
    espera: 'o tom guardado nao foi mexido',
  },
  {
    id: 'M7', nome: 'nao fechar a folha antes da mesa',
    de: /if \(h && typeof h\.close === 'function'\) h\.close\(\);/,
    para: '/* SABOTAGEM M7: duas folhas empilhadas */',
    espera: 'e a folha da musica fecha ANTES de a mesa abrir',
  },
  {
    id: 'M8', nome: 'abrir sempre a primeira musica da escala',
    de: /MesaDeEnsaio\.abrirDeMusica\(escala, mus\);/,
    para: 'MesaDeEnsaio.abrirDeMusica(escala, (escala && escala.musicas && escala.musicas[0]) || mus); // SABOTAGEM M8',
    espera: 'a segunda levou a segunda musica',
  },
  {
    id: 'M9', nome: 'perder a referencia da musica',
    de: /MesaDeEnsaio\.abrirDeMusica\(escala, mus\);/,
    para: 'MesaDeEnsaio.abrirDeMusica(escala, Object.assign({}, mus)); // SABOTAGEM M9: copia rasa',
    espera: 'o palco recebe a MUSICA CERTA, por identidade',
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

console.log('\n=== o provador do caminho musica -> mesa ===');

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
     mede o original e conclui que o trecho e desnecessario — a conclusao mais
     cara que existe aqui. */
  const noDisco = fs.readFileSync(arqAbs, 'utf8');
  if (noDisco.indexOf('SABOTAGEM ' + m.id) < 0) {
    console.log('  ??    ' + m.id + '  a marcacao nao esta no arquivo — mutacao nao aplicada de verdade');
    restaurar();
    invalidas++;
    continue;
  }

  const r = rodarSuite();
  restaurar();

  const restaurou = fs.readFileSync(arqAbs).equals(orig);
  if (!restaurou) {
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
    r.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 3)
      .forEach((l) => console.log('          a suite acusou: ' + l.trim().slice(0, 86)));
    invalidas++;
  }
}

console.log('');
console.log('  ' + provadas + '/' + MUTACOES.length + ' mutacoes observaveis'
  + (invalidas ? ', ' + invalidas + ' problema(s)' : ''));
console.log('=================================================\n');

process.exit(provadas === MUTACOES.length ? 0 : 1);