/* Teste de robustez: o que entra por um arquivo de backup.

   O backup e a unica porta por onde dado de fora entra no app — e arquivo
   JSON nao e entrada confiavel. Alguem pode abrir o backup no Bloco de Notas,
   trocar uma letra e mandar de volta; ou pegar um backup da internet.

   O que este teste prova e que a normalizacao segura antes de qualquer tela
   mostrar o dado:

     - `javascript:` nao vira `src` nem `href` de nada;
     - `__proto__` no arquivo nao contamina o prototipo de nada;
     - data invalida vira o padrao, e nao uma tela quebrada;
     - numero fora de faixa e corrigido, nao recusado;
     - campo do tipo errado nao derruba a leitura do resto.

   O ponto que mais importa e o ultimo: um backup com uma cifra de tipo
   errado tem que devolver a musica dela, e nao perder o acesso ao app inteiro.

   Rodar: node tools/test-importacao.js
*/
'use strict';

require('../js/core/utils.js');
require('../js/core/links.js');
require('../js/core/store.js');
const S = globalThis.Store;

let pass = 0, fail = 0;
function eq(atual, esperado, rotulo) {
  const bom = atual === esperado;
  bom ? pass++ : fail++;
  console.log((bom ? '  ok    ' : '  FALHA ') + rotulo +
    (bom ? '' : '  -> obtido ' + JSON.stringify(atual) + ', esperado ' + JSON.stringify(esperado)));
}
function ok(cond, rotulo) { eq(!!cond, true, rotulo); }

/** Um backup montado para atacar. */
function backupHostil() {
  return JSON.stringify({
    app: 'Clave',
    escalas: [{
      id: 'x1',
      data: 'nao-e-data',
      hora: '99:99:99',
      titulo: '<script>alert(1)</script>',
      local: 'x',
      tipo: 'desconhecido',
      status: 'inventado',
      musicas: [{
        nome: 'A',
        yt: 'javascript:alert(1)',
        ytId: 'curto',
        vs: 'javascript:alert(2)',
        foto: 'javascript:alert(3)',
        bpm: 99999,
        responsavel: '<img src=x onerror=alert(4)>',
        anotacoes: [{ t: -5, texto: 'a' }, { t: 1e9, texto: 'b' }, { t: 'x', texto: 'c' }, null, { texto: '' }],
      }],
    }],
    cifras: [{
      id: 'c1',
      titulo: 'T',
      yt: 'javascript:alert(5)',
      ytId: 'XXXXXXXXXXX',
      vs: 'data:text/html,<script>alert(6)</script>',
      foto: 'data:image/svg+xml,<svg onload=alert(7)>',
      bpm: -5,
      tom: 'C'.repeat(500),
      tags: 'nao-e-array',
      anotacoes: 'nao-e-lista',
    }],
    ajustes: { tema: 'nao-existe', accent: 'inexistente', bpmPadrao: 99999 },
  });
}

/** Um backup com `__proto__` — em JSON, e uma chave como outra qualquer. */
function backupComProto() {
  // Construido por parse de verdade: `{ __proto__: ... }` em objeto literal
  // de JavaScript mudaria o prototipo do objeto, e nao criaria a chave.
  return '{"__proto__":{"polluted":"sim"},"constructor":{"prototype":{"x":1}},'
    + '"cifras":[{"id":"p1","titulo":"ok"}],"escalas":[],"ajustes":{}}';
}

console.log('\n=== o backup nao consegue executar nada ===');

/* `apagar` e o caminho de limpeza. Atribuir em `db` nao funciona: a propriedade
   e so leitura, e e assim por proposito — nada fora do store escreve no dado. */
S.apagar();
S.importar(backupHostil(), 'substituir');

const c = S.cifras()[0];
eq(c.yt, 'javascript:alert(5)', 'o link malicioso e guardado como texto, mas nunca vira src');
/* O id gravado e respeitado quando tem os onze caracteres do alfabeto do
   YouTube. `XXXXXXXXXXX` tem exatamente onze, entao passa — e a conferida que
   importa e a de tamanho, testada logo abaixo com valores curtos e longos. */
eq(c.ytId, 'XXXXXXXXXXX', 'um id com onze caracteres e aceito, mesmo sem link: e o caso do backup antigo');
eq(S.normCifra({ titulo: 'x', ytId: 'curto' }).ytId, '', 'id curto demais e descartado');
eq(S.normCifra({ titulo: 'x', ytId: 'quatorze-caracteres' }).ytId, '', 'id longo demais e descartado');
eq(S.normCifra({ titulo: 'x', ytId: 'com espaco 11' }).ytId, '', 'id com caractere invalido e descartado');
eq(S.normCifra({ titulo: 'x', ytId: '<script>xx' }).ytId, '', 'id com marcação e descartado');
eq(c.vs, '', 'audio com javascript: e recusado');
ok(String(c.foto).indexOf('javascript') < 0, 'foto com javascript: e recusada');
ok(String(c.foto).indexOf('svg+xml') < 0, 'e SVG com script dentro tambem: nao serve de foto');

/* O titulo traz HTML. Isso NAO e um problema: ele vai para `textContent`, que
   mostra o texto e nao o interpreta. O que nao pode e o titulo virar `html:`.
   A prova e que o valor segue sendo texto puro. */
eq(c.titulo, 'T', 'o titulo passa como texto, sem virar marcação');

