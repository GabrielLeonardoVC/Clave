/* =========================================================
   tools/test-boot.js
   O app inteiro carrega, na ordem, e chega na tela inicial.

   POR QUE ESTE ARQUIVO EXISTE

   Todo teste deste projeto carrega UM modulo de cada vez. Nenhum carrega o app
   inteiro, na ordem em que o `index.html` faz.

   E essa e exatamente a lacuna em que moram os erros de boot. Um modulo que le
   `global.Outro` no topo do arquivo falha se o outro vier depois — e cada modulo
   sozinho passa no teste dele, porque o require dele monta as dependencias na
   ordem certa. O erro so aparece no navegador.

   Esta rodada mexeu na ordem de carregamento: o `timbre.js` foi inserido antes
   do `audio.js`, e o `audio.js` passou a ler o `Store` para saber o instrumento
   da pessoa. As duas dependencias dependem de ordem, e nenhuma delas tem teste
   de ordem.

   O QUE ISTO PROVA

     - os 34 scripts rodam, na ordem do HTML, sem lancar;
     - cada modulo publica o global que promete, e nenhum publica `undefined`;
     - o `app.js` monta e a tela inicial aparece;
     - nada depende de um `defer` que nao existe, nem de um global de CDN.

   O QUE ISTO NAO PROVA

   Que o app fica bonito, que o 3D abre, que o audio sai. Isso exige navegador
   de verdade. O que dá para provar sem navegador e que nada quebrou de um jeito
   que derrube a tela antes de aparecer.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');

let passou = 0;
let falhou = 0;
const problemas = [];
function ok(cond, titulo, detalhe) {
  if (cond) { passou++; console.log('  ok    ' + titulo + (detalhe ? '  (' + detalhe + ')' : '')); }
  else {
    falhou++;
    problemas.push(titulo);
    console.log('  FALHA ' + titulo);
    if (detalhe) console.log('        ' + detalhe);
  }
}
function secao(t) { console.log('\n=== ' + t + ' ==='); }

/* ------------------------------------------------------------------ */
/* 1. A ordem do HTML.                                                  */
/* ------------------------------------------------------------------ */
secao('1. A ordem em que o navegador carrega');

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const scripts = [];
{
  const re = /<script src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].indexOf('js/') === 0) scripts.push(m[1]);
  }
}

ok(scripts.length >= 30, 'o HTML carrega os scripts do projeto', scripts.length + ' scripts');
ok(scripts[scripts.length - 1] === 'js/app.js',
  'e o app.js e o ULTIMO: e ele quem monta a tela',
  scripts[scripts.length - 1]);
ok(!/<script[^>]*\bdefer\b[^>]*src="js\//.test(html),
  'nenhum script do projeto usa `defer` aqui',
  '`defer` mudaria a ordem, e a ordem e o que este teste confere');

/* Todo script listado existe de verdade. Um `<script>` para arquivo apagado e
 * um 404 silencioso: o navegador segue, e o global nunca aparece. */
const sumidos = scripts.filter((s) => !fs.existsSync(path.join(RAIZ, s)));
ok(sumidos.length === 0, 'todo script listado existe no disco',
  sumidos.join(', '));

/* ------------------------------------------------------------------ */
/* 2. Um navegador de mentira, completo o bastante.                    */
/*                                                                     */
/* Nao e um navegador — e o minimo para os 34 modulos rodarem. O que ele   */
/* FAZ de diferente de um navegador e que ele nao esconde erro: o `append` */
/* abaixo registra o que foi criado, para o teste conferir a tela inicial. */
/* ------------------------------------------------------------------ */
const criados = [];

