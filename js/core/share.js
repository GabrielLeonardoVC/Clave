/* =========================================================
   ACORDE - core/share.js
   Compartilhar escala: texto, .ics (calendario), link, PDF.
   Expõe window.Share.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const S = global.Store;
  const UI = global.UI;
  const M = global.Music;
  const Lk = global.Links;
  const P = global.Print;
  // O `el` faltava aqui. O arquivo inteiro chamava `el(...)` — nove vezes —
  // sem nunca trazê-lo para o escopo, e por isso o menu de compartilhar
  // devolvia `el is not defined` na primeira vez que alguém tocava nele.
  // WhatsApp, e-mail e .ics: nada disso nunca funcionou.
  const { el } = U;

  /* =======================
     TEXTO PARA WHATSAPP
     ======================= */
  function texto(e, opts) {
    opts = opts || {};
    const L = [];
    L.push('*' + e.titulo + (e.hora ? ' — ' + U.fmtTime(e.hora) : '') + '*');
    L.push(U.capitalize(U.DIAS[U.fromKey(e.data).getDay()]) + ', ' + U.fmtDate(e.data) + (e.local ? '\n' + e.local : ''));
    if (e.obs) { L.push(''); L.push('_' + e.obs + '_'); }
    L.push('');
    e.musicas.forEach((m, i) => {
      const bits = [];
      if (m.tom) bits.push(m.tom);
      if (m.bpm) bits.push(m.bpm + ' bpm');
      if (m.categoria) bits.push(m.categoria);
      L.push((i + 1) + '. *' + m.nome + '*' + (bits.length ? '  (' + bits.join(' · ') + ')' : ''));
      if (m.obs) L.push('   > ' + m.obs);
    });
    if (opts.comLinks !== false) {
      L.push('');
      L.push('_Pesquisar:_');
      e.musicas.forEach((m) => {
        const c = Lk.cifras(m.nome, m.artista)[0];
        if (c) L.push('• ' + m.nome + ' — ' + c.url);
      });
    }
    L.push('');
    L.push('_Feito no Acorde_');
    return L.join('\n');
  }

  /* =======================
     ARQUIVO .ics (importa em
     qualquer calendario)
     ======================= */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }
  function dataIcs(data, hora) {
    const [a, m, d] = data.split('-');
    const [h, mi] = (hora || '09:00').split(':');
    return a + m + d + 'T' + (h || '09') + (mi || '00') + '00';
  }
  function duracaoIcs(e) {
    // estimativa: 3 min por música + 2 min de transição
    const min = Math.max(30, e.musicas.length * 3 + 2);
    const h = String(Math.floor(min / 60)).padStart(2, '0');
    const m = String(min % 60).padStart(2, '0');
    return 'PT' + (h !== '00' ? h + 'H' : '') + m + 'M';
  }

  function ics(e) {
    const agora = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const L = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Acorde//Escalas//PT-BR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + e.id + '@acorde',
      'DTSTAMP:' + agora,
      'DTSTART:' + dataIcs(e.data, e.hora),
      'DTEND:' + dataIcs(e.data, adicionarMin(e.hora || '09:00', e.musicas.length * 3 + 2)),
      'SUMMARY:' + esc(e.titulo),
      'LOCATION:' + esc(e.local || ''),
      'DESCRIPTION:' + esc(
        e.musicas.map((m, i) => (i + 1) + '. ' + m.nome + (m.tom ? ' (' + m.tom + ')' : '')).join('\\n')
        + (e.obs ? '\\n\\n' + e.obs : '')
      ),
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:' + esc(e.titulo + ' comecam em 2 horas'),
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    return L.join('\r\n');
  }
  function adicionarMin(hora, min) {
    const [h, m] = hora.split(':').map(Number);
    const t = new Date(2000, 0, 1, h, m + min);
    return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
  }

  function baixarIcs(e) {
    U.download('escala-' + e.data + '.ics', ics(e), 'text/calendar;charset=utf-8');
    UI.toast('Arquivo de calendário salvo', { tipo: 'ok' });
  }

  /* =======================
     COMPARTILHAR
     ======================= */
  function podeNative() { return typeof navigator.share === 'function'; }

  async function menu(e) {
    const corpo = el('div', { class: 'stack gap-2' }, [
      linha('message-circle', 'Enviar pelo WhatsApp/Telegram',
        'Abre o aplicativo com o texto pronto', function () {
          const t = texto(e);
          const wa = 'https://wa.me/?text=' + encodeURIComponent(t);
          if (!U.openLink(wa)) {
            U.copy(t).then(function () {
              UI.toast('Copiado! Cole no seu app de mensagens.', { tipo: 'ok', dur: 4500 });
            });
          }
        }),
      linha('mail', 'Enviar por e-mail', 'Abre o seu programa de e-mail com o texto pronto', function () {
        // O corpo vai em HTML de proposito: e-mail nao formata asterisco nem
        // sublinhado como o WhatsApp. Mandando o mesmo texto dos dois jeitos,
        // o e-mail chega com os asteriscos aparecendo e parece defeito.
        const corpoHtml = e.musicas.map(function (m, idx) {
          const bits = [];
          if (m.tom) bits.push(m.tom);
          if (m.bpm) bits.push(m.bpm + ' bpm');
          return '<li><b>' + (idx + 1) + '. ' + U.esc(m.nome) + '</b>'
            + (bits.length ? ' &mdash; ' + U.esc(bits.join(' / ')) : '')
            + (m.responsavel ? ' <i>(' + U.esc(m.responsavel) + ')</i>' : '')
            + (m.obs ? '<br><small>' + U.esc(m.obs) + '</small>' : '') + '</li>';
        }).join('');

        const html =
          '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">'
          + '<h2 style="margin:0 0 2px">' + U.esc(e.titulo) + '</h2>'
          + '<div style="color:#555;margin-bottom:12px">'
          + U.esc(U.capitalize(U.DIAS[U.fromKey(e.data).getDay()]) + ', ' + U.fmtDate(e.data))
          + (e.hora ? ' as ' + U.esc(U.fmtTime(e.hora)) : '')
          + (e.local ? '<br>' + U.esc(e.local) : '')
          + '</div>'
          + (e.obs
              ? '<p style="background:#f6f3ec;padding:10px;border-left:3px solid #B45309;margin:0 0 14px">'
                + U.esc(e.obs).replace(/\n/g, '<br>') + '</p>'
              : '')
          + (corpoHtml ? '<ol style="margin:0;padding-left:20px">' + corpoHtml + '</ol>'
                        : '<p>Nenhuma musica na escala.</p>')
          + '</div>';

        const assunto = e.titulo + ' - ' + U.fmtDate(e.data) + (e.hora ? ' ' + U.fmtTime(e.hora) : '');
        // mailto nao aceita tudo o que um link normal aceita. O limite e do
        // protocolo, nao do navegador:browsers costumam cortar o assunto e
        // o corpo em poucos milhares de caracteres. Por isso o texto vai curto
        // e a escala grande continua indo pelo WhatsApp.
        const link = 'mailto:?subject=' + encodeURIComponent(assunto)
          + '&body=' + encodeURIComponent(html);
        if (!U.openLink(link)) {
          U.copy(texto(e, { comLinks: true }))
            .then(function () { UI.toast('Copiado! Cole no seu e-mail.', { tipo: 'ok', dur: 4500 }); });
        }
      }),

      // A foto do evento vai anexada, e nao colada no texto.
      //
      // Um data-URL dentro do corpo de um WhatsApp nao vira imagem: vira uma
      // linha de texto do tamanho da foto. E um `mailto:` nao anexa nada, so
      // abre o programa de e-mail com o texto — entao a foto vai pela
      // participacao nativa do sistema, que e o unico jeito de anexar de
      // verdade num celular.
      e.foto ? linha('image-plus', 'Enviar com a foto',
        'Abre a partilha do sistema com o texto e a imagem', function () {
        const arquivo = dataURLParaArquivo(e.foto);
        if (!arquivo) { UI.toast('Nao deu para preparar a foto', { tipo: 'err' }); return; }
        const conteudo = texto(e, { comLinks: true });
        if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
          navigator.share({
            title: e.titulo,
            text: conteudo,
            files: [arquivo],
          }).catch(function () { /* cancelado */ });
          return;
        }
        // O navegador nao aceita arquivo na partilha: cai para o texto, que
        // pelo menos chega com a escala.
        if (navigator.share) {
          navigator.share({ title: e.titulo, text: conteudo }).catch(function () {});
          return;
        }
        U.copy(conteudo).then(function () {
          UI.toast('Copiado! Este navegador nao anexa arquivos.', { tipo: 'ok', dur: 4500 });
        });
      }) : null,
      linha('copy', 'Copiar texto', 'Só a lista, sem links', function () {
        U.copy(texto(e, { comLinks: false }))
          .then(function () { UI.toast('Copiado!', { tipo: 'ok' }); })
          .catch(function () { UI.toast('Não foi possível copiar', { tipo: 'err' }); });
      }),
      linha('calendar-plus', 'Adicionar ao calendário', 'Baixa um .ics (Google, Apple, Outlook)', function () {
        baixarIcs(e);
      }),
      linha('printer', 'Imprimir / PDF', 'Folha A4 com a escala', function () {
        UI.print(P.folhaEscala(e));
      }),
      podeNative() ? linha('share-2', 'Compartilhar via sistema', 'Enviar link ou texto', function () {
        navigator.share({
          title: e.titulo,
          text: texto(e, { comLinks: false }),
          url: location.href,
        }).catch(function () { /* cancelado */ });
      }) : null,
    ]);
    UI.sheet({
      title: 'Compartilhar escala', sub: e.titulo,
      body: corpo,
      foot: [el('button', { class: 'btn btn-secondary btn-block', onclick: function () { UI.closeAllSheets(); } }, 'Fechar')],
    });
    /**
   * Data-URL para um arquivo que a partilha do sistema aceita.
   *
   * O armazenamento guarda a foto como data-URL — e a unica forma de ela
   * sobreviver a um F5 sem servidor. Mas `navigator.share` so anexa um
   * `File` de verdade, entao a base64 precisa virar bytes.
   *
   * Devolve null quando nao da: entao quem chama cai no texto, em vez de
   * falhar calado e a pessoa nao entender por que a foto nao foi.
   */
  function dataURLParaArquivo(dataUrl, nome) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const i = dataUrl.indexOf(',');
    if (i < 0) return null;
    const cabecalho = dataUrl.slice(0, i);
    const base64 = dataUrl.slice(i + 1);
    const tipo = /data:([^;]+)/.exec(cabecalho);
    if (!tipo) return null;
    let bin;
    try { bin = atob(base64); } catch (e) { return null; }
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    const extensao = tipo[1].indexOf('png') >= 0 ? 'png' : 'jpg';
    try {
      return new File([bytes], (nome || 'evento') + '.' + extensao, { type: tipo[1] });
    } catch (e) {
      // Navegador antigo sem o construtor de File.
      return null;
    }
  }

  function linha(ic, titulo, sub, onclick) {
      return el('button', { class: 'list-item tap', style: { width: '100%', textAlign: 'left' }, onclick: onclick }, [
        el('div', { class: 'avatar' }, el('i', { 'data-lucide': ic, style: { width: '17px', height: '17px' } })),
        el('div', { class: 'grow', style: { minWidth: '0' } }, [
          el('div', { class: 'fs-md fw-7' }, titulo),
          el('div', { class: 'fs-xs muted' }, sub),
        ]),
        el('i', { 'data-lucide': 'chevron-right', style: { width: '16px', height: '16px', color: 'var(--ink-4)' } }),
      ]);
    }
  }

  /* =======================
     COMPARTILHAR REPERTORIO
     ======================= */
  function repertorio(cifras) {
    const L = ['*Repertório — Acorde*', ''];
    cifras.forEach((c, i) => {
      const bits = [];
      if (c.tom) bits.push(c.tom);
      if (c.bpm) bits.push(c.bpm + ' bpm');
      L.push((i + 1) + '. *' + c.titulo + '*' + (c.artista ? ' — ' + c.artista : '') + (bits.length ? '  (' + bits.join(' · ') + ')' : ''));
    });
    return L.join('\n');
  }

  /* =======================
     QR / link da equipe
     ======================= */
  function linkDaEscala(e) {
    return location.origin + location.pathname + '#agenda';
  }

  global.Share = { texto, ics, baixarIcs, menu, repertorio, linkDaEscala };
})(typeof window !== 'undefined' ? window : globalThis);
