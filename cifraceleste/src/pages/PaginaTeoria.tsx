/**
 * PaginaTeoria — acordes, escalas e o círculo das quintas.
 *
 * Tudo que responde à pergunta feita no ensaio: "qual é a forma desse acorde
 * no violão?", "quais notas tem?", "qual a relativa da menor?".
 */

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Volume2 } from 'lucide-react'

import { QUALITIES, chordNotes, parseChord } from '@/lib/music/chords'
import { keyName, keyPrefersFlats, TWELVE_KEYS, mod12 } from '@/lib/music/notes'
import { scaleNotes, SCALES } from '@/lib/music/scales'
import { chordNotesInScale, scaleChords } from '@/lib/music/scales'
import { tocarAcorde, tocarNotaSolta } from '@/lib/audio'
import { NotaEmTeclado, ColunaDeTrastes } from '@/components/TeoriaViews'
import { useAviso } from '@/components/ui'

type Aba = 'acordes' | 'escala' | 'circulo'

const CATEGORIAS_QUALIDADE: Array<{ nome: string; ids: string[] }> = [
  { nome: 'Tríades', ids: ['maj', 'min', 'dim', 'aug', '5'] },
  { nome: 'Sétimas', ids: ['7', 'maj7', 'min7', 'minMaj7', 'min7b5', 'dim7', 'aug7'] },
  { nome: 'Extended', ids: ['9', 'maj9', 'min9', '11', 'min11', '13', 'maj13', 'add9', 'sus2', 'sus4', '7sus4', '6', 'min6', '69'] },
]

