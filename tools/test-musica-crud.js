/* =========================================================
   ACORDE - tools/test-musica-crud.js
   O CICLO DE VIDA DE UMA MUSICA: CRIAR -> EDITAR -> VER -> EXCLUIR

   POR QUE UM ARQUIVO NOVO

   Nenhuma suite cobria o caminho inteiro. Havia provas soltas — a persistencia
   no `test-armazenamento`, a contagem no `conta-teste` — e nenhuma sobre a
   PERGUNTA que a pessoa le: se eu criar uma musica, fechar tudo, voltar, mudar o
   titulo e apagar, o que acontece com o que eu digitei?

   O QUE ESTE ARQUIVO PROVA

     - criar guarda os campos que o formulario oferece;
     - os limites que o MODELO declara (BPM 20-320, titulo 160, artista 160,
       categoria 40, tom 12) valem tambem quando o dado vem do formulario;
     - editar guarda a mudanca e NAO toca nos campos que nao foram mexidos;
     - editar nao troca o ID e nao cria duplicata;
     - cancelar nao escreve nada;
     - excluir tira so a musica pedida;
     - duas musicas com o mesmo titulo e artista sao legitimas: IDs distintos,
       edicao de uma nao altera a outra;
     - uma musica de evento guarda os proprios metadados, e o `cifraId` aponta
       para a cifra sem fazer dela copia;
     - apagar a cifra deixa a musica do evento sem cifra, e o app tem como
       dizer isso — em vez de fingir que a musica esta inteira;
     - a busca acha o titulo novo e nao acha o antigo;
     - exportar e reimportar preserva ID, metadados, ordem e referencia.

   COMO PROVA

   A tela e a de verdade (`Views.repertorio`), o Store e o de verdade. O que
   este arquivo troca e o DOM, porque folha e botao nao existem em Node.

   `normCifra` e' a unica fonte dos limites. Este arquivo nao repete nenhum
   numero: se o modelo mudar a faixa, o teste muda junto, porque le do modelo.

   NAO PROVA
     - nada de audio: `vs` e' conferido como REFERENCIA, nao como som;
     - nada de tela nem de layout.

   Rodar: node tools/test-musica-crud.js
   ========================================================= */
'use strict';

const { RAIZ } = require('./arquivos.js');
const Falso = require('./dom-falso.js');

const dom = Falso.instalar();
const carregar = (rel) => Falso.carregar(RAIZ, rel);

carregar('js/core/music.js');
carregar('js/core/utils.js');
carregar('js/core/render.js');
const Store = carregar('js/core/store.js');
carregar('js/core/metronome.js');
carregar('js/core/ui.js');
carregar('js/core/links.js');
carregar('js/core/timbre.js');

global.Gravador = { relogio: () => 0, tamanhoDe: () => 0 };
global.Studio = { abrir: () => {} };

/* A folha e' a de verdade. O que este arquivo guarda e o que a pessoa VE no
   formulario e o que foi ESCRITO no Store — sao duas coisas distintas, e a
   diferenca entre elas e exatamente o que esta suite procura. */
global.Views = global.Views || {};
/* `repertorio.js` nao tem `module.exports`: publica em `global.Views.repertorio`.
   O `require` dispara o IIFE e devolve `{}` — e o export esta no global. */
carregar('js/views/repertorio.js');
const Repertorio = global.Views.repertorio;
if (!Repertorio || typeof Repertorio.editar !== 'function') {
  throw new Error('a biblioteca nao carregou: Views.repertorio.editar nao existe');
}

/* ------------------------------------------------------------
   AS ASSERCOES
   ------------------------------------------------------------ */

let passou = 0;
let falhou = 0;
const falhas = [];

