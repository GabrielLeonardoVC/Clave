/* =========================================================
   ACORDE - tools/check-conteudo.js
   O conteudo dos elementos vai pela chave que o construtor entende.

   Existe por causa de um defeito real. O construtor de elemento trata so
   algumas chaves para conteudo: text para texto, html para marcacao. Passar
   textContent cria um ATRIBUTO com esse nome, e o elemento fica vazio.

   Aconteceu com o relogio da gravacao: aparecia um retangulo vazio onde
   deveria aparecer 0:00. Sem erro no console, sem aviso, sem teste que
   pegasse — o elemento existia, so estava vazio.

   E um bug que se repete: e o nome intuitivo da propriedade do DOM, entao
   qualquer um que ja/programou vai passar a chave certa achando que
   passou. Da para conferir em um segundo, e nao e o tipo de coisa que se
   encontra sozinho.
   ========================================================= */
const fs = require('fs');
const path = require('path');

const RAIZ = 'C:/Users/Gilson/Documents/Micro Saas/Cifras-pro/js';
const arqs = [];
(function anda(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) anda(p);
    else if (e.name.endsWith('.js')) arqs.push(p);
  }
})(RAIZ);

/* As chaves que `el()` trata de verdade. Qualquer outra vira atributo. */
const ACEITAS = ['class', 'html', 'text', 'style', 'dataset', 'id', 'title',
  'type', 'value', 'placeholder', 'rows', 'cols', 'min', 'max', 'step',
  'name', 'href', 'src', 'alt', 'width', 'height', 'role', 'tabindex',
  'autocomplete', 'autocapitalize', 'spellcheck', 'disabled', 'selected',
  'multiple', 'accept', 'download', 'target', 'rel', 'loading', 'controls',
  'preload', 'readonly', 'required', 'hidden'];

console.log('\n=== o que el() entende ===');
const utils = fs.readFileSync(path.join(RAIZ, 'core', 'utils.js'), 'utf8');
utils.split('\n').forEach((l, i) => {
  if (l.indexOf("=== 'text'") >= 0 || l.indexOf("=== 'html'") >= 0 ||
      l.indexOf('hasOwnProperty') >= 0) {
    console.log('  L' + (i + 1) + ': ' + l.trim().slice(0, 90));
  }
});

console.log('\n=== conteudo passado com a chave errada ===');

const ERRADAS = ['textContent', 'innerText', 'innerHTML', 'nodeValue', 'content'];
let achadas = 0;

for (const a of arqs) {
  const linhas = fs.readFileSync(a, 'utf8').split('\n');
  linhas.forEach((l, i) => {
    for (const errada of ERRADAS) {
      // Procura `el(` seguido de `{` e da chave errada, na mesma linha.
      if (!new RegExp('el\\([^)]*' + errada + ':').test(l)) continue;
      achadas++;
      console.log('  ' + path.basename(a) + ':' + (i + 1) +
        '  ' + errada + ':  ' + l.trim().slice(0, 80));
      console.log('        el() so trata "text" (para o texto) e "html" (para marcação).');
      console.log('        "' + errada + '" vira um atributo chamado ' + errada + ', e o');
      console.log('        elemento fica vazio — sem erro, sem aviso.');
    }
  });
}

if (!achadas) console.log('  ok    nenhuma chave errada para o conteudo');

console.log('\n=================================================');
console.log(achadas ? '  ' + achadas + ' passagem(es) com a chave errada'
  : '  todo o conteudo passa pela chave certa');
console.log('=================================================\n');
process.exit(achadas ? 1 : 0);