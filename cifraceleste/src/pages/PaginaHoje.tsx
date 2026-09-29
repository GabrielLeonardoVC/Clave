/**
 * PaginaHoje — o painel de entrada.
 *
 * Responde a uma pergunta só: o que toca agora, e o que vem a seguir.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Bell, CalendarDays, Library, Mic, PlayCircle, Plus, Siren } from 'lucide-react'

import { eventosFuturos, hojeISO, seletorCifras, seletorEventos, useStore, type Evento } from '@/lib/store'
import { distanciaRelativa, formatarData } from '@/lib/helpers'
import { avisosPendentes } from '@/lib/notify'
import { abrirEmergencia } from '@/lib/emergencia'
import { navegarPara } from '@/lib/router'
import { PainelMetronomo } from '@/components/AudioTools'
import { Folha } from '@/components/ui'

export function PaginaHoje() {
  const eventos = useStore(seletorEventos)
  const cifras = useStore(seletorCifras)

  const hoje = hojeISO()
  const doDia = useMemo(() => eventos.filter((e) => e.data === hoje), [eventos, hoje])
  const proximos = useMemo(() => eventosFuturos().slice(0, 4), [eventos])
  const pendentes = useMemo(() => avisosPendentes().slice(0, 2), [eventos])

  const destaque = doDia[0] ?? proximos[0] ?? null
  const [metroAberto, setMetroAberto] = useState(false)

  return (
    <div className="pb-24">
      <header className="mb-4 pt-4">
        <p className="text-sm text-app-ink-3">{saudacao()}</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-app-ink">
          {destaque ? destaque.titulo : 'CifraCeleste'}
        </h1>
      </header>

      {/* ── Destaque ── */}
      {destaque ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.99 }}
          onClick={() => navegarPara('missas', { data: destaque.data, abrir: destaque.id })}
          className="mb-5 flex w-full items-center gap-4 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 p-5 text-left text-white shadow-lift"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold tracking-[0.15em] uppercase opacity-90">
              {distanciaRelativa(destaque.data, hoje)}
              {destaque.hora ? ` · ${destaque.hora}` : ''}
            </p>
            <p className="mt-1 truncate text-xl font-extrabold tracking-tight">{destaque.titulo}</p>
            <p className="mt-0.5 truncate text-sm opacity-90">
              {destaque.musicas.length} {destaque.musicas.length === 1 ? 'música' : 'músicas'}
              {destaque.local ? ` · ${destaque.local}` : ''}
            </p>
          </div>
          <PlayCircle size={34} className="shrink-0" />
        </motion.button>
      ) : (
        <div className="mb-5 rounded-2xl border border-dashed border-app-line-strong p-6 text-center">
          <p className="text-sm text-app-ink-3">Nenhuma missa ou ensaio marcado.</p>
          <button
            type="button"
            onClick={() => navegarPara('missas', { nova: '1' })}
            className="btn-primary mt-3"
          >
            <Plus size={16} /> Marcar o primeiro
          </button>
        </div>
      )}

      {/* ── Ações ── */}
      <div className="mb-5 grid grid-cols-4 gap-2">
        <Atalho icone={<CalendarDays size={19} />} rotulo="Missas" aoClicar={() => navegarPara('missas')} />
        <Atalho icone={<Library size={19} />} rotulo="Repertório" aoClicar={() => navegarPara('repertorio')} />
        <Atalho
          icone={<Siren size={19} />}
          rotulo="Emergência"
          destaque
          aoClicar={() => abrirEmergencia('hoje')}
        />
        <Atalho icone={<Mic size={19} />} rotulo="Metrônomo" aoClicar={() => setMetroAberto(true)} />
      </div>

      {/* ── Lembretes ── */}
      {pendentes.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 flex items-center gap-2 text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">
            <Bell size={13} /> Avisos marcados
          </h2>
          <ul className="flex flex-col gap-1.5">
            {pendentes.map(({ evento, em }) => (
              <li key={evento.id}>
                <button
                  type="button"
                  onClick={() => navegarPara('missas', { data: evento.data, abrir: evento.id })}
                  className="surface flex w-full items-center gap-3 p-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-app-ink">{evento.titulo}</p>
                    <p className="truncate text-xs text-app-ink-3">
                      {formatarData(evento.data)} às {evento.hora} · avisa{' '}
                      {em < 3600_000 ? `${Math.round(em / 60000)} min antes` : `${Math.round(em / 3600_000)} h antes`}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Próximos ── */}
      {proximos.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">Próximos</h2>
          <ul className="flex flex-col gap-1.5">
            {proximos.map((e) => (
              <li key={e.id}>
                <LinhaEvento evento={e} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Repertório ── */}
      {cifras.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">
            Repertório ({cifras.length})
          </h2>
          <ul className="flex flex-col gap-1.5">
            {cifras.slice(0, 5).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => navegarPara('repertorio', { abrir: c.id })}
                  className="surface flex w-full items-center gap-3 p-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-app-ink">{c.titulo}</p>
                    {c.artista && <p className="truncate text-xs text-app-ink-3">{c.artista}</p>}
                  </div>
                  {c.tom && (
                    <span className="shrink-0 rounded-md bg-brand-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                      {c.tom}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {cifras.length > 5 && (
            <button
              type="button"
              onClick={() => navegarPara('repertorio')}
              className="btn-ghost mt-2 w-full"
            >
              Ver todas as {cifras.length}
            </button>
          )}
        </section>
      )}

      <Folha aberta={metroAberto} aoFechar={() => setMetroAberto(false)} titulo="Metrônomo">
        <PainelMetronomo />
      </Folha>
    </div>
  )
}

function Atalho({
  icone,
  rotulo,
  aoClicar,
  destaque = false,
}: {
  icone: ReactNode
  rotulo: string
  aoClicar: () => void
  destaque?: boolean
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={aoClicar}
      className="surface flex flex-col items-center gap-1.5 px-1 py-3"
    >
      <span className={destaque ? 'text-danger-500' : 'text-brand-500'}>{icone}</span>
      <span className="text-[10px] leading-tight font-bold text-app-ink-2">{rotulo}</span>
    </motion.button>
  )
}

function LinhaEvento({ evento }: { evento: Evento }) {
  return (
    <button
      type="button"
      onClick={() => navegarPara('missas', { data: evento.data, abrir: evento.id })}
      className="surface flex w-full items-center gap-3 p-3 text-left"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-app-ink">{evento.titulo}</p>
        <p className="truncate text-xs text-app-ink-3">
          {formatarData(evento.data)} às {evento.hora} · {evento.musicas.length}{' '}
          {evento.musicas.length === 1 ? 'música' : 'músicas'}
        </p>
      </div>
    </button>
  )
}

function saudacao(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}
