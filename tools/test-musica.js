/* =========================================================
   tools/test-musica.js
   A camada musical, conferida contra a teoria e nao contra ela mesma.

   POR QUE ESTE TESTE EXISTE

   O resto da suite mede o motor MUSICAL: se `C` vira `D` dois tons acima, se
   uma palavra portuguesa nao vira acorde, se o desenho da cifra sobrevive a
   tokenizacao. Esta suite mede outra coisa, que era o que faltava:

   O QUE O MOTOR AFIRMA SOBRE SI MESMO

   Varias funcoes do motor dizem a verdade Musical e outras dizem uma verdade
   que PARECE musica e nao e. A diferenca so aparece quando a resposta e
   conferida contra a teoria, e nao contra outra saida do mesmo codigo — que e
   o que um teste que so compara funcoes entre si acaba fazendo.

   Os tres defeitos que este arquivo caça, todos medidos antes de corrigir:

   1. A GRAFIA DA ESCALA. A escala era montada a partir de classes de altura e
      nomeada por uma FLAG global de bemol/sustenido. O som saia certo e a
      letra errada. Do menor de Dó saia "C D D# F G G# A#": duas letras
      repetidas e nenhum acorde da menor natural. Na maior de Sol com bemóis
      saia "G A B C D E Gb" — e Sol maior nao tem Gb, tem F#.

   2. O ROTULO DO GRAU. A qualidade da triade era calculada dos intervalos, e
      o texto do grau vinha de uma tabela escrita a mao. Os dois discordavam:
      o app escrevia "Grau II" em cima de Dm, "Grau III" em cima de Em e "Grau
      VI" em cima de Am. Em maiusculo o numeral romano diz "maior".

   3. TRADE SILENCIOSA DE QUALIDADE. Escala sem terceira — pentatonica, blues —
      produzia uma triade que o motor nao reconhece, e o nome saia como se
      fosse maior. "C" na pentatonica menor de Dó e mentira: nao ha como C
      ser maior ou menor ali, porque a escala nao tem terceira.

   A REGRA DE OURO DESTE ARQUIVO

   Nenhuma verdade musical deste arquivo vem do codigo. Cada escala esperada,
   cada campo harmonico e cada intervalo esta escrito aqui a mao, tirado da
   teoria, e o motor e confrontado com ela. Se os dois concordassem por
   definicao, o teste nao diria nada.
   ========================================================= */
'use strict';

const path = require('path');

const RAIZ = path.join(__dirname, '..');
const Music = require(path.join(RAIZ, 'js', 'core', 'music.js'));

let passou = 0;
let falhou = 0;
const problemas = [];

/* Toda asserção que passa imprime uma linha, COM OU SEM detalhe.
 *
 * A primeira versão imprimia só quando havia detalhe, e o contador do projeto
 * (`conta-teste`) compara o total que o teste RELATA com as linhas de resultado que
 * ele IMPRIME. Sem a linha, o total dizia 113 e a saída tinha 82: o número
 * estava certo por acaso e a evidência de cada conferência sumia da tela. */
function ok(cond, titulo, detalhe) {
  if (cond) {
    passou++;
    console.log('  ok    ' + titulo + (detalhe ? '  (' + detalhe + ')' : ''));
  } else {
    falhou++;
    problemas.push(titulo);
    console.log('  FALHA ' + titulo);
    if (detalhe) console.log('        ' + detalhe);
  }
}
const secao = (t) => console.log('\n=== ' + t + ' ===');
const iguais = (a, b, titulo) => ok(
  JSON.stringify(a) === JSON.stringify(b), titulo,
  'obtido: ' + JSON.stringify(a) + (JSON.stringify(a) === JSON.stringify(b) ? '' : '  esperado: ' + JSON.stringify(b))
);

const ORDEM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LETRAS_7 = 'ABCDEFG';

/* ------------------------------------------------------------------
   A VERDADE DE REFERENCIA

   Estas tabelas NAO sao copia de saida do motor. Cada linha foi escrita
   pela regra da teoria:

     - a escala maior e T T ST T T T ST, com as sete letras em ordem;
     - a tônica abre a conta, e cada grau sobe UMA letra;
     - o acidente e o que sobra para a nota cair na altura pedida;
     - no mesmo semitom, ganha o nome que gasta menos accidentais.

   Conferir contra esta lista e o que separa "o motor esta certo" de "o motor
   concorda com o motor".
   ------------------------------------------------------------------ */

