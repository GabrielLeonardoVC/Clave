/**
 * music/chordTransposer — o motor de transposição.
 *
 * ── A regra que este arquivo existe para garantir ────────────────────────
 *
 * Uma transposição nunca pode produzir C♭ nem E♯ quando existe uma grafia
 * simples. Dois casos clássicos quebram quase todo transpositor ingênuo:
 *
 *     Db → C   escrevendo "Cb"   (um semitom abaixo, letra errada)
 *     Eb → E   escrevendo "E#"   (um semitom acima, letra errada)
 *
 * A causa é transpor só o número da altura e escolher a letra ao acaso. Aqui
 * a preferência de grafia é decidida antes, nesta ordem:
 *
 *   1. Tom de destino informado → usa a armadura desse tom.
 *   2. A nota de origem tem acidente → segue o sentido do acidente.
 *      Db tem bemol, então desce para C, e não para Cb.
 *      Eb tem bemol, então sobe para E, e não para E#.
 *   3. Nota natural, movimento para cima → prefere sustenido (F +1 vira F#).
 *   4. Nota natural, movimento para baixo → prefere bemol (F -1 vira E).
 *
 * Combinado com a escolha de "menos alterações vence" em `spellNote`, isso
 * garante que nenhuma das 12 alturas possa assumir duplo acidente.
 *
 * ── Por que a cifra é remontada caractere a caractere ──────────────────
 *
 * A transposição de uma cifra inteira não pode passar por
 * `replace(/C/g, 'D')`: isso trocaria o "C" de "Com" e o "G" de "Graça".
 * Aqui só as posições exatas dos acordes, levantadas pelo `smartParser`, são
 * substituídas. Todo o resto do texto é copiado sem alteração, o que garante
 * que a letra nunca seja tocada.
 */

import { mod12, spellNote, keyPrefersFlats, keyName, type AccidentalPreference } from './notes'
import { parseChord, type Chord } from './chords'
import { parseCifra, type ParsedCifra } from './smartParser'
import { detectKey, type DetectedKey, type Mode } from './keyDetection'

export interface TransposeOptions {
  /** Força a grafia. Quando omitido, a decisão é automática. */
  preferFlats?: boolean
  /** Tônica de destino: sobrepõe a inferência e usa a armadura desse tom. */
  targetKeyPc?: number
  /** Preferência herdada das configurações do usuário. */
  userPreference?: AccidentalPreference
}

export interface TransposeResult {
  /** A cifra transposta. A letra é idêntica à original. */
  text: string
  keyBefore: DetectedKey
  keyAfter: DetectedKey
  /** Quantos acordes foram efetivamente trocados. */
  changed: number
  /** Detalhe de cada troca, na ordem do texto. */
  changes: Array<{ from: string; to: string; semitones: number }>
}

/**
 * Decide se o acorde deve ser escrito com sustenido ou bemol.
 * Esta função é o coração da regra anti-Cb/E#.
 */
export function preferenceFor(
  chord: Chord,
  semitones: number,
  opts: TransposeOptions = {},
): AccidentalPreference {
  if (opts.preferFlats !== undefined) return opts.preferFlats ? 'flat' : 'sharp'

  if (opts.targetKeyPc !== undefined) {
    return keyPrefersFlats(opts.targetKeyPc) ? 'flat' : 'sharp'
  }

  // A origem tem acidente? Então o movimento continua no mesmo sentido.
  if (chord.rootAlter < 0) return 'flat'
  if (chord.rootAlter > 0) return 'sharp'

  if (opts.userPreference) return opts.userPreference

  // Nota natural: sobe com sustenido, desce com bemol.
  return semitones >= 0 ? 'sharp' : 'flat'
}

/**
 * Transpõe um único símbolo de acorde.
 * Devolve o símbolo intacto se ele não for um acorde.
 */
export function transposeChordSymbol(
  symbol: string,
  semitones: number,
  opts: TransposeOptions = {},
): string {
  const chord = parseChord(symbol)
  if (!chord) return symbol
  if (semitones === 0) return symbol

  const pref = preferenceFor(chord, semitones, opts)
  const novoRoot = spellNote(mod12(chord.rootPc + semitones), pref).name

  // A qualidade é preservada exatamente como o usuário escreveu: "min7"
  // continua "min7", e não vira "m7" do nada.
  const sufixo = chord.rawSuffix

  let baixo = ''
  if (chord.bass) {
    // O baixo acompanha a preferência do novo fundamental. É o que se faz na
    // prática: C/G sobe um tom como C#/G#, e não como C#/Ab.
    const novoBaixo = spellNote(mod12(chord.bass.pc + semitones), pref).name
    baixo = '/' + novoBaixo
  }

  return novoRoot + sufixo + baixo
}

/** Quantos semitons separam dois tons, pelo caminho mais curto. */
export function semitonesBetween(fromPc: number, toPc: number): number {
  const bruto = mod12(toPc - fromPc)
  // Mantém dentro de -6..+6, que é o movimento que o músico espera.
  return bruto > 6 ? bruto - 12 : bruto
}

