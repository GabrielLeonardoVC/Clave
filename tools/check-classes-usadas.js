/* =========================================================
   ACORDE - tools/check-classes-usadas.js
   Toda classe usada no codigo existe na folha de estilo.

   Existe por causa de um defeito real e ja visto: no React, `btn-icon`,
   `btn-soft`, `btn-sm` e `tabs` eram usados no JSX e nunca foram
   definidos no index.css. O elemento aparecia sem o visual pedido, sem
   erro no console, sem aviso — so faltava a regra.

   Aqui a conta e o inverso do `check-css`: aquele le a folha e diz se o
   arquivo chega inteiro ao navegador; este le o codigo e diz se o que o
   codigo pede existe.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { arquivosDe, RAIZ } = require('./arquivos.js');

const CSS = arquivosDe(/\.css$/)
  .map((a) => fs.readFileSync(a, 'utf8'))
  .join('\n');

/* Remove comentarios: `btn-novo` dentro de um /* ... *\/ nao define nada. */
const cssLimpo = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/* Classes declaradas: seletor que comeca com `.` ou `.-` dentro de uma regra.
   Pega `.a`, `.a.b`, `:hover` -> ignora, `.a > .b` -> pega as duas. */
const definidas = new Set();
const reClasse = /\.(-?[_a-zA-Z][\w-]*)/g;
let m;
while ((m = reClasse.exec(cssLimpo)) !== null) {
  definidas.add(m[1]);
}

/* Classes usadas no codigo. Tres caminhos, porque o codigo escreve do
   tres jeitos: `el('div', { class: 'x' })`, `class="x"` e `classList.add('x')`. */
const usadas = new Map(); // classe -> Set("arquivo:linha")

function anotar(onde, classe) {
  if (!usadas.has(classe)) usadas.set(classe, new Set());
  usadas.get(classe).add(onde);
}

/* O proprio verificador nao entra: as expressoes regulares dele tem `.` e `-`
   que o.leitor de classes veria como nome de classe. */
const fontes = arquivosDe(/\.(js|html)$/)
  .filter((f) => path.basename(f) !== path.basename(__filename));

for (const arq of fontes) {
  const txt = fs.readFileSync(arq, 'utf8');
  const rel = path.relative(RAIZ, arq).replace(/\\/g, '/');

  const linhas = txt.split('\n');
  linhas.forEach((linha, i) => {
    const onde = rel + ':' + (i + 1);

    /* class="a b" e class='a b' */
    const reAtributo = /\bclass\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a;
    while ((a = reAtributo.exec(linha)) !== null) {
      const valor = (a[2] !== undefined ? a[2] : a[3]).trim();
      for (const c of valor.split(/\s+/)) {
        if (c) anotar(onde, c);
      }
    }

    /* class: 'a b' (chave do construtor `el`) e template ``class: `a b` `` */
    const reChave = /\bclass\s*:\s*("([^"]*)"|'([^']*)'|`([^`]*)`)/g;
    let b;
    while ((b = reChave.exec(linha)) !== null) {
      const valor = b[2] !== undefined ? b[2] : b[3] !== undefined ? b[3] : b[4];
      /* Concatenacao dentro do valor: `'cs-linha cs-' + tipoClasse(...)`.
         O que vem antes do `+` e um nome de classe inteiro; o que vem depois
         e um prefixo que o codigo completa em tempo de execucao. */
      const partes = valor.split('+');
      for (const pedaco of partes[0].split(/\s+/)) {
        const limpo = pedaco.replace(/[^\w-]/g, '');
        if (limpo && !/^\d/.test(limpo)) anotar(onde, limpo);
      }
      /* Prefixos montados em tempo de execucao: `'t-' + e.tipo`, `'cs-' + ...`.
         O nome vem dos dados, entao so da para conferir que existe ALGUMA
         regra com o prefixo. E o que a lista de prefixos abaixo faz. */
      for (const pedaco of partes.slice(1)) {
        const limpo = pedaco.replace(/[^\w-]/g, '');
        /* So o pedaco antes do `(`: `tipoClasse(x)` nao e prefixo. */
        const soPrefixo = limpo.split('(')[0];
        if (/^[\w-]+$/.test(soPrefixo) && soPrefixo.endsWith('-')) {
          anotar(onde, soPrefixo);
        }
      }
    }

    /* classList.add('a') / .toggle('a') / .remove('a') / .contains('a') */
    const reLista = /classList\s*\.\s*(add|toggle|remove|contains)\s*\(\s*'([^']*)'\s*\)/g;
    let c;
    while ((c = reLista.exec(linha)) !== null) {
      for (const pedaco of c[2].split(/\s+/)) if (pedaco) anotar(onde, pedaco);
    }

    /* toggleAttribute nao usa classe. */
  });
}

/* Classes que o codigo monta em tempo de execucao a partir de um nome que
   vive nos dados, e nao no codigo:
     'accent-' + acento   — as 24 rimas de cor vem de `base.js`;
     't-' + e.tipo        — 'missa', 'ensaio', 'show', 'outro' vem do evento;
     'cs-' + tipoClasse() — 'acorde', 'secao', 'respiro', 'letra' vem do motor.

   Estas sao conferidas por prefixo: existe alguma regra que comece com ele?
   Sem isso o verificador acusaria as 24 rimas de acento e os quatro tipos de
   evento como faltando, e ele passaria a ser um verificador que a gente ignora
   — que e o mesmo defeito que o `test-identidade` existe para provar que nao
   acontece. */
function temAlgumaComPrefixo(prefixo) {
  for (const d of definidas) if (d.startsWith(prefixo) && d !== prefixo) return true;
  return false;
}

const naoDefinidas = [];
for (const [classe, onde] of usadas) {
  if (definidas.has(classe)) continue;
  if (classe.endsWith('-')) {
    if (temAlgumaComPrefixo(classe)) continue;
    naoDefinidas.push({ classe: classe + '<algo>', onde: Array.from(onde).slice(0, 4) });
    continue;
  }
  naoDefinidas.push({ classe, onde: Array.from(onde).slice(0, 4) });
}

naoDefinidas.sort((a, b) => a.classe.localeCompare(b.classe, 'pt-BR'));

console.log('\n=== a classe que o codigo pede existe na folha? ===');
console.log('  ' + definidas.size + ' classe(s) declarada(s) na folha');
console.log('  ' + usadas.size + ' classe(s) usada(s) no codigo');

if (!naoDefinidas.length) {
  console.log('  ok    todas as classes usadas tem regra');
} else {
  for (const n of naoDefinidas) {
    console.log('  FALHA ' + n.classe + '  usada em ' + n.onde.join(', '));
  }
}

console.log('');
console.log('=================================================');
console.log(naoDefinidas.length
  ? naoDefinidas.length + ' classe(s) usada(s) sem regra.'
  : 'ok: nada usado no codigo esta sem estilo.');
process.exit(naoDefinidas.length ? 1 : 0);