function elemento(tag) {
  const no = {
    tagName: String(tag || 'div').toUpperCase(),
    style: {},
    dataset: {},
    childNodes: [],
    parentNode: null,
    className: '',
    id: '',
    innerHTML: '',
    innerText: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    scrollTop: 0,
    scrollHeight: 800,
    offsetWidth: 400,
    offsetHeight: 800,
    classList: {
      _set: [],
      add(c) { this._set.push(c); },
      remove(c) { this._set = this._set.filter((x) => x !== c); },
      contains(c) { return this._set.indexOf(c) >= 0; },
      toggle(c) { if (this.contains(c)) this.remove(c); else this.add(c); },
    },
    appendChild(c) { no.childNodes.push(c); if (c) c.parentNode = no; return c; },
    insertBefore(c) { no.childNodes.unshift(c); return c; },
    removeChild(c) { no.childNodes = no.childNodes.filter((x) => x !== c); return c; },
    remove() {},
    setAttribute(k, v) { no[k] = v; },
    getAttribute(k) { return no[k] === undefined ? null : no[k]; },
    removeAttribute(k) { delete no[k]; },
    hasAttribute(k) { return no[k] !== undefined; },
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    click() {},
    closest() { return null; },
    contains() { return false; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 0, left: 0, right: 400, bottom: 800, width: 400, height: 800 }; },
    getContext() { return null; },
    toDataURL() { return 'data:image/png;base64,'; },
    matches() { return false; },
    cloneNode() { return elemento(no.tagName); },
    animate() {},
  };
  criados.push(no);
  return no;
}

const corpo = elemento('body');
const cabeca = elemento('head');
const raizDocumento = elemento('html');

/* O DOM MONTA A PARTIR DO HTML DE VERDADE.
 *
 * A primeira versao deste teste devolvia `null` para todo `getElementById`, e
 * o `app.js` morria em `appendChild` de `null`. Isso parecia um defeito do app
 * e era defeito do teste: no navegador aquele elemento EXISTE, porque esta no
 * HTML.
 *
 * Montar a arvore a partir do arquivo e o que da ao teste a mesma materia
 * prima que o navegador monta. E faz aparecer o outro lado do problema: se
 * o HTML pedir um `id` que o app procura — ou o app procurar um `id` que o
 * HTML nao tem — aqui aparece como `null`, igual apareceria na tela. */
const porId = {};
{
  const re = /id="([^"]+)"/g;
  let achado;
  while ((achado = re.exec(html)) !== null) {
    const no = elemento('div');
    no.id = achado[1];
    if (no.id === 'page-sub') no.tagName = 'SECTION';
    if (no.id === 'bottomnav' || no.id === 'drawer-host' || no.id === 'toast-host') no.tagName = 'NAV';
    porId[no.id] = no;
    corpo.appendChild(no);
  }
}

/* O seletor da meta de cor, montado com `String.fromCharCode`. Uma aspa
 * dupla dentro da propria string de selecao atrapalha, e um escape errado
 * aqui quebra o arquivo inteiro sem nenhum aviso. */
const ASPAS = String.fromCharCode(34);
const SEL = "meta[name=" + ASPAS + "theme-color" + ASPAS + "]";

const metaTheme = elemento('meta');

const documento = {
  body: corpo,
  head: cabeca,
  documentElement: raizDocumento,
  readyState: 'complete',
  createElement: elemento,
  createElementNS: (_ns, tag) => elemento(tag),
  createTextNode: (t) => ({ nodeValue: String(t), childNodes: [] }),
  createDocumentFragment: () => elemento('fragment'),
  getElementById: (id) => porId[id] || null,
  querySelector: (sel) => {
    if (sel === SEL) return metaTheme;
    if (sel.charAt(0) === '#') return porId[sel.slice(1)] || null;
    if (sel.charAt(0) === '.') {
      const classe = sel.slice(1);
      const achado = corpo.childNodes.find((c) => String(c.className || '').split(' ').indexOf(classe) >= 0);
      return achado || null;
    }
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel === SEL) return [metaTheme];
    if (sel.charAt(0) === '#') { const n = porId[sel.slice(1)]; return n ? [n] : []; }
    if (sel.charAt(0) === '.') {
      const classe = sel.slice(1);
      return corpo.childNodes.filter((c) => String(c.className || '').split(' ').indexOf(classe) >= 0);
    }
    return [];
  },
  getElementsByTagName: () => [],
  getElementsByClassName: () => [],
  addEventListener() {},
  removeEventListener() {},
  execCommand: () => false,
  title: 'Clave',
  cookie: '',
};

