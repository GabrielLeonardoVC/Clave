/**
 * router — navegação por hash.
 *
 * Hash em vez de History API porque o aplicativo precisa abrir direto de um
 * arquivo aberto no disco, sem servidor. `file://` não aceita History API, e
 * o CifraCeleste tem que funcionar tanto no celular, instalado, quanto com dois
 * cliques no explorador de arquivos.
 */

import { useEffect, useSyncExternalStore } from 'react'

export interface Rota {
  /** Nome da tela, sem o "#/". */
  nome: string
  /** Parâmetros da query, já decodificados. */
  params: Record<string, string>
}

const TELAS = ['hoje', 'missas', 'repertorio', 'teoria', 'ajustes'] as const
export type Tela = (typeof TELAS)[number]

export const telasValidas = (nome: string): nome is Tela => (TELAS as readonly string[]).includes(nome)

/** #/missas?data=2026-10-01&abrir=evt_1 -> { nome: 'missas', params: {...} } */
export function lerHash(hash: string): Rota {
  const limpo = hash.replace(/^#\/?/, '')
  if (!limpo) return { nome: 'hoje', params: {} }

  const [caminho, query] = limpo.split('?')
  const params: Record<string, string> = {}

  if (query) {
    for (const par of query.split('&')) {
      if (!par) continue
      const igual = par.indexOf('=')
      const chave = igual >= 0 ? par.slice(0, igual) : par
      const valor = igual >= 0 ? par.slice(igual + 1) : ''
      try {
        params[decodeURIComponent(chave)] = decodeURIComponent(valor.replace(/\+/g, ' '))
      } catch {
        // Parâmetro malformado não pode derrubar a navegação.
        params[chave] = valor
      }
    }
  }

  return { nome: telasValidas(caminho) ? caminho : 'hoje', params }
}

const montantes = new Set<() => void>()

function avisar(): void {
  for (const m of [...montantes]) m()
}

/** Aplica a mudança de hash sem recarregar a página. */
export function navegarPara(nome: string, params: Record<string, string> = {}): void {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const alvo = `#/${nome}${query ? `?${query}` : ''}`
  if (window.location.hash === alvo) {
    avisar()
    return
  }
  window.location.hash = alvo
}

/**
 * Última rota montada, memorizada pelo hash de origem.
 *
 * Isto não é micro-otimização: `useSyncExternalStore` exige que
 * `getSnapshot` devolva a MESMA referência enquanto o estado não muda. Sem a
 * memorização, toda leitura devolvia um objeto novo, o React achava que o
 * estado tinha mudado a cada leitura e reentrava no laço de atualização até
 * estourar o limite de aninhamento — o app inteiro não renderizava.
 */
let hashMemorizado = ''
let rotaMemorizada: Rota = { nome: 'hoje', params: {} }

function rotaAtual(): Rota {
  const hash = typeof window === 'undefined' ? '' : window.location.hash
  if (hash !== hashMemorizado) {
    hashMemorizado = hash
    rotaMemorizada = lerHash(hash)
  }
  return rotaMemorizada
}

/**
 * Assinatura estável: a mesma referência em todas as renderizações.
 *
 * O listener do navegador é registrado uma única vez, para o conjunto todo.
 * Se cada assinante adicionasse o seu, o DOM deduplicaria a função e a
 * remoção de uma tela tiraria a notificação das outras.
 */
let escutando = false

/**
 * Assinatura estável, e o listener do navegador registrado uma vez só.
 *
 * Se cada assinante adicionasse o seu, o DOM deduplicaria a função — e a
 * remoção de uma tela tiraria a notificação das outras. Por isso o registro
 * é contabilizado aqui, e não por assinante.
 */
function assinarRota(ouvinte: () => void): () => void {
  montantes.add(ouvinte)

  if (!escutando && typeof window !== 'undefined') {
    escutando = true
    window.addEventListener('hashchange', aoMudarHash)
    // O botão voltar do navegador e o `history.replaceState` não disparam
    // `hashchange` de forma confiável, e o `popstate` cobre os dois.
    window.addEventListener('popstate', aoMudarHash)
  }

  return () => {
    montantes.delete(ouvinte)
    if (montantes.size === 0 && escutando && typeof window !== 'undefined') {
      escutando = false
      window.removeEventListener('hashchange', aoMudarHash)
      window.removeEventListener('popstate', aoMudarHash)
    }
  }
}

function aoMudarHash(): void {
  // Limpa a memoização antes de avisar: o React vai pedir a rota logo em
  // seguida, e o cache precisa refletir o hash novo.
  hashMemorizado = '__invalido__'
  avisar()
}

/** Rota para a renderização no servidor, onde não há `window`. */
const rotaServidor: Rota = { nome: 'hoje', params: {} }

export function useRota(): Rota {
  return useSyncExternalStore(assinarRota, rotaAtual, () => rotaServidor)
}

/** Rola para o topo a cada troca de tela. */
export function useRolarAoTrocarTela(nome: string): void {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [nome])
}
