/**
 * PaginaRepertorio — a biblioteca de cifras.
 */

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Music, Plus, Search, X } from 'lucide-react'

import { atualizarCifra, criarCifra, removerCifra, seletorCifras, useStore, type Cifra } from '@/lib/store'
import { search, warmSearchIndex } from '@/lib/searchLogic'
import { detectarTom } from '@/lib/helpers'
import { useDebounce } from '@/lib/useDebounce'
import { useRota } from '@/lib/router'
import { SongView } from '@/components/SongView'
import { EstadoVazio, Folha, useAviso, useConfirmacao } from '@/components/ui'

/** Cifras que vêm prontas, como referência. Todas editáveis. */
const CIFRAS_BASE: ReadonlyArray<Pick<Cifra, 'titulo' | 'artista' | 'tom' | 'categoria' | 'tags' | 'cifra'>> = [
  {
    titulo: 'O Senhor é o meu Pastor',
    artista: 'Claudio Bassés',
    tom: 'C',
    categoria: 'Entrada',
    tags: ['paz', 'consolo', 'salmo 23'],
    cifra: `[C]
O Senhor é o meu pastor
C          G
Nada me faltará
Am         F
C      G      C
`,
  },
  {
    titulo: 'Preziosa Graça',
    artista: 'Tradicional',
    tom: 'G',
    categoria: 'Missa',
    tags: ['graça', 'hinário'],
    cifra: `[G]
Preziosa graça do Senhor
C              G
Que a um pecador salvou
Am         D7
Fui cego mas
G      C      G
Agora vejo
`,
  },
  {
    titulo: 'Como Foi Grande',
    artista: 'Diante do Trono',
    tom: 'E',
    categoria: 'Oferta',
    tags: ['adoração'],
    cifra: `[E]
Como foi grande o teu amor
Am7     C#m7
Que me drew até aqui
A        B
Como foi grande
`,
  },
]

type Aba = 'minhas' | 'base'

