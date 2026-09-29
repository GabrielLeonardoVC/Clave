/**
 * NotificationScheduler — lembrete com hora exata.
 *
 * O pedido é "me avise às 18:30", não "daqui a duas horas". Então o controle
 * é um seletor de horas e minutos, e o cálculo parte da data e hora do evento.
 *
 * O seletor é de rolagem e não um <input type="time"> nativo: o controle do
 * sistema varia muito entre Android, iOS e Windows, e em alguns ele abre um
 * diálogo que sai da tela. Aqui a interface é a mesma em qualquer aparelho.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, BellOff, Check } from 'lucide-react'

import { avisosPendentes, testarAviso } from '@/lib/notify'
import { paraData, type Evento, type Lembrete } from '@/lib/store'
import { seletorEventos, useStore } from '@/lib/store'

const HORAS = Array.from({ length: 24 }, (_, i) => i)
const MINUTOS = Array.from({ length: 60 }, (_, i) => i)

/** Opções prontas, para quem não quer mexer na rolagem. */
const PRESETS: Array<{ rotulo: string; h: number; m: number }> = [
  { rotulo: 'Na hora', h: 0, m: 0 },
  { rotulo: '15 min', h: 0, m: 15 },
  { rotulo: '30 min', h: 0, m: 30 },
  { rotulo: '1 hora', h: 1, m: 0 },
  { rotulo: '2 horas', h: 2, m: 0 },
  { rotulo: 'Dia anterior', h: 24, m: 0 },
]

