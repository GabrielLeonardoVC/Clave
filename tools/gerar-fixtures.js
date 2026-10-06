'use strict';
/* Gera um PDF REAL, mínimo e válido, e um TXT real.
 *
 * Não é uma string com extensão `.pdf`: é um arquivo com a estrutura que um
 * leitor de PDF reconhece — cabeçalho `%PDF-1.4`, catálogo, páginas, xref e
 * trailer com `startxref`. Um teste que usa `data:application/pdf;base64,xxxx`
 * com garbage provaria que o modelo aceita o prefixo, e nada mais.
 */
const fs = require('fs');
const path = require('path');

function pdfDe(texto) {
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 120] /Contents 4 0 R '
    + '/Resources << /Font << /F1 5 0 R >> >> >>';
  const fluxo = 'BT /F1 14 Tf 20 70 Td (' + texto.replace(/[()\\]/g, '') + ') Tj ET';
  objs[4] = '<< /Length ' + fluxo.length + ' >>\nstream\n' + fluxo + '\nendstream';
  objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let corpo = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = corpo.length;
    corpo += i + ' 0 obj\n' + objs[i] + '\nendobj\n';
  }
  const xref = corpo.length;
  let tabela = 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
  for (let i = 1; i < objs.length; i++) {
    tabela += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  tabela += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(corpo + tabela, 'latin1');
}

const destino = process.argv[2] || path.join(__dirname, '..', 'fixtures');
fs.mkdirSync(destino, { recursive: true });

const p1 = path.join(destino, 'partitura-teste.pdf');
const p2 = path.join(destino, 'outro-material.pdf');
const t1 = path.join(destino, 'letra-teste.txt');

fs.writeFileSync(p1, pdfDe('Entrada do Senhor'));
fs.writeFileSync(p2, pdfDe('Pao da Vida - em duas tonalidades'));
fs.writeFileSync(t1, 'Entrada do Senhor\n\nRefrao:\nA, e Ti se serve, Senhor.\n', 'utf8');

const rel = (p) => path.basename(p) + ' = ' + fs.statSync(p).size + ' B';
console.log('gerados em ' + destino);
console.log('  ' + rel(p1));
console.log('  ' + rel(p2));
console.log('  ' + rel(t1));