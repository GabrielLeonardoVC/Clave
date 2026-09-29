/**
 * store — estado do aplicativo e persistência.
 *
 * Store externo simples, lido por React através de `useSyncExternalStore`.
 * Sem biblioteca de estado: a lógica é pequena, e controlar a persistência na
 * mão evita surpresas com re-renderizações desnecessárias.
 *
 * Persistência em duas camadas:
 *  - localStorage para texto (repertório, eventos, ajustes)
 *  - IndexedDB para as gravações de áudio, que não caberiam no localStorage
 */

import { useCallback, useSyncExternalStore } from 'react'

const CHAVE = 'cifraceleste.v1'
const VERSAO = 1
/** Margem abaixo do limite real do navegador, para não estourar do nada. */
const LIMITE_SEGURANCA = 4.4 * 1024 * 1024

// ─────────────────────────────────────────────────────────────────────────
//  Modelo
// ─────────────────────────────────────────────────────────────────────────

export type TipoEvento = 'missa' | 'ensaio' | 'show' | 'outro'
export type StatusEvento = 'rascunho' | 'confirmado'

export interface Cifra {
  id: string
  titulo: string
  artista: string
  tom: string
  bpm: number | null
  compasso: string
  categoria: string
  tags: string[]
  letra: string
  cifra: string
  /** Chave da gravação de referência no IndexedDB. */
  audioId: string | null
  /**
   * Tamanho da fonte na grade da cifra, em pixels.
   * Vive na cifra, e não nos ajustes, porque a leitura no palco é uma
   * necessidade de cada música: uma com letra miúda precisa de outra com
   * letra grande, e a equipe troca entre as duas o tempo todo.
   */
  fonteCifra: number
  criadaEm: number
  atualizadaEm: number
}

export interface Musica {
  id: string
  titulo: string
  artista: string
  tom: string
  bpm: number | null
  compasso: string
  categoria: string
  responsavel: string
  observacao: string
  cifraId: string | null
  youtubeId: string
  /** Chave da gravação no IndexedDB. */
  audioId: string | null
}

export interface Lembrete {
  ativo: boolean
  /** Minutos antes do evento. Ex.: { horas: 2, minutos: 30 } = 2 h 30. */
  horas: number
  minutos: number
}

export interface Evento {
  id: string
  data: string
  hora: string
  titulo: string
  local: string
  tipo: TipoEvento
  observacao: string
  status: StatusEvento
  musicas: Musica[]
  lembrete: Lembrete | null
  criadoEm: number
  atualizadoEm: number
}

export interface Ajustes {
  tema: 'light' | 'dark' | 'system'
  accent: 'royal' | 'amber'
  /** Multiplicador da fonte da interface. 1 = normal. */
  tamanhoTexto: number
  /** 'auto' decide pela armadura do tom; os demais forçam a grafia. */
  grafia: 'auto' | 'sharp' | 'flat'
  metronomo: {
    bpm: number
    compasso: number
    subdivisao: 1 | 2
    som: 'click' | 'madeira' | 'sino' | 'digital'
    volume: number
  }
  /** Rolagem automática da cifra, em pixels por segundo. 0 desliga. */
  autoScroll: number
  notificacoes: boolean
  mostrarEmergencia: boolean
}

export interface Estado {
  versao: number
  cifras: Cifra[]
  eventos: Evento[]
  ajustes: Ajustes
}

const AJUSTES_PADRAO: Ajustes = {
  tema: 'system',
  accent: 'royal',
  tamanhoTexto: 1,
  grafia: 'auto',
  metronomo: { bpm: 100, compasso: 4, subdivisao: 1, som: 'click', volume: 0.7 },
  autoScroll: 0,
  notificacoes: false,
  mostrarEmergencia: true,
}

function estadoVazio(): Estado {
  return { versao: VERSAO, cifras: [], eventos: [], ajustes: { ...AJUSTES_PADRAO } }
}

// ─────────────────────────────────────────────────────────────────────────
//  Validação
// ─────────────────────────────────────────────────────────────────────────

export function uid(prefixo = 'id'): string {
  const aleatorio =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `${prefixo}_${aleatorio}`
}

const texto = (v: unknown, max = 4000): string => String(v ?? '').slice(0, max)

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/
const HORA_RE = /^\d{2}:\d{2}$/

function numOu(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, Math.round(n)))
}

