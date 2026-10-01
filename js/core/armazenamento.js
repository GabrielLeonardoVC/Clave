/* =========================================================
   ACORDE - js/core/armazenamento.js
   O trabalho da pessoa, e onde ele esta.

   =========================================================

   POR QUE ESTE ARQUIVO EXISTE

   O app promete que o dado fica no aparelho. Essa promessa e o produto: e a
   razao de alguem olhar a tela e digitar o repertorio inteiro da banda.

   E ela tinha um buraco. O app guardava tudo numa chave de `localStorage` e
   nunca pedia para o navegador NAO apagar aquela chave. Um navegador pode
   apagar o armazenamento de um site — por pressao de espaco, por uma limpeza
   automatica, por instalacao desfeita. Quando apaga, apaga sem avisar, e o
   repertorio inteiro vai embora.

   Este arquivo nao impede que o navegador apague. Nao existe API para isso.
   O que ele faz e o que da para fazer:

     1. PEDIR o armazenamento persistente. `navigator.storage.persist()` e o
        pedido oficial. O navegador concede sozinho quando o app esta
        instalado, ou quando a pessoa usa bastante — e negar a primeira vez nao
        e o fim, porque a resposta muda conforme o app ganha vida.

     2. MEDIR de verdade. `navigator.storage.estimate()` devolve uso e cota
        reais. A porcentagem que o app mostrava antes era calculada sobre um
        limite inventado (4,5 MB), que nao existe em lugar nenhum: o navegador
        decide, e o limite dele varia de aparelho para aparelho.

     3. LEMBRAR do ultimo backup. O unico jeito de o dado sobreviver a um
        aparelho perdido, e o unico jeito de desfazer um "apagar tudo" sem
        querer.

   E avisar. Um app que descobre que o dado esta em risco e nao diz nada esta
   mentindo do mesmo jeito que um app que perde.

   ---------------------------------------------------------
   O QUE ESTE ARQUIVO NAO FAZ

   Nao sincroniza, nao envia nada, nao pede conta. O dado sai do aparelho so
   quando a pessoa baixa um arquivo — e ela sabe disso porque foi ela que
   apertou o botao. `check-seguranca` vigia isso: se aparecer `fetch` aqui, o
   verificador acusa.
   ========================================================= */
