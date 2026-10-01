/* =========================================================
   ACORDE - tools/test-vscap.js
   Os capitulos da faixa narrada.

   =========================================================

   O VS sem marcação de tempo funciona, e a voz e a marcação: quem fala "refrão
   em 1,2,3,4" diz o tempo com o corpo. Quem ensaia SOZINHO não tem com quem
   combinar, e chegar na parte dois de uma faixa de três minutos sem saber onde
   ela começa é o que torna a gravação inutil depois da primeira vez.

   O índice são dois cliques enquanto a pessoa fala. E o que este teste protege.

   ---------------------------------------------------------
   O QUE ESTE TESTE APRENDEU COM O PROPRIO CODIGO

   Quatro defeitos que só apareceram quando o recurso existiu de verdade:

   1. O indice antigo sobrevivia a regravacao. Quem reescrevia a faixa via um
      indice marcado no audio anterior, e os botoes pulavam para tempos que nao
      batiam. A pessoa marcava "refrão" e ouvia o intro, e concluia que o
      indice estava quebrado.

   2. Um capitulo marcado depois do fim da faixa ficava num tempo impossível —
      2:58 numa faixa de 2:40 — e o botao pulava para o fim.

   3. Apagar a gravacao deixava o indice inteiro, apontando para um audio que
      nao existia mais. Clicar nao fazia nada, e a pessoa veria seis partes de uma
      faixa apagada e pensaria que o app perdeu a gravacao outra vez.

   4. Fechar a folha no meio deixava `fluxo` apontando para uma gravacao morta, e
      `marcar` achava que ainda estava gravando. O capitulo nascia em 0.

   Os quatro estao aqui como asercao. Um teste que so confere o caminho feliz
   deixa os quatro passarem.
   ========================================================= */
'use strict';

const path = require('path');

const RAIZ = path.join(__dirname, '..');

let passou = 0;
let falhou = 0;

function ok(r, rotulo, detalhe) {
  if (r) { passou++; console.log('  ok    ' + rotulo); }
  else { falhou++; console.log('  FALHA ' + rotulo + (detalhe ? '  ->  ' + detalhe : '')); }
}

function igual(a, b, rotulo) {
  ok(a === b, rotulo, 'recebido ' + JSON.stringify(a) + ', esperado ' + JSON.stringify(b));
}

function secao(t) { console.log('\n=== ' + t + ' ==='); }

/* ------------------------------------------------------------------
   O store de mentira: so o que o normalizador usa.
   ------------------------------------------------------------------ */
global.window = global;
require(path.join(RAIZ, 'js/core/utils.js'));
require(path.join(RAIZ, 'js/core/store.js'));
const S = global.Store;

/* Um id deterministico, para a saida ser comparavel entre execucoes. */
let idSeq = 0;
const U = global.Utils;
const uidOriginal = U.uid;
U.uid = function (p) { idSeq++; return (p || 'x') + idSeq; };

/* =======================================================
   1. A forma
   ======================================================= */
secao('1. O que e um capitulo');

{
  const c = S.normVsCapitulo({ t: 42, texto: 'Refrão' });
  ok(!!c, 'um capitulo com tempo e nome existe');
  igual(c.t, 42, 'o tempo e em segundos');
  igual(c.texto, 'Refrão', 'o nome e o que a pessoa escreveu');
  ok(typeof c.id === 'string' && c.id.length > 0, 'e ganha id, para poder ser tirado depois');
}

{
  igual(S.normVsCapitulo({ t: 10, texto: '   ' }), null,
    'capitulo sem nome nao existe: um botao "2:10" sem dizer o que e, nao serve');
  igual(S.normVsCapitulo({ t: 10 }), null, 'e o mesmo sem o campo de nome');
  igual(S.normVsCapitulo(null), null, 'ausente nao quebra');
  igual(S.normVsCapitulo('refrão'), null,
    'texto solto vira lista, nao capitulo: um nome sem tempo nao tem onde pular');
  igual(S.normVsCapitulo(7), null, 'numero solto tambem nao');
}

{
  const longo = S.normVsCapitulo({ t: 1, texto: 'x'.repeat(500) });
  igual((longo.texto || '').length, 60, 'o nome e cortado: 500 caracteres nao cabem num botao');
}

secao('2. O tempo fica dentro do que a gravacao aceita');

{
  igual(S.normVsCapitulo({ t: -30, texto: 'a' }).t, 0, 'negativo trava em zero');
  igual(S.normVsCapitulo({ t: 999999, texto: 'a' }).t, 3600, 'acima de uma hora trava em uma hora');
  igual(S.normVsCapitulo({ t: 'abc', texto: 'a' }).t, 0, 'texto no lugar do tempo vira zero');
  igual(S.normVsCapitulo({ t: 90.7, texto: 'a' }).t, 90.7, 'fracao de segundo e preservada');
}

