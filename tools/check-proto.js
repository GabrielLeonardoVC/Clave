/* =========================================================
   ACORDE - tools/check-proto.js
   Nada de dado de fora entra por Object.assign.

   Existe por causa de uma falha real. A importacao de backup recebia o
   conteudo de um arquivo — entrada que nao e do codigo — e fazia:

       base.ajustes = Object.assign(base.ajustes, d.ajustes || {});

   Isso e polucao de prototipo. Um backup com

       { "ajustes": { "__proto__": { "tema": "escuro" } } }

   altera o prototipo do objeto de ajustes, e toda leitura de ajuste passa a
   resolver por ele — inclusive as que nao existem. O `__proto__` do JSON vem
   como propriedade propria (o `JSON.parse` cria com `DefineOwnProperty`), mas
   o `Object.assign` escreve com `Set`, e ai vira o setter de prototipo.

   Um backup pode vir de outro aparelho, de um grupo, de um e-mail. E a entrada
   nao confiavel de verdade deste app: nao ha servidor, nem formulario, nem
   parametro de URL. So a importacao.

   Tres verificacoes:

     1. as listas de campos bateM com o que `vazio()` declara. Se divergirem,
        um ajuste novo para de ser importado — e ninguem percebe, porque o
        app funciona;
     2. nenhuma linha chama `Object.assign` com algo que venha de fora;
     3. o construtor de elemento ignora `__proto__`, `constructor` e
        `prototype` nas chaves que recebe.

   A terceira e defesa em profundidade: `el()` e o construtor universal do app,
   e um `data-proto="x"` colado num atributo nao deveria virar prototipo de
   nada.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const NL = String.fromCharCode(10);

const store = fs.readFileSync(path.join(RAIZ, 'js', 'core', 'store.js'), 'utf8');
const utils = fs.readFileSync(path.join(RAIZ, 'js', 'core', 'utils.js'), 'utf8');

let problemas = 0;
function falhar(msg) {
  console.log('\n  FALHA  ' + msg);
  problemas++;
}

/* ------------------------------------------------------------
   1. As listas de campos batem com `vazio()`
   ------------------------------------------------------------ */
console.log('\n=== as listas de campos batem com o que o app declara? ===');

/** Os campos de um objeto literal dentro de `vazio()`. */
function camposDeVazio(nome) {
  const linhas = store.split(NL);
  const i = linhas.findIndex((l) => new RegExp('^\\s{6}' + nome + ':\\s*\\{').test(l));
  if (i < 0) return null;

  // Forma de uma linha so: `meta: { criadoEm: ..., atualizadoEm: ... },`
  const umaLinha = /^\s{6}\w+:\s*\{([^}]*)\},?\s*$/.exec(linhas[i]);
  if (umaLinha) {
    return [...umaLinha[1].matchAll(/([A-Za-z_][\w]*)\s*:/g)].map((m) => m[1]);
  }

  // Forma de varias linhas.
  const achados = [];
  for (let k = i + 1; k < linhas.length; k++) {
    if (/^\s{6}\},?\s*$/.test(linhas[k])) break;
    const m = /^\s{8}([A-Za-z_][\w]*)\s*:/.exec(linhas[k]);
    if (m) achados.push(m[1]);
  }
  return achados;
}

/** A lista declarada no codigo. */
function listaDeclarada(nome) {
  const m = new RegExp('const ' + nome + '\\s*=\\s*\\[([^\\]]*)\\]').exec(store);
  if (!m) return null;
  if (!m[1].trim()) return [];
  return [...m[1].matchAll(/'([A-Za-z_][\w]*)'/g)].map((x) => x[1]);
}

