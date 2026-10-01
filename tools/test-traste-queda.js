/* =========================================================
   ACORDE - tools/test-traste-queda.js
   Quando o 3D cai, o 2D tem que aparecer.

   =========================================================

   Este teste cobre duas formas de o 3D cair, e as duas importam porque sao
   coisas que acontecem em aparelho de verdade, nao em teoria:

     1. A MONTAGEM QUEBRA. Depois que o renderer foi criado e o traste 2D ja
        foi escondido, alguma coisa na cena, na camera ou nos ouvintes falha.

     2. O CONTEXTO WEBGL MORRE. O driver da GPU reinicia, o celular entra em
        economia, o navegador descarta o contexto. O app nao fez nada de errado.

   Em ambas as duas, a tela mostra um aviso que promete "o traste acima mostra a
   mesma coisa". E o que o teste verifica e se a promessa e verdade.

   ---------------------------------------------------------
   O DEFEXITO QUE ESTE TESTE ACHOU

   O aviso do erro de DESENHO devolvia o 2D corretamente. O aviso do erro de
   MONTAGEM nao devolvia — ele so escrevia a frase. Como o plano 2D ja tinha
   sido escondido (`plano.style.display = 'none'`) para dar lugar ao 3D, a tela
   ficava assim:

       "Não consegui abrir o 3D. O traste acima funciona igual."
       (e nao havia traste acima)

   O aviso dizia a verdade ao contrario. E o pior tipo de mentira: nao era erro
   de sintaxe, nao era excecao, nao era aviso faltando. Era uma frase que
   prometia uma coisa e a tela nao tinha.
   ========================================================= */
'use strict';

const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');

let passou = 0;
let falhou = 0;

function ok(recebido, rotulo, detalhe) {
  if (recebido) { passou++; console.log('  ok    ' + rotulo); }
  else {
    falhou++;
    console.log('  FALHA ' + rotulo + (detalhe ? '  ->  ' + detalhe : ''));
  }
}

function igual(recebido, esperado, rotulo) {
  const r = (recebido && typeof recebido === 'object') ? '[no]' : JSON.stringify(recebido);
  const e = (esperado && typeof esperado === 'object') ? '[no]' : JSON.stringify(esperado);
  ok(recebido === esperado, rotulo, 'recebido ' + r + ', esperado ' + e);
}

function secao(t) { console.log('\n=== ' + t + ' ==='); }

/* ------------------------------------------------------------------
   O navegador e o three de mentira.

   Copiados do `test-3d.js` de proposito: duas pecas de teste parecidas sao um
   sinal de que a peca devia ser uma so, e nao um sinal de que tudo bem. O que
   muda aqui e o `Cena`, que e o ator desta historia.
   ------------------------------------------------------------------ */

function navFalso() {
  const estado = { pendentes: new Map(), proximo: 1, ms: 10000 };
  return {
    estado: estado,
    rAF: function (cb) { const id = estado.proximo++; estado.pendentes.set(id, cb); return id; },
    cAF: function (id) { estado.pendentes.delete(id); },
    rodar: function () {
      estado.ms += 100;
      const fila = Array.from(estado.pendentes.entries());
      estado.pendentes.clear();
      for (const [, cb] of fila) cb(estado.ms);
    },
    performance: { now: function () { return estado.ms; } },
  };
}