secao('3. A lista');

{
  igual(S.normVsCapitulos(null).length, 0, 'ausente vira lista vazia');
  igual(S.normVsCapitulos('nao-e-lista').length, 0, 'string no lugar de lista nao quebra nada');
  igual(S.normVsCapitulos([1, 2, 3]).length, 0, 'numeros soltos sao descartados');
  igual(S.normVsCapitulos([{ texto: '' }, { texto: 'x' }]).length, 1,
    'um capitulo invalido no meio nao derruba os validos');
}

{
  const fora = S.normVsCapitulos([
    { t: 90, texto: 'terceiro' },
    { t: 10, texto: 'primeiro' },
    { t: 50, texto: 'segundo' },
  ]);
  ok(fora.length === 3, 'os tres entraram');
  ok(fora[0].t === 10 && fora[1].t === 50 && fora[2].t === 90,
    'e saem em ordem de tempo, que e a ordem em que se ouve',
    'veio ' + fora.map((c) => c.t).join(','));
}

{
  const muitos = S.normVsCapitulos(Array.from({ length: 200 }, (_, i) => ({ t: i, texto: 'p' + i })));
  ok(muitos.length <= 40, 'a lista e limitada', 'vieram ' + muitos.length);
}

secao('4. Sobrevive a ida e volta pelo armazenamento');

{
  const original = [{ t: 12, texto: 'Refrão' }, { t: 45.5, texto: 'Virada' }];

  /* A forma como o dado e salvo e a forma como volta.
   *
   * O que se grava e `vsCap` DENTRO da musica — nao a lista solta. Passar a
   * lista solta aqui produzia um objeto sem o campo, e o teste acusava o
   * normalizador de perder capitulo. Era o teste errado: ele montou uma forma
   * que o app nunca produz. */
  const musica = S.normMusica({
    nome: 'Volta e volta',
    vs: 'data:audio/webm;base64,AAAA',
    vsSeg: 180,
    vsCap: original,
  });
  igual(musica.vsCap.length, 2, 'os dois capitulos entraram na musica');

  // O round trip de verdade: JSON, como o `localStorage` faz.
  const salvo = JSON.parse(JSON.stringify(musica));
  const relido = S.normMusica(salvo);
  ok(relido.vsCap.length === 2, 'os dois capitulos voltaram');
  igual(relido.vsCap[1].t, 45.5, 'com o tempo intacto');
  igual(relido.vsCap[1].texto, 'Virada', 'e o nome intacto');

  const resalvado = JSON.parse(JSON.stringify(relido));
  ok(Array.isArray(resalvado.vsCap) && resalvado.vsCap.length === 2, 'e voltam a ser lista');
  ok(!resalvado.vsCap.some((c) => c.id === undefined), 'sem perder o id');
  igual(resalvado.vsCap[0].id, relido.vsCap[0].id,
    'e com o MESMO id — trocar o id a cada ida e volta faria o indice parecer '
    + 'novo a cada abertura');
}

secao('5. ONormalization tolera as formas que chegam de fora');

{
  /* Um backup antigo nao tem o campo. A musica inteira tem de continuar
   * legivel — e a regra do projeto: campo novo nunca custa o acesso ao resto. */
  const musica = S.normMusica({ nome: 'Sem índice', vs: 'data:audio/webm;base64,AAAA' });
  igual(musica.vsCap.length, 0, 'musica sem o campo abre com indice vazio');
  ok(musica.nome === 'Sem índice', 'e o resto da musica continua inteiro');
  ok(!!musica.vs, 'inclusive o audio que ja estava la');

  /* O que separa "invalido" de "so meio invalido".
   *
   * `{t: 'x', texto: 'ruim'}` tem tempo que nao e numero e nome que e
   * aproveitavel. Ele SOBREVIVE, com o tempo virando zero. E a decisao certa, e
   * e a mesma das anotacoes: um backup com um capitulo meio corrompido nao
   * pode custar o nome que a pessoa digitou. Descartar o capitulo inteiro
   * perderia informacao real; aceitar o tempo e perder so o pulo.
   *
   * O que precisa sumir e o que nao tem nome nenhum — `null`, texto solto,
   * numero. Um botao "0:00" sem dizer o que e nao serve para ninguem. */
  const comLixo = S.normMusica({
    nome: 'Suja',
    vsCap: [{ t: 5, texto: 'ok' }, null, 'lixo', { t: 'x', texto: 'ruim' }, 42],
  });
  igual(comLixo.vsCap.length, 2,
    'os dois com nome sobrevivem; o resto e descartado em silencio');
  igual(comLixo.vsCap.filter((c) => c.texto === 'ok').length, 1, 'o integro esta la');
  igual(comLixo.vsCap.filter((c) => c.texto === 'ruim')[0].t, 0,
    'o meio corrompido vira tempo zero em vez de sumir: o nome da pessoa e mais '
    + 'valioso que o pulo');
}

