/**
 * searchLogic — busca tolerante a erro de digitação.
 *
 * Objetivo: achar a música mesmo com o nome meio errado, e instantaneamente.
 * Um músico digitando no celular, com o dedo na tela, erra uma letra com
 * frequência; uma busca que exige grafia exata falha justamente no momento em
 * que mais importa.
 *
 * ── Como a pontuação funciona ────────────────────────────────────────────
 *
 * Para cada palavra digitada,procura-se o melhor tipo de casamento, do mais
 * forte para o mais fraco:
 *
 *   igual            1000   "pastor" == "pastor"
 *   começa com        900   "past"  em  "pastor"
 *   início de palavra 800   "pas"   em  "o pastor"
 *   dentro de         700   "stor"  em  "pastor"
 *   subsequência      400   "ptr"   em  "pastor"
 *   erro de digitação 300   "pasotr" em "pastor" (distância 1)
 *
 * Todos os termos digitados precisam casar (semântica E): buscar "preziosa
 * graça" não pode devolver só as músicas de "graça". Campo por campo: título
 * pesa mais que artista, que pesa mais que letra.
 *
 * ── Desempenho ───────────────────────────────────────────────────────────
 *
 * A distância de edição só é calculada quando as palavras têm comprimento
 * compatível e a inicial é parecida. Isso corta quase todas as comparações e
 * mantém a busca em menos de um milissegundo para alguns milhares de itens.
 */

