/* =========================================================
   ACORDE - core/store.js
   Persistencia, modelo de dados e migracao.
   Expõe window.Store.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const STORAGE_KEY = 'acorde_v4';
  const SCHEMA = 4;
  const MAX_BYTES = 4.5 * 1024 * 1024;

  /* ---------------- modelo ----------------
     escalas: {id, data, hora, titulo, local, tipo, obs, status, musicas[]}
     musica:  {id, nome, artista, tom, bpm, compasso, categoria,
               responsavel, cifraId, yt, ytId, cf, foto, obs}
     cifra:   {id, titulo, artista, tom, bpm, compasso, categoria,
               tags[], letra, cifra}
  */
  function vazio() {
    return {
      version: SCHEMA,
      escalas: [],
      cifras: [],
      ajustes: {
        tema: 'auto',
        accent: 'ember',
        densidade: 'normal',
        fontsize: 'md',
        motion: 'on',
        notificacoes: true,
        antecedenciaNotif: 120,
        usarAmoles: 'auto',
        inicioSemana: 0,
        autoLink: true,
        bpmPadrao: 100,
        compassoPadrao: 4,
        metroSom: 'click',
        metroVolume: 0.8,
        metroSubdivisao: 1,
        metroAcento: true,

        /* O instrumento e a unica escolha que dirige tres coisas ao mesmo
         * tempo: o timbre do som, o braco que aparece nas telas de teoria e o
         * violao 3D. Por isso ele nao e uma preferencia solta — e o
         * primeiro item que o app precisa saber. */
        instrumento: 'violao',
      },
      meta: { criadoEm: Date.now(), atualizadoEm: Date.now() },
    };
  }

  let db = vazio();
  let listeners = [];
  let timer = null;
  let ultimoErro = null;

  function carregar() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { db = vazio(); return db; }
    if (!raw) { db = vazio(); return db; }
    try { db = migrar(JSON.parse(raw)); }
    catch (e) { console.error('[Store] dados corrompidos:', e); db = vazio(); }
    return db;
  }

  /**
   * Copia um conjunto de campos conhecidos de um objeto para outro.
   *
   * Existe no lugar de Object.assign para dados vindos de fora. Com
   * Object.assign, uma chave "__proto__" no arquivo de backup altera o
   * prototipo do destino, e toda leitura passa a resolver por ele. Aqui so
   * entram os campos nomeados, entao o objeto fica com o que ele deveria
   * ter, qualquer que seja o que o arquivo traga.
   *
   * Chave a mais nao e erro: um backup de versao mais nova pode ter ajustes
   * que esta versao ainda nao conhece, e recusar o arquivo inteiro por
   * causa disso seria pior do que ignorar.
   */
  function copiarCampos(destino, origem, campos) {
    const de = (origem && typeof origem === 'object' && !Array.isArray(origem)) ? origem : {};
    for (let i = 0; i < campos.length; i++) {
      const c = campos[i];
      // So copia quando a chave existe DE VERDADE no origem.
      //
      // Sem esta checagem, um backup que nao traga o campo apaga o padrao do
      // app: o destino ja vem com `tema: 'auto'`, a copia escreve `undefined`
      // por cima, e o app fica sem tema sem erro nenhum. E o oposto de
      // completar um backup — e apaga-lo.
      //
      // A chave "__proto__" continua barrada porque o laco anda pela lista de
      // campos conhecidos, nunca pelas chaves do arquivo.
      if (Object.prototype.hasOwnProperty.call(de, c)) destino[c] = de[c];
    }
    return destino;
  }

  /* Os ajustes reconhecidos. A lista e a mesma de `vazio()`.
   *
   * `check-proto.js` falha quando as duas deixam de bater, e essa lista e a
   * RAZAO de ela existir: sem ela, um ajuste novo entra em `vazio()`, o app
   * funciona, e o backup sai sem ele. A pessoa restaura, o instrumento volta
   * ao violao, e nada diz por que — o importador cuida de um backup sem
   * reclamar, que e a unica forma de ele passar despercebido. */
  const CAMPOS_AJUSTES = ['tema', 'accent', 'densidade', 'fontsize', 'motion', 'notificacoes', 'antecedenciaNotif', 'usarAmoles', 'inicioSemana', 'autoLink', 'bpmPadrao', 'compassoPadrao', 'metroSom', 'metroVolume', 'metroSubdivisao', 'metroAcento', 'instrumento'];
  /** O que o app guarda sobre a pessoa. Lista curta de proposito. */
  const CAMPOS_META = ['criadoEm', 'atualizadoEm'];

  /* =========================================================
     o que abaixo e a entrada nao confiavel de verdade

     Nao ha servidor, nem formulario, nem parametro de URL. O unico lugar
     onde entra dado de fora e a importacao de backup — um arquivo que a
     pessoa abre com a mao.
     ========================================================= */
  /* Os campos sao lidos de `vazio()` por `tools/check-proto.js`, que falha
     se a lista aqui e a de la deixarem de bater. */
  function migrar(d) {
    const base = vazio();
    if (!d || typeof d !== 'object') return base;
    // v1 antigo: { 'AAAA-MM-DD': [{id, titulo, musicas:[{nome,tom,yt,cf,foto}]}] }
    if (!d.escalas && !d.cifras) {
      const leg = [];
      Object.keys(d).forEach(function (data) {
        (Array.isArray(d[data]) ? d[data] : []).forEach(function (e) {
          leg.push(normEscala({
            id: e.id, data: data, titulo: e.titulo,
            musicas: (e.musicas || []).map(normMusica),
          }));
        });
      });
      base.escalas = leg;
      return base;
    }
    base.escalas = (Array.isArray(d.escalas) ? d.escalas : []).map(normEscala);
    base.cifras = (Array.isArray(d.cifras) ? d.cifras : []).map(normCifra);
    base.ajustes = copiarCampos(base.ajustes, d.ajustes, CAMPOS_AJUSTES);
    base.meta = copiarCampos(base.meta, d.meta, CAMPOS_META);
    base.version = SCHEMA;
    return base;
  }

  /** Tipos de evento reconhecidos, na ordem em que aparecem nos filtros. */
  const TIPOS = ['missa', 'ensaio', 'show', 'outro'];

  /**
   * Tipos que o app usava antes, e o que cada um virou.
   *
   * Um evento ja salvo continua valendo: a traducao roda na leitura, e o que
   * volta a ser gravado ja sai no vocabulario novo. Sem ela, trocar a lista de
   * tipos teria o efeito colateral de apagar a distincao de todo mundo que ja
   * usava o app.
   */
  const TIPOS_ANTIGOS = {
    culto: 'missa',
    louvor: 'missa',
    missa: 'missa',
    ensaio: 'ensaio',
    rehearsal: 'show',
    show: 'show',
    outro: 'outro',
  };

  function normEscala(e) {
    e = e || {};
    // Tipos antigos viram os novos. Quem ja usava o app tem 'culto' e
    // 'rehearsal' gravados no armazenamento; sem esta traducao o evento cairia
    // no padrao e viraria 'outro', perdendo a cor e o icone sem avisar. A
    // traducao acontece na normalizacao, ou seja, na leitura — nao aqui, onde
    // o evento ja seria gravado de volta.
    const tipoLido = TIPOS_ANTIGOS[String(e.tipo || '').toLowerCase()] || String(e.tipo || '');
    return {
      id: e.id || U.uid('esc'),
      data: /^\d{4}-\d{2}-\d{2}$/.test(e.data) ? e.data : U.todayKey(),
      hora: /^\d{2}:\d{2}$/.test(e.hora || '') ? e.hora : '',
      titulo: String(e.titulo || 'Missa').slice(0, 120),
      local: String(e.local || '').slice(0, 160),
      tipo: TIPOS.indexOf(tipoLido) >= 0 ? tipoLido : 'missa',
      obs: String(e.obs || ''),
      // A foto do evento: o aviso do ensaio, a partitura do grupo, a foto do
      // local. Cada musica tem a sua; o evento tinha nenhuma, e e a que as
      // pessoas costumam mandar no grupo antes de todo mundo confirmar.
      // Uma string (data-URL) e um limite do armazenamento — e o mesmo limite
      // que ja valia para a foto de cada musica, entao nao traz novidade.
      foto: String(e.foto || '').slice(0, 3000000),
      status: ['rascunho', 'confirmada', 'tocada'].indexOf(e.status) >= 0 ? e.status : 'rascunho',
      musicas: (Array.isArray(e.musicas) ? e.musicas : []).map(normMusica),
      criadoEm: e.criadoEm || Date.now(),
      atualizadoEm: e.atualizadaEm || Date.now(),
    };
  }

  function normMusica(m) {
    m = m || {};
    const vid = normYouTube(m.yt, m.ytId);
    return {
      id: m.id || U.uid('mus'),
      nome: String(m.nome || '').slice(0, 160),
      artista: String(m.artista || '').slice(0, 160),
      tom: String(m.tom || '').slice(0, 12),
      bpm: m.bpm ? U.clamp(parseInt(m.bpm, 10) || 0, 20, 320) : '',
      compasso: m.compasso || '',
      categoria: String(m.categoria || '').slice(0, 40),
      responsavel: String(m.responsavel || '').slice(0, 80),
      // O texto, quando a musica da escala nao usa uma cifra do repertorio.
      // Quem cadastra direto na escala tem letra e cifra proprias, e sem estes
      // dois campos o texto se perdia na leitura.
      cifra: String(m.cifra || ''),
      letra: String(m.letra || ''),
      cifraId: m.cifraId || null,
      yt: vid.yt,
      ytId: vid.ytId,
      cf: String(m.cf || '').slice(0, 600),
      foto: normFoto(m.foto),
      obs: String(m.obs || '').slice(0, 600),
      // A faixa narrada: a voz que a pessoa gravou guiando o ensaio.
      // Fica no aparelho; nada sai sem que ela mande.
      vs: normAudioGravado(m.vs),
      // O texto da passagem. A pessoa escreve o que falou, para ler sem dar
      // play — e para quem recebe o ensaio saber o que esperar.
      vsTexto: String(m.vsTexto || '').slice(0, 2000),
      vsSeg: m.vsSeg ? U.clamp(Number(m.vsSeg) || 0, 0, 3600) : 0,
      // As capitulos: onde comeca cada parte da faixa narrada.
      vsCap: normVsCapitulos(m.vsCap),
      // As anotacoes com hora, por musica do evento.
      anotacoes: normAnotacoes(m.anotacoes),
    };
  }

  /**
 * O estado de estudo da cifra: quais trechos estao escondidos, se o modo
 * so-acordes esta ligado e a velocidade da rolagem.
 *
 * Isto nao e algo descartavel. Esconder tres versos para decorar, fechar o
 * app e voltar e ver tudo de novo nao e um recurso — e o opposite disso. E
 * guardando por cifra, e nao globalmente: o que voce esta decorando em uma
 * musica nao tem nada a ver com a outra.
 *
 * A normalizacao tolera as tres formas que chegaram aqui:
 *   - ausente (toda cifra criada antes deste campo)
 *   - array (a primeira versao gravava so os indices, como lista)
 *   - objeto (o formato de hoje)
 * Qualquer coisa fora disso volta ao padrao, em vez de derrubar a leitura da
 * cifra inteira — um campo novo nunca pode custar o acesso ao resto.
 */