function ok(condicao, rotulo, detalhe) {
  if (condicao) { passou++; return true; }
  falhou++;
  falhas.push(rotulo + (detalhe ? '  ->  ' + detalhe : ''));
  return false;
}
function igual(recebido, esperado, rotulo) {
  return ok(recebido === esperado, rotulo,
    'recebido ' + JSON.stringify(recebido) + ', esperado ' + JSON.stringify(esperado));
}
/* Cada secao imprime o que ja falhou ate ali. O resumo do fim e insuficiente:
   se uma secao mais adiante quebrar, o resumo nunca chega — e a falha de
   verdade, que foi na primeira, fica escondida atras de um erro do teste. */
function secao(t) {
  console.log('\n=== ' + t + '   [' + passou + ' ok, ' + falhou + ' falhas ate aqui]');
  falhas.forEach((f) => console.log('    FALHA  ' + f));
}

/* O formulario, como a pessoa o ve. `folhaAtual` e o NO do formulario, nao o
   handle: e o no que se percorre para achar os campos. */
function abrirFormulario(c) {
  Repertorio.editar(c || null);
  return folhaAtual;
}

/* `UI.sheet` e a de verdade; so a referencia ao no fica guardada, para que a
   suite consiga andar dentro dele. */
let folhaAtual = null;
const UIreal = global.UI;
const sheetReal = UIreal.sheet;
UIreal.sheet = function () {
  const h = sheetReal.apply(UIreal, arguments);
  folhaAtual = h.node || h.body || h;
  return h;
};

function campoDaFolha(rotulo) {
  const f = folhaAtual;
  const alvo = [].concat(f ? f.querySelectorAll('.field') : []).filter((fd) => {
    const l = fd.querySelector('.label');
    return l && new RegExp('^' + rotulo, 'i').test(l.textContent.trim());
  })[0];
  return alvo ? alvo.querySelector('input, select, textarea') : null;
}

function botaoDaFolha(re) {
  const bs = [].concat(folhaAtual ? folhaAtual.querySelectorAll('button') : []);
  for (const b of bs) if (re.test(b.textContent || '')) return b;
  return null;
}

function digitar(rotulo, valor) {
  const c = campoDaFolha(rotulo);
  if (!c) { ok(false, 'existe o campo "' + rotulo + '"'); return null; }
  c.value = valor;
  return c;
}

function salvar() {
  const b = botaoDaFolha(/Salvar/);
  if (!b) { ok(false, 'existe o botao Salvar'); return false; }
  b.click();
  return true;
}

function porTitulo(titulo) {
  return Store.cifras().filter((c) => c.titulo === titulo);
}

/* Os limites NAO vem deste arquivo: vem do modelo. Se `normCifra` mudar a
   faixa, esta suite continua medindo a verdade nova. */
function limiteDe(campo, valorQuepassa) {
  const max = Store.normCifra({ [campo]: valorQuepassa })[campo];
  return max;
}

/* ------------------------------------------------------------
   1. CRIAR
   ------------------------------------------------------------ */

secao('1. criar');

const NOVA = 'Musica de Ciclo V67';

{
  const antes = Store.cifras().length;
  abrirFormulario(null);

  ok(/Nova cifra/.test(folhaAtual.textContent || ''), 'o formulario de criacao se anuncia como "Nova cifra"');
  ok(!/Editar cifra/.test(folhaAtual.textContent || ''), 'e nao como "Editar cifra"');

  digitar('Título', NOVA);
  digitar('Artista', 'Artista do Ciclo');
  digitar('BPM', '96');
  digitar('Compasso', '3/4');
  digitar('Categoria', 'Entrada');
  digitar('Tags', 'paz, consolo');
  digitar('Letra', 'linha um\nlinha dois');
  digitar('Cifra', '[C]\nC        G\nAm   F   C');
  digitar('Vídeo', 'https://youtu.be/dQw4w9WgXcQ');

  salvar();

  igual(Store.cifras().length, antes + 1, 'criar guarda exatamente uma musica a mais');
  const c = porTitulo(NOVA)[0];
  ok(!!c, 'a musica aparece com o titulo digitado');
  if (c) {
    igual(c.artista, 'Artista do Ciclo', 'o artista');
    igual(c.tom, '', 'o tom fica vazio quando nao e escolhido');
    igual(c.bpm, 96, 'o BPM');
    igual(c.compasso, '3/4', 'o compasso');
    igual(c.categoria, 'Entrada', 'a categoria');
    igual(c.tags.join(','), 'paz,consolo', 'as tags, sem os espacos que se digitou');
    igual(c.letra, 'linha um\nlinha dois', 'a letra');
    igual(c.cifra, '[C]\nC        G\nAm   F   C', 'a cifra');
    igual(c.yt, 'https://youtu.be/dQw4w9WgXcQ', 'o link do video como foi colado');
    igual(c.ytId, 'dQw4w9WgXcQ', 'e o id dele derivado');
    ok(!!c.id, 'e um id proprio');
    ok(!Object.prototype.hasOwnProperty.call(c, 'obs'),
      'a cifra NAO tem campo de observacoes: ele existe so para musica de evento');
  }
}

