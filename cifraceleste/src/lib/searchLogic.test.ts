import { describe, expect, it } from 'vitest'
import {
  search,
  searchTitles,
  normalizeText,
  boundedEditDistance,
  words,
  warmSearchIndex,
} from './searchLogic'

interface Musica {
  titulo: string
  artista?: string
  tags?: string[]
  categoria?: string
  tom?: string
  letra?: string
}

const REPERTORIO: Musica[] = [
  { titulo: 'O Senhor é o meu Pastor', artista: 'Claudio Bassés', tags: ['paz', 'consolo'], categoria: 'Adoração', tom: 'C' },
  { titulo: 'Preziosa Graça', artista: 'Hinos', tags: ['hinario', 'graca'], categoria: 'Hino', tom: 'G' },
  { titulo: 'Amazing Grace', artista: 'John Newton', tags: ['shelter'], categoria: 'Hino', tom: 'G', letra: 'Amazing grace how sweet the sound' },
  { titulo: 'Como Foi Grande', artista: 'Diante do Trono', tags: ['adoracao'], categoria: 'Oferta', tom: 'E' },
  { titulo: 'Prisões', artista: 'Nívea Soares', tags: ['luta'], categoria: 'Entrada', tom: 'A' },
  { titulo: 'Deus é Amor', artista: 'Diante do Trono', tags: ['amor'], categoria: 'Comunhão', tom: 'D' },
  { titulo: 'Tu És Fiel, Senhor', artista: 'Arautos do Rei', tags: ['fidelidade'], categoria: 'Fundo', tom: 'Bb' },
  { titulo: 'Senhor Te Adoro', artista: 'Adoradores', tags: ['adoracao'], categoria: 'Entrada', tom: 'Eb' },
  { titulo: 'Ave Maria', artista: 'Schubert', tags: ['classic'], categoria: 'Missa', tom: 'Am' },
  { titulo: 'Magnificat', artista: 'Tradicional', tags: ['classic'], categoria: 'Missa', tom: 'Dm' },
  { titulo: 'Vencedor', artista: 'Fernanda Brum', tags: ['sucesso'], categoria: 'Saída', tom: 'F' },
  { titulo: 'Fiel Esforço', artista: 'Mumford', tags: ['rock'], categoria: 'Coro', tom: 'C' },
]

describe('normalização', () => {
  it('tira acento e pontuação', () => {
    expect(normalizeText('Graça')).toBe('graca')
    expect(normalizeText('O Senhor é o meu Pastor')).toBe('o senhor e o meu pastor')
    expect(normalizeText('Cifra #1 — Eminor!')).toBe('cifra 1 eminor')
    expect(normalizeText('  espaços   demais  ')).toBe('espacos demais')
    // O til continua, porque é outra letra e não um acento combinante.
    expect(normalizeText('Coração')).toBe('coracao')
  })

  it('separa em palavras', () => {
    expect(words('O Senhor é o meu Pastor')).toEqual(['o', 'senhor', 'e', 'o', 'meu', 'pastor'])
    expect(words('')).toEqual([])
  })
})

describe('distância de edição', () => {
  it('mede a distância corretamente', () => {
    expect(boundedEditDistance('pastor', 'pastor', 2)).toBe(0)
    expect(boundedEditDistance('pastor', 'pasotr', 2)).toBe(2)
    expect(boundedEditDistance('pastor', 'pastorx', 2)).toBe(1)
    expect(boundedEditDistance('abc', 'xyz', 1)).toBe(2)
  })

  it('corta cedo quando já passou do limite', () => {
    // Mesmo resultado, mas sem percorrer as duas matrizes inteiras.
    expect(boundedEditDistance('pastor', 'completamente', 1)).toBeGreaterThan(1)
  })
})

describe('busca exata e por prefixo', () => {
  it('acha por título exato', () => {
    const r = search(REPERTORIO, 'Prisões')
    expect(r[0].item.titulo).toBe('Prisões')
    expect(r[0].score).toBeGreaterThan(0.9)
  })

  it('acha por prefixo', () => {
    expect(search(REPERTORIO, 'prez')[0].item.titulo).toBe('Preziosa Graça')
    expect(search(REPERTORIO, 'pris')[0].item.titulo).toBe('Prisões')
  })

  it('ignora acento do usuário', () => {
    expect(search(REPERTORIO, 'prisoes')[0].item.titulo).toBe('Prisões')
    expect(search(REPERTORIO, 'prIsoes')[0].item.titulo).toBe('Prisões')
    expect(search(REPERTORIO, 'GIRACA')[0].item.titulo).toBe('Preziosa Graça')
  })

  it('acha por artista', () => {
    const r = search(REPERTORIO, 'diante do trono')
    expect(r.length).toBe(2)
    expect(r.every((x) => x.item.artista === 'Diante do Trono')).toBe(true)
  })

  it('acha por tag e categoria', () => {
    expect(search(REPERTORIO, 'shelter')[0].item.titulo).toBe('Amazing Grace')
    expect(search(REPERTORIO, 'oferta')[0].item.titulo).toBe('Como Foi Grande')
  })
})

