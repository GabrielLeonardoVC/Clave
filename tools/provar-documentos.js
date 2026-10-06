/* =========================================================
   ACORDE - tools/provar-documentos.js
   O contrato do documento e lembrado por algum teste.

   Sabota `js/core/store.js` e exige que a suite acuse cada uma. A mutacao
   entra no arquivo, e o arquivo volta dos bytes guardados em memoria,
   verificado byte a byte. Nao usa `git checkout`.

   MUTACOES QUE FICARAM DE FORA, E POR QUE

     - "perder o documento no reload": o reload le o armazenamento e passa
       pelo mesmo `normCifra` que estas mutacoes ja sabotam. Nao existe uma
       segunda linha de codigo entre gravar e ler.
     - "duplicar o documento ao abrir em dois repertorios": o documento mora
       na cifra, e nao na entrada do repertorio. A secao 12 prova que o arquivo
       aparece uma vez no backup com duas entradas apontando para a mesma
       musica — e nao ha linha que multiplique, porque nada e copiado.

   Rodar: node tools/provar-documentos.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ } = require('./arquivos.js');

const ALVO = 'js/core/store.js';
const SUITE = 'tools/test-documentos.js';

const ALVO_DOCS_OK = String.raw`const DOCS_OK = /^data:(application\/pdf|text\/plain);base64,/i;`;
const DOCS_OK_SABOTADO = String.raw`const DOCS_OK = /^data:(text\/html|image\/svg\+xml);base64,/i;`;

const MUTACOES = [
  {
    id: 'M1', nome: 'o documento não é guardado',
    de: /doc: normDoc\(c\.doc\),/,
    para: "doc: null, /* SABOTAGEM M1: nunca guarda */",
    espera: 'o documento foi guardado',
  },
  {
    id: 'M2', nome: 'HTML e SVG passam a entrar',
    de: ALVO_DOCS_OK,
    /* As familias perigosas entram NO LUGAR das duas permitidas, e o grupo
       capturado continua existindo. Sem o grupo, a mutacao quebraria em
       `DOCS_OK.exec(dados)[1]` e provaria outra coisa. */
    para: DOCS_OK_SABOTADO + ' /* SABOTAGEM M2 */',
    espera: 'executaria script na origem do app',
  },
  {
    id: 'M3', nome: 'o limite some',
    de: /if \(dados\.length > DOC_MAX\) return null;/,
    para: '/* SABOTAGEM M3: sem limite */',
    espera: 'é recusado por inteiro',
  },
  {
    id: 'M4', nome: 'o limite corta em vez de recusar',
    de: /if \(dados\.length > DOC_MAX\) return null;/,
    para: 'if (dados.length > DOC_MAX) return { nome: String(v.nome || \'\'), tipo: \'text/plain\', dados: dados.slice(0, 100) }; /* SABOTAGEM M4: corta */',
    espera: 'é recusado por inteiro',
  },
  {
    id: 'M5', nome: 'o limite do nome some',
    /* O alvo original era o limpador de caracteres, e ele e instavel para
       automacao: a classe contem caracteres de CONTROLE de verdade, que
       nenhum literal reproduz sem mentir. Em vez de insistir num alvo
       que so funciona as vezes, esta mutacao mede o OUTRO limite da mesma
       linha — quantos caracteres do nome sobrevivem. */
    /* O alvo precisa ser UNICO. `.slice(0, 120)` aparece em mais de um
       lugar do Store, e o alvo solto mutava a linha errada — a suite
       seguia verde medindo outro campo. Ancorar no `String(v.nome` deixa
       o alvo com uma ocorrencia so. */
    de: /String\(v\.nome \|\| 'documento'\)\.replace\([^)]*\)\.slice\(0, 120\)/,
    /* A expressao inteira continua de pe de proposito: a `para` abaixo
       substitui a expressao INTEIRA, e nao um pedaco dela. */
    para: "String(v.nome || 'documento').slice(0, 12000) /* SABOTAGEM M5 */",
    espera: 'um nome enorme e aparado',
  },
  {
    id: 'M6', nome: 'o tipo passa a vir do que o arquivo alegou',
    de: /tipo: DOCS_OK\.exec\(dados\)\[1\]\.toLowerCase\(\),/,
    para: 'tipo: String(v.tipo || \'text/plain\'), /* SABOTAGEM M6: confia no arquivo */',
    espera: 'e o tipo',
  },
  {
    id: 'M7', nome: 'a conferencia do prefixo some',
    /* Duas tentativas anteriores foram INERTES, e o provador avisou as duas:
       trocar `typeof v.dados === 'string'` nao muda nada, porque
       `DOCS_OK.test(12345)` coage o numero para texto e segue recusando. O
       que separa um documento bom de um corrompido e a conferencia do
       prefixo — e e ela que esta aqui. */
    de: /if \(!DOCS_OK\.test\(dados\)\) return null;/,
    para: '/* SABOTAGEM M7: sem conferir o prefixo */',
    /* Esta mutacao nao produz um rotulo: ela produz um ESTOURO. Sem a
       conferencia, um texto que nao casa com o prefixo chega em
       `DOCS_OK.exec(dados)[1]`, que devolve nulo, e `normDoc` quebra
       dentro do proprio produto. O provador reconhece um estouro em tempo
       de execucao como deteccao — e nao confunde com SyntaxError, que
       seria a mutacao quebrando o arquivo em vez de quebrar o produto. */
    espera: 'qualquer um dos dois: um rotulo, ou um estouro no alvo',
  },
  {
    id: 'M8', nome: 'o documento apaga a foto ao ser salvo',
    de: /doc: normDoc\(c\.doc\),/,
    para: "doc: normDoc(c.doc), foto: '', /* SABOTAGEM M8: apaga a foto */",
    espera: 'a foto continua',
  },
  {
    id: 'M9', nome: 'o documento apaga o YouTube ao ser salvo',
    de: /doc: normDoc\(c\.doc\),/,
    para: "doc: normDoc(c.doc), yt: '', /* SABOTAGEM M9: apaga o YouTube */",
    espera: 'o YouTube continua',
  },
];

