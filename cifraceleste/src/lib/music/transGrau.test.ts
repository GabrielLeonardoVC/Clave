import { describe, expect, it } from 'vitest'
import { transposeCifraPorGrau } from './chordTransposer'
import { parseCifra } from './smartParser'

/** Uma cifra de progressão típica em Dó maior. */
const EM_C = ['[C]', 'C          G', 'Am         F', 'C     G     C'].join('\n')

/**
 * Os símbolos de acorde da progressão, sem a declaração de tom.
 *
 * A linha 0 é descartada porque é onde fica o tom entre colchetes, e ele é
 * lido como acorde igual a qualquer outro.
 */
const acordes = (texto: string): string[] =>
  parseCifra(texto)
    .hits.filter((h) => h.role === 'root' && h.lineIndex > 0)
    .map((h) => h.chord.raw)

/** Remove tudo que parece acorde, deixando o resto da linha intacto. */
const semAcordes = (linha: string): string =>
  linha.replace(/[A-Ga-g][#b]?[a-zA-Z0-9°øΔ+#/-]*/g, '§')

/**
 * Transposição por grau.
 *
 * Existe porque duas tonalidades com a mesma armadura não são transposição
 * uma da outra. O caso de teste é o clássico: levar uma música de Dó maior
 * para Lá menor.
 */
describe('transposição por grau', () => {
  it('reatribui os graus, e não só desloca as alturas', () => {
    const r = transposeCifraPorGrau(EM_C, 9, 'minor')
    // De Dó maior para Lá menor:
    //   C  (grau 1) -> Am      G  (grau 5) -> Em
    //   Am (grau 6) -> F       F  (grau 4) -> Dm
    // Um deslocamento fixo de 9 semitons daria A, E, F# e D. O F# está errado:
    // não pertence a Lá menor, e o acorde correto ali é o C.
    expect(acordes(r.text)).toEqual(['Am', 'Em', 'F', 'Dm', 'Am', 'Em', 'Am'])
  })

  it('o resultado pertence de fato à tonalidade de destino', () => {
    for (const simbolo of acordes(transposeCifraPorGrau(EM_C, 9, 'minor').text)) {
      // Lá menor não usa nenhum sustenido.
      expect(simbolo, `sustenido indevido em Lá menor: ${simbolo}`).not.toContain('#')
    }
  })

  it('nunca produz Cb, E#, Fb nem B#, em nenhuma tonalidade', () => {
    for (let pc = 0; pc < 12; pc++) {
      for (const modo of ['major', 'minor'] as const) {
        const r = transposeCifraPorGrau(EM_C, pc, modo)
        expect(r.text, `tônica ${pc} ${modo}`).not.toMatch(/Cb|E#|Fb|B#/)
        expect(r.text, `tônica ${pc} ${modo}`).not.toMatch(/##|bb/)
      }
    }
  })

  it('preserva a letra linha a linha', () => {
    const r = transposeCifraPorGrau(EM_C, 4, 'minor')
    const destino = r.text.split('\n')
    const origem = EM_C.split('\n')
    expect(destino).toHaveLength(origem.length)
    for (let i = 1; i < origem.length; i++) {
      expect(semAcordes(destino[i]), `linha ${i} alterada`).toBe(semAcordes(origem[i]))
    }
  })

  it('usa a armadura do tom de destino', () => {
    // Para Fá maior, que tem um bemol: os mesmos graus, grafados com bemol.
    const r = transposeCifraPorGrau(EM_C, 5, 'major')
    expect(acordes(r.text)).toEqual(['F', 'C', 'Dm', 'Bb', 'F', 'C', 'F'])
    expect(r.text).not.toContain('#')
  })

  it('para o mesmo tom de origem não mexe em nada', () => {
    const r = transposeCifraPorGrau(EM_C, 0, 'major')
    expect(acordes(r.text)).toEqual(acordes(EM_C))
    expect(r.changed).toBe(0)
  })

  it('não inventa tom quando a cifra não tem acordes', () => {
    const soLetra = 'O Senhor é o meu pastor\nNada me faltará'
    const r = transposeCifraPorGrau(soLetra, 5, 'major')
    expect(r.text).toBe(soLetra)
    expect(r.changed).toBe(0)
    expect(r.keyBefore.source).toBe('vazio')
  })

  it('acorde emprestado que pertence ao destino continua onde está', () => {
    // F#7 não é diatônico em Dó maior, mas é o sexto grau legítimo de Sol
    // maior. Deslocá-lo por semitons daria C#7, jogando fora a função.
    const r = transposeCifraPorGrau('[C]\nC    F#7    G', 7, 'major')
    expect(acordes(r.text)).toEqual(['G', 'F#7', 'D'])
    expect(r.text).not.toMatch(/Cb|E#/)
  })

  it('acorde estranho aos dois lados é deslocado, mantendo a qualidade', () => {
    // Db7 não pertence nem a Dó maior nem a Sol maior. Não há grau a que
    // reatribuí-lo, então o motor o desloca e preserva a dominante com sétima.
    const r = transposeCifraPorGrau('[C]\nC   Db7   G', 7, 'major')
    expect(acordes(r.text)).toEqual(['G', 'G#7', 'D'])
    // Sol maior não tem sustenido na escala, mas o acorde cromático traz um,
    // e isso é correto: ele não é diatônico em lugar nenhum.
    expect(r.text).not.toMatch(/Cb|E#/)
  })

  it('reconhece o mesmo grau em posição invertida', () => {
    // G depois de C é o grau 5, mesmo estando uma oitava acima. Sem isso, a
    // progressão inteira seria tratada como não diatônica.
    const r = transposeCifraPorGrau('[C]\nC        G        D', 7, 'major')
    // Em G maior: grau 1 -> G, grau 5 -> D, grau 2 -> Am
    expect(acordes(r.text)).toEqual(['G', 'D', 'Am'])
  })

  it('preserva a inversão do baixo', () => {
    const r = transposeCifraPorGrau('[C]\nC/G   F/A', 7, 'major')
    // Em Dó maior, C/G tem a quinta no baixo. Em Sol maior, o mesmo papel cabe
    // a G/D, e não a G/B: o que se preserva é a inversão, não a nota.
    expect(acordes(r.text)).toEqual(['G/D', 'C/E'])
  })

  it('a contagem de mudanças inclui a declaração de tom', () => {
    const r = transposeCifraPorGrau(EM_C, 2, 'major')
    // Sete acordes na progressão, mais o `[C]` do topo, que também muda: é
    // justamente ele que informa o tom de partida para quem abrir a cifra.
    expect(r.changed).toBe(8)
    expect(r.text.split('\n')[0]).toBe('[D]')
  })

  it('funciona para uma cifra longa, com seções e várias modalidades', () => {
    const longa = [
      '[G]',
      'Verso 1:',
      'C              G',
      'Am         D7',
      'Refrão:',
      'C     G     C',
      'Solo:',
      'D          Am',
    ].join('\n')

    // Para Eb menor. As tríades de Eb menor, conferidas na mão, são:
    //   Ebm  Fdim  Gb  Abm  Bbm  Cb  Db
    // A progressão de origem está em Sol maior, onde C é o grau 4, G o grau 1,
    // Am o grau 2 e D o grau 5. Cada um vira o mesmo grau em Eb menor.
    const r = transposeCifraPorGrau(longa, 3, 'minor')
    expect(acordes(r.text)).toEqual([
      'Abm', 'Ebm', // C (grau 4), G (grau 1)
      'Fdim', 'Bbm', // Am (grau 2), D (grau 5)
      'Abm', 'Ebm', 'Abm', // refrão: C, G, C
      'Bbm', 'Fdim', // solo: D, Am
    ])

    // Todo acorde pertence mesmo a Eb menor, e nenhum usa sustenido.
    for (const s of acordes(r.text)) expect(s, `sustenido em Eb menor: ${s}`).not.toContain('#')

    // Os rótulos de seção sobrevivem intactos.
    expect(r.text).toContain('Verso 1:')
    expect(r.text).toContain('Refrão:')
    expect(r.text).toContain('Solo:')
    expect(r.text.split('\n')[0]).toBe('[Ebm]')
  })

  it('para uma tonalidade com bemol, usa bemol em tudo', () => {
    const longa = ['[G]', 'C     G     Am'].join('\n')
    const r = transposeCifraPorGrau(longa, 3, 'major')
    // Tríades de Eb maior: Eb  Fm  Gm  Ab  Bb  Cm  Ddim
    // C é grau 4, G é grau 1, Am é grau 2.
    expect(acordes(r.text)).toEqual(['Ab', 'Eb', 'Fm'])
    expect(r.text).not.toContain('#')
  })

  it('não deixa lixo para trás em nenhum caminho de 24 em 24', () => {
    // A armadura de destino tem de valer para o acorde de tom inclusive, e a
    // declaração nunca pode sair com duplo acidente.
    for (let pc = 0; pc < 12; pc++) {
      for (const modo of ['major', 'minor'] as const) {
        const r = transposeCifraPorGrau(EM_C, pc, modo)
        const primeira = r.text.split('\n')[0]
        expect(primeira, `tônica ${pc} ${modo}: ${primeira}`).not.toMatch(/##|bb/)
        expect(primeira, `tônica ${pc} ${modo}: ${primeira}`).toMatch(/^\[[A-G][#b]?m?\]$/)
      }
    }
  })
})
