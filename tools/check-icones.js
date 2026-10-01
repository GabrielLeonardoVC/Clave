/* =========================================================
   ACORDE - tools/check-icones.js
   O icone existe de verdade, nos tamanhos que a loja exige.

   Rodar:  node tools/check-icones.js

   ---------------------------------------------------------
   POR QUE ISTO EXISTE

   O manifesto declarava `assets/icon-512.svg` com `sizes: "512x512"`, e o
   `index.html` apontava `apple-touch-icon` para o mesmo arquivo. As duas coisas
   estavam erradas, e as duas em silencio:

     - SVG NAO TEM PIXEL. Um `sizes: "512x512"` num SVG e uma mentira. A Play
       Store recusa; o instalador do Android ignora.

     - iOS NAO ACEITA SVG EM `apple-touch-icon`. O Safari descarta a tag e
       desenha na tela de inicio um PRINT DA PAGINA — a tela branca com a barra
       de ferramentas. O pior icone possivel, e o app inteiro parecendo quebrado.

   O app instalava, abria, funcionava. O icone estava errado. E e o pior tipo de
   defeito: so aparece na casa da pessoa, no aparelho dela, so depois de
   instalar, e ninguem testando no navegador vai ver.

   ---------------------------------------------------------
   O QUE ESTE VERIFICADOR FAZ, E O QUE NAO FAZ

   Ele LE o arquivo. Confere que existe, que a dimensao bate com o que o
   manifesto promete, e que nao e um retangulo chapado.

   Ele nao GOSTA do desenho. Julgar se o simbolo esta bonito, se o contraste do
   gradiente funciona, se o icone se distingue em tela pequena — isso e olho
   humano. O `fazer-icones.js` desenha; este arquivo so diz se o desenho chegou.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

let problemas = 0;

function conferir(cumpre, rotulo, detalhe) {
  if (cumpre) {
    console.log('  ok    ' + rotulo);
  } else {
    problemas++;
    console.log('  FALHA  ' + rotulo + (detalhe ? '  ->  ' + detalhe : ''));
  }
}

console.log('\n=== o icone existe de verdade ===');

/* ---------------------------------------------------------
   1. As dimensoes declaradas.
   --------------------------------------------------------- */

function dimensoes(png) {
  const b = fs.readFileSync(png);
  /* A assinatura do PNG tem 8 bytes; o tipo de bloco IHDR ocupa os 4
   * seguintes, e a largura e a altura sao os 4 primeiros do IHDR. */
  const assinatura = b.readUInt32BE(0) === 0x89504e47;
  if (!assinatura || b.length < 26) return null;
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20), tipoCor: b[25] };
}

const mPath = path.join(RAIZ, 'manifest.webmanifest');
if (!fs.existsSync(mPath)) {
  console.log('  FALHA  nao achei manifest.webmanifest');
  process.exit(1);
}
const manifesto = JSON.parse(fs.readFileSync(mPath, 'utf8'));
const icones = manifesto.icons || [];

conferir(icones.length > 0, 'o manifesto declara icones', 'nenhum');

