/* =========================================================
   ACORDE - core/search.js
   Busca tolerante a erro de digitacao.
   Expõe window.Search.
   =========================================================

   Musico digitando no celular, com o dedo na tela, erra uma letra com
   frequencia. Busca que exige grafia exata falha justamente no momento em que
   mais importa — e o musico esta de pe, com a banda esperando.

   ── Como a pontuacao funciona ──

   Para cada palavra digitada, procura-se o melhor tipo de casamento, do mais
   forte para o mais fraco:

     igual             1000   "pastor"  == "pastor"
     comeca com         900   "past"   em  "pastor"
     inicio de palavra  800   "pstr"   em  "pastor"
     dentro de          700   "stor"   em  "pastor"
     subquencia         420   "sr"     em  "senhor"
     erro de digitacao  300   "pasotr" em  "pastor" (distancia 1)

   Todos os termos precisam casar (semantica E): buscar "preziosa graca" nao
   pode devolver so as musicas de "graca". E campo por campo: titulo pesa mais
   que artista, que pesa mais que letra.

   ── Desempenho ──

   A distancia de edicao so e calculada quando as palavras tem comprimento
   compativel e a inicial e parecida. Isso corta quase todas as comparacoes e
   mantem a busca em menos de um milissegundo para alguns milhares de itens.
   --------------------------------------------------------- */
