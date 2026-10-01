/* =========================================================
   ACORDE - tools/check-tags.js
   Nenhuma tag acentuada, e nenhuma tag inventada.

   Existe por causa de um defeito real: `cancao.js` montava o player da faixa
   narrada com `el('áudio', ...)`, com acento.

   `document.createElement('áudio')` NAO dá erro. O navegador cria um elemento
   desconhecido, com o nome do elemento trocado para minusculo e o acento
   mantido, e o app segue rodando. O resultado e o pior tipo de defeito: a tela
   mostra o titulo da faixa, o texto da passagem, e um retangulo vazio onde
   deveria estar o player — enquanto o codigo logo acima diz que existe uma
   gravacao. Nada no console, nada no `querySelector`, nenhum aviso.

   Como nao da para pegar pelo DOM gerado (ele ja vem "consertado"), a
   conferencia e no codigo, na hora de escrever.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { arquivosDe, RAIZ } = require('./arquivos.js');

/* As tags que o `document.createElement` entende. Uma lista curta e fechada e
   melhor do que tentar adivinhar: o objetivo e pegar o erro de digitacao e o
   acento, e nao validar um HTML completo. `svg` precisa estar aqui porque os
   Namespace differem mas o nome da tag e o mesmo. */
const CONHECIDAS = new Set([
  'a', 'abbr', 'article', 'aside', 'audio', 'b', 'blockquote', 'br', 'button',
  'canvas', 'caption', 'circle', 'code', 'col', 'dd', 'div', 'dl', 'dt', 'em',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'g', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'header', 'hr', 'i', 'iframe', 'img', 'input', 'label',
  'li', 'main', 'nav', 'ol', 'option', 'p', 'path', 'pre', 'progress', 'rect',
  's', 'script', 'section', 'select', 'small', 'span', 'strong', 'style',
  'sub', 'sup', 'svg', 'table', 'tbody', 'td', 'template', 'textarea',
  'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'u', 'ul', 'video',
]);

const problemas = [];

for (const arq of arquivosDe(/\.(js|html)$/)) {
  /* O proprio verificador nao entra: ele escreve `el('áudio')` na documentacao
     do defeito, e a expressao regular tem exemplos que nao sao tags. Seria
     acusado de exatamente aquilo que ele existe para achar. */
  if (path.basename(arq) === path.basename(__filename)) continue;

  const rel = path.relative(RAIZ, arq).replace(/\\/g, '/');
  const linhas = fs.readFileSync(arq, 'utf8').split('\n');

  linhas.forEach(function (linha, i) {
    /* `el('...')` e `createElement('...')`: os dois criam elemento por nome.
       O segundo parametro e o namespace, que nao interfere. */
    const re = /\b(?:el|createElement)\(\s*'([^']*)'/g;
    let m;
    while ((m = re.exec(linha)) !== null) {
      const tag = m[1];
      if (!tag) continue;
      const minuscula = tag.toLowerCase();
      const temAcento = /[^\x00-\x7F]/.test(tag);
      if (temAcento) {
        problemas.push({
          rel, linha: i + 1, tag,
          tipo: 'acentada',
          msg: "tem acento — o navegador cria um elemento desconhecido, sem erro",
        });
      } else if (!CONHECIDAS.has(minuscula)) {
        problemas.push({
          rel, linha: i + 1, tag,
          tipo: 'desconhecida',
          msg: 'nao e uma tag conhecida — pode ser erro de digitacao',
        });
      }
    }
  });
}

console.log('\n=== toda tag criada existe de verdade? ===');

if (!problemas.length) {
  console.log('  ok    todas as tags criadas sao reais');
} else {
  for (const p of problemas) {
    console.log('  FALHA ' + p.rel + ':' + p.linha + "  el('" + p.tag + "')  " + p.msg);
  }
  console.log('');
  console.log('        createElement nao acusa nome invalido: o elemento');
  console.log('        simplesmente aparece e nunca faz o que deveria.');
}

console.log('');
console.log('=================================================');
console.log(problemas.length
  ? problemas.length + ' tag(s) invalida(s).'
  : 'ok: toda tag criada e uma tag de verdade.');
process.exit(problemas.length ? 1 : 0);