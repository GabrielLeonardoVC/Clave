/**
 * audio — tocar acordes, notas e metrônomo.
 *
 * Tudo sintetizado com Web Audio. Nenhum arquivo de áudio para baixar, e o
 * som sai na hora, sem latência de carregamento.
 *
 * O metrônomo agenda as batidas no relógio de áudio, e não no do JavaScript.
 * A diferença importa ao vivo: com o JavaScript, uma aba em segundo plano
 * (o celular no modo economia) atrasa o compasso; com o relógio de áudio, não.
 */

type Som = 'click' | 'madeira' | 'sino' | 'digital'

let contexto: AudioContext | null = null
let mestre: GainNode | null = null

/** O navegador só deixa tocar depois de um toque do usuário. */
export function contextoAudio(): AudioContext | null {
  if (contexto) return contexto
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    contexto = new Ctor()
    mestre = contexto.createGain()
    mestre.gain.value = 0.9
    mestre.connect(contexto.destination)
  } catch {
    contexto = null
  }
  return contexto
}

export function destravarAudio(): void {
  const ctx = contextoAudio()
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}

export function audioDisponivel(): boolean {
  return contextoAudio() !== null
}

/** Altura em Hz a partir da altura 0..11, com Dó4 (MIDI 60) como referência. */
export function frequencia(pc: number, oitava = 4): number {
  const midi = 12 * (oitava + 1) + (((pc % 12) + 12) % 12)
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// ─────────────────────────────────────────────────────────────────────────
//  Nota e acorde
// ─────────────────────────────────────────────────────────────────────────

/** Onda mais discreta para cada timbre: serra soa áspero em nota longa. */
const ONDAS: Record<string, OscillatorType> = {
  piano: 'triangle',
  violao: 'sawtooth',
  organ: 'sine',
}

export type Timbre = keyof typeof ONDAS

interface OpcoesTocar {
  oitava?: number
  duracao?: number
  volume?: number
  timbre?: Timbre
}

function tocarNota(ctx: AudioContext, saida: AudioNode, pc: number, opcoes: OpcoesTocar): void {
  const {
    oitava = 4,
    duracao = 0.9,
    volume = 0.22,
    timbre = 'piano',
  } = opcoes

  const agora = ctx.currentTime
  const envelope = ctx.createGain()
  envelope.gain.setValueAtTime(0.0001, agora)
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), agora + 0.02)
  envelope.gain.exponentialRampToValueAtTime(0.0001, agora + duracao)
  envelope.connect(saida)

  // Duas oscilações levemente desafinadas dão corpo sem harshness.
  const principal = ctx.createOscillator()
  principal.type = ONDAS[timbre] ?? 'triangle'
  principal.frequency.value = frequencia(pc, oitava)
  principal.connect(envelope)

  const parcial = ctx.createOscillator()
  parcial.type = 'sine'
  parcial.frequency.value = frequencia(pc, oitava) * 2.005
  const ganhoParcial = ctx.createGain()
  ganhoParcial.gain.value = 0.22
  parcial.connect(ganhoParcial)
  ganhoParcial.connect(envelope)

  principal.start(agora)
  parcial.start(agora)
  principal.stop(agora + duracao + 0.05)
  parcial.stop(agora + duracao + 0.05)

  // O envelope é descartado sozinho depois que o último oscilador para.
  principal.onended = () => {
    envelope.disconnect()
    ganhoParcial.disconnect()
  }
}

/** Toca uma nota solta. */
export function tocarNotaSolta(
  pc: number,
  opcoes: OpcoesTocar & { timbre?: Timbre } = {},
): void {
  const ctx = contextoAudio()
  if (!ctx || !mestre) return
  destravarAudio()
  tocarNota(ctx, mestre, pc, opcoes)
}

/**
 * Toca um acorde.
 *
 * As vozes entram com alguns milissegundos de atraso entre si, como um
 * dedilhado. Tocadas exatamente juntas, um acorde soa duro, e ninguém afina
 * um acorde ouvindo um bloco de notas.
 */
export function tocarAcorde(alturas: number[], opcoes: OpcoesTocar & { timbre?: Timbre } = {}): void {
  const ctx = contextoAudio()
  if (!ctx || !mestre || !alturas.length) return
  destravarAudio()

  const base = opcoes.oitava ?? 3
  alturas.forEach((pc, i) => {
    if (i === 0) {
      tocarNota(ctx, mestre!, pc, { ...opcoes, oitava: base })
      return
    }
    setTimeout(() => {
      const c = contextoAudio()
      if (c && mestre) tocarNota(c, mestre, pc, { ...opcoes, oitava: base })
    }, i * 22)
  })
}

// ─────────────────────────────────────────────────────────────────────────
//  Metrônomo
// ─────────────────────────────────────────────────────────────────────────

export interface EstadoMetro {
  tocando: boolean
  bpm: number
  compasso: number
  subdivisao: 1 | 2
  som: Som
  volume: number
  /** Batida atual, 0..(compasso*subdivisao-1). */
  passo: number
  onPasso?: (passo: number) => void
}

const metro: EstadoMetro = {
  tocando: false,
  bpm: 100,
  compasso: 4,
  subdivisao: 1,
  som: 'click',
  volume: 0.7,
  passo: 0,
}

