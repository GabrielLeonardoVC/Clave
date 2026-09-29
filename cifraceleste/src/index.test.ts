import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * Regressões de folha de estilo.
 *
 * São defeitos que nenhuma checagem de tipos pega e que só aparecem com o
 * navegador aberto. O caso grave já encontrado foi o das entradas de tela
 * invisíveis para quem pede menos movimento: a animação era encurtada em vez
 * de desligada, e com `fill-mode: both` o elemento ficava preso em
 * `opacity: 0`. A tela inteira desaparecia, e nada no console reclamava.
 *
 * Estes testes leem o CSS como texto porque é isso que o navegador faz. Não
 * importa o CSS gerado: o que importa é o arquivo-fonte, que é o que se
 * edita.
 */

const aqui = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(aqui, 'index.css'), 'utf8')

/** Extrai o corpo de um bloco, equilibra as chaves. */
function bloco(inicio: string): string {
  const a = css.indexOf(inicio)
  if (a < 0) return ''
  let i = css.indexOf('{', a)
  let nivel = 0
  for (; i < css.length; i++) {
    if (css[i] === '{') nivel++
    else if (css[i] === '}') {
      nivel--
      if (nivel === 0) return css.slice(a, i + 1)
    }
  }
  return css.slice(a)
}

describe('entrada de tela', () => {
  it('a classe usada pelo App existe no CSS', () => {
    expect(css).toContain('.tela-entra')
  })

  it('a animação vai de opacidade zero a um', () => {
    const regra = bloco('@keyframes tela-entra')
    expect(regra).toContain('opacity: 0')
    expect(regra).toContain('opacity: 1')
  })

  it('a entrada de tela nunca fica presa no estado inicial', () => {
    // `both` segura o estado inicial antes de começar e o final depois. Se a
    // animação for cancelada, o elemento fica no estado inicial — e como o
    // estado inicial é invisível, a tela some. O `forwards` é o que garante
    // que o fim seja o estado mostrado.
    const uso = /\.tela-entra\s*\{[^}]*\}/.exec(css)?.[0] ?? ''
    expect(uso).toContain('tela-entra')
  })
})

describe('respeito a movimento reduzido', () => {
  it('o bloco existe e desliga a animação de tela', () => {
    const blocoReduzido = bloco('@media (prefers-reduced-motion: reduce)')
    expect(blocoReduzido).toContain('.tela-entra')
    expect(blocoReduzido).toMatch(/\.tela-entra\s*\{[^}]*animation:\s*none/)
  })

  it('desliga a animação E fixa a opacidade, para a tela não sumir', () => {
    // Encurtar a animação não basta: com `fill-mode: both` o elemento herda o
    // estado inicial. Só desligar e declarar o estado final resolve.
    const blocoReduzido = bloco('@media (prefers-reduced-motion: reduce)')
    const regra = /\.tela-entra\s*\{[^}]*\}/.exec(blocoReduzido)?.[0] ?? ''
    expect(regra, 'falta a regra de .tela-entra no bloco de movimento reduzido').toContain('animation')
    expect(regra).toMatch(/opacity:\s*1/)
    expect(regra).toMatch(/transform:\s*none/)
  })

  it('o botão de emergência também é protegido', () => {
    // Mesmo problema do botão flutuante: animado por biblioteca, ele ficava
    // invisível quando a animação não rodava.
    const blocoReduzido = bloco('@media (prefers-reduced-motion: reduce)')
    const regra = /\.fab-emergencia\s*\{[^}]*\}/.exec(blocoReduzido)?.[0] ?? ''
    expect(regra, 'falta a regra do botão de emergência').toMatch(/animation:\s*none/)
    expect(regra).toMatch(/opacity:\s*1/)
  })

  it('o aviso de confirmação também é protegido', () => {
    // O aviso é o que confirma que a tela respondeu. Escondido, o usuário não
    // sabe se a música foi salva.
    const blocoReduzido = bloco('@media (prefers-reduced-motion: reduce)')
    const regra = /\.aviso-entra\s*\{[^}]*\}/.exec(blocoReduzido)?.[0] ?? ''
    expect(regra, 'falta a regra do aviso').toMatch(/animation:\s*none/)
    expect(regra).toMatch(/opacity:\s*1/)
  })
})

