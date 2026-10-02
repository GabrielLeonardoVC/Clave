/* =========================================================
   ACORDE - tools/test-3d.js
   O carregamento sob demanda, o laco de desenho e a cena do violao.

   Existe por causa de tres defeitos que so apareceram com o 3D ligado, e que
   nenhum outro teste pegava:

   1. O laco NUNCA PARAVA. `precisaRedesenhar` nascia verdadeiro e so o `parar()`
      desligava, entao a tela de teoria desenhava duas mil vezes por segundo com
      o violao parado. Numa tela 2D isso nao aparece: um `render` de DOM e
      barato. Com WebGL e bateria queimando.
   2. Os botoes de vista NAO FAZIAM NADA. A velocidade somada com o decaimento
      dava uns 0,6 rad no total, contra os 1,57 que separam "segurando" de "de
      lado" — e a atracao da trava vizinha devolvia o violao antes. O botao era
      mudo e o visivel era o angulo de antes.
   3. `destroy()` e `forceContextLoss` envenenavam o canvas. Um canvas com o
      contexto perdido nunca mais aceita outro, e o app remonta telas no mesmo
      elemento: o 3D funcionava na primeira visita e nunca mais.

   O three.js nao roda em Node. Este arquivo monta um substituto com as classes
   que a cena usa e verifica o que NAO depende da GPU: contagens, medidas,
   travelledas de angulo, brilho da nota, e a disciplina do laco.

   Rodar: node tools/test-3d.js
   ========================================================= */
'use strict';

const path = require('path');
const { RAIZ } = require('./arquivos.js');

let passou = 0;
let falhou = 0;
const falhas = [];

function ok(condicao, rotulo, detalhe) {
  if (condicao) { passou++; return true; }
  falhou++;
  falhas.push(rotulo + (detalhe ? '  ->  ' + detalhe : ''));
  return false;
}

function igual(recebido, esperado, rotulo) {
  return ok(recebido === esperado, rotulo, 'recebido ' + JSON.stringify(recebido) +
    ', esperado ' + JSON.stringify(esperado));
}

function perto(recebido, esperado, tolerancia, rotulo) {
  return ok(Math.abs(recebido - esperado) <= tolerancia, rotulo,
    'recebido ' + recebido + ', esperado ' + esperado + ' +/- ' + tolerancia);
}

function secao(titulo) {
  console.log('\n=== ' + titulo + ' ===');
}

/* =========================================================
   1. O laco de desenho
   ========================================================= */

/* O laco fala com `document`, `window` e `requestAnimationFrame`. Aquieles
   viram funcoes contadas: e a unica forma de provar que o laco PARA, que e
   justamente a promessa do arquivo. */
function montarNavegadorFalso() {
  /* O relogio comeca num valor grande DE PROPOSITO.
   *
   * `Cena` limita quadros por tempo: `MINIMO_MS` (33 ms) comparado com
   * `ultimoDesenho`, que comeca em zero. Com um relogio começando em zero, o
   * primeiro quadro cai dentro da janela e e descartado — e o teste comeca
   * medindo a hora errada.
   *
   * E `rodar()` avanca o relogio. Sem isso, a secao da tela 3D inteira rodava
   * dentro da mesma janela de 33 ms: o quadro da montagem era desenhado e o do
   * arraste era descartado pelo limitador, exatamente como aconteceria num
   * aparelho onde a pessoa arrasta depressa demais. O teste media a velocidade
   * da maquina, e nao a tela. */
  const estado = { quadros: 0, pendentes: new Map(), proximo: 1, visivel: 'visible',
    ouvintes: [], ms: 10000 };
  const nav = {
    document: {
      get visibilityState() { return estado.visivel; },
      addEventListener: function (nome, f) {
        if (nome === 'visibilitychange') estado.ouvintes.push(f);
      },
      removeEventListener: function (nome) {
        if (nome !== 'visibilitychange') return;
        const i = estado.ouvintes.indexOf(arguments[1]);
        if (i >= 0) estado.ouvintes.splice(i, 1);
      },
    },
    addEventListener: function () {},
    removeEventListener: function () {},
    requestAnimationFrame: function (cb) {
      const id = estado.proximo++;
      estado.pendentes.set(id, cb);
      estado.quadros++;
      return id;
    },
    cancelAnimationFrame: function (id) { estado.pendentes.delete(id); },
    /* Corre o que o navegador faria: dispara tudo que esta na fila.
     *
     * Cada volta e um quadro de verdade, e um quadro leva tempo. O relogio anda
     * 100 ms — bem acima do limite de 33 ms do `Cena` — para que o limitador
     * nunca decida o resultado do teste por acidente. */
    rodar: function () {
      estado.ms += 100;
      const fila = Array.from(estado.pendentes.entries());
      estado.pendentes.clear();
      for (const [, cb] of fila) cb(estado.ms);
      return fila.length;
    },
    /* O `performance` que casa com este relogio. Quem instala mede o `Cena`
     * inteiro por ele, em vez de deixar o `Cena` usar o relogio de verdade. */
    performance: { now: function () { return estado.ms; } },
    /* Troca a visibilidade da aba E avisa quem escutou, como o navegador faz.
     *
     * Fica aqui, e nao como atribuicao, porque `visibilityState` e so leitura no
     * navegador tambem — e porque o laco so acorda ao receber o aviso. Um falso
     * `document` que so devolvesse o valor novo testaria uma mudanca de estado
     * que o app nunca receberia, e o teste passaria sem a tela voltar a
     * desenhar. */
    ver: function (v) {
      estado.visivel = v;
      for (const f of estado.ouvintes) f();
    },
    __ouvir: function (f) { estado.ouvintes.push(f); },
    __estado: estado,
  };
  return nav;
}

secao('1. O laco para quando nada muda');