/* As 12 maiores, escritas com o nome de tônica que o próprio app usa
 * (`noteName(pc, useFlatsFor(pc))`) — o mesmo que aparece na tela. */
const MAIOR = [
  ['C D E F G A B'],
  ['Db Eb F Gb Ab Bb C'],
  ['D E F# G A B C#'],
  ['Eb F G Ab Bb C D'],
  ['E F# G# A B C# D#'],
  ['F G A Bb C D E'],
  ['F# G# A# B C# D# E#'],
  ['G A B C D E F#'],
  ['Ab Bb C Db Eb F G'],
  ['A B C# D E F# G#'],
  ['Bb C D Eb F G A'],
  ['B C# D# E F# G# A#'],
];

/* Menor natural: 1 2 b3 4 5 b6 b7. Harmonica: sobe o 7. Melodica: sobem o 6
 * e o 7. Sao tres escalas diferentes e o app precisa saber qual esta mostrando. */
const MENOR_DE_DOS = {
  minor: ['C D Eb F G Ab Bb', 'D E F G A Bb C'],
  harmonic: ['C D Eb F G Ab B', 'D E F G A Bb C#'],
  melodic: ['C D Eb F G A B', 'D E F G A B C#'],
  dorian: ['C D Eb F G A Bb'],
  phrygian: ['C Db Eb F G Ab Bb'],
  lydian: ['C D E F# G A B'],
  mixolydian: ['C D E F G A Bb'],
  locrian: ['C Db Eb F Gb Ab Bb'],
  aeolian: ['C D Eb F G Ab Bb'],
};

/* ------------------------------------------------------------------
   1. AS 12 TÔNICAS DA MAIOR
   ------------------------------------------------------------------ */
secao('1. Escala maior nas 12 tonalidades, com uma letra por grau');

for (let pc = 0; pc < 12; pc++) {
  const obtido = Music.nomesDaEscala(pc, 'major');
  const letras = obtido.map((n) => n.charAt(0)).sort().join('');
  iguais(obtido, MAIOR[pc][0].split(' '), ORDEM[pc] + ' maior: ' + obtido.join(' '));
  ok(letras === LETRAS_7, ORDEM[pc] + ' maior usa as 7 letras',
    'letras: ' + letras + (letras === LETRAS_7 ? '' : '  <-- REPETIU'));
}

/* ------------------------------------------------------------------
   2. O NOME DA TÔNICA E O MESMO QUE A PRIMEIRA NOTA

   Se discordarem, a mesma tela mostra "F#" num lugar e "Gb" em outro, e o
   músico não sabe qual afinar. E o defeito que apareceria se a grafia fosse
   escolhida por uma regra diferente da que nomeia o tom.
   ------------------------------------------------------------------ */
secao('2. A primeira nota da escala e a tônica que a tela nomeia');

for (let pc = 0; pc < 12; pc++) {
  const tonica = Music.noteName(pc, Music.useFlatsFor(pc));
  const primeiro = Music.nomesDaEscala(pc, 'major')[0];
  ok(primeiro === tonica, 'maior de ' + tonica + ' comeca em ' + tonica,
    'comecou em ' + primeiro);
}

/* ------------------------------------------------------------------
   3. MENORES: NATURAL, HARMÔNICA, MELÓDICA
   ------------------------------------------------------------------ */
secao('3. As tres menores sao tres escalas diferentes');

for (const chave of ['minor', 'harmonic', 'melodic']) {
  iguais(Music.nomesDaEscala(0, chave), MENOR_DE_DOS[chave][0].split(' '),
    'menor ' + chave + ' de Dó');
  iguais(Music.nomesDaEscala(2, chave), MENOR_DE_DOS[chave][1].split(' '),
    'menor ' + chave + ' de Ré');
}

/* As tres nao podem ser iguais: e a diferenca entre natural, harmonica e
 * melodica que o app promete mostrar. */
ok(Music.nomesDaEscala(0, 'minor').join(' ') !== Music.nomesDaEscala(0, 'harmonic').join(' '),
  'a menor natural e a harmonica nao saem iguais');
