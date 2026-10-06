/* =========================================================
   ACORDE - tools/test-backup-real.js
   O BACKUP COMO MECANISMO DE RECUPERAÇÃO

   POR QUE UM ARQUIVO NOVO

   O backup é a única coisa que separa "o app guarda" de "a pessoa guarda". A
   V6.7 provou que a foto sobrevive ao armazenamento; a V6.9 provou que ela
   sobrevive ao reload. Nenhuma das duas provou que ela sobrevive a um backup
   exportado por Ajustes e trazido de volta. Este arquivo fecha essa lacuna.

   O QUE ESTE ARQUIVO PROVA

     - o backup leva escalas, cifras, ajustes e a ordem em que estão;
     - uma foto anotada (que substitui a foto original no registro) atravessa;
     - exportar → apagar → importar devolve o mesmo estado;
     - mesclar não duplica e não sobrescreve o que já existe;
     - substituir troca tudo, incluindo o que não veio no arquivo;
     - id repetido no arquivo não cria duas músicas com a mesma chave;
     - arquivo corrompido é recusado E o estado anterior fica como estava;
     - a recusa acontece ANTES de mexer no estado — nada de importação pela
       metade;
     - um `id` inexistente no repertório não é consertado às escondidas.

   O QUE ESTE ARQUIVO NAO PROVA

     - o clique em Ajustes, o download no sistema e a folha de arquivos: isso é
       do navegador, e foi medido no DOM na fase.
     - gravação de áudio (VS). O campo existe no modelo; áudio de verdade não
       existe aqui.

   Rodar: node tools/test-backup-real.js
   ========================================================= */
'use strict';

const { RAIZ } = require('./arquivos.js');
const Falso = require('./dom-falso.js');

Falso.instalar();
const carregar = (rel) => Falso.carregar(RAIZ, rel);

carregar('js/core/music.js');
carregar('js/core/utils.js');
carregar('js/core/render.js');
const Store = carregar('js/core/store.js');
carregar('js/core/ui.js');

/* Um armazenamento local de mentira, para o ciclo exportar → apagar → importar
   acontecer inteiro em memoria. */
let RAM = {};
global.localStorage = {
  getItem: (k) => (k in RAM ? RAM[k] : null),
  setItem: (k, v) => { RAM[k] = String(v); },
  removeItem: (k) => { delete RAM[k]; },
  clear: () => { RAM = {}; },
  get length() { return Object.keys(RAM).length; },
  key: (i) => Object.keys(RAM)[i] || null,
};
global.U = { uid: (p) => p + '_' + Math.random().toString(36).slice(2, 10) };

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
function secao(t) {
  console.log('\n=== ' + t + '   [' + passou + ' ok, ' + falhou + ' falhas ate aqui]');
  falhas.forEach((f) => console.log('    FALHA  ' + f));
}

/* ------------------------------------------------------------
   O CONJUNTO DE TESTE
   ------------------------------------------------------------ */

const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAAA';
/* A foto anotada é a foto DEPOIS do "Salvar no Clave": o registro tem uma imagem
   só, e é a anotada. Por isso ela não pode ser confundida com a original. */
const FOTO_ANOTADA = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAGQAAAQABAAD/3BOWklm';

