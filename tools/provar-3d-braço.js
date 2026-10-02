/* =========================================================
   tools/provar-3d-braço.js
   Prova que o `test-3d-braço` pega o que ele diz pegar.

   A geometria do braco e o tipo de coisa que passa: um violao com os trastes
   em intervalos iguais parece um violao, e so quem ja segurou um braco de
   verdade percebe. Por isso o teste existe — e por isso ele precisa ser
   provado, senao ele passa com o defeito instalado e ninguem descobre.

   O QUE ESTE ARQUIVO PROVA EM SI MESMO

   Cada mutacao abaixo desfaz uma correcao desta rodada. Se alguma delas
   passar, a verificacao correspondente nao esta medindo o que diz medir.

     - a lei do traste (o 12 na metade da escala);
     - o violino sem traste;
     - a geometria por instrumento;
     - o numero inteiro de trastes;
     - a cena realmente usando a tabela, e nao a geometria unica de antes.

   A REGRA DAS MUTACOES DE UMA LINHA

   Ver o cabecalho do `provar-instrumento.js`: copiar bloco de codigo para
   reescrever com um numero trocado ja custou duas rodadas neste projeto.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ALVO = path.join(RAIZ, 'js', 'views', 'violao3d.js');
const TESTE = path.join(__dirname, 'test-3d-braço.js');

const original = fs.readFileSync(ALVO, 'utf8');
const CR = String.fromCharCode(13);
const NL = String.fromCharCode(10);

const MUTACOES = [
  {
    nome: 'os trastes voltaram para espacamento uniforme',
    de: '  function posicaoDeTraste(f, escalaComprimento) {\n    return escalaComprimento * (1 - Math.pow(2, -f / 12));\n  }',
    para: '  function posicaoDeTraste(f, escalaComprimento) {\n    return f * ESCALA.trasteL;\n  }',
  },
  {
    nome: 'a lei errada no expoente (o 12 cai fora da metade)',
    de: '    return escalaComprimento * (1 - Math.pow(2, -f / 12));',
    para: '    return escalaComprimento * (1 - Math.pow(2, -f / 11));',
  },
  {
    nome: 'o violino ganhou traste de novo',
    de: 'trastes: false },',
    para: 'trastes: true },',
  },
  {
    nome: 'a geometria voltou a ser uma so para todos',
    de: '    ukulele: { cordaEsp: 0.44, escalaComprimento: 6.2,',
    para: '    ukulele: { cordaEsp: 0.62, escalaComprimento: 8.9,',
  },
  {
    nome: 'o ukulele ficou com a escala do violao',
    de: 'escalaComprimento: 6.2,',
    para: 'escalaComprimento: 8.9,',
  },
  {
    nome: 'o numero de trastes deixou de ser inteiro',
    de: '    const n = Math.max(1, Math.min(24, Math.round(Number(nf)) || 12));',
    para: '    const n = Math.max(1, Math.min(24, nf || 12));',
  },
  {
    nome: 'a cena voltou a usar a cordaEsp unica de ESCALA',
    de: '    const cordaEsp = geoBase.cordaEsp;',
    para: '    const cordaEsp = ESCALA.cordaEsp;',
  },
  {
    nome: 'um instrumento ficou sem geometria',
    de: '    cavaquinho: { cordaEsp: 0.46, escalaComprimento: 6.6, alturaL: 0.12, nutL: 0.38, nutH: 0.24, cabeca: true, trastes: true },',
    para: '    /* cavaquinho sem geometria */',
  },
  {
    nome: 'os marcadores de posicao sumiram',
    de: 'const MARCADORES = [3, 5, 7, 9, 12];',
    para: 'const MARCADORES = [];',
  },
  {
    nome: 'a cabeca com as chaves sumiu',
    de: "return g.cabeca !== false ? g.nutL * 2.1 : 0;",
    para: 'return 0;',
  },
];

/* O fim de linha e lido do proprio arquivo. Os arquivos deste projeto nao sao
 * todos iguais, e uma mutacao escrita com o fim errado nao casa com nada — o
 * provador reporta "nao achei o trecho", que parece defeito do codigo. */
const EOL = original.indexOf(CR + NL) >= 0 ? CR + NL : NL;

function rodarTeste() {
  try {
    const saida = execFileSync(process.execPath, [TESTE], { encoding: 'utf8', cwd: RAIZ, timeout: 180000 });
    return { saida: saida, caiu: false, quebrou: false };
  } catch (e) {
    const texto = (e.stdout || '') + (e.stderr || '');
    const quebrou = /TypeError|ReferenceError|SyntaxError|RangeError|is not a function|Cannot read propert/.test(texto);
    return { saida: texto, caiu: true, quebrou: quebrou };
  }
}

let falhas = 0;
console.log('\n=== o teste da geometria pega o defeito? ===\n');

for (const m of MUTACOES) {
  const de = m.de.split(NL).join(EOL);
  const para = m.para.split(NL).join(EOL);
  const achadas = original.split(de).length - 1;
  if (achadas !== 1) {
    console.log('  FALHA ' + m.nome);
    console.log('          o trecho aparece ' + achadas + ' vez(es), e o provador espera 1.');
    console.log('          procurava: ' + JSON.stringify(m.de.slice(0, 80)));
    falhas++;
    continue;
  }

  fs.writeFileSync(ALVO, original.split(de).join(para), 'utf8');
  const r = rodarTeste();
  fs.writeFileSync(ALVO, original, 'utf8');

  if (r.quebrou) {
    console.log('  FALHA ' + m.nome);
    console.log('          o teste QUEBROU em vez de reprovar.');
    falhas++;
    continue;
  }

  const acusou = /FALHA/.test(r.saida);
  console.log((acusou ? '  ok    ' : '  FALHA ') + m.nome);
  if (!acusou) {
    console.log('          o teste passou com o defeito instalado');
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

fs.writeFileSync(ALVO, original, 'utf8');
const voltou = fs.readFileSync(ALVO, 'utf8') === original;
console.log('\n  ' + (voltou ? 'ok    ' : 'FALHA ') + 'o violao3d.js voltou ao estado original');
if (!voltou) falhas++;

const limpo = rodarTeste();
const passou = !limpo.caiu && !/FALHA/.test(limpo.saida);
console.log((passou ? '  ok    ' : '  FALHA ') + 'e, sem nenhum defeito, o teste passa');
if (!passou) falhas++;

console.log('\n  ' + (MUTACOES.length + 2 - falhas) + ' de ' + (MUTACOES.length + 2)
  + ' se comportaram como deviam');
process.exit(falhas ? 1 : 0);