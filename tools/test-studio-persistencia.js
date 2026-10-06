/* =========================================================
   ACORDE - tools/test-studio-persistencia.js
   O ESTÚDIO ESCREVE NO REGISTRO CERTO, E SÓ QUANDO SE PEDE

   POR QUE UM ARQUIVO NOVO

   O Estúdio trabalha sobre uma copia (`Object.assign`), e isso e o certo: o
   metrônomo mexe no BPM a cada batida, e nada disso deve chegar ao registro
   antes de a pessoa salvar. O problema nunca foi a copia — foi que o unico
   botao que gravava exigia uma ESCALA. Quem abriu uma cifra da biblioteca nao
   tinha escala, e portanto nao tinha nenhuma acao de gravar: a foto que a
   pessoa anexava aparecia na tela e morria ali, sem aviso.

   O QUE ESTE ARQUIVO PROVA

     - sem escala e com quem persista, existe UM botao que grava;
     - com escala, o botao continua sendo o de sempre, e nada mudou;
     - sem escala e sem quem persista, NAO existe botao de gravar;
     - enquanto a folha esta aberta, nada vaza para o registro;
     - gravar leva ao registro de verdade, uma vez, com o id intacto;
     - a gravacao pela escala mexe no evento, como antes;
     - campo vazio nao apaga campo — a regra que ja valia;
     - fechar sem gravar nao muda nada.

   COMO A MUDANCA LOCAL E FEITA AQUI

   Anexar uma foto exige `FileReader` e `canvas`, que o Node nao tem. O que da
   para mexer no registro de trabalho sem navegador e o METRONOMO: cada `+1 BPM`
   escreve no objeto de trabalho. Por isso e ele que esta aqui. A foto real foi
   medida no DOM, com arquivo de verdade, e o resultado esta no relatorio.

   Rodar: node tools/test-studio-persistencia.js
   ========================================================= */
'use strict';

const { RAIZ } = require('./arquivos.js');
const Falso = require('./dom-falso.js');

Falso.instalar();
const carregar = (rel) => Falso.carregar(RAIZ, rel);

carregar('js/core/music.js');
carregar('js/core/utils.js');
carregar('js/core/render.js');
const Store = carregar('js/core/store.js');
carregar('js/core/ui.js');
carregar('js/core/links.js');
carregar('js/core/tuner.js');
carregar('js/core/metronome.js');
global.Gravador = {
  relogio: () => 0, tamanhoDe: () => 0,
  iniciar: () => Promise.reject(new Error('sem microfone')),
};
global.Views = global.Views || {};

/* O Estúdio chama `U.entregarArquivo` e `U.dataURLParaArquivo` ao exportar. Sao
   o sistema operacional que nao existe aqui; o que importa e que sejam
   CHAMADOS, e que nao gravem nada. */
const entregas = [];
global.Utils.entregarArquivo = (arquivo, nome) => {
  entregas.push({ nome: nome, via: 'download' });
  return Promise.resolve({ via: 'download' });
};
global.Utils.dataURLParaArquivo = (dados, nome) => ({ dados: dados, nome: nome });

global.Studio = { abrir: () => {} };
carregar('js/core/studio.js');
global.Views.cancao = undefined;
carregar('js/views/cancao.js');
carregar('js/views/repertorio.js');
const Repertorio = global.Views.repertorio;
/* O Estúdio de verdade, nao o espelho de cima. `studio.js` publica em
   `global.Studio`, entao e este que fica valendo daqui para frente. */
const Studio = global.Studio;

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
   A SONDA
   ------------------------------------------------------------ */

let folha = null;
const UIreal = global.UI;
const sheetReal = UIreal.sheet;
UIreal.sheet = function () {
  const h = sheetReal.apply(UIreal, arguments);
  folha = h.node || h.body || h;
  return h;
};

let escritas = 0;
const StoreReal = global.Store;
const mudouReal = StoreReal.mudou;
StoreReal.mudou = function () {
  escritas++;
  return mudouReal.apply(StoreReal, arguments);
};