function semear() {
  Store.apagar();
  const cifras = [];
  const alvos = [
    { titulo: 'O Senhor e o Meu Pastor', artista: 'TNT', bpm: 80, tom: 'G', tags: ['favor'] },
    { titulo: 'Quão Grande É o Teu Amor', artista: 'Incidental', bpm: 92, tom: 'Eb' },
    { titulo: 'Entrada Com Um Anjo', bpm: 76, tom: 'C', letra: 'Entra, entra', cifra: '[C]\nG' },
    { titulo: 'O Amor Não Falha', artista: 'TNT', bpm: 88, tom: 'Am', foto: FOTO_ANOTADA },
    { titulo: 'O Amor Não Falha', artista: 'TNT', bpm: 96, tom: 'Dm' },
    { titulo: 'Comunhão', bpm: 64, tom: 'F', yt: 'https://youtu.be/abcdefghijk' },
    { titulo: 'Aleluia', bpm: 100, tom: 'Em' },
    { titulo: 'Senhor Te Adoro', bpm: 72, tom: 'D', tags: ['devocional', 'missa'] },
    { titulo: 'Vinde', bpm: 110, tom: 'C#' },
    { titulo: 'Nada Me Falta', artista: 'TNT', bpm: 78, tom: 'Am', foto: FOTO },
  ];
  alvos.forEach((a) => { cifras.push(Store.normCifra(a)); });
  Store.db.cifras = cifras;

  /* Um repertório com 8 músicas, em ordem que NÃO é a ordem da biblioteca. */
  Store.db.escalas = [Store.normEscala({
    titulo: 'Missa de Lava Pés', data: '2026-04-02', hora: '19:00',
    musicas: [cifras[8].id, cifras[0].id, cifras[5].id, cifras[3].id,
      cifras[1].id, cifras[7].id, cifras[2].id, cifras[4].id].map((id) => ({ id: id, nome: '', tom: '' })),
  })];
  Store.mudou('cifra');
  return cifras;
}

/* Uma comparacao que ignora os relogios.
   *
   * `criadoEm`, `atualizadoEm` e `atualizadaEm` mudam a cada gravacao, e um
   * backup que devolvesse exatamente o mesmo numero seria um relogio parado,
   * nao um backup melhor. O que tem de voltar identico e o resto — o que a
   * pessoa escreveu, a ordem, e as fotos. */
function semRelogio(v) {
  return JSON.parse(JSON.stringify(v, function (chave, valor) {
    return /^(criadoEm|atualizadoEm|atualizadaEm)$/.test(chave) ? '__t' : valor;
  }));
}

const titulos = () => Store.db.cifras.map((c) => c.titulo);
const porId = (id) => Store.db.cifras.filter((c) => c.id === id)[0] || null;

/* ------------------------------------------------------------
   1. EXPORTAÇÃO
   ------------------------------------------------------------ */

const base = semear();
const backup = Store.exportar();
let doc = null;

secao('1. a exportação leva o que importa');

{
  ok(typeof backup === 'string', 'devolve um texto');
  doc = JSON.parse(backup);
  ok(!!doc, 'e esse texto é um JSON que o Node entende');

  igual(doc.cifras.length, 10, 'leva as 10 cifras');
  igual(doc.escalas.length, 1, 'leva a escala');
  ok(!!doc.app, 'diz de que app veio (' + doc.app + ')');
  ok(!!doc.exportadoEm, 'e quando foi exportado');
  ok(doc.ajustes && typeof doc.ajustes === 'object', 'e leva os ajustes');

  /* Guarda antes de comparar: sem ela, um arquivo de backup sem cifras faz a
     suite MORRER num `TypeError` em `doc.cifras[0]`, e uma suite morta nao
     conta nada — só esconde a falha que a fez morrer. */
  igual(doc.cifras[0] && doc.cifras[0].id, base[0].id, 'a ordem das cifras é a mesma');
  igual(doc.escalas[0] && doc.escalas[0].musicas[0] && doc.escalas[0].musicas[0].id,
    Store.db.escalas[0].musicas[0].id, 'e a ordem dentro do repertorio também');

  ok(doc.escalas[0] && doc.escalas[0].musicas && doc.escalas[0].musicas.length === 8,
    'o repertorio tem 8 musicas');
  ok(!('version' in doc), 'e o arquivo NAO tem campo de versao — registrado como achado');
}

/* ------------------------------------------------------------
   2. FOTO E FOTO ANOTADA
   ------------------------------------------------------------ */

secao('2. foto e foto anotada atravessam o arquivo');

{
  const anotada = porId(base[3].id);
  const simples = porId(base[9].id);
  igual(anotada.foto, FOTO_ANOTADA, 'a foto anotada e um campo so, e vai inteiro');
  igual(simples.foto, FOTO, 'e a foto simples tambem');
  ok(anotada.foto !== FOTO, 'a anotada NAO e a foto original');
}

/* ------------------------------------------------------------
   3. EXPORTAR → APAGAR → IMPORTAR
   ------------------------------------------------------------ */

secao('3. exportar → apagar → importar devolve o mesmo estado');