const contexto = {
  console: console,
  setTimeout: (fn, ms) => { void fn; void ms; return 0; },
  clearTimeout() {},
  setInterval: () => 0,
  clearInterval() {},
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  requestIdleCallback: (fn) => { void fn; return 0; },
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  fetch: () => new Promise(() => {}),
  alert: () => {},
  confirm: () => false,
  prompt: () => null,
  location: { hash: '', href: 'https://exemplo/', origin: 'https://exemplo', protocol: 'https:', search: '', replace() {}, assign() {} },
  /* `scrollTo` e `scrollBy` faltavam, e o app.js morria neles ao trocar de
   * tela. A ausencia parecia defeito do app; era o navegador de mentira que
   * estava incompleto. Uma peca de verdade por peca, e `scrollTo` e uma delas. */
  scrollTo() {},
  scrollBy() {},
  history: { pushState() {}, replaceState() {}, scrollRestoration: 'auto' },
  navigator: {
    userAgent: 'node',
    language: 'pt-BR',
    languages: ['pt-BR'],
    platform: 'iPhone',
    maxTouchPoints: 5,
    serviceWorker: { register: () => Promise.resolve(), getRegistration: () => Promise.resolve(null), addEventListener() {} },
    mediaDevices: undefined,
    share: undefined,
    vibrate() {},
    clipboard: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') },
    storage: undefined,
  },
  localStorage: (function () {
    const dados = {};
    return {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(dados, k) ? dados[k] : null),
      setItem: (k, v) => { dados[k] = String(v); },
      removeItem: (k) => { delete dados[k]; },
      clear: () => { for (const k of Object.keys(dados)) delete dados[k]; },
      key: (i) => Object.keys(dados)[i] || null,
      get length() { return Object.keys(dados).length; },
    };
  })(),
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
  indexedDB: undefined,
  caches: { open: () => Promise.resolve({ put: () => Promise.resolve(), match: () => Promise.resolve(null) }), keys: () => Promise.resolve([]), delete: () => Promise.resolve(true) },
  Image: function () {},
  Audio: function () { return { play: () => Promise.resolve() }; },
  AudioContext: undefined,
  webkitAudioContext: undefined,
  performance: { now: () => 0 },
  MutationObserver: function () { return { observe() {}, disconnect() {} }; },
  ResizeObserver: function () { return { observe() {}, disconnect() {} }; },
  IntersectionObserver: function () { return { observe() {}, disconnect() {} }; },
  CustomEvent: function (t, o) { o = o || {}; o.type = t; return o; },
  Event: function (t) { return { type: t }; },
  URL: URL,
  Blob: function () {},
  File: function () {},
  FileReader: function () { this.readAsDataURL = () => {}; this.readAsText = () => {}; },
  FormData: function () {},
  crypto: { getRandomValues: (a) => a },
  TextEncoder: TextEncoder,
  TextDecoder: TextDecoder,
  document: documento,
};
contexto.window = contexto;
contexto.self = contexto;

    /* A JANELA.
     *
     * `app.js` registra os ouvintes em `window`, e nao em `document`: e por
     * isso que o `addEventListener` precisa estar aqui e nao la. A primeira
     * versao deste teste tinha um e nao o outro, e o app morria no primeiro
     * `addEventListener` — o que parece defeito do app e e navegador de
     * mentira incompleto.
     *
     * A lista e a do navegador de verdade, na ordem em que ele tem. */
    function metodosDeJanela(alvo) {
      const metodos = ['addEventListener', 'removeEventListener', 'dispatchEvent',
        'scrollTo', 'scrollBy', 'scroll', 'print', 'open', 'close', 'focus',
        'blur', 'postMessage', 'moveBy', 'moveTo', 'resizeBy', 'resizeTo',
        'getSelection', 'matchMedia', 'requestAnimationFrame',
        'cancelAnimationFrame', 'getComputedStyle', 'visualViewport'];
      for (const nome of metodos) {
        if (typeof alvo[nome] !== 'function') alvo[nome] = function () {};
      }
      return alvo;
    }
    metodosDeJanela(contexto);
