/* =========================================================
   tools/provar-escolha.js
   Prova que o `test-escolha` pega o que ele diz pegar.

   Este teste protege a COERENCIA entre tres listas: o timbre, o braco e a
   preferencia guardada.incoerencia entre elas nao da erro — ela desenha a coisa
   errada, toca o som errado, ou deixa um botao sem efeito. Por isso cada
   mutacao abaixo quebra UM dos lados e deixa o outro inteiro, que e exatamente
   a forma como a coisa se estraga no app de verdade.

   A REGRA DAS MUTACOES DE UMA LINHA

   Ver o cabecalho do `provar-instrumento.js`. Copiar bloco de codigo para
   reescrever com um numero trocado ja custou duas rodadas neste projeto: o fim
   de linha tem de bater e cada linha copiada pode sair com um caractere a mais
   ou a menos, sem aviso.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const TESTE = path.join(__dirname, 'test-escolha.js');
const NL = String.fromCharCode(10);

const ALVOS = {
  'js/core/timbre.js': path.join(RAIZ, 'js', 'core', 'timbre.js'),
  'js/core/music.js': path.join(RAIZ, 'js', 'core', 'music.js'),
  'js/core/store.js': path.join(RAIZ, 'js', 'core', 'store.js'),
  'js/core/audio.js': path.join(RAIZ, 'js', 'core', 'audio.js'),
  'js/views/emergencia.js': path.join(RAIZ, 'js', 'views', 'emergencia.js'),
  'js/views/afinador.js': path.join(RAIZ, 'js', 'views', 'afinador.js'),
};

const originais = {};
for (const rel of Object.keys(ALVOS)) {
  originais[rel] = fs.readFileSync(ALVOS[rel], 'utf8');
}

const MUTACOES = [
  {
    nome: 'um instrumento do braco ficou sem timbre (o jeito do baixo5)',
    rel: 'js/core/timbre.js',
    de: '    baixo5: {',
    para: '    baixoCincoQueNaoExiste: {',
  },
  {
    /* A mutacao nao e na busca, e na normalizacao. A linha da busca aparece
     * duas vezes no arquivo — em `instrumento()` e em `idDeInstrumento()` — e
     * uma string que casa duas vezes e ambigua: o provador recusa por contagem,
     * e quem escreveu pensou que era detalhe. */
    nome: 'a busca voltou a comparar o id com acento',
    rel: 'js/core/music.js',
    de: "    .normalize('NFD')",
    para: "    .normalize('NFC')",
  },
  {
    nome: 'quem nao tem braco passou a receber o violao',
    rel: 'js/core/music.js',
    de: '  if (!braco) return null;',
    para: '  if (!braco) return INSTRUMENTO_PADRAO;',
  },
  {
    nome: 'um timbre aponta para um braco que nao existe',
    rel: 'js/core/timbre.js',
    de: '      braco: \'cavaquinho\',',
    para: '      braco: \'violaQueNaoExiste\',',
  },
  {
    nome: 'a preferencia de instrumento sumiu do formato guardado',
    rel: 'js/core/store.js',
    de: "        instrumento: 'violao',",
    para: '        /* sem preferencia de instrumento */',
  },
  {
    nome: 'o backup passou a descartar a preferencia de instrumento',
    rel: 'js/core/store.js',
    de: "'metroAcento', 'instrumento'];",
    para: "'metroAcento'];",
  },
  {
    nome: 'o tom puro deixou de ser respeitado no audio',
    rel: 'js/core/audio.js',
    de: '    const escolhido = opts.puro === true ? null',
    para: '    const escolhido = opts.puro === false ? null',
  },
  {
    nome: 'a emergencia passou a tocar com o timbre do instrumento',
    rel: 'js/views/emergencia.js',
    de: "A.tocarNota(hz, 1.6, { volume: 0.24, puro: true });",
    para: "A.tocarNota(hz, 1.6, { volume: 0.24 });",
  },
  {
    nome: 'o afinador passou a tocar com o timbre do instrumento',
    rel: 'js/views/afinador.js',
    de: 'global.Nota.tocarNota(hz, 1.2, { puro: true })',
    para: 'global.Nota.tocarNota(hz, 1.2)',
  },
  {
    nome: 'um timbre fora de alcance entrou na lista do picker',
    rel: 'js/core/timbre.js',
    de: '      noPique: true,',
    para: '      /* saiu da lista */',
  },
  /* A mutacao que morava no `provar-instrumento` e que nao pegava la.
   *
   * O `test-instrumento` monta o audio SEM o Store, entao a escolha da
   * pessoa nunca chega a ser lida e trocar `instrumentoDaPessoa()` por
   * `return null` nao mudava nada naquele teste. Aqui o Store existe, e a
   * escolha e lida de verdade.
   *
   * O defeito: com a escolha ignorada, o app toca sempre no tom puro. O
   * som FUNCIONA, so nao e o instrumento de quem escolheu — e e o tipo de
   * defeito que ninguem percebe usando, porque nao ha erro nenhum. */
  {
    nome: 'a escolha de instrumento da pessoa foi ignorada',
    rel: 'js/core/audio.js',
    de: "    return typeof id === 'string' && id ? id : null;",
    para: '    return null;',
  },
];

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

function restaurar() {
  for (const rel of Object.keys(ALVOS)) {
    fs.writeFileSync(ALVOS[rel], originais[rel], 'utf8');
  }
}

let falhas = 0;
console.log('\n=== o teste da escolha pega o defeito? ===\n');

for (const m of MUTACOES) {
  const base = originais[m.rel];
  const achadas = base.split(m.de).length - 1;
  if (achadas !== 1) {
    console.log('  FALHA ' + m.nome);
    console.log('          a linha aparece ' + achadas + ' vez(es), e o provador espera 1.');
    console.log('          procurava: ' + JSON.stringify(m.de));
    falhas++;
    continue;
  }

  fs.writeFileSync(ALVOS[m.rel], base.split(m.de).join(m.para), 'utf8');
  const r = rodarTeste();
  restaurar();

  if (r.quebrou) {
    console.log('  FALHA ' + m.nome);
    console.log('          o teste QUEBROU em vez de reprovar — ele nao chegou a olhar.');
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
        console.log('          ' + l.trim().slice(0, 94));
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

const limpo = rodarTeste();
const passou = !limpo.caiu && !/FALHA/.test(limpo.saida);
console.log((passou ? '  ok    ' : '  FALHA ') + 'e, sem nenhum defeito, o teste passa');
if (!passou) falhas++;

console.log('\n  ' + (MUTACOES.length + 2 - falhas) + ' de ' + (MUTACOES.length + 2)
  + ' se comportaram como deviam');
process.exit(falhas ? 1 : 0);