function elFake() {
  function criar(tag) {
    const ouvintes = {};
    const no = {
      tagName: String(tag).toUpperCase(),
      style: {}, dataset: {},
      _classes: [],
      classList: {
        _s: [],
        add: function (c) { if (this._s.indexOf(c) < 0) this._s.push(c); no._sync(); },
        remove: function (c) {
          const i = this._s.indexOf(c); if (i >= 0) this._s.splice(i, 1);
          if (no.className) no.className = String(no.className).split(/\s+/).filter(function (x) { return x && x !== c; }).join(' ');
        },
        contains: function (c) { return no._classes(no).indexOf(c) >= 0; },
        toggle: function (c, f) {
          if (f === undefined) f = !this.contains(c);
          if (f) { if (this._s.indexOf(c) < 0) this._s.push(c); no._sync(); }
          else this.remove(c);
        },
      },
      /* `contains` precisa ver as DUAS vias.
       *
       * O `Utils.el` de verdade escreve `className = 'x'` direto, e nao passa
       * pelo `classList`. Um falso que so olha o `classList` finds zero classes
       * num no que esta com o nome posto — e o teste acusava a tela de estar
       * vazia quando ela estava cheia.
       *
       * E o caminho inverso tambem: `classList.add()` precisa aparecer no
       * `className`, porque e assim que o codigo real consulta. */
      _classes: function (no) {
        const doLista = (no.classList && no.classList._s) || [];
        const doNome = no.className ? String(no.className).split(/\s+/) : [];
        return doLista.concat(doNome).filter(Boolean);
      },
      /* `_sync` junta, nao substitui.
       *
       * O `Utils.el` escreve `className = 'traste3d-aviso'`. Depois a tela faz
       * `classList.add('visivel')`. Um `_sync` que reescreve `className` com so
       * o que esta no `classList` apaga o nome que o codigo acabou de dar — e
       * o no passa a ser `.visivel` e mais nada. No DOM de verdade `add`
       * ACRECENTA, nunca substitui, e o falso precisa copiar isso. */
      _sync: function () {
        const atuais = this.className ? String(this.className).split(/\s+/).filter(Boolean) : [];
        for (const c of this.classList._s) if (atuais.indexOf(c) < 0) atuais.push(c);
        this.className = atuais.join(' ');
      },
      children: [], parentNode: null, textContent: '', hidden: false,
      clientWidth: 400, clientHeight: 280, width: 0, height: 0,
      appendChild: function (f) { this.children.push(f); f.parentNode = this; return f; },
      removeChild: function (f) {
        const i = this.children.indexOf(f);
        if (i >= 0) this.children.splice(i, 1);
        return f;
      },
      remove: function () { if (this.parentNode) this.parentNode.removeChild(this); },
      closest: function (sel) {
        const alvo = sel.replace('.', '');
        let p = this;
        while (p) { if (p.classList && p.classList.contains(alvo)) return p; p = p.parentNode; }
        return null;
      },
      setAttribute: function (k, v) { this[k] = v; },
      getAttribute: function (k) { return this[k] === undefined ? null : this[k]; },
      addEventListener: function (n, f) { (ouvintes[n] = ouvintes[n] || []).push(f); },
      removeEventListener: function (n, f) {
        const ls = ouvintes[n] || []; const i = ls.indexOf(f);
        if (i >= 0) ls.splice(i, 1);
      },
      dispatch: function (n, ev) { for (const f of (ouvintes[n] || []).slice()) f(ev); },
    };
    no.className = '';
    return no;
  }
  return function (tag, attrs, filhos) {
    const no = criar(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') { for (const c of String(v).split(/\s+/)) if (c) no.classList.add(c); }
        else if (k === 'style' && typeof v === 'object') { for (const s of Object.keys(v)) no.style[s] = v[s]; }
        else no.setAttribute(k, String(v));
      }
    }
    for (const f of (filhos || [])) {
      if (f === null || f === undefined || f === false) continue;
      no.appendChild(typeof f === 'string' ? { text: String(f) } : f);
    }
    return no;
  };
}

/** Um objeto que aceita qualquer chamada e nao quebra.
 *
 * O three de mentira começou como objeto de chaves fixas, e cada rodada
 * apareceu um método novo: `rotateX`, `translate`, `computeVertexNormals`... A
 * cena do violão usa uns quinze construtores e umas trinta operações, e a
 * lista de METHODS que faltam é maior que a lista dos que existem.
 *
 * Enumerar é a abordagem errada: o próximo método entra na lista na semana que
 * vem e o falso quebra de novo, sempre com um erro que fala de geometria e
 * não de teste. Então o falso responde a qualquer chamada com um no-op.
 *
 * A guarda de `then` importa: um proxy que devolve função para tudo seria
 * tratado como entãoável, e qualquer `await` nele esperaria para sempre.
 */
