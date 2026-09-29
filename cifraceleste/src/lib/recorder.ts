/**
 * recorder — gravação de referência em áudio.
 *
 * Serve para o músico cantar o trecho uma vez e ouvir depois, para lembrar o
 * tom e a frase. O áudio vai para o IndexedDB: um blob de áudio não cabe no
 * localStorage, que é limitado a cerca de 5 MB e é compartilhado com todo o
 * resto do app.
 */

const NOME_BANCO = 'cifraceleste-audio'
const VERSAO_BANCO = 1
const LOJA = 'gravacoes'

let bancoPromise: Promise<IDBDatabase> | null = null

function abrirBanco(): Promise<IDBDatabase> {
  if (bancoPromise) return bancoPromise

  bancoPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Este navegador não guarda áudio localmente.'))
      return
    }
    const pedido = indexedDB.open(NOME_BANCO, VERSAO_BANCO)
    pedido.onupgradeneeded = () => {
      const db = pedido.result
      if (!db.objectStoreNames.contains(LOJA)) {
        db.createObjectStore(LOJA, { keyPath: 'id' })
      }
    }
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => reject(pedido.error ?? new Error('Não foi possível abrir o armazenamento de áudio.'))
  }).catch((erro) => {
    // Libera a promessa para uma nova tentativa poder rodar depois.
    bancoPromise = null
    throw erro
  })

  return bancoPromise
}

export interface Gravacao {
  id: string
  blob: Blob
  duracaoSegundos: number
  criadoEm: number
}

function transacao<T>(modo: IDBTransactionMode, acao: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return abrirBanco().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(LOJA, modo)
        const pedido = acao(tx.objectStore(LOJA))
        pedido.onsuccess = () => resolve(pedido.result)
        pedido.onerror = () => reject(pedido.error ?? new Error('Falha ao acessar o áudio.'))
        tx.onabort = () => reject(tx.error ?? new Error('Operação cancelada.'))
      }),
  )
}

export function armazenamentoDisponivel(): boolean {
  return typeof indexedDB !== 'undefined'
}

