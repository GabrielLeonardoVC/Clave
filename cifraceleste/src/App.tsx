/**
 * App — casca do aplicativo: tema, navegação e composição das telas.
 */

import { useCallback, useEffect } from 'react'
import { BookOpen, CalendarDays, Library, Settings, Sun } from 'lucide-react'

import { inicializar, seletorAjustes, seletorMostrarEmergencia, useStore } from '@/lib/store'
import { registrarServiceWorker } from '@/lib/pwa'
import { navegarPara, useRota, type Tela } from '@/lib/router'
import { iniciarAgendador, pararAgendador, reagendar } from '@/lib/notify'
import { useMediaQuery } from '@/lib/useDebounce'
import { EmergencyPanel } from '@/components/EmergencyPanel'
import { PaginaHoje } from '@/pages/PaginaHoje'
import { PaginaMissas } from '@/pages/PaginaMissas'
import { PaginaRepertorio } from '@/pages/PaginaRepertorio'
import { PaginaTeoria } from '@/pages/PaginaTeoria'
import { PaginaAjustes } from '@/pages/PaginaAjustes'

const NAVEGACAO: Array<{ id: Tela; rotulo: string; icone: typeof Sun }> = [
  { id: 'hoje', rotulo: 'Hoje', icone: Sun },
  { id: 'missas', rotulo: 'Missas', icone: CalendarDays },
  { id: 'repertorio', rotulo: 'Repertório', icone: Library },
  { id: 'teoria', rotulo: 'Teoria', icone: BookOpen },
  { id: 'ajustes', rotulo: 'Ajustes', icone: Settings },
]

export function App() {
  const rota = useRota()
  const ajustes = useStore(seletorAjustes)
  const mostrarEmergencia = useStore(seletorMostrarEmergencia)

  useEffect(() => {
    inicializar()
  }, [])

  // ── Tema ────────────────────────────────────────────────────────────────
  // O atributo `dark` já foi aplicado antes do primeiro desenho pelo script do
  // index.html. Aqui só sincronizamos quando o usuário muda a preferência.
  const sistemaEscuro = useMediaQuery('(prefers-color-scheme: dark)')
  const escuro = ajustes.tema === 'dark' || (ajustes.tema === 'system' && sistemaEscuro)

  useEffect(() => {
    const raiz = document.documentElement
    raiz.classList.toggle('dark', escuro)
    raiz.style.colorScheme = escuro ? 'dark' : 'light'
    raiz.dataset.accent = ajustes.accent
    raiz.dataset.themePref = ajustes.tema

    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', escuro ? '#14171C' : '#FAF9F7')

    // A transição só entra depois de aplicada a classe, senão o navegador
    // pinta o tema novo uma vez sem transição e outra com.
    const temporizador = setTimeout(() => {
      raiz.classList.add('theme-transition')
    }, 30)
    return () => {
      clearTimeout(temporizador)
      raiz.classList.remove('theme-transition')
    }
  }, [escuro, ajustes.accent, ajustes.tema])

  useEffect(() => {
    document.documentElement.style.fontSize = `${Math.round(ajustes.tamanhoTexto * 100)}%`
  }, [ajustes.tamanhoTexto])

  // Service worker: só faz sentido em https ou em localhost. Sob `file://` a
  // API não existe, e tentar registrar só produz um erro no console.
  useEffect(() => {
    registrarServiceWorker()
  }, [])

  // ── Lembretes ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (ajustes.notificacoes) iniciarAgendador()
    else pararAgendador()
    return () => pararAgendador()
  }, [ajustes.notificacoes, ajustes])

  useEffect(() => {
    if (ajustes.notificacoes) reagendar()
  }, [ajustes.notificacoes])

  const aoAbrirCifra = useCallback((id: string) => {
    navegarPara('repertorio', { abrir: id })
  }, [])

  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:rounded-lg focus:bg-brand-500 focus:px-3 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <main id="conteudo" className="mx-auto w-full max-w-2xl px-4">
        {/*
          A troca de tela anima por CSS, não por biblioteca.

          A animação de biblioteca depende do ciclo de medição do navegador
          para descobrir quando "começou" — e se ela não rodar, o elemento
          fica em `opacity: 0` para sempre, com a tela inteira invisível.
          Foi exatamente o que aconteceu com o `AnimatePresence`.

          Uma animação de CSS declarada aqui roda na primeira pintura,
          sem depender de nada, e some sozinha ao terminar. O mesmo vale
          para a animação de entrada do conteúdo.
        */}
        <div key={rota.nome} className="tela-entra">
          {rota.nome === 'hoje' && <PaginaHoje />}
          {rota.nome === 'missas' && <PaginaMissas />}
          {rota.nome === 'repertorio' && <PaginaRepertorio />}
          {rota.nome === 'teoria' && <PaginaTeoria />}
          {rota.nome === 'ajustes' && <PaginaAjustes />}
        </div>
      </main>

      {mostrarEmergencia && <EmergencyPanel aoAbrirCifra={aoAbrirCifra} />}

      <nav
        className="fixed inset-x-0 bottom-0 z-[60] border-t border-app-line bg-app-surface/92 backdrop-blur-md"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navegação principal"
      >
        <ul className="mx-auto flex max-w-2xl">
          {NAVEGACAO.map((item) => {
            const Icone = item.icone
            const ativo = rota.nome === item.id
            return (
              <li key={item.id} className="flex-1">
                <button
                  type="button"
                  onClick={() => navegarPara(item.id)}
                  aria-current={ativo ? 'page' : undefined}
                  className="relative flex w-full flex-col items-center gap-0.5 py-2.5 transition-colors"
                >
                  <span
                    className={[
                      'absolute top-0 h-0.5 w-8 rounded-full transition-colors',
                      ativo ? 'bg-brand-500' : 'bg-transparent',
                    ].join(' ')}
                  />
                  <Icone
                    size={21}
                    className={ativo ? 'text-brand-500' : 'text-app-ink-3'}
                    strokeWidth={ativo ? 2.4 : 1.8}
                  />
                  <span
                    className={[
                      'text-[10px] font-bold',
                      ativo ? 'text-brand-500' : 'text-app-ink-3',
                    ].join(' ')}
                  >
                    {item.rotulo}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
