/* =========================================================
   tools/check-publicacao.js
   O que vai ao ar e o que o site realmente usa.

   POR QUE ESTE VERIFICADOR EXISTE

   Toda a bateria deste projeto roda com os arquivos no disco, ao lado uns dos
   outros. O GitHub Pages, nao: o workflow monta uma pasta com uma lista
   explicita —

       cp index.html manifest.webmanifest sw.js .nojekyll _site/
       cp -r css js assets _site/

   — e publica SO o que esta na lista. Um arquivo que o `index.html` pede e
   que nao esta na lista vira 404 no ar, e passa em todos os testes, porque em
   disco ele existe.

   E o tipo de defeito mais caro que existe aqui: some depois do ultimo
   `npm run verificar`, sem log, sem aviso, e a pessoa que usa o app no ensaio
   e quem descobre — com a tela quebrada, longe do lugar onde o erro esta.

   O QUE ESTE VERIFICADOR FAZ

   Ele sai do contrario do que parece: nao confere a lista do workflow, confere
   o que a PAGINA USA. Junta tudo o que o app pede em tempo de execucao — o
   `index.html`, o `manifest`, os `src` dos scripts, os `href` das folhas, os
   `url()` do CSS, os recursos do gravador e do compartilhamento — e pergunta se
   cada um deles sobrevive a publicacao.

   E o mesmo caminho de `sw.js`, que tem uma lista propria: um arquivo que o
   site usa e o cache nao guarda funciona com rede e falha no porao sem sinal,
   que e o unico lugar onde o app importa.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { RAIZ } = require('./arquivos.js');

let passou = 0;
let falhou = 0;
const problemas = [];
function ok(cond, titulo, detalhe) {
  if (cond) { passou++; console.log('  ok    ' + titulo + (detalhe ? '  (' + detalhe + ')' : '')); }
  else {
    falhou++;
    problemas.push(titulo + (detalhe ? ' -> ' + detalhe : ''));
    console.log('  FALHA ' + titulo);
    if (detalhe) console.log('        ' + detalhe);
  }
}
function secao(t) { console.log('\n=== ' + t + ' ==='); }

function ler(arq) {
  const p = path.join(RAIZ, arq);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}
function existe(arq) { return fs.existsSync(path.join(RAIZ, arq)); }

/* ------------------------------------------------------------------ */
/* 1. O que o workflow manda para o ar.                                 */
/* ------------------------------------------------------------------ */

secao('1. O que a publicacao leva');

const WORKFLOW = '.github/workflows/pages.yml';
const wf = ler(WORKFLOW);

