/* =========================================================
   tools/test-id-unico.js
   Nenhum id repetido, e nenhuma referencia quebrada.

   POR QUE ESTE TESTE EXISTE

   `cifraPorId` devolve a PRIMEIRA ocorrencia. Duas cifras com o mesmo `id`
   significam que a segunda nao tem porta: ela aparece na lista, pode ser
   editada, e a edicao e gravada por cima da primeira. O sintoma para quem usa e
   "minha cifra sumiu", sem erro, sem aviso.

   O caminho que trazia o problema e o `Restaurar backup` no modo `substituir`:
   ele recebia a lista importada como veio, enquanto o modo mesclar ja
   descartava id repetido. Dois caminhos da mesma funcao discordando sobre a
   mesma invariante.

   A correcao renumera SO a segunda ocorrencia em diante. O id da primeira fica
   como esta, e isso nao e detalhe: `musica.cifraId` aponta para uma cifra, e
   essa referencia ja resolvia para a primeira. Trocar o id dela mandaria toda a
   ficha de ensaio para o nada.

   ESTE TESTE PROVA, ENTRE OUTRAS COISAS

     - importacao sem duplicata: nenhum id muda;
     - uma, varias, e o mesmo id repetido manyas vezes;
     - id vazio ou invalido: continua tudo, e ganha id;
     - backup antigo (schema v1) continua importando;
     - backup corrompido: recusa com mensagem, sem derrubar o app;
     - importar duas vezes o mesmo arquivo: nao duplica nada;
     - Unicode e emoji atravessam inteiros;
     - mil registros: aguenta;
     - e o mais importante: a referencia `cifraId` continua apontando para a
       MESMA cifra de antes, mesmo quando o backup tinha id repetido.
   ========================================================= */
'use strict';

const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ARQ = path.join(RAIZ, 'js', 'core', 'store.js');

/* O store usa `localStorage`, que o Node nao tem. Um stub minimo e suficiente:
 * o que este teste mede e a logica do `importar`, nao o armazenamento. */
const memoria = new Map();
global.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => { memoria.set(k, String(v)); },
  removeItem: (k) => { memoria.delete(k); },
  clear: () => { memoria.clear(); },
  key: () => null,
  get length() { return memoria.size; },
};

/* `Store` guarda o modulo em cache; entre os cenarios ele precisa ser
 * recarregado do zero, senao o `db` do cenario anterior vaza para o seguinte. */
require('../js/core/music.js');
require('../js/core/utils.js');
delete require.cache[require.resolve(ARQ)];
const Store = require(ARQ);

let passou = 0;
let falhou = 0;
const problemas = [];

function ok(cond, titulo, detalhe) {
  if (cond) { passou++; console.log('  ok    ' + titulo + (detalhe ? '  (' + detalhe + ')' : '')); }
  else {
    falhou++;
    problemas.push(titulo);
    console.log('  FALHA ' + titulo);
    if (detalhe) console.log('        ' + detalhe);
  }
}
function secao(t) { console.log('\n=== ' + t + ' ==='); }
function igual(a, b, titulo, detalhe) { ok(a === b, titulo, detalhe === undefined ? String(a) + ' = ' + String(b) : detalhe); }
function eq(a, b, titulo) { igual(JSON.stringify(a), JSON.stringify(b), titulo, JSON.stringify(a)); }

/* O store le `global.Utils` no topo do arquivo. Em Node nao existe `window`, e
 * os modulos deste projeto publicam em `globalThis` quando nao acham janela —
 * mas so depois de carregados. Por isso a ordem: `music`, `utils`, e so entao
 * `store`. Carregar o store primeiro daria `U` indefinido, e o erro apareceria
 * em `U.uid`, longe do que o teste esta medindo. */
const DEPENDENCIAS = [
  path.join(RAIZ, 'js', 'core', 'music.js'),
  path.join(RAIZ, 'js', 'core', 'utils.js'),
];

function partirDoZero() {
  memoria.clear();
  DEPENDENCIAS.forEach((a) => { delete require.cache[require.resolve(a)]; });
  DEPENDENCIAS.forEach((a) => { require(a); });
  delete require.cache[require.resolve(ARQ)];
  return require(ARQ);
}

