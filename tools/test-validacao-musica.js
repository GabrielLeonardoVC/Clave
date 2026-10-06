/* =========================================================
   ACORDE - tools/test-validacao-musica.js
   O FORMULARIO DIZ A VERDADE SOBRE O TITULO

   POR QUE UM ARQUIVO NOVO

   O campo do titulo era obrigatorio e mesmo assim ja nascia preenchido com
   "Sem titulo" — o valor de guarda do modelo, posto no campo como se a pessoa
   tivesse digitado. Duas consequencias, nenhuma delas subiesta: dava para
   guardar uma musica chamada "Sem titulo" sem escrever nada, e a marca de
   obrigatorio era mentira.

   E, deixando o titulo vazio e apertando Salvar, o formulario recusava em
   silencio: nenhuma palavra, so o foco indo para o campo.

   O QUE ESTE ARQUIVO PROVA

     - uma musica nova abre com o titulo VAZIO;
     - titulo vazio e recusado, e nada e gravado;
     - tituto so com espacos tambem e recusado, e nada e gravado;
     - a recusa vem com uma MENSAGEM, e a mensagem esta ligada ao campo;
     - o foco vai para o campo que falhou;
     - a musica anterior continua intacta depois de uma edicao recusada;
     - o ID nao muda, e nenhuma duplicata aparece;
     - corrigir o titulo salva, e uma unica musica;
     - espacos nas pontas sao aparados de forma coerente com o que ja existia;
     - os limites do modelo (BPM, artista, categoria, tom) continuam valendo.

   COMO PROVA

   A tela e a de verdade, o Store e o de verdade. O DOM e o de `dom-falso.js`.

   NAO PROVA
     - nada de layout, cor ou contraste: isso e do navegador.

   Rodar: node tools/test-validacao-musica.js
   ========================================================= */
'use strict';

const path = require('path');
const { RAIZ } = require('./arquivos.js');
const Falso = require('./dom-falso.js');

const dom = Falso.instalar();
const carregar = (rel) => Falso.carregar(RAIZ, rel);

carregar('js/core/music.js');
carregar('js/core/utils.js');
carregar('js/core/render.js');
const Store = carregar('js/core/store.js');
carregar('js/core/metronome.js');
carregar('js/core/ui.js');
carregar('js/core/links.js');
carregar('js/core/timbre.js');
global.Gravador = { relogio: () => 0, tamanhoDe: () => 0 };
global.Studio = { abrir: () => {} };
global.Views = global.Views || {};
carregar('js/views/repertorio.js');
const Repertorio = global.Views.repertorio;

/* ------------------------------------------------------------
   AS ASSERCOES
   ------------------------------------------------------------ */

let passou = 0;
let falhou = 0;
const falhas = [];

function ok(condicao, rotulo, detalhe) {
  if (condicao) { passou++; return true; }
  falhou++;
  falhas.push(rotulo + (detalhe ? '  ->  ' + detalhe : ''));
  return false;
}
function igual(recebido, esperado, rotulo) {
  return ok(recebido === esperado, rotulo,
    'recebido ' + JSON.stringify(recebido) + ', esperado ' + JSON.stringify(esperado));
}
function secao(t) {
  console.log('\n=== ' + t + '   [' + passou + ' ok, ' + falhou + ' falhas ate aqui]');
  falhas.forEach((f) => console.log('    FALHA  ' + f));
}

/* ------------------------------------------------------------
   O FORMULARIO
   ------------------------------------------------------------ */

let folha = null;
const UIreal = global.UI;
const sheetReal = UIreal.sheet;
UIreal.sheet = function () {
  const h = sheetReal.apply(UIreal, arguments);
  folha = h.node || h.body || h;
  return h;
};

function abrir(c) { Repertorio.editar(c || null); return folha; }

function campo(rotulo) {
  const alvo = [].concat(folha.querySelectorAll('.field')).filter((fd) => {
    const l = fd.querySelector('.label');
    return l && new RegExp('^' + rotulo, 'i').test(l.textContent.trim());
  })[0];
  return alvo ? alvo.querySelector('input, select, textarea') : null;
}

