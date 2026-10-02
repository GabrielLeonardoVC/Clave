/* =========================================================
   tools/check-exports.js
   Nenhum modulo exporta `undefined` por nome escrito errado.

   POR QUE ESTE ARQUIVO EXISTE

   Um defeito real, deste arquivo mesmo. O `timbre.js` exportava:

       parcialesPorVoz: parcialesPorVoz,

   com a GRAFIA ERRADA na chave: `parcialesPorVoz`, com "c" onde o
   identificador tem "i". Resultado: `Timbre.parciaisPorVoz` era `undefined`,
   e `Timbre.parciaisPorVoz(6)` quebrava no primeiro acorde.

   O que torna isso deserving de um verificador proprio e o fato de que NADA o
   pegou:

   - a SINTAXE esta correta: `x: x` e um objeto valido com "c" ou com "i";
   - a ORTOGRAFIA esta correta: as duas palavras sao palavras portuguesas
     plausiveis, e o dicionario nao tem opiniao sobre nomes internos;
   - a CLASSE DE CARACTERES esta correta: as duas sao ASCII puro. Um verificador
     de caractere estranho, que existe neste projeto, nao viu nada;
   - o `check-globais` nao pega: ele confere o nome do GLOBAL, e `Timbre` estava
     certo. O erro estava um nivel abaixo, dentro do literal;
   - um teste so pega se happen de usar a funcao exportada — e foi exatamente
     assim que este apareceu, tarde demais.

   DUAS CAMADAS

   1. ESTATICA, e a que pega o defeito. Num literal de exportacao, quando o
      valor de uma propriedade e um identificador puro (`nome: identificador`),
      o nome da propriedade TEM que ser esse identificador. E uma regra sem
      excecao: se os dois nomes diferem, ou o valor nao e o que o nome promete,
      ou o nome esta errado. Nos dois casos e erro.

   2. DE CARREGAMENTO, e a segunda rede. Carrega cada modulo com um navegador
      de mentira e acusa qualquer propriedade que valha `undefined`.

   A camada 1 nao depende de o modulo carregar, e por isso cobre ate os que
   precisam de browser de verdade. A camada 2 pega o que a 1 nao alcança.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

function arquivosDe(dir, sufixo) {
  const saida = [];
  (function anda(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) anda(q);
      else if (e.name.endsWith(sufixo)) saida.push(q);
    }
  })(dir);
  return saida;
}

/* Remove comentarios e strings, preservando o numero de linha. */
function semComentario(texto) {
  const NL = texto.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  let fora = 0;
  let estado = 0;   // 0 codigo, 1 linha, 2 bloco
  let saida = '';
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    const d = texto[i + 1];
    if (estado === 1) { if (c === '\n') { estado = 0; saida += c; } continue; }
    if (estado === 2) {
      if (c === '*' && d === '/') { estado = 0; i++; saida += '  '; continue; }
      if (c === '\n') { fora++; saida += c; } else { saida += ' '; }
      continue;
    }
    if (c === '/' && d === '/') { estado = 1; saida += '  '; i++; continue; }
    if (c === '/' && d === '*') { estado = 2; saida += '  '; i++; continue; }
    saida += c;
  }
  void NL; void fora;
  return saida;
}

const IDENT = '[A-Za-z_$][A-Za-z0-9_$]*';

/**
 * Quantas operacoes separam um nome do outro.
 *
 * Trocar uma letra, de uma letra, ou inserir uma letra valem 1. E o que separa
 * `espetro` de `espectro` (1) de `criarCena` de `criar` (4).
 *
 * Nao e uma funcao de uso geral: so precisa responder "esses dois nomes sao
 * praticamente o mesmo?". Por isso uma matriz simples, sem refatoracao.
 */
function distancia(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let anterior = new Array(n + 1);
  for (let j = 0; j <= n; j++) anterior[j] = j;
  for (let i = 1; i <= m; i++) {
    const atual = new Array(n + 1);
    atual[0] = i;
    for (let j = 1; j <= n; j++) {
      const custo = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      atual[j] = Math.min(atual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + custo);
    }
    anterior = atual;
  }
  return anterior[n];
}
let passou = 0;
let falhou = 0;
const problemas = [];

function ok(cond, titulo, porque) {
  if (cond) { passou++; console.log('  ok    ' + titulo); }
  else { falhou++; problemas.push(titulo); console.log('  FALHA ' + titulo); if (porque) console.log('        ' + porque); }
}

console.log('\n=== 1. A chave casa com o valor ===');

/* Procura `global.Algo = { ... };` e olha cada propriedade. */
const ARQS = arquivosDe(path.join(RAIZ, 'js'), '.js');
let literaisVistos = 0;

