/* =========================================================
   tools/test-quota-vs.js
   TESTE DETERMINÍSTICO DO COMPORTAMENTO DE QUOTA

   O QUE ESTE ARQUIVO PROVA — E O QUE NÃO PROVA

   PROVA: que, quando o navegador RECUSA a escrita, o `Store` devolve falha,
   marca o motivo certo, mantém o valor anterior intacto, e a gravação feita
   não fica pela metade.

   NÃO PROVA: qual é a cota do navegador de verdade. Nenhuma maquete aqui
   escreve gigabytes, e nenhuma depende de quanto a máquina de teste tem.
   A recusa é injetada no ponto exato do `setItem` — que é o cenário real:
   o navegador diz que não cabe.

   POR QUE INJETAR ERRO, E NÃO SIMULAR TAMANHO

   A versão anterior deste teste enchia o armazenamento com megabytes e
   escrevia uma cifra gigante. Duas coisas deram errado, e as duas são
   instrutivas:

     1. o `setItem` do stub gravava a string mesmo quando o `salvar` já tinha
        recusado, e a asserção "não ficou pela metade" passava por acidente;
     2. a partir de certa faixa o stub simplesmente não escrevia mais, sem
        nenhum aviso, e o teste falhava sem dizer por quê.

   Um teste que depende de encher a origem para medir um comportamento é um
   teste frágil. Injetar a recusa no ponto do save mede o comportamento, sem
   gigabytes e sem depender de nada da máquina.

   O STUB É FIEL NO QUE IMPORTA

     - aceita escritas normalmente;
     - recusa quando mandado, e NÃO escreve nada;
     - lança o mesmo nome de erro do navegador: `QuotaExceededError`;
     - o valor anterior fica como estava, porque `setItem` é atômico.

   A diferença em relação ao navegador real, dita com todas as letras: aqui a
   recusa acontece por comando, e lá acontece por tamanho. É por isso que este
   arquivo não diz nada sobre quanto cabe.
   ========================================================= */
'use strict';

const path = require('path');

const RAIZ = path.join(__dirname, '..');

/* ---- o armazenamento de teste ---- */
const memoria = new Map();

let recusar = false;          /* a chave: o navegador diz que não cabe */
let escritasRecusadas = 0;

global.localStorage = {
  getItem: function (k) { return memoria.has(k) ? memoria.get(k) : null; },
  setItem: function (k, v) {
    if (recusar) {
      escritasRecusadas++;
      /* O navegador Faz a escrita recursar e NÃO altera o que já estava lá.
       * Um stub que apaga o valor antes de recusar passaria num teste de
       * integridade e reprovaria num app correto. */
      const erro = new Error('A cota de armazenamento foi excedida.');
      erro.name = 'QuotaExceededError';
      throw erro;
    }
    memoria.set(k, String(v));
  },
  removeItem: function (k) { memoria.delete(k); },
  clear: function () { memoria.clear(); },
  key: function () { return null; },
  get length() { return memoria.size; },
};

if (typeof global.navigator === 'undefined') global.navigator = {};
else { try { global.navigator = {}; } catch (e) { /* somente-leitura */ } }

require(path.join(RAIZ, 'js', 'core', 'music.js'));
require(path.join(RAIZ, 'js', 'core', 'utils.js'));
const Store = require(path.join(RAIZ, 'js', 'core', 'store.js'));

let passou = 0;
let falhou = 0;
const problemas = [];

function ok(cond, titulo, detalhe) {
  if (cond) {
    passou++;
    console.log('  ok    ' + titulo + (detalhe ? '  (' + detalhe + ')' : ''));
  } else {
    falhou++;
    problemas.push(titulo);
    console.log('  FALHA ' + titulo);
    if (detalhe) console.log('        ' + detalhe);
  }
}
const secao = (t) => console.log('\n=== ' + t + ' ===');