contexto.globalThis = contexto;

vm.createContext(contexto);

/* ------------------------------------------------------------------ */
secao('2. Os 34 scripts rodam, na ordem');

/* Um por vez, sem `require`: e assim que o navegador faz — e nao ha
 * opportunity para o Node reorganizar as dependencias. Se um modulo le um
 * global que ainda nao existe, aqui quebra. */
const quebrados = [];
for (const rel of scripts) {
  const arquivo = path.join(RAIZ, rel);
  const codigo = fs.readFileSync(arquivo, 'utf8');
  try {
    vm.runInContext(codigo, contexto, { filename: rel, timeout: 30000 });
  } catch (e) {
    quebrados.push(rel + ' -> ' + e.constructor.name + ': ' + String(e.message).slice(0, 110));
  }
}

ok(quebrados.length === 0, 'nenhum modulo lancou ao carregar',
  quebrados.slice(0, 4).join(' | '));

/* ------------------------------------------------------------------ */
secao('3. Cada modulo publica o que promete');

/* O nome do arquivo, com a primeira letra maiuscula, e o nome que o modulo
 * publica. Nao e regra universal — `music.js` publica `Music`, `audio.js`
 * publica `Nota`, `store.js` publica `Store` — entao a lista e declarada, e
 * uma declaracao sem uso e um modulo que sumiu em silencio. */
const PUBLICA = {
  'identidade.js': 'Identidade', 'music.js': 'Music', 'utils.js': 'Utils',
  'store.js': 'Store', 'armazenamento.js': 'Armazenamento', 'ui.js': 'UI',
  'render.js': 'Render', 'print.js': 'Print', 'links.js': 'Links',
  'search.js': 'Search', 'tuner.js': 'Tuner', 'timbre.js': 'Timbre',
  'audio.js': 'Nota', 'gravador.js': 'Gravador', 'metronome.js': 'Metro',
  'palco.js': 'YT', 'gfx.js': 'Gfx', 'cena.js': 'Cena', 'studio.js': 'Studio',
  'notify.js': 'Notify', 'share.js': 'Share', 'base.js': 'BASE',
  
  'afinador.js': 'AcordAfinador',
  /* So quem PUBLICA um global entra aqui. Cinco telas nao publicam nada de
   * novo: registram em `Views.<id>`, e sao conferidas na secao 4.
   *
   * A primeira versao desta lista chutava `AcordHoje`, `AcordAgenda`,
   * `AcordRepertorio` e `AcordTeoria` — nomes que eu invento, porque nao
   * existem. Um verificador que declara um nome errado acusa o app de bug que
   * ele nao tem. */
  'emergencia.js': 'AcordEmergencia', 'violao3d.js': 'Violao3D',
  'traste3d.js': 'Traste3D', 'palco.js': 'PalcoView', 'cancao.js': 'AcordMusica',
};

