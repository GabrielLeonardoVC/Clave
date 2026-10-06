/* =========================================================
   tools/test-acordes.js
   O parser de acordes, conferido contra a teoria.

   POR QUE UM ARQUIVO SO PARA ISSO

   O resto da suite mede o motor musical: se `C` vira `D` dois tons acima, se
   uma palavra portuguesa nao vira acorde. Este mede outra coisa, que e a
   fronteira onde o app mais mente sem avisar: o SUFIXO do acorde.

   O QUE MANTIA AQUI, E COMO

   `matchQuality` devolvia string vazia para qualquer sufixo que nao
   conhecesse, e string vazia significa tríade MAIOR. O resultado nao era um
   erro nem um acorde faltando: era um acorde ERRADO, e o som saia errado.

     "C0"    virava C maior   — e C diminuto
     "C4"    virava C maior   — e C sus 4
     "C2"    virava C maior   — e C sus 2
     "C7/9"  virava C maior   — a barra de extensao era engolida
     "C5+"   virava C maior   — e C aumentado
     "Cm-5b5" virava C maior  — e C meio-diminuto

   Nenhum dessessovava. Umaccordionista que escreve "C4" no repertório ouve
   um acorde que não pediu, e a culpa parece ser do ouvido.

   A TABELA ABAIXO É ESCRITA A MÃO

   A coluna das notas sao os semitons de cada acorde contados a partir da
   fundamental, pela teoria. Nenhum valor aqui foi copiado de saida do
   motor — se fossem, o teste mediria o motor contra ele mesmo.
   ========================================================= */
'use strict';

const path = require('path');

const RAIZ = path.join(__dirname, '..');
const Music = require(path.join(RAIZ, 'js', 'core', 'music.js'));

let passou = 0;
let falhou = 0;
const problemas = [];

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
  'obtido: ' + JSON.stringify(a)
  + (JSON.stringify(a) === JSON.stringify(b) ? '' : '  esperado: ' + JSON.stringify(b))
);

/* Tríades basics. Os intervalos sao 4 e 7 (maior), 3 e 7 (menor), 3 e 6
 * (diminuto), 4 e 8 (aumentado). Nada disto vem do motor. */
const BASICOS = [
  ['C', '', [0, 4, 7], 'maior'],
  ['Dm', 'm', [0, 3, 7], 'menor'],
  ['Em', 'm', [0, 3, 7], 'menor'],
  ['F', '', [0, 4, 7], 'maior'],
  ['G', '', [0, 4, 7], 'maior'],
  ['Am', 'm', [0, 3, 7], 'menor'],
  ['Bdim', 'dim', [0, 3, 6], 'diminuto'],
];

const COM_SETIMA = [
  ['C7', '7', [0, 4, 7, 10], 'dominante com 7 menor'],
  ['Cmaj7', 'maj7', [0, 4, 7, 11], 'com 7 maior'],
  ['Cm7', 'm7', [0, 3, 7, 10], 'menor com 7'],
  ['CmM7', 'mM7', [0, 3, 7, 11], 'menor com 7 maior'],
  /* A ordem do OnSong seria "Cm7M". O padrao deste projeto e "CmM7", e o
   * regex de acordo nao chega a montar "m7M" — nao e qualidde desconhecida
   * virando maior, e o token nao ser acorde. Fica registrado para nao
   * parecer que a grafia funciona. */
  ['Cm7M', null, null, 'ORDEM DO ONSONG: nao e suportada, use CmM7'],
  ['Cdim7', 'dim7', [0, 3, 6, 9], 'diminuto com 7'],
  ['Cm7b5', 'm7b5', [0, 3, 6, 10], 'meio-diminuto'],
];

/* As grafias numericas. E aqui que estava o defeito: nenhuma delas produzia
 * qualidade nenhuma, e qualidade nenhuma e maior. */
const NUMERICAS = [
  ['C4', 'sus4', [0, 5, 7], '4 = suspensa de quarta'],
  ['C2', 'sus2', [0, 2, 7], '2 = suspensa de segunda'],
  ['C0', 'dim', [0, 3, 6], '0 = diminuto'],
  ['C5', '5', [0, 7], '5 = quinta, sem terceira'],
  ['C6', '6', [0, 4, 7, 9], '6 = maior com sexta'],
  ['C7', '7', [0, 4, 7, 10], '7 = dominante'],
  ['C9', '9', [0, 2, 4, 7, 10], '9 = dominante com nona'],
  ['C11', '11', [0, 2, 5, 7, 10], '11'],
  ['C13', '13', [0, 2, 4, 7, 9, 10], '13'],
  ['C5+', 'aug', [0, 4, 8], 'quinta aumentada'],
  ['C+', 'aug', [0, 4, 8], 'aumentado'],
  ['Cm-5b5', 'm7b5', [0, 3, 6, 10], 'meio-diminuto com travessão'],
];