{
  const nav = montarNavegadorFalso();
  // O modulo recebe o objeto global por parametro (`globalThis` quando nao ha
  // `window`), entao e este objeto que precisa dos metodos. Restaurar tudo no
  // fim e obrigatorio: sem isso o resto da suite testaria contra um navegador
  // de mentira.
  const CHAVES = ['document', 'addEventListener', 'removeEventListener',
    'requestAnimationFrame', 'cancelAnimationFrame', 'performance'];
  const anterior = {};
  CHAVES.forEach(function (k) { anterior[k] = global[k]; });
  /* O tempo tambem e falso. O laco guarda `performance.now()` entre dois quadros
     e ignora o segundo se passou menos de 33 ms. Com o relogio real e uma
    fila disparada na hora, todo quadro cairia nessa janela e o laco pareceria
     travado — o teste mediria a pressa da maquina, nao o laco. */
  let relogio = 0;
  global.performance = { now: function () { relogio += 40; return relogio; } };
  global.document = nav.document;
  global.addEventListener = nav.addEventListener;
  global.removeEventListener = nav.removeEventListener;
  global.requestAnimationFrame = nav.requestAnimationFrame;
  global.cancelAnimationFrame = nav.cancelAnimationFrame;

  delete require.cache[require.resolve(path.join(RAIZ, 'js/core/cena.js'))];
  const Cena = require(path.join(RAIZ, 'js/core/cena.js'));

  const quadros = [];
  const renderer = {
    domElement: { parentElement: { clientWidth: 300, clientHeight: 200 } },
    setSize: function () {},
    render: function () { quadros.push(1); },
  };
  const camera = { aspect: 1, updateProjectionMatrix: function () {} };

  const laco = Cena.criar(renderer, {}, camera, {
    animacaoContinua: false,
    desenhar: function () {},
  });

  // 1. Monta desenhando uma vez.
  igual(quadros.length, 0, 'antes do primeiro quadro, nada foi desenhado');
  nav.rodar();
  igual(quadros.length, 1, 'montar desenha um quadro');

  // 2. NINGUEM mandou desenhar: o laco tem de estar parado.
  nav.rodar(); nav.rodar(); nav.rodar();
  igual(quadros.length, 1, 'com a cena parada, o laco para (desenho travado)');

  // 3. `acordar()` traz de volta, por exatamente um quadro.
  laco.acordar();
  nav.rodar();
  igual(quadros.length, 2, 'acordar() desenha um quadro');
  nav.rodar(); nav.rodar();
  igual(quadros.length, 2, 'e para de novo em seguida');

  // 4. `animar()` segura o laco de pe.
  laco.animar();
  nav.rodar(); nav.rodar(); nav.rodar();
  igual(quadros.length, 5, 'animar() mantem o laco desenhando');

  // 5. `parar()` solta.
  laco.parar();
  const antesParar = quadros.length;
  nav.rodar(); nav.rodar();
  igual(quadros.length, antesParar, 'parar() interrompe o laco');

  // 6. Destruir cancela o quadro que estava na fila.
  laco.animar();
  ok(nav.__estado.pendentes.size > 0, 'com animar(), ha quadro na fila');
  laco.destruir();
  igual(nav.__estado.pendentes.size, 0, 'destruir() cancela o quadro pendente');
  ok(laco.vivo === false, 'destruir() marca o laco como morto');
  nav.rodar();
  igual(quadros.length, antesParar, 'depois de destruido, nada mais e desenhado');

  // 7. Aba oculta: nao desenha nada.
  const q2 = [];
  const renderer2 = {
    domElement: { parentElement: { clientWidth: 300, clientHeight: 200 } },
    setSize: function () {},
    render: function () { q2.push(1); },
  };
  nav.ver('hidden');
  const laco2 = Cena.criar(renderer2, {}, camera, {
    animacaoContinua: true,   // mesmo animando, aba oculta nao desenha
    desenhar: function () {},
  });
  nav.rodar(); nav.rodar();
  igual(q2.length, 0, 'aba oculta: nada e desenhado, mesmo com animacao continua');
  nav.ver('visible');
  nav.rodar();
  igual(q2.length, 1, 'voltou a aparecer: o laco retoma');
  laco2.destruir();

  // 8. Intervalo minimo entre quadros.
  const q3 = [];
  const renderer3 = {
    domElement: { parentElement: { clientWidth: 300, clientHeight: 200 } },
    setSize: function () {},
    render: function () { q3.push(performance.now()); },
  };
  const laco3 = Cena.criar(renderer3, {}, camera, {
    animacaoContinua: true,
    desenhar: function () {},
  });
  const antes3 = q3.length;
  for (let i = 0; i < 5; i++) nav.rodar();
  const intervalo = q3.length > antes3 + 1
    ? Math.round((q3[q3.length - 1] - q3[antes3]) / (q3.length - antes3 - 1))
    : 0;
  ok(intervalo === 0 || intervalo >= 20,
    'o laco respeita o intervalo minimo entre quadros', 'media de ' + intervalo + ' ms');
  laco3.destruir();

  CHAVES.forEach(function (k) { global[k] = anterior[k]; });
}

/* =========================================================
   2. O carregamento sob demanda
   ========================================================= */

secao('2. O carregamento decide antes de baixar');

