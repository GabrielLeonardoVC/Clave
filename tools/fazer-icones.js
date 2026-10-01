/* =========================================================
   ACORDE - tools/fazer-icones.js
   O icone em PNG, nos tamanhos que as lojas pedem.

   Rodar:  node tools/fazer-icones.js

   ---------------------------------------------------------
   POR QUE ISTE ARQUIVO EXISTE

   O manifesto declarava `assets/icon-512.svg` com `sizes: "512x512"`, e o
   `index.html` apontava `apple-touch-icon` para o mesmo SVG. As duas coisas
   estao erradas, e as duas quietas:

     - SVG NAO E PNG. Um `sizes` num arquivo SVG e uma mentira: o arquivo nao
       tem pixels. A Play Store recusa; o instalador do Android ignora.

     - iOS NAO USA SVG EM `apple-touch-icon`. O Safari ignora a tag, e o icone
       na tela inicial vira um print da pagina — a tela branca com a barra de
       ferramentas, que e a pior coisa que um icone pode ser.

   Nenhum dos dois dava erro. O app instalava, abria, funcionava, e o icone
   estava errado. E o pior tipo de defeito: o que so aparece na casa da
   pessoa, no aparelho dela, e so depois que ela instala.

   ---------------------------------------------------------
   POR QUE O NAVEGADOR E QUE DESENHA

   Nao existe outra ferramenta aqui. O projeto nao tem `sharp`, nao tem
   `resvg`, e nao deve ganhar uma dependencia so para isto. O Chrome ja e usado
   pelo `probe-css`, entao nao e dependencia nova: e a mesma que ja abre a tela.

   E desenhar no navegador tem uma vantagem que nenhuma outra via tem: o
   resultado e EXATAMENTE o que o aparelho vai mostrar. Um conversor SVG para
   PNG pode errar uma curva, um degrade, um `rx`. O Chrome, nao.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const SVG = path.join(RAIZ, 'assets', 'icon-512.svg');

/* O que gerar, e por que cada um existe.
 *
 *  192  Play Store e instalador do Android exigem, por nome.
 *  512  Tela de inicio do Android, em aparelho de alta densidade.
 *  180  `apple-touch-icon`. O iOS nao aceita SVG e nao aceita 192 "que serve":
 *       ele pede 180, e usa o que vier.
 *  mask  Icone adaptativo do Android 8+. A loja recusa sem ele.
 */
const ALVOS = [
  { arquivo: 'icon-192.png', tamanho: 192, maskavel: false },
  { arquivo: 'icon-512.png', tamanho: 512, maskavel: false },
  { arquivo: 'apple-touch-icon.png', tamanho: 180, maskavel: false },
  { arquivo: 'icon-maskable-512.png', tamanho: 512, maskavel: true },
];

