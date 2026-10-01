/* =========================================================
   ACORDE - tools/fixar-ortografia.js
   Aplica as correcoes que o verificador de ortografia aponta.

   Nao substitui o verificador — ele e quem decide o que e erro. Este aqui so
   executa a troca, e por isso usa exatamente a mesma extracao e a mesma lista.
   Uma ferramenta que decide sozinha e uma ferramenta que discorda de quem a
   chamou, e o resultado e pior do que nao ter nenhuma das duas.

   Por que existe: sessenta trechos em quinze arquivos, escritos a mao, com a
   atencao no cansaco. Feito a mao, some um e aparece um errado.

   O que ele NAO toca:

     - comentarios, nomes de variavel e nomes de arquivo. O codigo deste
       projeto e escrito sem acento de proposito;
     - regiao de dado declarada (`PT_STOPWORDS`), que precisa vir sem acento
       porque o motor de cifra compara depois de tirar os acentos da letra;
     - palavra que o app tambem usa como identificador;
     - `js/data/`, que e letra de musica: texto de terceiro, citado como se cita.

   Uso:
     node tools/fixar-ortografia.js            aplica
     node tools/fixar-ortografia.js --simula   so mostra
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const LISTA = require('./ortografia-lista.js');
const X = require('./extrair-texto.js');
const RAIZ = path.join(__dirname, '..');
const SIMULA = process.argv.indexOf('--simula') >= 0;

/** Capitaliza a primeira letra. `áudio` vira `Áudio`, e nao `Audio`. */
function mai(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/** Escapa o que o padrao pode entender. */
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const PADROES = LISTA.entradas.map((e) => ({
  de: e.de,
  para: e.para,
  soCodigo: (LISTA.CODIGOS || []).indexOf(e.de) >= 0,
  reSem: new RegExp('(?<![A-Za-zÀ-ÿ])' + esc(e.de) + '(?![A-Za-zÀ-ÿ])', 'g'),
  reCom: new RegExp('(?<![A-Za-zÀ-ÿ])' + esc(e.para) + '(?![A-Za-zÀ-ÿ])', 'g'),
  reSemMai: new RegExp('(?<![A-Za-zÀ-ÿ])' + esc(mai(e.de)) + '(?![A-Za-zÀ-ÿ])', 'g'),
  reComMai: new RegExp('(?<![A-Za-zÀ-ÿ])' + esc(mai(e.para)) + '(?![A-Za-zÀ-ÿ])', 'g'),
}));

/* Os mesmos arquivos do verificador, com as mesmas exclusoes. */
const ARQUIVOS = [];
const DIRETORIOS_FORA = {
  data: 'letra de musica e cifra: texto de terceiro',
};

const anda = function (dir, filtro) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      if (DIRETORIOS_FORA[e.name]) continue;
      anda(p, filtro);
    } else if (filtro(e.name)) ARQUIVOS.push(p);
  }
};
anda(path.join(RAIZ, 'js'), (n) => n.endsWith('.js'));
const INDEX = path.join(RAIZ, 'index.html');
if (fs.existsSync(INDEX)) ARQUIVOS.push(INDEX);

/** As regioes de dado, com o mesmo calculo do verificador. */
function regioesDe(rel) {
  const arq = path.join(RAIZ, rel);
  if (!fs.existsSync(arq)) return [];
  const linhas = fs.readFileSync(arq, 'utf8').split('\n');
  const saida = [];
  for (const tabela of (LISTA.TABELAS || [])) {
    if (tabela.arquivo !== rel) continue;
    const i = linhas.findIndex((l) => l.indexOf(tabela.marcador) >= 0);
    if (i < 0) continue;
    let prof = 0, aberta = false, fim = i;
    for (let k = i; k < linhas.length; k++) {
      for (const ch of linhas[k]) {
        if ('[{('.indexOf(ch) >= 0) { prof++; aberta = true; }
        else if (']})'.indexOf(ch) >= 0) prof--;
      }
      if (aberta && prof <= 0) { fim = k; break; }
    }
    saida.push({ de: i + 1, ate: fim + 1 });
  }
  return saida;
}

