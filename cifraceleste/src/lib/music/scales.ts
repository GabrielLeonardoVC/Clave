/**
 * music/scales — escalas, modos e os acordes de cada grau.
 */

import { mod12, keyName } from './notes'
import { parseChord } from './chords'

export interface Escala {
  id: string
  nome: string
  nomeCurto: string
  /** Semitons a partir da tônica. */
  intervalos: number[]
  /** Grau de cada nota: 1, 2, b3, 4... */
  graus: string[]
}

/** 16 escalas e modos, do mais usado ao mais raro. */
export const SCALES: Readonly<Record<string, Escala>> = Object.freeze({
  major: {
    id: 'major',
    nome: 'Escala maior (jônica)',
    nomeCurto: 'maior',
    intervalos: [0, 2, 4, 5, 7, 9, 11],
    graus: ['1', '2', '3', '4', '5', '6', '7'],
  },
  dorian: {
    id: 'dorian',
    nome: 'Dórico',
    nomeCurto: 'dórico',
    intervalos: [0, 2, 3, 5, 7, 9, 10],
    graus: ['1', '2', 'b3', '4', '5', '6', 'b7'],
  },
  phrygian: {
    id: 'phrygian',
    nome: 'Frígio',
    nomeCurto: 'frígio',
    intervalos: [0, 1, 3, 5, 7, 8, 10],
    graus: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'],
  },
  lydian: {
    id: 'lydian',
    nome: 'Lídio',
    nomeCurto: 'lídio',
    intervalos: [0, 2, 4, 6, 7, 9, 11],
    graus: ['1', '2', '3', '#4', '5', '6', '7'],
  },
  mixolydian: {
    id: 'mixolydian',
    nome: 'Mixolídio',
    nomeCurto: 'mixolídio',
    intervalos: [0, 2, 4, 5, 7, 9, 10],
    graus: ['1', '2', '3', '4', '5', '6', 'b7'],
  },
  aeolian: {
    id: 'aeolian',
    nome: 'Menor natural (eólio)',
    nomeCurto: 'menor',
    intervalos: [0, 2, 3, 5, 7, 8, 10],
    graus: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
  },
  locrian: {
    id: 'locrian',
    nome: 'Lócrio',
    nomeCurto: 'lócrio',
    intervalos: [0, 1, 3, 5, 6, 8, 10],
    graus: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
  },
  harmonicMinor: {
    id: 'harmonicMinor',
    nome: 'Menor harmônica',
    nomeCurto: 'menor harm.',
    intervalos: [0, 2, 3, 5, 7, 8, 11],
    graus: ['1', '2', 'b3', '4', '5', 'b6', '7'],
  },
  melodicMinor: {
    id: 'melodicMinor',
    nome: 'Menor melódica',
    nomeCurto: 'menor mel.',
    intervalos: [0, 2, 3, 5, 7, 9, 11],
    graus: ['1', '2', 'b3', '4', '5', '6', '7'],
  },
  pentatonicMajor: {
    id: 'pentatonicMajor',
    nome: 'Pentatônica maior',
    nomeCurto: 'pent. maior',
    intervalos: [0, 2, 4, 7, 9],
    graus: ['1', '2', '3', '5', '6'],
  },
  pentatonicMinor: {
    id: 'pentatonicMinor',
    nome: 'Pentatônica menor',
    nomeCurto: 'pent. menor',
    intervalos: [0, 3, 5, 7, 10],
    graus: ['1', 'b3', '4', '5', 'b7'],
  },
  blues: {
    id: 'blues',
    nome: 'Blues',
    nomeCurto: 'blues',
    intervalos: [0, 3, 5, 6, 7, 10],
    graus: ['1', 'b3', '4', 'b5', '5', 'b7'],
  },
  diminishedWhole: {
    id: 'diminishedWhole',
    nome: 'Diminuta de tons inteiros',
    nomeCurto: 'dim. inteira',
    intervalos: [0, 2, 4, 6, 8, 10],
    graus: ['1', '2', '3', '#4', '#5', 'b7'],
  },
  wholeTone: {
    id: 'wholeTone',
    nome: 'Tons inteiros',
    nomeCurto: 'tons inteiros',
    intervalos: [0, 2, 4, 6, 8, 10],
    graus: ['1', '2', '3', '#4', '#5', 'b7'],
  },
  harmonicMajor: {
    id: 'harmonicMajor',
    nome: 'Maior harmônica',
    nomeCurto: 'maior harm.',
    intervalos: [0, 2, 4, 5, 7, 8, 11],
    graus: ['1', '2', '3', '4', '5', 'b6', '7'],
  },
  phrygianDominant: {
    id: 'phrygianDominant',
    nome: 'Frígio dominante',
    nomeCurto: 'frígio dom.',
    intervalos: [0, 1, 4, 5, 7, 8, 10],
    graus: ['1', 'b2', '3', '4', '5', 'b6', 'b7'],
  },
})

/** Alturas de uma escala, já com a tônica aplicada. */
export function scaleNotes(tônica: number, escala: string): number[] {
  const s = SCALES[escala] ?? SCALES.major
  return s.intervalos.map((i) => mod12(tônica + i))
}

export function scaleNames(tônica: number, escala: string): string[] {
  return scaleNotes(tônica, escala).map((pc) => keyName(pc))
}

/** Todos os modos que contêm um conjunto de semitons, para gerar variações. */

/**
 * Qualidade de um acorde diatônico a partir do semitom acima da tônica.
 * Só os graus que aparecem em escalas de 7 notas precisam de tratamento
 * especial; o resto segue a regra geral (3 ou 4 semitons = maior).
 */
function qualidadeDiatonica(acimaDaTonica: number): string {
  switch (acimaDaTonica) {
    case 0:
      return 'maj'
    case 1:
      return 'min'
    case 2:
      return 'dim'
    case 3:
      return 'min'
    case 4:
      return 'maj'
    case 5:
      return 'dim'
    case 6:
      return 'dim7'
    case 7:
      return '5'
    case 8:
      return 'min'
    case 9:
      return 'min'
    case 10:
      return 'maj7'
    case 11:
      return '7'
    default:
      return 'maj'
  }
}

export interface AcordeDeGrau {
  pc: number
  qualidade: string
  nome: string
  grau: string
}

/** Os acordes de cada grau da escala, na ordem. */
export function scaleChords(tônica: number, escala: string): AcordeDeGrau[] {
  const s = SCALES[escala] ?? SCALES.major
  return s.intervalos.map((i, indice) => {
    const pc = mod12(tônica + i)
    const qualidade = qualidadeDiatonica(i)
    const nome = `${keyName(pc)}${qualidade === 'maj' ? '' : qualidade === '5' ? '5' : qualidade}`
    return { pc, qualidade, nome, grau: s.graus[indice] ?? String(indice + 1) }
  })
}

/** Alturas de um acorde, para tocar. */
export function chordNotesInScale(pc: number, qualidade: string): number[] {
  const simbolo = `${keyName(pc)}${qualidade === 'maj' ? '' : qualidade}`
  const acorde = parseChord(simbolo)
  if (!acorde) return [pc]
  return acorde.intervals.map((i) => mod12(pc + i))
}
