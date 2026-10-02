/* =========================================================
   tools/provar-timbre.js
   Prova que o `test-timbre` pega o que ele diz pegar.

   O `test-timbre` prova a MATEMATICA do som: as frequencias, as amplitudes, a
   ordem em que os parciais morrem. Este arquivo quebra a matematica de cinco
   maneiras diferentes e confere que o teste nota cada uma.

   A diferenca entre este e o `provar-instrumento` e o alvo: aquele quebra o
   caminho que leva ate o motor de audio, este quebra o modelo que decide COMO o
   som e feito. Um pode passar com o outro quebrado — e por isso que os dois
   existem.

   A REGRA DAS MUTACOES DE UMA LINHA

   Toda mutacao aqui mexe em uma linha so. Copiar um bloco de codigo para
   reescreve-lo com um numero trocado ja custou duas rodadas neste projeto: o
   fim de linha tem de bater, e cada linha copiada pode sair com um caractere a
   mais ou a menos sem nenhum aviso. Ver o cabecalho do `provar-instrumento`.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const TIMBRE = path.join(RAIZ, 'js', 'core', 'timbre.js');
const TESTE = path.join(__dirname, 'test-timbre.js');
const NL = String.fromCharCode(10);

const original = fs.readFileSync(TIMBRE, 'utf8');
const testeOriginal = fs.readFileSync(TESTE, 'utf8');

const MUTACOES = [
  {
    nome: 'todos os parciais duram igual (o som fica parado no tempo)',
    de: '      cai: [1, 0.52, 0.40, 0.30, 0.24, 0.19, 0.15, 0.12, 0.10, 0.08],',
    para: '      cai: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],',
  },
  {
    nome: 'o corpo do instrumento desapareceu',
    de: '      ressonancias: [[96, 2.1], [196, 1.55], [430, 1.15]],',
    para: '      ressonancias: [],',
  },
  {
    nome: 'as amplitudes nao sao mais normalizadas',
    de: '      for (const p of saida) p.amp /= soma;',
    para: '      /* sem normalizar */',
  },
  {
    nome: 'o traste parou de mudar o brilho',
    de: '      const brilhoParcial = Math.pow(1 + brilho * 0.55, Math.min(n - 1, 6));',
    para: '      const brilhoParcial = 1;',
  },
  {
    nome: 'o traste tambem parou de encurtar a corda',
    de: '      const tau = M.tauBase * M.cai[i] * (1 - brilho * 0.45);',
    para: '      const tau = M.tauBase * M.cai[i];',
  },
  {
    nome: 'a frequencia invalida passou a devolver um parcial em vez de nada',
    de: '    if (!isFinite(f) || f <= 0) return [];',
    para: '    if (!isFinite(f)) return [];',
  },
  {
    nome: 'o limite de vozes virou constante',
    de: '    if (vozesAtivas <= 3) return 6;',
    para: '    if (vozesAtivas <= 3) return 10;',
  },
  {
    nome: 'os parciais pararam de ser multiplos da fundamental',
    de: '      const fh = f * n;',
    para: '      const fh = f * n * 1.0007;',
  },

  /* O CANARIO. Nao testa o timbre: testa o PROVADOR.
   *
   * A mutacoes acima medem o `timbre.js`. Esta mede o proprio `provar-timbre.js`,
   * e existe por causa de um acidente real desta rodada.
   *
   * Ao desligar a ressonancia do violao, o teste nao reprovou: ele QUEBROU com
   * `TypeError` em `ressonancias[0][0]`. O erro saiu pelo stderr, o provador le
   * o stdout, nao encontrou a palavra FALHA e imprimiu "o teste passou com o
   * defeito instalado". O defeito estava la, o teste ate gritou, e o provador
   * informou o contrario.
   *
   * Um provador que mente quando o teste quebra e pior do que um provador
   * ausente: ele da um "ok" que ninguem pode desconfiar. Por isso o canario
   * QUEBRA o teste de proposito. Se esta mutacao aparecer como "ok", o
   * provador voltou a ler so o stdout, e o resultado do arquivo inteiro acima
   * nao vale nada. */
  {
    nome: 'CANARIO: o proprio teste quebrou (o provador tem de notar)',
    arquivo: 'teste',
    de: '    const sobreOPico = T.espectro(ressonancia, id);',
    para: '    const sobreOPico = T.espectro(ressonancia, id).istoNaoExiste[0];',
    esperadoQuebrado: true,
  },
];

