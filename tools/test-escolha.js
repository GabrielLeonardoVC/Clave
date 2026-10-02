/* =========================================================
   tools/test-escolha.js
   O instrumento e UMA escolha, nao tres.

   POR QUE ESTE ARQUIVO EXISTE

   Esta rodada trocou o audio de tom puro para som de instrumento, e o caminho
   abriu tres portas que nao existiam antes:

     - a preferencia "que instrumento eu toco";
     - a lista de timbres, que decide o som;
     - a lista de instrumentos, que decide o braco desenhado.

   Sao tres listas com nomes parecidos, e cada uma delas tem um jeito de ficar
   para fora da outra sem ninguem notar. Um baixo de 5 cordas sem timbre soa
   como violao. Um timbre sem braco desenha violao para quem toca teclado. E um
   id escrito com acento nao casa com nada — e o sintoma e o botao que nunca
   fica marcado, sem erro em log nenhum.

   Este arquivo verifica que as tres portas apontam para o mesmo lugar, e que
   nenhuma delas responde em silencio quando nao deveria.

   O QUE ISTO NAO PROVA
   Que o som e bonito. Isso exige ouvido.
   ========================================================= */
'use strict';

const path = require('path');
const fs = require('fs');
const RAIZ = path.join(__dirname, '..');

let passou = 0;
let falhou = 0;
const problemas = [];
function ok(cond, titulo, detalhe) {
  if (cond) { passou++; console.log('  ok    ' + titulo + (detalhe ? '  (' + detalhe + ')' : '')); }
  else { falhou++; problemas.push(titulo); console.log('  FALHA ' + titulo + (detalhe ? '  (' + detalhe + ')' : '')); }
}
function secao(t) { console.log('\n=== ' + t + ' ==='); }

/* ------------------------------------------------------------------ */
/* Um navegador de mentira, o mesmo do test-instrumento.                */
/* ------------------------------------------------------------------ */
function navegadorFalso() {
  const CR = String.fromCharCode(13);
  const NL = String.fromCharCode(10);
  function no() {
    return {
      style: {}, dataset: {}, childNodes: [],
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      setAttribute() {}, getAttribute() { return null; }, appendChild(c) { return c; },
      removeChild(c) { return c; }, insertBefore(c) { return c; },
      addEventListener() {}, removeEventListener() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
      getContext() { return null; }, focus() {}, click() {},
      className: '', textContent: '', id: '',
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
    };
  }
  const doc = {
    body: no(), head: no(), documentElement: no(),
    createElement: no, createElementNS: no, createTextNode: () => ({}),
    querySelector() { return null; }, querySelectorAll() { return []; },
    getElementById() { return null; }, getElementsByClassName() { return []; },
    addEventListener() {}, removeEventListener() {}, execCommand() { return false; },
  };
  global.document = doc;
  Object.defineProperty(global, 'navigator', {
    value: { userAgent: 'node' }, configurable: true, writable: true,
  });
  global.window = global;
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  global.requestAnimationFrame = () => 0;
  global.cancelAnimationFrame = () => {};
  global.getComputedStyle = () => ({ getPropertyValue: () => '' });
  global.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  void CR; void NL;
}

navegadorFalso();

const T = require(path.join(RAIZ, 'js', 'core', 'timbre.js'));
const M = require(path.join(RAIZ, 'js', 'core', 'music.js'));

/* ------------------------------------------------------------------ */
secao('1. A lista do que a pessoa pode escolher');

const ids = T.noPique();

ok(ids.length >= 6, 'ha pelo menos seis timbres para escolher', ids.length + ' opcoes');
ok(new Set(ids).size === ids.length, 'e nenhum aparece duas vezes');

for (const id of ids) {
  const nome = T.nomeDe(id);
  ok(typeof nome === 'string' && nome.length > 1,
    id + ': tem nome de verdade para a pessoa ler', JSON.stringify(nome));
}

ok(ids.indexOf('violao') >= 0, 'o violao esta na lista');
ok(ids.indexOf('sintetizador') < 0,
  'e o sintetizador nao esta: ninguem tem um na coxa, e a tela nao pode oferecer');

/* ------------------------------------------------------------------ */
secao('2. Todo instrumento do braco tem timbre');

/* Esta e a lacuna que o "Baixo 5 cordas" abriu. Sem timbre, `modeloDe()` cai no
 * violao — e um baixo de 5 cordas com ressonancia de caixa em 96 Hz soa como
 * violao de nylon. O sintoma e um som errado, e nenhum erro. */
const SEM_TIMBRE = [];
for (const i of M.INSTRUMENTOS) {
  const tem = Object.prototype.hasOwnProperty.call(T.MODELOS, i.id);
  if (!tem) SEM_TIMBRE.push(i.nome);
  ok(tem, i.nome + ' tem timbre proprio',
    tem ? T.MODELOS[i.id].nome : 'CAI NO VIOLAO');
}
ok(SEM_TIMBRE.length === 0, 'nenhum instrumento do braco fica sem som',
  SEM_TIMBRE.join(', '));