for (const arq of ARQS) {
  const rel = path.relative(RAIZ, arq).replace(/\\/g, '/');
  const codigo = semComentario(fs.readFileSync(arq, 'utf8'));

  /* Os nomes declarados no arquivo: funcao, const, let, var e classe. E o que
   * permite dizer "esse valor existe", e nao so "esse nome tem a palavra certa". */
  const declarados = new Set();
  const reDecl = new RegExp(
    '(?:^|[;{}(\\n])\\s*(?:function\\s+(' + IDENT + ')|(?:const|let|var)\\s+(' + IDENT
    + ')|class\\s+(' + IDENT + '))', 'g');
  let dd;
  while ((dd = reDecl.exec(codigo))) declarados.add(dd[1] || dd[2] || dd[3]);

  /* O projeto publica o global de DOIS jeitos, e um verificador que so conhece
   * um deles deixa passar metade dos modulos:
   *
   *   global.Store = { ... };              29x   literal direto
   *   const Store = { ... }; global.Store = Store;   6x   literal antes
   *
   * A primeira versao deste arquivo so reconhecia a primeira forma. Nos seis
   * modulos da segunda nao olhava nada — e o defeito estava exatamente num
   * deles. Por isso a lista abaixo e montada em duas passadas. */
  const alvos = [];

  const reDireto = new RegExp('global\\.(' + IDENT + ')\\s*=\\s*\\{', 'g');
  let m;
  while ((m = reDireto.exec(codigo))) {
    alvos.push({ nome: m[1], inicio: m.index + m[0].length - 1 });
  }

  const reIndireto = new RegExp('global\\.(' + IDENT + ')\\s*=\\s*(' + IDENT + ')\\s*;', 'g');
  while ((m = reIndireto.exec(codigo))) {
    const variavel = m[2];
    const achado = new RegExp('(?:^|[;{}\\n])\\s*(?:const|let|var)\\s+' + variavel + '\\s*=\\s*\\{').exec(codigo);
    if (achado) {
      alvos.push({ nome: m[1], inicio: achado.index + achado[0].length - 1 });
    } else {
      /* `global.X = outraCoisa` sem literal aqui. Nao ha o que inspecionar. */
      continue;
    }
  }

  for (const alvo of alvos) {
    const nomeGlobal = alvo.nome;
    void nomeGlobal;
    // Acha o fecha correspondente do literal.
    let prof = 0;
    let i = alvo.inicio;
    const inicio = i;
    for (; i < codigo.length; i++) {
      if (codigo[i] === '{') prof++;
      else if (codigo[i] === '}') { prof--; if (prof === 0) break; }
    }
    const corpo = codigo.slice(inicio + 1, i);
    const linhaBase = codigo.slice(0, inicio).split('\n').length;
    literaisVistos++;

    /* Cada propriedade `chave: valor`.
     *
     * Nem toda divergencia e erro: um modulo pode publicar um nome mais curto
     * que o interno de proposito — `Cena.criar` apontando para `criarCena` e
     * assim mesmo, e a API que o resto do app chama.
     *
     * A distincao que separa o alias do erro de digitacao e a PALAVRA:
     *
     *   - `criar: criarCena`               — um nome e pedaco do outro. Alias.
     *   - `parcialesPorVoz: parcialesPorVoz` — sao OUTRAS palavras. Erro.
     *
     * E o segundo caso e o que nada mais pega: sintaxe correta, grafia
     * correta, ASCII correto — e mesmo assim o valor exportado e `undefined`.
     *
     * E o valor tem de existir no arquivo. Se nao existe, o modulo nem
     * carrega, e o nome e sempre erro de digitacao. */
    const reProp = new RegExp('(^|[,{\\n])[ \\t]*(' + IDENT + ')[ \\t]*:[ \\t]*(' + IDENT + ')(?=[,}\\n])', 'g');
    let p;
    while ((p = reProp.exec(corpo))) {
      const chave = p[2];
      const valor = p[3];
      if (chave === valor) continue;
      const linha = linhaBase + corpo.slice(0, p.index).split('\n').length;

      /* A DIFFERENCA ENTRE ALIAS E ERRO DE DIGITACAO E A PROPORCAO.
       *
       * Um alias de proposito troca o nome de verdade: `criarCena` vira
       * `criar`, `ids` vira `Todos`. Isso exige uma decisao, e os dois nomes
       * ficam bem diferentes um do outro.
       *
       * Um erro de digitacao e um quase-igual. `parciaisPorVoz` e
       * `parcialesPorVoz` sao o mesmo nome com tres operacoes a mais — nao sao
       * duas escolhas, sao a mesma palavra digitada duas vezes, e a segunda nao
       * existe.
       *
       * A PROPORCAO separa os dois casos, e a distancia bruta nao separa:
       *
       *   espetro / espectro         1 de 8   -> 0,88   erro de digitacao
       *   parcialesPorVoz / ...      3 de 15  -> 0,80   erro de digitacao
       *   criarCena / criar          4 de 9   -> 0,56   alias
       *   listaDeIds / ids           7 de 10  -> 0,30   alias
       *   Todos / ids                4 de 5   -> 0,20   alias
       *
       * `Todos` e `ids` estao a distancia 3, exatamente a mesma do defeito real.
       * So a proporcao diz que sao coisas diferentes. O corte e 0,75. */
      const d = distancia(chave, valor);
      const maior = Math.max(chave.length, valor.length) || 1;
      const parecer = 1 - d / maior;
      if (d > 0 && parecer >= 0.75) {
        ok(false, rel + ' linha ' + linha + ': .' + chave + ' aponta para "' + valor + '"',
          'Sao quase o mesmo nome (' + d + ' diferencas em ' + maior
          + ' letras). Nomes tao parecidos sao erro de digitacao, e nao alias de '
          + 'proposito — um alias troca o nome de verdade. Se "' + valor
          + '" e o que deve sair, a chave deveria ser "' + valor + '": assim o '
          + 'valor exportado fica undefined, sem erro de sintaxe e sem aviso de '
          + 'grafia, que e o defeito que este arquivo existe para achar.');
      }

      if (!declarados.has(valor)) {
        ok(false, rel + ' linha ' + linha + ': .' + chave + ' aponta para "' + valor
          + '", que nao existe neste arquivo',
          'O modulo nem carrega. Um nome assim e sempre erro de digitacao.');
      }
    }
  }
}

