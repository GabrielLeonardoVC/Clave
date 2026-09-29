/**
 * music/chords — qualidades de acorde, leitura e escrita.
 *
 * A expressão regular de qualidade é montada com as grafias aceitas
 * ordenadas da mais longa para a mais curta. É isso que faz `Cmaj7` ser lido
 * como maior com sétima (e não `Cm` + "aj7") e `C#m7(b5)` manter o `b5`.
 */

import { LETTERS, letterIndexOf, letterPc, mod12, spellNote, type AccidentalPreference } from './notes'

export interface Quality {
  /** Identificador canônico, usado internamente. */
  id: string
  /** Nome em português, para a interface. */
  label: string
  /** Todas as grafias aceitas. */
  aliases: readonly string[]
  /** Semitons a partir da fundamental, incluindo a fundamental (0). */
  intervals: readonly number[]
}

export interface Bass {
  letter: number
  alter: number
  pc: number
}

export interface Chord {
  root: number
  rootAlter: number
  rootPc: number
  qualityId: string
  qualityLabel: string
  intervals: readonly number[]
  bass: Bass | null
  /** Símbolo exatamente como digitado. Preservado para reemitir após transpor. */
  raw: string
  rawRoot: string
  rawSuffix: string
  rawBass: string
}

const d = (id: string, label: string, intervals: number[], ...aliases: string[]): Quality => ({
  id,
  label,
  aliases: Object.freeze(aliases.length ? aliases : [id]),
  intervals: Object.freeze(intervals),
})

/**
 * Catálogo de qualidades. Os intervalos são em semitons a partir da
 * fundamental, sempre começando pelo 0.
 */
export const QUALITIES: readonly Quality[] = Object.freeze([
  d('maj', 'Maior', [0, 4, 7], '', 'maj', 'ma', 'M'),
  d('min', 'Menor', [0, 3, 7], 'm', 'min', 'mi', '-'),
  d('dim', 'Diminuto', [0, 3, 6], 'dim', 'o', '°'),
  d('aug', 'Aumentado', [0, 4, 8], 'aug', '+'),
  d('5', 'Power', [0, 7], '5'),

  d('6', 'Maior com sexta', [0, 4, 7, 9], '6', 'M6', 'maj6'),
  d('min6', 'Menor com sexta', [0, 3, 7, 9], 'm6', 'min6'),
  d('69', 'Sexta com nona', [0, 4, 7, 9, 14], '6/9', '69', '6add9'),

  d('7', 'Dominante com sétima', [0, 4, 7, 10], '7'),
  d('maj7', 'Maior com sétima maior', [0, 4, 7, 11], 'maj7', 'M7', 'Ma7', 'Δ', 'Δ7', 'ma7', '^7'),
  d('min7', 'Menor com sétima', [0, 3, 7, 10], 'm7', 'min7'),
  d('minMaj7', 'Menor com sétima maior', [0, 3, 7, 11], 'mMaj7', 'mmaj7', 'mM7', '-maj7'),
  d('min7b5', 'Meio-diminuto', [0, 3, 6, 10], 'm7b5', 'min7b5', 'ø', 'ø7', '-7b5', 'half-dim'),
  d('dim7', 'Diminuto com sétima', [0, 3, 6, 9], 'dim7', 'o7', '°7'),
  d('aug7', 'Aumentado com sétima', [0, 4, 8, 10], 'aug7', '+7', '7#5'),
  d('7b5', 'Dominante com quinta diminuta', [0, 4, 6, 10], '7b5'),
  d('7sus4', 'Sétima suspensa', [0, 5, 7, 10], '7sus4', '7sus'),
  d('sus2', 'Suspendida em segunda', [0, 2, 7], 'sus2'),
  d('sus4', 'Suspendida em quarta', [0, 5, 7], 'sus4', 'sus'),

  d('7b9', 'Dominante com sétima b9', [0, 4, 7, 10, 13], '7b9'),
  d('7#9', 'Dominante com sétima #9', [0, 4, 7, 10, 15], '7#9'),
  d('7#11', 'Dominante com sétima #11', [0, 4, 7, 10, 18], '7#11'),
  d('9', 'Dominante com nona', [0, 2, 4, 7, 10, 14], '9'),
  d('maj9', 'Maior com nona maior', [0, 2, 4, 7, 11, 14], 'maj9', 'M9', 'Ma9', 'Δ9'),
  d('min9', 'Menor com nona', [0, 2, 3, 7, 10, 14], 'm9', 'min9'),
  d('11', 'Dominante com undece', [0, 2, 4, 7, 10, 14, 17], '11'),
  d('min11', 'Menor com undece', [0, 2, 3, 7, 10, 14, 17], 'm11', 'min11'),
  d('13', 'Dominante com treze', [0, 2, 4, 7, 10, 14, 21], '13'),
  d('maj13', 'Maior com treze maior', [0, 2, 4, 7, 11, 14, 21], 'maj13', 'M13', 'Ma13'),
  d('min13', 'Menor com treze', [0, 2, 3, 7, 10, 14, 21], 'm13', 'min13'),
  d('maj7#11', 'Maior com sétima e #11', [0, 4, 7, 11, 18], 'maj7#11', 'M7#11', 'Δ7#11', 'maj7+11'),
  d('add2', 'Maior com segunda adicional', [0, 2, 4, 7], 'add2'),
  d('add4', 'Maior com quarta adicional', [0, 4, 5, 7], 'add4'),
  d('add9', 'Maior com nona adicional', [0, 2, 4, 7, 14], 'add9'),
  d('add11', 'Maior com undece adicional', [0, 5, 7, 11, 17], 'add11'),
  d('add13', 'Maior com treze adicional', [0, 4, 7, 9, 21], 'add13'),
  d('aug9', 'Aumentado com nona', [0, 4, 8, 14], 'aug9', '+9'),
  d('aug11', 'Aumentado com undece', [0, 4, 8, 14, 18], 'aug11', '+11'),
  d('aug13', 'Aumentado com treze', [0, 4, 8, 14, 18, 21], 'aug13', '+13'),
])

