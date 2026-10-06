/* =========================================================
   ACORDE - tools/provar-foto-biblioteca.js
   A foto da biblioteca e realmente lembrada por algum teste.

   Sabota o caminho em DOIS arquivos — a chamada em `repertorio.js` e a
   publicacao em `cancao.js` — e exige que a suite acuse cada uma. A mutacao
   entra no arquivo, e o arquivo volta dos bytes guardados em memoria,
   verificado byte a byte. Nao usa `git checkout`.

   MUTACOES QUE FICARAM DE FORA, E POR QUE

     - "criar segunda folha ao abrir a foto": a suite conta as folhas ao abrir,
       mas `abrirCifra` nao tem onde criar uma segunda — a folha e criada uma
       vez, no fim. Uma mutacao aqui exigiria reescrever a montagem inteira, e o
       que se mede seria a mutacao, nao o produto.
     - "deixar listener/instancia antiga viva": o DOM falso nao tem
       `addEventListener` observavel de fora nem contador de ouvintes. Fabricar
       uma assercao para isto seria cobertura de fachada.

   Rodar: node tools/provar-foto-biblioteca.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ } = require('./arquivos.js');

const REPERTORIO = 'js/views/repertorio.js';
const CANCAO = 'js/views/cancao.js';
const SUITE = 'tools/test-foto-biblioteca.js';

const MUTACOES = [
  {
    id: 'M1', nome: 'a biblioteca nao mostra o bloco de foto', alvo: REPERTORIO,
    de: /body\.appendChild\(V\.cancao\.blocoFoto\(registro, null, function \(\) \{ S\.mudou\('cifra'\); \}\)\);/,
    para: "/* SABOTAGEM M1: sem bloco de foto na biblioteca */",
    espera: 'e ha uma foto na folha',
  },
  {
    id: 'M2', nome: 'o bloco aparece mesmo sem foto', alvo: REPERTORIO,
    de: /if \(registro && registro\.foto && V\.cancao && V\.cancao\.blocoFoto\) \{/,
    para: 'if (registro && V.cancao && V.cancao.blocoFoto) { // SABOTAGEM M2: sem conferir a foto',
    espera: 'o bloco NAO foi montado',
  },
  {
    id: 'M3', nome: 'o bloco recebe a cópia de tela em vez do registro', alvo: REPERTORIO,
    de: /body\.appendChild\(V\.cancao\.blocoFoto\(registro, null, function \(\) \{ S\.mudou\('cifra'\); \}\)\);/,
    /* A substituicao cobre a expressao INTEIRA e deixa a marcacao no fim.
       Uma marcacao no meio engolia o `)));` com o `//` e quebrava a sintaxe —
       e uma suite que nem roda nao prova nada sobre comportamento. */
    para: "body.appendChild(V.cancao.blocoFoto(v, null, function () { S.mudou('cifra'); })); /* SABOTAGEM M3: a copia de tela */",
    espera: 'e recebeu o MESMO objeto que esta no armazenamento',
  },
  {
    id: 'M4', nome: 'o bloco recebe uma cópia nova', alvo: REPERTORIO,
    de: /body\.appendChild\(V\.cancao\.blocoFoto\(registro, null, function \(\) \{ S\.mudou\('cifra'\); \}\)\);/,
    para: "body.appendChild(V.cancao.blocoFoto(Object.assign({}, registro), null, function () { S.mudou('cifra'); })); /* SABOTAGEM M4: copia nova */",
    espera: 'e recebeu o MESMO objeto que esta no armazenamento',
  },
  {
    id: 'M5', nome: 'a resolução troca as músicas de foto', alvo: REPERTORIO,
    de: /const registro = \(c && c\.id && S\.db\.cifras\.find\(function \(x\) \{ return x\.id === c\.id; \}\)\) \|\| c;/,
    para: 'const registro = S.db.cifras.find(function (x) { return !!x.foto; }) || c; /* SABOTAGEM M5: primeiro com foto */',
    /* A troca aparece em B, nao em A: A e a primeira musica com foto do
       arquivo, entao a mutacao devolve a A para A — por coincidencia, e certo.
       B e que recebe a imagem de A. E o que a mutacao faz de verdade. */
    espera: 'B mostra a foto de B',
  },
  {
    id: 'M6', nome: 'o registro nunca e resolvido', alvo: REPERTORIO,
    de: /const registro = \(c && c\.id && S\.db\.cifras\.find\(function \(x\) \{ return x\.id === c\.id; \}\)\) \|\| c;/,
    para: 'const registro = (c && c.id) && null; // SABOTAGEM M6: nunca resolve',
    espera: 'e ha uma foto na folha',
  },
  {
    id: 'M7', nome: 'a página da música deixa de publicar o bloco', alvo: CANCAO,
    de: /V\.cancao = \{ abrir: abrir, botaoTom: botaoTom, cartaoVideo: cartaoVideo, blocoFoto: blocoFoto \};/,
    para: 'V.cancao = { abrir: abrir, botaoTom: botaoTom, cartaoVideo: cartaoVideo }; // SABOTAGEM M7',
    espera: 'a página da musica publica o bloco de foto',
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

console.log('\n=== o provador do acesso a foto pela biblioteca ===');

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
  const arqAbs = path.join(RAIZ, m.alvo);
  const orig = fs.readFileSync(arqAbs);
  const txt = orig.toString('utf8');
  if (!m.de.test(txt)) {
    console.log('  ??    ' + m.id + '  alvo nao encontrado em ' + m.alvo + ' — mutacao invalida');
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
      .forEach((l) => console.log('          a suite acusou: ' + l.trim().slice(0, 76)));
    invalidas++;
  }
}
console.log('');
console.log('  ' + provadas + '/' + MUTACOES.length + ' mutacoes observaveis'
  + (invalidas ? ', ' + invalidas + ' problema(s)' : ''));
console.log('=================================================\n');
process.exit(provadas === MUTACOES.length ? 0 : 1);