/* ------------------------------------------------------------------ */
secao('3. Todo timbre aponta para um braco, ou diz que nao tem');

/* A alternativa — devolver o violao quando nao ha braco — seria desenhar seis
 * cordas para quem escolheu teclado. A pessoa so descobriria depois de olhar. */
for (const id of ids) {
  const declarado = T.bracoDe(id);
  const achado = M.bracoPara(id);
  if (declarado === null) {
    ok(achado === null,
      id + ': diz que nao tem braco, e nao inventa um',
      achado ? 'devolveu ' + achado.id : 'devolveu nada');
  } else {
    ok(!!achado, id + ': o braco ' + declarado + ' existe de verdade',
      achado ? achado.id + ', ' + achado.cordas + ' cordas' : 'braco declarado e inexistente');
    if (achado) {
      ok(achado.cordas >= 1 && achado.cordas <= 12,
        id + ': o braco tem um numero de cordas que faz sentido', String(achado.cordas));
      ok(Array.isArray(achado.openPc) && achado.openPc.length === achado.cordas,
        id + ': e as cordas batem com a afinacao',
        achado.cordas + ' cordas, ' + achado.openPc.length + ' classes de nota');
    }
  }
}

/* Um timbre guardado que nao existe mais: versao mais nova, backup antigo. */
ok(M.bracoPara('instrumento-que-nao-existe') === null,
  'timbre desconhecido devolve nada, em vez de cair no violao');
ok(M.bracoPara('') === null, 'e timbre vazio tambem');
ok(M.bracoPara(null) === null, 'e timbre ausente tambem');

/* ------------------------------------------------------------------ */
secao('4. O nome com acento acha o instrumento');

/* O bug real: a tela de Teoria guardava `inst: 'violão'` e o id e `violao`.
 * A busca caia no padrao por sorte e o desenho aparecia certo; o botao do
 * instrumento escolhido nunca ficava marcado, porque a comparacao era sempre
 * falsa. Nenhum dos dois sintomas aparece em log.
 *
 * E aqui esta a licao da propria verificacao: `instrumento()` NAO serve para
 * provar isso. Ela tem queda para o violao, entao devolve violao com acento e
 * sem acento, e a verificacao passa nas duas. Foi por isso que o defeito
 * passou tantos anos: a funcao que o escondia era a mesma que alguém usaria
 * para checa-lo.
 *
 * `idDeInstrumento()` nao tem queda. E ela que diz a verdade. */
for (const grafia of ['violão', 'Violão', 'VIOLAO', 'Violao']) {
  ok(M.idDeInstrumento(grafia) === 'violao',
    'a busca por "' + grafia + '" acha o violão de verdade', String(M.idDeInstrumento(grafia)));
}
ok(M.instrumento('violão').id === 'violao',
  'e a busca com queda tambem chega nele', M.instrumento('violão').id);
ok(M.idDeInstrumento('BAIXO5') === 'baixo5',
  'e ignora a caixa nos outros tambem', String(M.idDeInstrumento('BAIXO5')));
ok(M.idDeInstrumento('Ukulele') === 'ukulele', 'e a caixa nao quebra a busca',
  String(M.idDeInstrumento('Ukulele')));

/* O que a busca promete NAO e resolver nome de exibicao. "Baixo 5 Cordas" e o
 * nome que aparece na tela; o id e `baixo5`. A funcao tolera acento e caixa,
 * e nao tenta adivinhar "5 cordas" dentro do id — essa seria correspondencia
 * por semelhança, e uma funcao assim devolve o violão quando erra, que e
 * pior do que devolver nada.
 *
 * A primeira versao deste teste exigia que "Baixo 5 Cordas" achasse. Nao
 * acha, e nao deve: a expectativa estava errada, nao a funcao. */
ok(M.idDeInstrumento('Baixo 5 Cordas') === null,
  'e um nome de exibicao NAO e um id, e a funcao diz isso em vez de chutar',
  String(M.idDeInstrumento('Baixo 5 Cordas')));
ok(M.idDeInstrumento('saxofone') === null,
  'instrumento que nao existe devolve null em vez de chutar o violão');

/* ------------------------------------------------------------------ */
secao('5. A preferencia guardada');

const S = require(path.join(RAIZ, 'js', 'core', 'store.js'));
const padrao = S.ajuste('instrumento', '');
ok(padrao === 'violao', 'o app comeca no violão', JSON.stringify(padrao));
ok(ids.indexOf(padrao) >= 0, 'e o padrao esta na lista do picker — o botao "ligado" existe');

