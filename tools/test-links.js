/* Testes de regressao da leitura de link do YouTube.
   Rodar:  node tools/test-links.js

   O links.js fala com o resto do app por global.Links, entao e carregado no
   global com o minimo de que ele precisa.                                            */
global.Utils = { deaccent: function (s) { return String(s || ''); } };
require('../js/core/links.js');
const L = global.Links;

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const good = actual === expected;
  good ? pass++ : fail++;
  console.log((good ? '  ok   ' : '  FALHA') + '  ' + label +
    (good ? '' : '  -> obtido "' + actual + '", esperado "' + expected + '"'));
}
const ID = 'dQw4w9WgXcQ';

console.log('\n=== 1. As formas de link que o grupo usa ===');
[
  'https://www.youtube.com/watch?v=' + ID,
  'https://youtube.com/watch?v=' + ID + '&list=PL1',
  'https://m.youtube.com/watch?v=' + ID,
  'https://youtu.be/' + ID,
  'https://youtu.be/' + ID + '?t=42',
  'https://www.youtube.com/embed/' + ID,
  'https://www.youtube-nocookie.com/embed/' + ID,
  'https://www.youtube.com/shorts/' + ID,
  'https://www.youtube.com/live/' + ID,
  'https://www.youtube.com/v/' + ID,
  ID,
  '  ' + ID + '  ',
].forEach((u) => eq(L.extrairYouTubeId(u), ID, 'le "' + u.trim().slice(0, 50) + '"'));

console.log('\n=== 2. Link sem o https:// tambem e aceito ===');
[
  'youtube.com/watch?v=' + ID,
  'youtu.be/' + ID,
  'www.youtube.com/shorts/' + ID,
  'youtube-nocookie.com/embed/' + ID,
].forEach((u) => eq(L.extrairYouTubeId(u), ID, 'le "' + u + '"'));

console.log('\n=== 3. Host hifenizado nao vira id ===');
// "youtube-nocookie" tem onze caracteres ligando por hifen, e a busca solta
// pegava o host inteiro em vez do video. Era este o defeito: um link de
// compartilhamento sem cookie devolvia "youtube-noc" e tocava o video errado.
eq(L.extrairYouTubeId('https://www.youtube-nocookie.com/embed/' + ID), ID,
  'youtube-nocookie.com/embed/ devolve o id, e nao o host');
eq(L.extrairYouTubeId('https://music.youtube-nocookie.com/watch?v=' + ID), ID,
  'subdominio hifenizado tambem devolve o id');

console.log('\n=== 4. Dominio que nao e do YouTube e recusado ===');
[
  'https://meusite.com.br/watch?v=' + ID,
  'https://vimeo.com/' + ID,
  'https://youtube.com.br/video/' + ID,
  'https://notyoutube.com/watch?v=' + ID,
  'https://exemplo.com/' + ID,
].forEach((u) => eq(L.extrairYouTubeId(u), '', 'recusa "' + u + '"'));

console.log('\n=== 5. Entrada perigosa ou invalida ===');
[null, undefined, '', '   ', 'javascript:alert(1)', 'data:text/html,<script>',
  'file:///etc/passwd', 'lixo qualquer', 'abc', 42, {}].forEach((u) =>
  eq(L.extrairYouTubeId(u), '', 'recusa ' + JSON.stringify(u)));

console.log('\n=== 6. A URL do player nunca sai do YouTube ===');
let fora = 0;
[ID, 'https://youtu.be/' + ID, 'javascript:alert(1)', 'https://vimeo.com/' + ID,
  '<script>alert(1)</script>', '../../etc/passwd'].forEach((e) => {
  const url = L.embedYouTube(L.extrairYouTubeId(e) || e);
  if (url && url.indexOf('https://www.youtube-nocookie.com/embed/') !== 0) {
    fora++;
    console.log('  FALHA  saiu do YouTube: ' + url);
  }
});
eq(fora, 0, 'toda URL de player fica em youtube-nocookie.com');

console.log('\n=== 7. Montagem da URL do player ===');
ok = L.embedYouTube(ID);
eq(ok.indexOf('https://www.youtube-nocookie.com/embed/' + ID), 0, 'o id vai na URL');
eq(ok.indexOf('playsinline=1') > 0, true, 'tocando dentro da pagina, e nao em tela cheia');
eq(L.embedYouTube(ID, { t: 90 }).indexOf('start=90') > 0, true, 'recomeca no segundo pedido');
eq(L.embedYouTube(ID, { mi: true }).indexOf('mute=1') > 0, true, 'comeca mudo quando pedido');
eq(L.urlYouTube('https://youtu.be/' + ID + '?t=42'), 'https://www.youtube.com/watch?v=' + ID,
  'remonta o link de assistir');

console.log('\n=== 8. Tabela de fontes externas ===');
eq(L.urlDe('cifraclub', 'O Senhor e o meu Pastor', '').indexOf('cifraclub.com.br/?q=') > 0, true,
  'CifraClub: formato que responde');
eq(L.urlDe('letras', 'O Senhor', '').indexOf('letras.mus.br/?q=') > 0, true,
  'Letras.mus.br: formato que responde');
eq(L.urlDe('youtube', 'O Senhor', '').indexOf('search_query=') > 0, true,
  'YouTube: busca pelo titulo');
eq(L.urlDe('inexistente', 'x', ''), '', 'fonte inexistente devolve string vazia');
const todas = L.de('O Senhor e o meu Pastor', 'David Sacer');
eq(todas.every((f) => f.url.indexOf('https://') === 0), true,
  'toda fonte devolve URL absoluta');

console.log('\n=================================================');
console.log('  ' + pass + ' passaram, ' + fail + ' falharam');
console.log('=================================================\n');
process.exit(fail ? 1 : 0);
