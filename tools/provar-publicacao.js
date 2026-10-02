/* =========================================================
   tools/provar-publicacao.js
   Prova que o `check-publicacao` pega o que ele diz pegar.

   O defeito que este verificador existe para achar tem uma propriedade cruel: ele
   NAO APARECE em nenhum teste local. Um arquivo fora da lista de publicação
   continua no disco, continua sendo lido por 116 arquivos de teste, e continua
   passando em todos eles. So quebra no ar.

   Por isso o provador aqui nao quebra um arquivo do projeto — quebra a LISTA
   que o workflow monta, que e a unica coisa que decide o que sobe. E sao tres
   Ways de quebrar, cada uma com um sintoma diferente:

     1. um asset que o codigo cita sai da lista  -> 404 no ar;
     2. um script que o HTML carrega sai do cache -> o app abre offline e quebra;
     3. um recurso do cache aponta para arquivo apagado -> o `add` falha e o
        worker novo nunca assume (o defeito da rodada passada, em outra forma);
     4. o passo de teste some do workflow -> publica sem conferir nada.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const WF = path.join(RAIZ, '.github', 'workflows', 'pages.yml');
const SW = path.join(RAIZ, 'sw.js');
const INDEX = path.join(RAIZ, 'index.html');
const CHECK = path.join(__dirname, 'check-publicacao.js');
const NL = String.fromCharCode(10);

const wfOriginal = fs.readFileSync(WF, 'utf8');
const swOriginal = fs.readFileSync(SW, 'utf8');
const indexOriginal = fs.readFileSync(INDEX, 'utf8');

const MUTACOES = [
  {
    nome: 'a pasta assets saiu da publicacao',
    arq: WF,
    de: 'cp -r css js assets _site/',
    para: 'cp -r css js _site/',
    quebra: 'o logo e os icones do manifesto somem do ar — 404, e nenhum teste local ve',
  },
  {
    nome: 'o service worker saiu da publicacao',
    arq: WF,
    de: 'cp index.html manifest.webmanifest sw.js .nojekyll _site/',
    para: 'cp index.html manifest.webmanifest .nojekyll _site/',
    quebra: 'o app perde o offline inteiro, e continua funcionando online — o pior tipo',
  },
  {
    nome: 'o passo de teste saiu do workflow',
    arq: WF,
    de: '        run: npm run verificar',
    para: '        run: echo "pulado"',
    quebra: 'publica sem conferir nada; um defeito novo vai ao ar em silencio',
  },
  {
    nome: 'o .nojekyll saiu da publicacao',
    arq: WF,
    de: 'cp index.html manifest.webmanifest sw.js .nojekyll _site/',
    para: 'cp index.html manifest.webmanifest sw.js _site/',
    quebra: 'sem .nojekyll o Pages ignora as pastas que comecam com _ e o site quebra',
  },
  {
    nome: 'um script do cache foi apagado da lista',
    arq: SW,
    de: "  './js/views/cancao.js',",
    para: '',
    quebra: 'o app abre offline e quebra ao abrir uma musica',
  },
  {
    nome: 'o cache passou a guardar um arquivo que nao existe',
    arq: SW,
    de: "  './js/views/cancao.js',",
    para: "  './js/views/cancao.js',\n  './js/views/nao-existe.js',",
    quebra: 'o `add` falha e o worker novo nunca assume — o app serve a versao antiga',
  },
];

function rodar() {
  try {
    const saida = execFileSync(process.execPath, [CHECK], { encoding: 'utf8', cwd: RAIZ, timeout: 120000 });
    return { saida: saida, caiu: false };
  } catch (e) {
    return { saida: (e.stdout || '') + (e.stderr || ''), caiu: true };
  }
}

function restaurar() {
  fs.writeFileSync(WF, wfOriginal, 'utf8');
  fs.writeFileSync(SW, swOriginal, 'utf8');
  fs.writeFileSync(INDEX, indexOriginal, 'utf8');
}

let falhas = 0;
console.log('\n=== o verificador de publicacao pega o que falta no ar? ===\n');

for (const m of MUTACOES) {
  const original = m.arq === WF ? wfOriginal : (m.arq === SW ? swOriginal : indexOriginal);
  if (original.indexOf(m.de) < 0) {
    console.log('  FALHA ' + m.nome);
    console.log('          nao achei a linha a trocar: ' + JSON.stringify(m.de.slice(0, 50)));
    falhas++;
    continue;
  }
  const modificado = original.split(m.de).join(m.para);
  if (modificado === original) {
    console.log('  FALHA ' + m.nome);
    console.log('          a troca nao mudou nada');
    falhas++;
    continue;
  }

  fs.writeFileSync(m.arq, modificado, 'utf8');
  const r = rodar();
  restaurar();

  if (/SyntaxError|ReferenceError|Unexpected/.test(r.saida)) {
    console.log('  FALHA ' + m.nome);
    console.log('          o verificador QUEBROU em vez de reprovar');
    falhas++;
    continue;
  }

  const acusou = /FALHA/.test(r.saida);
  console.log((acusou ? '  ok    ' : '  FALHA ') + m.nome);
  if (!acusou) {
    console.log('          passou com o defeito presente');
    console.log('          ' + m.quebra);
    falhas++;
  } else {
    const primeira = r.saida.split(NL).find((l) => /FALHA/.test(l));
    if (primeira) console.log('          ' + primeira.trim().slice(0, 92));
  }
}

restaurar();
const voltou = fs.readFileSync(WF, 'utf8') === wfOriginal
  && fs.readFileSync(SW, 'utf8') === swOriginal
  && fs.readFileSync(INDEX, 'utf8') === indexOriginal;
console.log('\n  ' + (voltou ? 'ok    ' : 'FALHA ') + 'os tres arquivos voltaram ao estado original');
if (!voltou) falhas++;

const limpo = rodar();
const passou = !limpo.caiu && !/FALHA/.test(limpo.saida);
console.log((passou ? '  ok    ' : '  FALHA ') + 'e, sem nenhum defeito, o verificador passa');
if (!passou) falhas++;

console.log('\n  ' + (MUTACOES.length + 2 - falhas) + ' de ' + (MUTACOES.length + 2)
  + ' se comportaram como deviam');
process.exit(falhas ? 1 : 0);