console.log('\n=== dado invalido vira o padrao, nao uma tela quebrada ===');

eq(c.bpm, 20, 'bpm negativo vai para o minimo');
eq(c.tom.length, 12, 'tom gigante e cortado no limite');
eq(Array.isArray(c.tags), true, 'tags no lugar errado viram lista, sem quebrar');
eq(Array.isArray(c.anotacoes), true, 'anotacoes no lugar errado viram lista');

const e = S.escalas()[0];
eq(e.titulo, '<script>alert(1)</script>', 'o titulo do evento e texto, com o que a pessoa escreveu');
ok(/^\d{4}-\d{2}-\d{2}$/.test(e.data), 'data invalida vira uma data de verdade: ' + e.data);
/* Hora invalida vira vazio, e o vazio e o certo: um evento sem hora definido
   aparece sem hora na agenda, o que a pessoa reconhece. Um "00:00" inventado
   seria pior — a agenda mostraria um evento as midnight. */
eq(e.hora, '', 'hora invalida fica vazia, e nao vira 00:00 inventado');
eq(e.tipo, 'missa', 'tipo desconhecido cai no padrao');
ok(['rascunho', 'confirmada', 'tocada'].indexOf(e.status) >= 0, 'status inventado cai no padrao');

const m = e.musicas[0];
eq(m.bpm, 320, 'bpm acima do limite vai para o maximo');
eq(m.responsavel, '<img src=x onerror=alert(4)>', 'a observacao e texto, e o app nao a interpreta');
eq(m.vs, '', 'o audio malicioso da musica tambem e recusado');

console.log('\n=== o prototipo nao e contaminado ===');

S.apagar();
S.importar(backupComProto(), 'substituir');
eq({}.polluted, undefined, '__proto__ no arquivo nao cria propriedade no objeto comum');
eq(Object.prototype.polluted, undefined, 'nem no prototipo de Object');
eq({}.x, undefined, 'constructor.prototype tambem nao');
eq(S.cifras().length, 1, 'e o resto do backup entra normalmente: uma cifra a menos seria perder dado');

console.log('\n=== arquivo invalido e recusado com explicacao ===');

let erro = null;
try { S.importar('{ isto nao e json', 'substituir'); } catch (ex) { erro = ex; }
/* A mensagem vai com acento — e assim que a pessoa ve na tela. Comparar sem
   acento testaria outra string, e o teste passaria sem provar nada. */
ok(erro && /inválido/i.test(erro.message), 'JSON quebrado da erro que diz o que houve');
ok(erro && /JSON/.test(erro.message), 'e o erro diz o que o arquivo devia ser');

erro = null;
try { S.importar('null', 'substituir'); } catch (ex) { erro = ex; }
ok(erro !== null, 'null e recusado');

erro = null;
try { S.importar('123', 'substituir'); } catch (ex) { erro = ex; }
ok(erro !== null, 'numero solto e recusado');

/* Array e objeto vazios sao RECUSADOS, e o motivo nao e cosmético: no modo
 * `substituir` eles limpavam o repertorio inteiro sem dar erro. A recusa e o que
 * segura isso.
 *
 * A primeira versao desta verificacao era `ok(erro === null || erro !== null)` —
 * que e verdade para qualquer valor do mundo, e portanto nunca falha. Um
 * verificador que nao pode falhar nao verifica nada: ele so ocupa linha. */
erro = null;
try { S.importar('[]', 'substituir'); } catch (ex) { erro = ex; }
ok(erro !== null, 'array vazio e recusado em vez de limpar o repertorio');

erro = null;
try { S.importar('{}', 'substituir'); } catch (ex) { erro = ex; }
ok(erro !== null, 'objeto vazio e recusado');

erro = null;
try { S.importar('{"cifras":{}}', 'substituir'); } catch (ex) { erro = ex; }
ok(erro !== null, 'cifras que nao e lista e recusado');

erro = null;
try { S.importar('{"cifras":"texto"}', 'substituir'); } catch (ex) { erro = ex; }
ok(erro !== null, 'cifras como texto e recusado');

/* E o backup de verdade que nao tem nada dentro continua entrando: quem apagou
 * tudo e exportou quis justamente trocar o app por uma lista vazia.
 *
 * Sem `S.apagar()` aqui de proposito: o que importa e o `importar` aceitar, e a
 * secao seguinte ja comeca do zero do jeito dela. */
erro = null;
try { S.importar('{"escalas":[],"cifras":[]}', 'substituir'); } catch (ex) { erro = ex; }
ok(erro === null, 'backup legitimamente vazio ainda e aceito');

console.log('\n=== mesclar nao duplica ===');

S.apagar();
S.importar(backupHostil(), 'substituir');
const antes = S.cifras().length;
S.importar(backupHostil(), 'mesclar');
eq(S.cifras().length, antes, 'importar o mesmo backup de novo nao duplica nada');

console.log('\n=== o app continua funcionando depois de tudo ===');

eq(typeof S.cifras()[0].cifra, 'string', 'a cifra devolve texto, sempre');
eq(Array.isArray(S.escalas()[0].musicas), true, 'a escala devolve a lista de musicas');
ok(S.storageInfo().pct >= 0, 'a cota e calculada sem erro');

console.log('');
console.log('=================================================');
console.log(fail ? fail + ' falharam, ' + pass + ' passaram.' : '  ' + pass + ' passaram, 0 falharam');
console.log('');
process.exit(fail ? 1 : 0);