let pendente = null;
function restaurar() {
  if (!pendente) return;
  const p = pendente;
  pendente = null;
  try { fs.writeFileSync(p.arqAbs, p.orig); } catch (e) { /* nada a fazer */ }
}
process.on('exit', restaurar);
process.on('SIGINT', function () { restaurar(); process.exit(130); });
process.on('SIGTERM', function () { restaurar(); process.exit(143); });
process.on('uncaughtException', function (e) { restaurar(); throw e; });

function rodarSuite() {
  try {
    const s = execFileSync('node', [SUITE], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 40e6 });
    return { codigo: 0, saida: s };
  } catch (e) {
    return { codigo: e.status === undefined ? 1 : e.status, saida: (e.stdout || '') + (e.stderr || '') };
  }
}

const arqAbs = path.join(RAIZ, ALVO);
console.log('\n=== o provador do documento ===');

const base = rodarSuite();
if (base.codigo !== 0) {
  console.log('  FALHA  a suite nao passa ANTES de qualquer mutacao');
  base.saida.split('\n').filter((l) => /FALHA|Error/.test(l)).slice(0, 8)
    .forEach((l) => console.log('        ' + l.trim().slice(0, 92)));
  console.log('=================================================\n');
  process.exit(1);
}
console.log('  ok    a suite passa sem nenhuma mutacao');