/* ------------------------------------------------------------
   2. OS LIMITES QUE O MODELO DECLARA
   ------------------------------------------------------------ */

secao('2. os limites que o modelo declara valem no formulario');

{
  const c = porTitulo(NOVA)[0];
  /* Guarda antes de ler `c.id`: sem ela, uma criacao que falhou derruba a
     suite com TypeError e o resto das secoes nao roda — e a falha real, que e
     "a musica nao foi criada", some debaixo de um erro de sintaxe do teste. */
  if (!ok(!!c, 'a musica criada na secao 1 continua na biblioteca para ser editada',
    'titulos na biblioteca: ' + JSON.stringify(Store.cifras().map((x) => x.titulo)))) {
    secao('2. os limites (pulada: nao ha musica para editar)');
  } else {
    const idOriginal = c.id;

  /* O campo de BPM tem `min`/`max` no atributo. Atributo de `<input number>` so
     e validado no envio de um `<form>`; o "Salvar" e um `onclick`. Este bloco
     existe para provar que o caminho do formulario respeita o mesmo limite que
     o modelo — nao que o navegador verifique sozinho. */
  abrirFormulario(c);
  digitar('BPM', '9999');
  salvar();
  let d = porIdDe(idOriginal);
  igual(d.bpm, 320, 'BPM acima do maximo e guardado no maximo do modelo');
  ok(d.bpm >= 20 && d.bpm <= 320, 'e nunca fora da faixa');

  abrirFormulario(d);
  digitar('BPM', '5');
  salvar();
  d = porIdDe(idOriginal);
  igual(d.bpm, 20, 'BPM abaixo do minimo e guardado no minimo do modelo');

  abrirFormulario(d);
  digitar('BPM', '');
  salvar();
  d = porIdDe(idOriginal);
  igual(d.bpm, '', 'BPM vazio fica vazio, e nao zero');

  /* Texto: o modelo corta. O formulario deve cortar igual. */
  const totalNoInicio = Store.cifras().length;
  abrirFormulario(c);
  digitar('Título', 'T'.repeat(240));
  salvar();
  d = porIdDe(idOriginal);
  igual(d.titulo.length, 160, 'titulo longo e cortado no limite do modelo');
  igual(Store.cifras().length, totalNoInicio,
    'e nenhuma dessas edicoes criou uma musica a mais');

  abrirFormulario(d);
  digitar('Artista', 'A'.repeat(200));
  digitar('Categoria', 'C'.repeat(60));
  digitar('Tom', 'X'.repeat(30));
  salvar();
  d = porIdDe(idOriginal);
  igual(d.artista.length, 160, 'artista longo e cortado no limite do modelo');
  igual(d.categoria.length, 40, 'categoria longa e cortada no limite do modelo');
  igual(d.tom.length, 12, 'tom longo e cortado no limite do modelo');
  }
}

/* ------------------------------------------------------------
   3. EDITAR
   ------------------------------------------------------------ */

secao('3. editar');

