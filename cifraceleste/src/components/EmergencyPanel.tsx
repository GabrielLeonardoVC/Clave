/**
 * EmergencyPanel — o botão flutuante e o que ele abre.
 *
 * Existe para o momento em que o músico está em cima do palco, com a Banda
 * esperando, e precisa de três coisas: achar a música, calcular o tom
 * rapidamente, ou colar uma cifra que veio de outro lugar. Uma única tela,
 * três abas, sem sair do que está fazendo.
 *
 * Fica acima de tudo em todas as telas, inclusive do modo Estúdio.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Calculator, Plus, Search, Siren, X } from 'lucide-react'

import { search, normalizeText } from '@/lib/searchLogic'
import { transposeCifra, keyOptions, describeKey } from '@/lib/music/chordTransposer'
import { detectKey } from '@/lib/music/keyDetection'
import { parseCifra } from '@/lib/music/smartParser'
import { transposeChordSymbol } from '@/lib/music/chordTransposer'
import { chordNotes, parseChord } from '@/lib/music/chords'
import { mod12, pcFromName } from '@/lib/music/notes'
import { tocarAcorde, tocarNotaSolta, destravarAudio } from '@/lib/audio'
import { criarCifra, seletorCifras, useStore } from '@/lib/store'
import { abrirEmergencia, fecharEmergencia, useEmergenciaAberta } from '@/lib/emergencia'
import { useDebounce } from '@/lib/useDebounce'
import { useAviso } from './ui'

type Aba = 'busca' | 'tom' | 'cifra'

export function EmergencyPanel({ aoAbrirCifra }: { aoAbrirCifra: (id: string) => void }) {
  // O estado de abertura vive fora do componente para que atalhos de outras
  // telas possam abrir o painel sem precisar conhecer a instância.
  const aberto = useEmergenciaAberta()
  const [aba, setAba] = useState<Aba>('busca')

  // Portal para a raiz do documento. Sem ele, o `z-index` do painel ficaria
  // preso dentro do contexto de empilhamento criado pela animação de troca de
  // tela, e o painel passaria por baixo da barra de navegação.
  const sobreposicao = (conteudo: ReactNode) =>
    typeof document === 'undefined' ? conteudo : createPortal(conteudo, document.body)

  return sobreposicao(
    <>
      {/* ── Botão flutuante ── */}
      {/*
        Aparece e some sem `AnimatePresence`.

        Duas razões, e as duas já custaram tempo aqui:

        1. O componente é renderizado por portal para o `body`, e a
           reconciliação do React acompanha a árvore do portal, não a da
           posição original. Com o `AnimatePresence` fora do portal, a saída
           nunca acontecia e o painel ficava no DOM depois de fechado.
        2. A animação de biblioteca depende do ciclo de medição do
           navegador. Se ela não rodar, o elemento fica em `opacity: 0`
           para sempre — um botão invisível que ocupa a tela.

        A animação de entrada, essa sim, é CSS e não tem nenhum dos dois
        problemas. A de saída não é necessária: o painel é fechado por um
        toque, e sumir na hora é o que se espera.
      */}
      {!aberto && (
        <button
          type="button"
          onClick={() => abrirEmergencia('fab')}
          aria-label="Abrir ferramentas de emergência"
          title="Emergência: buscar, calcular tom, colar cifra"
          className="fab-emergencia fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-danger-500 text-white shadow-[0_10px_30px_-6px_rgb(224_58_42/0.6)] active:scale-90 sm:bottom-6"
        >
          <Siren size={24} />
        </button>
      )}

      {/* ── Painel ── */}
      {aberto && (
        <div
          className="tela-entra fixed inset-0 z-[85] flex flex-col bg-app-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Ferramentas de emergência"
        >
            <header className="flex shrink-0 items-center gap-2 border-b border-app-line px-4 py-3">
              <Siren size={20} className="shrink-0 text-danger-500" />
              <h2 className="flex-1 text-lg font-bold text-app-ink">Emergência</h2>
              <button
                type="button"
                onClick={() => fecharEmergencia()}
                className="btn-icon"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </header>

            <div className="shrink-0 px-4 pt-3">
              <div className="tabs" role="tablist" aria-label="Ações rápidas">
                <button type="button" role="tab" aria-selected={aba === 'busca'} onClick={() => setAba('busca')} className="flex-1">
                  <Search size={15} /> Buscar
                </button>
                <button type="button" role="tab" aria-selected={aba === 'tom'} onClick={() => setAba('tom')} className="flex-1">
                  <Calculator size={15} /> Calcular tom
                </button>
                <button type="button" role="tab" aria-selected={aba === 'cifra'} onClick={() => setAba('cifra')} className="flex-1">
                  <Plus size={15} /> Colar cifra
                </button>
              </div>
            </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {aba === 'busca' && <AbaBusca aoAbrirCifra={aoAbrirCifra} />}
            {aba === 'tom' && <AbaTom aoAbrirCifra={aoAbrirCifra} />}
            {aba === 'cifra' && <AbaColarCifra aoAbrirCifra={aoAbrirCifra} />}
          </div>
        </div>
      )}
    </>,
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  1. Busca rápida
// ─────────────────────────────────────────────────────────────────────────