let provadas = 0;
let invalidas = 0;
for (const m of MUTACOES) {
  const orig = fs.readFileSync(arqAbs);
  const txt = orig.toString('utf8');
  /* O alvo pode ser um literal OU um texto simples: o mesmo `test` nao
     serve para os dois, e uma barra dentro de uma classe de caractere
     torna o literal inutil aqui. */
  const achou = m.de instanceof RegExp ? m.de.test(txt) : txt.indexOf(m.de) >= 0;
  if (!achou) {
    console.log('  ??    ' + m.id + '  alvo nao encontrado — mutacao invalida');
    invalidas++;
    continue;
  }
  const trocado = m.de instanceof RegExp
    ? txt.replace(m.de, m.para)
    : txt.replace(m.de, m.para);
  if (trocado === txt) {
    console.log('  ??    ' + m.id + '  o replace nao mudou nada — mutacao invalida');
    invalidas++;
    continue;
  }
  pendente = { arqAbs: arqAbs, orig: orig };
  fs.writeFileSync(arqAbs, trocado);
  if (fs.readFileSync(arqAbs, 'utf8').indexOf('SABOTAGEM ' + m.id) < 0) {
    console.log('  ??    ' + m.id + '  a marcacao nao esta no arquivo — nao aplicada de verdade');
    restaurar();
    invalidas++;
    continue;
  }
  const r = rodarSuite();
  restaurar();
  if (!fs.readFileSync(arqAbs).equals(orig)) {
    console.log('  FALHA  ' + m.id + '  o arquivo NAO voltou ao estado original');
    invalidas++;
    continue;
  }
  /* O marcador e um TRECHO do rotulo, nao o rotulo inteiro. Por isso o
     casamento exige uma linha de FALHA que CONTE o marcador — e nao a
     string "FALHA  " seguida do marcador, que so acharia quando o
     marcador comeca o rotulo. Era esse o defeito que escondia tres
     mutacoes: o comportamento quebrava, e o provador dizia que nao. */
  /* DOIS jeitos legitimos de a suite dizer "isto quebrou".
     *
     * 1. Uma assercao falha, e o rotulo dela contem o marcador.
     * 2. A MUTACAO PRODUZ UM ESTOURO EM TEMPO DE EXECUCAO no codigo que ela
     *    sabota. A M7 e o caso: tirando a conferencia do prefixo, o `exec`
     *    recebe um texto que nao casa e devolve nulo — e `normDoc` quebra
     *    dentro do proprio produto. Isso E o defeito aparecendo; e uma
     *    deteccao mais forte que uma assercao, nao mais fraca.
     *
     * O que NAO conta: SyntaxError. Uma mutacao que quebra a sintaxe nao
     * prova comportamento nenhum — o arquivo nem chega a rodar. Por isso a
     * distincao e explicita, e nao "qualquer erro conta". */
  const estourouEmTempoDeExecucao = r.codigo !== 0
    && r.saida.indexOf('SyntaxError') < 0
    && /\n\s*at [^\n]*store\.js/i.test(r.saida);
  const acusou = r.codigo !== 0 && (estourouEmTempoDeExecucao
    || r.saida.split(String.fromCharCode(10)).some(function (l) {
      return /^\s*FALHA\s/.test(l) && l.indexOf(m.espera) >= 0;
    }));
  if (acusou) {
    console.log('  ok    ' + m.id + '  ' + m.nome.padEnd(50) + ' -> "' + m.espera + '"');
    provadas++;
  } else {
    console.log('  FALHA  ' + m.id + '  ' + m.nome.padEnd(50) + ' -> nao observavel (exit ' + r.codigo + ')');
    r.saida.split('\n').filter((l) => /FALHA/.test(l)).slice(0, 2)
      .forEach((l) => console.log('          a suite acusou: ' + l.trim().slice(0, 70)));
    invalidas++;
  }
}
console.log('');
console.log('  ' + provadas + '/' + MUTACOES.length + ' mutacoes observaveis'
  + (invalidas ? ', ' + invalidas + ' problema(s)' : ''));
console.log('=================================================\n');
process.exit(provadas === MUTACOES.length ? 0 : 1);