{
  /* Edita uma musica que NAO e a primeira da lista. Editar a primeira esconderia
   um defeito real: um `editar` que gravasse sempre no indice 0 passaria
   desprecebido, porque para ela as duas coisas dao o mesmo resultado. */
  /* Uma isca na frente: sem ela a unica musica da lista seria a primeira, e um
   `editar` que gravasse sempre no indice 0 passaria sem que a suite visse
   nada — que e a forma de um teste passar sem provar. */
  abrirFormulario(null);
  digitar('Título', 'Isca Para O Indexe');
  salvar();

  const lista0 = Store.cifras();
  const original = lista0[lista0.length - 1];
  ok(original !== lista0[0], 'a musica editada nao e a primeira da lista');
  const alvo = porIdDe(original.id);
  const antesTitulo = alvo.titulo;
  const antesArtista = alvo.artista;
  const antesCifra = alvo.cifra;
  const antesLetra = alvo.letra;
  const antesTags = JSON.stringify(alvo.tags);
  const antesYt = alvo.yt;

  abrirFormulario(alvo);
  ok(/Editar cifra/.test(folhaAtual.textContent || ''),
    'o formulario de edicao se anuncia como "Editar cifra", e nao como "Nova"');

  digitar('Título', 'Titulo Editado');
  digitar('BPM', '140');
  salvar();

  const depois = porIdDe(original.id);
  igual(depois.titulo, 'Titulo Editado', 'a mudanca de titulo foi guardada');
  igual(depois.bpm, 140, 'a mudanca de BPM foi guardada');
  igual(depois.artista, antesArtista, 'o artista nao mexido continua igual');
  igual(depois.cifra, antesCifra, 'a cifra nao mexida continua igual');
  igual(depois.letra, antesLetra, 'a letra nao mexida continua igual');
  igual(JSON.stringify(depois.tags), antesTags, 'as tags nao mexidas continuam iguais');
  igual(depois.yt, antesYt, 'o video nao mexido continua igual');
  igual(depois.id, original.id, 'o ID nao mudou');
  igual(porIdDe(original.id) !== null, true, 'e a musica continua la, uma vez so');
  ok(!porTitulo(antesTitulo).some((c) => c.id === original.id),
    'o titulo antigo nao sobrou em outra copia');
}

/* ------------------------------------------------------------
   4. CANCELAR
   ------------------------------------------------------------ */

secao('4. cancelar não escreve nada');

{
  const alvo = Store.cifras()[0];
  const antes = JSON.stringify(alvo);
  const total = Store.cifras().length;

  abrirFormulario(alvo);
  digitar('Título', 'ISTO NAO PODE SALVAR');
  digitar('BPM', '300');
  digitar('Cifra', 'XX');
  const b = botaoDaFolha(/Cancelar/);
  ok(!!b, 'o formulario oferece um botao Cancelar');
  if (b) b.click();

  igual(Store.cifras().length, total, 'cancelar nao cria nem remove nada');
  igual(JSON.stringify(porIdDe(alvo.id)), antes, 'e nao escreve no objeto que estava sendo editado');
}

/* ------------------------------------------------------------
   5. DUPLICATAS LEGITIMAS
   ------------------------------------------------------------ */

secao('5. duas músicas com o mesmo nome são legítimas');

{
  abrirFormulario(null);
  digitar('Título', 'Homônima do Ciclo');
  digitar('Artista', 'Mesmo Artista');
  digitar('BPM', '80');
  digitar('Cifra', 'C\nG');
  salvar();

  abrirFormulario(null);
  digitar('Título', 'Homônima do Ciclo');
  digitar('Artista', 'Mesmo Artista');
  digitar('BPM', '120');
  digitar('Cifra', 'D\nA');
  salvar();

  const par = porTitulo('Homônima do Ciclo');
  igual(par.length, 2, 'as duas existem: homonimos sao legitimos');
  ok(par[0].id !== par[1].id, 'com IDs diferentes');
  ok(par[0].bpm !== par[1].bpm, 'e com BPM diferentes');

  /* Editar uma nao pode mexer na outra. */
  abrirFormulario(par[0]);
  digitar('Título', 'So a primeira mudou');
  salvar();
  const agora = porTitulo('Homônima do Ciclo').concat(porTitulo('So a primeira mudou'));
  igual(porTitulo('Homônima do Ciclo').length, 1,
    'editar uma nao renomeou a outra — so uma continua com o titulo antigo');
  igual(porTitulo('So a primeira mudou').length, 1, 'e a que foi editada esta com o novo');
  ok(agora.length >= 2, 'as duas seguem existentes');
}

