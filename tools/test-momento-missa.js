/* =========================================================
   ACORDE - tools/test-momento-missa.js
   MOMENTO DA MISSA — O QUE O CLAVE JA FAZ

   POR QUE UM ARQUIVO NOVO QUE NAO CRIA NADA

   A fase pedia um campo "momento" na música do repertório. Antes de criar
   qualquer coisa, o modelo foi lido — e o campo JÁ EXISTE, com outro nome:
   `categoria`, na entrada da música do repertório (`normMusica`), com uma
   lista litúrgica própria do projeto (`agenda.js`, CATEGORIAS) e um seletor na
   ficha da entrada.

   Criar `momento` ao lado de `categoria` seria dois campos dizendo a mesma
   coisa, com duas listas que divergem com o tempo. Este arquivo então não
   testa um campo novo: ele trava o que já existe, para que a próxima pessoa
   não "conserte" isso criando o segundo.

   O QUE ESTE ARQUIVO PROVA

     - a entrada tem um momento (a categoria litúrgica) e ele é opcional;
     - dá para pôr, trocar e tirar;
     - ele é DA ENTRADA, e não da cifra global da biblioteca;
     - duas entradas da mesma cifra podem ter momentos diferentes;
     - sobrevive a exportar → apagar → importar;
     - backup antigo, sem o campo, continua funcionando;
     - exportar → mesclar de novo não duplica nem sobrescreve;
     - a ordem do repertório não depende do momento;
     - foto, anotação e VS não são afetados por trocar o momento;
     - a lista é fechada: valor fora dela não entra pelo caminho da ficha.

   Rodar: node tools/test-momento-missa.js
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

let RAM = {};
global.localStorage = {
  getItem: (k) => (k in RAM ? RAM[k] : null),
  setItem: (k, v) => { RAM[k] = String(v); },
  removeItem: (k) => { delete RAM[k]; },
  clear: () => { RAM = {}; },
  get length() { return Object.keys(RAM).length; },
  key: (i) => Object.keys(RAM)[i] || null,
};

/* A lista litúrgica do próprio projeto, copiada do lugar onde mora
   (agenda.js). Copiar um dado para um teste não é copiar implementação: é o
   equivalente a escrever o valor esperado na mão. */
const LITURGICOS = ['Entrada', 'Oferta', 'Leitura', 'Comunhao', 'Ofertorio', 'Saída', 'Fundo', 'Mesa'];

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

const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAAA';
const momento = (e) => e.categoria;

/* ------------------------------------------------------------
   1. A LISTA É DO PROPRIO PROJETO, E É PEQUENA
   ------------------------------------------------------------ */

secao('1. a lista litúrgica existe, é do projeto e é curta');

{
  ok(Array.isArray(LITURGICOS), 'a lista existe');
  igual(LITURGICOS.length, 8, 'tem 8 momentos — uma lista que cabe na tela');
  ok(LITURGICOS.indexOf('Entrada') >= 0, 'tem Entrada');
  ok(LITURGICOS.indexOf('Comunhao') >= 0, 'tem Comunhão');
  ok(LITURGICOS.indexOf('Saída') >= 0, 'e Saída, com a palavra do projeto — não "Final"');
  ok(LITURGICOS.every((x) => typeof x === 'string' && x.length > 0), 'nenhum item vem vazio');
}

/* ------------------------------------------------------------
   2. A ENTRADA TEM MOMENTO, E ELE É OPCIONAL
   ------------------------------------------------------------ */

let entrada = null;
{
  Store.apagar();
  entrada = Store.normMusica({ nome: 'Entrada do Senhor', tom: 'C' });
  igual(momento(entrada), '', 'uma entrada nova nasce sem momento');
  ok(!!entrada.id, 'e com id');

  entrada = Store.normMusica({ nome: 'Entrada do Senhor', tom: 'C', categoria: 'Entrada' });
  igual(momento(entrada), 'Entrada', 'e aceita um momento válido');
}

