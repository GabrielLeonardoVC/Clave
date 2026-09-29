import fs from 'node:fs'
import path from 'node:path'

function walk(dir, out = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name)
    if (entrada.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|html|mjs|css)$/.test(p)) out.push(p)
  }
  return out
}

const arquivos = walk('src').concat(['index.html', 'vite.config.ts', 'tailwind.config.js'])
const problemas = []

const CJK = /[぀-ヿ㐀-鿿가-힯＀-￯]/
const TERMO_PROIBIDO = /\b(culto|louvor)\b|hinos base/i
const NOME_ESTRANHO = /\b(noctas|是非|semitonesEntreTons|criarCifraVazio)\b/
const PLACEHOLDER = /adicione a l[oó]gica|TODO|FIXME|XXX:/

for (const arquivo of arquivos) {
  const texto = fs.readFileSync(arquivo, 'utf8')
  const bytes = fs.readFileSync(arquivo)

  let nulos = 0
  for (const b of bytes) if (b === 0) nulos++
  if (nulos > 0) problemas.push(`${arquivo}: ${nulos} byte(s) NUL`)

  texto.split('\n').forEach((linha, i) => {
    const n = i + 1
    if (CJK.test(linha)) problemas.push(`${arquivo}:${n} caractere nao-latino: ${linha.trim().slice(0, 70)}`)
    if (TERMO_PROIBIDO.test(linha)) problemas.push(`${arquivo}:${n} termo proibido: ${linha.trim().slice(0, 70)}`)
    if (NOME_ESTRANHO.test(linha)) problemas.push(`${arquivo}:${n} nome invalido: ${linha.trim().slice(0, 70)}`)
    if (PLACEHOLDER.test(linha)) problemas.push(`${arquivo}:${n} placeholder: ${linha.trim().slice(0, 70)}`)
  })
}

if (problemas.length === 0) {
  console.log(`OK: ${arquivos.length} arquivos, nenhuma anomalia.`)
} else {
  console.log(`${problemas.length} problema(s):`)
  for (const p of problemas.slice(0, 40)) console.log('  ' + p)
}
