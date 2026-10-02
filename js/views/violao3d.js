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

     A ESCALA ABAIXO era a mesma para todo instrumento. Com o app passa a ter
     violino, cavaquinho e ukulele, isso virou uma mentira: o braco do ukulele
     sao 6 cm, o do baixo tem 9 cm de corda grave, e o violino NAO TEM TRASTE.
     Uma imagem so para os seis nao e um atalho, e o desenho ensinado errado.

     `semTrastes` e a resposta mais importante da lista: e a unica forma de o
     violino ser violino, e nao um ukulele com quatro cordas. */
  const ESCALA = {
    cordas: 6,
    cordaEsp: 0.62,
    trasteL: 0.5,
    alturaL: 0.14,
    nutL: 0.5,
    nutH: 0.3,
  };

  /* O que muda de um instrumento para o outro.
   *
   * `escalaComprimento` e a medida da escala em trastes — o comprimento da
   * corda da cravelha ate a ponte. E de onde sai a largura dos trastes, e o
   * valor que decide a forma do braco inteiro.
   *
   * Esta lista tem uma entrada por INSTRUMENTO, e nao por timbre. O violao de
   * nylon tem o mesmo braco do violao de aco — o que muda e a corda e o som,
   * nao a madeira nem a medida. Um `violaoClassico` aqui seria duas medidas
   * para o mesmo braco, e as duas valendo ao mesmo tempo. */
  const GEOMETRIA = {
    violao: { cordaEsp: 0.62, escalaComprimento: 8.9, alturaL: 0.14, nutL: 0.5, nutH: 0.3, cabeca: true, trastes: true },
    baixo: { cordaEsp: 0.74, escalaComprimento: 10.2, alturaL: 0.17, nutL: 0.55, nutH: 0.34, cabeca: true, trastes: true },
    baixo5: { cordaEsp: 0.78, escalaComprimento: 10.2, alturaL: 0.17, nutL: 0.55, nutH: 0.34, cabeca: true, trastes: true },
    ukulele: { cordaEsp: 0.44, escalaComprimento: 6.2, alturaL: 0.11, nutL: 0.34, nutH: 0.22, cabeca: true, trastes: true },
    cavaquinho: { cordaEsp: 0.46, escalaComprimento: 6.6, alturaL: 0.12, nutL: 0.38, nutH: 0.24, cabeca: true, trastes: true },
    violino: { cordaEsp: 0.5, escalaComprimento: 7.4, alturaL: 0.13, nutL: 0.42, nutH: 0.26, cabeca: true, trastes: false },
  };

  function geometriaDe(inst) {
    if (!inst || !inst.id) return GEOMETRIA.violao;
    return GEOMETRIA[inst.id] || GEOMETRIA.violao;
  }

  /* ------------------------------------------------------------
     A POSICAO DE UM TRASTE — a correcao que mais aparece

     Todo braco de corda tem os trastes mais juntos conforme se sobe, e a lei e
     a mesma em todos: o traste `n` fica a `1 - 2^(-n/12)` da escala.

     A consequencia que qualquer musico reconhece na hora: o decimo segundo
     traste fica exatamente na METADE do comprimento. E o que permite medir um
     braco sem regua.

     A versao anterior espalhava os trastes em intervalos iguais. Isso e um
     desenho, nao um braco: num violao de verdade o traste 12 fica em 4,45
     unidades e o desenho o colocava em 6 — um terco mais longe, e todos os
     trastes a partir do oitavo fora de lugar. Quem aprende por este desenho
     aprende a contagem errada, e o erro so aparece no brao de verdade. */
  function posicaoDeTraste(f, escalaComprimento) {
    return escalaComprimento * (1 - Math.pow(2, -f / 12));
  }

  /* Em que traste vao os marcadores de posicao.
   *
   * Nao e enfeite: sao a forma de CONTAR o traste sem tirar o olho do braco, e
   * e o que permite saber que o dedo esta no quinto sem ir ate a cravelha.
   *
   * No violino nao ha nem traste nem marcador. Quem toca conta pela altura da
   * quarta — e por isso que um violino com trastes marcados parece errado para
   * quem sabe, do mesmo jeito que parece certo para quem nunca viu um.
   *
   * Vive aqui, e nao dentro de `criar()`: houve duas listas, uma em cada lugar,
   * e a de dentro da cena era a que o desenho usava enquanto `medidas()` lia a
   * de fora. Mudar uma nao mudava a outra, e o teste conferia a que nao era
   * a que mandava na tela. Uma lista, um lugar. */
  /* A largura do primeiro traste, e o que `medidas()` devolve como `trasteL`.
   *
   * O nome antigo continua valendo porque e o que as telas e os testes ja
   * leem. E ele e a largura do PRIMEIRO traste de proposito: os seguintes sao
   * mais estreitos, e nao existe "a largura do traste" num braco de verdade. */
  const MARCADORES = [3, 5, 7, 9, 12];

  /* O comprimento da cabeca, em funcao da cravelha.
   *
   * Um valor so, usado pela cena E por `medidas()`. Com o numero escrito em
   * cada lugar, um `compCabeca = 0` na cena e um `2.1` na medicao conviviam
   * sem ninguem notar — e o teste confirmava uma cabeca que nao existia. */
  function comprimentoDaCabeca(g) {
    return g.cabeca !== false ? g.nutL * 2.1 : 0;
  }

  /* Quantas cordas o instrumento tem, que e o numero de chaves na cabeca. */
  function cordasDe(instId) {
    if (instId) {
      const achado = M.instrumento(instId);
      if (achado && typeof achado.cordas === 'number') return achado.cordas;
    }
    return ESCALA.cordas;
  }

  /* A escala precisa ser escolhida para o primeiro traste ter a largura de
   * referencia do VIOLAO. A versao anterior media em intervalos iguais e o
   * `trasteL` era literalmente o primeiro intervalo; agora e o mesmo numero,
   * tirado da escala real — e o que mantem o violao com a largura que tinha
   * antes, so que com a forma certa.
   *
   * Repare que `trasteL` NAO e a largura do primeiro traste de qualquer
   * instrumento: e a do violao. O baixo tem escala maior, entao o primeiro
   * traste dele e mais largo — e tem de ser, porque o braco dele e maior. E o
   * ukulele tem escala menor e traste mais estreito. Uma largura igual para
   * todos so seria uma foto. */
  function escalaPara(trasteL) {
    return trasteL / (1 - Math.pow(2, -1 / 12));
  }

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

    const geoBase = geometriaDe(opts.inst ? M.instrumento(opts.inst) : null);
    const cordaEsp = geoBase.cordaEsp;
    const alturaL = geoBase.alturaL;
    const nutL = geoBase.nutL;
    const nutH = geoBase.nutH;
    const temTraste = geoBase.trastes !== false;

    /* A largura da corda e da escala sao o que muda de um instrumento para o
     * outro. `escalaPara` mantem o primeiro traste com a largura de referencia,
     * e o resto vem da lei real — o que faz o braco do ukulele ser curto sem
     * mudar nada do que ja estava certo no violao. */
    const escalaCorda = escalaPara(ESCALA.trasteL) * (geoBase.escalaComprimento / 8.9);
    const largura = cordaEsp * (nc - 1);
    const ultimoTraste = posicaoDeTraste(nf, escalaCorda);
    const comprimento = ultimoTraste + ESCALA.trasteL / 2;
    const centroX = comprimento / 2 - ESCALA.trasteL / 2;

    const raiz = new three.Group();
    cena.add(raiz);

    const zDaCorda = function (s) { return (s - (nc - 1) / 2) * cordaEsp; };
    const xDoTraste = function (f) { return posicaoDeTraste(f, escalaCorda) - ESCALA.trasteL / 2; };

    /* ---- o braco ---- */
    const matBraco = registrar(new three.MeshStandardMaterial({
      color: 0x3b2617, roughness: 0.74, metalness: 0.03,
}), pilha);
    const geoBraco = registrar(new three.BoxGeometry(comprimento + 0.5, alturaL, largura + 0.66), pilha);
    const braco = new three.Mesh(geoBraco, matBraco);
    braco.position.set(centroX, -alturaL / 2 - 0.01, 0);
    raiz.add(braco);

    /* ---- os trastes ----
       Nas posicoes que a lei manda, e nao em intervalos iguais. Sem isso o
       decimo segundo traste fica a um terco de onde ele esta, e quem esta
       aprendendo conta errado. */
    const matTraste = registrar(new three.MeshStandardMaterial({
      color: 0xd9d3c6, roughness: 0.3, metalness: 0.7,
}), pilha);
    const geoTraste = registrar(new three.BoxGeometry(0.042, 0.03, largura + 0.13), pilha);
    if (temTraste) {
      for (let f = 0; f <= nf; f++) {
        const t = new three.Mesh(geoTraste, matTraste);
        t.position.set(posicaoDeTraste(f, escalaCorda) - ESCALA.trasteL / 2, 0.004, 0);
        raiz.add(t);
      }
    }

    /* ---- os marcadores de posicao ----
       Os pontinhos do tabuleiro, nos trastes 3, 5, 7 e 9, e dois no 12.
       Nao sao enfeite: eles sao a forma de CONTAR o traste sem tirar o olho do
       braco. E o que permite saber que o dedo esta no quinto sem ir ate a
       cravelha e contar, que e o que se faz no palco. */
    const geoMarca = registrar(new three.CylinderGeometry(0.036, 0.036, 0.008, 12), pilha);
    const matMarca = registrar(new three.MeshStandardMaterial({
      color: 0xe8e2d4, roughness: 0.42, metalness: 0.05,
}), pilha);
    const marcas = [];
    if (temTraste) {
      for (const f of MARCADORES) {
        if (f > nf) continue;
        const x = (posicaoDeTraste(f, escalaCorda) + posicaoDeTraste(f - 1, escalaCorda)) / 2
          - ESCALA.trasteL / 2;
        // No 12 saem dois, porque e onde o olho procura o fim do braco.
        const zs = f === 12 && nc >= 5
          ? [-(cordaEsp * (nc - 1)) / 6, (cordaEsp * (nc - 1)) / 6]
          : [0];
        for (const z of zs) {
          const m = new three.Mesh(geoMarca, matMarca);
          m.position.set(x, 0.006, z);
          raiz.add(m);
          marcas.push(m);
        }
      }
    }

    /* ---- a cravelha ---- */
    const matNut = registrar(new three.MeshStandardMaterial({
      color: 0xf4efe4, roughness: 0.38, metalness: 0.04,
}), pilha);
    const geoNut = registrar(new three.BoxGeometry(nutL, nutH, largura + 0.15), pilha);
    const cravelha = new three.Mesh(geoNut, matNut);
    cravelha.position.set(-ESCALA.trasteL / 2 - nutL / 2, 0.05, 0);
    raiz.add(cravelha);

    /* ---- a cabeca, onde as cordas vao morrer ----
       Sem isto as cordas saem no vazio do lado da cravelha. E a peca que faz a
       pessoa entender que o desenho e um INSTRUMENTO e nao um tabuleiro solto —
       e onde estao as chaves, que e a primeira coisa que se procura quando uma
       corda esta desafinada. */
    const compCabeca = comprimentoDaCabeca(geoBase);
    const matCabeca = registrar(new three.MeshStandardMaterial({
      color: 0x33200f, roughness: 0.68, metalness: 0.04,
}), pilha);
    const geoCabeca = registrar(new three.BoxGeometry(compCabeca, alturaL * 0.86, largura + 0.2), pilha);
    const cabeca = new three.Mesh(geoCabeca, matCabeca);
    const xCabeca = -ESCALA.trasteL / 2 - nutL - compCabeca / 2;
    cabeca.position.set(xCabeca, 0.02, 0);
    raiz.add(cabeca);

    /* Uma chave por corda, alternando os lados como num violao de verdade. */
    const geoChave = registrar(new three.CylinderGeometry(0.028, 0.028, 0.13, 8), pilha);
    const matChave = registrar(new three.MeshStandardMaterial({
      color: 0xcfcabd, roughness: 0.32, metalness: 0.62,
}), pilha);
    const chaves = [];
    for (let s = 0; s < nc; s++) {
      for (const lado of [-1, 1]) {
        const c = new three.Mesh(geoChave, matChave);
        c.rotation.x = Math.PI / 2;
        c.position.set(
          xCabeca + (s % 2 ? 1 : -1) * compCabeca * 0.22,
          0.055,
          lado * (largura + 0.2) / 2 + lado * 0.04
        );
        raiz.add(c);
        chaves.push(c);
      }
    }

    /* ---- as cordas ----
       A espessura muda da vala para a grave. E o que da a sensacao de peso ao
       olhar: seis linhas iguais nao dizem qual corda e a prima.
       E cada corda nasce na SUA chave e atravessa a cravelha ate o fim do
       braco — antes elas simplesmente apareciam no nada, do lado da cravelha,
       sem cabeca ondeelas terminassem. */
    const cordas = [];
    const xDaChave = -ESCALA.trasteL / 2 - nutL * 1.1;
    for (let s = 0; s < nc; s++) {
      const raio = 0.021 + (s / Math.max(1, nc - 1)) * 0.02;
      const comp = comprimento + Math.abs(xDaChave) + ESCALA.trasteL / 2;
      const geo = registrar(new three.CylinderGeometry(raio, raio, comp, 7, 1), pilha);
      const mat = registrar(new three.MeshStandardMaterial({
        color: s >= nc - 3 ? 0xc9bfa8 : 0xd6cfbe,
        roughness: 0.44, metalness: 0.56,
}), pilha);
      const c = new three.Mesh(geo, mat);
      // O cilindro do three.js e vertical. Deitar no X e o que faz a corda
      // correr ao longo do braco.
      c.rotation.z = Math.PI / 2;
      // A corda entra inclinada: nasce na chave, de lado, e chega no meio da
      // cravelha. Uma corda reta nao tem gancho, e nao parece afinada.
      const meio = (xDaChave + comprimento) / 2;
      c.position.set(meio, 0.052, zDaCorda(s) * (0.52 + 0.48 * (meio - xDaChave) / (comprimento - xDaChave)));
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

  /* ------------------------------------------------------------
     A GEOMETRIA, PARA QUEM QUISER CONFERIR SEM ABRIR O 3D

     Isto nao e so para depurar. E o que permite PROVAR que o braco esta com a
     forma certa: a lei do traste, a largura do ukulele contra a do baixo e o
     violino sem traste sao afirmações verificáveis, e não são o tipo de coisa
     que se descobre olhando uma captura de tela.
     ------------------------------------------------------------ */
  function medidas(instId, nf) {
    const g = geometriaDe(instId ? M.instrumento(instId) : null);
    /* O numero de trastes tem de ser um INTEIRO. `Math.max(1, Math.min(24, 1.5))`
     * devolve 1,5, e `posicoes[1.5]` e `undefined` — o comprimento do braco
     * saia `NaN`, a camera era posicionada em `NaN`, e o 3D simplesmente nao
     * aparecia. Sem erro, sem aviso: so a tela vazia. */
    const n = Math.max(1, Math.min(24, Math.round(Number(nf)) || 12));

    /* O violino NAO tem traste, e o valor vem da tabela sem nenhuma conversa.
     *
     * Isto era escrito como `trastes: g.trastes !== false` dentro do objeto de
     * retorno, e devolvia `true` para um instrumento cuja tabela diz `false` —
     * com `geometriaDe()`, com a tabela e com o arquivo inteiro conferidos um
     * por um. A conta feita a mao, na mesma funcao, dava `false`. Nao ha
     * explicacao para isso, e um `||` no lugar errado seria um paliativo.
     *
     * Ler o valor e pronto resolve, e deixa a fonte da verdade em um lugar so:
     * quem decide se o violino tem traste e a tabela, nao uma comparacao feita
     * em tres lugares diferentes. */
    const temTraste = g.trastes === true;
    const escala = escalaPara(ESCALA.trasteL) * (g.escalaComprimento / 8.9);

    const posicoes = [];
    for (let f = 0; f <= n; f++) posicoes.push(posicaoDeTraste(f, escala));

    /* As larguras entre traste e traste. E o que o olho ve: elas encolhem. */
    const larguras = [];
    for (let f = 1; f <= n; f++) larguras.push(posicoes[f] - posicoes[f - 1]);

    return {
      cordaEsp: g.cordaEsp,
      cordas: g.cordaEsp && instId && M.instrumento(instId) ? M.instrumento(instId).cordas : ESCALA.cordas,
      alturaL: g.alturaL,
      trasteL: larguras[0],
      nutL: g.nutL,
      nutH: g.nutH,
      trastes: temTraste,
      escala: escala,
      posicoes: posicoes,
      larguras: larguras,
      comprimento: posicoes[n] + ESCALA.trasteL / 2,
      /* As pecas que existem, e nao so as que o codigo menciona.
       *
       * Verificar que o arquivo contem a palavra `MARCADORES` e que contem
       * `compCabeca` nao prova nada: as duas sobreviveriam a um
       * `MARCADORES = []` e a um `compCabeca = 0`, que sao exatamente os
       * defeitos. O que prova e a quantidade — e por isso que elas sao dados
       * aqui, e nao so texto na tela. */
      marcadores: temTraste ? MARCADORES.filter(function (f) { return f <= n; }) : [],
      chavesPorLado: cordasDe(instId),
      cabeca: comprimentoDaCabeca(g) > 0,
      cabecaComprimento: comprimentoDaCabeca(g),
    };
  }

  /** A lei do traste, exposta. E matematica pura: nao depende de three.js. */
  function posicaoDeTrasteDe(f, escala) {
    return posicaoDeTraste(f, escala);
  }

  V.violao3d = { criar: criar, medidas: medidas, posicaoDeTraste: posicaoDeTrasteDe, GEOMETRIA: GEOMETRIA };
  global.Violao3D = V.violao3d;

  if (typeof module !== 'undefined' && module.exports) module.exports = V.violao3d;
})(typeof window !== 'undefined' ? window : globalThis);