function normalizaMusica(m: unknown): Musica {
  const o = (m ?? {}) as Record<string, unknown>
  return {
    id: texto(o.id, 40) || uid('mus'),
    titulo: texto(o.titulo ?? o.nome, 200),
    artista: texto(o.artista, 200),
    tom: texto(o.tom, 12),
    bpm: numOu(o.bpm, 20, 320),
    compasso: texto(o.compasso, 8) || '4/4',
    categoria: texto(o.categoria, 40),
    responsavel: texto(o.responsavel, 80),
    observacao: texto(o.observacao ?? o.obs, 600),
    cifraId: o.cifraId ? texto(o.cifraId, 40) : null,
    youtubeId: texto(o.youtubeId ?? o.ytId, 20),
    audioId: o.audioId ? texto(o.audioId, 60) : null,
  }
}

function normalizaCifra(c: unknown): Cifra {
  const o = (c ?? {}) as Record<string, unknown>
  const agora = Date.now()
  return {
    id: texto(o.id, 40) || uid('cif'),
    titulo: texto(o.titulo, 200) || 'Sem título',
    artista: texto(o.artista, 200),
    tom: texto(o.tom, 12),
    bpm: numOu(o.bpm, 20, 320),
    compasso: texto(o.compasso, 8) || '4/4',
    categoria: texto(o.categoria, 40),
    tags: Array.isArray(o.tags) ? o.tags.slice(0, 20).map((t) => texto(t, 30)) : [],
    letra: texto(o.letra),
    cifra: texto(o.cifra),
    audioId: o.audioId ? texto(o.audioId, 60) : null,
    fonteCifra: Math.min(24, Math.max(11, Number(o.fonteCifra) || 14)),
    criadaEm: numOu(o.criadaEm, 0, Number.MAX_SAFE_INTEGER) ?? agora,
    atualizadaEm: numOu(o.atualizadaEm, 0, Number.MAX_SAFE_INTEGER) ?? agora,
  }
}

function normalizaEvento(e: unknown): Evento {
  const o = (e ?? {}) as Record<string, unknown>
  const agora = Date.now()
  const rawTipo = texto(o.tipo, 20)
  const tipo: TipoEvento = (['missa', 'ensaio', 'show', 'outro'] as const).includes(
    rawTipo as TipoEvento,
  )
    ? (rawTipo as TipoEvento)
    : 'missa'

  const rawStatus = texto(o.status, 20)
  const status: StatusEvento = rawStatus === 'confirmado' ? 'confirmado' : 'rascunho'

  const lembr = (o.lembrete ?? null) as Record<string, unknown> | null
  const lembrete: Lembrete | null = lembr
    ? {
        ativo: lembr.ativo === true,
        horas: Math.min(72, Math.max(0, Number(lembr.horas) || 0)),
        minutos: Math.min(59, Math.max(0, Number(lembr.minutos) || 0)),
      }
    : null

  const data = DATA_RE.test(texto(o.data, 10)) ? texto(o.data, 10) : hojeISO()
  const hora = HORA_RE.test(texto(o.hora, 5)) ? texto(o.hora, 5) : '19:00'

  return {
    id: texto(o.id, 40) || uid('evt'),
    data,
    hora,
    titulo: texto(o.titulo, 200) || 'Missa',
    local: texto(o.local, 200),
    tipo,
    observacao: texto(o.observacao, 1000),
    status,
    musicas: Array.isArray(o.musicas) ? o.musicas.map(normalizaMusica) : [],
    lembrete,
    criadoEm: numOu(o.criadoEm, 0, Number.MAX_SAFE_INTEGER) ?? agora,
    atualizadoEm: numOu(o.atualizadaEm, 0, Number.MAX_SAFE_INTEGER) ?? agora,
  }
}

function normalizaAjustes(a: unknown): Ajustes {
  const o = (a ?? {}) as Record<string, unknown>
  const m = (o.metronomo ?? {}) as Record<string, unknown>
  const som = texto(m.som, 12)
  const tema = texto(o.tema, 10)
  const accent = texto(o.accent, 10)
  const grafia = texto(o.grafia, 8)

  return {
    tema: tema === 'light' || tema === 'dark' ? tema : 'system',
    accent: accent === 'amber' ? 'amber' : 'royal',
    tamanhoTexto: Math.min(1.4, Math.max(0.85, Number(o.tamanhoTexto) || 1)),
    grafia: grafia === 'sharp' || grafia === 'flat' ? grafia : 'auto',
    metronomo: {
      bpm: numOu(m.bpm, 20, 320) ?? AJUSTES_PADRAO.metronomo.bpm,
      compasso: numOu(m.compasso, 1, 16) ?? AJUSTES_PADRAO.metronomo.compasso,
      subdivisao: numOu(m.subdivisao, 1, 2) === 2 ? 2 : 1,
      som: (['click', 'madeira', 'sino', 'digital'] as const).includes(som as never)
        ? (som as Ajustes['metronomo']['som'])
        : 'click',
      volume: Math.min(1, Math.max(0, Number(m.volume) ?? 0.7)),
    },
    autoScroll: Math.min(120, Math.max(0, Number(o.autoScroll) || 0)),
    notificacoes: o.notificacoes === true,
    mostrarEmergencia: o.mostrarEmergencia !== false,
  }
}

