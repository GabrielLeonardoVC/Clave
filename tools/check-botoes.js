/* =========================================================
   ACORDE - tools/check-botoes.js
   Nenhum botao dentro de outro botao.

   Existe por causa de um defeito real, encontrado na mesa de ensaio: a linha
   da anotacao era um `<button>` e o botao de apagar estava DENTRO dela.

   `<button>` dentro de `<button>` e HTML invalido. O navegador nao avisa — ele
   simplesmente fecha o botao de fora no primeiro `</button>` que encontra. O
   resultado e silencioso e grave ao mesmo tempo:

     - a linha da anotacao deixa de ser clicavel, entao clicar nela nao pula o
       video;
     - o botao de apagar acaba como um botao solto, do lado de fora;
     - na tela, nada indica que algo deu errado.

   Nao da para pegar isso no navegador com `querySelector`, porque o DOM gerado
   ja vem "consertado". Precisa ser conferido no codigo, antes do DOM existir.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { arquivosDe, RAIZ } = require('./arquivos.js');

/**
 * Aprofunda a partir de uma posicao e devolve onde a chamada fecha.
 *
 * Nao conta parenteses: `el('button', { onclick: function () { ... } }, [...])`
 * tem `{` e `}` que nao sao o fim da chamada, e `texto )` dentro de uma string
 * contaria errado. O que fecha uma chamada `el(` e um `)` no nivel zero de
 * parenteses — e o nivel e o que decide.
 */
function fechaEl(linhas, inicio) {
  let nivel = 0;
  let emString = null;
  for (let i = inicio; i < linhas.length; i++) {
    const linha = linhas[i];
    for (let c = 0; c < linha.length; c++) {
      const ch = linha[c];
      if (emString) {
        if (ch === '\\') { c++; continue; }
        if (ch === emString) emString = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') { emString = ch; continue; }
      if (ch === '(') nivel++;
      else if (ch === ')') {
        nivel--;
        if (nivel === 0) return i;
      }
    }
  }
  return -1;
}

const problemas = [];

/* Tudo em funcao, e nao no nivel do modulo. Sem isto, as variaveis daqui
   (`nivel`, `linha`, `i`, `trimmed`...) vazam para o require de quem vier
   depois, e um verificador que roda junto com os outros quebra o arquivo que
   parece innocentemente ler. */
(function varrer() {
  for (const arq of arquivosDe(/\.js$/)) {
    const rel = path.relative(RAIZ, arq).replace(/\\/g, '/');
    const linhas = fs.readFileSync(arq, 'utf8').split('\n');

    for (let a = 0; a < linhas.length; a++) {
      if (!/el\(\s*'button'/.test(linhas[a])) continue;
      const fim = fechaEl(linhas, a);
      if (fim < 0) continue;

      for (let b = a + 1; b <= fim; b++) {
        if (/el\(\s*'button'/.test(linhas[b])) {
          problemas.push({ rel, de: a + 1, dentro: b + 1, texto: linhas[a].trim().slice(0, 60) });
          break;   // um achado por botao de fora ja basta
        }
      }
    }
  }
})();

console.log('\n=== nenhum botao dentro de outro botao? ===');

if (!problemas.length) {
  console.log('  ok    nenhum botao aninhado');
} else {
  for (const p of problemas) {
    console.log('  FALHA ' + p.rel + ':' + p.de + ' tem um <button> dentro (linha ' + p.dentro + ')');
    console.log('        ' + p.texto);
  }
  console.log('');
  console.log('        O navegador fecha o botao de fora no primeiro </button>:');
  console.log('        o de dentro vira solto e o de fora deixa de responder.');
  console.log('        Use um <div role="button" tabindex="0"> no de fora.');
}

console.log('');
console.log('=================================================');
console.log(problemas.length
  ? problemas.length + ' botao(s) com outro dentro.'
  : 'ok: nenhum botao dentro de outro.');
process.exit(problemas.length ? 1 : 0);