/**
 * Transpõe a cifra inteira.
 *
 * Reconstroi o texto a partir dos trechos entre os acordes, então a letra é
 * preservada caractere a caractere — inclusive espaços, acentuação e a
 * posição de cada acorde na grade monoespaçada.
 */
export function transposeCifra(
  text: string,
  semitones: number,
  opts: TransposeOptions = {},
): TransposeResult {
  const parsed = parseCifra(text)
  const keyBefore = detectKey(parsed)

  if (semitones === 0) {
    return { text, keyBefore, keyAfter: keyBefore, changed: 0, changes: [] }
  }

  // Só as fundamental importam. O baixo é transposto dentro do mesmo trecho,
  // para não duplicar o trabalho nem corromper o texto.
  const roots = parsed.hits.filter((h) => h.role === 'root').sort((a, b) => a.absStart - b.absStart)

  if (roots.length === 0) {
    return { text, keyBefore, keyAfter: keyBefore, changed: 0, changes: [] }
  }

  const changes: TransposeResult['changes'] = []
  let saida = ''
  let cursor = 0

  for (const hit of roots) {
    // Trecho de letra entre o acorde anterior e este: copiado sem tocar.
    if (hit.absStart > cursor) saida += text.slice(cursor, hit.absStart)

    const original = text.slice(hit.absStart, hit.absEnd)
    const novo = transposeChordSymbol(original, semitones, opts)
    saida += novo
    cursor = hit.absEnd

    if (novo !== original) {
      changes.push({ from: original, to: novo, semitones })
    }
  }

  // Cauda depois do último acorde.
  if (cursor < text.length) saida += text.slice(cursor)

  const keyAfter = detectKey(parseCifra(saida))

  return {
    text: saida,
    keyBefore,
    keyAfter,
    changed: changes.length,
    changes,
  }
}

/**
 * Transpõe para um tom específico, e não por um número de semitons.
 * Usa o menor movimento entre os dois tons.
 */
export function transposeCifraToKey(
  text: string,
  targetKeyPc: number,
  opts: TransposeOptions = {},
): TransposeResult {
  const origem = detectKey(parseCifra(text))
  const semitones = semitonesBetween(origem.pc, targetKeyPc)
  return transposeCifra(text, semitones, { ...opts, targetKeyPc })
}

// ─────────────────────────────────────────────────────────────────────────
//  Transposição por grau
// ─────────────────────────────────────────────────────────────────────────

/**
 * Triades que se formam em cada grau de uma escala, na grafia que se imprime.
 *
 * Maior não leva sufixo: ninguém escreve "Cmaj" numa cifra. Guardar aqui a
 * grafia, e não o identificador da qualidade, evita que a reatribuição
 * despeje "maj" em cima de cada acorde.
 */
const QUALIDADE_POR_GRAU_MAIOR: readonly string[] = ['', 'm', 'm', '', '', 'm', 'dim']
const QUALIDADE_POR_GRAU_MENOR: readonly string[] = ['m', 'dim', '', 'm', 'm', '', '']

/** Semitons acima da tônica para cada grau, em escala maior e menor. */
const GRAUS_MAIOR = [0, 2, 4, 5, 7, 9, 11]
const GRAUS_MENOR = [0, 2, 3, 5, 7, 8, 11]

/**
 * Descobre o grau de uma fundamental dentro de uma escala, ou null.
 */
function grauDe(pc: number, tomonica: number, modo: Mode): number | null {
  const graus = modo === 'minor' ? GRAUS_MENOR : GRAUS_MAIOR
  for (let i = 0; i < 7; i++) {
    if (mod12(tomonica + graus[i]) === pc) return i + 1
  }
  // Uma quinta acima conta como o mesmo grau, e uma oitava abaixo também. Sem
  // isso, uma progressão que cai na dominante de repente vira "não diatônica".
  for (let i = 0; i < 7; i++) {
    const desteGrau = mod12(tomonica + graus[i])
    if (desteGrau === mod12(pc + 7) || desteGrau === mod12(pc - 5)) return i + 1
  }
  return null
}

/**
 * Transpõe reatribuindo os graus, e não aplicando um número fixo de semitons.
 *
 * Isto só importa quando o tom de origem e o de destino têm modos diferentes
 * ou estão a mais de uma quinta de distância — e é justamente o caso comum:
 * levar uma música de Dó maior para Lá menor.
 *
 * A razão é que duas tonalidades com a mesma armadura **não** são
 * transposição uma da outra. De Dó maior para Lá menor, um deslocamento fixo
 * de 9 semitons leva o acorde de Dó para Lá, mas leva o Am de Dó para F#, e o
 * correcto em Lá menor é o C. Só a reatribuição por grau acerta os dois.
 *
 * Acordes que não pertencem à escala de origem caem no deslocamento fixo,
 * porque para eles não existe "grau" que possa ser transportado.
 */
