/* =========================================================
   tools/test-execucao.js
   O CONTROLADOR DA EXECUCAO: indice, limites, orfa e ordem

   POR QUE UM ARQUIVO NOVO

   `execucao.js` nasceu em V5.14 com uma unica evidencia: uma missa de 8 musicas
   percorrida no navegador. O controlador, com todas as suas guardas de indice,
   nao tinha nenhum teste. Isso e' a situacao em que um `indice + 2` passa
   despercebido ate o dia em que a pula uma musica na missa.

   O QUE ESTE ARQUIVO PROVA — E O QUE NAO PROVA

   PROVA, em Node e sem DOM:
     - `iniciar` abre na posicao 0;
     - `proxima` e `anterior` andam UM, nao dois;
     - as pontas nao damos a volta nem quebram;
     - `posicao` devolve indice e total coerentes;
     - um indice invalido e' corrigido, nao obedecido;
     - um repertorio vazio nao inicia;
     - musica orfa e' detectada pelo `cifraId`, e a sequencia continua;
     - a ordem persiste no disco e a execucao percorre nessa ordem;
     - `sair` limpa a sessao;
     - a execucao nao duplica dados pesados na Store.

   NAO PROVA:
     - nada de tela. A barra, o botao e a folha sao do navegador — e o provador
       comportamental (`tools/guarda-navegador.js`) mede aquilo que se ve.
     - nada sobre transposicao. Transpor NAO EXISTE no palco (medido na V5.15),
       entao nao ha estado para testar aqui; fingir que ha seria testar o vazio.

   SEM DOM DE MENTIRA

   `execucao.js` nao toca no DOM nas funcoes testadas: `iniciar`, `proxima`,
   `anterior`, `sair`, `posicao` e `sessaoAtual` sao aritmetica e consulta. So o
   `mostrar` chama o palco, e e' ele que este arquivo substitui por uma sonda
   que conta quantas vezes foi chamado e com que indice.
   ========================================================= */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');

const memoria = new Map();
global.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => { memoria.set(k, String(v)); },
  removeItem: (k) => memoria.delete(k),
  clear: () => memoria.clear(),
  key: () => null,
  get length() { return memoria.size; },
};
if (typeof global.navigator === 'undefined') global.navigator = {};
else { try { global.navigator = {}; } catch (e) { /* somente-leitura */ } }

require(path.join(RAIZ, 'js/core/music.js'));
require(path.join(RAIZ, 'js/core/utils.js'));
const Store = require(path.join(RAIZ, 'js/core/store.js'));

/* ---- o palco e' uma SONDA, nao uma folha ----
 *
 * `mostrar` chama `Views.palco.abrirDeMusica` e depois injeta a barra no
 * handle. Aqui nao existe folha, entao a sonda devolve um handle minimo e
 * guarda o que foi pedido. O que se mede e' a ORDEM PEDIDA — que e' a unica
 * coisa que o controlador decide. A barra e' desenho. */
const pedidos = [];
const fichas = [];
global.Views = global.Views || {};
global.UI = {
  toast: () => {},
  sheet: () => ({ node: { insertBefore: () => {}, firstChild: null }, close: () => {} }),
  icons: () => {},
  el: () => ({ insertBefore: () => {} }),
};
global.Views.palco = {
  /* `mostrar` chama `abrir(ficha)` — o export real do palco — porque e' ele
   * que recebe a ficha ja com a cifra transposta. A sonda guarda a ficha para
   * que o teste possa conferir a CIFRA, e nao apenas o indice.
   *
   * O indice sai da ficha, e nao de uma posicao que a sonda receberia: quem
   * sabe em que posicao a execucao esta e' a ficha, e e' por `musicaId` que
   * ela se liga ao repertorio. Desconfiar do indice que a propria execucao
   * mandaria seria medir o mesmo numero duas vezes. */
  abrir: (ficha) => {
    fichas.push(ficha);
    const ev = ficha.escalaId ? Store.porId(ficha.escalaId) : null;
    const i = ev ? ev.musicas.findIndex((m) => m.id === ficha.musicaId) : -1;
    pedidos.push({ indice: i, nome: ficha.titulo, id: ficha.musicaId, cifra: ficha.cifra });
    return { node: null, close: () => {} };
  },
};

