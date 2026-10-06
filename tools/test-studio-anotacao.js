/* =========================================================
   ACORDE - tools/test-studio-anotacao.js
   A ANOTAÇÃO QUE FICA NA MÚSICA, E A QUE SÓ SAI PARA O SISTEMA

   POR QUE UM ARQUIVO NOVO

   A V6.11 deu ao Estúdio um botão que grava. A V6.12 dá um segundo, com outro
   destino: "Salvar anotação" CONTINUA entregando um JPEG ao sistema — é o que
   a pessoa leva para outro lugar — e "Salvar no Clave" grava a foto com os
   traços dentro da música. Duas ações, dois destinos, nenhum misturado.

   O QUE ESTE ARQUIVO PROVA

     - os três botões existem e são diferentes entre si;
     - sem rabisco, "Salvar no Clave" recusa e não grava nada;
     - com rabisco, grava no registro de verdade, uma vez, com o id intacto;
     - o segundo rabisco se SOMA ao primeiro, e não o substitui;
     - "Salvar anotação" entrega arquivo e NÃO grava;
     - fechar sem salvar não muda o registro;
     - "Limpar" não promete que a música foi limpa;
     - pela Agenda, o que se grava é o da música do evento.

   O QUE ESTE ARQUIVO NAO PROVA

     - o pixel do traço: o canvas falso conta trços e devolve uma string que
       muda com eles, o que prova o CAMINHO (compor e gravar no lugar certo) e
       não o desenho. O pixel de verdade foi medido no DOM, com arquivo e
       ponteiro de verdade, e está no relatório da fase.

   A ESPERA
   ----------
   Abrir o Estúdio não deixa a foto pronta: `imgBase` só existe quando a imagem
   carrega, e isso é assíncrono. Desenhar ou gravar antes disso faria o botão
   recusar pelo motivo errado, e a suite estaria medindo a pressa em vez do
   comportamento. Por isso `settle()` entre abrir e agir.

   Rodar: node tools/test-studio-anotacao.js
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

/* A exportação é entregue ao sistema operacional, que aqui não existe. O que
   importa é QUE SEJA CHAMADA, e com que nome — e que nada seja gravado. */
const entregues = [];
global.Utils.entregarArquivo = (arquivo, nome) => {
  entregues.push({ nome: nome });
  return Promise.resolve({ via: 'download' });
};
global.Utils.dataURLParaArquivo = (dados, nome) => ({ dados: dados, nome: nome });

global.Studio = { abrir: () => {} };
carregar('js/core/studio.js');
global.Views.cancao = undefined;
carregar('js/views/cancao.js');
carregar('js/views/repertorio.js');
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

const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAAA';

let folha = null;
const UIreal = global.UI;
const sheetReal = UIreal.sheet;
UIreal.sheet = function () {
  const h = sheetReal.apply(UIreal, arguments);
  folha = h.node || h.body || h;
  return h;
};

let escritas = 0;
const mudouReal = Store.mudou;
Store.mudou = function () { escritas++; return mudouReal.apply(Store, arguments); };

/* O aviso é interceptado porque é ele que diz o que o botão AFIRMOU — e é na
   frase que um botão pode mentir. */
let ultimoAviso = null;
const toastReal = UIreal.toast;
UIreal.toast = function (texto, opts) {
  ultimoAviso = { texto: texto, tipo: opts && opts.tipo };
  return toastReal.apply(UIreal, arguments);
};

function criar(titulo, extra) {
  const c = Store.normCifra(
    Object.assign({ titulo: titulo, bpm: 90, artista: 'Alguem', foto: FOTO }, extra || {}));
  Store.db.cifras.push(c);
  return c;
}
function limpar() {
  try { UIreal.closeAllSheets(); } catch (e) { /* sem folhas */ }
  const s = global.document.body.querySelectorAll('.scrim');
  for (let i = 0; i < s.length; i++) s[i].remove();
  folha = null;
  ultimoAviso = null;
}
function botao(nome) {
  if (!folha) return null;
  const bs = folha.querySelectorAll('button');
  for (let i = 0; i < bs.length; i++) {
    if ((bs[i].textContent || '').trim() === nome) return bs[i];
  }
  return null;
}
function botaoComRotulo(aria) {
  const bs = folha ? folha.querySelectorAll('button') : [];
  for (let i = 0; i < bs.length; i++) {
    if ((bs[i].getAttribute('aria-label') || '') === aria) return bs[i];
  }
  return null;
}