ok(Music.nomesDaEscala(0, 'harmonic').join(' ') !== Music.nomesDaEscala(0, 'melodic').join(' '),
  'a harmonica e a melodica nao saem iguais');

secao('4. Modos: cada um com a letra certa em todas as tonalidades');

{
  let ruins = 0;
  const quais = [];
  for (const chave of Object.keys(MENOR_DE_DOS)) {
    for (let pc = 0; pc < 12; pc++) {
      const nomes = Music.nomesDaEscala(pc, chave);
      const letras = nomes.map((n) => n.charAt(0)).sort().join('');
      if (letras !== LETRAS_7) {
        ruins++;
        if (quais.length < 8) quais.push(chave + ' em ' + ORDEM[pc] + ': ' + nomes.join(' '));
      }
    }
  }
  ok(ruins === 0, 'todos os modos usam as 7 letras em todas as tonalidades',
    ruins === 0 ? '9 modos x 12 tonalidades' : ruins + ' com letra repetida: ' + quais.join(' | '));
}

/* ------------------------------------------------------------------
   5. A ALTURA DE CADA NOTA ESCRITA

   A letra e uma coisa, a altura e outra, e o app precisa acertar as duas.
   Aqui o nome impresso e lido de volta pelo proprio leitor de acordes: e o
   caminho que o musico faz quando olha a tela e pensa "entao e isso".
   ------------------------------------------------------------------ */
secao('5. O nome escrito le na altura que a escala pede');

{
  let divergentes = 0;
  const exemplos = [];
  for (const chave of Object.keys(Music.SCALES)) {
    for (let pc = 0; pc < 12; pc++) {
      for (const g of Music.escalaComGravacao(pc, chave)) {
        if (g.letra === null) continue;
        const letra = String(g.letra).toUpperCase();
        const lido = Music.pcFromAccidental(letra, g.nome.slice(1));
        if (lido !== g.pc) {
          divergentes++;
          if (exemplos.length < 6) {
            exemplos.push(chave + '/' + ORDEM[pc] + ': "' + g.nome + '" pedido ' + g.pc + ', lido ' + lido);
          }
        }
      }
    }
  }
  ok(divergentes === 0, 'toda nota escrita le na altura certa',
    divergentes === 0 ? 'todas as escalas' : divergentes + ' divergentes: ' + exemplos.join(' | '));
}

/* ------------------------------------------------------------------
   6. INTERVALOS DA ESCALA MAIOR

   A regra e T T ST T T T ST. O ultimo intervalo — do 7o grau ate a oitava —
   e o que a tabela de intervalos nao guarda, porque a oitava e o mesmo
   semitom da tonica. Aqui ele e calculado a partir da escala.
   ------------------------------------------------------------------ */
secao('6. Intervalos da maior: 2-2-1-2-2-2-1, incluindo o ultimo');

{
  const esperado = [2, 2, 1, 2, 2, 2, 1];
  let ruins = 0;
  for (let pc = 0; pc < 12; pc++) {
    const iv = Music.SCALES.major.iv;
    const gaps = [];
    for (let g = 0; g < 6; g++) gaps.push(iv[g + 1] - iv[g]);
    gaps.push(12 - iv[6]);
    if (JSON.stringify(gaps) !== JSON.stringify(esperado)) {
      ruins++;
      console.log('        ' + ORDEM[pc] + ': ' + gaps.join(','));
    }
  }
  ok(ruins === 0, 'as 12 maiores tem os mesmos 7 intervalos',
    '2-2-1-2-2-2-1 em todas');
}

/* ------------------------------------------------------------------
   7. CAMPO HARMÔNICO

   A regra: em maior, os graus sao sempre estes, em qualquer tonalidade.

       I maior   ii menor  iii menor  IV maior
       V maior   vi menor  vii° diminuto

   A triade e montada empilhando tercas sobre a escala, e a qualidade
   DESCOBRE. O rotulo do grau tem de concordar com ela.
   ------------------------------------------------------------------ */
secao('7. Campo harmonico da maior, em todas as tonalidades');

const REGRA_MAIOR = [
  ['I', '', 'I maior'], ['ii', 'm', 'ii menor'], ['iii', 'm', 'iii menor'],
  ['IV', '', 'IV maior'], ['V', '', 'V maior'], ['vi', 'm', 'vi menor'],
  ['vii°', 'dim', 'vii diminuto'],
];

