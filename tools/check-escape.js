/* =========================================================
   tools/check-escape.js
   Texto do usuario nao vira codigo. Em nenhum lugar.

   POR QUE ESTE ARQUIVO EXISTE

   Este nao nasceu de um defeito. Nasceu de uma AUDITORIA, feita a mao, que
   passou por todos os lugares onde texto de fora entra no app:

     - o `innerHTML` da impressao;
     - o `.ics` que a pessoa importa no calendario dela;
     - as `data:` URL das fotos;
     - o `window.open` das consultas;
     - o `blob:` do download;
     - o `el()`, que monta o DOM inteiro.

   O resultado da auditoria: nao havia brecha. `U.esc` escapa os cinco
   caracteres, o `el()` transforma string em no de texto, o `.ics` escapa
   campo por campo, e a foto em SVG e recusada — que e a unica forma de data URL
   que executa script.

   E "nao havia brecha" e exatamente o que se esquece. Nenhum desses pontos tem
   aviso: amanha alguem acrescenta uma coluna na tabela da impressa e esquece do
   `esc`, e o titulo de uma musica passa a ser interpreted como HTML. Como o
   app nao tem servidor e nao mostra conteudo de terceiros, o titulo vem da
   propria pessoa — o que significa que o ataque seria de alguem para a propria
   pessoa, e nao apareceria em nenhum log.

   POR QUE ISTO E SEPARADO DO `check-seguranca`

   O `check-seguranca` procura coisas que NAO DEVEM EXISTIR: `eval`, `new
   Function`, `document.write`, `postMessage`. E a lista do que este app nao
   tem.

   Este verifica coisa oposta: que uma coisa que DEVE EXISTIR — a funcao de
   escapar — continue completa e continue sendo usada onde precisa. O
   `check-seguranca` passa com `esc()` faltando num lugar; este nao.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');

let passou = 0;
let falhou = 0;
const problemas = [];
function ok(cond, titulo, porque) {
  if (cond) { passou++; console.log('  ok    ' + titulo); }
  else {
    falhou++;
    problemas.push(titulo);
    console.log('  FALHA ' + titulo);
    if (porque) console.log('        ' + porque);
  }
}
function secao(t) { console.log('\n=== ' + t + ' ==='); }

function arquivosDe(dir, filtro) {
  const saida = [];
  (function anda(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) anda(q);
      else if (filtro(q)) saida.push(q);
    }
  })(dir);
  return saida;
}

const JS = arquivosDe(path.join(RAIZ, 'js'), (q) => q.endsWith('.js'));
const fonte = {};
for (const arq of JS) {
  fonte[arq] = fs.readFileSync(arq, 'utf8');
}

/** O codigo sem comentarios: uma tag dentro de um comentario nao e HTML. */
function semComentario(txt) {
  let fora = '';
  let estado = 0;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    const d = txt[i + 1];
    if (estado === 1) { if (c === '\n') { estado = 0; fora += c; } else { fora += ' '; } continue; }
    if (estado === 2) {
      if (c === '*' && d === '/') { estado = 0; i++; fora += '  '; continue; }
      fora += c === '\n' ? '\n' : ' ';
      continue;
    }
    if (c === '/' && d === '/') { estado = 1; fora += '  '; i++; continue; }
    if (c === '/' && d === '*') { estado = 2; fora += '  '; i++; continue; }
    fora += c;
  }
  return fora;
}

const rel = (arq) => path.relative(RAIZ, arq).replace(/\\/g, '/');
const linhaDe = (txt, pos) => txt.slice(0, pos).split('\n').length;

/* ------------------------------------------------------------------ */
secao('1. A funcao de escapar escapa tudo');

