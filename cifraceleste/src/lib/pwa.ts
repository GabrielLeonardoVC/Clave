/**
 * pwa — instalação como aplicativo e funcionamento sem internet.
 */

/** O service worker exige um contexto seguro; `file://` não serve. */
export function contextoSeguro(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

export function registrado(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

let registrando = false

/**
 * Registra o service worker.
 *
 * Falha silenciosa de propósito: sem service worker o aplicativo continua
 * funcionando, só perde o funcionamento offline. Um erro no console aqui
 * seria ruído para o usuário, não um problema que ele possa resolver.
 */
export function registrarServiceWorker(): void {
  if (registrando) return
  if (!registrado() || !contextoSeguro()) return

  registrando = true

  const registrar = () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      registrando = false
    })
  }

  // Esperar o `load` era para não competir com os recursos iniciais. Só que
  // o bundle é pequeno e monta antes da janela carregar: quando o React chega
  // aqui, o `load` já passou, o listener nunca dispara e o app perde o
  // funcionamento offline inteiro — justamente o que este app promete.
  // Consultando o estado, o registro acontece nos dois casos.
  if (document.readyState === 'complete') registrar()
  else window.addEventListener('load', registrar, { once: true })
}

export interface PromptInstalacao extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let promptAdiado: PromptInstalacao | null = null

/** Convite de instalação disponível, para a interface reagir. */
let podeInst = false
const ouvintes = new Set<() => void>()

function avisar(): void {
  for (const o of [...ouvintes]) o()
}

/**
 * Captura o convite de instalação do navegador.
 *
 * O Android dispara `beforeinstallprompt` e dá para convidar o usuário a
 * instalar com um botão. O iOS não dispara nada: ele só mostra o botão de
 * compartilhamento do Safari, e o caminho é outro. Por isso o estado é
 * consultado por função, e não por evento: quem quiser mostrar um convite
 * pergunta, e não fica esperando um aviso que talvez nunca venha.
 */
export function escutarInstalacao(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault()
    promptAdiado = evento as PromptInstalacao
    podeInst = true
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    promptAdiado = null
    podeInst = false
    avisar()
  })
}

/** Assina mudanças na disponibilidade do convite de instalação. */
export function assinarInstalacao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function podeInstalar(): boolean {
  return promptAdiado !== null
}

/** Instalar só faz sentido quando o navegador ofrecceu o convite. */
export const instalacaoDisponivel = (): boolean => podeInst

export function ehIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS 13+ se apresenta como Mac; o teste do número de toques separa.
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1)
  )
}

export function ehAplicativo(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
}

/** Abre o convite de instalação. Devolve false se não houver convite. */
export async function instalar(): Promise<boolean> {
  if (!promptAdiado) return false
  await promptAdiado.prompt()
  const escolha = await promptAdiado.userChoice
  if (escolha.outcome === 'accepted') promptAdiado = null
  return escolha.outcome === 'accepted'
}
