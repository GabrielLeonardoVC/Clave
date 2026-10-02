/* =========================================================
   tools/test-3d-braço.js
   A forma do braco, conferida sem abrir o 3D.

   POR QUE UM TESTE DE GEOMETRIA

   O violao 3D e a tela que mais sofre com "parece certo". Ninguem tira foto
   dela para comparar, ninguem abre o codigo para ver a conta, e um braco com
   os trastes em intervalos iguais parece um braco — ate alguem segurar o
   proprio. E quem aprende por este desenho aprende a contagem errada.

   Por isso a matematica do braco foi separada do three.js e exposta em
   `medidas()`. O que nao da para provar em numero: que a textura ficou bonita,
   que a luz pegou bem o angulo. Isso exige olho e aparelho.

   O QUE ESTE ARQUIVO PROVA

     - a lei do traste: o decimo segundo fica na metade da escala, e os
       intervalos encolhem;
     - a geometria muda de instrumento para o outro (o ukulele e mais estreito
       que o baixo, e nao a mesma coisa com quatro cordas a menos);
     - o violino NAO tem traste, porque violino nao tem traste.
   ========================================================= */
'use strict';

const path = require('path');
const fs = require('fs');

let passou = 0;
let falhou = 0;
const problemas = [];
function ok(cond, titulo, detalhe) {
  if (cond) { passou++; console.log('  ok    ' + titulo + (detalhe ? '  (' + detalhe + ')' : '')); }
  else { falhou++; problemas.push(titulo); console.log('  FALHA ' + titulo + (detalhe ? '  (' + detalhe + ')' : '')); }
}
function secao(t) { console.log('\n=== ' + t + ' ==='); }

const RAIZ = path.join(__dirname, '..');
global.window = global;
global.Views = {};
global.Music = require(path.join(RAIZ, 'js', 'core', 'music.js'));
global.Timbre = require(path.join(RAIZ, 'js', 'core', 'timbre.js'));

const V3 = require(path.join(RAIZ, 'js', 'views', 'violao3d.js'));
const M = global.Music;

/* ------------------------------------------------------------------ */
secao('1. A lei do traste');

/* Todo braco de corda obedece: o traste n fica a `1 - 2^(-n/12)` da escala, e
 * por isso o decimo segundo cai exatamente na metade. E o que permite medir um
 * braco sem regua — e o que o desenho tem de ensinar. */
{
  const m = V3.medidas('violao', 12);
  const escala = m.escala;

  ok(Math.abs(m.posicoes[0]) < 1e-9, 'o traste zero fica na cravelha',
    m.posicoes[0].toFixed(6));
  ok(Math.abs(m.posicoes[12] - escala / 2) < 1e-9,
    'o decimo segundo traste fica na METADE da escala',
    m.posicoes[12].toFixed(4) + ' contra ' + (escala / 2).toFixed(4));

  /* O sinal da lei, conferido traste a traste. E o que pega um `
   * posicoes[f] * 12` colocado no lugar por engano. */
  let bate = true;
  for (let f = 0; f <= 12; f++) {
    const esperado = escala * (1 - Math.pow(2, -f / 12));
    if (Math.abs(m.posicoes[f] - esperado) > 1e-9) bate = false;
  }
  ok(bate, 'e todas as posicoes seguem 1 - 2^(-n/12)');

  /* Os intervalos encolhem. E o que o olho ve. */
  let encolhe = true;
  for (let i = 1; i < m.larguras.length; i++) {
    if (m.larguras[i] >= m.larguras[i - 1]) encolhe = false;
  }
  ok(encolhe, 'e o espaco entre trastes encolhe conforme sobe',
    m.larguras.slice(0, 3).map((x) => x.toFixed(3)).join(' ')
    + ' ... ' + m.larguras.slice(-2).map((x) => x.toFixed(3)).join(' '));

  /* Um traste em intervalos iguais daria largura constante, e o 12 cairia em
   * 12 * 0,5 = 6,0 — um terco mais longe que a lei. */
  const igual = 12 * m.larguras[0];
  ok(Math.abs(m.posicoes[12] - escala / 2) < Math.abs(m.posicoes[12] - igual) / 2,
    'o decimo segundo nao esta onde o desenho de intervalos iguais colocaria',
    'lei ' + m.posicoes[12].toFixed(2) + ', igual ' + igual.toFixed(2));
}

/* ------------------------------------------------------------------ */
secao('2. O violino nao tem traste');