/** Remove acentos, minúsculas e pontuação, deixando só o que importa. */
export function normalizeText(input: string): string {
  // Caminho rápido: sem caractere acima de 127 não há acento a remover, e
  // `normalize` deixaria de ser a operação mais cara da busca.
  if (!/[^\x20-\x7e]/.test(input)) {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return input
    .normalize('NFD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Faixa de diacríticos combinantes. */
const COMBINING = /[̀-ͯ]/g

/**
 * Buffers reaproveitados pela distância de edição.
 *
 * A busca chama esta função centenas de milhares de vezes por tecla digitada.
 * Alocar dois arrays em cada chamada era, sozinho, a maior fatia do tempo de
 * resposta. Como a função é síncrona e não se chama a si mesma, um buffer
 * compartilhado é seguro.
 */
const LINHA_A = new Int32Array(130)
const LINHA_B = new Int32Array(130)

/** Distância de edição com corte antecipado: devolve > limite se passar disso. */
export function boundedEditDistance(a: string, b: string, limit: number): number {
  if (a === b) return 0
  if (limit < 0) return 1
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Termos de busca são curtos; para os longos, alocar é mais barato do que
  // complicar o reaproveitamento.
  if (a.length > LINHA_A.length - 1 || b.length > LINHA_A.length - 1) {
    return editDistanceArrays(a, b, limit, new Array<number>(b.length + 1), new Array<number>(b.length + 1))
  }

  const la = LINHA_A
  const lb = LINHA_B
  for (let j = 0; j <= b.length; j++) la[j] = j

  for (let i = 1; i <= a.length; i++) {
    lb[0] = i
    let melhorDaLinha = lb[0]
    const ai = a.charCodeAt(i - 1)
    for (let j = 1; j <= b.length; j++) {
      const custo = ai === b.charCodeAt(j - 1) ? 0 : 1
      const del = la[j] + 1
      const ins = lb[j - 1] + 1
      const sub = la[j - 1] + custo
      const v = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub
      lb[j] = v
      if (v < melhorDaLinha) melhorDaLinha = v
    }
    // Se nenhuma célula da linha chega a zero, já passamos do limite.
    if (melhorDaLinha > limit) return limit + 1
    la.set(lb.subarray(0, b.length + 1))
  }

  return la[b.length]
}

function editDistanceArrays(
  a: string,
  b: string,
  limit: number,
  anterior: number[],
  atual: number[],
): number {
  for (let j = 0; j <= b.length; j++) anterior[j] = j
  for (let i = 1; i <= a.length; i++) {
    atual[0] = i
    let melhorDaLinha = atual[0]
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      const v = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + custo)
      atual[j] = v
      if (v < melhorDaLinha) melhorDaLinha = v
    }
    if (melhorDaLinha > limit) return limit + 1
    const troca = anterior
    anterior = atual
    atual = troca
  }
  return anterior[b.length]
}

/** Quantos erros de digitação tolerar para um termo deste tamanho. */
function toleranceFor(length: number): number {
  if (length <= 2) return 0
  if (length <= 4) return 1
  if (length <= 8) return 1
  return 2
}

export interface SearchField {
  value: string
  /** Peso do campo: 3 = título, 2 = artista, 1 = tags, 0.5 = letra. */
  weight: number
}

export interface Searchable {
  titulo: string
  artista?: string
  tags?: string[]
  categoria?: string
  tom?: string
  letra?: string
  cifra?: string
}

export interface SearchResult<T> {
  item: T
  score: number
  /** Palavras do termo que casaram em cada campo, para destacar na interface. */
  matched: Set<string>
}

export interface SearchOptions<T> {
  /** Campos extras além dos padrão, para dados que vivem fora do item. */
  extraFields?: (item: T) => SearchField[]
  /** Corta o resultado. 0 = sem corte. */
  limit?: number
  /** Pontuação mínima para entrar no resultado. */
  minScore?: number
  /** Desliga a tolerância a erro, quando se quer correspondência literal. */
  strict?: boolean
  /** Inclui campos de texto longo (letra, cifra) na busca. */
  incluirLetra?: boolean
}

const PESO_TITULO = 3
const PESO_ARTISTA = 2.4
const PESO_TAGS = 1.6
const PESO_CATEGORIA = 1.4
const PESO_TOM = 1.2
const PESO_TEXTO = 0.7

/** Uma palavra de um campo indexado, com o peso do campo de origem. */
interface Entrada {
  palavra: string
  peso: number
  nome: string
}

/**
 * Índice de um item.
 *
 * `entradas` traz só os campos curtos (título, artista, tags, categoria, tom),
 * palavra a palavra. Letra e cifra ficam em `textosLongos` e são pesquisadas
 * apenas como texto corrido: criar uma entrada para cada palavra de uma letra
 * inteira custaria milhares de objetos por música e não traria resultado
 * melhor, já que ninguém procura uma palavra de letra com erro de digitação.
 */
interface ItemIndex {
  tituloFull: string
  entradas: Entrada[]
  /**
   * Palavra exata -> melhor peso em que ela aparece.
   *
   * Casar uma palavra exata é o melhor resultado possível, então vale um mapa:
   * transforma o caso mais comum da busca em uma consulta só, em vez de varrer
   * a lista de entradas palavra a palavra.
   */
  exatas: Map<string, { peso: number; nome: string }>
  textosLongos: Array<{ texto: string; peso: number }>
}

const CAMPOS_CURTOS: ReadonlyArray<{ chave: keyof Searchable; peso: number; nome: string }> = [
  { chave: 'titulo', peso: PESO_TITULO, nome: 'titulo' },
  { chave: 'artista', peso: PESO_ARTISTA, nome: 'artista' },
  { chave: 'categoria', peso: PESO_CATEGORIA, nome: 'categoria' },
  { chave: 'tom', peso: PESO_TOM, nome: 'tom' },
]

function buildIndex(item: Searchable): ItemIndex {
  const entradas: Entrada[] = []

  for (const campo of CAMPOS_CURTOS) {
    const valor = item[campo.chave]
    if (typeof valor !== 'string' || !valor) continue
    const norm = normalizeText(valor)
    if (!norm) continue
    for (const palavra of norm.split(' ')) {
      entradas.push({ palavra, peso: campo.peso, nome: campo.nome })
    }
  }

  for (const tag of item.tags ?? []) {
    const norm = normalizeText(tag)
    if (!norm) continue
    for (const palavra of norm.split(' ')) {
      entradas.push({ palavra, peso: PESO_TAGS, nome: 'tag' })
    }
  }

  // Ordem decrescente de peso: o laço de busca depende disso para poder
  // interromper antes do fim.
  entradas.sort((a, b) => b.peso - a.peso)

  const exatas = new Map<string, { peso: number; nome: string }>()
  for (const e of entradas) {
    const ja = exatas.get(e.palavra)
    if (!ja || e.peso > ja.peso) exatas.set(e.palavra, { peso: e.peso, nome: e.nome })
  }

  const textosLongos: Array<{ texto: string; peso: number }> = []
  if (item.letra) {
    const t = normalizeText(item.letra)
    if (t) textosLongos.push({ texto: t, peso: PESO_TEXTO })
  }
  if (item.cifra) {
    const t = normalizeText(item.cifra)
    if (t) textosLongos.push({ texto: t, peso: PESO_TEXTO })
  }

  return { tituloFull: normalizeText(item.titulo ?? ''), entradas, exatas, textosLongos }
}

/**
 * Índice por item, guardado em WeakMap.
 *
 * Sem isto, cada tecla digitada refazia a normalização de todos os campos de
 * todos os itens. A chave é montada a partir dos próprios textos, de modo que
 * editar uma música invalida a entrada e o índice é refeito na próxima busca.
 */
const cache = new WeakMap<object, { chave: string; indice: ItemIndex }>()

function indexOfItem<T extends Searchable>(item: T): ItemIndex {
  const chave =
    (item.titulo ?? '') +
    '|' +
    (item.artista ?? '') +
    '|' +
    (item.tags?.join(' ') ?? '') +
    '|' +
    (item.categoria ?? '') +
    '|' +
    (item.tom ?? '') +
    '|' +
    (item.letra ?? '') +
    '|' +
    (item.cifra ?? '')

  const guardado = cache.get(item as object)
  if (guardado && guardado.chave === chave) return guardado.indice

  const indice = buildIndex(item)
  cache.set(item as object, { chave, indice })
  return indice
}

/**
 * Casamento por prefixo tolerante: "pstr" casa com "pastor".
 *
 * Só é aceito se as letras do termo aparecerem nos primeiros caracteres da
 * palavra, pulando no máximo `tolerancia` caracteres. Comparar apenas a inicial
 * faria qualquer palavra com a mesma letra casar, que é o que estraga a busca.
 */
function scoreFuzzyPrefix(palavra: string, termo: string, tolerancia: number): number {
  if (palavra[0] !== termo[0]) return 0

  let ti = 1
  let pulos = 0
  for (let i = 1; i < palavra.length && ti < termo.length; i++) {
    if (palavra[i] === termo[ti]) ti++
    else if (++pulos > tolerancia) return 0
  }

  if (ti < termo.length) return 0
  return 800 - (palavra.length - termo.length) * 10
}

/**
 * Troca de letras vizinhas: "preziosa" digitado "prezoisa".
 *
 * É o erro mais comum de teclado de celular e a distância de edição comum
 * conta como dois, o que estouraria a tolerância. Aqui vale um erro só.
 */
export function isAdjacentSwap(a: string, b: string): boolean {
  if (a.length !== b.length || a.length < 2) return false
  let par = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue
    if (par >= 1) return false
    if (i + 1 >= a.length) return false
    if (a[i] !== b[i + 1] || a[i + 1] !== b[i]) return false
    par++
    i++
  }
  return par === 1
}

