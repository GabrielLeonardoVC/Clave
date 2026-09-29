/**
 * AudioTools — metrônomo e gravação de referência.
 *
 * Duas ferramentas que respondem à mesma pergunta: "qual é o tom e a
 * velocidade dessa música?". O metrônomo responde com pulsos, o gravador
 * responde com a voz de quem canta.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Pause, Play, Square, Trash2, Volume2 } from 'lucide-react'

import {
  alternarMetronomo,
  definirMetronomo,
  estadoMetronomo,
  pararMetronomo,
  reiniciarTap,
  tapTempo,
  type EstadoMetro,
} from '@/lib/audio'
import { Gravador, apagarGravacao, duracaoFormatada, urlDaGravacao } from '@/lib/recorder'
import { useAviso } from './ui'

const COMPASSOS = [
  { v: 2, n: '2/4' },
  { v: 3, n: '3/4' },
  { v: 4, n: '4/4' },
  { v: 6, n: '6/8' },
  { v: 7, n: '7/8' },
  { v: 9, n: '9/8' },
  { v: 12, n: '12/8' },
]

const SONS: Array<{ v: EstadoMetro['som']; n: string }> = [
  { v: 'click', n: 'Clique' },
  { v: 'madeira', n: 'Madeira' },
  { v: 'sino', n: 'Sino' },
  { v: 'digital', n: 'Digital' },
]

/** Cópia do estado do metrônomo, para o React reagir às mudanças. */
function useMetronomo(): EstadoMetro {
  const [estado, setEstado] = useState<EstadoMetro>(() => ({ ...estadoMetronomo() }))

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      const atual = estadoMetronomo()
      setEstado((anterior) =>
        anterior.tocando === atual.tocando &&
        anterior.bpm === atual.bpm &&
        anterior.compasso === atual.compasso &&
        anterior.passo === atual.passo
          ? anterior
          : { ...atual },
      )
    }, 60)
    return () => clearInterval(intervalo)
  }, [])

  return estado
}

// ─────────────────────────────────────────────────────────────────────────
//  Metrônomo
// ─────────────────────────────────────────────────────────────────────────

