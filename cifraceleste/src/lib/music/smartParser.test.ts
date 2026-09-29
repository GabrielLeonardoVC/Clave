import { describe, expect, it } from 'vitest'
import { parseCifra, extractChords, uniqueChords, sectionLabel } from './smartParser'

/** Atalho: os símbolos de acorde de uma linha, na ordem. */
const acordesDa = (linha: string): string[] => {
  const p = parseCifra(linha)
  return p.hits.filter((h) => h.role === 'root').map((h) => h.chord.raw)
}

describe('detecção de acordes', () => {
  it('lê uma linha de acordes', () => {
    expect(acordesDa('C        G')).toEqual(['C', 'G'])
    expect(acordesDa('Am  F  C  G')).toEqual(['Am', 'F', 'C', 'G'])
    expect(acordesDa('C G Am F')).toEqual(['C', 'G', 'Am', 'F'])
    expect(acordesDa('C#m7b5  F#/A#')).toEqual(['C#m7b5', 'F#/A#'])
  })

  it('NUNCA transforma letra em acorde', () => {
    // Cada uma destas linhas já enganou algum app de cifra.
    const letras = [
      'O Senhor e o meu pastor',
      'Nada me faltará',
      'Com Deus é um bom dia',
      'Amém',
      'Amor que não se vai',
      'A Emanuel',
      'Ele é o caminho',
      'Cristão searching',
      'Da glória à vitória',
      'do céu desce',
      'Bênção e paz',
      'Alma que descansa',
      'Emanuel, Emanuel',
    ]
    for (const linha of letras) {
      expect(acordesDa(linha), `acorde falso em: ${linha}`).toEqual([])
      expect(parseCifra(linha).lines[0].kind, `classificou errado: ${linha}`).toBe('lyrics')
    }
  })

  it('não confunde preposição "do" com Ré diminuto', () => {
    expect(acordesDa('do Senhor')).toEqual([])
    // A mesma linha com um acorde real ao lado continua sendo inline.
    const p = parseCifra('C  do Senhor')
    expect(p.lines[0].kind).toBe('inline')
    expect(p.hits.filter((h) => h.role === 'root').map((h) => h.chord.raw)).toEqual(['C'])
  })

  it('separa acorde e letra quando estão na mesma linha', () => {
    const p = parseCifra('C Quando eu crer no Teu chamado')
    const l = p.lines[0]
    expect(l.kind).toBe('inline')
    expect(l.chordRow).not.toBeNull()
    expect(l.lyricRow).not.toBeNull()
    // O acorde tem de ficar exatamente sobre a palavra que ele toca.
    expect(l.chordRow!.indexOf('C')).toBe(l.lyricRow!.indexOf('Quando'))
  })

  it('mantém o alinhamento de uma cifra em duas linhas', () => {
    const texto = 'C        G\nO Senhor e o meu pastor'
    const p = parseCifra(texto)
    expect(p.lines[0].kind).toBe('chords')
    expect(p.lines[0].raw).toBe('C        G')
    // Como as duas linhas são renderizadas na mesma grade monoespaçada,
    // o G cai exatamente sobre o "e o" da letra.
    expect(p.lines[0].raw.indexOf('G')).toBe(9)
    expect(p.lines[1].raw.indexOf('e o')).toBe(9)
  })

  it('lê acordes dentro de colchetes como acordes, não como seção', () => {
    const p = parseCifra('[Am] Eu sou o bom pastor')
    expect(p.declaredRoot).not.toBeNull()
    expect(p.declaredRoot!.rootPc).toBe(9)
  })

  it('reconhece seções sem confundir com acordes', () => {
    expect(sectionLabel('[Refrão]')).toBe('Refrão')
    expect(sectionLabel('REFRÃO:')).toBe('REFRÃO')
    expect(sectionLabel('Verso 1:')).toBe('Verso 1')
    expect(sectionLabel('Solo')).toBe('Solo')
    // Uma linha de acordes não é seção, apesar de não ter letra minúscula.
    expect(sectionLabel('C G Am F')).toBeNull()
    expect(sectionLabel('AM7')).toBeNull()
    // Uma letra comum não é seção.
    expect(sectionLabel('O Senhor e o meu pastor')).toBeNull()
  })

  it('conta o baixo separado como acorde a transpor', () => {
    const p = parseCifra('F#/A#')
    expect(p.hits).toHaveLength(2)
    expect(p.hits[0].role).toBe('root')
    expect(p.hits[1].role).toBe('bass')
    expect(p.hits[1].chord.rootPc).toBe(10)
  })

  it('preserva a estrutura de linhas e a posição de cada acorde', () => {
    const texto = '[C]\nC        G\nO Senhor e o meu pastor\n\nAm   F   C'
    const p = parseCifra(texto)
    expect(p.lines).toHaveLength(5)
    expect(p.lines[3].kind).toBe('blank')
    // Cada posição absoluta tem de apontar para o símbolo no texto original.
    for (const h of p.hits) {
      expect(texto.slice(h.absStart, h.absEnd)).toBe(h.chord.raw)
    }
  })

  it('lê uma cifra real de ponta a ponta sem inventar acorde na letra', () => {
    const cifra = [
      '[G]',
      'Amazing grace how sweet the sound',
      'C              G',
      'That saved a wretch like me',
      'G                        D',
      'I once was lost but now am found',
      '',
      'Was blind but now I see',
      'C        G        D',
      'Was bound but now I\'m free',
    ].join('\n')
    const p = parseCifra(cifra)
    // [G] vem primeiro porque é o tom declarado no topo.
    const todos = uniqueChords(cifra)
    expect(todos).toEqual(['G', 'C', 'D'])
    // Invariante real: nenhum acorde pode estar em uma linha de letra.
    const emLetra = p.hits.filter((h) => p.lines[h.lineIndex].kind === 'lyrics')
    expect(emLetra).toHaveLength(0)
    // E as duas linhas de letra da música não podem ter acorde nenhum.
    const linhasDeLetra = p.lines.filter((l) => l.kind === 'lyrics')
    expect(linhasDeLetra.length).toBeGreaterThanOrEqual(4)
    for (const l of linhasDeLetra) expect(l.chords).toHaveLength(0)
  })

  it('extrai acordes de uma cifra colada do Cifra Club', () => {
    const texto = [
      'O Senhor é o meu pastor',
      'Nada me faltará',
      'C          G',
      'Am         F',
      'C  G  Am  F  C  G  C',
    ].join('\n')
    expect(extractChords(texto)).toEqual([
      'C',
      'G',
      'Am',
      'F',
      'C',
      'G',
      'Am',
      'F',
      'C',
      'G',
      'C',
    ])
  })

  it('lida com texto vazio e espaços', () => {
    expect(parseCifra('').hits).toHaveLength(0)
    expect(parseCifra('   \n  \n').lines.every((l) => l.kind === 'blank')).toBe(true)
  })

  it('não entra em laço infinito com texto enorme ou repetido', () => {
    const grande = 'C G Am F\n'.repeat(2000)
    const p = parseCifra(grande)
    expect(p.lines).toHaveLength(2000)
    expect(p.hits).toHaveLength(8000)
  })
})