/**
 * Pontuação de um termo contra UMA palavra. 0 = não casou.
 *
 * Trabalha palavra a palavra, e não campo a campo: um laço só sobre a lista
 * de entradas é bem mais barato do que reiniciar a varredura para cada campo,
 * e o peso de cada palavra já vem junto.
 */
function scorePalavra(termo: string, palavra: string, tolerancia: number, posicao: number): number {
  if (palavra === termo) {
    // Palavra exata: quanto mais cedo no campo, melhor.
    return 1000 - Math.min(posicao, 40)
  }

  if (palavra.startsWith(termo)) {
    // Prefixo exato: penaliza o quanto falta para completar a palavra.
    return 900 - (palavra.length - termo.length) * 12
  }

  const prefixo = scoreFuzzyPrefix(palavra, termo, tolerancia)
  if (prefixo > 0) return prefixo

  if (palavra.includes(termo)) {
    return 700 - palavra.indexOf(termo) * 4
  }

  if (tolerancia > 0 && Math.abs(palavra.length - termo.length) <= tolerancia) {
    const dif = Math.abs(palavra.length - termo.length)
    const d = boundedEditDistance(palavra, termo, tolerancia)
    if (d <= tolerancia) {
      // Faixa 300-399: o `squash` abaixo consome exatamente esta faixa.
      return 380 - d * 70 - dif * 10
    }
    if (d > tolerancia && isAdjacentSwap(palavra, termo)) {
      return 340 - dif * 10
    }
  }

  return 0
}

