/* =========================================================
   ACORDE - tools/check-globais.js
   Todo global lido no codigo existe em algum modulo.

   Existe por causa de um defeito real, e um dos mais caros de achar:
   `traste3d.js` chamava `global.Violao3d.criar(...)` com o d minusculo, e o
   modulo publicava `global.Violao3D` com o D maiusculo.

   Um nome global escrito duas vezes com uma letra diferente nao da erro de
   sintaxe. Nao ha aviso. O `try` pega um `undefined` e a tela cai no caminho
   alternativo com a mensagem "nao consegui abrir o 3D" - que e a mesma
   mensagem para quando o WebGL falhou, quando o aparelho nao tem 3D e quando o
   modulo simplesmente nao esta ali. Quatro causas, uma frase, e o developer
   caçando a causa errada.

   O `check-api` ve metodos de modulo, nao o nome do global. Este ve o global.

   O QUE ESTE NAO FAZ

   Nao valida nomes inventados: so compara com o que os modulos publicam. Um
   `global.naoExiste` ainda passa, porque nenhum modulo publica isso - e isso
   esta certo, porque parte do codigo depende de globais padrao do navegador.
   A lista de publicado vem de tras a frente: e a fonte da verdade.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { arquivosDe, RAIZ } = require('./arquivos.js');

/* ---- 1. os globais que os modulos publicam ---- */
const publicados = new Map();   // nome -> arquivo

const PADRAO_PUBLICA = /global(?:This)?\s*\.\s*([A-Za-z_$][\w$]*)\s*=/g;

for (const arq of arquivosDe(/\.js$/)) {
  const rel = path.relative(RAIZ, arq).replace(/\\/g, '/');
  if (rel.startsWith('tools/')) continue;      // as ferramentas nao vao para o app
  const txt = fs.readFileSync(arq, 'utf8');

  let m;
  while ((m = PADRAO_PUBLICA.exec(txt)) !== null) {
    publicados.set(m[1], rel);
  }
}

/* ---- 2. os globais que o codigo le ---- */
const lidos = new Map();   // nome -> "arquivo:linha"

const PADRAO_LE = /(?:global|window|globalThis)\s*\.\s*([A-Za-z_$][\w$]*)/g;

// Globais que o navegador garante e que nenhum modulo publica. A lista e
// curta de proposito: cada item aqui e uma excecao que deixa de ser conferida,
// e item demais transforma o verificador em enfeite.
const DO_NAVEGADOR = new Set([
  'document', 'window', 'navigator', 'location', 'history', 'localStorage',
  'sessionStorage', 'console', 'performance', 'fetch', 'caches', 'crypto',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
  'getComputedStyle', 'matchMedia', 'scrollTo', 'scrollBy', 'print',
  'open', 'close', 'alert', 'confirm', 'prompt',
  'addEventListener', 'removeEventListener', 'dispatchEvent', 'focus', 'blur',
  'innerWidth', 'innerHeight', 'devicePixelRatio', 'screen', 'isSecureContext',
  'URL', 'Blob', 'File', 'FileReader', 'Image', 'Audio', 'AudioContext',
  'webkitAudioContext', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent',
  'TouchEvent', 'PointerEvent', 'DataTransfer', 'IntersectionObserver',
  'ResizeObserver', 'MutationObserver', 'MediaRecorder', 'IndexedDB',
  'TextEncoder', 'TextDecoder', 'Uint8Array', 'Float32Array', 'ArrayBuffer',
  'DataView', 'AbortController', 'Headers', 'Request', 'Response', 'FormData',
  'DOMParser', 'XMLHttpRequest', 'WebGLRenderingContext',
  'WebGL2RenderingContext', 'Intl', 'Date', 'Math', 'JSON', 'CSS',
]);

// Globais de biblioteca externa, carregada por CDN e fora deste repositorio.
// Nao entra em `DO_NAVEGADOR` porque nao e padrao do navegador: e uma excecao
// declarada, que some no dia em que a biblioteca sair.
const EXTERNOS = new Map([
  ['lucide', 'icones (CDN)'],
]);

// Linha de comentario: nao executa, entao nao pode falhar nada.
function ehComentario(linha) {
  const t = linha.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('*/');
}

for (const arq of arquivosDe(/\.js$/)) {
  const rel = path.relative(RAIZ, arq).replace(/\\/g, '/');
  if (rel.startsWith('tools/')) continue;
  const linhas = fs.readFileSync(arq, 'utf8').split('\n');

  linhas.forEach(function (linha, i) {
    // Sem comentario, `nao global. Um registro` casaria como `global.Um` e
    // acusaria um nome que ninguem escreveu em codigo.
    if (ehComentario(linha)) return;
    PADRAO_LE.lastIndex = 0;
    let m;
    while ((m = PADRAO_LE.exec(linha)) !== null) {
      const nome = m[1];
      if (DO_NAVEGADOR.has(nome)) continue;
      if (!lidos.has(nome)) lidos.set(nome, rel + ':' + (i + 1));
    }
  });
}

/* ---- 3. a conferencia ---- */
console.log('\n=== todo global lido existe em algum modulo? ===');
console.log('  ' + publicados.size + ' global(is) publicado(s) pelos modulos');
console.log('  ' + lidos.size + ' global(is) lido(s) pelo codigo');

const desconhecidos = [];
for (const [nome, onde] of lidos) {
  if (publicados.has(nome)) continue;
  if (EXTERNOS.has(nome)) continue;
  desconhecidos.push({ nome, onde });
}
desconhecidos.sort(function (a, b) { return a.nome.localeCompare(b.nome); });

if (!desconhecidos.length) {
  console.log('  ok    todo global lido e publicado por algum modulo');
} else {
  for (const d of desconhecidos) {
    console.log('  FALHA ' + d.nome + ' em ' + d.onde + ' - nenhum modulo publica esse nome');
  }
  console.log('');
  console.log('        Nome global escrito diferente do que existe nao da erro:');
  console.log('        o try pega um undefined e a tela cai no caminho de reserva');
  console.log('        com uma mensagem que aponta para a causa errada.');
}

console.log('');
console.log('  publicados: ' + Array.from(publicados.keys()).sort().join(', '));
if (EXTERNOS.size) {
  console.log('  externos (CDN, fora do repositorio): ' +
    Array.from(EXTERNOS.keys()).sort().join(', '));
}

console.log('');
console.log('=================================================');
console.log(desconhecidos.length
  ? desconhecidos.length + ' global(is) lido(s) e nao publicado(s).'
  : 'ok: todo global lido existe.');
process.exit(desconhecidos.length ? 1 : 0);
