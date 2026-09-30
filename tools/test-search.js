/* Testes de regressao da busca tolerante a erro.
   Rodar:  node tools/test-search.js
   --------------------------------------------------------- */
const S = require('../js/core/search.js');

let pass = 0, fail = 0;
// A busca devolve listas, e `===` em array compara referencia, nunca conteudo.
// A comparacao vai pelo JSON, que e o que importa aqui: a lista de resultados.
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const good = a === e;
  good ? pass++ : fail++;
  console.log((good ? '  ok   ' : '  FALHA') + '  ' + label +
    (good ? '' : '  -> obtido ' + a + ', esperado ' + e));
}
function ok(cond, label) { eq(!!cond, true, label); }
function titulos(itens) { return S.buscarItens(itens, '').length === 0 ? [] : null; }
function achou(itens, q) { return S.buscarItens(itens, q).map(function (i) { return i.titulo || i.nome; }); }

const BASE = [
  { titulo: 'O Senhor e o meu Pastor', artista: 'Claudio Bassés', tom: 'C', categoria: 'Entrada', tags: ['salmo 23'] },
  { titulo: 'Preziosa Graça', artista: 'David Sacer', tom: 'G', categoria: 'Oferta', tags: ['devocional'] },
  { titulo: 'Como Foi Grande', artista: 'Diante do Trono', tom: 'E', categoria: 'Oferta' },
  { titulo: 'Alma do Pai', artista: 'Tradicional', tom: 'D', categoria: 'Oferta' },
  { titulo: 'Senhor, eu te amo', artista: 'Missionário', tom: 'A', categoria: 'Oferta' },
];

console.log('\n=== 1. Normalizacao ===');
eq(S.normalizeText('Preziosa Graça!'), 'preziosa graca', 'tira acento e pontuacao');
eq(S.normalizeText('  Múltiplos   espaços  '), 'multiplos espacos', 'colapsa espacos');
eq(S.normalizeText('Ação-Legal 123'), 'acao legal 123', 'tira hifen e numeros ficam');
eq(S.normalizeText(''), '', 'texto vazio');
eq(S.palavras('O Senhor e o meu Pastor'), ['o', 'senhor', 'e', 'o', 'meu', 'pastor'], 'separa em palavras');

console.log('\n=== 2. Distancia de edicao ===');
eq(S.boundedEditDistance('pastor', 'pastor', 2), 0, 'igual da zero');
eq(S.boundedEditDistance('pastor', 'pastorx', 2), 1, 'uma insercao');
eq(S.boundedEditDistance('pastor', 'pastar', 2), 1, 'uma substituicao');
eq(S.boundedEditDistance('pastor', 'pstr', 2), 2, 'duas remocoes');
ok(S.boundedEditDistance('pastor', 'zzzzzzzz', 2) > 2, 'corta cedo quando passou do limite');
ok(S.boundedEditDistance('a', 'abcdefghij', 1) > 1, 'corta quando o comprimento ja e incompativel');

console.log('\n=== 3. Busca exata, prefixo e campo ===');
eq(achou(BASE, 'Pastor'), ['O Senhor e o meu Pastor'], 'acha por titulo exato');
eq(achou(BASE, 'pastor'), ['O Senhor e o meu Pastor'], 'acha por titulo exato, sem caixa');
ok(achou(BASE, 'Past').indexOf('O Senhor e o meu Pastor') >= 0, 'acha por prefixo');
eq(achou(BASE, 'preziosa'), ['Preziosa Graça'], 'ignora o acento que o usuario nao digitou');
eq(achou(BASE, 'bassés'), ['O Senhor e o meu Pastor'], 'acha por artista, com acento');
eq(achou(BASE, 'trono'), ['Como Foi Grande'], 'acha por artista, sem acento');
ok(achou(BASE, 'oferta').length === 4, 'acha por categoria');
ok(achou(BASE, 'salmo').length === 1, 'acha por tag');
eq(achou(BASE, 'quemsabe'), [], 'nao inventa resultado para o que nao existe');

console.log('\n=== 4. Tolerancia a erro de digitacao ===');
ok(achou(BASE, 'pastotr').indexOf('O Senhor e o meu Pastor') >= 0, 'acha com uma letra trocada');
ok(achou(BASE, 'pastor').length > 0, 'continua achando o correto');
ok(achou(BASE, 'pastr').indexOf('O Senhor e o meu Pastor') >= 0, 'acha com letra faltando');
ok(achou(BASE, 'pastorr').indexOf('O Senhor e o meu Pastor') >= 0, 'acha com letra sobrando');
ok(achou(BASE, 'prezoisa').indexOf('Preziosa Graça') >= 0, 'acha com as duas letras trocadas de lugar');
ok(achou(BASE, 'senhr').indexOf('O Senhor e o meu Pastor') >= 0, 'acha com duas letras erradas');
ok(achou(BASE, 'sr').indexOf('O Senhor e o meu Pastor') >= 0, 'acha por subquencia (sr -> Senhor)');
ok(achou(BASE, 'pstr').indexOf('O Senhor e o meu Pastor') >= 0, 'acha por prefixo tolerante');
eq(achou(BASE, 'quemsabe'), [], 'nao inventa resultado para o que nao existe');

// Modo estrito: desliga a tolerancia. Um termo curto nao casa com palavra
// parecida, so com a palavra mesmo.
eq(S.buscar(BASE, 'pastr', { strict: true }).length, 0, 'modo estrito barra o erro de digitacao');
ok(S.buscar(BASE, 'pastr').length === 1, 'sem modo estrito, o mesmo termo acha');
ok(S.buscar(BASE, 's').length > 0, 'prefixo de uma letra acha palavra que comeca com ela');

