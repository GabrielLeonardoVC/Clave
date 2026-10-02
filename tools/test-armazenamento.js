/* =========================================================
   ACORDE - tools/test-armazenamento.js
   O dado da pessoa, e as tres perguntas sobre ele.

   Este modulo cuida da coisa mais importante que o app tem — o repertorio de
   quem toca — e cuida disso numa area onde a API e escassa, o comportamento
   muda conforme o aparelho e a resposta do navegador nao e a mesma hoje e
   amanha.

   Cada secao aqui responde uma pergunta que a tela faz, e todas as respostas
   Precisam sobreviver a um navegador quebrado: sem `storage`, com `storage` que
   lanca, com cota menor do que o uso, com um backup de hoje e com nenhum.

   A ultima secao e a que mais importa: `persist()` sera chamado varias vezes
   na vida real — no boot, de novo quando a pessoa instala, de novo no botao de
   Ajustes. Se a segunda chamada mudar de ideia, o app precisa aguentar.
   ========================================================= */
'use strict';

const path = require('path');

const RAIZ = path.join(__dirname, '..');

/* Datas fixas, para o teste nao depender do dia em que ele roda.
 *
 * Um teste de "ha quantos dias" que usa a data de hoje passa hoje e falha
 * amanha — ou pior, passa sempre, porque os dois lados andam juntos. Datas
 * presas aqui fazem o numero ser o mesmo em qualquer execucao. */
const HOJE = '2026-10-01';
const ONTEM = '2026-09-30';
const ANTIGO = '2000-01-01';
const FUTURO = '2199-01-01';

/* ------------------------------------------------------------------
   As tres perguntinhas.
   ------------------------------------------------------------------ */

let passou = 0;
let falhou = 0;

function ok(recebido, rotulo, detalhe) {
  if (recebido) {
    passou++;
    console.log('  ok    ' + rotulo);
  } else {
    falhou++;
    console.log('  FALHA ' + rotulo + (detalhe ? '  ->  ' + detalhe : ''));
  }
}

function igual(recebido, esperado, rotulo) {
  ok(recebido === esperado, rotulo,
    'recebido ' + JSON.stringify(recebido) + ', esperado ' + JSON.stringify(esperado));
}

function secao(titulo) {
  console.log('\n=== ' + titulo + ' ===');
}

/* ------------------------------------------------------------------
   O navegador de mentira.

   `storage` e opcional porque a resposta honesta e "nem todo aparelho tem" —
   e o codigo precisa funcionar sem ele, nao falhar por causa dele.
   ------------------------------------------------------------------ */

function instalarNavegador(storage, ua, toques) {
  const anterior = Object.getOwnPropertyDescriptor(global, 'navigator');

  /* `ua` e `toques` entraram depois, para o relogio de sete dias. Sao
   * argumentos novos e opcionais justamente para nao ter que reescrever as
   * secoes que ja existiam: quem nao passa nada recebe um `navigator` sem
   * `userAgent`, e `soSafari()` devolve `false` — que e o certo para um
   * aparelho que nao diz qual e. */
  const falso = { storage: storage };
  if (ua !== undefined) falso.userAgent = ua;
  if (toques !== undefined) falso.maxTouchPoints = toques;

  /* `navigator` global e SOMENTE LEITURA no Node moderno, e nao e so leitura:
   * a atribuicao direto lanca `TypeError`. `defineProperty` e o caminho que
   * funciona — e precisa de `configurable`, senao o primeiro `instalar` ja
   * trava o segundo, e o teste inteiro morre na secao 2. */
  Object.defineProperty(global, 'navigator', {
    value: falso,
    configurable: true,
    writable: true,
  });

  return function restaurar() {
    if (anterior) Object.defineProperty(global, 'navigator', anterior);
    else delete global.navigator;
  };
}

/** Um `navigator.storage` que concede e mede, como o navegador cumpre. */
function storageBom(opts) {
  opts = opts || {};
  const estado = { persistidas: 0, negadas: opts.persiste === false };
  return {
    estado: estado,
    api: {
      persisted: function () { return estado.persistidas > 0; },
      persist: function () {
        if (estado.negadas) return Promise.resolve(false);
        estado.persistidas++;
        return Promise.resolve(true);
      },
      estimate: function () {
        return Promise.resolve({
          usage: opts.uso === undefined ? 1234567 : opts.uso,
          quota: opts.cota === undefined ? 52428800 : opts.cota,
        });
      },
    },
  };
}