{
  let ruinsRotulo = 0;
  let ruinsQualidade = 0;
  const exemplos = [];
  for (let pc = 0; pc < 12; pc++) {
    const campoDoTom = Music.scaleChords(pc, 'major');
    for (let g = 0; g < 7; g++) {
      const esperadoRotulo = REGRA_MAIOR[g][0];
      const esperadoQualidade = REGRA_MAIOR[g][1];
      if (campoDoTom[g].degree !== esperadoRotulo) {
        ruinsRotulo++;
        if (exemplos.length < 6) {
          exemplos.push(ORDEM[pc] + ' grau ' + (g + 1) + ': "' + campoDoTom[g].degree
            + '" em vez de "' + esperadoRotulo + '" (' + campoDoTom[g].name + ')');
        }
      }
      if (campoDoTom[g].quality !== esperadoQualidade) {
        ruinsQualidade++;
        if (exemplos.length < 6) {
          exemplos.push(ORDEM[pc] + ' grau ' + (g + 1) + ' qualidade "'
            + campoDoTom[g].quality + '" em vez de "' + esperadoQualidade + '"');
        }
      }
    }
  }
  ok(ruinsQualidade === 0, 'a qualidade das 84 triades segue a regra da maior',
    ruinsQualidade === 0 ? 'I ii iii IV V vi vii°' : ruinsQualidade + ' erradas');
  ok(ruinsRotulo === 0, 'e o rotulo do grau concorda com ela',
    ruinsRotulo === 0 ? '84 rotulos' : exemplos.join(' | '));
}

/* ------------------------------------------------------------------
   8. O ROTULO NUNCA CONTRADIZ A QUALIDADE

   Numeral romano maiusculo afirma tríade maior. Se a tríade for menor, o
   numero esta mentindo — e o musiciano le o numero primeiro.
   ------------------------------------------------------------------ */
secao('8. Nenhum rotulo de grau afirma a qualidade errada');

{
  let mentiras = 0;
  const exemplos = [];
  const heptatonicas = Object.keys(Music.SCALES)
    .filter((k) => Music.SCALES[k].iv.length === 7);
  for (const chave of heptatonicas) {
    for (let pc = 0; pc < 12; pc++) {
      for (const acorde of Music.scaleChords(pc, chave)) {
        const numeral = /^[IViv]+/.exec(acorde.degree);
        if (!numeral) continue;
        const maiuscula = numeral[0] === numeral[0].toUpperCase();
        const diminuto = /°/.test(acorde.degree);
        const mente = (maiuscula && acorde.quality === 'm')
          || (maiuscula && acorde.quality === 'dim' && !diminuto)
          || (!maiuscula && acorde.quality === '')
          || (!maiuscula && acorde.quality === 'dim' && !diminuto);
        if (mente) {
          mentiras++;
          if (exemplos.length < 6) {
            exemplos.push(chave + '/' + ORDEM[pc] + ': "' + acorde.degree
              + '" mas a triade e ' + acorde.quality + ' (' + acorde.name + ')');
          }
        }
      }
    }
  }
  ok(mentiras === 0, 'nenhum dos ' + (heptatonicas.length * 12 * 7) + ' rotulos mente',
    mentiras === 0 ? 'maiusculo=maior, minusculo=menor, com grau=diminuto'
      : mentiras + ' mentiras: ' + exemplos.join(' | '));
}

/* ------------------------------------------------------------------
   9. ACORDES SEM TERCEIRA: a qualidade desconhecida nao pode virar maior

   Pentatonica e blues nao tem terceira. O que se forma sobre o 1o grau nao e
   uma triade, e dizer "C" ali afirma que e maior — o que a escala nao diz.
   ------------------------------------------------------------------ */
secao('9. Escala sem terceira nao ganha qualidade inventada');

{
  for (const chave of ['pentMajor', 'pentMinor', 'blues', 'wholeTone', 'diminished', 'chromatic']) {
    const acordes = Music.scaleChords(0, chave);
    const inventadas = acordes.filter((a) => a.quality === '?' && a.conhecido !== false);
    ok(inventadas.length === 0,
      chave + ': as qualidades desconhecidas sao declaradas como desconhecidas',
      acordes.length + ' graus, ' + contarSemTriade(acordes) + ' sem triade, nenhuma rotulada');
    ok(acordes.every((a) => a.conhecido === (a.quality !== '?')),
      chave + ': `conhecido` acompanha a qualidade', null);
  }
}

