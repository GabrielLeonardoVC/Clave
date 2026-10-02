/* =========================================================
   tools/provar-boot.js
   Prova que o `test-boot` pega o que ele diz pegar.

   Este teste e o unico do projeto que carrega o app INTEIRO, na ordem do
   HTML. E por isso que ele e o unico que precisa de prova com tanto cuidado:
   um teste de boot que passa com o app quebrado e o teste mais perigoso que
   existe — da a sensacao de que tudo esta coberto, e nao esta.

   As mutacoes abaixo mexem na ORDEM dos scripts, que e a coisa que este teste
   ve e que nenhum outro ve. Nenhuma delas altera uma linha de codigo: e a
   mesma prova que o navegador faz, na mesma ordem, e so que invertida.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const HTML = path.join(RAIZ, 'index.html');
const VERIF = path.join(__dirname, 'test-boot.js');
const NL = String.fromCharCode(10);

const original = fs.readFileSync(HTML, 'utf8');

/* Troca duas linhas de script de lugar, mantendo o resto intacto. */
function trocar(a, b) {
  if (original.indexOf(a) < 0 || original.indexOf(b) < 0) return null;
  return original.split(a).join('@@A@@').split(b).join(a).split('@@A@@').join(b);
}

const MUTACOES = [
  {
    nome: 'o timbre passou a carregar depois do audio',
    a: '<script src="js/core/timbre.js"></script>',
    b: '<script src="js/core/audio.js"></script>',
    comentario: 'o audio usa o motor de timbre no primeiro toque; invertido, sairia'
      + ' tom puro sem aviso nenhum',
  },
  {
    nome: 'o store passou a carregar depois do audio',
    a: '<script src="js/core/store.js"></script>',
    b: '<script src="js/core/audio.js"></script>',
    comentario: 'o audio le a escolha de instrumento do Store',
  },
  {
    nome: 'o app passou a carregar antes das telas',
    a: '<script src="js/views/hoje.js"></script>',
    b: '<script src="js/app.js"></script>',
    comentario: 'o app monta as telas; carregado antes, ele nao acha nenhuma',
  },
  {
    nome: 'um script foi apagado do HTML',
    remover: '<script src="js/core/timbre.js"></script>',
    comentario: 'o navegador segue e da um 404 em silencio; o global nunca aparece',
  },
  {
    nome: 'o app.js deixou de ser o ultimo',
    a: '<script src="js/app.js"></script>',
    b: '<script src="js/data/base.js"></script>',
    comentario: 'qualquer coisa depois do app monta por cima do que ele fez',
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

let falhas = 0;
console.log('\n=== o teste de boot pega a ordem errada? ===\n');

for (const m of MUTACOES) {
  let modificado = null;
  if (m.remover) {
    if (original.indexOf(m.remover) < 0) {
      console.log('  FALHA ' + m.nome);
      console.log('          nao achei o script para remover');
      falhas++;
      continue;
    }
    modificado = original.split(m.remover).join('');
  } else {
    modificado = trocar(m.a, m.b);
    if (!modificado) {
      console.log('  FALHA ' + m.nome);
      console.log('          nao achei um dos dois scripts');
      console.log('          procurava: ' + JSON.stringify(m.a));
      falhas++;
      continue;
    }
  }
  if (modificado === original) {
    console.log('  FALHA ' + m.nome);
    console.log('          a troca nao mudou nada');
    falhas++;
    continue;
  }

  fs.writeFileSync(HTML, modificado, 'utf8');
  const r = rodar();
  fs.writeFileSync(HTML, original, 'utf8');

  if (r.quebrou) {
    console.log('  FALHA ' + m.nome);
    console.log('          o teste QUEBROU em vez de reprovar.');
    falhas++;
    continue;
  }

  const acusou = /FALHA/.test(r.saida);
  console.log((acusou ? '  ok    ' : '  FALHA ') + m.nome);
  if (!acusou) {
    console.log('          o teste passou com a ordem errada');
    console.log('          ' + m.comentario);
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

fs.writeFileSync(HTML, original, 'utf8');
const voltou = fs.readFileSync(HTML, 'utf8') === original;
console.log('\n  ' + (voltou ? 'ok    ' : 'FALHA ') + 'o index.html voltou ao estado original');
if (!voltou) falhas++;

const limpo = rodar();
const passou = !limpo.caiu && !/FALHA/.test(limpo.saida);
console.log((passou ? '  ok    ' : '  FALHA ') + 'e, sem nenhum defeito, o teste passa');
if (!passou) falhas++;

console.log('\n  ' + (MUTACOES.length + 2 - falhas) + ' de ' + (MUTACOES.length + 2)
  + ' se comportaram como deviam');
process.exit(falhas ? 1 : 0);