function coringa() {
  const alvo = function () { return coringa(); };
  return new Proxy(alvo, {
    get(t, k) {
      if (k in t) return t[k];
      // `then` tornaria o proxy uma promessa. `Symbol.*` nao e chamada de metodo.
      if (k === 'then' || typeof k === 'symbol') return undefined;
      return coringa();
    },
    set(t, k, v) { t[k] = v; return true; },
    apply() { return coringa(); },
  });
}

function threeFalso() {
  /* A lista vem do codigo, nao da memoria: `violao3d.js` usa `three.X` em
   * quinze lugares, e um falso que esquece um construtor falha na tela sem
   * erro util. */
  const no = function () { return coringa(); };
  return {
    Scene: function () { return coringa(); },
    PerspectiveCamera: no,
    DirectionalLight: no, HemisphereLight: no,
    Group: no, Mesh: no,
    BoxGeometry: no, CircleGeometry: no, CylinderGeometry: no,
    TorusGeometry: no, SphereGeometry: no,
    MeshStandardMaterial: no, MeshBasicMaterial: no,
    BufferGeometry: function () { return coringa(); },
    Float32BufferAttribute: function () { return coringa(); },
    Raycaster: function () { return coringa(); },
    Vector2: function () { return coringa(); },
    Vector3: function (x, y, z) { return coringa(); },
    Color: function () { return coringa(); },
    MathUtils: { clamp: function (v, a, b) { return Math.min(b, Math.max(a, v)); },
      degToRad: function (d) { return d * Math.PI / 180; } },
  };
}

/* ------------------------------------------------------------------
   Monta uma tela de traste com o `Cena` que o teste quiser.
   ------------------------------------------------------------------ */

function achar(no, tag) {
  if (!no || !no.tagName) return null;
  if (no.tagName === tag) return no;
  for (const f of (no.children || [])) { const a = achar(f, tag); if (a) return a; }
  return null;
}

/**
 * @param quebraCena  quando verdadeiro, `Cena.criar` lanca — simula a montagem
 *                    quebrando DEPOIS do 2D ter sumido.
 * @param contextoPerdido quando verdadeiro, o canvas ganha `webglcontextlost`.
 */