console.log('\n=== 5. Semantica de conjuncao ===');
eq(achou(BASE, 'preziosa graça'), ['Preziosa Graça'], 'acha a musica que tem as duas palavras');
eq(achou(BASE, 'preziosa'), ['Preziosa Graça'], 'acha so a que tem a primeira');
eq(achou(BASE, 'pastor sacer'), [], 'nao devolve resultado parcial quando um termo nao casa');
eq(achou(BASE, 'sacer pastor'), [], 'a ordem dos termos nao muda o resultado');
ok(achou(BASE, 'trono diante').indexOf('Como Foi Grande') >= 0, 'busca em dois campos ao mesmo tempo');
// "grace" e "graca" diferem em uma letra, entao a tolerancia aceita. E o
// comportamento pedido: o dedo errou a ultima letra e o app achou assim mesmo.
ok(achou(BASE, 'preziosa grace').indexOf('Preziosa Graça') >= 0,
  'tolerancia a erro tambem vale entre os termos da consulta');

console.log('\n=== 6. Ordenacao ===');
const r = S.buscar(BASE, 'senhor');
ok(r.length >= 2, 'varias musicas casam com "senhor"');
ok(r[0].score >= r[r.length - 1].score, 'vem do mais relevante para o menos');
eq(S.buscar(BASE, 'senhor', { limit: 1 }).length, 1, 'respeita o limite');
const a1 = S.buscar(BASE, 'senhor').map(function (x) { return x.item.titulo; });
const a2 = S.buscar(BASE, 'senhor').map(function (x) { return x.item.titulo; });
eq(a1.join('|'), a2.join('|'), 'empate e resolvido de forma deterministica');

console.log('\n=== 7. Campo nome (musica dentro de uma escala) ===');
// No repertorio o campo e `titulo`; dentro de uma escala, e `nome`. A busca
// precisa funcionar nos dois, senao ela funciona numa tela e falha na outra.
const comNome = [{ nome: 'Alma do Pai', artista: 'Tradicional', tom: 'D' }];
ok(achou(comNome, 'alma').length === 1, 'acha pelo campo nome');
ok(achou(comNome, 'pastor').length === 0, 'nao inventa o que nao esta');
ok(achou(comNome, 'tradicional').length === 1, 'acha o titulo pelo campo nome');

console.log('\n=== 8. Casos de borda ===');
eq(S.buscar(BASE, '').length, 0, 'consulta vazia devolve vazio');
eq(S.buscar(BASE, '   ').length, 0, 'consulta so com espacos');
eq(S.buscar([], 'pastor').length, 0, 'lista vazia nao quebra');
ok(S.buscar(BASE, 'x'.repeat(300)).length === 0, 'texto muito longo nao estoura');
ok(achou(BASE, '  pastor  ').length === 1, 'espaco a mais no meio e nasas pontas');
ok(S.buscar([{ titulo: null }, { titulo: undefined }, {}], 'qualquer').length === 0, 'itens sem titulo nao quebram');
ok(S.buscar(BASE, 'pastor', { incluirLetra: false }).length === 1, 'incluirLetra:false funciona');

console.log('\n=== 9. A letra entra na busca ===');
const comLetra = [{ titulo: 'Misterio', letra: 'Nao foi o espinho que pungiu' }];
ok(achou(comLetra, 'espinho').length === 1, 'acha por palavra da letra');
ok(achou(comLetra, 'quenaoesta').length === 0, 'nao inventa palavra da letra');
eq(S.buscar(comLetra, 'espinho', { incluirLetra: false }).length, 0, 'incluirLetra:false tira a letra da busca');

console.log('\n=== 10. Desempenho ===');
const ITENS = 5000;
const grandes = [];
for (let i = 0; i < ITENS; i++) {
  grandes.push({
    titulo: 'Musica ' + i + ' ' + ['pastor', 'graça', 'senhor', 'aleluia', 'oferta'][i % 5],
    artista: 'Artista ' + (i % 400),
    tom: ['C', 'G', 'D', 'E', 'A'][i % 5],
    categoria: 'Categoria ' + (i % 12),
    tags: ['tag' + (i % 30)],
    letra: 'letra com muitas palavras para o indice nao ficar trivial ' + i,
  });
}
S.aquecerIndice(grandes); // aquece fora da medicao, como o app faz
const t0 = Date.now();
let Ultimo;
for (const q of ['pastor', 'pastr', 'pstr', 'sr', 'graca', 'senhr']) Ultimo = S.buscar(grandes, q, { limit: 20 });
const dt = Date.now() - t0;
console.log('        seis buscas em ' + ITENS + ' musicas: ' + dt + 'ms');
ok(dt < 1200, 'busca continua rapida com ' + ITENS + ' musicas (limite 1200ms)');
ok(Ultimo.length <= 20, 'o limite vale mesmo');

// O indice e construido uma vez. Editar a musica invalida.
const editavel = { titulo: 'Antes', tags: [] };
S.aquecerIndice([editavel]);
ok(S.buscarItens([editavel], 'antes').length === 1, 'indexa o titulo original');
editavel.titulo = 'Depois';
eq(S.buscarItens([editavel], 'antes').length, 0, 'reindexa quando o conteudo muda');
ok(S.buscarItens([editavel], 'depois').length === 1, 'acha o titulo novo');

console.log('\n=================================================');
console.log('  ' + pass + ' passaram, ' + fail + ' falharam');
console.log('=================================================\n');
process.exit(fail ? 1 : 0);