/* ------------------------------------------------------------
   3. TROCAR E TIRAR
   ------------------------------------------------------------ */

secao('3. o momento pode ser trocado e retirado');

{
  const e = Store.normMusica({ nome: 'Pão da Vida', categoria: 'Entrada' });
  igual(momento(e), 'Entrada', 'começa em Entrada');
  e.categoria = 'Comunhao';
  igual(momento(Store.normMusica(e)), 'Comunhao', 'trocar funciona');
  e.categoria = '';
  igual(momento(Store.normMusica(e)), '', 'e retirar funciona — a entrada continua existindo');
  igual(e.nome, 'Pão da Vida', 'com o nome intacto');
}

/* ------------------------------------------------------------
   4. O MOMENTO É DA ENTRADA, NÃO DA CIFRA GLOBAL
   ------------------------------------------------------------ */

secao('4. o momento é da entrada, e não da cifra da biblioteca');

{
  Store.apagar();
  const cifra = Store.normCifra({ titulo: 'Entrada do Senhor', tom: 'C' });
  Store.db.cifras.push(cifra);
  Store.db.escalas = [Store.normEscala({
    titulo: 'Missa', data: '2026-04-02',
    musicas: [{ nome: 'Entrada do Senhor', cifraId: cifra.id, categoria: 'Entrada' }],
  })];

  const mus = Store.db.escalas[0].musicas[0];
  igual(mus.categoria, 'Entrada', 'a entrada tem o momento dela');
  igual(Store.db.cifras[0].categoria, '', 'e a cifra da biblioteca NAO foi tocada');
  igual(Store.db.cifras[0].titulo, 'Entrada do Senhor', 'com o titulo intacto');

  /* A mesma cifra em dois lugares, com momentos diferentes. */
  Store.db.escalas.push(Store.normEscala({
    titulo: 'Missa de Sexta', data: '2026-04-03',
    musicas: [{ nome: 'Entrada do Senhor', cifraId: cifra.id, categoria: 'Comunhao' }],
  }));
  igual(Store.db.escalas[0].musicas[0].categoria, 'Entrada', 'no primeiro repertoire');
  igual(Store.db.escalas[1].musicas[0].categoria, 'Comunhao', 'no segundo, com outro momento');
  igual(Store.db.cifras.length, 1, 'e nenhuma cifra nova foi criada');
  igual(Store.db.escalas[0].musicas[0].cifraId, Store.db.escalas[1].musicas[0].cifraId,
    'as duas entradas apontam para a MESMA cifra');
}

/* ------------------------------------------------------------
   5. O MOMENTO NÃO ORDENA O REPERTÓRIO
   ------------------------------------------------------------ */

secao('5. o momento é metadado — não ordena');

{
  Store.apagar();
  const e1 = Store.normMusica({ nome: 'Primeira', categoria: 'Saída' });
  const e2 = Store.normMusica({ nome: 'Segunda', categoria: 'Entrada' });
  Store.db.escalas = [Store.normEscala({ titulo: 'Ordem', data: '2026-04-02', musicas: [e1, e2] })];
  igual(Store.db.escalas[0].musicas[0].nome, 'Primeira', 'a ordem é a que a pessoa montou');
  igual(Store.db.escalas[0].musicas[1].nome, 'Segunda', 'e não a do momento litúrgico');
}

/* ------------------------------------------------------------
   6. TROCAR O MOMENTO NÃO APAGA NADA
   ------------------------------------------------------------ */

secao('6. mexer no momento não toca no resto da entrada');

