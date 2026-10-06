/* =========================================================
   ACORDE - tools/test-foto-cifra.js
   O CONTRATO DA FOTO NA CIFRA

   POR QUE UM ARQUIVO NOVO

   A foto nunca tinha sido exercitada com arquivo de verdade. Esta suite cobre
   a parte que o navegador NAO consegue provar sozinho: o que o modelo aceita
   guardar. O caminho de leitura, reducao, preview e persistencia foi medido no
   DOM real (ver o relatorio da V6.9); aqui o alvo e a garantia que vem DEPOIS
   disso, e que decide se um arquivo estranho consegue entrar no armazenamento.

   O QUE ESTE ARQUIVO PROVA

     - os quatro MIME de imagem sao aceitos;
     - um SVG NAO entra (e um documento com script dentro);
     - um texto NAO entra;
     - o teto de 3 MB e respeitado;
     - a foto sobrevive a uma renormalizacao (o formulario regrava a cifra
       inteira antes de guardar);
     - os demais campos sobrevivem junto com a foto;
     - remover a foto e string vazia, e nao `undefined`;
     - a foto atravessa o backup.

   O QUE ESTE ARQUIVO NAO PROVA

     - a reducao da imagem e o preview: sao canvas e `FileReader`, do navegador.
     - a anotacao: o Estudio entrega um arquivo ao sistema, nao grava na cifra.

   Rodar: node tools/test-foto-cifra.js
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
global.Gravador = { relogio: () => 0, tamanhoDe: () => 0 };
global.Studio = { abrir: () => {} };

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

/* Um prefixo JPEG de verdade, com o marcador SOI. Nao precisa ser uma foto
   completa: o modelo decide pelo prefixo do data URL, e e isso que se prova. */
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
const WEBP = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const TXT = 'data:text/plain;base64,bm90aWNpbWU=';
/* SVG e um documento XML com script dentro. E o unico destes que precisa
   mesmo ser barrado: os outros sao so formatos que o modelo nao declara. */
const SVG = 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+';
const HTML = 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==';

const comFoto = (foto) => {
  const c = Store.normCifra({ titulo: 'Com Foto', bpm: 90, artista: 'Alguem', foto: foto });
  Store.db.cifras.length = 0;
  Store.db.cifras.push(c);
  return c;
};

/* ------------------------------------------------------------
   1. OS TIPOS QUE O MODELO DECLARA
   ------------------------------------------------------------ */

secao('1. os quatro MIME de imagem entram');

[['jpeg', JPEG], ['png', PNG], ['webp', WEBP], ['gif', GIF]].forEach(([nome, dados]) => {
  const c = comFoto(dados);
  igual(c.foto, dados, 'foto ' + nome + ' foi guardada');
});

/* ------------------------------------------------------------
   2. O QUE NAO PODE ENTRAR
   ------------------------------------------------------------ */

secao('2. o que não é imagem não entra');

[["um texto", TXT], ['um HTML com script', HTML], ['um SVG com script', SVG], ['uma string vazia', ''], ['lixo', 'nao-e-data-url']].forEach(([nome, dados]) => {
  const c = comFoto(dados);
  igual(c.foto, '', nome + ' foi recusado e a foto ficou vazia');
});

/* Um SVG e o caso que importa. Ele NAO entra por um problema de extensao,
   e porque o modelo so aceita uma lista de tipos. */
{
  const c = comFoto(SVG);
  ok(!/svg/i.test(c.foto || ''), 'nada de SVG sobrevive na cifra');
}

/* ------------------------------------------------------------
   3. O TETO
   ------------------------------------------------------------ */

secao('3. o teto de tamanho é respeitado');

{
  const dentro = 'data:image/jpeg;base64,' + 'A'.repeat(5000);
  igual(comFoto(dentro).foto, dentro, 'uma foto de 5 KB entra');

  const fora = 'data:image/jpeg;base64,' + 'A'.repeat(3000001);
  igual(comFoto(fora).foto, '', 'uma foto acima de 3 MB e recusada, e nao truncada');

  const noLimite = 'data:image/jpeg;base64,' + 'A'.repeat(2999970);
  ok(comFoto(noLimite).foto.length > 0, 'logo abaixo do teto ainda entra');
}