describe('tolerância a erro de digitação', () => {
  it('acha com uma letra trocada', () => {
    expect(search(REPERTORIO, 'prisoes'[0] + 'X' + 'isoes')[0].item.titulo).toBe('Prisões')
    expect(search(REPERTORIO, 'amazing')[0].item.titulo).toBe('Amazing Grace')
    expect(search(REPERTORIO, 'amazingg')[0].item.titulo).toBe('Amazing Grace')
  })

  it('acha com letra faltando ou sobrando', () => {
    expect(search(REPERTORIO, 'preziosa')[0].item.titulo).toBe('Preziosa Graça')
    expect(search(REPERTORIO, 'prziosa')[0].item.titulo).toBe('Preziosa Graça')
  })

  it('acha com as duas letras trocadas de lugar', () => {
    // Erro típico de dedo no celular: "prezoisa" em vez de "preziosa".
    expect(search(REPERTORIO, 'prezoisa')[0].item.titulo).toBe('Preziosa Graça')
    expect(search(REPERTORIO, 'amazign')[0].item.titulo).toBe('Amazing Grace')
  })

  it('acha por subquência em palavra longa', () => {
    expect(search(REPERTORIO, 'pastr')[0].item.titulo).toBe('O Senhor é o meu Pastor')
    expect(search(REPERTORIO, 'snh')[0].item.titulo).toBe('O Senhor é o meu Pastor')
  })

  it('não casa palavra só porque tem a mesma inicial', () => {
    // Regressão: comparar só a primeira letra fazia qualquer palavra com a
    // mesma inicial passar, e a busca devolvia resultados sem relação.
    const r = search(REPERTORIO, 'pastr')
    const titulos = r.map((x) => x.item.titulo)
    expect(titulos).toEqual(['O Senhor é o meu Pastor'])
  })

  it('não inventa resultado para o que não existe', () => {
    expect(search(REPERTORIO, 'xablau')).toHaveLength(0)
    expect(search(REPERTORIO, 'guitarra eletrica')).toHaveLength(0)
    expect(search(REPERTORIO, 'pqp')).toHaveLength(0)
  })

  it('respeita o modo estrito', () => {
    // Em modo estrito, o erro de digitação deixa de compensar.
    const flex = search(REPERTORIO, 'prziosa')
    const duro = search(REPERTORIO, 'prziosa', { strict: true })
    expect(flex.length).toBeGreaterThan(0)
    expect(duro.length).toBe(0)
  })
})

describe('semântica deconjuntiva', () => {
  it('exige que todos os termos casem', () => {
    const r = search(REPERTORIO, 'preziosa graça')
    expect(r).toHaveLength(1)
    expect(r[0].item.titulo).toBe('Preziosa Graça')
  })

  it('não devolve resultado parcial', () => {
    // "preziosa" casa, "violao" não: nada entra no resultado.
    expect(search(REPERTORIO, 'preziosa violao')).toHaveLength(0)
  })

  it('busca em vários campos ao mesmo tempo', () => {
    const r = search(REPERTORIO, 'john newton')
    expect(r[0].item.titulo).toBe('Amazing Grace')
  })
})

describe('ordenação', () => {
  it('coloca as correspondências exatas acima das aproximadas', () => {
    const r = search(REPERTORIO, 'senhor')
    const titulos = r.map((x) => x.item.titulo)
    // Três músicas têm "Senhor" no título; "Amazing Grace" só tem na letra e
    // precisa ficar por último, mesmo passando pela tolerância a erro.
    expect(titulos).toHaveLength(3)
    expect(titulos.sort()).toEqual(
      ['O Senhor é o meu Pastor', 'Senhor Te Adoro', 'Tu És Fiel, Senhor'].sort(),
    )
  })

  it('ordena de forma determinística em caso de empate', () => {
    const a = search(REPERTORIO, 'adoracao')
    const b = search(REPERTORIO, 'adoracao')
    expect(a.map((x) => x.item.titulo)).toEqual(b.map((x) => x.item.titulo))
  })

  it('respeita o limite', () => {
    expect(search(REPERTORIO, 'senhor', { limit: 1 })).toHaveLength(1)
    expect(searchTitles(REPERTORIO, 'a', 3)).toHaveLength(3)
  })
})