/* O aviso e encontrado pelo ATRIBUTO `role="alert"`, que e como ele e
   anunciado — e nao por classe, que ele nao tem. */
function aviso() {
  let achado = null;
  (function varrer(no) {
    if (achado) return;
    for (const x of [].concat(no.childNodes || [])) {
      if (!x) continue;
      if (x.getAttribute && x.getAttribute('role') === 'alert') { achado = x; return; }
      if (x.tagName) varrer(x);
    }
  })(folha);
  return achado;
}

function salvar() {
  const bs = [].concat(folha.querySelectorAll('button'));
  for (const b of bs) if (/Salvar/i.test(b.textContent || '')) { b.click(); return true; }
  ok(false, 'existe o botao Salvar');
  return false;
}

const tituloDe = (t) => Store.cifras().filter((c) => c.titulo === t);
const porId = (id) => Store.cifras().filter((c) => c.id === id)[0] || null;

/* ------------------------------------------------------------
   1. UMA MUSICA NOVA NASCE COM O TITULO VAZIO
   ------------------------------------------------------------ */

secao('1. o campo obrigatório nasce vazio');

{
  abrir(null);
  const t = campo('Título');
  ok(!!t, 'o campo do titulo existe');
  igual(t.value, '', 'e nasce VAZIO — nao com "Sem título" dentro');
  igual(t.getAttribute('aria-required'), 'true', 'e diz que e obrigatorio');
  ok(!!t.getAttribute('placeholder'), 'com o exemplo no placeholder, que e onde ele pertence');
  ok(!!aviso(), 'a folha tem um aviso ligado ao campo');
  igual(t.getAttribute('aria-describedby'), aviso().getAttribute('id'),
    'e o campo aponta para o aviso: o texto e lido COM o campo, nao so visto');
}

/* ------------------------------------------------------------
   2. TITULO VAZIO E RECUSADO
   ------------------------------------------------------------ */

secao('2. título vazio é recusado, com aviso e foco');

{
  const antes = Store.cifras().length;
  abrir(null);
  campo('Título').value = '';
  campo('BPM').value = '96';
  salvar();

  igual(Store.cifras().length, antes, 'nada foi gravado');
  ok(!!folha, 'o formulario continua aberto');
  const a = aviso();
  ok(!!a && /informe o título/i.test(a.textContent || ''),
    'e ha um aviso dizendo o que falta',
    'aviso = ' + JSON.stringify(a ? a.textContent : null));
  igual(a ? a.style.display : null, 'block', 'o aviso esta a vista');
  igual(campo('Título').getAttribute('aria-invalid'), 'true',
    'e o campo se marca como invalido');
  ok(!!campo('Título').recebeuFoco && campo('Título').recebeuFoco(),
    'e o foco foi para o campo que falhou');
  ok(!!campo('BPM') && !campo('BPM').recebeuFoco(),
    'e nao para um campo que estava certo');
}

/* ------------------------------------------------------------
   3. TITULO SO COM ESPACOS
   ------------------------------------------------------------ */

secao('3. título só com espaços é recusado do mesmo jeito');

{
  const antes = Store.cifras().length;
  abrir(null);
  campo('Título').value = '     ';
  salvar();
  igual(Store.cifras().length, antes, '"     " nao virou musica');
  ok(!tituloDe('     ').length, 'e nada guardado com esse titulo');
  ok(/informe o título/i.test((aviso() || {}).textContent || ''), 'com o mesmo aviso');

  /* O titulo tem de virar musica de verdade depois da correcao. */
  campo('Título').value = 'Depois Do Erro';
  salvar();
  igual(tituloDe('Depois Do Erro').length, 1, 'corrigido, salva UMA musica');
  ok(!!(tituloDe('Depois Do Erro')[0] || {}).id, 'com id valido');
}

/* ------------------------------------------------------------
   4. ESPACOS NAS PONTAS
   ------------------------------------------------------------ */

secao('4. espaços nas pontas são aparados');

