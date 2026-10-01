/* =========================================================
   ACORDE - tools/check-vida.js
   Todo recurso caro tem dono.

   Existe por causa de um vazamento real e silencioso.

   `traste3d.mostrar()` criava um renderer WebGL e expunha
   `wrap.destruir3d = destruir` — e **ninguém chamava**. O comentario logo acima
   da função prometia o contrario: "Fechar a folha tem que soltar o laco, o
   renderer e as geometrias. Sem isto, abrir e fechar a tela vinte vezes deixa
   vinte contextos WebGL pedidos ao navegador".

   O sintoma não era erro nenhum. O 3D funcionava, e o `Gfx` tinha um teto que
   recicla o mais antigo — então a tela continuava abrindo, e o defeito só
   aparecia como "o 3D às vezes não abre", que é o tipo de coisa que se
   atribui ao aparelho.

   Um `catch` não pega isso. Um teste de sintaxe não pega isso. Só olhando o
   grafo de chamadas — ou contando quem chama — dá para ver.

   A regra: um método cujo nome promete liberar algo não pode existir só para
   escrever. Ele precisa de pelo menos um chamador em outro lugar.

   E o inverso também é checado: um observador que ninguém desliga é o mesmo
   vazamento, com outro nome.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

/* Nomes que prometem soltar algo. */
const TEARDOWN = /\b(destruir|destruir\w*|dispose|dispose\w*|teardown|liberar|release|free|fecharTudo)\b/;

let problemas = 0;
function falhar(msg) {
  console.log('  FALHA  ' + msg);
  problemas++;
}

const arqs = [];
(function anda(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      anda(p);
    } else if (e.name.endsWith('.js')) {
      arqs.push(p);
    }
  }
})(path.join(RAIZ, 'js'));

console.log('\n=== quem promete soltar, e quem chama ===');

/* 1. Metodos de teardown expostos em um no: `algo.destruirX = funcao`. */
const expostos = [];

for (const arq of arqs) {
  const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
  const linhas = fs.readFileSync(arq, 'utf8').split('\n');

  linhas.forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('*') || t.startsWith('//')) return;

    // `no.metodo = funcao` — o no e o que importa, e o nome precisa prometer.
    const m = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;?\s*$/.exec(t);
    if (!m) return;
    const [, no, metodo, valor] = m;
    if (no !== 'wrap' && no !== 'no' && no !== 'node') return;
    if (!TEARDOWN.test(metodo)) return;

    expostos.push({ rel: rel, linha: i + 1, metodo: metodo, valor: valor });
  });
}

console.log('  ' + arqs.length + ' arquivo(s) em js/');

if (!expostos.length) {
  console.log('  ok    nenhum no expoe um metodo de teardown');
}

/* 2. Cada um precisa de um chamador em OUTRO lugar do codigo. */
for (const e of expostos) {
  let chamadas = 0;
  const onde = [];

  for (const arq of arqs) {
    const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
    const texto = fs.readFileSync(arq, 'utf8').split('\n');
    texto.forEach((l, i) => {
      const t = l.trim();
      if (t.startsWith('*') || t.startsWith('//')) return;
      // Uma ATRIBUICAO e o que define. Uma CHAMADA e `algo.metodo(`.
      if (!new RegExp('\\.[ ]*' + e.metodo + '\\s*\\(').test(t)) return;
      if (new RegExp('\\.[ ]*' + e.metodo + '\\s*=\\s*').test(t)) return;
      chamadas++;
      onde.push(rel + ':' + (i + 1));
    });
  }

  if (chamadas === 0) {
    falhar(e.rel + ':' + e.linha + '  expoe `' + e.metodo + '` e ninguem chama');
    console.log('        um teardown que ninguem chama e um vazamento escrito e nomeado');
  } else {
    console.log('  ok    ' + e.metodo.padEnd(12) + 'chamado em ' + chamadas +
      ' lugar(es): ' + onde.slice(0, 3).join(', ') +
      (onde.length > 3 ? '...' : ''));
  }
}

/* 3. Observador que ninguem desliga. */
console.log('\n=== observador que ninguem desliga ===');

