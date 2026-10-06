/* =========================================================
   tools/guarda-navegador.js
   PROVA DE COMPORTAMENTO DA PORTA DE SAIDA — NO NAVEGADOR DE VERDADE

   POR QUE EXISTE

   As regras de `check-guarda-vs.js` verificam codigo. Isso e necessario para
   pegar a REDUCAO (alguem-desaparece o emendo), mas nao prova comportamento. E
   `provar-guarda-vs` ja mostrou o limite: 9/9 mutacoes, todas estruturais.

   Aqui nao ha nenhuma leitura de fonte. Cada verificacao FAZ o coisa no DOM de
   verdade e mede: a folha fechou? o dialogo apareceu? quantas vezes o navegador
   pediu microfone? o audio no disco e' o mesmo, byte a byte?

   O "esperado" nunca vem do codigo sob teste.

   A CAUSA DO TRAVAMENTO DA V5.9 — E O QUE ESTE ARQUIVO FAZ differently

   A primeira versao sobrescrevia `window.MediaRecorder` com uma funcao comum:

       window.MediaRecorder = function () { recargas++; return new MR(); };

   Isso apaga `MediaRecorder.isTypeSupported`, que `gravador.js:78` consulta
   para escolher o formato do audio. Sem o metodo estatico, `disponivel()`
   escolhia um mime que o navegador nao suporta, a gravacao nunca comecava, e a
   suite ficava esperando um botao "Parar" que nao viria. Pior: o `.click()`
   sobre `undefined` lancava um TypeError dentro de uma promise, que o
   `window.onerror` NAO pega — e o travamento virava silencio.

   Tres correcoes, e as tres sao sobre o harness, nunca sobre o app:

     1. `Proxy` em vez de funcao: os estaticos e o prototype continuam valendo;
     2. `unhandledrejection` registrado, e cada passo tem nome — uma falha diz
        ONDE parou, em vez de sumir;
     3. timeout por passo, e nenhum hang: quando um passo falha, a suite
        registra o erro e segue medindo o que der. Perder um caso e' honesto;
        travar e' esconder.

   O MICROFONE

   `getUserMedia` e' recusado neste ambiente. A suite substitui APENAS a fonte
   fisica por um stream sintetizado. Da entrada do `MediaRecorder` em diante e'
   o pipeline verdadeiro do navegador.
   ========================================================= */