function normEstudo(e) {
  const base = { ocultos: [], soAcordes: false, velocidade: 1 };
  if (e == null) return base;
  // Formato antigo: so a lista de indices.
  if (Array.isArray(e)) {
    base.ocultos = e.filter(function (n) { return Number.isInteger(n) && n >= 0 && n < 200; });
    return base;
  }
  if (typeof e !== 'object') return base;
  if (Array.isArray(e.ocultos)) {
    base.ocultos = e.ocultos.filter(function (n) { return Number.isInteger(n) && n >= 0 && n < 200; });
  }
  base.soAcordes = e.soAcordes === true;
  const v = Number(e.velocidade);
  // A velocidade e um fator de tempo: abaixo de 0,25 a rolagem vira um pisca
  // e acima de 4 ela salta varias linhas. O intervalo do controle e 0,5 a 3.
  if (isFinite(v) && v >= 0.5 && v <= 3) base.velocidade = v;
  return base;
}

/**
 * Uma anotacao com hora: "aos 1:32, a bateria entra".
 *
 * E o que permite transformar a ficha da musica em algo que se usa no ensaio.
 * Uma observacao solta ("virada no refrão") exige que a pessoa decore a ordem;
 * com o tempo marcado, ela clica e o video pula para la.
 *
 * O tempo e em segundos, porque e assim que o audio e o video trabalham. Guardar
 * "1:32" como texto obrigaria a converter de volta toda vez que o app precisasse
 * comparar com a posicao atual.
 */
