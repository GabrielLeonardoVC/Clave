/* =========================================================
   ACORDE - tools/dom-falso.js
   O DOM minimo para carregar uma VIEW em Node.

   POR QUE UM ARQUIVO NOVO

   `cancao.js` e `hoje.js` montam tela no `abrir`/`render`, e nao tem como
   exercitar o comportamento deles em Node sem um DOM. A segunda suite comecou a
   copiar o arquivo inteiro — e codigo copiado diverge: uma delas passa a medir
   `textContent` e a outra nao, e nenhuma das duas avisa.

   Este arquivo e a unica copia. Ele nao e um DOM completo, e nao pretende ser:
   e o suficiente para o que estas telas fazem, e nada alem.

   O QUE ELE FAZ, E POR QUE CADA PARTE EXISTE

   - `click()` DESPACHA o ouvinte. Sem isso o botao existiria e nao faria
     nada, e o teste mediria a PRESENCA do botao — a forma mais facil de um
     teste passar sem provar nada.
   - `textContent` e CALCULADO a partir dos filhos. Com um texto solto, a busca
     na arvore nao acha nada: o botao existe mas o pai devolve string vazia, e
     o teste acaba procurando no documento inteiro, onde o botao de outra tela
     responde por ele.
   - `setAttribute('disabled')` reflete na PROPRIEDADE, como no navegador.
     Sem isso, um botao desabilitado chega aqui habilitado e o teste mede o
     DOM falso em vez do produto.

   O QUE ELE NAO FAZ

   Nao simula layout: nao tem `getBoundingClientRect` util, nao tem CSS
   aplicado e nao mede nada que dependa de largura de tela. Coisa de layout e
   do navegador — e foi medida no navegador, na caixa de 390px, com os
   numeros anotados no CSS da regua.
   ========================================================= */
'use strict';

/* Cada `toDataURL` devolve uma string diferente. Sem isso, duas exportacoes
   com o mesmo numero de tracos seriam indistinguiveis, e uma suite nao
   conseguiria dizer se o que foi para o registro era a imagem nova ou a
   antiga. */
let CONTADOR_EXPORTACAO = 0;


const memoria = new Map();

/** Casa um no com um seletor simples: `.classe` ou `tag`. */
function casa(no, sel) {
  if (!no || !no.tagName) return false;
  if (sel.charAt(0) === '.') {
    const cls = sel.slice(1);
    return typeof no.className === 'string' && no.className.split(/\s+/).indexOf(cls) >= 0;
  }
  return no.tagName === sel.toUpperCase();
}

/** Todos os descendentes que casam, em ordem de documento. */
function varrer(raiz, sel) {
  const achados = [];
  for (const c of [].concat(raiz.childNodes || [])) {
    if (!c) continue;
    if (casa(c, sel)) achados.push(c);
    if (c.tagName) achados.push.apply(achados, varrer(c, sel));
  }
  return achados;
}

