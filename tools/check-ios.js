/* =========================================================
   tools/check-ios.js
   As regras do iPhone, escritas uma vez para nao voltar.

   POR QUE ESTE ARQUIVO EXISTE

   Nenhuma das diferencas do iOS aparece num SyntaxError, e nenhuma delas
   aparece no Chrome de mesa. Elas aparecem no aparelho da pessoa: o backup
   que nao baixa, o seletor de arquivo vazio, a pagina que da zoom quando
   ela toca num campo, o conteudo que fica embaixo da barra de status.

   E todas sao silenciosas. O codigo "funciona", o teste passa, e a pessoa
   perde o repertorio. Por isso as regras ficam aqui, escritas, em vez de na
   memoria de alguem.

   -------------------------------------------------------------
   UMA ARMADILHA QUE ESTE ARQUIVO JA CAIU

   O `Utils` tem, num comentario, o codigo ANTIGO do download:

       setTimeout(() => URL.revokeObjectURL(url), 100);

   E uma regra que procurasse esse padrao no arquivo inteiro acharia o
   comentario e diria que o defeito voltou — sendo que o defeito foi
   consertado. Pior no outro sentido: uma regra fraca demais passaria porque
   o texto certo esta em comentario.

   Entao TODA regra de codigo aqui roda sobre o texto sem comentarios.
   Nao e capricho: e o que separa "o codigo faz isto" de "alguem escreveu
   sobre isto".

   A LEI DO PROJETO: um verificador que nunca falha e ignorado. Cada regra
   daqui foi provada reintroduzindo o defeito — o script que faz isso e
   `tools/provar-ios.js`, e ele ja reprovou 8 de 16 na primeira rodada.
   ========================================================= */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

function ler(rel) {
  return fs.readFileSync(path.join(RAIZ, rel), 'utf8');
}

/* O codigo sem comentarios.
 *
 * Uma string dentro do codigo e conservada de proposito: a regra do `accept`
 * precisa ler o valor da constante, e esse valor vive numa string. O que sai
 * sao os comentarios, que e onde o codigo velho foi parar. */
