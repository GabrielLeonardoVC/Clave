/* Prova que o verificador de seguranca acusa o defeito real.

   Um verificador que nunca falhou e um verificador que a pessoa ignora. Este
   script abre cinco buracos de verdade — um por vez — confere que o verificador
   acusa, e fecha cada buraco.

   A quebra e por EXPRESSAO REGULAR, nunca por texto exato. Texto exato depende
   da indentacao, e a indentacao muda sempre que alguem mexe no arquivo: o teste
   passaria a falhar por causa da propria edicao, e ele existe para testar o
   verificador, nao o codigo.

   Cada caso diz QUAL REGRA tem de acusar. Um verificador que acusa por outro
   motivo nao provou nada: pode ter barrado por otra regra e continuaria
   barrado quando o buraco fechar. */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = 'C:/Users/Gilson/Documents/Micro Saas/Cifras-pro';
const ARQ = path.join(RAIZ, 'tools', 'check-seguranca.js');

const CASOS = [
  {
    nome: 'campo digitado cru na folha de impressao',
    arquivo: 'js/core/print.js',
    quebra: /esc\(m\.nome\)/,
    conserta: 'm.nome',
    esperado: 'campo cru na folha',
  },
  {
    nome: 'o id do video deixa de ser codificado',
    arquivo: 'js/core/links.js',
    quebra: /encodeURIComponent\(id\)/,
    conserta: 'id',
    esperado: 'codifica o id',
  },
  {
    nome: 'uma tela monta endereco de video por conta propria',
    arquivo: 'js/views/repertorio.js',
    /* Um ifrar de verdade: uma tela constroi o embed na mao, em vez de chamar
     * `Links.embedYouTube`. E o que aconteceu no `cancao.js` antes da
     * unificacao — um segundo lugar onde a regra do video mora. */
    quebra: /(const\s+)(v = c \? Object\.assign\(\{\}, c\) : S\.normCifra\(pre \|\| \{\}\);)/,
    conserta: '$1_frame = { src: "https://www.youtube-nocookie.com/embed/x", title: "v" };\n    $2',
    esperado: 'montado fora do helper',
  },
  {
    nome: 'o app passa a falar com um servidor',
    arquivo: 'js/core/store.js',
    quebra: /(\n\s*)(function exportar\(\))/,
    conserta: '\n  fetch("https://api.exemplo.com/dados");$2',
    esperado: 'nao fala com ninguem',
  },
  {
    nome: 'HTML escrito a mao volta no lugar',
    arquivo: 'js/core/utils.js',
    quebra: /else if \(k === 'text'\) node\.textContent = v;/,
    conserta: "else if (k === 'html') node.innerHTML = v;\n        else if (k === 'text') node.textContent = v;",
    esperado: 'HTML escrito a mao',
  },
];

function rodar() {
  try {
    execFileSync(process.execPath, [ARQ], { cwd: RAIZ, encoding: 'utf8', timeout: 120000 });
    return { passou: true, saida: '' };
  } catch (e) {
    return { passou: false, saida: (e.stdout || '') + (e.stderr || '') };
  }
}

/* Este teste QUEBRA O CODIGO de proposito. Se ele for interrompido no meio — um
 * Ctrl+C, o harness encerrando o processo, a maquina apagando — o arquivo fica
 * com o buraco aberto, e o proximo a rodar o codigo nao sabe por que aquilo
 * esta la.
 *
 * A rede de seguranca e um `exit` handler, que roda tanto no fim normal quanto
 * em excecao e em `process.exit`. O que estiver na pilha e restaurado. E o que
 * ja foi restaurado sai da pilha. */
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

console.log('\n=== o verificador precisa acusar o buraco de verdade ===');

const antes = rodar();
console.log((antes.passou ? '  ok    ' : '  FALHA ')
  + 'com o codigo certo, o verificador passa');
if (!antes.passou) {
  falhas++;
  console.log(antes.saida.split('\n').filter((l) => l.indexOf('FALHA') >= 0).join('\n'));
}

for (const c of CASOS) {
  const caminho = path.join(RAIZ, c.arquivo);
  const original = fs.readFileSync(caminho, 'utf8');

  if (!c.quebra.test(original)) {
    console.log('  FALHA  "' + c.nome + '": a expressao a quebrar nao existe mais');
    console.log('        o codigo mudou de forma e o teste ficou velho');
    falhas++;
    continue;
  }

  let quebrado = original.replace(c.quebra, c.conserta);
  if (c.vezes) {
    quebrado = quebrado.replace(new RegExp(c.quebra.source, 'g'), c.conserta);
  }
  quebrar(caminho, quebrado);

  const r = rodar();
  const acusou = !r.passou;
  /* A regra esperada tem de ser a que disparou. Acusar por outra raziao nao
   * prova que esta regra funciona. */
  const linhasFalha = r.saida.split('\n').filter((l) => l.indexOf('FALHA') >= 0);
  const pelaRegraCerta = linhasFalha.some((l) => l.indexOf(c.esperado) >= 0);

  console.log((acusou ? '  ok    ' : '  FALHA ') + 'abriu "' + c.nome + '" e o verificador '
    + (acusou ? 'acusou' : 'NAO acusou'));
  if (acusou) {
    console.log('        pela regra certa ("' + c.esperado + '"): '
      + (pelaRegraCerta ? 'sim' : 'NAO — disparou outra regra, entao nao provou nada'));
    if (!pelaRegraCerta) {
      falhas++;
      console.log('        disparou: ' + linhasFalha.slice(0, 2).map((l) => l.trim().slice(0, 80)).join(' | '));
    } else {
      const achou = linhasFalha.find((l) => l.indexOf(c.esperado) >= 0);
      console.log('        ' + achou.trim().slice(0, 92));
    }
  } else {
    falhas++;
  }

  restaurar(caminho);
}
const depois = rodar();
console.log((depois.passou ? '  ok    ' : '  FALHA ')
  + 'fechado, o verificador volta a passar');
if (!depois.passou) { falhas++; console.log(depois.saida); }

console.log('');
console.log('=================================================');
console.log(falhas
  ? falhas + ' problema(s)'
  : 'o verificador barra os cinco buracos, cada um pela regra que promete');
console.log('=================================================\n');
process.exit(falhas ? 1 : 0);
