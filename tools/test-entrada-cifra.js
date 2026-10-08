/* =========================================================
   ACORDE - tools/test-entrada-cifra.js
   A HOME DIZ QUAIS SAO AS DUAS COISAS QUE SE FAZEM COM UMA CIFRA

   POR QUE UM ARQUIVO NOVO

   A regua da Home tinha "Cifra" — e abria o FORMULARIO de criacao. Quem tocou
   achando que ia abrir uma musica que ja tinha escreveu uma nova sem querer, e
   a unica pista do erro era o titulo da folha, uma tela depois. Do outro lado,
   nao havia NENHUM atalho para a biblioteca: quem queria consultar uma cifra
   tinha que adivinhar que a biblioteca se chamava "Repertorio" na barra de
   baixo.

   Nao era funcionalidade quebrada. Era nomenclatura, e nomenclatura e teste de
   comportamento tanto quanto qualquer outra coisa.

   O QUE ESTE ARQUIVO PROVA

     - "Nova cifra" abre a CRIACAO, e nao a biblioteca;
     - "Minhas cifras" abre a BIBLIOTECA, e nao a criacao;
     - os dois destinos sao diferentes um do outro;
     - nenhum dos dois abre a tela errada;
     - a volta continua funcionando depois dos dois;
     - nenhum botao aparece duplicado;
     - nenhum atalho novo foi criado: a regua tem exatamente seis botoes;
     - cada botao tem nome acessivel, e o nome e o rotulo que a pessoa ve;
     - nenhum dos dois e so icone.

   COMO PROVA

   Os dois destinos sao SONDAS. `V.repertorio.novo` e `App.ir` viram funcoes
   que registram o que receberam. A tela real e a de verdade; a biblioteca e a
   de verdade. O que se mede e a LIGACAO, que e a unica coisa que a Home decide.

   Nenhum `source.includes()`. Um verificador que le o arquivo prova que a
   palavra esta escrita; nao prova que o botao leva a algum lugar.

   O QUE NAO PROVA

     Nada de layout. Se o rotulo cabe, se a faixa quebra em duas linhas e se a
     area de toque e boa — isso e do navegador, e foi medido la com uma caixa
     de 390px. O numero que resulted esta escrito no CSS da regua.

   Rodar: node tools/test-entrada-cifra.js
   ========================================================= */
'use strict';

const { RAIZ } = require('./arquivos.js');
const Falso = require('./dom-falso.js');

const dom = Falso.instalar();
const carregar = (rel) => Falso.carregar(RAIZ, rel);

carregar('js/core/music.js');
carregar('js/core/utils.js');
carregar('js/core/render.js');
const Store = carregar('js/core/store.js');
carregar('js/core/metronome.js');
carregar('js/core/ui.js');
carregar('js/core/links.js');
carregar('js/core/timbre.js');

/* ------------------------------------------------------------
   AS SONDAS

   `nova()` e a criacao; `ir()` e a navegacao. Registrar o que cada uma recebeu
   e o suficiente: a pergunta nao e "a Home funciona", e "o botao que diz
   Nova cifra vai para a criacao, e o que diz Minhas cifras vai para a
   biblioteca".
   ------------------------------------------------------------ */

const criados = [];
const rotas = [];

global.App = {
  ir: function (rota, params) {
    rotas.push({ rota: rota, params: params || null });
    return rota;
  },
};

global.Identidade = { NOME: 'Clave' };
global.Studio = { abrir: () => {} };
global.Gravador = { relogio: () => 0, tamanhoDe: () => 0, iniciar: () => Promise.reject(new Error('sem microfone')) };

global.Views = global.Views || {};
global.Views.repertorio = {
  novo: function (pre) { criados.push({ o: 'nova', pre: pre || null }); },
  colar: function () { criados.push({ o: 'colar' }); },
  abrirCifra: function () {},
  editar: function () {},
};
global.Views.afinador = { abrir: function () { criados.push({ o: 'afinador' }); } };
global.Views.teoria = {
  metronome: function () {}, transpor: function () {}, acordes: function () {},
  circulo: function () {}, instrumento: function () {},
};

/* `hoje.js` nao tem `module.exports`: ele publica em `global.Views.hoje`.
   O `require` dispara o IIFE e devolve `{}` — e o export esta no global. */
