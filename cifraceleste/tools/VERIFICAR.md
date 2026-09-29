# Verificação de interface

```bash
npm run build
npx serve dist -l 8812     # ou: python -m http.server 8812 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8812/index.html` e rode os casos abaixo pelo console do
navegador. Todos passam; se algum falhar, é defeito.

Os casos estão escritos como funções para não depender de ferramenta
qualquer. Cole a que quiser e chame.

## Por que isto existe

Os testes automatizados (110) cobrem a lógica e a folha de estilo. Eles **não**
pegam três classes de defeito que só aparecem com o navegador aberto:

1. animação de biblioteca que não roda, deixando o elemento em `opacity: 0`
2. camada de empilhamento presa por `transform` do contêiner animado
3. sobreposição que não sai do DOM ao fechar

Todos os três aconteceram de fato durante a construção, e nenhum deles
reclamou no console.

---

## Caso 1 — navegação e visibilidade

```js
(async function () {
  const out = { ok: [], fail: [] }
  const c = (n, fn) => { try { const v = fn(); (v === true ? out.ok : out.fail).push(n + (v === true ? '' : ' -> ' + v)) } catch (e) { out.fail.push(n + ' ERRO: ' + e.message) } }
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const op = () => { const e = document.querySelector('#conteudo > div'); return e ? Number(getComputedStyle(e).opacity) : -1 }
  const txt = () => document.querySelector('#conteudo').textContent.slice(0, 40)

  await esperar(900)
  const nomes = ['Hoje', 'Missas', 'Repertório', 'Teoria', 'Ajustes']
  for (let i = 0; i < 5; i++) {
    document.querySelectorAll('nav button')[i].click()
    await esperar(620)
    c('tela ' + nomes[i], () => op() > 0.9 ? true : 'opacidade ' + op() + ' — tela invisível')
  }
  return out
})()
```

O defeito que pega: `op() === 0`. A tela troca de conteúdo mas não aparece.

## Caso 2 — anti-FOUC

Semeie o tema escuro **antes** de recarregar, e confira que o `<html>` já nasce
com a classe e a cor certas.

```js
localStorage.setItem('cifraceleste.v1', JSON.stringify({
  versao: 1, cifras: [], eventos: [], ajustes: { tema: 'dark', accent: 'royal' }
}))
location.reload()
```

Depois, sem esperar nada:

```js
({
  dark: document.documentElement.classList.contains('dark'),
  fundo: document.documentElement.style.backgroundColor,   // rgb(20, 23, 28)
  esquema: document.documentElement.style.colorScheme,       // dark
})
```

Se `dark` for `false`, há flash. O script do `<head>` não rodou a tempo.

## Caso 3 — tema com contraste medido

```js
(async function () {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const achar = (t) => Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === t)
  const fundo = () => getComputedStyle(document.body).backgroundColor
  const texto = () => getComputedStyle(document.body).color
  const rgb = (c) => c.match(/\d+/g).map(Number)
  const lum = (c) => { const m = rgb(c); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]) }
  const contraste = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }

  location.hash = '#/ajustes'
  await esperar(600)
  achar('Claro').click(); await esperar(650)
  const claro = { f: fundo(), t: texto() }
  achar('Escuro').click(); await esperar(650)
  const escuro = { f: fundo(), t: texto() }
  return { claro, escuro, contrasteClaro: contraste(claro.f, claro.t).toFixed(2), contrasteEscuro: contraste(escuro.f, escuro.t).toFixed(2) }
})()
```

Esperado: claro `rgb(250, 249, 247)`, escuro `rgb(20, 23, 28)`, contraste acima
de 7 nos dois. O escuro **não** pode ser `rgb(0, 0, 0)`.

## Caso 4 — transposição pela interface

```js
(async function () {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const achar = (t) => Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === t)
  const grade = () => document.querySelector('.cifra-grid').textContent

  location.hash = '#/repertorio'
  await esperar(600)
  achar('Para começar').click()
  await esperar(450)
  Array.from(document.querySelectorAll('button')).filter((b) => (b.textContent || '').indexOf('O Senhor é o meu Pastor') >= 0)[0].click()
  await esperar(800)

  const original = grade()
  document.querySelector('button[aria-label="Subir meio tom"]').click()
  await esperar(400)
  const acima = grade()

  return {
    mudou: acima !== original,
    nuncaDuploAcidente: !/Cb|E#|Fb|B#|##|bb/.test(acima),
    letraPreservada: acima.includes('pastor'),
  }
})()
```

O defeito que pega: `letraPreservada: false` (a transposição tocou a letra) ou
`nuncaDuploAcidente: false` (apareceu Cb ou E#).

## Caso 5 — emergência abre e fecha de verdade

```js
(async function () {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const painel = () => document.querySelector('.z-\\[85\\]')
  const out = []

  document.querySelector('button[aria-label*="merg"]').click()
  await esperar(700)
  out.push('abriu: ' + !!painel())

  painel().querySelector('button[aria-label="Fechar"]').click()
  await esperar(900)
  out.push('saiu do DOM: ' + (painel() === null))
  out.push('FAB voltou: ' + !!document.querySelector('button[aria-label*="merg"]'))

  return out
})()
```

O defeito que pega: `saiu do DOM: false`. O painel fecha mas continua no DOM.

## Caso 6 — movimento reduzido

Com o sistema em "reduzir movimento" ligado, repita o Caso 1. A opacidade
precisa ser `1`: o defeito clássico deixava a tela inteira invisível.

## Console

Depois de qualquer caso, o console deve estar limpo:

```js
// erros e avisos precisam estar em zero
```

Erro `NotFoundError: removeChild` aparece quando um script externo mexe no DOM
que o React administra. Não é defeito do app — é interferência do teste.
