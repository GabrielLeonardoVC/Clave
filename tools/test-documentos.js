/* =========================================================
   ACORDE - tools/test-documentos.js
   O DOCUMENTO DA MÚSICA

   POR QUE UM ARQUIVO NOVO

   A foto da cifra foi validada na V6.9 com um PNG real. O documento é a mesma
   ideia com outro material: um arquivo que a pessoa anexa à música e que
   precisa sobreviver a fechar, recarregar, exportar e importar.

   O QUE ESTE ARQUIVO PROVA

     - música sem documento é válida, e continua válida;
     - um PDF REAL e um TXT REAL são aceitos, com nome e tipo preservados;
     - o tipo vem do PREFIXO DOS DADOS, nunca da extensão nem do que o
       arquivo alegou;
     - HTML, SVG, javascript: e data URL de outra família são recusados;
     - acima do limite é recusado, e não truncado;
     - documento malformado não derruba o resto da música;
     - o documento convive com foto, foto anotada e VS, sem trocar nenhum;
     - sobrevive a exportar → apagar → importar, e ao mesclar;
     - a mesma música em dois repertórios NÃO duplica o arquivo;
     - remover o documento não apaga nada do resto.

   O QUE NÃO PROVA

     - a pixel do PDF aberto na tela: abrir é o navegador, e o caminho de
       entrega (`entregarArquivo`) já foi validado na V6.12.

   Rodar: node tools/test-documentos.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
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
   OS ARQUIVOS REAIS
   ------------------------------------------------------------ */

const FIX = path.join(RAIZ, 'fixtures');
['partitura-teste.pdf', 'outro-material.pdf', 'letra-teste.txt'].forEach((n) => {
  if (!fs.existsSync(path.join(FIX, n))) {
    console.error('\n  FALTA O FIXTURE ' + n + ' — rode: node tools/gerar-fixtures.js\n');
    process.exit(1);
  }
});

/* Um PDF de verdade vai para o modelo como data URL — é assim que o navegador
   entrega um arquivo lido por `readFile`. */
function comoDataURL(nome) {
  const buf = fs.readFileSync(path.join(FIX, nome));
  const mime = nome.slice(-4) === '.pdf' ? 'application/pdf' : 'text/plain';
  return {
    nome: nome,
    bytes: buf.length,
    dados: 'data:' + mime + ';base64,' + buf.toString('base64'),
    tipoReal: mime,
  };
}

const PDF = comoDataURL('partitura-teste.pdf');
const PDF2 = comoDataURL('outro-material.pdf');
const TXT = comoDataURL('letra-teste.txt');
const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAAA';
const FOTO_ANOTADA = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAAGQAAAQABAAD/3BOWklm';

const comDoc = (extra, doc) => Store.normCifra(Object.assign({
  titulo: 'Com Documento', bpm: 90, artista: 'Alguem',
}, extra || {}, { doc: doc }));

/* Uma comparacao que ignora os relogios.
   *
   * `criadoEm` e `atualizadoEm` mudam a cada gravacao, e um backup que devolvesse
   * exatamente o mesmo numero seria um relogio parado, nao um backup melhor.
   * O que tem de voltar identico e o resto — inclusive o documento inteiro. */
function semRelogio(v) {
  return JSON.parse(JSON.stringify(v, function (chave, valor) {
    return /^(criadoEm|atualizadoEm|atualizadaEm)$/.test(chave) ? '__t' : valor;
  }));
}

/* ------------------------------------------------------------
   1. MÚSICA SEM DOCUMENTO
   ------------------------------------------------------------ */

secao('1. música sem documento');

{
  const c = Store.normCifra({ titulo: 'Sem Documento', bpm: 90 });
  igual(c.doc, null, 'o campo é null, e não objeto vazio');
  ok(!!c.id, 'e a música continua com id');
  igual(c.titulo, 'Sem Documento', 'e título');
}

/* Uma música que já existia, de uma versão antiga, sem o campo nenhum. */
{
  const c = Store.normCifra({ titulo: 'Antiga' });
  ok(!('doc' in c) || c.doc === null, 'uma música antiga sem o campo continua válida');
}

/* ------------------------------------------------------------
   2. PDF REAL
   ------------------------------------------------------------ */

secao('2. um PDF real é aceito');

let cPdf = null;
{
  ok(PDF.dados.slice(0, 28) === 'data:application/pdf;base64,', 'o fixture e mesmo um PDF');
  ok(PDF.bytes > 400, 'e tem tamanho de arquivo de verdade (' + PDF.bytes + ' B)');

  cPdf = comDoc({}, { nome: PDF.nome, dados: PDF.dados });
  ok(!!cPdf.doc, 'o documento foi guardado');
  igual(cPdf.doc && cPdf.doc.nome, PDF.nome, 'o nome foi preservado');
  igual(cPdf.doc && cPdf.doc.tipo, 'application/pdf', 'e o tipo');
  igual(cPdf.doc && cPdf.doc.dados, PDF.dados, 'e os dados inteiros');
}