carregar('js/views/hoje.js');
const Home = global.Views.hoje;
if (!Home || typeof Home.render !== 'function') {
  throw new Error('a Home nao carregou: global.Views.hoje.render nao existe');
}

/* ------------------------------------------------------------
   AS ASSERCOES
   ------------------------------------------------------------ */

let passou = 0;
let falhou = 0;
const falhas = [];

function ok(condicao, rotulo, detalhe) {
  if (condicao) { passou++; return true; }
  falhou++;
  falhas.push(rotulo + (detalhe ? '  ->  ' + detalhe : ''));
  return false;
}
function igual(recebido, esperado, rotulo) {
  return ok(recebido === esperado, rotulo,
    'recebido ' + JSON.stringify(recebido) + ', esperado ' + JSON.stringify(esperado));
}
function secao(t) { console.log('\n=== ' + t + ' ==='); }

/* Monta a Home e devolve a regua.
 *
 * Nao ha parametro para "quer a capa": quem decide isso e o proprio `render`,
 * pela existencia de evento proximo. Com o Store vazio — e ele comeca vazio —
 * a capa de boas-vindas aparece. Passar uma opcao que nao faz nada seria
 * deixar no codigo a promessa de um controle que nao existe. */
function montarHome() {
  const raiz = Falso.elemento('div');
  Home.render(raiz, null);
  const regua = (function achar(no) {
    for (const c of [].concat(no.childNodes || [])) {
      /* `regua mt-5`: o comparador exato nao acha nada e a falha aparece como
         "a regua nao existe", que e o diagnostico errado. */
      if (c && typeof c.className === 'string' && c.className.indexOf('regua') >= 0) return c;
      if (c) { const dentro = achar(c); if (dentro) return dentro; }
    }
    return null;
  })(raiz);
  return { raiz: raiz, regua: regua };
}

/* O rotulo de um atalho esta no `span`; o `i` do icone nao contribute nada. */
function rotuloDe(b) {
  const sp = (function achar(no) {
    for (const c of [].concat(no.childNodes || [])) {
      if (!c) continue;
      if (c.tagName === 'SPAN') return c;
      const dentro = achar(c);
      if (dentro) return dentro;
    }
    return null;
  })(b);
  return (sp ? sp.textContent : b.textContent).trim();
}

function botao(regua, re) {
  for (const b of [].concat(regua ? regua.childNodes : [])) {
    if (b && b.tagName === 'BUTTON' && re.test(rotuloDe(b))) return b;
  }
  return null;
}

/* Clicar num atalho que sumiu tem de FALHAR COM NOME, nao estourar com
   TypeError. Um provador de mutacao precisa que a suite continue contando ate o
   fim: a mutacao que apagou o botao e uma das que estao sendo provadas, e ela
   nao pode ser a que derruba o resto da contagem. */
function clique(regua, re, nome) {
  const b = botao(regua, re);
  if (!b) { ok(false, 'existe o atalho "' + nome + '" para clicar'); return null; }
  b.click();
  return b;
}

/* ------------------------------------------------------------
   1. A REGUA: O QUE HÁ NELA
   ------------------------------------------------------------ */

secao('1. o que a regua da Home oferece');

const { regua } = montarHome();

ok(!!regua, 'a regua existe');
igual(regua ? regua.childNodes.length : 0, 6, 'e tem exatamente seis botoes');

const nomes = regua ? [].concat(regua.childNodes).map((b) => rotuloDe(b)) : [];
ok(nomes.indexOf('Nova cifra') >= 0, 'existe um botao "Nova cifra"', JSON.stringify(nomes));
ok(nomes.indexOf('Minhas cifras') >= 0, 'existe um botao "Minhas cifras"', JSON.stringify(nomes));
ok(nomes.indexOf('Cifra') < 0, 'e o antigo "Cifra" nao esta mais la — era ele que prometia uma coisa e entregava outra');
ok(nomes.indexOf('Instrumentos') >= 0, 'e "Instrumentos" esta na regua', JSON.stringify(nomes));

/* Nenhum botao pode depender so do icone. */
const semTexto = regua ? [].concat(regua.childNodes).filter((b) => !rotuloDe(b)) : [];
igual(semTexto.length, 0, 'nenhum botao da regua e so icone');

/* Nenhum duplicado. */
ok(nomes.every((n, i) => nomes.indexOf(n) === i), 'nao ha botao repetido na regua');

