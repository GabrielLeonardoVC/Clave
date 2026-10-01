/* Testes do estado de estudo da cifra.
   Rodar:  node tools/test-estudo.js

   O campo `estudo` foi adicionado depois que a app ja existia. Isso significa
   que ele chega de tres formas diferentes: ausente (toda cifra antiga), lista
   (a primeira versao) e objeto (o formato de hoje). Um campo novo que derruba
   a leitura da cifra inteira seria muito mais caro do que o recurso que ele
   entrega.                                                      */
// O store le `Utils` no topo do arquivo, entao ele precisa estar carregado
// antes — caso contrario `U.uid` seria undefined na hora de gerar um id.
require('../js/core/utils.js');
const S = require('../js/core/store.js');

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const good = actual === expected;
  good ? pass++ : fail++;
  console.log((good ? '  ok   ' : '  FALHA') + '  ' + label +
    (good ? '' : '  -> obtido ' + JSON.stringify(actual) + ', esperado ' + JSON.stringify(expected)));
}
function ok(cond, label) { eq(!!cond, true, label); }
function deep(actual, expected, label) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  const good = a === b;
  good ? pass++ : fail++;
  console.log((good ? '  ok   ' : '  FALHA') + '  ' + label +
    (good ? '' : '  -> obtido ' + a + ', esperado ' + b));
}

console.log('\n=== 1. Cifra sem estudo (todas as antigas) ===');
const semEstudo = S.normCifra({ titulo: 'Antiga', cifra: 'C  G' });
deep(semEstudo.estudo, { ocultos: [], soAcordes: false, velocidade: 1 },
  'cifra sem o campo recebe o estado padrao');
eq(S.normCifra(null).estudo.ocultos.length, 0, 'cifra nula tambem');
eq(S.normCifra(undefined).estudo.velocidade, 1, 'cifra indefinida tambem');
// A expectativa tem o acento: o app escreve "Sem título" na tela, e um teste
  // que espera a forma sem acento so continuaria passando enquanto a tela
  // estivesse errada.
  eq(S.normCifra({}).titulo, 'Sem título', 'o resto da cifra continua normal');

console.log('\n=== 2. Estado bem formado ===');
deep(S.normEstudo({ ocultos: [0, 2, 5], soAcordes: true, velocidade: 1.5 }),
  { ocultos: [0, 2, 5], soAcordes: true, velocidade: 1.5 },
  'os tres campos passam como vieram');
eq(S.normEstudo({ velocidade: 1 }).velocidade, 1, 'velocidade neutra');
eq(S.normEstudo({ velocidade: 0.5 }).velocidade, 0.5, 'no limite de baixo');
eq(S.normEstudo({ velocidade: 3 }).velocidade, 3, 'no limite de cima');

console.log('\n=== 3. O formato antigo, que era so uma lista ===');
// A primeira versao gravava `estudo` como array de indices.
deep(S.normEstudo([1, 3]), { ocultos: [1, 3], soAcordes: false, velocidade: 1 },
  'array vira o estado completo, com o resto no padrao');
const veioAntigo = S.normCifra({ titulo: 'Velha', estudo: [2] });
deep(veioAntigo.estudo.ocultos, [2], 'e a cifra antiga carrega os trechos escondidos');

console.log('\n=== 4. Dado sujo nao derruba a leitura ===');
// Isto e o ponto principal: um campo corrompido pode custar o estado de
// estudo, nunca o acesso a musica.
eq(S.normEstudo(null).ocultos.length, 0, 'null');
eq(S.normEstudo(undefined).ocultos.length, 0, 'undefined');
eq(S.normEstudo('texto').ocultos.length, 0, 'texto solto');
eq(S.normEstudo(42).ocultos.length, 0, 'numero');
eq(S.normEstudo(true).ocultos.length, 0, 'booleano');
eq(S.normEstudo([]).ocultos.length, 0, 'array vazio');
ok(S.normCifra({ titulo: 'X', cifra: 'Am F G', estudo: 'lixo' }).cifra === 'Am F G',
  'a cifra continua legivel mesmo com o estudo corrompido');
ok(S.normCifra({ titulo: 'Y', cifra: 'C', estudo: 999 }).titulo === 'Y',
  'e o titulo tambem');

console.log('\n=== 5. Indice de trecho invalido ===');
// Um indice de trecho que nao existe mais (a cifra foi reescrita e perdeu um
// verso) nao pode virar indice negativo nem NaN na interface.
deep(S.normEstudo({ ocultos: [0, -1, 2.5, 'a', null, NaN, 7] }).ocultos, [0, 7],
  'so os inteiros dentro da faixa sobrevivem');
deep(S.normEstudo({ ocultos: 'nao-e-array' }).ocultos, [], 'ocultos que nao sao array caem no padrao');
deep(S.normEstudo({ ocultos: {} }).ocultos, [], 'objeto no lugar do array tambem');
// O limite de 200 existe para conter um valor corrompido, nao para rejeitar
// uma cifra grande. E o painel ja descarta o que nao existe: ele so aceita
// indices abaixo do numero de trechos que a cifra realmente tem.
deep(S.normEstudo({ ocultos: [199] }).ocultos, [199], '199 ainda passa: cabe numa cifra enorme');
deep(S.normEstudo({ ocultos: [200] }).ocultos, [], '200 ja e absurdo e e descartado');
deep(S.normEstudo({ ocultos: [1e9] }).ocultos, [], 'indice Gigante e descartado');

