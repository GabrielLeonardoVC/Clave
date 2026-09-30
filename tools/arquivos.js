// Varredura de arquivos compartilhada pelas ferramentas do Acorde.
//
// Estas ferramentas conferem o app da raiz, que e JS classico sem build. Sem
// esta separacao, tres coisas davam errado:
//
//   - o check-syntax acusava `import`/`export` de qualquer ESM por perto como
//     erro de sintaxe, por compilar com vm.Script, que e script classico;
//   - o icons.js chegava a percorrer node_modules e a recolher nomes de icone
//     de codigo de terceiros, produzindo uma lista que nao era a do Acorde;
//   - as demais perdiam tempo lendo build e dependencias a cada execucao.
//
// Por isso a varredura e fechada no que e do app. A pasta `legado/` fica de
// fora de proposito: e historico, e nao faz parte do produto.
const fs = require('fs'), path = require('path');

// Fora do alcance do Acorde. `dist` e build, nunca fonte.
const IGNORAR = new Set([
  'node_modules',
  '.git',
  'dist',
  'legado',
  '.github',
]);

/**
 * Raiz do repositorio, resolvida a partir deste arquivo e nao do diretorio
 * de onde o comando foi chamado. Sem isto, rodar `node tools/check-syntax.js`
 * de dentro de `tools/` conferia so a propria pasta e dava "0 arquivos", que
 * parece passar sem ter conferido nada.
 */
const RAIZ = path.join(__dirname, '..');

/** Percorre a arvore pulando o que nao pertence ao app. */
function andar(dir, out = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) andar(p, out);
    else out.push(p);
  }
  return out;
}

/** Arquivos do Acorde, a partir da raiz do repositorio. */
function arquivos() {
  return andar(RAIZ);
}

/** Igual a arquivos(), mas so o que casar a expressao. */
function arquivosDe(re) {
  return arquivos().filter((f) => re.test(f));
}

/**
 * Caminho relativo a raiz do repositorio, com o separador do sistema.
 * Para comparar pasta, e nao pedaco de caminho: `includes('tools')` casaria
 * tambem com um "tools" qualquer no nome do diretorio do usuario.
 */
function relativo(f) {
  return path.relative(RAIZ, f);
}

/** Verdadeiro se o arquivo estiver dentro da pasta indicada. */
function dentroDe(f, pasta) {
  return relativo(f).split(path.sep)[0] === pasta;
}

module.exports = { andar, arquivos, arquivosDe, dentroDe, relativo, RAIZ, IGNORAR };
