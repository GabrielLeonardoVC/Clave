/**
 * helpers — funções de formatação usadas por várias telas.
 */

import { parseCifra } from './music/smartParser'
import { detectKey } from './music/keyDetection'

/**
 * Nome do tom detectado numa cifra, para sugerir no formulário.
 * Devolve string vazio quando não há acorde nenhum, porque aí não há tom a
 * sugerir e preencher o campo seria inventar.
 */
export function detectarTom(cifra: string): string {
  if (!cifra.trim()) return ''
  const chave = detectKey(parseCifra(cifra))
  return chave.source === 'vazio' ? '' : chave.name
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function formatarData(iso: string): string {
  const partes = iso.split('-')
  if (partes.length !== 3) return iso
  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

export function formatarDataExtenso(iso: string): string {
  const partes = iso.split('-')
  if (partes.length !== 3) return iso
  const [, m, d] = partes
  const indice = Number(m) - 1
  if (indice < 0 || indice > 11) return iso
  return `${Number(d)} de ${MESES[indice]}`
}

export function nomeDoDia(iso: string): string {
  const partes = iso.split('-')
  if (partes.length !== 3) return ''
  const data = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]))
  const indice = data.getDay()
  return indice >= 0 && indice < 7 ? DIAS[indice] : ''
}

export function diaCurto(iso: string): string {
  const partes = iso.split('-')
  if (partes.length !== 3) return ''
  const data = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]))
  const indice = data.getDay()
  return indice >= 0 && indice < 7 ? DIAS_CURTOS[indice] : ''
}

export function nomeDoMes(indice: number): string {
  return MESES[indice] ?? ''
}

/** "há 3 dias", "hoje", "em 5 dias". */
export function distanciaRelativa(iso: string, hoje: string): string {
  const alvo = paraDataLocal(iso)
  const base = paraDataLocal(hoje)
  if (!alvo || !base) return iso

  const dias = Math.round((alvo.getTime() - base.getTime()) / 86400000)
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  if (dias === -1) return 'ontem'
  if (dias > 0) return `em ${dias} dias`
  return `há ${Math.abs(dias)} dias`
}

/** 1.234,5 KB, 3,2 MB. */
export function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0).replace('.', ',')} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

export function formatarDuracao(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function paraDataLocal(iso: string): Date | null {
  const partes = iso.split('-')
  if (partes.length !== 3) return null
  const data = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]))
  return Number.isNaN(data.getTime()) ? null : data
}

/** Remove acentos e espaços extras, para comparar nomes. */
export function simplificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}
