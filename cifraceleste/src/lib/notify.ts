/**
 * notify — lembretes de missa, ensaio e show.
 *
 * O pedido é horário exato (horas e minutos), não "daqui a 2 horas". Então o
 * cálculo parte da data e da hora do evento, subtrai o deslocamento escolhido,
 * e dispara naquele instante.
 *
 * Como o app é offline, não existe servidor para empurrar a notificação. O
 * agendamento roda enquanto o app estiver aberto, e cada lembrete só dispara
 * uma vez por sessão, guardado no sessionStorage — recarregar a página não
 * gera uma chuva de avisos.
 */

import { eventosFuturos, obterEstado, paraData, type Evento } from './store'

const MARCA = 'cifraceleste_lembrete_'
const CHAVE_PERMISSAO = 'cifraceleste_notificou'

export function suportaNotificacao(): boolean {
  return typeof Notification !== 'undefined'
}

export function permissao(): 'default' | 'granted' | 'denied' | 'unsupported' {
  if (!suportaNotificacao()) return 'unsupported'
  return Notification.permission
}

export async function pedirPermissao(): Promise<boolean> {
  if (!suportaNotificacao()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const resultado = await Notification.requestPermission()
    return resultado === 'granted'
  } catch {
    return false
  }
}

/** Quando este evento deve gerar aviso, em ms desde agora. 0 = nunca. */
export function atrasoDoLembrete(evento: Evento, agora = Date.now()): number {
  if (!evento.lembrete?.ativo) return 0

  const comecar = paraData(evento.data, evento.hora)
  if (!comecar) return 0

  const deslocamento = (evento.lembrete.horas * 60 + evento.lembrete.minutos) * 60000
  const alvo = comecar.getTime() - deslocamento
  const falta = alvo - agora

  // Só interessa o que está no futuro e dentro de uma semana. Aviso de
  // coisa do mês que vem não ajuda ninguém.
  if (falta < 0 || falta > 7 * 24 * 3600 * 1000) return 0
  return falta
}

function tituloDoAviso(evento: Evento): string {
  const prefixo = evento.tipo === 'ensaio' ? 'Ensaio' : evento.tipo === 'show' ? 'Show' : 'Missa'
  return `${prefixo}: ${evento.titulo}`
}

function corpoDoAviso(evento: Evento): string {
  const linhas: string[] = []
  const quando = `${formatarData(evento.data)} às ${evento.hora}`
  linhas.push(quando)
  if (evento.local) linhas.push(evento.local)
  if (evento.musicas.length) {
    linhas.push('')
    evento.musicas.slice(0, 4).forEach((m) => linhas.push(`• ${m.titulo}`))
    if (evento.musicas.length > 4) linhas.push(`+${evento.musicas.length - 4} outras`)
  }
  return linhas.join('\n')
}

function formatarData(iso: string): string {
  const [a, m, d] = iso.split('-')
  if (!a || !m || !d) return iso
  return `${d}/${m}/${a}`
}

function mostrarAviso(evento: Evento): void {
  if (permissao() !== 'granted') return
  try {
    const aviso = new Notification(tituloDoAviso(evento), {
      body: corpoDoAviso(evento),
      tag: evento.id,
      icon: '/icon.svg',
      badge: '/icon.svg',
    })
    aviso.onclick = () => {
      try {
        window.focus()
      } catch {
        /* alguns navegadores bloqueiam o foco; o app já está aberto */
      }
      window.location.hash = `#/agenda?data=${evento.data}&abrir=${evento.id}`
      aviso.close()
    }
  } catch {
    // Alguns navegadores exigem Service Worker para notificação no desktop.
    // Sem registro, seguir sem aviso é melhor do que quebrar o agendador.
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  Agendador
// ─────────────────────────────────────────────────────────────────────────

let temporizadores: number[] = []
let rodando = false

function jaDisparou(id: string): boolean {
  try {
    return sessionStorage.getItem(MARCA + id) === '1'
  } catch {
    return false
  }
}

function marcarDisparado(id: string): void {
  try {
    sessionStorage.setItem(MARCA + id, '1')
  } catch {
    /* sessão sem storage: o aviso pode repetir, o que é preferível a falhar */
  }
}

/** Limpa as marcas da sessão, para o usuário poder reexecutar os testes. */
export function limparMarcas(): void {
  try {
    const chaves: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(MARCA)) chaves.push(k)
    }
    chaves.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    /* sem storage não há o que limpar */
  }
}

function agendar(): void {
  pararAgendador()

  if (permissao() !== 'granted' || !obterEstado().ajustes.notificacoes) return

  for (const evento of eventosFuturos()) {
    if (jaDisparou(evento.id)) continue
    const atraso = atrasoDoLembrete(evento)
    if (atraso <= 0) continue

    // setTimeout tem limite de ~24 dias em alguns navegadores; como só
    // agendamos até 7 dias, cabe com folga.
    const id = window.setTimeout(() => {
      marcarDisparado(evento.id)
      mostrarAviso(evento)
    }, atraso)
    temporizadores.push(id)
  }
}

export function iniciarAgendador(): void {
  if (rodando) return
  rodando = true
  agendar()
}

export function pararAgendador(): void {
  temporizadores.forEach((id) => clearTimeout(id))
  temporizadores = []
  rodando = false
}

/** Reagenda do zero. Chamar depois de qualquer mudança em evento ou ajuste. */
export function reagendar(): void {
  if (rodando) agendar()
}

export function avisosPendentes(): Array<{ evento: Evento; em: number }> {
  return eventosFuturos()
    .filter((e) => !jaDisparou(e.id))
    .map((e) => ({ evento: e, em: atrasoDoLembrete(e) }))
    .filter((x) => x.em > 0)
    .sort((a, b) => a.em - b.em)
}

/** Envia um aviso de teste, para o usuário conferir a permissão. */
export function testarAviso(): void {
  if (permissao() !== 'granted') {
    void pedirPermissao().then((ok) => {
      if (!ok) return
      testarAviso()
    })
    return
  }
  try {
    new Notification('CifraCeleste', {
      body: 'Se você viu isto, os lembretes de missa e ensaio vão funcionar.',
      icon: '/icon.svg',
      tag: 'teste',
    })
  } catch {
    /* sem suporte a notificação sem Service Worker */
  }
}

/** A chave de permissão no localStorage evita pedir duas vezes no mesmo dia. */
export function jaPediuPermissao(): boolean {
  try {
    return localStorage.getItem(CHAVE_PERMISSAO) === '1'
  } catch {
    return false
  }
}

export function registrarPedidoDePermissao(): void {
  try {
    localStorage.setItem(CHAVE_PERMISSAO, '1')
  } catch {
    /* ignorado */
  }
}