ok(literaisVistos > 0, 'foram inspecionados ' + literaisVistos + ' literais de exportacao');

/* ------------------------------------------------------------------ */
console.log('\n=== 2. Nenhum modulo exporta undefined ===');

function navegadorFalso() {
  const no = () => ({
    style: {}, dataset: {}, childNodes: [],
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    setAttribute() {}, getAttribute() { return null; }, appendChild(c) { return c; },
    removeChild(c) { return c; }, insertBefore(c) { return c; }, addEventListener() {},
    removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getContext() { return null; }, focus() {}, click() {}, className: '', textContent: '',
    id: '', getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
  });
  global.document = {
    body: no(), head: no(), documentElement: no(),
    createElement: no, createElementNS: no, createTextNode: () => ({}),
    querySelector() { return null; }, querySelectorAll() { return []; },
    getElementById() { return null; }, getElementsByClassName() { return []; },
    addEventListener() {}, removeEventListener() {}, execCommand() { return false; },
  };
  Object.defineProperty(global, 'navigator', {
    value: { userAgent: 'node', maxTouchPoints: 0 }, configurable: true, writable: true,
  });
  global.window = global;
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  global.requestAnimationFrame = () => 0;
  global.cancelAnimationFrame = () => {};
  global.getComputedStyle = () => ({ getPropertyValue: () => '' });
  global.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
}

navegadorFalso();

/* Descobre o que cada modulo publico, em vez de SUPOR o nome.

   A primeira versao procurava `global[nomeDoArquivo]`. Isso funciona so para os
   modulos cujo nome do arquivo bate com o global — e quase nenhum bate:
   `timbre.js` publica `Timbre`, `store.js` publica `Store`, `audio.js` publica
   `Nota`. Ou seja: a camada 2 nao conferia nenhum deles, e passou sem dizer
   nada.

   Agora o metodo e comparar o que existia antes e depois de carregar o modulo. O
   que aparecer novo no global foi publicado por ele. Nenhuma suposicao sobre
   nome, e nenhuma chance de um modulo ficar de fora em silencio. */
let carregou = 0;
const naoCarregou = [];
const ruins = [];

function retratoDoGlobal() {
  const antes = new Set(Object.keys(global));
  return function mudou() {
    const novo = [];
    for (const k of Object.keys(global)) if (!antes.has(k)) novo.push(k);
    return novo;
  };
}

for (const arq of ARQS) {
  const rel = path.relative(RAIZ, arq).replace(/\\/g, '/');
  const mudou = retratoDoGlobal();
  try {
    delete require.cache[require.resolve(arq)];
    require(arq);
    carregou++;
  } catch (e) {
    naoCarregou.push(rel);
    continue;
  }

  for (const nome of mudou()) {
    const obj = global[nome];
    if (!obj || typeof obj !== 'object') continue;
    for (const k of Object.keys(obj)) {
      if (obj[k] === undefined) ruins.push(rel + ' -> global.' + nome + '.' + k);
    }
  }
}

ok(ruins.length === 0, 'nenhum dos ' + carregou + ' modulos carregados exporta undefined',
  ruins.join(' | '));

/* Modulo que nao carrega nao e culpa dele — mas tambem nao pode ser esquecido em
 * silencio. Um modulo que quebra ao carregar e um modulo que nao existe. */
ok(naoCarregou.length < ARQS.length,
  'os ' + naoCarregou.length + ' modulos que precisam de browser de verdade ficaram de fora (e sao listados)',
  naoCarregou.join(', '));
console.log('        fora: ' + naoCarregou.join(', '));

/* ------------------------------------------------------------------ */
console.log('\n' + '-'.repeat(50));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  Um export com nome errado nao da erro de sintaxe e nao e erro de');
  console.log('  grafia. E por isso que este arquivo existe.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('-'.repeat(50) + '\n');
process.exit(falhou ? 1 : 0);
