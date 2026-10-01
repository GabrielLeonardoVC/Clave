/* =========================================================
   ACORDE - tools/check-concordancia.js
   O numero tem que concordar com a palavra.

   Rodar:  node tools/check-concordancia.js

   Existe por causa de um defeito que nenhuma ferramenta acusava, e que aparecia
   em quase toda tela do app: "1 músicas".

   O codigo estava certo. A string estava certa. A concatenacao estava certa. E
   mesmo assim o app escrevia "1 músicas", "3 cifras salvas" para uma so, "2
   eventos e 1 cifras salvos". O defeito era de portugues, e nao de programa —
   e por isso que `check-ortografia` nao pegava: ele julga PALAVRA, e "músicas"
   esta escrita com acento certo. O que estava errado era o ACORDO entre ela e o
   numero.

   Isso importa mais do que parece. Ninguem que escreve portugues escreve "1
   musicas" de proposito — a pessoa que escreve a frase pensa no plural. O
   detalhe quebrado e a pista de que o texto foi montado sem ninguem pensar, e
   e exatamente o que faz um app parecer gerado por maquina.

   ---------------------------------------------------------
   O QUE ESTE VERIFICADOR CONSEGUE E O QUE NAO CONSEGUE

   Ele ve texto. Entao ele pega o caso comum: um numero colado num substantivo
   plural, sem nenhuma condicao antes. Ele nao pega:

     - o substantivo no plural e a palavra logo depois de um ternario que ja
       cuida do singular (`x === 1 ? 'cifra' : 'cifras'`) — ali esta certo e o
       verificador cala;
     - o plural que muda a palavra em vez de ganhar `s` ("1 dia", "2 dias" e
       "1 capaz", "2 capazes" sao casos diferentes, e o padrao so cobre o `s`);
     - o que so se resolve lendo a frase inteira.

   Por isso ele reporta como `conferir`, e nao como prova. Ele aponta o lugar
   onde vale olhar; quem escreve olha e decide.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

/* Os substantivos que o app conta.

   Uma lista, e nao um padrao generico de palavra terminada em `s`: "as", "voce
   os tem many" e os nomes proprios demais para valer a pena, e a lista cobre o
   vocabulario real deste app. Os que faltarem entram aqui — e o lugar de entrar
   e aqui, e nao num `if` espalhado por seis telas. */
const SUBSTANTIVOS = [
  'músicas', 'musicas', 'cifras', 'escalas', 'eventos', 'anotações', 'anotacoes',
  'acordes', 'pessoas', 'leituras', 'afordâncias', 'afordancias', 'versões',
  'versoes', 'capazes', 'salvas', 'salvos', 'gravações', 'gravacoes',
  'arquivos', 'fotos', 'presets', 'paradas', 'tentativas', 'passadas', 'falhas',
];

/* O RE nao precisa de `g` nem de `lastIndex`.
 *
 * A primeira versao usava `while (exec())` e chamava `exec` DUAS vezes por
 * volta. Isso e um laco infinito classico: quando `exec` devolve `null`, o
 * `lastIndex` volta para zero, e a chamada seguinte recomeca do comeco e
 * devolve a MESMA casa. O verificador imprimia a mesma linha indefinidamente
 * ate o processo comer a memoria.
 *
 * `matchAll` entrega todas as casas de uma vez e nao tem estado nenhum para
 * errar. */
const RE = /(\w+(?:\.\w+)*(?:\([^()]*\)|\.\w+)?)\s*\+\s*'([^']{2,40})'/g;

/* A linha ja resolve o acordo sozinha?
 *
 * Tres formas, todas corretas e todas ja em uso no app:
 *
 *   `x === 1 ? 'cifra' : 'cifras'`       — escolhe entre as duas palavras
 *   `x > 1 ? x + ' pessoas' : ''`        — no singular mostra o nome, nao a
 *                                          palavra: `resps[0]`
 *   `U.plural(n, 'cifra')`                — a ferramenta
 *
 * O padrao e proposital largo: este verificador nao julga a frase, ele aponta
 * o lugar onde vale olhar. Reconhecer o caso ja resolvido e o que impede que
 * ele vire barulho — e barulho e o que faz a pessoa parar de rodar. */
