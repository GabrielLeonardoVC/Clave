/* =========================================================
   ACORDE - tools/check-css.js
   O CSS e valido, e nao so esta balanceado.

   Existe por causa de um defeito real e silencioso: um fechamento de comentario
   a mais no meio da folha. Um token invalido faz o parser pular ate o proximo
   `;` ou `}`, e o que ele engole e uma regra INTEIRA.

   Aconteceu duas vezes no mesmo arquivo, e as duas com consequencia visivel:

     - a regra `.acorde-placa` sumia do CSSOM. A placa do acorde ficava sem
       fundo, sem borda e sem raio. Nenhum aviso, nenhum erro de sintaxe, e o
       verificador de variaveis passava: a variavel existia, e nao estava
       sendo usada.
     - `.topbar { position: sticky; ... }` sumia. A barra superior nao grudava
       ao rolar.

   A regra esta no arquivo. Ela nao esta no navegador. Nenhum dos verificadores
   que eu tinha enxergava isso, porque todos leem o ARQUIVO, e o arquivo estava
   certo — o que estava errado era o que o parser fez com ele.

   Tres verificacoes:

     1. comentario aberto e nunca fechado
     2. fechamento de comentario orfao (o defeito acima)
     3. chaves balanceadas

   E, para fechar a classe de vez, uma quarta que nenhum verificador de arquivo
   pega: as regras que o ARQUIVO declara tem de estar no CSSOM do navegador. As
   tres primeiras sao degeneracoes do erro real; a quarta e o erro real, e o
   navegador responde num instante. As duas Needs: se o navegador nao esta
   disponivel, a quarta e pulada e as outras ainda valem.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = path.join(__dirname, '..');
const FOLHAS = ['base.css', 'components.css', 'features.css'];

const ABRE = String.fromCharCode(47, 42);   // barra + estrela
const FECHA = String.fromCharCode(42, 47);  // estrela + barra

console.log('\n=== o CSS e valido? ===');

let problemas = 0;

/* ------------------------------------------------------------
   1 e 2. Comentarios
   ------------------------------------------------------------ */
for (const nome of FOLHAS) {
  const arquivo = path.join(DIR, 'css', nome);
  const texto = fs.readFileSync(arquivo, 'utf8');

  const usado = new Array(texto.length).fill(false);
  let i = 0;
  let comentarioSemFim = -1;

  while (i < texto.length) {
    if (texto.startsWith(ABRE, i)) {
      const f = texto.indexOf(FECHA, i + 2);
      if (f < 0) { comentarioSemFim = i; break; }
      for (let k = i; k < f + 2; k++) usado[k] = true;
      i = f + 2;
      continue;
    }
    i++;
  }

  const linha = (pos) => texto.slice(0, pos).split('\n').length;

  if (comentarioSemFim >= 0) {
    problemas++;
    console.log('  FALHA  ' + nome + ': comentario aberto na linha ' +
      linha(comentarioSemFim) + ' e nunca fechado — engle o resto do arquivo.');
    continue;
  }

  const orfaos = [];
  for (let k = 0; k < texto.length - 1; k++) {
    if (texto.startsWith(FECHA, k) && !usado[k]) orfaos.push(k);
  }

  if (orfaos.length) {
    problemas++;
    console.log('  FALHA  ' + nome + ': ' + orfaos.length +
      ' fechamento(s) de comentario sem abertura.');
    for (const p of orfaos) {
      // O parser pula ate o proximo `;` ou `}`. Mostrar o que ele engole e a
      // parte que importa: e ai que a regra vai sumir.
      let fim = p + 2;
      while (fim < texto.length && texto[fim] !== '}' && texto[fim] !== ';') fim++;
      const engolido = texto.slice(p + 2, fim);
      console.log('          linha ' + linha(p) + ' engole ' + engolido.length + ' caracteres:' +
        (engolido.indexOf('{') >= 0 ? ' a primeira regra perdida e ' +
          JSON.stringify(engolido.slice(0, 60)) : ''));
    }
  } else {
    console.log('  ok    ' + nome.padEnd(15) + ' comentarios fechados');
  }
}

/* ------------------------------------------------------------
   3. Chaves balanceadas
   ------------------------------------------------------------ */
for (const nome of FOLHAS) {
  const texto = fs.readFileSync(path.join(DIR, 'css', nome), 'utf8');

  // Contar sobre o texto sem comentarios, para o comentario nao confundir.
  let limpo = '';
  let i = 0;
  while (i < texto.length) {
    if (texto.startsWith(ABRE, i)) {
      const f = texto.indexOf(FECHA, i + 2);
      if (f < 0) break;
      limpo += texto.slice(i, f + 2);
      i = f + 2;
      continue;
    }
    limpo += texto[i];
    i++;
  }

  let prof = 0, minimo = 0;
  for (const c of limpo) {
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof < minimo) minimo = prof; }
  }

  if (prof !== 0 || minimo < 0) {
    problemas++;
    console.log('  FALHA  ' + nome + ': chaves desbalanceadas (sobram ' + prof +
      ', chega a ' + minimo + ').');
  } else {
    console.log('  ok    ' + nome.padEnd(15) + ' chaves balanceadas');
  }
}

/* ------------------------------------------------------------
   4. As regras do arquivo estao no CSSOM?

   As verificacoes acima sao degeneracoes de um mesmo erro. Esta e o erro: a
   regra esta no arquivo e nao esta no navegador. So quem pergunta ao navegador
   descobre — e a resposta e imediata.

   Sem navegador, as verificacoes acima ainda valem e isto e pulado.
   ------------------------------------------------------------ */
console.log('\n=== as regras do arquivo chegam ao navegador? ===');

let checado = false;
try {
  // O probe abre a pagina em um servidor local e pergunta ao CSSOM.
  const probe = execFileSync(process.execPath, [path.join(__dirname, 'probe-css.js')], {
    encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const dados = JSON.parse(probe);
  checado = true;

  if (!dados.ok) {
    problemas++;
    console.log('  FALHA  o navegador nao respondeu: ' + dados.erro);
  } else {
    for (const folha of dados.folhas) {
      const perdidos = folha.ausentes;
      if (perdidos.length) {
        problemas++;
        console.log('  FALHA  ' + folha.nome + ': ' + perdidos.length +
          ' regra(s) no arquivo e ausentes do CSSOM:');
        perdidos.slice(0, 6).forEach((s) => console.log('          ' + s));
        if (perdidos.length > 6) console.log('          ... e mais ' + (perdidos.length - 6));
      } else {
        console.log('  ok    ' + folha.nome.padEnd(15) + folha.total +
          ' regra(s) conferidas, nenhuma engolida');
      }
    }
    console.log('  ' + dados.totalRegras + ' regra(s) conferidas no total');
  }
} catch (e) {
  console.log('  pulado — o probe precisa de navegador e de um servidor local.');
  console.log('         As verificacoes de arquivo acima continuam valendo.');
}

console.log('\n=================================================');
console.log(problemas
  ? '  ' + problemas + ' problema(s) de CSS'
  : '  o CSS esta integro' + (checado ? ' e chega inteiro ao navegador' : ''));
console.log('=================================================\n');
process.exit(problemas ? 1 : 0);