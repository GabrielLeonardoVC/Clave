/* =========================================================
   ACORDE - views/violao3d.js
   O braco, a corda e o traste em tres dimensoes.

   O QUE ISTO RESOLVE, E POR QUE 3D E O CAMINHO CERTO

   Diagrama de traste em 2D funciona para quem esta olhando de cima, no papel.
   Nao funciona para quem esta com o violao na coxa: ali o braco e visto de um
   angulo de uns 40 graus, e a mao procura a posicao por MEMORIA — nao pela
   tela. O desenho 2D e uma vista de cima; o que a pessoa precisa e a vista que
   ela ve de verdade.

   Por isso o violao aqui e navegavel: a pessoa gira para a altura em que esta
   segurando, ve os dedos nos traste certos, e a nota toca ao tocar. E a
   diferenca nao e decorativa: quem esta aprendendo um desenho novo passa de
   "procurar no papel" para "ver onde o dedo vai".

   O QUE FAZ:

     - girar: um dedo arrastando, com inercia e travamento nos angulos uteis;
     - tocar: cada corda e cada traste e um alvo que soa a nota;
     - acender: o traste da nota que esta soando acende, para o olho encontrar
       o dedo;
     - desenhar o desenho pedido: os aneis marcam onde cada dedo vai.

   SEM THREE.JS, ESTA TELA VOLTA AO QUE EXISTIA

   O traste 2D de `Render.scaleFretboard` continua no lugar. Nao e uma versao
   empobrecida: e a versao certaina para quem esta de cima, e funciona sem
   rede. Quem abre o 3D sem WebGL ve a mesma informacao, em outra vista.
   ========================================================= */
