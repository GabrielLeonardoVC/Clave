/* =========================================================
   ACORDE - tools/check-rotas.js
   O id que o codigo pede para navegar existe.

   Existe por causa de um defeito real: a busca global chamava
   `ir('repertório')` — com acento — enquanto o id da rota e `repertorio`.
   `rota()` cai no primeiro item da lista quando nao acha o id, entao a
   navegacao funcionava, nao dava erro, e levava a pessoa para a tela de Hoje.
   Quem buscava uma cifra e clicava no resultado recebia a tela errada, sem
   nenhuma pista do motivo.

   Um id de rota e uma string sem espaco para ler em voz alta. Qualquer caractere
   a mais — acento, espaco, letra trocada — nao da erro: so troca o destino.
   E por isso que o `check-api`, que cobre metodos, nao pega isto: um id de
   rota nao e um metodo de modulo, e um valor de dado.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { arquivosDe, RAIZ } = require('./arquivos.js');

/** Os ids declarados em ROTAS, no app.js. */
function idsDeclarados() {
  const app = fs.readFileSync(path.join(RAIZ, 'js', 'app.js'), 'utf8');
  const bloco = app.slice(app.indexOf('const ROTAS'), app.indexOf('];', app.indexOf('const ROTAS')));
  const ids = new Set();
  const re = /id:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(bloco)) !== null) ids.add(m[1]);
  return ids;
}

const declarados = idsDeclarados();

/** Chamar `ir('...')` com um id literal. */
function idsUsados() {
  const usos = [];
  // As ferramentas nao entram: o proprio verificador escreve `ir('...')` na
  // documentacao e na expressao regular, e elas seriam acusadas de navegar
  // para uma rota inexistente.
  const esteArquivo = path.basename(__filename);
  for (const arq of arquivosDe(/\.js$/)) {
    if (path.basename(arq) === esteArquivo) continue;
    const txt = fs.readFileSync(arq, 'utf8');
    const rel = path.relative(RAIZ, arq).replace(/\\/g, '/');
    txt.split('\n').forEach(function (linha, i) {
      const re = /\bir\(\s*'([^']+)'/g;
      let m;
      while ((m = re.exec(linha)) !== null) {
        usos.push({ id: m[1], onde: rel + ':' + (i + 1) });
      }
    });
  }
  return usos;
}

const usos = idsUsados();
const errados = usos.filter(function (u) { return !declarados.has(u.id); });

console.log('\n=== o id de rota que o codigo pede existe? ===');
console.log('  ' + declarados.size + ' rota(s) declarada(s): ' + Array.from(declarados).join(', '));
console.log('  ' + usos.length + ' navegacao(oes) por id no codigo');

if (!errados.length) {
  console.log('  ok    todas as navegacoes apontam para uma rota que existe');
} else {
  for (const e of errados) {
    console.log('  FALHA ir(\'' + e.id + '\') em ' + e.onde + ' — nao existe essa rota');
    console.log('        (o id leva acento ou tem caractere a mais; sem isso o app');
    console.log('         vai para outra tela sem avisar)');
  }
}

/* O mesmo id precisa estar na pagina, senao a secao nunca aparece. */
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const semPagina = Array.from(declarados).filter(function (id) {
  return html.indexOf('id="page-' + id + '"') < 0;
});
if (semPagina.length) {
  for (const id of semPagina) {
    console.log('  FALHA a rota ' + id + ' nao tem <section id="page-' + id + '"> no index.html');
  }
}

console.log('');
console.log('=================================================');
const problemas = errados.length + semPagina.length;
console.log(problemas
  ? problemas + ' problema(s) de rota.'
  : 'ok: as rotas apontam para telas que existem.');
process.exit(problemas ? 1 : 0);