(function (global) {
  'use strict';

  const DIA = 24 * 60 * 60 * 1000;

  /* Ate quantos dias sem backup o app deixa ficar quieto.
   *
   * O numero e arbitrario, e essa e a discussao: muito curto e o aviso vira
   * irritacao, e a pessoa desliga. Muito longo e o aviso chega tarde demais
   * para ser util. Quinze dias e o tempo de um ciclo de ensaio.
   *
   * E o aviso NAO e sobre perder o aparelho — e sobre perder o que foi
   * digitado. Quem usa todo dia tem o dado na mao; quem parou de usar por
   * tres semanas e depois volta e encontra o espaco vazio, esse e o caso. */
  const DIAS_SEM_BACKUP = 15;

  /* A cota do navegador e contada em bytes do app inteiro, nao so do
   * `localStorage`. Por isso o numero do store (4,5 MB) era util como
   * limite de escrita e enganoso como limite de espaco. */
  const PERSISTINDO = 'persistente';

  let pedidoFeito = false;
  let cached = null;

  function nav() {
    return global.navigator || null;
  }

  function api() {
    const n = nav();
    return n && n.storage ? n.storage : null;
  }

  /** O navegador oferece alguma coisa para conversar sobre espaco? */
  function suporta() {
    return !!api();
  }

  /** O navegador ja marcou este armazenamento como persistente? */
  function persistente() {
    const s = api();
    if (!s || typeof s.persisted !== 'function') return false;
    try { return s.persisted() === true; } catch (e) { return false; }
  }

  /** Pede o armazenamento persistente.
   *
   * Devolve `true`, `false` ou `null` quando o navegador nao tem essa API.
   *
   * Chamar uma vez nao e suficiente. O navegador nega a primeira vez com
   * muita frequencia, e concede depois que o app ganha evidencia de uso. Por
   * isso `pedir()` e seguro de chamar de novo — e e o que `aoAbrir` faz, e o
   * que o app faz quando a pessoa instala. */
  function pedir() {
    const s = api();
    if (!s || typeof s.persist !== 'function') return null;
    try {
      return Promise.resolve(s.persist()).catch(function () { return false; });
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  /** Uso e cota reais, do jeito que o navegador informa.
   *
   * Devolve SEMPRE uma promessa, mesmo sem a API.
   *
   * Este era o primeiro bug do modulo, e a forma dele era travar em aparelho
   * antigo: quando nao havia `estimate`, a funcao devolvia o objeto direto, e
   * quem chamava — `estado()`, e a tela de Ajustes — fazia `.then` num objeto
   * que nao era promessa. Num aparelho com a API, tudo funcionava e o teste
   * passava; num aparelho sem, a tela inteira quebrava. Um retorno que muda de
   * forma conforme o aparelho obriga quem chama a lidar com os dois casos. */
  function medir() {
    const s = api();
    const padrao = { uso: null, cota: null, pct: null, exato: false };
    if (!s || typeof s.estimate !== 'function') return Promise.resolve(padrao);
    return Promise.resolve(s.estimate()).then(function (e) {
      if (!e) return padrao;
      const uso = typeof e.usage === 'number' ? e.usage : null;
      const cota = typeof e.quota === 'number' && e.quota > 0 ? e.quota : null;
      return {
        uso: uso,
        cota: cota,
        pct: (uso !== null && cota) ? Math.min(100, Math.round((uso / cota) * 100)) : null,
        exato: uso !== null,
      };
    }).catch(function () { return padrao; });
  }

  /** Quando a pessoa fez o ultimo backup, em data de hoje (`YYYY-MM-DD`). */
  function ultimoBackup() {
    const S = global.Store;
    if (!S || typeof S.ajuste !== 'function') return '';
    const v = S.ajuste('ultimoBackup', '');
    return typeof v === 'string' ? v : '';
  }

  function registrarBackup() {
    const S = global.Store;
    const hoje = global.Utils ? global.Utils.todayKey()
      : new Date().toISOString().slice(0, 10);
    if (S && typeof S.setAjuste === 'function') S.setAjuste('ultimoBackup', hoje);
    cached = null;
    return hoje;
  }

  /** Quantos dias ha sem backup. `-1` quando nunca houve backup. */
  function diasSemBackup() {
    const iso = ultimoBackup();
    if (!iso) return -1;
    const U = global.Utils;
    const hoje = U ? U.fromKey(U.todayKey()).getTime() : Date.now();
    const dia = U ? U.fromKey(iso).getTime() : Date.parse(iso + 'T00:00:00');
    if (!isFinite(dia) || !isFinite(hoje)) return -1;
    const dias = Math.floor((hoje - dia) / DIA);
    return dias < 0 ? 0 : dias;
  }

  /** Ha trabalho que valha perder? */
  function temTrabalho() {
    const S = global.Store;
    if (!S || typeof S.metricas !== 'function') return false;
    try {
      const m = S.metricas();
      return (m.escalas || 0) > 0 || (m.cifras || 0) > 0;
    } catch (e) {
      return false;
    }
  }

  /** O tamanho do que o app guardou, em bytes. */
  function usoDoApp() {
    const S = global.Store;
    if (!S || typeof S.storageInfo !== 'function') return 0;
    try { return S.storageInfo().used || 0; } catch (e) { return 0; }
  }

  /** O veredito, em portugues, para a tela mostrar.
   *
   * Tres niveis, e o nivel do meio existe porque o primeiro e o que a pessoa
   *uka costuma achar: "estou seguro". O app guarda tudo num aparelho so, sem
   * conta e sem copia. Se esse aparelho se perde, o que estava nele vai junto.
   * Isso nao e defeito — e a consequencia de um app que nao manda o dado para
   * lugar nenhum. Mas e a unica copia, e a pessoa precisa saber disso antes,
   * e nao depois de precisar.
   *
   * Devolve `{nivel, titulo, texto}` — o texto ja e frase pronta, para a tela
   * nao ter de inventar um jeito de dizer a mesma coisa tres lugares. */
  function risco() {
    if (!temTrabalho()) {
      return {
        nivel: 'tranquilo',
        titulo: 'Nada em risco',
        texto: 'Ainda não há nada salvo que valha perder.',
      };
    }

    const dias = diasSemBackup();
    const firme = persistente();

    if (dias === -1) {
      return {
        nivel: firme ? 'tranquilo' : 'atencao',
        titulo: firme ? 'Está tudo certo' : 'Faça o primeiro backup',
        texto: firme
          ? 'Este aparelho guardou seu trabalho de forma persistente. Ainda assim, um backup não machuca: é a única cópia que existe.'
          : 'Você já salvou coisas aqui, e este navegador pode apagar este espaço se precisar. Baixe um backup para ter uma cópia fora daqui.',
      };
    }

    if (dias >= DIAS_SEM_BACKUP) {
      return {
        nivel: 'perigo',
        titulo: 'Faz ' + dias + ' dias sem backup',
        texto: 'O que está aqui é a única cópia. Baixe um backup agora — leva um segundo.',
      };
    }

    if (!firme) {
      return {
        nivel: 'atencao',
        titulo: 'Este espaço pode ser apagado',
        texto: 'Seu último backup foi há ' + dias + (dias === 1 ? ' dia' : ' dias')
          + '. Este navegador pode limpar este espaço sem avisar; o backup é o que sobrevive a isso.',
      };
    }

    return {
      nivel: 'tranquilo',
      titulo: 'Tudo protegido',
      texto: 'Este armazenamento é persistente e seu backup tem ' + dias
        + (dias === 1 ? ' dia' : ' dias') + '.',
    };
  }

  /** O estado inteiro, para a tela de Ajustes desenhar. */
  function estado() {
    return medir().then(function (m) {
      const r = risco();
      const r2 = {
        suporta: suporta(),
        persistente: persistente(),
        uso: m.uso,
        cota: m.cota,
        pct: m.pct,
        exato: m.exato,
        usoApp: usoDoApp(),
        ultimoBackup: ultimoBackup(),
        diasSemBackup: diasSemBackup(),
        temTrabalho: temTrabalho(),
        nivel: r.nivel,
        titulo: r.titulo,
        texto: r.texto,
      };
      cached = r2;
      return r2;
    });
  }

  function estadoCache() {
    if (cached) return Promise.resolve(cached);
    return estado();
  }

  /** Chamar uma vez, cedo.
   *
   * Na primeira vez o app so PEDE. Depois, quando a pessoa instala, ele pede
   * de novo — e e nesse segundo pedido que o navegador costuma dizer sim,
   * porque a instalacao e justamente a evidencia que ele queria. */
  function aoAbrir() {
    pedidoFeito = true;
    const s = api();
    if (!s) return Promise.resolve(null);

    // Quem instala o app e a prova de que ele vai ficar. E o melhor momento
    // para pedir de novo, e o unico em que a resposta muda de verdade.
    if (global.addEventListener) {
      global.addEventListener('appinstalled', function () { pedir(); }, { once: true });
    }

    if (persistente()) return Promise.resolve(true);
    return pedir();
  }

  function jaPediu() {
    return pedidoFeito;
  }

  global.Armazenamento = {
    DIAS_SEM_BACKUP: DIAS_SEM_BACKUP,
    suporta: suporta, persistente: persistente, pedir: pedir, medir: medir,
    estado: estado, estadoCache: estadoCache, risco: risco,
    aoAbrir: aoAbrir, jaPediu: jaPediu,
    ultimoBackup: ultimoBackup, registrarBackup: registrarBackup,
    diasSemBackup: diasSemBackup, temTrabalho: temTrabalho,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.Armazenamento;
})(typeof window !== 'undefined' ? window : globalThis);
