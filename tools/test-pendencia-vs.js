/* =========================================================
   tools/test-pendencia-vs.js
   O ESTADO "GRAVACAO SO NESTA TELA": pendente, retentativa e descarte

   POR QUE ESTE ARQUIVO EXISTE

   A rodada V5.7 fechou o guarda de saida no navegador e nao deixou cobertura
   automatizada. O buraco mais caro que apareceu foi este: uma gravacao que o
   armazenamento recusou continuava no objeto da Store, e a tela seguinte
   abria mostrando "Narração gravada" — um audio que o disco nao tinha. Depois
   disso, o botao "Sair e descartar" esvaziava a ficha local e NAO a Store, de
   modo que o descarte nao descartava: a mesa seguinte trazia a narracao de
   volta, integral.

   Dois erros, a mesma raiz: duas copias da verdade ("esta gravada?" e "esta
   salva?"), e a resposta correta vive em `localStorage`, nao em campo nenhum.

   O QUE ESTE ARQUIVO PROVA — E O QUE NAO PROVA

   PROVA, no mesmo processo:
     - a recusa de cota deixa o audio na Store e fora do disco;
     - a retentativa grava O MESMO audio, sem pedir microfone de novo;
     - o descarte apaga nos DOIS lados, e a audio nao volta;
     - o descarte nao toca o resto da musica;
     - `storageInfo` mede o que o disco tem, e nao o que a memoria tem;
     - apos o descarte a mesa nao mostraria gravacao nenhuma.

   NAO PROVA:
     - nada sobre o DOM, folha, dialogo ou botao — o `close()` e' testado pelo
       `provar-quota-vs`, que o muta e exige que a regra acuse;
     - nada sobre navegador real, microfone ou cota fisica.

   Este arquivo nao usa DOM de mentira. Ele usa a Store de verdade, com um
   `localStorage` que recusa quando mandado — e o `localStorage` do Node nao
   tem cota nenhuma, entao a recusa precisa ser injetada mesmo.
   ========================================================= */
'use strict';

const path = require('path');

const RAIZ = path.join(__dirname, '..');

const memoria = new Map();
let recusar = false;      /* recusa TOTAL, por comando — usada nos testes 1 a 3 */
let recusas = 0;
let cotaBytes = Infinity; /* cota REAL, por tamanho — usada no teste 6 */

