/* Medicao informativa do controlador: 10, 50 e 100 musicas.
 * Nao e' benchmark e nao reprova nada: o objetivo e' detectar regressao
 * ESTRUTURAL (um controlador que copia a cifra, ou que cresce com o quadrado
 * do repertorio), nao nanossegundo. Por isso nao ha limite aqui. */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');

const corpo = `
  const path = require('path');
  const RAIZ = ${JSON.stringify(RAIZ)};
  const memoria = new Map();
  global.localStorage = {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => { memoria.set(k, String(v)); },
    removeItem: (k) => memoria.delete(k),
    clear: () => memoria.clear(), key: () => null,
    get length() { return memoria.size; },
  };
  if (typeof global.navigator === 'undefined') global.navigator = {};
  require(path.join(RAIZ, 'js/core/music.js'));
  require(path.join(RAIZ, 'js/core/utils.js'));
  const Store = require(path.join(RAIZ, 'js/core/store.js'));
  const fichas = [];
  global.Views = { palco: { abrir: (f) => { fichas.push(JSON.stringify(f).length); return { node: null, close() {} }; } } };
  global.UI = { toast(){}, sheet: () => ({ node: { insertBefore(){}, firstChild: null }, close(){} }), icons(){} };
  const E = require(path.join(RAIZ, 'js/views/execucao.js'));

  const N = Number(process.argv[2]);
  const CIFRA = 'C\\nG7\\nAm\\nF#\\nBb/D\\nC/E\\nDm7\\nG/B';
  Store.apagar();
  for (let i = 0; i < N; i++) {
    Store.db.cifras.push(Store.normCifra({
      titulo: 'Musica ' + (i + 1), tom: ['C','G','Dm','F','Am'][i % 5], bpm: 90,
      categoria: 'liturgia', cifra: CIFRA,
    }));
  }
  Store.gravar();
  const ev = Store.normEscala({ data: '2026-10-05', hora: '19:00', titulo: 'Missa', musicas: [] });
  Store.cifras().forEach((c) => ev.musicas.push(Store.normMusica({
    nome: c.titulo, tom: c.tom, bpm: c.bpm, categoria: c.categoria, cifraId: c.id })));
  Store.db.escalas.push(ev); Store.gravar();

  /* escritas na Store: conta cada gravacao */
  let escritas = 0;
  const gravaReal = Store.gravar;
  Store.gravar = function () { escritas++; return gravaReal.apply(this, arguments); };

  let t = process.hrtime.bigint();
  const ok = E.iniciar(ev);
  const iniciar = Number(process.hrtime.bigint() - t) / 1e6;
  escritas = 0;

  const ida = [];
  for (let i = 0; i < N - 1; i++) { t = process.hrtime.bigint(); E.proxima(); ida.push(Number(process.hrtime.bigint() - t) / 1e6); }
  const voltas = [];
  for (let i = 0; i < N - 1; i++) { t = process.hrtime.bigint(); E.anterior(); voltas.push(Number(process.hrtime.bigint() - t) / 1e6); }

  const med = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const p = E.posicao();
  const sessao = E.sessaoAtual();

  /* o estado da sessao: e' um indice e um mapa de semitons, nao as musicas */
  const chavesSessao = sessao ? Object.keys(sessao) : [];
  const tamanhoSessao = sessao ? JSON.stringify(sessao).length : 0;

  /* transpor em todas: o tempo e' o que importa */
  t = process.hrtime.bigint();
  E.semisPorMusica = null;
  for (let i = 0; i < N; i++) { E.mostrar(i); E.transpor(2); }
  const todosTransp = Number(process.hrtime.bigint() - t) / 1e6;

  process.stdout.write(JSON.stringify({
    n: N, iniciou: ok,
    iniciarMs: iniciar,
    proximaMedia: med(ida), anteriorMedia: med(voltas),
    transporTodasMs: todosTransp,
    escritasDuranteNavegacao: escritas,
    posicaoFinal: p,
    chavesSessao: chavesSessao,
    tamanhoSessaoBytes: tamanhoSessao,
    tamanhoDiscoBytes: JSON.stringify(Store.db).length,
    tamanhoMedioFichaBytes: Math.round(fichas.reduce((s, x) => s + x, 0) / Math.max(1, fichas.length)),
    fichasCount: fichas.length,
  }));
`;

const fs = require('fs');
const ARQ = path.join(process.env.TEMP || '.', 'perf-execucao-medido.js');
fs.writeFileSync(ARQ, corpo, 'utf8');

console.log('N  | iniciar | proxima | anterior | transpor TODAS | escritas | sessao | ficha | disco');
console.log('---+---------+---------+----------+----------------+---------+--------+-------+-------');
for (const n of [10, 50, 100]) {
  const r = JSON.parse(execFileSync('node', [ARQ, String(n)], { encoding: 'utf8' }));
  console.log(
    String(r.n).padStart(3) + ' | '
    + r.iniciarMs.toFixed(2).padStart(7) + ' | '
    + r.proximaMedia.toFixed(3).padStart(7) + ' | '
    + r.anteriorMedia.toFixed(3).padStart(8) + ' | '
    + r.transporTodasMs.toFixed(2).padStart(14) + ' | '
    + String(r.escritasDuranteNavegacao).padStart(8) + ' | '
    + String(r.tamanhoSessaoBytes).padStart(6) + ' | '
    + String(r.tamanhoMedioFichaBytes).padStart(5) + ' | '
    + String(r.tamanhoDiscoBytes).padStart(5));
  console.log('      chaves da sessao: ' + r.chavesSessao.join(', ')
    + '   |   posicao final: ' + r.posicaoFinal.indice + ' de ' + r.posicaoFinal.total);
}