function backup(cifras, escalas) {
  return { app: 'Clave', exportadoEm: '2026-01-01T00:00:00.000Z', cifras: cifras, escalas: escalas || [] };
}

function idsQueNaoSeRepetem(lista) {
  const v = new Set();
  for (const r of lista) {
    if (v.has(r.id)) return false;
    v.add(r.id);
  }
  return true;
}

/* ------------------------------------------------------------------ */
secao('1. Importacao sem duplicata: nenhum id pode mudar');

{
  const S = partirDoZero();
  const entrada = [
    { id: 'cif_a', titulo: 'A', artista: 'X', cifra: 'C' },
    { id: 'cif_b', titulo: 'B', artista: 'Y', cifra: 'G' },
    { id: 'cif_c', titulo: 'C', artista: 'Z', cifra: 'D' },
  ];
  const r = S.importar(JSON.stringify(backup(entrada)), 'substituir');
  igual(r.cifras, 3, 'entrou tudo');
  eq(S.cifras().map((c) => c.id).sort(), ['cif_a', 'cif_b', 'cif_c'],
    'e os tres ids continuam exatamente como vieram');
}

secao('2. Uma duplicata: a segunda ganha id, a primeira fica');

{
  const S = partirDoZero();
  const r = S.importar(JSON.stringify(backup([
    { id: 'cif_x', titulo: 'Primeira', artista: 'A', cifra: 'C' },
    { id: 'cif_x', titulo: 'Segunda',  artista: 'B', cifra: 'G' },
  ])), 'substituir');

  igual(r.cifras, 2, 'as DUAS entradas entraram — nada foi descartado');
  const lista = S.cifras();
  ok(idsQueNaoSeRepetem(lista), 'e nenhum id se repete');
  igual(lista.length, 2, 'as duas cifras estao na lista');

  const primeira = lista.find((c) => c.titulo === 'Primeira');
  const segunda = lista.find((c) => c.titulo === 'Segunda');
  igual(primeira.id, 'cif_x', 'a PRIMEIRA conservou o id original');
  ok(segunda.id !== 'cif_x', 'a segunda recebeu id novo', segunda.id);
  ok(S.cifraPorId('cif_x') === primeira,
    'e `cifraPorId` acha a primeira, que e quem a referencia apontava');
  ok(S.cifraPorId(segunda.id) === segunda,
    'a segunda tambem ficou alcancavel — antes nao era', segunda.id);
}

secao('3. Varias duplicatas, e o mesmo id repetido muitas vezes');

{
  const S = partirDoZero();
  const entrada = [
    { id: 'cif_r', titulo: 'A', cifra: 'C' },
    { id: 'cif_r', titulo: 'B', cifra: 'G' },
    { id: 'cif_r', titulo: 'C', cifra: 'D' },
    { id: 'cif_r', titulo: 'D', cifra: 'E' },
    { id: 'cif_outro', titulo: 'E', cifra: 'F' },
  ];
  const r = S.importar(JSON.stringify(backup(entrada)), 'substituir');
  igual(r.cifras, 5, 'as CINCO entraram');
  ok(idsQueNaoSeRepetem(S.cifras()), 'nenhum id se repete');
  const lista = S.cifras();
  igual(lista.find((c) => c.titulo === 'A').id, 'cif_r', 'a primeira repetida ficou com o id');
  igual(lista.find((c) => c.titulo === 'E').id, 'cif_outro', 'o id unico nao foi tocado');
  ok(new Set(lista.slice(1, 4).map((c) => c.id)).size === 3,
    'as tres repetidas ganharam tres ids diferentes',
    lista.slice(1, 4).map((c) => c.id).join(' | '));
}

secao('4. Id vazio ou invalido');

{
  const S = partirDoZero();
  const r = S.importar(JSON.stringify(backup([
    { titulo: 'Sem id', cifra: 'C' },
    { id: '', titulo: 'Id vazio', cifra: 'G' },
    { id: null, titulo: 'Id nulo', cifra: 'D' },
    { id: 'cif_ok', titulo: 'Com id', cifra: 'E' },
  ])), 'substituir');
  igual(r.cifras, 4, 'as quatro entraram');
  const lista = S.cifras();
  ok(lista.every((c) => typeof c.id === 'string' && c.id.length > 0),
    'toda cifra tem id nao vazio, e string');
  ok(idsQueNaoSeRepetem(lista), 'e nenhum se repete');
  ok(lista.every((c) => S.cifraPorId(c.id) === c),
    'toda cifra e alcancavel pelo proprio id');
}