/* ------------------------------------------------------------
   3. TXT REAL
   ------------------------------------------------------------ */

secao('3. um TXT real é aceito');

{
  const c = comDoc({}, { nome: TXT.nome, dados: TXT.dados });
  ok(!!c.doc, 'o texto foi guardado');
  igual(c.doc && c.doc.tipo, 'text/plain', 'com o tipo certo');
  igual(c.doc && c.doc.nome, TXT.nome, 'e o nome');
  const decodificado = c.doc && c.doc.dados
    ? Buffer.from(c.doc.dados.split(',')[1], 'base64').toString('utf8') : '';
  ok(decodificado === fs.readFileSync(path.join(FIX, TXT.nome), 'utf8'),
    'e o conteudo do arquivo, byte a byte — nao um placeholder');
}

/* ------------------------------------------------------------
   4. O TIPO VEM DOS DADOS, NÃO DA EXTENSÃO
   ------------------------------------------------------------ */

secao('4. o tipo vem do prefixo dos dados');

{
  /* Um arquivo chamado "musica.pdf" que chega como texto. O app trata pelo
     que ACEitou, e o nome fica como a pessoa escreveu. */
  const c = comDoc({}, { nome: 'musica.pdf', dados: TXT.dados });
  igual(c.doc && c.doc.tipo, 'text/plain', 'o nome diz PDF, o conteudo e texto: vale o conteudo');
  igual(c.doc && c.doc.nome, 'musica.pdf', 'e o nome da pessoa e preservado assim mesmo');
}

/* ------------------------------------------------------------
   5. O QUE É RECUSADO
   ------------------------------------------------------------ */

secao('5. o que não entra');

const recusa = (dados, rotulo, nome) => {
  const c = comDoc({}, { nome: nome || 'qualquer', dados: dados });
  igual(c.doc, null, rotulo + ' — recusado');
};

