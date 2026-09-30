/* Servidor local do Acorde.
   Rodar:  npm run servir        (ou: node tools/serve.js [porta])

   O app abre direto pelo index.html, sem servidor nenhum. Este script existe
   para os casos em que abrir o arquivo nao serve:

     - o service worker so funciona em contexto seguro, e file:// nao e um
     - o cache do app e o que permite usar sem internet, e precisa de http
     - o console do navegador mostra os erros que o arquivo aberto esconde

   Sem dependencia nenhuma: e um servidor estatico de arquivo para arquivo.    */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const PORTA = Number(process.argv[2]) || 8080;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

http
  .createServer((req, res) => {
    let rel;
    try {
      rel = decodeURIComponent(req.url.split('?')[0]);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('URL invalida');
    }

    if (rel === '/') rel = '/index.html';

    //Impede sair da pasta do projeto por "../" ou por caminho absoluto.
    const alvo = path.normalize(path.join(RAIZ, rel));
    if (!alvo.startsWith(RAIZ)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Proibido');
    }

    fs.readFile(alvo, (erro, dados) => {
      if (erro) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Nao encontrado: ' + rel);
      }
      res.writeHead(200, {
        'Content-Type': TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream',
        // Sem cache no desenvolvimento: uma alteracao no js precisa aparecer
        // no F5, e um cache guardado aqui esconderia justamente isso.
        'Cache-Control': 'no-store',
      });
      res.end(dados);
    });
  })
  .listen(PORTA, '127.0.0.1', () => {
    console.log('Acorde em http://127.0.0.1:' + PORTA + '/');
    console.log('Ctrl+C para parar.');
  });