/**
 * Pontuação de um termo contra um texto corrido (letra ou cifra).
 * Aqui não há tolerância a erro: procura-se a sequência exata, porque o
 * usuário lembra a frase da letra, não a palavra dela.
 */
function scoreTextoLongo(termo: string, texto: string): number {
  const pos = texto.indexOf(termo)
  if (pos < 0) return 0
  return 700 - Math.min(pos, 60) * 4
}

/**
 * Casa o termo como subquência do texto, premiando palavras curtas e
 * posições iniciais. É o que faz "sr" achar "Senhor".
 */
function subsequenceScore(term: string, texto: string): number {
  const palavras = texto.split(' ')
  let melhor = 0
  for (const palavra of palavras) {
    if (palavra.length < term.length) continue
    let ti = 0
    let ultimo = -1
    for (let i = 0; i < palavra.length && ti < term.length; i++) {
      if (palavra[i] === term[ti]) {
        ultimo = i
        ti++
      }
    }
    if (ti === term.length) {
      const espalhao = ultimo - (term.length - 1)
      melhor = Math.max(melhor, 420 - espalhao * 25 - (palavra.length - term.length))
    }
  }
  return melhor
}

/** Normaliza a pontuação para a escala final. */
function squash(raw: number): number {
  if (raw >= 1000) return 1
  if (raw >= 900) return 0.92
  if (raw >= 800) return 0.84
  if (raw >= 700) return 0.72
  if (raw >= 600) return 0.6
  if (raw >= 400) return 0.45
  if (raw >= 300) return 0.32
  return 0
}

/**
 * Aquece o índice de um conjunto de itens.
 *
 * Deve ser chamada uma vez, depois que o repertório carregar. Sem isso, a
 * primeira tecla digitada paga a construção do índice inteiro e a busca dá
 * um solavanco visível; as teclas seguintes, que são as mais importantes por
 * causa do atraso acumulado, ficam rápidas.
 */
export function warmSearchIndex<T extends Searchable>(items: readonly T[]): void {
  for (const item of items) indexOfItem(item)
}

/**
 * Busca principal.
 *
 * Todos os termos precisam casar em pelo menos um campo (semântica E), o que
 * evita que "preziosa graça" traga só as músicas de "graça".
 */