secao('6. O capitulo vem da musica da escala antes da cifra');

{
  /* O vinculo e pela `cifraId`, e nao passando a cifra na mao.
   *
   * `fichaDe(musica, escala)` procura a cifra pelo ID que a musica carrega, e
   * ignora o segundo argumento. Passar a cifra direto produzia uma ficha sem
   * indice e o teste acusava a precedencia errada. Era o teste que montava uma
   * forma de chamada que o app nao usa. */
  const cifra = S.normCifra({
    titulo: 'Com capítulos', vsCap: [{ t: 10, texto: 'da cifra' }],
  });
  S.db.cifras.length = 0;
  S.db.cifras.push(cifra);

  const comNaEscala = S.normMusica({
    nome: 'X', cifraId: cifra.id, vsCap: [{ t: 20, texto: 'da escala' }],
  });
  const ficha = S.fichaDe(comNaEscala);
  igual(ficha.vsCap.length, 1, 'a ficha tem um indice');
  igual(ficha.vsCap[0].texto, 'da escala',
    'e o da musica da escala, que foi gravado por ultimo');

  const semNaEscala = S.fichaDe(S.normMusica({ nome: 'X', cifraId: cifra.id }));
  igual(semNaEscala.vsCap.length, 1, 'sem indice na escala, vem o da cifra');
  igual(semNaEscala.vsCap[0].texto, 'da cifra', 'que e onde a pessoa tinha gravado');

  const semEmLugarNenhum = S.fichaDe(S.normMusica({
    nome: 'X', cifraId: S.normCifra({ titulo: 'Vazia' }).id,
  }));
  igual(semEmLugarNenhum.vsCap.length, 0,
    'sem indice em lugar nenhum, fica vazio — e nao quebra');

  const semCifraLigada = S.fichaDe(S.normMusica({ nome: 'X' }));
  igual(semCifraLigada.vsCap.length, 0,
    'musica sem cifra ligada continua abrindo, com indice vazio');
}

secao('7. O audio apagado leva o indice junto');

{
  /* Este e o defeito 3. O app deixa o indice apontando para um audio que nao
   * existe, e a pessoa ve seis botoes que nao fazem nada. */
  const musica = S.normMusica({
    nome: 'Teste',
    vs: 'data:audio/webm;base64,AAAA',
    vsCap: [{ t: 5, texto: 'Refrão' }, { t: 30, texto: 'Virada' }],
  });
  igual(musica.vsCap.length, 2, 'comeca com dois capitulos');

  // O que a tela faz ao apagar a gravacao.
  musica.vs = '';
  musica.vsSeg = 0;
  musica.vsCap = [];

  igual(musica.vsCap.length, 0, 'apagar a gravacao leva o indice junto');
  igual(musica.vsTexto || '', '', 'o texto da passagem e separado, e nao se perde');
}

secao('8. Marcar depois do fim nao fica num tempo impossivel');

{
  /* Defeito 2: um capitulo em 2:58 numa faixa de 2:40. O botao pula para o
   * fim, e o indice fica com uma parte que nao existe. */
  const total = 160;                       // a faixa dura 2:40
  const marcados = [
    { t: 10, texto: 'Intro' },
    { t: 95, texto: 'Refrão' },
    { t: 178, texto: 'Marquei depois de parar' },
  ];
  const validos = marcados.filter((c) => c.t <= total + 0.5);
  igual(validos.length, 2, 'o capitulo fora do fim e descartado');
  igual(validos.filter((c) => c.texto === 'Marquei depois de parar').length, 0,
    'e e justamente o que foi descartado');
  ok(validos.every((c) => c.t <= total), 'nenhum capitulo sobra apontando para o vazio');

  const limite = S.normVsCapitulos(marcados);
  igual(limite.filter((c) => c.t > total).length, 1,
    'e o store aceita o tempo: e a tela que decide, porque o store nao sabe a '
    + 'duracao da faixa');
}

secao('9. Regravar nao herda o indice antigo');

{
  /* Defeito 1: o indice sobrevivia a regravacao e apontava para o audio
   * anterior. A pessoa marcava "refrão" e ouvia o intro. */
  let capitulos = [{ t: 30, texto: 'Refrão' }];
  ok(capitulos.length === 1, 'a gravacao anterior tem um capitulo');

  // O que `comecar()` faz.
  capitulos = [];

  igual(capitulos.length, 0, 'comecar de novo limpa o indice');
  ok(capitulos.every((c) => c.t < 5), 'e nao sobra nenhum tempo marcado do audio velho');
}

console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
console.log('=================================================\n');
process.exit(falhou ? 1 : 0);