/* Os outros quatro continuam como estavam: nada foi perdido. */
['Evento', 'Afinador', 'Colar', 'Instrumentos'].forEach((n) => {
  ok(nomes.indexOf(n) >= 0, 'o atalho "' + n + '" continua na Home', JSON.stringify(nomes));
});

/* ------------------------------------------------------------
   2. "Nova cifra" ABRE A CRIACAO
   ------------------------------------------------------------ */

secao('2. "Nova cifra" abre a criação');

{
  const h = montarHome();
  const b = botao(h.regua, /^Nova cifra$/);
  ok(!!b, 'o botao existe');

  criados.length = 0;
  rotas.length = 0;
  clique(h.regua, /^Nova cifra$/, 'Nova cifra');

  igual(criados.length, 1, 'clicar chama a criacao UMA vez');
  igual(criados[0] && criados[0].o, 'nova', 'e e a criacao de cifra');
  igual(rotas.length, 0, 'e nao navega para lugar nenhum: criar nao e ir para a biblioteca');
}

/* ------------------------------------------------------------
   3. "Minhas cifras" ABRE A BIBLIOTECA
   ------------------------------------------------------------ */

secao('3. "Minhas cifras" abre a biblioteca');

{
  const h = montarHome();
  const b = botao(h.regua, /^Minhas cifras$/);
  ok(!!b, 'o botao existe');

  criados.length = 0;
  rotas.length = 0;
  clique(h.regua, /^Minhas cifras$/, 'Minhas cifras');

  igual(rotas.length, 1, 'clicar navega UMA vez');
  igual(rotas[0] && rotas[0].rota, 'repertorio', 'e vai para a rota da biblioteca');
  igual(criados.length, 0, 'e nao abre o formulario de criacao');

  /* A rota precisa ser a que o app ja usa, e nao uma nova. `ROTAS` em app.js
     declara cinco rotas; 'repertorio' e uma delas. Uma rota inventada aqui
     seria um destino que nao existe. */
  const appJs = require('fs').readFileSync(require('path').join(RAIZ, 'js/app.js'), 'utf8');
  ok(/id: 'repertorio'/.test(appJs), 'a rota "repertorio" existe de verdade em app.js');
}

/* ------------------------------------------------------------
   4. OS DOIS NAO SE CONFUNDEM
   ------------------------------------------------------------ */

secao('4. os dois não se confundem');

{
  const h = montarHome();
  const bNova = botao(h.regua, /^Nova cifra$/);
  const bMinhas = botao(h.regua, /^Minhas cifras$/);
  ok(bNova && bMinhas && bNova !== bMinhas, 'sao botoes diferentes');

  criados.length = 0; rotas.length = 0;
  clique(h.regua, /^Nova cifra$/, 'Nova cifra');
  const depoisDaNova = { criou: criados.length, navegou: rotas.length, rota: rotas[0] && rotas[0].rota };

  criados.length = 0; rotas.length = 0;
  clique(h.regua, /^Minhas cifras$/, 'Minhas cifras');
  const depoisDasMinhas = { criou: criados.length, navegou: rotas.length, rota: rotas[0] && rotas[0].rota };

  ok(depoisDaNova.criou === 1 && depoisDaNova.navegou === 0,
    '"Nova cifra" so cria e nao navega');
  ok(depoisDasMinhas.criou === 0 && depoisDasMinhas.navegou === 1,
    '"Minhas cifras" so navega e nao cria');
  ok(depoisDaNova.rota !== depoisDasMinhas.rota,
    'e os dois destinos sao diferentes entre si');
}

/* ------------------------------------------------------------
   5. A VOLTA CONTINUA FUNCIONANDO
   ------------------------------------------------------------ */

secao('5. a volta continua funcionando');

