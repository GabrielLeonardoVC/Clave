/* =========================================================
   ACORDE - tools/test-icones.js
   O verificador de icones precisa acusar o icone quebrado.

   Este arquivo quebra o icone de cinco jeitos diferentes e confere que o
   verificador acusa cada um. Sem isso, `check-icones.js` seria um relatorio a
   mais — e um relatorio que nunca falhou e um relatorio que ninguem le.

   Os cinco jeitos sao os quatro defeitos REAIS que este projeto ja teve, mais o
   quinto que ele esta a um passo de ter:

     1. `apple-touch-icon` apontando para SVG. O erro que estava no `index.html`.
        O Safari ignora a tag e desenha um print da pagina na tela de inicio.

     2. O manifesto declarando `sizes: "512x512"` num SVG. A mentira do pixel.

     3. Um PNG que nao esta no disco. Apontar para arquivo ausente e pior que
        um icone ruim: some o icone e nao avisa.

     4. Um icone maskavel faltando. A Play Store recusa a publicacao.

     5. Um PNG retangular de cor lisa. Foi assim que o primeiro maskavel saiu:
        1,8 KB em 512x512, com o fundo pintado por cima do desenho. O icone era
        um quadrado vazio, e o arquivo tinha o tamanho certinho.

   O quinto e o mais importante, porque e o unico que passa despercebido: o
   arquivo existe, o tamanho bate, o manifesto esta correto. So o peso entrega.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/* A raiz vem do proprio repositorio, e nao de um caminho fixo.
 *
 * O caminho absoluto que estava aqui so resolvia na maquina em que o arquivo
 * foi escrito. Em qualquer outra o `readFileSync` do `index.html` recebia um
 * ENOENT e a prova dos cinco defeitos de icone nunca rodava. */
const { RAIZ } = require('./arquivos.js');
const VERIF = path.join(RAIZ, 'tools', 'check-icones.js');

const CASOS = [
  {
    nome: 'o apple-touch-icon aponta para SVG',
    arquivo: 'index.html',
    quebra: /<link rel="apple-touch-icon" href="assets\/apple-touch-icon\.png">/,
    conserta: '<link rel="apple-touch-icon" href="assets/icon-512.svg">',
    esperado: 'apple-touch-icon nao e SVG',
  },
  {
    nome: 'o manifesto promete 512x512 num SVG',
    arquivo: 'manifest.webmanifest',
    quebra: /"src": "assets\/logo\.svg",\s*"sizes": "any"/,
    conserta: '"src": "assets/logo.svg",\n      "sizes": "512x512"',
    esperado: 'SVG declara size honesto',
  },
  {
    nome: 'o manifesto aponta para um icone que nao existe',
    arquivo: 'manifest.webmanifest',
    quebra: /"src": "assets\/icon-192\.png"/,
    conserta: '"src": "assets/icon-194.png"',
    /* A regra dispara duas: "o icone declarado existe" E "o tamanho bate com o
     * que o manifesto promete". A segunda vem antes na tela, e o teste confere
     * a primeira pelo nome exato da linha. */
    esperado: 'o icone declarado existe: assets/icon-194.png',
  },
  {
    nome: 'o icone maskavel sumiu',
    arquivo: 'manifest.webmanifest',
    quebra: /"src": "assets\/icon-maskable-512\.png"[\s\S]*?"purpose": "maskable"/,
    conserta: '"src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"',
    esperado: 'maskable',
  },
  {
    nome: 'o offline deixa de guardar o icone',
    arquivo: 'sw.js',
    quebra: /\s*'\.\/assets\/icon-192\.png',/,
    conserta: '',
    esperado: 'o offline guarda assets/icon-192.png',
  },
];

/* O quinto caso precisa mexer no BINARIO do PNG, e nao no texto. */
function estrangularPng() {
  const p = path.join(RAIZ, 'assets', 'icon-maskable-512.png');
  const original = fs.readFileSync(p);
  /* Um PNG de 512x512 chapado tem poucos KB. Reescrever o arquivo com o mesmo
   * cabecalho e um bloco IDAT minusculo produz um retangulo de cor solida —
   * que e exatamente o defeito. */
  const cabecalho = original.subarray(0, 33);
  const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  return { caminho: p, original: original, novo: Buffer.concat([cabecalho, iend]) };
}