/* O que aconteceu de verdade com o teste, e nao so o que ele imprimiu.
 *
 * Um teste que QUEBRA nao passa: ele morre antes de olhar para o defeito. O
 * erro sai pelo `stderr`, o provador le o `stdout`, nao acha a palavra FALHA e
 * escreve "o teste passou com o defeito instalado" — o contrario do que
 * aconteceu.
 *
 * Ja aconteceu nesta rodada: desligar a ressonancia do violao fazia o teste
 * quebrar com TypeError, e o provador dava "ok". Por isso a queda e separada da
 * verificacao, e uma queda que NAO seja uma reprovacao e tratada como defeito
 * do teste — nunca como sucesso. */
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
console.log('\n=== o teste da matematica do timbre pega o defeito? ===\n');

for (const m of MUTACOES) {
  const eOTeste = m.arquivo === 'teste';
  const base = eOTeste ? testeOriginal : original;
  const caminho = eOTeste ? TESTE : TIMBRE;

  const achadas = base.split(m.de).length - 1;
  if (achadas !== 1) {
    console.log('  FALHA ' + m.nome);
    console.log('          a linha procurada aparece ' + achadas + ' vez(es), e o provador'
      + ' espera 1. Ele mediria outra coisa, entao parou.');
    console.log('          procurava: ' + JSON.stringify(m.de));
    falhas++;
    continue;
  }

  fs.writeFileSync(caminho, base.split(m.de).join(m.para), 'utf8');
  const r = rodarTeste();
  if (eOTeste) fs.writeFileSync(TESTE, testeOriginal, 'utf8');
  else fs.writeFileSync(TIMBRE, original, 'utf8');

  if (r.quebrou) {
    /* O canario QUER quebrar. Nele, quebra e o resultado esperado — e a prova de
     * que o provador sabe notar quando o teste morre em vez de reprovar. */
    if (m.esperadoQuebrado) {
      console.log('  ok    ' + m.nome);
      console.log('          o provador viu a queda em vez de chamar isso de "passou"');
      continue;
    }
    console.log('  FALHA ' + m.nome);
    console.log('          o teste QUEBROU em vez de reprovar. Isso nao prova que o'
      + ' teste pegaria o defeito — prova que ele nao chegou a olhar.');
    falhas++;
    continue;
  }

  if (m.esperadoQuebrado) {
    console.log('  FALHA ' + m.nome);
    console.log('          o teste deveria ter quebrado e nao quebrou. Ou a mutacao'
      + ' do canario parou de valer, ou o teste ficou quebrado de um jeito que'
      + ' o provador nao enxerga.');
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
        console.log('          ' + l.trim().slice(0, 96));
        break;
      }
    }
  }
}

/* O arquivo tem de voltar como estava. */
fs.writeFileSync(TIMBRE, original, 'utf8');
fs.writeFileSync(TESTE, testeOriginal, 'utf8');
const voltou = fs.readFileSync(TIMBRE, 'utf8') === original
  && fs.readFileSync(TESTE, 'utf8') === testeOriginal;
console.log('\n  ' + (voltou ? 'ok    ' : 'FALHA ') + 'o timbre.js e o teste voltaram ao estado original');
if (!voltou) falhas++;

const limpo = rodarTeste();
const semDefeito = !limpo.caiu && !/FALHA/.test(limpo.saida);
console.log((semDefeito ? '  ok    ' : '  FALHA ') + 'e, sem nenhum defeito, o teste passa');
if (!semDefeito) {
  if (limpo.caiu) console.log('          o teste nem chegou ao fim sem defeito nenhum');
  falhas++;
}

console.log('\n  ' + (MUTACOES.length + 2 - falhas) + ' de ' + (MUTACOES.length + 2)
  + ' se comportaram como deviam');
process.exit(falhas ? 1 : 0);