{
  const antesCifras = JSON.stringify(semRelogio(Store.db.cifras));
  const antesEscalas = JSON.stringify(semRelogio(Store.db.escalas));

  Store.apagar();
  igual(Store.db.cifras.length, 0, 'apagar esvaziou as cifras');
  igual(Store.db.escalas.length, 0, 'e as escalas');

  const r = Store.importar(backup, 'substituir');
  ok(r && r.ok, 'a importacao respondeu que deu certo');
  igual(r.cifras, 10, 'contou 10 cifras');
  igual(r.escalas, 1, 'e 1 escala');

  igual(JSON.stringify(semRelogio(Store.db.cifras)), antesCifras,
    'as cifras voltaram inteiras, campo por campo');
  igual(JSON.stringify(semRelogio(Store.db.escalas)), antesEscalas,
    'e as escalas tambem');
  ok(!!porId(base[3].id) && porId(base[3].id).foto === FOTO_ANOTADA,
    'a foto anotada voltou');
  ok(!!porId(base[9].id) && porId(base[9].id).foto === FOTO,
    'e a foto simples tambem');
}

/* ------------------------------------------------------------
   4. OS IDs ESTÃO TODOS LÁ, E SÓ UMA VEZ
   ------------------------------------------------------------ */

secao('4. os ids voltaram, e nenhum repetido');

{
  const ids = Store.db.cifras.map((c) => c.id);
  igual(new Set(ids).size, ids.length, 'nao ha id repetido');
  base.forEach((c, i) => {
    ok(ids.indexOf(c.id) >= 0, 'a cifra ' + (i + 1) + ' (' + c.titulo + ') voltou com o mesmo id');
  });
  /* Dois titulos iguais com ids diferentes sao duas musicas de verdade. */
  const iguais = titulos().filter((t) => t === 'O Amor Não Falha');
  igual(iguais.length, 2, 'o titulo repetido continua sendo duas musicas');
  ok(ids.filter((i) => porId(i).titulo === 'O Amor Não Falha').length === 2,
    'com ids distintos');
}

/* ------------------------------------------------------------
   5. O REPERTÓRIO APONTA PARA MÚSICAS QUE EXISTEM
   ------------------------------------------------------------ */

secao('5. o repertorio aponta para músicas que existem');

{
  const musicas = Store.db.escalas[0].musicas;
  igual(musicas.length, 8, 'o repertorio tem 8 entradas');
  const orfas = musicas.filter((m) => !porId(m.id));
  igual(orfas.length, 0, 'nenhuma entrada aponta para uma cifra que nao veio');
  const repetidas = new Set(musicas.map((m) => m.id));
  igual(repetidas.size, 8, 'e nenhuma entrada esta repetida');
}

/* ------------------------------------------------------------
   6. MESCLAR
   ------------------------------------------------------------ */

secao('6. mesclar junta sem duplicar e sem sobrescrever');

{
  Store.apagar();
  /* A pessoa ja tem duas musicas. */
  Store.db.cifras = [
    Store.normCifra({ titulo: 'Já Era', artista: 'Alguem', bpm: 100 }),
    Store.normCifra({ titulo: 'Só Aqui', artista: 'Alguem', bpm: 90 }),
  ];
  const jaEra = Store.db.cifras[0].id;
  const antesJson = JSON.stringify(Store.db.cifras[0]);

  const r = Store.importar(backup, 'mesclar');
  igual(r.cifras, 10, 'o arquivo entrou inteiro');

  /* 2 antigas + 10 do arquivo MENOS a duplicata legitima que o mesclar
     descarta por ter mesmo titulo e mesmo artista. E um comportamento real,
     medido: o app aceita as duas na biblioteca e o mesclar guarda uma. */
  igual(Store.db.cifras.length, 12, 'as duas antigas continuam, e as 10 entraram');
  igual(JSON.stringify(porId(jaEra)), antesJson, 'a musica que ja estava nao foi mexida');
  ok(!!porId(base[0].id), 'e a do arquivo entrou');
  igual(Store.db.cifras.filter((c) => c.id === base[0].id).length, 1,
    'sem repetir a mesma cifra duas vezes');

  /* Mesclar de novo o MESMO arquivo não pode acrescentar nada. */
  Store.importar(backup, 'mesclar');
  igual(Store.db.cifras.length, 12, 'mesclar duas vezes o mesmo arquivo nao duplica');
}