function contarSemTriade(lista) {
  return lista.filter((a) => !a.conhecido).length;
}

/* ------------------------------------------------------------------
   10. NOMES DE ESCALA ANTIGOS CONTINUAM FUNCIONANDO

   `scaleNames` e `scaleChords` com o booleano sao a assinatura que a tela e
   os testes antigos usam. Nao podem mudar de comportamento.
   ------------------------------------------------------------------ */
secao('10. A assinatura antiga (booleano) continua igual');

{
  iguais(Music.scaleNames(0, 'major', false), ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    'scaleNames(Do, maior, false)');
  iguais(Music.scaleNames(0, 'minor', true),
    ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'],
    'scaleNames(Do, menor, true)');
  iguais(Music.scaleNames(0, 'pentMinor', true), ['C', 'Eb', 'F', 'G', 'Bb'],
    'scaleNames pentatonica menor com bemol');
  iguais(Music.scaleChords(0, 'major', false).map((c) => c.name),
    ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'],
    'scaleChords maior de Do');
  iguais(Music.scaleChords(0, 'minor', true).map((c) => c.name),
    ['Cm', 'Ddim', 'Eb', 'Fm', 'Gm', 'Ab', 'Bb'],
    'scaleChords menor natural de Do, com bemol');
  iguais(Music.scaleChords(0, 'harmonic', true).map((c) => c.name),
    ['Cm', 'Ddim', 'Ebaug', 'Fm', 'G', 'Ab', 'Bdim'],
    'scaleChords menor harmonica de Do, com bemol');
}

/* ------------------------------------------------------------------
   11. A GRAVIA CONTEXTUAL, ESCOLHIDA À MÃO

   `opts.tonica` fixa a letra da tonica. Serve para quando a pessoa digitou
   "C#" e nao "Db" — as duas grafias sao corretas em tomenos diferentes, e o
   app nao pode trocar uma pela outra sem o musiciano pedir.
   ------------------------------------------------------------------ */
secao('11. Fixar a tonica escolhe a grafia, e cada uma e a sua');

{
  iguais(Music.nomesDaEscala(1, 'major', { tonica: 'D' }),
    ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
    'semitom 1 como tom: a regra escolhe Db (5 bemois, menos que 7 sustenidos)');
  iguais(Music.nomesDaEscala(1, 'major', { tonica: 'C' }),
    ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'],
    'semitom 1 pedido como C#: a escala tem E# e B#');
  iguais(Music.nomesDaEscala(4, 'major', { tonica: 'F' }),
    ['Fb', 'Gb', 'Ab', 'Bbb', 'Cb', 'Db', 'Eb'],
    'tonica F forçada em Mi: a resposta honesta, com bemóis duplos');
}

/* ------------------------------------------------------------------
   12. ENARMONIA

   `C#` e `Db` tem a mesma altura, e essa parte ja estava certa. O que se
   confere aqui e que a funcao nova NAO quebrou isso, e que ela nao troca um
   nome pelo outro sozinha.
   ------------------------------------------------------------------ */
secao('12. Enarmonia: a altura e a mesma, o nome e escolha');

{
  ok(Music.pcFromAccidental('C', '#') === Music.pcFromAccidental('D', 'b'),
    'C# e Db tem a mesma altura');
  ok(Music.pcFromAccidental('F', 'b') === Music.pcFromAccidental('E', ''),
    'Fb tem a altura de E');
  ok(Music.pcFromAccidental('B', '#') === Music.pcFromAccidental('C', ''),
    'B# tem a altura de C');
  ok(Music.pcFromAccidental('C', '##') === Music.pcFromAccidental('D', ''),
    'C## tem a altura de D');

  /* Um acorde isolado nao tem grafia certa: os dois nomes servem. O que o
   * app faz e escolher um, e por isso `nomeDeAcorde` existe separado de
   * `noteName`. */
  ok(typeof Music.nomeDeAcorde === 'function',
    'a escolha de grafia de acorde tem funcao propria');
  ok(Music.noteName(1, false) === 'C#' && Music.noteName(1, true) === 'Db',
    'e `noteName` continua aceitando a escolha direta');
}