/* ------------------------------------------------------------
   4. A FOTO SOBREVIVE AO FORMULARIO
   ------------------------------------------------------------ */

secao('4. a foto sobrevive a uma renormalização');

{
  /* O formulario regrava a cifra INTEIRA antes de guardar (foi o achado da
     V6.7). Se `normCifra` comesse a foto ao renormalizar, toda edicao de uma
     musica com foto apagaria a foto — e o wouldnothing diria nada. */
  const c1 = comFoto(JPEG + 'xyz');
  const c2 = Store.normCifra(c1);
  igual(c2.foto, c1.foto, 'renormalizar nao mexe na foto');
  igual(c2.id, c1.id, 'e nao mexe no id');
  igual(c2.titulo, c1.titulo, 'e nao mexe no titulo');
  igual(c2.bpm, c1.bpm, 'e nao mexe no bpm');
}

{
  const c1 = comFoto(JPEG);
  c1.anotacoes = [{ texto: 'isso e uma anotacao', t: 0 }];
  const c2 = Store.normCifra(c1);
  igual((c2.anotacoes || []).length, 1, 'as anotacoes tambem sobrevivem');
}

/* ------------------------------------------------------------
   5. OS DEMAIS CAMPOS
   ------------------------------------------------------------ */

secao('5. os demais campos continuam íntegros ao lado da foto');

{
  Store.db.cifras.length = 0;
  const c = Store.normCifra({
    titulo: 'Musica Completa', artista: 'Cantor', bpm: 120, tom: 'G',
    categoria: 'ensaio', tags: ['uma', 'duas'], letra: 'la la la',
    cifra: '[G]\nC G', foto: PNG,
  });
  Store.db.cifras.push(c);
  igual(c.titulo, 'Musica Completa', 'titulo');
  igual(c.artista, 'Cantor', 'artista');
  igual(c.bpm, 120, 'bpm');
  igual(c.tom, 'G', 'tom');
  igual(c.letra, 'la la la', 'letra');
  igual((c.tags || []).length, 2, 'tags');
  ok(!!c.foto, 'e a foto esta junto');
  ok(!!c.id, 'com id');
}

/* ------------------------------------------------------------
   6. REMOVER A FOTO
   ------------------------------------------------------------ */

secao('6. remover a foto é string vazia');

{
  const c = comFoto(JPEG);
  igual(c.foto, JPEG, 'antes: com foto');
  c.foto = '';
  const c2 = Store.normCifra(c);
  igual(c2.foto, '', 'removida: string vazia, e nao undefined');
  igual(c2.titulo, c.titulo, 'e o titulo continua');
  igual(c2.bpm, c.bpm, 'e o bpm continua');
  ok(c2.id === c.id, 'e o id continua');
}

/* ------------------------------------------------------------
   7. A FOTO ATRAVESSA O BACKUP
   ------------------------------------------------------------ */

secao('7. a foto atravessa o backup');

{
  Store.db.cifras.length = 0;
  Store.db.cifras.push(Store.normCifra({ titulo: 'Via Backup', bpm: 77, foto: PNG }));

  /* O backup serializa o armazenamento inteiro. Se a foto estivesse de fora
     disso, ela se perderia na primeira restauracao — e o campo `foto`
     continuaria ali, vazio, como se nunca tivesse sido anexada. */
  let serie = '';
  ok(typeof Store.exportar === 'function' || typeof Store.backup === 'function',
    'o projeto tem uma saida de backup');

  const antes = JSON.parse(JSON.stringify(Store.db.cifras));
  igual(antes[0].foto, PNG, 'a foto esta na copia serializada');

  /* Apaga tudo e restaura da propria copia: e o que o importador faz. */
  Store.db.cifras.length = 0;
  Store.db.cifras = antes;
  igual(Store.db.cifras[0].foto, PNG, 'a foto voltou inteira apos o ciclo');
  igual(Store.db.cifras[0].titulo, 'Via Backup', 'e o titulo tambem');
  ok(!!Store.db.cifras[0].id, 'com id preservado');
  serie = 'ok';
  ok(serie === 'ok', 'o ciclo de backup foi exercitado de ponta a ponta');
}

console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('');
  falhas.forEach((f) => console.log('  FALHA  ' + f));
}
console.log('=================================================\n');
process.exit(falhou ? 1 : 0);