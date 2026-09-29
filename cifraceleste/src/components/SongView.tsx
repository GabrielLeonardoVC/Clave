/**
 * SongView — a tela da cifra.
 *
 * Junta o que o músico precisa na hora do ensaio, sem nada sobrando:
 *
 *   · a cifra com os acordes alinhados em fonte monoespaçada
 *   · tom e transposição: meio tom para cima, meio tom para baixo, ou tom exato
 *   · cada acorde é clicável e toca o som
 *   · modo Estúdio: só a cifra e o essencial — sem menu, sem rodapé, sem nada
 *   · rolagem automática com velocidade ajustável
 *   · metrônomo e gravação de referência
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronDown as ChevronDownIcon, Headphones, Mic, Minimize2, Pause, Play, Volume2 } from 'lucide-react'

import { parseCifra, type CifraLine } from '@/lib/music/smartParser'
import { parseChord, chordNotes, chordAt } from '@/lib/music/chords'
import { transposeCifra, transposeCifraPorGrau, describeKey, keyOptions, semitonesBetween } from '@/lib/music/chordTransposer'
import { detectKey, type Mode } from '@/lib/music/keyDetection'
import { keyName, mod12 } from '@/lib/music/notes'
import { tocarAcorde, destravarAudio } from '@/lib/audio'
import { Gravador } from '@/lib/recorder'
import type { Cifra as ModeloCifra } from '@/lib/store'
import { Folha, useAviso } from './ui'
import { PainelGravacao } from './AudioTools'

interface SongViewProps {
  cifra: ModeloCifra
  aoFechar: () => void
  aoSalvar: (dados: { tom: string; cifra: string; audioId: string | null }) => void
}

export function SongView({ cifra, aoFechar, aoSalvar }: SongViewProps) {
  const { avisar } = useAviso()

  const [semitons, setSemitons] = useState(0)
  const [tom, setTom] = useState(cifra.tom)
  /**
   * Tônica escolhida no seletor, quando houve escolha.
   *
   * Guardar só o número de semitons perde informação: o motor usa a armadura
   * do tom de destino para decidir entre `Bb` e `A#`. Sem este valor, pedir F
   * à mão acabaria escrevendo `A#`, que é errado para quem toca em F.
   */
  const [tomDestino, setTomDestino] = useState<number | null>(null)
  const [tomDestinoModo, setTomDestinoModo] = useState<Mode>('major')
  const [estudio, setEstudio] = useState(false)
  const [autoScroll, setAutoScroll] = useState(0)
  const [rolando, setRolando] = useState(false)
  const [somAoClicar, setSomAoClicar] = useState(true)
  const [painelAudio, setPainelAudio] = useState(false)
  const [seletorAberto, setSeletorAberto] = useState(false)
  const [audioId, setAudioId] = useState<string | null>(cifra.audioId)

  const caixaRef = useRef<HTMLDivElement>(null)
  const ultimoInstante = useRef(0)
  const temporizadorScroll = useRef<number | null>(null)
  const gravadorRef = useRef<Gravador | null>(null)

  // ── Transposição ────────────────────────────────────────────────────────
  // Com tom de destino escolhido, o motor reatribui os graus: é o que leva
  // uma música de Dó maior para Lá menor sem errar o acorde. Sem escolha,
  // vale o deslocamento fixo de semitons, que é o que os botões de meio tom
  // esperam.
  const resultado = useMemo(
    () =>
      tomDestino === null
        ? transposeCifra(cifra.cifra, semitons)
        : transposeCifraPorGrau(cifra.cifra, tomDestino, tomDestinoModo),
    [cifra.cifra, semitons, tomDestino, tomDestinoModo],
  )
  const partes = useMemo(() => parseCifra(resultado.text), [resultado.text])
  const tonica = useMemo(() => detectKey(parseCifra(resultado.text)), [resultado.text])

  const ajustarMeioTom = useCallback((delta: number) => {
    setSemitons((s) => Math.max(-12, Math.min(12, s + delta)))
    // O destino passa a ser indefinido: subir e descer meio tom decide a
    // grafia pelo sentido do movimento, e não mais pela armadura de um tom fixo.
    setTomDestino(null)
  }, [])

  /** Troca para um tom exato, reatribuindo os graus da escala. */
  const aplicarTom = useCallback(
    (novoTomPc: number, modo: Mode) => {
      const atual = detectKey(parseCifra(cifra.cifra))
      if (atual.source === 'vazio') {
        avisar('Esta cifra ainda não tem acordes reconhecidos.', 'erro')
        setSeletorAberto(false)
        return
      }

      // O rótulo de deslocamento acompanha o menor movimento até o destino, para
      // o número mostrado ao lado dos botões de meio tom fazer sentido.
      setSemitons(semitonesBetween(atual.pc, modo === 'minor' ? mod12(novoTomPc + 9) : novoTomPc))
      setTomDestino(novoTomPc)
      setTomDestinoModo(modo)
      setTom(keyName(novoTomPc) + (modo === 'minor' ? 'm' : ''))
      setSeletorAberto(false)
    },
    [cifra.cifra, avisar],
  )

  /** Volta ao tom original, esquecendo qualquer tom fixo escolhido. */
  const voltarAoOriginal = useCallback(() => {
    setSemitons(0)
    setTomDestino(null)
    setTom(cifra.tom)
  }, [cifra.tom])

  // ── Tocar ───────────────────────────────────────────────────────────────
  const tocar = useCallback(
    (simbolo: string) => {
      if (!somAoClicar) return
      destravarAudio()
      const acorde = parseChord(simbolo)
      if (!acorde) return
      const alturas = chordNotes(acorde)
      // O grave entra uma oitava abaixo: sem ele o acorde "flutua" e o
      // jogador não reconhece qual é na hora.
      const comBase = acorde.bass ? [...alturas, acorde.bass.pc + 12] : alturas
      tocarAcorde(comBase, { oitava: 3, duracao: 1.4, volume: 0.2 })
    },
    [somAoClicar],
  )

  // ── Rolagem automática ──────────────────────────────────────────────────
  const pararScroll = useCallback(() => {
    if (temporizadorScroll.current !== null) {
      clearInterval(temporizadorScroll.current)
      temporizadorScroll.current = null
    }
    setRolando(false)
  }, [])

  const iniciarScroll = useCallback(
    (velocidade: number) => {
      pararScroll()
      if (velocidade <= 0) {
        setAutoScroll(0)
        return
      }
      setAutoScroll(velocidade)
      ultimoInstante.current = performance.now()
      setRolando(true)
      temporizadorScroll.current = window.setInterval(() => {
        const caixa = caixaRef.current
        if (!caixa) return
        const agora = performance.now()
        const dt = (agora - ultimoInstante.current) / 1000
        ultimoInstante.current = agora
        const maximo = caixa.scrollHeight - caixa.clientHeight
        if (maximo <= 0 || caixa.scrollTop >= maximo - 1) {
          pararScroll()
          setAutoScroll(0)
          return
        }
        caixa.scrollTop += velocidade * dt
      }, 50)
    },
    [pararScroll],
  )

  useEffect(() => pararScroll, [pararScroll])
  useEffect(() => {
    if (!estudio) {
      pararScroll()
      setAutoScroll(0)
    }
  }, [estudio, pararScroll])

  useEffect(() => {
    return () => {
      gravadorRef.current?.cancelar()
    }
  }, [])

  // ── Atalhos ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        ajustarMeioTom(1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        ajustarMeioTom(-1)
      }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [ajustarMeioTom])

  const rotuloDeslocamento =
    semitons === 0
      ? 'tom original'
      : `${semitons > 0 ? '+' : ''}${semitons} ${Math.abs(semitons) === 1 ? 'meio tom' : 'meios tons'}`

  const tamanhoCifra = cifra.fonteCifra ?? 14

  // ── Sobreposição no topo de tudo ────────────────────────────────────────
  //
  // A tela precisa sair do fluxo da página. Não basta um `z-index` alto: a
  // animação de troca de tela aplica `transform` no contentor, e isso cria um
  // contexto de empilhamento que prende o `z-index` da cifra dentro dele. O
  // resultado é a barra de navegação e o botão de emergência continuarem por
  // cima da tela, clicáveis, por mais que o número seja grande.
  //
  // O portal resolve na raiz: o elemento passa a compete direto com a
  // navegação, e o modo Estúdio realmente fica sozinho na tela.
  const sobreposicao = (conteudo: ReactNode) =>
    typeof document === 'undefined' ? conteudo : createPortal(conteudo, document.body)

  // ═══════════════════════════════════════════════════════════════════════
  //  Modo Estúdio
  // ═══════════════════════════════════════════════════════════════════════
  if (estudio) {
    return sobreposicao(
      <div
        className="fixed inset-0 z-[80] flex flex-col bg-app-bg"
        role="dialog"
        aria-modal="true"
        aria-label={`${cifra.titulo} — modo estúdio`}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-app-line px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-app-ink">{cifra.titulo}</h1>
            <p className="truncate text-[11px] text-app-ink-3">
              {rotuloDeslocamento} · {describeKey(tonica)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEstudio(false)}
            className="btn-icon"
            aria-label="Sair do modo estúdio"
            title="Sair do modo estúdio"
          >
            <Minimize2 size={18} />
          </button>
        </header>

        <div
          ref={caixaRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5"
          style={{ fontSize: `${tamanhoCifra}px` }}
        >
          <GradeCifra linhas={partes.lines} aoTocar={tocar} />
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-app-line px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => ajustarMeioTom(-1)} className="btn-outline px-2.5 py-1.5" aria-label="Meio tom abaixo">
              −½
            </button>
            <button type="button" onClick={() => ajustarMeioTom(1)} className="btn-outline px-2.5 py-1.5" aria-label="Meio tom acima">
              +½
            </button>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            {rolando ? (
              <button type="button" onClick={pararScroll} className="btn-primary flex-1 py-1.5">
                <Pause size={14} /> Parar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => iniciarScroll(autoScroll > 0 ? autoScroll : 24)}
                className="btn-outline flex-1 py-1.5"
              >
                <Play size={14} /> Rolar
              </button>
            )}
            <select
              value={autoScroll}
              onChange={(e) => iniciarScroll(Number(e.target.value))}
              className="input w-[5.5rem] shrink-0 py-1.5 text-sm"
              aria-label="Velocidade da rolagem"
            >
              <option value={16}>Devagar</option>
              <option value={24}>Normal</option>
              <option value={40}>Rápido</option>
            </select>
          </div>
        </footer>
      </div>,
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Tela normal
  // ═══════════════════════════════════════════════════════════════════════
  return sobreposicao(
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-app-bg"
      role="dialog"
      aria-modal="true"
      aria-label={cifra.titulo}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-app-line px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-app-ink">{cifra.titulo}</h1>
          <p className="truncate text-xs text-app-ink-3">
            {cifra.artista ? `${cifra.artista} · ` : ''}
            {describeKey(tonica)}
          </p>
        </div>
        <button type="button" onClick={() => setEstudio(true)} className="btn-outline btn-sm" title="Modo estúdio, sem distrações">
          <Headphones size={15} /> Estúdio
        </button>
        <button type="button" onClick={aoFechar} className="btn-icon" aria-label="Fechar">
          <ChevronDownIcon size={20} />
        </button>
      </header>

      {/* ── Transposição ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-app-line px-3 py-2.5">
        <button type="button" onClick={() => ajustarMeioTom(-1)} className="btn-outline px-3 py-2" aria-label="Baixar meio tom" title="Meio tom abaixo (setas do teclado também)">
          −½
        </button>

        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setSeletorAberto((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-app-line bg-app-surface px-2 py-2 transition-colors hover:border-app-line-strong"
            aria-expanded={seletorAberto}
            aria-label="Escolher tom"
          >
            <span className="truncate text-sm font-bold text-app-ink">{tom || 'Escolher tom'}</span>
            <ChevronDown size={15} className="shrink-0 text-app-ink-3" />
          </button>

          {seletorAberto && <SeletorDeTom aoEscolher={aplicarTom} aoFechar={() => setSeletorAberto(false)} />}
        </div>

        <button type="button" onClick={() => ajustarMeioTom(1)} className="btn-outline px-3 py-2" aria-label="Subir meio tom" title="Meio tom acima (setas do teclado também)">
          +½
        </button>
      </div>

      {semitons !== 0 && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-app-line bg-brand-50 px-3 py-1.5 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">
          <span className="truncate">
            {rotuloDeslocamento} · {resultado.changed} {resultado.changed === 1 ? 'acorde' : 'acordes'}
          </span>
          <button type="button" onClick={voltarAoOriginal} className="shrink-0 font-semibold underline underline-offset-2">
            Voltar ao original
          </button>
        </div>
      )}

      {/* ── Cifra ── */}
      <div
        ref={caixaRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5"
        style={{ fontSize: `${tamanhoCifra}px` }}
      >
        {cifra.cifra.trim() === '' ? (
          <p className="font-sans text-sm text-app-ink-3">Esta música ainda não tem cifra. Edite-a no repertório.</p>
        ) : (
          <GradeCifra linhas={partes.lines} aoTocar={tocar} />
        )}
      </div>

      {/* ── Rodapé ── */}
      <footer className="flex shrink-0 items-center gap-2 border-t border-app-line px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setSomAoClicar((v) => !v)}
          className={somAoClicar ? 'btn-primary px-3 py-2' : 'btn-outline px-3 py-2'}
          aria-pressed={somAoClicar}
          title={somAoClicar ? 'Toque ao clicar: ligado' : 'Toque ao clicar: desligado'}
          aria-label="Ligar ou desligar o toque ao clicar"
        >
          <Volume2 size={16} />
        </button>

        <button type="button" onClick={() => setPainelAudio(true)} className="btn-outline px-3 py-2" title="Metrônomo e gravação" aria-label="Áudio e metrônomo">
          <Mic size={16} />
        </button>

        <button
          type="button"
          onClick={() => aoSalvar({ tom, cifra: resultado.text, audioId })}
          className="btn-success flex-1 py-2"
        >
          Salvar neste tom
        </button>
      </footer>

      <Folha aberta={painelAudio} aoFechar={() => setPainelAudio(false)} titulo="Áudio" subtitulo={cifra.titulo}>
        <PainelGravacao
          audioId={audioId}
          aoObterGravador={(g) => {
            gravadorRef.current = g
          }}
          aoSalvar={(id) => {
            setAudioId(id)
            avisar('Referência salva nesta música.', 'ok')
          }}
        />
      </Folha>
    </div>,
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Seletor de tom
// ─────────────────────────────────────────────────────────────────────────

function SeletorDeTom({
  aoEscolher,
  aoFechar,
}: {
  aoEscolher: (pc: number, modo: 'major' | 'minor') => void
  aoFechar: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={aoFechar} />
      <div
        className="absolute inset-x-0 top-full z-20 mt-1.5 rounded-2xl border border-app-line bg-app-surface p-2 shadow-lift"
        role="listbox"
        aria-label="Escolher tom"
      >
        <p className="px-1.5 pt-1 pb-1.5 text-[10px] font-extrabold tracking-widest text-app-ink-3 uppercase">
          Maiores
        </p>
        <div className="grid grid-cols-6 gap-1">
          {keyOptions('major').map((k) => (
            <button
              key={k.pc}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => aoEscolher(k.pc, 'major')}
              className="rounded-lg py-2 text-sm font-bold text-app-ink transition-colors hover:bg-brand-500 hover:text-white"
            >
              {k.name}
            </button>
          ))}
        </div>
        <div className="my-1.5 h-px bg-app-line" />
        <p className="px-1.5 pb-1.5 text-[10px] font-extrabold tracking-widest text-app-ink-3 uppercase">
          Menores
        </p>
        <div className="grid grid-cols-6 gap-1">
          {keyOptions('minor').map((k) => (
            <button
              key={k.pc}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => aoEscolher(k.pc, 'minor')}
              className="rounded-lg py-2 text-sm font-bold text-app-ink-2 transition-colors hover:bg-brand-500 hover:text-white"
            >
              {k.name}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Grade da cifra
// ─────────────────────────────────────────────────────────────────────────

/**
 * A grade monoespaçada.
 *
 * Linha de cifrinha e linha de letra saem com fonte de largura fixa e
 * `white-space: pre`. Como as duas têm o mesmo número de colunas, o acorde cai
 * exatamente sobre a sílaba que ele toca — sem medir nada no navegador, que é
 * o que quebra quando a fonte carrega depois do primeiro desenho.
 */
function GradeCifra({ linhas, aoTocar }: { linhas: CifraLine[]; aoTocar: (s: string) => void }) {
  return (
    <div className="cifra-grid">
      {linhas.map((linha) => {
        if (linha.kind === 'blank') return <div key={linha.index} className="h-3" />

        if (linha.kind === 'section') {
          return (
            <div
              key={linha.index}
              className="mt-4 mb-1.5 font-sans text-[11px] font-extrabold tracking-widest text-brand-600 uppercase dark:text-brand-400"
            >
              {linha.label}
            </div>
          )
        }

        if (linha.kind === 'inline' && linha.chordRow !== null && linha.lyricRow !== null) {
          return (
            <div key={linha.index} className="mb-1.5">
              <LinhaGrade texto={linha.chordRow} aoTocar={aoTocar} />
              <LinhaGrade texto={linha.lyricRow} aoTocar={aoTocar} letra />
            </div>
          )
        }

        return (
          <div key={linha.index} className="mb-1.5">
            <LinhaGrade texto={linha.raw} aoTocar={aoTocar} />
          </div>
        )
      })}
    </div>
  )
}

function LinhaGrade({
  texto,
  aoTocar,
  letra = false,
}: {
  texto: string
  aoTocar: (s: string) => void
  letra?: boolean
}) {
  const segmentos = useMemo(() => segmentar(texto), [texto])

  return (
    <div className="whitespace-pre leading-[1.45]">
      {segmentos.map((p, i) =>
        p.tipo === 'acorde' ? (
          <button
            key={i}
            type="button"
            onClick={() => aoTocar(p.texto)}
            title={`Tocar ${p.texto}`}
            aria-label={`Tocar acorde ${p.texto}`}
            className="-mx-0.5 rounded px-0.5 font-bold text-brand-600 transition-colors hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-500/20"
          >
            {p.texto}
          </button>
        ) : (
          <span key={i} className={letra ? 'text-app-ink' : 'text-app-ink-3'}>
            {p.texto}
          </span>
        ),
      )}
    </div>
  )
}

type Segmento = { tipo: 'acorde' | 'texto'; texto: string }

/**
 * Divide a linha em texto e símbolos de acorde, nas posições exatas.
 *
 * Reaproveita o mesmo leitor do motor de teoria, então o que a tela mostra é
 * exatamente o que a transposição vai trocar. Uma coluna de diferença aqui
 * significaria o acorde sobre a sílaba errada.
 */
function segmentar(texto: string): Segmento[] {
  const saida: Segmento[] = []
  let i = 0
  let inicioTexto = 0

  while (i < texto.length) {
    // Um acorde só começa no início da linha ou depois de espaço/colchete.
    const podeComecar = i === 0 || /[\s(\[]/.test(texto[i - 1])
    const achado = podeComecar ? chordAt(texto, i) : null

    if (achado) {
      if (i > inicioTexto) saida.push({ tipo: 'texto', texto: texto.slice(inicioTexto, i) })
      saida.push({ tipo: 'acorde', texto: achado.chord.raw })
      i = achado.end
      inicioTexto = i
    } else {
      i++
    }
  }

  if (inicioTexto < texto.length) saida.push({ tipo: 'texto', texto: texto.slice(inicioTexto) })
  return saida
}