/** Um no. Chame sempre por `elemento()`. */
function elemento(tag) {
  const no = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    childNodes: [],
    parentNode: null,
    nodeName: String(tag || 'div').toUpperCase(),
    className: '',
    id: '',
    innerHTML: '',
    innerText: '',
    _text: '',
    value: '',
    checked: false,
    disabled: false,
    title: '',
    type: '',
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 800,
    scrollWidth: 400,
    offsetWidth: 400,
    offsetHeight: 800,
    dataset: {},
    style: {},
    _ouv: {},
    _attrs: {},
    classList: {
      _set: [],
      add(c) { if (this._set.indexOf(c) < 0) this._set.push(c); },
      remove(c) { this._set = this._set.filter((x) => x !== c); },
      contains(c) { return this._set.indexOf(c) >= 0; },
      toggle(c) { if (this.contains(c)) this.remove(c); else this.add(c); },
    },
    appendChild(c) {
      no._text = '';
      no.childNodes.push(c);
      if (c) c.parentNode = no;
      return c;
    },
    insertBefore(c) {
      no._text = '';
      no.childNodes.unshift(c);
      if (c) c.parentNode = no;
      return c;
    },
    removeChild(c) { no.childNodes = no.childNodes.filter((x) => x !== c); return c; },
    remove() {},
    setAttribute(k, v) {
      no._attrs[k] = String(v);
      if (k === 'class') no.className = String(v);
      /* Estes reflexam na propriedade, como no navegador. `value` e o caso que
         mais importa aqui: o formulario de edicao preenche os campos com
         `el('input', { value: ... })`. Sem este reflexo o campo abria VAZIO ao
         editar, o `Salvar` era recusado em silencio pelo titulo vazio, e a
         suite media o DOM falso em vez do produto. */
      if (k === 'value') no.value = String(v);
      if (k === 'placeholder') no.placeholder = String(v);
      if (k === 'disabled') no.disabled = true;
      if (k === 'checked') no.checked = true;
      if (k === 'title') no.title = String(v);
      if (k === 'type') no.type = String(v);
      if (k === 'id') no.id = String(v);
    },
    getAttribute(k) { return no._attrs[k] === undefined ? null : no._attrs[k]; },
    removeAttribute(k) { delete no._attrs[k]; },
    hasAttribute(k) { return no._attrs[k] !== undefined; },
    addEventListener(n, f) { (no._ouv[n] = no._ouv[n] || []).push(f); },
    removeEventListener(n, f) {
      const l = no._ouv[n] || [];
      const i = l.indexOf(f);
      if (i >= 0) l.splice(i, 1);
    },
    dispatch(n, ev) {
      for (const f of (no._ouv[n] || []).slice()) {
        try { f(ev || { type: n, target: no, preventDefault() {}, stopPropagation() {} }); }
        catch (e) { throw new Error('ouvinte de "' + n + '" no ' + no.tagName + ': ' + e.message); }
      }
    },
    dispatchEvent(ev) {
      const nome = (ev && ev.type) || 'input';
      no.dispatch(nome, ev);
      return true;
    },
    click() {
      no.dispatch('click', { type: 'click', target: no, preventDefault() {}, stopPropagation() {} });
    },
    focus() { no._focado = true; },
    /* A rolagem da cifra chama `scrollTo` e depois le `scrollTop` de novo. Sem
       os dois, abrir uma musica com letra morre num `TypeError` que esconde o
       que a suite queria medir. */
    scrollTo() { /* sem layout, nao ha para onde rolar */ },
    /* `firstChild` e `children` sao lidos direto pelo codigo de produto — a barra
       de progresso da cifra escreve em `prog.firstChild.style`. Sem eles, abrir
       uma musica com letra morre num `TypeError` que nada tem a ver com o que a
       suite queria medir. */
    get firstChild() { return no.childNodes[0] || null; },
    get children() { return no.childNodes.slice(); },
    get lastChild() { return no.childNodes[no.childNodes.length - 1] || null; },
    blur() { no._focado = false; },
    /* `focus()` precisa deixar rastro: um verificador que diz "o foco foi para
       o campo" sem olhar para onde o foco foi, so esta repetindo o codigo. */
    recebeuFoco() { return !!no._focado; },
    closest() { return null; },
    contains() { return false; },
    /* Busca de verdade na arvore. Sem ela, `querySelectorAll` devolvia `[]` para
       qualquer coisa, e um teste que precisa achar o campo "BPM" dentro da
       folha nao achava — nem quando o campo estava ali, escrito certinho.
       Cobre o que estas telas pedem: uma classe (`.field`) ou um nome de tag
       (`button`). NAO e um motor de CSS: nao ha descendente, nem atributo, nem
       pseudo-classe. O que nao for isso precisa ser feito percorrendo a arvore,
       e as suites fazem isso. */
    querySelectorAll(sel) {
      const bruto = String(sel || '').trim();
      if (!bruto) return [];
      /* A lista e dividida ANTES do teste: `input, select, textarea` tem espacos
         depois das virgulas, e testar o espaco primeiro descartava a lista
         inteira — que e exatamente a forma que o codigo do projeto usa para
         achar o controle de um campo. */
      const partes = bruto.split(',').map((s) => s.trim()).filter(Boolean);
      /* Descendente (`a b`), filho (`>`), irmao (`~`), atributo (`[`) e
         pseudo-classe (`:`) nao sao suportados: devolvem `[]`, nunca um
         resultado errado. */
      if (!partes.length || partes.some((p) => /[\s>+~:]/.test(p) || p.indexOf('[') >= 0)) return [];
      const achados = [];
      for (const p of partes) {
        for (const n of varrer(no, p)) {
          if (achados.indexOf(n) < 0) achados.push(n);
        }
      }
      return achados;
    },
    querySelector(sel) {
      return no.querySelectorAll(sel)[0] || null;
    },
    getBoundingClientRect() { return { top: 0, left: 0, right: 400, bottom: 800, width: 400, height: 800 }; },
    /* Um contexto 2D que ANOTA o que foi desenhado, em vez de devolver nulo.
     *
     * Com `null`, o pincel do Estúdio morria no primeiro `ctx.strokeStyle`, e
     * qualquer suite que tentasse desenhar mediria o `TypeError` em vez do
     * comportamento. Aqui cada `stroke()` vira um registro, e `toDataURL`
     * transforma a contagem em um data URL — o que basta para provar que a
     * composição aconteceu e que o resultado DIFFERENTE foi para o registro
     * certo. Pixel de verdade é do navegador; aqui o que se prova é o
     * caminho, e o caminho é o que estava em dúvida. */
    getContext(tipo) {
      if (tipo !== '2d') return null;
      if (!no._ctx) {
        const ctx = {
          canvas: no,
          fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', lineJoin: '',
          globalCompositeOperation: 'source-over',
          _tracos: [], _imagens: [],
          fillRect() {},
          clearRect() {},
          drawImage(img) { ctx._imagens.push(img ? (img.tagName || 'img') : 'null'); },
          beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {},
          save() {}, restore() {}, translate() {}, scale() {}, setTransform() {},
          stroke() { ctx._tracos.push({ cor: ctx.strokeStyle, ferramenta: ctx.globalCompositeOperation }); },
          fill() {},
          measureText() { return { width: 0 }; },
        };
        no._ctx = ctx;
      }
      return no._ctx;
    },
    /* Quantos tracos tem este canvas, mais um contador de exportacao. Dois
       rabiscos nao podem dar a mesma string que um — e e isso que a suite usa
       para provar que as anotacoes se acumulam em vez de se substituirem. */
    toDataURL() {
      const n = no._ctx ? no._ctx._tracos.length : 0;
      CONTADOR_EXPORTACAO += 1;
      return 'data:image/jpeg;base64,FALSO' + String(n) + '-' + String(CONTADOR_EXPORTACAO);
    },
    matches() { return false; },
    cloneNode() { return elemento(no.tagName); },
    animate() {},
    get textContent() {
      if (no.childNodes.length === 0) return no._text;
      return no.childNodes
        .map((c) => (c && c.textContent !== undefined ? c.textContent : String(c == null ? '' : c)))
        .join('');
    },
    set textContent(v) { no._text = String(v == null ? '' : v); no.childNodes = []; },
  };
  return no;
}