/* ------------------------------------------------------------------
   O Store de mentira: so o que este modulo le dele.
   ------------------------------------------------------------------ */

function instalarStore(ajustes, metricas) {
  const anteriorStore = global.Store;
  const anteriorUtils = global.Utils;
  const mapa = Object.assign({}, ajustes || {});

  global.Store = {
    ajuste: function (chave, padrao) {
      return Object.prototype.hasOwnProperty.call(mapa, chave) ? mapa[chave] : padrao;
    },
    setAjuste: function (chave, valor) { mapa[chave] = valor; },
    metricas: metricas || function () { return { escalas: 0, cifras: 0 }; },
    storageInfo: function () { return { used: 2048 }; },
  };

  /* Uma data de verdade, e nao a palavra "HOJE".
   *
   * A primeira versao deste falso devolvia `todayKey() === 'HOJE'`, e o
   * `fromKey` de mentira tentava transformar isso em data. Dava `Invalid Date`,
   * o contador de dias devolvia -1, e seis asercoes falhavam — parecendo um
   * defeito do modulo.
   *
   * Era defeito do falso. E a liacao vale para o resto do projeto: um teste que
   * mente sobre o formato da data vai acusar o codigo certo. */
  global.Utils = {
    HOJE: HOJE,
    todayKey: function () { return HOJE; },
    fromKey: function (k) { return new Date(k + 'T00:00:00Z'); },
  };

  return {
    mapa: mapa,
    restaurar: function () {
      if (anteriorStore === undefined) delete global.Store; else global.Store = anteriorStore;
      if (anteriorUtils === undefined) delete global.Utils; else global.Utils = anteriorUtils;
    },
  };
}

function carregar() {
  delete require.cache[require.resolve(path.join(RAIZ, 'js/core/armazenamento.js'))];
  return require(path.join(RAIZ, 'js/core/armazenamento.js'));
}