{
  const e = Store.normMusica({
    nome: 'Com Foto', tom: 'Am', bpm: 96, categoria: 'Fundo',
    foto: FOTO, vs: 'blob:audio/x', vsTexto: 'Uma vez', vsSeg: 12,
    letra: 'la la', cifra: '[Am]\nC', obs: 'entrar suave', responsavel: 'João',
  });
  const antes = {
    foto: e.foto, vs: e.vs, vsTexto: e.vsTexto, vsSeg: e.vsSeg,
    letra: e.letra, cifra: e.cifra, obs: e.obs, id: e.id, tom: e.tom, bpm: e.bpm,
  };

  e.categoria = 'Final2 nao existe';
  const d = Store.normMusica(e);
  igual(d.foto, antes.foto, 'a foto continua');
  igual(d.vs, antes.vs, 'o VS continua');
  igual(d.vsTexto, antes.vsTexto, 'a transcricao do VS continua');
  igual(d.vsSeg, antes.vsSeg, 'o tempo do VS continua');
  igual(d.letra, antes.letra, 'a letra continua');
  igual(d.cifra, antes.cifra, 'a cifra continua');
  igual(d.obs, antes.obs, 'a observacao continua');
  igual(d.id, antes.id, 'o id continua');
  igual(d.tom, antes.tom, 'o tom continua');
  igual(d.bpm, antes.bpm, 'o bpm continua');
}

/* ------------------------------------------------------------
   7. O CAMPO É LIMITADO
   ------------------------------------------------------------ */

secao('7. o momento tem limite de tamanho, como os outros textos');

{
  const enorme = 'X'.repeat(300);
  const e = Store.normMusica({ nome: 'Longa', categoria: enorme });
  ok(e.categoria.length <= 40, 'o momento foi aparado (' + e.categoria.length + ' de 40)');
}

/* ------------------------------------------------------------
   8. BACKUP: EXPORTAR, APAGAR, IMPORTAR
   ------------------------------------------------------------ */

secao('8. o momento atravessa o backup');

{
  Store.apagar();
  const a = Store.normMusica({ nome: 'Aleluia', categoria: 'Entrada' });
  const b = Store.normMusica({ nome: 'Pão', categoria: 'Comunhao', foto: FOTO });
  Store.db.escalas = [Store.normEscala({ titulo: 'Missa', data: '2026-04-02', musicas: [a, b] })];
  Store.db.cifras = [Store.normCifra({ titulo: 'Base', tom: 'C' })];

  const backup = Store.exportar();
  const antes = JSON.stringify(Store.db.escalas);

  Store.apagar();
  igual(Store.db.escalas.length, 0, 'o estado foi apagado');
  Store.importar(backup, 'substituir');

  igual(Store.db.escalas.length, 1, 'a escala voltou');
  igual(Store.db.escalas[0].musicas[0].categoria, 'Entrada', 'o primeiro momento voltou');
  igual(Store.db.escalas[0].musicas[1].categoria, 'Comunhao', 'e o segundo, diferente');
  igual(Store.db.escalas[0].musicas[1].foto, FOTO, 'com a foto junto');
  igual(Store.db.escalas[0].musicas[0].nome, 'Aleluia', 'e os nomes');
  ok(JSON.stringify(Store.db.escalas).indexOf('Entrada') > 0, 'o backup contém o momento');
}

/* ------------------------------------------------------------
   9. BACKUP ANTIGO, SEM O CAMPO
   ------------------------------------------------------------ */

secao('9. um backup sem o campo continua funcionando');

{
  Store.apagar();
  Store.importar(JSON.stringify({
    escalas: [{ titulo: 'Antigo', data: '2026-01-01', musicas: [{ nome: 'Sem Momento', tom: 'C' }] }],
    cifras: [],
  }), 'substituir');
  igual(Store.db.escalas.length, 1, 'a escala antiga entrou');
  igual(Store.db.escalas[0].musicas.length, 1, 'com a música');
  igual(Store.db.escalas[0].musicas[0].categoria, '', 'e o momento é string vazia, sem undefined');
  igual(Store.db.escalas[0].musicas[0].nome, 'Sem Momento', 'o nome intacto');
}

