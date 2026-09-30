// Confere quais icones do Lucide o Acorde usa.
//
// A varredura e fechada pelo modulo arquivos.js. Antes ela percorria
// node_modules e cifraceleste/, e a lista saia com nomes vindos de codigo de
// terceiros, que nao dizem nada sobre os icones deste app.
const fs = require('fs');
const { arquivosDe, dentroDe } = require('./arquivos');
const usados = new Set();
for (const f of arquivosDe(/\.(js|html)$/)) {
  // As ferramentas em si ficam de fora: os padroes de texto que casam aqui
  // estao escritos nelas, e entrariam na lista como se fossem icones do app.
  if (dentroDe(f, 'tools')) continue;
  const s = fs.readFileSync(f, 'utf8'); let m;
  const re=/data-lucide['"]?\s*[:=]\s*['"]([a-z0-9-]+)['"]/g; while((m=re.exec(s))) usados.add(m[1]);
  const re2=/icone:\s*'([a-z0-9-]+)'/g; while((m=re2.exec(s))) usados.add(m[1]);
}
console.log('total icones: '+usados.size);
console.log(Array.from(usados).sort().join(' '));