function normAnotacao(a) {
    a = a || {};
    const texto = String(a.texto || '').trim().slice(0, 200);
    if (!texto) return null;                       // anotacao sem texto nao existe
    return {
      id: a.id || U.uid('anot'),
      t: U.clamp(Number(a.t) || 0, 0, 3600),
      texto: texto,
    };
  }

  /**
   * As anotacoes da musica.
   *
   * Tolera tres formas: ausente (cifra antiga), array de textos soltos (a
   * primeira versao, sem tempo) e o formato de hoje. Mesma regra do `estudo`:
   * um campo novo nunca pode custar o acesso ao resto.
   */
  function normAnotacoes(lista) {
    if (!Array.isArray(lista)) return [];
    const saida = [];
    for (const a of lista.slice(0, 60)) {
      // A forma antiga era uma lista de strings. Vira anotacao no tempo zero,
      // que e onde uma observacao sem tempo estava mesmo.
      const n = normAnotacao(typeof a === 'string' ? { texto: a } : a);
      if (n) saida.push(n);
    }
    return saida.sort(function (x, y) { return x.t - y.t; });
  }

  /**
   * As capitulos da faixa narrada: onde comeca cada parte.
   *
   * O VS sem marcação de tempo funciona, e a voz e a marcação: quem fala "refrão
   * em 1,2,3,4" diz o tempo com o corpo. Quem ensaia SOZINHO nao tem com quem
   * combinar, e chegar na parte dois de uma faixa de três minutos sem saber onde
   * ela começa e o problema que o indice resolve.
   *
   * São dois cliques durante a gravação: a pessoa marca "refrão", segue falando,
   * marca "verso 2". Nada de digitação com o microfone aberto, nada de relógio a
   * mais para manter em dia — a voz ja marca o ritmo, e o indice apenas nomeia
   * o que a voz disse.
   *
   * O tempo e em segundos, como o das anotacoes e como o audio trabalha.
   */
  function normVsCapitulo(c) {
    if (!c || typeof c !== 'object') return null;
    const texto = String(c.texto || '').trim().slice(0, 60);
    if (!texto) return null;                        // capitulo sem nome nao tem utilidade
    return {
      id: c.id || U.uid('vscap'),
      t: U.clamp(Number(c.t) || 0, 0, 3600),
      texto: texto,
    };
  }

  function normVsCapitulos(lista) {
    if (!Array.isArray(lista)) return [];
    const saida = [];
    for (const c of lista.slice(0, 40)) {
      const n = normVsCapitulo(c);
      if (n) saida.push(n);
    }
    return saida.sort(function (x, y) { return x.t - y.t; });
  }

  /** O audio gravado da musica: a voz que guia o ensaio. */
  function normAudioGravado(v) {
    if (!v || typeof v !== 'string') return '';
    // So data-URL de audio. Um "javascript:" aqui viraria script ao ser usado
    // como `src`, e o campo vem de um arquivo de backup — que e entrada nao
    // confiavel. A verificacao e no prefixo, nao no nome do mime.
    if (v.indexOf('data:audio/') !== 0) return '';
    /* O prefixo sozinho nao basta. "data:audio/" sem subtipo e
     * "data:audio/webm;base64," sem carga nenhuma passavam, e o que a tela
     * mostrava nesse caso e um player quebrado — sem audio e sem explicacao.
     *
     * Nao e burro de seguranca: os dois continuam começando com "data:audio/",
     * entao nenhum dos dois vira script. E burro de conteudo: um audio gravado
     * de verdade sempre chega com subtipo e com carga, porque vem de
     * `blobParaDataUrl`, que monta "data:audio/webm;base64,....".
     */
    const corte = v.indexOf(',');
    if (corte < 0) return '';
    const cabecalho = v.slice(0, corte);
    const temSubtipo = /^data:audio\/[a-z0-9.+-]+/i.test(cabecalho);
    const temCarga = v.length > corte + 1;
    if (!temSubtipo || !temCarga) return '';
    return v.slice(0, 4194304);
  }

  /**
   * O link do YouTube, com o id ja extraido.
   *
   * `Links` e consultado na hora, e nao guardado no topo do arquivo: o store e
   * carregado antes do modulo de links, e uma referencia capturada no topo
   * seria `undefined` para sempre. Se o modulo nao estiver disponivel, o id
   * guardado ainda e respeitado, e o link fica para a proxima leitura — quem
   * gravou o link ja gravou o id junto.
   */
  function normYouTube(yt, ytId) {
    const bruto = String(yt || '').slice(0, 600);
    // O id gravado so vale se tiver mesmo onze caracteres do alfabeto do
    // YouTube. Sem esta conferencia, qualquer texto de onze caracteres em um
    // backup virava "video": o app montava `youtube-nocookie.com/embed/<lixo>`
    // e a tela da mesa abria um video inexistente, sem aviso. Pior do que
    // nao ter video: e ter video apontando para a coisa errada, e a pessoa nao
    // tem como saber qual das duas e a certa.
    const guardado = String(ytId || '').trim();
    let id = /^[A-Za-z0-9_-]{11}$/.test(guardado) ? guardado : '';
    if (!id) {
      id = (global.Links && typeof global.Links.extrairYouTubeId === 'function')
        ? global.Links.extrairYouTubeId(bruto)
        : '';
    }
    return { yt: bruto, ytId: id };
  }

  /**
   * A imagem da cifra, como data-URL.
   *
   * So `png`, `jpeg`, `webp` e `gif`. O que entra aqui vem de um arquivo de
   * backup, e SVG e um documento XML: `<svg onload="...">` executa script no
   * momento em que a imagem e mostrada. Como a foto aparece em varias telas ao
   * mesmo tempo, `src="data:image/svg+xml,...` seria execucao de codigo
   * disparada por abrir o app — vindo de um arquivo que a pessoa mesma
   * restaurou.
   *
   * `data:image/svg+xml` e recusado mesmo sendo a unica forma de SVG, e
   * nenhum formato aqui perde qualidade que importe para uma foto de partitura.
   */
  const FOTOS_OK = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i;
  function normFoto(v) {
    const s = typeof v === 'string' ? v : '';
    if (!FOTOS_OK.test(s)) return '';
    return s.length > 3000000 ? '' : s;
  }

  /* ---- O DOCUMENTO DA MÚSICA ----------------------------------------
     *
     * Um PDF ou um texto, guardado como data URL ao lado da foto. UM por
     * música, como UM por foto: a mesma música pode estar em tres
     * repertórios, e um array aqui seria o mesmo arquivo guardado tres
     * vezes — que é o oposto do que este app faz.
     *
     * POR QUE SÓ PDF E TEXTO
     *
     * Os dois abrem no navegador sem que nada seja inventado: o PDF no
     * visualizador nativo, o texto no campo de texto. DOCX, ODF e RTF não
     * abrem em lugar nenhum sem uma biblioteca de terceiros, e guardá-los
     * seria pagar armazenamento por um arquivo que a pessoa não consegue ver.
     *
     * POR QUE ESTA LISTA FECHADA É SEGURANÇA, E NÃO MODÉLIA
     *
     * Este app guarda o arquivo e depois o entrega de volta ao navegador. Um
     * `data:text/html` devolvido num iframe EXECUTA script na origem do app, e
     * um `data:image/svg+xml` idem — é o mesmo motivo que barra SVG na foto,
     * dois locais acima. Uma lista de tipos que não executam é o filtro.
     *
     * O TAMANHO
     *
     * A foto tem 3 MB porque a foto é pequena. Um PDF chega com a partitura
     * inteira. O armazenamento local do navegador costuma dar ~5 MB para TUDO,
     * e a base64 come um terço a mais: 1,2 MB de texto são ~900 KB de arquivo.
     * Passando disso, o resto do app (todas as músicas, com suas fotos) não
     * caberia. O limite vem do armazenamento real, não de um número gostoso.
     */
  const DOCS_OK = /^data:(application\/pdf|text\/plain);base64,/i;
  const DOC_MAX = 1200000;
  function normDoc(v) {
    if (!v || typeof v !== 'object') return null;
    const dados = typeof v.dados === 'string' ? v.dados : '';
    if (!DOCS_OK.test(dados)) return null;
    if (dados.length > DOC_MAX) return null;
    const nome = String(v.nome || 'documento').replace(/[\\/:*?"<>| -]/g, '_').slice(0, 120);
    return {
      nome: nome,
      /* O tipo vem do proprio prefixo aceito, nunca do que o arquivo disse.
       * Um arquivo que se diz `text/plain` e chega como `application/pdf`
       * continua sendo tratado pelo que o app aceitou. */
      tipo: DOCS_OK.exec(dados)[1].toLowerCase(),
      dados: dados,
    };
  }

  function normCifra(c) {
    c = c || {};
    const vid = normYouTube(c.yt, c.ytId);
    return {
      id: c.id || U.uid('cif'),
      titulo: String(c.titulo || 'Sem título').slice(0, 160),
      artista: String(c.artista || '').slice(0, 160),
      tom: String(c.tom || '').slice(0, 12),
      bpm: c.bpm ? U.clamp(parseInt(c.bpm, 10) || 0, 20, 320) : '',
      compasso: c.compasso || '4/4',
      categoria: String(c.categoria || '').slice(0, 40),
      tags: Array.isArray(c.tags) ? c.tags.slice(0, 20).map(function (t) { return String(t).slice(0, 30); }) : [],
      letra: String(c.letra || ''),
      cifra: String(c.cifra || ''),
      estudo: normEstudo(c.estudo),

      /* ---- a ficha do ensaio ----
         Antes estes campos existiam so em `normMusica`, dentro de uma escala.
         Isso significava que uma musica do REPERTORIO nao tinha onde guardar
         o video, a foto nem a faixa narrada: quem cadastrava a musica no
         repertorio e depois colocava numa escala perdia os tres, ou tinha que
         cadastrar de novo. Agora a ficha vive na cifra, e a musica da escala
         aponta para ela. */

      // O video do YouTube que a equipe assiste.
      yt: vid.yt,
      ytId: vid.ytId,

      // A foto da cifra, para desenhar por cima.
      foto: normFoto(c.foto),
      // O documento da musica, quando houver UM. `null` e a forma de dizer que
      // nao ha — e e a mesma que `cifraId` ja usa, para nao inventar um
      // objeto vazio que ocupa espaco em todo backup.
      doc: normDoc(c.doc),

      // A faixa narrada: "virada da bateria em 1,2,3,4", dita pela propria
      // pessoa. E o que toca junto com o video.
      vs: normAudioGravado(c.vs),
      vsTexto: String(c.vsTexto || '').slice(0, 2000),
      vsSeg: c.vsSeg ? U.clamp(Number(c.vsSeg) || 0, 0, 3600) : 0,
      // Onde comeca cada parte da faixa: "refrão", "verso 2", "virada".
      vsCap: normVsCapitulos(c.vsCap),

      // As anotacoes com hora.
      anotacoes: normAnotacoes(c.anotacoes),

      criadoEm: c.criadoEm || Date.now(),
      atualizadoEm: Date.now(),
    };
  }

  function salvar() {
    db.meta.atualizadoEm = Date.now();
    try {
      const json = JSON.stringify(db);
      if (U.byteLen(json) > MAX_BYTES) {
        /* Passou do NOSSO teto, e o nosso e' conservador. Tentamos assim mesmo:
         * o navegador pode ter mais espaco, e recusar sem tentar seria jogar
         * fora uma gravacao que caberia.
         *
         * O que estava errado era o que se contava depois. O `setItem` era
         * envolvido num `catch` que ignorava, e o `salvar` devolvia `false` com
         * `cheio` — de qualquer jeito. Num desktop cuja cota passa de 4,5 MB, a
         * escrita passava, o audio FICAVA no disco, e a tela dizia "nao salvou,
         * espaco cheio". A pessoa repetia a acao, abria backup, e a folha de
         * gravacao continuava pedindo para tentar de novo um audio que ja
         * estava guardado. O aviso mentira ao contrario do defeito antigo.
         *
         * O que aconteceu agora e' a unica informacao que importa. */
        try {
          localStorage.setItem(STORAGE_KEY, json);
          ultimoErro = null;        /* coube no navegador: salvou mesmo */
          return true;
        } catch (e) {
          ultimoErro = (e && e.name === 'QuotaExceededError') ? 'cheio' : 'erro';
          emitir('cota', {});
          emitir('erro', { err: e });
          return false;
        }
      }
      localStorage.setItem(STORAGE_KEY, json);
      ultimoErro = null;
      return true;
    } catch (e) {
      ultimoErro = (e && e.name === 'QuotaExceededError') ? 'cheio' : 'erro';
      emitir('erro', { err: e });
      return false;
    }
  }
  function salvarLogo() { clearTimeout(timer); timer = setTimeout(salvar, 300); }
  function gravar() { clearTimeout(timer); return salvar(); }

  function assinar(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }
  function emitir(tipo, payload) {
    listeners.slice().forEach(function (fn) {
      try { fn(tipo, payload, db); } catch (e) { console.error('[Store]', e); }
    });
  }
  function mudou(what) { salvarLogo(); emitir('mudou', { what: what || 'db' }); }

  function escalas() { return db.escalas; }
  function porData(data) {
    return db.escalas.filter(function (e) { return e.data === data; })
      .sort(function (a, b) { return (a.hora || '99:99').localeCompare(b.hora || '99:99'); });
  }
  function porId(id) { return db.escalas.find(function (e) { return e.id === id; }) || null; }
  function cmp(a, b) {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    return (a.hora || '').localeCompare(b.hora || '');
  }
  function proximas(limite) {
    const hoje = U.todayKey();
    return db.escalas.filter(function (e) { return e.data >= hoje; }).sort(cmp).slice(0, limite || 5);
  }
  function ultimas(limite) { return db.escalas.slice().sort(cmp).reverse().slice(0, limite || 20); }

  function cifras() { return db.cifras; }
  function cifraPorId(id) { return db.cifras.find(function (c) { return c.id === id; }) || null; }
  function filtrarCifras(opts) {
    opts = opts || {};
    const q = U.norm(opts.q || '');
    const tom = opts.tom || '';
    const cat = opts.categoria || '';
    const lista = db.cifras.filter(function (c) {
      if (tom && c.tom !== tom) return false;
      if (cat && c.categoria !== cat) return false;
      return true;
    });
    if (q) {
      // Busca tolerante a erro. Sem ela, digitar "prezoisa" no celular nao
      // acha "Preziosa" — e a troca de duas letras vizinhas e o erro mais
      // comum de dedo em tela deitada. A ordem passa a ser por relevancia,
      // que e o que a pessoa digitou; sem busca, continua por ultima edicao.
      if (global.Search) return global.Search.buscarItens(lista, q, 0);
    }
    return lista.slice().sort(function (a, b) { return (b.atualizadaEm || 0) - (a.atualizadaEm || 0); });
  }
  function categorias() {
    const s = new Set();
    db.cifras.forEach(function (c) { if (c.categoria) s.add(c.categoria); });
    db.escalas.forEach(function (e) { e.musicas.forEach(function (m) { if (m.categoria) s.add(m.categoria); }); });
    return Array.from(s).sort();
  }
  function tons() {
    const s = new Set();
    db.cifras.forEach(function (c) { if (c.tom) s.add(c.tom); });
    db.escalas.forEach(function (e) { e.musicas.forEach(function (m) { if (m.tom) s.add(m.tom); }); });
    return Array.from(s);
  }
  function metricas() {
    const hoje = U.todayKey();
    const futuras = db.escalas.filter(function (e) { return e.data >= hoje; });
    return {
      escalas: db.escalas.length,
      cifras: db.cifras.length,
      musicas: db.escalas.reduce(function (s, e) { return s + e.musicas.length; }, 0),
      proximas: futuras.length,
      confirmadas: db.escalas.filter(function (e) { return e.status === 'confirmada'; }).length,
      // `rehearsal` foi renomeado para `show` e nunca mais e gravado. A
      // condicao sobrava da versao antiga e inflava a conta: todo evento de
      // show contava tambem como ensaio.
      ensaios: db.escalas.filter(function (e) { return e.tipo === 'ensaio'; }).length,
      shows: db.escalas.filter(function (e) { return e.tipo === 'show'; }).length,
      // Quantas cifras estao prontas para o ensaio: com video, com audio da
      // voz ou com anotacao com hora. E a medida de quanto do repertorio
      // realmente pode ser usado no palco.
      prontasParaPalco: db.cifras.filter(function (c) {
        return !!(c.ytId || c.vs || (c.anotacoes && c.anotacoes.length));
      }).length,
      porTom: db.escalas.reduce(function (m, e) {
        e.musicas.forEach(function (x) { if (x.tom) m[x.tom] = (m[x.tom] || 0) + 1; });
        return m;
      }, {}),
    };
  }

  /**
   * A ficha completa de uma musica, junta numa coisa so.
   *
   * Existe porque a mesma informacao estava partida em dois lugares: o video,
   * a foto e a faixa narrada vivem na cifra do repertorio, enquanto o
   * responsavel e a observacao vivem na musica da escala. Quem abria a tela
   * tinha de escolher uma das duas, e a metade que escolheu nao aparecia.
   *
   * Aqui entra uma fonte e sai o objeto inteiro. A precedencia e: o que a
   * pessoa escreveu na escala vence sobre o que veio do repertorio, porque
   * quem escreveu o evento sabe o que aquele dia precisa. E o que a escala
   * deixou em branco cai no que a cifra ja tinha.
   */
  function fichaDe(musica, escala) {
    const m = musica || {};
    // A musica da escala pode nao ter ligado uma cifra do repertorio. Quando
    // nao ligou, ela mesma e a fonte do texto — quem cadastrou a musica direto
    // na escala, sem passar pelo repertorio, tem letra e cifra proprias.
    const c = m.cifraId ? cifraPorId(m.cifraId) : null;
    const texto = function () {
      if (c) return String(c.cifra || '');
      return String(m.cifra || '');
    };
    const letra = function () {
      if (c) return String(c.letra || '');
      return String(m.letra || '');
    };
    const primeiro = function (a, b) {
      const x = a === undefined || a === null ? '' : String(a).trim();
      return x || String(b || '');
    };
    // As anotacoes: as da escala tem prioridade. As da cifra entram atras das
    // que a pessoa escreveu, porque um item sem texto e um item com tempo zero
    // nao devem tomar o lugar de uma anotacao marcada.
    const anot = normAnotacoes((m.anotacoes || []).concat(c && c.anotacoes ? c.anotacoes : []));

    return {
      // de onde veio
      musicaId: m.id || null,
      escalaId: escala ? escala.id : null,
      escalaTitulo: escala ? escala.titulo : '',
      escalaData: escala ? escala.data : '',
      escalaHora: escala ? escala.hora : '',
      temCifra: !!c,

      // identidade
      titulo: primeiro(m.nome, c && c.titulo) || 'Sem título',
      artista: primeiro(m.artista, c && c.artista),

      // o que se toca
      tom: primeiro(m.tom, c && c.tom),
      bpm: Number(m.bpm) || Number(c && c.bpm) || 0,
      compasso: primeiro(m.compasso, c && c.compasso) || '4/4',
      categoria: primeiro(m.categoria, c && c.categoria),
      responsavel: primeiro(m.responsavel, ''),
      obs: String(m.obs || ''),

      // o texto
      letra: letra(),
      cifra: texto(),

      // os tres que tocam juntos
      ytId: primeiro(m.ytId, c && c.ytId),
      yt: primeiro(m.yt, c && c.yt),
      foto: primeiro(m.foto, c && c.foto),
      vs: normAudioGravado(primeiroAudio(m.vs, c && c.vs)),
      vsTexto: primeiro(m.vsTexto, c && c.vsTexto),
      vsSeg: Number(m.vsSeg) || Number(c && c.vsSeg) || 0,
      /* Os capitulos vem da musica da escala quando ela tem, e da cifra quando
       * nao tem — a mesma regra do audio. Uma musica cadastrada no repertorio e
       * depois colocada numa escala nao pode perder o indice que a pessoa
       * gravou; era o mesmo defeito que a ficha da cifra teve. */
      vsCap: normVsCapitulos(
        (Array.isArray(m.vsCap) && m.vsCap.length ? m.vsCap : (c && c.vsCap)) || []),

      // o que a pessoa anotou
      anotacoes: anot,
    };
  }

  /**
   * Primeiro audio valido entre dois.
   *
   * Diferente do `primeiro` acima, que so ignora string vazia: aqui o que
   * importa e a data-URL do audio, e uma string vazia nao substitui a outra.
   * Se a escala nao tem gravacao, vale a do repertorio — que e o caso comum de
   * quem cadastrou a musica uma vez e so a usa em varios eventos.
   */
  function primeiroAudio(a, b) {
    if (typeof a === 'string' && a.indexOf('data:audio/') === 0) return a;
    return b || '';
  }

  /**
 * A ficha de uma musica do repertorio, sem escala.
 *
 * A cifra e passada inteira, e nao so o titulo e o artista. Montando um objeto
 * com so esses dois campos, a ficha saia sem video, sem narração e sem
 * anotacoes — porque `fichaDe` so enxerga o que recebe. E o sintoma era
 * silencioso e enganoso: o cartao do repertorio aparecia sem nenhum icone,
 * como se a musica nunca tivesse sido gravada.
   */
  function fichaDaCifra(cifra) {
    if (!cifra) return fichaDe({}, null);
    const f = fichaDe(Object.assign({}, cifra, {
      id: null,
      nome: cifra.titulo,
      responsavel: cifra.responsavel || '',
      obs: cifra.obs || '',
    }), null);
    // Sem escala nao ha musica de evento, entao o id do objeto original e o
    // que permite saber de onde a ficha veio.
    f.cifraId = cifra.id;
    return f;
  }

  /**
   * Todas as musicas de um evento, ja com a ficha pronta.
   *
   * A ordem e a da escala: quem monta o ensaio nao quer que o app reordene.
   */
  function fichasDeEscala(escala) {
    if (!escala || !Array.isArray(escala.musicas)) return [];
    return escala.musicas.map(function (m) { return fichaDe(m, escala); });
  }

  function ajuste(k, padrao) {
    const v = db.ajustes[k];
    return v === undefined ? padrao : v;
  }
  function setAjuste(k, v) { db.ajustes[k] = v; mudou('ajustes'); }

  function exportar() {
    return JSON.stringify({
      app: global.Identidade ? global.Identidade.NOME : 'Clave',
      exportadoEm: new Date().toISOString(),
      escalas: db.escalas, cifras: db.cifras, ajustes: db.ajustes,
    }, null, 2);
  }
  /** Garante que nenhum `id` apareca duas vezes numa lista.
   *
   * O `id` e a chave com que o registro e encontrado. `cifraPorId` devolve a
   * PRIMEIRA ocorrencia, entao a segunda fica sem porta: ela aparece na lista,
   * pode ser editada, e a edicao e gravada por cima da primeira. Isso e perda de
   * dado silenciosa — o sintoma e "minha cifra sumiu" sem nenhum aviso.
   *
   * A CORRECAO MANTEM O ID DA PRIMEIRA E SO RENUMERA AS SEGUINTES
   *
   * Nao e uma escolha estetica: e a unica que nao quebra referencia. A ficha de
   * ensaio aponta para a cifra por `musica.cifraId`, e essa referencia ja
   * resolvia para a primeira ocorrencia. Se a primeira perdesse o id, toda
   * ficha passaria a apontar para o nada — e trocar a segunda seria trocar a
   * ficha de outra musica.
   *
   * Os ids unicos nao sao tocados. So muda o registro que ja estava
   * inacessivel, e o que muda e ele GANHAR uma chave, o que nunca quebra nada.
   *
   * POR QUE SO NO CAMINHO "SUBSTITUIR"
   *
   * O modo mesclar ja faz isso, e faz certo: ele semeia um `Set` com os ids que
   * ja existem e vai acrescentando conforme aceita, entao duas linhas com o
   * mesmo id na entrada caem fora. O `substituir` recebia a lista como veio —
   * e e por ai que um backup com id repetido chegava ao app inteiro.
   *
   * `normCifra` e `normEscala` ja geram um id quando o de entrada vem vazio, e
   * por isso o `!r.id` aqui e apenas uma rede: sem ele, um registro sem id
   * entraria como `undefined` e a checagem seguinte o trataria como duplicado
   * de todos os outros sem id.
   */
  function unicosPorId(lista, prefixo) {
    const vistos = new Set();
    return lista.map(function (r) {
      if (r.id && !vistos.has(r.id)) {
        vistos.add(r.id);
        return r;
      }
      const copia = Object.assign({}, r);
      copia.id = U.uid(prefixo);
      return copia;
    });
  }

  function importar(json, modo) {
    let d;
    try { d = typeof json === 'string' ? JSON.parse(json) : json; }
    catch (e) { throw new Error('Arquivo inválido: não e um backup JSON válido.'); }
    if (!d || typeof d !== 'object') throw new Error('Arquivo inválido.');

    /* O arquivo tem de CONTER dados antes de qualquer substituicao.
     *
     * A guarda de cima aceitava `[]`, `{}` e `{"cifras": {}}`: sao objetos, e
     * `migrar` devolvia uma base vazia — porque ela le `Array.isArray(...) ? ...
     * : []`. No modo mesclar isso e inofensivo: nada entra, nada sai. No modo
     * `substituir` e o oposto: `db.cifras` virava lista vazia, e o repertorio
     * inteiro da pessoa sumia ao restaurar um arquivo estragado — sem erro, sem
     * aviso, e com um "Restaurado: 0 eventos e 0 cifras" na tela.
     *
     * Sao recusados aqui: array vazio, objeto vazio, e qualquer coisa em que
     * `escalas` e `cifras` nao sejam listas.
     *
     * Continuam aceitos, porque sao backups de verdade:
     *
     *   - `{"escalas": [], "cifras": []}` — quem apagou tudo e exportou. E uma
     *     intencao legitima, e substituir por ela e o que a pessoa pediu;
     *   - `{"cifras": [...]}`  — so um dos dois;
     *   - `{"2026-03-08": [ ... ]}` — o backup v1, que nao tem nenhuma das duas
     *     chaves e tem data como chave. Por isso a segunda condicao: um objeto
     *     cujas TODAS as chaves apontam para listas e um backup antigo.
     */
    const temLista = Array.isArray(d.escalas) || Array.isArray(d.cifras);
    const chavesLegadas = temLista ? [] : Object.keys(d);
    const temLegado = chavesLegadas.length > 0
      && chavesLegadas.every(function (k) { return Array.isArray(d[k]); });
    if (!temLista && !temLegado) {
      throw new Error('Arquivo inválido: não tem nem escalas nem cifras para restaurar.');
    }

    const inc = migrar(d);
    if (modo === 'substituir') {
      db = vazio();
      db.escalas = unicosPorId(inc.escalas, 'esc'); db.cifras = unicosPorId(inc.cifras, 'cif');
      db.ajustes = copiarCampos(db.ajustes, inc.ajustes, CAMPOS_AJUSTES);
    } else {
      const eids = new Set(db.escalas.map(function (e) { return e.id; }));
      inc.escalas.forEach(function (e) {
        if (eids.has(e.id)) return;
        if (db.escalas.some(function (x) { return x.data === e.data && x.titulo === e.titulo && x.hora === e.hora; })) return;
        eids.add(e.id); db.escalas.push(e);
      });
      const cids = new Set(db.cifras.map(function (c) { return c.id; }));
      inc.cifras.forEach(function (c) {
        /* SO O ID DECIDE QUEM E QUEM.
         *
         * Antes havia uma segunda porta aqui: mesmo titulo e mesmo artista. A
         * das cifras custava musica de verdade. Tocar "O Amor Nao Falha" em Am e
         * em Dm sao duas entradas independentes — a biblioteca guarda as duas, e
         * a propria V6.7 tratou a duplicata como legitima. No mesclar, porem, a
         * segunda era deixada de fora por coincidir no nome: a pessoa restaurava
         * o backup do outro aparelho e perdia uma das tonalidades, sem erro e
         * sem aviso.
         *
         * E o que a segunda porta comprava nao era nada: reimportar o mesmo
         * backup NAO duplica por causa dela, e sim porque o registro volta com o
         * MESMO id — que e a unica coisa que precisa casar. A porta de titulo so
         * produzia perda.
         *
         * A da escala foi deixada como esta: evento repetido na mesma data, hora
         * e titulo e, na pratica, o mesmo ensaio — e mexer nisso mudaria o
         * comportamento de algo que nao foi reportado aqui. */
        if (cids.has(c.id)) return;
        cids.add(c.id); db.cifras.push(c);
      });
    }
    gravar();
    emitir('importou', { escalas: inc.escalas.length, cifras: inc.cifras.length });
    return { escalas: inc.escalas.length, cifras: inc.cifras.length, ok: true };
  }
  function apagar() {
    db = vazio();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignora */ }
    emitir('mudou', { what: 'reset' });
  }
  function storageInfo() {
    let used = 0;
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) used = U.byteLen(s); } catch (e) { /* ignora */ }
    return { used, limit: MAX_BYTES, pct: Math.min(100, Math.round((used / MAX_BYTES) * 100)) };
  }

  /**
   * Quanto espaço ainda resta, em uma frase que a pessoa entende.
   *
   * EXISTEM TRÊS NÚMEROS, E A TELA MISTURAVA DOIS
   *
   *   1. a cota que o NAVEGADOR diz (uns 5 MB no iPhone, dezenas de GB no desktop)
   *   2. o limite que o CLAVE impõe (MAX_BYTES, 4,5 MB)
   *   3. o que sobra para uma gravação nova
   *
   * O cartão de Ajustes chamava a barra de "Armazenamento no aparelho" e
   * mostrava, logo abaixo, "de 9,8 GB disponíveis neste aparelho". Os dois
   * números eram verdadeiros e se contradiam: a barra media o limite do Clave,
   * e o texto media a cota do aparelho. Quem lê entende que tem gigabytes
   * livres e descobre o contrário na hora de gravar.
   *
   * Por isso aqui os três vêm separados, e o que interessa — o que SOBRA —
   * vem em bytes de verdade. Porcentagem não serve para decidir se a pessoa
   * grava dois minutos ou vinte.
   *
   * OS TRÊS ESTADOS
   *
   *   normal    sobra mais que um terço: ninguém precisa ser avisado
   *   atencao   sobra pouco: a gravação longa pode não caber
   *   cheio     o que resta é menor que o menor VS útil (30 s de áudio)
   *
   * O corte não é arbitrário: 30 segundos é a gravação mais curta que serve
   * para alguma coisa — marcar uma contagem de bateria. Abaixo disso o espaço
   * já não comporta uso real.
   */
  const VS_MINIMO_UTIL = Math.ceil(30 * 1024 * 4 / 3);   // 30 s de áudio, já em base64
  function espacoParaGravacao() {
    const info = storageInfo();
    const livre = Math.max(0, info.limit - info.used);
    const estado = livre <= VS_MINIMO_UTIL ? 'cheio'
      : livre < info.limit / 3 ? 'atencao'
        : 'normal';
    return {
      usado: info.used,
      limite: info.limit,
      livre: livre,
      pct: info.pct,
      estado: estado,
      /* Quantos segundos de áudio cabem no que sobrou. É a mesma matemática do
       * base64 que o `salvar` vai encontrar quando a pessoa apertar parar:
       * quatro caracteres guardados por três de áudio. Não é promessa de
       * qualidade — é a conta que vai acontecer. */
      segundosQueCabem: Math.max(0, Math.floor((livre * 3 / 4) / 1024)),
    };
  }

  const Store = {
    STORAGE_KEY, SCHEMA,
    carregar, salvar, salvarLogo, gravar, assinar, emitir, mudou,
    /* Por que a ultima gravacao falhou: `'cheio'`, `'erro'`, ou `null` quando
     * deu certo. A tela precisa da diferenca porque a resposta muda: "cheio"
     * pede para apagar uma gravacao antiga ou baixar um backup; "erro" nao se
     * resolve com espaco. Sem isto, o `Store` dizia que a gravacao falhou e a
     * tela so pava. */
    ultimoErro: function () { return ultimoErro; },
    get db() { return db; }, vazio,
    escalas, porData, porId, proximas, ultimas, cmp,
    cifras, cifraPorId, filtrarCifras, categorias, tons,
    metricas, ajuste, setAjuste,
    fichaDe, fichaDaCifra, fichasDeEscala,
    exportar, importar, apagar, storageInfo, espacoParaGravacao,
    normEscala, normMusica, normCifra, normEstudo, normAnotacao, normAnotacoes,
    normVsCapitulo, normVsCapitulos,
  };

  global.Store = Store;
  // Sem isto, nenhum teste consegue alcancar o store: o resto dos módulos do
  // core exporta assim, e sem o store a normalização do modelo — que e onde
  // mora a migracao — fica sem nenhuma verificacao automatica.
  if (typeof module !== 'undefined' && module.exports) module.exports = Store;
})(typeof window !== 'undefined' ? window : globalThis);