/** Lê o estado salvo, tolerante a dados corrompidos ou de versões antigas. */
function carregarDoDisco(): Estado {
  const base = estadoVazio()
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return base
    const dados = JSON.parse(bruto) as Record<string, unknown>
    if (!dados || typeof dados !== 'object') return base

    return {
      versao: VERSAO,
      cifras: Array.isArray(dados.cifras) ? dados.cifras.map(normalizaCifra) : [],
      eventos: Array.isArray(dados.eventos) ? dados.eventos.map(normalizaEvento) : [],
      ajustes: normalizaAjustes(dados.ajustes),
    }
  } catch {
    // Dado ilegível não pode impedir o app de abrir.
    return base
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  Store
// ─────────────────────────────────────────────────────────────────────────

let estado: Estado = estadoVazio()
let carregado = false
let salvoEm: ReturnType<typeof setTimeout> | null = null
let falhaDeCota = false
const ouvintes = new Set<() => void>()

function emitir(): void {
  for (const o of [...ouvintes]) o()
}

function gravarAgora(): boolean {
  if (salvoEm) {
    clearTimeout(salvoEm)
    salvoEm = null
  }
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado))
    falhaDeCota = false
    return true
  } catch {
    falhaDeCota = true
    return false
  }
}

/** Agrupa as gravações: escrever a cada tecla travaria a interface. */
function agendarGravacao(): void {
  if (salvoEm) clearTimeout(salvoEm)
  salvoEm = setTimeout(gravarAgora, 400)
}

export function inicializar(): void {
  if (carregado) return
  estado = carregarDoDisco()
  carregado = true
  emitir()
}

export function obterEstado(): Estado {
  if (!carregado) inicializar()
  return estado
}

function mudar(mutacao: (atual: Estado) => Estado): void {
  const anterior = estado
  const proximo = mutacao(anterior)
  if (proximo === anterior) return
  estado = proximo
  agendarGravacao()
  emitir()
}

export function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/**
 * Assina o estado do React ao store.
 *
 * O seletor precisa devolver um valor estável para o mesmo estado — senão o
 * React entra em laço de re-render. Por isso os seletores mais usados são
 * funções de escopo de módulo, e não lambdas criadas dentro do componente.
 */
export function useStore<T>(seletor: (e: Estado) => T): T {
  const leitor = useCallback(() => seletor(obterEstado()), [seletor])
  return useSyncExternalStore(assinar, leitor, leitor)
}

/** Seletores estáveis. Use estes em vez de criar lambdas na hora. */
export const seletorCifras = (e: Estado): Cifra[] => e.cifras
export const seletorEventos = (e: Estado): Evento[] => e.eventos
export const seletorAjustes = (e: Estado): Ajustes => e.ajustes
export const seletorMostrarEmergencia = (e: Estado): boolean => e.ajustes.mostrarEmergencia

export const cotaEstourada = (): boolean => falhaDeCota

// ── Repertório ───────────────────────────────────────────────────────────

export function listaCifras(): Cifra[] {
  return obterEstado().cifras
}

export function criarCifra(dados: Partial<Cifra>): Cifra {
  const nova = normalizaCifra({ ...dados, criadaEm: Date.now(), atualizadaEm: Date.now() })
  mudar((e) => ({ ...e, cifras: [nova, ...e.cifras] }))
  return nova
}

export function atualizarCifra(id: string, dados: Partial<Cifra>): void {
  mudar((e) => ({
    ...e,
    cifras: e.cifras.map((c) => (c.id === id ? normalizaCifra({ ...c, ...dados, id, atualizadaEm: Date.now() }) : c)),
  }))
}

export function removerCifra(id: string): void {
  mudar((e) => ({ ...e, cifras: e.cifras.filter((c) => c.id !== id) }))
}

export function obterCifra(id: string | null): Cifra | null {
  if (!id) return null
  return obterEstado().cifras.find((c) => c.id === id) ?? null
}