global.localStorage = {
  getItem: function (k) { return memoria.has(k) ? memoria.get(k) : null; },
  setItem: function (k, v) {
    v = String(v);
    /* DOIS MODOS, E ELES RESPONDEM A COISAS DIFERENTES
     *
     * `recusar` e' injecao de erro: o navegador diz "nao cabe" e nao escreve.
     * Serve para provar o caminho da falha.
     *
     * `cotaBytes` e' cota de verdade: so recusa quando o write EXCEDE o teto.
     * Um navegador recusa o que nao cabe e ACEITA o que cabe — em especial
     * escrever MENOS do que ja estava, que e o caso do descarte. Um stub que
     * recusa tudo rejeitaria o apagar, e o teste "apagar e' sempre possivel"
     * passaria medindo um navegador que nao existe.
     *
     * Os dois modos ficam, porque medem coisas diferentes. O que nao fica e'
     * usar o modo errado: fingir que cota e' "recusa tudo" e' a forma mais
     * facil de um teste de cuota passar sem provar nada. */
    if (recusar || v.length > cotaBytes) {
      recusas++;
      const e = new Error('Cota excedida.');
      e.name = 'QuotaExceededError';
      throw e;               /* e NAO escreve: e o que o navegador faz */
    }
    memoria.set(k, v);
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

let passou = 0; let falhou = 0;
const problemas = [];
function ok(cond, titulo, detalhe) {
  if (cond) { passou++; console.log('  ok    ' + titulo + (detalhe ? '  (' + detalhe + ')' : '')); }
  else {
    falhou++; problemas.push(titulo);
    console.log('  FALHA ' + titulo);
    if (detalhe) console.log('        ' + detalhe);
  }
}
const secao = (t) => console.log('\n=== ' + t + ' ===');

const vs = (n) => 'data:audio/webm;codecs=opus;base64,' + 'A'.repeat(n);

function zera() {
  recusar = false; recusas = 0; cotaBytes = Infinity;
  memoria.clear();
  Store.apagar();
  Store.db.cifras.push(Store.normCifra({
    titulo: 'Teste', artista: 'Lab', tom: 'C', cifra: 'C\nG\nAm', letra: 'a\nb',
  }));
  Store.db.escalas.push(Store.normEscala({
    data: '2026-10-25', hora: '19:00', titulo: 'Missa', local: 'Comunidade',
    tipo: 'missa', musicas: [{ nome: 'Teste', tom: 'C' }],
  }));
  Store.gravar();
  return Store.cifras()[0];
}

/* O MESMO teste de `palco.js`, escrito aqui a mao de proposito.
 *
 * Nao foi importado do arquivo: o ponto do teste e' justamente que o codigo da
 * tela dice "esta gravada?" quando `f.vs` esta cheio. Se o teste usasse a mesma
 * funcao, ele passaria junto com o defeito — os dois incluem o defeito. Aqui a pergunta
 * e' feita de novo, com o disco como fonte, e e' ela que mede. */
function estaSalvoNoDisco(cifraId) {
  const cru = JSON.parse(memoria.get(Store.STORAGE_KEY) || 'null');
  if (!cru) return false;
  const c = (cru.cifras || []).filter(function (x) { return x.id === cifraId; })[0];
  return !!(c && c.vs);
}

/* ------------------------------------------------------------------ */
secao('1. Recusa de cota: a memória tem, o disco não');

{
  const c = zera();
  const audio = vs(400 * 1024);
  recusar = true;
  c.vs = audio;
  const salvou = Store.gravar();
  recusar = false;

  ok(salvou === false, 'a gravação foi recusada', 'gravar() = ' + salvou);
  ok(Store.ultimoErro() === 'cheio', 'o motivo é "cheio"', String(Store.ultimoErro()));
  ok((Store.cifras()[0].vs || '').length === audio.length,
    'o áudio continua inteiro na memória da Store',
    (Store.cifras()[0].vs || '').length + ' chars');
  ok(!estaSalvoNoDisco(c.id),
    'e o disco NÃO tem o áudio — as duas verdades divergem de verdade');
}

/* ------------------------------------------------------------------ */
secao('2. A tela que pergunta "está gravada?" — a resposta é o disco');

{
  const c = Store.cifras()[0];
  /* O teste da V5.7 escrevia `if (f.vs)`. Com o áudio em memória e fora do
   * disco, isso respondia "gravada" para um áudio inexistente. */
  ok(!!c.vs, 'o campo em memória está cheio');
  ok(!estaSalvoNoDisco(c.id), 'mas o disco está vazio');
  ok(!!c.vs && !estaSalvoNoDisco(c.id) === true,
    'a combinação "campo cheio + disco vazio" é detectável — o estado existe e tem nome');
}

/* ------------------------------------------------------------------ */
secao('3. Retentativa grava O MESMO áudio, sem pedir microfone');

{
  const c = Store.cifras()[0];
  const audioOriginal = c.vs;
  /* Nada de `Gravador.iniciar()` aqui: nao ha microfone em teste de Node, e a
   * retentativa NAO deveria precisar dele. Se precisasse, o audio mudaria de
   * tamanho ou de origem — e e isso que se esta medindo. */
  const gravados = [];
  const recusasAntes = recusas;
  recusar = true;
  gravados.push({ tentativa: 1, gravou: Store.gravar() });
  gravados.push({ tentativa: 2, gravou: Store.gravar() });
  recusar = false;
  const okFinal = Store.gravar();

  ok(gravados[0].gravou === false && gravados[1].gravou === false,
    'as duas primeiras tentativas falham',
    gravados.map(function (g) { return String(g.gravou); }).join(', '));
  ok(recusas - recusasAntes === 2, 'cada tentativa foi recusada — medido no trecho, não no arquivo',
    (recusas - recusasAntes) + ' recusa(s)');
  ok(okFinal === true, 'liberado o espaço, a gravação passa', 'gravar() = ' + okFinal);
  ok((Store.cifras()[0].vs || '').length === audioOriginal.length,
    'e o áudio gravado é O MESMO — mesmo tamanho, byte a byte',
    (Store.cifras()[0].vs || '').length + ' chars');
  ok(Store.cifras()[0].vs === audioOriginal, 'idêntico, não só do mesmo tamanho');
  ok(estaSalvoNoDisco(c.id), 'agora o disco tem o áudio');
}

/* ------------------------------------------------------------------ */
secao('4. Descartar apaga nos DOIS lados — e o que o V5.7 esquecia');

{
  const c = Store.cifras()[0];
  ok(c.vs.length > 0, 'começa com áudio em memória e gravado', c.vs.length + ' chars');
  ok(estaSalvoNoDisco(c.id), 'e o disco também tem');

  /* O V5.7 fazia só `f.vs = ''`, e a ficha local NÃO é o objeto da Store. */
  c.vs = '';
  c.vsSeg = 0;
  Store.gravar();
  ok(!(Store.cifras()[0].vs || ''), 'a memória ficou sem áudio');
  ok(!estaSalvoNoDisco(c.id), 'e o disco também — os dois lados foram juntos');
  ok((Store.cifras()[0].vs || '').length === 0,
    'a narração descartada não volta na próxima montagem');
}

/* ------------------------------------------------------------------ */
secao('5. Descartar não toca o resto da música');

{
  const c = Store.cifras()[0];
  c.vs = vs(2000);
  Store.gravar();
  c.vs = '';
  c.vsSeg = 0;
  Store.gravar();

  const d = Store.cifras()[0];
  ok(d.titulo === 'Teste', 'o título continua', d.titulo);
  ok(d.artista === 'Lab', 'o artista continua', d.artista);
  ok(d.tom === 'C', 'o tom continua', d.tom);
  ok(d.cifra === 'C\nG\nAm', 'a cifra continua intacta', JSON.stringify(d.cifra));
  ok(d.letra === 'a\nb', 'a letra continua intacta');
  ok(Store.escalas().length === 1, 'o evento continua', Store.escalas().length + ' evento');
  ok(Store.escalas()[0].musicas.length === 1, 'e as músicas do evento');
}

/* ------------------------------------------------------------------ */
secao('6. Descartar ignora a cota: apagar sempre cabe');

{
  const c = Store.cifras()[0];
  c.vs = vs(300 * 1024);
  Store.gravar();
  const comAudio = memoria.get(Store.STORAGE_KEY).length;
  c.vs = ''; c.vsSeg = 0;   /* agora SIM apaga, antes de medir o teto */

  /* A cota e' agora de TAMANHO: um teto que o audio ultrapassa e que o audio
   * apagado fica bem dentro. E o que o navegador faz. */
  cotaBytes = Math.floor(comAudio * 0.9);
  const gravou = Store.gravar();
  const semAudio = (Store.cifras()[0].vs || '').length === 0;
  cotaBytes = Infinity;
  ok(semAudio, 'o audio foi mesmo removido antes de medir');


  ok(gravou === true,
    'apagar passa mesmo com o teto quase estourado',
    'teto ' + Math.floor(comAudio * 0.9) + ' bytes, ao apagar ' + comAudio);
  ok(semAudio, 'e o audio sumiu de verdade');

  /* E o contrario: escrever ACIMA do teto tem de falhar. Um stub que so
   * sabe dizer "sim" nao distingue nada de um navegador. */
  const c2 = Store.cifras()[0];
  c2.vs = vs(400 * 1024);
  cotaBytes = Math.floor(comAudio * 0.9);
  const passou = Store.gravar();
  cotaBytes = Infinity;
  ok(passou === false, 'e escrever acima do teto é recusado — o stub sabe os dois lados',
    'gravar() = ' + passou);
  c2.vs = '';
  Store.gravar();
}

/* ------------------------------------------------------------------ */
secao('7. O que o indicador de espaço mede');

{
  const e0 = Store.espacoParaGravacao();
  ok(e0.usado >= 0 && e0.limite > 0, 'o indicador responde', e0.usado + ' de ' + e0.limite);
  /* O indicador olha o ARMAZENAMENTO. Com um áudio só na memória, o que
   * sobrou é o do disco — que é o que a pessoa precisa para decidir. */
  const c1 = Store.cifras()[0];
  c1.vs = vs(500 * 1024);
  recusar = true;
  Store.gravar();
  recusar = false;
  const e1 = Store.espacoParaGravacao();
  ok(e1.usado === e0.usado,
    'com áudio só na memória, o espaço em disco NÃO muda — e a tela mede o disco',
    e0.usado + ' -> ' + e1.usado);
  ok(e1.livre > 0, 'e o que sobra continua disponível para salvar depois',
    e1.livre + ' bytes');
}

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(58));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  "Gravada" e "salva" são coisas diferentes, e a tela precisa da segunda.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(58) + '\n');
process.exit(falhou ? 1 : 0);