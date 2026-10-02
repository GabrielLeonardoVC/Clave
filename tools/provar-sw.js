/* =========================================================
   tools/provar-sw.js
   Prova que o `test-sw` pega o que ele diz pegar.

   Este teste roda o `sw.js` de verdade num sandbox. Isso e raro e e o motivo
   de ele valer tanto: quase todas as regras deste projeto que "passam sem
   nada acusar" eram verificadores que nunca olharam. Um teste que carrega o
   worker e ve qual das duas respostas — rede ou cache — saiu tem menos por onde
   escapar.

   As mutacoes abaixo sao de UMA LINHA cada, e cada uma e um jeito diferente de
   o app voltar a servir a versao antiga sem nenhum erro:

     1. trocar a ordem: responder pelo cache primeiro (o defeito original);
     2. tirar o prazo, e deixar a rede segurar a tela para sempre;
     3.olar o `skipWaiting` de volta para dentro do `.then` do cache;
     4. trocar `addAll`, que e atomico, por uma esperaSequencial;
     5. tirar a conferencia de origem do `message`;
     6. trocar o nome do cache, para o `activate` deixar o cache velho vivo;
     7. tirar a ordem "assumir" do lado da pagina.

   A ultima e a mais importante por uma razao: ela quebra em DOIS lugares ao
   mesmo tempo — a pagina deixa de pedir, e o worker fica sem quem mande. Um
   verificador que so olhasse um dos lados passaria.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const SW = path.join(RAIZ, 'sw.js');
const APP = path.join(RAIZ, 'js', 'app.js');
const TESTE = path.join(__dirname, 'test-sw.js');
const NL = String.fromCharCode(10);

const swOriginal = fs.readFileSync(SW, 'utf8');
const appOriginal = fs.readFileSync(APP, 'utf8');

/* Cada mutacao diz qual arquivo mexe, o que troca por o que, e o que a troca
 * QUEBRA — porque uma mutacao sem defeito穿 nao é uma mutacao. */
const MUTACOES = [
  {
    nome: 'o worker voltou a responder pelo cache primeiro',
    arq: SW,
    de: "      return caches.match(req).then(function (hit) {",
    para: "      return caches.match(req).then(function (hit) { if (!hit) throw 0;",
    quebra: 'a rede deixa de ser tentada primeiro, que e o defeito inteiro',
  },
  {
    nome: 'o prazo da rede foi eliminado',
    arq: SW,
    de: "const cronometro = setTimeout(function () { responder(null); }, PRAZO);",
    para: "const cronometro = setTimeout(function () { responder(null); }, 600000);",
    quebra: 'sem rede, quem espera 10 minutos nao ve o app abrir',
  },
  {
    nome: 'a rede parou de revalidar e aceitou o cache do navegador',
    arq: SW,
    de: "const pergunta = new Request(req, { cache: 'no-cache' });",
    para: "const pergunta = new Request(req);",
    quebra: 'o `fetch` herda o cache HTTP, que fica abaixo do worker',
  },
  {
    nome: 'o worker parou de se declarar quando o cache nao enche',
    arq: SW,
    de: "    await self.skipWaiting();",
    para: "    if (self.__cacheCheio) await self.skipWaiting();",
    quebra: '`__cacheCheio` nunca e definido, entao o worker novo nao assume',
  },
  {
    nome: 'um recurso faltando derrubou a instalacao inteira',
    arq: SW,
    de: "      } catch (e) {",
    para: "      } catch (e) { throw e;",
    quebra: 'o primeiro recurso indisponivel cancela os outros e o `skipWaiting`',
  },
  {
    nome: 'a conferencia de origem do worker foi removida',
    arq: SW,
    de: "  if (!ev.origin || ev.origin !== self.location.origin) return;",
    para: "  // guarda removida",
    quebra: 'qualquer aba do navegador passa a mandar no worker',
  },
  {
    nome: 'o cache voltou ao nome antigo',
    arq: SW,
    de: "const CACHE = 'clave-v4';",
    para: "const CACHE = 'clave-v3';",
    quebra: 'o `activate` deixa de apagar o cache da regra antiga',
  },
  {
    nome: 'a pagina parou de pedir que o worker novo assuma',
    arq: APP,
    de: "reg.waiting.postMessage({ tipo: 'assumir' });",
    para: "// a pagina nao pede mais nada",
    quebra: 'ninguem manda, e o worker novo fica esperando para sempre',
  },
];

function aplicar(m) {
  const original = m.arq === SW ? swOriginal : appOriginal;
  if (original.indexOf(m.de) < 0) return null;
  return original.split(m.de).join(m.para);
}

function rodar() {
  try {
    const saida = execFileSync(process.execPath, [TESTE], {
      encoding: 'utf8', cwd: RAIZ, timeout: 180000,
    });
    return { saida: saida, caiu: false };
  } catch (e) {
    const texto = (e.stdout || '') + (e.stderr || '');
    return {
      saida: texto,
      caiu: true,
      quebrou: /SyntaxError|ReferenceError|TypeError: .* is not|Unexpected/.test(texto),
    };
  }
}

function restaurar() {
  fs.writeFileSync(SW, swOriginal, 'utf8');
  fs.writeFileSync(APP, appOriginal, 'utf8');
}

let falhas = 0;
console.log('\n=== o teste do worker pega a regra antiga? ===\n');

for (const m of MUTACOES) {
  const original = m.arq === SW ? swOriginal : appOriginal;
  const modificado = aplicar(m);
  if (modificado === null) {
    console.log('  FALHA ' + m.nome);
    console.log('          nao achei a linha a trocar');
    console.log('          procurava: ' + JSON.stringify(m.de.slice(0, 60)));
    falhas++;
    continue;
  }
  if (modificado === original) {
    console.log('  FALHA ' + m.nome);
    console.log('          a troca nao mudou nada');
    falhas++;
    continue;
  }

  fs.writeFileSync(m.arq, modificado, 'utf8');
  const r = rodar();
  restaurar();

  if (r.quebrou) {
    console.log('  FALHA ' + m.nome);
    console.log('          o teste QUEBROU em vez de reprovar.');
    console.log('          Um provador que quebra o arquivo e nao acusa nada e pior');
    console.log('          que nao ter provador: ele parece cobertura.');
    console.log('          ' + r.saida.split(NL).filter((l) => /Error/.test(l))[0]);
    falhas++;
    continue;
  }

  const acusou = /FALHA/.test(r.saida);
  console.log((acusou ? '  ok    ' : '  FALHA ') + m.nome);
  if (!acusou) {
    console.log('          o teste passou com a regra antiga');
    console.log('          ' + m.quebra);
    falhas++;
  } else {
    const primeira = r.saida.split(NL).find((l) => /FALHA/.test(l));
    if (primeira) console.log('          ' + primeira.trim().slice(0, 92));
  }
}

restaurar();
const voltou = fs.readFileSync(SW, 'utf8') === swOriginal
  && fs.readFileSync(APP, 'utf8') === appOriginal;
console.log('\n  ' + (voltou ? 'ok    ' : 'FALHA ') + 'os dois arquivos voltaram ao estado original');
if (!voltou) falhas++;

const limpo = rodar();
const passou = !limpo.caiu && !/FALHA/.test(limpo.saida);
console.log((passou ? '  ok    ' : '  FALHA ') + 'e, sem nenhum defeito, o teste passa');
if (!passou) falhas++;

console.log('\n  ' + (MUTACOES.length + 2 - falhas) + ' de ' + (MUTACOES.length + 2)
  + ' se comportaram como deviam');
process.exit(falhas ? 1 : 0);