secao('5. Backup antigo (schema v1) e escalas com id repetido');

{
  const S = partirDoZero();
  const v1 = { '2026-03-08': [
    { id: 'esc_v1', titulo: 'Ensaio', musicas: [{ nome: 'Musica 1', tom: 'C', letra: 'la', cifra: 'C G' }] },
  ] };
  /* O `try` aqui nao e cautela: e a unica forma de o teste RELATAR o defeito.
   * Sem ele, uma excecao derruba o processo, e o provador le isso como
   * "nenhuma falha" — foi o que aconteceu na primeira versao, em que esta
   * mutacao passou sem ser percebida por um teste que morreu em vez de
   * reprovar. */
  let erro = null, r = null;
  try { r = S.importar(JSON.stringify(v1), 'substituir'); }
  catch (e) { erro = e; }
  ok(erro === null, 'o backup v1 importa sem recusar',
    erro ? erro.name + ': ' + String(erro.message).slice(0, 70) : '');
  if (erro === null) {
    igual(r.escalas, 1, 'e traz a escala');
    igual(S.escalas().length, 1, 'a escala entrou na lista');
    ok(S.escalas()[0].musicas.length === 1, 'e a musica dentro dela tambem');
  }
}
{
  const S = partirDoZero();
  const r = S.importar(JSON.stringify({
    cifras: [],
    escalas: [
      { id: 'esc_d', data: '2026-03-08', titulo: 'Primeiro', musicas: [] },
      { id: 'esc_d', data: '2026-03-09', titulo: 'Segundo', musicas: [] },
      { id: 'esc_d', data: '2026-03-10', titulo: 'Terceiro', musicas: [] },
    ],
  }), 'substituir');
  igual(r.escalas, 3, 'as tres escalas entraram');
  ok(idsQueNaoSeRepetem(S.escalas()), 'e nenhum id de escala se repete');
  igual(S.escalas()[0].id, 'esc_d', 'a primeira conservou o id');
}

secao('6. A referencia `cifraId` continua apontando para a mesma cifra');

{
  const S = partirDoZero();
  /* Uma ficha de ensaio aponta para `cif_x`, que no backup aparece DUAS vezes.
   * A referencia ja resolvia para a primeira; depois do import tem de resolver
   * para a MESMA cifra, senao o ensaio passa a tocar outra musica. */
  const r = S.importar(JSON.stringify({
    cifras: [
      { id: 'cif_x', titulo: 'Alvo', artista: 'A', cifra: 'C' },
      { id: 'cif_x', titulo: 'Outra', artista: 'B', cifra: 'G' },
    ],
    escalas: [{
      id: 'esc_1', data: '2026-03-08', titulo: 'Ensaio',
      musicas: [{ nome: 'Musica', tom: 'C', cifraId: 'cif_x' }],
    }],
  }), 'substituir');

  igual(r.cifras, 2, 'as duas cifras entraram');
  const escala = S.escalas()[0];
  const musica = escala.musicas[0];
  const alvo = S.cifraPorId(musica.cifraId);
  ok(!!alvo, 'a ficha do ensaio ainda acha a cifra');
  igual(alvo && alvo.titulo, 'Alvo', 'e aponta para a MESMA cifra de antes, nao para a duplicata');
}

secao('7. Importar o mesmo arquivo duas vezes');

{
  const S = partirDoZero();
  const arquivo = JSON.stringify(backup([
    { id: 'cif_1', titulo: 'A', artista: 'A', cifra: 'C' },
    { id: 'cif_2', titulo: 'B', artista: 'B', cifra: 'G' },
  ]));

  S.importar(arquivo, 'substituir');
  igual(S.cifras().length, 2, 'primeira importacao');

  S.importar(arquivo, 'substituir');
  igual(S.cifras().length, 2, 'segunda importacao nao duplicou nada');

  /* E o modo mesclar, que e o outro caminho da mesma funcao. */
  S.importar(arquivo);
  igual(S.cifras().length, 2, 'e o modo mesclar tambem nao duplicou');
  ok(idsQueNaoSeRepetem(S.cifras()), 'e nenhum id se repetiu no caminho todo');
}

