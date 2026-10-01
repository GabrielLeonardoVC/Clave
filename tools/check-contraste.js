/* =========================================================
   ACORDE - tools/check-contraste.js
   O tom de cada acento tem de ser legivel nos DOIS temas.

   Existe por causa de um defeito real: os catorze blocos de acento declaravam
   `--brand-tint` com um valor escuro e `--primary` apontando para o 400 — a
   variante CLARA da cor. Os dois foram pensados para o tema escuro e valiam
   tambem no claro. No tema claro, entao, cada acento virava uma caixa quase
   preta sobre fundo creme, com texto de cor clara em cima.

   O defeito nao aparecia em nenhum teste: o verificador de sintaxe passa, o de
   variaveis passa (a variavel existia), o de API passa. So aparecia olhando a
   tela. Este arquivo o torna visivel sem navegador.

   Duas verificacoes:

     1. ESTRUTURA — nenhum bloco de acento pode declarar cor de fundo ou de
        texto. Se ele declara, a cor vale para os dois temas e um deles
        quebra. O tom tem de ser uma MISTURA com `--tint-base`, que o tema
        define.

     2. CONTRASTE — o tom de texto de cada acento (600 no claro, 400 no
        escuro) precisa de 4.5:1 contra o fundo do seu tema. Abaixo disso o
        texto some no fundo, que e o pior defeito que um app de partitura
        pode ter.

   WCAG 2.1, nivel AA para texto normal.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const CSS = path.join(__dirname, '..', 'css', 'base.css');
const css = fs.readFileSync(CSS, 'utf8');

const MINIMO = 4.5;

function falhar(msg) {
  console.log('\n  FALHA  ' + msg);
  return false;
}

/* ------------------------------------------------------------
   A cor de fundo de cada tema. E literal na folha — por isso da
   para conferir sem navegador.
   ------------------------------------------------------------ */
function corDoTema(tema, nome) {
  const re = new RegExp('\\[data-theme="' + tema + '"\\][\\s\\S]*?--' + nome + ':\\s*(#[0-9A-Fa-f]{3,8})');
  const m = re.exec(css);
  return m ? m[1] : null;
}

const bgClaro = corDoTema('light', 'bg');
const bgEscuro = corDoTema('dark', 'bg');

console.log('\n=== contraste dos acentos ===');
console.log('  fundo claro: ' + bgClaro + '   fundo escuro: ' + bgEscuro);

if (!bgClaro || !bgEscuro) {
  console.log('\n  FALHA  nao achei o fundo de um dos temas em base.css');
  console.log('=================================================\n');
  process.exit(1);
}

/* ------------------------------------------------------------
   A formula de luminancia relativa da WCAG.
   ------------------------------------------------------------ */
