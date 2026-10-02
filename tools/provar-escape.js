/* =========================================================
   tools/provar-escape.js
   Prova que o `check-escape` pega o que ele diz pegar.

   Este verificador nao nasceu de um defeito: nasceu de uma auditoria que nao
   achou brecha. E um verificador assim e o mais facil de passar vazio — a
   tentacao e ele nao accusationar nada nunca, e isso nao e seguranca, e
   disfarce.

   Por isso cada regra recebe aqui a mutacao que ela deveria pegar. Se alguma
   passar, a regra esta olhando para o lado errado.

   A REGRA DAS MUTACOES DE UMA LINHA

   Ver o cabecalho do `provar-instrumento.js`. Copiar bloco de codigo para
   reescrever com um numero trocado ja custou duas rodadas neste projeto.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const VERIF = path.join(__dirname, 'check-escape.js');
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);

const ALVOS = {
  'js/core/utils.js': path.join(RAIZ, 'js', 'core', 'utils.js'),
  'js/core/share.js': path.join(RAIZ, 'js', 'core', 'share.js'),
  'js/core/print.js': path.join(RAIZ, 'js', 'core', 'print.js'),
  'js/core/store.js': path.join(RAIZ, 'js', 'core', 'store.js'),
};

const originais = {};
const eol = {};
for (const rel of Object.keys(ALVOS)) {
  originais[rel] = fs.readFileSync(ALVOS[rel], 'utf8');
  eol[rel] = originais[rel].indexOf(CR + NL) >= 0 ? CR + NL : NL;
}

const MUTACOES = [
  {
    nome: 'esc() parou de trocar as aspas',
    rel: 'js/core/utils.js',
    de: ".replace(/\"/g, '&quot;').replace(/'/g, '&#39;');",
    para: ";",
  },
  {
    nome: 'esc() parou de trocar o &',
    rel: 'js/core/utils.js',
    de: ".replace(/&/g, '&amp;')",
    para: "",
  },
  {
    nome: 'esc() passou a trocar o & depois do <',
    rel: 'js/core/utils.js',
    de: ".replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')",
    para: ".replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;')",
  },
  {
    nome: 'uma coluna da tabela da impressa entrou sem esc()',
    rel: 'js/core/print.js',
    de: "esc(m.categoria || '')",
    para: "(m.categoria || '')",
  },
  {
    nome: 'o titulo do .ics parou de ser escapado',
    rel: 'js/core/share.js',
    de: "'SUMMARY:' + esc(e.titulo),",
    para: "'SUMMARY:' + e.titulo,",
  },
  {
    nome: 'o local do .ics parou de ser escapado',
    rel: 'js/core/share.js',
    de: "'LOCATION:' + esc(e.local || ''),",
    para: "'LOCATION:' + (e.local || ''),",
  },
  {
    nome: 'o .ics voltou a deixar passar o carriage return sozinho',
    rel: 'js/core/share.js',
    de: ".replace(/\\r\\n|\\r|\\n/g, '\\\\n');",
    para: ".replace(/\\r?\\n/g, '\\\\n');",
  },
  {
    nome: 'a foto passou a aceitar SVG, que executa script',
    rel: 'js/core/store.js',
    de: 'const FOTOS_OK = /^data:image\\/(png|jpeg|jpg|webp|gif);base64,/i;',
    para: 'const FOTOS_OK = /^data:image\\/(png|jpeg|jpg|webp|gif|svg\\+xml);base64,/i;',
  },
  {
    nome: 'window.open sem noopener',
    rel: 'js/core/utils.js',
    de: "window.open(parsed.href, '_blank', 'noopener,noreferrer');",
    para: "window.open(parsed.href, '_blank');",
  },
  {
    nome: 'o blob foi revogado cedo de novo',
    rel: 'js/core/utils.js',
    de: '      }, 60000);',
    para: '      }, 100);',
  },
  {
    nome: 'eval entrou no app',
    rel: 'js/core/utils.js',
    de: '  function esc(s) {',
    para: '  function esc(s) {\n    if (global.__p) return eval(s);',
  },
];

function rodar() {
  try {
    const saida = execFileSync(process.execPath, [VERIF], { encoding: 'utf8', cwd: RAIZ, timeout: 180000 });
    return { saida: saida, caiu: false, quebrou: false };
  } catch (e) {
    const texto = (e.stdout || '') + (e.stderr || '');
    const quebrou = /TypeError|ReferenceError|SyntaxError|Invalid regular expression/.test(texto);
    return { saida: texto, caiu: true, quebrou: quebrou };
  }
}

function restaurar() {
  for (const rel of Object.keys(ALVOS)) fs.writeFileSync(ALVOS[rel], originais[rel], 'utf8');
}

let falhas = 0;
console.log('\n=== o verificador de escape pega o defeito? ===\n');

for (const m of MUTACOES) {
  const e = eol[m.rel];
  const de = m.de.split(NL).join(e);
  const para = m.para.split(NL).join(e);
  const achadas = originais[m.rel].split(de).length - 1;

  if (achadas !== 1) {
    console.log('  FALHA ' + m.nome);
    console.log('          o trecho aparece ' + achadas + ' vez(es), e o provador espera 1.');
    console.log('          procurava: ' + JSON.stringify(m.de.slice(0, 70)));
    falhas++;
    continue;
  }

  fs.writeFileSync(ALVOS[m.rel], originais[m.rel].split(de).join(para), 'utf8');
  const r = rodar();
  restaurar();

  if (r.quebrou) {
    console.log('  FALHA ' + m.nome);
    console.log('          o verificador QUEBROU em vez de reprovar.');
    falhas++;
    continue;
  }

  const acusou = /FALHA/.test(r.saida);
  console.log((acusou ? '  ok    ' : '  FALHA ') + m.nome);
  if (!acusou) {
    console.log('          o verificador passou com o defeito instalado');
    falhas++;
  } else {
    for (const l of r.saida.split(NL)) {
      if (/FALHA/.test(l) && l.indexOf('    - ') < 0) {
        console.log('          ' + l.trim().slice(0, 92));
        break;
      }
    }
  }
}

restaurar();
let voltou = true;
for (const rel of Object.keys(ALVOS)) {
  if (fs.readFileSync(ALVOS[rel], 'utf8') !== originais[rel]) voltou = false;
}
console.log('\n  ' + (voltou ? 'ok    ' : 'FALHA ') + 'todos os arquivos voltaram ao estado original');
if (!voltou) falhas++;

const limpo = rodar();
const passou = !limpo.caiu && !/FALHA/.test(limpo.saida);
console.log((passou ? '  ok    ' : '  FALHA ') + 'e, sem nenhum defeito, o verificador passa');
if (!passou) falhas++;

console.log('\n  ' + (MUTACOES.length + 2 - falhas) + ' de ' + (MUTACOES.length + 2)
  + ' se comportaram como deviam');
process.exit(falhas ? 1 : 0);