/* ------------------------------------------------------------
   7. MÚSICAS HOMÔNIMAS: O ID É A IDENTIDADE

   Antes esta seção media o defeito: o mesclar descartava a segunda música por
   ter o mesmo título e artista. A regra agora é que só o `id` decide quem é quem.

   CASO 1 — mesmo id: é o mesmo registro, e não entra de novo.
   CASO 2 — ids diferentes, mesmo título e artista: são dois registros.
   ------------------------------------------------------------------ */

secao('7. música com mesmo título e artista: só o id decide');

{
  Store.apagar();
  Store.db.cifras = [Store.normCifra({ titulo: 'O Amor Não Falha', artista: 'TNT', bpm: 88, tom: 'Am' })];
  Store.importar(backup, 'mesclar');
  igual(Store.db.cifras.length, 11,
    'a homonima de outro aparelho ENTROU: são ids diferentes, e nenhuma foi descartada');
  ok(!!porId(base[0].id), 'e a do arquivo entrou com o id dela');
  ok(!!porId(base[4].id), 'e a homonima do próprio backup também');
  ok(!!Store.db.cifras.some((c) => c.id === base[3].id && c.tom === 'Am'),
    'e continua com o tom dela');
  ok(!!Store.db.cifras.some((c) => c.id === base[4].id && c.tom === 'Dm'),
    'a outra continua com o tom dela, e as duas coexistem');
}

/* CASO 1 pelo outro lado: o MESMO registro duas vezes. */
{
  Store.apagar();
  Store.importar(backup, 'substituir');
  const antes = Store.db.cifras.length;
  Store.importar(backup, 'mesclar');
  igual(Store.db.cifras.length, antes, 'reexportar e mesclar de novo não acrescenta nada');
  Store.importar(backup, 'mesclar');
  igual(Store.db.cifras.length, antes, 'e nem mesclar uma terceira vez');
}

/* ------------------------------------------------------------
   7b. OS DOIS APARELHOS, AS DUAS HOMÔNIMAS, E AS DUAS FOTOS

   Este é o defeito exato da V6.13. Duas músicas com o MESMO título e o MESMO
   artista, ids diferentes, tons diferentes e fotos diferentes — como acontece
   quando alguém toca a mesma peça em duas tonalidades. A biblioteca guarda as
   duas; o mesclar precisa guardar as duas.
   ------------------------------------------------------------ */

secao('7b. dois aparelhos, duas homônimas, duas fotos');

{
  const A = Store.normCifra({ titulo: 'O Amor Não Falha', artista: 'TNT', tom: 'Am', bpm: 88, foto: FOTO });
  const B = Store.normCifra({ titulo: 'O Amor Não Falha', artista: 'TNT', tom: 'Dm', bpm: 96, foto: FOTO_ANOTADA });

  /* Aparelho 1: so a música A. */
  Store.apagar();
  Store.db.cifras = [A];
  Store.importar(JSON.stringify({ escalas: [], cifras: [A] }), 'substituir');
  igual(Store.db.cifras.length, 1, 'aparelho 1 tem uma música');

  /* Aparelho 2 manda o backup dele, que tem a música B. */
  Store.importar(JSON.stringify({ escalas: [], cifras: [B] }), 'mesclar');
  igual(Store.db.cifras.length, 2, 'o mesclar ficou com as DUAS');

  const porTom = {};
  Store.db.cifras.forEach((c) => { porTom[c.tom] = c; });
  ok(!!porTom.Am && porTom.Am.id === A.id, 'a de Am continua com o id de A');
  ok(!!porTom.Dm && porTom.Dm.id === B.id, 'a de Dm entrou com o id de B');
  igual((porTom.Am || {}).foto, FOTO, 'e cada uma ficou com a SUA foto');
  igual((porTom.Dm || {}).foto, FOTO_ANOTADA,
    'inclusive a foto anotada, que nao vazou para a outra');

  /* E o MESMO registro indo e voltando: uma musica so. */
  Store.importar(JSON.stringify({ escalas: [], cifras: [A] }), 'mesclar');
  igual(Store.db.cifras.length, 2, 'reenviar A nao duplicou');
  Store.importar(JSON.stringify({ escalas: [], cifras: [A, B] }), 'mesclar');
  igual(Store.db.cifras.length, 2, 'reenviar as duas tambem nao duplicou');
}