export function PainelMetronomo({ bpmInicial }: { bpmInicial?: number | null }) {
  const { avisar } = useAviso()
  const estado = useMetronomo()

  useEffect(() => {
    if (bpmInicial) definirMetronomo({ bpm: bpmInicial })
  }, [bpmInicial])

  // O metrônomo não pode ficar soando depois que a tela fecha.
  useEffect(() => {
    return () => {
      pararMetronomo()
      reiniciarTap()
    }
  }, [])

  const passos = estado.compasso * estado.subdivisao

  return (
    <div className="flex flex-col gap-4">
      <div className="surface flex items-center gap-4 p-4">
        {/* Colunas do compasso, com a primeira destacada. */}
        <div className="flex shrink-0 gap-1.5" aria-hidden="true">
          {Array.from({ length: Math.min(passos, 16) }, (_, i) => {
            const ativo = estado.tocando && i === estado.passo % Math.min(passos, 16)
            const primeiro = i % estado.compasso === 0
            return (
              <span
                key={i}
                className={[
                  'block h-3 w-3 rounded-full transition-all duration-100',
                  ativo
                    ? primeiro
                      ? 'scale-125 bg-brand-500'
                      : 'scale-110 bg-brand-400'
                    : primeiro
                      ? 'bg-app-line-strong'
                      : 'bg-app-line',
                ].join(' ')}
              />
            )
          })}
        </div>

        <div className="min-w-0 flex-1 text-center">
          <div className="text-3xl leading-none font-extrabold tracking-tight text-app-ink tabular-nums">
            {estado.bpm}
          </div>
          <div className="text-[11px] font-bold text-app-ink-3">
            {estado.compasso}/{estado.subdivisao === 2 ? '8' : '4'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => alternarMetronomo()}
          className={estado.tocando ? 'btn-danger h-12 w-12 shrink-0 rounded-full p-0' : 'btn-primary h-12 w-12 shrink-0 rounded-full p-0'}
          aria-label={estado.tocando ? 'Parar metrônomo' : 'Tocar metrônomo'}
        >
          {estado.tocando ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>
      </div>

      {/* Ajuste fino e tap tempo */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => definirMetronomo({ bpm: Math.max(20, estado.bpm - 1) })}
          className="btn-outline h-11 w-11 shrink-0 rounded-xl p-0 text-lg"
          aria-label="Baixar 1 BPM"
        >
          −
        </button>
        <input
          type="range"
          min={20}
          max={320}
          value={estado.bpm}
          onChange={(e) => definirMetronomo({ bpm: Number(e.target.value) })}
          className="h-1.5 flex-1 accent-[rgb(var(--c-primary))]"
          aria-label="Andamento em batidas por minuto"
        />
        <button
          type="button"
          onClick={() => definirMetronomo({ bpm: Math.min(320, estado.bpm + 1) })}
          className="btn-outline h-11 w-11 shrink-0 rounded-xl p-0 text-lg"
          aria-label="Subir 1 BPM"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            const b = tapTempo()
            if (b) avisar(`${b} BPM`, 'ok')
            else avisar('Toque mais algumas vezes no ritmo.', 'info')
          }}
          className="btn-outline h-11 shrink-0 rounded-xl px-3 text-xs font-extrabold"
          title="Toque no ritmo da música"
        >
          TAP
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="metro-compasso">
            Compasso
          </label>
          <select
            id="metro-compasso"
            className="input"
            value={estado.compasso}
            onChange={(e) => definirMetronomo({ compasso: Number(e.target.value) })}
          >
            {COMPASSOS.map((c) => (
              <option key={c.v} value={c.v}>
                {c.n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="metro-som">
            Som
          </label>
          <select
            id="metro-som"
            className="input"
            value={estado.som}
            onChange={(e) => definirMetronomo({ som: e.target.value as EstadoMetro['som'] })}
          >
            {SONS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-3">
        <Volume2 size={17} className="shrink-0 text-app-ink-3" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={estado.volume}
          onChange={(e) => definirMetronomo({ volume: Number(e.target.value) })}
          className="h-1.5 flex-1 accent-[rgb(var(--c-primary))]"
          aria-label="Volume do metrônomo"
        />
      </label>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Gravação de referência
// ─────────────────────────────────────────────────────────────────────────

interface PainelGravacaoProps {
  audioId: string | null
  aoSalvar: (id: string) => void
  aoObterGravador?: (g: Gravador) => void
}

export function PainelGravacao({ audioId, aoSalvar, aoObterGravador }: PainelGravacaoProps) {
  const { avisar } = useAviso()
  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [nivel, setNivel] = useState(0)
  const [url, setUrl] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const gravadorRef = useRef<Gravador | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const relogioRef = useRef<number | null>(null)

  // Carrega a gravação existente para reprodução.
  useEffect(() => {
    let cancelado = false
    if (!audioId) {
      setUrl(null)
      return
    }
    void urlDaGravacao(audioId).then((u) => {
      if (!cancelado) setUrl(u)
    })
    return () => {
      cancelado = true
    }
  }, [audioId])

  // Libera a URL do objeto quando ela troca, para não vazar memória.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  useEffect(() => {
    return () => {
      if (relogioRef.current !== null) clearInterval(relogioRef.current)
      gravadorRef.current?.cancelar()
    }
  }, [])

  const pararRelogio = useCallback(() => {
    if (relogioRef.current !== null) {
      clearInterval(relogioRef.current)
      relogioRef.current = null
    }
  }, [])

  const iniciar = useCallback(async () => {
    const g = new Gravador()
    aoObterGravador?.(g)

    const ok = await g.iniciar({ aoMedir: setNivel, maximoSegundos: 300 })
    if (!ok) {
      setErro(g.erro ?? 'Não foi possível gravar.')
      setGravando(false)
      return
    }

    setErro(null)
    setGravando(true)
    gravadorRef.current = g
    pararRelogio()
    relogioRef.current = window.setInterval(() => setSegundos(g.segundos()), 200)
  }, [aoObterGravador, pararRelogio])

  const parar = useCallback(async () => {
    pararRelogio()
    const g = gravadorRef.current
    if (!g) return
    const id = await g.parar()
    setGravando(false)
    setNivel(0)
    setSegundos(0)

    if (id) {
      aoSalvar(id)
      const nova = await urlDaGravacao(id)
      setUrl((atual) => {
        if (atual) URL.revokeObjectURL(atual)
        return nova
      })
    } else {
      avisar('Nada foi gravado.', 'erro')
    }
  }, [aoSalvar, avisar, pararRelogio])

  const cancelar = useCallback(() => {
    pararRelogio()
    gravadorRef.current?.cancelar()
    setGravando(false)
    setNivel(0)
    setSegundos(0)
  }, [pararRelogio])

  const remover = useCallback(async () => {
    if (url) URL.revokeObjectURL(url)
    setUrl(null)
    if (audioId) {
      try {
        await apagarGravacao(audioId)
      } catch {
        // Já não estar mais lá também é um resultado aceitável aqui.
      }
    }
    aoSalvar('')
    avisar('Gravação removida.', 'ok')
  }, [audioId, url, aoSalvar, avisar])

  const suporta = typeof MediaRecorder !== 'undefined' && typeof navigator !== 'undefined'

  return (
    <div className="flex flex-col gap-4">
      {!suporta && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-app-ink-2">
          Este navegador não grava áudio. No celular o Chrome e o Safari gravam normalmente.
        </p>
      )}

      {erro && (
        <p className="rounded-xl border border-danger-500/30 bg-danger-500/10 p-3 text-sm text-danger-500">
          {erro}
        </p>
      )}

      {/* Medidor e controles */}
      <div className="surface flex items-center gap-4 p-4">
        <div className="flex h-12 flex-1 items-center gap-0.5 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => {
            const posicao = i / 28
            const aceso = posicao < nivel
            return (
              <span
                key={i}
                className={[
                  'h-full flex-1 rounded-sm transition-colors duration-75',
                  aceso ? (posicao > 0.88 ? 'bg-danger-500' : 'bg-brand-500') : 'bg-app-line',
                ].join(' ')}
              />
            )
          })}
        </div>

        {gravando ? (
          <button type="button" onClick={() => void parar()} className="btn-danger h-12 w-12 shrink-0 rounded-full p-0" aria-label="Parar gravação">
            <Square size={18} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void iniciar()}
            disabled={!suporta}
            className="btn-primary h-12 w-12 shrink-0 rounded-full p-0"
            aria-label="Gravar referência"
            title="Grave cantando o início da música"
          >
            <Mic size={20} />
          </button>
        )}
      </div>

      {gravando && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-danger-500 tabular-nums">{duracaoFormatada(segundos)}</span>
          <button type="button" onClick={cancelar} className="btn-ghost btn-sm">
            Descartar
          </button>
        </div>
      )}

      {!gravando && !url && (
        <p className="text-sm leading-relaxed text-app-ink-3">
          Grave uns trinta segundos cantando o início. Serve para lembrar o tom e a frase na hora do ensaio,
          sem depender de lembrar a melodia.
        </p>
      )}

      {url && (
        <div className="flex items-center gap-3">
          <audio ref={audioRef} src={url} controls className="h-10 flex-1" />
          <button type="button" onClick={() => void remover()} className="btn-ghost shrink-0 p-2" aria-label="Apagar gravação" title="Apagar gravação">
            <Trash2 size={18} className="text-danger-500" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  AudioTools — as duas ferramentas juntas
// ─────────────────────────────────────────────────────────────────────────

/**
 * Metrônomo e gravação lado a lado.
 *
 * É o módulo que aparece dentro do painel de emergência e no modo estúdio:
 * quem está sem tempo precisa das duas coisas no mesmo lugar.
 */
export function AudioTools({
  audioId = null,
  aoSalvarAudio,
  aoObterGravador,
  bpmInicial = null,
  compacta = false,
}: {
  audioId?: string | null
  aoSalvarAudio?: (id: string) => void
  aoObterGravador?: (g: Gravador) => void
  bpmInicial?: number | null
  compacta?: boolean
}) {
  const { avisar } = useAviso()
  const [aba, setAba] = useState<'metronomo' | 'voz'>(compacta ? 'metronomo' : 'metronomo')

  return (
    <div className="flex flex-col gap-4">
      <div className="tabs" role="tablist" aria-label="Ferramentas de áudio">
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'metronomo'}
          onClick={() => setAba('metronomo')}
          className="flex-1"
        >
          Metrônomo
        </button>
        <button type="button" role="tab" aria-selected={aba === 'voz'} onClick={() => setAba('voz')} className="flex-1">
          Minha voz
        </button>
      </div>

      {aba === 'metronomo' ? (
        <PainelMetronomo bpmInicial={bpmInicial} />
      ) : (
        <PainelGravacao
          audioId={audioId}
          aoObterGravador={aoObterGravador}
          aoSalvar={(id) => {
            aoSalvarAudio?.(id)
            avisar('Referência salva.', 'ok')
          }}
        />
      )}
    </div>
  )
}

export default AudioTools