function acharNavegador() {
  const candidatos = [
    path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const c of candidatos) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

/** A pagina que o navegador vai fotografar.
 *
 * `maskavel` muda duas coisas, e as duas importam:
 *
 *  - o fundo enche a tela inteira, sem canto arredondado. A mascara do
 *    aparelho recorta os cantos, e um fundo com `rx` deixa a borda transparente
 *    embaixo da recorte — o icone vira uma figura recortada em vez de um
 *    quadrado.
 *
 *  - o desenho encolhe para dentro da ZONA SEGURA, que e o circulo central de
 *    80%. A mascara chega a 25% de cada lado. O desenho original ocupa 61% do
 *    largura e ja cabe; encolher mais seria perder detalhe por causa de um
 *    aparelho que ainda nao existe na sua mao.
 */
function pagina(svg, tamanho, maskavel) {
  const fundo = maskavel
    ? '<rect width="512" height="512" fill="#17140F"/>'
    : '';

  // Remove o <rect> de fundo do desenho original, para nao haver dois fundos.
  const conteudo = svg.replace(/<rect[^>]*\bfill="#17140F"[^>]*\/>\s*/, '');

  // O fundo vem ANTES do desenho.
  //
  // Na primeira versao ele vinha depois, e o resultado foi um PNG de 1,8 KB:
  // 512 por 512 de uma cor so. O retangulo de tela cheia tinha pintado por cima
  // do simbolo, e o icone adaptativo do Android — justamente o que existe para
  // sobreviver a recorte — era um quadrado vazio.
  //
  // O sintoma era o TAMANHO DO ARQUIVO, e nao o desenho: um PNG achatado para
  // menos de 2 KB em 512 por 512 so pode estar chapado. Vale conferir a
  // dimensao e o tipo de cor de todo PNG que este script gera.
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; }
    html, body { width: ${tamanho}px; height: ${tamanho}px; overflow: hidden; background: ${maskavel ? '#17140F' : 'transparent'}; }
    svg { display: block; width: ${tamanho}px; height: ${tamanho}px; }
  </style></head><body>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${tamanho}" height="${tamanho}">
    ${fundo}
    ${conteudo.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}
  </svg></body></html>`;
}

function principal() {
  console.log('\n=== o icone em PNG, nos tamanhos que a loja pede ===');

  if (!fs.existsSync(SVG)) {
    console.log('  FALHA nao achei ' + SVG);
    process.exit(1);
  }
  const svg = fs.readFileSync(SVG, 'utf8');

  const navegador = acharNavegador();
  if (!navegador) {
    console.log('  --    nenhum Chrome ou Edge encontrado; os PNGs nao foram gerados.');
    console.log('        O SVG continua servindo para o navegador, e o manifesto');
    console.log('        deve continuar apontando para ele ate haver raster.');
    process.exit(0);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clave-icones-'));
  let feitos = 0;

  try {
    for (const alvo of ALVOS) {
      const html = path.join(tmp, alvo.arquivo + '.html');
      const png = path.join(tmp, alvo.arquivo);
      fs.writeFileSync(html, pagina(svg, alvo.tamanho, alvo.maskavel), 'utf8');

      /* O Chrome desenha o canvas do tamanho da janela. A escala de device e 1
       * para nao aparecer um PNG de 2x com outro nome. */
      try {
        execFileSync(navegador, [
          '--headless',
          '--disable-gpu',
          '--hide-scrollbars',
          '--default-background-color=00000000',
          '--force-device-scale-factor=1',
          '--window-size=' + alvo.tamanho + ',' + alvo.tamanho,
          '--screenshot=' + png,
          'file:///' + html.replace(/\\/g, '/'),
        ], { stdio: ['ignore', 'ignore', 'ignore'], timeout: 60000, windowsHide: true });
      } catch (e) { /* o Chrome costuma sair com codigo diferente mesmo em sucesso */ }

      if (!fs.existsSync(png)) {
        console.log('  FALHA o navegador nao gerou ' + alvo.arquivo);
        continue;
      }

      const destino = path.join(RAIZ, 'assets', alvo.arquivo);
      fs.copyFileSync(png, destino);
      const bytes = fs.statSync(destino).size;
      feitos++;
      console.log('  ok    ' + alvo.arquivo.padEnd(26)
        + String(alvo.tamanho).padStart(4) + 'px  '
        + (bytes / 1024).toFixed(1).padStart(6) + ' KB  '
        + (alvo.maskavel ? 'maskavel (fundo cheio)' : ''));
    }
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* nada */ }
  }

  console.log('');
  console.log('  ' + feitos + ' de ' + ALVOS.length + ' gerado(s).');
  if (feitos === ALVOS.length) {
    console.log('  Agora aponte o manifesto e o index.html para estes arquivos.');
  } else {
    console.log('  Nao aponte nada ainda: um caminho para arquivo que nao existe');
    console.log('  e pior do que um icone ruim.');
  }
  console.log('');
  process.exit(feitos === ALVOS.length ? 0 : 1);
}

principal();
