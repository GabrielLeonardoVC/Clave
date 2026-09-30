/* Confere se o app chama metodos que existem.
   Rodar:  node tools/check-api.js

   O Acorde e JavaScript puro, sem compilador. Um metodo renomeado na API e
   chamado pelo nome antigo na tela nao da erro de sintaxe, nao quebra o build e
   nao aparece em nenhum teste: so quebra quando a pessoa toca, e Often-times
   dentro de um setTimeout, muito depois do app ter aberto.

   Ja aconteceu. `notify.js` chamava `Store.allEscalas()` e
   `Store.cmpEscala()`, e nenhum dos dois nomes existia — a API exporta
   `escalas` e `cmp`. O aviso de missa simplesmente nunca aparecia, e o unico
   sinal era um TypeError no console 2,4 s depois de abrir o app.

   Este e o substituto do compilador: le a API real de cada modulo, resolve os
   apelidos que cada arquivo cria e avisa quando algum acesso nao existe.
   --------------------------------------------------------- */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { arquivosDe, RAIZ } = require('./arquivos.js');

/** Ordem de carga: cada modulo usa os que vieram antes. */
const MODULOS = [
  { arquivo: 'js/core/music.js', global: 'Music' },
  { arquivo: 'js/core/utils.js', global: 'Utils' },
  { arquivo: 'js/core/store.js', global: 'Store' },
  { arquivo: 'js/core/ui.js', global: 'UI' },
  { arquivo: 'js/core/render.js', global: 'Render' },
  { arquivo: 'js/core/print.js', global: 'Print' },
  { arquivo: 'js/core/links.js', global: 'Links' },
  { arquivo: 'js/core/search.js', global: 'Search' },
  { arquivo: 'js/core/metronome.js', global: 'Metro' },
  { arquivo: 'js/core/studio.js', global: 'Studio' },
  { arquivo: 'js/core/notify.js', global: 'Notify' },
  { arquivo: 'js/core/share.js', global: 'Share' },
];

/** Propriedades que vem do proprio JavaScript, e nao da API do modulo. */
const DO_JS = new Set([
  'length', 'name', 'call', 'apply', 'bind', 'prototype', 'constructor',
  'toString', 'valueOf', 'hasOwnProperty',
]);

/** Carrega cada modulo e anota o que ele de fato exporta. */
function carregar() {
  const api = new Map();
  const erros = [];

  for (const mod of MODULOS) {
    const alvo = path.join(RAIZ, mod.arquivo);
    if (!fs.existsSync(alvo)) {
      erros.push(mod.arquivo + ': arquivo nao encontrado');
      continue;
    }
    try {
      delete require.cache[require.resolve(alvo)];
      require(alvo);
    } catch (e) {
      erros.push(mod.arquivo + ': ' + e.message);
      continue;
    }
    const g = globalThis[mod.global];
    if (!g || typeof g !== 'object') {
      erros.push(mod.arquivo + ': nao publica ' + mod.global);
      continue;
    }
    api.set(mod.global, new Set(Object.keys(g)));
  }
  return { api, erros };
}

/**
 * Descobre os apelidos: `const M = global.Music;` torna `M.parseChord` um
 * acesso a API de Music. Sem resolver isso, todo apelido pareceria um global
 * desconhecido.
 */
function apelidos(texto) {
  const mapa = new Map();
  const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*global(?:This)?\.([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    mapa.set(m[1], m[2]);
    mapa.set(m[2], m[2]);
  }
  return mapa;
}

const { api, erros } = carregar();

console.log('\n=== 1. Os modulos carregam e exportam ===');
MODULOS.forEach((mod) => {
  if (!api.has(mod.global)) return;
  console.log('  ok    ' + mod.global.padEnd(9) + api.get(mod.global).size + ' exportados');
});
erros.forEach((e) => console.log('  FALHA ' + e));

console.log('\n=== 2. Nenhum acesso a uma API inexistente ===');
const fontes = arquivosDe(/\.(js|html)$/).filter((f) => !f.includes('tools'));
let acessos = 0;
const ruins = [];

for (const arquivo of fontes) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  const mapa = apelidos(texto);
  if (mapa.size === 0) continue;

  // Varre "Apelido.metodo" e "Global.metodo".
  const re = /\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g;
  let m;
  const linhas = texto.split('\n');
  while ((m = re.exec(texto)) !== null) {
    const [, apelido, membro] = m;
    const destino = mapa.get(apelido);
    if (!destino) continue; // nao e um dos nossos modulos
    if (!api.has(destino)) continue;
    if (DO_JS.has(membro)) continue;

    acessos++;
    if (!api.get(destino).has(membro)) {
      const linha = texto.slice(0, m.index).split('\n').length;
      const trecho = (linhas[linha - 1] || '').trim().slice(0, 76);
      ruins.push(arquivo.replace(RAIZ + path.sep, '') + ':' + linha +
        '  ' + apelido + '.' + membro + ' nao existe em ' + destino +
        '  ->  ' + trecho);
    }
  }
}

console.log('  ' + acessos + ' acessos conferidos em ' + fontes.length + ' arquivos');
if (ruins.length === 0) {
  console.log('  ok    todo acesso aponta para uma API que existe');
} else {
  console.log('  ' + ruins.length + ' acesso(s) quebrado(s):');
  ruins.forEach((r) => console.log('        ' + r));
}

console.log('\n=================================================');
const total = erros.length + ruins.length;
console.log('  ' + (total === 0 ? 'nenhuma quebra de API' : total + ' problema(s)'));
console.log('=================================================\n');
process.exit(total ? 1 : 0);