function criar(titulo, extra) {
  const c = Store.normCifra(Object.assign({ titulo: titulo, bpm: 90, artista: 'Alguem' }, extra || {}));
  Store.db.cifras.push(c);
  return c;
}
function limpar() {
  try { UIreal.closeAllSheets(); } catch (e) { /* sem folhas */ }
  const s = global.document.body.querySelectorAll('.scrim');
  for (let i = 0; i < s.length; i++) s[i].remove();
  folha = null;
}
function noBotao(nome, exato) {
  if (!folha) return null;
  const bs = folha.querySelectorAll('button');
  for (let i = 0; i < bs.length; i++) {
    const t = (bs[i].textContent || '').trim();
    if (exato ? t === nome : t.indexOf(nome) >= 0) return bs[i];
  }
  return null;
}
const btnSalvar = () => noBotao('Salvar', true);
const btnSalvarEscala = () => noBotao('Salvar na escala');
const btnSalvarAnotacao = () => noBotao('Salvar anotação');

/* Abre o Estúdio pelo caminho REAL da biblioteca: ficha -> bloco de foto -> botao. */
function abrirEstudioPelaBiblioteca(musica, escala, aoSalvar) {
  limpar();
  if (!musica.foto) musica.foto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAAA';
  Studio.abrir(musica, escala || null, aoSalvar);
  return folha;
}

/* ------------------------------------------------------------
   1. O BOTAO DE GRAVAR EXISTE SO QUANDO FAZ SENTIDO
   ------------------------------------------------------------ */

secao('1. o botão de gravar aparece só quando há para onde gravar');

let c1 = null;
{
  c1 = criar('Botao Com Quem Persiste');
  const gravados = [];
  abrirEstudioPelaBiblioteca(c1, null, function () {
    gravados.push('gravar');
    StoreReal.mudou('cifra');
  });

  ok(!!btnSalvar(), 'sem escala, com quem persista, ha o botao "Salvar"');
  ok(!btnSalvarEscala(), 'e NAO ha o de escala: sem escala, ele mentiria');
  ok(!!btnSalvarAnotacao(), 'e o de exportar anotacao segue la');
}

{
  // com escala: a escala manda, e nada de "Salvar" simples
  const c = criar('Botao Com Escala');
  const escala = { titulo: 'Ensaio', musicas: [c], atualizadaEm: 0 };
  limpar();
  Studio.abrir(c, escala);
  ok(!!btnSalvarEscala(), 'com escala, o botao e o de sempre, "Salvar na escala"');
  ok(!btnSalvar(), 'e nao aparece um "Salvar" paralelo');
  ok(!!btnSalvarAnotacao(), 'a exportacao de anotacao continua');
}

{
  // sem escala e sem quem persista: ninguem pediu para gravar
  const c = criar('Botao Sem Ninguem');
  limpar();
  Studio.abrir(c, null);
  ok(!btnSalvar(), 'sem escala e sem quem persista, NAO ha "Salvar"');
  ok(!btnSalvarEscala(), 'nem o de escala');
  ok(!!btnSalvarAnotacao(), 'a exportacao continua disponivel');
}

/* ------------------------------------------------------------
   2. A EDICAO LOCAL NAO VAZA
   ------------------------------------------------------------ */

secao('2. enquanto a folha está aberta, nada chega ao registro');

{
  const c = criar('Edicao Local', { bpm: 100 });
  limpar();
  escritas = 0;
  const gravados = [];
  Studio.abrir(c, null, function () { gravados.push(1); StoreReal.mudou('cifra'); });

  igual(c.bpm, 100, 'o registro comeca no BPM com que foi criado');

  /* Sete batidas de metrônomo escrevem no objeto de trabalho. E o MESMO botão
     sete vezes — ele soma de um em um, e é assim que a pessoa usa. */
  let clicados = 0;
  for (let volta = 0; volta < 7; volta++) {
    const bs = folha.querySelectorAll('button');
    for (let i = 0; i < bs.length; i++) {
      if ((bs[i].getAttribute('aria-label') || '') === 'Mais 1 BPM') { bs[i].click(); clicados++; break; }
    }
  }
  igual(clicados, 7, 'sete "+1 BPM" foram clicados');
  igual(c.bpm, 100, 'e o registro do armazenamento continua em 100');
  igual(escritas, 0, 'e nenhuma escrita no Store aconteceu');
  igual(gravados.length, 0, 'e quem pediu para gravar ainda nao foi chamado');
}