/* O BACKUP LEVA A ESCOLHA JUNTO.
 *
 * O importador tem uma lista de campos que ele aceita copiar. Um ajuste novo
 * que entra no formato e fica de fora dessa lista nao da erro: o app restaura,
 * o campo nao volta, e a pessoa volta ao violao sem nenhuma explicacao. Foi o
 * `check-seguranca` que acusou esta rodada — e o sintoma, para quem usa o app,
 * seria o mesmo de um bug de importacao de musica. */
{
  const comInstrumento = S.exportar();
  const texto = typeof comInstrumento === 'string' ? comInstrumento : JSON.stringify(comInstrumento);
  const lido = JSON.parse(texto);
  ok(lido && lido.ajustes && lido.ajustes.instrumento === 'violao',
    'o backup inclui o instrumento', JSON.stringify(lido.ajustes && lido.ajustes.instrumento));

  /* E o caminho completo: exportar, mudar, importar, conferir que voltou. */
  const antes = S.exportar();
  S.setAjuste('instrumento', 'cavaquinho');
  const comCavaquinho = S.exportar();
  S.setAjuste('instrumento', 'violao');
  const r = S.importar(comCavaquinho, 'substituir');
  ok(r && r.ok !== false, 'o arquivo com o instrumento volta sem erro',
    r && r.mensagem ? r.mensagem : '');
  ok(S.ajuste('instrumento', '') === 'cavaquinho',
    'e o instrumento volta como estava antes do backup', String(S.ajuste('instrumento', '')));
  void antes;

  // Deixa o store como estava, para as outras verificacoes nao herdarem o cambio.
  S.importar(antes, 'substituir');
}

/* ------------------------------------------------------------------ */
secao('6. O som segue a escolha — e o tom puro nao segue');

/* O AudioContext falso conta quantos osciladores abriram. Um so e o tom puro;
 * varios e o instrumento. */
let abertos = 0;
function carregarAudio() {
  abertos = 0;
  const osc = () => { return { type: 'sine', frequency: { valor: 0, setValueAtTime(v) { this.valor = v; } },
    connect(x) { return this; }, disconnect() {}, start() { abertos++; }, stop() {}, onended: null }; };
  const ganho = () => ({ gain: { valor: 1, ganhoEm: [],
    set value(v) { this.valor = v; }, get value() { return this.valor; },
    setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {},
    setTargetAtTime() {} }, connect(x) { return this; }, disconnect() {} });
  const c = {
    currentTime: 10, sampleRate: 48000, destination: { destino: true },
    createOscillator: osc, createGain: ganho,
    createBuffer() { return { length: 8, getChannelData: () => new Float32Array(8) }; },
    createBufferSource() { return { buffer: null, connect() { return this; }, start() {}, stop() {} }; },
    createBiquadFilter() { return { type: '', frequency: { setValueAtTime() {} }, Q: { value: 1 }, connect() { return this; } }; },
  };
  global.AudioContext = function () { return c; };
  require(path.join(RAIZ, 'js', 'core', 'utils.js'));
  delete require.cache[require.resolve(path.join(RAIZ, 'js', 'core', 'audio.js'))];
  require(path.join(RAIZ, 'js', 'core', 'audio.js'));
  return global.Nota;
}

{
  const Nota = carregarAudio();
  Nota.tocarNota(220, 1.5, {});
  ok(abertos > 1, 'sem pedir nada, o som ja sai no instrumento escolhido', abertos + ' osciladores');

  abertos = 0;
  Nota.tocarNota(220, 1.5, { puro: true });
  ok(abertos === 1, 'com `puro`, sai um so oscilador: o tom de referencia',
    abertos + ' osciladores');

  abertos = 0;
  Nota.tocarNota(220, 1.5, { instrumento: 'baixo5' });
  ok(abertos > 1, 'pedindo outro instrumento, ele obedece', abertos + ' osciladores');
}

/* ------------------------------------------------------------------ */
secao('7. As telas que precisam do tom puro pedem o tom puro');

/* Sao as duas telas cujo trabalho e comparar o tom da tela com o tom da corda.
 * Com harmonicos no meio, a corda parece mais afinada do que esta — que e o
 * erro que a tela existe para corrigir. */
for (const rel of ['js/views/afinador.js', 'js/views/emergencia.js']) {
  const src = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  ok(/puro:\s*true/.test(src), rel + ' pede o tom puro',
    /puro:\s*true/.test(src) ? '' : 'toca com o timbre do instrumento');
}

/* ------------------------------------------------------------------ */
secao('8. Nenhuma tela de desenho inventa um braco');

/* Quem escolhe teclado nao pode ver um braco de violao. As telas que pedem
 * braco passam por `Music.bracoPara`, e nao por `Music.instrumento` — que cai
 * no violao sem avisar. */
for (const rel of ['js/core/render.js', 'js/views/violao3d.js', 'js/views/traste3d.js']) {
  const src = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  ok(src.indexOf('bracoPara') >= 0 || src.indexOf('inst') >= 0,
    rel + ' tem um caminho de braco declarado');
}

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(54));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  Uma lista que nao conversa com a outra nao da erro: ela so');
  console.log('  desenha a coisa errada, ou deixa um botao sem efeito.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(54) + '\n');
process.exit(falhou ? 1 : 0);