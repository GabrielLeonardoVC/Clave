/**
 *music/notes — alturas, grafia e preferências de tonalidade.
 *
 * REGRA CENTRAL DESTE ARQUIVO
 * Ao nomear uma altura, jamais produzir C♭ ou E♯. A grafia escolhida é sempre
 * a de menor número de alterações; o desempate vai para a preferência de
 * sustenido/bemol. Por isso `B` é sempre `B`, nunca `H` (grafia britânica) e
 * nunca `Cb`.
 */

/** Letras: 0=C 1=D 2=E 3=F 4=G 5=A 6=B */
export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type LetterIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Altura (0..11) das letras naturais. */
export const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11] as const

export type AccidentalPreference = 'sharp' | 'flat'

/** Uma altura escrita: letra + alteração. */
export interface SpelledNote {
  /** Índice da letra em LETTERS. */
  letter: number
  /** -2 = duplo bemol, -1 = bemol, 0 = natural, 1 = sustenido, 2 = duplo sustenido */
  alter: number
  /** Altura absoluta 0..11. */
  pc: number
  /** Nome pronto para exibir: "C", "F#", "Bb". */
  name: string
}

/** Ordem dos tons com sustenidos, partindo de Dó: C G D A E B F# C# */
const SHARP_ORDER = [0, 7, 2, 9, 4, 11, 6, 1]
/** Ordem dos tons com bemóis, partindo de Dó: C F Bb Eb Ab Db Gb Cb */
const FLAT_ORDER = [0, 5, 10, 3, 8, 1, 6, 11]

const ACCIDENTAL_SUFFIX: Record<number, string> = {
  [-2]: 'bb',
  [-1]: 'b',
  [0]: '',
  [1]: '#',
  [2]: '##',
}

export const mod12 = (n: number): number => ((n % 12) + 12) % 12

/** Índice da letra (0=C .. 6=B). Devolve -1 se não for uma letra de nota. */
export function letterIndexOf(letter: string): number {
  if (!letter) return -1
  const alvo = letter[0].toUpperCase()
  for (let i = 0; i < LETTERS.length; i++) if (LETTERS[i] === alvo) return i
  return -1
}

export const letterPc = (letter: number, alter: number): number =>
  mod12(NATURAL_PC[mod12(letter) as 0 | 1 | 2 | 3 | 4 | 5 | 6] + alter)

/** Lê a grafia ASCII de uma nota. Estrito: só aceita letra + acidente. */
export function parseNoteName(input: string): { letter: number; alter: number } | null {
  const s = input.trim()
  if (!s) return null

  const first = s[0].toUpperCase()
  const li = LETTERS.indexOf(first as (typeof LETTERS)[number])
  if (li < 0) return null

  let alter = 0
  for (const ch of s.slice(1)) {
    if (ch === '#' || ch === '♯') alter += 1
    else if (ch === 'b' || ch === 'β' || ch === '♭') alter -= 1
    else return null
  }
  if (Math.abs(alter) > 2) return null
  return { letter: li, alter }
}

/** Faixa de diacríticos combinantes, usada para decompor acentos. */
const COMBINING_MARKS = /[̀-ͯ]/g

/** Uniformiza para comparação: minúsculas, sem acento, sem til. */
export function normalize(input: string): string {
  return input.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim()
}

/**
 * Escolhe a grafia de uma altura.
 *
 * Candidatos são todas as letras cuja distância até a altura é no máximo um
 * duplo acidente. Ordena por: 1) menos alterações; 2) na preferência pedida.
 *
 * Consequência garantida: nenhuma altura vira C♭ ou E♯, porque essas exigem
 * alteração dupla enquanto a letra correta tem zero.
 */
export function spellNote(pc: number, prefer: AccidentalPreference = 'sharp'): SpelledNote {
  const target = mod12(pc)
  let best: SpelledNote | null = null
  let bestAlter = 0
  let bestDistance = 99

  for (let letter = 0; letter < 7; letter++) {
    let alter = target - NATURAL_PC[letter as 0 | 1 | 2 | 3 | 4 | 5 | 6]
    // Traz para (-6, 6] para obter a alteração real daquela letra.
    if (alter > 6) alter -= 12
    if (alter < -6) alter += 12
    if (Math.abs(alter) > 2) continue

    const matches = prefer === 'flat' ? alter < 0 : alter > 0
    // Empate de |alter| é resolvido pela preferência, mas a letra natural
    // (alter 0) sempre vence porque tem |alter| menor.
    const distance = Math.abs(alter) * 2 + (matches ? 0 : 1)

    if (best === null || distance < bestDistance) {
      best = { letter, alter, pc: target, name: '' }
      bestDistance = distance
      bestAlter = alter
    }
  }

  if (!best) {
    // Inatingível com duplo acidente: cai no natural mais próximo.
    const letter = nearestLetter(target)
    const alter = target - NATURAL_PC[letter]
    best = { letter, alter, pc: target, name: '' }
    bestAlter = alter
  }

  const name = LETTERS[best.letter as LetterIndex] + ACCIDENTAL_SUFFIX[bestAlter]
  return { ...best, name }
}