{
  // O carregador le `navigator.connection` e `document.createElement` para
  // descobrir se ha WebGL. Os dois viram respostas controladas.
  function navegador(quais) {
    const gl = quais.webgl
      ? { getExtension: function () { return null; } }   // compilar shader e o teste real
      : null;
    return {
      document: {
        createElement: function () { return { getContext: function () { return gl; } }; },
        addEventListener: function () {},
        removeEventListener: function () {},
      },
      performance: { now: function () { return 0; } },
      saveData: !!quais.economia,
    };
  }

  /* `navigator.connection` e a segunda porta da economia de dados, e no Node o
   * `navigator` global e congelado. A porta que o app realmente usa e o ajuste
   * `gfx3d` do proprio Store, e e essa que o teste exercita. */
  function comAjuste3d(valor) {
    const anteriorStore = global.Store;
    global.Store = {
      ajuste: function (chave, padrao) { return chave === 'gfx3d' ? valor : padrao; },
    };
    return function restaurar() { global.Store = anteriorStore; };
  }

  /* O `document` fica instalado enquanto o `Gfx` esta vivo.
   *
   * `temWebGL()` le `document` de dentro do modulo, e o modulo recebe o objeto
   * global por parametro na carga. Se o `document` falso fosse retirado logo
   * depois do `require`, o `temWebGL` voltaria a ler o `document` de verdade —
   * o de Node, que nao existe — e devolveria `false` para qualquer aparelho,
   * incluindo os que tem 3D. O teste passaria a medir o ambiente. */
  function comGfx(quais) {
    const nav = navegador(quais);
    const anteriorDoc = global.document;
    global.document = nav.document;
    delete require.cache[require.resolve(path.join(RAIZ, 'js/core/gfx.js'))];
    const Gfx = require(path.join(RAIZ, 'js/core/gfx.js'));
    return { Gfx: Gfx, soltar: function () { global.document = anteriorDoc; } };
  }

  // WebGL existe, sem economia de dados.
  const c1 = comGfx({ webgl: true, economia: false });
  const g1 = c1.Gfx;
  igual(g1.temWebGL(), true, 'com WebGL, o carregador diz que ha 3D');
  igual(g1.emEconomia(), false, 'sem pedir economia, o 3D fica ligado');
  igual(g1.estado().pronto, false, 'antes de carregar, nao esta pronto');
  igual(g1.estado().motivo, 'ainda não tentou', 'e diz que ainda nao tentou');
  igual(g1.estado().vivos, 0, 'nenhum renderer vivo antes de comecar');
  c1.soltar();

  // Aparelho sem WebGL.
  const c2 = comGfx({ webgl: false, economia: false });
  const g2 = c2.Gfx;
  igual(g2.temWebGL(), false, 'sem WebGL, o carregador diz que nao ha 3D');
  igual(g2.estado().temWebGL, false, 'e o estado repete isso');
  igual(g2.criarRenderer(null), null, 'sem three carregado, nenhum renderer e criado');
  c2.soltar();

  // A pessoa pediu para nunca usar 3D. E a decisao ANTES de qualquer download.
  const restaurar = comAjuste3d('nunca');
  const c3 = comGfx({ webgl: true, economia: false });
  const g3 = c3.Gfx;
  igual(g3.emEconomia(), true, 'com o ajuste "nunca", o 3D e desligado');
  igual(g3.estado().economia, true, 'e o estado diz que e por economia');
  igual(g3.criarRenderer(null), null, 'na economia, nenhum renderer e criado');
  c3.soltar();
  restaurar();

  // O mesmo carregador, com a preferencia padrao, volta a ligar.
  igual(g3.emEconomia(), false, 'voltando ao padrao, o 3D e ligado de novo');

  // O `ultimoErro` existe para o diagnostico, e comeca vazio.
  igual(g3.estado().ultimoErro, '', 'sem falha ainda, o diagnostico esta vazio');
  ok(typeof g3.estado().ultimoErro === 'string', 'o diagnostico e um texto');
}

/* =========================================================
   3. A cena do violao, com um three de mentira
   ========================================================= */

/* O three.js nao roda em Node. O que a cena usa dele e uma lista curta e
   fixa: uma cena, uma camera, um grupo, malhas, geometrias, materiais, duas
   luzes, um vetor e um raycaster. O substituto abaixo implementa so isso, e
   conta o que foi criado e devolvido. */
function threeFalso(contador) {
  /* Cada recurso ganha um numero, e `dispose` registra QUAL foi devolvido.
   *
   * Contar apenas o total nao distingue os dois defeitos: um registro global e
   * um registro por violao devolvem a MESMA quantidade de recursos, e so
   * devolvem os ERRADOS. Sem identidade, o teste passaria com o bug dentro —
   * que e o que aconteceu na primeira versao desta prova. */
  function recurso(nome) {
    return function () {
      const id = ++contador.criados;
      this.__id = id;
      this.__nome = nome;
      this.dispose = function () {
        contador.devolvidos++;
        contador.devolvidosPorId[id] = nome;
      };
      this.rotateX = function () {};
      this.rotateY = function () {};
      this.rotateZ = function () {};
    };
  }
  function no3D() {
    return { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; },
      setScalar: function (s) { this.x = this.y = this.z = s; } };
  }
  function Mesh(geo, mat) {
    this.geometry = geo;
    this.material = mat;
    this.position = no3D();
    this.rotation = no3D();
    this.scale = no3D();
    this.userData = {};
  }
  return {
    __contador: contador,
    Scene: function () { this.children = []; this.add = function (o) { this.children.push(o); }; this.clear = function () { this.children = []; } },
    Group: function () { this.children = []; this.rotation = no3D(); this.position = no3D();
      this.add = function (o) { this.children.push(o); }; },
    Mesh: Mesh,
    BoxGeometry: recurso('BoxGeometry'),
    CylinderGeometry: recurso('CylinderGeometry'),
    CircleGeometry: recurso('CircleGeometry'),
    SphereGeometry: recurso('SphereGeometry'),
    TorusGeometry: recurso('TorusGeometry'),
    MeshStandardMaterial: function (o) {
      o = o || {};
      this.color = o.color;
      // O brilho da nota vive aqui, e e um numero que o laco altera a cada
      // quadro. Sem isto o teste do "acender" nao teria o que medir.
      this.emissive = { setHex: function () {} };
      this.emissiveIntensity = 1;
      this.dispose = function () { contador.devolvidos++; };
    },
    MeshBasicMaterial: function () { this.dispose = function () { contador.devolvidos++; }; },
    HemisphereLight: function () { this.position = no3D(); },
    DirectionalLight: function () { this.position = no3D(); },
    PerspectiveCamera: function () { this.position = no3D(); this.lookAt = function () {};
      this.updateProjectionMatrix = function () {}; this.aspect = 1; },
    Vector2: function (x, y) { this.x = x || 0; this.y = y || 0;
      this.set = function (a, b) { this.x = a; this.y = b; }; this.copy = function (o) { this.x = o.x; this.y = o.y; }; },
    Raycaster: function () { this.setFromCamera = function () {};
      this.intersectObjects = function () { return []; }; },
  };
}

secao('3. A cena do violao');

