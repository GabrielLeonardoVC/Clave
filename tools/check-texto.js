/* =========================================================
   Conference: o tamanho de texto tem que ser relativo
   ---------------------------------------------------------
   Rodar:  node tools/check-texto.js

   Existe porque a opcao "Tamanho do texto" das configuracoes nao fazia
   absolutamente nada, e nenhuma das ferramentas existentes acusou.

   A causa: os 108 tamanhos de texto do app estavam em px. `font-size` no
   <html> so alcança quem herda ou usa rem — e nao herda ninguem com tamanho
   fixo. Entao a opcao funcionava, o atributo mudava, e a tela nao mudava
   junto. Um bug que so se ve mexendo nela e olhando.

   Este conference nao tenta ser esperto. Ele proibe `font-size` em px nos
   arquivos que vao para o navegador, com duas unicas excecoes, ambas
   deliberadas:
     - as regras [data-fontsize], que definem a propria raiz e portanto
       nao podem estar em rem (seria calculado contra si mesmo);
     - a folha de impressao, que e medida em centimetros e nao deve
       acompanhar a preferencia de tela.
   ========================================================= */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const CSS_DIR = path.join(RAIZ, 'css');
const IGNORAR_DIR = new Set(['node_modules', '.git', 'tools', 'dist', '_site']);

/** Padroes em que px e obrigatorio, e o motivo de cada um. */
const EXCECOES = [
  // A raiz e a referencia do rem. Se ela valesse 1rem, seria calculada contra
  // ela mesma — um laco sem ponto de parada.
  { re: /(?:^|[}\s])html\s*\{[^}]*font-size:\s*[\d.]+px/, motivo: 'a raiz: e a referencia do rem' },
  // As regras que mudam a raiz por preferencia do usuario, tambem em px pelo
  // mesmo motivo.
  { re: /\[data-fontsize[^\]]*\]\s*\{[^}]*font-size:\s*[\d.]+px/, motivo: 'define a raiz; em rem seria autorreferente' },
];

function css() {
  return fs.readdirSync(CSS_DIR).filter((f) => f.endsWith('.css')).map((f) => path.join(CSS_DIR, f));
}

function js() {
  const out = [];
  (function andar(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORAR_DIR.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name.endsWith('.js')) out.push(p);
    }
  })(RAIZ);
  return out;
}

const problemas = [];

function conferir(arq, texto, padrao, como) {
  // As regras de impressao sao medidas em centimetro e nao seguem a preferencia
  // de tela. Uma folha A4 impressa em letra de 22px nao cabe na pagina.
  let corpo = texto;
  const iPrint = texto.search(/@media\s+print/);
  if (iPrint >= 0) corpo = texto.slice(0, iPrint);

  corpo.split(/\r?\n/).forEach(function (linha, i) {
    if (!padrao.test(linha)) return;
    for (const exc of EXCECOES) {
      if (exc.re.test(texto.slice(Math.max(0, linha.length - 200), texto.indexOf(linha) + linha.length))) return;
    }
    problemas.push({
      onde: path.relative(RAIZ, arq) + ':' + (i + 1),
      trecho: linha.trim().slice(0, 90),
      como: como,
    });
  });
}

const rePxCss = /font-size:\s*[\d.]+px/;
const rePxJs = /fontSize:\s*'[\d.]+px'/;

for (const arq of css()) conferir(arq, fs.readFileSync(arq, 'utf8'), rePxCss, 'CSS');
for (const arq of js()) conferir(arq, fs.readFileSync(arq, 'utf8'), rePxJs, 'JS');

console.log('\n=== Tamanho de texto relativo ===');
if (!problemas.length) {
  console.log('  ok    nenhum font-size em px — o tamanho global funciona');
} else {
  console.log('\n  FALHA ' + problemas.length + ' tamanho(s) fixo(s) em px:\n');
  for (const p of problemas) {
    console.log('    ' + p.onde + '  (' + p.como + ')');
    console.log('      ' + p.trecho);
  }
  console.log('\n  px nao responde a `data-fontsize`. Converta para rem dividindo por 16.');
  console.log('  A excecao e so a regra [data-fontsize] e a folha de impressao.');
}

// Confere tambem que toda chave usada no JS tem regra no CSS.
const ajuste = fs.readFileSync(path.join(RAIZ, 'js', 'views', 'ajustes.js'), 'utf8');
const chavesJs = [...ajuste.matchAll(/v:\s*'([a-z]{1,3})',\s*n:\s*'A'/g)].map((m) => m[1]);
const baseCss = fs.readFileSync(path.join(CSS_DIR, 'base.css'), 'utf8');
const faltando = chavesJs.filter((k) => !baseCss.includes('[data-fontsize="' + k + '"]'));

console.log('  ' + chavesJs.length + ' tamanho(s) na interface, ' + (chavesJs.length - faltando.length) + ' com regra no CSS');
if (faltando.length) {
  console.log('  FALHA sem regra no CSS: ' + faltando.join(', '));
  problemas.push({ onde: 'ajustes.js', trecho: faltando.join(','), como: 'chave sem CSS' });
}

// E que o padrao do store bate com alguma regra.
const store = fs.readFileSync(path.join(RAIZ, 'js', 'core', 'store.js'), 'utf8');
const m = /fontsize:\s*'([a-z]{1,3})'/.exec(store);
if (!m) problemas.push({ onde: 'store.js', trecho: 'sem padrao de fontsize', como: 'padrao ausente' });
else if (!baseCss.includes('[data-fontsize="' + m[1] + '"]')) {
  problemas.push({ onde: 'store.js', trecho: 'padrao "' + m[1] + '" sem regra', como: 'padrao sem CSS' });
} else {
  console.log('  padrao do store: ' + m[1] + ' (com regra)');
}

console.log('\n=================================================');
console.log(problemas.length ? '  ' + problemas.length + ' problema(s)' : '  tudo relativo');
console.log('=================================================\n');
process.exit(problemas.length ? 1 : 0);