function AbaBusca({ aoAbrirCifra }: { aoAbrirCifra: (id: string) => void }) {
  const cifras = useStore(seletorCifras)
  const [termo, setTermo] = useState('')
  const atrasado = useDebounce(termo, 130)
  const caixaBusca = useRef<HTMLInputElement>(null)

  useEffect(() => {
    caixaBusca.current?.focus()
  }, [])

  const resultados = useMemo(
    () => (atrasado.trim() ? search(cifras, atrasado, { limit: 40 }) : []),
    [cifras, atrasado],
  )

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={caixaBusca}
        className="input text-lg"
        placeholder="Buscar música..."
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Buscar música"
      />

      {termo.trim() === '' ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">Tons mais comuns</p>
          <div className="grid grid-cols-6 gap-1.5">
            {keyOptions('major').map((k) => (
              <button
                key={k.pc}
                type="button"
                onClick={() => setTermo(k.name)}
                className="rounded-xl border border-app-line py-2.5 text-sm font-bold text-app-ink transition-colors hover:border-brand-500 hover:text-brand-600"
              >
                {k.name}
              </button>
            ))}
          </div>
        </div>
      ) : resultados.length === 0 ? (
        <p className="py-8 text-center text-sm text-app-ink-3">Nada encontrado para "{termo}".</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {resultados.map(({ item }) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => aoAbrirCifra(item.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-app-line bg-app-surface px-3.5 py-3 text-left transition-colors hover:border-brand-500"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-app-ink">{item.titulo}</p>
                  {item.artista && <p className="truncate text-xs text-app-ink-3">{item.artista}</p>}
                </div>
                {item.tom && (
                  <span className="shrink-0 rounded-lg bg-brand-500 px-2 py-1 text-xs font-extrabold text-white">
                    {item.tom}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  2. Calculadora de tom
// ─────────────────────────────────────────────────────────────────────────

function AbaTom({ aoAbrirCifra }: { aoAbrirCifra: (id: string) => void }) {
  const { avisar } = useAviso()
  const [original, setOriginal] = useState('')
  const [semitons, setSemitons] = useState(0)

  const partes = useMemo(() => parseCifra(original), [original])
  const tomOriginal = useMemo(() => detectKey(partes), [partes])
  const resultado = useMemo(
    () => (original.trim() ? transposeCifra(original, semitons) : null),
    [original, semitons],
  )
  const tomFinal = useMemo(() => (resultado ? detectKey(parseCifra(resultado.text)) : null), [resultado])

  const acordes = useMemo(() => {
    const vistos = new Set<string>()
    for (const l of partes.lines) {
      for (const c of l.chords) {
        if (c.role === 'root') vistos.add(c.chord.raw)
      }
    }
    return [...vistos]
  }, [partes])

  /** Toca o acorde já no tom de destino, que é o que o músico quer conferir. */
  const tocarTransformado = (simbolo: string) => {
    destravarAudio()
    const destino = transposeChordSymbol(simbolo, semitons)
    const acorde = parseChord(destino)
    if (!acorde) return
    tocarAcorde(chordNotes(acorde), { oitava: 3, duracao: 1.3, volume: 0.2 })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="emerg-tom-entrada">
          Nota ou acorde (ex.: C, F#m7b5, Bb/D)
        </label>
        <input
          id="emerg-tom-entrada"
          className="input text-lg"
          value={original}
          onChange={(e) => {
            setOriginal(e.target.value)
            setSemitons(0)
          }}
          placeholder="C"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>

      {original.trim() !== '' && (
        <>
          <button
            type="button"
            onClick={() => {
              destravarAudio()
              const p = pcFromName(original.trim().slice(0, 2)) ?? parseChord(original.trim())?.rootPc
              if (p !== null && p !== undefined) tocarNotaSolta(p, { oitava: 4, duracao: 1.6 })
            }}
            className="btn-outline w-full"
          >
            Ouvir a nota
          </button>

          <div className="surface p-4">
            <p className="mb-3 text-center text-4xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">
              {tomOriginal.source === 'vazio' ? '—' : describeKey(tomOriginal)}
            </p>
            <p className="mb-4 text-center text-xs text-app-ink-3">
              {tomOriginal.source === 'declarado'
                ? 'tom declarado na cifra'
                : `detectado com ${Math.round(tomOriginal.confidence * 100)}% de confiança`}
            </p>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSemitons((s) => s - 1)} className="btn-outline h-11 w-11 shrink-0 rounded-xl p-0 text-lg" aria-label="Meio tom abaixo">
                −½
              </button>
              <div className="flex-1 text-center">
                <span className="text-sm font-bold text-app-ink">
                  {semitons === 0 ? 'original' : `${semitons > 0 ? '+' : ''}${semitons}`}
                </span>
                {tomFinal && semitons !== 0 && (
                  <span className="ml-2 text-sm font-extrabold text-brand-600">{tomFinal.name}</span>
                )}
              </div>
              <button type="button" onClick={() => setSemitons((s) => s + 1)} className="btn-outline h-11 w-11 shrink-0 rounded-xl p-0 text-lg" aria-label="Meio tom acima">
                +½
              </button>
            </div>
          </div>

          {acordes.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">
                Toque no tom novo
              </p>
              <div className="flex flex-wrap gap-2">
                {acordes.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => tocarTransformado(a)}
                    className="rounded-xl border border-app-line bg-app-surface px-3.5 py-2.5 font-mono text-sm font-bold text-app-ink transition-colors hover:border-brand-500 hover:text-brand-600"
                  >
                    {transposeChordSymbol(a, semitons)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {resultado && resultado.text !== original && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const nova = criarCifra({
                    titulo: tomFinal?.name ? `Cifra em ${tomFinal.name}` : 'Cifra transposta',
                    tom: tomFinal?.name ?? '',
                    cifra: resultado.text,
                    tags: ['transposição'],
                  })
                  avisar('Salva no repertório.', 'ok')
                  aoAbrirCifra(nova.id)
                }}
                className="btn-primary flex-1"
              >
                Salvar no repertório
              </button>
            </div>
          )}
        </>
      )}

      {original.trim() === '' && (
        <div>
          <p className="mb-2 text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">Ou escolha um tom</p>
          <div className="grid grid-cols-6 gap-1.5">
            {keyOptions('major').map((k) => (
              <button
                key={k.pc}
                type="button"
                onClick={() => {
                  setOriginal(k.name)
                  setSemitons(0)
                }}
                className="rounded-xl border border-app-line py-2.5 text-sm font-bold text-app-ink transition-colors hover:border-brand-500 hover:text-brand-600"
              >
                {k.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  3. Colar e transpor uma cifra de fora
// ─────────────────────────────────────────────────────────────────────────

function AbaColarCifra({ aoAbrirCifra }: { aoAbrirCifra: (id: string) => void }) {
  const { avisar } = useAviso()
  const [texto, setTexto] = useState('')
  const [semitons, setSemitons] = useState(0)
  const [titulo, setTitulo] = useState('')

  const resultado = useMemo(() => (texto.trim() ? transposeCifra(texto, semitons) : null), [texto, semitons])
  const tom = useMemo(() => (resultado ? detectKey(parseCifra(resultado.text)) : null), [resultado])

  // Quantos acordes a cifra colada tem. A contagem vem do texto original, e
  // não do resultado, porque a transposição não cria nem remove acordes.
  const totalAcordes = useMemo(
    () => parseCifra(texto).hits.filter((h) => h.role === 'root').length,
    [texto],
  )

  const semAcento = normalizeText(texto).length > 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="emerg-colar">
          Cole aqui a cifra
        </label>
        <textarea
          id="emerg-colar"
          className="input min-h-52 font-mono text-[13px] leading-relaxed"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setSemitons(0)
          }}
          placeholder={'[C]\nO Senhor é o meu pastor\nC        G\nNada me faltará'}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      {semAcento && resultado && (
        <>
          <div className="surface p-4">
            <p className="text-center text-3xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">
              {tom?.source === 'vazio' ? 'sem tom' : describeKey(tom!)}
            </p>
            <p className="mt-1 text-center text-xs text-app-ink-3">
              {/* Quantos acordes a cifra tem, e não quantos mudaram: no tom
                  original o número de mudanças é zero, e "0 acordes" faz
                  parecer que não foi reconhecido nada. */}
              {totalAcordes} {totalAcordes === 1 ? 'acorde' : 'acordes'} na cifra
              {semitons !== 0 && `, ${resultado.changed} ajustados`}
            </p>

            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={() => setSemitons((s) => s - 1)} className="btn-outline h-11 w-11 shrink-0 rounded-xl p-0 text-lg" aria-label="Meio tom abaixo">
                −½
              </button>
              <div className="flex-1 text-center text-sm font-bold text-app-ink">
                {semitons === 0 ? 'tom original' : `${semitons > 0 ? '+' : ''}${semitons} meios tons`}
              </div>
              <button type="button" onClick={() => setSemitons((s) => s + 1)} className="btn-outline h-11 w-11 shrink-0 rounded-xl p-0 text-lg" aria-label="Meio tom acima">
                +½
              </button>
            </div>

            <div className="mt-3 grid grid-cols-6 gap-1">
              {keyOptions('major').map((k) => (
                <button
                  key={k.pc}
                  type="button"
                  onClick={() => {
                    const atual = detectKey(parseCifra(texto))
                    if (atual.source === 'vazio') return
                    const bruto = mod12(k.pc - atual.pc)
                    setSemitons(bruto > 6 ? bruto - 12 : bruto)
                  }}
                  className="rounded-lg py-1.5 text-xs font-bold text-app-ink-2 transition-colors hover:bg-brand-500 hover:text-white"
                >
                  {k.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">Resultado</p>
            <pre className="cifra-grid surface max-h-64 overflow-auto p-3.5 text-app-ink-2">{resultado.text}</pre>
          </div>

          <input
            className="input"
            placeholder="Título (opcional)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />

          <button
            type="button"
            onClick={() => {
              if (!resultado) return
              const nova = criarCifra({
                titulo: titulo.trim() || `Cifra em ${tom?.name ?? 'tom desconhecido'}`,
                tom: tom?.name ?? '',
                cifra: resultado.text,
                tags: ['emergência'],
              })
              avisar('Salva no repertório.', 'ok')
              setTexto('')
              setTitulo('')
              setSemitons(0)
              aoAbrirCifra(nova.id)
            }}
            className="btn-primary w-full"
          >
            Salvar no repertório
          </button>
        </>
      )}

      {semAcento && !resultado?.changed && semitons === 0 && (
        <p className="text-sm text-app-ink-3">
          Nenhum acorde reconhecido ainda. Confira se o texto tem os acordes em linhas próprias ou antes das palavras.
        </p>
      )}
    </div>
  )
}