/* ------------------------------------------------------------
   7c. O REPERTÓRIO CONTINUA APONTANDO PARA A MÚSICA DELE

   A referência é por id. Se o mesclar trocasse um id pelo outro, a peça do
   repertório passaria a tocar a música errada — sem erro nenhum na tela.
   ------------------------------------------------------------ */

secao('7c. o repertório continua apontando para a música certa');

{
  const A = Store.normCifra({ titulo: 'Entrada', artista: 'TNT', tom: 'Am' });
  const B = Store.normCifra({ titulo: 'Entrada', artista: 'TNT', tom: 'Dm' });

  Store.apagar();
  Store.db.cifras = [A];
  Store.db.escalas = [Store.normEscala({
    titulo: 'Repertório', data: '2026-04-02', musicas: [{ id: A.id, nome: '', tom: '' }],
  })];

  Store.importar(JSON.stringify({ escalas: [], cifras: [B] }), 'mesclar');

  igual(Store.db.cifras.length, 2, 'as duas musicas estao la');
  igual(Store.db.escalas[0].musicas.length, 1, 'o repertorio tem uma entrada');
  igual(Store.db.escalas[0].musicas[0].id, A.id, 'e ela continua apontando para A');
  ok(!!Store.db.escalas[0].musicas[0].id && Store.db.escalas[0].musicas[0].id !== B.id,
    'e nao foi trocada pela B, que entrou agora');

  /* E a ordem do repertorio nao muda. */
  Store.db.escalas = [Store.normEscala({
    titulo: 'Com ordem', data: '2026-04-02',
    musicas: [B.id, A.id].map((id) => ({ id: id, nome: '', tom: '' })),
  })];
  Store.importar(JSON.stringify({ escalas: [], cifras: [B] }), 'mesclar');
  igual(Store.db.escalas[0].musicas[0].id, B.id, 'a ordem do repertorio foi preservada');
  igual(Store.db.escalas[0].musicas[1].id, A.id, 'inteira, do começo ao fim');
}

/* ------------------------------------------------------------
   7d. ÓRFÃ CONTINUA ÓRFÃ

   A referência que aponta para o nada continua apontando para o nada. O mesclar
   não é, e não deve virar, um conserto automático de referência quebrada.
   ------------------------------------------------------------ */

secao('7d. órfã não é resolvida às escondidas');

{
  Store.apagar();
  Store.importar(JSON.stringify({
    escalas: [{ titulo: 'Com órfã', data: '2026-05-01', musicas: [{ id: 'cif_que_nao_existe', nome: 'X' }] }],
    cifras: [],
  }), 'mesclar');
  igual(Store.db.escalas[0].musicas[0].id, 'cif_que_nao_existe',
    'a referência quebrada continua quebrada, e identificável');
  igual(Store.db.escalas[0].musicas.length, 1, 'e nenhuma entrada foi criada por conta propria');
}

/* ------------------------------------------------------------
   8. SUBSTITUIR TROCA TUDO
   ------------------------------------------------------------ */

secao('8. substituir troca tudo, inclusive o que não veio no arquivo');

{
  Store.apagar();
  Store.db.cifras = [Store.normCifra({ titulo: 'Só no aparelho', bpm: 70 })];
  Store.db.escalas = [Store.normEscala({ titulo: 'Repertório do aparelho', data: '2026-01-01' })];
  Store.importar(backup, 'substituir');
  ok(!Store.db.cifras.some((c) => c.titulo === 'Só no aparelho'),
    'o que estava no aparelho e nao veio no arquivo foi embora');
  ok(!Store.db.escalas.some((e) => e.titulo === 'Repertório do aparelho'),
    'e a escala tambem');
  igual(Store.db.cifras.length, 10, 'so sobrou o que veio no arquivo');
  igual(Store.db.escalas.length, 1, 'e uma escala');
}

