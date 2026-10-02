/* ---------------------------------------------------------------
   CONFERE O ZOOM DE INPUT NO iOS

   O iOS dá zoom quando o foco chega num campo cuja fonte é MENOR que
   16px, e o zoom não volta quando o campo perde o foco. Num ensaio isso
   transforma o app em "quebrado" sem que nada esteja quebrado.

   Este verificador NAO procura palavra: ele monta a lista de regras na
   ordem em que o navegador as leria e resolve a cascata de verdade, com
   media query e especificidade. Procurar texto num CSS dá a impressão de
   que a regra existe quando ela nao faz nada — que foi exatamente o que
   aconteceu com o `.textarea.mono`.
   --------------------------------------------------------------- */
const fs = require('fs');

const ARQUIVOS = ['css/base.css', 'css/components.css', 'css/features.css']
  .map((f) => ({ nome: f, texto: fs.readFileSync(f, 'utf8') }));

/* Extrai as regras de um texto, respecting o aninhamento por chaves.
 * Devolve [{sel, corpo, midia}] em ordem de leitura. */
function extrair(texto) {
  const regras = [];
  const pilha = [];   // {tipo:'at'|'sel', midia}
  let buf = '';
  let sel = '';
  let i = 0;
  const n = texto.length;

  const semComentario = texto
    .replace(/\/\*[\s\S]*?\*\//g, function (m) { return ' '.repeat(m.length); });

  while (i < n) {
    const c = semComentario[i];
    if (c === '{') {
      const cabecalho = buf.trim();
      buf = '';
      if (cabecalho.indexOf('@') === 0) {
        // @media, @supports, @keyframes: empurra, e e o que guarda a condicao
        // das regras que estao dentro.
        pilha.push({ tipo: 'at', midia: cabecalho });
        sel = '';
      } else {
        pilha.push({ tipo: 'sel', midia: sel ? '' : (pilha.length ? pilha[pilha.length - 1].midia : '') });
        sel = cabecalho;
      }
      i++;
      continue;
    }
    if (c === '}') {
      const corpo = buf.trim();
      const aberto = pilha.pop();
      /* So uma regra de seletor vira regra do CSS. A media query nao e uma.
       *
       * A primeira versao desfaia a pilha em TODO `}`, e com isso a media query
       * era fechada junto com a primeira regra que estava dentro dela — de modo
       * que as regras seguintes eram lidas como se NAO houvesse media query, e o
       * desktop recebia a fonte de toque. Um verificador que filtra demais
       * aprova o que nao devia. */
      if (aberto && aberto.tipo === 'sel' && sel && corpo) {
        regras.push({ sel: sel, corpo: corpo, midia: aberto.midia });
      }
      buf = '';
      sel = '';
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  return regras;
}

/* A media query vale para este aparelho? */
function vale(midia, ap) {
  if (!midia) return true;
  const m = /@media\s+([^{]+)/i.exec(midia);
  if (!m) return false;
  const conds = m[1];

  const larg = /max-width:\s*([\d.]+)px/.exec(conds);
  if (larg && ap.largura > Number(larg[1])) return false;
  const minL = /min-width:\s*([\d.]+)px/.exec(conds);
  if (minL && ap.largura < Number(minL[1])) return false;

  if (/hover:\s*none/.test(conds) && /pointer:\s*coarse/.test(conds)) {
    if (!ap.toque) return false;
  }
  if (/hover:\s*hover/.test(conds) && /pointer:\s*fine/.test(conds)) {
    if (ap.toque) return false;
  }
  return true;
}

/* Resolve qual `font-size` um seletor recebe neste aparelho. */
function resolver(ap, selAlvo) {
  const alvo = selAlvo.split('.').filter(Boolean);
  let melhor = null;
  for (const f of ARQUIVOS) {
    for (const r of extrair(f.texto)) {
      if (!vale(r.midia, ap)) continue;
      for (const grupo of r.sel.split(',')) {
        const g = grupo.trim();
        if (!g) continue;
        const ultimo = g.split(/\s+/).pop();
        if (!ultimo) continue;
        const cls = ultimo.split('.').filter(Boolean);
        if (cls.length !== alvo.length) continue;
        if (!cls.every((c, k) => c === alvo[k])) continue;

        const rem = /font-size:\s*([\d.]+)rem/.exec(r.corpo);
        const px = /font-size:\s*([\d.]+)px/.exec(r.corpo);
        let valor = null;
        if (rem) valor = Number(rem[1]) * 16;
        else if (px) valor = Number(px[1]);
        if (valor === null) continue;

        const espec = cls.length;
        if (!melhor || espec >= melhor.espec) {
          melhor = { valor: valor, espec: espec, de: g, arquivo: f.nome };
        }
      }
    }
  }
  return melhor;
}

const APARELHOS = [
  { nome: 'iPhone em pe (393px)', largura: 393, toque: true },
  { nome: 'iPhone deitado (932px)', largura: 932, toque: true },
  { nome: 'iPhone Pro Max deitado (956px)', largura: 956, toque: true },
  { nome: 'iPad mini (744px)', largura: 744, toque: true },
  { nome: 'iPad (820px)', largura: 820, toque: true },
  { nome: 'iPad Pro (1024px)', largura: 1024, toque: true },
  { nome: 'Chrome no desktop (1440px)', largura: 1440, toque: false },
];

const ALVOS = [
  { sel: '.input', desc: 'campo de texto' },
  { sel: '.textarea', desc: 'area de texto' },
  { sel: '.textarea.mono', desc: 'observacao da escala' },
];

const MINIMO = 16;
let ruins = 0;
const linhas = [];

console.log('O iOS dá zoom quando a fonte do campo é menor que ' + MINIMO + 'px.\n');

for (const ap of APARELHOS) {
  const pedacos = [];
  for (const alvo of ALVOS) {
    const r = resolver(ap, alvo.sel);
    const v = r ? r.valor : null;
    if (v === null) { pedacos.push(alvo.sel + '=?'); continue; }
    const zooma = ap.toque && v < MINIMO;
    if (zooma) ruins++;
    pedacos.push(alvo.sel + '=' + v + 'px' + (zooma ? '  ZOOMA' : ''));
  }
  linhas.push('  ' + ap.nome.padEnd(33) + pedacos.join('   '));
}
console.log(linhas.join('\n'));

/* O desktop NAO pode ter recebido a regra de toque. Se recebeu, o
 * verificador de media query esta quebrado — e um verificador quebrado
 * aprova tudo. */
const desk = resolver({ largura: 1440, toque: false }, '.input');
const tocouDesktop = desk && desk.valor >= MINIMO;
if (tocouDesktop) {
  console.log('\nO verificador esta quebrado: o desktop recebeu a fonte de toque.');
  console.log('Um verificador que aprova tudo nao esta verificando nada.');
  process.exit(1);
}

console.log('\n' + (ruins === 0
  ? 'OK: nenhum campo fica abaixo de 16px em aparelho de toque, e o desktop nao foi afetado.'
  : ruins + ' combinacao(oes) abaixo de 16px em aparelho de toque.'));
process.exit(ruins === 0 ? 0 : 1);