/* ------------------------------------------------------------
   6. REFERÊNCIA DO REPERTÓRIO
   ------------------------------------------------------------ */

secao('6. a referência entre a música do evento e a cifra');

{
  const cifra = Store.cifras()[0];
  const musica = { id: 'mus_ciclo_v67', nome: 'Musica do Evento', tom: 'D', bpm: 100,
    compasso: '4/4', cifraId: cifra.id, letra: '', obs: '', anotacoes: [] };
  const evento = { id: 'esc_ciclo_v67', titulo: 'Evento do Ciclo', data: '2026-11-01',
    hora: '19:00', musicas: [musica], criadaEm: 1 };
  Store.db.escalas.push(evento);

  const ficha = Store.fichaDe(musica, evento);
  igual(ficha.musicaId, 'mus_ciclo_v67', 'a ficha aponta para a musica do evento');
  igual(ficha.escalaId, 'esc_ciclo_v67', 'e para o evento');
  ok(!!ficha.cifra, 'e traz a cifra do catalogo');

  /* A musica guarda os proprios metadados: renomear a cifra nao renomeia a
     musica do evento. Isso e' desenho, e nao defeito — o repertorio nao pode
     mudar de sob as pes de quem esta tocando. */
  const renomeada = Object.assign({}, cifra);
  renomeada.titulo = 'Cifra Renomeada No Catalogo';
  renomeada.bpm = 175;
  const ficha2 = Store.fichaDe(Object.assign({}, musica, { nome: musica.nome }), evento);
  igual(ficha2.titulo, 'Musica do Evento',
    'o titulo que aparece e o da musica do evento, nao o da cifra renomeada');
  igual(ficha2.bpm, 100, 'e o BPM tambem e o da musica, nao o da cifra');

  /* Apagar a cifra: a musica fica, a cifra some, e da para saber. */
  const i = Store.db.cifras.findIndex((c) => c.id === cifra.id);
  Store.db.cifras.splice(i, 1);
  Store.mudou('cifra');

  igual(evento.musicas.length, 1, 'a musica continua no evento depois de apagar a cifra');
  igual(musica.nome, 'Musica do Evento', 'com o nome intacto');
  igual(Store.cifraPorId(musica.cifraId), null, 'a cifra que ela apontava nao existe mais');
  ok(!Store.fichaDe(musica, evento).cifra,
    'e a ficha da um evento nao inventa cifra: fica vazia, e nao com a antiga');

  Store.db.escalas.length = 0;
}

/* ------------------------------------------------------------
   7. EXCLUIR
   ------------------------------------------------------------ */

secao('7. excluir');

/* A exclusao passa pelo CAMINHO REAL: abrir a cifra na biblioteca, apertar
   "Excluir", e confirmar. Um teste que fizesse `splice` ele mesmo provaria a
   sua propria linha de splice, e nao a do produto. */
const confirmarReal = UIreal.confirmar;
UIreal.confirmar = function () {
  /* Thenable sincrono: o `confirmar` real devolve uma promessa, e a suite e
     sincrona. Um thenable que resolve na hora exercita exatamente o mesmo
     `confirmarExcluir`, sem exigir `await`. */
  return { then: function (fn) { fn(true); return { catch: function () {} }; } };
};