export function NotificationScheduler({
  evento,
  aoMudar,
}: {
  evento: Evento
  aoMudar: (lembrete: Lembrete | null) => void
}) {
  const notificacoesAtivas = useStore(
    useMemo(() => (e: { ajustes: { notificacoes: boolean } }) => e.ajustes.notificacoes, []),
  )

  const atual = evento.lembrete ?? { ativo: false, horas: 2, minutos: 0 }
  const [horas, setHoras] = useState(atual.horas)
  const [minutos, setMinutos] = useState(atual.minutos)

  // Sincroniza quando o evento muda de fora (abrir outro no mesmo painel).
  useEffect(() => {
    const l = evento.lembrete
    if (l) {
      setHoras(l.horas)
      setMinutos(l.minutos)
    }
  }, [evento.id, evento.lembrete])

  const atraso = useMemo(() => {
    const quando = paraData(evento.data, evento.hora)
    if (!quando) return 0
    const alvo = quando.getTime() - (horas * 60 + minutos) * 60000
    return alvo - Date.now()
  }, [evento.data, evento.hora, horas, minutos])

  const quandoDispara = useMemo(() => {
    const base = paraData(evento.data, evento.hora)
    if (!base) return ''
    const alvo = new Date(base.getTime() - (horas * 60 + minutos) * 60000)
    const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
    return `${dias[alvo.getDay()]}, ${String(alvo.getDate()).padStart(2, '0')}/${String(
      alvo.getMonth() + 1,
    ).padStart(2, '0')} às ${String(alvo.getHours()).padStart(2, '0')}:${String(alvo.getMinutes()).padStart(2, '0')}`
  }, [evento.data, evento.hora, horas, minutos])

  const descricao = useMemo(() => {
    if (atraso < 0) return 'Esse horário já passou'
    if (atraso < 3600_000) return `daqui a ${Math.max(1, Math.round(atraso / 60000))} minutos`
    if (atraso < 86_400_000) return `daqui a ${Math.round(atraso / 3600_000)} horas`
    return `daqui a ${Math.round(atraso / 86_400_000)} dias`
  }, [atraso])

  const ativar = (v: boolean) => {
    if (v) {
      aoMudar({ ativo: true, horas, minutos })
    } else {
      aoMudar(null)
    }
  }

  return (
    <div className="surface flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => ativar(!atual.ativo)}
          className={atual.ativo ? 'btn-primary flex-1 justify-start' : 'btn-outline flex-1 justify-start'}
          aria-pressed={atual.ativo}
        >
          {atual.ativo ? <Bell size={17} /> : <BellOff size={17} />}
          {atual.ativo ? 'Lembrete ativado' : 'Sem lembrete'}
        </button>
        {atual.ativo && (
          <button
            type="button"
            onClick={() => void testarAviso()}
            className="btn-outline shrink-0 px-3"
            title="Enviar um aviso de teste"
            aria-label="Testar notificação"
          >
            Testar
          </button>
        )}
      </div>

      {atual.ativo && (
        <>
          {/* ── Presets ── */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const escolhido = p.h === horas && p.m === minutos
              return (
                <button
                  key={p.rotulo}
                  type="button"
                  onClick={() => {
                    setHoras(p.h)
                    setMinutos(p.m)
                    aoMudar({ ativo: true, horas: p.h, minutos: p.m })
                  }}
                  className={escolhido ? 'chip' : 'chip'}
                  data-active={escolhido}
                >
                  {p.rotulo}
                </button>
              )
            })}
          </div>

          {/* ── Horas e minutos ── */}
          <div className="flex items-stretch gap-2">
            <RolagemNumerica
              valores={HORAS}
              valor={horas}
              aoMudar={(v) => {
                setHoras(v)
                aoMudar({ ativo: true, horas: v, minutos })
              }}
              formatar={(v) => String(v).padStart(2, '0')}
              rotulo="Horas de antecedência"
              sufixo="h"
            />
            <div className="flex items-center text-2xl font-extrabold text-app-ink-3">:</div>
            <RolagemNumerica
              valores={MINUTOS}
              valor={minutos}
              aoMudar={(v) => {
                setMinutos(v)
                aoMudar({ ativo: true, horas, minutos: v })
              }}
              formatar={(v) => String(v).padStart(2, '0')}
              rotulo="Minutos de antecedência"
              sufixo="min"
            />
          </div>

          <div className="rounded-xl bg-app-raised px-3.5 py-2.5">
            <p className="text-sm font-bold text-app-ink">{quandoDispara}</p>
            <p className="mt-0.5 text-xs text-app-ink-3">{descricao}</p>
          </div>

          {!notificacoesAtivas && (
            <p className="text-xs leading-relaxed text-app-ink-3">
              Ative as notificações em Ajustes para o aviso aparecer mesmo com o app fechado.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Rolagem numérica
// ─────────────────────────────────────────────────────────────────────────

/**
 * Seletor de número por rolagem.
 *
 * Uma lista com a opção visível centralizada e encaixe ao rolar. Tocar num
 * item também seleciona, para quem prefere não rolar. Teclado: setas e
 * página inicial/fim.
 */
function RolagemNumerica({
  valores,
  valor,
  aoMudar,
  formatar,
  rotulo,
  sufixo,
}: {
  valores: number[]
  valor: number
  aoMudar: (v: number) => void
  formatar: (v: number) => string
  rotulo: string
  sufixo: string
}) {
  const listaRef = useRef<HTMLUListElement>(null)
  const itemAltura = 40

  // Traz o valor atual para o centro, ao montar e quando muda por fora.
  useEffect(() => {
    const lista = listaRef.current
    if (!lista) return
    const alvo = lista.querySelector<HTMLElement>(`[data-valor="${valor}"]`)
    if (!alvo) return
    lista.scrollTop = alvo.offsetTop - lista.clientHeight / 2 + itemAltura / 2
  }, [valor])

  /** Anda N posições a partir do valor atual, sem sair da lista. */
  const andar = (passos: number) => {
    const atual = valores.indexOf(valor)
    const proximo = Math.min(valores.length - 1, Math.max(0, (atual < 0 ? 0 : atual) + passos))
    const novo = valores[proximo]
    if (novo !== undefined) aoMudar(novo)
  }

  return (
    <div className="min-w-0 flex-1">
      <span className="label">{rotulo}</span>
      <div className="relative overflow-hidden rounded-xl border border-app-line bg-app-surface">
        <ul
          ref={listaRef}
          role="listbox"
          tabIndex={0}
          aria-label={rotulo}
          aria-activedescendant={`opcao-${sufixo}-${valor}`}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              andar(-1)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              andar(1)
            } else if (e.key === 'PageUp') {
              e.preventDefault()
              andar(-5)
            } else if (e.key === 'PageDown') {
              e.preventDefault()
              andar(5)
            } else if (e.key === 'Home') {
              e.preventDefault()
              aoMudar(valores[0])
            } else if (e.key === 'End') {
              e.preventDefault()
              aoMudar(valores[valores.length - 1])
            }
          }}
          className="h-30 snap-y snap-mandatory overflow-y-auto py-20"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          {valores.map((v) => (
            <li
              key={v}
              id={`opcao-${sufixo}-${v}`}
              data-valor={v}
              role="option"
              aria-selected={v === valor}
              onClick={() => aoMudar(v)}
              className={[
                'flex h-10 cursor-pointer snap-center items-center justify-center text-lg tabular-nums transition-colors',
                v === valor ? 'font-extrabold text-brand-600 dark:text-brand-400' : 'text-app-ink-3',
              ].join(' ')}
            >
              {formatar(v)}
            </li>
          ))}
        </ul>
        {/* Faixa do valor escolhido, para o olho achar onde está. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 h-10 -translate-y-1/2 rounded-lg border border-brand-500/40 bg-brand-500/5"
          aria-hidden="true"
        />
      </div>
      <p className="mt-1 text-center text-[10px] font-bold tracking-widest text-app-ink-3 uppercase">{sufixo}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Painel geral
// ─────────────────────────────────────────────────────────────────────────

/**
 * Lista de todos os lembretes configurados.
 * Aparece em Missas, para o usuário conferir de relance o que está marcado.
 */
export function ListaLembretes({ aoAbrir }: { aoAbrir: (id: string) => void }) {
  const eventos = useStore(seletorEventos)
  // `avisosPendentes` relê os eventos do store, então ele precisa mudar junto.
  const pendentes = useMemo(() => avisosPendentes(), [eventos])

  if (pendentes.length === 0) {
    return (
      <p className="text-sm text-app-ink-3">
        Nenhum lembrete marcado. Abra uma missa ou ensaio e defina a antecedência.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {pendentes.slice(0, 8).map(({ evento, em }) => {
        const quando = paraData(evento.data, evento.hora)
        const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
        return (
          <li key={evento.id}>
            <button
              type="button"
              onClick={() => aoAbrir(evento.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-app-line bg-app-surface px-3.5 py-2.5 text-left transition-colors hover:border-brand-500"
            >
              <Bell size={16} className="shrink-0 text-brand-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-app-ink">{evento.titulo}</p>
                <p className="truncate text-xs text-app-ink-3">
                  {quando ? `${dias[quando.getDay()]} ${evento.hora}` : evento.data} · avisa{' '}
                  {em < 3600_000 ? `${Math.round(em / 60000)} min antes` : `${Math.round(em / 3600_000)} h antes`}
                </p>
              </div>
              <Check size={15} className="shrink-0 text-app-ink-4" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
