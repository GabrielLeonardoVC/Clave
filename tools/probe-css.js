/* =========================================================
   ACORDE - tools/probe-css.js
   Pergunta ao navegador se as regras do CSS chegaram ate ele.

   Chamado por tools/check-css.js. Devolve JSON na saida padrao.

   O caminho e o mais simples que funciona sem dependencia: uma pagina com as
   tres folhas e um script que compara o texto com o CSSOM, escrevendo o
   resultado num `<pre>`. Depois o Chrome headless despeja o DOM e o resultado
   sai de la.

   A alternativa seria falar com o Chrome pelo protocolo de depuracao remoto,
   que exige um cliente de WebSocket. Node 22+ ja traz um, mas nao ha motivo
   para levantar um servidor e abrir porta quando `--dump-dom` resolve.

   Sem navegador, sai com `erro` preenchido — e quem chama decide o que fazer.
   ========================================================= */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = path.join(__dirname, '..');
const HTML = path.join(__dirname, 'probe-css.html');

/* O Chrome, onde estiver. */
function acharChrome() {
  const candidatos = [
    path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];
  for (const c of candidatos) {
    try { if (c && fs.existsSync(c)) return c; } catch (e) { /* sem variavel */ }
  }
  return null;
}

const chrome = acharChrome();
if (!chrome) {
  process.stdout.write(JSON.stringify({ ok: false, erro: 'nenhum Chrome ou Edge encontrado' }));
  process.exit(0);
}

if (!fs.existsSync(HTML)) {
  process.stdout.write(JSON.stringify({ ok: false, erro: 'probe-css.html nao existe' }));
  process.exit(0);
}

const url = 'file:///' + HTML.replace(/\\/g, '/');

let dom = '';
try {
  dom = execFileSync(chrome, [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--virtual-time-budget=6000',
    '--dump-dom',
    url,
  ], { encoding: 'utf8', timeout: 45000, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  // Mesmo dando erro de saida, o Chrome costuma ter despejado o DOM.
  dom = (e.stdout || '').toString();
  if (!dom) {
    process.stdout.write(JSON.stringify({
      ok: false, erro: 'o Chrome nao respondeu: ' + String(e.message).slice(0, 120),
    }));
    process.exit(0);
  }
}

/* O resultado esta no <pre id="css-probe">. O `textContent` veio escapado. */
const m = /<pre id="css-probe">([\s\S]*?)<\/pre>/.exec(dom);
if (!m) {
  process.stdout.write(JSON.stringify({ ok: false, erro: 'o probe nao escreveu no DOM' }));
  process.exit(0);
}

const bruto = m[1]
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&#39;/g, "'");

let dados;
try {
  dados = JSON.parse(bruto);
} catch (e) {
  process.stdout.write(JSON.stringify({
    ok: false, erro: 'a saida do probe nao e JSON: ' + bruto.slice(0, 120),
  }));
  process.exit(0);
}

process.stdout.write(JSON.stringify(dados));