function montar(opcoes) {
  opcoes = opcoes || {};
  const nav = navFalso();
  const criar = elFake();

  global.performance = nav.performance;
  global.requestAnimationFrame = nav.rAF;
  global.cancelAnimationFrame = nav.cAF;
  global.addEventListener = function () {};
  global.removeEventListener = function () {};
  global.document = {
    visibilityState: 'visible',
    createElement: criar, createElementNS: criar,
    createTextNode: function (t) { return { text: t }; },
    addEventListener: function () {}, removeEventListener: function () {},
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    documentElement: { classList: { add: function () {}, remove: function () {}, contains: function () { return false; } },
      style: {}, setAttribute: function () {}, getAttribute: function () { return null; } },
    body: { appendChild: function () {}, removeChild: function () {} },
    head: { appendChild: function () {} },
  };
  global.matchMedia = function (q) {
    return { matches: /reduced-motion/.test(q), media: q, addEventListener: function () {} };
  };

  for (const m of ['js/core/utils.js', 'js/core/music.js', 'js/core/render.js',
    'js/core/gfx.js', 'js/core/cena.js', 'js/views/violao3d.js', 'js/views/traste3d.js']) {
    delete require.cache[require.resolve(path.join(RAIZ, m))];
  }

  global.UI = { el: criar, icons: function () {} };
  require(path.join(RAIZ, 'js/core/utils.js'));
  require(path.join(RAIZ, 'js/core/music.js'));
  require(path.join(RAIZ, 'js/core/render.js'));
  let quadros = 0;
  const Gfx = require(path.join(RAIZ, 'js/core/gfx.js'));
  Object.defineProperty(Gfx, 'three', { value: threeFalso(), configurable: true });
  Gfx.carregar = function () { return Promise.resolve(threeFalso()); };
  Gfx.criarRenderer = function () {
    return {
      domElement: { parentElement: { clientWidth: 400, clientHeight: 280 } },
      setSize: function () {}, setPixelRatio: function () {},
      render: function () { quadros++; },
      dispose: function () {}, getContext: function () { return null; },
    };
  };
  Gfx.destruir = function () { /* o contador real e o de Gfx */ };
  /* `estado` tambem precisa de mentira.
   *
   * A tela chama `Gfx.estado()` DENTRO do `.then` da carga, e so monta o 3D se
   * `pronto` for verdade. O `estado` de verdade le uma variavel que o
   * `carregar` de mentira nao preencheu — e a tela recebia "O 3D não está
   * disponível nesta tela", sem nunca chegar na montagem.
   *
   * Era o mesmo desenho do defeito que o `test-3d.js` ja enganou quem o
   * escreveu: a tela tem um caminho que NAO e o caminho de erro, e ele se
   * disfarça de erro. Aqui a montagem nunca acontecia, e o teste acusava uma
   * tela que estava sem 3D por um motivo completamente diferente. */
  const vivosReais = [];
  Gfx.estado = function () {
    return { pronto: true, motivo: 'pronto', temWebGL: true, economia: false,
      vivos: vivosReais.length, ultimoErro: '' };
  };
  Gfx.destruir = function (r) {
    const i = vivosReais.indexOf(r);
    if (i >= 0) vivosReais.splice(i, 1);
  };
  const criarRendererReal = Gfx.criarRenderer;
  Gfx.criarRenderer = function () {
    const r = criarRendererReal();
    vivosReais.push(r);
    return r;
  };
  global.Gfx = Gfx;

  /* O `Cena` de mentira. E o ator: e ele que decide se a montagem quebra e
   * conta se o renderer foi solto. */
  const criado = { called: false, destruido: false, parado: false };
  global.Cena = {
    movimentoDesejado: function () { return false; },
    criar: function () {
      criado.called = true;
      if (opcoes.quebraCena) throw new Error('a cena nao subiu');
      return {
        acordar: function () {}, animar: function () {},
        parar: function () { criado.parado = true; },
        ajustar: function () {},
        destruir: function () { criado.destruido = true; },
      };
    },
  };

  /* `Violao3D` tambem precisa estar carregado.
   *
   * Sem este `require`, a tela caia na guarda "O 3D não está disponível nesta
   * tela" — que e uma SAIDA legitima do codigo, com a mensagem certa e o 2D no
   * lugar. O teste passava a testar a guarda, e nao a queda: ele media uma tela
   * sem 3D, que e o resultado que ele queria produzir.
   *
   * E o mesmo formato de engano que o `test-3d.js` original cometeu com o
   * `Gfx.carregar`: um caminho que nao e o caminho de erro, e que se disfarça de
   * erro. A tela avisa, o aviso parece o esperado, e a causa nao tem nada a ver.
   * Por isso cada parte e carregada na mao e conferida antes. */
  require(path.join(RAIZ, 'js/views/violao3d.js'));
  if (!global.Violao3D || typeof global.Violao3D.criar !== 'function') {
    throw new Error('o teste nao montou: Violao3D nao carregou');
  }

  const Traste3D = require(path.join(RAIZ, 'js/views/traste3d.js'));
  const wrap = Traste3D.mostrar({
    pcs: [0, 2, 4, 5, 7, 9, 11], rootPc: 0, flat: false, frets: 12,
    inst: 'violao', acordes: [],
  });

  return { wrap: wrap, nav: nav, criado: criado, Gfx: Gfx, quadros: function () { return quadros; } };
}

/* ------------------------------------------------------------------
   1. A montagem quebrada
   ------------------------------------------------------------------ */

secao('1. A montagem quebra depois que o 2D ja sumiu');