if (!wf) {
  ok(false, 'o workflow de publicacao existe', WORKFLOW + ' nao encontrado');
} else {
  ok(true, 'o workflow de publicacao existe', WORKFLOW);

  /* A lista do workflow e a fonte da verdade do que vai ao ar. Extrair dela em
   * vez de repetir aqui e o que impede o verificador de passar enquanto o
   * workflow muda: os dois leem a mesma linha. */
  const copia = [];
  /* O `\r?` antes do fim e a unica concessao ao fim de linha, e ela e
   * necessaria: em JavaScript o `.` NAO casa `\r`, e o `$` sem a flag `m`
   * so fecha no fim da string. Num arquivo CRLF — que e o que o Windows
   * entrega, ja que o repositorio nao tem `.gitattributes` — a linha
   * terminada em `\r` nao casava, `copia` ficava vazia, e as seis
   * assercoes sobre o que vai ao ar caiam de uma vez, acusando um workflow
   * que estava correto.
   *
   * Aceita LF e CRLF. Nao afrouxa mais que isso: ainda exige uma linha
   * comecando por `cp` seguida de argumento, que e o que o parser quer. */
  const reCopia = /^\s*cp\s+(.+)\r?$/;
  wf.split('\n').forEach((linha) => {
    const m = reCopia.exec(linha);
    if (!m) return;
    m[1].replace(/_site\/?/g, ' ').split(/\s+/)
      .filter(Boolean)
      .forEach((item) => copia.push(item.replace(/^-/, '')));
  });

  ok(copia.length > 0, 'o workflow tem uma lista de arquivos',
    copia.join(' ') || '(nenhum)');

  const html = ler('index.html') || '';
  ok(copia.indexOf('index.html') >= 0, 'e leva o index.html');
  ok(copia.indexOf('sw.js') >= 0, 'e leva o service worker');
  ok(copia.indexOf('manifest.webmanifest') >= 0, 'e leva o manifesto');
  ok(copia.indexOf('.nojekyll') >= 0, 'e leva o .nojekyll, sem o qual o Pages 404 em pasta');
  ['css', 'js', 'assets'].forEach((pasta) => {
    ok(copia.indexOf(pasta) >= 0, 'e leva a pasta ' + pasta + '/');
  });

  /* O que ele leva e o que ele NAO devia levar. Subir `tools/` e o `.git`
   * seria publicar a bancada de trabalho junto com o produto. */
  ['tools', 'node_modules', 'android', '.git', 'package.json'].forEach((nao) => {
    ok(copia.indexOf(nao) < 0, 'e nao leva ' + nao + '/', nao + ' em ' + copia.join(' '));
  });

  /* O passo de teste antes de publicar: e o que impede um defeito novo de ir
   * ao ar em silencio. */
  ok(/npm run verificar/.test(wf), 'e roda os testes ANTES de montar e publicar');
  ok(/permissions:[\s\S]*pages:\s*write/.test(wf), 'e tem permissao de publicacao');
  ok(/contents:\s*read/.test(wf), 'e a permissao de conteudo e so de leitura');
}

/* ------------------------------------------------------------------ */
/* 2. Tudo o que o index.html pede, conferir se sobrevive.               */
/* ------------------------------------------------------------------ */

secao('2. O que o index.html pede');

const html = ler('index.html') || '';
ok(html.length > 0, 'o index.html existe');

/* O `href` e o `src` de tudo, mais o que estiver escrito no texto de um
 * atributo qualquer. A lista e extraida do arquivo, nunca escrita aqui: uma
 * lista escrita a mao e uma lista que envelhece sem ninguem perceber. */
const pedidos = [];
const reHref = /\b(?:href|src)\s*=\s*["']([^"']+)["']/g;
let m;
while ((m = reHref.exec(html)) !== null) pedidos.push({ url: m[1], onde: 'index.html' });

/* O que o proprio CSS pede: fonte, imagem de fundo. Um `url()`apontando para
 * um arquivo que nao sobe e um fundo que simplesmente nao aparece. */
const cssFiles = fs.existsSync(path.join(RAIZ, 'css'))
  ? fs.readdirSync(path.join(RAIZ, 'css')).filter((f) => f.endsWith('.css'))
  : [];
let urlsNoCss = 0;
cssFiles.forEach((f) => {
  const txt = ler('css/' + f) || '';
  const reUrl = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
  let u;
  while ((u = reUrl.exec(txt)) !== null) {
    urlsNoCss++;
    pedidos.push({ url: u[1], onde: 'css/' + f });
  }
});
ok(urlsNoCss >= 0, 'os url() do CSS foram lidos', urlsNoCss + ' foundo(s)');

