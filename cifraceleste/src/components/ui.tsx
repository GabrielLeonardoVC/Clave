/**
 * ui — peças de interface compartilhadas: folha inferior, diálogo, aviso.
 *
 * Todas acessíveis por teclado e fecham com Escape, porque quem usa o app
 * durante uma missa está com o celular na mão eFewso tem um polegar.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────
//  Aviso rápido (toast)
// ─────────────────────────────────────────────────────────────────────────

type TipoAviso = 'ok' | 'erro' | 'info'

interface Aviso {
  id: number
  texto: string
  tipo: TipoAviso
}

interface ContextoAviso {
  avisar: (texto: string, tipo?: TipoAviso) => void
}

const CtxAviso = createContext<ContextoAviso>({ avisar: () => undefined })

export const useAviso = (): ContextoAviso => useContext(CtxAviso)

export function ProvedorAviso({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const proximoId = useRef(1)

  const avisar = useCallback((texto: string, tipo: TipoAviso = 'info') => {
    const id = proximoId.current++
    setAvisos((atuais) => [...atuais, { id, texto, tipo }])
    setTimeout(() => {
      setAvisos((atuais) => atuais.filter((a) => a.id !== id))
    }, tipo === 'erro' ? 5200 : 3000)
  }, [])

  const remover = useCallback((id: number) => {
    setAvisos((atuais) => atuais.filter((a) => a.id !== id))
  }, [])

  return (
    <CtxAviso.Provider value={{ avisar }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4"
            role="status"
            aria-live="polite"
          >
            {/*
              Aviso animado por CSS.

              Com animação de biblioteca o aviso ficava preso em `opacity: 0`
              e o usuário nunca via a confirmação de que a música foi salva.
              É o aviso que dá a sensação de que a tela respondeu, então ele
              tem de aparecer sempre — a animação é enfeite, não o essencial.
            */}
            {avisos.map((a) => (
              <div
                key={a.id}
                onClick={() => remover(a.id)}
                className={[
                  'aviso-entra pointer-events-auto flex max-w-md cursor-pointer items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-sheet',
                  a.tipo === 'erro'
                    ? 'bg-danger-500 text-white'
                    : a.tipo === 'ok'
                        ? 'bg-app-ink text-app-bg'
                        : 'bg-app-surface text-app-ink border border-app-line',
                  ].join(' ')}
              >
                {a.texto}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </CtxAviso.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Folha inferior (bottom sheet)
// ─────────────────────────────────────────────────────────────────────────

interface FolhaProps {
  aberta: boolean
  aoFechar: () => void
  titulo?: string
  subtitulo?: string
  /** A folha ocupa quase toda a largura, em vez de metade. */
  larga?: boolean
  children: ReactNode
  rodape?: ReactNode
}

export function Folha({ aberta, aoFechar, titulo, subtitulo, larga, children, rodape }: FolhaProps) {
  const idPainel = useId()
  const refPainel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberta) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        aoFechar()
      }
    }
    document.addEventListener('keydown', aoTeclar)
    // Impede o fundo de rolar enquanto a folha está aberta.
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflowAnterior
    }
  }, [aberta, aoFechar])

  // Prende o foco dentro da folha enquanto ela estiver aberta.
  useEffect(() => {
    if (!aberta || !refPainel.current) return
    const anterior = document.activeElement as HTMLElement | null
    const alvo = refPainel.current.querySelector<HTMLElement>(
      'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
    )
    alvo?.focus()
    return () => anterior?.focus?.()
  }, [aberta])

  if (typeof document === 'undefined') return null

  // A folha entra por CSS e sai na hora.
  //
  // O mesmo motivo do resto do aplicativo: a animação de biblioteca depende do
  // ciclo de medição do navegador, e se ela não rodar o painel fica preso no
  // estado inicial. Aqui isso significaria um painel com `opacity: 0`
  // ocupando a tela e impossível de ler. A entrada continua suave; a saída é
  // imediata, que é o que se espera de um toque em "fechar".
  return createPortal(
    aberta ? (
      <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
        <div
          className="fundo-entra absolute inset-0 bg-black/55 backdrop-blur-sm"
          onClick={aoFechar}
        />
        <div
          ref={refPainel}
          id={idPainel}
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          className={[
            'folha-entra relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-app-bg shadow-sheet',
            'sm:max-h-[88dvh] sm:rounded-3xl',
            larga ? 'sm:max-w-3xl' : 'sm:max-w-lg',
          ].join(' ')}
        >
          <div className="flex justify-center pt-2.5 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-app-line" />
          </div>

          {(titulo || subtitulo) && (
            <div className="flex items-start gap-3 border-b border-app-line px-5 py-3.5">
              <div className="min-w-0 flex-1">
                {titulo && <h2 className="truncate text-lg font-bold text-app-ink">{titulo}</h2>}
                {subtitulo && <p className="truncate text-sm text-app-ink-3">{subtitulo}</p>}
              </div>
              <button
                type="button"
                onClick={aoFechar}
                aria-label="Fechar"
                className="-mr-1.5 -mt-0.5 rounded-lg p-1.5 text-app-ink-3 transition-colors hover:bg-app-raised hover:text-app-ink"
              >
                <X size={20} />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

          {rodape && (
            <div className="flex gap-2 border-t border-app-line px-5 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-3.5">
              {rodape}
            </div>
          )}
        </div>
      </div>
    ) : null,
    document.body,
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Diálogo de confirmação
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
//  Diálogo de confirmação
// ─────────────────────────────────────────────────────────────────────────

interface Confirmacao {
  titulo: string
  mensagem: string
  rotuloOk: string
  perigoso: boolean
  resolver: (v: boolean) => void
}

interface ContextoConfirmacao {
  confirmar: (opcoes: { titulo: string; mensagem: string; rotuloOk?: string; perigoso?: boolean }) => Promise<boolean>
}

const CtxConfirmacao = createContext<ContextoConfirmacao>({
  confirmar: async () => false,
})

export const useConfirmacao = (): ContextoConfirmacao => useContext(CtxConfirmacao)

export function ProvedorConfirmacao({ children }: { children: ReactNode }) {
  const [atual, setAtual] = useState<Confirmacao | null>(null)

  const confirmar = useCallback<ContextoConfirmacao['confirmar']>(
    ({ titulo, mensagem, rotuloOk = 'Confirmar', perigoso = false }) =>
      new Promise<boolean>((resolve) => {
        setAtual({ titulo, mensagem, rotuloOk, perigoso, resolver: resolve })
      }),
    [],
  )

  const responder = (valor: boolean) => {
    atual?.resolver(valor)
    setAtual(null)
  }

  return (
    <CtxConfirmacao.Provider value={{ confirmar }}>
      {children}
      <Folha
        aberta={atual !== null}
        aoFechar={() => responder(false)}
        titulo={atual?.titulo}
        rodape={
          <>
            <button type="button" className="btn-outline flex-1" onClick={() => responder(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className={atual?.perigoso ? 'btn-danger flex-1' : 'btn-primary flex-1'}
              onClick={() => responder(true)}
            >
              {atual?.rotuloOk}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-app-ink-2">{atual?.mensagem}</p>
      </Folha>
    </CtxConfirmacao.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Estado vazio
// ─────────────────────────────────────────────────────────────────────────

export function EstadoVazio({
  icone,
  titulo,
  mensagem,
  acao,
}: {
  icone: ReactNode
  titulo: string
  mensagem: string
  acao?: { rotulo: string; aoClicar: () => void }
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-app-raised text-app-ink-3">
        {icone}
      </div>
      <h3 className="text-base font-bold text-app-ink">{titulo}</h3>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-app-ink-3">{mensagem}</p>
      {acao && (
        <button type="button" className="btn-primary mt-5" onClick={acao.aoClicar}>
          {acao.rotulo}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Interruptor
// ─────────────────────────────────────────────────────────────────────────

export function Interruptor({
  ligado,
  aoMudar,
  rotulo,
}: {
  ligado: boolean
  aoMudar: (v: boolean) => void
  rotulo: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={() => aoMudar(!ligado)}
      className={[
        'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
        ligado ? 'bg-brand-500' : 'bg-app-line-strong',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200',
          ligado ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
        style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
    </button>
  )
}

/** Linha com título, descrição e interruptor. */
export function LinhaInterruptor({
  titulo,
  descricao,
  ligado,
  aoMudar,
}: {
  titulo: string
  descricao?: string
  ligado: boolean
  aoMudar: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-4 border-t border-app-line py-3.5 first:border-t-0">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-app-ink">{titulo}</span>
        {descricao && <span className="mt-0.5 block text-xs text-app-ink-3">{descricao}</span>}
      </span>
      <Interruptor ligado={ligado} aoMudar={aoMudar} rotulo={titulo} />
    </label>
  )
}