secao('8. Backup corrompido: recusa com mensagem, sem derrubar o app');

{
  const S = partirDoZero();
  S.importar(JSON.stringify(backup([{ id: 'cif_ok', titulo: 'Boa', cifra: 'C' }])), 'substituir');

  const corruptos = ['{isto nao e json', 'null', '[]', '"uma string"', '42', '', '{"cifras":{}}', '{"cifras":"nao e lista"}'];
  let recusouTodos = true;
  for (const c of corruptos) {
    let lancou = false;
    let dadosIntactos = false;
    try { S.importar(c, 'substituir'); }
    catch (e) { lancou = true; }
    // Depois de cada tentativa, os dados anteriores tem de continuar la.
    dadosIntactos = S.cifras().length === 1 && S.cifras()[0].titulo === 'Boa';
    if (!lancou || !dadosIntactos) {
      recusouTodos = false;
      console.log('        "' + c.slice(0, 24) + '" lancou=' + lancou + ', dados intactos=' + dadosIntactos);
    }
  }
  ok(recusouTodos, 'todo backup corrompido foi recusado SEM tocar nos dados validos',
    corruptos.length + ' entradas');
  igual(S.cifras().length, 1, 'e a cifra valida continua la no fim');
}

secao('9. Unicode e emoji atravessam inteiros');

{
  const S = partirDoZero();
  const titulos = [
    'Avião — Música Involvível',
    '🎸 일으ambiguation',
    '日本語のタイトル',
    'Кириллица',
    'Ana & Bruno <b>não</b>',
    'acentuação completa: ãõâêô',
  ];
  const entrada = titulos.map((t, i) => ({ id: 'cif_u' + i, titulo: t, cifra: 'C' }));
  // E com o MESMO id, para o teste valer tambem com texto estranho.
  entrada.push({ id: 'cif_u0', titulo: 'duplicada com emoji 🎵', cifra: 'G' });

  const r = S.importar(JSON.stringify(backup(entrada)), 'substituir');
  igual(r.cifras, titulos.length + 1, 'todas entraram');
  eq(S.cifras().slice(0, titulos.length).map((c) => c.titulo), titulos,
    'e os titulos voltaram exatos, caractere por caractere');
  ok(idsQueNaoSeRepetem(S.cifras()), 'e a duplicata com emoji tambem ganhou id proprio');
}

secao('10. Mil registros');

{
  const S = partirDoZero();
  const entrada = [];
  for (let i = 0; i < 1000; i++) {
    entrada.push({ id: 'cif_' + (i % 400), titulo: 'Musica ' + i, cifra: 'C G D' });
  }
  const t0 = Date.now();
  const r = S.importar(JSON.stringify(backup(entrada)), 'substituir');
  const ms = Date.now() - t0;
  igual(r.cifras, 1000, 'as mil entraram, nenhuma descartada');
  ok(idsQueNaoSeRepetem(S.cifras()), 'e os 1000 ids sao distintos');
  igual(new Set(S.cifras().map((c) => c.id)).size, 1000, 'confere por contagem');
  ok(ms < 4000, 'e levou um tempo razoavel', ms + 'ms');
}

secao('11. O modo mesclar continua como estava (nao regredi)');

{
  const S = partirDoZero();
  S.importar(JSON.stringify(backup([{ id: 'cif_1', titulo: 'A', artista: 'A', cifra: 'C' }])), 'substituir');
  const r = S.importar(JSON.stringify(backup([
    { id: 'cif_1', titulo: 'A repetida', artista: 'A', cifra: 'C' },
    { id: 'cif_2', titulo: 'B nova', artista: 'B', cifra: 'G' },
  ])));
  igual(r.cifras, 2, 'o mesclar recebeu dois e aceitou um');
  igual(S.cifras().length, 2, 'a lista tem as duas, sem repetir a que ja existia');
  ok(idsQueNaoSeRepetem(S.cifras()), 'e nenhum id se repete');
}

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(56));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  Uma cifra duplicada nao da erro: ela some quando alguem edita');
  console.log('  a outra, e o sintoma e "minha cifra sumiu".');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(56) + '\n');
process.exit(falhou ? 1 : 0);