/* Tudo numa funcao so.
 *
 * A primeira versao encadeava dois blocos — um IIFE e um `.then` — e o ponto e
 * virgula faltou entre eles. O JavaScript colou os dois e o erro foi "is not a
 * function" numa linha que nao tinha nada a ver com o assunto.
 *
 * Uma funcao so nao tem essa classe de problema: nao existe fronteira onde o
 * ponto e virgula possa faltar. E o teste fica legivel de ponta a ponta. */
async function principal() {
  const t = montar({ quebraCena: true });
  await new Promise(function (r) { setTimeout(r, 30); });
  t.nav.rodar();

  const plano = achar(t.wrap, 'DIV');
  const plano2d = (function acharClasse(no) {
    if (!no || !no.tagName) return null;
    if (no.classList && no.classList.contains('traste3d-plano')) return no;
    for (const f of (no.children || [])) { const a = acharClasse(f); if (a) return a; }
    return null;
  })(t.wrap);

  ok(!!plano2d, 'o plano do 2D existe');
  igual(plano2d.style.display, '', 'o 2D esta VISIVEL de novo, depois da falha');
  ok(!t.wrap.classList.contains('tem-3d'), 'a tela ja nao se diz "tem 3D"');

  const aviso = (function acharAviso(no) {
    if (!no || !no.tagName) return null;
    if (no.classList && no.classList.contains('traste3d-aviso')) return no;
    for (const f of (no.children || [])) { const a = acharAviso(f); if (a) return a; }
    return null;
  })(t.wrap);

  ok(!!aviso, 'o aviso existe');
  ok(aviso && aviso.classList.contains('visivel'), 'o aviso esta visivel: a pessoa sabe o que houve');
  ok(aviso && /traste acima/i.test(aviso.textContent || ''),
     'o aviso promete o 2D', 'disse: ' + (aviso && aviso.textContent));

  /* A promessa e verificavel: o aviso diz "o traste acima funciona igual", e o
   * traste acima TEM que estar desenhando. */
  ok(plano2d.children.length > 0, 'o 2D tem conteudo desenhado, e nao e um espaco vazio',
     'o plano tinha ' + plano2d.children.length + ' filho(s)');
  ok(t.criado.called, 'a cena chegou a ser criada (o erro foi depois dela entrar)');
  ok(plano.style.display !== 'none', 'o 2D nao ficou escondido',
     'display=' + JSON.stringify(plano.style.display));

  /* ------------------------------------------------------------------
     2. A perda do contexto WebGL
     ------------------------------------------------------------------ */
  secao('2. O contexto WebGL morre');

  const t2 = montar({});
  await new Promise(function (r) { setTimeout(r, 30); });
  t2.nav.rodar();

  const canvas = achar(t2.wrap, 'CANVAS');
  ok(!!canvas, 'o canvas do 3D foi criado');
  ok(t2.wrap.classList.contains('tem-3d'), 'a tela entrou em 3D');
  ok(!!t2.criado.called, 'o laco foi criado');

  const plano2 = (function acharClasse(no, cls) {
    if (!no || !no.tagName) return null;
    if (no.classList && no.classList.contains(cls)) return no;
    for (const f of (no.children || [])) { const a = acharClasse(f, cls); if (a) return a; }
    return null;
  })(t2.wrap, 'traste3d-plano');
  igual(plano2.style.display, 'none', 'com o 3D na tela, o 2D esta escondido');

  /* O evento. Num aparelho de verdade, o driver da GPU reinicia. */
  let impedido = false;
  canvas.dispatch('webglcontextlost', {
    preventDefault: function () { impedido = true; },
  });

  ok(impedido, 'o app impede o navegador de tomar conta da perda',
     'sem preventDefault o navegador desiste de recuperar o contexto');
  igual(plano2.style.display, '', 'o 2D voltou a aparecer');
  ok(!t2.wrap.classList.contains('tem-3d'), 'a tela deixou de se dizer "tem 3D"');
  ok(t2.criado.destruido || t2.criado.parado, 'o laco foi parado ou destruido');
  ok(!t2.nav.estado.pendentes.size, 'nao sobrou quadro na fila apos a queda');

  const aviso2 = (function acharClasse(no, cls) {
    if (!no || !no.tagName) return null;
    if (no.classList && no.classList.contains(cls)) return no;
    for (const f of (no.children || [])) { const a = acharClasse(f, cls); if (a) return a; }
    return null;
  })(t2.wrap, 'traste3d-aviso');
  ok(aviso2 && aviso2.classList.contains('visivel'), 'a pessoa foi avisada da queda');
  ok(aviso2 && /aparelho/i.test(aviso2.textContent || ''),
     'o aviso diz que foi o aparelho, e nao o app', 'disse: ' + (aviso2 && aviso2.textContent));

  /* A queda nao pode derrubar o 2D nem a tela. */
  ok(plano2.children.length > 0, 'o 2D continua desenhado depois da queda');

  /* E a tela tem que continuar viva depois disso. */
  let explodiu = null;
  try { t2.nav.rodar(); t2.wrap.destruir3d(); } catch (e) { explodiu = e.message; }
  ok(!explodiu, 'rodar e destruir depois da queda nao explode', explodiu);

  /* ------------------------------------------------------------------
     3. A queda duas vezes
     ------------------------------------------------------------------ */
  secao('3. A queda repetida nao acumula nada');

  const t3 = montar({});
  await new Promise(function (r) { setTimeout(r, 30); });
  t3.nav.rodar();
  const cv3 = achar(t3.wrap, 'CANVAS');
  ok(!!cv3, 'o canvas foi criado');
  const vivosDepois = global.Gfx.estado().vivos;
  ok(vivosDepois > 0, 'o renderer conta como vivo enquanto o 3D esta na tela',
     'vivos: ' + vivosDepois);

  cv3.dispatch('webglcontextlost', { preventDefault: function () {} });
  const vivosApos = global.Gfx.estado().vivos;
  igual(vivosApos, 0, 'o renderer foi solto quando o 3D caiu');

  /* O `voltarAo2D` e a mesma funcao para as duas causas; disparar de novo nao
   * pode fazer trabalho dobrado nem estourar a tela. */
  let explodiu2 = null;
  try { cv3.dispatch('webglcontextlost', { preventDefault: function () {} }); } catch (e) { explodiu2 = e.message; }
  ok(!explodiu2, 'a segunda queda nao quebra nada', explodiu2);
  igual(global.Gfx.estado().vivos, 0, 'e o renderer continua solto, sem contar duas vezes');

  /* ------------------------------------------------------------------
     4. O codigo do aviso promete o que o codigo faz
     ------------------------------------------------------------------ */
  secao('4. As frases dos avisos batem com o que acontece');

  /* Um aviso que promete "o traste acima" e um aviso que so faz sentido se o
   * 2D voltar. Este teste nao le a frase: ele LE O QUE A FRASE PROMETE e
   * confere. Se alguem trocar "traste acima" por "tente de novo", a frase
   * continua funcionando e o teste passa — e o defeito volta sem aviso. */
  const src = fs.readFileSync(path.join(RAIZ, 'js/views/traste3d.js'), 'utf8');
  const frases = src.match(/aviso\.textContent\s*=\s*'([^']+)'/g) || [];

  let prometeram2d = 0;
  for (const f of frases) {
    if (/traste acima/i.test(f)) {
      prometeram2d++;
      // A frase que promete tem que estar atras de um `voltarAo2D` ou de um
      // `aoErrar` que restaure o plano.
      ok(/plano\.style\.display\s*=\s*''/.test(src),
         'alguem restaura o 2D em algum caminho');
    }
  }
  ok(prometeram2d > 0, 'existe pelo menos um aviso que promete o 2D',
     'encontradas: ' + prometeram2d);

  console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
  console.log('=================================================\n');
  process.exit(falhou ? 1 : 0);
}

principal().catch(function (e) {
  console.error('\nO TESTE QUEBROU:');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
