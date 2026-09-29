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
