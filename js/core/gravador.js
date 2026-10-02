/* =========================================================
   ACORDE - core/gravador.js
   Gravar a voz que guia o ensaio.

   O que e: a pessoa fala o que acontece em cada parte da musica — "refrão em
   1, 2, 3, 4", "virada da bateria, e para tudo" — e ouve isso enquanto toca. E o
   que permite ensaiar sem o resto da banda.

   Por que a sincronia nao precisa de codigo: quem grava fala no tempo certo.
   O guia e a propria voz, entao quem toca segue a voz. Nao ha marca de tempo
   para casar nem(video, cifra). Um contador de tempo seria um relogio a mais
   para manter em dia, e o que falta no ensaio nunca e pontualidade — e a
   ordem das coisas.

   A gravacao fica no aparelho. Nao ha servidor, nao ha upload, e nada sai sem
   que a pessoa mande.

   Antes de gravar, a pessoa ve o que vai acontecer e porque o navegador pide
   permissao. Isso nao e burocracia: o microfone e a coisa mais intima que um
   site pode pedir, e um app que pede sem explicar ensina a pessoa a aceitar
   tudo.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;

  /* ------------------------------------------------------------
     Formatos, do melhor para o mais fraco.

     Opus dentro de WebM cabe em cerca de 1 KB por segundo de fala — uma
     passagem de dois minutos ocupa uns 120 KB. O `MediaRecorder` com Opus so
     existe em navegador moderno; onde falta, cai para WebM puro, e depois
     para qualquer coisa que o navegador aceitar.
     ------------------------------------------------------------ */
  /* A ordem desta lista e o que decide o que a pessoa leva para dentro do
   * aparelho. Nao e "do melhor para o mais fraco": e a ordem que faz o iPhone
   * funcionar sem piorar o que o Chrome ja fazia.
   *
   * O iPhone e a razao do MP4 estar aqui. O Safari nao sabe gravar WebM, nem
   * Opus, nem Ogg — so `audio/mp4` com AAC. Antes do MP4 entrar na lista, os
   * tres primeiros formatos falhavam todos no `isTypeSupported` e o gravador
   * caia no ultimo item, o de mime VAZIO. E ai a coisa ficava silenciosamente
   * errada:
   *
   *   - `MediaRecorder` sem `mimeType` escolhe MP4 por conta propria, e grava.
   *   - mas `gravador.mimeType` volta vazio, e o `|| 'audio/webm'` do `parar()`
   *     declarava WebM sobre bytes que eram MP4.
   *
   * O `data:audio/webm;base64,...` chegava ao `<audio src>`, o Safari recebia
   * MP4 declarado como WebM, e a gravacao nao tocava. Sem erro, sem aviso, sem
   * caso: a pessoa gravava a faixa, ela nao reproduzia, e a unica pista era o
   * bloco dizer que havia audio.
   *
   * MP4 fica NO MEIO, e nao na frente, por um motivo que a primeira versao
   * deste conserto errou: colocando o MP4 primeiro, o Chrome passou a gravar
   * AAC em vez de Opus, e o arquivo cresceu. O Opus cabe em cerca de 1 KB por
   * segundo de fala; o AAC nao chega perto. Consertei o iPhone e piora o Chrome
   * sem nenhum dos dois avisar.
   *
   * A ordem que serve: primeiro o que e MENOR onde existe (Opus, WebM — o
   * Chrome, o Firefox e o Edge param no primeiro), depois o MP4 para o Safari,
   * que pula os tres primeiros e para no quarto. */
  const FORMATOS = [
    { mime: 'audio/webm;codecs=opus', nome: 'opus' },
    { mime: 'audio/webm', nome: 'webm' },
    { mime: 'audio/mp4;codecs=mp4a.40.2', nome: 'mp4-aac' },
    { mime: 'audio/mp4', nome: 'mp4' },
    { mime: 'audio/ogg;codecs=opus', nome: 'ogg' },
    { mime: '', nome: 'padrão' },
  ];

  /** O primeiro formato que este navegador sabe gravar. */
  function formatoSuportado() {
    if (typeof MediaRecorder === 'undefined') return null;
    for (const f of FORMATOS) {
      if (!f.mime) return f;
      if (typeof MediaRecorder.isTypeSupported === 'function' &&
          MediaRecorder.isTypeSupported(f.mime)) return f;
    }
    return null;
  }

  /** O tipo que o gravador esta gravando DE VERDADE.
   *
   * Nunca adivinhar aqui. O gravador sabe, e `mimeType` responde: quando ele
   * devolve vazio, o aparelho escolheu por conta propria e o honesto e dizer que
   * nao sabemos — nao declarar um formato que pode ser outro.
   *
   * A versao anterior devolvia `'audio/webm'` nesse caso, e era um palpite
   * assassino: em qualquer aparelho que escolhesse por conta propria, o blob
   * saia rotulado errado. */
  function tipoDoGravador(g) {
    try {
      return (g && g.mimeType) || '';
    } catch (e) {
      return '';
    }
  }

  /** O app pode gravar? E o que a pessoa ve antes de mexer em botao. */
  function disponivel() {
    const f = formatoSuportado();
    if (!f) return { ok: false, motivo: 'Este navegador não sabe gravar áudio.' };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { ok: false, motivo: 'Este navegador não da acesso ao microfone.' };
    }
    return { ok: true, formato: f.nome };
  }

  /** O acesso ja foi concedido alguma vez? Nao abre a janela do navegador. */
  function jaAutorizado() {
    if (!navigator.permissions || !navigator.permissions.query) return null;
    return navigator.permissions.query({ name: 'microphone' })
      .then((p) => p.state)     // 'granted', 'denied' ou 'prompt'
      .catch(() => null);       // o navegador nao expoe a permissao: nao da pra saber
  }

  /**
   * Comeca a gravar.
   *
   * Devolve uma promessa com o fluxo: `parar()` encerra e entrega o audio.
   * O fluxo e um objeto, e nao uma funcao, porque quem grava precisa consultar
   * quanto tempo ja passou — o musico quer ver "0:42" enquanto fala.
   */
  async function iniciar(opcoes) {
    opcoes = function (opcoes) { return {}; }(); // se nao vier nada, nao quebra

    const disp = disponivel();
    if (!disp.ok) throw new Error(disp.motivo);

    // O pedido do microfone e feito AQUI, e nao no clique do botao da tela.
    // O navegador so mostra a janela para um gesto do usuario, e o gesto
    // acontece antes desta chamada — abrir a folha e depois pedir funciona
    // igual. Pedir de dentro de um `await` longo e o que faz a janela aparecer
    // sem gesto e ser negada sozinha.
    const fluxo = await navigator.mediaDevices.getUserMedia({
      audio: {
        // A voz nao precisa de faixa larga: cortar o ruido de fundo deixa o
        // guia mais limpo e o arquivo menor, que importa num aparelho com
        // cota apertada.
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const formato = formatoSuportado();
    const gravador = new MediaRecorder(fluxo, formato.mime ? { mimeType: formato.mime } : undefined);
    const partes = [];

    gravador.addEventListener('dataavailable', (ev) => {
      if (ev.data && ev.data.size > 0) partes.push(ev.data);
    });

    const fim = new Promise((resolve, reject) => {
      gravador.addEventListener('stop', () => {
        resolve();
      });
      gravador.addEventListener('error', (ev) => {
        reject(new Error('A gravação falhou: ' + (ev && ev.error && ev.error.name || 'desconhecido')));
      });
    });

    gravador.start(250);   // um pedaco a cada 250 ms: perde no maximo isso

    const inicio = Date.now();

    return {
      formato: formato.nome,
      /** Quanto tempo ja fala. */
      segundos: () => (Date.now() - inicio) / 1000,
      /** As faixas de audio ja gravadas, enquanto ainda grava. */
      parcial: () => new Blob(partes, { type: tipoDoGravador(gravador) }),
      /** Encerra e entrega o audio como data-URL. */
      async parar() {
        if (gravador.state !== 'inactive') gravador.stop();
        await fim;
        // O microfone e um recurso do aparelho. Sem soltar o fluxo, o indicador
        // de gravacao fica aceso e a bateria continua consumindo depois de
        // parar — e em alguns aparelhos o microfone fica travado para outro
        // uso ate a aba fechar.
        fluxo.getTracks().forEach((t) => t.stop());
        const blob = new Blob(partes, { type: tipoDoGravador(gravador) });
        if (!blob.size) throw new Error('Nada foi gravado.');
        return { dataUrl: await blobParaDataUrl(blob), bytes: blob.size, segundos: (Date.now() - inicio) / 1000 };
      },
      /** Desiste e solta o microfone, sem entregar audio. */
      cancelar() {
        try { if (gravador.state !== 'inactive') gravador.stop(); } catch (e) { /* ja parou */ }
        fluxo.getTracks().forEach((t) => t.stop());
      },
    };
  }

  /** Blob para data-URL. E a unica forma de guardar no armazenamento local. */
  function blobParaDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result);
      leitor.onerror = () => reject(new Error('Não deu para ler o áudio gravado.'));
      leitor.readAsDataURL(blob);
    });
  }

  /**
   * Quanto tempo cabe, em data-URL.
   *
   * O armazenamento do navegador costuma dar cinco megabytes por origem, e
   * uma data-URL custa um terco a mais que o binario. Isto e uma estimativa
   * honesta a partir do tamanho do blob real, nao uma suposicao.
   */
  function tamanhoDe(dataUrl) {
    if (!dataUrl) return 0;
    const i = dataUrl.indexOf(',');
    if (i < 0) return 0;
    const base64 = dataUrl.length - i - 1;
    return Math.floor(base64 * 3 / 4);
  }

  /** Formata segundos como 1:04, que e como se conta uma passagem. */
  function relogio(segundos) {
    const s = Math.max(0, Math.floor(Number(segundos) || 0));
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  global.Gravador = {
    iniciar: iniciar,
    disponivel: disponivel,
    jaAutorizado: jaAutorizado,
    relogio: relogio,
    tamanhoDe: tamanhoDe,
    FORMATOS: FORMATOS,
    tipoDoGravador: tipoDoGravador,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.Gravador;
})(typeof window !== 'undefined' ? window : globalThis);