(async function principal() {
  /* =======================================================
     1. Sem a API: nada quebra
     ======================================================= */
  secao('1. Aparelho sem a API de armazenamento');

  {
    const nav = instalarNavegador(undefined);
    const st = instalarStore();
    const Arm = carregar();

    igual(Arm.suporta(), false, 'o app diz que o aparelho nao suporta');
    igual(Arm.persistente(), false, 'e nao inventa que e persistente');
    igual(await Arm.pedir(), null, 'pedir devolve null, e nao falso');
    ok(!Arm.jaPediu(), 'e ainda nao disse que pediu');

    const medido = await Arm.medir();
    igual(medido.exato, false, 'medir devolve o que sabe: nada');
    igual(medido.uso, null, 'e sem numero inventado');

    const e = await Arm.estado();
    igual(e.suporta, false, 'o estado inteiro segue inteiro');
    igual(e.pct, null, 'e sem porcentagem de mentira');

    nav();
    st.restaurar();
  }

  /* =======================================================
     2. A API existe e o navegador diz sim
     ======================================================= */
  secao('2. O navegador concede');

  {
    const bom = storageBom();
    const nav = instalarNavegador(bom.api);
    const st = instalarStore();
    const Arm = carregar();

    igual(Arm.suporta(), true, 'o aparelho suporta');
    igual(Arm.persistente(), false, 'ainda nao e persistente: ninguem pediu');
    igual(await Arm.pedir(), true, 'pedir e aceito');
    igual(Arm.persistente(), true, 'e agora e persistente');
    ok(Arm.jaPediu() === false, 'pedir() direto nao marca o pedido do boot');

    await Arm.aoAbrir();
    ok(Arm.jaPediu(), 'aoAbrir marca que pediu');
    ok(bom.estado.persistidas >= 1, 'e o pedido chegou ao navegador');

    nav();
    st.restaurar();
  }

  /* =======================================================
     3. O navegador nega
     ======================================================= */
  secao('3. O navegador nega, e recusa nao e erro');

  {
    const bom = storageBom({ persiste: false });
    const nav = instalarNavegador(bom.api);
    const st = instalarStore();
    const Arm = carregar();

    igual(await Arm.pedir(), false, 'pedir devolve falso');
    igual(await Arm.pedir(), false, 'e pode pedir de novo sem explodir');
    igual(Arm.persistente(), false, 'continua nao persistente');
    ok(Arm.suporta(), 'e o aparelho continua suportando');

    nav();
    st.restaurar();
  }

  /* =======================================================
     4. A API lanca. Navegador e doido mesmo.
     ======================================================= */
  secao('4. A API lanca');

  {
    const nav = instalarNavegador({
      persisted: function () { throw new Error('negado pelo navegador'); },
      persist: function () { throw new Error('negado pelo navegador'); },
      estimate: function () { return Promise.reject(new Error('sem permissao')); },
    });
    const st = instalarStore();
    const Arm = carregar();

    igual(Arm.persistente(), false, 'persisted que lanca vira falso, e nao BREAK');
    igual(await Arm.pedir(), false, 'persist que lanca vira promessa resolvida');
    const medido = await Arm.medir();
    igual(medido.exato, false, 'estimate que falha devolve o vazio');
    igual(medido.cota, null, 'e sem cota inventada');

    nav();
    st.restaurar();
  }

  /* =======================================================
     5. Medir de verdade
     ======================================================= */
  secao('5. Medir o que o navegador informa');

  {
    const nav = instalarNavegador(storageBom({ uso: 1000, cota: 4000 }).api);
    const st = instalarStore();
    const Arm = carregar();
    const m = await Arm.medir();

    igual(m.uso, 1000, 'o uso vem do navegador');
    igual(m.cota, 4000, 'a cota tambem');
    igual(m.pct, 25, 'e a porcentagem sai da divisao real, nao de um limite inventado');
    igual(m.exato, true, 'sabendo que e medido de verdade');

    nav();
    st.restaurar();
  }

  {
    const nav = instalarNavegador(storageBom({ uso: 9999, cota: 1000 }).api);
    const st = instalarStore();
    const Arm = carregar();
    const m = await Arm.medir();

    igual(m.pct, 100, 'uso acima da cota trava em 100, e nao passa de 100');
    ok(m.pct <= 100, 'a barra nunca estoura o trilho');

    nav();
    st.restaurar();
  }

  {
    const nav = instalarNavegador(storageBom({ uso: 500, cota: 0 }).api);
    const st = instalarStore();
    const Arm = carregar();
    const m = await Arm.medir();

    igual(m.cota, null, 'cota zero nao e cota: e ausencia de informacao');
    igual(m.pct, null, 'e sem ela nao ha porcentagem');
    ok(m.exato, 'mas o uso continua informado');

    nav();
    st.restaurar();
  }

  /* =======================================================
     6. O historico de backup
     ======================================================= */
  secao('6. Ha quanto tempo nao ha backup');

  {
    const nav = instalarNavegador(storageBom().api);
    const st = instalarStore();
    const Arm = carregar();

    igual(Arm.ultimoBackup(), '', 'sem backup, o campo esta vazio');
    igual(Arm.diasSemBackup(), -1, 'e os dias sao -1, que significa "nunca"');

    st.mapa.ultimoBackup = HOJE;
    igual(Arm.diasSemBackup(), 0, 'backup hoje e zero dias');

    st.mapa.ultimoBackup = ONTEM;
    igual(Arm.diasSemBackup(), 1, 'backup de ontem e um dia, e nao zero');

    st.mapa.ultimoBackup = ANTIGO;
    ok(Arm.diasSemBackup() > 9000, 'backup de 2000 conta os dias de verdade',
      'veio ' + Arm.diasSemBackup());

    st.mapa.ultimoBackup = FUTURO;
    igual(Arm.diasSemBackup(), 0, 'backup no futuro nao gera negativo');

    st.mapa.ultimoBackup = 'nao-e-data';
    igual(Arm.diasSemBackup(), -1, 'data invalida e tratada como sem backup');

    nav();
    st.restaurar();
  }

  /* =======================================================
     7. Registrar um backup
     ======================================================= */
  secao('7. Registrar o backup');

  {
    const nav = instalarNavegador(storageBom().api);
    const st = instalarStore();
    const Arm = carregar();

    igual(Arm.registrarBackup(), HOJE, 'registrar devolve a data de hoje');
    igual(Arm.ultimoBackup(), HOJE, 'e ela fica guardada onde a tela le');
    igual(Arm.diasSemBackup(), 0, 'o contador zera');
    igual(st.mapa.ultimoBackup, HOJE, 'e o dado foi para o store, que sobrevive a fechar o app');

    nav();
    st.restaurar();
  }

  /* =======================================================
     8. O veredito. As tres situacoes mais uma.
     ======================================================= */
  secao('8. O que a tela mostra, em cada situacao');

  const CASOS = [
    {
      nome: 'nada salvo, espaco descartavel',
      ajustes: {},
      metricas: { escalas: 0, cifras: 0 },
      persistente: false,
      esperado: 'tranquilo',
      porque: 'avisar quem nao tem nada a perder e treinar a pessoa a ignorar avisos',
    },
    {
      nome: 'trabalho salvo, espaco descartavel, nunca exportou',
      ajustes: {},
      metricas: { escalas: 4, cifras: 12 },
      persistente: false,
      esperado: 'atencao',
      porque: 'ha trabalho que o navegador pode apagar',
    },
    {
      nome: 'trabalho salvo, espaco persistente, nunca exportou',
      ajustes: {},
      metricas: { escalas: 4, cifras: 12 },
      persistente: true,
      esperado: 'tranquilo',
      porque: 'o espaco esta seguro',
    },
    {
      nome: 'backup atrasado, espaco descartavel',
      ajustes: { ultimoBackup: ANTIGO },
      metricas: { escalas: 4, cifras: 12 },
      persistente: false,
      esperado: 'perigo',
      porque: 'muito tempo sem copia, e copia vulneravel',
    },
    {
      nome: 'backup atrasado, espaco persistente',
      ajustes: { ultimoBackup: ANTIGO },
      metricas: { escalas: 4, cifras: 12 },
      persistente: true,
      esperado: 'perigo',
      porque: 'o backup atrasado pesa mesmo com o espaco seguro',
    },
    {
      nome: 'backup de hoje, espaco descartavel',
      ajustes: { ultimoBackup: HOJE },
      metricas: { escalas: 4, cifras: 12 },
      persistente: false,
      esperado: 'atencao',
      porque: 'a copia existe, mas o espaco continua descartavel',
    },
  ];

  for (const c of CASOS) {
    const bom = storageBom({ persiste: c.persistente });
    const nav = instalarNavegador(bom.api);
    const st = instalarStore(c.ajustes, function () { return c.metricas; });
    const Arm = carregar();

    if (c.persistente) {
      await Arm.pedir();
    } else {
      bom.estado.persistidas = 0;
    }

    const r = Arm.risco();
    igual(r.nivel, c.esperado, c.nome);
    ok(typeof r.titulo === 'string' && r.titulo.length > 0, '  e a tela recebe um titulo');
    ok(typeof r.texto === 'string' && r.texto.length > 20, '  e uma frase pronta, nao um esqueleto');

    nav();
    st.restaurar();
  }

  /* =======================================================
     9. O app so avisa quem tem o que perder
     ======================================================= */
  secao('9. Quem recebe o aviso');

  {
    const nav = instalarNavegador(storageBom().api);
    const st = instalarStore({}, function () { return { escalas: 0, cifras: 0 }; });
    const Arm = carregar();
    igual(Arm.temTrabalho(), false, 'sem eventos e sem cifras, nao ha o que avisar');
    igual(Arm.risco().nivel, 'tranquilo', 'e o veredito e tranquilo, sem texto de risco');
    nav();
    st.restaurar();
  }

  {
    const nav = instalarNavegador(storageBom().api);
    const st = instalarStore({}, function () { return { escalas: 1, cifras: 0 }; });
    const Arm = carregar();
    igual(Arm.temTrabalho(), true, 'um evento so ja conta como trabalho');
    nav();
    st.restaurar();
  }

  {
    const nav = instalarNavegador(storageBom().api);
    const st = instalarStore({}, function () { return { escalas: 0, cifras: 1 }; });
    const Arm = carregar();
    igual(Arm.temTrabalho(), true, 'e uma cifra so tambem conta');
    nav();
    st.restaurar();
  }

  /* =======================================================
     10. Pedir varias vezes. E a vida real.
     ======================================================= */
  secao('10. Pedir de novo, como acontece de verdade');

  {
    const bom = storageBom();
    const nav = instalarNavegador(bom.api);
    const st = instalarStore();
    const Arm = carregar();

    await Arm.aoAbrir();
    await Arm.aoAbrir();
    await Arm.aoAbrir();
    igual(Arm.persistente(), true, 'tres pedidos nao tiram a concessao');
    igual(bom.estado.persistidas, 1, 'e so um pedido chega ao navegador: ja era persistente');

    await Arm.pedir();
    igual(Arm.persistente(), true, 'pedir de novo nao estraga');

    nav();
    st.restaurar();
  }

  {
    const nav = instalarNavegador(undefined);
    const st = instalarStore();
    const Arm = carregar();
    await Arm.aoAbrir();
    await Arm.aoAbrir();
    ok(Arm.jaPediu(), 'sem API, o boot segue rodando e nao trava');
    nav();
    st.restaurar();
  }

  /* =======================================================
     11. O boot escuta a instalacao
     ======================================================= */
  secao('11. Pedir de novo quando a pessoa instala');

  {
    const ouvintes = [];
    const anteriorAdd = global.addEventListener;
    const anteriorOn = global.Armazenamento;

    global.addEventListener = function (nome, fn) { ouvintes.push({ nome: nome, fn: fn }); };

    const bom = storageBom({ persiste: false });
    const nav = instalarNavegador(bom.api);
    const st = instalarStore();
    const Arm = carregar();

    await Arm.aoAbrir();
    igual(Arm.persistente(), false, 'ainda negado');

    const instalou = ouvintes.filter(function (o) { return o.nome === 'appinstalled'; });
    igual(instalou.length, 1, 'o boot ficou de olho na instalacao');

    /* A instalacao e a prova de que o app vai ficar. E o melhor momento para
     * pedir de novo — e o navegador costuma dizer sim aqui. */
    const agora = storageBom();
    instalarNavegador(agora.api);
    instalou[0].fn();
    await new Promise(function (r) { setTimeout(r, 0); });

    igual(Arm.persistente(), true, 'instalar o app e o momento de ganhar o espaco');

    global.addEventListener = anteriorAdd;
    if (anteriorOn === undefined) delete global.Armazenamento; else global.Armazenamento = anteriorOn;
    nav();
    st.restaurar();
  }

  /* =======================================================
     12. O modulo nao manda nada para lugar nenhum
     ======================================================= */
  secao('12. O modulo nao fala com ninguem');

  {
    const bom = storageBom();
    const nav = instalarNavegador(bom.api);
    const st = instalarStore();
    const Arm = carregar();

    const src = require('fs').readFileSync(
      path.join(RAIZ, 'js/core/armazenamento.js'), 'utf8');

    ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(src),
      'nao ha chamada de rede no arquivo inteiro');
    ok(!/\bimport\s*\(/.test(src), 'nem carga dinamica de nada');
    ok(Object.keys(Arm).indexOf('exportar') < 0, 'o modulo nao exporta dado nenhum para fora');

    await Arm.aoAbrir();
    await Arm.estado();

    nav();
    st.restaurar();
  }

  /* =======================================================
     13. O relogio de sete dias do iPhone

     O texto antigo dizia "este navegador pode limpar este espaco SE PRECISAR".
     Isso e a regra de pressao de espaco, que e a do Chrome. No iPhone nao existe
     falta de espaco na historia: o Safari apaga o que o app guardou no SETIMO
     DIA SEM ABRIR, e apaga tudo de uma vez.

     Quem tem 256 GB no celular le "se precisar", olha o armazenamento vazio e
     conclui que esta seguro. No iPhone ele nao esta — e o aviso dizia que ele
     estava, exatamente na situacao em que nao esta.
     ======================================================= */
  secao('13. O relogio de sete dias do iPhone');

  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) '
    + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  const CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) '
    + 'Chrome/120.0.0.0 Mobile Safari/537.36';
  const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
    + '(KHTML, like Gecko) Version/18.1 Safari/605.1.15';

  /* Data de N dias atras, em `YYYY-MM-DD`. Uma funcao, e nao a palavra "HOJE",
   * pelo mesmo motivo que o falso de `Utils` ja traz escrito: um falso que
   * mente sobre o formato da data acaba acusando o codigo certo. */
  const diasAtras = function (n) {
    const d = new Date(HOJE + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };

  console.log('\n-- quem tem o relogio --');
  {
    const medir = (ua, toques) => {
      const nav = instalarNavegador(undefined, ua, toques);
      const Arm = carregar();
      const r = Arm.soSafari();
      nav();
      return r;
    };

    igual(medir(IPHONE), true, 'o iPhone tem o relogio');
    igual(medir(CHROME), false, 'o Chrome nao tem: la o risco e falta de espaco');
    igual(medir('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) '
      + 'Chrome/120.0.0.0 Safari/537.36'), false, 'Chrome de mesa nao tem');
    igual(medir(MAC_SAFARI), true, 'Safari de mesa tem o relogio tambem');

    /* Qualquer navegador do iPhone e WebKit, ate os de outro fabricante. E o
     * iPadOS 13+ se anuncia como Macintosh — o toque e o que denuncia. */
    igual(medir(MAC_SAFARI, 5), true, 'iPad disfarçado de Macintosh tem o relogio: 5 toques');

    /* Este caso JA foi escrito ao contrario, e vale registrar por que.
     *
     * A primeira versao afirmava que um Macintosh de verdade (0 pontos de toque)
     * NAO tinha o relogio. O codigo discordou — e o codigo estava certo: o cap
     * de sete dias chegou no Safari 13.1, nao so no iOS 13.4. Ele e uma politica
     * de privacidade do WebKit, nao um limite de espaco do celular, e por isso
     * alcança o Safari de mesa do mesmo jeito.
     *
     * Corrigir a expectativa foi o caminho certo, e o contrario de "ajustar o
     * teste para passar": o teste afirmava uma coisa que eu nao tinha
     * verificado, e a verificacao mostrou que a afirmacao era falsa. */

    igual(medir(undefined), false, 'aparelho que nao diz qual e nao ganha alarme falso');
    igual(medir(''), false, 'userAgent vazio nao ganha alarme falso');

    /* `userAgent` pode chegar como funcao. Ler direto daria `[object Function]`
     * e nenhum navegador casaria — o aviso nunca apareceria em lugar nenhum. */
    const nav = instalarNavegador(undefined, function () { return IPHONE; });
    igual(carregar().soSafari(), true, 'userAgent que e funcao tambem e lido');
    nav();
  }

  console.log('\n-- o intervalo e medido ANTES de marcar o dia de hoje --');
  {
    /* Este e o detalhe que faz o aviso existir. Se o app gravasse o uso e so
     * depois lesse o intervalo, o intervalo seria zero no exato instante em que
     * a pessoa abre o app — e o aviso de "voce voltou a tempo" jamais apareceria,
     * sempre na visita em que ela esta de volta e ainda tem tudo. */
    const bom = storageBom({ persiste: false });
    const nav = instalarNavegador(bom.api, IPHONE, 5);
    const st = instalarStore({ ultimoUso: diasAtras(8) },
      function () { return { escalas: 3, cifras: 9 }; });
    const Arm = carregar();

    igual(Arm.diasDesdeUso(), 8, 'faziam 8 dias que a pessoa nao abria');

    await Arm.aoAbrir();

    ok(st.mapa.ultimoUso === HOJE, 'o dia de hoje foi gravado');
    igual(Arm.diasDesdeUso(), 0, 'depois de gravar, o intervalo e zero — como deve ser');

    const r = Arm.risco();
    igual(r.nivel, 'perigo', 'mas o veredito ainda sabe da ausencia de 8 dias');
    ok(/voltou a tempo/i.test(r.titulo),
      'e o aviso e o de "voltei a tempo", e nao o de um backup atrasado');

    /* A frase tem que dizer o mecanismo certo. "Se precisar" seria a regra
     * errada — e a que fazia a pessoa concluir que estava segura. */
    ok(/s[eé]timo dia|sétimo/i.test(r.texto), 'o texto diz que e no setimo dia');
    ok(/iPhone|Safari/i.test(r.texto), 'e diz que e o iPhone que apaga');
    ok(!/se precisar/i.test(r.texto),
      'e NAO diz "se precisar": no iPhone nao depende de espaco nenhum');

    nav();
    st.restaurar();
  }

  console.log('\n-- quando o aviso nao pode aparecer --');
  {
    const comDados = function () { return { escalas: 3, cifras: 9 }; };

    const cenario = async function (ua, persiste, ultimoUso) {
      const bom = storageBom({ persiste: persiste });
      const nav = instalarNavegador(bom.api, ua, 5);
      const st = instalarStore({ ultimoUso: ultimoUso }, comDados);
      const Arm = carregar();
      if (persiste) await Arm.pedir();
      await Arm.aoAbrir();
      const risco = Arm.relogioPerigoso();
      nav();
      st.restaurar();
      return risco;
    };

    /* Persistencia concedida e a UNICA isencao do relogio. Com ela, trinta dias
     * fora e o relogio nao corre — o aviso aqui seria mentira. */
    igual(await cenario(IPHONE, true, diasAtras(30)), null,
      'persistencia concedida: o relogio nao corre, mesmo apos 30 dias fora');

    /* No Chrome nao existe o mecanismo. Trinta dias fora la e o risco de sempre:
     * o backup atrasado. */
    igual(await cenario(CHROME, false, diasAtras(30)), null,
      'no Chrome o relogio de sete dias nao existe');

    /* Abaixo do limite o app cala a boca. Avisar sobre cinco dias e treinar a
     * pessoa a ignorar o aviso que vem no sexto. */
    igual(await cenario(IPHONE, false, diasAtras(2)), null,
      'dois dias fora ainda nao e aviso: o prazo e de sete');

    /* Sem historico nao ha o que afirmar. */
    igual(await cenario(IPHONE, false, undefined), null,
      'sem historico o app nao inventa um prazo');
  }

  console.log('\n-- "se precisar" e a regra errada, e ela aparecia justamente aqui --');
  {
    /* A frase "este navegador pode apagar este espaco SE PRECISAR" descreve a
     * regra de PRESSAO DE ESPACO, que e a do Chrome. No iPhone o Safari apaga
     * no setimo dia SEM USO, e nao depende de espaco nenhum.
     *
     * O efeito de dizer a coisa errada aqui era o pior possivel: a pessoa que
     * NUNCA fez backup e justamente a que mais tem a perder, e ela era a
     * primeira a receber "se precisar". Quem tem 256 GB no celular lia isso,
     * olhava o armazenamento vazio e saia de tela com a certeza de que estava
     * segura. Este caso nao tinha teste nenhum — a mutacaoIntroduzindo o texto
     * antigo passou verde, e foi o que revelou a lacuna. */
    const verNoIphone = async function (ultimoBackup) {
      const bom = storageBom({ persiste: false });
      const nav = instalarNavegador(bom.api, IPHONE, 5);
      const st = instalarStore(ultimoBackup === undefined ? {} : { ultimoBackup: ultimoBackup },
        function () { return { escalas: 2, cifras: 6 }; });
      const Arm = carregar();
      await Arm.aoAbrir();
      const r = Arm.risco();
      nav();
      st.restaurar();
      return r;
    };

    const nunca = await verNoIphone(undefined);
    igual(nunca.nivel, 'atencao', 'sem backup nenhum, o app ainda pede o primeiro');
    ok(!/se precisar/i.test(nunca.texto),
      'NAO promete que o espaco so se perder se precisar: no iPhone nao depende de espaco');
    ok(/sete dias|sétimo dia/i.test(nunca.texto),
      'e diz a regra que vale no iPhone');
    ok(/Safari/i.test(nunca.texto), 'e diz quem e que apaga');

    const atrasado = await verNoIphone(diasAtras(3));
    ok(!/se precisar/i.test(atrasado.texto),
      'no caso do backup atrasado tambem: a mesma regra errada aparecia duas vezes');
    ok(/tela de in[ií]cio/i.test(atrasado.texto),
      'e o aviso oferece instalar na tela de inicio, que e o conserto');

    /* O titulo tambem. Ele e o cabecalho do aviso que aparece na tela — o
     * texto abaixo e o detalhe, e o titulo e o que a pessoa le de longe. Um
     * teste que olha so para o `texto` deixa o titulo dizer a regra errada
     * sem ninguem reclamar. */
    ok(!/este espa[cç]o pode ser apagado/i.test(atrasado.titulo),
      'o titulo nao promete "este espaco pode ser apagado" no iPhone');
    ok(/iPhone|s[eé]timo dia/i.test(atrasado.titulo),
      'e diz no titulo que e o iPhone que apaga');

    /* No Chrome a frase antiga estava certa — la o risco e mesmo falta de
     * espaco. Trocar o texto do iPhone nao pode ter estragado o do Chrome. */
    const bom = storageBom({ persiste: false });
    const nav = instalarNavegador(bom.api, CHROME, 5);
    const st = instalarStore({ ultimoBackup: diasAtras(3) },
      function () { return { escalas: 2, cifras: 6 }; });
    const Arm = carregar();
    await Arm.aoAbrir();
    const noChrome = Arm.risco();
    ok(/pode limpar este espa[cç]o/i.test(noChrome.texto),
      'no Chrome a frase de espaco continua: la ela descreve o risco certo');
    ok(!/s[eé]timo dia/i.test(noChrome.texto),
      'e o Chrome nao entra na regra do relogio de sete dias');
    nav();
    st.restaurar();

    ok(carregar().DIAS_SEM_USO < 7,
      'o aviso vem antes do prazo, e nao depois de vencer');
  }

  console.log('\n-- quem nao tem nada a perder nao ouve nada --');
  {
    const bom = storageBom({ persiste: false });
    const nav = instalarNavegador(bom.api, IPHONE, 5);
    const st = instalarStore({ ultimoUso: diasAtras(30) },
      function () { return { escalas: 0, cifras: 0 }; });
    const Arm = carregar();
    await Arm.aoAbrir();
    igual(Arm.risco().nivel, 'tranquilo',
      '30 dias sem abrir e nada salvo: o "nada em risco" vem primeiro');
    nav();
    st.restaurar();
  }

  console.log('\n-- o estado que a tela recebe --');
  {
    const bom = storageBom({ persiste: false });
    const nav = instalarNavegador(bom.api, IPHONE, 5);
    const st = instalarStore({ ultimoUso: diasAtras(8) },
      function () { return { escalas: 1, cifras: 2 }; });
    const Arm = carregar();
    await Arm.aoAbrir();
    const e = await Arm.estado();
    igual(e.soSafari, true, 'a tela sabe que e iPhone');
    igual(e.diasDesdeUso, 8, 'e sabe quantos dias a pessoa ficou fora');
    igual(e.relogioSeteDias, true, 'e sabe que o relogio esta correndo');
    nav();
    st.restaurar();
  }

  console.log('\n-- instalar na tela de inicio: o conserto de verdade --');
  {
    /* O unico jeito de REMOVER o relogio, e nao apenas enxergar o prazo, e
     * instalar o app na tela de inicio. Um app instalado nao passa pelo contador
     * do Safari, e e por isso que o WebKit concede o `persist()` a ele.
     *
     * E isso so vale se o manifesto disser `"display": "standalone"`. Com
     * `minimal-ui` ou `browser`, o icone abre o Safari e o app continua no
     * relogio mesmo instalado — que e o defeito relatado no bug 232302 do
     * WebKit. O nosso manifesto ja diz `standalone`. */
    const instalarTela = function (consultas) {
      const anterior = global.matchMedia;
      global.matchMedia = function (q) {
        return { matches: consultas.indexOf(q) >= 0 };
      };
      const r = carregar().instalado();
      global.matchMedia = anterior;
      return r;
    };

    igual(instalarTela(['(display-mode: standalone)']), true, 'standalone: instalado');
    igual(instalarTela(['(display-mode: fullscreen)']), true,
      'fullscreen: tambem conta como instalado');
    igual(instalarTela([]), false, 'nem standalone nem fullscreen: ainda no Safari');

    /* Sem `matchMedia` nenhum, o app diz "nao instalado" em vez de quebrar. */
    const nav = instalarNavegador(undefined, IPHONE, 5);
    igual(carregar().instalado(), false, 'navegador sem matchMedia nao quebra');
    nav();

    /* O sinal do iPhone vale mais que o `display-mode`. Este `standalone` e o
     * que o proprio Safari publica dentro de um app na tela de inicio. */
    const nav2 = instalarNavegador(undefined, IPHONE, 5);
    igual(carregar().instalado(), false, 'sem o sinal, e so o Safari mesmo');
    global.navigator.standalone = true;
    igual(carregar().instalado(), true, 'navigator.standalone do iPhone e respeitado');
    nav2();

    /* E o texto tem que oferecer o conserto, e nao so o medo. Um aviso que
     * diz "o repertorio pode sumir" sem dizer o que fazer e metade do trabalho. */
    const bom = storageBom({ persiste: false });
    const nav3 = instalarNavegador(bom.api, IPHONE, 5);
    const st = instalarStore({ ultimoUso: diasAtras(8) },
      function () { return { escalas: 2, cifras: 5 }; });
    const Arm = carregar();
    await Arm.aoAbrir();
    const r = Arm.risco();
    ok(/tela de in[ií]cio/i.test(r.texto),
      'o aviso oferece instalar na tela de inicio, que e o que remove o prazo');
    ok(/backup/i.test(r.texto), 'e ainda assim oferece o backup');
    igual(r.nivel, 'perigo', 'e continua sendo perigo: instalar nao traz o dado de volta');
    nav3();
    st.restaurar();
  }

  console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
  console.log('=================================================\n');
  process.exit(falhou ? 1 : 0);
})().catch(function (e) {
  console.error('\nO TESTE QUEBROU:');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
