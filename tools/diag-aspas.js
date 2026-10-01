/* O extrator de texto se perde em algum arquivo?

   O verificador de ortografia le os trechos entre aspas para procurar palavras
   que perderam o acento. Se o extrator se perder — por causa de um regex, de
   uma barra-estrela dentro de uma string, de um bloco mal fechado — ele inventa
   rotulos onde nao ha nenhum, e o verificador passa a acusar coisas certas.

   Perder credibilidade e pior do que nao ter verificador: a pessoa para de
   olhar a saida, e um defeito real passa junto.

   Este script NAO tem maquina de estados propria. Ele chama a mesma mascara do
   extrator e a mesma funcao de conferencia — porque duas copias das regras
   divergem, e foi exatamente assim que este arquivo acusou arquivos que
   estavam corretos.

   Uso: node tools/diag-aspas.js
*/
'use strict';

const fs = require('fs');
const path = require('path');

const X = require('./extrair-texto.js');
const RAIZ = path.join(__dirname, '..');

const arqs = [];
(function anda(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      anda(p);
    } else if (/\.(js|css|html)$/.test(e.name)) {
      arqs.push(p);
    }
  }
})(RAIZ);

let problemas = 0;

for (const arq of arqs) {
  const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
  const bruto = fs.readFileSync(arq, 'utf8');

  /* Dois blocos de comentario abertos seguidos. O segundo e tratado como
     conteudo do primeiro, e o paramento se perde a partir dai. */
  if (/\.js$/.test(arq)) {
    const linhas = bruto.split('\n');
    for (let i = 0; i < linhas.length - 1; i++) {
      if (/^\s*\/\*\*\s*$/.test(linhas[i]) && /^\s*\/\*\*\s*$/.test(linhas[i + 1])) {
        console.log(rel + ':' + (i + 1) + '  dois blocos de comentario abertos seguidos');
        problemas++;
      }
    }
  }

  const sobra = X.primeiraAspaAberta(X.mascara(bruto));
  if (sobra) {
    console.log(rel + ':' + sobra.linha + '  ' + sobra.tipo + ' nao fecha');
    console.log('    ' + JSON.stringify(sobra.trecho));
    problemas++;
  }
}

console.log('');
console.log(arqs.length + ' arquivo(s) conferidos');
console.log(problemas
  ? problemas + ' ponto(s) onde o extrator se perde'
  : 'ok    nenhum arquivo perde o extrator');
process.exit(problemas ? 1 : 0);