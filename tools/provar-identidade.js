/* Prova que o verificador de identidade pega o nome antigo na tela.
 * Um verificador que nao pode falhar nao verifica nada. */
const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');

const RAIZ = 'C:/Users/Gilson/Documents/Micro Saas/Cifras-pro';
const VERIF = path.join(RAIZ, 'tools', 'check-identidade.js');

/* As quatro posicoes de marca, com o texto bom e o texto velho. */
const CASOS = [
  {
    nome: 'a faixa de boas-vindas voltou a dizer ACORDE',
    arq: 'js/views/hoje.js',
    bom: "'BEM-VINDO AO ' + global.Identidade.NOME.toUpperCase()",
    velho: "'BEM-VINDO AO ACORDE'",
  },
  {
    nome: 'a assinatura do compartilhamento voltou ao nome antigo',
    arq: 'js/core/share.js',
    bom: "'_Feito no ' + (global.Identidade ? global.Identidade.NOME",
    velho: "'_Feito no Acorde'",
  },
  {
    nome: 'o cartao "Sobre" voltou a se chamar acorde',
    arq: 'js/views/ajustes.js',
    bom: "class: 'fs-md fw-8' }, global.Identidade.NOME)",
    velho: "class: 'fs-md fw-8' }, 'acorde')",
  },
  {
    nome: 'a folha "Sobre" voltou ao nome antigo',
    arq: 'js/app.js',
    bom: 'title: global.Identidade.NOME, sub:',
    velho: "title: 'acorde', sub:",
  },
];

let falhas = 0;
console.log('\n=== o verificador de identidade pega o nome antigo na tela? ===\n');

for (const caso of CASOS) {
  const caminho = path.join(RAIZ, caso.arq);
  const original = fs.readFileSync(caminho, 'utf8');

  if (original.indexOf(caso.bom) < 0) {
    console.log('  FALHA ' + caso.nome);
    console.log('          nao achei o texto bom: ' + caso.bom.slice(0, 50));
    falhas++;
    continue;
  }

  /* Devolve o nome antigo e roda o verificador: ele tem de reprovar. */
  fs.writeFileSync(caminho, original.split(caso.bom).join(caso.velho), 'utf8');
  let reprovou = false;
  let saida = '';
  try {
    saida = execFileSync(process.execPath, [VERIF], { encoding: 'utf8', cwd: RAIZ, timeout: 120000 }).toString();
  } catch (e) {
    reprovou = true;
    saida = (e.stdout || '').toString() + (e.stderr || '').toString();
  }
  fs.writeFileSync(caminho, original, 'utf8');

  const acusou = reprovou && /FALHA/.test(saida) && /nome de/.test(saida);
  console.log((acusou ? '  ok    ' : '  FALHA ') + caso.nome);
  if (!acusou) {
    console.log('          o verificador passou com o nome antigo na tela');
    falhas++;
  } else {
    /* A prova tem que ser a linha que ACUSOU. Imprimir a última linha "ok"
     * seria mostrar uma evidência que não prova nada — e foi exatamente o que
     * aconteceu na primeira versão deste arquivo. */
    const linha = saida.split('\n').find((l) => /FALHA/.test(l) && /nome de/.test(l))
      || saida.split('\n').find((l) => /FALHA/.test(l));
    if (linha) console.log('          ' + linha.trim().slice(0, 96));
  }
}

/* E o estado bom tem de passar. */
let limpo = false;
try {
  execFileSync(process.execPath, [VERIF], { encoding: 'utf8', cwd: RAIZ, timeout: 120000 });
  limpo = true;
} catch (e) { limpo = false; }
console.log('\n  ' + (limpo ? 'ok    ' : 'FALHA ') + 'e com os nomes corretos o verificador passa');
if (!limpo) falhas++;

/* Os arquivos voltaram ao estado original? */
const intactos = CASOS.every((caso) => {
  const t = fs.readFileSync(path.join(RAIZ, caso.arq), 'utf8');
  return t.indexOf(caso.bom) >= 0;
});
console.log('  ' + (intactos ? 'ok    ' : 'FALHA ') + 'os 4 arquivos voltaram ao estado original');
if (!intactos) falhas++;

console.log('\n  ' + (CASOS.length + 2 - falhas) + ' de ' + (CASOS.length + 2)
  + ' se comportaram como deviam');
process.exit(falhas ? 1 : 0);