/* =========================================================
   tools/test-ios.js
   O caminho de arquivo no iPhone, EXECUTADO.

   POR QUE UM TESTE E NAO SO O VERIFICADOR

   `check-ios.js` olha o texto e diz que o codigo esta escrito. Este arquivo
   EXECUTA o `download` contra um navegador de mentira e diz o que ele faz.
   Sao perguntas diferentes, e as duas importam.

   O iPhone muda o comportamento do navegador de arquivo de um jeito que so
   aparece em tempo de execucao: existe `navigator.share`? ele aceita ESTE
   arquivo? a pessoa cancelou? o navegador recusou? Cada resposta muda o que o
   app diz sobre o backup — e o backup e a unica copia do repertorio.

   O bug que motivou tudo isto era o mais discreto possivel: o `download` era
   uma funcao sincrona que nao devolvia nada, e o chamador gravava "backup
   feito" na sequencia. No iPhone, onde o arquivo pode so ser ABERTO em vez de
   salvo, o app desligava o proprio aviso de risco sem nenhum erro.
   ========================================================= */
'use strict';

const path = require('path');

const RAIZ = path.join(__dirname, '..');
const INDEX = path.join(RAIZ, 'js', 'core', 'utils.js');

let passou = 0;
let falhou = 0;

function ok(cond, nome) {
  if (cond) { passou++; console.log('  ok    ' + nome); }
  else { falhou++; console.log('  FALHA ' + nome); }
}
function igual(recebido, esperado, nome) {
  if (recebido === esperado) {
    passou++; console.log('  ok    ' + nome + '  -> ' + JSON.stringify(recebido));
  } else {
    falhou++;
    console.log('  FALHA ' + nome);
    console.log('        recebido ' + JSON.stringify(recebido) + ', esperado ' + JSON.stringify(esperado));
  }
}
function secao(t) { console.log('\n=== ' + t + ' ==='); }

/* ------------------------------------------------------------------
   O navegador de mentira.

   `navigator` global e SOMENTE LEITURA no Node moderno, entao precisa de
   `defineProperty` — e `configurable`, senao o primeiro `instalar` trava o
   segundo e o teste inteiro morre.
   ------------------------------------------------------------------ */
function instalarNav(nav) {
  const anterior = Object.getOwnPropertyDescriptor(global, 'navigator');
  Object.defineProperty(global, 'navigator', { value: nav, configurable: true, writable: true });
  return function restaurar() {
    if (anterior) Object.defineProperty(global, 'navigator', anterior);
    else delete global.navigator;
  };
}

/* O `document` de mentira: `el` so precisa de createElement, setAttribute,
 * appendChild/removeChild e `style`. */
function instalarDoc(registro) {
  const anterior = global.document;
  const corpo = {
    appendChild: (n) => { registro.anexados.push(n); n.parentNode = corpo; return n; },
    removeChild: (n) => { registro.removidos.push(n); n.parentNode = null; return n; },
  };
  global.document = {
    body: corpo,
    createElement: (tag) => ({
      tagName: String(tag).toUpperCase(),
      style: {},
      dataset: {},
      childNodes: [],
      setAttribute(k, v) { this[k] = v; },
      appendChild(c) { this.childNodes.push(c); return c; },
      addEventListener() {},
      click() { registro.clicados.push(this); },
    }),
  };
  return function restaurar() {
    if (anterior) global.document = anterior; else delete global.document;
  };
}

/* O `URL` de mentira: a gente precisa ver QUANDO a URL do blob foi revogada,
 * porque revogar cedo corta o download pela metade. */
function instalarURL(registro) {
  const anterior = global.URL;
  let n = 0;
  global.URL = {
    createObjectURL: function () { registro.criadas.push(++n); return 'blob:mock/' + n; },
    revokeObjectURL: function (u) { registro.revogados.push(u); },
  };
  return function restaurar() { global.URL = anterior; };
}

/* O `setTimeout` de mentira: em vez de esperar, anota o atraso pedido. */
function instalarTimer(registro) {
  const anterior = global.setTimeout;
  global.setTimeout = function (fn, ms) {
    registro.timeouts.push(ms);
    return 0;
  };
  return function restaurar() { global.setTimeout = anterior; };
}

function carregar() {
  delete require.cache[require.resolve(INDEX)];
  require(INDEX);
  return global.Utils;
}

