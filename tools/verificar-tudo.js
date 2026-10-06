/* =========================================================
   tools/verificar-tudo.js
   TODOS OS CHECKERS RODAM, MESMO QUANDO UM REPROVA

   O QUE ESTA ERRADO NO `&&`

   O `verificar` era uma cadeia `&&`. Isso nao e' um detalhe de estilo: uma
   cadeia para na primeira falha, entao um unico checker reprovado deixava
   **todos os outros sem executar**. Ninguem via o resultado deles porque
   eles nunca rodaram.

   Isso aconteceu de verdade. O `test-tuner` era instavel e reprovava; por
   causa disso, tres checkers reprovados (`check-variaveis` com um token de
   CSS que eu tinha inventado sem existir, `check-api` com um falso positivo
   sobre um comentario, e `conta-teste` com uma contagem velha) **ficaram
   escondidos por rodadas inteiras**. Quando o tuner passou, apareceram. Nao e'
   hipotese: foi medido nesta V5.17.

   A REGRA DE OURO DELE

   Um checker que nao roda e' um checker que nunca olhou. A alternativa — rodar
   todos e sair no primeiro erro — esconde exatamente o que o verde precisa ver.

   O QUE ESTE ARQUIVO FAZ, E O QUE NAO FAZ

   * Roda **todos** os checkers, na ordem, sem parar no primeiro erro.
   * Imprime PASS/FAIL de cada um, para dar para ler onde foi.
   * Sai com codigo 1 se **qualquer** reprovou. A semantica de sucesso e de
     falha fica igual: `verificar` verde significa que tudo passou.
   * Confere se existe algum checker em `tools/` que NAO esta na lista, e
     reprova se encontrar. Esse e' o outro lado do mesmo buraco: um checker
     escrito e nunca ligado nao protege ninguem.

   A lista fica em `package.json`, em `verificar:checkers` — uma fonte so. Este
   arquivo nao tem lista propria para nao poder divergir.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));

const lista = (pkg.scripts['verificar:checkers'] || '').trim().split(/\s+/).filter(Boolean);

/* ---- 1. a lista cobre todos os checkers que existem? ---- */
const temCaraDeChecker = (f) => /^(check-|scan|termos|diag-|conta-)/.test(f) && f.endsWith('.js');
const existentes = fs.readdirSync(path.join(RAIZ, 'tools')).filter(temCaraDeChecker).sort();
const foraDaLista = existentes.filter((f) => lista.indexOf(f) < 0);

console.log('=== a lista cobre os checkers que existem? ===');
console.log('  na lista ..... ' + lista.length);
console.log('  em tools/ .... ' + existentes.length);
if (foraDaLista.length === 0) {
  console.log('  ok    nenhum checker fora da lista');
} else {
  console.log('  FALHA ' + foraDaLista.length + ' checker(s) em tools/ que NINGUEM roda:');
  foraDaLista.forEach((f) => console.log('          ' + f));
}

const inexistentes = lista.filter((f) => !fs.existsSync(path.join(RAIZ, 'tools', f)));
if (inexistentes.length) {
  console.log('  FALHA na lista, sem arquivo: ' + inexistentes.join(' '));
}

/* ---- 2. roda todos, sem parar ---- */
console.log('\n=== rodando ' + lista.length + ' checkers, sem parar no primeiro erro ===');
let passou = 0; let reprovou = 0;
const reprovados = [];

for (const nome of lista) {
  const arquivo = path.join(RAIZ, 'tools', nome);
  const t0 = Date.now();
  let codigo; let saida = '';
  try {
    saida = execFileSync('node', [arquivo], { encoding: 'utf8', cwd: RAIZ, stdio: 'pipe' });
    codigo = 0;
  } catch (e) {
    saida = (e.stdout || '') + (e.stderr || '');
    codigo = e.status === 0 ? 1 : (e.status === null ? 'sinal' : e.status);
  }
  const ms = Date.now() - t0;
  const cracha = codigo === 0;
  if (cracha) passou++; else { reprovou++; reprovados.push(nome); }
  console.log('  [' + (cracha ? 'PASS' : 'FAIL') + '] ' + nome.padEnd(30)
    + ' exit=' + codigo + '  ' + (ms / 1000).toFixed(1) + 's');
  if (!cracha) {
    saida.split('\n').filter((l) => /FALHA|problema|erro/i.test(l)).slice(0, 6)
      .forEach((l) => console.log('         ' + l.trim().slice(0, 100)));
  }
}

console.log('\n' + '='.repeat(66));
console.log('  ' + passou + ' checkers passaram, ' + reprovou + ' reprovaram'
  + (reprovados.length ? ': ' + reprovados.join(' ') : ''));
const sai1 = reprovou > 0 || foraDaLista.length > 0 || inexistentes.length > 0;
console.log('  exit final: ' + (sai1 ? 1 : 0));
console.log('='.repeat(66) + '\n');
process.exit(sai1 ? 1 : 0);