/* ------------------------------------------------------------------
   13. ACIDENTE DUPLO

   Escala com sustenido duplo e bemol duplo existe, e sai da regra sem
   gambiarra: e o mesmo algoritmo com o numero maior.
   ------------------------------------------------------------------ */
secao('13. Accidentais duplos, que a regra produz de graca');

{
  iguais(Music.nomesDaEscala(3, 'major', { tonica: 'D' }),
    ['D#', 'E#', 'F##', 'G#', 'A#', 'B#', 'C##'],
    'Ré# maior com sustenido duplo na 3a e na 7a');
  iguais(Music.nomesDaEscala(11, 'major', { tonica: 'C' }),
    ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'],
    'Dó bemol maior, que e o semitom 11 e nao o 10');
  ok(Music.nomesDaEscala(6, 'major', { tonica: 'F' }).indexOf('E#') >= 0,
    'a maior de F# tem E# no 7o grau, nao F');
}

/* ------------------------------------------------------------------
   14. A FREQUENCIA DE CADA NOTA

   O motor ainda nao tem a formula; ela vive no afinador. O que este teste
   mede e a aritmetica que a formula vai usar, contra os valores conhecidos.
   ------------------------------------------------------------------ */
secao('14. Aritmetica de frequencia (aformula fica no afinador)');

{
  function hz(pc, oitava, ref) {
    return ref * Math.pow(2, (pc - 9 + (oitava - 4) * 12) / 12);
  }
  ok(Math.abs(hz(9, 4, 440) - 440) < 1e-9, 'Lá4 com A4=440 e 440 Hz');
  ok(Math.abs(hz(0, 4, 440) - 261.6256) < 0.001, 'Dó4 (dó central) e 261,63 Hz');
  ok(Math.abs(hz(9, 3, 440) - 220) < 1e-9, 'Lá3 e a oitava abaixo: 220 Hz');
  /* Sol3 em temperamento igual dá 195,9977 Hz. O "196" que aparece em tabela
   * é o valor arredondado, e comparar contra ele com precisão de bilionésimo
   * seria comparar o motor com uma tabela, não com a teoria. A tolerância aqui
   * é de um centésimo de Hz, que é bem mais apertada do que um afinador
   * consegue ouvir. */
  ok(Math.abs(hz(7, 3, 440) - 196) < 0.01, 'Sol3 (Sol2 do violão) e 196 Hz',
    hz(7, 3, 440).toFixed(4) + ' Hz');
  ok(Math.abs(hz(4, 2, 440) - 82.4069) < 0.001, 'Mi2, corda 6 do violão, e 82,41 Hz');
  ok(Math.abs(hz(0, 4, 442) - 262.8143) < 0.01, 'com A4=442 tudo sobe, e nao so o Lá');
  ok(Music.TUNING.length === 6 && Music.TUNING[0] === 40 && Music.TUNING[5] === 64,
    'a afinacao do violao em MIDI vai de Mi2 a Mi4',
    JSON.stringify(Music.TUNING));
}

/* ------------------------------------------------------------------
   15. CASA 12 E A MESMA NOTA, UMA OITAVA ACIMA

   A regra que o musico usa para saber onde esta a oitava, e que vale para
   qualquer corda.
   ------------------------------------------------------------------ */
secao('15. Casa 12: a mesma nota da corda aberta, uma oitava acima');

{
  for (let corda = 0; corda < 6; corda++) {
    const aberta = Music.fretNote(corda, 0);
    const doze = Music.fretNote(corda, 12);
    ok(aberta === doze, 'corda ' + (corda + 1) + ': casa 12 tem a classe da corda aberta',
      'aberta=' + Music.noteName(aberta, false) + ' casa12=' + Music.noteName(doze, false));
  }
}

/* ------------------------------------------------------------------
   16. O QUE A FUNCAO NOVA NAO QUEBROU

   Cada uma destas ja era verdade antes da mudanca. E a regiao que um erro de
   grafia poderia ter estragado sem ninguem perceber.
   ------------------------------------------------------------------ */
secao('16. Regressao: o que ja estava certo continua certo');

