/* =========================================================
   ACORDE - tools/check-sw.js
   O service worker guarda no cache o que a pagina realmente carrega.

   Existe por causa de um defeito real e ja happenedo: a lista de recursos do
   `sw.js` era escrita a mao e ficou desatualizada por varios commits. Faltavam
   `identidade.js`, `search.js`, `tuner.js`, `audio.js`, `gravador.js`,
   `cancao.js`, `afinador.js` e `emergencia.js`.

   O app abria offline — a tela aparecia, o logo aparecia — e so quebrava
   depois, ao tocar em buscar, no afinador ou na emergencia. O sintoma e o pior
   possivel para quem usa: o app parece funcionar e falha na hora em que a
   rede e o que falta.

   O `check-css` ja faz a mesma coisa pelo outro lado: confere que a folha chega
   inteira ao navegador. Este confere que o cache chega inteiro.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { RAIZ } = require('./arquivos.js');

const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');

/* O que o navegador vai buscar: as folhas de estilo e os scripts da pagina.
   O `defer` e o `type` nao importam — tanto faz como a pagina carrega, o
   arquivo e o mesmo. */
const carregados = new Set();
const reRecurso = /(?:href|src)\s*=\s*"(?!https?:|data:|\/\/|#)([^"]+)"/g;
let m;
while ((m = reRecurso.exec(HTML)) !== null) {
  const alvo = m[1].trim();
  // Fontes externas ficam de fora; o cache so guarda o que e do app.
  if (/\.(css|js|svg|png|webmanifest)$/.test(alvo)) carregados.add('./' + alvo.replace(/^\.\//, ''));
}

/* O que o service worker promete guardar. A lista esta entre colchetes, no
   primeiro bloco do arquivo. */
const lista = SW.slice(SW.indexOf('RECURSOS'), SW.indexOf('];', SW.indexOf('RECURSOS')));
const noCache = new Set();
const reCache = /'(\.\/[^']+)'/g;
let c;
while ((c = reCache.exec(lista)) !== null) noCache.add(c[1]);

/* ------------------------------------------------------------
   As tres perguntas
   ------------------------------------------------------------ */
const faltando = [];
for (const r of Array.from(carregados).sort()) {
  // A raiz ('./') e o proprio index ficam sempre; sao o mesmo arquivo.
  if (r === './index.html') continue;
  if (!noCache.has(r)) faltando.push(r);
}

const sobrando = [];
for (const r of Array.from(noCache).sort()) {
  if (r === './' || r === './index.html') continue;
  if (!carregados.has(r)) sobrando.push(r);
}

console.log('\n=== o offline guarda o que a pagina carrega? ===');
console.log('  ' + carregados.size + ' arquivo(s) carregado(s) pela pagina');
console.log('  ' + noCache.size + ' recurso(s) na lista do cache');

if (!faltando.length) {
  console.log('  ok    tudo o que a pagina carrega esta no cache');
} else {
  for (const f of faltando) {
    console.log('  FALHA ' + f + ' e carregado pela pagina e NAO esta no cache');
  }
  console.log('');
  console.log('        Sem rede, tocar no que usa este arquivo falha — e o app');
  console.log('        parece funcionar ate esse momento.');
}

/* Sobra e um aviso, nao um erro: dar entrada na raiz ou em um arquivo que so o
   service worker usa pode ser de proposito. */
if (sobrando.length) {
  console.log('  aviso ' + sobrando.length + ' recurso(s) no cache que a pagina nao carrega:');
  for (const s of sobrando) console.log('        ' + s);
}

console.log('');
console.log('=================================================');
console.log(faltando.length
  ? faltando.length + ' arquivo(s) carregado(s) e nao cacheado(s).'
  : 'ok: o offline cobre tudo o que a pagina carrega.');
process.exit(faltando.length ? 1 : 0);