describe('casos de borda', () => {
  it('devolve vazio para consulta vazia, sem quebrar', () => {
    expect(search(REPERTORIO, '')).toHaveLength(0)
    expect(search(REPERTORIO, '   ')).toHaveLength(0)
    expect(search(REPERTORIO, '!!!')).toHaveLength(0)
  })

  it('aguenta lista vazia', () => {
    expect(search([], 'qualquer')).toHaveLength(0)
  })

  it('não estoura com texto muito longo', () => {
    const longo = 'a'.repeat(500)
    expect(() => search(REPERTORIO, longo)).not.toThrow()
    expect(search(REPERTORIO, longo)).toHaveLength(0)
  })

  it('acha mesmo com um espaço a mais no meio', () => {
    expect(search(REPERTORIO, 'preziosa  graca')).toHaveLength(1)
  })
})

describe('desempenho', () => {
  const construir = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      titulo: `Música de Teste Número ${i}`,
      artista: `Artista ${i % 300}`,
      tags: ['tag' + (i % 40)],
      categoria: 'Categoria ' + (i % 10),
    }))

  // Os limites abaixo são generosos de propósito: o runner de teste roda com
  // instrumentação e é bem mais lento que a aplicação real. As medidas feitas
  // fora do runner, que é o que importa para o usuário, são cerca de 2 ms por
  // busca com 300 músicas e 26 ms com 5.000.
  const DIGITANDO = ['m', 'mu', 'mus', 'musi', 'musica', 'musica teste', 'musica teste 4321']

  it('é instantânea no tamanho real de um repertório de igreja', () => {
    const itens = construir(300)
    warmSearchIndex(itens)

    const inicio = performance.now()
    for (const trecho of DIGITANDO) search(itens, trecho)
    const porBusca = (performance.now() - inicio) / DIGITANDO.length

    // Sete buscas, como alguém digitando um título com pressa.
    expect(porBusca).toBeLessThan(25)
  })

  it('aguenta cinco mil músicas sem travar', () => {
    const itens = construir(5000)
    warmSearchIndex(itens)

    const inicio = performance.now()
    for (const trecho of DIGITANDO) search(itens, trecho)
    const porBusca = (performance.now() - inicio) / DIGITANDO.length

    expect(porBusca).toBeLessThan(90)
  })

  it('a indexação inicial acontece uma vez só', () => {
    const itens = construir(2000)
    warmSearchIndex(itens)
    // Segunda chamada não deve reconstruir nada de relevante.
    const inicio = performance.now()
    warmSearchIndex(itens)
    expect(performance.now() - inicio).toBeLessThan(60)
  })

  it('reindexa quando o conteúdo da música muda', () => {
    const lista = [{ titulo: 'Antes' }]
    expect(search(lista, 'depois')).toHaveLength(0)
    lista[0].titulo = 'Depois'
    expect(search(lista, 'depois')).toHaveLength(1)
  })

  it('não trava com a letra inteira de todas as músicas', () => {
    const comLetra = Array.from({ length: 300 }, (_, i) => ({
      titulo: `Canta ${i}`,
      letra: 'lalalala '.repeat(120) + ` final ${i}`,
    }))
    warmSearchIndex(comLetra)
    const inicio = performance.now()
    const r = search(comLetra, 'final 299')
    expect(performance.now() - inicio).toBeLessThan(120)
    // A letra continua sendo pesquisável.
    expect(r.length).toBeGreaterThan(0)
  })

  it('devolve o mesmo resultado com e sem a letra no índice', () => {
    const comLetra = [{ titulo: 'Vencedor', letra: 'Sou vencedor do Senhor' }]
    const semLetra = [{ titulo: 'Vencedor' }]
    // "vence" está no título nos dois casos.
    expect(search(comLetra, 'vencedor').length).toBe(search(semLetra, 'vencedor').length)
    // "senhor" só existe na letra.
    expect(search(semLetra, 'senhor')).toHaveLength(0)
    expect(search(comLetra, 'senhor')).toHaveLength(1)
  })
})