let timerMetro: number | null = null
let proximoAgendado = 0
let contadorPassos = 0

/** Frequências de cada timbre, para diferenciar o timbre de relance. */
const FREQ_SOM: Record<Som, [number, number]> = {
  click: [1568, 1047],
  madeira: [1175, 880],
  sino: [1760, 1319],
  digital: [2093, 1568],
}

function agendarTique(ctx: AudioContext, destino: AudioNode, tempo: number, primeiro: boolean): void {
  const [alta, baixa] = FREQ_SOM[metro.som]
  const g = ctx.createGain()
  g.connect(destino)

  const dur = metro.som === 'sino' ? 0.09 : 0.05
  const f = primeiro ? alta : baixa
  const vol = metro.volume * (primeiro ? 1 : 0.55)

  g.gain.setValueAtTime(0.0001, tempo)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), tempo + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, tempo + dur)

  const osc = ctx.createOscillator()
  osc.type = metro.som === 'madeira' ? 'triangle' : 'sine'
  osc.frequency.setValueAtTime(f, tempo)
  if (primeiro) osc.frequency.exponentialRampToValueAtTime(f * 0.78, tempo + dur * 0.85)
  osc.connect(g)
  osc.start(tempo)
  osc.stop(tempo + dur + 0.02)
}

function varrer(): void {
  const ctx = contextoAudio()
  if (!ctx || !mestre || !metro.tocando) return

  const duracaoPasso = 60 / metro.bpm / metro.subdivisao
  const janela = 0.06
  let guarda = 0

  while (proximoAgendado < ctx.currentTime + janela && guarda++ < 32) {
    const totalPassos = metro.compasso * metro.subdivisao
    const passo = contadorPassos % totalPassos
    const primeiro = passo % metro.compasso === 0

    agendarTique(ctx, mestre, proximoAgendado, primeiro)
    metro.passo = passo

    // O aviso para a interface sai com o atraso exato do relógio de áudio.
    if (metro.onPasso) {
      const atrasoMs = Math.max(0, (proximoAgendado - ctx.currentTime) * 1000)
      const passoAvisado = passo
      setTimeout(() => metro.onPasso?.(passoAvisado), atrasoMs)
    }

    proximoAgendado += duracaoPasso
    contadorPassos++
  }
}

export function iniciarMetronomo(config?: Partial<Omit<EstadoMetro, 'tocando'>>): boolean {
  if (config) {
    if (typeof config.bpm === 'number') metro.bpm = Math.min(320, Math.max(20, config.bpm))
    if (typeof config.compasso === 'number') metro.compasso = Math.min(16, Math.max(1, config.compasso))
    if (config.subdivisao === 1 || config.subdivisao === 2) metro.subdivisao = config.subdivisao
    if (config.som) metro.som = config.som
    if (typeof config.volume === 'number') metro.volume = Math.min(1, Math.max(0, config.volume))
    if (typeof config.onPasso === 'function') metro.onPasso = config.onPasso
  }

  const ctx = contextoAudio()
  if (!ctx) return false
  destravarAudio()
  if (metro.tocando) return true

  metro.tocando = true
  contadorPassos = 0
  proximoAgendado = ctx.currentTime + 0.1
  varrer()
  timerMetro = window.setInterval(varrer, 25)
  return true
}

export function pararMetronomo(): void {
  metro.tocando = false
  if (timerMetro !== null) {
    clearInterval(timerMetro)
    timerMetro = null
  }
}

export function alternarMetronomo(): boolean {
  if (metro.tocando) {
    pararMetronomo()
    return false
  }
  return iniciarMetronomo()
}

export function estadoMetronomo(): Readonly<EstadoMetro> {
  return metro
}

export function definirMetronomo(config: Partial<Omit<EstadoMetro, 'tocando'>>): void {
  iniciarMetronomo(config)
  if (metro.tocando) {
    // Já rodando: aplica na hora, sem reiniciar a contagem.
    if (typeof config.bpm === 'number') metro.bpm = Math.min(320, Math.max(20, config.bpm))
    if (typeof config.compasso === 'number') metro.compasso = Math.min(16, Math.max(1, config.compasso))
    if (config.som) metro.som = config.som
    if (typeof config.volume === 'number') metro.volume = Math.min(1, Math.max(0, config.volume))
    if (typeof config.onPasso === 'function') metro.onPasso = config.onPasso
  }
}

/**
 * Tap tempo.
 * Usa a mediana dos intervalos, em vez da média: um intervalo atrapalhado
 * (uma distração, um toque atrasado) não deve puxar o resultado.
 */
let toques: number[] = []

export function tapTempo(): number | null {
  const agora = performance.now()
  toques = toques.filter((t) => agora - t < 2600)
  toques.push(agora)
  if (toques.length < 2) return null

  const recentes = toques.slice(-7)
  const intervalos: number[] = []
  for (let i = 1; i < recentes.length; i++) intervalos.push(recentes[i] - recentes[i - 1])
  intervalos.sort((a, b) => a - b)
  const mediana = intervalos[Math.floor(intervalos.length / 2)]
  if (mediana < 200 || mediana > 2400) return null

  const bpm = Math.round(60000 / mediana)
  metro.bpm = Math.min(320, Math.max(20, bpm))
  return metro.bpm
}

export function reiniciarTap(): void {
  toques = []
}
