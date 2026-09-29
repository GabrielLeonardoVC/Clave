/**
 * music/smartParser — leitura de cifra como um músico de verdad le.
 *
 * O problema que este arquivo resolve: decidir se "e" em "e o meu pastor" é
 * o acorde Mi ou a conjunção "e", e se "do" em "do Senhor" é Ré diminuto ou
 * a preposição. Errar aqui é o defeito mais comum de apps de cifra: letra
 * virando acorde, ou acorde virando letra.
 *
 * A estratégia é em três camadas:
 *  1. O padrão de acorde exige um terminador. "Amém" não casa porque depois
 *     de "Am" vem "é", que é letra. Isso já barra a maioria do pior caso.
 *  2. Palavras que[colidem] com notação musical viram letra, sempre. A letra
 *     ganha o empate: na dúvida, é palavra.
 *  3. A linha só é de acordes se tiver pelo menos um acorde inequívoco. Uma
 *     linha com zero acordes inequívocos é letra, sem exceção.
 */

import { chordAt, type Chord } from './chords'
import { normalize } from './notes'

export type LineKind = 'chords' | 'lyrics' | 'inline' | 'section' | 'blank'

export interface ChordHit {
  chord: Chord
  /** Coluna inicial dentro de `raw`. */
  start: number
  end: number
  /** Coluna inicial no texto inteiro da cifra. */
  absStart: number
  absEnd: number
  lineIndex: number
  role: 'root' | 'bass'
}

export interface CifraLine {
  index: number
  kind: LineKind
  raw: string
  /**
   * Linha de acordes alinhada sobre a letra, para o formato "acorde na mesma
   * linha da palavra". Nulo nos demais formatos.
   */
  chordRow: string | null
  lyricRow: string | null
  label: string | null
  chords: ChordHit[]
}

export interface ParsedCifra {
  lines: CifraLine[]
  /** Todos os acordes do texto, ordenados por posição. */
  hits: ChordHit[]
  /** Tom declarado entre colchetes logo no início, se houver. */
  declaredRoot: Chord | null
}

/**
 * Palavras que casam com um símbolo de acorde e precisam ser tratadas como
 * letra. Só entram as que realmente casam com o padrão de acorde.
 */
const WORD_SHADOWS: ReadonlySet<string> = new Set([
  // Preposições e artigos que começam por letra de nota
  'a',
  'as',
  'ao',
  'aos',
  'à',
  'ás',
  'b',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'é',
  'ai',
  'aí',
  'eis',
  'ela',
  'ele',
  'mais',
  'mas',
  'na',
  'no',
  'nos',
  'nas',
  'ou',
  'se',
  'um',
  'uma',
  'já',
  'lá',
  'sol',
  'fa',
  'mi',
  're',
  'si',
  'dó',
  'lá',
  'fá',
  'ré',
  'ti',
  'lá',
])

/** Seções de música, em português e inglês. */
const SECTION_WORDS: readonly string[] = [
  'intro',
  'introdução',
  'verso',
  'pre-verso',
  'prechorus',
  'pre-chorus',
  'refrão',
  'refrao',
  'refrã',
  'coro',
  'ponte',
  'bridge',
  'solo',
  'solo de violão',
  'final',
  'fim',
  'saída',
  'saida',
  'coda',
  'outro',
  'interlúdio',
  'interludio',
  'reprise',
  'instrumental',
  'base',
  'riff',
  'break',
  'tag',
  'hook',
  'verset',
  'chorus',
  'verse',
  'lift',
  'falso',
  'encerramento',
]

const SECTION_RE = /^\s*\[([^\]]{1,40})\]\s*$/
const LABEL_RE = /^([^:]{1,48}):\s*$/

/** Reconhece o cabeçalho de uma seção. Devolve o rótulo ou null. */
export function sectionLabel(line: string): string | null {
  const s = line.trim()
  if (!s) return null

  const m = SECTION_RE.exec(s)
  if (m) {
    const dentro = m[1].trim()
    // "[C]" e "[Am]" são acordes, não seções.
    return dentro.length > 0 && !looksLikeChord(dentro) ? dentro : null
  }

  const comDoisPontos = LABEL_RE.exec(s)
  if (comDoisPontos) {
    const dentro = comDoisPontos[1].trim()
    if (inSectionVocabulary(dentro)) return dentro
  }

  // "Solo", "Refrão", "Bridge" em qualquer caixa.
  if (inSectionVocabulary(s)) return s

  return null
}

/**
 * Uma frase é rótulo de seção se for o vocábulo sozinho ou seguido de no
 * máximo um qualificador ("verso 1", "solo de violão").
 *
 * A âncora no fim é o que impede "C G Am F" de virar seção: nenhuma das
 * palavras de seção casa com aquela sequência inteira.
 */
