/* =========================================================
   tools/check-guarda-vs.js
   O CONTRATO DA SAIDA COM GRAVACAO NAO SALVA

   POR QUE UM VERIFICADOR DE CODIGO, E NAO UM DE NAVEGADOR

   O comportamento na tela foi medido no navegador em rodadas anteriores — X,
   Escape, backdrop, dialogo e `closeAllSheets` com pilha real, com
   `MediaRecorder` de verdade. O que o navegador nao cobre e' a REDUCAO: se
   alguem-desaparece o emendo, o navegador continua "funcionando" e ninguem ve,
   porque o defeito so aparece quando um navegador de verdade recusa uma
   gravacao de verdade.

   A SUITE COMPORTAMENTAL (`tools/guarda-navegador.js`) existe e roda o fluxo
   inteiro no navegador. Ela e' a prova ideal. Esta aqui e' a rede de seguranca
   para quando ela nao pode rodar — e a razao de cada regra ser o mais
   ESTRUTURAL possivel: casar com a palavra solta `aoFechar` e o que deixou
   seis de nove protecoes quebradas passarem.

   POR QUE CADA REGRA E' ESCRITA ASSIM

   Nenhuma regra aceita a palavra. Todas apontam para a LINHA que, se apagada,
   abre a falha, e todas as nove tem mutacao correspondente em
   `provar-guarda-vs.js`. Regra sem prova de que acusa e decoracao.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
/* O codigo e lido SEM COMENTARIO: uma regra que casa com um exemplo dentro de
 * um comentario acusa um arquivo cujo codigo esta certo — e ensina a pessoa a
 * ignorar a regra. Foi assim que a regra do "aviso de gravacao" passou com o
 * defeito na V5.6. */
const semComentario = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let passou = 0; let falhou = 0;
const problemas = [];
function ok(cond, titulo, porQue) {
  if (cond) { passou++; console.log('  ok    ' + titulo); }
  else {
    falhou++; problemas.push(titulo);
    console.log('  FALHA ' + titulo);
    if (porQue) console.log('        ' + porQue);
  }
}
const secao = (t) => console.log('\n=== ' + t + ' ===');

const ui = semComentario(ler('js/core/ui.js'));
const palco = semComentario(ler('js/views/palco.js'));
const cancao = semComentario(ler('js/views/cancao.js'));

/* ------------------------------------------------------------------ */
secao('1. O guarda no `close` e\'s o portao, e chega sem condicao falsa');

/* M1 — `if (false && opts.aoFechar)` mantem a palavra e desliga a protecao.
 * Por isso a regra exige a CONDICAO INTEIRA, e nao o nome dela. */
ok(/if \(!forcado && opts\.aoFechar\) \{/.test(ui),
  'o guarda e\' testado pela condicao, e nao pelo nome',
  'Procurar so `opts.aoFechar` passa com `false && opts.aoFechar` — foi assim '
  + 'que M1 escapou. A protecao precisa estar ALCANCADA, e nao citada.');
ok(/return false;/.test(ui) && /if \(ok\) fechar\(\)/.test(ui),
  'o guarda nega na hora e so fecha depois da resposta',
  'Um guarda que so responde com Promise deixa o X fechar antes da resposta.');

/* ------------------------------------------------------------------ */
secao('2. Cada porta passa pelo `close`');

/* M2 — o X tem um bloco de comentario entre o atributo e o `onclick`. Por isso
 * a janela e' de 400 e nao de 160: com 160, a regra acusava um arquivo certo
 * por causa da distancia. */
ok(/'aria-label': 'Fecher'|'aria-label': 'Fechar'[\s\S]{0,400}?onclick: \(\) => close\(\)/.test(ui),
  'o X fecha pelo `close`',
  'O X foi a unica porta que ignorava o guarda: `dismissible` protegia Escape '
  + 'e backdrop, e nao o botao. Fechar por Escape era a unica maneira de NAO fechar.');

/* M3 — a linha inteira, nao uma janela: `onKey` tem mais de um `close` no
 * arquivo, e a janela de 400 pegava o do backdrop. */
ok(/sheetStack\[sheetStack\.length - 1\] === handle\) \{ ev\.stopPropagation\(\); close\(\); \}/.test(ui),
  'o Escape fecha pelo `close`, na linha certa',
  'Uma janela de 400 caracteres em volta de `onKey` casava tambem com o `close` '
  + 'do backdrop — a regra olhava o lugar errado e via o certo.');