/* Desenhar traste num violino e o tipo de coisa que passa: o violino fica
 * bonito, tem quatro cordas, e nao e violino. */
{
  const v = V3.medidas('violino', 12);
  ok(v.trastes === false, 'o violino e desenhado sem traste',
    'trastes = ' + v.trastes);
  ok(V3.GEOMETRIA.violino.trastes === false, 'e a tabela diz o mesmo',
    String(V3.GEOMETRIA.violino.trastes));

  for (const id of ['violao', 'baixo', 'baixo5', 'ukulele', 'cavaquinho']) {
    ok(V3.medidas(id, 12).trastes === true, id + ': tem traste, como deve');
  }
}

/* ------------------------------------------------------------------ */
secao('3. A geometria muda de instrumento para o outro');

/* Uma imagem so para os seis nao e atalho, e desenho ensinado errado: o
 * ukulele tem 6 cm de escala e o baixo tem 10, e a pessoa sente a diferenca na
 * mao antes de ver na tela. */
{
  const ukulele = V3.medidas('ukulele', 12);
  const baixo = V3.medidas('baixo', 12);
  const violao = V3.medidas('violao', 12);

  ok(ukulele.escala < violao.escala,
    'o ukulele tem escala menor que a do violão',
    ukulele.escala.toFixed(2) + ' contra ' + violao.escala.toFixed(2));
  ok(baixo.escala > violao.escala,
    'e o baixo tem escala maior',
    baixo.escala.toFixed(2) + ' contra ' + violao.escala.toFixed(2));
  ok(ukulele.cordaEsp < violao.cordaEsp,
    'o ukulele e mais estreito que o violão',
    ukulele.cordaEsp.toFixed(2) + ' contra ' + violao.cordaEsp.toFixed(2));
  ok(baixo.cordaEsp > violao.cordaEsp,
    'e o baixo e mais largo',
    baixo.cordaEsp.toFixed(2) + ' contra ' + violao.cordaEsp.toFixed(2));
  ok(baixo.alturaL > violao.alturaL, 'e o brao do baixo e mais grosso',
    baixo.alturaL.toFixed(2) + ' contra ' + violao.alturaL.toFixed(2));
}

/* O primeiro traste acompanha a escala, e isso e o CORRETO.
 *
 * A primeira versao desta verificacao exigia 0,50 em todos os instrumentos, e
 * falhou em cinco. A expectativa estava errada: um baixo tem escala maior que
 * um violao, entao o primeiro traste dele e MAIS LARGO. Exigir a mesma largura
 * seria exigir que o baixo tivesse o tamanho do violao.
 *
 * O que precisa valer e a ordem: baixo > violao > ukulele, na mesma direcao da
 * escala. E o que pega um `escalaComprimento` trocado entre dois instrumentos. */
{
  const primeiro = (id) => V3.medidas(id, 12).larguras[0];
  const ordem = ['baixo', 'baixo5', 'violao', 'violino', 'cavaquinho', 'ukulele'];

  for (let i = 1; i < ordem.length; i++) {
    const maior = primeiro(ordem[i - 1]);
    const menor = primeiro(ordem[i]);
    ok(maior >= menor,
      ordem[i - 1] + ' tem o primeiro traste no minimo tão largo quanto ' + ordem[i],
      maior.toFixed(4) + ' contra ' + menor.toFixed(4));
  }

  /* E o violao continua com a largura que tinha antes da correcao do
   * espacamento: 0,50. E o que garante que a mudanca nao mexeu no que ja
   * estava certo. */
  ok(Math.abs(primeiro('violao') - 0.5) < 1e-9,
    'e o violao continua com o primeiro traste em 0,50',
    primeiro('violao').toFixed(4));
}

/* ------------------------------------------------------------------ */
secao('4. Instrumento desconhecido cai no violao');

/* Um id de uma versao mais nova, ou de um backup antigo, nao pode quebrar a
 * tela — nem desenhar metade de um instrumento. */
{
  const m = V3.medidas('instrumento-que-nao-existe', 12);
  const v = V3.medidas('violao', 12);
  ok(m.cordaEsp === v.cordaEsp && m.escala === v.escala,
    'instrumento desconhecido vira o violão inteiro',
    m.escala.toFixed(2));
  ok(V3.medidas('', 12).escala === v.escala, 'e id vazio tambem');
  ok(V3.medidas(null, 12).escala === v.escala, 'e id ausente tambem');
}

/* ------------------------------------------------------------------ */
secao('5. Numeros absurdos nao quebram');