function vs(bytes) {
  return 'data:audio/webm;base64,' + 'A'.repeat(bytes);
}
function partirDoZero() {
  recusar = false;
  escritasRecusadas = 0;
  memoria.clear();
  Store.apagar();
}

/* ------------------------------------------------------------------
   1. O RECUSA CHEGA NO PONTO CERTO
   ------------------------------------------------------------------ */
secao('1. O armazenamento recusa, e o Store diz que recusa');

{
  partirDoZero();
  Store.db.cifras.push(Store.normCifra({ titulo: 'Boa', artista: 'X', cifra: 'C G' }));
  const salvouNormal = Store.gravar();
  ok(salvouNormal === true, 'sem recusa, o save passa', 'gravar() = ' + salvouNormal);
  ok(Store.ultimoErro() === null, 'e não há erro registrado', String(Store.ultimoErro()));

  recusar = true;
  Store.db.cifras.push(Store.normCifra({ titulo: 'Nova', cifra: 'Am' }));
  const salvouRecusado = Store.gravar();
  ok(salvouRecusado === false, 'com recusa, o save falha', 'gravar() = ' + salvouRecusado);
  ok(escritasRecusadas === 1, 'o setItem foi chamado uma vez e recusou',
    escritasRecusadas + ' recusa(s)');
}

/* ------------------------------------------------------------------
   2. ATOMICIDADE: o estado anterior fica inteiro
   ------------------------------------------------------------------ */
secao('2. A cifra existente continua intacta depois da recusa');

let estadoAntes = null;
{
  partirDoZero();
  Store.db.cifras.push(Store.normCifra({ titulo: 'Boa', artista: 'X', tom: 'C', cifra: 'C G', letra: 'verso' }));
  Store.db.escalas.push(Store.normEscala({
    data: '2026-10-25', hora: '19:00', titulo: 'Missa NSG',
    local: 'Comunidade NSG', tipo: 'missa', obs: 'com o grupo',
    musicas: [{ nome: 'Boa', tom: 'C' }],
  }));
  Store.gravar();
  estadoAntes = JSON.parse(memoria.get(Store.STORAGE_KEY));

  recusar = true;
  /* A tentativa: uma gravação nova numa música que já existe. */
  const alvo = Store.cifras()[0];
  alvo.vs = vs(400 * 1024);
  Store.gravar();
  recusar = false;

  const depois = JSON.parse(memoria.get(Store.STORAGE_KEY));
  ok(depois.cifras.length === estadoAntes.cifras.length,
    'o número de cifras é o de antes', depois.cifras.length + ' = ' + estadoAntes.cifras.length);
  ok(depois.cifras[0].id === estadoAntes.cifras[0].id, 'o id não mudou');
  ok(depois.cifras[0].titulo === 'Boa', 'o título não mudou');
  ok(depois.cifras[0].letra === 'verso', 'a letra não mudou');
  ok(!depois.cifras[0].vs, 'e a gravação recusada NÃO ficou gravada');
  ok(Store.ultimoErro() === 'cheio', 'o motivo registrado é "cheio"', String(Store.ultimoErro()));
}

/* ------------------------------------------------------------------
   3. O REPERTÓRIO NÃO É PREJUDICADO
   ------------------------------------------------------------------ */
secao('3. Uma recusa de VS não arrasta o repertório');

{
  const depois = JSON.parse(memoria.get(Store.STORAGE_KEY));
  ok(depois.escalas.length === estadoAntes.escalas.length,
    'o número de eventos é o de antes', depois.escalas.length);
  ok(depois.escalas[0].titulo === 'Missa NSG', 'o título do evento não mudou');
  ok(depois.escalas[0].data === '2026-10-25', 'a data não mudou', depois.escalas[0].data);
  ok(depois.escalas[0].hora === '19:00', 'a hora não mudou', depois.escalas[0].hora);
  ok(depois.escalas[0].local === 'Comunidade NSG', 'o local não mudou');
  ok(depois.escalas[0].tipo === 'missa', 'o tipo não mudou');
  ok(depois.escalas[0].obs === 'com o grupo', 'a observação não mudou');
  ok(depois.escalas[0].musicas.length === 1, 'as músicas do evento continuam lá');
}