// ── Eventos ──────────────────────────────────────────────────────────────

export function listaEventos(): Evento[] {
  return obterEstado().eventos
}

export function eventosDoDia(data: string): Evento[] {
  return obterEstado()
    .eventos.filter((e) => e.data === data)
    .sort((a, b) => a.hora.localeCompare(b.hora))
}

export function eventosFuturos(): Evento[] {
  const hoje = hojeISO()
  return obterEstado()
    .eventos.filter((e) => e.data >= hoje)
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
}

export function criarEvento(dados: Partial<Evento>): Evento {
  const novo = normalizaEvento({ ...dados, criadoEm: Date.now(), atualizadoEm: Date.now() })
  mudar((e) => ({ ...e, eventos: [...e.eventos, novo] }))
  return novo
}

export function atualizarEvento(id: string, dados: Partial<Evento>): void {
  mudar((e) => ({
    ...e,
    eventos: e.eventos.map((ev) =>
      ev.id === id ? normalizaEvento({ ...ev, ...dados, id, atualizadoEm: Date.now() }) : ev,
    ),
  }))
}

export function removerEvento(id: string): void {
  mudar((e) => ({ ...e, eventos: e.eventos.filter((ev) => ev.id !== id) }))
}

export function obterEvento(id: string): Evento | null {
  return obterEstado().eventos.find((e) => e.id === id) ?? null
}

/** Músicas usadas em algum evento, sem repetir, para o repertório rápido. */
export function musicaPorTitulo(titulo: string): Musica | null {
  const alvo = titulo.trim().toLowerCase()
  if (!alvo) return null
  for (const ev of obterEstado().eventos) {
    for (const m of ev.musicas) {
      if (m.titulo.trim().toLowerCase() === alvo) return m
    }
  }
  return null
}

// ── Ajustes ──────────────────────────────────────────────────────────────

export function obterAjustes(): Ajustes {
  return obterEstado().ajustes
}

export function definirAjuste<K extends keyof Ajustes>(chave: K, valor: Ajustes[K]): void {
  mudar((e) => ({ ...e, ajustes: { ...e.ajustes, [chave]: valor } }))
}

// ── Dados ────────────────────────────────────────────────────────────────

export function exportarBackup(): string {
  return JSON.stringify(
    { app: 'CifraCeleste', exportadoEm: new Date().toISOString(), ...estado, versao: VERSAO },
    null,
    2,
  )
}

export function importarBackup(json: string): { cifras: number; eventos: number } {
  const dados = JSON.parse(json) as Record<string, unknown>
  if (!dados || typeof dados !== 'object') throw new Error('Arquivo inválido.')

  const cifras = Array.isArray(dados.cifras) ? dados.cifras.map(normalizaCifra) : []
  const eventos = Array.isArray(dados.eventos) ? dados.eventos.map(normalizaEvento) : []

  mudar((e) => {
    // Substitui o que já existe em vez de duplicar.
    return { ...e, cifras, eventos, ajustes: normalizaAjustes(dados.ajustes ?? e.ajustes) }
  })

  return { cifras: cifras.length, eventos: eventos.length }
}

export function apagarTudo(): void {
  estado = estadoVazio()
  gravarAgora()
  emitir()
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    /* armazenamento indisponível: o estado em memória já foi limpo */
  }
}

/** Tamanho ocupado, para avisar antes de encher. */
export function tamanhoArmazenado(): { bytes: number; pct: number } {
  try {
    const s = localStorage.getItem(CHAVE)
    const bytes = s ? s.length * 2 : 0
    return { bytes, pct: Math.min(100, Math.round((bytes / LIMITE_SEGURANCA) * 100)) }
  } catch {
    return { bytes: 0, pct: 0 }
  }
}

// ── Datas ────────────────────────────────────────────────────────────────

export function hojeISO(): string {
  return paraISO(new Date())
}

export function paraISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** 'YYYY-MM-DD' + 'HH:MM' -> Date local. Devolve null se os dados forem inválidos. */
export function paraData(data: string, hora = '00:00'): Date | null {
  if (!DATA_RE.test(data)) return null
  const [a, m, d] = data.split('-').map(Number)
  const [hh, mm] = (HORA_RE.test(hora) ? hora : '00:00').split(':').map(Number)
  const resultado = new Date(a, m - 1, d, hh, mm, 0, 0)
  // Confere: `new Date(2024, 1, 31)` rola para março, e isso não é o que o
  // usuário pediu.
  if (resultado.getFullYear() !== a || resultado.getMonth() !== m - 1) return null
  return resultado
}
