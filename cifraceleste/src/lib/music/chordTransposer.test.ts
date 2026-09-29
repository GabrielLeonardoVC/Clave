import { describe, expect, it } from 'vitest'
import {
  transposeChordSymbol,
  transposeCifra,
  transposeCifraToKey,
  semitonesBetween,
  chordInKey,
  keyOptions,
  describeKey,
} from './chordTransposer'
import { detectKeyFromText } from './keyDetection'
import { parseChord } from './chords'

/**
 * A regra do projeto: nunca produzir Cb nem E# quando existe grafia simples.
 * Este teste varre as 12 alturas x 24 semitons para provar isso.
 */
describe('regra anti-Cb/E#', () => {
  const SIMBOLOS = [
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#',
    'Ab', 'A', 'A#', 'Bb', 'B',
  ]

  it('nenhuma combinação produz Cb, E#, Fb ou B#', () => {
    const proibidos = ['Cb', 'E#', 'Fb', 'B#']
    for (const simbolo of SIMBOLOS) {
      for (let s = -12; s <= 12; s++) {
        const out = transposeChordSymbol(simbolo, s)
        for (const mau of proibidos) {
          expect(
            out.startsWith(mau),
            `${simbolo} com ${s > 0 ? '+' : ''}${s} produziu "${out}"`,
          ).toBe(false)
        }
        // Também não pode haver duplo acidente em lugar nenhum.
        expect(out, `${simbolo} ${s} -> ${out}`).not.toMatch(/##|bb/)
      }
    }
  })

  it('desce de bemol para natural em vez de escrever Cb', () => {
    expect(transposeChordSymbol('Db', -1)).toBe('C')
    expect(transposeChordSymbol('Eb', -1)).toBe('D')
    expect(transposeChordSymbol('Ab', -1)).toBe('G')
    expect(transposeChordSymbol('Gb', -1)).toBe('F')
    expect(transposeChordSymbol('Bb', -1)).toBe('A')
  })

  it('sobe de bemol para natural em vez de escrever E#', () => {
    expect(transposeChordSymbol('Eb', +1)).toBe('E')
    expect(transposeChordSymbol('Ab', +1)).toBe('A')
    expect(transposeChordSymbol('Db', +1)).toBe('D')
    expect(transposeChordSymbol('Gb', +1)).toBe('G')
  })

  it('desce de sustenido para natural em vez de escrever B#', () => {
    expect(transposeChordSymbol('C#', -1)).toBe('C')
    expect(transposeChordSymbol('F#', -1)).toBe('F')
    expect(transposeChordSymbol('G#', -1)).toBe('G')
  })

  it('sobe de sustenido mantendo o sentido, sem dobrar a alteração', () => {
    // B +1 tem que ser C, e não B#.
    expect(transposeChordSymbol('B', +1)).toBe('C')
    expect(transposeChordSymbol('B', -1)).toBe('Bb')
    expect(transposeChordSymbol('C', -1)).toBe('B')
    expect(transposeChordSymbol('F', -1)).toBe('E')
  })

  it('mantém a qualidade e o baixo na transposição', () => {
    // C#m7b5 (C# E G B) + 3 semitons = Em7b5 (E G Bb D).
    expect(transposeChordSymbol('C#m7b5', +3)).toBe('Em7b5')
    // C#m7b5 + 2 semitons = D#m7b5. Segue a grafia de sustenido da origem,
    // que é o correto: trocar para "Em" seria salt de 2 para 4.
    expect(transposeChordSymbol('C#m7b5', +2)).toBe('D#m7b5')
    // F#/A# + 1 semitom: a fundamental vira G e o baixo vira B.
    expect(transposeChordSymbol('F#/A#', +1)).toBe('G/B')
    // A preferência só entra quando há duas grafias possíveis para a mesma
    // altura. C + 1 é C# ou Db.
    expect(transposeChordSymbol('C', +1)).toBe('C#')
    expect(transposeChordSymbol('C', +1, { preferFlats: true })).toBe('Db')
    expect(transposeChordSymbol('C', -1, { preferFlats: true })).toBe('B')
    // O destino tem precedência sobre a preferência do usuário.
    expect(transposeChordSymbol('C', +1, { targetKeyPc: 5 })).toBe('Db')
    // Bbmaj7/D (Bb D F A + D) + 1 = Bmaj7/Eb (B D# F# A# + D#).
    expect(transposeChordSymbol('Bbmaj7/D', +1)).toBe('Bmaj7/Eb')
    expect(transposeChordSymbol('Cmin7', +1)).toBe('C#min7')
    // A grafia da qualidade é preservada como o usuário digitou.
    expect(transposeChordSymbol('Cmin7', +1)).toContain('min7')
  })

  it('não altera o símbolo quando não há acorde', () => {
    expect(transposeChordSymbol('Amém', +2)).toBe('Amém')
    expect(transposeChordSymbol('Composição', -3)).toBe('Composição')
    expect(transposeChordSymbol('C', 0)).toBe('C')
  })
})

describe('transposição de tom para tom', () => {
  it('escolhe sempre o menor movimento', () => {
    expect(semitonesBetween(0, 5)).toBe(5) //  C -> F  (quinta acima)
    expect(semitonesBetween(0, 7)).toBe(-5) // C -> G  (quarta abaixo)
    expect(semitonesBetween(5, 0)).toBe(-5) // F -> C  (quarta abaixo)
    expect(semitonesBetween(0, 1)).toBe(1)
    expect(semitonesBetween(0, 6)).toBe(6)
    // Nunca devolve mais de 6 semitons, para a mão não ter de se deslocar
    // para o outro extremo do cravo.
    for (let a = 0; a < 12; a++) {
      for (let b = 0; b < 12; b++) {
        expect(Math.abs(semitonesBetween(a, b))).toBeLessThanOrEqual(6)
      }
    }
  })

  it('usa a armadura do tom de destino', () => {
    // Indo de C para F (um bemol na armadura), tudo é escrito com bemol.
    const r = transposeCifraToKey('C\nC  G  Am  F', 5)
    expect(r.text).toBe('F\nF  C  Dm  Bb')
    expect(r.text).not.toContain('A#m')
    expect(r.text).not.toContain('G#m')

    // Indo de C para G, a armadura pede sustenido.
    const g = transposeCifraToKey('C\nC  G  Am  F', 7)
    expect(g.text).toBe('G\nG  D  Em  C')
  })
})

describe('transposição da cifra inteira', () => {
  const CIFRA = [
    '[C]',
    'O Senhor é o meu pastor',
    'C          G',
    'Nada me faltará',
    'Am         F',
    'C     G     C',
  ].join('\n')

  it('troca os acordes e preserva a letra byte a byte', () => {
    const r = transposeCifra(CIFRA, +2)
    const antes = CIFRA.split('\n')
    const depois = r.text.split('\n')
    expect(depois).toHaveLength(antes.length)
    for (let i = 0; i < antes.length; i++) {
      // A linha 0 é a declaração de tom, que também muda.
      if (i === 0) continue
      const soLetra = (s: string) => s.replace(/[A-Ga-g][#b]?[a-zA-Z0-9°øΔ+/#-]*/g, '§')
      expect(soLetra(depois[i])).toBe(soLetra(antes[i]))
    }
    // [C] + 2 na linha de tom + 2 na linha 2 + 2 na linha 4 + 3 na linha 5.
    expect(r.changed).toBe(8)
  })

  it('mantém o alinhamento dos acordes na grade monoespaçada', () => {
    const r = transposeCifra('C          G', +2)
    // "Dm" ocupa duas colunas, como "C" ocupava uma; o G continua na coluna 11.
    expect(r.text.indexOf('A')).toBe(11)
  })

  it('não toca em nada quando o número de semitons é zero', () => {
    const r = transposeCifra(CIFRA, 0)
    expect(r.text).toBe(CIFRA)
    expect(r.changed).toBe(0)
  })

  it('devolve o texto intacto quando não há nenhum acorde', () => {
    const soLetra = 'O Senhor é o meu pastor\nNada me faltará'
    const r = transposeCifra(soLetra, +3)
    expect(r.text).toBe(soLetra)
    expect(r.changed).toBe(0)
  })

  it('nunca cria acorde na letra durante o caminho', () => {
    let atual = CIFRA
    // Vinte passos de meio tom em cada direção, como o usuario faria girando.
    for (let s = -10; s <= 10; s++) {
      const r = transposeCifra(atual, s)
      const novo = detectKeyFromText(r.text)
      expect(novo).toBeTruthy()
      // A linha de letra tem de continuar sem nenhum acorde.
      const linhas = r.text.split('\n')
      expect(linhas[1]).toBe('O Senhor é o meu pastor')
      expect(linhas[3]).toBe('Nada me faltará')
      atual = r.text
    }
  })

  it('aponta o tom antes e depois', () => {
    const r = transposeCifraToKey('C\nC  G  Am  F', 0)
    expect(describeKey(r.keyBefore)).toContain('maior')
    expect(r.keyAfter.pc).toBe(0)
  })
})

describe('detecção de tom', () => {
  it('encontra a tônica de cifras com progressão típica', () => {
    const emC = ['C', 'C          G', 'Am         F', 'C     G     C'].join('\n')
    expect(detectKeyFromText(emC).name).toBe('C')

    const emG = ['G', 'C              G', 'Am         D7', 'G     C     G'].join('\n')
    expect(detectKeyFromText(emG).name).toBe('G')

    const emF = ['F', 'Dm            Bb', 'F     C     F'].join('\n')
    expect(detectKeyFromText(emF).name).toBe('F')
  })

  it('respeita o tom declarado entre colchetes', () => {
    // O texto sugere C, mas a declaração manda.
    const r = detectKeyFromText('[F]\nC  G  Am  F')
    expect(r.name).toBe('F')
    expect(r.source).toBe('declarado')
    expect(r.confidence).toBe(1)
  })

  it('detecta modo menor a partir da qualidade declarada', () => {
    expect(detectKeyFromText('[Am]\nAm  F  C  G').name).toBe('Am')
    expect(detectKeyFromText('[Em]\nEm  C  G  D').name).toBe('Em')
  })

  it('não inventa tom quando não há acorde nenhum', () => {
    const k = detectKeyFromText('Só uma letra, nenhum acorde aqui')
    expect(k.source).toBe('vazio')
    expect(k.confidence).toBe(0)
  })
})

describe('utilidades de tom', () => {
  it('monta a lista de 12 tons sem repetição', () => {
    const maiores = keyOptions('major')
    const menores = keyOptions('minor')
    expect(maiores).toHaveLength(12)
    expect(menores).toHaveLength(12)
    expect(new Set(maiores.map((k) => k.name)).size).toBe(12)
    expect(new Set(menores.map((k) => k.name)).size).toBe(12)
    expect(menores[0].name).toBe('Am')
  })

  it('puxa um acorde para um tom preservando a qualidade', () => {
    expect(chordInKey('C', 7)).toBe('G')
    expect(chordInKey('C7', 5)).toBe('F7')
    expect(chordInKey('Am', 9)).toBe('Am')
    expect(parseChord(chordInKey('Cmin7', 10))!.qualityId).toBe('min7')
  })
})
