/* =========================================================
   Ferramenta de conference: variavel de CSS definida
   ---------------------------------------------------------
   Rodar:  node tools/check-variaveis.js

   Existe por causa de dois bugs reais que nenhum teste pegou.

   O circulo de tonalidades desenhava alguns setores pretos, e as letras das
   notas de dentro sumiam no tema escuro. A causa era a mesma nos dois casos:
   uma variavel de CSS que nao existe. Um `fill` de SVG com `var(--algo)`
   inexistente nao da erro — o navegador simplesmente ignora e usa o valor
   inicial, que para `fill` e preto. No tema claro o preto e o texto certo, e
   bug nenhum aparece. No escuro, some.

   E nenhum automatismo acusou, porque as ferramentas existentes olham API de
   JS, codificacao e terminologia — nenhuma delas abre um `var(--x)` e pergunta
   se o `--x` existe. Esta pergunta e simples e vale para o app inteiro.
   ========================================================= */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const CSS_DIR = path.join(RAIZ, 'css');
const IGNORAR_DIR = new Set(['node_modules', '.git', '.github', 'dist', '_site', 'tools']);

/** Tudo que o navegador le como CSS, mais o CSS embutido em string de JS. */
function arquivosCss() {
  return fs.readdirSync(CSS_DIR)
    .filter((f) => f.endsWith('.css'))
    .map((f) => path.join(CSS_DIR, f));
}

function arquivosJs() {
  const out = [];
  (function andar(dir) {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORAR_DIR.has(entrada.name)) continue;
      const p = path.join(dir, entrada.name);
      if (entrada.isDirectory()) andar(p);
      else if (entrada.name.endsWith('.js')) out.push(p);
    }
  })(RAIZ);
  return out;
}

/**
 * Coleta as variaveis declaradas.
 *
 * `--x: valor` e uma declaracao. `--x: ;` nao conta: e um placeholder vazio,
 * e o `var(--x)` que aponta para ele fica invalido do mesmo jeito que se
 * nao existisse. Por isso a verificacao exige algo depois dos dois pontos.
 */
function declaradas(arquivos) {
  const mapa = new Map(); // token -> [ onde ]
  const re = /(--[a-zA-Z0-9_-]+)'?\s*:\s*([^;{}\n]+)/g;
  for (const arq of arquivos) {
    const texto = fs.readFileSync(arq, 'utf8');
    let m;
    while ((m = re.exec(texto)) !== null) {
      const valor = m[2].trim();
      if (!valor) continue;
      if (!mapa.has(m[1])) mapa.set(m[1], []);
      mapa.get(m[1]).push(path.relative(RAIZ, arq) + ':' + linhaDe(texto, m.index));
    }
  }
  return mapa;
}

function linhaDe(texto, indice) {
  let n = 1;
  for (let i = 0; i < indice && i < texto.length; i++) if (texto[i] === '\n') n++;
  return String(n);
}

/** Coleta os usos de `var(--x)`. */
function usadas(arquivos) {
  const mapa = new Map(); // token -> [{ onde, trecho }]
  const re = /var\(\s*(--[a-zA-Z0-9_-]+)/g;
  for (const arq of arquivos) {
    const texto = fs.readFileSync(arq, 'utf8');
    let m;
    while ((m = re.exec(texto)) !== null) {
      const token = m[1];
      const ini = Math.max(0, m.index - 40);
      const trecho = texto.slice(ini, m.index + 60).replace(/\s+/g, ' ').trim();
      if (!mapa.has(token)) mapa.set(token, []);
      mapa.get(token).push({ onde: path.relative(RAIZ, arq) + ':' + linhaDe(texto, m.index), trecho: trecho });
    }
  }
  return mapa;
}

const css = arquivosCss();
const js = arquivosJs();
// O proprio index.html tambem tem estilo inline e pode usar variavel.
const html = [path.join(RAIZ, 'index.html')].filter((p) => fs.existsSync(p));

const definidos = declaradas([...css, ...js, ...html]);
const usos = usadas([...css, ...js, ...html]);

const quebradas = [];
for (const [token, onde] of usos) {
  if (definidos.has(token)) continue;
  quebradas.push({ token: token, usos: onde });
}

console.log('\n=== Variaveis de CSS ===');
console.log('  ' + definidos.size + ' declarada(s)');
console.log('  ' + usos.size + ' usada(s)');

if (!quebradas.length) {
  console.log('  ok    todo var(--x) aponta para uma variavel que existe');
} else {
  console.log('\n  FALHA ' + quebradas.length + ' variavel(is) usada(s) e nunca declarada(s):\n');
  for (const b of quebradas) {
    console.log('    ' + b.token);
    for (const u of b.usos.slice(0, 4)) console.log('      ' + u.onde + '   ' + u.trecho);
    if (b.usos.length > 4) console.log('      ... e mais ' + (b.usos.length - 4) + ' uso(s)');
    console.log('');
  }
  console.log('  Por que isso vira bug e nao erro: um `fill` de SVG com');
  console.log('  `var(--inexistente)` e ignorado pelo navegador, que usa o valor');
  console.log('  inicial do atributo. Para `fill` isso e PRETO — certaino no tema');
  console.log('  claro, invisivel no escuro. Nenhum teste de JS acusa isso.');
}

// Variavel declarada e nunca usada nao e erro (pode ser consumed por um
// script externo, e apagar seria adivinhar), mas e util saber.
const orfas = [...definidos.keys()].filter((t) => !usos.has(t));

console.log('\n=================================================');
const status = quebradas.length ? 1 : 0;
console.log(quebradas.length
  ? '  ' + quebradas.length + ' variavel(is) quebrada(s)'
  : '  nenhuma variavel quebrada');
if (orfas.length) console.log('  (' + orfas.length + ' declarada(s) sem uso neste repositorio)');
console.log('=================================================\n');
process.exit(status);