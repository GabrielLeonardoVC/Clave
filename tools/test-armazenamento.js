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

function instalarNavegador(storage) {
  const anterior = Object.getOwnPropertyDescriptor(global, 'navigator');

  /* `navigator` global e SOMENTE LEITURA no Node moderno, e nao e so leitura:
   * a atribuicao direto lanca `TypeError`. `defineProperty` e o caminho que
   * funciona — e precisa de `configurable`, senao o primeiro `instalar` ja
   * trava o segundo, e o teste inteiro morre na secao 2. */
  Object.defineProperty(global, 'navigator', {
    value: { storage: storage },
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

  console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
  console.log('=================================================\n');
  process.exit(falhou ? 1 : 0);
})().catch(function (e) {
  console.error('\nO TESTE QUEBROU:');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