/* Monta um cenario completo e devolve oUtils mais o que aconteceu. */
function cenario(opts) {
  opts = opts || {};
  const registro = { clicados: [], anexados: [], removidos: [], criadas: [], revogados: [], timeouts: [], shares: [], pode: true };

  const nav = Object.assign({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120',
  }, opts.navigator || {});

  if (opts.comShare) {
    nav.share = function (dados) {
      registro.shares.push(dados);
      if (opts.cancelar) return Promise.reject(new Error('AbortError'));
      return Promise.resolve();
    };
    nav.canShare = function (d) {
      if (opts.canShareLanca) throw new Error('canShare explodiu');
      if (opts.canShareRecusa) return false;
      return !!(d && d.files && d.files.length);
    };
  }

  const rNav = instalarNav(nav);
  const rDoc = instalarDoc(registro);
  const rURL = instalarURL(registro);
  const rTimer = instalarTimer(registro);

  const U = carregar();

  return {
    U: U,
    registro: registro,
    restaurar: function () { rTimer(); rURL(); rDoc(); rNav(); },
  };
}

const CONTEUDO = '{"escalas":[],"cifras":[]}';

/* ================================================================== */
(async function principal() {

  secao('1. A funcao diz o que aconteceu');

  {
    const c = cenario();
    const r = await c.U.download('backup.json', CONTEUDO);
    ok(r && typeof r === 'object', 'devolve um objeto, e nao nada');
    ok(r && typeof r.via === 'string', 'diz por onde o arquivo saiu');
    ok(r && typeof r.salvou === 'boolean', 'diz se o arquivo saiu daqui');
    igual(r.via, 'ancora', 'sem partilha nativa, o caminho e o ancor');
    igual(r.salvou, true, 'e conta como saiu');
    ok(!(r && r.cancelou), 'e nao e cancelamento: ninguem cancelou');
    c.restaurar();
  }

  secao('2. O caminho do iPhone: a partilha nativa');

  {
    const c = cenario({ comShare: true });
    const r = await c.U.download('backup.json', CONTEUDO);
    igual(r.via, 'partilha', 'com share e canShare, o app usa a partilha do sistema');
    igual(c.registro.shares.length, 1, 'e chama a partilha uma vez');
    ok(c.registro.shares[0] && c.registro.shares[0].files && c.registro.shares[0].files.length === 1,
      'anexando o arquivo, e nao so texto');
    igual(c.registro.clicados.length, 0,
      'e nao dispara o ancor: no iPhone ele abriria o arquivo em vez de salvar');
    c.restaurar();
  }

  secao('3. Cancelar a partilha nao e erro');

  {
    /* A pessoa mudou de ideia. Um "deu errado" aqui seria mentira — e o pior
     * efeito seria o app marcar o backup como feito, quando ela nao salvou
     * nada. E por isso que o cancelamento vem separado. */
    const c = cenario({ comShare: true, cancelar: true });
    const r = await c.U.download('backup.json', CONTEUDO);
    igual(r.cancelou, true, 'o cancelamento e reconhecido');
    igual(r.salvou, false, 'e NAO conta como salvo: o arquivo nao foi guardado');
    igual(r.via, 'partilha', 'mas a via continua sendo a partilha');
    c.restaurar();
  }

  secao('4. Quando o navegador recusa, o app nao quebra');

  {
    const recusa = cenario({ comShare: true, canShareRecusa: true });
    const r = await recusa.U.download('backup.json', CONTEUDO);
    igual(r.via, 'ancora', 'canShare recusando o arquivo: cai para o ancor');
    igual(recusa.registro.clicados.length, 1, 'e o ancor e disparado mesmo assim');
    recusa.restaurar();
  }

  {
    /* Um `canShare` que lanca e o jeito de um aparelho com seguranca. A resposta
     * honesta e "nao sei", e o app tem um caminho que funciona. */
    const lanca = cenario({ comShare: true, canShareLanca: true });
    const r = await lanca.U.download('backup.json', CONTEUDO);
    igual(r.via, 'ancora', 'canShare lancando: cai para o ancor, e nao quebra');
    lanca.restaurar();
  }

  {
    const semShare = cenario({});
    igual(typeof semShare.U.podeCompartilharArquivo, 'function', 'a pergunta existe mesmo sem share');
    igual(semShare.U.podeCompartilharArquivo(null), false, 'sem arquivo, nao da para compartilhar');
    semShare.restaurar();
  }

  secao('5. A URL do blob nao e revogada cedo');

  {
    /* Este e o defeito que existia: `setTimeout(..., 100)` e `revokeObjectURL`.
     * O download e assincrono, e revogar a URL enquanto o navegador ainda esta
     * lendo o blob entrega um arquivo pela metade. */
    const c = cenario();
    await c.U.download('backup.json', CONTEUDO);
    igual(c.registro.criadas.length, 1, 'a URL do blob foi criada');
    igual(c.registro.revogados.length, 0, 'e nao foi revogada na hora');
    ok(c.registro.timeouts.length === 1, 'a revogacao foi agendada');
    const atraso = c.registro.timeouts[0];
    ok(atraso >= 10000,
      'e o agendamento e longo (' + atraso + 'ms): 100 ms cortava o download pela metade');
    c.restaurar();
  }

  {
    const c = cenario({ comShare: true });
    await c.U.download('backup.json', CONTEUDO);
    igual(c.registro.criadas.length, 0,
      'no caminho da partilha nao existe URL de blob para revogar: o iOS cuida do arquivo');
    c.restaurar();
  }

  secao('6. Data-URL vira arquivo de verdade');

  {
    const c = cenario();
    const U = c.U;
    // "Clave" em bytes: 43 6c 61 76 65
    const png = 'data:image/png;base64,Q2x2dmU=';
    const arq = U.dataURLParaArquivo(png, 'anotada');
    ok(arq && typeof arq.name === 'string', 'vira um arquivo com nome');
    igual(arq && arq.name, 'anotada.png', 'e a extensao vem do tipo do dado');
    igual(arq && arq.type, 'image/png', 'e o tipo e preservado');

    const jpg = U.dataURLParaArquivo('data:image/jpeg;base64,Q2x2dmU=', 'foto', 'jpg');
    igual(jpg && jpg.name, 'foto.jpg', 'a extensao pode ser forcada');

    igual(U.dataURLParaArquivo(null), null, 'nada nao vira nada');
    igual(U.dataURLParaArquivo(''), null, 'texto vazio nao vira nada');
    igual(U.dataURLParaArquivo('sem virgula'), null, 'sem o separador, nao ha dados');
    igual(U.dataURLParaArquivo('data:image/png;base64,@@@nao-base64@@@'), null,
      'base64 invalido devolve nulo em vez de estourar');
    c.restaurar();
  }

  secao('7. Conteudo estragado nao vira promessa quebrada');

  {
    const c = cenario();
    const r = await c.U.download('x.json', null);
    ok(r && typeof r.via === 'string', 'conteudo nulo ainda devolve um resultado valido');
    igual(r.via, 'ancora', 'e o arquivo vazio mesmo assim sai pelo ancor');

    const vazio = await c.U.entregarArquivo(null, 'nada.json');
    igual(vazio.via, 'nada', 'sem arquivo, o app diz que nao conseguiu');
    igual(vazio.salvou, false, 'e nao finge que salvou');
    c.restaurar();
  }

  secao('8. O backup nao se declara feito sem saber');

  {
    /* A ultima verificacao nao e do `Utils`, e do arquivo que chama. O `exportar`
     * do Ajustes e onde o app grava a data do backup — e onde o aviso de risco
     * se cala. Se ele marcar sem esperar, o iPhone perde a unica protecao que
     * o app tem. */
    const fs = require('fs');
    const ajustes = fs.readFileSync(path.join(RAIZ, 'js/views/ajustes.js'), 'utf8');
    const corpo = /function exportar\(\)[\s\S]*?\n {2}\}/.exec(ajustes);
    ok(!!corpo, 'a funcao exportar existe e da para ser lida');
    if (corpo) {
      const f = corpo[0];
      ok(/U\.download\([\s\S]*?\)\s*\.then/.test(f),
        'exportar espera o resultado do download antes de fazer qualquer coisa');
      ok(!/U\.download\([^)]*\)\s*;\s*\n\s*(const|let|if|UI)/.test(f),
        'e nao segue o download com nada: nada acontece enquanto ele nao responde');
      ok(/marcarBackup\(\)/.test(f), 'a data do backup so e gravada por uma funcao com nome proprio');
      ok(/acao:\s*function/.test(f),
        'no caminho da partilha, ha um botao para a pessoa confirmar que guardou');
      /* "Backup salvo" PODE aparecer no caminho do ancor: la o navegador pegou o
       * arquivo de verdade. O que nao pode e aparecer ANTES da resposta — a
       * versao antiga nem tinha `.then`, e a frase saia na mesma linha do
       * `download`.
       *
       * A primeira versao deste teste procurava a frase antes do `acao:`, e
       * acusou o codigo certo: no caminho do ancor a frase e verdadeira e
       * obrigatoria. O que conta e a posicao em relacao ao `.then`. */
      ok(f.indexOf('.then(') >= 0 && f.indexOf('Backup salvo') > f.indexOf('.then('),
        'a frase "Backup salvo" so vem DEPOIS que o download respondeu');
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
  console.log('='.repeat(50) + '\n');
  process.exit(falhou ? 1 : 0);
})().catch(function (e) {
  console.error('\nO TESTE QUEBROU:');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