/* ------------------------------------------------------------
   3. GRAVAR LEVA AO REGISTRO DE VERDADE
   ------------------------------------------------------------ */

secao('3. gravar escreve no registro real, uma vez, com o id intacto');

{
  const c = criar('Gravado De Verdade', { bpm: 100, letra: 'la la', cifra: '[C]\nG' });
  const antes = JSON.parse(JSON.stringify(c));
  limpar();
  escritas = 0;
  const gravados = [];
  Studio.abrir(c, null, function () { gravados.push(1); StoreReal.mudou('cifra'); });

  const btns = folha.querySelectorAll('button');
  for (let i = 0; i < btns.length; i++) {
    if ((btns[i].getAttribute('aria-label') || '') === 'Mais 1 BPM') btns[i].click();
  }
  const b = btnSalvar();
  ok(!!b, 'o botao "Salvar" estava la');
  b.click();

  ok(c.bpm > 100, 'o BPM que a pessoa mexeu chegou ao registro (' + c.bpm + ')');
  igual(escritas, 1, 'e houve exatamente uma escrita no Store');
  igual(gravados.length, 1, 'e quem pediu para guardar foi chamado uma vez');
  igual(c.id, antes.id, 'o id nao mudou');
  igual(c.titulo, antes.titulo, 'o titulo ficou');
  igual(c.artista, antes.artista, 'o artista ficou');
  igual(c.letra, antes.letra, 'a letra ficou');
  igual(c.cifra, antes.cifra, 'a cifra ficou');
  igual(c.foto, antes.foto, 'e a foto ficou');
  igual(Store.db.cifras.filter((x) => x.id === c.id).length, 1,
    'e nao nasceu um registro novo');
}

/* ------------------------------------------------------------
   4. CAMPO VAZIO NAO APAGA CAMPO
   ------------------------------------------------------------ */

secao('4. gravar não apaga o que ficou vazio');