/* Os cinco sao o minimo. Faltando as aspas, um titulo com um `"` dentro de
 * `alt="..."` fecha o atributo e o resto vira atributo novo — e e por isso que
 * `&quot;` e `&#39;` estao aqui e nao so `&lt;` e `&gt;`. */
{
  const utils = fonte[path.join(RAIZ, 'js', 'core', 'utils.js')];
  const i = utils.indexOf('function esc(');
  ok(i >= 0, 'a funcao esc() existe em utils.js', i < 0 ? 'nao achei' : '');
  const corpo = utils.slice(i, i + 320);

  for (const [re, nome] of [[/&/g, '"&"'], [/</g, '"<"'], [/>/g, '">"'],
    [/"/g, '"\""'], [/'/g, '"\'"']]) {
    const achado = new RegExp('replace\\(/' + re.source.replace('/', '') + '/g,') .test(corpo);
    // O `&` precisa vir PRIMEIRO, senao `&lt;` vira `&amp;lt;` e o texto
    // aparece com o codigo a vista na tela.
    ok(achado, 'esc() troca ' + nome);
  }

  const ordemDe = corpo.indexOf('&amp;');
  const ordem_lt = corpo.indexOf('&lt;');
  const ordemGt = corpo.indexOf('&gt;');
  const ordemQ = corpo.indexOf('&quot;');
  const ordemA = corpo.indexOf('&#39;');
  ok(ordemDe >= 0 && ordemDe < ordem_lt && ordemDe < ordemGt,
    'e o "&" e escapado primeiro de todos',
    'posicoes ' + [ordemDe, ordem_lt, ordemGt].join(', '));
  ok(ordemQ > 0 && ordemA > 0, 'e as duas aspas tambem sao trocadas',
    'aspas ' + ordemQ + ' e ' + ordemA);
}

/* ------------------------------------------------------------------ */
secao('2. Nenhum texto solto entra num atributo com aspas');