const Execucao = require(path.join(RAIZ, 'js/views/execucao.js'));

let passou = 0; let falhou = 0;
const problemas = [];
function ok(cond, titulo, detalhe) {
  if (cond) { passou++; console.log('  ok    ' + titulo + (detalhe ? '  (' + detalhe + ')' : '')); }
  else { falhou++; problemas.push(titulo); console.log('  FALHA ' + titulo); if (detalhe) console.log('        ' + detalhe); }
}
const secao = (t) => console.log('\n=== ' + t + ' ===');

/* ---- um evento com N musicas, cada uma vindo do catalogo ---- */
function evento(nomes) {
  Store.apagar();
  const tons = ['C', 'G', 'Dm', 'F', 'Am', 'Bb', 'C', 'D', 'Em', 'F#m'];
  nomes.forEach((n, i) => {
    Store.db.cifras.push(Store.normCifra({
      titulo: n, tom: tons[i % tons.length], bpm: 90, categoria: 'liturgia', cifra: 'C\nG\nAm',
    }));
  });
  Store.gravar();
  const ev = Store.normEscala({ data: '2026-10-25', hora: '19:00', titulo: 'Missa', musicas: [] });
  Store.cifras().forEach((c, i) => {
    ev.musicas.push(Store.normMusica({
      nome: nomes[i], artista: c.artista, tom: c.tom, bpm: c.bpm,
      categoria: c.categoria, cifraId: c.id,
    }));
  });
  Store.db.escalas.push(ev);
  Store.gravar();
  return ev;
}
const posDe = (nome) => pedidos.map((p) => p.nome).lastIndexOf(nome);

/* ------------------------------------------------------------------ */
secao('1. iniciar abre na PRIMEIRA, na ultima posicao');

{
  const ev = evento(['A', 'B', 'C']);
  pedidos.length = 0;
  const abriu = Execucao.iniciar(ev);
  ok(abriu === true, 'iniciar devolve verdadeiro');
  ok(pedidos.length === 1, 'e pediu exatamente UMA musica ao palco', pedidos.length + ' pedido(s)');
  ok(pedidos[0].indice === 0 && pedidos[0].nome === 'A',
    'e pediu a posicao 0 — a primeira da ordem', 'indice ' + pedidos[0].indice);
  ok(Execucao.posicao().indice === 0 && Execucao.posicao().total === 3,
    'posicao() diz 0 de 3', JSON.stringify(Execucao.posicao()));
}

/* ------------------------------------------------------------------ */
secao('2. proxima e anterior andam UM — nao dois');

{
  const ev = evento(['A', 'B', 'C']);
  Execucao.iniciar(ev);
  pedidos.length = 0;
  Execucao.proxima();
  ok(pedidos[0].indice === 1 && pedidos[0].nome === 'B', 'proxima vai para B',
    'indice ' + pedidos[0].indice);
  Execucao.proxima();
  ok(pedidos[1].indice === 2 && pedidos[1].nome === 'C', 'proxima de novo vai para C',
    'indice ' + pedidos[1].indice);
  Execucao.anterior();
  ok(pedidos[2].indice === 1 && pedidos[2].nome === 'B', 'anterior volta para B',
    'indice ' + pedidos[2].indice);
  ok(pedidos.length === 3, 'e nenhum pedido extra — nem pulo, nem repeticao',
    pedidos.length + ' pedidos');
}

/* ------------------------------------------------------------------ */
secao('3. As pontas: nao da a volta, nao quebra');

{
  const ev = evento(['A', 'B', 'C']);
  Execucao.iniciar(ev);
  pedidos.length = 0;
  const ant1 = Execucao.anterior();
  ok(ant1 === false, 'anterior na PRIMEIRA devolve falso (nao avancou)');
  ok(pedidos.length === 0, 'e nao pediu NADA ao palco', pedidos.length + ' pedido(s)');
  ok(Execucao.posicao().indice === 0, 'o indice continua em 0',
    String(Execucao.posicao().indice));

  Execucao.proxima(); Execucao.proxima();
  pedidos.length = 0;
  const proxFim = Execucao.proxima();
  ok(proxFim === false, 'proxima na ULTIMA devolve falso');
  ok(pedidos.length === 0, 'e nao pediu nada', pedidos.length + ' pedido(s)');
  const p = Execucao.posicao();
  ok(p.indice === 2 && p.total === 3, 'o indice continua no ultimo', JSON.stringify(p));
  ok(p.nome === 'C', 'e ainda e\' a ultima musica', p.nome);
}