function rodar() {
  try {
    execFileSync(process.execPath, [VERIF], { cwd: RAIZ, encoding: 'utf8', timeout: 60000 });
    return { passou: true, saida: '' };
  } catch (e) {
    return { passou: false, saida: (e.stdout || '') + (e.stderr || '') };
  }
}

let falhas = 0;

console.log('\n=== o verificador de icones precisa acusar o icone quebrado ===');

const antes = rodar();
console.log((antes.passou ? '  ok    ' : '  FALHA ') + 'com os icones certos, o verificador passa');
if (!antes.passou) {
  falhas++;
  console.log(antes.saida.split('\n').filter((l) => l.indexOf('FALHA') >= 0).join('\n'));
}

/* Um verificador que acusa por outra razao nao provou nada: pode ter barrado
 * por outra regra e continuaria barrando quando o buraco fechar. Cada caso
 * declara qual regra tem de ser a que dispara. */
for (const c of CASOS) {
  const p = path.join(RAIZ, c.arquivo);
  const original = fs.readFileSync(p, 'utf8');

  if (!c.quebra.test(original)) {
    console.log('  FALHA  "' + c.nome + '": a expressao a quebrar nao existe mais');
    console.log('        o codigo mudou de forma e o teste ficou velho');
    falhas++;
    continue;
  }

  fs.writeFileSync(p, original.replace(c.quebra, c.conserta), 'utf8');
  const r = rodar();
  const acusou = !r.passou;
  const linhas = r.saida.split('\n').filter((l) => l.indexOf('FALHA') >= 0);
  const pelaCerta = linhas.some((l) => l.indexOf(c.esperado) >= 0);

  console.log((acusou ? '  ok    ' : '  FALHA ') + 'abriu "' + c.nome + '" e o verificador '
    + (acusou ? 'acusou' : 'NAO acusou'));
  if (acusou) {
    console.log('        pela regra certa: ' + (pelaCerta ? 'sim' : 'NAO, disparou outra'));
    const achou = linhas.find((l) => l.indexOf(c.esperado) >= 0) || linhas[0];
    console.log('        ' + achou.trim().slice(0, 90));
    if (!pelaCerta) falhas++;
  } else {
    falhas++;
  }

  fs.writeFileSync(p, original, 'utf8');
}

/* ---- o PNG estrangulado ---- */
console.log('  --    e agora o icone estrangulado, que passa por cima de tudo');
{
  const alvo = estrangularPng();
  try {
    fs.writeFileSync(alvo.caminho, alvo.novo);
    const r = rodar();
    const acusou = !r.passou;
    const linhas = r.saida.split('\n').filter((l) => l.indexOf('FALHA') >= 0);
    const pelaCerta = linhas.some((l) => /cor lisa/.test(l));

    console.log((acusou ? '  ok    ' : '  FALHA ')
      + 'o icone virou um quadrado de cor e o verificador '
      + (acusou ? 'acusou' : 'NAO acusou'));
    if (acusou) {
      console.log('        pela regra certa: ' + (pelaCerta ? 'sim' : 'NAO'));
      const achou = linhas.find((l) => /cor lisa/.test(l)) || linhas[0];
      console.log('        ' + achou.trim().slice(0, 90));
      console.log('        este e o defeito que so o PESO do arquivo denuncia.');
      if (!pelaCerta) falhas++;
    } else {
      console.log('        um PNG chapado passa: existe, do tamanho certo, no manifesto.');
      console.log('        Sem a regra do peso, o icone-adaptativo seria um vazio.');
      falhas++;
    }
  } finally {
    fs.writeFileSync(alvo.caminho, alvo.original);
  }
}

const depois = rodar();
console.log((depois.passou ? '  ok    ' : '  FALHA ') + 'tudo restaurado, o verificador volta a passar');
if (!depois.passou) { falhas++; console.log(depois.saida); }

console.log('');
console.log('=================================================');
console.log(falhas
  ? '  ' + falhas + ' problema(s)'
  : '  o verificador barra os seis jeitos de o icone estar errado');
console.log('=================================================\n');
process.exit(falhas ? 1 : 0);