/* Esta e a regra que pega o defeito real. Uma linha que costura HTML tem de
 * envolver a variavel em `esc(...)`. Sem isso, um titulo com uma aspa fecha o
 * atributo e o resto da linha vira atributo — e nenhuma tela mostra erro. */
{
  /* As variaveis que JA sao HTML escapado e entram Crus.
   *
   * Ha um caso legitimo: um fragmento montado antes, campo por campo, cada um
   * passando por `esc()`. `corpoHtml` em `share.js` e um deles — a lista de
   * musicas da escala, montada nas linhas de cima, onde nome, responsavel e
   * observacao vao todos por `U.esc`.
   *
   * A excecao esta DECLARADA aqui, com nome e motivo, em vez de estar escondida
   * dentro de um padrao que ninguem vai ler. Quem acrescentar uma variavel
   * nova nesse lugar tem de vir ate aqui, e a lista mostra o que foi
   * sem esc(). Uma lista que cresce sozinha e uma lista que ninguem
   * atualizou. */
  const ESCAPADOS = {
    corpoHtml: 'share.js monta a lista de musicas com U.esc em cada campo antes',
  };

  /* Os campos que GUARDAM O QUE A PESSOA ESCREVEU. Nomes de titulo, artista,
   * letra, observacao, local, categoria, responsavel — e o que sai do
   * formulario e do backup.
   *
   * A regra nao tenta adivinhar "isto e texto ou ja e HTML". Ela procura o
   * defeito REAL: um destes nomes, numa linha que monta HTML, sem `esc(` antes.
   *
   * A primeira versao fazia o contrario — contava identificadores colados ao
   * `+` — e tinha duas falhas: nao pegava `(m.categoria || '')` depois de um
   * `+`, e acusava metade das linhas de HTML. Direcionar pelo NOME do dado e o
   * que faz a regra ter preco e nao so barulho. */
  const CAMPOS = [
    '.titulo', '.artista', '.letra', '.cifra', '.obs', '.local',
    '.categoria', '.responsavel', '.nome', '.notas', '.letraCifra',
  ];

  /* O limite de palavra importa: sem ele, `.cifra` casa dentro de `.cifraId`,
   * e a regra passa a accuse uma linha de `filter` que nao monta HTML nenhuma. */
  const RE_CAMPO = new RegExp(CAMPOS.map((c) => c.replace('.', '\\.') + '\\b').join('|'), 'g');

  const achados = [];
  for (const arq of JS) {
    const codigo = semComentario(fonte[arq]);
    const NLc = String.fromCharCode(10);
    const linhas = codigo.split(NLc);

    RE_CAMPO.lastIndex = 0;
    let m;
    while ((m = RE_CAMPO.exec(codigo)) !== null) {
      const pos = m.index;
      const linhaNum = codigo.slice(0, pos).split(NLc).length;

      /* A linha que monta HTML e a atual ou a ANTERIOR — a anterior porque
       * `body += '<div ...>'` numa linha e `+ esc(e.obs)` na seguinte e o
       * formato normal deste arquivo.
       *
       * Uma janela de 160 caracteres atravessava tres linhas e acusava o
       * `filter` de duas linhas abaixo de um `<div>` que nao tem nada a ver. */
      const atual = linhas[linhaNum - 1] || '';
      const anterior = linhas[linhaNum - 2] || '';
      const montaHtml = /['"`][^'"`]*<[a-zA-Z\/][^'"`]*['"`]/.test(atual)
        || /['"`][^'"`]*<[a-zA-Z\/][^'"`]*['"`]/.test(anterior)
        || /['"`]\s*\+\s*U\.esc\(/.test(atual) || /['"`]\s*\+\s*esc\(/.test(atual);
      if (!montaHtml) continue;

      /* Posicao de CONDICAO nao e saida.
       *
       * `e.obs ? '<p>' + U.esc(e.obs) + '</p>' : ''` tem o campo duas vezes: uma
       * no teste do ternario e outra dentro do `esc`. A primeira nao vira HTML
       * — ela decide qual dos dois ramos entra. `if (c.letra) ...` e o mesmo
       * caso.
       *
       * Sem esta exclusao a regra acusa quatro linhas CORRETAS, e uma regra que
       * acusa codigo certo e uma regra que a pessoa desliga. */
      const depois = codigo.slice(pos + m[0].length).replace(/^\s*/, '');
      if (depois.indexOf('?') === 0) continue;
      const antes = codigo.slice(Math.max(0, pos - 12), pos);
      /* `if (c.letra)`: o abre-parentese vem ANTES do nome, entao a checagem
       * tem de olhar o que esta antes do `(`, e nao o que esta antes do campo.
       * A primeira versao procurava `if (` no fim da janela e nao achava,
       * porque o nome da variavel esta no meio. */
      const abre = antes.lastIndexOf('(');
      if (abre >= 0 && /^\s*\)\s/.test(depois)) {
        const comando = antes.slice(0, abre).trim().split(/\s+/).pop() || '';
        if (/^(if|while|switch)$/.test(comando)) continue;
      }
      const antesLimpo = antes.trim();
      if (/(&&|\|\||!|=)\s*$/.test(antesLimpo)) continue;

      /* Anda para tras por TODOS os grupos que envolvem o campo, e pergunta se
       * ALGUM deles e um `esc(`. Nao so o mais interno.
       *
       * Sao tres formas, e as tres existem neste arquivo:
       *
       *   U.esc(m.nome)                  o esc vem DEPOIS do campo
       *   esc(m.categoria || '')         o campo e o primeiro argumento
       *   esc(porTom[t].map(m => m.nome))  o esc e o grupo EXTERNO
       *
       * Uma janela de texto nao da conta para nenhuma das tres. E verificar so
       * o grupo mais interno acusa as duas ultimas. As tres apareceram em
       * codigo que estava certo, e acertar codigo certo e o jeito mais rapido
       * de uma regra ser ignorada. */
      let profundidade = 0;
      let dentro = false;
      for (let k = pos - 1; k >= 0 && !dentro; k--) {
        const c = codigo[k];
        if (c === ')') { profundidade++; continue; }
        if (c !== '(') continue;
        if (profundidade === 0) {
          const nome = codigo.slice(Math.max(0, k - 12), k).trim();
          if (/(^|[^\w$])esc$/.test(nome)) dentro = true;
          // O grupo mais interno ja foi avaliado; um `esc(` mais externo ainda
          // conta, entao o laco continua.
        } else {
          profundidade--;
        }
      }
      if (!dentro) achados.push({ rel: rel(arq), linha: linhaNum, campo: m[0] });
    }
  }
  ok(achados.length === 0,
    'nenhum campo que a pessoa escreveu entra num HTML sem esc()',
    achados.slice(0, 8).map((a) => a.rel + ':' + a.linha + ' -> ' + a.campo).join(' | '));

  /* A lista de excecoes e curta de proposito, e cada item precisa de motivo. */
  const semMotivo = Object.keys(ESCAPADOS).filter((k) => !ESCAPADOS[k]);
  ok(semMotivo.length === 0,
    'toda excecao declarada tem motivo escrito',
    semMotivo.join(', '));
  ok(Object.keys(ESCAPADOS).length <= 4,
    'e a lista de excecoes continua curta',
    Object.keys(ESCAPADOS).length + ' excecao(oes) — acima de quatro, a regra nao esta mais segurando');
}