const comObserver = arqs.filter((a) => {
  const t = fs.readFileSync(a, 'utf8');
  return /new MutationObserver|new ResizeObserver|new IntersectionObserver/.test(t);
});

for (const arq of comObserver) {
  const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
  const texto = fs.readFileSync(arq, 'utf8');
  const constroi = (texto.match(/new MutationObserver|new ResizeObserver|new IntersectionObserver/g) || []).length;
  const desliga = (texto.match(/\.disconnect\(\)/g) || []).length;

  /* A conta e um para um, e nao "pelo menos um".
   *
   * Dois observadores e um `disconnect` passa em qualquer verificador que so
   * pergunte "existe um?", e o que sobra e um observador vivo para sempre —
   *a o vazamento que o nome do arquivo promete achar. Compara com o que foi
   * criado. */
  if (desliga < constroi) {
    falhar(rel + '  cria ' + constroi + ' observador(es) e desliga ' + desliga);
    console.log('        sobrou observador sem dono: ele continua checando a tela depois dela sumir');
  } else {
    console.log('  ok    ' + rel.padEnd(24) + constroi + ' observador(es), ' + desliga + ' disconnect()');
  }
}

/* 4. Temporizador que se repete.

   So o REPETIDO e problema. Um `setTimeout` de uma vez — debounce, aviso que
   some sozinho, um quadro de animacao — termina sozinho e nao precisa de
   limpeza; cobrar `clearTimeout` de cada um acusaria quase todos os arquivos do
   projeto e transformaria o verificador em barulho. Um verificador que sempre
   falha e tão inutil quanto um que nunca falha.

   O que e problema e o `setInterval`: ele roda ate alguem mandar parar. */
console.log('\n=== temporizador que se repete sem parar ===');

const comInterval = arqs.filter((a) => /setInterval\(/.test(fs.readFileSync(a, 'utf8')));

for (const arq of comInterval) {
  const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
  const texto = fs.readFileSync(arq, 'utf8');
  const cria = (texto.match(/setInterval\(/g) || []).length;
  const limpa = (texto.match(/clearInterval\(/g) || []).length;

  if (limpa === 0) {
    falhar(rel + '  cria ' + cria + ' intervalo(s) e nunca chama clearInterval()');
    console.log('        ele roda ate a aba fechar, exista a tela ou nao');
  } else {
    console.log('  ok    ' + rel.padEnd(24) + cria + ' intervalo(s), ' + limpa + ' clearInterval()');
  }
}

if (!comInterval.length) console.log('  ok    nenhum setInterval no app');

/* 5. Temporizador guardado em variavel.

   E o que o app usa de verdade para parar uma tela no meio: o nome fica, e um
   `clearTimeout` com esse nome volta a chamá-lo. Guardar sem limpar é o
   vazamento — o temporizador continua disparando depois de a tela fechar. */
console.log('\n=== temporizador guardado, e limpo pelo nome ===');

let guardadosVistos = 0;

for (const arq of arqs) {
  const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
  const texto = fs.readFileSync(arq, 'utf8');
  const linhas = texto.split('\n');

  const guardados = [];
  linhas.forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('*') || t.startsWith('//')) return;
    const m = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:global\.)?setTimeout\s*\(/.exec(t);
    if (m) guardados.push({ nome: m[1], linha: i + 1 });
  });
  if (!guardados.length) continue;

  let naoLimpos = 0;
  for (const g of guardados) {
    guardadosVistos++;
    const limpo = new RegExp('clearTimeout\\s*\\(\\s*(?:global\\.)?' + g.nome + '\\b').test(texto);
    if (!limpo) {
      naoLimpos++;
      falhar(rel + ':' + g.linha + '  `' + g.nome + '` guarda um setTimeout e ninguem limpa');
    }
  }
  if (!naoLimpos) {
    console.log('  ok    ' + rel.padEnd(24) + guardados.length + ' guardado(s), todos limpos');
  }
}

if (!guardadosVistos) console.log('  ok    nenhum temporizador guardado em variavel');

console.log('');
console.log('=================================================');
console.log(problemas
  ? problemas + ' recurso(s) caro(s) sem dono'
  : 'todo recurso caro tem quem o solte');
console.log('=================================================\n');
process.exit(problemas ? 1 : 0);