console.log('\n=== 6. soAcordes so aceita verdadeiro de verdade ===');
// "false" e uma string truthy. Se passasse, toda cifra antiga entraria no
// modo de estudo sem ninguem pedir.
eq(S.normEstudo({ soAcordes: true }).soAcordes, true, 'true liga');
eq(S.normEstudo({ soAcordes: false }).soAcordes, false, 'false desliga');
eq(S.normEstudo({ soAcordes: 'true' }).soAcordes, false, 'a string "true" NAO liga');
eq(S.normEstudo({ soAcordes: 1 }).soAcordes, false, 'o numero 1 NAO liga');
eq(S.normEstudo({}).soAcordes, false, 'ausente desliga');

console.log('\n=== 7. Velocidade fora da faixa do controle ===');
// O controle vai de 0,5 a 3. Um valor gravado fora disso nao pode ser
// devolvido: 0,1 vira um pisca e 50 salta a cifra inteira.
eq(S.normEstudo({ velocidade: 0.1 }).velocidade, 1, 'abaixo do minimo volta ao padrao');
eq(S.normEstudo({ velocidade: 0 }).velocidade, 1, 'zero volta ao padrao');
eq(S.normEstudo({ velocidade: -2 }).velocidade, 1, 'negativo volta ao padrao');
eq(S.normEstudo({ velocidade: 4 }).velocidade, 1, 'acima do maximo volta ao padrao');
eq(S.normEstudo({ velocidade: 100 }).velocidade, 1, 'absurdo volta ao padrao');
eq(S.normEstudo({ velocidade: NaN }).velocidade, 1, 'NaN volta ao padrao');
eq(S.normEstudo({ velocidade: 'lixo' }).velocidade, 1, 'texto volta ao padrao');
eq(S.normEstudo({ velocidade: '1.75' }).velocidade, 1.75, 'texto numerico e aceito');
eq(S.normEstudo({ velocidade: 2.25 }).velocidade, 2.25, '2,25 passa');
eq(S.normEstudo({ velocidade: 0.75 }).velocidade, 0.75, '0,75 passa');
eq(S.normEstudo({ velocidade: 0.49 }).velocidade, 1, '0,49 ja e abaixo do controle');

console.log('\n=== 8. O estado nao suja o resto da cifra ===');
const c = S.normCifra({
  titulo: 'Teste', artista: 'X', tom: 'Am', bpm: 120, compasso: '4/4',
  categoria: 'Rock', tags: ['a', 'b'], letra: 'la', cifra: 'C  G',
  estudo: { ocultos: [1], soAcordes: true, velocidade: 2 },
});
eq(c.titulo, 'Teste', 'titulo');
eq(c.artista, 'X', 'artista');
eq(c.tom, 'Am', 'tom');
eq(c.bpm, 120, 'bpm');
eq(c.compasso, '4/4', 'compasso');
eq(c.categoria, 'Rock', 'categoria');
deep(c.tags, ['a', 'b'], 'tags');
eq(c.letra, 'la', 'letra');
eq(c.cifra, 'C  G', 'cifra');
ok(c.id, 'id gerado');
ok(c.criadoEm > 0, 'criadoEm');
deep(c.estudo.ocultos, [1], 'e o estudo');
eq(c.estudo.soAcordes, true, 'e o soAcordes');

console.log('\n=== 9. Ida e volta: gravar e reler ===');
// O que o app grava tem de sobreviver ao ciclo de salvar e carregar. E o que
// garante que fechar e abrir a cifra nao apaga o trabalho.
{
  const original = { ocultos: [0, 2], soAcordes: true, velocidade: 0.75 };
  const gravado = S.normCifra({ titulo: 'Ciclo', cifra: 'C  G', estudo: original });
  const json = JSON.stringify(gravado);
  const relido = S.normCifra(JSON.parse(json));
  deep(relido.estudo, original, 'o estado sobrevive a salvar e carregar');
}
{
  // Sem estudo, o ciclo tambem tem de dar o mesmo estado, e nao undefined.
  const gravado = S.normCifra({ titulo: 'Ciclo2', cifra: 'C  G' });
  const relido = S.normCifra(JSON.parse(JSON.stringify(gravado)));
  deep(relido.estudo, { ocultos: [], soAcordes: false, velocidade: 1 }, 'cifra sem estado relida limpa');
}

console.log('\n=== 10. O estado nunca e compartilhado entre cifras ===');
// Guardar por cifra e o ponto: o que voce decora em uma musica nao tem a ver
// com a outra. Duas cifras com o mesmo objeto de estado nao podem interferir.
{
  const a = S.normCifra({ titulo: 'A', cifra: 'C  G', estudo: { ocultos: [1] } });
  const b = S.normCifra({ titulo: 'B', cifra: 'D  A', estudo: { ocultos: [1] } });
  a.estudo.ocultos.push(9);
  deep(b.estudo.ocultos, [1], 'mudar uma cifra nao muda a outra');
}

console.log('\n=================================================');
console.log('  ' + pass + ' passaram, ' + fail + ' falharam');
console.log('=================================================\n');
process.exit(fail ? 1 : 0);