ok(/ev\.target === scrim && opts\.dismissible !== false\) close\(\)/.test(ui),
  'o backdrop fecha pelo `close`');

/* ------------------------------------------------------------------ */
secao('3. closeAllSheets para no primeiro veto');

/* M4 — o veto chega em duas formas, e as DUAS precisam parar a varredura.
 *
 * So com `false` a regra passava: um veto assincrono — que e' o caso de
 * verdade, porque perguntar involves um dialogo — nao casava, e a folha de baixo
 * fechava. Medido no navegador: a mesa fechava e a gravacao ficava orfa. */
ok(/if \(resposta === false \|\| \(resposta && typeof resposta\.then === 'function'\)\) break;/.test(ui),
  'closeAllSheets para no veto sincrono E no assincrono',
  'Medido no navegador com a pilha [Mesa, Gravar a narração, Folha C]: com o '
  + 'teste so em `false`, a mesa fechava e a gravacao ficava orfa sobre uma '
  + 'tela onde a mesa nao existia mais. O break estava no lugar certo e nao '
  + 'disparava, porque a condicao via metade do caso.');
ok(/reverse\(\)/.test(ui), 'e desce de cima para baixo',
  'De cima para baixo, a folha que recusa vem antes de tudo que dependia dela.');
ok(/function\s+close\(forcado\)[\s\S]{0,900}?return true;/.test(ui),
  'o `close` diz se fechou ou se recusou',
  'Sem o retorno, `closeAllSheets` nao tem como saber que alguem falhou.');

/* ------------------------------------------------------------------ */
secao('4. As DUAS folhas usam o mesmo contrato');

for (const [nome, fonte] of [['palco.js', palco], ['cancao.js', cancao]]) {
  ok(/aoFechar: function \(\) \{ return perguntarAoSair\(\); \},/.test(fonte),
    nome + ' protege a saida com o diálogo',
    'Duas implementacoes que respondem diferente ao mesmo defeito: a pessoa '
    + 'perde o audio justamente na que nao perguntou.');
  ok(/Tentar salvar de novo[\s\S]{0,200}Fazer backup[\s\S]{0,200}Continuar aqui[\s\S]{0,200}Sair e descartar/.test(fonte),
    nome + ' oferece as quatro saidas, na ordem do argumento',
    'A ordem e o argumento: salvar, preservar, e so no fim descartar.');
}

/* ------------------------------------------------------------------ */
secao('5. Descarte apaga nos dois lados');

/* M5 — o bug real do V5.8. `f.vs = ''` sozinho nao descarta nada.
 *
 * A sentenca aparece em DOIS lugares — no diálogo e no botão "Descartar" da
 * mesa. Contar presenca nao serve: removendo um, o outro ainda casava e a
 * mutacao passava. Por isso a regra e' ancorada no ramo do diálogo, que e' o
 * caminho que a pessoa percorre ao tentar sair. */
ok(/resposta === 'descartar'[\s\S]{0,900}?salvarFicha\(\{ vs: '', vsSeg: 0 \}\)/.test(palco),
  'palco.js descarta passando por `salvarFicha`, no ramo do diálogo',
  'Limpar so `f.vs` deixa o audio no objeto da Store, e a mesa que reabrir '
  + 'mostra a mesma narracao que a pessoa acabou de descartar.');
/* Os dois pontos de descarte: o diálogo e o botão da mesa. Contar as duas.
 *
 * A segunda versao desta regra procurava `'Descartar'` DEPOIS do `salvarFicha`,
 * e no arquivo o texto do botão vem depois da função — ou seja, a ordem está
 * invertida e a regra acusava o codigo certo. Contarocorrencias nao tem ordem
 * nenhuma para se enganar, e é o que importa aqui: os dois pontos existem. */