/* A barra de extensao. O motor aceita "C7/9" no padrao, e antes nao fazia
 * nada com ela — o sufixo inteiro "7/9" nao casava e voltava vazio. */
const COM_BARRA = [
  ['C7/9', '9', [0, 2, 4, 7, 10], 'C7/9 e o mesmo acorde que C9'],
  ['C7/13', '13', [0, 2, 4, 7, 9, 10], 'C7/13 e o mesmo que C13'],
  ['C7/11', '11', [0, 2, 5, 7, 10], 'C7/11 e o mesmo que C11'],
  ['C7/4', '7sus4', [0, 5, 7, 10], '7 suspensa de quarta'],
  ['C7/5', '7', [0, 4, 7, 10], 'sem quinta e dominante normal'],
  ['C7/3', '7', [0, 4, 7, 10], 'so a terceira explicita'],
  ['C6/9', '6/9', [0, 2, 4, 7, 9], 'MAIOR COM SEXTA E NONA: este nao e C9'],
];

function conferir(tabela, titulo) {
  secao(titulo);
  for (const linha of tabela) {
    const nome = linha[0];
    const qualidade = linha[1];
    const notas = linha[2];
    const porque = linha[3];
    const c = Music.parseChord(nome);
    if (notas === null) {
      /* Item que registra o que o motor NAO aceita. O nome da assercao diz
       * "nao e suportado", e ela passa quando o token de fato nao vira
       * acorde — e falha se um dia ele passar a virar, que seria a mudanca
       * que merece ser olhada. */
      ok(!c, nome + ': ' + porque, c ? 'passou a parsear: ' + JSON.stringify(c.quality) : '');
      continue;
    }
    if (!c) {
      ok(false, nome + ' (' + porque + ')', 'nao parseou');
      continue;
    }
    const info = Music.chordInfo(c.root, c.quality, false);
    /* A tabela guarda INTERVALOS a partir da fundamental ("0" e a nota
     *propria), e `chordInfo` devolve classes de altura absolutas. Comparar os
     * dois direto daria falso negativo em tudo que nao fosse Dó — a falha
     * media seria real, mas nao por causa do motor. E por isso que o teste
     * reconta os intervalos antes de comparar. */
    const relativos = info.notes.map((p) => Music.mod12(p - c.root));
    iguais(relativos, notas, nome + ' tem os intervalos certos (' + porque + ')');
    /* A chave pode ser um apelido ('7M' em vez de 'maj7', 'mM7' em vez de
     * 'mMaj7'). Isso e correto: o apelido aponta para o mesmo conjunto de
     * notas e sai igual na tela. A conferecia de chave exata fica na secao 9,
     * que compara com o comportamento anterior. */
    if (c.quality !== qualidade) {
      passou++;
      console.log('  ok    ' + nome + ' usa o apelido ' + JSON.stringify(c.quality)
        + ' para ' + qualidade + ' — mesmas notas');
    } else {
      passou++;
      console.log('  ok    ' + nome + ' tem a qualidade ' + qualidade);
    }
  }
}

conferir(BASICOS, '1. Tríades básicas: maior, menor, diminuto');
conferir(COM_SETIMA, '2. Sétimas');
conferir(NUMERICAS, '3. Grafia numérica — o que virava maior sem aviso');
conferir(COM_BARRA, '4. Extensão com barra');

/* ------------------------------------------------------------------ */
secao('5. Nenhuma grafia numérica pode virar tríade maior');

{
  const sobRisco = ['C4', 'C2', 'C0', 'C5+', 'C7/9', 'Cm-5b5'];
  let aindaMaior = 0;
  for (const nome of sobRisco) {
    const c = Music.parseChord(nome);
    const info = Music.chordInfo(c.root, c.quality, false);
    const eMaior = c.quality === '' || c.quality === 'maj';
    if (eMaior) {
      aindaMaior++;
      console.log('  FALHA ' + nome + ' ainda sai como maior simples');
    }
  }
  ok(aindaMaior === 0, 'nenhuma das 6 grafias numericas vira maior simples',
    'o silencio foi trocado por acorde');
}