/* Um rabisco de verdade: os mesmos eventos que o dedo faz. */
function rabisco() {
  const cv = folha ? folha.querySelectorAll('canvas')[0] : null;
  if (!cv) return 0;
  const ev = (t, x, y) => ({
    type: t, clientX: x, clientY: y, pointerId: 1, isPrimary: true,
    bubbles: true, cancelable: true, button: 0, pressure: 1,
    preventDefault() {}, stopPropagation() {},
  });
  cv.dispatchEvent(ev('pointerdown', 20, 20));
  for (let i = 1; i <= 5; i++) cv.dispatchEvent(ev('pointermove', 20 + i * 15, 20 + i * 11));
  global.dispatchEvent(ev('pointerup', 95, 75));
  return 1;
}

/* Deixa a fila do Node respirar: temporizadores (a imagem carrega) e microtasks
   (o `imgBase` é atribuído; a exportação tem dois níveis de promessa). Quatro
   voltas cobrem os dois — e é a espera que impede a suite de medir o
   "entregue um arquivo" antes de a entrega acontecer. */
function settle() {
  return new Promise((r) => {
    let n = 0;
    const passo = () => {
      n += 1;
      if (n >= 4) return r();
      return setImmediate(() => setTimeout(passo, 0));
    };
    setTimeout(passo, 0);
  });
}
const espera = () => settle();

/* ------------------------------------------------------------
   1. TRÊS BOTÕES, TRÊS COISAS
   ------------------------------------------------------------ */

secao('1. os três botões existem e não são o mesmo botão');

{
  const c = criar('Tres Botoes');
  limpar(); escritas = 0;
  Studio.abrir(c, null, function () { Store.mudou('cifra'); });

  ok(!!botao('Salvar no Clave'), 'existe "Salvar no Clave"');
  ok(!!botao('Salvar anotação'), 'existe "Salvar anotação"');
  ok(!!botao('Salvar'), 'existe "Salvar"');
  ok(!botao('Salvar na escala'), 'e, sem escala, não existe o da escala');
  ok(!!botaoComRotulo('Limpar'), 'e o "Limpar" continua com nome acessível');
}

/* ------------------------------------------------------------
   2. A CADEIA
   ------------------------------------------------------------ */