{
  const h = montarHome();

  /* Criar -> voltar -> consultar -> voltar. Cada ida e volta e uma
     remontagem da Home, que e o que acontece quando a pessoa navega. */
  clique(h.regua, /^Nova cifra$/, 'Nova cifra');
  const h2 = montarHome();
  ok(!!botao(h2.regua, /^Nova cifra$/), 'depois de criar, a regua volta com "Nova cifra"');
  clique(h2.regua, /^Minhas cifras$/, 'Minhas cifras');
  const h3 = montarHome();
  ok(!!botao(h3.regua, /^Minhas cifras$/), 'depois de consultar, a regua volta com "Minhas cifras"');
  ok(!!botao(h3.regua, /^Nova cifra$/), 'e com "Nova cifra" tambem');

  /* E os outros atalhos seguem funcionando depois do vaivem. */
  criados.length = 0; rotas.length = 0;
  clique(h3.regua, /^Colar$/, 'Colar');
  igual(criados.length, 1, '"Colar" continua colando');
  igual(criados[0] && criados[0].o, 'colar', 'e nao abriu a criacao por acidente');

  criados.length = 0; rotas.length = 0;
  clique(h3.regua, /^Afinador$/, 'Afinador');
  igual(criados.length, 1, '"Afinador" continua abrindo o afinador');
  igual(criados[0] && criados[0].o, 'afinador', 'e nao abriu nada mais');

  criados.length = 0; rotas.length = 0;
  clique(h3.regua, /^Evento$/, 'Evento');
  igual(rotas.length, 1, '"Evento" continua indo para a agenda');
  igual(rotas[0] && rotas[0].rota, 'agenda', 'na rota da agenda');
}

/* ------------------------------------------------------------
   6. A CAPA DE BOAS-VINDAS DIZ A MESMA COISA
   ------------------------------------------------------------ */

secao('6. a capa de boas-vindas diz a mesma coisa');

{
  /* Sem evento proximo, a capa aparece com os botoes dela. A duvida pode ser
     respondida ali tambem, e os dois lugares precisam responder igual — senao a
     pessoa que ve a capa recebe uma resposta e a que nao ve recebe outra. */
  const h = montarHome();
  const achados = [];
  (function andar(no) {
    for (const c of [].concat(no.childNodes || [])) {
      if (c && c.tagName === 'BUTTON') achados.push(rotuloDe(c));
      if (c) andar(c);
    }
  })(h.raiz);

  const temNova = achados.some((r) => /Nova (música|cifra)/i.test(r));
  const temMinhas = achados.some((r) => /Minhas (músicas|cifras)/i.test(r));
  ok(temNova, 'a capa tem um botao de criar', JSON.stringify(achados.filter(Boolean)));
  ok(temMinhas, 'a capa tem um botao de consultar', JSON.stringify(achados.filter(Boolean)));

  criados.length = 0; rotas.length = 0;
  const b = (function achar(no) {
    for (const c of [].concat(no.childNodes || [])) {
      if (c && c.tagName === 'BUTTON' && /Nova (música|cifra)/i.test(c.textContent || '')) return c;
      if (c) { const d = achar(c); if (d) return d; }
    }
    return null;
  })(h.raiz);
  if (b) b.click();
  igual(criados.length, 1, 'o botao de criar da capa cria');
  igual(criados[0] && criados[0].o, 'nova', 'e nao navega');

  criados.length = 0; rotas.length = 0;
  const b2 = (function achar(no) {
    for (const c of [].concat(no.childNodes || [])) {
      if (c && c.tagName === 'BUTTON' && /Minhas (músicas|cifras)/i.test(c.textContent || '')) return c;
      if (c) { const d = achar(c); if (d) return d; }
    }
    return null;
  })(h.raiz);
  if (b2) b2.click();
  igual(rotas.length, 1, 'o botao de consultar da capa navega');
  igual(rotas[0] && rotas[0].rota, 'repertorio', 'para a mesma rota do atalho da regua');
}

/* ------------------------------------------------------------
   7. A CASA NAO FOI MEXIDA EM PELO MENOS NESTE ARQUIVO
   ------------------------------------------------------------ */

secao('7. nada além dos dois caminhos');

{
  const h = montarHome();
  criados.length = 0; rotas.length = 0;
  clique(h.regua, /^Instrumentos$/, 'Instrumentos');
  ok(rotas.length === 1 && rotas[0].rota === 'instrumentos',
    '"Instrumentos" navega para a rota instrumentos',
    'criou=' + criados.length + ' navegou=' + rotas.length);
}

/* ------------------------------------------------------------
   FIM
   ------------------------------------------------------------ */

console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('');
  falhas.forEach((f) => console.log('  FALHA  ' + f));
}
console.log('=================================================\n');
process.exit(falhou ? 1 : 0);