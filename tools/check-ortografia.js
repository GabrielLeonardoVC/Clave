/* =========================================================
   ACORDE - tools/check-ortografia.js
   O que a pessoa le na tela esta escrito certo.

   Existe por causa de um padrao que o proprio codigo incentivou. Variaveis,
   funcoes e comentarios foram escritos sem acento — de proposito, para nao
   passar por codificacao corrompida. Mas texto de tela nao e codigo: a pessoa
   le "Apagar a gravacao" e le errado. E o app ja escreve com acento em outros
   lugares ("Apareencia", "Proximos"), entao ainda fica a impressao de que
   metade da tela foi escrita por outra pessoa.

   Este verificador olha SO para o texto que a pessoa ve:

     - aspas simples, aspas duplas e templates entram na busca;
     - comentarios saem da busca;
     - identificadores saem da busca, porque so entram trechos entre aspas.

   Cada trecho e lido duas vezes: uma como esta (com acento) e outra com
   todo acento trocado por uma letra neutra.
   A busca roda sobre a versao neutra. Assim "musica" e "música" dao o mesmo
   resultado, e so o que realmente perdeu o acento e acusado.

   As ambiguas ficam de fora de proposito: "esta" (pronome), "so"
   (preposicao) e "ja" (ja adverbio) sao palavras validas sem acento, e
   acusa-las daria falso positivo em quase toda frase.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const LISTA = require('./ortografia-lista.js');
const X = require('./extrair-texto.js');
const RAIZ = path.join(__dirname, '..');

/* ------------------------------------------------------------
   Os arquivos. O texto que a pessoa ve esta no JavaScript e no
   HTML; o CSS so tem nomes de classe.
   ------------------------------------------------------------ */
const ARQUIVOS = [];

/** Diretorios inteiros que ficam de fora, e o motivo. */
const DIRETORIOS_FORA = {
  // Letra de musica e cifra: texto de terceiro, citado. Acentuar "E com teu
  // Nome, oh, nao sei viver" seria corrigir uma letra que nao e nossa — e a
  // letra tem uma grafia que a musica usa. E o mesmo caso de uma citacao
  // biblica ou de um nome proprio: o app guarda o que outro escreveu, e nao
  // reescreve.
  data: 'letra e cifra: texto de terceiro',
};

const anda = function (dir, filtro) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      if (DIRETORIOS_FORA[e.name]) continue;
      anda(p, filtro);
    } else if (filtro(e.name)) {
      ARQUIVOS.push(p);
    }
  }
};
anda(path.join(RAIZ, 'js'), (n) => n.endsWith('.js'));

/* `tools/` fica de fora, e por dois motivos ao mesmo tempo:

   - o que sai de la vai para o terminal de quem roda `npm run verificar`, e nao
     para a tela de quem usa o app;
   - os rotulos dos testes sao comparados com o valor esperado. Trocar um acento
     num rotulo sem trocar o esperado quebra o teste — e o erro apareceria como
     falha de logica, que e a pior coisa que pode acontecer com um arranjo
     automatico.

   Um verificador que aponta duzentas Strings que ninguem vai ler cansa em
   uma semana e passa a ser ignorado. Vale apontar as trinta que a pessoa le.
*/
const INDEX = path.join(RAIZ, 'index.html');
if (fs.existsSync(INDEX)) ARQUIVOS.push(INDEX);

/* ------------------------------------------------------------
   Separar o que a pessoa ve do que e codigo.
   ------------------------------------------------------------ */

/** Tira comentarios de bloco, deixando os quebras de linha no lugar. */
/* A extracao de texto mora em extrair-texto.js, com uma so maquina de
   estados. Ter uma copia aqui dentro foi o que fez este verificador
   acusar arquivos que estavam corretos: a copia nao sabia tratar regex,
   entao lia a aspa de dentro de um padrao como aspa de codigo.



/* ------------------------------------------------------------
   A busca.
   ------------------------------------------------------------ */
const SEM_ACENTO = LISTA.SEM_ACENTO;

/** Escapa os caracteres que o padrao pode entender. */
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Um arranjo por palavra, nas DUAS formas e nas DUAS capitalizecoes.

   `soCodigo` marca as palavras que o app tambem usa como identificador: uma
   ocorrencia de palavra solta dessas nao e erro, porque o codigo as usa sem
   acento para nomear campo e canal. Ver `CODIGOS` na lista.

   A forma capitalizada entra junto porque "Nao deu", "Estudio" e "Musica" sao
   exatamente o mesmo erro de tela, e o verificador original so via a minuscula —
   ou seja, so acusava metade dos casos. */
