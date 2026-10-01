/* =========================================================
   Cifras e Escalas Pro — core/print.js
   Geração de folha de escala para impressão e texto simples
   para compartilhamento. Expõe window.Print.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const S = global.Store;
  const M = global.Music;
  const { el, esc } = U;

  /* =======================================================
     Folha A4 para impressão
     ======================================================= */
  function folhaEscala(e) {
    if (!e) return '';
    const titulo = [e.titulo, e.hora ? U.fmtTime(e.hora) : ''].filter(Boolean).join(' · ');
    const meta = [
      U.capitalize(U.DIAS[U.fromKey(e.data).getDay()]) + ', ' + U.fmtDate(e.data),
      e.local,
      e.musicas.length + (e.musicas.length === 1 ? ' música' : ' músicas'),
      e.status === 'confirmada' ? 'Confirmada' : '',
    ].filter(Boolean).join('  ·  ');

    // agrupa por tom (facilita para quem toca)
    const porTom = {};
    e.musicas.forEach((m) => {
      const t = m.tom || '—';
      (porTom[t] = porTom[t] || []).push(m);
    });
    /* A ordem dos tons na impressao e a ordem dos circulos: Re, Mi, Sol, La,
     * Si, Dó, Fa. E a ordem em que quem toca procura o tom no violao, e a
     * ordem em que o olho reconhece um tom sem ler.
     *
     * Havia aqui um `sort` que comparava duas coisas e devolvia zero nos dois
     * casos — ou seja, nao ordenava nada, e ainda calculava `da` sem usar. A
     * lista saia na ordem em que a pessoa cadastrou as musicas, que e
     * aleatoria. */
    const ordem = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db'];
    function pesoDoTom(t) {
      const p = M.parseChord(t);
      if (!p) return 99;                 // "—" e o que nao tem tom: no fim
      const i = ordem.indexOf(M.noteName(p.root, M.useFlatsFor(p.root)));
      return i >= 0 ? i : 99;
    }
    const tomOrdenado = Object.keys(porTom).sort((a, b) => {
      const d = pesoDoTom(a) - pesoDoTom(b);
      return d !== 0 ? d : a.localeCompare(b, 'pt-BR');
    });

    let body = '<div class="ps-head"><h1>' + esc(titulo) + '</h1><div class="meta">' + esc(meta) + '</div></div>';

    if (e.obs) {
      body += '<div class="ps-sec"><h2>Observações</h2><div>' + esc(e.obs).replace(/\n/g, '<br>') + '</div></div>';
    }

    // tabela-resumo
    body += '<div class="ps-sec"><h2>Escala</h2><table class="ps-table"><thead><tr>' +
      '<th>#</th><th>Música</th><th>Tom</th><th>BPM</th><th>Categoria</th><th>Obs</th>' +
      '</tr></thead><tbody>';
    e.musicas.forEach((m, i) => {
      body += '<tr><td>' + (i + 1) + '</td><td>' + esc(m.nome) +
        '</td><td>' + esc(m.tom || '') + '</td><td>' + esc(m.bpm || '') +
        '</td><td>' + esc(m.categoria || '') + '</td><td>' + esc(m.obs || '') + '</td></tr>';
    });
    body += '</tbody></table></div>';

    // agrupado por tom
    if (tomOrdenado.length > 1) {
      body += '<div class="ps-sec"><h2>Por tom</h2>';
      tomOrdenado.forEach((t) => {
        body += '<div style="margin-bottom:4px"><b>' + esc(t) + ':</b> ' +
          esc(porTom[t].map((m) => m.nome).join(', ')) + '</div>';
      });
      body += '</div>';
    }

    // cifras em anexo (opcional: as que estão no repertório)
    const comCifra = e.musicas.filter((m) => m.cifraId && S.cifraPorId(m.cifraId));
    if (comCifra.length) {
      body += '<div class="ps-sec"><h2>Cifras</h2>';
      comCifra.forEach((m) => {
        const c = S.cifraPorId(m.cifraId);
        if (!c) return;
        body += '<div class="ps-song"><div class="t">' + esc(c.titulo) +
          (c.tom ? ' (' + esc(c.tom) + ')' : '') + '</div>' +
          '<div class="ps-cifra">' + esc(c.cifra) + '</div></div>';
      });
      body += '</div>';
    }

    /* As fotos.
     *
     * Antes esta seção imprimia a data-URL da foto como texto. Uma foto de
     * celular shrunk ocupa 100 KB, e a base64 disso vira uma linha de texto que
     * ocupa paginas inteiras de papel — ou, pior, trava a janela de impressão
     * do navegador sem aviso. Quem imprimia uma escala com foto anexada levava
     * uma folha que nao tinha nada a ver com a escala.
     *
     * A foto agora entra como <img>, que e o que a pessoa esperava: a imagem
     * sai na folha. E a imagem e referenciada pelo mesmo `src` que ja estava
     * nos dados, entao nao ha nada para carregar antes de imprimir. */
    const comFoto = e.musicas.filter((m) => m.foto);
    if (comFoto.length) {
      body += '<div class="ps-sec"><h2>Cifras fotográficas</h2>';
      comFoto.forEach((m) => {
        body += '<div class="ps-song"><div class="t">' + esc(m.nome) + '</div>' +
          '<img class="ps-foto" src="' + esc(m.foto) + '" alt="' + esc(m.nome) + '"></div>';
      });
      body += '</div>';
    }

    body += '<div class="ps-foot"><span>' + esc(global.Identidade ? global.Identidade.NOME : 'Clave') +
      '</span><span>' + esc(U.fmtDate(e.data)) + '</span></div>';
    return body;
  }

  /* =======================================================
     Texto simples para colar no WhatsApp
     ======================================================= */
  function textoEscala(e) {
    if (!e) return '';
    const linhas = [];
    const titulo = [e.titulo, e.hora ? U.fmtTime(e.hora) : ''].filter(Boolean).join(' · ');
    linhas.push('*' + titulo + '*');
    linhas.push(U.capitalize(U.DIAS[U.fromKey(e.data).getDay()]) + ', ' + U.fmtDate(e.data) +
      (e.local ? ' · ' + e.local : ''));
    if (e.obs) { linhas.push(''); linhas.push(e.obs); }
    linhas.push('');
    if (!e.musicas.length) {
      linhas.push('(sem músicas)');
    } else {
      e.musicas.forEach((m, i) => {
        const bits = [];
        if (m.tom) bits.push('tom: ' + m.tom);
        if (m.bpm) bits.push(m.bpm + ' bpm');
        if (m.categoria) bits.push(m.categoria);
        linhas.push((i + 1) + '. *' + m.nome + '*' + (bits.length ? '  (' + bits.join(' · ') + ')' : ''));
        if (m.obs) linhas.push('   ' + m.obs);
      });
    }
    return linhas.join('\n');
  }

  /* =======================================================
     Folha de repertório (lista de cifras)
     ======================================================= */
  function folhaCifras(lista, titulo) {
    let body = '<div class="ps-head"><h1>' + esc(titulo || 'Repertório') + '</h1>' +
      '<div class="meta">' + lista.length + ' cifras</div></div>';
    body += '<div class="ps-sec"><table class="ps-table"><thead><tr>' +
      '<th>#</th><th>Música</th><th>Artista</th><th>Tom</th><th>BPM</th><th>Categoria</th>' +
      '</tr></thead><tbody>';
    lista.forEach((c, i) => {
      body += '<tr><td>' + (i + 1) + '</td><td>' + esc(c.titulo) + '</td><td>' + esc(c.artista) +
        '</td><td>' + esc(c.tom) + '</td><td>' + esc(c.bpm || '') + '</td><td>' + esc(c.categoria) + '</td></tr>';
    });
    body += '</tbody></table></div>';
    body += '<div class="ps-foot"><span>' + esc(global.Identidade ? global.Identidade.NOME : 'Clave') +
      '</span><span>' + esc(U.fmtDate(U.todayKey())) + '</span></div>';
    return body;
  }

  global.Print = { folhaEscala, textoEscala, folhaCifras };
})(typeof window !== 'undefined' ? window : globalThis);