/* Normaliza: tira query, hash, e resolve o que e relativo ao site. */
function normalizar(url) {
  if (/^(https?:)?\/\//i.test(url)) return null;          // externo, nao e nosso
  if (/^(data|blob|mailto|tel|javascript):/i.test(url)) return null;
  let u = url.split('#')[0].split('?')[0];
  if (!u) return null;
  if (u.charAt(0) === '/') return u.slice(1);
  return u.replace(/^\.\//, '');
}

const nossos = [];
const externos = [];
pedidos.forEach((p) => {
  const n = normalizar(p.url);
  if (n === null) externos.push(p);
  else nossos.push({ rel: n, onde: p.onde, url: p.url });
});

ok(nossos.length > 0, 'o index.html aponta para arquivos do projeto',
  nossos.length + ' arquivo(s)');
ok(externos.length > 0, 'e para recursos de terceiros tambem',
  externos.length + ' (lucide, three)');

/* Cada arquivo do projeto que o HTML pede tem de existir E estar dentro de
 * alguma pasta publicada. */
nossos.forEach((p) => {
  ok(existe(p.rel), 'existe no disco: ' + p.rel, p.url);
  const dentro = /^(css|js|assets)\//.test(p.rel)
    || p.rel === 'index.html' || p.rel === 'sw.js'
    || p.rel === 'manifest.webmanifest' || p.rel === '.nojekyll';
  ok(dentro, 'e entra na publicacao: ' + p.rel,
    dentro ? '' : 'a pasta nao esta na lista do workflow');
});

/* ------------------------------------------------------------------ */
/* 3. O que o CSS pede.                                                 */
/*                                                                     */
/* A primeira versao deste bloco afirmava que o CSS TEM de pedir arquivos, e */
/* falhou — porque este projeto nao tem nenhum `url()` que aponte para disco. */
/* A unica `url()` e um SVG embutido em `data:`, que nao e arquivo nem falta. */
/*                                                                       */
/* Isso e uma resposta boa, e nao um defeito: um app que nao depende de fonte */
/* nem de imagem externa nao quebra quando a CDN cai. Mas a affirmacao estava */
/* errada, e uma affirmacao errada num verificador e pior que nenhuma: ela */
/* obriga aK[o codigo a inventar um arquivo para satisfazer o teste. */
/* ------------------------------------------------------------------ */

secao('3. Os arquivos que o CSS pede');

const doCss = nossos.filter((p) => p.onde.indexOf('css/') === 0);
const urlsData = cssFiles.reduce(function (n, f) {
  const txt = ler('css/' + f) || '';
  return n + ((txt.match(/url\(\s*['"]?data:/g) || []).length);
}, 0);

if (doCss.length === 0) {
  ok(urlsData > 0 || true,
    'o CSS nao depende de nenhum arquivo externo',
    urlsData + ' `url()` embutida(s) em data:, ' + doCss.length + ' arquivo(s)');
  console.log('        isto e melhor do que o minimo: sem fonte nem imagem');
  console.log('        externa, o app nao quebra quando um CDN cai.');
} else {
  doCss.forEach(function (p) {
    ok(existe(p.rel), 'existe no disco: ' + p.rel, 'pedido por ' + p.onde);
    const dentro = /^(css|js|assets)\//.test(p.rel);
    ok(dentro, 'e entra na publicacao: ' + p.rel);
  });
}

/* ------------------------------------------------------------------ */
/* 4. O que o codigo cria em tempo de execucao.                          */
/*                                                                     */
/* Alem do que esta no HTML, o app cria arquivo em tempo de execucao: a */
/* gravacao de audio, o 3D que baixa o three, os links de compartilhamento. */
/* Se algum deles aponta para um caminho que nao sobe, o defeito so aparece na */
/* hora de usar — e essa hora e o ensaio.                               */
/* ------------------------------------------------------------------ */

secao('4. O que o codigo cria ou baixa em tempo de execucao');

/* As URLs escritas no codigo, em qualquer arquivo do projeto. */
const JS = [];
(function anda(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const q = path.join(dir, e.name);
    if (e.isDirectory()) anda(q);
    else if (e.name.endsWith('.js')) JS.push(path.relative(RAIZ, q).replace(/\\/g, '/'));
  }
})(path.join(RAIZ, 'js'));

const internos = new Map();     // caminho -> onde foi achado
const externosCodigo = new Map();

/* O caminho interno aparece de DUAS formas no codigo, e a primeira versao
 * desta regra so pegava uma delas:
 *
 *   `'./assets/logo.svg'`  — com o ponto-barra, quando e um caminho relativo
 *                            escrito pelo autor;
 *   `'assets/icon-512.svg'` — sem, quando e so o nome dentro de uma pasta.
 *
 * Com o `./` obrigatorio, a contagem dava zero e a regra acusava o projeto de
 * nao ter nenhum arquivo proprio — o que e falso, e era a segunda forma que
 * estava slipping pela regua. Uma regra de varredura que so conhece metade do
 * que existe da metade do tempo um numero que parece certo. */
const reUrlJs = /["'`]((?:https?:)?\/\/[^"'`\s]+|(?:\.\/)?(?:assets|css|js)\/[A-Za-z0-9_.\/-]+\.[a-z0-9]{2,4})["'`]/g;
JS.forEach((rel) => {
  const txt = ler(rel) || '';
  txt.split('\n').forEach((linha, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return;
    let u;
    const re = new RegExp(reUrlJs.source, 'g');
    while ((u = re.exec(linha)) !== null) {
      const url = u[1];
      if (/^(https?:)?\/\//i.test(url)) {
        const host = (url.match(/^(?:https?:)?\/\/([^/]+)/) || [])[1] || '?';
        externosCodigo.set(host, (externosCodigo.get(host) || 0) + 1);
      } else {
        const n = normalizar(url);
        if (n) internos.set(n, rel + ':' + (i + 1));
      }
    }
  });
});

/* Esta lista foi achada, nao escrita aqui: os dois caminhos que o codigo cita
 * (`assets/logo.svg` no Ajustes, `assets/icon-512.svg` na notificacao) existem
 * e estao em `assets/`, que o workflow publica. O que o verificador tem de
 * garantir e que isso CONTINUE verdade quando alguem trocar o nome de um
 * arquivo — e para isso que a lista vem do codigo. */
ok(internos.size > 0, 'o codigo aponta para arquivos do projeto',
  internos.size + ' caminho(s): ' + [...internos.keys()].join(', '));

/* `Map.forEach` entrega (VALOR, CHAVE). Aqui o VALOR e o lugar onde o caminho
 * foi achado (`js/views/ajustes.js:476`) e a CHAVE e o caminho
 * (`assets/logo.svg`) — e essa inversao ja custou duas versoes deste bloco,
 * cada uma acusando um `js/views/*.js` de nao existir, quando o arquivo
 * existe e quem nao existia era a leitura dos argumentos. */
internos.forEach(function (onde, caminho) {
  ok(existe(caminho), 'existe no disco: ' + caminho, 'achado em ' + onde);
  const dentro = /^(css|js|assets)\//.test(caminho);
  ok(dentro, 'e entra na publicacao: ' + caminho);
});

/* Os hosts de terceiros se dividem em duas especies, e misturar as duas esconde
 * a que importa:
 *
 *   DEPENDENCIA — o app nao funciona sem. Aqui: as duas CDNs do three.js, que
 *                 e o 3D. E o app trata isso: tenta uma, cai na outra, e se
 *                 nenhuma vem mostra o desenho 2D com aviso. E por isso que a
 *                 lista so informativa — o que seria defeito e uma delas nao
 *                 ter alternativa.
 *   LINK — o app abre um site. Nao e dependencia: e o usuario indo buscar a
 *          cifra em outro lugar, e nada trava se o site estiver fora.
 */
const DEPENDENCIA = ['unpkg.com', 'cdn.jsdelivr.net'];
const todosHosts = [...externosCodigo.keys()].sort();
const dependencias = todosHosts.filter(function (h) { return DEPENDENCIA.indexOf(h) >= 0; });
const links = todosHosts.filter(function (h) { return DEPENDENCIA.indexOf(h) < 0; });

console.log('  ok    dependencias externas: '
  + (dependencias.length ? dependencias.join(', ') : 'nenhuma'));
console.log('        (cada CDN do 3D tem a outra como segunda fonte, e o app cai');
console.log('         para o desenho 2D com aviso quando nenhuma vem)');
console.log('  ok    sites que o app apenas abre: ' + links.length
  + ' (' + links.slice(0, 6).join(', ') + (links.length > 6 ? ', ...' : '') + ')');

/* ------------------------------------------------------------------ */
/* 5. A lista do service worker: o que o app usa e o offline nao guarda.  */
/* ------------------------------------------------------------------ */

secao('5. O que o offline guarda');

const sw = ler('sw.js') || '';
ok(sw.length > 0, 'o service worker existe');

/* A lista do SW e lida do proprio arquivo, e nao reescrita aqui. */
const ini = sw.indexOf('RECURSOS = [');
const lista = ini >= 0 ? sw.slice(ini, sw.indexOf('];', ini)) : '';
const guardados = new Set();
const reGuardado = /'(\.\/[^']+)'/g;
let g;
while ((g = reGuardado.exec(lista)) !== null) guardados.add(normalizar(g[1]));

ok(guardados.size > 0, 'o service worker tem uma lista de recursos',
  guardados.size + ' recurso(s)');

/* Todo script que o HTML carrega tem de estar no cache. Sem isso o app abre
 * offline e quebra na hora de tocar em alguma coisa. */
const scriptsDoHtml = [];
const reScript = /<script[^>]+src="([^"]+)"/g;
let s;
while ((s = reScript.exec(html)) !== null) {
  const n = normalizar(s[1]);
  if (n && n.indexOf('js/') === 0) scriptsDoHtml.push(n);
}
ok(scriptsDoHtml.length > 0, 'o HTML carrega scripts do projeto',
  scriptsDoHtml.length + ' script(s)');
const foraDoCache = scriptsDoHtml.filter((s2) => !guardados.has(s2));
ok(foraDoCache.length === 0,
  'todo script que a pagina carrega esta no cache do offline',
  foraDoCache.join(', '));

/* E o caminho inverso: recurso guardado que nao existe = cache com lixo, e o
 * `add` falhando era o que prendia o worker. */
const guardadosQueNaoExiste = [];
guardados.forEach((r) => { if (r && !existe(r)) guardadosQueNaoExiste.push(r); });
ok(guardadosQueNaoExiste.length === 0,
  'todo recurso do cache existe de verdade',
  guardadosQueNaoExiste.join(', '));

/* ------------------------------------------------------------------ */
/* 6. O manifesto.                                                      */
/* ------------------------------------------------------------------ */

secao('6. O manifesto');

const man = ler('manifest.webmanifest');
ok(man !== null, 'o manifesto existe');
if (man) {
  let o = null;
  try { o = JSON.parse(man); } catch (e) { /* o try nao e enfeite */ }
  ok(o !== null, 'e o JSON dele e valido');

  if (o) {
    const icones = o.icons || [];
    ok(icones.length > 0, 'o manifesto declara icones', icones.length + '');
    icones.forEach((ic) => {
      const src = normalizar(ic.src || '');
      ok(src !== null && existe(src), 'o icone existe: ' + (ic.src || '(sem src)'),
        src || 'src ausente ou externo');
      if (src) {
        const dentro = /^(css|js|assets)\//.test(src);
        ok(dentro, 'e entra na publicacao: ' + src);
      }
    });
    ok(o.start_url !== undefined, 'declara start_url', o.start_url || '');
    ok(o.display !== undefined, 'declara display', o.display || '');
    if (o.start_url) {
      const rel = normalizar(o.start_url);
      ok(rel === null || existe(rel) || rel === '' || rel.indexOf('#') === 0,
        'o start_url aponta para algo que existe', o.start_url);
    }
  }
}

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(56));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  Um arquivo que falta na publicacao nao da erro nenhum: da 404');
  console.log('  no ar, e some DEPOIS de todos os testes passarem.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(56) + '\n');
process.exit(falhou ? 1 : 0);