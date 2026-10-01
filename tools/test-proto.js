/* Prova que a poluição de prototipo esta fechada.

   Monta um backup com "__proto__" dentro dos ajustes e importa. O que nao pode
   acontecer: o tema do app mudar, um ajuste que nao existe virar legivel, ou o
   prototipo de qualquer objeto ficar contaminado.

   Sem este teste, a correcao e uma opiniao. Com ele, e um fato — e o teste roda
   em Node, sem navegador.

   Rodar: node tools/test-proto.js
*/
'use strict';

require('../js/core/utils.js');

// O store le do localStorage ao carregar. No Node ele nao existe, entao se
//injeta o minimo antes de requerer.
global.localStorage = {
  getItem: function () { return null; },
  setItem: function () {},
  removeItem: function () {},
};

const S = require('../js/core/store.js');

let pass = 0, fail = 0;
function eq(atual, esperado, rotulo) {
  const bom = atual === esperado;
  bom ? pass++ : fail++;
  console.log((bom ? '  ok    ' : '  FALHA ') + rotulo +
    (bom ? '' : '  -> obtido ' + JSON.stringify(atual) + ', esperado ' + JSON.stringify(esperado)));
}

/* Um backup com "__proto__" nos ajustes e no meta.
   O JSON e montado por `JSON.parse` de proposito: e assim que a chave entra no
   objeto — como propriedade PROPRIA, e nao como o prototipo herdado. E
   exatamente por isso que o `Object.assign` virava um problema: ele escreve com
   Set, e Set em "__proto__" e o setter de prototipo. */
const ajustes = JSON.parse('{"__proto__": {"tema": "ARBITRARIO", "hacker": true}, "densidade": "compact"}');
const meta = JSON.parse('{"__proto__": {"criadoEm": 0}}');
const backup = JSON.stringify({ cifras: [], escalas: [], ajustes: ajustes, meta: meta });

console.log('\n=== o backup traz a chave perigosa ===');
eq(Object.prototype.hasOwnProperty.call(ajustes, '__proto__'), true,
  'o ajuste malicioso tem "__proto__" como propriedade propria');
eq(ajustes.tema, undefined, 'e ler direto nao devolve o valor do prototipo');

console.log('\n=== importar nao contamina nada ===');
S.importar(backup, 'substituir');

eq(S.ajuste('tema'), 'auto', 'o tema continua "auto"');
eq(S.ajuste('hacker'), undefined, 'um ajuste que nao existe continua nao existindo');
eq(S.ajuste('densidade'), 'compact', 'mas o ajuste legitimo do backup foi importado');

eq({}.hacker, undefined, 'Object.prototype nao foi contaminado');
eq({}.tema, undefined, 'e nenhuma chave vazou para o prototipo global');

console.log('\n=== o prototipo do objeto de ajustes continua limpo ===');
// Ler uma chave que nao existe nao modifica nada — e a propriedade que importa.
// `ajuste('__proto__')` devolve o prototipo, como qualquer leitura de chave
// inexistente faria; o que nao pode acontecer e a leitura CONTAMINAR algo.
// Por isso o teste mede o efeito, e nao o valor devolvido.
const antesDaLeitura = JSON.stringify([S.ajuste('tema'), S.ajuste('densidade')]);
S.ajuste('__proto__');
S.ajuste('constructor');
S.ajuste('inexistente');
eq({}.hacker, undefined, 'ler uma chave perigosa nao contamina o prototipo global');
eq(JSON.stringify([S.ajuste('tema'), S.ajuste('densidade')]), antesDaLeitura,
  'e nao mexe em nenhum ajuste ao longo do caminho');

console.log('\n=== backup incompleto nao apaga o padrao ===');
// A regressao que a primeira versao da correcao trouxe: ela escrevia
// `undefined` por cima de todo campo que o backup nao trouxesse, e o app
// ficava sem tema — sem erro, sem aviso.
S.importar(JSON.stringify({
  cifras: [], escalas: [],
  ajustes: JSON.parse('{"densidade": "roomy"}'),
  meta: {},
}), 'substituir');
eq(S.ajuste('tema'), 'auto', 'o tema que o backup nao traz continua "auto"');
eq(S.ajuste('notificacoes'), true, 'e a notificacao continua ligada');
eq(S.ajuste('densidade'), 'roomy', 'mas o campo que o backup traz foi importado');

console.log('\n=== e o app continua funcionando ===');
const antes = S.cifras().length;
eq(antes, 0, 'as cifras continuam vazias apos importar um backup vazio');
eq(S.escalas().length, 0, 'as escalas tambem');

console.log('\n=================================================');
console.log('  ' + pass + ' passaram, ' + fail + ' falharam');
console.log('=================================================\n');
process.exit(fail ? 1 : 0);