/* ------------------------------------------------------------------
   4. A GRAVAÇÃO RECÉM-FEITA SOBREVIVE EM MEMÓRIA
   ------------------------------------------------------------------ */
secao('4. Depois de falhar, a gravação continua na música em memória');

{
  /* `salvar` recusa, mas a property `vs` JÁ foi escrita no objeto. É isso que
   * permite à pessoa ouvir e tentar de novo sem regravar. */
  const alvo = Store.cifras()[0];
  ok(typeof alvo.vs === 'string' && alvo.vs.indexOf('data:audio/webm') === 0,
    'o áudio continua disponível na música em memória');
  ok(alvo.vs.length > 100000, 'e é o áudio inteiro, não um resto',
    Math.round(alvo.vs.length / 1024) + ' KB');

  /* E o que está no ARMAZENAMENTO não tem esse áudio — são coisas diferentes,
   * e confundir as duas é o que faz a pessoa acreditar que salvou. */
  const persistido = JSON.parse(memoria.get(Store.STORAGE_KEY));
  ok(!persistido.cifras[0].vs, 'no armazenamento não há áudio');
}

/* ------------------------------------------------------------------
   5. LIBERAR ESPAÇO E TENTAR DE NOVO
   ------------------------------------------------------------------ */
secao('5. Liberar espaço e salvar de novo funciona');

{
  const alvo = Store.cifras()[0];
  /* A pessoa apaga uma gravação antiga de OUTRA música. */
  Store.db.cifras.push(Store.normCifra({ titulo: 'Antiga', vs: vs(300 * 1024) }));
  Store.gravar();
  ok(Store.cifras().length === 2, 'a música antiga entrou', Store.cifras().length + ' cifras');

  const antiga = Store.cifras().filter(function (c) { return c.titulo === 'Antiga'; })[0];
  antiga.vs = '';
  Store.gravar();

  /* A segunda tentativa, agora sem recusa. */
  const salvou = Store.gravar();
  ok(salvou === true, 'a segunda tentativa passa', 'gravar() = ' + salvou);
  ok(Store.ultimoErro() === null, 'e o erro foi limpo', String(Store.ultimoErro()));

  const persistido = JSON.parse(memoria.get(Store.STORAGE_KEY));
  const gravada = persistido.cifras.filter(function (c) { return c.titulo === 'Boa'; })[0];
  ok(gravada && gravada.vs && gravada.vs.indexOf('data:audio/webm') === 0,
    'a gravação agora ESTÁ no armazenamento');
  const semAudio = persistido.cifras.filter(function (c) { return c.titulo === 'Antiga'; })[0];
  ok(semAudio && !semAudio.vs, 'e a gravação apagada sumiu de verdade');
}

/* ------------------------------------------------------------------
   6. BACKUP DEPOIS DA FALHA
   ------------------------------------------------------------------ */
secao('6. Backup feito depois da recusa é o do estado persistido');