const QUALITY_BY_ALIAS: ReadonlyMap<string, Quality> = (() => {
  const map = new Map<string, Quality>()
  for (const q of QUALITIES) for (const a of q.aliases) map.set(a, q)
  return map
})()

/** Grafias distintas, da mais longa para a mais curta. */
const ALIASES_BY_LENGTH: readonly string[] = (() => {
  const all = new Set<string>()
  for (const q of QUALITIES) for (const a of q.aliases) if (a.length > 0) all.add(a)
  return [...all].sort((a, b) => b.length - a.length)
})()

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Padrão ancorado, para validar o símbolo inteiro (ex.: "C#m7(b5)" -> null,
 * porque não existe parêntese nessa notação; "C#m7b5" -> acorde).
 *
 * Sensível a maiúsculas/minúsculas de propósito: `Cm` é menor e `CM7` é
 * maior com sétima.
 */
const ACCIDENTALS = '[#b♯♭]'
const QUALITY_GROUP = ALIASES_BY_LENGTH.map(escapeRe).join('|')
export const CHORD_PATTERN =
  '^([A-Ga-g])(' + ACCIDENTALS + '{0,2})(' + QUALITY_GROUP + ')?(?:/([A-Ga-g])(' + ACCIDENTALS + '{0,2}))?$'

/**
 * Mesmo padrão, mas sem âncoras e com uma afirmação negativa no fim.
 *
 * A afirmação é indispensável: sem ela o motor casa o prefixo mais curto.
 * Em "Cmin7" ele pararia em "Cmin" e deixaria o "7" de fora. Com ela, "Cmin"
 * é rejeitado porque o próximo caractere é um dígito, e o motor é obrigado
 * a tentar "min7" até fechar.
 *
 * E é ela que impede "Amém" de virar "Am" + "ém", ou "Composição" de virar
 * "C" + "omposição".
 */
export const CHORD_AT_PATTERN =
  '([A-Ga-g])(' + ACCIDENTALS + '{0,2})(' + QUALITY_GROUP + ')?(?:/([A-Ga-g])(' + ACCIDENTALS + '{0,2}))?(?![\\p{L}\\p{N}#/♯♭])'

const CHORD_RE = new RegExp(CHORD_PATTERN)
const CHORD_AT_RE = new RegExp(CHORD_AT_PATTERN, 'gu')

/** Converte a grafia digitada em número de semitons, reconhecendo ♯ e ♭. */
function alterOf(acc: string | undefined): number {
  if (!acc) return 0
  let n = 0
  for (const ch of acc) n += ch === '#' || ch === '♯' ? 1 : -1
  return n
}