const PADROES = LISTA.entradas.map((e) => {
  const mai = s => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    de: e.de,
    para: e.para,
    soCodigo: (LISTA.CODIGOS || []).indexOf(e.de) >= 0,
    reSem: new RegExp('(?<![A-Za-zÀ-ÿ])' + esc(e.de) + '(?![A-Za-zÀ-ÿ])', 'g'),
    reCom: new RegExp('(?<![A-Za-zÀ-ÿ])' + esc(e.para) + '(?![A-Za-zÀ-ÿ])', 'g'),
    reSemMai: new RegExp('(?<![A-Za-zÀ-ÿ])' + esc(mai(e.de)) + '(?![A-Za-zÀ-ÿ])', 'g'),
    reComMai: new RegExp('(?<![A-Za-zÀ-ÿ])' + esc(mai(e.para)) + '(?![A-Za-zÀ-ÿ])', 'g'),
  };
});

const IGNORAR = {
  'check-ortografia.js': 1, 'ortografia-lista.js': 1,
};

/**
 * As regioes que sao dado de busca, e nao rotulo.
 *
 * Diferente do resto, aqui a declaracao precisa ficar no codigo. A alternativa
 * — tentar adivinhar pelo formato — ja falhou: `PT_STOPWORDS` e uma lista de
 * duzentas palavras minúsculas de uma linha so, e nao ha como distinguir isso de
 * um menu por aparencia.
 *
 * Cada regiao e declarada pelo nome da constante. A extensao vai ate a linha em
 * que o colchete fecha, contando profundidade, e nao ate um numero de linha
 * fixo: quando a lista cresce, a regiao cresce junto, sem ninguem ter que
 * mexer aqui.
 */
function regioesDoArquivo(rel) {
  const arq = path.join(RAIZ, rel);
  if (!fs.existsSync(arq)) return [];
  const linhas = fs.readFileSync(arq, 'utf8').split('\n');

  const saida = [];
  for (const tabela of (LISTA.TABELAS || [])) {
    if (tabela.arquivo !== rel) continue;
    const i = linhas.findIndex((l) => l.indexOf(tabela.marcador) >= 0);
    if (i < 0) {
      saida.push({ marcador: tabela.marcador, erro: 'marcador nao achado' });
      continue;
    }
    // A partir do marcador, conta colchetes ate fechar.
    let prof = 0;
    let aberta = false;
    let fim = i;
    for (let k = i; k < linhas.length; k++) {
      for (const ch of linhas[k]) {
        if (ch === '[' || ch === '{' || ch === '(') { prof++; aberta = true; }
        else if (ch === ']' || ch === '}' || ch === ')') prof--;
      }
      if (aberta && prof <= 0) { fim = k; break; }
    }
    saida.push({ marcador: tabela.marcador, de: i + 1, ate: fim + 1 });
  }
  return saida;
}

const REGIOES = {};
for (const rel of new Set(ARQUIVOS.map((a) => path.relative(RAIZ, a).split(path.sep).join('/')))) {
  const rs = regioesDoArquivo(rel);
  if (rs.length) REGIOES[rel] = rs;
}

function regiaoDeTabela(rel, linha) {
  const rs = REGIOES[rel];
  if (!rs) return null;
  for (const r of rs) {
    if (r.erro) continue;
    if (linha >= r.de && linha <= r.ate) return r;
  }
  return null;
}

console.log('\n=== o texto que a pessoa le na tela ===');
console.log('  ' + ARQUIVOS.length + ' arquivo(s), ' + PADROES.length + ' palavra(s) na lista');

const regioesDeclaradas = Object.keys(REGIOES).length;
if (regioesDeclaradas) {
  let total = 0;
  for (const rel of Object.keys(REGIOES)) {
    for (const r of REGIOES[rel]) total++;
  }
  console.log('  ' + total + ' regiao(oes) de dado declaradas em ' + regioesDeclaradas + ' arquivo(s)');
}

const problemas = [];