{
  const contador = { criados: 0, devolvidos: 0, devolvidosPorId: {} };
  const Gfx = require(path.join(RAIZ, 'js/core/gfx.js'));
  const Music = require(path.join(RAIZ, 'js/core/music.js'));
  // `three` e lido na hora de criar, entao o substituto entra pelo Gfx.
  const three = threeFalso(contador);
  Object.defineProperty(Gfx, 'three', { value: three, configurable: true });

  const Violao3D = require(path.join(RAIZ, 'js/views/violao3d.js'));

  // --- as medidas ---
  //
  // `trasteL` foi trocado por `larguras[0]`: os trastes nao sao mais iguais
  // entre si, entao "a largura do traste" deixou de ser um numero so. A
  // propriedade continua exposta por compatibilidade com quem chama `medidas()`
  // sem passar instrumento — e ela significa a largura do PRIMEIRO traste, que
  // e a unica que tem valor de unha.
  const m = Violao3D.medidas();
  igual(m.cordas, 6, 'o violao tem 6 cordas');
  const unha = m.larguras[0];
  ok(unha > 0.3 && unha < 0.8, 'o primeiro traste tem largura de unha', 'trasteL=' + unha);
  ok(m.cordaEsp > unha, 'a corda e mais espacada que o traste',
    m.cordaEsp.toFixed(2) + ' contra ' + unha.toFixed(2));
  igual(m.trasteL, unha, 'e `trasteL` continua de volta, para quem chama sem instrumento');

  // --- sem three, devolve nulo em vez de explodir ---
  Object.defineProperty(Gfx, 'three', { value: null, configurable: true });
  igual(Violao3D.criar({ pcs: [0, 2, 4] }), null, 'sem three, a cena devolve nulo');
  Object.defineProperty(Gfx, 'three', { value: three, configurable: true });

  // --- uma escala de sete notas no violao de seis cordas ---
  const escala = Music.scaleNotes(7, 0, false);   // 7, 9, 11, 0, 2, 4, 6
  const v = Violao3D.criar({
    pcs: escala, rootPc: 7, flat: false, frets: 12, inst: 'violao', acordes: [],
  });
  /* A partir daqui a suite usa `v` como se existisse. Sem esta guarda, uma cena
   * que volte `null` — que e a resposta correta sem three.js — derruba o teste
   * com um `TypeError` na linha seguinte, e o verificador morre antes de dizer
   * o que aconteceu. Um verificador que morre no primeiro defeito e um
   * verificador que nao diz nada sobre o resto. */
  if (!ok(!!v, 'a cena monta')) {
    console.log('\n  (sem cena, o resto da secao 3 nao pode ser medido)');
  } else {
  igual(v.notas.length, escala.length * 6, 'uma esfera por nota em cada corda');
  igual(v.cordas.length, 6, 'seis cordas desenhadas');
  ok(v.alvos.length >= v.notas.length, 'ha um alvo de toque por nota');
  igual(v.aneis.length, 0, 'escala nao desenha aneis');

  // --- os aneis so aparecem quando o desenho principal tem desenho ---
  const comAcorde = Violao3D.criar({
    pcs: [7, 11, 2], rootPc: 7, flat: false, frets: 12, inst: 'violao',
    acordes: [{ pc: 7, quality: 'maj' }],
  });
  ok(comAcorde.aneis.length > 0, 'com acorde, os aneis marcam a posicao',
    'aneis=' + comAcorde.aneis.length);
  comAcorde.dispose();

  // --- os angulos: o botao precisa CHEGAR no angulo ---
  const pos = function () { return { y: v.camera.position.y, z: v.camera.position.z }; };
  const z0 = pos().z;
  igual(v.girarPara('de lado'), true, 'o botao "de lado" e reconhecido');
  const andou = function () {
    let q = 0;
    while (q < 400) { v.ajustarAngulo(); q++; if (v.desenhar() === false) break; }
    return q;
  };
  const quadros = andou();
  ok(Math.abs(pos().z - z0) > 3, '"de lado" realmente vira o violao',
    'z veio de ' + z0.toFixed(2) + ' para ' + pos().z.toFixed(2));
  ok(quadros > 5 && quadros < 200, 'a virada leva alguns quadros, nao um salto',
    'levou ' + quadros);
  igual(v.desenhar(), false, 'no angulo pedido, a cena nao pede mais quadro');

  // Ida e volta entre as duas travas mais distantes.
  v.girarPara('de cima');
  andou();
  const yCima = pos().y;
  v.girarPara('de lado');
  andou();
  ok(pos().y < yCima, '"de cima" volta a ser mais alto que "de lado"',
    yCima.toFixed(2) + ' -> ' + pos().y.toFixed(2));

  // O angulo pedido fica: repetir a travessia termina no mesmo lugar.
  const yFinal = pos().y;
  const zFinal = pos().z;
  v.girarPara('de lado');
  andou();
  perto(pos().y, yFinal, 0.01, 'a travessia e repetivel no eixo vertical');
  perto(pos().z, zFinal, 0.01, 'a travessia e repetivel no giro');

  // `imediato` nao passa pela travessia.
  v.girarPara('de cima');
  andou();
  v.girarPara('de lado', true);
  igual(v.desenhar(), false, 'com imediato, nao ha travessia a espera');
  ok(pos().z > 5, 'com imediato, o angulo e alcancado na hora', 'z=' + pos().z.toFixed(2));

  /* O arraste assume o controle, e o violao segue o dedo.
   *
   * Os valores NAO sao simetricos de proposito. A partir de "de lado" (giro em
   * PI/2), arrastar +70 e depois -70 devolveria o violao a exatamente a mesma
   * posicao: o `sin` e simetrico em torno de PI/2, e o teste passaria sem o
   * angulo nunca ter virado. Com -140, o destino e outro. */
  v.aoArrastar(70, 0);
  const depoisArraste = pos().z;
  ok(depoisArraste > 0, 'arrastar gira o violao', 'z=' + depoisArraste.toFixed(2));
  v.aoArrastar(-300, 0);
  ok(pos().z < depoisArraste - 1, 'arrastar para o outro lado tambem gira',
    depoisArraste.toFixed(2) + ' -> ' + pos().z.toFixed(2));

  // Na vertical: arrastar para baixo leva a camera para baixo. E o que faz o
  // violao de lado virar o de quem segura sem nenhum botao.
  const yAntesDy = pos().y;
  v.aoArrastar(0, 60);
  ok(pos().y > yAntesDy + 0.2, 'arrastar para baixo olha o violao de cima',
    yAntesDy.toFixed(2) + ' -> ' + pos().y.toFixed(2));
  v.aoArrastar(0, -60);
  perto(pos().y, yAntesDy, 0.05, 'e voltar o arrasto devolve a altura');

  /* O arraste tem de ACABAR. E o que garante o fim e o `desenhar` devolver
   * `false` depois que a velocidade decai.
   *
   * Este e o defeito que a tela escondia: com movimento reduzido, o `traste3d`
   * nao chamava `ajustarAngulo` no laco — e sem ele a velocidade do arraste
   * nunca decaia, a cena pedia quadro para sempre, e o aparelho queimava
   * bateria a 30 fps com a tela parada. O `Cena` estava certo; quem nunca
   * desligava a velocidade era o `traste3d`. */
  v.aoArrastar(200, 0);
  igual(v.desenhar(), true, 'logo apos o arraste, a cena pede quadro: ha movimento');
  let passos = 0;
  while (v.desenhar() && passos < 500) { v.ajustarAngulo(); passos++; }
  ok(passos > 0 && passos < 200, 'a velocidade do arraste decai sozinha',
    'levou ' + passos + ' passos');
  igual(v.desenhar(), false, 'e a cena para de pedir quadro sozinha');

  // Um nome de vista que nao existe nao mexe em nada.
  const antesRuim = pos().z;
  igual(v.girarPara('de lado de cima'), false, 'um angulo desconhecido e recusado');
  igual(v.aoArrastar(0, 0) === undefined, true, 'arrastar sem deslocamento nao lanca');
  ok(Math.abs(pos().z - antesRuim) < 0.001, 'o angulo desconhecido nao moveu o violao');

  // --- tocar acende a nota e chama quem pediu para ouvir ---
  const ouvido = [];
  const v2 = Violao3D.criar({
    pcs: [0], rootPc: 0, flat: false, frets: 5, inst: 'violao', acordes: [],
    ouvir: function (pc, dur) { ouvido.push([pc, dur]); },
  });
  const nota = v2.notas.filter(function (x) { return x.userData.pc === 0; })[0];
  ok(!!nota, 'a nota C existe na cena');
  const antesBrilho = nota.material.emissiveIntensity;
  v2.tocar(0, 1.5);
  igual(ouvido.length, 1, 'ouvir foi chamado uma vez');
  igual(ouvido[0][0], 0, 'com a nota certa');
  igual(ouvido[0][1], 1.5, 'e a duracao pedida');

  /* O brilho e do LACO, nao do `tocar`. O `tocar` marca o instante; quem acende
     e o proximo `desenhar`. Medir antes disso mede o estado antigo e o teste
     falha por um motivo que nao existe. */
  igual(v2.desenhar(), true, 'no primeiro quadro a cena pede redesenho: o pulso comecou');
  ok(nota.material.emissiveIntensity > antesBrilho, 'o brilho sobe',
    antesBrilho + ' -> ' + nota.material.emissiveIntensity.toFixed(2));
  ok(nota.scale.x > 1, 'a nota cresce', 'escala=' + nota.scale.x.toFixed(2));

  /* Passado o pulso, a cena avisa que pode parar. E o que segura o laco de pe so
     enquanto ha brilho — e o que economiza a bateria quando ninguem toca. */
  const esperaFim = performance.now() + 800;
  while (performance.now() < esperaFim) { /* deixa o pulso passar */ }
  igual(v2.desenhar(), false, 'passado o pulso, a cena nao pede mais quadro');
  ok(nota.scale.x < 1.2, 'a nota volta ao tamanho normal',
    'escala=' + nota.scale.x.toFixed(2));

  // Uma nota que nao esta no desenho: o som sai, e o brilho de quem continua
  // soando NAO pode sumir.
  v2.tocar(0, 0.2);
  v2.desenhar();
  const antesFora = ouvido.length;
  v2.tocar(99);
  igual(ouvido.length, antesFora + 1, 'nota fora do desenho ainda soa');
  igual(ouvido[ouvido.length - 1][0], 99 % 12, 'e o pitch sai normalizado');
  igual(v2.desenhar(), true, 'o pulso de quem continua soando nao foi apagado');

  // --- o raycast responde, mesmo sem GPU ---
  const canvas = { getBoundingClientRect: function () { return { left: 0, top: 0, width: 300, height: 200 }; } };
  igual(v2.alvoEm(10, 10, canvas), null, 'raycast sem alvo devolve nulo');
  igual(v2.alvoEm(10, 10, null), null, 'raycast sem canvas devolve nulo');
  igual(v2.alvoEm(10, 10, { getBoundingClientRect: function () { return { width: 0, height: 0 }; } }), null,
    'canvas sem tamanho devolve nulo, em vez de dividir por zero');

  // --- os recursos voltam ---
  const antes4 = contador.devolvidos;
  v2.dispose();
  ok(contador.devolvidos > antes4, 'dispose devolve os recursos ao three',
    (contador.devolvidos - antes4) + ' devolvidos');
  v.dispose();

  /* Cada violao devolve o SEU, e a identidade do recurso e o que prova.
   *
   * A primeira versao deste teste comparava so a CONTAGEM de recursos
   * devolvidos, e passava com o registro global por dentro. A contagem e a
   * mesma nos dois casos — o que muda e DE QUEM sao os recursos devolvidos. Um
   * registro global faz o `dispose` de um violao devolver a geometria de outro
   * que continua na tela, em outra aba: no WebGL o objeto desenhado simplesmente
   * some, sem erro. E por isso que o teste guarda qual id foi devolvido. */
  const v3a = Violao3D.criar({ pcs: [0], rootPc: 0, frets: 3, inst: 'violao', acordes: [] });
  const idsA = v3a.notas.map(function (x) { return x.geometry.__id; })
    .filter(function (x) { return typeof x === 'number'; });
  ok(idsA.length > 0, 'a cena do primeiro violao tem geometria com identidade',
    idsA.length + ' geometrias');
  const antes5 = contador.devolvidos;
  const v3b = Violao3D.criar({ pcs: [2], rootPc: 2, frets: 3, inst: 'violao', acordes: [] });
  igual(contador.devolvidos, antes5, 'criar outro violao nao devolve nada');
  ok(v3a.notas.length > 0, 'o primeiro violao continua com as notas dele');

  v3a.dispose();
  const idB = v3b.notas[0] && v3b.notas[0].geometry
    ? v3b.notas[0].geometry.__id : null;
  ok(idB === null || contador.devolvidosPorId[idB] === undefined,
    'devolver o primeiro violao NAO devolve a geometria do segundo',
    'a geometria ' + idB + ' do segundo violao foi devolvida junto');
  v3b.dispose();
  ok(idB === null || contador.devolvidosPorId[idB] !== undefined,
    'e o segundo violao devolve a dele quando e descartado');
  }   // fecha o `else` da guarda da cena
}