function semComentario(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, function (m) { return new Array(m.length + 1).join(' '); })
    .replace(/(^|[^:'"\\])\/\/[^\r\n]*/g, function (m, p1) { return p1; });
}

const CSS = ['css/base.css', 'css/components.css', 'css/features.css'];
const css = CSS.map((f) => ({ nome: f, texto: ler(f), codigo: semComentario(ler(f)) }));
const html = ler('index.html');
const manifest = ler('manifest.webmanifest');
const utils = semComentario(ler('js/core/utils.js'));
const ajustes = semComentario(ler('js/views/ajustes.js'));
const armazenamento = semComentario(ler('js/core/armazenamento.js'));
const ui = semComentario(ler('js/core/ui.js'));

let passou = 0;
let falhou = 0;
const problemas = [];

function ok(cond, titulo, porque) {
  if (cond) {
    passou++;
    console.log('  ok    ' + titulo);
  } else {
    falhou++;
    problemas.push(titulo);
    console.log('  FALHA ' + titulo);
    if (porque) console.log('        ' + porque);
  }
}

function secao(t) {
  console.log('\n=== ' + t + ' ===');
}

/* ------------------------------------------------------------------ */
secao('1. O que o iOS exige no <head>');

/* `viewport-fit=cover` diz ao iOS que a pagina desenha embaixo da barra de
 * status e do entalhe. Sem ele, o `env(safe-area-inset-*)` vale zero e o
 * app fica com o botao de cima grudado no relogio. */
ok(/viewport-fit=cover/.test(html), 'a pagina desenha ate o entalhe (viewport-fit=cover)',
  'Sem isso, o safe-area vale zero e o topo fica sob a barra de status.');

ok(/apple-mobile-web-app-status-bar-style/.test(html), 'a barra de status do app instalado e tratada',
  'Sem a meta, o app instalado no iPhone fica com a barra do sistema por cima do conteudo.');

ok(/apple-mobile-web-app-capable/.test(html), 'o app abre sem barra de endereco quando instalado',
  'Sem a meta, o icone na tela de inicio abre o Clave dentro do Safari.');

ok(/rel="apple-touch-icon"/.test(html), 'o iPhone tem icone proprio na tela de inicio',
  'O iOS ignora o icone do manifesto e usa o apple-touch-icon. Sem ele, mostra um recorte da pagina.');

ok(/-webkit-text-size-adjust:\s*100%/.test(css[0].codigo), 'o iOS nao infla a fonte por conta propria',
  'Sem isso, o Safari aumenta o texto e quebra o layout ao girar o aparelho.');

ok(!/user-scalable\s*=\s*no/.test(html), 'a pessoa pode dar zoom, e um app de cifra precisa disso',
  'O zoom nao pode ser bloqueado: e a forma de ler a cifra miuda no palco.');

/* ------------------------------------------------------------------ */
secao('2. O entalhe, a barra e a area de toque');

/* Com `viewport-fit=cover`, todo elemento FIXO colado embaixo ou em cima
 * precisa de `env(safe-area-inset-*)`.
 *
 * A regra aponta para o seletor, e nao para o arquivo inteiro. Testar
 * "a string safe-area-inset-bottom existe em algum lugar" foi a primeira
 * versao, e ela nao distingueva nada: existem duas ocorrencias da string,
 * entao apagar uma nao acusava nada, e apagar a errada passava. Uma regra
 * que olha o arquivo inteiro aceita qualquer arquivo. */
/* `seletor` chega CRU e e escapado aqui dentro.
 *
 * A primeira versao passava `'.bottomnav'` — ja escapado — e esta funcao
 * escapava de novo. O padrao virava "literal backslash seguido de qualquer
 * caractere", que nao casa com nada: as tres regras de safe-area acusaram
 * defeito num arquivo que estava certo. Um verificador que acusa o que esta
 * bom tambem nao serve — ele treina a pessoa a ignorar as tres. */
function seletorTem(arquivo, seletor, trecho) {
  const c = css.find((x) => x.nome === arquivo);
  if (!c) return false;
  const re = new RegExp('(^|[,{}])\\s*' + seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    + '\\s*(,[^{]*)?\\{([^}]*)\\}', 'g');
  let m;
  while ((m = re.exec(c.codigo))) {
    if (new RegExp(trecho).test(m[3])) return true;
  }
  return false;
}

/* O que levanta o conteudo e o PADDING, nao a altura.
 *
 * A regra acceptava qualquer mencao a `safe-area-inset-bottom` dentro da regra
 * do elemento. E a barra tem as duas: `height: calc(var(--nav-h) +
 * env(safe-area-inset-bottom))` e `padding-bottom: env(safe-area-inset-bottom)`.
 * Apagando so o padding, a string continuava na altura e a regra passava — e o
 * elemento ficava mais alto com o conteudo encostado embaixo, ou seja,
 * exatamente o defeito que a regra existe para pegar.
 *
 * Uma barra mais alta, com o conteudo no topo dela, tem o conteudo sob o
 * indicador do iPhone. O que resolve e o padding. */
ok(seletorTem('css/features.css', '.bottomnav', 'padding[^;]*env\\(safe-area-inset-bottom\\)'),
  'a barra de navegacao tira o conteudo de cima do indicador do iPhone',
  'Sem padding com safe-area, a barra pode ser alta e mesmo assim ter o conteudo embaixo do '
  + 'indicador do iPhone — e o botao nao recebe o toque.');

ok(seletorTem('css/features.css', '.topbar', 'safe-area-inset-top'),
  'a barra de cima respeita o entalhe e o relogio',
  'Sem isso, o conteudo do topo fica embaixo do entalhe do iPhone.');

ok(seletorTem('css/components.css', '.sheet', 'safe-area-inset-bottom'),
  'a folha que sobe tambem respeita o indicador',
  'A sheet e a forma mais comum de o dedo chegar na acao; perder o rodape dela e perder o botao.');

/* `100vh` no iOS e a altura com a barra de endereco RECOLHIDA — a maior
 * possivel. Usar isso para "tela inteira" deixa a pagina mais alta que a tela
 * visivel, e o rodape fica embaixo da barra do navegador. `dvh` e o valor
 * certo para isso.
 *
 * A regra e especifica de proposito: NAO e "nenhum vh".
 *
 * A primeira versao proibia qualquer `vh`, e ela estava errada. A caixa da
 * cifra usa `46vh` com `min-height: 220px` e `max-height: 420px`: com os dois
 * limites, o valor do vh fica sempre dentro da faixa, entao o iOS nao muda
 * nada ali. E trocar por `dvh` seria um PIOR: a caixa mudaria de altura cada
 * vez que a barra de endereco aparecesse, e a linha da cifra pularia no meio da
 * leitura.
 *
 * Ou seja: `dvh` e certo para "preencher a tela", e e ruim para "uma fracao
 * estavel". So o primeiro caso e defeito. */
const usaVhInteiro = [];
for (const c of css) {
  c.codigo.split('\n').forEach((l, i) => {
    if (/(?<![\w-])100vh(?![\w-])/.test(l) && !/min-height|max-height|clamp/.test(l)) {
      usaVhInteiro.push(c.nome + ':' + (i + 1));
    }
  });
}
ok(usaVhInteiro.length === 0, 'nenhum lugar usa 100vh como "tela inteira"',
  'No iOS, 100vh e a altura com a barra de endereco escondida: a pagina fica maior que a tela e o '
  + 'rodape some. Use dvh. Em: ' + usaVhInteiro.join(', '));

let semPrefixo = false;
for (const c of css) {
  if (/backdrop-filter:/.test(c.codigo) && !/-webkit-backdrop-filter/.test(c.codigo)) semPrefixo = true;
}
ok(!semPrefixo, 'todo backdrop-filter tem o prefixo do Safari',
  'Sem -webkit-backdrop-filter, a barra de cima e a de baixo ficam sem o vidro no iOS.');

/* ------------------------------------------------------------------ */
secao('3. O backup: a unica rede de seguranca do repertorio');

/* O `accept` do seletor de arquivo e onde o iOS trava o resgate.
 *
 * O iOS nao filtra por extensao: filtra pelo que o PROPRIO iOS reconhece. E o
 * WebKit avisa (bug 279606) que "se nenhuma extensao for suportada, nenhum
 * arquivo pode ser selecionado". Um seletor vazio, para quem esta tentando
 * recuperar o repertorio, e indistinguivel de "o backup nunca existiu".
 *
 * A regra le o VALOR da constante, e nao o arquivo. A primeira versao procurava
 * `application/octet-stream` no `ajustes.js` inteiro, e o nome aparecia duas
 * vezes no comentario que explica a regra — entao apagar o valor de verdade
 * passava sem acusa. */
const acceptBackup = /ACEITE_BACKUP\s*=\s*'([^']*)'/.exec(ajustes);
ok(!!acceptBackup, 'o accept do backup esta numa constante nomeada',
  'Sem a constante, a regra do octet-stream nao tem onde olhar.');