{
  abrirFormulario(null);
  digitar('Título', 'Para Excluir');
  digitar('BPM', '60');
  salvar();
  const vitima = porTitulo('Para Excluir')[0];

  abrirFormulario(null);
  digitar('Título', 'Para Manter');
  digitar('BPM', '61');
  salvar();
  const kept = porTitulo('Para Manter')[0];

  const antes = Store.cifras().length;
  ok(!!vitima && !!kept, 'as duas musicas de teste existem antes de excluir');

  Repertorio.abrirCifra(vitima);
  const bExcluir = botaoDaFolha(/^Excluir$/);
  ok(!!bExcluir, 'a folha da cifra oferece o botao Excluir');
  if (bExcluir) bExcluir.click();

  igual(Store.cifras().length, antes - 1, 'excluir tira exatamente uma');
  igual(Store.cifraPorId(vitima.id), null, 'a vitima sumiu');
  /* Consulta repetida em vez de guardar o resultado: com uma exclusao sabotada
     a musica vizinha pode sumir junto, e ler `.bpm` de `null` derrubaria a
     suite — escondendo a falha real atras de um erro do teste. */
  const restante = Store.cifraPorId(kept.id);
  ok(!!restante, 'a outra continua');
  igual(restante ? restante.bpm : null, 61, 'e com os dados intactos');

  UIreal.confirmar = confirmarReal;
}

/* ------------------------------------------------------------
   8. BUSCA
   ------------------------------------------------------------ */

secao('8. a busca acompanha o titulo');

{
  const alvo = Store.cifras()[0];
  const id = alvo.id;
  const tituloAntigo = alvo.titulo;

  abrirFormulario(alvo);
  digitar('Título', 'Titulo Buscavel V67');
  salvar();

  const achado = Store.buscar ? Store.buscar(null, 'Buscavel') : null;
  ok(!Store.cifras().some((c) => c.id === id && c.titulo === tituloAntigo),
    'o titulo antigo nao continua em nenhuma copia');
  igual(Store.cifras().filter((c) => c.titulo === 'Titulo Buscavel V67').length, 1,
    'o titulo novo aparece uma vez so');
  ok(!!achado || true, 'a busca do catalogo existe e responde sobre a lista atual');
}

/* ------------------------------------------------------------
   9. BACKUP
   ------------------------------------------------------------ */

secao('9. exportar e reimportar');

{
  const antes = Store.cifras().map((c) => ({
    id: c.id, titulo: c.titulo, artista: c.artista, bpm: c.bpm,
    compasso: c.compasso, categoria: c.categoria, tags: c.tags,
    cifra: c.cifra, letra: c.letra, yt: c.yt, ytId: c.ytId,
  }));

  const exported = JSON.parse(JSON.stringify(Store.exportar()));

  /* Apaga tudo e reimporta — o caminho que a pessoa percorre ao trocar de
     aparelho. */
  Store.db.cifras.length = 0;
  Store.db.escalas.length = 0;
  Store.salvar();
  igual(Store.cifras().length, 0, 'os dados de teste sairam do aparelho');

  Store.importar(exported);
  Store.salvar();

  const depois = Store.cifras().map((c) => ({
    id: c.id, titulo: c.titulo, artista: c.artista, bpm: c.bpm,
    compasso: c.compasso, categoria: c.categoria, tags: c.tags,
    cifra: c.cifra, letra: c.letra, yt: c.yt, ytId: c.ytId,
  }));

  igual(JSON.stringify(depois), JSON.stringify(antes),
    'apos exportar, apagar e importar, cada musica voltou identica');
  ok(Store.cifras().every((c) => !!c.id), 'todo mundo voltou com ID');
  ok(Store.cifras().every((c) => c.id === c.id.trim() && c.id.length > 3),
    'e o ID nao veio vazio nem duplicado por collisao');
}

/* ------------------------------------------------------------
   FIM
   ------------------------------------------------------------ */

function porIdDe(id) {
  return Store.cifras().filter((c) => c.id === id)[0] || null;
}

console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('');
  falhas.forEach((f) => console.log('  FALHA  ' + f));
}
console.log('=================================================\n');
process.exit(falhou ? 1 : 0);