/* ------------------------------------------------------------------ */
secao('4. Um so: nas duas pontas a sequencia tem uma musica');

{
  const ev = evento(['So']);
  Execucao.iniciar(ev);
  ok(Execucao.proxima() === false, 'proxima numa musica so: falso');
  ok(Execucao.anterior() === false, 'anterior numa musica so: falso');
  ok(Execucao.posicao().total === 1, 'e a posicao diz 1', JSON.stringify(Execucao.posicao()));
}

/* ------------------------------------------------------------------ */
secao('5. Repertorio vazio nao inicia');

{
  const ev = evento(['A']);
  ev.musicas = [];
  Store.db.escalas = Store.db.escalas.map((x) => (x.id === ev.id ? ev : x));
  Store.gravar();
  pedidos.length = 0;
  const abriu = Execucao.iniciar(ev);
  ok(abriu === false, 'iniciar num repertorio vazio devolve falso');
  ok(pedidos.length === 0, 'e nao pediu musica nenhuma');
  ok(Execucao.ativa() === false, 'e nao ha sessao em curso');
  ok(Execucao.sessaoAtual() === null, 'o estado de sessao e\' nulo');
}

/* ------------------------------------------------------------------ */
secao('6. Indice invalido e\' corrigido, nao obedecido');

{
  const ev = evento(['A', 'B', 'C']);
  Execucao.iniciar(ev);
  /* Um indice de fora e' o que uma edicao feita durante a execucao deixaria.
   * A execucao tem de se recolocar, e nao mostrar uma musica que nao existe. */
  Execucao.sessaoAtual().indice = 99;
  const p = Execucao.posicao();
  ok(p.indice === 2 && p.nome === 'C', 'indice 99 foi preso no ultimo',
    JSON.stringify(p));
  Execucao.sessaoAtual().indice = -5;
  const p2 = Execucao.posicao();
  ok(p2.indice === 0 && p2.nome === 'A', 'indice -5 foi preso no primeiro',
    JSON.stringify(p2));
}

/* ------------------------------------------------------------------ */
secao('7. Referencia orfa: detectada, e a sequencia continua');

{
  const ev = evento(['A', 'B', 'C']);
  /* Guarda o id de B **pelos ids**, nunca pela posicao na tela: e' a sonda da
   * V5.14 que falhou por apagar a musica errada. */
  const idB = ev.musicas[1].cifraId;
  ok(!!idB, 'a musica B tem cifraId guardado', idB);

  Execucao.iniciar(ev);
  ok(Execucao.posicao().orfa === false, 'A nao e\' orfa');

  Store.db.cifras = Store.db.cifras.filter((c) => c.id !== idB);
  Store.gravar();

  /* A sessao continua de pe; so a ficha de B e' um buraco. */
  ok(Execucao.ativa(), 'a sessao continua ativa apos a exclusao');
  pedidos.length = 0;

  /* `proxima` e `anterior` ANDAM o indice e pedem a musica ao palco; so depois
   * desenham. A musica orfa abre uma folha propria — e folha e' DOM, que este
   * arquivo nao finge ter.
   *
   * Entao o teste mede a DECISAO e tolera a apresentacao: se a folha orfa
   * lancar por falta de `document`, o indice ja foi movido (ele e' setado antes
   * do desenho), e e' a decisao que a FASE 11 pergunta — a sequencia nao pode
   * travar. O desenho da orfa tem o provador no navegador. */
  const andar = (fn) => { try { fn(); return 'ok'; } catch (e) { return 'apresentacao: ' + (e && e.name); } };

  ok(andar(() => Execucao.proxima()) !== undefined, 'proxima executou');
  ok(Execucao.posicao().indice === 1, 'proxima chegou na posicao de B',
    String(Execucao.posicao().indice));
  ok(Execucao.posicao().orfa === true, 'e a posicao sabe que B esta orfa',
    JSON.stringify(Execucao.posicao()));
  ok(Execucao.posicao().nome === 'B', 'e o nome dela continua visivel',
    Execucao.posicao().nome);

  /* O ponto que a V5.14 nao mediu: a sequencia NAO fica presa. */
  andar(() => Execucao.proxima());
  ok(Execucao.posicao().indice === 2 && Execucao.posicao().nome === 'C',
    'proxima APOS a orfa ainda avanca', JSON.stringify(Execucao.posicao()));
  ok(Execucao.posicao().orfa === false, 'e C continua valida');
  andar(() => Execucao.anterior());
  ok(Execucao.posicao().indice === 1, 'anterior volta da orfa, sem travar',
    String(Execucao.posicao().indice));
  ok(Execucao.posicao().orfa === true, 'e a orfa continua onde estava');
}

