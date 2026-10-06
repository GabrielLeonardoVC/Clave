/* =========================================================
   ACORDE - tools/test-foto-biblioteca.js
   A FOTO DA CIFRA EXISTENTE PELA BIBLIOTECA

   POR QUE UM ARQUIVO NOVO

   A V6.9 provou que a foto entrava, era processada, persistia e sobrevivia ao
   reload. E provou tambem o contrario, que importava mais: que ela nao
   aparecia. O registro tinha o campo; a tela da biblioteca nao tinha nada com o
   campo. Dava para anexar uma foto pela biblioteca e nunca mais ve-la la — so
   onde a Agenda abre a musica, por um caminho que a biblioteca nao alcança.

   Este arquivo trava esse caminho fechado. O que ele prova:

     - a biblioteca mostra a foto que o registro tem;
     - o acesso ao Estudio aparece junto;
     - uma musica SEM foto nao ganha bloco nem botao inuteis;
     - quem entra no bloco e o REGISTRO do armazenamento, nao a copia de tela;
     - duas musicas com fotos diferentes nao trocam de imagem;
     - abrir duas vezes nao duplica nada;
     - a foto continua depois do ciclo do backup.

   O QUE ESTE ARQUIVO NAO PROVA

     - o canvas do desenho e a exportacao da anotacao: sao do Estudio, e a
       V6.9 ja registrou que o Estúdio entrega um arquivo ao sistema.
     - a reducao da imagem: e do navegador.

   Rodar: node tools/test-foto-biblioteca.js
   ========================================================= */
'use strict';

const { RAIZ } = require('./arquivos.js');
const Falso = require('./dom-falso.js');

Falso.instalar();
const carregar = (rel) => Falso.carregar(RAIZ, rel);

/* A ordem e a de `index.html`: `render.js` captura `Music` no topo do IIFE, e
   `utils.js` nao pode vir depois de quem o usa. */
carregar('js/core/music.js');
carregar('js/core/utils.js');
carregar('js/core/render.js');
const Store = carregar('js/core/store.js');
carregar('js/core/ui.js');
carregar('js/core/links.js');
carregar('js/core/tuner.js');
global.Studio = { abrir: () => {} };
global.Gravador = {
  relogio: () => 0, tamanhoDe: () => 0,
  iniciar: () => Promise.reject(new Error('sem microfone')),
};
global.Views = global.Views || {};
carregar('js/views/cancao.js');
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
   A SONDA: A FOLHA DA BIBLIOTECA
   ------------------------------------------------------------ */

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAAA';
const WEBP = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';

let folha = null;
const UIreal = global.UI;
const sheetReal = UIreal.sheet;
UIreal.sheet = function () {
  const h = sheetReal.apply(UIreal, arguments);
  folha = h.node || h.body || h;
  return h;
};

/* Espia o bloco de foto: e o unico jeito de responder "qual objeto entrou aqui"
   sem abrir o codigo e ver. */
let recebido = null;
let chamadas = 0;
const blocoReal = global.Views.cancao.blocoFoto;
global.Views.cancao.blocoFoto = function () {
  chamadas++;
  recebido = arguments[0];
  return blocoReal.apply(null, arguments);
};

function criar(titulo, foto) {
  const c = Store.normCifra({ titulo: titulo, bpm: 90, artista: 'Alguem', foto: foto });
  Store.db.cifras.push(c);
  return c;
}
function abrirNaBiblioteca(c) {
  /* Cada abertura comeca de um DOM limpo. Sem isto a folha capturada seria a
     da chamada anterior — e uma verificacao que olha a folha velha passa
     medindo a coisa errada, que e a forma mais confortavel de um teste falso. */
  try { UIreal.closeAllSheets(); } catch (e) { /* sem folhas, tudo bem */ }
  if (global.document && global.document.body) {
    const scrims = global.document.body.querySelectorAll('.scrim');
    for (let i = 0; i < scrims.length; i++) scrims[i].remove();
  }
  folha = null; recebido = null; chamadas = 0;
  Repertorio.abrirCifra(c);
  return folha;
}
/* O DOM falso entende `img` e `.foto-cheia`, mas nao a forma composta
   `img.foto-cheia`. Filtrar por classe sobre a lista de `img` e o mesmo
   resultado, e nao depende do que o seletor combinado suportar. */