/* ------------------------------------------------------------------ */
secao('3. O .ics escapa de verdade, e nao no papel');

/* O calendário da pessoa e o lugar onde o estrago e invisivel: um arquivo .ics
 * com um titulo quebrado nao da erro, ele simplesmente nao abre — e a pessoa
 * perde a escala que ela tinha acabado de marcar.
 *
 * ESTA REGRA EXECUTA A FUNCAO. A versao anterior contava barras no codigo-fonte,
 * e errou feio: `JSON.stringify` duplica cada barra invertida, e contar a saida
 * do stringify como se fosse o texto cru fez eu "concluir" que o `\\` estava
 * trocando quatro barras quando troca duas — que e o comportamento CORRETO de
 * um arquivo .ics.
 *
 * Ler o codigo e adivinhar o que ele faz foi a origem do erro. Rodar e ver o
 * que sai nao tem como errar. */
{
  const share = fonte[path.join(RAIZ, 'js', 'core', 'share.js')];
  const BR = String.fromCharCode(92);
  const NLc = String.fromCharCode(10);

  const ini = share.indexOf('function esc(s) {');
  ok(ini >= 0, 'o .ics tem funcao de escapar', 'nao achei `function esc(s)` em share.js');

  if (ini >= 0) {
    const fim = share.indexOf(NLc + '  }', ini) + (NLc + '  }').length;
    const corpo = share.slice(ini, fim);

    let saida = null;
    try {
      const ctx = { String: String };
      vm.createContext(ctx);
      vm.runInContext(corpo + NLc + ';globalThis.f = esc;', ctx);
      saida = ctx.f;
    } catch (e) {
      saida = null;
      ok(false, 'a funcao esc() do .ics pode ser executada', 'lançou ' + e.message);
    }

    if (saida) {
      /* Cada caso e um caractere que, solto, quebra o arquivo. O esperado e o
       * texto que o .ics precisa: a barra do escape + o caractere.
       *
       * O CR solto vira `\\n` e nao `\\r` porque `.ics` nao tem escape de CR:
       * os quatro validos sao `\\\\`, `\;`, `\,` e `\\n`. Um CR solto e uma
       * quebra de linha, entao a saida correta e a MESMA de um LF. A primeira
       * versao deste teste esperava `\\r` e acusou o codigo de errado. */
      const CASOS = [
        { nome: 'a barra invertida', entra: 'a' + BR + 'b', sai: 'a' + BR + BR + 'b' },
        { nome: 'o ponto e virgula', entra: 'a;b', sai: 'a' + BR + ';b' },
        { nome: 'a virgula', entra: 'a,b', sai: 'a' + BR + ',b' },
        { nome: 'a quebra de linha', entra: 'a' + NLc + 'b', sai: 'a' + BR + 'nb' },
        { nome: 'o carriage return sozinho', entra: 'a' + String.fromCharCode(13) + 'b', sai: 'a' + BR + 'nb' },
      ];
      for (const c of CASOS) {
        const obtido = saida(c.entra);
        ok(obtido === c.sai,
          'o .ics escapa ' + c.nome + ' do jeito certo',
          'entrou ' + JSON.stringify(c.entra) + ', saiu ' + JSON.stringify(obtido)
          + ', e o certo era ' + JSON.stringify(c.sai));
      }

      /* E o mais importante: nenhuma saida pode conter uma quebra de linha de
       * verdade. Uma unica basta para o arquivo inteiro ser recusado. */
      let quebrou = null;
      for (const c of CASOS) {
        const obtido = saida(c.entra);
        if (obtido.indexOf(NLc) >= 0) quebrou = c.nome;
      }
      ok(!quebrou, 'e nenhuma saida tem quebra de linha de verdade',
        quebrou ? 'o caso "' + quebrou + '" deixou uma' : '');

      /* Texto normal nao pode ser alterado: escapar demais tambem e defeito,
       * porque o titulo aparece com barra e virgula na tela. */
      const limpo = saida('O Senhor e o Meu Pastor');
      ok(limpo === 'O Senhor e o Meu Pastor',
        'e um titulo sem caractere especial sai intacto', JSON.stringify(limpo));
    }
  }

  // Todo campo de texto do VEVENT passa por esc.
  //
  // A janela e POSICIONAL e para no fim do elemento do array, e nao 60
  // caracteres soltos. Com uma janela de tamanho fixo, `'SUMMARY:' + e.titulo,`
  // achava o `esc(` do LOCATION na linha seguinte e passava — que e
  // exatamente o defeito que a regra existe para pegar.
  const campos = ['SUMMARY:', 'LOCATION:', 'DESCRIPTION:'];
  for (const campo of campos) {
    let quantas = 0;
    const semEsc = [];
    let n = share.indexOf(campo);
    while (n >= 0) {
      quantas++;
      // O elemento vai ate a proxima linha que comeca com aspas: e ali que
      // comeca o proximo item da lista.
      const resto = share.slice(n + campo.length);
      const fim = resto.search(/\n\s*'/);
      const elemento = resto.slice(0, fim < 0 ? resto.length : fim);
      if (elemento.indexOf('esc(') < 0) semEsc.push(campo);
      n = share.indexOf(campo, n + campo.length);
    }
    ok(quantas > 0 && semEsc.length === 0,
      'todo ' + campo.replace(':', '') + ' do evento passa por esc()',
      semEsc.length + ' de ' + quantas + ' sem esc(): ' + semEsc.join(', '));
  }

  /* E a lista de musicas, que e o campo mais cheio e o mais facil de esquecer:
   * ela entra colada, com nome e tom, e so e segura porque a expressao INTEIRA
   * esta dentro do esc(). */
  ok(/DESCRIPTION:'\s*\+\s*esc\(/.test(share) || /'DESCRIPTION:' \+ esc\(/.test(share),
    'a lista de musicas do .ics entra dentro do esc()',
    'o esc() tem de envolver a expressao inteira, e nao cada pedaco');
}

/* ------------------------------------------------------------------ */
secao('4. Foto e data URL: SVG nao entra');

/* A unica forma de data URL que executa script e o SVG. Uma foto de ensaio
 * nunca e SVG, entao recusar SVG nao custa nada e fecha o caminho. */
{
  const store = fonte[path.join(RAIZ, 'js', 'core', 'store.js')];
  ok(/FOTOS_OK\s*=\s*\/\^data:image\\\/\(png\|jpeg\|jpg\|webp\|gif\)/i.test(store),
    'o filtro de foto aceita so imagem de bitmap');
  ok(!/svg/i.test((store.match(/FOTOS_OK[^\n]*/) || [''])[0]),
    'e nao aceita SVG, que e a data URL que executa script',
    (store.match(/FOTOS_OK[^\n]*/) || [''])[0]);
  ok(/data:audio\//.test(store), 'e o audio so entra como data URL de audio',
    'um `javascript:` aqui viraria script ao ser usado como src');
}

/* ------------------------------------------------------------------ */
secao('5. Abrir aba nova nao entrega o window.opener');

/* Sem `noopener`, a aba nova mexe em `window.opener` — e a aba nova e um site
 * de terceiro, aqui uma busca no YouTube. */
{
  for (const arq of JS) {
    const codigo = semComentario(fonte[arq]);
    if (codigo.indexOf('window.open') < 0) continue;
    const L = codigo.split('\n');
    L.forEach((linha, i) => {
      if (!/window\.open/.test(linha)) return;
      ok(/noopener/.test(linha) || /noreferrer/.test(linha),
        rel(arq) + ':' + (i + 1) + ': window.open com noopener',
        'sem isso a aba nova mexe no app de origem');
    });
  }
  let total = 0;
  for (const arq of JS) total += (fonte[arq].match(/window\.open/g) || []).length;
  ok(total > 0, 'e o app abre aba nova mesmo (' + total + ' lugar(es)) — a regra nao esta vazia');
}

/* ------------------------------------------------------------------ */
secao('6. O blob do download vive tempo suficiente');

/* Revogar em 100 ms era o prazo do download, e o download nao termina em
 * 100 ms: em rede de telefone, nao termina nem em dez segundos. O arquivo
 * chegava pela metade. */
{
  const utils = fonte[path.join(RAIZ, 'js', 'core', 'utils.js')];
  const revogas = utils.match(/revokeObjectURL/g) || [];
  ok(revogas.length > 0, 'o blob e revogado em algum momento', revogas.length + ' chamada(s)');

  /* O atraso do `setTimeout` que revoga.
   *
   * A primeira versao procurava `.{160}revokeObjectURL` — e o ponto NAO casa
   * com quebra de linha. O atraso esta na linha de cima, entao a janela nunca
   * existia, a lista ficava vazia e a regra passava com `100` no lugar de
   * `60000`. Um verificador que nunca olha e um verificador que nunca falha:
   * os dois dão a mesma sensacao e nenhum dos dois serve. */
  const BR = String.fromCharCode(92);
  const n = String.fromCharCode(10);
  /* Sem comentario. O arquivo DESCREVE o defeito antigo em prosa — "a versao
   * anterior era esta: setTimeout(() => URL.revokeObjectURL(url), 100)" — e a
   * regra lia essa prosa como se fosse codigo, e acusava o app de revogar em
   * 100 ms. A versao boa estava no codigo, a versao ruim estava na explicacao. */
  const partes = semComentario(utils).split(n);

  /* O prazo fica NO FIM do bloco, e nao na linha do `setTimeout`:
   *
   *     setTimeout(function () {
   *       ...
   *       URL.revokeObjectURL(url);
   *     }, 60000);
   *
   * A primeira versao desta regra olhava para TRAS do `revokeObjectURL` e nunca
   * achou o prazo — ela nao achava porque ele esta depois, e nao antes. Uma
   * regra que nao ve nada passa com `100` no lugar de `60000`. */
  const prazos = [];
  for (let i = 0; i < partes.length; i++) {
    if (partes[i].indexOf('setTimeout') < 0) continue;
    const bloco = partes.slice(i, i + 8).join(n);
    if (bloco.indexOf('revokeObjectURL') < 0) continue;
    const ms = bloco.match(/\},\s*(\d{1,7})\s*\)/);
    if (ms) prazos.push({ linha: i + 1, ms: Number(ms[1]) });
  }

  ok(prazos.length > 0, 'e o prazo da revogacao foi encontrado',
    'nenhum setTimeout com revokeObjectURL dentro — a regra esta olhando para o lado errado');
  const rapidas = prazos.filter((r) => r.ms < 2000);
  ok(rapidas.length === 0,
    'e nunca e revogado em menos de dois segundos',
    rapidas.map((r) => 'linha ' + r.linha + ': ' + r.ms + ' ms').join(', ')
    + ' | encontrados: ' + prazos.map((r) => r.ms + ' ms').join(', '));
  void BR;
}

