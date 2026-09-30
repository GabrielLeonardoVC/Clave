/* Guarda o vocabulario do app.
   Rodar:  node tools/termos.js

   O app fala a lingua de quem usa: missa, ensaio, show, repertorio, musica.
   Nao e preciosismo — e que o nome da tela e o primeiro lugar que o usuario
   le antes de qualquer icone. "Culto", "louvor" e "hino" tiram a pessoa do
   aplicativo na hora.

   A lista e conferida a cada `npm run verificar` e no deploy, entao o termo
   antigo nao volta sem quebrar a build.
   --------------------------------------------------------- */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { arquivosDe, RAIZ } = require('./arquivos.js');

/**
 * Termos que nao devem aparecer no app.
 *
 * Os padroes sao escritos com escape Unicode e nao com o caractere acentuado
 * literal. Parecia funcionar, mas nao: um literal depende de como o arquivo foi
 * gravado, e uma diferenca de normalizacao — "ç" de um byte so contra "c" mais
 * o acento combinando — faz o padrao deixar de casar sem erro nenhum. Num
 * validador isso e pior que nao ter validador: passa dando falso Assurance.
 *
 * Por isso o texto lido tambem passa por NFC, e os padroes usam \\u.
 */
const PROIBIDOS = [
  { re: /\bculto\b/iu, porque: 'use "missa"' },
  { re: /\blouvor\b/iu, porque: 'use "oferta" ou "missa"' },
  { re: /\bador(?:a\u00e7\u00e3o|acao)\b/iu, porque: 'use "devocional"' },
  { re: /\bhino(?:s|rio)?s?\b/iu, porque: 'use "repertório" ou "canção"' },
  { re: /\bigreja\b/iu, porque: 'use o local real, como "salão paroquial"' },
  { re: /\brehearsal\b/iu, porque: 'use "show" ou "ensaio"' },
  { re: /\bcongrega(?:cao|\u00e7\u00e3o)\b/iu, porque: 'use "grupo"' },
  { re: /\bdominical\b/iu, porque: 'use "missa" ou "ensaio"' },
];

/** Arquivos em que o termo antigo e permitido, e por que. */
const IGNORAR = {
  'tools/termos.js': 'a propria lista de termos',
  'README.md': 'documenta a troca de vocabulario',
  'js/core/store.js': 'traduz os tipos antigos ja salvos no aparelho',
  'tools/test-termos.js': 'o proprio teste',
};

let problemas = 0;
let conferidos = 0;

const fontes = arquivosDe(/\.(js|html|json|webmanifest|md)$/).filter(
  (f) => !/[\\/]node_modules[\\/]/.test(f) && !/[\\/]\.git[\\/]/.test(f),
);

for (const arquivo of fontes) {
  const rel = path.relative(RAIZ, arquivo).split(path.sep).join('/');
  if (IGNORAR[rel]) continue;

  const texto = fs.readFileSync(arquivo, 'utf8').normalize('NFC');
  const linhas = texto.split('\n');
  conferidos++;

  for (const regra of PROIBIDOS) {
    for (let i = 0; i < linhas.length; i++) {
      if (regra.re.test(linhas[i])) {
        problemas++;
        console.log(
          '  ' + rel + ':' + (i + 1) +
          '  "' + linhas[i].trim().slice(0, 60) + '"  -> ' + regra.porque,
        );
      }
    }
  }
}

console.log('\n' + conferidos + ' arquivos conferidos, ' + problemas + ' termo(s) a trocar.');
if (problemas === 0) {
  console.log('OK: o app fala a lingua de quem usa.');
}
process.exit(problemas ? 1 : 0);