/**
 * O trecho corrigido, ou null quando ja esta certo.
 *
 * Minuscula e capitalizada contam como a mesma palavra: "Titulo do evento" e
 * erro tanto quanto "titulo do evento", e so olhar a minuscula deixaria metade
 * dos casos passar.
 */
function corrigir(texto) {
  let saida = texto;
  const trocas = [];
  for (const p of PADROES) {
    if (p.soCodigo && texto.trim() === p.de) continue;

    const pares = [
      { reSem: p.reSem, reCom: p.reCom, de: p.de, para: p.para },
      { reSem: p.reSemMai, reCom: p.reComMai, de: mai(p.de), para: mai(p.para) },
    ];

    let trocou = null;
    for (const par of pares) {
      par.reSem.lastIndex = 0;
      if (!par.reSem.test(texto)) continue;
      par.reCom.lastIndex = 0;
      if (par.reCom.test(texto)) continue;
      par.reSem.lastIndex = 0;
      saida = saida.replace(new RegExp(par.reSem.source, 'g'), par.para);
      trocou = { de: par.de, para: par.para };
      break;
    }
    if (trocou) trocas.push(trocou.de + ' -> ' + trocou.para);
  }
  return trocas.length ? { texto: saida, trocas: trocas } : null;
}

let totalTrechos = 0, totalTrocas = 0, arquivosTocados = 0;

for (const arq of ARQUIVOS) {
  const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
  const regioes = regioesDe(rel);
  const bruto = fs.readFileSync(arq, 'utf8');
  const ehHtml = /\.html?$/i.test(arq);

  const paraCorrigir = [];
  for (const t of X.textos(bruto)) {
    if (t.texto.length > 400) continue;
    if (X.ehCodigo(t.texto, t.antes)) continue;
    if ((LISTA.CODIGOS || []).indexOf(t.texto.trim()) >= 0) continue;
    if (regioes.some((r) => t.linha >= r.de && t.linha <= r.ate)) continue;

    const r = corrigir(t.texto);
    if (!r) continue;
    paraCorrigir.push({
      inicio: t.ini + 1,
      fim: t.ini + 1 + t.texto.length,
      r: r,
      linha: t.linha,
    });
  }

  // O HTML tem o texto fora das aspas, e o caminho de troca e outro. O
  // verificador ainda o cobre; aqui fica de fora e o relatorio diz.
  if (ehHtml && paraCorrigir.length) {
    console.log(rel + ': precisa de correcao manual (HTML, nao string)');
  }
  if (ehHtml) continue;
  if (!paraCorrigir.length) continue;

  arquivosTocados++;
  let novo = bruto;

  // Do fim para o comeco: assim os indices dos trechos seguintes continuam
  // valendo enquanto o arquivo e reescrito.
  for (const p of paraCorrigir.sort((a, b) => b.inicio - a.inicio)) {
    const cru = novo.slice(p.inicio, p.fim);
    let substituto = p.r.texto;
    if (cru.indexOf('\\') >= 0) {
      substituto = substituto.replace(/"/g, '\\"').replace(/'/g, "\\'");
    }
    novo = novo.slice(0, p.inicio) + substituto + novo.slice(p.fim);

    totalTrechos++;
    totalTrocas += p.r.trocas.length;
    console.log((SIMULA ? 'simula  ' : 'arruma  ') + rel + ':' + p.linha +
      '  ' + p.r.trocas.join(', '));
    console.log('         ' + JSON.stringify(p.r.texto.slice(0, 78)));
  }

  if (!SIMULA) fs.writeFileSync(arq, novo, 'utf8');
}

console.log('');
console.log('=================================================');
console.log('  ' + totalTrechos + ' trecho(s), ' + totalTrocas + ' palavra(s), ' +
  arquivosTocados + ' arquivo(s)');
if (SIMULA) console.log('  SIMULA: nada foi escrito');
console.log('=================================================\n');