/** Grafia canônica de uma letra com acidente, no formato que será impresso. */
function rootNameOf(letter: string, acc: string | undefined): string {
  const li = letterIndexOf(letter)
  return LETTERS[li] + (acc ?? '')
}

/** Reconstrói o acorde a partir dos grupos capturados. */
function buildChord(
  rootL: string,
  rootAcc: string | undefined,
  suffix: string | undefined,
  bassL: string | undefined,
  bassAcc: string | undefined,
  raw: string,
): Chord {
  const root = letterIndexOf(rootL as string)
  const rootAlter = alterOf(rootAcc)
  const quality = QUALITY_BY_ALIAS.get(suffix ?? '') ?? QUALITY_BY_ALIAS.get('')!

  let bass: Bass | null = null
  let rawBass = ''
  if (bassL) {
    const bl = letterIndexOf(bassL as string)
    const ba = alterOf(bassAcc)
    bass = { letter: bl, alter: ba, pc: letterPc(bl, ba) }
    rawBass = '/' + rootNameOf(bassL, bassAcc)
  }

  return {
    root,
    rootAlter,
    rootPc: letterPc(root, rootAlter),
    qualityId: quality.id,
    qualityLabel: quality.label,
    intervals: quality.intervals,
    bass,
    raw,
    rawRoot: rootNameOf(rootL, rootAcc),
    rawSuffix: suffix ?? '',
    rawBass,
  }
}

/** Tenta ler um símbolo como acorde. Retorna null se não for acorde. */
export function parseChord(symbol: string): Chord | null {
  if (!symbol) return null
  const s = symbol.trim()
  if (s.length === 0 || s.length > 12) return null

  const m = CHORD_RE.exec(s)
  if (!m) return null
  return buildChord(m[1] as string, m[2], m[3], m[4], m[5], s)
}

/** Verificação rápida: o texto inteiro é um acorde? */
export function isChordSymbol(text: string): boolean {
  return CHORD_RE.test(text.trim())
}

/**
 * Casa um acorde a partir da posição `index` e devolve o objeto lido.
 * Retorna null se não houver acorde começando exatamente ali.
 */
export function chordAt(text: string, index: number): { chord: Chord; end: number } | null {
  CHORD_AT_RE.lastIndex = index
  const m = CHORD_AT_RE.exec(text)
  if (!m || m.index !== index) return null
  const raw = m[0]
  return { chord: buildChord(m[1] as string, m[2], m[3], m[4], m[5], raw), end: index + raw.length }
}

export function qualityOf(symbol: string): Quality | null {
  const c = parseChord(symbol)
  return c ? (QUALITY_BY_ALIAS.get(c.rawSuffix) ?? QUALITY_BY_ALIAS.get('')!) : null
}

/**
 * Monta o símbolo de um acorde com grafia musicalmente correta.
 * A qualidade reaproveita a grafia original do usuário, para não trocar
 * "min7" por "m7" durante uma transposição.
 */
export function formatChord(
  rootPc: number,
  qualityId: string,
  bassPc: number | null = null,
  prefer: AccidentalPreference = 'sharp',
): string {
  const quality = QUALITIES.find((q) => q.id === qualityId) ?? QUALITY_BY_ALIAS.get('')!
  const root = spellNote(rootPc, prefer).name
  const suffix = quality.aliases[0] ?? quality.id
  const bass = bassPc === null ? '' : '/' + spellNote(bassPc, prefer).name
  return root + suffix + bass
}

/** Todas as alturas do acorde, fundamental incluída. */
export function chordNotes(chord: Chord): number[] {
  return chord.intervals.map((i) => mod12(chord.rootPc + i))
}

/** Nome de exibição: usa a grafia padrão da qualidade, não a digitada. */
export function chordLabel(chord: Chord, prefer: AccidentalPreference = 'sharp'): string {
  return formatChord(chord.rootPc, chord.qualityId, chord.bass ? chord.bass.pc : null, prefer)
}

/** Texto do acorde como o jogador deve ler em português. */
export function chordSpokenName(chord: Chord, prefer: AccidentalPreference = 'sharp'): string {
  const quality = QUALITIES.find((q) => q.id === chord.qualityId) ?? QUALITY_BY_ALIAS.get('')!
  const rootName = spellNote(chord.rootPc, prefer).name
  return `${rootName} ${quality.label.toLowerCase()}`
}