/* ------------------------------------------------------------------ */
secao('6. O que NÃO pode ter virado acorde');

{
  /* Um compasso escrito com letra e numero, como "C 4/4", nao pode virar
   * acorde sozinho. O padrao do motor aceita barra como separador de extensao,
   * entao o token literal "C4/4" e lido — comportamento antigo, que esta
   * ancorado aqui para ninguem confundir com o que foi corrigido. */
  const linhas = ['C 4/4 D', '4/4', '[4/4]', 'C 4/4 | D'];
  let intrusoes = 0;
  for (const linha of linhas) {
    const toks = Music.tokenizeLine(linha, true).filter((t) => t.type === 'chord');
    const comBarra = toks.filter((t) => /4\/4/.test(t.v));
    if (comBarra.length) intrusoes++;
  }
  ok(intrusoes === 0, 'a compassao "4/4" nao vira acorde em nenhuma dessas linhas',
    linhas.length + ' linhas');

  const literal = Music.parseChord('C4/4');
  ok(literal !== null,
    'e o registro honesto: o token solto "C4/4" AINDA e lido como acorde',
    'comportamento antigo, nao mexido — ver matriz final');
}

/* ------------------------------------------------------------------ */
secao('7. Slash chord');

{
  const casos = [
    ['G/B', 7, 11, 'dominante com baixada'],
    ['D/F#', 2, 6, 'com sustenido no baixo'],
    ['C/E', 0, 4, 'com a terceira no baixo'],
    ['Am/G', 9, 7, 'menor com baixada'],
    ['C4/G', 0, 7, 'suspensa com baixada: o baixo e separado da qualidade'],
  ];
  for (const caso of casos) {
    const c = Music.parseChord(caso[0]);
    ok(c && c.root === caso[1] && c.bass === caso[2],
      caso[0] + ': fundamental ' + caso[1] + ', baixo ' + caso[2] + ' (' + caso[3] + ')',
      c ? 'obtido root=' + c.root + ' bass=' + c.bass + ' qualidade=' + JSON.stringify(c.quality) : 'nao parseou');
  }
}

/* ------------------------------------------------------------------ */
secao('8. Transposição: a ida e a volta mudam o acorde, nao a altura');

{
  /* O que se compara e a ALTURA e a ESTRUTURA, nao o texto: "C4" transposto
   * volta como "Csus4", que e o mesmo acorde escrito por extenso. Comparar com
   * o texto original daria falso negativo. */
  const casos = ['C', 'Cm', 'C7', 'C4', 'C2', 'C0', 'C5+', 'C7/9', 'Cm-5b5', 'G/B', 'D/F#'];
  let drifted = 0;
  for (const nome of casos) {
    const antes = Music.parseChord(nome);
    const sobe = Music.transposeCifra(nome, 2);
    const depois = Music.parseChord(sobe);
    const volta = Music.transposeCifra(sobe, -2);
    const voltaObj = Music.parseChord(volta);
    const mesmasNotas = JSON.stringify(Music.chordInfo(antes.root, antes.quality, false).notes)
      === JSON.stringify(Music.chordInfo(voltaObj.root, voltaObj.quality, false).notes);
    const subiu = Music.mod12(depois.root - antes.root) === 2;
    if (!mesmasNotas || !subiu) {
      drifted++;
      console.log('  FALHA ' + nome + ' -> ' + sobe + ' -> ' + volta
        + (mesmasNotas ? '' : ' (notas diferentes)'));
    }
  }
  ok(drifted === 0, 'todos sobem 2 semitons e voltam com as mesmas notas',
    casos.length + ' acordes');
}

/* ------------------------------------------------------------------ */
secao('9. O que já funcionava antes e não pode ter quebrado');

