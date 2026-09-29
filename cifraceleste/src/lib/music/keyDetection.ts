/**
 * music/keyDetection — descobre o tom de uma cifra.
 *
 * Método: correlação de Pearson entre o peso de cada altura e os perfis
 * tonais de Krumhansl-Schmuckler, testando as 24 combinações de tônica e
 * modo. A correlação sozinha erra bastante em cifras curtas, então há um
 * reforço estrutural: o primeiro e o último acorde de uma música quase sempre
 * pertencem ao tom.
 *
 * Tom declarado entre colchetes no topo ([Am]) tem prioridade absoluta: quem
 * escreveu sabia melhor do que qualquer estatística.
 */

import { keyName, keyPrefersFlats, mod12, noteName, type AccidentalPreference } from './notes'
import { parseChord } from './chords'
import { parseCifra, type ParsedCifra } from './smartParser'

export type Mode = 'major' | 'minor'

export interface DetectedKey {
  pc: number
  mode: Mode
  /** 0 a 1. Abaixo de 0.25 o palpite é fraco e vale mostrar como sugestão. */
  confidence: number
  /** 'declarado' quando veio de [Am] no topo. */
  source: 'declarado' | 'perfil' | 'vazio'
  name: string
}

const PROFILE_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const PROFILE_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** Pearson entre dois vetores. Devolve 0 se algum for constante. */
function correlation(a: number[], b: number[]): number {
  const ma = mean(a)
  const mb = mean(b)
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - ma
    const y = b[i] - mb
    num += x * y
    da += x * x
    db += y * y
  }
  const den = Math.sqrt(da * db)
  return den === 0 ? 0 : num / den
}

/** Gira o perfil para que a tônica candidato fique na posição 0. */
function rotate(profile: number[], tonic: number): number[] {
  const out = new Array<number>(12)
  for (let i = 0; i < 12; i++) out[i] = profile[mod12(i - tonic)]
  return out
}

/**
 * Acumula o peso de cada altura a partir dos acordes encontrados.
 * Acorde em linha dedicada pesa mais que acorde embutido na letra.
 */
function pitchWeights(parsed: ParsedCifra): { weights: number[]; roots: number[] } {
  const weights = new Array<number>(12).fill(0)
  const roots: number[] = []

  for (const hit of parsed.hits) {
    if (hit.role !== 'root') continue
    const linha = parsed.lines[hit.lineIndex]
    // Linha só de acordes: 1.0. Embutido na letra: 0.55.
    const peso = linha?.kind === 'chords' ? 1 : 0.55
    weights[hit.chord.rootPc] += peso
    roots.push(hit.chord.rootPc)
  }

  return { weights, roots }
}

export function detectKey(parsed: ParsedCifra): DetectedKey {
  if (parsed.declaredRoot) {
    const pc = parsed.declaredRoot.rootPc
    const menor = isMinorQuality(parsed.declaredRoot.qualityId)
    return {
      pc,
      mode: menor ? 'minor' : 'major',
      confidence: 1,
      source: 'declarado',
      name: keyName(pc) + (menor ? 'm' : ''),
    }
  }

  const { weights, roots } = pitchWeights(parsed)
  const total = weights.reduce((a, b) => a + b, 0)
  if (total === 0 || roots.length === 0) {
    return { pc: 0, mode: 'major', confidence: 0, source: 'vazio', name: 'C' }
  }

  // A tônica real costuma ser a fundamental mais repetida.
  const maisFrequente = indiceDoMaximo(weights)
  const primeiro = roots[0]
  const ultimo = roots[roots.length - 1]

  let melhorPc = 0
  let melhorModo: Mode = 'major'
  let melhorScore = -Infinity

  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor'] as const) {
      const base = mode === 'major' ? PROFILE_MAJOR : PROFILE_MINOR
      let score = correlation(weights, rotate(base, tonic))

      // Reforço estrutural: o primeiro e o último acorde rarely mentem.
      if (tonic === primeiro) score += 0.09
      if (tonic === ultimo) score += 0.07
      if (tonic === maisFrequente) score += 0.05

      if (score > melhorScore) {
        melhorScore = score
        melhorPc = tonic
        melhorModo = mode
      }
    }
  }

  return {
    pc: melhorPc,
    mode: melhorModo,
    confidence: Math.max(0, Math.min(1, melhorScore)),
    source: 'perfil',
    name: keyName(melhorPc) + (melhorModo === 'minor' ? 'm' : ''),
  }
}

/** Detecta o tom direto a partir do texto bruto da cifra. */
export function detectKeyFromText(text: string): DetectedKey {
  return detectKey(parseCifra(text))
}

function indiceDoMaximo(xs: number[]): number {
  let melhor = 0
  for (let i = 1; i < xs.length; i++) if (xs[i] > xs[melhor]) melhor = i
  return melhor
}

export function isMinorQuality(qualityId: string): boolean {
  return qualityId.startsWith('min')
}

/** Tônico relativo menor: três semitons abaixo, com a grafia do próprio tom. */
export function relativeMinor(keyPc: number): { pc: number; name: string } {
  const pc = mod12(keyPc + 9)
  return { pc, name: noteName(pc, keyPrefersFlats(pc) ? 'flat' : 'sharp') + 'm' }
}

export const keyDisplayName = (pc: number, mode: Mode): string =>
  keyName(pc) + (mode === 'minor' ? 'm' : '')

export const keyAccidental = (pc: number): AccidentalPreference => (keyPrefersFlats(pc) ? 'flat' : 'sharp')

/** Tonalidades conhecidas, para o teste automático usar como gabarito. */
export const KNOWN_KEYS: ReadonlyArray<{ titulo: string; tom: string; modo: Mode }> = Object.freeze([
  { titulo: 'O Senhor é o meu Pastor', tom: 'C', modo: 'major' },
  { titulo: 'Amazing Grace', tom: 'G', modo: 'major' },
  { titulo: 'Como foi grande', tom: 'E', modo: 'major' },
  { titulo: 'Prisões', tom: 'A', modo: 'major' },
  { titulo: 'Deus é Amor', tom: 'D', modo: 'major' },
  { titulo: 'Vem Espirit Santo', tom: 'F', modo: 'major' },
  { titulo: 'Tu És Fiel', tom: 'Bb', modo: 'major' },
  { titulo: 'Senhor Te Adoro', tom: 'Eb', modo: 'major' },
  { titulo: 'Ave Maria', tom: 'Am', modo: 'minor' },
  { titulo: 'Magnificat', tom: 'Dm', modo: 'minor' },
])

/** Confere se a cifra bate com o gabarito, útil em teste e em depuração. */
export function keyMatches(text: string, esperado: string): boolean {
  const k = detectKeyFromText(text)
  const alvo = parseChord(esperado)
  if (!alvo) return false
  const nomeEsperado = keyName(alvo.rootPc) + (isMinorQuality(alvo.qualityId) ? 'm' : '')
  return k.name === nomeEsperado
}