/* ------------------------------------------------------------
   9. SUBSTITUIR COM BACKUP VAZIO É INTENÇÃO LEGÍTIMA
   ------------------------------------------------------------ */

secao('9. um backup de quem apagou tudo é aceito');

{
  Store.importar(JSON.stringify({ app: 'Clave', escalas: [], cifras: [] }), 'substituir');
  igual(Store.db.cifras.length, 0, 'substituir por um backup vazio esvazia');
  igual(Store.db.escalas.length, 0, 'e as escalas tambem');
}

/* ------------------------------------------------------------
   10. CORRUPÇÃO
   ------------------------------------------------------------ */

secao('10. arquivo estragado é recusado e o estado fica como estava');

{
  Store.apagar();
  Store.importar(backup, 'substituir');
  const bom = JSON.stringify(semRelogio(Store.db.cifras));
  const boaEscala = JSON.stringify(semRelogio(Store.db.escalas));

  const recusa = (entrada, rotulo) => {
    let erro = null;
    try { Store.importar(entrada, 'substituir'); } catch (e) { erro = e; }
    ok(!!erro, rotulo + ' — foi recusado');
    ok(!!erro && /inválido/i.test(String(erro.message)),
      rotulo + ' — e a mensagem diz que o arquivo é inválido',
      erro ? erro.message : 'nao_recusou');
    igual(JSON.stringify(semRelogio(Store.db.cifras)), bom, rotulo + ' — e as cifras nao mudaram');
    igual(JSON.stringify(semRelogio(Store.db.escalas)), boaEscala, rotulo + ' — nem as escalas');
  };

  recusa('isto nao e json {{{', 'JSON quebrado');
  recusa('', 'texto vazio');
  recusa('[]', 'array vazio');
  recusa('{}', 'objeto vazio');
  recusa('null', 'nulo');
  recusa('"uma string"', 'uma string');
  recusa('42', 'um numero');
  recusa('{"cifras": {}}', 'cifras que nao sao lista');
  recusa('{"escalas": "texto"}', 'escalas que nao sao lista');
  /* `cifras: []` + uma chave a mais NAO e recusa: o store trata chave
     desconhecida como versao futura, por decisao documentada. Aqui estahamos
     medindo essa decisao, nao esperando que ela mude. */
  Store.apagar();
  Store.importar(backup, 'substituir');
  const comChave = Store.db.cifras.length;
  Store.importar(JSON.stringify({ cifras: [], outraCoisa: 1 }), 'substituir');
  igual(Store.db.cifras.length, 0, 'e, como e um backup vazio legitimo, ele esvazia');
  Store.importar(backup, 'substituir');
  igual(Store.db.cifras.length, comChave, 'e um backup bom logo depois volta inteiro');
}

/* ------------------------------------------------------------
   11. NADA É MEIO IMPORTADO
   ------------------------------------------------------------ */

secao('11. o que é recusado não entra pela metade');

{
  Store.apagar();
  Store.importar(backup, 'substituir');
  const antes = Store.db.cifras.length;

  /* Um backup com uma cifra boa e uma estruturalmente quebrada. O que acontece
     com a segunda depende de `migrar`; o que NÃO pode acontecer é a primeira
     ficar salva e a segunda simplesmente sumir, sem aviso. */
  const misto = { escalas: [], cifras: [
    Store.normCifra({ titulo: 'Boa', bpm: 90 }),
    Store.normCifra({ titulo: 'Ruim', bpm: 80, foto: 'javascript:alert(1)' }),
  ] };
  let erro = null;
  try { Store.importar(JSON.stringify(misto), 'substituir'); } catch (e) { erro = e; }

  if (!erro) {
    /* Aceitou: então as DUAS precisam estar la, com a foto perigosa barrada. */
    igual(Store.db.cifras.length, 2, 'as duas cifras entraram — nenhuma foi deixada para trás');
    igual(Store.db.cifras[1].foto, '', 'e a foto que nao e imagem foi barrada na entrada');
  } else {
    igual(Store.db.cifras.length, antes, 'recusou o arquivo inteiro, sem deixar a boa entrar');
  }
  ok(Store.db.cifras.every((c) => !/javascript:/i.test(c.foto || '')),
    'nenhuma foto perigosa sobreviveu');
}