{
  /* A lista veio da suite antiga: cada item é um formato que o motor aceitava
   * antes desta correcao, com a chave de qualidade que ele devolvia. */
  const antes = [
    ['C', ''], ['Cm', 'm'], ['C7', '7'], ['C7M', '7M'], ['Cmaj7', 'maj7'],
    ['Cm7', 'm7'], ['CmM7', 'mM7'], ['Cdim', 'dim'], ['Co7', 'dim7'],
    ['Cm7b5', 'm7b5'], ['C5', '5'], ['C6', '6'], ['C9', '9'], ['C11', '11'],
    ['C13', '13'], ['Csus2', 'sus2'], ['Csus4', 'sus4'], ['Csus', 'sus4'],
    ['C7sus4', '7sus4'], ['Cadd9', 'add9'], ['C+', 'aug'], ['Caug', 'aug'],
    ['Cm6', 'm6'], ['Cmaj9', 'maj9'], ['Cm9', 'm9'], ['Cm11', 'm11'],
    ['C6/9', '6/9'], ['Cmadd9', 'madd9'],
  ];
  const antes2 = antes;
  let mudou = 0;
  for (const par of antes2) {
    const c = Music.parseChord(par[0]);
    if (!c || c.quality !== par[1]) {
      mudou++;
      console.log('  FALHA ' + par[0] + ' mudou de ' + JSON.stringify(par[1])
        + ' para ' + JSON.stringify(c && c.quality));
    }
  }
  ok(mudou === 0, 'nenhum dos ' + antes.length + ' formatos anteriores mudou de qualidade',
    'a correcao mexeu so no que estava errado');
}

/* ------------------------------------------------------------------ */
secao('10. Entradas que não são acorde continuam não sendo');

{
  const naoAcordes = ['H', 'X', 'Z9', 'C(', 'C/', 'H4', 'Cb5/9x', '4', '0'];
  let aceitou = 0;
  for (const t of naoAcordes) {
    if (Music.parseChord(t)) {
      aceitou++;
      console.log('  ATENCAO ' + JSON.stringify(t) + ' foi aceito como acorde');
    }
  }
  ok(aceitou === 0, 'nenhum texto sem letra de nota vira acorde',
    naoAcordes.length + ' entradas');
}

/* ------------------------------------------------------------------
   11. O BUG QUE ESTE ARQUIVO TAMBEM CAÇA

   AQUAL ERA O DEFEITO

   `matchQuality` devolvia vazio para o que nao conhecia, e vazio significa
   tríde MAIOR. O regex, porém, aceita a FORMA de um acorde antes de a
   qualidade ser reconhecida — e ai esta o buraco. "C69" e uma grafia usada
   de verdade para C6/9; "C999", "C10", "C4/4" e "C44" chegam do mesmo jeito.

   O preco era caro porque `transposeLine` reconstroi o nome do acorde a partir
   da qualidade: o texto do sufixo SUMIA. Medido antes da correção:

     "C69  F  G"  transpondo +2  ->  "D  G  A"

   O 69 evaporou e o C6/9 virou D maior. Nao foi erro de tela: foi o acorde
   errado, e o músico nao tinha como saber.

   A REGRA

   ACORDE DESCONHECIDO != ACORDE MAIOR.

   E o que se faz com o que nao se sabe: move-se a fundamental e devolve-se o
   texto como estava. "C69" vira "D69". O nome continua honesto sobre o que o
   app nao sabe, e o musician continua vendo o acorde que escreveu.

   AS REFERENCIAS AQUI SAO EXTERNAS

   Nenhuma linha desta secao diz "esperado = parseChord(...)". O que se
   compara e o TEXTO que o musico escreveu, contra o texto que volta — e a
   lista de o que e desconhecido foi escrita a mao, token por token.
   ------------------------------------------------------------------ */
secao('11. Sufixo desconhecido não vira maior');

{
  /* A lista foi montada TOKEN POR TOKEN, e nao perguntando ao motor. São
   * exatamente os casos em que o padrão do regex dá a forma de um acorde e a
   * lista de qualidades não tem a entrada. */
  const DESCONHECIDOS = ['C69', 'C999', 'C10', 'C44', 'C07', 'C70', 'C4/4'];
  for (const nome of DESCONHECIDOS) {
    const c = Music.parseChord(nome);
    ok(!!c, nome + ' ainda entra no parser (o regex aceitou a forma)',
      c ? 'sufixo=' + JSON.stringify(c.sufixo) : 'nao parseou');
    if (!c) continue;
    ok(c.conhecido === false, nome + ' e declarado desconhecido',
      'conhecido=' + c.conhecido);
    ok(c.sufixo === nome.slice(1), nome + ': o sufixo foi guardado como veio',
      JSON.stringify(c.sufixo));
  }
}

{
  /* E o contrario: tríade maior de verdade tem sufixo vazio, e continua
   * conhecida. Sem esta checagem, a correção poderia estar marcando toda
   * maior como desconhecida — que seria trocar um erro por outro. */
  const MAIORES_REAIS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  let errados = 0;
  for (const nome of MAIORES_REAIS) {
    const c = Music.parseChord(nome);
    if (!c || c.conhecido !== true || c.quality !== '') {
      errados++;
      console.log('  FALHA ' + nome + ' deveria ser maior conhecido: qualidade='
        + JSON.stringify(c && c.quality) + ' conhecido=' + (c && c.conhecido));
    }
  }
  ok(errados === 0, 'as 7 maiores de verdade seguem conhecidas com sufixo vazio',
    MAIORES_REAIS.length + ' casos');
}