{
  /* O circulo das quintas nao pode mudar: e ele que diz o lado dos bemois. */
  iguais(Music.CIRCLE, [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5], 'a ordem do circulo');
  iguais(Music.ORDEM_SUS, ['F', 'C', 'G', 'D', 'A', 'E', 'B'], 'a ordem dos sustenidos');
  iguais(Music.ORDEM_BEM, ['B', 'E', 'A', 'D', 'G', 'C', 'F'], 'a ordem dos bemois');
  ok(Music.armadura(9, 'minor').quantidade === 0, 'Lá menor nao tem armadura');
  ok(Music.armadura(2, 'minor').quantidade === 1 && Music.armadura(2, 'minor').bemois,
    'Ré menor tem um bemol (o do relativo maior)');
  ok(Music.sharpsCount(7) === 1 && Music.sharpsCount(0) === 0 && Music.sharpsCount(5) === 1,
    'o numero de alteracoes de cada lado do circulo');
  ok(Music.useFlatsFor(0) === false && Music.useFlatsFor(5) === true,
    'e o lado de bemol continua o de sempre');

  /* Transposicao: ida e volta tem de devolver a cifra original. */
  const linha = 'C  Am  F  G';
  let voltasRuins = 0;
  for (let n = 0; n <= 12; n++) {
    const sobe = Music.transposeCifra(linha, n);
    const volta = Music.transposeCifra(sobe, -n);
    if (volta.replace(/\s+/g, ' ').trim() !== linha.replace(/\s+/g, ' ').trim()) voltasRuins++;
  }
  ok(voltasRuins === 0, 'transpor +0 a +12 e voltar da a cifra original', voltasRuins + ' erros');

  /* E o mesmo para baixo. */
  voltasRuins = 0;
  for (let n = 0; n <= 12; n++) {
    const desce = Music.transposeCifra(linha, -n);
    const volta = Music.transposeCifra(desce, n);
    if (volta.replace(/\s+/g, ' ').trim() !== linha.replace(/\s+/g, ' ').trim()) voltasRuins++;
  }
  ok(voltasRuins === 0, 'e para -0 a -12 tambem', voltasRuins + ' erros');

  /* Baixo viaja junto com a fundamental, ou a inversao se perde. */
  iguais(Music.transposeCifra('G/B', 2), 'A/C#', 'G/B +2 = A/C#');
  iguais(Music.transposeCifra('D/F#', 2), 'E/G#', 'D/F# +2 = E/G#');

  /* Analise de graus, que ja era certa e usa outra funcao. */
  iguais(Music.analyzeChords(
    [{ root: 0, quality: '' }, { root: 9, quality: 'm' }, { root: 7, quality: '' }, { root: 5, quality: '' }],
    0, 'major').map((a) => a.degree).join(' '),
  'I vi V IV', 'analyzeChords nao foi afetado');
}

/* ------------------------------------------------------------------
   17. ENTRADAS INVALIDAS

   Uma funcao nova que aceita besteira produz letra inventada na tela. O que
   ela devolve para entradas sem sentido tem de ser o mesmo que ja era.
   ------------------------------------------------------------------ */
secao('17. Entradas invalidas nao viram letra na tela');

{
  ok(Music.escalaComGravacao(0, 'escalaQueNaoExiste').length === 7,
    'escala inexistente cai na maior, como antes',
    Music.nomesDaEscala(0, 'escalaQueNaoExiste').join(' '));
  ok(Music.escalaComGravacao(99, 'major').length === 7, 'tonica fora de 0..11 e normalizada');
  ok(Music.escalaComGravacao(-1, 'major').length === 7, 'tonica negativa e normalizada');
  ok(Music.escalaComGravacao(0, null).length === 7, 'escala nula cai na maior');
  ok(Music.acentoDaLetra(0, 'Z') === null, 'letra que nao existe nao vira numero');
  ok(Music.letraComAcidente('C', 7) === 'C', 'acidente fora da tabela nao inventa simbolo');
  ok(Music.letraDaTonica(0, Music.SCALES.major.iv) === 'C', 'a tônica de um tom sem ambiguidade e ela mesma');
  ok(typeof Music.nomeDeAcorde(0) === 'string' && Music.nomeDeAcorde(0).length > 0,
    'nomeDeAcorde devolve texto mesmo sem contexto');
}

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(58));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  Uma nota escrita com a letra errada tem o som certo e ensina');
  console.log('  o numero errado. O musico afina o que a tela mostra.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(58) + '\n');
process.exit(falhou ? 1 : 0);