/* Corpo do teste E2E — executado dentro da página.
   Resultado em window.__e2e.                                     */
(function () {
  const out = [];
  const log = (m) => out.push(m);
  const S = window.Store, U = window.Utils, M = window.Music;

  // limpa tudo
  S.apagarTudo();
  log('1. dados limpos: ' + S.escalas().length + ' escalas, ' + S.cifras().length + ' cifras');

  // importa uma cifra do repertório pronto (fluxo real do usuario)
  const base = window.BASE.byId('h_amazing_grace');
  const c = S.normCifra({
    titulo: base.titulo, artista: base.artista, tom: base.tom, bpm: base.bpm,
    compasso: base.compasso, categoria: base.categoria, tags: base.tags,
    letra: base.letra, cifra: base.cifra,
  });
  S.db.cifras.push(c); S.salvar();
  log('2. cifra importada: "' + c.titulo + '" tom ' + c.tom);
  const k = M.detectKey(c.cifra);
  log('   tom detectado: ' + M.noteName(k.pc, M.useFlatsFor(k.pc)) + ' (declarado: ' + c.tom + ')');

  // cria escala com essa cifra
  const esc = S.normEscala({
    data: U.todayKey(), titulo: 'Missa de domingo', hora: '19:00', tipo: 'missa',
    musicas: [{ nome: c.titulo, tom: c.tom, bpm: c.bpm, categoria: c.categoria, cifraId: c.id }],
  });
  S.db.escalas.push(esc); S.salvar();
  log('3. escala criada com ' + esc.musicas.length + ' musica; vinculo preservado: ' + (esc.musicas[0].cifraId === c.id));

  // transpoe
  const t2 = M.transposeCifra(c.cifra, 5, false);
  const k2 = M.detectKey(t2);
  log('4. transposta +5: ' + c.tom + ' -> ' + M.keyLabel(k2.pc, k2.mode === 'minor', false));
  log('   1o acorde: ' + M.extractChords(c.cifra)[0].text + ' -> ' + M.extractChords(t2)[0].text);

  // graus romanos
  const ana = M.analyzeChords(M.extractChords(c.cifra), k.pc, 'major');
  log('5. graus (6 primeiros): ' + ana.slice(0, 6).map((a) => a.degree).join(' '));

  // backup / restore
  const json = S.exportar();
  S.apagarTudo();
  S.importar(json, 'substituir');
  log('6. backup ' + (json.length / 1024).toFixed(1) + 'KB -> restaurado: ' +
    S.allCifras().length + ' cifras, ' + S.allEscalas().length + ' escalas');

  // impressao
  const folha = window.Print.folhaEscala(S.allEscalas()[0]);
  log('7. folha: ' + folha.length + ' chars, tem tabela: ' + (folha.indexOf('ps-table') > 0));
  const txt = window.Print.textoEscala(S.allEscalas()[0]);
  log('   texto compartilhavel: ' + txt.split('\n').length + ' linhas');

  // persistencia
  log('8. localStorage: ' + (localStorage.getItem(S.STORAGE_KEY) || '').length + ' bytes');

  // links
  const links = U.searchLinks('Amazing Grace', 'Newton');
  log('9. links: youtube=' + (links.youtube.indexOf('youtube.com') > 0) + ' cifraclub=' + (links.cifraclub.indexOf('cifraclub') > 0));

  // voicings
  let shapes = 0;
  ['C', 'Am', 'G7', 'Fmaj7', 'Bdim7', 'F#m7b5', 'Eb', 'Aadd9'].forEach((ch) => {
    const p = M.parseChord(ch);
    shapes += M.guitarShapes(p.root, p.quality, { maxFret: 12, limit: 4 }).length;
  });
  log('10. ' + shapes + ' posicoes de violao para 8 acordes');

  // deteccao de PT stopwords dentro de cifra real
  const cifraReal = ['[C]', 'Eu sei que Deus e o meu pastor', 'C        G', 'Nada me faltara', 'Am   F   C/G', 'Nada me faltara, Senhor'].join('\n');
  const ck = M.detectKey(cifraReal);
  const ct = M.extractChords(cifraReal).map((x) => x.text).join(' ');
  log('11. cifra com letra: tom=' + M.noteName(ck.pc, false) + ' acordes=[' + ct + ']');

  window.__e2e = out.join('\n');
})();