function inSectionVocabulary(text: string): boolean {
  const norm = normalize(text)
  if (!norm) return false
  return SECTION_WORDS.some((w) => {
    if (norm === w) return true
    if (!norm.startsWith(w)) return false
    const resto = norm.slice(w.length).trim()
    return resto === '' || (resto.length <= 12 && resto.split(/\s+/).length <= 2)
  })
}

function looksLikeChord(text: string): boolean {
  return chordAt(text, 0)?.end === text.length
}

interface Token {
  kind: 'chord' | 'word'
  text: string
  start: number
  end: number
  chord: Chord | null
  /** O acorde está entre colchetes, então é declaração, não palavra. */
  bracketed: boolean
}

/** Quebra a linha em palavras e acordes, preservando as colunas. */
function tokenize(line: string, allowStopwordsAsChords: boolean): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < line.length) {
    const ch = line[i]

    if (ch === ' ' || ch === '\t') {
      i++
      continue
    }

    // Trecho entre colchetes ou parênteses: pode ser acorde ou rótulo de seção.
    if (ch === '[' || ch === '(') {
      const fecha = ch === '[' ? ']' : ')'
      const fim = line.indexOf(fecha, i + 1)
      if (fim > i) {
        const dentro = line.slice(i + 1, fim)
        const achado = chordAt(dentro, 0)
        if (achado && achado.end === dentro.length) {
          tokens.push({
            kind: 'chord',
            text: dentro,
            start: i + 1,
            end: fim,
            chord: achado.chord,
            bracketed: true,
          })
        } else {
          tokens.push({ kind: 'word', text: dentro, start: i + 1, end: fim, chord: null, bracketed: false })
        }
        i = fim + 1
        continue
      }
    }

    // Palavra comum: até o próximo espaço ou colchete.
    let fim = i
    while (fim < line.length && !' \t[('.includes(line[fim])) fim++

    const palavra = line.slice(i, fim)
    const achado = allowStopwordsAsChords || !WORD_SHADOWS.has(normalize(palavra))
      ? chordAt(line, i)
      : null

    if (achado && achado.end <= fim) {
      tokens.push({
        kind: 'chord',
        text: line.slice(i, achado.end),
        start: i,
        end: achado.end,
        chord: achado.chord,
        bracketed: false,
      })
      i = achado.end
    } else {
      tokens.push({ kind: 'word', text: palavra, start: i, end: fim, chord: null, bracketed: false })
      i = fim
    }
  }

  return tokens
}

/**
 * Rebaixa para palavra um acorde sem maiúscula dentro de uma linha que tem
 * letra.
 *
 * Em toda cifra publicada a fundamental do acorde é maiúscula: "C", "Am",
 * "F#m7b5". Letra é minúscula, exceto a inicial da frase. Então um acorde
 * minúsculo cercado de palavras é, com quase certeza, parte de uma palavra.
 *
 * Sem esta regra, "...but now am found" vira uma linha de acordes com "am".
 */
function demoteLowercaseChords(tokens: Token[]): Token[] {
  return tokens.map((t) =>
    t.kind === 'chord' && !t.bracketed && t.text[0] === t.text[0].toLowerCase()
      ? { ...t, kind: 'word' as const, chord: null }
      : t,
  )
}

type Classified = { kind: LineKind; tokens: Token[] }

function classify(line: string): Classified {
  const rotulo = sectionLabel(line)
  if (rotulo) return { kind: 'section', tokens: [] }

  if (!line.trim()) return { kind: 'blank', tokens: [] }

  // Primeira passada: palavras que colidem com notação musical contam como
  // palavra. Sem esta etapa, "do Senhor" viraria Ré diminuto.
  const segura = tokenize(line, false)
  const inequivocos = segura.filter((t) => t.kind === 'chord')

  // Nenhum acorde inequívoco? Então é letra, sem discussão.
  if (inequivocos.length === 0) {
    return { kind: 'lyrics', tokens: segura }
  }

  // Uma palavra de verdade tem pelo menos duas letras.
  const palavrasReais = segura.filter(
    (t) => t.kind === 'word' && t.text.replace(/[^\p{L}\p{N}]/gu, '').length >= 2,
  )

  // Há letra na linha: os acordes identificados são inline e as palavras que
  // colidem continuam palavras. "C do Senhor" tem um C, não um D diminuto.
  if (palavrasReais.length > 0) {
    const ajustados = demoteLowercaseChords(segura)
    const sobrouAlgum = ajustados.some((t) => t.kind === 'chord')
    return sobrouAlgum
      ? { kind: 'inline', tokens: ajustados }
      : { kind: 'lyrics', tokens: ajustados }
  }

  // Linha só de acordes. Aqui as colisões viram acordes, senão "A  E  D" — que
  // é uma linha de acordes perfeitamente normal — seria lida como letra.
  return { kind: 'chords', tokens: tokenize(line, true) }
}