for (const ic of icones) {
  const p = path.join(RAIZ, ic.src);
  if (!fs.existsSync(p)) {
    conferir(false, 'o icone declarado existe: ' + ic.src, 'nao esta no disco');
    continue;
  }
  const ehSvg = /\.svg$/i.test(ic.src);

  if (ehSvg) {
    /* Um SVG com `sizes` numerico e uma promessa que o arquivo nao pode
     * cumprir. `sizes: "any"` e honesto; `sizes: "512x512"` num SVG nao e. */
    conferir(ic.sizes === 'any' || !/^\d+x\d+$/.test(ic.sizes || ''),
      'o SVG declara size honesto: ' + ic.src,
      'disse sizes=' + ic.sizes + ' — um SVG nao tem pixels nessa medida');
    continue;
  }

  const d = dimensoes(p);
  if (!d) {
    conferir(false, 'o PNG e um PNG de verdade: ' + ic.src);
    continue;
  }
  const declarado = (ic.sizes || '').split('x').map(Number);
  conferir(d.largura === declarado[0] && d.altura === declarado[1],
    'o tamanho bate com o que o manifesto promete: ' + ic.src,
    'arquivo ' + d.largura + 'x' + d.altura + ', manifesto ' + ic.sizes);

  /* Um PNG 512x512 com menos de 8 KB e um retangulo de cor so. Foi assim que o
   * primeiro icone maskavel saiu: o fundo de tela cheia foi pintado POR CIMA do
   * desenho, e o resultado — 1,8 KB — passou despercebido ate alguem conferir o
   * peso do arquivo. */
  const bytes = fs.statSync(p).size;
  conferir(d.largura < 512 || bytes > 8192,
    'o icone tem conteudo, e nao uma cor lisa: ' + ic.src,
    bytes / 1024 + ' KB em ' + d.largura + 'x' + d.altura + ' — retangulo chapado?');
}

/* ---------------------------------------------------------
   2. O que a loja exige e o manifesto nao tinha.
   --------------------------------------------------------- */

console.log('\n=== o que a loja e o aparelho exigem ===');

const temTamanho = (n) => (manifesto.icons || []).some((i) => (i.sizes || '').indexOf(n) >= 0);
const temProposito = (p) => (manifesto.icons || []).some((i) => (i.purpose || '').indexOf(p) >= 0);

conferir(temTamanho('192'), 'icone de 192 (exigido pela Play Store)');
conferir(temTamanho('512'), 'icone de 512');
conferir(temProposito('maskable'), 'icone maskable (Android 8+ recusa sem ele)');

/* ---------------------------------------------------------
   3. O iOS, que nao usa o manifesto.
   --------------------------------------------------------- */

console.log('\n=== o iOS, que nao le o manifesto ===');

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const apple = /<link[^>]+rel="apple-touch-icon"[^>]+href="([^"]+)"/.exec(html);

conferir(!!apple, 'o index.html declara apple-touch-icon');
if (apple) {
  const ehSvg = /\.svg$/i.test(apple[1]);
  conferir(!ehSvg,
    'o apple-touch-icon nao e SVG — o Safari ignora e desenha um print da pagina',
    'apontava para ' + apple[1]);
  conferir(fs.existsSync(path.join(RAIZ, apple[1])),
    'o apple-touch-icon existe no disco', apple[1]);
}

/* O `apple-touch-icon` do iOS e 180x180. O aparelho aceita o que vier, mas um
 * icone quadrado grande demais ou pequeno demais fica com a borda cortada na
 * tela de inicio — e o corte do iOS e fixo. */
if (apple && !/\.svg$/i.test(apple[1])) {
  const d = dimensoes(path.join(RAIZ, apple[1]));
  conferir(!!d && d.largura === 180 && d.altura === 180,
    'o apple-touch-icon tem 180x180, que e o que o iOS pede',
    d ? 'tem ' + d.largura + 'x' + d.altura : 'nao consegui ler');
}

/* ---------------------------------------------------------
   4. O offline precisa servir o icone tambem.
   --------------------------------------------------------- */

console.log('\n=== sem rede, o icone ainda aparece? ===');

const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
for (const ic of (manifesto.icons || [])) {
  const rel = './' + ic.src.replace(/^\.\//, '');
  conferir(sw.indexOf(rel) >= 0,
    'o offline guarda ' + ic.src,
    'sem rede, a tela de inicio fica sem icone — e o icone e a unica coisa que '
    + 'existe antes de abrir o app');
}

console.log('');
console.log('=================================================');
console.log(problemas
  ? '  ' + problemas + ' problema(s) com o icone'
  : '  o icone existe, nos tamanhos certos, e funciona sem rede');
console.log('=================================================\n');
process.exit(problemas ? 1 : 0);