describe('sobreposições', () => {
  it('nenhuma depende de animação de biblioteca para existir', () => {
    // Já custaram três defeitos: o painel ficava no DOM depois de fechado, o
    // botão flutuante ficava invisível, e o aviso de confirmação nunca
    // aparecia. A causa comum era a mesma — a animação de biblioteca não roda
    // e o elemento fica preso no estado inicial.
    //
    // O teste olha o CÓDIGO, não o texto: a palavra pode aparecer em
    // comentário explicando o motivo da escolha, que é justamente o que
    // impede alguém de reintroduzir o problema.
    const fontes = [
      'components/EmergencyPanel.tsx',
      'components/SongView.tsx',
      'components/ui.tsx',
    ]
    for (const arquivo of fontes) {
      const caminho = resolve(aqui, arquivo)
      // Tira comentários de bloco e de linha antes de olhar.
      const codigo = readFileSync(caminho, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^[ \t]*\/\/.*$/gm, '')

      expect(codigo, `${arquivo} importa AnimatePresence`).not.toMatch(
        /import[\s\S]{0,120}AnimatePresence/,
      )
      expect(codigo, `${arquivo} usa <AnimatePresence>`).not.toMatch(/<AnimatePresence/)
    }
  })

  it('toda animação de entrada tem uma regra de movimento reduzido', () => {
    // Cada animação com estado inicial invisível precisa de uma regra que a
    // desligue e declare o estado final. Sem ela, o elemento some.
    const blocoReduzido = bloco('@media (prefers-reduced-motion: reduce)')
    // Só as classes de animação, e não qualquer seletor com `animation`.
    const comEntrada = [...css.matchAll(/^\s*\.([a-z][a-z-]*)\s*\{[^}]*?animation:\s*[a-z-]+-/gm)].map(
      (m) => m[1],
    )
    expect(comEntrada.length).toBeGreaterThan(0)
    for (const classe of comEntrada) {
      expect(blocoReduzido, `falta regra para .${classe}`).toContain(`.${classe}`)
    }
  })
})

describe('tema', () => {
  it('o modo escuro é ativado por classe, e não por atributo', () => {
    // A classe é o que o script do index.html aplica antes da primeira
    // pintura. Um seletor por atributo deixaria o tema errado no primeiro
    // quadro, que é o flash que o projeto precisa evitar.
    expect(css).toMatch(/\.dark\s*\{/)
  })

  it('o escuro é cinza chumbo, não preto puro', () => {
    const escuro = bloco('.dark {')
    // Um preto puro seria `0 0 0`. O chumbo tem os três canais acima de zero,
    // e o azul acima do vermelho, que é o tom frio do chumbo.
    const encontrados = [...escuro.matchAll(/--c-bg:\s*(\d+)\s+(\d+)\s+(\d+)/g)]
    expect(encontrados.length).toBeGreaterThan(0)
    const [r, g, b] = encontrados[0].slice(1).map(Number)
    expect(r, 'vermelho do fundo escuro').toBeGreaterThan(5)
    expect(g, 'verde do fundo escuro').toBeGreaterThan(5)
    expect(b, 'azul do fundo escuro').toBeGreaterThan(5)
    expect(b, 'sem tom azulado').toBeGreaterThan(r)
  })

  it('o claro é papel quente, não branco puro', () => {
    const claro = bloco(':root {')
    const encontrados = [...claro.matchAll(/--c-bg:\s*(\d+)\s+(\d+)\s+(\d+)/g)]
    expect(encontrados.length).toBeGreaterThan(0)
    const [r, g, b] = encontrados[0].slice(1).map(Number)
    // Branco puro seria 255, 255, 255.
    expect(r + g + b).toBeLessThan(255 * 3)
    expect(r, 'papel quente tem vermelho acima do azul').toBeGreaterThanOrEqual(b)
  })

  it('o body não tem transição permanente, para não piscar', () => {
    const corpo = bloco('body {')
    expect(corpo).toMatch(/transition:\s*none/)
  })
})

describe('grade da cifra', () => {
  it('usa fonte de largura fixa e preserva os espaços', () => {
    // Sem fonte monoespaçada, o alinhamento do acorde com a sílaba se perde.
    const grade = bloco('.cifra-grid {')
    expect(grade).toContain('mono')
    expect(grade).toMatch(/white-space:\s*pre/)
    expect(grade).toMatch(/letter-spacing:\s*0/)
  })
})

describe('foco visível', () => {
  it('todo elemento focável tem indicador de foco', () => {
    // Navegar por teclado é obrigatório: quem usa o app no palco às vezes
    // está com o celular apoiado e um dedo só.
    expect(css).toContain(':focus-visible')
    expect(css).toMatch(/ring-\d|outline:\s*(?!none)\S/)
  })
})

describe('rolagem', () => {
  it('a barra de rolagem tem espaço reservado, para o conteúdo não pular', () => {
    // Sem `scrollbar-gutter`, abrir um modal adiciona a barra e empurra todo
    // o conteúdo para a esquerda por um quadro.
    expect(css).toMatch(/scrollbar-gutter:\s*stable/)
  })
})