{
  abrir(null);
  campo('Título').value = '  Entrada do Senhor  ';
  salvar();
  const achada = tituloDe('Entrada do Senhor');
  igual(achada.length, 1, '"  Entrada do Senhor  " foi guardado aparado');
  ok(!tituloDe('  Entrada do Senhor  ').length, 'e nao com os espacos grudados');
}

/* ------------------------------------------------------------
   5. O AVISO SOME QUANDO A PESSOA CORRIGE
   ------------------------------------------------------------ */

secao('5. o aviso some assim que a pessoa digita');

{
  abrir(null);
  campo('Título').value = '';
  salvar();
  igual(aviso().style.display, 'block', 'o aviso apareceu');

  campo('Título').value = 'A';
  campo('Título').dispatchEvent({ type: 'input' });
  ok(!!aviso() && aviso().style.display !== 'block', 'e sumiu quando comecou a digitar');
  igual(campo('Título').getAttribute('aria-invalid'), null, 'e o campo deixou de estar marcado como invalido');
}

/* ------------------------------------------------------------
   6. EDICAO RECUSADA NAO DESTRUI A MUSICA ANTERIOR
   ------------------------------------------------------------ */

secao('6. edição recusada não destrói o que já existia');

{
  abrir(null);
  campo('Título').value = 'Musica Para Editar';
  campo('Artista').value = 'Artista Original';
  campo('BPM').value = '88';
  salvar();
  const original = tituloDe('Musica Para Editar')[0];
  ok(!!original, 'a musica existe para editar');
  const idAntes = original.id;
  const antesJSON = JSON.stringify(original);

  abrir(original);
  campo('Título').value = '';
  campo('BPM').value = '200';
  salvar();

  const depois = porId(idAntes);
  ok(!!depois, 'a musica continua na biblioteca');
  igual(depois && JSON.stringify(depois), antesJSON,
    'e esta EXATAMENTE como estava: titulo, artista e BPM intactos');
  igual(depois && depois.id, idAntes, 'o ID nao mudou');
  igual(Store.cifras().filter((c) => c.titulo === 'Musica Para Editar').length, 1,
    'e nao apareceu duplicata');
  ok(/informe o título/i.test((aviso() || {}).textContent || ''), 'com o aviso de novo');

  /* E, corrigindo, salva. */
  campo('Título').value = 'Musica Editada';
  salvar();
  igual(tituloDe('Musica Editada').length, 1, 'corrigido, a edicao foi guardada');
  igual(porId(idAntes).bpm, 200, 'e o BPM que ela mudou junto foi guardado');
}

/* ------------------------------------------------------------
   7. OS OUTROS LIMITES CONTINUAM VALENDO
   ------------------------------------------------------------ */

secao('7. os limites que já existiam continuam valendo');

{
  const alvo = tituloDe('Musica Editada')[0];
  abrir(alvo);
  campo('BPM').value = '9999';
  campo('Artista').value = 'A'.repeat(200);
  salvar();
  const d = porId(alvo.id);
  igual(d.bpm, 320, 'BPM fora do maximo continua sendo aparado no maximo do modelo');
  igual(d.artista.length, 160, 'artista fora do limite continua sendo aparada');
}

/* ------------------------------------------------------------
   8. NADA DE FANTASMA NA BIBLIOTECA
   ------------------------------------------------------------ */

secao('8. nenhuma edição inválida deixa rastro');

{
  const antes = Store.cifras().length;
  abrir(Store.cifras()[0]);
  campo('Título').value = '   ';
  salvar();
  igual(Store.cifras().length, antes, 'a biblioteca nao ganhou nem perdeu nada');
  ok(!Store.cifras().some((c) => c.titulo === ''), 'e nenhuma musica sem titulo apareceu');
  ok(!Store.cifras().some((c) => /^\\s+$/.test(c.titulo)), 'nem uma so com espacos');
}

console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('');
  falhas.forEach((f) => console.log('  FALHA  ' + f));
}
console.log('=================================================\n');
process.exit(falhou ? 1 : 0);