function jaCombinado(linha) {
  if (/plural\s*\(/.test(linha)) return true;
  if (/===\s*1\s*\?/.test(linha)) return true;
  if (/>\s*1\s*\?/.test(linha)) return true;
  if (/\?\s*'[^']*'\s*:\s*'[^']*'/.test(linha)) return true;
  return false;
}

/* O que conta e contagem de verdade? */
const CONTA = /(length|count|total|size|resto|indice|idx|num|n)\b/i;

let problema = 0;

function conferir() {
  console.log('\n=== o numero concorda com a palavra ===');

  const arqs = [];
  (function andar(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name.endsWith('.js')) arqs.push(p);
    }
  })(path.join(RAIZ, 'js'));

  /* `js/data/` fica de fora, e pelo mesmo motivo do `check-ortografia`: ali e
   * letra de musica e cifra, texto de terceiro, citado como se cita. O acordo
   * entre numero e substantivo nao e coisa que o app escreve la dentro.
   *
   * Alem disso, o arquivo tem linhas de dezenas de milhares de caracteres, e o
   * padrao deste arquivo — que tem grupos aninhados — fica lento demais nelas.
   * A primeira versao deste verificador travou por tres minutos sem saida. */
  const INTERESSANTES = arqs.filter((a) => {
    const rel = path.relative(RAIZ, a).split(path.sep).join('/');
    return rel.indexOf('js/data/') !== 0;
  });

  console.log('  ' + INTERESSANTES.length + ' arquivo(s) do app'
    + ' (js/data/ fora: e letra de terceiro)');

  let avisados = 0;

  for (const arq of INTERESSANTES) {
    const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
    const linhas = fs.readFileSync(arq, 'utf8').split('\n');

    linhas.forEach((l, i) => {
      const t = l.trim();
      if (t.startsWith('*') || t.startsWith('//')) return;

      /* Linha de codigo tem tamanho humano. Uma linha de tres mil caracteres
       * esta com alguma coisa colada nela — dado de amostra, base64, uma letra
       * inteira — e nao e codigo que alguem vai revisar. */
      if (l.length > 600) return;

      if (jaCombinado(l)) return;

      for (const casa of l.matchAll(RE)) {
        const conta = casa[1];
        const texto = casa[2];
        const primeira = texto.trim().split(/\s+/)[0];

        if (SUBSTANTIVOS.indexOf(primeira) < 0) continue;
        if (!CONTA.test(conta)) continue;

        avisados++;
        problema++;
        const trecho = conta + " + '" + texto + "'";
        console.log('  FALHA ' + rel + ':' + (i + 1) + '  ' + trecho);
        console.log('        a tela le [' + trecho + '] e mostra isso para 1.');
        console.log('        use U.plural(n, "singular") ou um ternario com === 1.');
      }
    });
  }

  if (!avisados) {
    console.log('  ok    nenhum numero colado num substantivo sem combinar');
  }

  /* ---------------------------------------------------------
     A ferramenta existe. Ela nao pode estar calada por acidente.
     ---------------------------------------------------------
     `U.plural` precisa estar no `Utils`, e o verificador de escopo ja cobre o
     resto. Aqui so se confirma que a ferramenta foi exportada — um `plural` que
     ficou no arquivo, sem sair, faria toda tela chamar `undefined` em vez de
     combinar a palavra. */
  const utils = fs.readFileSync(path.join(RAIZ, 'js/core/utils.js'), 'utf8');
  const temFuncao = /function plural\s*\(/.test(utils);
  const exporta = /plural,/.test(utils) || /plural\s*}/.test(utils);

  if (temFuncao && exporta) {
    console.log('  ok    U.plural existe e sai do modulo');
  } else {
    problema++;
    console.log('  FALHA U.plural nao esta pronto para uso'
      + (temFuncao ? ' (existe mas nao e exportado)' : ' (a funcao nao existe)'));
    console.log('        sem ele, toda tela que chamar quebra em tempo de execucao.');
  }
}

conferir();

console.log('');
console.log('=================================================');
console.log(problema
  ? '  ' + problema + ' frase(s) para conferir'
  : '  todo numero concorda com a palavra');
console.log('=================================================\n');
process.exit(problema ? 1 : 0);
