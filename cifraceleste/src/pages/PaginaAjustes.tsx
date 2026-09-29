/**
 * PaginaAjustes — aparência, lembretes, áudio e dados.
 */

import { useRef, useState } from 'react'
import { Database, Download, Palette, Trash2, Upload, Bell, Volume2 } from 'lucide-react'

import {
  apagarTudo,
  definirAjuste,
  exportarBackup,
  importarBackup,
  obterEstado,
  tamanhoArmazenado,
  seletorAjustes,
  useStore,
} from '@/lib/store'
import { formatarBytes } from '@/lib/helpers'
import { pedirPermissao, permissao, testarAviso } from '@/lib/notify'
import { ehAplicativo, ehIos, instalar, instalacaoDisponivel } from '@/lib/pwa'
import { PainelMetronomo } from '@/components/AudioTools'
import { LinhaInterruptor, useAviso, useConfirmacao } from '@/components/ui'

export function PaginaAjustes() {
  const { avisar } = useAviso()
  const { confirmar } = useConfirmacao()
  const ajustes = useStore(seletorAjustes)
  const [metro, setMetro] = useState(false)
  const arquivoRef = useRef<HTMLInputElement>(null)

  const espaco = tamanhoArmazenado()
  const permissaoAtual = permissao()

  const exportar = () => {
    const json = exportarBackup()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cifraceleste-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    avisar('Backup salvo.', 'ok')
  }

  const importar = (arquivo: File) => {
    const leitor = new FileReader()
    leitor.onload = () => {
      try {
        const r = importarBackup(String(leitor.result))
        avisar(`Restaurado: ${r.cifras} cifras e ${r.eventos} eventos.`, 'ok')
      } catch (e) {
        avisar(e instanceof Error ? e.message : 'Arquivo inválido.', 'erro')
      }
    }
    leitor.onerror = () => avisar('Não consegui ler o arquivo.', 'erro')
    leitor.readAsText(arquivo)
  }

  return (
    <div className="pb-24">
      <header className="mb-4 pt-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-app-ink">Ajustes</h1>
        <p className="text-sm text-app-ink-3">Do jeito que fica melhor para você</p>
      </header>

      {/* ── Aparência ── */}
      <section className="mb-6">
        <h2 className="mb-2 flex items-center gap-2 text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">
          <Palette size={13} /> Aparência
        </h2>
        <div className="surface p-4">
          <span className="label">Tema</span>
          <div className="mb-4 flex gap-1.5">
            {(
              [
                ['system', 'Automático'],
                ['light', 'Claro'],
                ['dark', 'Escuro'],
              ] as const
            ).map(([v, n]) => (
              <button
                key={v}
                type="button"
                className="chip flex-1 justify-center"
                data-active={ajustes.tema === v}
                onClick={() => definirAjuste('tema', v)}
              >
                {n}
              </button>
            ))}
          </div>

          <span className="label">Cor de destaque</span>
          <div className="mb-4 flex gap-2">
            {(
              [
                ['royal', 'Azul'],
                ['amber', 'Âmbar'],
              ] as const
            ).map(([v, n]) => (
              <button
                key={v}
                type="button"
                className="chip flex-1 justify-center"
                data-active={ajustes.accent === v}
                onClick={() => definirAjuste('accent', v)}
              >
                {n}
              </button>
            ))}
          </div>

          <span className="label">Tamanho do texto</span>
          <input
            type="range"
            min={0.85}
            max={1.4}
            step={0.05}
            value={ajustes.tamanhoTexto}
            onChange={(e) => definirAjuste('tamanhoTexto', Number(e.target.value))}
            className="h-1.5 w-full accent-[rgb(var(--c-primary))]"
            aria-label="Tamanho do texto da interface"
          />
          <div className="mt-1 flex justify-between text-[10px] text-app-ink-3">
            <span>Pequeno</span>
            <span>Grande</span>
          </div>
        </div>
      </section>

      {/* ── Cifra ── */}
      <section className="mb-6">
        <h2 className="mb-2 text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">Cifra</h2>
        <div className="surface p-4">
          <span className="label">Notação das notas</span>
          <div className="flex gap-1.5">
            {(
              [
                ['auto', 'Automática'],
                ['sharp', 'Sempre #'],
                ['flat', 'Sempre bemol'],
              ] as const
            ).map(([v, n]) => (
              <button
                key={v}
                type="button"
                className="chip flex-1 justify-center"
                data-active={ajustes.grafia === v}
                onClick={() => definirAjuste('grafia', v)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Áudio ── */}
      <section className="mb-6">
        <h2 className="mb-2 flex items-center gap-2 text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">
          <Volume2 size={13} /> Áudio
        </h2>
        <button type="button" onClick={() => setMetro(true)} className="btn-outline w-full">
          Abrir metrônomo
        </button>
        {metro && (
          <div className="surface mt-2 p-4">
            <PainelMetronomo
              bpmInicial={ajustes.metronomo.bpm}
            />
          </div>
        )}
      </section>

      {/* ── Lembretes ── */}
      <section className="mb-6">
        <h2 className="mb-2 flex items-center gap-2 text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">
          <Bell size={13} /> Lembretes
        </h2>
        <div className="surface px-4 py-1">
          <LinhaInterruptor
            titulo="Avisar de missas e ensaios"
            descricao={
              permissaoAtual === 'granted'
                ? 'Permissão concedida ao navegador.'
                : 'O navegador vai pedir autorização.'
            }
            ligado={ajustes.notificacoes}
            aoMudar={(v) => {
              definirAjuste('notificacoes', v)
              if (v) {
                void pedirPermissao().then((ok) => {
                  if (ok) {
                    avisar('Lembretes ativados.', 'ok')
                    testarAviso()
                  } else {
                    avisar('Permissão negada. Libere nas configurações do navegador.', 'erro')
                  }
                })
              }
            }}
          />
        </div>
        {permissaoAtual === 'denied' && (
          <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-app-ink-2">
            A permissão está bloqueada. Libere nas configurações do site, no seu navegador.
          </p>
        )}
      </section>

      {/* ── Dados ── */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">
          <Database size={13} /> Dados
        </h2>
        <div className="surface p-4">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-app-ink-2">Espaço usado</span>
            <span className="font-mono font-bold text-app-ink">{formatarBytes(espaco.bytes)}</span>
          </div>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-app-raised">
            <div
              className={[
                'h-full rounded-full transition-all',
                espaco.pct > 85 ? 'bg-danger-500' : espaco.pct > 70 ? 'bg-amber-500' : 'bg-brand-500',
              ].join(' ')}
              style={{ width: `${Math.min(100, espaco.pct)}%` }}
            />
          </div>
          <p className="mb-3 text-xs text-app-ink-3">
            {obterEstado().cifras.length} cifras e {obterEstado().eventos.length} eventos salvos neste aparelho. Nada é
            enviado para servidor nenhum.
          </p>

          <div className="flex flex-col gap-2">
            <button type="button" onClick={exportar} className="btn-outline w-full">
              <Download size={16} /> Fazer backup
            </button>
            <button type="button" onClick={() => arquivoRef.current?.click()} className="btn-outline w-full">
              <Upload size={16} /> Restaurar backup
            </button>
            <input
              ref={arquivoRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0]
                if (arquivo) importar(arquivo)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={async () => {
                const ok = await confirmar({
                  titulo: 'Apagar tudo',
                  mensagem:
                    'Isso apaga todas as cifras, missas e preferências deste aparelho. Não dá para desfazer.',
                  rotuloOk: 'Apagar tudo',
                  perigoso: true,
                })
                if (ok) {
                  apagarTudo()
                  avisar('Dados apagados.', 'ok')
                }
              }}
              className="btn-danger w-full"
            >
              <Trash2 size={16} /> Apagar tudo
            </button>
          </div>
        </div>
      </section>

      {/* ── Aplicativo ── */}
      <section className="mb-6">
        <h2 className="mb-2 flex items-center gap-2 text-[11px] font-extrabold tracking-widest text-app-ink-3 uppercase">
          <Download size={13} /> Aplicativo
        </h2>
        <div className="surface p-4">
          {ehAplicativo() ? (
            <p className="text-sm text-app-ink-2">
              O CifraCeleste já está instalado neste aparelho e funciona sem internet.
            </p>
          ) : instalacaoDisponivel() ? (
            <button
              type="button"
              onClick={() => {
                void instalar().then((ok) => {
                  if (ok) avisar('Instalado. Dá para abrir pela tela inicial.', 'ok')
                })
              }}
              className="btn-primary w-full"
            >
              <Download size={16} /> Instalar no aparelho
            </button>
          ) : (
            <div>
              <p className="mb-2 text-sm text-app-ink-2">
                Para instalar: no Android, use o menu do navegador e escolha
                &ldquo;Adicionar à tela inicial&rdquo;. No iPhone, toque em compartilhar e depois em
                &ldquo;Adicionar à Tela de Início&rdquo;.
              </p>
              {ehIos() && (
                <p className="text-xs text-app-ink-3">
                  O Safari do iPhone não oferece instalação automática, mas o atalho funciona
                  como um aplicativo e abre sem internet.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-app-ink-3">
        CifraCeleste · funciona offline · seus dados ficam no aparelho
      </p>
    </div>
  )
}