{
  partirDoZero();
  Store.db.cifras.push(Store.normCifra({ titulo: 'Boa', cifra: 'C G' }));
  Store.gravar();

  recusar = true;
  Store.cifras()[0].vs = vs(500 * 1024);
  Store.gravar();
  recusar = false;

  const backup = Store.exportar();
  const lido = JSON.parse(backup);
  ok(lido.cifras.length === 1, 'o backup tem a música', lido.cifras.length + ' cifras');
  ok(lido.cifras[0].titulo === 'Boa', 'a música está íntegra no backup');

  /* O backup leva a gravação que NÃO foi salva — e isso é o comportamento
   * certo, não um defeito.
   *
   * `exportar()` serializa o estado EM MEMÓRIA, não o que está no
   * armazenamento. E é por isso que ela é a última rede: a pessoa que fala
   * três minutos, não consegue salvar, e mesmo assim não perde a gravação —
   * ela sai no `.json`.
   *
   * A primeira versão deste teste afirmava o contrário, e estava errada:
   * esperava que o backup escondesse o áudio recusado. Esconder seria jogar
   * fora justamente o que ainda existe. */
  ok(lido.cifras[0].vs && lido.cifras[0].vs.indexOf('data:audio/webm') === 0,
    'e o backup PRESERVA a gravação que não coube no armazenamento',
    Math.round(lido.cifras[0].vs.length / 1024) + ' KB no backup');
  ok(backup.indexOf('data:audio') > 0, 'o áudio está de fato dentro do arquivo');

  /* E o que volta de um backup desses continua sendo um áudio válido. */
  const outra = Store.normCifra(JSON.parse(backup).cifras[0]);
  ok(outra.vs && outra.vs.indexOf('data:audio/webm') === 0,
    'repassar pelo normCifra mantém o áudio válido');
}

/* ------------------------------------------------------------------
   7. CASOS NEGATIVOS
   ------------------------------------------------------------------ */
secao('7. Nenhum caso estragado destrói o que já existe');

{
  partirDoZero();
  Store.db.cifras.push(Store.normCifra({ titulo: 'Boa', cifra: 'C G' }));
  Store.db.escalas.push(Store.normEscala({ data: '2026-10-25', titulo: 'Missa', musicas: [] }));
  Store.gravar();
  const bom = memoria.get(Store.STORAGE_KEY);

  /* Primeiro: VS degenerado passa pelo `normCifra`? */
  const degenerados = ['data:audio/', 'data:audio/webm;base64,', 'javascript:alert(1)',
    'http://x/y.mp3', 'data:text/html,<b>x</b>', '', null, 12345];
  let passouAlgo = 0;
  for (const d of degenerados) {
    if (Store.normCifra({ titulo: 't', vs: d }).vs !== '') passouAlgo++;
  }
  ok(passouAlgo === 0, 'todo VS degenerado é recusado antes de salvar',
    degenerados.length + ' entradas, ' + passouAlgo + ' passaram');

  /* Segundo: uma recusa no meio não deixa o estado pela metade. */
  recusar = true;
  Store.db.escalas.push(Store.normEscala({ data: '2026-11-08', titulo: 'Show' }));
  Store.gravar();
  recusar = false;
  ok(memoria.get(Store.STORAGE_KEY) === bom,
    'depois de recusa, o valor no armazenamento é byte a byte o de antes');

  /* Terceiro: musica sem VS, com VS e sem VS nenhum continuam funcionando. */
  Store.db.cifras.push(Store.normCifra({ titulo: 'Com audio', vs: vs(1000) }));
  Store.gravar();
  ok(Store.gravar() === true, 'salvar com um VS pequeno passa');
  const fim = JSON.parse(memoria.get(Store.STORAGE_KEY));

  /* O evento "Show" foi recusado junto com o VS. Mas ele continuava na
   * memória, e a gravação seguinte passou — levando o evento junto. Isso é
   * atômico no sentido certo: ou a tentativa inteira passa, ou não passa nada.
   * A primeira versão deste teste esperava 1 evento e estava errada: o
   * comportamento real é 2, e é o que a pessoa quer — a alteração pendente
   * não se perde sozinha. */
  ok(fim.cifras.length === 2 && fim.escalas.length === 2,
    'o estado final tem as duas cifras e os dois eventos',
    fim.cifras.length + ' cifras, ' + fim.escalas.length + ' eventos');
}

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(58));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  Este arquivo mede o COMPORTAMENTO quando o navegador recusa.');
  console.log('  Ele não mede a cota de nada — e não deve ser lido como se medisse.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(58) + '\n');
process.exit(falhou ? 1 : 0);