export function PaginaTeoria() {
  const [aba, setAba] = useState<Aba>('acordes')
  const [tônica, setTônica] = useState(0)

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 -mx-4 mb-4 bg-app-bg/85 px-4 pt-4 pb-3 backdrop-blur-md">
        <h1 className="text-2xl font-extrabold tracking-tight text-app-ink">Teoria</h1>
        <p className="text-sm text-app-ink-3">O que você precisa na hora do ensaio</p>

        <div className="mt-3 flex gap-1.5" role="tablist" aria-label="Seções da teoria">
          {(
            [
              ['acordes', 'Acordes'],
              ['escala', 'Escalas'],
              ['circulo', 'Círculo'],
            ] as Array<[Aba, string]>
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={aba === id}
              onClick={() => setAba(id)}
              className="chip flex-1 justify-center"
              data-active={aba === id}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </header>

      {aba === 'acordes' && <PainelAcordes tônica={tônica} aoTrocar={setTônica} />}
      {aba === 'escala' && <PainelEscala tônica={tônica} aoTrocar={setTônica} />}
      {aba === 'circulo' && <PainelCirculo tônica={tônica} aoTrocar={setTônica} />}
    </div>
  )
}

function SeletorTonica({
  tônica,
  aoTrocar,
}: {
  tônica: number
  aoTrocar: (pc: number) => void
}) {
  return (
    <div className="mb-4 grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Tônica">
      {TWELVE_KEYS.map((k) => (
        <button
          key={k.pc}
          type="button"
          role="radio"
          aria-checked={tônica === k.pc}
          onClick={() => aoTrocar(k.pc)}
          className={[
            'rounded-xl border py-2.5 text-sm font-bold transition-colors',
            tônica === k.pc
              ? 'border-transparent bg-brand-500 text-white'
              : 'border-app-line text-app-ink-2 hover:border-brand-500',
          ].join(' ')}
        >
          {k.major}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Acordes
// ─────────────────────────────────────────────────────────────────────────

function PainelAcordes({ tônica, aoTrocar }: { tônica: number; aoTrocar: (pc: number) => void }) {
  const [qualidade, setQualidade] = useState('maj')
  const { avisar } = useAviso()

  const nome = keyName(tônica)
  const simbolo = `${nome}${QUALITIES.find((q) => q.id === qualidade)?.aliases[0] ?? ''}`
  const acorde = useMemo(() => parseChord(simbolo), [simbolo])
  const alturas = acorde ? chordNotes(acorde) : []

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="label">Tônica</span>
        <SeletorTonica tônica={tônica} aoTrocar={aoTrocar} />
      </div>

      <div className="flex flex-col gap-3">
        {CATEGORIAS_QUALIDADE.map((cat) => (
          <div key={cat.nome}>
            <span className="label">{cat.nome}</span>
            <div className="flex flex-wrap gap-1.5">
              {cat.ids.map((id) => {
                const q = QUALITIES.find((x) => x.id === id)
                if (!q) return null
                return (
                  <button
                    key={id}
                    type="button"
                    className="chip"
                    data-active={qualidade === id}
                    onClick={() => setQualidade(id)}
                  >
                    {q.aliases[0] || 'maior'}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {acorde && (
        <motion.div
          key={simbolo}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="surface p-5 text-center"
        >
          <button
            type="button"
            onClick={() => {
              if (alturas.length === 0) {
                avisar('Não consegui montar este acorde.', 'erro')
                return
              }
              tocarAcorde(alturas, { oitava: 3, duracao: 1.5, volume: 0.22 })
            }}
            className="w-full"
            aria-label={`Tocar o acorde ${simbolo}`}
          >
            <span className="block text-4xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">
              {simbolo}
            </span>
            <span className="mt-1 flex items-center justify-center gap-1.5 text-xs text-app-ink-3">
              <Volume2 size={13} /> toque para ouvir
            </span>
          </button>

          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {alturas.map((pc, i) => (
              <button
                key={pc}
                type="button"
                onClick={() => tocarNotaSolta(pc, { oitava: 4, duracao: 0.9 })}
                className={[
                  'rounded-lg px-2.5 py-1.5 font-mono text-sm font-bold transition-colors',
                  i === 0
                    ? 'bg-brand-500 text-white'
                    : 'bg-app-raised text-app-ink-2 hover:bg-app-line',
                ].join(' ')}
                aria-label={`Tocar ${keyName(pc)}`}
              >
                {keyName(pc)}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Escalas
// ─────────────────────────────────────────────────────────────────────────

function PainelEscala({ tônica, aoTrocar }: { tônica: number; aoTrocar: (pc: number) => void }) {
  const [escala, setEscala] = useState('major')
  const [selecionada, setSelecionada] = useState<number | null>(null)

  const prefer = keyPrefersFlats(tônica) ? 'flat' : 'sharp'
  const notas = useMemo(() => scaleNotes(tônica, escala), [tônica, escala, prefer])
  const acordes = useMemo(() => scaleChords(tônica, escala), [tônica, escala, prefer])
  const nomeEscala = SCALES[escala]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="label">Tônica</span>
        <SeletorTonica tônica={tônica} aoTrocar={aoTrocar} />
      </div>

      <div>
        <span className="label">Escala e modo</span>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(SCALES).map(([id, s]) => (
            <button key={id} type="button" className="chip" data-active={escala === id} onClick={() => setEscala(id)}>
              {s.nomeCurto}
            </button>
          ))}
        </div>
      </div>

      <div className="surface p-4 text-center">
        <p className="text-2xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">
          {keyName(tônica)} {nomeEscala?.nomeCurto}
        </p>
        <p className="mt-0.5 text-xs text-app-ink-3">{nomeEscala?.nome}</p>

        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {notas.map((pc, i) => (
            <button
              key={`${pc}-${i}`}
              type="button"
              onClick={() => {
                setSelecionada(i)
                tocarNotaSolta(pc, { oitava: 4, duracao: 0.9 })
              }}
              className={[
                'rounded-lg px-2.5 py-1.5 font-mono text-sm font-bold transition-colors',
                i === 0
                  ? 'bg-brand-500 text-white'
                  : selecionada === i
                    ? 'bg-brand-300 text-app-ink'
                    : 'bg-app-raised text-app-ink-2 hover:bg-app-line',
              ].join(' ')}
              aria-label={`Tocar ${keyName(pc)}`}
            >
              {keyName(pc)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Acordes de cada grau</span>
        <ul className="grid grid-cols-4 gap-1.5">
          {acordes.map((c) => (
            <li key={`${c.pc}-${c.qualidade}`}>
              <button
                type="button"
                onClick={() => tocarAcorde(chordNotesInScale(c.pc, c.qualidade), { oitava: 3, duracao: 1.3, volume: 0.2 })}
                className="surface w-full px-1 py-2.5 text-center transition-colors hover:border-brand-500"
              >
                <span className="block font-mono text-sm font-extrabold text-app-ink">{c.nome}</span>
                <span className="block text-[10px] font-bold text-app-ink-3">{c.grau}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <span className="label">No teclado</span>
        <NotaEmTeclado notas={notas} />
      </div>

      <div>
        <span className="label">No braço do violão</span>
        <ColunaDeTrastes notas={notas} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Círculo das quintas
// ─────────────────────────────────────────────────────────────────────────

function PainelCirculo({ tônica, aoTrocar }: { tônica: number; aoTrocar: (pc: number) => void }) {
  const relativa = mod12(tônica + 9)
  const ordem = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]

  return (
    <div className="flex flex-col gap-4">
      <div className="surface p-4">
        <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-72" role="img" aria-label="Círculo das quintas">
          <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" className="text-app-line" strokeWidth="1" />
          {ordem.map((pc, i) => {
            const ang = (i / 12) * Math.PI * 2 - Math.PI / 2
            const x = 100 + Math.cos(ang) * 92
            const y = 100 + Math.sin(ang) * 92
            const ehMaior = pc === tônica
            const ehMenor = pc === relativa
            return (
              <g key={pc}>
                <circle
                  cx={x}
                  cy={y}
                  r="15"
                  className={ehMaior ? 'fill-brand-500' : ehMenor ? 'fill-moss-500' : 'fill-app-raised'}
                  stroke="currentColor"
                  strokeOpacity="0.15"
                />
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  className={ehMaior ? 'fill-white' : ehMenor ? 'fill-white' : 'fill-app-ink-2'}
                  style={{ fontSize: '12px', fontWeight: 700 }}
                >
                  {keyName(pc)}
                </text>
                {/* Setas de quinta, formando a estrela. */}
                {i % 2 === 0 && (
                  <circle
                    cx={x}
                    cy={y}
                    r="15"
                    className="cursor-pointer fill-transparent"
                    onClick={() => aoTrocar(pc)}
                  >
                    <title>{`Ir para ${keyName(pc)}`}</title>
                  </circle>
                )}
              </g>
            )
          })}
        </svg>
        <p className="mt-2 text-center text-xs text-app-ink-3">
          Toque no contorno de um acorde para trocar a tônica.
        </p>
      </div>

      <div className="surface grid grid-cols-2 gap-3 p-4 text-center">
        <div>
          <p className="text-2xl font-extrabold text-brand-600 dark:text-brand-400">{keyName(tônica)}</p>
          <p className="text-xs text-app-ink-3">maior</p>
        </div>
        <div>
          <p className="text-2xl font-extrabold text-moss-500">{keyName(relativa)}m</p>
          <p className="text-xs text-app-ink-3">menor relativa</p>
        </div>
      </div>

      <div className="surface p-4">
        <span className="label">Escala maior de {keyName(tônica)}</span>
        <p className="font-mono text-sm text-app-ink-2">
          {scaleNotes(tônica, 'major')
            .map((pc) => keyName(pc))
            .join('  ')}
        </p>
      </div>

      <div className="surface p-4">
        <span className="label">Acordes de {keyName(relativa)}m</span>
        <div className="flex flex-wrap gap-1.5">
          {scaleChords(relativa, 'minor').map((c) => (
            <button
              key={c.nome}
              type="button"
              onClick={() => tocarAcorde(chordNotesInScale(c.pc, c.qualidade), { oitava: 3, duracao: 1.3, volume: 0.2 })}
              className="rounded-lg bg-app-raised px-2.5 py-1.5 font-mono text-sm font-bold text-app-ink-2 transition-colors hover:bg-brand-500 hover:text-white"
            >
              {c.nome}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