/* As chaves que o app procura com `getElementById` sao as do `index.html`.
   Devolver `null` delas e o jeito mais facil de um teste passar measuring a
   tela errada. */
const IDS = ['toast-host', 'page-sub', 'bottomnav', 'drawer-host', 'main', 'modal-host'];

function instalar() {
  const corpo = elemento('body');
  const raizDocumento = elemento('html');
  const porId = {};

  const documento = {
    body: corpo,
    head: elemento('head'),
    documentElement: raizDocumento,
    createElement: elemento,
    createElementNS: (_ns, tag) => elemento(tag),
    createDocumentFragment: () => elemento('fragment'),
    getElementById: (id) => porId[id] || null,
    createTextNode: (t) => ({ nodeName: '#text', textContent: String(t) }),
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    hidden: false,
    visibilityState: 'visible',
    fullscreenEnabled: false,
    fullscreenElement: null,
  };

  IDS.forEach((id) => {
    const n = elemento('div');
    n.id = id;
    porId[id] = n;
    corpo.appendChild(n);
  });

  global.document = documento;
  global.window = global;

  /* O pincel do Estúdio pendura ouvintes na JANELA (`pointerup`), não no
     documento — e é o `pointerup` que fecha o traço e o coloca no histórico.
     Como aqui `window` é o próprio `global` do Node, esses ouvintes precisam
     existir de verdade: um `addEventListener` que não guarda nada faz o traço
     nunca ser registrado, e `temAlgo()` responder sempre "não". */
  const OUVINTES_JANELA = {};
  global.addEventListener = function (n, f) { (OUVINTES_JANELA[n] = OUVINTES_JANELA[n] || []).push(f); };
  global.removeEventListener = function (n, f) {
    OUVINTES_JANELA[n] = (OUVINTES_JANELA[n] || []).filter(function (x) { return x !== f; });
  };
  global.dispatchEvent = function (ev) {
    (OUVINTES_JANELA[ev && ev.type] || []).slice().forEach(function (f) { f(ev); });
    return true;
  };

  /* `navigator` e somente-leitura no Node moderno. O mesmo guarda de
     `test-execucao.js`: tenta atribuir e, se recusarem, segue com o `navigator`
     que o proprio Node oferece. */
  if (typeof global.navigator === 'undefined') global.navigator = {};
  else if (!global.navigator.mediaDevices) {
    try { global.navigator = { mediaDevices: {} }; } catch (e) { /* somente-leitura */ }
  }

  global.requestAnimationFrame = () => 0;
  global.cancelAnimationFrame = () => {};

  /* `Image` existe para o pincel do Estúdio. Carregar a foto da música chama
     `new Image()` e espera `onload`; sem isto, abrir uma música com foto morre
     num `ReferenceError` que não tem nada a ver com o que a suite mede. As
     dimensões são fixas porque aqui não há decodificação de verdade — o que se
     prova é o caminho, e o caminho depende de `naturalWidth`, não do valor. */
  global.Image = function () {
    const img = {
      tagName: 'IMG', naturalWidth: 512, naturalHeight: 512,
      onload: null, onerror: null, complete: false,
    };
    let interno = '';
    Object.defineProperty(img, 'src', {
      get() { return interno; },
      set(v) {
        interno = v;
        img.complete = true;
        setTimeout(() => { if (typeof img.onload === 'function') img.onload(); }, 0);
      },
    });
    return img;
  };
  global.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });

  global.localStorage = {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => { memoria.set(k, String(v)); },
    removeItem: (k) => memoria.delete(k),
    clear: () => memoria.clear(),
    key: () => null,
    get length() { return memoria.size; },
  };

  return { documento, corpo, porId, elemento };
}

/** Carrega um modulo do projeto do zero, ignorando o cache do `require`. */
function carregar(RAIZ, rel) {
  const path = require('path');
  const alvo = path.join(RAIZ, rel);
  delete require.cache[require.resolve(alvo)];
  return require(alvo);
}

/** Procura um no pelo TEXTO visivel, andando a arvore de verdade. */
function porTexto(raiz, re) {
  const andar = (no) => {
    if (!no) return null;
    for (const c of [].concat(no.childNodes || [])) {
      if (!c) continue;
      if (re.test(c.textContent || '')) {
        if (c.tagName === 'BUTTON' || c.tagName === 'A') return c;
        const dentro = andar(c);
        if (dentro) return dentro;
      }
      const achado = andar(c);
      if (achado) return achado;
    }
    return null;
  };
  return andar(raiz);
}

module.exports = { instalar, carregar, elemento, porTexto };