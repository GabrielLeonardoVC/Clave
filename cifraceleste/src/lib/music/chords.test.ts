import { describe, expect, it } from 'vitest'
import { noteName, spellNote, pcFromName, keyPrefersFlats, keyName, TWELVE_KEYS } from './notes'
import { parseChord, chordAt, isChordSymbol, formatChord, chordNotes } from './chords'

describe('notas', () => {
  it('nomeia as 12 alturas sem produzir Cb nem E#', () => {
    const nomes: string[] = []
    for (let pc = 0; pc < 12; pc++) {
      nomes.push(noteName(pc, 'sharp'), noteName(pc, 'flat'))
    }
    expect(nomes).not.toContain('Cb')
    expect(nomes).not.toContain('E#')
    expect(nomes).not.toContain('Fb')
    expect(nomes).not.toContain('B#')
  })

  it('respeita a preferência de sustenido e bemol', () => {
    expect(noteName(1, 'sharp')).toBe('C#')
    expect(noteName(1, 'flat')).toBe('Db')
    expect(noteName(3, 'sharp')).toBe('D#')
    expect(noteName(3, 'flat')).toBe('Eb')
    expect(noteName(6, 'sharp')).toBe('F#')
    expect(noteName(6, 'flat')).toBe('Gb')
    expect(noteName(10, 'sharp')).toBe('A#')
    expect(noteName(10, 'flat')).toBe('Bb')
  })

  it('prefere sempre a grafia mais simples', () => {
    // Si e Dó nunca ganham duplo acidente, em nenhuma preferência.
    expect(noteName(11, 'sharp')).toBe('B')
    expect(noteName(11, 'flat')).toBe('B')
    expect(noteName(0, 'sharp')).toBe('C')
    expect(noteName(0, 'flat')).toBe('C')
    expect(noteName(4, 'flat')).toBe('E')
    expect(noteName(5, 'sharp')).toBe('F')
  })

  it('tem grafia com no máximo uma alteração', () => {
    for (let pc = 0; pc < 12; pc++) {
      for (const pref of ['sharp', 'flat'] as const) {
        const s = spellNote(pc, pref)
        expect(Math.abs(s.alter)).toBeLessThanOrEqual(1)
        expect(s.name).toHaveLength(s.alter === 0 ? 1 : 2)
      }
    }
  })

  it('converte grafias para altura, inclusive as portuguesas', () => {
    expect(pcFromName('C')).toBe(0)
    expect(pcFromName('F#')).toBe(6)
    expect(pcFromName('Bb')).toBe(10)
    expect(pcFromName('dó')).toBe(1)
    expect(pcFromName('Ré')).toBe(2)
    expect(pcFromName('Mi')).toBe(4)
    expect(pcFromName('Fá')).toBe(5)
    expect(pcFromName('Sol')).toBe(7)
    expect(pcFromName('Lá')).toBe(9)
    expect(pcFromName('Si')).toBe(11)
    expect(pcFromName('lixo')).toBeNull()
  })

  it('escolhe bemol só nos tons que pedem', () => {
    expect(keyPrefersFlats(0)).toBe(false) // C
    expect(keyPrefersFlats(7)).toBe(false) // G
    expect(keyPrefersFlats(5)).toBe(true) //  F
    expect(keyPrefersFlats(10)).toBe(true) // Bb
    expect(keyPrefersFlats(3)).toBe(true) //  Eb
    expect(keyPrefersFlats(2)).toBe(false) // D
  })

  it('lista os 12 tons sem repetir nenhum', () => {
    expect(TWELVE_KEYS).toHaveLength(12)
    expect(new Set(TWELVE_KEYS.map((k) => k.pc)).size).toBe(12)
    expect(new Set(TWELVE_KEYS.map((k) => k.major)).size).toBe(12)
    expect(keyName(1)).toBe('Db')
    expect(keyName(3)).toBe('Eb')
  })
})