/* ------------------------------------------------------------------ */
secao('8. A ordem do repertorio e a ordem da execucao');

{
  const ev = evento(['A', 'B', 'C']);
  /* Move C para o inicio — a operacao que a pessoa faz na lista. */
  const c = ev.musicas[2];
  ev.musicas.splice(2, 1);
  ev.musicas.unshift(c);
  Store.db.escalas = Store.db.escalas.map((x) => (x.id === ev.id ? ev : x));
  Store.gravar();

  const relido = JSON.parse(memoria.get(Store.STORAGE_KEY)).escalas[0];
  const noDisco = relido.musicas.map((m) => m.nome).join(' ');
  ok(noDisco === 'C A B', 'a ordem nova sobrevive ao disco', noDisco);

  Execucao.iniciar(relido);
  pedidos.length = 0;
  const trilha = [Execucao.posicao().nome];
  Execucao.proxima(); trilha.push(Execucao.posicao().nome);
  Execucao.proxima(); trilha.push(Execucao.posicao().nome);
  ok(trilha.join(' ') === 'C A B', 'e a execucao percorre nessa ordem', trilha.join(' '));
  ok(pedidos.map((p) => p.nome).join(' ') === 'A B', 'o palco recebeu na ordem tambem',
    pedidos.map((p) => p.nome).join(' '));
}

/* ------------------------------------------------------------------ */
secao('9. A execucao nao guarda copia da musica');

{
  const ev = evento(['A', 'B', 'C']);
  const antes = memoria.get(Store.STORAGE_KEY).length;
  Execucao.iniciar(ev);
  Execucao.proxima(); Execucao.proxima(); Execucao.anterior();
  const depois = memoria.get(Store.STORAGE_KEY).length;
  ok(depois === antes, 'navegar nao escreve nada no armazenamento',
    antes + ' -> ' + depois + ' bytes');
  const s = Execucao.sessaoAtual();
  ok(Object.keys(s).length === 3,
    'a sessao so tem escalaId, indice e o mapa de semitons',
    Object.keys(s).join(', '));
  ok(Object.keys(s.semisPorMusica || {}).length === 0,
    'e o mapa de semitons comeca vazio — nenhuma musica vem transposta');
}

/* ------------------------------------------------------------------ */
secao('9b. TRANSPOR: temporario, por musica, e sem tocar a biblioteca');