function fotosDaFolha() {
  if (!folha) return [];
  return [].concat(folha.querySelectorAll('img')).filter((i) => {
    const cn = typeof i.className === 'string' ? i.className : '';
    return cn.split(/\s+/).indexOf('foto-cheia') >= 0;
  });
}
const texto = () => (folha ? (folha.textContent || '') : '');

/* ------------------------------------------------------------
   1. O BLOCO EXISTE E E O DE LÁ
   ------------------------------------------------------------ */

secao('1. o bloco de foto é o mesmo da página da música');

{
  ok(!!blocoReal, 'a página da musica publica o bloco de foto');
  igual(typeof blocoReal, 'function', 'e ele e uma funcao');
  ok(global.Views.cancao.blocoFoto === blocoReal || chamadas === 0,
    'e a biblioteca usa esse, sem reescrever');
}

/* ------------------------------------------------------------
   2. MUSICA COM FOTO: A BIBLIOTECA MOSTRA
   ------------------------------------------------------------ */

secao('2. uma música com foto aparece na biblioteca');

let comFoto = null;
{
  comFoto = criar('Com Foto Na Biblioteca', JPEG);
  abrirNaBiblioteca(comFoto);

  igual(chamadas, 1, 'o bloco foi montado uma vez');
  const imgs = fotosDaFolha();
  igual(imgs.length, 1, 'e ha uma foto na folha');
  igual(imgs[0] && imgs[0].getAttribute('src'), JPEG, 'e e a foto do registro');
  ok(/Foto e desenho/.test(texto()), 'a secao aparece');
  ok(/Abrir o Estúdio/.test(texto()), 'e o acesso ao Estúdio aparece');
  ok(!!comFoto.id, 'a musica tem id');
}

/* ------------------------------------------------------------
   3. MUSICA SEM FOTO: NADA DE COMPONENTE VAZIO
   ------------------------------------------------------------ */

secao('3. uma música sem foto não ganha bloco nem botão inútil');

{
  const semFoto = criar('Sem Foto Nenhuma', '');
  abrirNaBiblioteca(semFoto);

  igual(chamadas, 0, 'o bloco NAO foi montado');
  igual(fotosDaFolha().length, 0, 'nao ha foto na folha');
  ok(!/Foto e desenho/.test(texto()), 'e nao ha secao de foto');
  ok(!/Abrir o Estúdio/.test(texto()), 'e nao ha botao do Estúdio');
  ok(/Abrir a mesa/.test(texto()), 'mas a musica continua normal, com a mesa');
}

/* ------------------------------------------------------------
   4. O REGISTRO VERDADEIRO, E NAO A COPIA
   ------------------------------------------------------------ */

secao('4. quem entra no bloco é o registro do armazenamento');

{
  const c = criar('Identidade Da Musica', WEBP);
  const antes = Store.db.cifras.length;
  abrirNaBiblioteca(c);

  ok(!!recebido, 'o bloco recebeu alguma coisa');
  igual(recebido === c, true, 'e recebeu o MESMO objeto que esta no armazenamento');
  igual(recebido && recebido.id, c.id, 'com o mesmo id');
  igual(recebido && recebido.foto, WEBP, 'e a mesma foto');
  ok(recebido !== Object.assign({}, c), 'e nao uma copia recem-criada');
  igual(Store.db.cifras.length, antes, 'e nada foi gravado ao abrir');
}

/* Uma escrita feita no objeto do bloco tem de aparecer no armazenamento. E o
   que separa "recebeu o registro" de "recebeu um objeto que parece o registro":
   o segundo aceita a mudanca e a perde. */
{
  const c = criar('Escrita No Registro', JPEG);
  const quantosAntes = Store.db.cifras.length;
  abrirNaBiblioteca(c);
  recebido.foto = WEBP;
  const noStore = Store.db.cifras.filter((x) => x.id === c.id)[0];
  igual(noStore.foto, WEBP, 'uma mudanca no objeto recebido aparece no armazenamento');
  igual(Store.db.cifras.length, quantosAntes, 'e nao nasce um registro novo');
  igual(Store.db.cifras.filter((x) => x.id === c.id).length, 1,
    'e o id continua apontando para um so registro');
}

/* ------------------------------------------------------------
   5. DUAS MUSICAS NAO SE TROCAN
   ------------------------------------------------------------ */

secao('5. duas músicas com fotos diferentes não se trocam');