export function transposeCifraPorGrau(
  text: string,
  targetKeyPc: number,
  targetMode: Mode,
): TransposeResult {
  const parsed = parseCifra(text)
  const keyBefore = detectKey(parsed)

  if (keyBefore.source === 'vazio') {
    return { text, keyBefore, keyAfter: keyBefore, changed: 0, changes: [] }
  }

  const origem = keyBefore.pc
  const origemModo = keyBefore.mode
  const destinoGraus = targetMode === 'minor' ? GRAUS_MENOR : GRAUS_MAIOR
  const destinoQualidades =
    targetMode === 'minor' ? QUALIDADE_POR_GRAU_MENOR : QUALIDADE_POR_GRAU_MAIOR

  // `targetKeyPc` já é a tônica pedida. Converter de novo aqui deslocaria o
  // destino duas vezes: escolher "Am" cairia em F#, que é o relativo maior de
  // Lá. O modo entra só para escolher o padrão de intervalos e de qualidades.
  const destinoPc = mod12(targetKeyPc)

  const prefer = keyPrefersFlats(destinoPc) ? 'flat' : 'sharp'
  const fallback = semitonesBetween(origem, destinoPc)

  const mudancas: TransposeResult['changes'] = []
  let saida = ''
  let cursor = 0

  for (const hit of parsed.hits) {
    if (hit.role !== 'root') continue
    if (hit.absStart > cursor) saida += text.slice(cursor, hit.absStart)

    const original = text.slice(hit.absStart, hit.absEnd)
    const acorde = parseChord(original)
    let novo = original

    if (acorde) {
      const grau = grauDe(acorde.rootPc, origem, origemModo)

      if (grau !== null) {
        const indice = (grau - 1 + 7) % 7
        const novoPc = mod12(destinoPc + destinoGraus[indice])
        // A qualidade vem do grau de destino, para o acorde fazer sentido na
        // nova tonalidade: o 3º grau de Lá menor é menor, não maior.
        const nomeRaiz = spellNote(novoPc, prefer).name
        // O baixo é transportado pelo mesmo intervalo, o que preserva a
        // inversão: C/G em Dó maior vira G/D em Sol maior, com a quinta no
        // baixo nos dois casos.
        const baixo = acorde.bass
          ? '/' + spellNote(mod12(acorde.bass.pc + semitonesBetween(acorde.rootPc, novoPc)), prefer).name
          : ''
        novo = nomeRaiz + destinoQualidades[indice] + baixo
      } else if (grauDe(acorde.rootPc, destinoPc, targetMode) !== null) {
        // O acorde não pertence à escala de origem, mas pertence à de destino.
        // É o caso do F#7: ele é emprestado em Dó maior, e é o sexto grau
        // legítimo em Sol maior. Transportá-lo por semitons o transformaria em
        // C#7, jogando fora a função que ele cumpre.
        const nomeRaiz = spellNote(acorde.rootPc, prefer).name
        const baixo = acorde.bass ? '/' + spellNote(acorde.bass.pc, prefer).name : ''
        novo = nomeRaiz + acorde.rawSuffix + baixo
      } else {
        // Estrangeiro nos dois lados: desloca e mantém a qualidade escrita.
        novo = transposeChordSymbol(original, fallback, { targetKeyPc: destinoPc })
      }
    }

    saida += novo
    cursor = hit.absEnd
    if (novo !== original) mudancas.push({ from: original, to: novo, semitones: fallback })
  }

  if (cursor < text.length) saida += text.slice(cursor)

  const keyAfter = detectKey(parseCifra(saida))
  return { text: saida, keyBefore, keyAfter, changed: mudancas.length, changes: mudancas }
}

/** Transpõe uma lista de acordes, útil para a régua de acordes. */
export function transposeChordList(
  symbols: string[],
  semitones: number,
  opts: TransposeOptions = {},
): string[] {
  return symbols.map((s) => transposeChordSymbol(s, semitones, opts))
}

/** Puxa um acorde para uma tônica específica, preservando a qualidade. */
export function chordInKey(symbol: string, keyPc: number, opts: TransposeOptions = {}): string {
  const chord = parseChord(symbol)
  if (!chord) return symbol
  return transposeChordSymbol(symbol, semitonesBetween(chord.rootPc, keyPc), {
    ...opts,
    targetKeyPc: keyPc,
  })
}

/**
 * Nome do tom por extenso, em português.
 *
 * "C maior" e "A menor" são mais legíveis que "C" e "Am" num cabeçalho: o
 * modo fica explícito, e quem não lê partitura entende na hora.
 */
export function describeKey(key: DetectedKey): string {
  if (key.source === 'vazio') return 'sem tom'
  const base = keyName(key.pc)
  return key.mode === 'minor' ? `${base} menor` : `${base} maior`
}

/** Os 12 tons para o seletor, na ordem do círculo das quintas. */
export function keyOptions(
  mode: Mode = 'major',
): Array<{ pc: number; name: string; label: string }> {
  return [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5].map((pc) => {
    if (mode === 'minor') {
      const menorPc = mod12(pc + 9)
      return { pc: menorPc, name: keyName(menorPc) + 'm', label: keyName(menorPc) + ' menor' }
    }
    return { pc, name: keyName(pc), label: keyName(pc) + ' maior' }
  })
}

export { parseCifra, detectKey }
export type { DetectedKey, Mode, ParsedCifra }
