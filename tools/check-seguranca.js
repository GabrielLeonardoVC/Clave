/* =========================================================
   ACORDE - tools/check-seguranca.js
   O que o app aceita do mundo de fora.

   O app nao tem servidor, nao tem login, nao tem banco e nao manda nada para
   lugar nenhum. Isso nao e sorte: e o que permite dizer "os dados ficam no
   aparelho" sem medo. Este arquivo existe para manter essa frase verdadeira.

   ELE E UM VERIFICADOR DE LEITURA. Ele ve o texto, nao o comportamento. Por
   isso ele aponta so o que o texto mostra, e o `test-seguranca` prova que ele
   accuse de verdade.

   ---------------------------------------------------------
   A DISTINCAO QUE MUDA TUDO

   Nem toda URL e igual, e tratar todas como iguais foi o que fez a primeira
   versao deste arquivo acusar 26 coisas e nenhuma ser problema. Sao quatro
   categorias, e cada uma tem regra propria:

     CARREGADO   — o app BUSCA o endereco: `<script src>`, `<link href>`,
                   `import()`. Aqui o app entrega controle a quem publica
                   aquele endereco. Endereco novo e decisao nova.

     EMBUTIDO    — o app vira endereco com o que a pessoa escreveu. Aqui o
                   risco real: backup adulterado, link colado errado. O id tem
                   de ser conferido e codificado.

     OFERECIDO   — o app mostra um link para a pessoa abrir numa aba nova.
                   Nao e uma decisao de seguranca, e sim de produto: onde buscar
                   letra. Aparece no relatorio, nunca como falha.

     IDENTIFICADOR— o endereco nomeia um padrao, nao e destino. O namespace de
                   SVG e um identificador, nao uma viagem ao w3.org.

   Eram quatro categorias e uma regra unica. A regra unica acusava tudo e nao
   explicava nada.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

/* ---------------------------------------------------------
   As listas. Um destino fora daqui e uma decisao nova — e decisao nova merece
   uma linha nova aqui, com o por que.
   --------------------------------------------------------- */

const CARREGADOS = {
  'cdn.jsdelivr.net': 'three.js pelo CDN, com versao fixada',
  'unpkg.com': 'three.js pelo CDN, com versao fixada',
  'fonts.googleapis.com': 'fonte do texto',
  'fonts.gstatic.com': 'arquivo da fonte do texto',
  'www.youtube.com': 'API do player, que so a tela de video usa',
};

const EMBUTIDOS = {
  'www.youtube-nocookie.com': 'embed do video, com id validado e codificado',
};

const IDENTIFICADORES = {
  'www.w3.org': 'namespace de SVG. E um nome, nao um destino',
};

let problemas = 0;

function falhar(msg) {
  console.log('  FALHA  ' + msg);
  problemas++;
}

/** Confere uma condicao e ja anota o problema.
 *
 * Existe por causa de um erro que este arquivo cometeu tres vezes: imprimir
 * `'  FALHA  '` dentro de um ternario, sem passar por `falhar`. A linha
 * accusava, a tela mostrava FALHA, e `problemas` continuava zero — o processo
 * saia com 0 e o `npm run verificar` passava. Um verificador que falha sem
 * falhar e pior do que um verificador ausente: da a sensacao de que olha.
 *
 * Aqui, printing e contar sao o mesmo gesto. Nao ha como acusar de graca. */
function conferir(cumpre, nome, porQue) {
  if (cumpre) {
    console.log('  ok    ' + nome);
    return true;
  }
  falhar(nome);
  if (porQue) console.log('        ' + porQue);
  return false;
}

/* ---------------------------------------------------------
   Os arquivos: `js/`, mais `index.html` e `sw.js`.
   --------------------------------------------------------- */

const alvos = [];

(function anda(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) anda(p);
    else if (e.name.endsWith('.js')) alvos.push(p);
  }
})(path.join(RAIZ, 'js'));

for (const nome of ['index.html', 'sw.js']) {
  const p = path.join(RAIZ, nome);
  if (fs.existsSync(p)) alvos.push(p);
}

const rel = (a) => path.relative(RAIZ, a).split(path.sep).join('/');

/* Uma linha de codigo: nem comentario, nem dentro de string de URL. */
function linhaDeCodigo(l) {
  const t = l.trim();
  return t.length > 0 && !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*');
}

/* ---------------------------------------------------------
   1. Os padroes que nao tem conversa.
   --------------------------------------------------------- */

console.log('=== o que o app aceita do mundo de fora ===');
console.log('  ' + alvos.length + ' arquivo(s) lido(s)');

