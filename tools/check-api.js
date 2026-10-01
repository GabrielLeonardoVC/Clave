/* Confere se o app chama metodos que existem.
   Rodar:  node tools/check-api.js

   O Acorde e JavaScript puro, sem compilador. Um metodo renomeado na API e
   chamado pelo nome antigo na tela nao da erro de sintaxe, nao quebra o build e
   nao aparece em nenhum teste: so quebra quando a pessoa toca, e Often-times
   dentro de um setTimeout, muito depois do app ter aberto.

   Ja aconteceu. `notify.js` chamava `Store.allEscalas()` e
   `Store.cmpEscala()`, e nenhum dos dois nomes existia — a API exporta
   `escalas` e `cmp`. O aviso de missa simplesmente nunca aparecia, e o unico
   sinal era um TypeError no console 2,4 s depois de abrir o app.

   Este e o substituto do compilador: le a API real de cada modulo, resolve os
   apelidos que cada arquivo cria e avisa quando algum acesso nao existe.
   --------------------------------------------------------- */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { arquivosDe, RAIZ } = require('./arquivos.js');

/** Ordem de carga: cada modulo usa os que vieram antes. */
const MODULOS = [
  { arquivo: 'js/core/music.js', global: 'Music' },
  { arquivo: 'js/core/utils.js', global: 'Utils' },
  { arquivo: 'js/core/store.js', global: 'Store' },
  { arquivo: 'js/core/ui.js', global: 'UI' },
  { arquivo: 'js/core/render.js', global: 'Render' },
  { arquivo: 'js/core/print.js', global: 'Print' },
  { arquivo: 'js/core/links.js', global: 'Links' },
  { arquivo: 'js/core/search.js', global: 'Search' },
  { arquivo: 'js/core/tuner.js', global: 'Tuner' },
  { arquivo: 'js/core/metronome.js', global: 'Metro' },
  { arquivo: 'js/core/studio.js', global: 'Studio' },
  { arquivo: 'js/core/notify.js', global: 'Notify' },
  { arquivo: 'js/core/share.js', global: 'Share' },
];

/** Propriedades que vem do proprio JavaScript, e nao da API do modulo. */
const DO_JS = new Set([
  'length', 'name', 'call', 'apply', 'bind', 'prototype', 'constructor',
  'toString', 'valueOf', 'hasOwnProperty',
]);

/** Carrega cada modulo e anota o que ele de fato exporta. */
function carregar() {
  const api = new Map();
  const erros = [];

  for (const mod of MODULOS) {
    const alvo = path.join(RAIZ, mod.arquivo);
    if (!fs.existsSync(alvo)) {
      erros.push(mod.arquivo + ': arquivo nao encontrado');
      continue;
    }
    try {
      delete require.cache[require.resolve(alvo)];
      require(alvo);
    } catch (e) {
      erros.push(mod.arquivo + ': ' + e.message);
      continue;
    }
    const g = globalThis[mod.global];
    if (!g || typeof g !== 'object') {
      erros.push(mod.arquivo + ': nao publica ' + mod.global);
      continue;
    }
    api.set(mod.global, new Set(Object.keys(g)));
  }
  return { api, erros };
}

/**
 * Descobre os apelidos: `const M = global.Music;` torna `M.parseChord` um
 * acesso a API de Music. Sem resolver isso, todo apelido pareceria um global
 * desconhecido.
 *
 * O padrao exige que a parte direita seja o global sozinho. Sem o
 * lookahead, `const h = global.UI.sheet({...})` contava como apelido do
 * modulo inteiro, e `h.body` — que existe no valor devolvido por sheet —
 * virava "acesso quebrado" junto com um punhado de falsos positivos.
 */
function apelidos(texto) {
  const mapa = new Map();
  const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*global(?:This)?\.([A-Za-z_$][\w$]*)(?![.\w$])/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    mapa.set(m[1], m[2]);
    mapa.set(m[2], m[2]);
  }
  return mapa;
}

const { api, erros } = carregar();

console.log('\n=== 1. Os modulos carregam e exportam ===');
MODULOS.forEach((mod) => {
  if (!api.has(mod.global)) return;
  console.log('  ok    ' + mod.global.padEnd(9) + api.get(mod.global).size + ' exportados');
});
erros.forEach((e) => console.log('  FALHA ' + e));

console.log('\n=== 2. Nenhum acesso a uma API inexistente ===');
const fontes = arquivosDe(/\.(js|html)$/).filter((f) => !f.includes('tools'));
let acessos = 0;
const ruins = [];

for (const arquivo of fontes) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  const mapa = apelidos(texto);
  if (mapa.size === 0) continue;

  // Varre "Apelido.metodo" e "Global.metodo".
  const re = /\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g;
  let m;
  const linhas = texto.split('\n');
  while ((m = re.exec(texto)) !== null) {
    const [, apelido, membro] = m;
    const destino = mapa.get(apelido);
    if (!destino) continue; // nao e um dos nossos modulos
    if (!api.has(destino)) continue;
    if (DO_JS.has(membro)) continue;

    acessos++;
    if (!api.get(destino).has(membro)) {
      const linha = texto.slice(0, m.index).split('\n').length;
      const trecho = (linhas[linha - 1] || '').trim().slice(0, 76);
      ruins.push(arquivo.replace(RAIZ + path.sep, '') + ':' + linha +
        '  ' + apelido + '.' + membro + ' nao existe em ' + destino +
        '  ->  ' + trecho);
    }
  }
}

