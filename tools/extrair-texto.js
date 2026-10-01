/* =========================================================
   ACORDE - tools/extrair-texto.js
   Separar o texto que a pessoa le do texto que e codigo.

   Existe porque o verificador de ortografia precisa ler os trechos entre
   aspas — e porque errar isso produz uma pilha de falsos positivos que faz o
   verificador perder credibilidade. Ja aconteceu duas vezes, e as duas por
   motivos diferentes:

     1. `.replace(/'/g, ...)` — a aspa de dentro do padrao foi lida como aspa de
        codigo, e tudo depois disso foi lido como texto. Uma frase de
        comentario apareceu como se fosse rotulo de tela.

     2. `accept: 'image/*'` — a barra-estrela de dentro da string foi lida como
        abertura de comentario, e o pedaco inteiro do arquivo ate a proxima
        fechadura de bloco foi apagado. O verificador passou a ler um arquivo
        que nao existe.

   Nenhuma das duas e resolvida por uma expressao regular, porque todas as
   tres coisas se sobrepoem no mesmo caractere: uma barra e inicio de
   comentario, inicio de regex ou divisao, e o que decide e o contexto — que e
   justamente o que um arranjo de caracteres nao sabe.

   Por isso e UM passe so, com estados. Um passe que apaga comentarios e outro
   que apaga strings nao funciona: cada um apaga coisa do outro, e quem se
   perde e o arquivo.
   ========================================================= */
'use strict';

/** Depois destes, uma barra comeca um padrao, e nao uma divisao. */
const ABRE_REGEX = new Set([
  '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%',
  '<', '>', '~', '^',
]);

/** Palavras depois das quais uma barra comeca um padrao. */
const ABRE_REGEX_PALAVRA = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'yield', 'await',
  'new', 'delete', 'void', 'instanceof', 'throw',
]);

/**
 * O token anterior, ignorando espaco e comentario.
 *
 * Quando o caractere anterior nao e letra nem numero, o token e esse
 * caractere — e nao a string vazia. Devolver a vazia diria "nao ha token
 * anterior", e a barra seguinte seria lida como divisao em vez de regex.
 */
function tokenAnterior(t, ate) {
  let i = ate - 1;
  while (i >= 0) {
    const c = t[i];
    if (/\s/.test(c)) { i--; continue; }
    if (c === '/' && t[i + 1] === '/') {
      while (i >= 0 && t[i] !== '\n') i--;
      continue;
    }
    if (c === '/' && t[i - 1] === '*') {
      let j = i - 2;
      while (j >= 0 && !(t[j] === '/' && t[j + 1] === '*')) j--;
      i = j - 1;
      continue;
    }
    break;
  }
  if (i < 0) return '';

  let fim = i + 1;
  while (i >= 0 && /[A-Za-z0-9_$]/.test(t[i])) i--;
  const palavra = t.slice(i + 1, fim);
  return palavra || t[fim - 1];
}

/** A barra que está aqui abre um padrao, e nao uma divisao? */
function abreRegex(t, i) {
  if (t[i + 1] === '/' || t[i + 1] === '*') return false;
  const anterior = tokenAnterior(t, i);
  if (anterior === '') return true;
  if (ABRE_REGEX_PALAVRA.has(anterior)) return true;
  return ABRE_REGEX.has(anterior);
}

/** Espacos do mesmo tamanho do trecho apagado, para as linhas nao se fundirem. */
function branco(n) {
  return ' '.repeat(Math.max(0, n));
}

/**
 * Apaga comentarios, mantendo strings intactas.
 *
 * O que sobra e o codigo, com os comentarios virados em espaco — inclusive as
 * quebras de linha de dentro deles, para que a contagem de linhas continue
 * valendo.
 */