export function PaginaRepertorio() {
  const { avisar } = useAviso()
  const { confirmar } = useConfirmacao()
  const rota = useRota()
  const cifras = useStore(seletorCifras)

  const [aba, setAba] = useState<Aba>('minhas')
  const [termo, setTermo] = useState('')
  const atrasado = useDebounce(termo, 140)
  const [aberta, setAberta] = useState<string | null>(null)
  const [editando, setEditando] = useState<{ id: string | null; dados: Cifra } | null>(null)
  const NOVA_VAZIA: Cifra = useMemo(
    () => ({
      id: '',
      titulo: '',
      artista: '',
      tom: '',
      bpm: null,
      compasso: '4/4',
      categoria: '',
      tags: [],
      letra: '',
      cifra: '',
      audioId: null,
      fonteCifra: 14,
      criadaEm: 0,
      atualizadaEm: 0,
    }),
    [],
  )

  // O índice de busca é construído uma vez, depois que o repertório carrega.
  // Sem isso a primeira tecla digitada paga a indexação inteira.
  useEffect(() => {
    warmSearchIndex(cifras)
  }, [cifras])

  useEffect(() => {
    if (rota.params.abrir) setAberta(rota.params.abrir)
  }, [rota.params.abrir])

  /**
   * A lista mostrada. Com termo, vem da busca ranqueada; sem termo, o
   * repertório inteiro na ordem em que foi salvo.
   */
  const resultados = useMemo<Cifra[]>(
    () => (atrasado.trim() ? search(cifras, atrasado, { limit: 60 }).map((r) => r.item) : cifras),
    [cifras, atrasado],
  )

  const abertaAtual = useMemo(() => cifras.find((c) => c.id === aberta) ?? null, [cifras, aberta])

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 -mx-4 mb-4 bg-app-bg/85 px-4 pt-4 pb-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-app-ink">Repertório</h1>
            <p className="text-sm text-app-ink-3">
              {cifras.length} {cifras.length === 1 ? 'cifra salva' : 'cifras salvas'}
            </p>
          </div>
          <button type="button" onClick={() => setEditando({ id: null, dados: NOVA_VAZIA })} className="btn-primary btn-sm">
            <Plus size={15} /> Nova
          </button>
        </div>

        <div className="mt-3 flex gap-1.5">
          <div className="flex-1">
            <div className="input-group">
              <Search size={17} />
              <input
                className="input pl-10"
                placeholder="Buscar música, artista, letra..."
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label="Buscar no repertório"
              />
              {termo && (
                <button
                  type="button"
                  onClick={() => setTermo('')}
                  className="absolute right-2 rounded-lg p-1.5 text-app-ink-3 hover:bg-app-raised"
                  aria-label="Limpar busca"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex gap-1.5">
          <button type="button" className="chip" data-active={aba === 'minhas'} onClick={() => setAba('minhas')}>
            Minhas ({cifras.length})
          </button>
          <button type="button" className="chip" data-active={aba === 'base'} onClick={() => setAba('base')}>
            Para começar
          </button>
        </div>
      </header>

      {aba === 'minhas' ? (
        resultados.length === 0 ? (
          <EstadoVazio
            icone={<Music size={26} />}
            titulo={termo.trim() ? 'Nada encontrado' : 'Repertório vazio'}
            mensagem={
              termo.trim()
                ? 'Tente outro termo. A busca tolera erro de digitação.'
                : 'Guarde aqui as cifras que você usa sempre. Depois é só puxar para qualquer missa.'
            }
            acao={
              termo.trim()
                ? undefined
                : { rotulo: 'Criar primeira cifra', aoClicar: () => setEditando({ id: null, dados: NOVA_VAZIA }) }
            }
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {resultados.map((c) => (
              <li key={c.id}>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  onClick={() => setAberta(c.id)}
                  className="surface flex w-full items-center gap-3 p-3.5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-app-ink">{c.titulo}</p>
                    {c.artista && <p className="truncate text-xs text-app-ink-3">{c.artista}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {c.tom && (
                        <span className="rounded-md bg-brand-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                          {c.tom}
                        </span>
                      )}
                      {c.bpm && (
                        <span className="rounded-md bg-app-raised px-1.5 py-0.5 text-[10px] font-bold text-app-ink-2">
                          {c.bpm} bpm
                        </span>
                      )}
                      {c.categoria && (
                        <span className="rounded-md bg-app-raised px-1.5 py-0.5 text-[10px] font-bold text-app-ink-2">
                          {c.categoria}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="flex flex-col gap-1.5">
          {CIFRAS_BASE.map((base) => (
            <li key={base.titulo}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => {
                  const nova = criarCifra({ ...base, letra: '' })
                  avisar('Copiada para o seu repertório. Edite à vontade.', 'ok')
                  setAberta(nova.id)
                }}
                className="surface flex w-full items-center gap-3 p-3.5 text-left"
              >
                <BookOpen size={18} className="shrink-0 text-app-ink-3" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-app-ink">{base.titulo}</p>
                  <p className="truncate text-xs text-app-ink-3">
                    {base.artista} · {base.tom} · {base.categoria}
                  </p>
                </div>
                <Plus size={16} className="shrink-0 text-brand-500" />
              </motion.button>
            </li>
          ))}
          <li className="px-1 pt-2 text-xs leading-relaxed text-app-ink-3">
            Estas são referências para começar. Cifras variam entre hinários e arranjos: confira a sua e ajuste.
            Tudo o que você salvar aqui fica editável.
          </li>
        </ul>
      )}

      {/* ── Visualizar ── */}
      {abertaAtual && (
        <SongView
          cifra={abertaAtual}
          aoFechar={() => setAberta(null)}
          aoSalvar={({ tom, cifra: texto, audioId }) => {
            atualizarCifra(abertaAtual.id, {
              tom,
              cifra: texto,
              audioId: audioId === '' ? null : audioId,
            })
            avisar('Salvo neste tom.', 'ok')
          }}
        />
      )}

      {editando && (
        <EditorCifra
          id={editando.id}
          inicial={editando.dados}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null)
            avisar('Cifra salva.', 'ok')
          }}
          aoExcluir={async (id) => {
            const ok = await confirmar({
              titulo: 'Excluir cifra',
              mensagem: 'Excluir esta cifra do repertório? As missas que já a usaram continuam como estão.',
              rotuloOk: 'Excluir',
              perigoso: true,
            })
            if (!ok) return
            removerCifra(id)
            setEditando(null)
            avisar('Cifra excluída.', 'ok')
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Editor de cifra
// ─────────────────────────────────────────────────────────────────────────

function EditorCifra({
  id,
  inicial,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  /** null = cifra nova. Com id, atualiza a existente. */
  id: string | null
  inicial: Cifra
  aoFechar: () => void
  aoSalvar: () => void
  aoExcluir: (id: string) => void
}) {
  const [titulo, setTitulo] = useState(inicial.titulo)
  const [artista, setArtista] = useState(inicial.artista)
  const [tom, setTom] = useState(inicial.tom)
  const [bpm, setBpm] = useState(inicial.bpm?.toString() ?? '')
  const [categoria, setCategoria] = useState(inicial.categoria)
  const [tags, setTags] = useState(inicial.tags.join(', '))
  const [letra, setLetra] = useState(inicial.letra)
  const [cifra, setCifra] = useState(inicial.cifra)
  const [fonte, setFonte] = useState(inicial.fonteCifra)
  const editando = id !== null

  const sugestao = useMemo(() => detectarTom(cifra), [cifra])

  const salvar = () => {
    const tituloLimpo = titulo.trim()
    if (!tituloLimpo) return

    const dados = {
      titulo: tituloLimpo,
      artista: artista.trim(),
      tom: tom.trim() || sugestao,
      bpm: bpm ? Number(bpm) : null,
      categoria: categoria.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      letra,
      cifra,
      fonteCifra: fonte,
    }

    if (id) atualizarCifra(id, dados)
    else criarCifra(dados)
    aoSalvar()
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      larga
      titulo={editando ? 'Editar cifra' : 'Nova cifra'}
      rodape={
        <>
          {editando && id && (
            <button type="button" onClick={() => aoExcluir(id)} className="btn-danger">
              Excluir
            </button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={aoFechar} className="btn-outline">
            Cancelar
          </button>
          <button type="button" onClick={salvar} className="btn-primary" disabled={!titulo.trim()}>
            Salvar
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="cif-titulo">
            Título
          </label>
          <input
            id="cif-titulo"
            className="input"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: O Senhor é o meu Pastor"
            autoFocus
          />
        </div>

        <div>
          <label className="label" htmlFor="cif-artista">
            Artista
          </label>
          <input
            id="cif-artista"
            className="input"
            value={artista}
            onChange={(e) => setArtista(e.target.value)}
            placeholder="Ex.: Claudio Bassés"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="cif-tom">
              Tom
            </label>
            <input
              id="cif-tom"
              className="input"
              value={tom}
              onChange={(e) => setTom(e.target.value)}
              placeholder={sugestao || 'C'}
            />
          </div>
          <div>
            <label className="label" htmlFor="cif-bpm">
              BPM
            </label>
            <input
              id="cif-bpm"
              type="number"
              min={20}
              max={320}
              className="input"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              placeholder="100"
            />
          </div>
          <div>
            <label className="label" htmlFor="cif-cat">
              Categoria
            </label>
            <input
              id="cif-cat"
              className="input"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Entrada"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cif-tags">
            Tags (separadas por vírgula)
          </label>
          <input
            id="cif-tags"
            className="input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="paz, consolo"
          />
        </div>

        <div>
          <label className="label" htmlFor="cif-letra">
            Letra
          </label>
          <textarea
            id="cif-letra"
            className="input min-h-24"
            value={letra}
            onChange={(e) => setLetra(e.target.value)}
            placeholder="Opcional. Útil para imprimir a letra sem a cifra."
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0" htmlFor="cif-texto">
              Cifra
            </label>
            {sugestao && (
              <button
                type="button"
                onClick={() => setTom(sugestao)}
                className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                Seems {sugestao}
              </button>
            )}
          </div>
          <textarea
            id="cif-texto"
            className="input min-h-64 font-mono text-[13px] leading-relaxed"
            value={cifra}
            onChange={(e) => setCifra(e.target.value)}
            placeholder={'[C]\nO Senhor é o meu pastor\nC        G\nNada me faltará'}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <p className="mt-1.5 text-xs text-app-ink-3">
            Cole do Cifra Club ou do WhatsApp. Os acordes são reconhecidos automaticamente e ficam alinhados com a
            letra.
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0" htmlFor="cif-fonte">
              Tamanho da fonte ao tocar
            </label>
            <span className="font-mono text-xs font-bold text-app-ink-2">{fonte}px</span>
          </div>
          <input
            id="cif-fonte"
            type="range"
            min={11}
            max={24}
            value={fonte}
            onChange={(e) => setFonte(Number(e.target.value))}
            className="h-1.5 w-full accent-[rgb(var(--c-primary))]"
          />
          <p className="mt-1.5 text-xs text-app-ink-3">
            Fica salvo nesta música. Serve para quem tem dificuldade de ler de longe, no palco.
          </p>
        </div>
      </div>
    </Folha>
  )
}