async function cadeia() {
  /* ---- 2. sem rabisco, recusa e não grava ---- */
  secao('2. sem rabisco, "Salvar no Clave" recusa e não grava');

  const c2 = criar('Sem Rabisco');
  const antes2 = c2.foto;
  limpar(); escritas = 0;
  Studio.abrir(c2, null, function () { Store.mudou('cifra'); });
  await espera();

  botao('Salvar no Clave').click();
  ok(ultimoAviso && ultimoAviso.tipo === 'err',
    'e avisa que é erro, não sucesso (' + (ultimoAviso ? ultimoAviso.texto : 'nada') + ')');
  igual(escritas, 0, 'não escreveu no Store');
  igual(c2.foto, antes2, 'e o registro continua com a foto de antes');

  /* ---- 3. com rabisco, grava no registro de verdade ---- */
  secao('3. com rabisco, grava no registro');

  const c3 = criar('Gravou Anotacao');
  const antes3 = c3.foto;
  limpar(); escritas = 0;
  Studio.abrir(c3, null, function () { Store.mudou('cifra'); });
  await espera();

  igual(rabisco(), 1, 'desenhou um rabisco');
  igual(escritas, 0, 'desenhar não grava nada');
  igual(c3.foto, antes3, 'e o registro ainda é o de antes');

  const idAntes3 = c3.id;
  botao('Salvar no Clave').click();
  await espera();

  ok(c3.foto !== antes3, 'o registro recebeu uma imagem diferente');
  igual(c3.id, idAntes3, 'e o id da música não mudou');
  igual(escritas, 1, 'e houve exatamente uma escrita no Store');
  igual(Store.db.cifras.filter((x) => x.id === c3.id).length, 1, 'e não nasceu outro');
  igual(c3.titulo, 'Gravou Anotacao', 'o título ficou');
  igual(c3.artista, 'Alguem', 'o artista ficou');
  igual(c3.bpm, 90, 'o BPM ficou');
  ok(ultimoAviso && ultimoAviso.tipo === 'ok', 'e o aviso é de sucesso');
  const fotoDepois1 = c3.foto;

  /* ---- 4. o segundo rabisco se soma ao primeiro ---- */
  secao('4. o segundo rabisco se soma ao primeiro');

  limpar(); escritas = 0;
  Studio.abrir(c3, null, function () { Store.mudou('cifra'); });
  await espera();

  igual(rabisco(), 1, 'desenhou o segundo rabisco');
  botao('Salvar no Clave').click();
  await espera();

  ok(c3.foto !== fotoDepois1, 'a imagem mudou de novo — não ficou a primeira');
  igual(escritas, 1, 'mais uma escrita, e apenas uma');
  igual(Store.db.cifras.filter((x) => x.id === c3.id).length, 1, 'e ainda um registro só');

  /* ---- 5. exportar continua sendo exportar ---- */
  secao('5. "Salvar anotação" entrega arquivo e não grava');

  const antes5 = c3.foto;
  entregues.length = 0; escritas = 0;
  /* A exportação recusa quando não há rabisco novo, porque depois de gravar a
     anotação o traço já virou parte da imagem e o canvas começa limpo. Isso é o
     comportamento certo: exportar sem rabisco devolveria a foto sem nada. */
  rabisco();
  botao('Salvar anotação').click();
  await espera();

  igual(escritas, 0, 'exportar não escreve no Store');
  igual(c3.foto, antes5, 'e não mexe no registro');
  igual(entregues.length, 1, 'e entregou um arquivo ao sistema');
  ok(entregues[0] && entregues[0].nome === 'Gravou Anotacao (anotada).jpg',
    'com o nome da música, e não "undefined" (' + (entregues[0] ? entregues[0].nome : '?') + ')');

  /* ---- 6. fechar sem salvar ---- */
  secao('6. fechar sem salvar não muda o registro');

  const antes6 = JSON.stringify(c3);
  limpar(); escritas = 0;
  Studio.abrir(c3, null, function () { Store.mudou('cifra'); });
  await espera();
  rabisco();
  limpar();                                  /* fecha sem apertar nada */
  igual(JSON.stringify(c3), antes6, 'o registro está byte a byte igual');
  igual(escritas, 0, 'e nada foi escrito');

  /* ---- 7. limpar não promete que a música foi limpa ---- */
  secao('7. "Limpar" diz o que fez e o que não fez');

  limpar(); ultimoAviso = null;
  Studio.abrir(c3, null, function () { Store.mudou('cifra'); });
  await espera();
  rabisco();
  const btnLimpar = botaoComRotulo('Limpar');
  ok(!!btnLimpar, 'o botão Limpar existe');
  if (btnLimpar) {
    btnLimpar.click();
    const t = (ultimoAviso ? ultimoAviso.texto : '');
    ok(/limpo/i.test(t), 'ele diz que limpou (' + t.slice(0, 44) + ')');
    ok(/edi/i.test(t), 'e diz que foi NESTA edição');
    ok(/salvar/i.test(t), 'e avisa que a música só muda ao salvar');
    ok(!/Anotações limpas/.test(t), 'e não afirma que a música foi limpa');
  }

  /* ---- 8. pela Agenda, grava o da música do evento ---- */
  secao('8. pela Agenda, grava o da música do evento');

  const ce = criar('Da Agenda Anotada');
  const escala = { titulo: 'Ensaio', musicas: [ce], atualizadaEm: 0 };
  limpar(); escritas = 0;
  Studio.abrir(ce, escala);
  await espera();

  ok(!!botao('Salvar no Clave'), 'o botão de gravar a anotação existe na Agenda também');
  igual(rabisco(), 1, 'desenhou na música do evento');
  const antes8 = ce.foto;
  botao('Salvar no Clave').click();
  await espera();

  ok(ce.foto !== antes8, 'e a música do evento recebeu a imagem anotada');
  igual(escritas, 1, 'com uma escrita no Store');
  ok(escala.atualizadaEm > 0, 'e o evento marcado como atualizado');
  igual(Store.db.cifras.filter((x) => x.id === ce.id).length, 1, 'sem registro novo');
  igual(ce.titulo, 'Da Agenda Anotada', 'e o resto da música intacto');
}

cadeia().then(function () {
  console.log('\n=================================================');
  console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
  if (falhou) {
    console.log('');
    falhas.forEach((f) => console.log('  FALHA  ' + f));
  }
  console.log('=================================================\n');
  process.exit(falhou ? 1 : 0);
}, function (e) {
  console.error('\n  A SUITE ROMPEU: ' + (e && e.message ? e.message : e));
  console.log('=================================================\n');
  process.exit(1);
});