export function search<T extends Searchable>(
  items: readonly T[],
  query: string,
  options: SearchOptions<T> = {},
): Array<SearchResult<T>> {
  const bruto = query.trim()
  if (!bruto) return []

  const termos = normalizeText(bruto).split(' ').filter(Boolean)
  if (termos.length === 0) return []

  const { limit = 0, minScore = 0.12, strict = false, extraFields, incluirLetra } = options
  const frase = normalizeText(bruto)
  const resultados: Array<SearchResult<T>> = []

  for (const item of items) {
    const indice = indexOfItem(item)
    const extras = extraFields ? extraFields(item) : null

    let total = 0
    const matched = new Set<string>()
    let todosCasaram = true

    for (const termo of termos) {
      const tolerancia = strict ? 0 : toleranceFor(termo.length)
      let melhorDoTermo = 0
      let melhorCampo: string | null = null

      // Palavra exata: resultado máximo, sem precisar varrer nada.
      const exata = indice.exatas.get(termo)
      if (exata) {
        total += exata.peso
        matched.add(exata.nome)
        continue
      }

      const entradas = indice.entradas
      for (let i = 0; i < entradas.length; i++) {
        const e = entradas[i]
        const bruto = scorePalavra(termo, e.palavra, tolerancia, i)
        if (bruto > 0) {
          const ajustado = squash(bruto) * e.peso
          if (ajustado > melhorDoTermo) {
            melhorDoTermo = ajustado
            melhorCampo = e.nome
          }
        }
        // Nenhuma palavra restante tem peso maior que `peso`, e `squash`
        // nunca passa de 1. Então, se o próximo peso já foi alcançado, o
        // resto da lista não pode melhorar o resultado.
        const proximoPeso = i + 1 < entradas.length ? entradas[i + 1].peso : 0
        if (melhorDoTermo >= proximoPeso) break
      }

      // Campos extras (data do evento, local, observações).
      if (extras && melhorDoTermo < extras[0]?.weight) {
        for (const extra of extras) {
          if (!extra.value) continue
          const bruto = scoreTextoLongo(termo, normalizeText(extra.value))
          if (bruto > 0) {
            const ajustado = squash(bruto) * extra.weight
            if (ajustado > melhorDoTermo) {
              melhorDoTermo = ajustado
              melhorCampo = 'extra'
            }
          }
        }
      }

      // Letra e cifra, por último e só por substring exato.
      if (incluirLetra !== false && melhorDoTermo < PESO_TEXTO) {
        for (const longo of indice.textosLongos) {
          const bruto = scoreTextoLongo(termo, longo.texto)
          if (bruto > 0) {
            const ajustado = squash(bruto) * longo.peso
            if (ajustado > melhorDoTermo) {
              melhorDoTermo = ajustado
              melhorCampo = 'texto'
            }
          }
        }
      }

      // Abreviação: "sr" para "senhor". Só para termos curtos, e só quando
      // nada mais casou, para não competir com um casamento de verdade.
      if (melhorDoTermo === 0 && termo.length >= 2 && termo.length <= 4) {
        const seq = subsequenceScore(termo, indice.tituloFull)
        if (seq > 0) {
          melhorDoTermo = squash(seq) * PESO_TITULO
          melhorCampo = 'titulo'
        }
      }

      if (melhorDoTermo <= 0) {
        todosCasaram = false
        break
      }
      total += melhorDoTermo
      if (melhorCampo) matched.add(melhorCampo)
    }

    if (!todosCasaram) continue

    // Bônus quando a frase inteira aparece no título: é o que o usuário
    // provavelmente digitou.
    if (indice.tituloFull.startsWith(frase)) total += 1.2
    else if (indice.tituloFull.includes(frase)) total += 0.6
    else if (matched.has('titulo') && matched.size === 1) total += 0.3

    // Normaliza pela quantidade de termos, para que buscar duas palavras não
    // dê um score maior só por ter mais.
    const score = total / termos.length

    if (score >= minScore) {
      resultados.push({ item, score, matched })
    }
  }

  resultados.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // Empate: título em ordem alfabética, para ser determinístico.
    return a.item.titulo.localeCompare(b.item.titulo, 'pt-BR')
  })

  return limit > 0 ? resultados.slice(0, limit) : resultados
}

/** Só os títulos, na ordem de relevância. */
export function searchTitles<T extends Searchable>(items: readonly T[], query: string, limit = 0): T[] {
  return search(items, query, { limit }).map((r) => r.item)
}

/**
 * Sugestões para um campo de texto.
 * Usado pelo seletor de tom, onde o erro de digitação é comum no celular.
 */
export function suggest<T extends Searchable>(
  items: readonly T[],
  query: string,
  take = 6,
): T[] {
  return searchTitles(items, query, take)
}

/** Divide um texto em palavras normalizadas, para montar índices à parte. */
export function words(text: string): string[] {
  const n = normalizeText(text)
  return n ? n.split(' ') : []
}

/** Verifica se um termo casa com o texto, para uso em um filtro simples. */
export function matches(text: string, query: string): boolean {
  return normalizeText(text).includes(normalizeText(query))
}
