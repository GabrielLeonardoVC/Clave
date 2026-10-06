/* Prova que o verificador de vida pega o vazamento original.
 *
 * O defeito era `traste3d` expoe `destruir3d` e ninguem chama. Este script
 * quebra o chamador, roda o verificador, mostra que acusou, e restaura.
 *
 * A quebra e por EXPRESSAO REGULAR, nao por texto exato. O texto exato dependia
 * da indentacao, e a indentacao muda sempre que alguem mexe no arquivo — o
 * teste passaria a falhar por causa da propria edicao, e ele nao existe para
 * testar codigo, e para testar o verificador.
 *
 * Um verificador que nunca falhou e um verificador que a pessoa ignora — e o
 * que importa aqui e que ele falha na hora certa.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/* A raiz vem do proprio repositorio, e nao de um caminho fixo.
 *
 * O caminho absoluto que estava aqui so resolvia na maquina em que o arquivo
 * foi escrito; em qualquer outra a prova de vida dos recursos nao rodava. */
const { RAIZ } = require('./arquivos.js');
const ARQ = path.join(RAIZ, 'tools', 'check-vida.js');

const CASOS = [
  {
    nome: 'ninguem chama o teardown do 3D',
    arquivo: 'js/views/teoria.js',
    /* A quebra e na CHAMADA, nao no `if` que a protege.
     *
     * Quebrar o `if` tiraria o `if (typeof ...)` e deixaria a chamada ali,
     * dentro de um bloco que so nao roda — e o verificador, que le o texto,
     * continuaria vendo um chamador. Isso e o mesmo defeito que ele existe para
     * achar: a estrutura parece cared, o comportamento nao e. O que reproduz o
     * vazamento e a chamada sumir. */
    quebra: /try \{ n\.destruir3d\(\); \} catch \(e\) \{[^\n]*\}/,
    conserta: '/* sem teardown */',
  },
  {
    nome: 'o observador nunca desliga',
    arquivo: 'js/views/traste3d.js',
    quebra: /try \{ (observador\w*)\.disconnect\(\); \} catch \(e\) \{[^\n]*\}/g,
    conserta: '/* sem desligar */',
  },
];

function rodar() {
  try {
    execFileSync(process.execPath, [ARQ], { cwd: RAIZ, encoding: 'utf8' });
    return { passou: true, saida: '' };
  } catch (e) {
    return { passou: false, saida: (e.stdout || '') + (e.stderr || '') };
  }
}

/* Este teste QUEBRA O CODIGO de proposito, entao precisa de rede contra
 * interrupcao. Se o processo for encerrado com um arquivo aberto — um Ctrl+C, o
 * harness derrubando a sessao — a restauracao normal nao roda, e o proximo a
 * abrir o projeto encontra o buraco e nao sabe de onde ele veio.
 *
 * Um `exit` handler roda no fim normal, em excecao e em `process.exit`, que e
 * exatamente a janela que importa. */
const A_RESTAURAR = [];

function quebrar(caminho, conteudo) {
  A_RESTAURAR.push({ caminho: caminho, conteudo: fs.readFileSync(caminho, 'utf8') });
  fs.writeFileSync(caminho, conteudo, 'utf8');
}

function restaurar(caminho) {
  const i = A_RESTAURAR.map((x) => x.caminho).lastIndexOf(caminho);
  if (i < 0) return;
  fs.writeFileSync(caminho, A_RESTAURAR[i].conteudo, 'utf8');
  A_RESTAURAR.splice(i, 1);
}

process.on('exit', () => {
  while (A_RESTAURAR.length) {
    const x = A_RESTAURAR.pop();
    try { fs.writeFileSync(x.caminho, x.conteudo, 'utf8'); } catch (e) { /* nada a fazer */ }
  }
});

let falhas = 0;

console.log('\n=== o verificador precisa falhar quando o recurso fica sem dono ===');

const antes = rodar();
console.log((antes.passou ? '  ok    ' : '  FALHA ') + 'com o codigo certo, o verificador passa');
if (!antes.passou) { falhas++; console.log(antes.saida); }

for (const c of CASOS) {
  const caminho = path.join(RAIZ, c.arquivo);
  const original = fs.readFileSync(caminho, 'utf8');

  const m = c.quebra.exec(original);
  if (!m) {
    console.log('  FALHA  ' + c.nome + ': a expressao a quebrar nao existe mais em ' + c.arquivo);
    console.log('        o codigo mudou de forma e o teste ficou velho; ajuste a expressao');
    falhas++;
    continue;
  }

  quebrar(caminho, original.replace(c.quebra, c.conserta));

  const r = rodar();
  const acusou = !r.passou;
  const linha = (r.saida.split('\n').find((l) => l.indexOf('FALHA') >= 0) || '').trim();
  console.log((acusou ? '  ok    ' : '  FALHA ') + 'quebrou "' + c.nome + '" e o verificador ' +
    (acusou ? 'acusou' : 'NAO acusou'));
  if (acusou && linha) console.log('        ' + linha.slice(0, 100));
  if (!acusou) falhas++;

  restaurar(caminho);
}

const depois = rodar();
console.log((depois.passou ? '  ok    ' : '  FALHA ') + 'restaurado, o verificador volta a passar');
if (!depois.passou) { falhas++; console.log(depois.saida); }

console.log('');
console.log('=================================================');
console.log(falhas
  ? falhas + ' problema(s)'
  : 'o verificador falha quando o recurso fica sem dono, e passa quando tem dono');
console.log('=================================================\n');
process.exit(falhas ? 1 : 0);