/**
 * Converte uma linha "acorde palavra acorde palavra" em duas linhas
 * sobrepostas, deslocando cada acorde para a coluna da palavra que ele
 * toca. Sem o deslocamento o acorde ficaria uma ou duas colunas à esquerda,
 * e em fonte monoespaçada isso é visível.
 */
function splitInline(line: string, tokens: Token[]): { chordRow: string; lyricRow: string } {
  const chars = [...line]
  const chordRow = new Array<string>(chars.length).fill(' ')
  const lyricRow = new Array<string>(chars.length).fill(' ')

  for (let i = 0; i < chars.length; i++) lyricRow[i] = chars[i]

  for (const t of tokens) {
    if (t.kind !== 'chord') continue

    // Apaga o acorde do texto original.
    for (let i = t.start; i < t.end; i++) lyricRow[i] = ' '

    // Alvo: início da próxima palavra; se não houver, fica onde estava.
    let alvo = t.end
    while (alvo < chars.length && (chars[alvo] === ' ' || chars[alvo] === '\t')) alvo++
    if (alvo >= chars.length) alvo = t.end

    const simbolo = [...t.text]
    for (let k = 0; k < simbolo.length; k++) {
      const coluna = alvo + k
      if (coluna < chordRow.length) chordRow[coluna] = simbolo[k]
    }
  }

  return { chordRow: chordRow.join(''), lyricRow: lyricRow.join('') }
}

/** Lê uma cifra inteira, classificando cada linha e locating cada acorde. */
export function parseCifra(text: string): ParsedCifra {
  const lines: CifraLine[] = []
  const hits: ChordHit[] = []
  let declaredRoot: Chord | null = null

  // Divide preservando a posição de cada linha no texto original.
  const partes: Array<{ raw: string; absStart: number }> = []
  let cursor = 0
  const re = /([^\r\n]*)(\r\n|\n|\r|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[0] === '' && m.index >= text.length) break
    partes.push({ raw: m[1], absStart: cursor })
    cursor += m[0].length
    if (m[0] === '') break
  }

  partes.forEach((parte, index) => {
    const linha = parte.raw
    const { kind, tokens } = classify(linha)

    const linhaBase: CifraLine = {
      index,
      kind,
      raw: linha,
      chordRow: null,
      lyricRow: null,
      label: kind === 'section' ? sectionLabel(linha) : null,
      chords: [],
    }

    if (kind === 'inline') {
      const { chordRow, lyricRow } = splitInline(linha, tokens)
      linhaBase.chordRow = chordRow
      linhaBase.lyricRow = lyricRow
    }

    for (const t of tokens) {
      if (t.kind !== 'chord' || !t.chord) continue
      const hit: ChordHit = {
        chord: t.chord,
        start: t.start,
        end: t.end,
        absStart: parte.absStart + t.start,
        absEnd: parte.absStart + t.end,
        lineIndex: index,
        role: 'root',
      }
      linhaBase.chords.push(hit)
      hits.push(hit)

      // Baixo separado: o "A#" de "F#/A#" também precisa ser transposto.
      if (t.chord.bass) {
        hits.push({
          chord: {
            ...t.chord,
            root: t.chord.bass.letter,
            rootAlter: t.chord.bass.alter,
            rootPc: t.chord.bass.pc,
            bass: null,
            raw: t.text.slice(t.text.lastIndexOf('/') + 1),
            rawRoot: t.text.slice(t.text.lastIndexOf('/') + 1),
            rawSuffix: '',
            rawBass: '',
          },
          start: t.start + t.text.lastIndexOf('/') + 1,
          end: t.end,
          absStart: parte.absStart + t.start + t.text.lastIndexOf('/') + 1,
          absEnd: parte.absStart + t.end,
          lineIndex: index,
          role: 'bass',
        })
      }
    }

    // Tom declarado: o primeiro acorde entre colchetes no topo do texto.
    if (index === 0 && linhaBase.chords.length > 0) {
      const primeiro = linhaBase.chords[0]
      if (linha.trimStart().startsWith('[')) {
        declaredRoot = primeiro.chord
      }
    }

    lines.push(linhaBase)
  })

  return { lines, hits, declaredRoot }
}

/** Só os símbolos de acorde, na ordem em que aparecem. */
export function extractChords(text: string): string[] {
  return parseCifra(text).hits.filter((h) => h.role === 'root').map((h) => h.chord.raw)
}

/** Lista única de acordes, sem repetição, mantendo a ordem original. */
export function uniqueChords(text: string): string[] {
  const vistos = new Set<string>()
  const saida: string[] = []
  for (const s of extractChords(text)) {
    const k = s.toLowerCase()
    if (!vistos.has(k)) {
      vistos.add(k)
      saida.push(s)
    }
  }
  return saida
}