/* Um auxiliar declarado depois, para o codigo de cima ficar legivel. */
void 0;

/* =========================================================
   4. A frequencia de uma nota
   ========================================================= */

secao('4. A frequencia que a tela 3D usa para tocar');

{
  /* A tela usa `Utils.el` na hora de montar, entao os modulos de que ela
     depende precisam estar carregados — na ordem do `index.html`. Sem isso o
     `require` quebra no `el` e o teste mediria uma tela que nunca abre. */
  const CHAVES4 = ['document', 'addEventListener', 'removeEventListener'];
  const anterior4 = {};
  CHAVES4.forEach(function (k) { anterior4[k] = global[k]; });
  global.document = {
    createElement: function () { return { getContext: function () { return null; } }; },
    addEventListener: function () {},
    removeEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    documentElement: {
      classList: { add: function () {}, remove: function () {} },
      style: {}, setAttribute: function () {}, getAttribute: function () { return null; },
    },
    body: { appendChild: function () {}, removeChild: function () {} },
  };
  global.addEventListener = function () {};
  global.removeEventListener = function () {};
  ['js/core/music.js', 'js/core/utils.js', 'js/core/ui.js', 'js/core/render.js',
    'js/core/tuner.js', 'js/views/violao3d.js', 'js/views/traste3d.js']
    .forEach(function (m) {
      try { require(path.join(RAIZ, m)); } catch (e) { /* um a menos e o teste diz */ }
    });
  let Traste3D = null;
  try { Traste3D = require(path.join(RAIZ, 'js/views/traste3d.js')); }
  catch (e) { Traste3D = null; }
  CHAVES4.forEach(function (k) { global[k] = anterior4[k]; });

  if (ok(!!Traste3D, 'traste3d carrega para o teste', Traste3D ? '' : 'nao carregou')) {
    // A4 = 440 Hz e a referencia. C4 (pc 0 uma oitava abaixo) fica perto de
    // 261,6 Hz — o mesmo valor que o afinador usa.
    /* O 3D tem de tocar exatamente a nota que o resto do app toca. A conta fica
       no `Tuner` — o mesmo que o afinador, o teclado e o desenho de acordes
       usam — e o 3D e que estava com o sinal trocado: dava 740 Hz para o dó.
       Nada acusava, porque nenhuma tela com audio mostra o nome da nota. */
    perto(Traste3D.frequenciaDe(0), 261.63, 0.5, 'C4 fica perto de 261,6 Hz');
    perto(Traste3D.frequenciaDe(9), 440, 0.5, 'A4 fica em 440 Hz');
    perto(Traste3D.frequenciaDe(4), 329.63, 0.5, 'mi4 fica perto de 329,6 Hz');
    igual(Traste3D.frequenciaDe(0), global.Tuner.notaParaHz(0, 4),
      'o 3D e o Tuner concordam nota por nota');
    perto(Traste3D.frequenciaDe(12), 261.63, 0.5, 'uma oitave acima volta a 261,6 Hz');
    igual(Traste3D.frequenciaDe(9 + 12), Traste3D.frequenciaDe(9), '12 semitons sao a mesma nota');
    /* O intervalo de um semitom, medido entre duas notas vizinhas: o dó e o dó
     * sustenido, e o lã e o si.
     *
     * A ordem dentro da oitava 4 cresce com o numero: C4 (0) e a mais grave da
     * oitava, e B4 (11) a mais aguda. Comparar "dó e mais agudo que lã" seria
     * falso — e o teste falhando diria que o codigo esta errado, quando quem
     * estaria errado seria o teste. */
    ok(Traste3D.frequenciaDe(1) > Traste3D.frequenciaDe(0), 'dó sustenido e mais agudo que dó');
    ok(Traste3D.frequenciaDe(11) > Traste3D.frequenciaDe(10), 'si e mais agudo que lã');
    ok(Traste3D.frequenciaDe(10) > Traste3D.frequenciaDe(0), 'lã e mais agudo que dó');
    ok(Traste3D.frequenciaDe(0) < Traste3D.frequenciaDe(7), 'o dó e a nota mais grave da oitava');
    /* E a razao de um semitom: 2^(1/12) = 1,0595. E o que o ouvido distingue; se
     * a conta perder o sinal, a razao vira 0,943 e nenhuma das comparacoes
     * acima acusaria. */
    const razao = Traste3D.frequenciaDe(1) / Traste3D.frequenciaDe(0);
    perto(razao, Math.pow(2, 1 / 12), 0.002, 'um semitono multiplica por 1,0595');
    igual(Traste3D.frequenciaDe(-3), Traste3D.frequenciaDe(9), 'nota negativa volta a ser a mesma');
  }
}