function mascara(t) {
  let saida = '';
  let i = 0;
  // `estado` e o NOME do estado; `delim` e o caractere que fecha a string.
  // Sao dois porque o estado nao fecha a string: dentro de um texto so acaba
  // o delimitador que abriu. Guardar o nome no lugar do delimitador — o que
  // aconteceu na primeira versao — deixa NENHUMA string fechar, e o arquivo
  // inteiro e lido como texto.
  let estado = 'codigo';   // codigo | linha | bloco | texto
  let delim = null;

  while (i < t.length) {
    const c = t[i];
    const d = t[i + 1];

    if (estado === 'codigo') {
      if (c === '/' && d === '/') { estado = 'linha'; saida += '  '; i += 2; continue; }
      if (c === '/' && d === '*') { estado = 'bloco'; saida += '  '; i += 2; continue; }
      if (c === '/' && abreRegex(t, i)) {
        let j = i + 1;
        let emClasse = false;
        while (j < t.length) {
          if (t[j] === '\\') { j += 2; continue; }
          if (t[j] === '\n') break;         // regex nao atravessa linha
          if (t[j] === '[') emClasse = true;
          else if (t[j] === ']') emClasse = false;
          else if (t[j] === '/' && !emClasse) break;
          j++;
        }
        // Depois da barra que fecha o padrao vem a letra das opcoes (`g`, `i`,
        // `m`, `s`, `u`, `y`, `d`). Sem consumir, o `g` de `/x/g` sobrevivia
        // na mascara e virava letra solta no meio do codigo — o verificador
        // passaria a le-lo como texto.
        //
        // A contagem comeca DEPOIS da barra de fechamento. Comecar nela
        // consumiria uma letra a mais, e o espaco em branco trocaria uma letra
        // do codigo seguinte.
        let k = j + 1;
        while (k < t.length && /[a-z]/.test(t[k])) k++;
        const fim = Math.min(k, t.length);
        saida += branco(fim - i);
        i = fim;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') { estado = 'texto'; delim = c; }
      saida += c;
      i++;
      continue;
    }

    if (estado === 'linha') {
      if (c === '\n') { estado = 'codigo'; saida += c; i++; continue; }
      saida += ' ';
      i++;
      continue;
    }

    if (estado === 'bloco') {
      if (c === '*' && d === '/') { estado = 'codigo'; saida += '  '; i += 2; continue; }
      saida += c === '\n' ? '\n' : ' ';
      i++;
      continue;
    }

    // estado === 'texto'
    if (c === '\\') { saida += c + (d || ''); i += 2; continue; }
    if (c === '\n' && delim !== '`') {
      // String normal nao atravessa linha. Chegou aqui porque algo antes
      // ja virou o estado; fechar evita que o resto do arquivo inteiro
      // seja engolido em um erro so.
      estado = 'codigo';
      delim = null;
      saida += c;
      i++;
      continue;
    }
    saida += c;
    if (c === delim) { estado = 'codigo'; delim = null; }
    i++;
  }
  return saida;
}

/** Tira comentarios. Mantido como nome proprio porque e o que os doisdae. */
function tiraBloco(t) { return mascara(t); }
function tiraLinha(t) { return mascara(t); }

/**
 * Cada trecho de texto, com a linha em que comeca — e os que ficaram abertos.
 *
 * Anda pelo texto mascarado, onde os comentarios ja viraram espaco e as
 * strings continuam intactas: entao uma aspa aqui e sempre abertura de
 * codigo, nunca uma aspa de dentro de um padrao.
 *
 * A volta tambem diz o que ficou sem fechar. Uma string normal nao atravessa
 * linha; um template atravessa. Encontrar um destes e sinal de que alguma
 * coisa antes ja virou o estado — e e assim que se descobre onde.
 */
function varrer(t) {
  const base = mascara(t);
  const achados = [];
  const semFechar = [];
  let i = 0;

  while (i < base.length) {
    const c = base[i];
    if (c !== "'" && c !== '"' && c !== '`') { i++; continue; }

    const abre = c;
    const linha = base.slice(0, i).split('\n').length;
    let j = i + 1;
    let buf = '';
    let fechou = false;

    while (j < base.length) {
      const d = base[j];
      if (d === '\\') { buf += base.slice(j, j + 2); j += 2; continue; }
      if (d === abre) { fechou = true; break; }
      // So o template atravessa linha. Se um destes parou na quebra, o estado
      // ja estava virado antes.
      if (d === '\n' && abre !== '`') break;
      buf += d;
      j++;
    }

    if (fechou) {
      achados.push({
        linha: linha,
        texto: buf,
        // Onde a aspa de abertura comeca no texto mascarado. Permite trocar
        // o trecho sem reescrever o arquivo inteiro.
        ini: i,
        // O que vem logo antes da aspa de abertura. E o que distingue
        // `id: 'violao'` (identificador) de `'Violão'` (rotulo) — os dois
        // tem a mesma palavra e papeis opostos, e a palavra sozinha nao diz
        // qual dos dois e.
        antes: base.slice(Math.max(0, i - 40), i),
      });
    } else {
      semFechar.push({ linha: linha, tipo: abre, trecho: base.slice(i, i + 96) });
    }
    // Depois de um trecho fechado, a proxima aspa e a DEPOIS da de
    // fechamento. Voltar para a propria aspa de fechamento a trataria como uma
    // abertura nova, e todo o arquivo pareceria ter strings pela metade.
    i = Math.min(j + 1, base.length);
  }

  return { textos: achados, semFechar: semFechar };
}

/** So os trechos de texto. */
function textos(t) {
  return varrer(t).textos;
}

/**
 * A primeira aspa que ficou aberta depois da mascara.
 *
 * A mascara e a unica autoridade sobre o que e codigo, entao a conferencia tem
 * de usar a mascara — e nao um segundo passeio com as mesmas regras. Foi o que
 * aconteceu: `diag-aspas` tinha a propria copia da maquina de estados, sem o
 * tratamento de regex, e passou a acusar arquivos que estavam corretos. Um
 * verificador que acusa o arquivo errado e pior do que nenhum.
 *
 * Devolve null quando esta tudo fechado.
 */
function primeiraAspaAberta(t) {
  const sobra = varrer(t).semFechar;
  return sobra.length ? sobra[0] : null;
}

/**
 * O HTML e lido diferente do JavaScript.
 *
 * Entre aspas no HTML estao atributos — `src`, `class`, `id` — que ninguem le.
 * O que a pessoa le e o texto que fica entre um `>` e o `<` seguinte. Extrair
 * so isso evita ter que distinguir "texto" de "atributo" palavra por palavra.
 */
function textosDoHtml(t) {
  const foraDeScript = t
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  const achados = [];
  const re = />([^<>]+)</g;
  let m;
  while ((m = re.exec(foraDeScript)) !== null) {
    if (!m[1].trim()) continue;
    achados.push({
      linha: foraDeScript.slice(0, m.index).split('\n').length,
      texto: m[1].trim(),
    });
  }
  return achados;
}

/**
 * Propriedades cujo valor e identificador, e nao rotulo.
 *
 * `id: 'violao'` e `'Violão'` tem a mesma palavra dentro, papeis opostos: o
 * primeiro nunca chega na tela, o segundo e o que a pessoa le no botao de
 * instrumento. Sem o contexto antes da aspa, os dois parecem o mesmo.
 *
 * `aria-label`, `title` e `placeholder` NAO estao aqui, e essa exclusao e o
 * que importa: os tres sao lidos. O `aria-label` e anunciado por leitor de
 * tela, o `title` vira balão, e o `placeholder` fica dentro do campo vazio. O
 * verificador tratava os tres como identificador e deixava passar o rotulo do
 * botão de emergência escrito "Emergencia" — que ninguem ouve em voz alta e
 * todo mundo le no balão.
 */
const CHAVE_DE_IDENTIFICADOR = [
  'id:', 'class:', 'key:', 'href:', 'src:', 'type:', 'role:', 'name:',
  'variant:', 'theme:', 'accent:', 'icon:', 'id-', 'data-', 'dismissible:',
  'value:', 'autofocus:', 'flush:', 'wide:', 'live:', 'preload:', 'controls:',
  'enterkeyhint:', 'inputmode:', 'min:', 'max:', 'step:', 'rows:', 'cols:',
  'accept:', 'method:', 'target:', 'rel:', 'download:', 'charset:',
];

/**
 * O trecho e coisa de codigo, e nao texto que a pessoa le?
 *
 * Quatro formatos do app nao sao rotulo, e todos passam entre aspas:
 *
 *   "js/views/cancao.js"   caminho de arquivo
 *   "btn-emergencia"       nome de classe
 *   "#btn-emergencia"      seletor
 *   "violao" depois de id: identificador
 *
 * Os tres primeiros nao tem espaco. Rotulo de interface quase sempre tem —
 * "Apagar a gravacao", "Abrir o estudio". O quarto e reconhecido pelo que vem
 * antes da aspa, e nao pela palavra.
 */
function ehCodigo(s, antes) {
  // O contexto vem ANTES da regra de espaco. `class: 'label st-acc-titulo'`
  // tem espaco e e nome de classe; conferir o espaco primeiro devolvia "nao e
  // codigo" e o verificador acusava a propria classe CSS como erro de
  // ortografia.
  if (antes) {
    const cauda = String(antes).replace(/[\s,({[]+$/, '');
    for (const chave of CHAVE_DE_IDENTIFICADOR) {
      if (cauda.endsWith(chave)) return true;
    }
  }

  if (/\s/.test(s)) return false;

  if (s.indexOf('/') >= 0) return true;                        // caminho ou seletor
  if (s.indexOf('-') >= 0 || s.indexOf('_') >= 0) return true;  // classe ou id
  if (/^[#.\[]/.test(s)) return true;                            // seletor
  if (/^[a-z]+:[a-z]+$/i.test(s)) return true;                   // protocolo, tipo MIME
  return false;
}

module.exports = {
  mascara: mascara,
  tiraBloco: tiraBloco,
  tiraLinha: tiraLinha,
  textos: textos,
  textosDoHtml: textosDoHtml,
  primeiraAspaAberta: primeiraAspaAberta,
  ehCodigo: ehCodigo,
};