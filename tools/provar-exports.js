/* =========================================================
   tools/provar-exports.js
   Prova que o `check-exports` pega o que ele diz pegar.

   Este arquivo existe por causa de um defeito REAL deste projeto. O `timbre.js`
   exportava `parcialesPorVoz: parcialesPorVoz,` — a chave com "c" no lugar do
   "i". O valor exportado era `undefined`, e nenhuma das dezenas de verificacoes
   do projeto reclamou: sintaxe correta, grafia correta, ASCII correto.

   Um verificador que nunca falha e um verificador que e ignorado. Por isso cada
   regra aqui e testada nos dois sentidos: os defeitos tem de ser acusados, e
   os aliases legítimos nao podem ser.

   UMA ARMADILHA QUE JA CUSTOU TEMPO NESTE ARQUIVO

   As duas grafias sao quase iguais. Digitar a mutacao "na mao" produz
   facilmente uma string que difere da original no lugar errado — e o provador
   acusa "o verificador passou" quando, na verdade, so nao achou o trecho. Por
   isso os nomes sao montados por pedacos e conferidos contra o arquivo antes de
   qualquer mutacao.
   ========================================================= */
'use strict';

const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ALVO = path.join(RAIZ, 'js', 'core', 'timbre.js');
const VERIF = path.join(__dirname, 'check-exports.js');

/* Montado por pedacos de proposito. Ver abaixo a confericao. */
/* parciais = p-a-r-c-i-a-i-s. Sao DOIS "i", e nao um: o trecho e "ia" + "is".
 * Digitar isso "a mao" e errar um "i" e o erro exato que este arquivo existe
 * para detectar — por isso a montagem e por pedacos e a conferencia abaixo. */
const NOME_CERTO = 'parc' + 'ia' + 'is' + 'PorVoz';
const NOME_ERRADO = 'parc' + 'i' + 'ales' + 'PorVoz';

const original = fs.readFileSync(ALVO, 'utf8');

console.log('\n=== as duas grafias ===');
console.log('  a certa : ' + NOME_CERTO + '  (' + NOME_CERTO.length + ' letras)');
console.log('  a errada: ' + NOME_ERRADO + '  (' + NOME_ERRADO.length + ' letras)');

/* Se o nome "certo" nao for o que esta no arquivo, o resto deste arquivo esta
 * medindo a coisa errada — e foi exatamente assim que a primeira versao
 * passou vergonha. */
const linhaCerta = '    ' + NOME_CERTO + ': ' + NOME_CERTO + ',';
if (original.indexOf(linhaCerta) < 0) {
  console.log('\n  ERRO DESTE ARQUIVO: a linha de exportacao real nao e a esperada.');
  console.log('  Esperado: ' + JSON.stringify(linhaCerta));
  console.log('  O arquivo tem:');
  original.split(/\r?\n/).forEach((l, i) => {
    if (/PorVoz/.test(l)) console.log('    ' + (i + 1) + ': ' + JSON.stringify(l));
  });
  console.log('  Nada abaixo seria valido.');
  process.exit(1);
}
console.log('  a linha de exportacao do arquivo bate com a grafia certa  ok');

const CASOS = [
  {
    nome: 'grafia errada na chave (o defeito real)',
    de: linhaCerta,
    para: '    ' + NOME_ERRADO + ': ' + NOME_CERTO + ',',
  },
  {
    nome: 'letra trocada em outra funcao exportada',
    de: '    espectro: espectro,',
    para: '    espetro: espectro,',
  },
  {
    nome: 'o valor aponta para um nome que nao existe',
    de: '    ids: ids,',
    para: '    ids: idsQueNaoExiste,',
  },
  {
    nome: 'o valor vale undefined (operador virgula)',
    de: '    tocarNo: tocarNo,',
    para: '    tocarNo: (tocarNo, undefined),',
  },
  {
    nome: 'alias legitimo: nome encurtado de proposito',
    de: '    ids: ids,',
    para: '    criar: ids,',
    naoDeveAcusar: true,
  },
  {
    nome: 'alias legitimo: nome totalmente diferente, de proposito',
    de: '    ids: ids,',
    para: '    Todos: ids,',
    naoDeveAcusar: true,
  },
  {
    nome: 'alias legitimo: nome estendido',
    de: '    ids: ids,',
    para: '    listaDeIds: ids,',
    naoDeveAcusar: true,
  },
];

function rodarVerificador() {
  try {
    return execFileSync(process.execPath, [VERIF], { encoding: 'utf8', cwd: RAIZ, timeout: 180000 });
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

console.log('\n=== o verificador de exportacoes ===\n');

let falhas = 0;
for (const c of CASOS) {
  if (original.indexOf(c.de) < 0) {
    console.log('  FALHA ' + c.nome);
    console.log('          nao achei o trecho ' + JSON.stringify(c.de) + ' — o provador esta errado');
    falhas++;
    continue;
  }

  fs.writeFileSync(ALVO, original.replace(c.de, c.para), 'utf8');
  const saida = rodarVerificador();
  fs.writeFileSync(ALVO, original, 'utf8');

  const acusou = /FALHA/.test(saida);
  const passou = !acusou;

  if (c.naoDeveAcusar) {
    console.log((passou ? '  ok    ' : '  FALHA ') + c.nome + '   (nao deve acusar)');
    if (!passou) {
      console.log('          a regra esta rigida demais: acusou um alias legitimo');
      for (const l of saida.split('\n')) if (/FALHA/.test(l)) console.log('          ' + l.trim().slice(0, 100));
      falhas++;
    }
    continue;
  }

  console.log((acusou ? '  ok    ' : '  FALHA ') + c.nome);
  if (!acusou) {
    console.log('          o verificador passou com o defeito');
    falhas++;
  } else {
    for (const l of saida.split('\n')) {
      if (/FALHA/.test(l) && /timbre/.test(l)) { console.log('          ' + l.trim().slice(0, 100)); break; }
    }
  }
}

console.log('\n  ' + (CASOS.length - falhas) + ' de ' + CASOS.length + ' se comportaram como deviam');
process.exit(falhas ? 1 : 0);