const pontosDescarte = (palco.match(/salvarFicha\(\{ vs: '', vsSeg: 0 \}\)/g) || []).length;
ok(pontosDescarte >= 2,
  'e tambem no botão Descartar da mesa — os dois pontos existem',
  'Um so deixa um caminho de descarte sem efeito: a pessoa apaga o que a tela '
  + 'mostra, e a mesa que reabrir traz a narracao de volta.');
ok(/musica\.vs = ''/.test(cancao),
  'cancao.js descarta no proprio objeto, que ja e' + ' o da Store',
  'Aqui `musica` vem de `Store.cifras()`, entao o campo e o objeto certo.');
for (const [nome, fonte] of [['palco.js', palco], ['cancao.js', cancao]]) {
  ok(/descartar[\s\S]{0,700}?pendenteDeSalvar = false/.test(fonte),
    nome + ' o descarte limpa a pendência',
    'Descartar sem limpar a pendencia faria a proxima saida perguntar de novo.');
}

/* ------------------------------------------------------------------ */
secao('6. Retentativa e sucesso');

/* M6 — a sentenca exata do `close` seguida da limpeza. Mutar e' inserir
 * `Gravador.iniciar()` no MEIO dessa janela. */
const ramoRetry = /if \(pendenteDeSalvar\) \{[\s\S]{0,800}?pendenteDeSalvar = false;/.exec(palco);
ok(!!ramoRetry, 'existe um ramo que recomeca quando ha pendência');
ok(!!ramoRetry && !/Gravador\.iniciar/.test(ramoRetry[0]),
  'esse ramo nao abre o microfone',
  'Com o microfone aberto de novo, o `getUserMedia` sobe para 2 e a voz nova '
  + 'fica por cima da que nao coube. Medido: 1 chamada em todos os caminhos.');

/* M7 — as tres linhas em sequencia. `pendenteDeSalvar = false` existe em varios
 * lugares do arquivo; o que importa e' que venham DEPOIS do `S.gravar()` da
 * retentativa e logo antes do `resetar()`. */
ok(/S\.gravar\(\);\r?\n\s*const erro2 = S\.ultimoErro\(\);[\s\S]{0,700}?return;\r?\n\s*\}\r?\n\s*pendenteDeSalvar = false;\r?\n\s*dicaFalha\.textContent = '';\r?\n\s*resetar\(\);/.test(palco),
  'a pendência so e' + ' limpa DEPOIS do save responder bem',
  'Limpar antes do `S.gravar()` seria o defeito do V5.6 de novo: anunciando '
  + 'sucesso sobre uma escrita que nao aconteceu.');
ok(/function tentarSalvarNaMesa[\s\S]{0,700}?return false;[\s\S]{0,300}?return true;/.test(palco),
  'a mesa so anuncia e fecha depois do sucesso confirmado');
/* E a mesa nao chama `f.vs` para dizer que esta gravada. */
ok(/const soNaMemoria = !!voz && !vsEstaSalvo\(\);/.test(palco),
  'a mesa pergunta ao disco se o audio foi salvo',
  '`!!f.vs` respondia a duas perguntas — "esta gravada?" e "esta salva?" — '
  + 'com o mesmo campo. Sao coisas diferentes.');

/* ------------------------------------------------------------------ */
secao('7. beforeunload entra e sai');

ok(/addEventListener\('beforeunload', avisaAntesDeSair\)/.test(palco)
  && /addEventListener\('beforeunload', avisaAntesDeSair\)/.test(cancao),
  'as duas folhas registram o aviso de recarregar');
ok(/removeEventListener\('beforeunload', avisaAntesDeSair\)/.test(palco)
  && /removeEventListener\('beforeunload', avisaAntesDeSair\)/.test(cancao),
  'as duas folhas tiram o aviso quando fecham',
  'Listener vazado pergunta "tem gravacao nao salva?" para sempre — inclusive '
  + 'depois de a gravacao estar salva. E aviso que mente.');
ok(/if \(!pendenteDeSalvar\) return true/.test(palco),
  'sem pendência, a folha sai sem perguntar',
  'Perguntar a quem nao tem nada a perder e a forma mais rapida de ensinar '
  + 'alguem a clicar em sair sem ler.');

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(58));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  "Nao foi salva" que a pessoa nao le e um bug silencioso com tela.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(58) + '\n');
process.exit(falhou ? 1 : 0);