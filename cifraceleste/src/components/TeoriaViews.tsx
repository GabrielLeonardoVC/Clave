/**
 * TeoriaViews — desenho do teclado e do braço do violão.
 *
 * São visões, não componentes de lógica: recebem as notas e desenham.
 */

import { keyName } from '@/lib/music/notes'

// ─────────────────────────────────────────────────────────────────────────
//  Teclado
// ─────────────────────────────────────────────────────────────────────────

/** Alturas das teclas brancas, começando em Dó. */
const BRANCAS = [0, 2, 4, 5, 7, 9, 11]

/** Cada tecla preta fica entre duas brancas. Os números são os índices
 *  da branca à esquerda, e o valor é a altura da preta. Uma oitava tem
 *  7 brancas e 5 pretas: desenhar 2 pretas por oitava deixa o teclado
 *  com cara errada. */
const PRETAS: Array<[branca: number, altura: number]> = [
  [0, 1],
  [1, 3],
  [3, 6],
  [4, 8],
  [5, 10],
]

/** Teclado de duas oitavas, com as notas da escala destacadas. */
export function NotaEmTeclado({ notas, oitavas = 2 }: { notas: number[]; oitavas?: number }) {
  const noAcorde = new Set(notas)
  const totalBrancas = BRANCAS.length * oitavas

  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="relative h-28 min-w-[22rem] select-none rounded-xl border border-app-line bg-app-surface p-1"
        role="img"
        aria-label={`Teclado com as notas ${notas.map((n) => keyName(n)).join(', ')}`}
      >
        {Array.from({ length: totalBrancas }, (_, i) => {
          const altura = BRANCAS[i % BRANCAS.length]
          const pertence = noAcorde.has(altura)
          const ehTonica = i === 0
          return (
            <span
              key={`b${i}`}
              className={[
                'absolute bottom-1 flex items-end justify-center rounded-b-md border border-app-line pb-1 font-mono text-[9px] font-bold',
                pertence
                  ? ehTonica
                    ? 'bg-brand-600 text-white'
                    : 'bg-brand-400 text-app-ink'
                  : 'bg-app-surface text-app-ink-4',
              ].join(' ')}
              style={{
                left: `calc(${(i / totalBrancas) * 100}% + 0.25rem)`,
                width: `calc(${100 / totalBrancas}% - 0.5rem)`,
                height: 'calc(100% - 0.5rem)',
              }}
            >
              {/* Só a primeira oitava é rotulada, para não repetir oito vezes. */}
              {i < BRANCAS.length ? keyName(altura) : ''}
            </span>
          )
        })}

        {PRETAS.map(([indiceBranca, altura]) =>
          Array.from({ length: oitavas }, (_, oitava) => {
            const posicao = indiceBranca + oitava * BRANCAS.length
            // A última preta de cada oitava cai sobre a fronteira seguinte.
            if (posicao >= totalBrancas - 1) return null
            const pertence = noAcorde.has(altura)
            return (
              <span
                key={`p${altura}-${oitava}`}
                className={[
                  'absolute top-1 h-3/5 rounded-b-md border border-app-line',
                  pertence ? 'bg-brand-700' : 'bg-app-ink',
                ].join(' ')}
                style={{
                  left: `calc(${((posicao + 1) / totalBrancas) * 100}% - 0.5rem)`,
                  width: '1rem',
                }}
              />
            )
          }),
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Braço do violão
// ─────────────────────────────────────────────────────────────────────────

/** Afidação padrão: 6 cordas, da quinta à primeira. */
const CORDAS: Array<{ nome: string; altura: number }> = [
  { nome: 'E', altura: 4 },
  { nome: 'A', altura: 9 },
  { nome: 'D', altura: 2 },
  { nome: 'G', altura: 7 },
  { nome: 'B', altura: 11 },
  { nome: 'e', altura: 4 },
]

const CASAS = 12

/**
 * Mapa do braço: todas as notas, da 1ª à 12ª casa.
 * Serve para achar a nota sem precisar dizer "terceira casa da quinta
 * corda", que ninguém lembra na hora do ensaio.
 */
export function ColunaDeTrastes({ notas }: { notas: number[] }) {
  const noAcorde = new Set(notas)
  // Índice de cada altura na lista: o 0 é a tônica e recebe destaque maior.
  const ordem = new Map<number, number>()
  notas.forEach((altura, i) => {
    if (!ordem.has(altura)) ordem.set(altura, i)
  })

  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[20rem]">
        <div className="mb-1 flex gap-0.5 pl-6">
          {Array.from({ length: CASAS }, (_, i) => (
            <span
              key={i}
              className={[
                'flex-1 text-center font-mono text-[9px] font-bold',
                i === 0 ? 'text-brand-600' : 'text-app-ink-4',
              ].join(' ')}
            >
              {i + 1}
            </span>
          ))}
        </div>

        {CORDAS.map((corda) => (
          <div key={corda.nome} className="mb-0.5 flex items-center gap-0.5">
            <span className="w-5 shrink-0 text-right font-mono text-[9px] font-bold text-app-ink-4">
              {corda.nome}
            </span>
            <div className="flex flex-1 gap-0.5">
              {Array.from({ length: CASAS }, (_, casa) => {
                const altura = ((corda.altura + casa) % 12 + 12) % 12
                const pertence = noAcorde.has(altura)
                const ehTonica = ordem.get(altura) === 0
                return (
                  <span
                    key={casa}
                    className={[
                      'flex h-6 flex-1 items-center justify-center rounded font-mono text-[9px] font-bold',
                      pertence
                        ? ehTonica
                          ? 'bg-brand-600 text-white'
                          : 'bg-brand-400 text-app-ink'
                        : 'bg-app-raised text-app-ink-4',
                    ].join(' ')}
                    title={`${corda.nome} na casa ${casa + 1} = ${keyName(altura)}`}
                  >
                    {pertence ? keyName(altura) : ''}
                  </span>
                )
              })}
            </div>
          </div>
        ))}

        <p className="mt-2 text-xs text-app-ink-3">
          Afinação padrão E A D G B e. A tônica sai com o fundo mais escuro.
        </p>
      </div>
    </div>
  )
}