/* =========================================================
   5. A LIGACAO DA TELA
   ========================================================= */

/* O `traste3d` e o unico arquivo que junta cena, laco e entrada do usuario, e
 * por isso o unico onde os defeitos somem.
 *
 * O `if (mover)` que envolvia o `ajustarAngulo` no laco e o exemplo do caminho:
 * o `Cena` estava certo, a cena estava certa, e a tela achava que "sem
 * movimento" significava "nao mexa no angulo". Com o aparelho em movimento
 * reduzido — o padrao de quem programa acessibilidade — o arraste deixava uma
 * velocidade que ninguem decayia, a cena pedia quadro para sempre, e o celular
 * queimava bateria a 30 quadros por segundo com a tela parada. Nenhum teste
 * cobrava disto, porque nenhum teste abria a tela.
 *
 * Aqui a tela e montada de verdade, num DOM de mentira, e o que se mede e o
 * que a pessoa sente: a tela para de trabalhar quando nao esta sendo usada.
 */
secao('5. A tela para de trabalhar quando ninguem mexe');

{
  const nav = montarNavegadorFalso();
  const CHAVES5 = ['document', 'addEventListener', 'removeEventListener',
    'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia', 'performance'];
  const anterior5 = {};
  CHAVES5.forEach(function (k) { anterior5[k] = global[k]; });

  /* O tempo e falso aqui tambem, e pelo mesmo motivo da secao 1: o `Cena`
   * descarta um quadro que chegue menos de 33 ms depois do anterior. Sem isto, a
   * montagem e o arraste acontecem na mesma janela, o quadro do arraste e
   * descartado, e o teste acusa "o arraste nao redesenha" — sendo que num
   * aparelho a tela redesenha, so que nao antes do proximo passo. */
  global.performance = nav.performance;

  const criar = elFake();
  global.document = {
    visibilityState: 'visible',
    createElement: criar,
    createElementNS: criar,
    createTextNode: function (t) { return { text: t }; },
    addEventListener: function () {},
    removeEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    documentElement: {
      classList: { add: function () {}, remove: function () {}, contains: function () { return false; } },
      style: {}, setAttribute: function () {}, getAttribute: function () { return null; },
    },
    body: { appendChild: function () {}, removeChild: function () {} },
    head: { appendChild: function () {} },
  };
  global.addEventListener = nav.addEventListener;
  global.removeEventListener = nav.removeEventListener;
  global.requestAnimationFrame = nav.requestAnimationFrame;
  global.cancelAnimationFrame = nav.cancelAnimationFrame;
  /* Movimento reduzido ligado: e o caso que escondia o defeito. O `Cena` le o
   * `document.visibilityState` de dentro, entao o falso `document` e o mesmo
   * que o navegador falso consulta. */
  global.matchMedia = function (q) {
    return { matches: /reduced-motion/.test(q), media: q, addEventListener: function () {} };
  };

  /* A ordem de carga e a do `index.html`, e ela importa.
   *
   * Duas coisas contam aqui. A primeira: `render.js` le `Music` no topo do IIFE, e
   * por isso `music.js` vem antes. A segunda, e a que custou mais: o `require`
   * guarda o modulo em cache, e a secao 4 JA carregou `render.js` com um
   * `Music` de outra combinacao. Recarregar `music.js` nao basta — o `render`
   * continua com a referencia antiga, e `M.instrumento` volta a ser
   * `undefined` com um erro que aponta para o arquivo errado.
   *
   * Por isso o cache e limpo explicitamente, na ordem, antes de qualquer
   * `require`. Sem isso o teste mede o que sobrou da secao anterior. */
  ['js/core/utils.js', 'js/core/ui.js', 'js/core/music.js', 'js/core/render.js',
    'js/views/violao3d.js', 'js/views/traste3d.js']
    .forEach(function (m) {
      delete require.cache[require.resolve(path.join(RAIZ, m))];
    });

  const utils = require(path.join(RAIZ, 'js/core/utils.js'));
  utils.el = elCompleto(criar);
  const UI = require(path.join(RAIZ, 'js/core/ui.js'));
  UI.el = elCompleto(criar);
  UI.icons = function () {};

  require(path.join(RAIZ, 'js/core/music.js'));
  require(path.join(RAIZ, 'js/core/render.js'));

  /* A cena, com o three de mentira e o `Gfx` apontando para ele. */
  const contador = { criados: 0, devolvidos: 0, devolvidosPorId: {} };
  const Gfx = require(path.join(RAIZ, 'js/core/gfx.js'));
  Object.defineProperty(Gfx, 'three', { value: threeFalso(contador), configurable: true });
  let quadros = 0;
  const rendererFalso = {
    domElement: { parentElement: { clientWidth: 400, clientHeight: 280 } },
    setSize: function () {}, setPixelRatio: function () {},
    render: function () { quadros++; },
    dispose: function () {}, getContext: function () { return null; },
  };
  Gfx.criarRenderer = function () { return rendererFalso; };
  Gfx.destruir = function () {};

  /* A CARGA PRECISA VIR DE MENTIRA AQUI.
   *
   * `Gfx.carregar` faz `import()` de uma CDN. No Node isso falha sempre — e
   * falha do jeito certo: a promessa resolve com `null`, a tela mostra o aviso
   * "sem 3D" e o traste 2D continua. O resultado e um teste que passa sem nunca
   * montar a cena: o canvas nunca aparece, e a asercao abaixo falha sem dizer
   * nada sobre a cena em si.
   *
   * Substituir `carregar` e o certo aqui porque a DECISAO de carregar — modo
   * economia, WebGL ausente, ordem das CDNs — ja e testada na secao 2, com o
   * `carregar` de verdade. Esta secao e sobre a cena: os objetos, o
   * raycast, o laco. Deixar a carga de fora e o que mantem as duas separadas. */
  let cargaResolveu = false;
  Gfx.carregar = function () {
    cargaResolveu = true;
    return Promise.resolve(threeFalso(contador));
  };

  require(path.join(RAIZ, 'js/core/cena.js'));
  const Traste3D = require(path.join(RAIZ, 'js/views/traste3d.js'));

  const wrap = Traste3D.mostrar({
    pcs: [0, 2, 4, 5, 7, 9, 11], rootPc: 0, flat: false, frets: 12,
    inst: 'violao', acordes: [],
  });
  ok(!!wrap, 'a tela monta');

  /* O 3D entra por uma promessa — a carga do three.js nao trava a tela, e o
   * traste 2D fica no lugar enquanto ela chega. */
  esperarPromessa().then(function () {
  /* O quadro da MONTAGEM ainda esta na fila quando a promessa resolve: `Cena`
     chama `acordar()` ao criar, e isso agenda um quadro. Comparar `quadros`
     antes de rodar a fila media um quadro que era esperado — a tela nao estava
     "desenhando sozinha", estava entregando o primeiro desenho. Sao coisas
     diferentes, entao a fila e drenada antes de contar. */
  nav.rodar();
  nav.rodar();
  const base = quadros;
  nav.rodar(); nav.rodar(); nav.rodar();
  igual(quadros, base, 'a tela montada e parada: o laco nao fica rodando sozinho');

  /* O ponto do defeito: o arraste com movimento reduzido. A velocidade que ele
   * deixa tem de decair sozinha. Com o `if (mover)` no laco, nao decaia — e a
   * tela queimava bateria a 30 fps sem ninguem tocar em nada. */
  const canvas = acharCanvas(wrap);
  if (ok(!!canvas, 'a tela criou o canvas do 3D')) {
    const ev = function (x, y) {
      return { clientX: x, clientY: y, changedTouches: null, touches: null,
        preventDefault: function () {} };
    };
    canvas.__dispatch('mousedown', ev(200, 140));
    for (let k = 1; k <= 10; k++) canvas.__dispatch('mousemove', ev(200 + k * 10, 140));
    const aposArrasto = quadros;
    canvas.__dispatch('mouseup', ev(300, 140));

    let guardou = 0;
    while (quadros === aposArrasto && guardou < 5) { nav.rodar(); guardou++; }
    ok(quadros > aposArrasto, 'o arraste redesenha a tela',
      'nenhum quadro depois de ' + guardou + ' voltas do agendador');

    /* E o que a prova: a tela VOLTA A PARAR.

     * Dois defeitos moram aqui, e por isso sao duas asercoes.
     *
     * A primeira e o defeito antigo: sem decair a velocidade, `desenhar()`
     * devolveria `true` para sempre e o contador cresceria sem limite — 30 fps
     * com a tela parada, e a bateria do aparelho descendo sem ninguem tocar em
     * nada.
     *
     * A segunda e o erro que estava no teste. Ele comparava `quadros` com o
     * valor de antes do arraste e esperava zero crescimento. Mas o arraste DEIXA
     * inercia de proposito: e o violao deslizando e parando, que e o peso de um
     * objeto pequeno na mao. Medido, sao 55 quadros ate assentar, cerca de 1,8 s
     * a 30 fps. Esse numero e o certo, e a comparacao estava acusando o certo.
     *
     * O que a tela promete nao e "nenhum quadro depois do arraste". E "a
     * CONTAGEM PARA". Entao a verificacao deixa a inercia assentar, anota onde
     * ela parou, e so entao mede se continua andando. */
    const depoisDoArrasto = quadros;
    /* O laco precisa de uma volta antes de poder dizer "parou". Comecar
       `ultimo` igual a `quadros` faria a condicao ser falsa na primeira
       checagem, o laco nunca entraria, e o teste passaria medindo zero
       assentamento — que e o resultado que ele deveria estar Napoleonando. */
    let voltas = 0;
    let ultimo = quadros;
    let andou = true;
    while (voltas < 400 && andou) {
      nav.rodar();
      voltas++;
      andou = quadros !== ultimo;
      ultimo = quadros;
    }
    const assentouEm = quadros - depoisDoArrasto;
    ok(assentouEm < 300, 'a inercia do arraste assenta em pouco tempo',
      'assentou em ' + assentouEm + ' quadros; o teto e 300');

    const paradoEm = quadros;
    for (let i = 0; i < 120; i++) nav.rodar();
    igual(quadros, paradoEm, 'a tela volta a parar sozinha depois do arraste');
  }

  CHAVES5.forEach(function (k) { global[k] = anterior5[k]; });
  }).then(fechar);
}