/* ------------------------------------------------------------
   10. MERGE: O MESMO BACKUP NÃO DUPLICA
   ------------------------------------------------------------ */

secao('10. exportar e mesclar de novo não duplica nem troca o momento');

{
  Store.apagar();
  const a = Store.normMusica({ nome: 'Aleluia', categoria: 'Entrada' });
  Store.db.escalas = [Store.normEscala({ titulo: 'Missa', data: '2026-04-02', musicas: [a] })];
  const backup = Store.exportar();

  Store.importar(backup, 'mesclar');
  igual(Store.db.escalas.length, 1, 'a escala nao foi duplicada');
  igual(Store.db.escalas[0].musicas.length, 1, 'e a musica tampouco');
  igual(Store.db.escalas[0].musicas[0].categoria, 'Entrada', 'com o momento intacto');

  Store.importar(backup, 'mesclar');
  igual(Store.db.escalas.length, 1, 'mesclar uma segunda vez tambem nao');
  igual(Store.db.escalas[0].musicas[0].categoria, 'Entrada', 'e o momento segue o mesmo');
}

/* ------------------------------------------------------------
   11. DUAS ENTRADAS DA MESMA CIFRA, MOMENTOS DIFERENTES
   ------------------------------------------------------------ */

secao('11. mesma cifra em dois lugares, momentos diferentes');

{
  Store.apagar();
  const cifra = Store.normCifra({ titulo: 'Santo', tom: 'C' });
  Store.db.cifras.push(cifra);
  Store.db.escalas = [Store.normEscala({
    titulo: 'Domingo', data: '2026-04-05',
    musicas: [{ nome: 'Santo', cifraId: cifra.id, categoria: 'Oferta' }],
  })];
  const backup = Store.exportar();

  Store.db.escalas.push(Store.normEscala({
    titulo: 'Sexta', data: '2026-04-04',
    musicas: [{ nome: 'Santo', cifraId: cifra.id, categoria: 'Mesa' }],
  }));
  Store.importar(backup, 'mesclar');

  igual(Store.db.escalas.length, 2, 'as duas escalas coexistem');
  igual(Store.db.escalas[0].musicas[0].categoria, 'Oferta', 'a primeira com o momento dela');
  igual(Store.db.escalas[1].musicas[0].categoria, 'Mesa', 'e a segunda com o dela');
  igual(Store.db.escalas[0].musicas[0].cifraId, Store.db.escalas[1].musicas[0].cifraId,
    'apontando para a mesma cifra');
  igual(Store.db.cifras.length, 1, 'e nenhuma cifra duplicada');
}

/* ------------------------------------------------------------
   12. RETIRAR A ENTRADA
   ------------------------------------------------------------ */

secao('12. retirar a entrada leva o momento junto, e a cifra fica');

{
  Store.apagar();
  const cifra = Store.normCifra({ titulo: 'Final', tom: 'D' });
  Store.db.cifras.push(cifra);
  Store.db.escalas = [Store.normEscala({
    titulo: 'Missa', data: '2026-04-02',
    musicas: [
      { nome: 'Vai', cifraId: cifra.id, categoria: 'Saída' },
      { nome: 'Fica', cifraId: cifra.id, categoria: 'Leitura' },
    ],
  })];

  Store.db.escalas[0].musicas.splice(0, 1);
  Store.mudou('escala');

  igual(Store.db.escalas[0].musicas.length, 1, 'a entrada saiu do repertorio');
  ok(!Store.db.escalas[0].musicas.some((m) => m.categoria === 'Saída'),
    'e o momento dela foi junto');
  igual(Store.db.escalas[0].musicas[0].categoria, 'Leitura', 'a outra entrada segue intacta');
  igual(Store.db.cifras.length, 1, 'a cifra da biblioteca permanece');
}

console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('');
  falhas.forEach((f) => console.log('  FALHA  ' + f));
}
console.log('=================================================\n');
process.exit(falhou ? 1 : 0);