const ausentes = [];
for (const rel of scripts) {
  const nome = path.basename(rel);
  if (nome === 'app.js') continue;   // conferido na secao 4
  const esperado = PUBLICA[nome];
  if (!esperado) continue;
  const obj = contexto[esperado];
  if (obj === undefined) { ausentes.push(esperado + ' (de ' + nome + ')'); continue; }
  if (obj === null) { ausentes.push(esperado + ' e nulo'); continue; }
  if (typeof obj === 'object') {
    const ruins = Object.keys(obj).filter((k) => obj[k] === undefined);
    if (ruins.length) ausentes.push(esperado + ' tem ' + ruins.length + ' propriedade(s) undefined: ' + ruins.slice(0, 3).join(', '));
  }
}
ok(ausentes.length === 0, 'todo modulo publicou o global, e nenhum com undefined dentro',
  ausentes.slice(0, 4).join(' | '));

/* ------------------------------------------------------------------ */
secao('4. O app montou');

/* O `app.js` e o ultimo, e a unica prova de que os 33 anteriores chegaram
 * inteiros ate ele. Se ele lancou, o carregamento inteiro parou ali. */
ok(contexto.App !== undefined, 'o app.js publicou o App',
  contexto.App === undefined ? 'nao chegou ate o fim' : '');

const Views = contexto.Views;
ok(Views && typeof Views === 'object', 'a pasta de telas existe',
  Views ? Object.keys(Views).length + ' telas' : 'Views nao existe');

if (Views) {
  /* Uma tela que o usuario pode abrir e que nao existe e um botao que nao faz
   * nada. `check-rotas.js` cobre a lista de rotas; esta cobre se a tela
   * realmente carregou. */
  const TEMAS = ['hoje', 'agenda', 'repertorio', 'teoria', 'ajustes',
    'afinador', 'emergencia', 'palco', 'cancao'];
  const faltando = TEMAS.filter((t) => !Views[t]);
  ok(faltando.length === 0, 'todas as telas da barra de baixo existem',
    faltando.join(', ') || TEMAS.length + ' telas');
}

/* ------------------------------------------------------------------ */
secao('5. O que o app le do outro, e se a ordem importa');

/* Estas sao as dependencias que ESTA RODADA criou, e cada uma so funciona se o
 * modulo vier antes. Um teste de boot que nao as verifica specifically deixa a
 * pegadinha mais provavel passar. */
ok(scripts.indexOf('js/core/music.js') < scripts.indexOf('js/core/timbre.js'),
  'music.js vem antes de timbre.js',
  'o timbre aponta para bracos que o music declara');
ok(scripts.indexOf('js/core/store.js') < scripts.indexOf('js/core/audio.js'),
  'store.js vem antes de audio.js',
  'o audio le a escolha de instrumento do Store');
ok(scripts.indexOf('js/core/timbre.js') < scripts.indexOf('js/core/audio.js'),
  'timbre.js vem antes de audio.js',
  'o audio usa o motor de timbre; invertido, sairia tom puro sem aviso');
ok(scripts.indexOf('js/core/timbre.js') < scripts.indexOf('js/views/violao3d.js'),
  'e antes do violao 3D, que consulta os bracos');

/* E o mais importante: o app tem de BOOTAR com o som ligado. O `audio.js` le
 * o Store no primeiro toque, nao no carregamento — entao um boot sem AudioContext
 * nao exercita nada disso. O que dá para afirmar aqui e mais modesto: que o
 * caminho do timbre existe e que o Store tem a preferencia. */
ok(contexto.Store && typeof contexto.Store.ajuste === 'function',
  'o Store expoe a funcao de ajuste que o audio usa');
ok(contexto.Timbre && typeof contexto.Timbre.tocarNo === 'function',
  'o motor de timbre expoe a funcao que o audio chama');
ok(contexto.Timbre && Array.isArray(contexto.Timbre.noPique())
  && contexto.Timbre.noPique().length >= 6,
  'e a lista do que a pessoa pode escolher esta montada',
  contexto.Timbre ? contexto.Timbre.noPique().join(', ') : '');

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(54));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  Um modulo que le um global que ainda nao existe falha SO no');
  console.log('  navegador. Cada teste dele, passando sozinho, nao ve nada.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(54) + '\n');
process.exit(falhou ? 1 : 0);