/* ------------------------------------------------------------------ */
secao('7. O que este app NAO tem');

/* A lista do que nao existe. Cada linha aqui e uma porta fechada, e a lista so
 * tem valor enquanto estiver vazia de pertencias. */
{
  const naoTem = [
    ['eval ou new Function', /(^|[^.\w])eval\s*\(|new\s+Function\s*\(/],
    ['document.write', /document\.write\s*\(/],
    /* `postMessage` nao e proibido em si: e proibido o uso que VAZA DADO.
     *
     * A proibicao geral era `postMessage\s*\(`, e ela barrou uma coisa legitima
     * que o app passou a fazer: a pagina mandar uma ordem para o service worker
     * que esta esperando. Nao existe outra via — nem `fetch`, nem evento, nem
     * outra API do padrao chega num worker instalado. Sem essa ordem, o worker
     * novo nunca assume e o app continua servindo a versao antiga para sempre.
     *
     * Entao o que vale proibir sao as DUAS formas que vazam:
     *
     *   1. mandar para OUTRA JANELA (`window`, `parent`, `opener`, `top`,
     *      `frames`) — quem abriu a aba recebe o conteudo;
     *   2. mandar sem conferir a origem de destino (`'*'`) — qualquer pagina
     * *      que estiver esperando no caminho recebe a mensagem.
     *
     * As duas valem para a pagina E para o worker. O que nao vale e o medo do
     * `postMessage` em si: e o unico canal com o proprio worker, e o worker
     * confere `ev.origin` antes de obedecer — regra do `check-seguranca`,
     * conferida arquivo a arquivo. */
    ['postMessage para outra janela',
      /\b(?:window|parent|opener|top|frames)\s*\.\s*postMessage\s*\(/],
    ['postMessage para origem qualquer',
      /postMessage\s*\([^)]*['"]\*['"]/],
    ['execCommand com texto do usuario', /execCommand\((?!['"]copy)/],
    ['setTimeout com string', /setTimeout\s*\(\s*['"]/],
    ['importacao dinamica de script', /importScripts\s*\(/],
    ['document.write de origem externa', /outerHTML\s*=\s*(?!['"]{2})/],
  ];
  for (const [nome, re, excecao] of naoTem) {
    const achados = [];
    for (const arq of JS) {
      /* A excecao e por ARQUIVO, e o `testar` diz se ela cobre este. Uma
       * excecao sem motivo e um buraco; um motivo sem excecao que o exercite e
       * uma regra que ninguem testou. */
      if (excecao && excecao.test(arq)) continue;
      const codigo = semComentario(fonte[arq]);
      const L = codigo.split('\n');
      L.forEach((linha, i) => {
        if (re.test(linha)) achados.push(rel(arq) + ':' + (i + 1) + ' -> ' + linha.trim().slice(0, 60));
      });
    }
    ok(achados.length === 0, 'o app nao usa ' + nome, achados.slice(0, 3).join(' | '));
  }
}

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(54));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  Nenhum desses erros apareceria em log. Um titulo de musica com uma');
  console.log('  aspa fecha o atributo e vira atributo novo; um .ics quebrado nao da');
  console.log('  erro, ele simplesmente nao abre — e a pessoa perde a escala.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(54) + '\n');
process.exit(falhou ? 1 : 0);