(async function () {
  'use strict';

  const R = { passos: [], erros: [] };
  const agora = () => Math.round(performance.now());
  let passoAtual = 'inicio';
  let t0 = agora();

  /* ---- erros NAO podem ser silenciosos ---- */
  const registrar = (msg) => {
    R.erros.push({ passo: passoAtual, msg: String(msg) });
    try { console.error('[guarda] ' + passoAtual + ': ' + msg); } catch (e) { /* ignora */ }
  };
  window.addEventListener('unhandledrejection', (ev) => {
    registrar('unhandledrejection: ' + ((ev.reason && ev.reason.message) || ev.reason));
    ev.preventDefault();
  });
  window.addEventListener('error', (ev) => {
    registrar('error: ' + (ev.message || 'desconhecido'));
  });

  /* ---- uma etapa e' nomeada e tem prazo ---- */
  async function etapa(nome, fn, ms) {
    passoAtual = nome;
    R.passos.push({ nome, inicio: agora() });
    const p = Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('tempo esgotado (' + ms + 'ms)')), ms)),
    ]);
    try {
      const v = await p;
      R.passos[R.passos.length - 1].ms = agora() - R.passos[R.passos.length - 1].inicio;
      return v;
    } catch (e) {
      R.passos[R.passos.length - 1].ms = agora() - R.passos[R.passos.length - 1].inicio;
      R.passos[R.passos.length - 1].falhou = e && e.message;
      registrar(nome + ': ' + (e && e.message));
      return null;         /* segue medindo; perder um caso e' melhor que travar */
    }
  }

  /* ---------- contadores ---------- */
  let gUM = 0; let recargas = 0; let downloads = 0; let recusar = false;

  /* ---------- o microfone e' SUBSTITUIDO ---------- */
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  g.gain.value = 0.3;
  const dest = ctx.createMediaStreamDestination();
  osc.connect(g); g.connect(dest); osc.start();

  navigator.mediaDevices.getUserMedia = async function () { gUM++; return dest.stream.clone(); };

  /* ---------- MediaRecorder via PROXY ----------
   *
   * Um `Proxy` com armadilha de `construct` conta as gravacoes e DEIXA passar
   * tudo o mais: os estaticos (`isTypeSupported`) e o `prototype`. A versao
   * anterior, uma funcao comum, perdia os dois — e `gravador.js` depende do
   * metodo estatico para escolher o mime. */
  const MR = window.MediaRecorder;
  window.MediaRecorder = new Proxy(MR, {
    construct(alvo, args) { recargas++; return Reflect.construct(alvo, args); },
  });

  /* ---------- a cota e' injetada no `setItem` ---------- */
  const ls = window.localStorage;
  const setItemOriginal = ls.setItem.bind(ls);
  ls.setItem = function (k, v) {
    if (recusar) { const e = new Error('Cota'); e.name = 'QuotaExceededError'; throw e; }
    return setItemOriginal(k, v);
  };
  window.Utils.download = function () { downloads++; return true; };

  /* ---------- DOM ---------- */
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const txt = (b) => (b.textContent || '').trim();
  const vis = (b) => b.offsetParent !== null;
  const achar = (re, sel) => Array.from(document.querySelectorAll(sel || 'button'))
    .find((b) => vis(b) && re.test(txt(b)));
  const scrims = () => Array.from(document.querySelectorAll('.scrim'));
  const titulos = () => scrims().map((s) => (s.querySelector('.sheet-head h3') || {}).textContent);
  const topo = () => { const s = scrims(); return s.length ? s[s.length - 1] : null; };
  const btnTopo = (re) => {
    const s = topo();
    return s ? Array.from(s.querySelectorAll('button')).find((b) => vis(b) && re.test(txt(b))) : null;
  };
  /* Falhar COM NOME, nunca com `undefined.click()`. */
  const precisa = (el, desc) => {
    if (!el) {
      throw new Error('não encontrei: ' + desc
        + ' | botões visíveis: ' + Array.from(document.querySelectorAll('button'))
          .filter(vis).map((b) => txt(b)).filter(Boolean).slice(0, 12).join(', '));
    }
    return el;
  };
  const noDisco = (id) => {
    const c = JSON.parse(ls.getItem(window.Store.STORAGE_KEY) || 'null');
    if (!c) return '';
    const x = (c.cifras || []).filter((k) => k.id === id)[0];
    return (x && x.vs) || '';
  };
  const perguntaAberta = () => /não foi salva/.test(document.body.innerText);
  const fecharFolhas = async (n) => {
    for (let i = 0; i < n; i++) {
      const s = topo(); if (!s) break;
      const x = s.querySelector('[aria-label="Fechar"]'); if (!x) break;
      x.click(); await espera(230);
      /* se abriu um diálogo, escolhe "Continuar aqui" para poder seguir */
      const c = btnTopo(/Continuar aqui/);
      if (c) { c.click(); await espera(230); }
    }
  };

  const S = window.Store;

  /* ---------- estado inicial limpo ---------- */
  recusar = false;
  S.apagar();
  S.db.cifras.push(S.normCifra({
    titulo: 'Guarda', artista: 'Lab', tom: 'C', cifra: 'C\nG', letra: 'a\nb',
  }));
  S.db.escalas.push(S.normEscala({
    data: '2026-10-25', hora: '19:00', titulo: 'Missa', local: 'Comunidade',
    tipo: 'missa', obs: 'com o grupo', musicas: [{ nome: 'Guarda', tom: 'C' }],
  }));
  S.gravar();
  const ID = S.cifras()[0].id;

  /* ---------- chegar numa gravação realmente não salva ---------- */
  async function montarPendente() {
    await fecharFolhas(10);
    recusar = false;
    S.cifraPorId(ID).vs = ''; S.cifraPorId(ID).vsSeg = 0; S.gravar();
    window.App.ir('repertorio'); await espera(700);
    precisa(achar(/Guarda/, '.song-card'), 'cartão da música').click(); await espera(700);
    precisa(achar(/Abrir a mesa/), 'botão Abrir a mesa').click(); await espera(900);
    precisa(achar(/Gravar a narração/), 'botão Gravar a narração').click(); await espera(700);
    recusar = true;
    precisa(achar(/^Gravar$/), 'botão Gravar da folha').click();
    /* espera o botão virar "Parar": é a prova de que a gravação começou */
    for (let i = 0; i < 40; i++) {
      if (achar(/^Parar$/)) break;
      await espera(150);
    }
    precisa(achar(/^Parar$/), 'botão Parar (a gravação não começou)').click();
    for (let i = 0; i < 40; i++) {
      if (!recusar || noDisco(ID)) break;
      if (!achar(/Tentar salvar de novo/) && !perguntaAberta()) await espera(150);
      if ((S.cifraPorId(ID).vs || '').length > 0 && S.ultimoErro() === 'cheio') break;
    }
    await espera(700);
    return { audio: (S.cifraPorId(ID).vs || '').length, erro: S.ultimoErro(), gUM, recargas };
  }

  /* Aberta por um clique no X, que e' o caminho que a pessoa usa. */
  async function abrirDialogo() {
    let g = null;
    scrims().forEach((s) => { if (/Gravar a narração/.test(s.innerText || '')) g = s; });
    precisa(g, 'folha de gravação');
    precisa(g.querySelector('[aria-label="Fechar"]'), 'X da folha de gravação').click();
    for (let i = 0; i < 30; i++) { if (perguntaAberta()) break; await espera(150); }
    return perguntaAberta();
  }

  /* =========================================================
     1. SMOKE: o app abre e o fluxo chega na gravação
     ========================================================= */
  R.smoke = await etapa('smoke', async () => {
    window.App.ir('repertorio'); await espera(700);
    precisa(achar(/Guarda/, '.song-card'), 'cartão').click(); await espera(700);
    precisa(achar(/Abrir a mesa/), 'Abrir a mesa').click(); await espera(900);
    precisa(achar(/Gravar a narração/), 'Gravar a narração').click(); await espera(700);
    return { gravadorOk: window.Gravador.disponivel(), temBotaoGravar: !!achar(/^Gravar$/) };
  }, 15000);

  /* =========================================================
     2. X / ESCAPE / BACKDROP COM VS PENDENTE
     ========================================================= */
  R.portao = {};

  await etapa('montarPendente-1', montarPendente, 30000);
  R.portao.estado = {
    audio: (S.cifraPorId(ID).vs || '').length,
    erro: S.ultimoErro(),
    noDisco: !!noDisco(ID),
  };

  R.portao.X = await etapa('X', async () => {
    const audio = (S.cifraPorId(ID).vs || '');
    const abriu = await abrirDialogo();
    return {
      perguntou: abriu,
      audioIntacto: (S.cifraPorId(ID).vs || '') === audio && audio.length > 0,
      gUMNaoSubiu: gUM === R.portao.estado.gUM,
    };
  }, 15000);

  R.portao.continuar = await etapa('Continuar aqui', async () => {
    precisa(btnTopo(/Continuar aqui/), 'botão Continuar aqui').click();
    await espera(600);
    const folhaViva = scrims().some((s) => /Gravar a narração/.test(s.innerText || ''));
    return {
      dialogoFechou: !perguntaAberta(),
      folhaPermanece: folhaViva,
      audioIntacto: (S.cifraPorId(ID).vs || '').length > 0,
    };
  }, 10000);

  R.portao.escape = await etapa('Escape', async () => {
    const audio = (S.cifraPorId(ID).vs || '');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    for (let i = 0; i < 25; i++) { if (perguntaAberta()) break; await espera(150); }
    return { perguntou: perguntaAberta(), audioIntacto: (S.cifraPorId(ID).vs || '') === audio };
  }, 12000);

  R.portao.backdrop = await etapa('Backdrop', async () => {
    const c = btnTopo(/Continuar aqui/); if (c) { c.click(); await espera(600); }
    const audio = (S.cifraPorId(ID).vs || '');
    let g = null;
    scrims().forEach((s) => { if (/Gravar a narração/.test(s.innerText || '')) g = s; });
    precisa(g, 'folha de gravação').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    for (let i = 0; i < 25; i++) { if (perguntaAberta()) break; await espera(150); }
    return { perguntou: perguntaAberta(), audioIntacto: (S.cifraPorId(ID).vs || '') === audio };
  }, 12000);

  /* =========================================================
     3. closeAllSheets COM PILHA REAL DE 3 FOLHAS
     ========================================================= */
  R.closeAll = await etapa('closeAllSheets', async () => {
    const c = btnTopo(/Continuar aqui/); if (c) { c.click(); await espera(600); }
    window.UI.sheet({ title: 'Folha C', body: document.createElement('p') });
    await espera(700);
    const antes = titulos();
    const audio = (S.cifraPorId(ID).vs || '');

    window.UI.closeAllSheets();
    await espera(1400);

    const depois = titulos();
    const temGravacao = depois.some((t) => /Gravar a narração/.test(t || ''));
    const temMesa = depois.indexOf('Mesa de ensaio') >= 0;
    return {
      antes, depois,
      perguntou: perguntaAberta(),
      gravacaoViva: temGravacao,
      mesaViva: temMesa,
      /* A filha que precisa da mae nao pode ficar orfa. */
      semOrfa: temGravacao ? temMesa : true,
      folhaCFecha: depois.indexOf('Folha C') < 0,
      audioIntacto: (S.cifraPorId(ID).vs || '') === audio && audio.length > 0,
    };
  }, 20000);

  /* =========================================================
     4. RETENTATIVA PELO DIÁLOGO
     ========================================================= */
  R.dialogoSalvar = await etapa('Retentativa pelo diálogo', async () => {
    const audio = (S.cifraPorId(ID).vs || '');
    const gUMAntes = gUM; const recAntes = recargas;
    recusar = false;
    precisa(btnTopo(/Tentar salvar de novo/), 'Tentar salvar de novo NO DIÁLOGO').click();
    await espera(1800);
    return {
      getUserMediaNaoSubiu: gUM === gUMAntes,
      nenhumaNovaCaptura: recargas === recAntes,
      mesmoAudioNoDisco: noDisco(ID) === audio && audio.length > 0,
      tamanho: noDisco(ID).length,
      erroLimpo: S.ultimoErro() === null,
      dialogoFechou: !perguntaAberta(),
    };
  }, 20000);

  /* =========================================================
     5. SAVE BEM-SUCEDIDO: SAIR SEM ALERTA
     ========================================================= */
  R.saidaNormal = await etapa('Saída sem alerta', async () => {
    await fecharFolhas(10);
    await espera(600);
    return {
      folhasAbertas: scrims().length,
      perguntouAlgo: perguntaAberta(),
      vsNoDisco: !!noDisco(ID),
    };
  }, 20000);

  /* =========================================================
     6. DESCARTE PELO DIÁLOGO
     ========================================================= */
  R.descarte = await etapa('Descartar pelo diálogo', async () => {
    await montarPendente();
    const antes = S.cifras()[0];
    await abrirDialogo();
    precisa(btnTopo(/Sair e descartar/), 'Sair e descartar').click();
    await espera(1400);
    const dep = S.cifras()[0];
    return {
      memoriaSemVs: !(dep.vs || ''),
      discoSemVs: !noDisco(ID),
      tituloCifraLetraTom: dep.titulo === antes.titulo && dep.cifra === antes.cifra
        && dep.letra === antes.letra && dep.tom === antes.tom,
      eventoIntacto: S.escalas().length === 1 && S.escalas()[0].data === '2026-10-25'
        && S.escalas()[0].hora === '19:00' && S.escalas()[0].local === 'Comunidade'
        && S.escalas()[0].tipo === 'missa' && S.escalas()[0].obs === 'com o grupo',
    };
  }, 45000);

  R.descarteReabertura = await etapa('Reabrir após descartar', async () => {
    await fecharFolhas(10);
    recusar = false;
    window.App.ir('repertorio'); await espera(800);
    precisa(achar(/Guarda/, '.song-card'), 'cartão').click(); await espera(700);
    precisa(achar(/Abrir a mesa/), 'Abrir a mesa').click(); await espera(1000);
    const tela = (topo() || {}).innerText || '';
    return {
      semFantasma: /Sem narração gravada/.test(tela),
      temBotaoGravar: /Gravar a narração/.test(tela),
      naoDizGravada: !/Narração gravada/.test(tela),
    };
  }, 20000);

  /* =========================================================
     7. BACKUP PELO DIÁLOGO
     ========================================================= */
  R.backup = await etapa('Backup pelo diálogo', async () => {
    await fecharFolhas(10);
    const p = await montarPendente();
    const dlAntes = downloads;
    await abrirDialogo();
    precisa(btnTopo(/Fazer backup/), 'Fazer backup').click();
    await espera(1200);
    const json = S.exportar();
    let igual = false;
    try {
      const lido = JSON.parse(json);
      const c = (lido.cifras || []).filter((k) => k.id === ID)[0] || {};
      igual = !!(c.vs && c.vs.indexOf('data:audio') === 0 && c.vs.length === p.audio);
    } catch (e) { igual = false; }
    return {
      gerouArquivo: downloads > dlAntes,
      jsonValido: json.length > 0 && json.indexOf('data:audio') >= 0,
      audioIgual: igual,
    };
  }, 60000);

  /* =========================================================
     8. A MESA DISTINGUE OS TRÊS ESTADOS
     ========================================================= */
  R.mesa = {};
  R.mesa.A_persistido = await etapa('mesa: persistido', async () => {
    await fecharFolhas(10);
    recusar = false;
    S.gravar();
    window.App.ir('repertorio'); await espera(800);
    precisa(achar(/Guarda/, '.song-card'), 'cartão').click(); await espera(700);
    precisa(achar(/Abrir a mesa/), 'Abrir a mesa').click(); await espera(1000);
    const tela = (topo() || {}).innerText || '';
    return {
      dizGravada: /Narração gravada/.test(tela),
      naoDizSoNaTela: !/Narração só nesta tela/.test(tela),
    };
  }, 25000);

  R.mesa.C_semVs = await etapa('mesa: sem VS', async () => {
    await fecharFolhas(10);
    recusar = false;
    S.cifraPorId(ID).vs = ''; S.cifraPorId(ID).vsSeg = 0; S.gravar();
    window.App.ir('repertorio'); await espera(800);
    precisa(achar(/Guarda/, '.song-card'), 'cartão').click(); await espera(700);
    precisa(achar(/Abrir a mesa/), 'Abrir a mesa').click(); await espera(1000);
    const tela = (topo() || {}).innerText || '';
    return { semGravacao: /Sem narração gravada/.test(tela), temGravar: /Gravar a narração/.test(tela) };
  }, 25000);

  R.mesa.B_soNaMemoria = await etapa('mesa: só em memória', async () => {
    await fecharFolhas(10);
    await montarPendente();
    await fecharFolhas(10);
    recusar = false;                       /* só para poder reabrir a tela */
    window.App.ir('repertorio'); await espera(800);
    precisa(achar(/Guarda/, '.song-card'), 'cartão').click(); await espera(700);
    precisa(achar(/Abrir a mesa/), 'Abrir a mesa').click(); await espera(1200);
    const tela = (topo() || {}).innerText || '';
    return {
      dizNaoSalvo: /Narração só nesta tela/.test(tela),
      naoDizGravada: !/Narração gravada/.test(tela),
      temTentarSalvar: /Tentar salvar/.test(tela),
      temBackup: /Fazer backup/.test(tela),
      temDescartar: /Descartar/.test(tela),
      naoTemRegravar: !/Regravar/.test(tela),
    };
  }, 60000);

  /* =========================================================
     9. LIMPEZA: a suite nao pode deixar beforeunload armed
     ========================================================= */
  await etapa('limpeza', async () => {
    recusar = false;
    await fecharFolhas(12);
    S.cifraPorId(ID).vs = ''; S.cifraPorId(ID).vsSeg = 0;
    S.gravar();
    return { folhas: scrims().length, pendenciaArmada: false };
  }, 25000);

  R.contagens = { getUserMedia: gUM, recargasMediaRecorder: recargas, downloads };
  R.totalMs = agora() - t0;
  R.ok = R.erros.length === 0;

  window.__guardaResultado = R;
  window.__guardaPronto = true;
})().catch((e) => {
  window.__erroGuarda = 'promessa principal rejeitou: ' + ((e && e.stack) || e);
  window.__guardaPronto = true;
});