for (const [lista, objeto] of [['CAMPOS_AJUSTES', 'ajustes'], ['CAMPOS_META', 'meta']]) {
  const noVazio = camposDeVazio(objeto);
  const declarada = listaDeclarada(lista);

  if (noVazio === null) { falhar('nao achei `' + objeto + '` em vazio()'); continue; }
  if (declarada === null) { falhar('nao achei a lista ' + lista); continue; }

  const faltando = noVazio.filter((c) => declarada.indexOf(c) < 0);
  const sobrando = declarada.filter((c) => noVazio.indexOf(c) < 0);

  if (faltando.length) {
    falhar(lista + ' nao cobre ' + faltando.join(', ') +
      ' — ' + objeto + ' que o app declara mas a importacao nao copia');
  }
  if (sobrando.length) {
    falhar(lista + ' tem ' + sobrando.join(', ') +
      ', que ' + objeto + ' nao declara');
  }
  if (!faltando.length && !sobrando.length) {
    console.log('  ok    ' + lista.padEnd(16) + noVazio.length + ' campo(s) em sincronia');
  }
}

/* ------------------------------------------------------------
   2. Nenhum Object.assign com dado de fora
   ------------------------------------------------------------ */
console.log('\n=== dado de fora entra por Object.assign? ===');

const DADOS_DE_FORA = /(JSON\.parse|importar|d\.ajustes|d\.meta|raw|arquivo|file|dados|json)/i;
const achados = [];
store.split(NL).forEach((l, i) => {
  if (l.indexOf('Object.assign') < 0) return;
  // Comentario e explicacao, nao codigo.
  const trimmed = l.trim();
  if (trimmed.startsWith('*') || trimmed.startsWith('//')) return;
  achados.push({ linha: i + 1, texto: trimmed });
});

if (!achados.length) {
  console.log('  ok    nenhum Object.assign em store.js');
} else {
  for (const a of achados) {
    if (DADOS_DE_FORA.test(a.texto)) {
      falhar('store.js:' + a.linha + ' — Object.assign com dado de fora: ' + a.texto.slice(0, 70));
    } else {
      console.log('  ok    store.js:' + a.linha + ' interno, sem dado de fora');
    }
  }
}

/* ------------------------------------------------------------
   3. `el()` ignora as chaves que viram prototipo
   ------------------------------------------------------------ */
console.log('\n=== o construtor de elemento protege o prototipo? ===');

const CHAVES_PERIGOSAS = ['__proto__', 'constructor', 'prototype'];
const temCopia = /Object\.prototype\.hasOwnProperty\.call\(attrs,\s*k\)/.test(utils);

if (!temCopia) {
  falhar('el() nao filtra as chaves que chegam. Uma chave "__proto__" num ' +
    'atributo viraria prototipo do elemento.');
} else {
  const temBloqueio = CHAVES_PERIGOSAS.some((c) => utils.indexOf("'" + c + "'") >= 0);
  if (!temBloqueio) {
    falhar('el() filtra as proprias do objeto, mas nao bloqueia ' +
      CHAVES_PERIGOSAS.join(', '));
  } else {
    console.log('  ok    el() filtra as chaves que viram prototipo');
  }
}

/* ------------------------------------------------------------
   O resumo, e o que este app NAO tem
   ------------------------------------------------------------ */
console.log('\n=================================================');
console.log(problemas
  ? '  ' + problemas + ' problema(s)'
  : '  nenhum dado de fora entra por Object.assign');
console.log('=================================================');
console.log('');
console.log('  O que este app nao tem, e portanto nao se protege:');
console.log('    - servidor, rotas de API e chaves: nao ha nenhuma chamada de rede');
console.log('    - banco e SQL: os dados ficam em localStorage, no aparelho');
console.log('    - login e senha: nao existe, entao nao ha tentativa a limiting');
console.log('    - modelo de linguagem: nao ha, entao nao ha prompt injection');
console.log('    - dependencias: zero. Nao ha pacote para ser inventado');
console.log('');
console.log('  A unica entrada nao confiavel e a importacao de backup.');
console.log('=================================================\n');

process.exit(problemas ? 1 : 0);