let A = null;
let B = null;
{
  /* O armazenamento e zerado ANTES deste teste, e nao depois. Sem isto a
     musica com a primeira foto do arquivo e a que resolve, e a mutacao que
     resolve "qualquer uma com foto" trocaria A por uma foto igual a de A —
     pareceria passar, e nao mede nada. Aqui so existem A e B. */
  Store.db.cifras.length = 0;
  A = criar('Foto A Dela', JPEG);
  B = criar('Foto B Dela', WEBP);

  abrirNaBiblioteca(A);
  const imgA = fotosDaFolha()[0];
  igual(imgA && imgA.getAttribute('src'), JPEG, 'A mostra a foto de A');

  abrirNaBiblioteca(B);
  const imgB = fotosDaFolha()[0];
  igual(imgB && imgB.getAttribute('src'), WEBP, 'B mostra a foto de B');

  abrirNaBiblioteca(A);
  const imgA2 = fotosDaFolha()[0];
  igual(imgA2 && imgA2.getAttribute('src'), JPEG, 'e de volta em A, A de novo');

  igual(fotosDaFolha().length, 1, 'uma foto por vez, sem duplicar');
  igual(B.foto, WEBP, 'a foto de B nao foi mexida');
}

/* ------------------------------------------------------------
   6. ABRIR DUAS VEZES NAO DUPLICA
   ------------------------------------------------------------ */

secao('6. abrir a mesma música várias vezes não acumula');

{
  A = criar('Foto Repetida', JPEG);
  for (let i = 0; i < 5; i++) abrirNaBiblioteca(A);
  igual(fotosDaFolha().length, 1, 'cinco aberturas, uma foto');
  igual(chamadas, 1, 'e um bloco por abertura, nunca dois');
}

/* ------------------------------------------------------------
   7. OS DEMAIS CAMPOS DA MUSICA NAO MUDARAM
   ------------------------------------------------------------ */

secao('7. o resto da música continua igual');

{
  Store.db.cifras.length = 0;
  const c = Store.normCifra({
    titulo: 'Tudo Junto', artista: 'Cantor', bpm: 118, tom: 'G', compasso: '4/4',
    categoria: 'ensaio', tags: ['uma'], letra: 'la la', cifra: '[G]\nC G',
    yt: '', foto: JPEG,
  });
  Store.db.cifras.push(c);
  abrirNaBiblioteca(c);

  igual(c.titulo, 'Tudo Junto', 'titulo');
  igual(c.artista, 'Cantor', 'artista');
  igual(c.bpm, 118, 'bpm');
  igual(c.tom, 'G', 'tom');
  igual(c.compasso, '4/4', 'compasso');
  igual(c.categoria, 'ensaio', 'categoria');
  igual((c.tags || []).length, 1, 'tags');
  igual(c.letra, 'la la', 'letra');
  igual(c.cifra, '[G]\nC G', 'cifra');
  igual(c.foto, JPEG, 'foto');
  ok(!!c.id, 'e o id');

  const t = texto();
  ok(/Tudo Junto/.test(t), 'e a folha mostra o titulo de verdade');
  ok(/Transpor/.test(t), 'e o Transpor continua la');
  ok(/Excluir/.test(t), 'e o Excluir');
  ok(/Editar/.test(t), 'e o Editar');
  ok(/Abrir a mesa/.test(t), 'e a mesa de ensaio');
}

/* ------------------------------------------------------------
   8. A FOTO SOBREVIVE AO BACKUP
   ------------------------------------------------------------ */

secao('8. a foto atravessa o backup');

{
  Store.db.cifras.length = 0;
  Store.db.cifras.push(Store.normCifra({ titulo: 'Backup Com Foto', bpm: 77, foto: WEBP }));
  const copia = JSON.parse(JSON.stringify(Store.db.cifras));
  igual(copia[0].foto, WEBP, 'a foto esta na copia serializada');

  Store.db.cifras.length = 0;
  Store.db.cifras = copia;
  const c = Store.db.cifras.filter((x) => x.titulo === 'Backup Com Foto')[0];
  igual(c.foto, WEBP, 'e volta inteira');
  abrirNaBiblioteca(c);
  igual(fotosDaFolha().length, 1, 'e a biblioteca a mostra de novo');
  igual(fotosDaFolha()[0].getAttribute('src'), WEBP, 'com a foto certa');
}

console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('');
  falhas.forEach((f) => console.log('  FALHA  ' + f));
}
console.log('=================================================\n');
process.exit(falhou ? 1 : 0);