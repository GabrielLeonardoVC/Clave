/**
 * PaginaMissas — agenda de missas, ensaios e shows.
 *
 * Um dia pode ter vários eventos, porque a mesma igreja faz a missa às 8h, o
 * ensaio às 19h30 e a consagração às 20h30, e a equipe precisa saber de todos.
 */

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus } from 'lucide-react'

import {
  atualizarEvento,
  criarEvento,
  eventosDoDia,
  hojeISO,
  paraData,
  paraISO,
  removerEvento,
  seletorCifras,
  seletorEventos,
  useStore,
  type Evento,
} from '@/lib/store'
import { navegarPara, useRota } from '@/lib/router'
import { search } from '@/lib/searchLogic'
import { NotificationScheduler, ListaLembretes } from '@/components/NotificationScheduler'
import { EstadoVazio, Folha, useAviso, useConfirmacao } from '@/components/ui'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const TIPOS: Array<{ v: Evento['tipo']; n: string; cor: string }> = [
  { v: 'missa', n: 'Missa', cor: 'bg-brand-500' },
  { v: 'ensaio', n: 'Ensaio', cor: 'bg-amber-500' },
  { v: 'show', n: 'Show', cor: 'bg-moss-500' },
  { v: 'outro', n: 'Outro', cor: 'bg-app-line-strong' },
]