(function (global) {
  'use strict';

  /** Faixa de diacriticos combinantes. */
  var COMBINING = /[̀-ͯ]/g;

  /** Remove acentos, minusculas e pontuacao, deixando so o que importa. */
  function normalizeText(entrada) {
    var s = String(entrada == null ? '' : entrada);
    if (!s) return '';
    // Caminho rapido: sem caractere acima de 127 nao ha acento a remover, e o
    // normalize deixaria de ser a operacao mais cara da busca.
    if (!/[^\x20-\x7e]/.test(s)) {
      return s
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return s
      .normalize('NFD')
      .replace(COMBINING, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Buffers reaproveitados pela distancia de edicao.
   *
   * A busca chama esta funcao centenas de milhares de vezes por tecla digitada.
   * Alocar dois arrays em cada chamada era, sozinho, a maior fatia do tempo de
   * resposta. Como a funcao e sincrona e nao se chama a si mesma, um buffer
   * compartilhado e seguro.
   */
  var LINHA_A = new Int32Array(130);
  var LINHA_B = new Int32Array(130);

  function editDistanceArrays(a, b, limite, anterior, atual) {
    var j, i, custo, v, melhor;
    for (j = 0; j <= b.length; j++) anterior[j] = j;
    for (i = 1; i <= a.length; i++) {
      atual[0] = i;
      melhor = atual[0];
      for (j = 1; j <= b.length; j++) {
        custo = a[i - 1] === b[j - 1] ? 0 : 1;
        v = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + custo);
        atual[j] = v;
        if (v < melhor) melhor = v;
      }
      // Se nenhuma celula da linha chega a zero, ja passamos do limite.
      if (melhor > limite) return limite + 1;
      var troca = anterior;
      anterior = atual;
      atual = troca;
    }
    return anterior[b.length];
  }

  /** Distancia de edicao com corte antecipado: devolve > limite se passar. */
  function boundedEditDistance(a, b, limite) {
    var i, j, custo, del, ins, sub, v, melhorDaLinha;
    if (a === b) return 0;
    if (limite < 0) return 1;
    if (Math.abs(a.length - b.length) > limite) return limite + 1;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    // Termos de busca sao curtos; para os longos, alocar e mais barato do que
    // complicar o reaproveitamento.
    if (a.length > LINHA_A.length - 1 || b.length > LINHA_A.length - 1) {
      return editDistanceArrays(a, b, limite, new Array(b.length + 1), new Array(b.length + 1));
    }

    var la = LINHA_A;
    var lb = LINHA_B;
    for (j = 0; j <= b.length; j++) la[j] = j;

    for (i = 1; i <= a.length; i++) {
      lb[0] = i;
      melhorDaLinha = lb[0];
      for (j = 1; j <= b.length; j++) {
        custo = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        del = la[j] + 1;
        ins = lb[j - 1] + 1;
        sub = la[j - 1] + custo;
        v = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
        lb[j] = v;
        if (v < melhorDaLinha) melhorDaLinha = v;
      }
      if (melhorDaLinha > limite) return limite + 1;
      la.set(lb.subarray(0, b.length + 1));
    }
    return la[b.length];
  }

  /** Quantos erros de digitacao tolerar para um termo deste tamanho. */
  function toleranceFor(comprimento) {
    if (comprimento <= 2) return 0;
    if (comprimento <= 8) return 1;
    return 2;
  }

  /**
   * Troca de letras vizinhas: "preziosa" digitado "prezoisa".
   *
   * E o erro mais comum de teclado de celular, e a distancia de edicao comum
   * conta como dois, o que estouraria a tolerancia. Aqui vale um erro so.
   */
  function isAdjacentSwap(a, b) {
    var i, par = 0;
    if (a.length !== b.length || a.length < 2) return false;
    for (i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      if (par >= 1) return false;
      if (i + 1 >= a.length) return false;
      if (a[i] !== b[i + 1] || a[i + 1] !== b[i]) return false;
      par++;
      i++;
    }
    return par === 1;
  }

  /**
   * Casamento por prefixo tolerante: "pstr" casa com "pastor".
   *
   * So e aceito se as letras do termo aparecerem nos primeiros caracteres da
   * palavra, pulando no maximo `tolerancia` caracteres. Comparar apenas a
   * inicial faria qualquer palavra com a mesma letra casar.
   */
  function scoreFuzzyPrefix(palavra, termo, tolerancia) {
    var ti = 1, pulos = 0, i;
    if (palavra[0] !== termo[0]) return 0;
    for (i = 1; i < palavra.length && ti < termo.length; i++) {
      if (palavra[i] === termo[ti]) ti++;
      else if (++pulos > tolerancia) return 0;
    }
    if (ti < termo.length) return 0;
    return 800 - (palavra.length - termo.length) * 10;
  }

  /**
   * Pontuacao de um termo contra UMA palavra. 0 = nao casou.
   *
   * Trabalha palavra a palavra, e nao campo a campo: um laco so sobre a lista de
   * entradas e bem mais barato do que reiniciar a varredura para cada campo.
   */
  function scorePalavra(termo, palavra, tolerancia, posicao) {
    var prefixo, d, dif;
    if (palavra === termo) {
      // Palavra exata: quanto mais cedo no campo, melhor.
      return 1000 - Math.min(posicao, 40);
    }
    if (palavra.indexOf(termo) === 0) {
      // Prefixo exato: penaliza o quanto falta para completar a palavra.
      return 900 - (palavra.length - termo.length) * 12;
    }
    prefixo = scoreFuzzyPrefix(palavra, termo, tolerancia);
    if (prefixo > 0) return prefixo;
    if (palavra.indexOf(termo) >= 0) {
      return 700 - palavra.indexOf(termo) * 4;
    }
    if (tolerancia > 0 && Math.abs(palavra.length - termo.length) <= tolerancia) {
      dif = Math.abs(palavra.length - termo.length);
      d = boundedEditDistance(palavra, termo, tolerancia);
      // Faixa 300-399: o squash abaixo consome exatamente esta faixa.
      if (d <= tolerancia) return 380 - d * 70 - dif * 10;
      if (d > tolerancia && isAdjacentSwap(palavra, termo)) return 340 - dif * 10;
    }
    return 0;
  }

  /**
   * Pontuacao de um termo contra um texto corrido (letra ou cifra).
   * Aqui nao ha tolerancia a erro: procura-se a sequencia exata, porque o
   * usuario lembra a frase da letra, nao a palavra dela.
   */
  function scoreTextoLongo(termo, texto) {
    var pos = texto.indexOf(termo);
    if (pos < 0) return 0;
    return 700 - Math.min(pos, 60) * 4;
  }

  /** Casa o termo como subquencia, premiando palavras curtas e posicoes iniciais. */
  function subsequenceScore(termo, texto) {
    var palavras = texto.split(' ');
    var melhor = 0;
    for (var p = 0; p < palavras.length; p++) {
      var palavra = palavras[p];
      if (palavra.length < termo.length) continue;
      var ti = 0, ultimo = -1;
      for (var i = 0; i < palavra.length && ti < termo.length; i++) {
        if (palavra[i] === termo[ti]) {
          ultimo = i;
          ti++;
        }
      }
      if (ti === termo.length) {
        var espalhao = ultimo - (termo.length - 1);
        melhor = Math.max(melhor, 420 - espalhao * 25 - (palavra.length - termo.length));
      }
    }
    return melhor;
  }

  /** Normaliza a pontuacao para a escala final. */
  function squash(raw) {
    if (raw >= 1000) return 1;
    if (raw >= 900) return 0.92;
    if (raw >= 800) return 0.84;
    if (raw >= 700) return 0.72;
    if (raw >= 600) return 0.6;
    if (raw >= 400) return 0.45;
    if (raw >= 300) return 0.32;
    return 0;
  }

  var PESO_TITULO = 3;
  var PESO_ARTISTA = 2.4;
  var PESO_TAGS = 1.6;
  var PESO_CATEGORIA = 1.4;
  var PESO_TOM = 1.2;
  var PESO_TEXTO = 0.7;

  /**
   * O titulo da musica.
   *
   * No repertório o campo se chama `titulo`; dentro de uma escala, o mesmo
   * objeto se chama `nome`. Buscar pelos dois e o que evita que a busca
   * funcione em uma tela e falhe na outra.
   */
  function tituloDe(item) {
    return String((item && (item.titulo || item.nome)) || '');
  }

  var CAMPOS_CURTOS = [
    { chave: 'artista', peso: PESO_ARTISTA, nome: 'artista' },
    { chave: 'categoria', peso: PESO_CATEGORIA, nome: 'categoria' },
    { chave: 'tom', peso: PESO_TOM, nome: 'tom' },
    { chave: 'obs', peso: 1.0, nome: 'obs' },
  ];

  function buildIndex(item) {
    var entradas = [];
    var i, norma, j, palavra;

    var campos = [{ chave: null, peso: PESO_TITULO, nome: 'titulo' }].concat(CAMPOS_CURTOS);
    for (i = 0; i < campos.length; i++) {
      var valor = i === 0 ? tituloDe(item) : item[campos[i].chave];
      if (typeof valor !== 'string' || !valor) continue;
      norma = normalizeText(valor);
      if (!norma) continue;
      for (j = 0; j < norma.split(' ').length; j++) {
        palavra = norma.split(' ')[j];
        if (!palavra) continue;
        entradas.push({ palavra: palavra, peso: campos[i].peso, nome: campos[i].nome });
      }
    }

    var tags = item && item.tags;
    if (Array.isArray(tags)) {
      for (i = 0; i < tags.length; i++) {
        norma = normalizeText(tags[i]);
        if (!norma) continue;
        var partes = norma.split(' ');
        for (j = 0; j < partes.length; j++) {
          if (partes[j]) entradas.push({ palavra: partes[j], peso: PESO_TAGS, nome: 'tag' });
        }
      }
    }

    // Ordem decrescente de peso: o laco de busca depende disso para poder
    // interromper antes do fim.
    entradas.sort(function (a, b) { return b.peso - a.peso; });

    var exatas = new Map();
    for (i = 0; i < entradas.length; i++) {
      var ja = exatas.get(entradas[i].palavra);
      if (!ja || entradas[i].peso > ja.peso) {
        exatas.set(entradas[i].palavra, { peso: entradas[i].peso, nome: entradas[i].nome });
      }
    }

    var textosLongos = [];
    if (item && item.letra) {
      var lt = normalizeText(item.letra);
      if (lt) textosLongos.push({ texto: lt, peso: PESO_TEXTO });
    }
    if (item && item.cifra) {
      var ct = normalizeText(item.cifra);
      if (ct) textosLongos.push({ texto: ct, peso: PESO_TEXTO });
    }

    return { tituloFull: normalizeText(tituloDe(item)), entradas: entradas, exatas: exatas, textosLongos: textosLongos };
  }

  /**
   * Indice por item, guardado em WeakMap.
   *
   * Sem isto, cada tecla digitada refazia a normalizacao de todos os campos de
   * todos os itens. A chave e montada a partir dos proprios textos, de modo que
   * editar uma musica invalida a entrada e o indice e refeito na proxima busca.
   */
  var cache = new WeakMap();

  function indexOfItem(item) {
    if (!item || typeof item !== 'object') return buildIndex({});
    var tags = Array.isArray(item.tags) ? item.tags.join(' ') : '';
    var chave =
      tituloDe(item) + '|' + (item.artista || '') + '|' + tags + '|' +
      (item.categoria || '') + '|' + (item.tom || '') + '|' + (item.obs || '') + '|' +
      (item.letra || '') + '|' + (item.cifra || '');

    var guardado = cache.get(item);
    if (guardado && guardado.chave === chave) return guardado.indice;

    var indice = buildIndex(item);
    cache.set(item, { chave: chave, indice: indice });
    return indice;
  }

  /**
   * Aquece o indice de um conjunto de itens.
   *
   * Deve ser chamada uma vez, depois que o repertorio carregar. Sem isso, a
   * primeira tecla digitada paga a construcao do indice inteiro e da um
   * solavanco visivel; as teclas seguintes ficam rapidas.
   */
  function aquecerIndice(itens) {
    for (var i = 0; i < itens.length; i++) indexOfItem(itens[i]);
  }

  /**
   * Busca principal.
   *
   * Todos os termos precisam casar em pelo menos um campo (semantica E).
   * Devolve [{item, score, matched}], do mais relevante para o menos.
   */
  function buscar(itens, consulta, opcoes) {
    opcoes = opcoes || {};
    var bruto = String(consulta == null ? '' : consulta).trim();
    if (!bruto) return [];

    var termos = normalizeText(bruto).split(' ').filter(Boolean);
    if (termos.length === 0) return [];

    var limite = opcoes.limit || 0;
    var minScore = opcoes.minScore === undefined ? 0.12 : opcoes.minScore;
    var estrito = !!opcoes.strict;
    var extras = opcoes.camposExtras;
    var incluirTexto = opcoes.incluirLetra !== false;
    var frase = normalizeText(bruto);
    var resultados = [];

    for (var idx = 0; idx < itens.length; idx++) {
      var item = itens[idx];
      var indice = indexOfItem(item);

      var total = 0;
      var matched = {};
      var todosCasaram = true;

      for (var t = 0; t < termos.length; t++) {
        var termo = termos[t];
        var tolerancia = estrito ? 0 : toleranceFor(termo.length);
        var melhorDoTermo = 0;
        var melhorCampo = null;

        // Palavra exata: resultado maximo, sem precisar varrer nada.
        var exata = indice.exatas.get(termo);
        if (exata) {
          total += exata.peso;
          matched[exata.nome] = true;
          continue;
        }

        var entradas = indice.entradas;
        for (var i = 0; i < entradas.length; i++) {
          var e = entradas[i];
          var brutoPalavra = scorePalavra(termo, e.palavra, tolerancia, i);
          if (brutoPalavra > 0) {
            var ajustado = squash(brutoPalavra) * e.peso;
            if (ajustado > melhorDoTermo) {
              melhorDoTermo = ajustado;
              melhorCampo = e.nome;
            }
          }
          // Nenhuma palavra restante tem peso maior que `peso`, e squash nunca
          // passa de 1. Se o proximo peso ja foi alcancado, o resto da lista
          // nao pode melhorar o resultado.
          var proximoPeso = i + 1 < entradas.length ? entradas[i + 1].peso : 0;
          if (melhorDoTermo >= proximoPeso) break;
        }

        // Campos extras (data do evento, local, observacoes).
        if (extras) {
          var lista = extras(item) || [];
          for (var x = 0; x < lista.length; x++) {
            if (!lista[x].value) continue;
            var bx = scoreTextoLongo(termo, normalizeText(lista[x].value));
            if (bx > 0) {
              var ax = squash(bx) * lista[x].weight;
              if (ax > melhorDoTermo) {
                melhorDoTermo = ax;
                melhorCampo = 'extra';
              }
            }
          }
        }

        // Letra e cifra, por ultimo e so por substring exato.
        if (incluirTexto && melhorDoTermo < PESO_TEXTO) {
          for (var y = 0; y < indice.textosLongos.length; y++) {
            var bl = scoreTextoLongo(termo, indice.textosLongos[y].texto);
            if (bl > 0) {
              var al = squash(bl) * indice.textosLongos[y].peso;
              if (al > melhorDoTermo) {
                melhorDoTermo = al;
                melhorCampo = 'texto';
              }
            }
          }
        }

        // Abreviacao: "sr" para "senhor". So para termos curtos, e so quando
        // nada mais casou, para nao competir com um casamento de verdade.
        if (melhorDoTermo === 0 && termo.length >= 2 && termo.length <= 4) {
          var seq = subsequenceScore(termo, indice.tituloFull);
          if (seq > 0) {
            melhorDoTermo = squash(seq) * PESO_TITULO;
            melhorCampo = 'titulo';
          }
        }

        if (melhorDoTermo <= 0) {
          todosCasaram = false;
          break;
        }
        total += melhorDoTermo;
        if (melhorCampo) matched[melhorCampo] = true;
      }

      if (!todosCasaram) continue;

      // Bonus quando a frase inteira aparece no titulo: e o que o usuario
      // provavelmente digitou.
      if (indice.tituloFull.indexOf(frase) === 0) total += 1.2;
      else if (indice.tituloFull.indexOf(frase) >= 0) total += 0.6;
      else {
        var soTitulo = true;
        for (var chave in matched) {
          if (chave !== 'titulo') { soTitulo = false; break; }
        }
        if (soTitulo && matched.titulo) total += 0.3;
      }

      // Normaliza pela quantidade de termos, para que buscar duas palavras nao
      // de um score maior so por ter mais.
      var score = total / termos.length;

      if (score >= minScore) {
        resultados.push({ item: item, score: score, matched: matched });
      }
    }

    resultados.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      // Empate: titulo em ordem alfabetica, para ser deterministico.
      return tituloDe(a.item).localeCompare(tituloDe(b.item), 'pt-BR');
    });

    return limite > 0 ? resultados.slice(0, limite) : resultados;
  }

  /** So os itens, na ordem de relevancia. */
  function buscarItens(itens, consulta, limite) {
    return buscar(itens, consulta, { limit: limite || 0 }).map(function (r) { return r.item; });
  }

  /** Sugestoes para um campo de texto. */
  function sugerir(itens, consulta, quantos) {
    return buscarItens(itens, consulta, quantos || 6);
  }

  /** Divide um texto em palavras normalizadas. */
  function palavras(texto) {
    var n = normalizeText(texto);
    return n ? n.split(' ') : [];
  }

  /** Verifica se um termo casa com o texto, para um filtro simples. */
  function casaCom(texto, consulta) {
    return normalizeText(texto).indexOf(normalizeText(consulta)) >= 0;
  }

  var Search = {
    normalizeText: normalizeText,
    boundedEditDistance: boundedEditDistance,
    isAdjacentSwap: isAdjacentSwap,
    aquecerIndice: aquecerIndice,
    buscar: buscar,
    buscarItens: buscarItens,
    sugerir: sugerir,
    palavras: palavras,
    casaCom: casaCom,
  };

  global.Search = Search;
  if (typeof module !== 'undefined' && module.exports) module.exports = Search;
})(typeof window !== 'undefined' ? window : globalThis);