(function (global) {
  'use strict';

  const V = global.Views || (global.Views = {});
  const M = global.Music;

  /* ------------------------------------------------------------
     GEOMETRIA DO INSTRUMENTO

     As medidas nao sao decorativas: sao as de um violao. Cordas separadas o
     suficiente para um dedo caber entre elas, e trastes com a largura de uma
     unha — e o que faz a posicao na tela bater com a posicao na mao. Um
     violao desenhado "bonito" com as cordas coladas ensina a pessoa a colocar
     o dedo no lugar errado.
     ------------------------------------------------------------ */
  const ESCALA = {
    cordas: 6,
    cordaEsp: 0.62,
    trasteL: 0.5,
    alturaL: 0.14,
    nutL: 0.5,
    nutH: 0.3,
  };

  /* Os recursos do three.js que precisam ser devolvidos.
   *
   * Cada violao aloca geometrias e materiais. Sem devolver, trocar de escala
   * umas vinte vezes esvazia a memoria da GPU — e o aparelho comeca a falhar
   * ao abrir outra tela, sem erro visivel.
   *
   * O registro e POR VIOLAO, e nao global. Um registro global seria limpo pela
   * criacao do violao seguinte, e o violao anterior — que continua na tela,
   * em outra aba — ficaria com geometria devolvida. No WebGL isso e pior que
   * vazamento: o objeto desenhado some, sem erro. Cada violao carrega o seu. */
  function registrar(r, pilha) { pilha.push(r); return r; }

  function soltar(pilha) {
    while (pilha.length) {
      const r = pilha.pop();
      try { if (r && r.dispose) r.dispose(); } catch (e) { /* ja devolvido */ }
    }
  }

  /**
   * Monta a cena do violao.
   *
   * Devolve `null` sem o three.js: quem chama precisa ter um caminho 2D. Nao
   * lanca, e nao tenta consertar — um 3D que falha e um 3D que nao existe.
   */
  function criar(opts) {
    const three = global.Gfx && global.Gfx.three;
    if (!three) return null;

    opts = opts || {};
    const nf = Math.max(1, Math.min(24, opts.frets || 12));
    const rotulos = opts.rotulos && opts.rotulos.length ? opts.rotulos : M.STRING_LABELS;
    const nc = rotulos.length;
    const inst = opts.inst ? M.instrumento(opts.inst) : null;
    const acordes = opts.acordes || [];
    const ouvir = typeof opts.ouvir === 'function' ? opts.ouvir : function () {};
    const rotulo = opts.rotulo || 'Traste';

    /* Os recursos deste violao. Vive aqui, e nao em um lugar global: um
       registro global seria esvaziado pela criacao do violao seguinte, e o
       violao anterior — que continua na tela, em outra aba — ficaria com
       geometria devolvida. No WebGL isso e pior que vazamento: o objeto
       desenhado simplesmente some, sem erro. */
    const pilha = [];

    const cena = new three.Scene();
    const camera = new three.PerspectiveCamera(40, 1, 0.1, 120);

    const largura = ESCALA.cordaEsp * (nc - 1);
    const comprimento = nf * ESCALA.trasteL;
    const centroX = comprimento / 2 - ESCALA.trasteL / 2;

    const raiz = new three.Group();
    cena.add(raiz);

    const zDaCorda = function (s) { return (s - (nc - 1) / 2) * ESCALA.cordaEsp; };
    const xDoTraste = function (f) { return f * ESCALA.trasteL + ESCALA.trasteL / 2 - 0.25; };

    /* ---- o braco ---- */
    const matBraco = registrar(new three.MeshStandardMaterial({
      color: 0x3b2617, roughness: 0.74, metalness: 0.03,
}), pilha);
    const geoBraco = registrar(new three.BoxGeometry(comprimento + 0.5, ESCALA.alturaL, largura + 0.66), pilha);
    const braco = new three.Mesh(geoBraco, matBraco);
    braco.position.set(centroX, -ESCALA.alturaL / 2 - 0.01, 0);
    raiz.add(braco);

    /* ---- os trastes ---- */
    const matTraste = registrar(new three.MeshStandardMaterial({
      color: 0xd9d3c6, roughness: 0.3, metalness: 0.7,
}), pilha);
    const geoTraste = registrar(new three.BoxGeometry(0.042, 0.03, largura + 0.13), pilha);
    for (let f = 0; f <= nf; f++) {
      const t = new three.Mesh(geoTraste, matTraste);
      t.position.set(f * ESCALA.trasteL - 0.25, 0.004, 0);
      raiz.add(t);
    }

    /* ---- a cravelha ---- */
    const matNut = registrar(new three.MeshStandardMaterial({
      color: 0xf4efe4, roughness: 0.38, metalness: 0.04,
}), pilha);
    const geoNut = registrar(new three.BoxGeometry(ESCALA.nutL, ESCALA.nutH, largura + 0.15), pilha);
    const cravelha = new three.Mesh(geoNut, matNut);
    cravelha.position.set(-0.25 - ESCALA.nutL / 2, 0.05, 0);
    raiz.add(cravelha);

    /* ---- as cordas ----
       A espessura muda da vala para a grave. E o que da a sensacao de peso ao
       olhar: seis linhas iguais nao dizem qual corda e a prima. */
    const cordas = [];
    for (let s = 0; s < nc; s++) {
      const raio = 0.021 + (s / Math.max(1, nc - 1)) * 0.02;
      const geo = registrar(new three.CylinderGeometry(raio, raio, comprimento + 0.85, 7, 1), pilha);
      const mat = registrar(new three.MeshStandardMaterial({
        color: s >= nc - 3 ? 0xc9bfa8 : 0xd6cfbe,
        roughness: 0.44, metalness: 0.56,
}), pilha);
      const c = new three.Mesh(geo, mat);
      // O cilindro do three.js e vertical. Deitar no X e o que faz a corda
      // correr ao longo do braco.
      c.rotation.z = Math.PI / 2;
      c.position.set(centroX, 0.052, zDaCorda(s));
      raiz.add(c);
      cordas.push({ mesh: c, raio: raio, s: s });
    }

    /* ---- os alvos de toque ----
       Um disco invisivel por traste. Invisible porque o que se ve e a nota
       desenhada; o disco e a area que o dedo acerta, e precisa ser maior que o
       ponto para o dedo nao errar o traste vizinho. */
    const alvos = [];
    const geoAlvo = registrar(new three.CircleGeometry(ESCALA.trasteL * 0.48, 14), pilha);
    geoAlvo.rotateX(-Math.PI / 2);
    const matAlvo = registrar(new three.MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: false,
}), pilha);
    for (let s = 0; s < nc; s++) {
      for (let f = 0; f < nf; f++) {
        const alvo = new three.Mesh(geoAlvo, matAlvo);
        alvo.position.set(xDoTraste(f), 0.07, zDaCorda(s));
        alvo.userData = { s: s, f: f, pc: M.fretNote(s, f, inst) };
        raiz.add(alvo);
        alvos.push(alvo);
      }
    }

    /* ---- as notas da escala ----
       A cor diz o papel: a tonica em laranja, o resto em azul. Um desenho de
       escala precisa dos dois, porque a tonica e a nota de referencia. */
    const notas = [];
    const set = new Set((opts.pcs || []).map(function (p) { return M.mod12(p); }));
    const rootPc = (opts.rootPc === undefined || opts.rootPc === null) ? null : M.mod12(opts.rootPc);

    const geoNotaBaixa = registrar(new three.SphereGeometry(0.058, 12, 9), pilha);
    const geoNotaAlta = registrar(new three.SphereGeometry(0.076, 14, 10), pilha);
    for (let s = 0; s < nc; s++) {
      for (let f = 0; f < nf; f++) {
        const pc = M.fretNote(s, f, inst);
        if (!set.has(pc)) continue;
        const isRoot = rootPc !== null && pc === rootPc;
        const mat = registrar(new three.MeshStandardMaterial({
          color: isRoot ? 0xff8a3d : 0x63c0ee,
          emissive: isRoot ? 0x5c2400 : 0x0a2a3c,
          roughness: 0.38, metalness: 0.12,
}), pilha);
        const n = new three.Mesh(isRoot ? geoNotaAlta : geoNotaBaixa, mat);
        n.position.set(xDoTraste(f), 0.095, zDaCorda(s));
        n.userData = { pc: pc, s: s, f: f, isRoot: isRoot };
        raiz.add(n);
        notas.push(n);
      }
    }

    /* ---- os aneis do desenho pedido ----
       Um anel em cada traste que o dedo deve ocupar. E o que transforma o
       desenho em instrucao: nao e "e C", e "aqui, nesta corda, neste traste". */
    const aneis = [];
    if (acordes.length) {
      const geoAnel = registrar(new three.TorusGeometry(0.1, 0.026, 7, 18), pilha);
      geoAnel.rotateX(Math.PI / 2);
      for (const a of acordes) {
        const formas = M.guitarShapes(a.pc, { quality: a.quality, inst: inst });
        if (!formas || !formas.length) continue;
        const primeira = formas[0];
        const frets = primeira.frets || primeira;
        if (!Array.isArray(frets)) continue;
        frets.forEach(function (fr) {
          const s = (fr && fr.s !== undefined) ? fr.s : (fr && fr.corda);
          const f = (fr && fr.f !== undefined) ? fr.f : (fr && fr.traste);
          if (s === undefined || f === undefined || s === null || f === null) return;
          const si = Number(s), fi = Number(f);
          if (!(si >= 0 && si < nc && fi >= 0 && fi < nf)) return;
          const mat = registrar(new three.MeshStandardMaterial({
            color: 0x8ef0c4, emissive: 0x1e6f4f, roughness: 0.34, metalness: 0.18,
}), pilha);
          const anel = new three.Mesh(geoAnel, mat);
          anel.position.set(xDoTraste(fi), 0.09, zDaCorda(si));
          raiz.add(anel);
          aneis.push(anel);
        });
      }
    }

    /* ---- a luz ----
       Tres, de proposito. A que preenche sozinha deixa o violao chapado, sem
       forma; sem a que marca nao se ve onde esta o traste, que e a informacao
       mais importante da cena. */
    cena.add(new three.HemisphereLight(0xe3ecf5, 0x2b2118, 1.45));
    const chave = new three.DirectionalLight(0xfff2df, 2.0);
    chave.position.set(4, 8, 5);
    cena.add(chave);
    const recorte = new three.DirectionalLight(0x9ed6ff, 0.65);
    recorte.position.set(-5, 3, -4);
    cena.add(recorte);

    /* ------------------------------------------------------------
       A CAMERA — o angulo de quem segura
       ------------------------------------------------------------ */
    let giro = 0;
    let altura = 0.6;
    let velGiro = 0;

    function enquadrar() {
      const dist = comprimento * 0.95 + 4.4;
      // O arco vai de cima (0.1, quase de cima) ate de frente (1.3). Acima de
      // 1.3 a camera passa do outro lado do braco e o violao fica invertido —
      // e ai o giro comeca a parecer um defeito, nao uma escolha.
      camera.position.set(
        centroX + Math.sin(altura) * 0.5,
        Math.cos(altura) * dist * 0.66 + 0.9,
        Math.sin(giro) * dist * 0.9
      );
      camera.lookAt(centroX, 0, 0);
    }

    /* Os angulos que travam.
     *
     * De cima, de frente e de lado sao as tres vistas em que alguem realmente
     * olha para o proprio braco. Entre elas, livre. E uma trava e nao um
     * limite: passar por elas e continuar e o que da a sensacao de objeto
     * real, e o que faz a pessoa parar de procurar o angulo certo. */
    const TRAVOS = [
      { g: 0, a: 0.12, nome: 'de cima' },
      { g: 0, a: 0.6, nome: 'segurando' },
      { g: Math.PI / 2, a: 0.45, nome: 'de lado' },
    ];

    /* O menor caminho de um angulo ate outro, em radianos, no intervalo
     * -PI..PI. Sem esta conta, virar o violao de 350 para 10 graus da uma
     * volta quase completa, e a pessoa ve o braco girar ao contrario. */
    function passoDeGiro(de, atual) {
      let d = de - atual;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    }

    function maisProximo(g, a) {
      let melhor = null;
      let dist = Infinity;
      for (const t of TRAVOS) {
        const dg = Math.abs(passoDeGiro(t.g, g));
        const da = Math.abs(t.a - a);
        const d = dg * 0.55 + da;
        if (d < dist) { dist = d; melhor = t; }
      }
      return { alvo: melhor, perto: dist < 0.22 };
    }

    /* A trava que a pessoa pediu.
     *
     * Enquanto existe, o violao vai ate ela. Sem isto os botoes de vista NAO
     * FAZIAM NADA, e era um defeito silencioso: pedindo "de lado" a partir de
     * "segurando", a velocidade levava o violao uns 0,6 rad para o lado — e a
     * atracao da trava vizinha, que continuava valendo, o devolvia em 22% por
     * quadro. O resultado final era o angulo de antes, com a pessoa achando que
     * o botao estava quebrado.
     *
     * A velocidade sozinha nunca chegava: `dg * 2.4` com decaimento de 10% por
     * quadro soma cerca de 0,6 rad no total, contra os 1,57 que separam
     * "segurando" de "de lado". Metade do caminho, sempre.
     *
     * A trava e um comando; o arraste e fisica. Sao caminhos diferentes e nao
     * deviam se misturar. */
    let trava = null;

    function girarPara(nome, imediato) {
      for (const t of TRAVOS) {
        if (t.nome !== nome) continue;
        if (imediato) {
          // Sem movimento (a pessoa pediu, ou o aparelho pediu): o violao vai
          // para o angulo e pronto. Sem isto, quem nao quer movimento veria a
          // travessia inteira quadro a quadro.
          trava = null;
          giro = t.g;
          altura = t.a;
          velGiro = 0;
          enquadrar();
          return true;
        }
        trava = t;
        velGiro = 0;
        return true;
      }
      return false;
    }

    function ajustarAngulo() {
      if (trava) {
        const d = passoDeGiro(trava.g, giro);
        giro += d * 0.11;
        altura += (trava.a - altura) * 0.11;
        if (Math.abs(d) < 0.004 && Math.abs(trava.a - altura) < 0.004) {
          // Chegou: fica exatamente no angulo pedido e devolve o controle para a
          // inercia e para a atracao das outras travas.
          giro = trava.g;
          altura = trava.a;
          trava = null;
        }
      } else {
        // A inercia e o que da peso. Sem ela, o violao gruda no dedo; com ela,
        // ele chega e para, que e como um objeto pequeno na mao se comporta.
        giro += velGiro * 0.016;
        velGiro *= 0.9;
        if (Math.abs(velGiro) < 0.0006) velGiro = 0;
        const p = maisProximo(giro, altura);
        if (p.perto && p.alvo) {
          // Atracao suave perto do travamento: sem ela, o objeto "pula" e a
          // pessoa perde a referencia de onde esta olhando.
          giro += passoDeGiro(p.alvo.g, giro) * 0.22;
          altura += (p.alvo.a - altura) * 0.22;
        }
      }
      altura = Math.max(0.08, Math.min(1.34, altura));
      enquadrar();
    }

    enquadrar();

    /* ------------------------------------------------------------
       A NOTA QUE ESTA SOANDO
       ------------------------------------------------------------ */
    let notaTocando = null;
    let relogioPulso = 0;
    let aoDesenhar = null;

    function tocar(pc, duracao) {
      const alvo = notas.find(function (n) { return n.userData.pc === M.mod12(pc); }) || null;
      /* So troca a nota que brilha se a procurada ESTA no desenho. Sem este
         cuidado, chamar `tocar` com uma nota fora do traste — o que acontece
         quando o dedo cai no braco e nao numa corda — apagava o brilho da nota
         que ainda estava soando, e o pulso morria no meio. */
      if (alvo) notaTocando = alvo;
      relogioPulso = performance.now();
      ouvir(M.mod12(pc), duracao);
      if (notaTocando && aoDesenhar) aoDesenhar();
    }

    /* Devolve o par corda/traste sob o ponteiro, ou null. */
    const raycaster = new three.Raycaster();
    const ponteiro = new three.Vector2();
    const ndc = new three.Vector2();

    function alvoEm(clientX, clientY, canvas) {
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ponteiro.copy(ndc);
      raycaster.setFromCamera(ponteiro, camera);
      const achados = raycaster.intersectObjects(alvos, false);
      return achados.length ? achados[0].object.userData : null;
    }

    return {
      cena: cena,
      camera: camera,
      raiz: raiz,
      notas: notas,
      cordas: cordas,
      alvos: alvos,
      aneis: aneis,
      comprimento: comprimento,
      largura: largura,
      rotulo: rotulo,
      gf: nf,

      /** Liga o desenho ao laco. */
      ligarDesenho: function (fn) { aoDesenhar = fn; },

      girarPara: girarPara,
      ajustarAngulo: ajustarAngulo,
      aoArrastar: function (dx, dy) {
        // Quem pegou no violao assume o controle. Sem soltar a trava aqui, a
        // interpolacao continuaria puxando de volta para o ultimo botao
        // apertado, e o arraste pareceria preso.
        trava = null;
        giro += dx * 0.0065;
        altura = Math.max(0.08, Math.min(1.34, altura - dy * 0.006));
        velGiro = dx * 0.02;
        enquadrar();
      },
      soltar: function () { velGiro = 0; },

      tocar: tocar,
      alvoEm: alvoEm,

      /** O que o laco chama a cada quadro. */
      desenhar: function () {
        if (notaTocando) {
          const dt = performance.now() - relogioPulso;
          const pulso = Math.max(0, 1 - dt / 640);
          notaTocando.material.emissive.setHex(0xff5a1a);
          notaTocando.material.emissiveIntensity = 0.6 + pulso * 2.6;
          notaTocando.scale.setScalar(1 + pulso * 0.55);
          if (pulso > 0) return true;   // ainda ha quadro a desenhar
        } else {
          for (const n of notas) {
            n.material.emissiveIntensity = 1;
            n.scale.setScalar(1);
          }
        }
        // A camera ainda esta andando? A travessia para um angulo leva uns 50
        // quadros, e o laco — que para sozinho para nao queimar bateria — so
        // continuaria se a cena dissesse que ainda falta quadro. Sem esta linha
        // o botao de vista desenhava UM quadro e a travessia congelava no
        // meio, sem nunca chegar no angulo pedido.
        return trava !== null || velGiro !== 0;
      },

      dispose: function () {
        soltar(pilha);
        cena.clear();
        aoDesenhar = null;
      },
    };
  }

  /* Le a geometria para quem quiser conferir sem abrir o 3D. */
  function medidas() {
    return {
      cordaEsp: ESCALA.cordaEsp,
      trasteL: ESCALA.trasteL,
      cordas: ESCALA.cordas,
      nutL: ESCALA.nutL,
      nutH: ESCALA.nutH,
      alturaL: ESCALA.alturaL,
    };
  }

  V.violao3d = { criar: criar, medidas: medidas };
  global.Violao3D = V.violao3d;

  if (typeof module !== 'undefined' && module.exports) module.exports = V.violao3d;
})(typeof window !== 'undefined' ? window : globalThis);