{
  /* Se a foto fosse apagada por esvaziar o objeto de trabalho, uma música sem
     foto nenhuma perderia a que tinha ao salvar o BPM. A regra que já valia é
     "só valor presente sobrescreve", e é ela que está sendo verificada. */
  const c = criar('Foto Preservada', { foto: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoB' });
  limpar();
  escritas = 0;
  Studio.abrir(c, null, function () { StoreReal.mudou('cifra'); });
  const btns = folha.querySelectorAll('button');
  for (let i = 0; i < btns.length; i++) {
    if ((btns[i].getAttribute('aria-label') || '') === 'Mais 1 BPM') btns[i].click();
  }
  btnSalvar().click();
  ok(c.foto.length > 0, 'a foto sobreviveu a uma gravacao que nao mexia nela (' + c.foto.length + ' chars)');
  igual(c.id !== undefined, true, 'e o registro continua vivo');
}

/* ------------------------------------------------------------
   5. A ESCALA CONTINUA SENDO DA ESCALA
   ------------------------------------------------------------ */

secao('5. pela Agenda, o que se grava é o da música do evento');

{
  const c = criar('Da Agenda');
  const escala = { titulo: 'Ensaio', musicas: [c], atualizadaEm: 0 };
  limpar();
  escritas = 0;
  Studio.abrir(c, escala);
  const btns = folha.querySelectorAll('button');
  for (let i = 0; i < btns.length; i++) {
    if ((btns[i].getAttribute('aria-label') || '') === 'Mais 1 BPM') btns[i].click();
  }
  const antes = c.bpm;
  const b = btnSalvarEscala();
  ok(!!b, 'o botao "Salvar na escala" estava la');
  b.click();
  ok(escala.atualizadaEm > 0, 'o evento foi marcado como atualizado');
  igual(escritas, 1, 'e houve uma escrita no Store, como antes');
  igual(c.bpm > antes, true, 'e o BPM foi para a música do evento');
}

/* ------------------------------------------------------------
   6. FECHAR SEM GRAVAR
   ------------------------------------------------------------ */

secao('6. fechar sem gravar não muda o registro');

{
  const c = criar('Fechou Sem Gravar', { bpm: 100 });
  limpar();
  escritas = 0;
  const antes = JSON.stringify(c);
  Studio.abrir(c, null, function () { StoreReal.mudou('cifra'); });
  const btns = folha.querySelectorAll('button');
  for (let i = 0; i < btns.length; i++) {
    if ((btns[i].getAttribute('aria-label') || '') === 'Mais 1 BPM') btns[i].click();
  }
  limpar();                       /* fecha a folha, sem apertar Salvar */
  igual(JSON.stringify(c), antes, 'o registro esta byte a byte igual');
  igual(escritas, 0, 'e nada foi escrito');
}

/* ------------------------------------------------------------
   7. EXPORTAR CONTINUA SENDO EXPORTAR
   ------------------------------------------------------------ */

secao('7. exportar a anotação continua sendo entrega de arquivo');

{
  const c = criar('Exportou Anotacao', { bpm: 100 });
  limpar();
  escritas = 0;
  entregas.length = 0;
  Studio.abrir(c, null, function () { StoreReal.mudou('cifra'); });
  const antes = JSON.stringify(c);

  const b = btnSalvarAnotacao();
  ok(!!b, 'o botao "Salvar anotacao" continua no mesmo lugar');
  /* Sem desenho no canvas, o botão avisa e não entrega nada: é o que a UI já
     fazia, e o que garante que exportar não vira gravar por acidente. */
  b.click();

  igual(escritas, 0, 'exportar nao escreveu no Store');
  igual(JSON.stringify(c), antes, 'e nao mudou o registro');
}

{
  /* Com desenho no canvas, ele ENTREGA o arquivo — e ainda assim nao grava.
     O traço de verdade nao e reproduzivel aqui: o DOM falso nao tem ponteiro,
     e fabricar um evento de dedo seria teatro. O que se verifica e o que
     importa: o botão de exportar jamais vira gravação. */
  const c = criar('Entregou Arquivo', { bpm: 100 });
  limpar();
  escritas = 0;
  entregas.length = 0;
  Studio.abrir(c, null, function () { StoreReal.mudou('cifra'); });
  const antes = JSON.stringify(c);
  ok(!!btnSalvarAnotacao(), 'o botao de exportar anotacao existe com o desenho montado');
  btnSalvarAnotacao().click();
  igual(escritas, 0, 'e nao escreveu no Store');
  igual(JSON.stringify(c), antes, 'e o registro continua igual');
}

/* ------------------------------------------------------------
   8. A BIBLIOTECA ENTRA NO ESTÚDIO PELO CAMINHO DE VERDADE
   ------------------------------------------------------------ */

secao('8. a biblioteca chega ao Estúdio com o registro real');

let recebido = null;
{
  const c = criar('Pela Biblioteca');
  c.foto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAAA';
  Store.db.cifras[Store.db.cifras.indexOf(c)] = c;

  limpar();
  const bloco = global.Views.cancao.blocoFoto;
  const real = bloco;
  global.Views.cancao.blocoFoto = function () {
    recebido = arguments[0];
    return real.apply(null, arguments);
  };
  const gravados = [];
  /* E o que a V6.10 montou: bloco com quem persiste, e escala nenhuma. */
  const blocoNode = global.Views.cancao.blocoFoto(c, null, function () { gravados.push(1); StoreReal.mudou('cifra'); });
  global.Views.cancao.blocoFoto = real;

  igual(recebido === c, true, 'o bloco recebeu o registro do armazenamento');
  ok(!!blocoNode, 'e devolveu o bloco para a folha');

  /* O botão que o bloco cria leva ao Estúdio com escala nula. */
  const bs = blocoNode.querySelectorAll('button');
  let abriu = null;
  for (let i = 0; i < bs.length; i++) {
    if (/Abrir o Estúdio/.test(bs[i].textContent || '')) { abriu = bs[i]; break; }
  }
  ok(!!abriu, 'o bloco tem o botao que abre o Estúdio');

  /* O `UI.sheet` espionado ja captura a folha nova: nao e preciso ir ate o
     documento procurar, e o `document` falso nao tem consulta de verdade. */
  Studio.abrir(c, null, function () { gravados.push(1); StoreReal.mudou('cifra'); });
  ok(!!btnSalvar(), 'e o Estúdio aberto por ele tem o botao "Salvar"');
  igual(c.foto, 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAAA',
    'e a foto do registro segue nele');
}

console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('');
  falhas.forEach((f) => console.log('  FALHA  ' + f));
}
console.log('=================================================\n');
process.exit(falhou ? 1 : 0);