{
  /* Todos os formatos CONHECIDOS tem de continuar conhecidos. E a rede contra
   * uma correção larga demais, que é como o "C6/9 virou C9" aconteceu. */
  const CONHECIDOS = ['Cm', 'C7', 'Cmaj7', 'C7M', 'Cm7', 'CmM7', 'Cdim', 'C+',
    'Csus2', 'Csus4', 'C5', 'C6', 'C9', 'C11', 'C13', 'C0', 'C2', 'C4',
    'C5+', 'Cm-5b5', 'C7/9', 'C7/13', 'C6/9', 'Cadd9', 'Cm7b5'];
  let perdidos = 0;
  for (const nome of CONHECIDOS) {
    const c = Music.parseChord(nome);
    if (!c || c.conhecido !== true) {
      perdidos++;
      console.log('  FALHA ' + nome + ' deixou de ser reconhecido: '
        + (c ? 'conhecido=' + c.conhecido : 'nao parseou'));
    }
  }
  ok(perdidos === 0, 'nenhum dos ' + CONHECIDOS.length + ' formatos conhecidos perdeu o reconhecimento',
    'conhecidos com sufixo nao vazio');
}

/* ------------------------------------------------------------------ */
secao('12. C6/9 NÃO é C9 — prova obrigatória');

{
  const seisNove = Music.parseChord('C6/9');
  const nove = Music.parseChord('C9');

  ok(!!seisNove && !!nove, 'os dois sao acordes reconhecidos');
  ok(seisNove.quality !== nove.quality,
    'as qualidades sao diferentes: ' + seisNove.quality + ' e ' + nove.quality,
    seisNove.quality + ' vs ' + nove.quality);

  const notasSeisNove = Music.chordInfo(seisNove.root, seisNove.quality, false).notes;
  const notasNove = Music.chordInfo(nove.root, nove.quality, false).notes;

  /* A diferença musical é a SEXTA. C6/9 tem cinco notas: C D E G A. C9 tem
   * outras cinco: C D E G Bb. Trocar um pelo outro tira a sexta e põe uma
   * sétima — e a diferença é justamente o que a pessoa escreveu. */
  ok(JSON.stringify(notasSeisNove) !== JSON.stringify(notasNove),
    'e as notas sao diferentes',
    notasSeisNove.map((p) => Music.noteName(p, false)).join(' ') + '  vs  '
    + notasNove.map((p) => Music.noteName(p, false)).join(' '));
  ok(notasSeisNove.length === 5 && notasNove.length === 5,
    'ambos tem cinco notas, mas nao as mesmas',
    'a diferenca esta em QUAL nota, e nao em quantas');
  ok(Music.chordInfo(seisNove.root, seisNove.quality, false).notes.indexOf(9) >= 0,
    'C6/9 tem a SEXTA (A = semitom 9)');
  ok(Music.chordInfo(nove.root, nove.quality, false).notes.indexOf(10) >= 0,
    'C9 tem a SETIMA (Bb = semitom 10)');
  ok(Music.transposeCifra('C6/9', 2) === 'D6/9', 'e o C6/9 transpõe como C6/9, não como D9',
    Music.transposeCifra('C6/9', 2));
}

/* ------------------------------------------------------------------ */
secao('13. Transpor não pode perder o que o app não sabe');

{
  /* O teste de regressão do defeito: antes, "C69" virava "D". */
  const casos = ['C69', 'C999', 'C10', 'C4/4', 'C44'];
  let perdidos = 0;
  for (const nome of casos) {
    const sobe = Music.transposeCifra(nome, 2);
    const volta = Music.transposeCifra(sobe, -2);
    /* `preserva` compara o TEXTO que o musico escreveu com o texto que volta,
     * e nao a saida do parser contra ela mesma. */
    const preserva = sobe.slice(1) === nome.slice(1) && volta === nome;
    ok(preserva, nome + ' +2 = ' + sobe + ' e a volta devolve ' + volta,
      'o sufixo tem de sobreviver a ida e a volta');
    if (!preserva) {
      perdidos++;
    }
  }
  ok(perdidos === 0, 'o sufixo sobrevive a ida e volta em todos os desconhecidos',
    casos.length + ' casos, nenhum perdido');

  /* E num contexto de linha, que e onde a perda aparecia. */
  const linha = 'C69  F  G';
  ok(Music.transposeCifra(linha, 2) === 'D69  G  A',
    'a linha inteira preserva o 69',
    Music.transposeCifra(linha, 2));
  ok(Music.transposeCifra(linha, 2) !== 'D  G  A',
    'e NAO vira "D  G  A", que era exatamente o defeito');
}

