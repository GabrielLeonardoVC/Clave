/**
 * emergencia — abre o painel flutuante de qualquer tela.
 *
 * O botão vive no `App`, mas precisa ser acionável de páginas diferentes:
 * o atalho em Hoje, a busca dentro de uma cifra, o atalho de emergência.
 *
 * Um evento global resolveria, mas `dispatchEvent` sem ninguém escutando é
 * botão morto: o clique não produz efeito nenhum e o defeito só aparece ao
 * usar. Um controlador exposto deixa a falha visível na hora da digitação —
 * se o nome mudar, o compilador reclama.
 */

import { useSyncExternalStore } from 'react'

type Abertura = { origem: string } | null

let pedidoAbertura: Abertura = null
let aberto = false
const ouvintes = new Set<() => void>()

function avisar(): void {
  for (const o of [...ouvintes]) o()
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/** Abre o painel. `origem` serve só para depuração. */
export function abrirEmergencia(origem = 'desconhecida'): void {
  pedidoAbertura = { origem }
  if (!aberto) {
    aberto = true
    avisar()
  }
}

export function fecharEmergencia(): void {
  if (!aberto) return
  aberto = false
  pedidoAbertura = null
  avisar()
}

export function alternarEmergencia(origem?: string): void {
  if (aberto) fecharEmergencia()
  else abrirEmergencia(origem)
}

export const emergenciaAberta = (): boolean => aberto

/**
 * Leitura para o `EmergencyPanel`.
 *
 * Devolve apenas o booleano, que é estável, e o pedido fica num getter
 * separado. Devolver o objeto do pedido faria o `getSnapshot` devolver uma
 * referência nova a cada leitura, e o React entraria em laço de renderização.
 */
export function useEmergenciaAberta(): boolean {
  return useSyncExternalStore(assinar, emergenciaAberta, () => false)
}

/** O que deu origem à última abertura, para o painel escolher a aba certa. */
export function ultimaOrigem(): string | null {
  return pedidoAbertura?.origem ?? null
}