function luminancia(cor) {
  let h = cor.trim();
  if (h[0] !== '#') return null;
  h = h.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const canais = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

function contraste(a, b) {
  const la = luminancia(a), lb = luminancia(b);
  if (la === null || lb === null) return null;
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------
   1. ESTRUTURA: o acento nao pode declarar cor, so a rampa.
   ------------------------------------------------------------ */
console.log('\n=== o acento declara so a rampa ===');

const blocos = [...css.matchAll(/\[data-accent="([a-z]+)"\]\s*\{([^}]*)\}/g)];
if (!blocos.length) {
  console.log('\n  FALHA  nenhum bloco de acento encontrado');
  console.log('=================================================\n');
  process.exit(1);
}

let estruturaOk = true;

// Extrai o valor de uma declaracao dentro do bloco. Comparar o valor e mais
// seguro do que olhar para frente com regex: um `(?!color-mix)` depois de
// `\s*` faz backtracking quando o espaco nao casa, esvazia o `\s*` e passa a
// olhar para o espaco em vez da palavra — e a regra accuse um bloco correto.
function valorDe(corpo, nome) {
  const m = new RegExp('--' + nome + '\\s*:\\s*([^;\\n}]+)').exec(corpo);
  return m ? m[1].trim() : null;
}

// Um valor que NAO pode aparecer dentro de um bloco de acento. A cor tem de
// nascer da mistura com --tint-base, que cada tema define.
const FIXOS = ['brand-tint', 'brand-tint-2'];
const DO_TEMA = ['primary', 'primary-ink', 'tint-base', 'bg', 'ink', 'surface', 'line'];

for (const [, id, corpo] of blocos) {
  for (const nome of FIXOS) {
    const v = valorDe(corpo, nome);
    if (v === null) continue;
    if (v.indexOf('color-mix') === 0 || v.indexOf('var(') === 0) continue;
    estruturaOk = falhar(id + ': --' + nome + ' esta fixo (' + v +
      '). Um valor fixo vale nos dois temas, e um deles quebra. Tem de ser uma mistura com --tint-base.') && estruturaOk;
  }
  for (const nome of DO_TEMA) {
    if (new RegExp('--' + nome + '\\s*:').test(corpo)) {
      estruturaOk = falhar(id + ': --' + nome +
        ' pertence ao tema, nao ao acento. O acento declara so a rampa e as misturas.') && estruturaOk;
    }
  }
  // E a rampa tem de existir inteira: uma rampa pela metade deixa o tom de
  // texto herdando a cor do acento padrao, sem ninguem perceber.
  for (const passo of ['400', '500', '600']) {
    if (!/^#[0-9A-Fa-f]{6}$/i.test(valorDe(corpo, 'brand-' + passo) || '')) {
      estruturaOk = falhar(id + ': falta o --brand-' + passo + ' na rampa') && estruturaOk;
    }
  }
}
if (estruturaOk) console.log('  ok    os ' + blocos.length + ' acentos declaram so a rampa');

/* ------------------------------------------------------------
   2. CONTRASTE: o tom de texto em cada tema.
   ------------------------------------------------------------ */
console.log('\n=== o tom de texto se le nos dois temas ===');

let contrasteOk = true;
let piores = [];

for (const [, id, corpo] of blocos) {
  const b400 = /--brand-400\s*:\s*(#[0-9A-Fa-f]{6})/.exec(corpo);
  const b600 = /--brand-600\s*:\s*(#[0-9A-Fa-f]{6})/.exec(corpo);
  if (!b400 || !b600) continue;   // a estrutura acima ja reclamou

  // No claro o texto usa o 600 (a cor escura da rampa); no escuro, o 400.
  const cClaro = contraste(b600[1], bgClaro);
  const cEscuro = contraste(b400[1], bgEscuro);

  const ruim = (cClaro !== null && cClaro < MINIMO) || (cEscuro !== null && cEscuro < MINIMO);
  if (ruim) piores.push(id + ' (claro ' + cClaro.toFixed(2) + ', escuro ' + cEscuro.toFixed(2) + ')');

  const marca = ruim ? 'ABAIXO' : 'ok';
  console.log('  ' + (ruim ? 'FALHA' : 'ok   ') + '  ' +
    id.padEnd(10) + ' claro ' + cClaro.toFixed(2).padStart(6) +
    '   escuro ' + cEscuro.toFixed(2).padStart(6) + '   ' + marca);
  if (ruim) contrasteOk = false;
}

/* ------------------------------------------------------------
   3. O fundo do tom tem de existir em cada tema, e de ser uma
      MISTURA — e a mistura que garante a heranca do tema.
   ------------------------------------------------------------ */
console.log('\n=== o tom do acento segue o tema ===');
let tomOk = true;
for (const tema of ['light', 'dark', 'auto']) {
  const base = corDoTema(tema, 'tint-base');
  if (!base) { tomOk = falhar('o tema ' + tema + ' nao declara --tint-base') && tomOk; continue; }
  console.log('  ok    ' + tema.padEnd(6) + ' --tint-base: ' + base);
}
const semMistura = blocos.filter(([, , corpo]) => !/--brand-tint\s*:\s*color-mix/.test(corpo));
if (semMistura.length) {
  tomOk = falhar(semMistura.length + ' acento(s) sem `color-mix` no tom — nao herdam o tema') && tomOk;
} else {
  console.log('  ok    todos os ' + blocos.length + ' acentos derivam o tom de --tint-base');
}

/* ------------------------------------------------------------
   4. O TEXTO SOBRE A COR DO ACENTO.

   `--on-brand` e a cor do texto que fica SOBRE o fundo do acento: todo chip
   selecionado, toda tecla de tom, o botao principal, a nota fundamental no
   braco. Sao os dois lados de uma moeda — o 600 no claro, o 400 no escuro — e
   por isso os dois precisam ser conferidos.

   Aqui estava o defeito: `--on-brand` era quase preto, e `--primary` no claro
   e a variante ESCURA da rampa. Texto quase preto sobre cor escura: 3.55:1,
   abaixo dos 4.5, nas dezessete regras que usam a variavel. No escuro o valor
   escuro esta certo e nao deve ser mudado, porque la `--primary` e a variante
   clara. Um ajuste no escuro estragaria o tema que ja funciona.
   ------------------------------------------------------------ */
console.log('\n=== o texto sobre a cor do acento ===');

const onClaro = corDoTema('light', 'on-brand');
const onEscuro = corDoTema('dark', 'on-brand');
if (!onClaro || !onEscuro) {
  console.log('\n  FALHA  nao achei --on-brand em um dos temas');
  console.log('=================================================\n');
  process.exit(1);
}
console.log('  --on-brand  claro: ' + onClaro + '   escuro: ' + onEscuro);

let sobreOk = true;
let piorSobre = 99;

for (const [, id, corpo] of blocos) {
  const b400 = /--brand-400\s*:\s*(#[0-9A-Fa-f]{6})/.exec(corpo);
  const b600 = /--brand-600\s*:\s*(#[0-9A-Fa-f]{6})/.exec(corpo);
  if (!b400 || !b600) continue;

  // Claro: fundo e o 600 (a cor escura da rampa). Escuro: fundo e o 400.
  const c1 = contraste(onClaro, b600[1]);
  const c2 = contraste(onEscuro, b400[1]);

  const ruim = (c1 !== null && c1 < MINIMO) || (c2 !== null && c2 < MINIMO);
  if (c1 !== null) piorSobre = Math.min(piorSobre, c1);
  if (c2 !== null) piorSobre = Math.min(piorSobre, c2);
  if (ruim) sobreOk = false;

  console.log('  ' + (ruim ? 'FALHA' : 'ok   ') + '  ' + id.padEnd(10) +
    ' claro ' + c1.toFixed(2).padStart(6) + '   escuro ' + c2.toFixed(2).padStart(6) +
    (ruim ? '   ABAIXO' : ''));
}

const tudoOk = estruturaOk && contrasteOk && tomOk && sobreOk;

console.log('\n=================================================');
if (tudoOk) {
  console.log('  os ' + blocos.length + ' acentos passam nos dois temas');
} else {
  console.log('  corrigir antes de publicar:');
  if (!contrasteOk) piores.forEach((p) => console.log('    - ' + p));
  if (!sobreOk) console.log('    - o texto sobre a cor do acento esta abaixo de ' + MINIMO +
    ':1 em algum acento. `--on-brand` e a cor do texto SOBRE o fundo do acento.');
  console.log('=================================================\n');
  process.exit(1);
}
console.log('  pior contraste medido: ' + piorSobre.toFixed(2) + ':1');
console.log('=================================================\n');