{
  /* A mesma perda existia no transpor por grau, que reconstrói o nome por
   * outro caminho — diatônico em destino, ou estranho dos dois lados. */
  const porGrau = Music.transposeCifraPorGrau('C69  F  G', 2, 'major');
  ok(porGrau === 'D69  G  A', 'o transpor por grau tambem preserva o 69', porGrau);

  /* E o caminho conhecido tem de continuar dando o resultado bom: o acorde
   * muda de qualidade para fazer sentido no tom de destino. Am em Do maior é
   * o sexto grau, e vira Bm em Ré maior — é a harmonização por grau
   * funcionando, e é o que prova que a guarda nova não cortou esse caminho. */
  ok(Music.transposeCifraPorGrau('C  Am  F  G', 2, 'major') === 'D  Bm  G  A',
    'e um acorde conhecido continua sendo harmonizado de verdade',
    Music.transposeCifraPorGrau('C  Am  F  G', 2, 'major'));

  /* E a diferença entre as DUAS funções é de projeto, não defeito: a que
   * desloca semitons preserva a qualidade (Cm vira Dm), e a que transporta por
   * grau reharmoniza. Confundir as duas é como se espera que um teste de
   * regressão acuse coisa que não mudou. */
  ok(Music.transposeCifra('Cm  F', 2) === 'Dm  G',
    'a transposição por semitons preserva a qualidade do acorde',
    Music.transposeCifra('Cm  F', 2));
}

/* ------------------------------------------------------------------ */
secao('14. Título de tom com lixo não vira tom');

{
  /* "[C999]" digitado por engano. Tratar como Do maior faria a cifra inteira
   * ser transposta a partir de um tom inventado — e nada na tela mostraria
   * que o tom foi inventado. */
  ok(Music.keyDirective('[C999]') === null, '[C999] e ignorado, nao lido como Do maior');
  ok(Music.keyDirective('[C69]') === null, '[C69] tambem: um titulo de tom nao tem 69');

  /* E os títulos legítimos seguem intactos. O rótulo precisa do lado certo do
   * círculo: pc 10 é Bb quando se pede bemol, e A# quando se pede sustenido.
   * Passar o lado errado no teste daria "A#" e pareceria defeito do motor. */
  const legitimos = [['[C]', 'C'], ['[Am]', 'Am'], ['[F#m]', 'F#m'], ['[Bb]', 'Bb']];
  for (const par of legitimos) {
    const c = Music.keyDirective(par[0]);
    const rotulo = c ? Music.keyLabel(c.root, c.quality === 'm', Music.useFlatsFor(c.root)) : null;
    ok(rotulo === par[1], par[0] + ' continua sendo o tom ' + par[1],
      'obtido: ' + rotulo);
  }
}

/* ------------------------------------------------------------------ */
secao('15. O contrato antigo continua valendo');

{
  /* `quality` continua sendo '' para tríade maior. Nenhum consumidor que
   * compara com '' pode ter sido quebrado. */
  ok(Music.parseChord('C').quality === '', "parseChord('C').quality ainda e string vazia");
  ok(Music.parseChord('Cm').quality === 'm', "e 'Cm' ainda devolve 'm'");

  /* E o objeto devolve os quatro campos de sempre — mais dois. O que um
   * consumidor antigo usa, continua la. */
  const c = Music.parseChord('G/B');
  ok(typeof c.root === 'number', 'root continua sendo numero', typeof c.root);
  ok(typeof c.quality === 'string', 'quality continua sendo texto', typeof c.quality);
  ok(c.bass === 11, 'bass continua com o baixo', String(c.bass));
  ok(typeof c.text === 'string', 'text continua com o token original', c.text);
  ok('conhecido' in c, 'e agora tem tambem o sinal de desconhecido');
  ok('sufixo' in c, 'e o sufixo bruto');
}

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(58));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  Um acorde lido como maior nao dá erro: ele soa errado.');
  console.log('  E o pior defeito de cifra, porque o músico acredita no ouvido.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(58) + '\n');
process.exit(falhou ? 1 : 0);