for (const arq of ARQUIVOS) {
  const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
  if (IGNORAR[path.basename(arq)]) continue;

  const bruto = fs.readFileSync(arq, 'utf8');
  const ehHtml = /\.html?$/i.test(arq);

  // A extracao de trechos ja aplica a mascara por conta propria, entao nao ha
  // passo separado aqui. Aplicar dois vezes nao muda o resultado — a mascara
  // e idempotente — mas sugere que existe um segundo lugar onde o texto e
  // separado, e nao existe.
  const trechos = ehHtml ? X.textosDoHtml(bruto) : X.textos(bruto);

  for (const t of trechos) {
    // Bloco enormousamente longo e dado colado (uma partitura, um backup
    // embutido), nao rotulo de interface.
    if (t.texto.length > 400) continue;
    if (X.ehCodigo(t.texto, t.antes)) continue;

    // Tabela de dado declarada: onde o texto e uma palavra de busca, e nao
    // rotulo. Ver `TABELAS` na lista.
    const regiao = regiaoDeTabela(rel, t.linha);
    if (regiao) continue;

    // Palavra que o codigo tambem usa como identificador, sozinha. Ver
    // `CODIGOS` na lista.
    const semAcentoEmCodigo = (LISTA.CODIGOS || []);
    if (semAcentoEmCodigo.indexOf(t.texto.trim()) >= 0) continue;

    // Conta as DUAS formas NO TRECHO ORIGINAL, e nas DUAS capitalizacoes.
    // O que decide e a comparacao: a forma sem acento aparece e a com acento
    // nao? Entao a palavra perdeu o acento. Se as duas aparecem, o trecho tem
    // as duas coisas e quem escreveu acertou a maioria — acusar seria trabalho
    // de revisao de texto, nao de verificacao automatica.
    const achados = [];
    for (const p of PADROES) {
      // Minuscula e capitalizada contam como a mesma palavra. "Nao deu" e
      // "nao deu" sao o mesmo erro de tela, e so olhar a minuscula acusaria
      // metade dos casos.
      const pares = [
        { reSem: p.reSem, reCom: p.reCom, forma: p.de },
        {
          reSem: p.reSemMai,
          reCom: p.reComMai,
          forma: p.de.charAt(0).toUpperCase() + p.de.slice(1),
        },
      ];

      let perdeu = null;
      for (const par of pares) {
        par.reSem.lastIndex = 0;
        const semAcento = (t.texto.match(par.reSem) || []).length;
        if (!semAcento) continue;
        par.reCom.lastIndex = 0;
        const comAcento = (t.texto.match(par.reCom) || []).length;
        if (comAcento) continue;
        perdeu = { forma: par.forma, n: semAcento };
        break;
      }
      if (!perdeu) continue;

      achados.push({
        de: perdeu.forma,
        // A forma acentuada capitalizada. O acento vai junto: `Audio` vira
        // `Áudio`, e nao `Audio` — o que a primeira versao deste bloco fazia,
        // porque capitalizava a forma sem acento em vez da forma certa.
        para: perdeu.forma === p.de
          ? p.para
          : p.para.charAt(0).toUpperCase() + p.para.slice(1),
        n: perdeu.n,
      });
    }
    if (achados.length) {
      problemas.push({ rel: rel, linha: t.linha, texto: t.texto, achados: achados });
    }
  }
}

/* ------------------------------------------------------------
   O relatorio.
   ------------------------------------------------------------ */
if (!problemas.length) {
  console.log('  ok    nenhuma palavra da lista perdeu o acento na tela');
} else {
  problemas.sort((a, b) => (a.rel + a.linha).localeCompare(b.rel + b.linha));
  console.log('');
  for (const p of problemas) {
    const amostra = p.texto.length > 84 ? p.texto.slice(0, 84) + '...' : p.texto;
    console.log('  ' + p.rel + ':' + p.linha);
    console.log('      ' + JSON.stringify(amostra));
    console.log('      ' + p.achados.map((a) => a.de + ' -> ' + a.para).join(', '));
  }
  console.log('');
  console.log('  ' + problemas.length + ' trecho(s) com acento faltando');
}

if (LISTA.acusadas.length) {
  console.log('');
  console.log('  A LISTA ESTA COM ERRO:');
  for (const a of LISTA.acusadas) {
    console.log('    ' + a.chave + ' — ' + a.problema);
  }
}
if (LISTA.repetidas.length) {
  console.log('');
  console.log('  palavras repetidas na lista (ignoradas): ' + LISTA.repetidas.join(', '));
}

console.log('');
console.log('=================================================');
console.log('  O que NAO e verificado aqui, e por que:');
console.log('    - comentarios e nomes de variavel: nao aparecem na tela, e o');
console.log('      codigo deste projeto e escrito sem acento de proposito;');
console.log('    - tools/: a saida vai para o terminal, nao para a tela — e os');
console.log('      rotulos dos testes sao comparados com o valor esperado, entao');
console.log('      trocar um acento la quebraria a assercao;');
console.log('    - js/data/: letra de musica e cifra sao texto de terceiro, citado');
console.log('      como se cita;');
console.log('    - concordancia, crase e regencia: dependem da frase inteira, e');
console.log('      nao de palavra;');
console.log('    - palavras fora da lista: a lista cobre o vocabulario deste app,');
console.log('      nao o portugues inteiro.');
console.log('=================================================\n');

process.exit(problemas.length || LISTA.acusadas.length ? 1 : 0);