describe('leitura de acordes', () => {
  it('lê acordes complexos que quebram parsers ingênuos', () => {
    const casos: Array<[string, number, string]> = [
      ['C', 0, 'maj'],
      ['Am', 9, 'min'],
      ['Cm', 0, 'min'],
      ['CM7', 0, 'maj7'],
      ['Cmaj7', 0, 'maj7'],
      ['Cmin7', 0, 'min7'],
      ['C#m7b5', 1, 'min7b5'],
      ['F#7sus4', 6, '7sus4'],
      ['Cø', 0, 'min7b5'],
      ['Bdim', 11, 'dim'],
      ['Aaug', 9, 'aug'],
      ['C+', 0, 'aug'],
      ['C6/9', 0, '69'],
      ['C/G', 0, 'maj'],
      ['Bbmaj7/D', 10, 'maj7'],
      ['F#/A#', 6, 'maj'],
      ['G7sus4', 7, '7sus4'],
      ['Dm7b5', 2, 'min7b5'],
      ['Cadd9', 0, 'add9'],
      ['Cmaj7#11', 0, 'maj7#11'],
    ]
    for (const [simbolo, rootPc, qualidade] of casos) {
      const c = parseChord(simbolo)
      expect(c, `não leu ${simbolo}`).not.toBeNull()
      expect(c!.rootPc, `fundamental errada em ${simbolo}`).toBe(rootPc)
      expect(c!.qualityId, `qualidade errada em ${simbolo}`).toBe(qualidade)
    }
  })

  it('distingue menor (m) de maior com sétima (M)', () => {
    expect(parseChord('Cm')!.qualityId).toBe('min')
    expect(parseChord('CM7')!.qualityId).toBe('maj7')
    expect(parseChord('CM')!.qualityId).toBe('maj')
  })

  it('separa e preserva o baixo', () => {
    const c = parseChord('Bbmaj7/D')
    expect(c!.bass).not.toBeNull()
    expect(c!.bass!.pc).toBe(2)
    expect(c!.rootPc).toBe(10)
  })

  it('recusa o que não é acorde', () => {
    for (const naoAcorde of ['', 'Composição', 'Amém', 'Deus', 'xkcd', '123', 'H', 'I', 'aaaaaa']) {
      expect(isChordSymbol(naoAcorde), `aceitou "${naoAcorde}"`).toBe(false)
    }
  })

  it('casa no meio do texto sem invadir a palavra seguinte', () => {
    const texto = 'Amém C'
    // "Amém" não é acorde: o lookahead barra o "é".
    expect(chordAt(texto, 0)).toBeNull()
    // "C" no fim da linha é acorde.
    const achado = chordAt(texto, 5)
    expect(achado!.chord.raw).toBe('C')
    expect(achado!.end).toBe(6)
  })

  it('lê inline sem parar na metade da qualidade', () => {
    const achado = chordAt('Cmin7 F', 0)
    expect(achado!.chord.raw).toBe('Cmin7')
    expect(achado!.end).toBe(5)
    expect(achado!.chord.qualityId).toBe('min7')
  })

  it('lista as notas do acorde em ordem', () => {
    expect(chordNotes(parseChord('C')!)).toEqual([0, 4, 7])
    expect(chordNotes(parseChord('Am')!)).toEqual([9, 0, 4])
    expect(chordNotes(parseChord('C7')!)).toEqual([0, 4, 7, 10])
    expect(chordNotes(parseChord('Cm7b5')!)).toEqual([0, 3, 6, 10])
  })

  it('formata de volta preservando a grafia da qualidade', () => {
    expect(formatChord(0, 'maj', null, 'sharp')).toBe('C')
    expect(formatChord(1, 'min7b5', null, 'flat')).toBe('Dbm7b5')
    expect(formatChord(6, 'maj7', 10, 'flat')).toBe('Gbmaj7/Bb')
  })
})