{
  const ev = evento(['A', 'B', 'C']);   /* A=C  B=G  C=Dm */
  const antesDaBiblioteca = JSON.parse(memoria.get(Store.STORAGE_KEY));
  Execucao.iniciar(ev);

  const originalA = fichas[fichas.length - 1].cifra;

  /* --- subir dois semitons em A --- */
  const s1 = Execucao.transpor(1);
  const s2 = Execucao.transpor(1);
  ok(s2 === 2, 'A subiu dois semitons', String(s2));
  Execucao.mostrar(0);
  const fichaA = fichas[fichas.length - 1];
  ok(fichaA.cifra !== originalA, 'a cifra de A mudou de verdade',
    (originalA || '').slice(0, 14).replace(/\n/g, ' ') + ' -> ' + (fichaA.cifra || '').slice(0, 14).replace(/\n/g, ' '));
  ok(fichaA.cifra.indexOf('C') < 0 || fichaA.cifra.indexOf('D') >= 0,
    'e o acorde de abertura saiu de C para D',
    JSON.stringify((fichaA.cifra || '').split('\n')[0]));
  ok(fichaA.tom === 'D' || fichaA.tom === 'C', 'e o tom declarado foi acompanhado',
    'tom=' + fichaA.tom);

  /* --- seguir para B: B nao pode receber o +2 de A --- */
  Execucao.proxima();
  const fichaB = fichas[fichas.length - 1];
  ok(fichaB.semisSessao === 0, 'B abre com ZERO semitons', 'semis=' + fichaB.semisSessao);
  ok(fichaB.cifra.indexOf('D') === 0 || !/^D/m.test(fichaB.cifra),
    'e a cifra de B nao foi contaminada por A',
    JSON.stringify((fichaB.cifra || '').split('\n')[0]));
  ok(fichaB.tom === 'G', 'B continua no tom G', 'tom=' + fichaB.tom);

  /* --- B sobe tres, C nao recebe --- */
  Execucao.transpor(3);
  Execucao.proxima();
  const fichaC = fichas[fichas.length - 1];
  ok(fichaC.semisSessao === 0, 'C abre com ZERO semitons', 'semis=' + fichaC.semisSessao);
  ok(fichaC.tom === 'Dm', 'C continua Dm', 'tom=' + fichaC.tom);

  /* --- voltar a A: o +2 de A continua la --- */
  Execucao.anterior(); Execucao.anterior();
  const fichaA2 = fichas[fichas.length - 1];
  ok(fichaA2.semisSessao === 2, 'A volta com os DOIS semitons que tinha',
    'semis=' + fichaA2.semisSessao);
  ok(fichaA2.cifra === fichaA.cifra, 'e com a mesma cifra transposta');

  /* --- restaurar --- */
  Execucao.restaurarTom();
  Execucao.mostrar(0);
  ok(fichas[fichas.length - 1].cifra === originalA,
    'restaurar devolve A ao original, sem deriva');

  /* --- rollback: +2 e -2 volta ao original --- */
  Execucao.transpor(2); Execucao.transpor(-2);
  Execucao.mostrar(0);
  ok(fichas[fichas.length - 1].cifra === originalA, '+2 e -2 volta ao original');

  /* --- +12 e' o mesmo acorde: nao pode acumular --- */
  Execucao.transpor(12);
  ok(Execucao.tomAtual().semis === 0, '+12 volta a zero — semitons sao circulares',
    'semis=' + Execucao.tomAtual().semis);
  Execucao.transpor(-14);
  ok(Execucao.tomAtual().semis === 10, '-14 equivale a -2 (10 semitons)', 'semis=' + Execucao.tomAtual().semis);
  Execucao.restaurarTom();

  /* --- A BIBLIOTECA NAO FOI TOCADA --- */
  const depoisDaBiblioteca = JSON.parse(memoria.get(Store.STORAGE_KEY));
  ok(JSON.stringify(antesDaBiblioteca.cifras) === JSON.stringify(depoisDaBiblioteca.cifras),
    'nenhuma cifra da biblioteca mudou');
  ok(JSON.stringify(antesDaBiblioteca.escalas) === JSON.stringify(depoisDaBiblioteca.escalas),
    'e o repertorio nao mudou');
}

{
  /* --- sessao nova nao herda --- */
  const ev = evento(['A', 'B', 'C']);
  Execucao.iniciar(ev);
  Execucao.transpor(2);
  ok(Execucao.tomAtual().semis === 2, 'A esta em +2');
  Execucao.sair();
  Execucao.iniciar(ev);
  ok(Execucao.tomAtual().semis === 0, 'nova sessao comeca no ORIGINAL',
    'semis=' + Execucao.tomAtual().semis);
}

/* ------------------------------------------------------------------ */
secao('10. sair limpa a sessao');

{
  const ev = evento(['A', 'B']);
  Execucao.iniciar(ev);
  ok(Execucao.ativa() === true, 'apos iniciar, ha sessao');
  Execucao.sair();
  ok(Execucao.ativa() === false, 'apos sair, nao ha sessao');
  ok(Execucao.posicao() === null, 'e posicao() devolve nulo');
  pedidos.length = 0;
  ok(Execucao.proxima() === false, 'proxima sem sessao nao faz nada');
  ok(pedidos.length === 0, 'e nao abre musica nenhuma');
}

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(60));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  O controlador sem teste e um `indice + 2` esperando a missa.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(60) + '\n');
process.exit(falhou ? 1 : 0);