ok(!!acceptBackup && /application\/octet-stream/.test(acceptBackup[1]),
  'o seletor do backup tem a rede de seguranca do iOS (application/octet-stream)',
  'Sem application/octet-stream no accept, o iOS pode nao oferecer NENHUM arquivo selecionavel '
  + '(bug 279606 do WebKit). O filtro de extensao no iOS e so sugestao — quem filtra de verdade e o app.');

/* E o app tem de filtrar de verdade, porque o octet-stream deixa passar tudo. */
ok(/!\s*\/\s*\\\.json\$\/i\.test\(\s*f\.name/.test(ajustes) || /\\\.json\$\/i\.test\(\s*f\.name/.test(ajustes),
  'o app confere a extensao do backup em vez de confiar no accept',
  'Com octet-stream no accept, qualquer arquivo passa. Sem a conferida no codigo, a pessoa escolhe '
  + 'a foto errada e recebe um erro em vez do repertorio.');

/* O download precisa oferecer o caminho nativo do iOS. O ancor com `blob:` e
 * serrilha: o Safari ABRE o arquivo em vez de salvar, quando reconhece o
 * tipo. E `navigator.share` com arquivo e o caminho que o iOS espera. */
ok(/navigator\.share\s*\(\s*\{[^}]*files/.test(utils),
  'a entrega de arquivo oferece a partilha nativa do iOS, com arquivo anexado',
  'Sem navigator.share com arquivos, o iPhone pode so abrir uma previa do backup em vez de salvar.');

/* Revogar a URL do blob cedo quebra o download. O download e assincrono.
 *
 * A regra mede o ATRASO do agendamento, e nao a presenca da chamada. A primeira
 * versao usava um padrao que nao atravessava a quebra de linha do corpo do
 * `setTimeout`, entao nao casava nem com o codigo certo nem com o errado. */
const revogacoes = [];
{
  const re = /setTimeout\(([\s\S]{0,400}?revokeObjectURL[\s\S]{0,200}?),\s*(\d+)\s*\)/g;
  let m;
  while ((m = re.exec(utils))) revogacoes.push(Number(m[2]));
}
ok(revogacoes.every((ms) => ms >= 10000),
  'a URL do blob nao e revogada em poucos milissegundos',
  'revokeObjectURL em 100 ms corta o download pela metade: o navegador ainda esta lendo o blob. '
  + 'Atrasos vistos: ' + JSON.stringify(revogacoes));

/* O backup nao pode se declarar feito sem saber. E o que desliga o aviso de
 * "faz N dias sem backup". */
const exporta = /function exportar\(\)[\s\S]*?\n {2}\}/.exec(ajustes);
ok(!!exporta && /\.then\(/.test(exporta[0]), 'o backup espera o resultado antes de se declarar salvo',
  'Marcar o backup como feito sem saber se o arquivo saiu desliga o aviso de risco — '
  + 'e o app passa a calar justamente quem nunca fez copia.');
ok(!!exporta && exporta[0].indexOf('.then(') >= 0
  && exporta[0].indexOf('Backup salvo') > exporta[0].indexOf('.then('),
  'e a frase "Backup salvo" so aparece depois da resposta',
  'A versao antiga nao tinha `.then`: a frase saia na mesma linha do `download`, antes de qualquer '
  + 'resposta.');
ok(!!exporta && /acao\s*:\s*function/.test(exporta[0]),
  'no caminho da partilha, o app pergunta se a pessoa guardou',
  'A folha de partilha pode ser cancelada ou mandada para o lugar errado. Declarar "backup salvo" '
  + 'ali e mentir, e o preco e desligar o aviso.');

/* A data so pode ser gravada DEPOIS da resposta.
 *
 * Esta e a regra que mais importa do arquivo inteiro, e ela nao pode ser
 * escrita como "o texto `.then` existe": a versao antiga nao tinha `.then`
 * nenhum, e uma regra que so procurasse a frase em algum lugar acabaria
 * aceitando o codigo errado. O que conta e a POSICAO — nenhuma chamada de
 * `marcarBackup` pode ficar antes do tratamento do resultado. */
ok(!!exporta && exporta[0].indexOf('.then(') >= 0
  && exporta[0].slice(0, exporta[0].indexOf('.then(')).indexOf('marcarBackup') < 0,
  'a data do backup so e gravada depois da resposta, e nunca antes',
  'Gravar a data antes da resposta e o defeito real desta frente: o app desligava o aviso de '
  + '"faz N dias sem backup" sem saber se o arquivo tinha saido. E quem mais sofre com isso e '
  + 'justamente quem nunca fez backup.');

/* ------------------------------------------------------------------ */
secao('4. O iOS e o que ele nao tem');

/* `navigator.vibrate` nao existe no iOS — nem no iPad. A chamada tem de ser
 * guardada, senao o app quebra no primeiro toque. */
ok(/if\s*\(\s*navigator\.vibrate\s*\)/.test(ui), 'a vibracao tátil e guardada, porque o iOS nao tem essa API',
  'No iOS, navigator.vibrate nao existe. Chamar sem guardar e TypeError no primeiro toque.');

/* ------------------------------------------------------------------ */
secao('4b. Quando a gravacao falha, alguem tem de avisar');

/* O `Store.salvar()` devolve `false` e emite `'erro'` ou `'cota'` quando o
 * navegador recusa a escrita. Sem um assinante desses dois eventos, a falha
 * some: a pessoa ve o que digitou na tela, fecha o app, e o nome nao estava em
 * lugar nenhum.
 *
 * E o iPhone e onde isso acontece primeiro — cota de cerca de 5 MB, e uma
 * gravacao de faixa cabe ate 4 MB. Uma so gravacao, e o espaco inteiro.
 *
 * A regra exige as tres coisas: escutar o evento, traduzir em frase, e saber a
 * causa. Escutar sem frase e meio conserto; saber a causa sem usar e codigo
 * morto. */
const app = semComentario(ler('js/app.js'));
const store = semComentario(ler('js/core/store.js'));

/* A janela vai ate o FECHAMENTO do bloco, e nao ate o primeiro parentese.
 *
 * A primeira versao usou `[\s\S]{0,400}?\)` e parou no `)` de
 * `function (tipo)` — a regra acusou um app que estava ouvindo a falha
 * corretamente. Um verificador que acusa o que esta certo treina a pessoa a
 * ignorar a regra, que e justamente o que ela existe para evitar. */
const assina = /S\.assinar\(([\s\S]{0,700}?)\n {4}\}\);/.exec(app);
ok(!!assina && /'erro'/.test(assina[1]) && /'cota'/.test(assina[1]),
  'o app escuta a falha de gravacao, e nao so a mudanca',
  'Sem assinar "erro" e "cota", o Store avisa que a gravacao falhou e ninguem escuta. A tela '
  + 'continua mostrando o que o armazenamento recusou.');

/* A janela vai ate o FECHAMENTO da funcao, e nao por um numero de caracteres.
 *
 * A primeira versao lia `[\s\S]{0,900}` e o `UI.toast` ficava alem do limite,
 * por causa do comentario do meio da funcao. A regra passou com a frase
 * comentada — que e o jeito mais comum de um aviso ser desligado "so por
 * enquanto" e nunca mais voltar. */
const corpoAviso = /function avisarFalhaAoSalvar\([^)]*\)\s*\{[\s\S]*?\n {2}\}/.exec(app);
ok(!!corpoAviso && /UI\.toast\(/.test(corpoAviso[0]),
  'a falha vira uma frase na tela, e nao so um evento',
  'Um evento sem frase e um evento que ninguem ve. Uma frase comentada e o jeito mais comum de um '
  + 'aviso ser desligado "so por enquanto" e nunca mais voltar.');

/* A causa tem de SAIR do Store e CHEGAR na tela.
 *
 * A primeira versao procurava a palavra `ultimoErro` nos dois arquivos, e ela
 * existe em `let ultimoErro = null` dentro do proprio Store. Apagar a
 * EXPORTACAO nao mudava nada na regra, e a regra passou com o conserto undone.
 * O que importa e o `ultimoErro:` na exportacao e o `S.ultimoErro()` na tela. */
ok(/ultimoErro:\s*function/.test(store) && /S\.ultimoErro\s*\(/.test(app),
  'a tela sabe POR QUE a gravacao falhou',
  '"Cheio" e "erro" pedem respostas diferentes: um apaga gravacao antiga, o outro nao se resolve '
  + 'com espaco. Sem a causa exportada, a tela so sabe que algo deu errado.');

/* ------------------------------------------------------------------ */
/* ---- E O LADO QUE NINGUEM OLHAVA ---- */

/* ESTA REGRA EXISTE PORQUE A ANTERIOR PASSOU COM O DEFEITO
 *
 * As tres regras acima verificam o assinante GLOBAL: existe alguem em
 * `app.js` que escuta 'erro' e 'cota' e vira frase. Isso e verdade, e estava
 * verdade quando a gravacao da faixa se perdia em silencio.
 *
 * O que elas nao olhavam era o CAMINHO DA GRAVACAO, em `cancao.js`, que e um
 * outro arquivo e nao passa por `avisarFalhaAoSalvar`. La, o codigo era:
 *
 *     aoMudar();                 // o retorno e' ignorado
 *     h.close();                 // a folha fecha
 *     UI.toast('Faixa gravada')  // verde: sucesso
 *
 * O armazenamento recusava, `ultimoErro` virava 'cheio' no Store, e o toast
 * verde dizia "Faixa gravada" para um audio que existia so na memoria. Quem
 * perdia nao era o app: era a pessoa, que falou tres minutos e recebeu um
 * "gravado". E o aviso verde era pior que a perda — era o oposto da verdade.
 *
 * O que a regra exige, entao, e o que o DEFEITO tinha:
 *
 *   1. o resultado do save e' lido ANTES do aviso de sucesso;
 *   2. existe um caminho que diz que NAO foi salva;
 *   3. existe uma retentativa que nao regrava por cima do audio. */
const cancao = semComentario(ler('js/views/cancao.js'));
const iSave = cancao.indexOf('aoMudar();');
const iOk = cancao.indexOf("'Faixa gravada — ");

ok(iSave >= 0 && iOk > iSave,
  'a folha de gravacao mostra sucesso DEPOIS de tentar salvar',
  'Sem este par na ordem certa na ha como exigir que o resultado foi olhado antes do aviso.');

/* A REGRA PRECISA LER O RESULTADO — E "PRECISA" AQUI E LITERAL
 *
 * A primeira versao desta regra aceitava qualquer `ultimoErro(` que aparecesse
 * entre o save e o toast. A janela entre os dois tem cerca de 7 KB e cabe mais
 * do que um `ultimoErro`; a regra passava com o defeito de volta no lugar, que
 * e o jeito mais facil de uma regra nao ver nada.
 *
 * A versao que pegou o defeito exige o PAR: o erro lido de `S.ultimoErro()`,
 * guardado num `erro`, e um `naoSalvou` derivado dele. Apaga esse par — como o
 * codigo antigo fazia, com `const naoSalvou = false` — e a regra acusa. */
ok(/const\s+erro\s*=\s*typeof\s+S\.ultimoErro/.test(cancao)
  && /const\s+naoSalvou\s*=\s*erro\s*===\s*'cheio'\s*\|\|\s*erro\s*===\s*'erro'/.test(cancao)
  && /if\s*\(\s*naoSalvou\s*\)/.test(cancao),
  'o resultado do save e lido antes do "Faixa gravada"',
  'O codigo antigo chamava aoMudar(), ignorava o retorno, e mostrava "Faixa gravada" em verde. '
  + 'A pessoa via sucesso para um audio que o armazenamento tinha recusado — e o aviso verde '
  + 'era mais danoso que a perda, porque dizia o oposto da verdade.');

/* A retentativa precisa ser uma RETENTATIVA.
 *
 * A primeira versao procurava o IDENTIFICADOR `pendenteDeSalvar`, e ele aparece
 * na declaracao e em duas atribuicoes — de modo que apagar a guarda do botao nao
 * derrubava a regra. A mutacao de teste provou isso. A regra agora exige a
 * guarda que faz o trabalho. */
ok(/function\s+tentarSalvar/.test(cancao)
  && /if\s*\(\s*pendenteDeSalvar\s*\)\s*\{\s*tentarSalvar\(\);/.test(cancao),
  'o botao de retentativa nao regrava por cima do audio',
  'Depois de falhar, o botao ficava com o texto "Tentar salvar de novo" e, com o microfone livre, '
  + 'caia em comecar() — abria o microfone e GRAVAVA POR CIMA dos tres minutos recem-falados. '
  + 'O aviso estava certo e o botao mentia.');

/* E a retentativa tem que LER o erro DEPOIS de tentar salvar.
 *
 * `ultimoErro` e' definido pelo proprio `aoMudar`. Ler antes — ou nao ler —
 * faz a retentativa dizer que deu certo sem nunca ter tentado nada. A ordem
 * importa, e por isso a regra compara as duas posicoes dentro do corpo da
 * funcao, em vez de procurar a palavra solta pelo arquivo. */
const corpoTentar = /function\s+tentarSalvar\(\)\s*\{([\s\S]*?)\n {4}\}/.exec(cancao);
const iTenta = corpoTentar ? corpoTentar[1].indexOf('aoMudar();') : -1;
const iLeErro = corpoTentar ? corpoTentar[1].indexOf('ultimoErro') : -1;
ok(!!corpoTentar && iTenta >= 0 && iLeErro > iTenta,
  'a retentativa sobrescreve o que o save respondeu',
  'O erro de gravacao e' + ' definido pelo proprio save. Lido antes, ele descreve a tentativa '
  + 'anterior: a retentativa anunciava sucesso sem ter tentado nada.');

/* E precisa existir uma frase que diga que NAO salvou.
 *
 * Um caminho de erro que nao diz nada nao e caminho de erro — e a pessoa so ve
 * o verde. Esta e a unica regra do arquivo que olha o texto da tela, e e
 * deliberada: o contrato com a pessoa e' "esta gravacao ficou guardada ou nao",
 * e nao ha como provar isso olhando o codigo ao redor. */
ok(/NÃO foi salva|Não foi salva|nao foi salva/.test(cancao),
  'a tela diz, com palavras, que a gravacao nao foi salva',
  'Sem essa frase, o unico aviso que a pessoa ve e o verde de sucesso, e ela acredita que o '
  + 'audio esta guardado quando nao esta.');

/* ------------------------------------------------------------------ */
secao('5. O manifesto, que e o que protege o dado no iPhone');

const m = JSON.parse(manifest);

/* O icone da tela de inicio so protege o repertorio se abrir FORA do Safari.
 * Com `minimal-ui` ou `browser`, o app instalado continua passando pelo
 * contador de sete dias do Safari — e foi o defeito relatado no bug 232302
 * do WebKit. */
ok(m.display === 'standalone', 'o app instalado abre sem o Safari (display: standalone)',
  'Com "minimal-ui" ou "browser", o icone abre o Safari e o app continua no relogio de sete dias, '
  + 'mesmo instalado. E o app que manda o backup ser feito.');

/* O contador de sete dias e o unico jeito de perder o repertorio sem aviso no
 * iPhone. A regra olha o CODIGO do reconhecimento, nao o nome da funcao: a
 * primeira versao procurava `soSafari` e passava mesmo com a funcao devolvendo
 * `false` para tudo. */
const corpoSoSafari = /function soSafari\(\)\s*\{([\s\S]*?)\n {2}\}/.exec(armazenamento);
ok(!!corpoSoSafari && /iPhone|iPad|iPod/.test(corpoSoSafari[1]),
  'o app reconhece de fato o iPhone e o iPad, que e onde o relogio roda',
  'Sem reconhecer o iPhone, o aviso de perda de dados nao aparece no aparelho que perde. '
  + 'O `test-armazenamento` prova o comportamento; esta regra prova que o reconhecimento esta no codigo. '
  + 'O marcador e `iPhone|iPad|iPod` e nao `Safari`: `Safari` aparece na deteccao de desktop, e uma '
  + 'regula que aceitaria essa palavra passaria com o reconhecimento do iPhone apagado.');

/* ------------------------------------------------------------------ */
console.log('\n' + '-'.repeat(50));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  O iPhone depende disto:');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('-'.repeat(50) + '\n');
process.exit(falhou ? 1 : 0);