function nearestLetter(pc: number): number {
  let best = 0
  let bestDist = 99
  for (let i = 0; i < 7; i++) {
    const d = Math.min(
      Math.abs(pc - NATURAL_PC[i as 0 | 1 | 2 | 3 | 4 | 5 | 6]),
      12 - Math.abs(pc - NATURAL_PC[i as 0 | 1 | 2 | 3 | 4 | 5 | 6]),
    )
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

/** Nome de uma altura respeitando a preferência. Atalho de `spellNote`. */
export function noteName(pc: number, prefer: AccidentalPreference = 'sharp'): string {
  return spellNote(pc, prefer).name
}

const PC_BY_NAME: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  'Fb': 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
  'E#': 5,
  'B#': 0,
  // Solfege português, usado nos seletores de tom.
  do: 1,
  dos: 1,
  re: 2,
  res: 2,
  mi: 4,
  mis: 4,
  fa: 5,
  fas: 5,
  sol: 7,
  la: 9,
  sis: 11,
  si: 11,
  ti: 11,
}

/** Converte qualquer grafia para número 0..11. Retorna null se irreconhecível. */
export function pcFromName(name: string): number | null {
  const n = normalize(name)
  if (!n) return null
  if (PC_BY_NAME[n] !== undefined) return PC_BY_NAME[n]
  const parsed = parseNoteName(n)
  if (parsed) return letterPc(parsed.letter, parsed.alter)
  return null
}

/**
 * O tom usa bemóis?
 *
 * Compara quantos sustenidos e quantos bemóis o tom exige.Empate favorece
 * sustenido (convenção: F# usa sustenido, Gb usa bemol — ambos Knife-edge,
 * mas sustenido é o padrão em quase todos os hinários).
 */
export function keyPrefersFlats(pc: number): boolean {
  const target = mod12(pc)
  const sharps = SHARP_ORDER.indexOf(target)
  const flats = FLAT_ORDER.indexOf(target)
  // Tons com duas sharpenings equivalentes: C#(7#/5b) e F#(6#/6b).
  const sharpCount = sharps < 0 ? 0 : sharps
  const flatCount = flats < 0 ? 0 : flats
  if (sharpCount === flatCount) return false
  return flatCount > sharpCount
}

/** Quantidade de sustenidos (0..7) na armadura do tom. */
export function keySharps(pc: number): number {
  const i = SHARP_ORDER.indexOf(mod12(pc))
  return i < 0 ? 0 : i
}

/** Quantidade de bemóis (0..7) na armadura do tom. */
export function keyFlats(pc: number): number {
  const i = FLAT_ORDER.indexOf(mod12(pc))
  return i < 0 ? 0 : i
}

/**
 * Nome do tom. Usa a mesma tabela do círculo das quintas, para que o nome do
 * tom e o nome no seletor nunca divirjam (Db e nunca C#, por exemplo).
 */
export function keyName(pc: number): string {
  const achado = CIRCLE_ORDER.find((k) => k.pc === mod12(pc))
  if (achado) return achado.name
  return noteName(pc, keyPrefersFlats(pc) ? 'flat' : 'sharp')
}

export const isBlackKey = (pc: number): boolean => ![0, 2, 4, 5, 7, 9, 11].includes(mod12(pc))

/**
 * Os 12 tons na ordem do círculo das quintas (C→G→D→A→E→B→F#→Db...).
 * Os seis primeiros usam sustenido, os seis últimos bemol — que é como
 * qualquer hinário imprime, e evita tanto "Db" quanto "C#" para o mesmo tom.
 */
const CIRCLE_ORDER: ReadonlyArray<{ pc: number; name: string }> = Object.freeze([
  { pc: 0, name: 'C' },
  { pc: 7, name: 'G' },
  { pc: 2, name: 'D' },
  { pc: 9, name: 'A' },
  { pc: 4, name: 'E' },
  { pc: 11, name: 'B' },
  { pc: 6, name: 'F#' },
  { pc: 1, name: 'Db' },
  { pc: 8, name: 'Ab' },
  { pc: 3, name: 'Eb' },
  { pc: 10, name: 'Bb' },
  { pc: 5, name: 'F' },
])

export const TWELVE_KEYS = Object.freeze(
  CIRCLE_ORDER.map((k) =>
    Object.freeze({
      pc: k.pc,
      name: k.name,
      major: k.name,
      minor: noteName(mod12(k.pc + 9), keyPrefersFlats(mod12(k.pc + 9)) ? 'flat' : 'sharp') + 'm',
    }),
  ),
)

/** Tabela de alturas para afinação padrão do violão (EADGBE), starting E2. */
export const GUITAR_TUNING = [4, 9, 2, 7, 11, 4] as const
export const GUITAR_TUNING_PC = [4, 9, 2, 7, 11, 4] as const
export const GUITAR_STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'] as const