/* ------------------------------------------------------------
   12. ID REPETIDO NO ARQUIVO
   ------------------------------------------------------------ */

secao('12. id repetido dentro do arquivo não vira duas com a mesma chave');

{
  Store.apagar();
  const a = Store.normCifra({ titulo: 'Original', bpm: 90 });
  const b = Store.normCifra({ titulo: 'Copia', bpm: 91 });
  b.id = a.id;                                   /* o arquivo veio com o id repetido */
  Store.importar(JSON.stringify({ escalas: [], cifras: [a, b] }), 'substituir');

  const ids = Store.db.cifras.map((c) => c.id);
  igual(ids.length, new Set(ids).size, 'os ids sao unicos');
  igual(Store.db.cifras.length, 2, 'as duas musicas entraram — nenhuma sumiu');
  ok(Store.db.cifras.some((c) => c.titulo === 'Original'), 'a original ficou com o id');
  ok(Store.db.cifras.some((c) => c.titulo === 'Copia'), 'e a copia ganhou um id dela');
}

/* ------------------------------------------------------------
   13. ID VAZIO
   ------------------------------------------------------------ */

secao('13. registro sem id não entra como `undefined`');

{
  Store.apagar();
  Store.importar(JSON.stringify({ escalas: [], cifras: [{ titulo: 'Sem Id', bpm: 90 }] }), 'substituir');
  igual(Store.db.cifras.length, 1, 'entrou');
  ok(!!Store.db.cifras[0].id, 'e ganhou um id de verdade');
  ok(String(Store.db.cifras[0].id).indexOf('undefined') < 0, 'que nao e a palavra "undefined"');
}

/* ------------------------------------------------------------
   14. CAMPOS DESCONHECIDOS
   ------------------------------------------------------------ */

secao('14. campo que o app não conhece');

{
  Store.apagar();
  Store.importar(JSON.stringify({
    escalas: [], cifras: [{ titulo: 'Com Extra', bpm: 90, campoDoFuturo: 'valor', outro: 1 }],
  }), 'substituir');
  igual(Store.db.cifras.length, 1, 'a música entrou');
  ok(!!Store.db.cifras[0].titulo, 'e tem título');
  igual(Store.db.cifras[0].campoDoFuturo, undefined,
    'o campo desconhecido foi descartado pela normalização (comportamento atual)');
}

/* ------------------------------------------------------------
   15. FOTO DENTRO DE UM REPERTÓRIO ÓRFÃO
   ------------------------------------------------------------ */

secao('15. entrada de repertorio que aponta para o nada');

{
  Store.apagar();
  Store.importar(JSON.stringify({
    escalas: [{ titulo: 'Órfã', data: '2026-05-01', musicas: [{ id: 'cif_nao_existe', nome: 'X' }] }],
    cifras: [],
  }), 'substituir');
  igual(Store.db.escalas.length, 1, 'a escala entrou');
  igual(Store.db.escalas[0].musicas.length, 1, 'com a entrada que aponta para o nada');
  ok(Store.db.escalas[0].musicas[0].id === 'cif_nao_existe',
    'e a referência NAO foi consertada às escondidas — comportamento atual, documentado');
}

/* ------------------------------------------------------------
   16. O ARQUIVO VOLTA A FUNCIONAR DEPOIS DE TUDO ISSO
   ------------------------------------------------------------ */

secao('16. depois de recusar arquivos, um backup bom ainda restaura');

{
  Store.apagar();
  Store.importar(backup, 'substituir');
  igual(Store.db.cifras.length, 10, 'as 10 voltaram');
  ok(!!porId(base[3].id) && porId(base[3].id).foto === FOTO_ANOTADA, 'com a foto anotada');
  igual(Store.db.escalas[0].musicas.length, 8, 'e o repertorio com 8');
  ok(titulos().indexOf('Nada Me Falta') >= 0, 'e a busca por título acha');
  ok(titulos().indexOf('Aleluia') >= 0, 'e a outra tambem');
}

console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('');
  falhas.forEach((f) => console.log('  FALHA  ' + f));
}
console.log('=================================================\n');
process.exit(falhou ? 1 : 0);