export function PaginaMissas() {
  const { avisar } = useAviso()
  const { confirmar } = useConfirmacao()
  const rota = useRota()
  const eventos = useStore(seletorEventos)

  const [mes, setMes] = useState(() => {
    const base = rota.params.data ? paraData(rota.params.data) ?? new Date() : new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const [dia, setDia] = useState<string>(() => rota.params.data ?? hojeISO())
  const [editorAberto, setEditorAberto] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)

  const doDia = useMemo(() => eventosDoDia(dia), [eventos, dia])

  // Abre o evento pedido pela rota: a notificação leva direto para ele.
  useEffect(() => {
    const id = rota.params.abrir
    if (id && eventos.some((e) => e.id === id)) {
      setEditorAberto(id)
      setDia(rota.params.data ?? hojeISO())
    }
  }, [rota.params.abrir, rota.params.data, eventos])

  const mudarMes = (delta: number) => {
    setMes((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }

  const celulas = useMemo(() => montarGrade(mes), [mes])

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 -mx-4 mb-4 bg-app-bg/85 px-4 pt-4 pb-3 backdrop-blur-md">
        <h1 className="text-2xl font-extrabold tracking-tight text-app-ink">Missas</h1>
        <p className="text-sm text-app-ink-3">Ensaios, missas e shows da equipe</p>
      </header>

      {/* ── Calendário ── */}
      <section className="surface mb-5 p-3">
        <div className="mb-2 flex items-center gap-1">
          <button type="button" onClick={() => mudarMes(-1)} className="btn-icon" aria-label="Mês anterior">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-bold text-app-ink capitalize">
              {MESES[mes.getMonth()]} {mes.getFullYear()}
            </p>
          </div>
          <button type="button" onClick={() => mudarMes(1)} className="btn-icon" aria-label="Próximo mês">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 text-center">
          {DIAS.map((d, i) => (
            <span
              key={d}
              className={[
                'text-[10px] font-extrabold tracking-wide uppercase',
                i === 0 || i === 6 ? 'text-danger-500' : 'text-app-ink-4',
              ].join(' ')}
            >
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {celulas.map(({ data, diaDoMes: numeroDoMes, mesDe }) => {
            const temEventos = eventosDoDia(data).length
            const ehHoje = data === hojeISO()
            const selecionado = data === dia
            return (
              <button
                key={data}
                type="button"
                onClick={() => setDia(data)}
                aria-label={`${data}${temEventos ? `, ${temEventos} evento(s)` : ''}`}
                aria-pressed={selecionado}
                className={[
                  'flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold transition-colors',
                  selecionado
                    ? 'bg-brand-500 text-white'
                    : ehHoje
                      ? 'border border-brand-500 text-brand-600 dark:text-brand-300'
                      : 'text-app-ink-2 hover:bg-app-raised',
                  mesDe !== mes.getMonth() && !selecionado ? 'opacity-35' : '',
                ].join(' ')}
              >
                <span>{numeroDoMes}</span>
                {temEventos > 0 && (
                  <span className={['mt-0.5 h-1 w-1 rounded-full', selecionado ? 'bg-white' : 'bg-brand-500'].join(' ')} />
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Lembretes ── */}
      <section className="mb-5">
        <h2 className="mb-2 flex items-center gap-2 text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">
          <Bell size={13} /> Lembretes
        </h2>
        <ListaLembretes aoAbrir={(id) => navegarPara('missas', { abrir: id })} />
      </section>

      {/* ── Eventos do dia ── */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">
            {formatarDia(dia)}
          </h2>
          <button type="button" onClick={() => setCriando(true)} className="btn-primary btn-sm">
            <Plus size={15} /> Nova
          </button>
        </div>

        {doDia.length === 0 ? (
          <EstadoVazio
            icone={<CalendarDays size={26} />}
            titulo="Nada neste dia"
            mensagem="Crie a missa, o ensaio ou o show. Dá para ter vários no mesmo dia."
            acao={{ rotulo: 'Criar evento', aoClicar: () => setCriando(true) }}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {doDia.map((evento) => (
              <li key={evento.id}>
                <CartaoEvento evento={evento} aoAbrir={() => setEditorAberto(evento.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {criando && (
        <EditorEvento
          evento={null}
          dataInicial={dia}
          aoFechar={() => setCriando(false)}
          aoSalvar={(d) => {
            setCriando(false)
            setDia(d.data)
            avisar('Missa salva.', 'ok')
          }}
        />
      )}

      {editorAberto !== null &&
        (() => {
          const evento = eventos.find((e) => e.id === editorAberto)
          if (!evento) return null
          return (
            <EditorEvento
              evento={evento}
              dataInicial={evento.data}
              aoFechar={() => setEditorAberto(null)}
              aoSalvar={() => {
                setEditorAberto(null)
                avisar('Alterações salvas.', 'ok')
              }}
              aoExcluir={async () => {
                const ok = await confirmar({
                  titulo: 'Excluir evento',
                  mensagem: `Excluir "${evento.titulo}"? Não dá para desfazer.`,
                  rotuloOk: 'Excluir',
                  perigoso: true,
                })
                if (!ok) return
                removerEvento(evento.id)
                setEditorAberto(null)
                avisar('Excluído.', 'ok')
              }}
            />
          )
        })()}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Cartão de evento
// ─────────────────────────────────────────────────────────────────────────

function CartaoEvento({ evento, aoAbrir }: { evento: Evento; aoAbrir: () => void }) {
  const cor = TIPOS.find((t) => t.v === evento.tipo)?.cor ?? 'bg-app-line-strong'

  return (
    <motion.button
      type="button"
      onClick={aoAbrir}
      whileTap={{ scale: 0.985 }}
      className="surface flex w-full items-center gap-3 overflow-hidden p-3.5 text-left"
    >
      <span className={['h-full min-h-12 w-1 shrink-0 rounded-full', cor].join(' ')} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-bold text-app-ink">{evento.titulo}</span>
          {evento.status === 'confirmado' && (
            <span className="shrink-0 rounded-full bg-moss-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
              OK
            </span>
          )}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-app-ink-3">
          <span className="font-semibold text-app-ink-2">{evento.hora}</span>
          {evento.local && (
            <span className="flex items-center gap-1">
              <MapPin size={11} /> {evento.local}
            </span>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-app-raised px-2 py-0.5 text-[11px] font-bold text-app-ink-2">
            {evento.musicas.length} {evento.musicas.length === 1 ? 'música' : 'músicas'}
          </span>
          {evento.musicas.some((m) => m.tom) && (
            <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-bold text-brand-700 dark:text-brand-300">
              {[...new Set(evento.musicas.map((m) => m.tom).filter(Boolean))].join(' · ')}
            </span>
          )}
          {evento.lembrete?.ativo && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
              <Bell size={10} />
              {evento.lembrete.horas}h{evento.lembrete.minutos > 0 ? String(evento.lembrete.minutos).padStart(2, '0') : ''}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Editor de evento
// ─────────────────────────────────────────────────────────────────────────

function EditorEvento({
  evento,
  dataInicial,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  evento: Evento | null
  dataInicial: string
  aoFechar: () => void
  aoSalvar: (dados: { data: string }) => void
  aoExcluir?: () => void
}) {
  const [titulo, setTitulo] = useState(evento?.titulo ?? '')
  const [data, setData] = useState(evento?.data ?? dataInicial)
  const [hora, setHora] = useState(evento?.hora ?? '19:00')
  const [local, setLocal] = useState(evento?.local ?? '')
  const [tipo, setTipo] = useState<Evento['tipo']>(evento?.tipo ?? 'missa')
  const [observacao, setObservacao] = useState(evento?.observacao ?? '')
  const [musicas, setMusicas] = useState<Evento['musicas']>(evento?.musicas ?? [])
  const [confirmado, setConfirmado] = useState(evento?.status === 'confirmado')
  const [lembrete, setLembrete] = useState(evento?.lembrete ?? null)

  const salvar = () => {
    const dados = {
      titulo: titulo.trim() || 'Missa',
      data,
      hora,
      local: local.trim(),
      tipo,
      observacao: observacao.trim(),
      status: (confirmado ? 'confirmado' : 'rascunho') as Evento['status'],
      musicas,
      lembrete,
    }
    if (evento) {
      atualizarEvento(evento.id, dados)
    } else {
      criarEvento(dados)
    }
    aoSalvar(dados)
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      larga
      titulo={evento ? 'Editar' : 'Nova missa'}
      subtitulo={formatarDataExtenso(data)}
      rodape={
        <>
          {aoExcluir && (
            <button type="button" onClick={aoExcluir} className="btn-danger" aria-label="Excluir evento">
              Excluir
            </button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={aoFechar} className="btn-outline">
            Cancelar
          </button>
          <button type="button" onClick={salvar} className="btn-primary">
            Salvar
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="evt-titulo">
            Título
          </label>
          <input
            id="evt-titulo"
            className="input"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Missa de domingo"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="evt-data">
              Data
            </label>
            <input id="evt-data" type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="evt-hora">
              Hora
            </label>
            <input id="evt-hora" type="time" className="input" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="evt-local">
            Local
          </label>
          <input
            id="evt-local"
            className="input"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Ex.: Igreja Matriz"
          />
        </div>

        <div>
          <span className="label">Tipo</span>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS.map((t) => (
              <button
                key={t.v}
                type="button"
                className="chip"
                data-active={tipo === t.v}
                onClick={() => setTipo(t.v)}
              >
                {t.n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="evt-obs">
            Observação
          </label>
          <textarea
            id="evt-obs"
            className="input min-h-20"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: levar a caixa, confirmar o organista"
          />
        </div>

        {/* ── Músicas ── */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">Músicas ({musicas.length})</span>
            <AdicionarMusica aoAdicionar={(m) => setMusicas((atuais) => [...atuais, m])} />
          </div>

          {musicas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-app-line px-4 py-6 text-center text-sm text-app-ink-3">
              Nenhuma música ainda.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {musicas.map((m, i) => (
                <li key={m.id} className="flex items-center gap-2 rounded-xl border border-app-line bg-app-surface px-3 py-2">
                  <span className="w-4 shrink-0 text-xs font-bold text-app-ink-3 tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-app-ink">{m.titulo}</p>
                    <p className="truncate text-xs text-app-ink-3">
                      {[m.tom, m.bpm ? `${m.bpm} bpm` : '', m.categoria, m.responsavel].filter(Boolean).join(' · ')}
                    </p>
                    {m.observacao && <p className="mt-0.5 truncate text-xs text-amber-600 dark:text-amber-400">{m.observacao}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMusicas((atuais) => atuais.filter((_, j) => j !== i))}
                    className="btn-icon shrink-0"
                    aria-label={`Remover ${m.titulo}`}
                  >
                    <ChevronRight size={16} className="rotate-45" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Lembrete ── */}
        <div>
          <span className="label">Lembrete</span>
          <NotificationScheduler
            evento={{ ...(evento ?? criarEventoVazio(data, hora)), data, hora, lembrete }}
            aoMudar={setLembrete}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            className="h-5 w-5 accent-[rgb(var(--c-primary))]"
          />
          <span className="text-sm text-app-ink">Escala confirmada com a equipe</span>
        </label>
      </div>
    </Folha>
  )
}

function criarEventoVazio(data: string, hora: string): Evento {
  return {
    id: '',
    data,
    hora,
    titulo: '',
    local: '',
    tipo: 'missa',
    observacao: '',
    status: 'rascunho',
    musicas: [],
    lembrete: null,
    criadoEm: 0,
    atualizadoEm: 0,
  }
}

function AdicionarMusica({ aoAdicionar }: { aoAdicionar: (m: Evento['musicas'][number]) => void }) {
  const { avisar } = useAviso()
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const cifras = useStore(seletorCifras)

  const resultados = useMemo(
    () => (termo.trim() ? search(cifras, termo, { limit: 12 }) : []),
    [cifras, termo],
  )

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="btn-soft btn-sm">
        <Plus size={14} /> Adicionar
      </button>

      <Folha aberta={aberto} aoFechar={() => setAberto(false)} titulo="Adicionar música">
        <div className="flex flex-col gap-3">
          <input
            className="input"
            placeholder="Buscar no repertório..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoFocus
          />
          {termo.trim() === '' ? (
            <p className="py-6 text-center text-sm text-app-ink-3">
              Digite para buscar entre as {cifras.length} cifras do repertório.
            </p>
          ) : resultados.length === 0 ? (
            <p className="py-6 text-center text-sm text-app-ink-3">Nada encontrado.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {resultados.map(({ item }) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      aoAdicionar({
                        id: uidMusica(),
                        titulo: item.titulo,
                        artista: item.artista,
                        tom: item.tom,
                        bpm: item.bpm,
                        compasso: item.compasso,
                        categoria: item.categoria,
                        responsavel: '',
                        observacao: '',
                        cifraId: item.id,
                        youtubeId: '',
                        audioId: null,
                      })
                      setAberto(false)
                      setTermo('')
                      avisar(`"${item.titulo}" adicionada.`, 'ok')
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-app-line px-3 py-2.5 text-left transition-colors hover:border-brand-500"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-app-ink">{item.titulo}</p>
                      <p className="truncate text-xs text-app-ink-3">{[item.artista, item.tom].filter(Boolean).join(' · ')}</p>
                    </div>
                    <Plus size={16} className="shrink-0 text-brand-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Folha>
    </>
  )
}

function uidMusica(): string {
  return `mus_${Math.random().toString(36).slice(2, 12)}`
}

// ─────────────────────────────────────────────────────────────────────────
//  Datas
// ─────────────────────────────────────────────────────────────────────────

/**
 * Monta a grade do mês, até seis semanas.
 *
 * Cada célula carrega o próprio mês de origem: a primeira e a última linha
 * podem trazer dias do mês vizinho, e é só comparando o mês da célula com o
 * mês em exibição que eles podem ser esmaecidos.
 */
function montarGrade(mes: Date): Array<{ data: string; dia: number; diaDoMes: number; mesDe: number }> {
  const ano = mes.getFullYear()
  const mesNumero = mes.getMonth()
  const primeiroDia = new Date(ano, mesNumero, 1).getDay()
  const celulas: Array<{ data: string; dia: number; diaDoMes: number; mesDe: number }> = []

  for (let i = 0; i < 42; i++) {
    const d = new Date(ano, mesNumero, 1 - primeiroDia + i)
    // A sexta semana só entra se trouxer dia do mês corrente; sem isso a
    // grade fecha com uma linha vazia.
    if (i >= 35 && d.getMonth() !== mesNumero) break
    celulas.push({
      data: paraISO(d),
      dia: d.getDay(),
      diaDoMes: d.getDate(),
      mesDe: d.getMonth(),
    })
  }
  return celulas
}

function formatarDia(iso: string): string {
  const d = paraData(iso)
  if (!d) return iso
  const hoje = hojeISO()
  if (iso === hoje) return 'Hoje'
  const amanha = paraISO(new Date(Date.now() + 86400000))
  if (iso === amanha) return 'Amanhã'
  return `${DIAS[d.getDay()].toUpperCase()}, ${d.getDate()} de ${MESES[d.getMonth()]}`
}

function formatarDataExtenso(iso: string): string {
  const d = paraData(iso)
  if (!d) return iso
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}