export function salvarGravacao(blob: Blob, duracaoSegundos: number): Promise<string> {
  const id = `gra_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const registro: Gravacao = { id, blob, duracaoSegundos, criadoEm: Date.now() }
  return transacao('readwrite', (loja) => loja.put(registro) as IDBRequest<IDBValidKey>).then(() => id)
}

export function lerGravacao(id: string): Promise<Gravacao | null> {
  return transacao<Gravacao | undefined>('readonly', (loja) => loja.get(id)).then((r) => r ?? null)
}

export function apagarGravacao(id: string): Promise<void> {
  return transacao('readwrite', (loja) => loja.delete(id) as unknown as IDBRequest<undefined>).then(() => undefined)
}

export function listarGravacoes(): Promise<Gravacao[]> {
  return transacao<Gravacao[]>('readonly', (loja) => loja.getAll() as IDBRequest<Gravacao[]>).then(
    (todas) => [...todas].sort((a, b) => b.criadoEm - a.criadoEm),
  )
}

/** Tamanho aproximado do que está guardado, para o aviso de espaço. */
export async function tamanhoArmazenado(): Promise<number> {
  try {
    const todas = await listarGravacoes()
    return todas.reduce((soma, g) => soma + g.blob.size, 0)
  } catch {
    return 0
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  Captura
// ─────────────────────────────────────────────────────────────────────────

export type EstadoGravador = 'inativo' | 'preparando' | 'gravando' | 'parado' | 'erro'

export interface OpcoesGravador {
  /** Callback do nível de entrada, 0..1, para o medidor. */
  aoMedir?: (nivel: number) => void
  /** Duração máxima em segundos. O gravador para sozinho ao atingir. */
  maximoSegundos?: number
}

export class Gravador {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private pedacos: Blob[] = []
  private contexto: AudioContext | null = null
  private analisador: AnalyserNode | null = null
  private animacao: number | null = null
  private inicio = 0
  private maximo = 300

  estado: EstadoGravador = 'inativo'
  erro: string | null = null

  get gravando(): boolean {
    return this.estado === 'gravando'
  }

  /** Formatos aceitos por ordem de preferência: nem todo navegador tem todos. */
  private static formatos(): string[] {
    if (typeof MediaRecorder === 'undefined') return []
    const candidatas = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ]
    return candidatas.filter((t) => MediaRecorder.isTypeSupported(t))
  }

  suportado(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      Gravador.formatos().length > 0
    )
  }

  async iniciar(opcoes: OpcoesGravador = {}): Promise<boolean> {
    if (this.gravando) return true
    this.erro = null
    this.maximo = opcoes.maximoSegundos ?? 300

    if (!this.suportado()) {
      this.estado = 'erro'
      this.erro = 'Este navegador não grava áudio.'
      return false
    }

    this.estado = 'preparando'
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // O cancelamento de eco e o de ruído fazem diferença enorme quando
          // o celular está apoiado na mesa ao lado do violão.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (e) {
      this.estado = 'erro'
      const nome = e instanceof DOMException ? e.name : ''
      this.erro =
        nome === 'NotAllowedError'
          ? 'Permissão de microfone negada.'
          : nome === 'NotFoundError'
            ? 'Nenhum microfone encontrado.'
            : 'Não foi possível acessar o microfone.'
      return false
    }

    const formatos = Gravador.formatos()
    this.recorder = new MediaRecorder(this.stream, formatos.length ? { mimeType: formatos[0] } : undefined)
    this.pedacos = []
    this.recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) this.pedacos.push(ev.data)
    }
    this.recorder.start(250)
    this.inicio = performance.now()
    this.estado = 'gravando'

    if (opcoes.aoMedir) this.medir(opcoes.aoMedir)
    return true
  }

  /** Medidor de nível, para o desenho do medidor na interface. */
  private medir(aoMedir: (nivel: number) => void): void {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC || !this.stream) return
      this.contexto = new AC()
      const origem = this.contexto.createMediaStreamSource(this.stream)
      this.analisador = this.contexto.createAnalyser()
      this.analisador.fftSize = 256
      origem.connect(this.analisador)

      const dados = new Uint8Array(this.analisador.frequencyBinCount)
      const laco = () => {
        if (!this.analisador || !this.gravando) return
        this.analisador.getByteFrequencyData(dados)
        let soma = 0
        for (let i = 0; i < dados.length; i++) soma += dados[i]
        aoMedir(Math.min(1, soma / dados.length / 128))
        this.animacao = requestAnimationFrame(laco)
      }
      laco()
    } catch {
      // Sem medidor a gravação continua funcionando; só falta o desenho.
    }
  }

  segundos(): number {
    return this.gravando ? (performance.now() - this.inicio) / 1000 : 0
  }

  /** Para e devolve a gravação salva, ou null se ficou vazia. */
  async parar(): Promise<string | null> {
    const rec = this.recorder
    if (!rec || !this.gravando) return null

    return new Promise<string | null>((resolve) => {
      rec.onstop = async () => {
        const duracao = (performance.now() - this.inicio) / 1000
        this.limpar()

        const tipo = rec.mimeType || 'audio/webm'
        const blob = new Blob(this.pedacos, { type: tipo })
        this.pedacos = []

        if (blob.size < 512) {
          this.estado = 'inativo'
          resolve(null)
          return
        }
        try {
          const id = await salvarGravacao(blob, duracao)
          this.estado = 'parado'
          resolve(id)
        } catch (e) {
          this.estado = 'erro'
          this.erro = e instanceof Error ? e.message : 'Falha ao salvar a gravação.'
          resolve(null)
        }
      }

      // Precisa de tempo para o último pedaço chegar antes de fechar.
      setTimeout(() => {
        if (rec.state !== 'inactive') rec.stop()
        if ((performance.now() - this.inicio) / 1000 >= this.maximo) this.parar()
      }, 300)
    })
  }

  /** Descarta a gravação em andamento e libera o microfone. */
  cancelar(): void {
    const rec = this.recorder
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null
      rec.stop()
    }
    this.pedacos = []
    this.limpar()
    this.estado = 'inativo'
  }

  private limpar(): void {
    if (this.animacao !== null) {
      cancelAnimationFrame(this.animacao)
      this.animacao = null
    }
    this.analisador = null
    if (this.contexto) {
      void this.contexto.close().catch(() => undefined)
      this.contexto = null
    }
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.recorder = null
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  Reprodução
// ─────────────────────────────────────────────────────────────────────────

/** Objeto de URL do blob, para tocar no <audio>. */
export async function urlDaGravacao(id: string): Promise<string | null> {
  const g = await lerGravacao(id)
  if (!g) return null
  return URL.createObjectURL(g.blob)
}

export function duracaoFormatada(segundos: number): string {
  const s = Math.max(0, Math.round(segundos))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