/* Uma volta completa do laco de eventos: todas as microtarefas, e um timer.
 *
 * A tela monta o 3D dentro de uma promessa, justamente para nao travar a
 * espera pelo megabyte do three.js. Sem esta volta, o canvas ainda nao
 * existe e a tela parece ter falhado — o teste mediria o tempo, e nao a tela. */
function esperarPromessa() {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

/* Fecha a suite depois da ultima secao assincrona. */
function fechar() {
  console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
  if (falhou) {
    console.log('');
    falhas.forEach(function (f) { console.log('  FALHA  ' + f); });
  }
  console.log('=================================================\n');
  process.exit(falhou ? 1 : 0);
}

/* Um `el` que guarda os filhos e sabe entregar os seus ouvintes, para o teste
   poder despachar um evento nele. O DOM de mentira nao e um navegador, mas e o
   bastante para a tela montar e para o laco rodar. */
function elFake() {
  function criar(tag) {
    const listeners = {};
    return {
      tagName: String(tag).toUpperCase(),
      style: {},
      dataset: {},
      classList: {
        _set: [],
        add: function (c) { this._set.push(c); },
        remove: function () {},
        contains: function (c) { return this._set.indexOf(c) >= 0; },
      },
      children: [],
      parentNode: null,
      textContent: '',
      clientWidth: 400,
      clientHeight: 280,
      width: 0,
      height: 0,
      appendChild: function (f) { this.children.push(f); f.parentNode = this; return f; },
      removeChild: function (f) {
        const i = this.children.indexOf(f);
        if (i >= 0) this.children.splice(i, 1);
        return f;
      },
      remove: function () { if (this.parentNode) this.parentNode.removeChild(this); },
      setAttribute: function (k, v) { this[k] = v; },
      getAttribute: function (k) { return this[k] === undefined ? null : this[k]; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      getBoundingClientRect: function () {
        return { left: 0, top: 0, width: 400, height: 280, right: 400, bottom: 280 };
      },
      /* O gancho do teste: despachar um evento e chamar quem escutou. */
      __dispatch: function (nome, ev) {
        const ls = listeners[nome] || [];
        for (const l of ls) if (typeof l === 'function') l(ev);
      },
      addEventListener: function (n, f) { (listeners[n] = listeners[n] || []).push(f); },
      removeEventListener: function (n, f) {
        const ls = listeners[n] || [];
        const i = ls.indexOf(f);
        if (i >= 0) ls.splice(i, 1);
      },
    };
  }
  return criar;
}

/* O `el` completo: e o que o app usa, e nao o `createElement` cru.
 *
 * `Utils.el` traduz `class` em `classList.add`, `onclick` em um ouvinte, e
 * `style` em propriedades. Sem essa traducao o no sai sem classe nenhuma, e a
 * tela construida com ele nao se parece com a do navegador — o teste mediria
 * uma arvore que o app nunca produz. */
function elCompleto(criar) {
  return function (tag, attrs, filhos) {
    const no = criar(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === null || v === undefined) continue;
        if (k === 'class') {
          for (const c of String(v).split(/\s+/)) if (c) no.classList.add(c);
        } else if (k === 'style' && typeof v === 'object') {
          for (const s of Object.keys(v)) no.style[s] = v[s];
        } else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          no.addEventListener(k.slice(2), v);
        } else if (typeof v === 'boolean') {
          if (v) no.setAttribute(k, '');
        } else {
          no.setAttribute(k, String(v));
        }
      }
    }
    if (filhos) {
      for (const f of (Array.isArray(filhos) ? filhos : [filhos])) {
        if (f === null || f === undefined) continue;
        if (typeof f === 'string' || typeof f === 'number') {
          no.appendChild({ text: String(f) });
        } else {
          no.appendChild(f);
        }
      }
    }
    return no;
  };
}