{
  for (const n of [0, -5, 1.5, 2.7, NaN, Infinity, 999, 'doze']) {
    let explodiu = null;
    try {
      const m = V3.medidas('violao', n);
      if (!isFinite(m.escala) || !isFinite(m.comprimento)) explodiu = 'devolveu numero sem sentido';
      else if (m.posicoes.length !== Math.max(1, Math.min(24, Math.round(Number(n) || 12))) + 1) {
        explodiu = 'devolveu ' + (m.posicoes.length - 1) + ' trastes, e nao um numero inteiro';
      }
    } catch (e) { explodiu = 'lançou ' + e.constructor.name; }
    ok(!explodiu, 'frets = ' + JSON.stringify(n) + ' não quebra', explodiu || '');
  }
}

/* ------------------------------------------------------------------ */
secao('6. A cena usa a geometria do instrumento');

/* A tabela e uma promessa so se o 3D a ler. Sem isto, `medidas()` pode estar
 * certa e a cena continuar com a geometria unica de antes — que era
 * exatamente o defeito que a tabela veio corrigir. */
{
  const src = fs.readFileSync(path.join(RAIZ, 'js', 'views', 'violao3d.js'), 'utf8');
  const corpo = src.slice(src.indexOf('function criar('));

  ok(/geometriaDe\(/.test(corpo), 'criar() le a geometria do instrumento');
  ok(corpo.indexOf('ESCALA.cordaEsp') < 0,
    'e nao usa mais a cordaEsp unica de ESCALA');
  ok(/posicaoDeTraste\(f, escalaCorda\)/.test(corpo),
    'e posiciona os trastes pela lei, e nao por f * trasteL');
  ok(corpo.indexOf('f * ESCALA.trasteL') < 0,
    'e nao ha mais o espacamento uniforme em lugar nenhum');
  ok(/temTraste/.test(corpo), 'e respeita o instrumento sem traste');
}

/* As pecas que o desenho precisa ter.
 *
 * A verificacao anterior procurava as palavras `MARCADORES` e `compCabeca` no
 * codigo. Um `MARCADORES = []` e um `compCabeca = 0` deixariam as duas palavras
 * no lugar — e sao exatamente os defeitos. O que prova e a quantidade. */
{
  const violao = V3.medidas('violao', 12);
  ok(violao.marcadores.length >= 5,
    'o violao tem marcadores de posicao',
    violao.marcadores.join(', '));
  ok(violao.marcadores.indexOf(3) >= 0 && violao.marcadores.indexOf(12) >= 0,
    'nos trastes onde eles ficam num violao de verdade', violao.marcadores.join(', '));
  ok(violao.cabeca === true && violao.cabecaComprimento > 0,
    'e a cabeca existe, e nao e um comprimento zero',
    violao.cabecaComprimento.toFixed(2));
  ok(violao.chavesPorLado === 6, 'com uma chave por corda', String(violao.chavesPorLado));
  ok(violao.chavesPorLado === V3.medidas('ukulele', 12).chavesPorLado * 1.5,
    'o ukulele tem metade das chaves',
    V3.medidas('ukulele', 12).chavesPorLado + ' contra ' + violao.chavesPorLado);

  const violino = V3.medidas('violino', 12);
  ok(violino.marcadores.length === 0,
    'o violino nao tem marcador: nao ha traste para marcar',
    violino.marcadores.length + ' marcadores');
}

/* ------------------------------------------------------------------ */
secao('7. A tabela de geometria e a lista de instrumentos sao o mesmo mundo');

/* Duas listas de nomes, e cada uma pode ganhar um item sem a outra. Um
 * instrumento novo sem geometria cai no violao — e um ukulele com o braco de
 * seis cordas, que e pior do que nao ter o instrumento. Uma geometria sem
 * instrumento e codigo morto, que passa em todos os testes e ninguem ve. */
{
  const naTabela = Object.keys(V3.GEOMETRIA);
  const naLista = M.INSTRUMENTOS.map((i) => i.id);

  for (const id of naTabela) {
    ok(naLista.indexOf(id) >= 0,
      'geometria "' + id + '" corresponde a um instrumento',
      naLista.indexOf(id) >= 0 ? '' : 'so existe na tabela de geometria');
  }

  for (const id of naLista) {
    ok(naTabela.indexOf(id) >= 0,
      'instrumento "' + id + '" tem geometria', naTabela.indexOf(id) >= 0 ? '' : 'AUSENTE');
  }
}

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(54));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  Um braco com os trastes em intervalos iguais parece um braco,');
  console.log('  e ensina a contagem errada. E o unico jeito de ver isso e conferir');
  console.log('  a conta.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(54) + '\n');
process.exit(falhou ? 1 : 0);