const REGRAS = [
  {
    nome: 'codigo que se monta sozinho',
    re: /(^|[^.\w])(eval\s*\(|new\s+Function\s*\()/,
    porQue: 'executa texto como codigo. Quem escreve a string manda no app.',
  },
  {
    nome: 'HTML escrito a mao no no',
    re: /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML\s*\(/,
    porQue: 'o navegador interpreta o que for escrito. Dado de fora vira script.',
    /* Duas folgas, e as duas por motivo:
     *
     * 1. ATRIBUICAO VAZIA e so apagar o no (`area.innerHTML = ''`). Nao
     *    interpreta nada. A folga e para QUALQUER posicao da linha, e nao so
     *    no fim: `const done = () => { area.innerHTML = ''; ... }` tem a
     *    atribuicao no meio da linha, e a versao anterior acusava essa linha.
     *
     * 2. `UI.print` escreve no no de impressao a folha montada como texto. E o
     *    unico uso legitimo, e ele e necessario: a folha e mesmo uma string. O
     *    que garante a seguranca dele nao e este arquivo, e sim `print.js`,
     *    `share.js` e `repertorio.js` escaparem cada valor — o que a regra
     *    seguinte confere, arquivo por arquivo. */
    ok: (t) => /\.(innerHTML|outerHTML)\s*=\s*(''|"")/.test(t)
      || /insertAdjacentHTML\s*\(\s*(['"])\1/.test(t)
      || /area\.innerHTML\s*=\s*[A-Za-z_$]/.test(t),
  },
  {
    nome: 'mensagem sem conferir a origem',
    re: /\.addEventListener\s*\(\s*['"]message['"]/,
    porQue: 'qualquer aba pode mandar mensagem. Sem comparar `event.origin`, o '
      + 'app obedece a quem abrir.',
    /* A forma segura e comparar `event.origin` com a origem do proprio app — e
     * essa comparacao NAO fica na mesma linha do registro: ela vai no corpo do
     * ouvinte, porque e la que o `event` existe. Uma regra que so aceitasse a
     * forma de uma linha so estaria proibindo a forma correta e aceitando a
     * errada, que e o pior dos dois mundos.
     *
     * A janela vai ate o proximo registro de ouvinte: e o alcance do bloco, e
     * nao o arquivo inteiro. E preciso parar ali — sem parar, um `message` sem
     * guarda no fim do arquivo seria absolvido pela guarda de outro, que e
     * exatamente o defeito que a regra existe para pegar. */
    precisaDe: /\borigin\b[^\n]*\b(?:self\.)?location\.origin\b|\b(?:self\.)?location\.origin\b[^\n]*\borigin\b/,
    janela: 8,
  },
  {
    nome: 'aba nova com acesso a quem abriu',
    re: /target\s*=\s*['"]_blank['"]/,
    porQue: 'sem `rel="noopener"`, a aba nova mexe em `window.opener`.',
    precisaDe: /rel\s*=\s*['"][^'"]*noopener/,
  },
  {
    nome: 'endereco sem https',
    re: /http:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org)/,
    porQue: 'trafego em claro. Alguem no caminho pode trocar o que chega.',
  },
];

for (const regra of REGRAS) {
  const achados = [];
  for (const arq of alvos) {
    const linhas = fs.readFileSync(arq, 'utf8').split('\n');
    linhas.forEach((l, i) => {
      if (!linhaDeCodigo(l)) return;
      if (!regra.re.test(l)) return;
      if (regra.ok && regra.ok(l.trim())) return;
      if (regra.precisaDe && regra.precisaDe.test(l)) return;
      /* A guarda pode estar nas linhas seguintes: e o corpo do ouvinte que a
       * contem, e e a-la que pertence. A janela para no proximo registro de
       * ouvinte — o alcance do bloco, e nao o arquivo inteiro. */
      if (regra.precisaDe && regra.janela) {
        for (let k = i + 1; k < Math.min(i + 1 + regra.janela, linhas.length); k++) {
          if (/addEventListener\s*\(/.test(linhas[k])) break;
          if (regra.precisaDe.test(linhas[k])) return;
        }
      }
      achados.push({ rel: rel(arq), linha: i + 1, texto: l.trim() });
    });
  }

  if (!achados.length) {
    console.log('  ok    ' + regra.nome);
    continue;
  }
  for (const a of achados) {
    falhar(regra.nome + '  ' + a.rel + ':' + a.linha);
    console.log('        ' + a.texto.slice(0, 92));
    console.log('        por que: ' + regra.porQue);
  }
}

/* ---------------------------------------------------------
   2. Onde cada URL esta.
   --------------------------------------------------------- */

console.log('\n=== para onde o app pode ir ===');

/* Endereco que o app CARREGA: aparece numa posicao que faz o navegador
 * buscar o recurso. */
const RE_CARREGA = /(<script[^>]*\ssrc\s*=|import\s*\(\s*['"`]|url\(\s*['"`]|new\s+script|\.src\s*=\s*['"`])/i;

/* URL construida com o que a pessoa escreveu. */
const RE_EMBUTIDO = /(embed\/|watch\?v=|src\s*[:=]\s*[A-Za-z_$])/;

const destinos = new Map();   /* host -> { onde: Set, carregado: bool } */

for (const arq of alvos) {
  fs.readFileSync(arq, 'utf8').split('\n').forEach((l, i) => {
    const re = /https?:\/\/([A-Za-z0-9._-]+)/g;
    let m = re.exec(l);
    while (m) {
      const host = m[1];
      if (!destinos.has(host)) destinos.set(host, { onde: new Set(), carregado: false, t: i + 1, rel: rel(arq) });
      const d = destinos.get(host);
      d.onde.add(rel(arq));
      if (RE_CARREGA.test(l)) d.carregado = true;
      m = re.exec(l);
    }
  });
}

const hosts = Array.from(destinos.keys()).sort();

const categorize = (h) => {
  if (CARREGADOS[h]) return 'carregado';
  if (EMBUTIDOS[h]) return 'embutido';
  if (IDENTIFICADORES[h]) return 'identificador';
  return null;
};

for (const h of hosts) {
  const d = destinos.get(h);
  const cat = categorize(h);

  if (cat === 'identificador') {
    console.log('  ok    ' + h.padEnd(26) + IDENTIFICADORES[h]);
    continue;
  }
  if (cat === 'carregado') {
    console.log('  ok    ' + h.padEnd(26) + 'CARREGADO  ' + CARREGADOS[h]);
    continue;
  }
  if (cat === 'embutido') {
    console.log('  ok    ' + h.padEnd(26) + 'EMBUTIDO   ' + EMBUTIDOS[h]);
    continue;
  }

  /* Sem categoria: ou e link oferecido (decisao de produto, so relatorio), ou
   * e destino carregado que ninguem aprovou (falha de verdade). */
  const carrega = d.carregado || RE_EMBUTIDO.test(Array.from(d.onde).join(' '));
  if (d.carregado) {
    falhar('destino CARREGADO nao autorizado: ' + h + '  (' + d.rel + ':' + d.t + ')');
    console.log('        o app busca este endereco, entao quem publica o controle o app.');
    console.log('        se o destino e legitimo, acrescente em CARREGADOS com o por que.');
  } else {
    console.log('  --    ' + h.padEnd(26) + 'OFERECIDO  link para a pessoa abrir, em '
      + Array.from(d.onde).join(', '));
  }
}

/* ---------------------------------------------------------
   3. O endereco embutido tem de ser conferido.
   --------------------------------------------------------- */

console.log('\n=== o video embutido e conferido antes de virar endereco ===');

/* Onde um id entra num endereco de embed: tem de estar codificado E validado. */
const arqLinks = path.join(RAIZ, 'js/core/links.js');
const arqStore = path.join(RAIZ, 'js/core/store.js');

const temValidacao = /\/\[A-Za-z0-9_-\]\{11\}\/|\^' \+ YT_ID \+ '\$/.test(
  fs.readFileSync(arqStore, 'utf8') + fs.readFileSync(arqLinks, 'utf8'));

conferir(temValidacao,
  'o id do video e conferido antes de virar endereco',
  'um backup adulterado com "ytId" viraria um embed apontando ao que a pessoa quiser.');

/* A codificacao e conferida nas linhas que constroem um ENDERECO de embed.
 *
 * Duas tentativas anteriores erraram aqui, e as duas teacham algo:
 *
 * 1. Procurar `encodeURIComponent` num trecho depois do nome da funcao acusou um
 *    codigo certo: a funcao tem cinco linhas de preparo entre o nome e o
 *    `return`, e a janela era menor que isso.
 *
 * 2. Contar toda linha com `/embed/` acusou o padrao de EXTRACAO
 *    (`new RegExp('/embed/(' + YT_ID + ')', 'i')`), que nao e um endereco e nao
 *    precisa de codificacao — `YT_ID` e uma classe de caracteres fixa.
 *
 * A distinguishing e o `https://`: a linha so conta se monta um endereco. */
const linhasDoEmbed = fs.readFileSync(arqLinks, 'utf8').split('\n')
  .filter((l) => /https?:\/\/[^'"]*\/embed\//.test(l) && linhaDeCodigo(l));
const codifica = linhasDoEmbed.length > 0
  && linhasDoEmbed.every((l) => /encodeURIComponent\s*\(/.test(l));

conferir(codifica,
  'o endereco do embed codifica o id  (' + linhasDoEmbed.length + ' endereco(s) de embed)',
  'sem `encodeURIComponent`, um id com caractere especial altera o caminho do endereco.');

/* Nenhuma tela pode montar o endereco do embed por conta propria. A regra mora
 * em um lugar so — duas copias divergem no primeiro ajuste.

 * A regra exige o endereco numa POSICAO DE ATRIBUICAO (`src:` ou `href=`). Sem
 * isso, ela acusava as tres mensagens de erro que explicam quais formatos o app
 * aceita — texto que fala sobre YouTube, e nao um endereco. Acusar a frase que
 * explica a regra faz o verificador gritar no lugar errado. */
const montandoPorFora = [];
for (const arq of alvos) {
  if (arq === arqLinks) continue;
  fs.readFileSync(arq, 'utf8').split('\n').forEach((l, i) => {
    if (!linhaDeCodigo(l)) return;
    if (!/(src|href)\s*[:=]\s*['"][^'"]*youtube(-nocookie)?\.com\/(embed|watch)/.test(l)) return;
    montandoPorFora.push({ rel: rel(arq), linha: i + 1, texto: l.trim() });
  });
}

if (montandoPorFora.length) {
  for (const a of montandoPorFora) {
    falhar('endereco do video montado fora do helper  ' + a.rel + ':' + a.linha);
    console.log('        ' + a.texto.slice(0, 88));
    console.log('        a regra do video precisa morar em um lugar so.');
  }
} else {
  console.log('  ok    nenhuma tela monta endereco de video por conta propria');
}

/* ---------------------------------------------------------
   4. A folha de impressao escapa o que interpola.

   `UI.print` aceita texto, entao a seguranca dela NAO esta no `print`: esta em
   quem monta a folha. Uma interpolacao esquecida de `esc()` entre titulo e
   letra e o caminho mais curto de um campo digitado virar script — e a folha de
   impressao e justamente onde o titulo, o artista, a letra e a observacao da
   pessoa aparecem juntos, sem nenhuma interface no meio para dar contexto.

   A regra e textual e porem ser burra: numa linha que constroi HTML, toda
   interpolacao que nao for numero nem parte de um elemento tem de estar dentro
   de `esc(`. Nao e prova de que o HTML fica certo. E prova de que ninguem
   connector um valor cru entre aspas de um atributo. */

console.log('\n=== a folha de impressao escapa o que interpola ===');

const FOLHAS = ['js/core/print.js', 'js/core/share.js', 'js/views/repertorio.js'];

/* Os campos que a pessoa digita. Sao estes que viram script se forem
 * concatenados crus dentro de uma aspas de atributo. Contar todos seria um
 * numero; contar estes diz o que importa.
 *
 * A flag `g` e obrigatoria, e nao um detalhe: sem ela, `exec` ignora
 * `lastIndex` e devolve a PRIMEIRA match para sempre. O laco que consome o
 * resultado acrescentava a mesma linha indefinidamente, e o verificador morria
 * de memoria — 2 GB de lista antes de reclamar. */
const CAMPOS_DE_DADO = /\.\s*(titulo|nome|artista|obs|letra|cifra|local|categoria|responsavel|foto|compositor|ano)\b/g;

/** Tira da linha tudo o que ja passou por `esc` ou `encodeURIComponent`.
 *
 * Nao pode ser regex simples. `esc([c.artista, c.tom].filter(Boolean).join('  -  '))`
 * tem parenteses aninhados, e um `[^)]*` para no primeiro `)` — sobrando um
 * pedaco com `c.tom` nu, que o verificador acusaria como falha de seguranca
 * num codigo que estava certo. Por isso a conta de parenteses e feita a mao.
 */
function semEsc(line) {
  let fora = '';
  let i = 0;
  while (i < line.length) {
    const inicio = line.slice(i).match(/^\s*(?:[A-Za-z_$][\w$.]*\s*\.\s*)?(esc|encodeURIComponent)\s*\(/);
    if (!inicio) { fora += line[i]; i++; continue; }

    // Anda ate o parenteses que fecha, contando profundidade.
    let prof = 0;
    let j = i + inicio[0].length - 1;
    for (; j < line.length; j++) {
      if (line[j] === '(') prof++;
      else if (line[j] === ')') { prof--; if (prof === 0) break; }
    }
    fora += 'ESC';
    i = j + 1;
  }
  return fora;
}

let folhasRuins = 0;

for (const nome of FOLHAS) {
  const caminho = path.join(RAIZ, nome);
  if (!fs.existsSync(caminho)) continue;
  const linhas = fs.readFileSync(caminho, 'utf8').split('\n');
  const suspeitas = [];

  linhas.forEach((l, i) => {
    if (!linhaDeCodigo(l)) return;
    // So interessa onde se monta HTML: precisa de uma tag na mesma linha.
    if (!/<[a-z][a-z0-9]*[\s>/]/.test(l)) return;

    const limpo = semEsc(l);
    CAMPOS_DE_DADO.lastIndex = 0;
    let m = CAMPOS_DE_DADO.exec(limpo);
    while (m) {
      /* So e falha se o campo estiver sendo INTERPOLADO. Duas coisas nao sao:
       *
       *  - precedido por `+`: e onde o valor entra na concatenacao. Um
       *    `if (c.letra)` so pergunta se o campo existe.
       *
       *  - seguido de `?`: e a CONDICAO do ternario, que decide se o pedaco
       *    entra ou nao. `m.obs ? '<br>' + U.esc(m.obs) : ''` tem o campo duas
       *    vezes: uma deciding, outra escapada. Acusar as duas e acusar codigo
       *    certo — e a versao anterior acusava exatamente essas quatro linhas.
       */
      const antes = limpo.slice(0, m.index);
      const depois = limpo.slice(m.index + m[0].length);
      const interpolando = /\+\s*[A-Za-z_$][\w$]*\s*$/.test(antes);
      const condicao = /^\s*\?/.test(depois);

      if (interpolando && !condicao) {
        suspeitas.push({
          linha: i + 1,
          campo: m[1],
          trecho: limpo.slice(Math.max(0, m.index - 14), m.index + 24),
        });
      }
      m = CAMPOS_DE_DADO.exec(limpo);
    }
  });

  if (!suspeitas.length) {
    console.log('  ok    ' + nome.padEnd(26) + 'todo campo digitado passa por esc()');
  } else {
    folhasRuins++;
    for (const s of suspeitas) {
      falhar('campo cru na folha  ' + nome + ':' + s.linha + '  .' + s.campo);
      console.log('        ...' + s.trecho.replace(/\n/g, ' ') + '...');
    }
    console.log('        campo cru entre aspas de atributo vira atributo novo.');
  }
}

/* ---------------------------------------------------------
   5. As promessas do app.
   --------------------------------------------------------- */

console.log('\n=== a promessa do app ===');

/* O `sw.js` usa `fetch` para responder a navegacao e guardar arquivo — e assim
 * que um app sem servidor funciona sem rede. Contar o service worker como
 * "chamada de rede do app" seria acusar o offline por existir. */
const semSw = alvos.filter((a) => rel(a) !== 'sw.js');
const TODO_APP = semSw.map((a) => fs.readFileSync(a, 'utf8')).join('\n');

const PROMETESSAS = [
  ['o app nao fala com ninguem', /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/,
    'nao ha servidor para onde falar. O unico fetch e o do service worker, que responde a quem abre o app.'],
  ['nenhuma chave guardada', /\b(apiKey|api_key|secretKey|accessToken)\b\s*[:=]\s*['"][^'"]+['"]/i,
    'sem chave nao ha conta, e sem conta nao ha dado de ninguem.'],
  ['o trabalho fica no aparelho', /localStorage/,
    'o trabalho da pessoa e guardado no aparelho dela.'],
];

for (const [nome, re, porQue] of PROMETESSAS) {
  const presente = re.test(TODO_APP);
  /* A promessa "o trabalho fica no aparelho" e o contrario das outras: ela e o
   * `localStorage` estar PRESENTE. Verificar que um recurso ausente nao
   * estraga a promessa e exigir que ele apareca sao coisas opostas, e a forma
   * delas e diferente. */
  const esperaPresente = nome.indexOf('fica no aparelho') >= 0;
  conferir(presente === esperaPresente, nome, porQue);
}

console.log('');
console.log('=================================================');
console.log(problemas
  ? problemas + ' coisa(s) para resolver'
  : 'o app so aceita o que precisa, e so fala com quem foi listado');
console.log('=================================================\n');
process.exit(problemas ? 1 : 0);