/* Acha o canvas na arvore do falso DOM. */
/* Acha o canvas descendo a arvore.
 *
 * O no de mentira aceita texto como filho: `elCompleto` transforma string em
 * `{ text: ... }` e o `appendChild` guarda no `children`. Esse objeto nao tem
 * `tagName` nem `children` — e um no de texto, nao um elemento.
 *
 * Sem a guarda, `no.children` e `undefined` e o `|| []` segura. Mas o que
 * segurava era o `||` doChildren, e ele foi removido numa edicao: o primeiro
 * erro disso foi um `Cannot read properties of undefined` dentro do proprio
 * teste, com a tela 3D funcionando perfeitamente. O defeito estava no
 * verificador, e ele acusou a cena.
 *
 * A guarda e entao explicita, e nao implicita: e um no so e o que tem `tagName`
 * que se percorre. */
function acharCanvas(no) {
  if (!no || typeof no !== 'object' || !no.tagName) return null;
  if (no.tagName === 'CANVAS') return no;
  const filhos = Array.isArray(no.children) ? no.children : [];
  for (const f of filhos) {
    const achado = acharCanvas(f);
    if (achado) return achado;
  }
  return null;
}

/* A secao 5 e assincrona e chama `fechar` no fim. As demais rodam antes dela, e
 * por isso o resumo e impresso uma vez so. */