console.log('  ' + acessos + ' acessos conferidos em ' + fontes.length + ' arquivos');
if (ruins.length === 0) {
  console.log('  ok    todo acesso aponta para uma API que existe');
} else {
  console.log('  ' + ruins.length + ' acesso(s) quebrado(s):');
  ruins.forEach((r) => console.log('        ' + r));
}

console.log('\n=== 3. Acentos: a lista e o CSS precisam bater ===');
// A lista em ajustes.js e o bloco [data-accent] do base.css sao as duas metades
// de um mesmo conjunto. Nao ha import entre elas — uma So pode ser conferida
// por leitura. O sintoma de divergencia e silencioso: a pessoa toca numa
// amostra, recebe outra cor, e nao ha erro em lugar nenhum.

// ── funcoes de comparacao ──
let problemaAcento = 0;
function eq(actual, expected, label) {
  const good = actual === expected;
  if (!good) problemaAcento++;
  console.log((good ? '  ok    ' : '  FALHA ') + label);
}

const css = fs.readFileSync(path.join(RAIZ, 'css', 'base.css'), 'utf8');const noCss = new Set();
{
  const re = /\[data-accent="([a-z]+)"\]/g;
  let m;
  while ((m = re.exec(css)) !== null) noCss.add(m[1]);
}
const ajustes = fs.readFileSync(path.join(RAIZ, 'js', 'views', 'ajustes.js'), 'utf8');

/**
 * Os ids de acento declarados em um trecho de `ajustes.js`.
 *
 * Conta chaves de verdade em vez de cortar num `];`: os acentos vem agrupados
 * em `FAMILIAS`, e o `];` seguinte nao fecha a lista. Um corte por texto fixo
 * devolveu zero ids sem reclamar, e um verificador que responde zero sem
 * erro e pior que um verificador quebrado: o quebrado se ve, o zero se
 * aceita.
 */
function idsDeAcento(texto, apartirDe) {
  const i = texto.indexOf(apartirDe);
  if (i < 0) return new Set();
  const achados = new Set();
  const re = /\{\s*id:\s*'([a-z]+)'/g;
  let profundidade = 0;
  let m;
  let p = i;
  while (p < texto.length) {
    // Cada chave abre ou fecha um nivel. A contagem volta a zero no fim da
    // declaracao que começou em `apartirDe`.
    if (texto[p] === '{') profundidade++;
    else if (texto[p] === '}') {
      profundidade--;
      if (profundidade <= 0) break;
    } else if (texto[p] === ';') {
      // Um `;` no nivel zero tambem fecha: e o caso de uma familia escrita
      // sem chaves em volta.
      if (profundidade === 0 && achados.size > 0) break;
    }
    // Procura o padrao a partir da posicao atual.
    re.lastIndex = p;
    m = re.exec(texto);
    if (m && m.index >= p) { achados.add(m[1]); p = m.index + m[0].length; continue; }
    p++;
  }
  return achados;
}

// As familias sao a fonte da verdade: e delas que a tela tira os botoes.
const noJs = idsDeAcento(ajustes, 'const FAMILIAS');

// `ACCENTS` precisa continuar DERIVADO das familias.
//
// Se alguem voltar a escrever `ACCENTS` como lista literal, o verificador
// reclama — e o motivo e concreto: uma lista literal e uma segunda fonte de
// verdade, e duas fontes divergem no primeiro ajuste. Foi o que aconteceu com
// o hex do acento, que a lista guardava e o CSS nunca usou: as amostras
// mostravam uma cor e o app aplicava outra, sem erro em lugar nenhum.
{
  if (ajustes.indexOf('const ACCENTS') < 0) {
    console.log('  FALHA  nao achei a lista ACCENTS em ajustes.js');
  } else {
    // A declaracao vai ate a proxima linha em branco.
    // `ajustes` e o conteudo do arquivo, uma string. Percorrer com
    // `ajustes[fim]` devolveria um caractere, nao uma linha: o laco terminaria
    // no primeiro espaco e leria um trecho sem sentido.
    const linhas = ajustes.split(String.fromCharCode(10));
    let k = linhas.findIndex((l, x) => x >= 0 && l.indexOf('const ACCENTS') >= 0);
    while (k < linhas.length && linhas[k].trim() !== '') k++;
    const decl = linhas.slice(linhas.findIndex((l) => l.indexOf('const ACCENTS') >= 0), k).join(String.fromCharCode(10));
    // Um id literal aqui dentro seria a lista manual de volta.
    const literal = /\{\s*id:\s*'[a-z]+'/.test(decl);
    const derivada = decl.indexOf('FAMILIAS') >= 0;
    if (literal || !derivada) {
      console.log('  FALHA  ACCENTS nao e derivada de FAMILIAS.');
      console.log('          Uma lista literal aqui e uma segunda fonte de verdade,');
      console.log('          e duas fontes divergem no primeiro ajuste.');
    } else {
      console.log('  ok    ACCENTS continua derivada de FAMILIAS');
    }
  }
}

const soCss = [...noCss].filter((x) => !noJs.has(x));
const soJs = [...noJs].filter((x) => !noCss.has(x));
eq(soCss.length, 0, 'todo acento do CSS aparece na lista' +
  (soCss.length ? ' — faltam: ' + soCss.join(', ') : ''));
eq(soJs.length, 0, 'todo acento da lista existe no CSS' +
  (soJs.length ? ' — sobram: ' + soJs.join(', ') : ''));
console.log('  ' + noJs.size + ' acento(s) ofertado(s)');

console.log('\n=================================================');
const total = erros.length + ruins.length + problemaAcento;
console.log('  ' + (total === 0 ? 'nenhuma quebra de API' : total + ' problema(s)'));
console.log('=================================================\n');
process.exit(total ? 1 : 0);