{
  recusa('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'HTML, que executaria script na origem do app');
  recusa('data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pjwvc2NyaXB0Pjwvc3ZnPg==',
    'SVG, que é um documento com script dentro');
  recusa('javascript:alert(1)', 'um javascript:');
  recusa('https://exemplo.com/x.pdf', 'um http:', 'x.pdf');
  recusa('data:application/octet-stream;base64,AAAA', 'um tipo que o app não conhece');
  recusa('data:application/pdf,semBase64', 'PDF sem base64');
  recusa('', 'uma string vazia');
  recusa('nao-e-data-url', 'lixo');
  igual(comDoc({}, { nome: 'x', dados: null }).doc, null, 'e dados nulos');
  igual(comDoc({}, 'nao-e-objeto').doc, null, 'e um doc que nem é objeto');
}

/* ------------------------------------------------------------
   6. O LIMITE
   ------------------------------------------------------------ */

secao('6. acima do limite é recusado, não cortado');

{
  const enorme = 'data:application/pdf;base64,' + 'A'.repeat(1300000);
  igual(comDoc({}, { nome: 'grande.pdf', dados: enorme }).doc, null,
    '1,3 MB de data URL é recusado por inteiro');

  const dentro = 'data:application/pdf;base64,' + 'A'.repeat(500000);
  ok(!!comDoc({}, { nome: 'medio.pdf', dados: dentro }).doc,
    'meio MB ainda entra');
}

/* ------------------------------------------------------------
   7. NOME ESTRANHO
   ------------------------------------------------------------ */

secao('7. o nome é limpo, não é caminho');

{
  const c = comDoc({}, { nome: '../../etc/passwd', dados: PDF.dados });
  ok(c.doc && c.doc.nome.indexOf('/') < 0 && c.doc.nome.indexOf('\\') < 0,
    'as barras do caminho foram trocadas (' + (c.doc ? c.doc.nome : '?') + ')');
  ok(c.doc && c.doc.nome.length <= 120, 'e o nome tem limite');
  const c2 = comDoc({}, { nome: 'x'.repeat(400), dados: PDF.dados });
  ok(c2.doc && c2.doc.nome.length <= 120, 'um nome enorme e aparado');
  /* Um nome de 20.000 caracteres nao cabe em NENHUM dos limites: nem no de
     120, nem no de 12.000 que um defeito poderia trocar. Por isso e este o
     que separa a regra certa da regra quebrada. */
  const c3 = comDoc({}, { nome: 'MuitoLongoDemais'.repeat(1500), dados: PDF.dados });
  ok(c3.doc && c3.doc.nome.length <= 120, 'e um nome de 20 mil caracteres tambem e aparado ('
    + (c3.doc ? c3.doc.nome.length : 'sem doc') + ')');
}

/* ------------------------------------------------------------
   8. CONVIVÊNCIA
   ------------------------------------------------------------ */

/* O VS e a gravacao ao vivo. Ele NAO vive na cifra da biblioteca — vive na
   musica do REPERTORIO, que e outro registro. Documento e VS nunca dividem o
   mesmo objeto, e esta suite diz isso em vez de fabricar uma convivencia. */
secao('8. o documento convive com foto e foto anotada');

{
  const c = comDoc({
    foto: FOTO, letra: 'la la', cifra: '[C]\nG', yt: 'https://youtu.be/abc',
  }, { nome: PDF.nome, dados: PDF.dados });

  igual(c.foto, FOTO, 'a foto continua');
  igual(c.yt, 'https://youtu.be/abc', 'o YouTube continua');
  igual(c.letra, 'la la', 'a letra continua');
  igual(c.cifra, '[C]\nG', 'a cifra continua');
  ok(!!c.doc, 'e o documento está junto');

  /* E com a foto anotada, que é o mesmo campo com o desenho dentro. */
  const c2 = comDoc({ foto: FOTO_ANOTADA }, { nome: PDF.nome, dados: PDF.dados });
  igual(c2.foto, FOTO_ANOTADA, 'a foto anotada continua');
  ok(!!c2.doc, 'e o documento continua ao lado dela');
}

/* ------------------------------------------------------------
   9. REMOVER O DOCUMENTO
   ------------------------------------------------------------ */

secao('9. remover o documento não apaga nada');

{
  const c = comDoc({ foto: FOTO, yt: 'https://youtu.be/zzz' }, { nome: PDF.nome, dados: PDF.dados });
  c.doc = null;
  const d = Store.normCifra(c);
  igual(d.doc, null, 'o documento foi');
  igual(d.foto, FOTO, 'a foto ficou');
  igual(d.yt, 'https://youtu.be/zzz', 'e o YouTube tambem');
  ok(!!d.id && d.id === c.id, 'e o id ficou');
  igual(d.titulo, c.titulo, 'e o título');
}

/* ------------------------------------------------------------
   10. TROCAR O DOCUMENTO
   ------------------------------------------------------------ */

secao('10. trocar o documento');

{
  const c = comDoc({}, { nome: PDF.nome, dados: PDF.dados });
  c.doc = { nome: PDF2.nome, dados: PDF2.dados };
  const d = Store.normCifra(c);
  igual(d.doc.nome, PDF2.nome, 'o novo ficou no lugar do antigo');
  igual(d.doc.dados, PDF2.dados, 'com os dados novos');
}

/* ------------------------------------------------------------
   11. MÚSICAS INDEPENDENTES
   ------------------------------------------------------------ */

secao('11. duas músicas guardam documentos separados');

{
  const a = comDoc({ titulo: 'A' }, { nome: PDF.nome, dados: PDF.dados });
  const b = comDoc({ titulo: 'B' }, { nome: PDF2.nome, dados: PDF2.dados });
  Store.db.cifras = [a, b];
  ok(!!(a.doc && b.doc) && a.doc.dados !== b.doc.dados, 'os dados sao diferentes');
  igual(Store.db.cifras[0].doc && Store.db.cifras[0].doc.nome, PDF.nome, 'A ficou com o dela');
  igual(Store.db.cifras[1].doc && Store.db.cifras[1].doc.nome, PDF2.nome, 'e B com o dele');
}

/* ------------------------------------------------------------
   12. A MESMA MÚSICA EM DOIS REPERTÓRIOS NÃO DUPLICA O ARQUIVO
   ------------------------------------------------------------ */

secao('12. a mesma música em dois repertórios');

{
  Store.db.cifras = [cPdf];
  Store.db.escalas = [
    Store.normEscala({ titulo: 'Domingo', data: '2026-04-05', musicas: [{ id: cPdf.id, nome: '', categoria: 'Entrada' }] }),
    Store.normEscala({ titulo: 'Sexta', data: '2026-04-04', musicas: [{ id: cPdf.id, nome: '', categoria: 'Comunhao' }] }),
  ];
  const backup = Store.exportar();
  igual(backup.match(/data:application\/pdf/g).length, 1,
    'o arquivo aparece UMA vez no backup, apesar das duas entradas apontarem para ela');
}

/* ------------------------------------------------------------
   13. BACKUP: EXPORTAR, APAGAR, IMPORTAR
   ------------------------------------------------------------ */

secao('13. o documento atravessa o backup');

{
  const antes = JSON.stringify(semRelogio(Store.db.cifras));
  const backup = Store.exportar();

  Store.apagar();
  igual(Store.db.cifras.length, 0, 'o estado foi apagado');
  Store.importar(backup, 'substituir');

  igual(JSON.stringify(semRelogio(Store.db.cifras)), antes, 'as musicas voltaram inteiras');
  igual(Store.db.cifras[0].doc && Store.db.cifras[0].doc.nome, PDF.nome, 'com o nome do documento');
  igual(Store.db.cifras[0].doc && Store.db.cifras[0].doc.tipo, 'application/pdf', 'e o tipo');
  igual(Store.db.cifras[0].doc && Store.db.cifras[0].doc.dados, PDF.dados, 'e os dados');
}

/* ------------------------------------------------------------
   14. MERGE
   ------------------------------------------------------------ */

secao('14. mesclar não troca o documento de ninguém');

{
  Store.apagar();
  const a = comDoc({ titulo: 'A' }, { nome: PDF.nome, dados: PDF.dados });
  Store.db.cifras = [a];
  const backupA = Store.exportar();

  /* Aparelho 2, com o MESMO título e artista, e outro documento. */
  const b = comDoc({ titulo: 'A' }, { nome: PDF2.nome, dados: PDF2.dados });
  Store.importar(JSON.stringify({ escalas: [], cifras: [b] }), 'mesclar');

  igual(Store.db.cifras.length, 2, 'as duas músicas entraram (ids diferentes)');
  const dA = Store.db.cifras.filter((c) => c.doc.nome === PDF.nome);
  const dB = Store.db.cifras.filter((c) => c.doc.nome === PDF2.nome);
  igual(dA.length, 1, 'o documento de A ficou com A');
  igual(dB.length, 1, 'e o de B ficou com B');
  ok(dA[0] && dB[0] && dA[0].id !== dB[0].id, 'em ids distintos');

  /* O mesmo registro de novo: não duplica nem troca. */
  Store.importar(backupA, 'mesclar');
  igual(Store.db.cifras.length, 2, 'reenviar A não duplicou');
  igual(Store.db.cifras.filter((c) => c.doc && c.doc.nome === PDF2.nome).length, 1,
    'e o documento de B nao foi sobrescrito');
}

/* ------------------------------------------------------------
   15. DADOS CORROMPIDOS NÃO DERRUBAM A MÚSICA
   ------------------------------------------------------------ */

secao('15. documento corrompido não derruba o resto');

{
  /* É o que acontece quando o armazenamento foi mexido de fora, ou quando uma
     versão futura gravou um formato que esta não conhece. */
  const sujo = { titulo: 'Suja', bpm: 88, letra: 'la la', foto: FOTO };
  const c = Store.normCifra(sujo);
  ok(!!c.id && c.titulo === 'Suja', 'a música entrou inteira');
  igual(c.doc, null, 'e o documento, que nem existia, é null');

  const comLixo = Store.normCifra({ titulo: 'Com Lixo', doc: { nome: 'x', dados: 12345 } });
  igual(comLixo.doc, null, 'dados que não são texto viram null');
  ok(!!comLixo.titulo, 'e a música continua');

  const lista = Store.normCifra({ titulo: 'Lista', doc: ['a', 'b'] });
  igual(lista.doc, null, 'uma lista no lugar do documento é recusada');
}

/* ------------------------------------------------------------
   16. SEM REPERTÓRIO: A MÚSICA SEGUE SENDO UMA SÓ
   ------------------------------------------------------------ */

secao('16. o documento não multiplica a música');

{
  Store.apagar();
  const c = comDoc({}, { nome: PDF.nome, dados: PDF.dados });
  Store.db.cifras = [c];
  Store.db.escalas = [
    Store.normEscala({ titulo: 'Um', data: '2026-01-01', musicas: [{ id: c.id, nome: '' }] }),
    Store.normEscala({ titulo: 'Dois', data: '2026-01-02', musicas: [{ id: c.id, nome: '' }] }),
  ];
  igual(Store.db.cifras.length, 1, 'a musica e uma, e continua uma');
  igual(Store.db.escalas.length, 2, 'os dois repertórios apontam para ela');
  ok(!!Store.db.cifras[0].doc, 'e o documento esta nela, uma vez so');
}

console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('');
  falhas.forEach((f) => console.log('  FALHA  ' + f));
}
console.log('=================================================\n');
process.exit(falhou ? 1 : 0);