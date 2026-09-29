/**
 * hooks — utilitários de React compartilhados.
 */

import { useEffect, useRef, useState } from 'react'

/**
 * Adia a propagação de um valor até que ele pare de mudar.
 *
 * É o que segura a busca: sem isso, cada tecla dispara a varredura de todo o
 * repertório, e o resultado chega fora de ordem.
 */
export function useDebounce<T>(valor: T, atrasoMs = 200): T {
  const [atrasado, setAtrasado] = useState(valor)

  useEffect(() => {
    if (atrasado === valor) return
    const temporizador = setTimeout(() => setAtrasado(valor), atrasoMs)
    return () => clearTimeout(temporizador)
  }, [valor, atrasoMs, atrasado])

  return atrasado
}

/** Detecta uma media query e reage à mudança. */
export function useMediaQuery(consulta: string): boolean {
  const [combina, setCombina] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(consulta).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(consulta)
    const aoMudar = () => setCombina(mq.matches)
    aoMudar()
    if (mq.addEventListener) mq.addEventListener('change', aoMudar)
    else if (mq.addListener) mq.addListener(aoMudar)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', aoMudar)
      else if (mq.removeListener) mq.removeListener(aoMudar)
    }
  }, [consulta])

  return combina
}

/**
 * Callback que nunca fica obsoleto.
 * Útil para listas grandes, em que trocar a função a cada renderização
 * remontaria todos os itens.
 */
export function useCallbackEstavel<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  return ref.current as unknown as T
}
