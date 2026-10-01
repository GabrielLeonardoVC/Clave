/* =========================================================
   ACORDE - views/agenda.js
   Calendario + montagem de escalas de ensaio e missa.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const S = global.Store;
  const UI = global.UI;
  const M = global.Music;
  const R = global.Render;
  const Lk = global.Links;
  const { el, $ } = U;
  const V = global.Views || (global.Views = {});

  const TIPOS = [
    { id: 'missa', nome: 'Missa' },
    { id: 'ensaio', nome: 'Ensaio' },
    { id: 'show', nome: 'Show' },
    { id: 'outro', nome: 'Outro' },
  ];
  const CATEGORIAS = ['Entrada', 'Oferta', 'Leitura', 'Comunhao', 'Ofertorio', 'Saida', 'Fundo', 'Mesa'];

  let ref = new Date();
  let sel = U.todayKey();

  function render(root, params) {
    if (params && params.data) { sel = params.data; ref = U.fromKey(params.data); }
    if (params && params.nova) { sel = U.todayKey(); ref = new Date(); }
    U.clear(root);

    root.appendChild(el('div', { class: 'page-head' }, el('div', { class: 'row between' }, [
      el('div', {}, [el('h1', {}, 'Agenda'), el('div', { class: 'sub' }, 'Ensaios, missas e shows')]),
      el('button', { class: 'btn-icon', 'aria-label': 'Opcoes', onclick: menuDia }, el('i', { 'data-lucide': 'more-vertical' })),
    ])));

    root.appendChild(calendario());
    root.appendChild(listaDia());
    UI.icons(root);

    if (params && params.nova) abrirEditor(null, true);
    if (params && params.abrir) { const e = S.porId(params.abrir); if (e) abrirEditor(e, false); }
  }

  function recarregar() {
    const p = document.getElementById('page-agenda');
    if (p && p.classList.contains('active')) render(p, {});
  }

  /* =======================
     CALENDARIO
     ======================= */
  function calendario() {
    const card = el('div', { class: 'card mb-4' });
    const ano = ref.getFullYear(), mes = ref.getMonth();
    const inicioSemana = S.ajuste('inicioSemana', 0);

    card.appendChild(el('div', { class: 'cal-toolbar' }, [
      el('button', { class: 'btn-icon', 'aria-label': 'Mes anterior', onclick: function () { ref = U.addMonths(ref, -1); recarregar(); } },
        el('i', { 'data-lucide': 'chevron-left' })),
      el('div', { class: 'month-label' }, [el('div', {}, U.capitalize(U.MESES[mes])), el('small', {}, String(ano))]),
      el('button', { class: 'btn-icon', 'aria-label': 'Proximo mes', onclick: function () { ref = U.addMonths(ref, 1); recarregar(); } },
        el('i', { 'data-lucide': 'chevron-right' })),
    ]));

    const dow = el('div', { class: 'cal-dow' });
    for (let i = 0; i < 7; i++) {
      const idx = (inicioSemana + i) % 7;
      dow.appendChild(el('span', { class: (idx === 0 || idx === 6) ? 'we' : '' }, U.DIAS_CURTOS[idx].slice(0, 3)));
    }
    card.appendChild(dow);

    const grid = el('div', { class: 'cal-grid' });
    const primeiro = new Date(ano, mes, 1);
    const startDow = (primeiro.getDay() - inicioSemana + 7) % 7;
    const inicio = new Date(ano, mes, 1 - startDow, 12);

    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i, 12);
      if (i >= 35 && d.getMonth() !== mes) break;
      const key = U.toKey(d);
      const evs = S.porData(key);
      const cls = ['cal-cell'];
      if (d.getMonth() !== mes) cls.push('out');
      if (U.isSameDay(d, new Date())) cls.push('today');
      if (key === sel) cls.push('sel');
      grid.appendChild(el('button', {
        class: cls.join(' '),
        'aria-label': U.fmtDateLong(key) + (evs.length ? ' (' + evs.length + ' evento)' : ''),
        onclick: function () { sel = key; recarregar(); },
      }, [
        el('span', { class: 'n' }, String(d.getDate())),
        evs.length ? el('span', { class: 'dots' }, evs.slice(0, 3).map(function (e) {
          return el('i', { class: e.status === 'confirmada' ? '' : 'warn' });
        })) : null,
        evs.length > 3 ? el('span', { class: 'cnt' }, String(evs.length)) : null,
      ]));
    }
    card.appendChild(grid);

    card.appendChild(el('div', { class: 'row gap-2 mt-3 wrap' }, [
      mini('calendar-check', 'Hoje', function () { sel = U.todayKey(); ref = new Date(); recarregar(); }),
      mini('copy', 'Copiar semana', copiarSemana),
      mini('arrow-right', 'Ir para', irPara),
    ]));
    return card;
  }

  function mini(icon, label, onclick) {
    return el('button', { class: 'btn btn-secondary btn-sm', onclick: onclick }, [el('i', { 'data-lucide': icon }), label]);
  }

  function irPara() {
    const input = el('input', { type: 'date', class: 'input', value: sel });
    const h = UI.sheet({
      title: 'Ir para data', body: el('div', {}, [el('label', { class: 'label' }, 'Data'), input]),
      foot: [
        el('button', { class: 'btn btn-secondary', onclick: function () { h.close(); } }, 'Cancelar'),
        el('button', { class: 'btn btn-primary', onclick: function () { sel = input.value || sel; ref = U.fromKey(sel); h.close(); recarregar(); } }, 'Ir'),
      ],
    });
  }

  function menuDia() {
    const evs = S.porData(sel);
    const body = el('div', { class: 'stack gap-2' }, [
      el('p', { class: 'fs-sm muted' }, U.fmtDateLong(sel) + ' - ' + evs.length + (evs.length === 1 ? ' evento' : ' eventos')),
      el('button', { class: 'btn btn-primary btn-block', onclick: function () { UI.closeAllSheets(); abrirEditor(null, true); } },
        [el('i', { 'data-lucide': 'plus' }), 'Novo evento neste dia']),
    ]);
    if (evs.length) {
      body.appendChild(el('div', { class: 'hr-label' }, 'Existentes'));
      evs.forEach(function (e) {
        body.appendChild(el('button', { class: 'list-item tap', style: { width: '100%' }, onclick: function () { UI.closeAllSheets(); abrirEditor(e, false); } }, [
          el('div', { class: 'avatar' }, el('i', { 'data-lucide': 'list-music', style: { width: '17px', height: '17px' } })),
          el('div', { class: 'grow', style: { textAlign: 'left', minWidth: '0' } }, [
            el('div', { class: 'fs-md fw-7 ellipsis' }, e.titulo),
            el('div', { class: 'fs-xs muted' }, (e.hora ? U.fmtTime(e.hora) + ' - ' : '') + e.musicas.length + ' musicas'),
          ]),
        ]));
      });
    }
    UI.sheet({ title: 'Acoes do dia', body: body, foot: [el('button', { class: 'btn btn-secondary btn-block', onclick: function () { UI.closeAllSheets(); } }, 'Fechar')] });
  }
  /* =======================
     LISTA DO DIA
     ======================= */
  function listaDia() {
    const wrap = el('div', {});
    const evs = S.porData(sel);
    wrap.appendChild(el('div', { class: 'row between mt-4 mb-3' }, [
      el('div', {}, [
        el('h2', { class: 'fs-lg fw-8', style: { fontFamily: 'var(--font-d)' } }, U.fmtDateLong(sel)),
        el('div', { class: 'fs-xs muted' }, U.fmtRelativeDay(sel)),
      ]),
      el('button', { class: 'btn btn-primary btn-sm', onclick: function () { abrirEditor(null, true); } }, [el('i', { 'data-lucide': 'plus' }), 'Novo']),
    ]));
    if (!evs.length) {
      wrap.appendChild(UI.empty({
        icon: 'calendar-off', title: 'Nada neste dia',
        message: 'Crie um ensaio, uma missa ou um show. Da para ter varios no mesmo dia.',
        action: { label: 'Criar evento', icon: 'plus', onClick: function () { abrirEditor(null, true); } },
      }));
      return wrap;
    }
    const l = el('div', { class: 'day-events' });
    evs.forEach(function (e) { l.appendChild(cardEscala(e)); });
    wrap.appendChild(l);
    return wrap;
  }

  function cardEscala(e) {
    const tons = {};
    e.musicas.forEach(function (m) { if (m.tom) tons[m.tom] = (tons[m.tom] || 0) + 1; });
    const listaTons = Object.keys(tons).map(function (t) { return t + (tons[t] > 1 ? ' (' + tons[t] + ')' : ''); }).join(' - ');
    const d = U.diffDays(new Date(), U.fromKey(e.data));
    // quem toca e o que precisa lembrar
    const resps = [];
    e.musicas.forEach(function (m) { if (m.responsavel && resps.indexOf(m.responsavel) < 0) resps.push(m.responsavel); });
    const nResp = resps.length === 1 ? resps[0] : (resps.length > 1 ? resps.length + ' pessoas' : '');
    const nObs = e.musicas.filter(function (m) { return m.obs; }).length;

    return el('div', { class: 'day-ev t-' + e.tipo }, [
      el('div', { style: { flex: '1 1 auto', minWidth: '0', cursor: 'pointer' }, onclick: function () { abrirEditor(e, false); } }, [
        el('div', { class: 'row gap-2 between' }, [
          el('span', { class: 'ttl grow ellipsis' }, e.titulo),
          e.status === 'confirmada' ? el('span', { class: 'badge badge-ok' }, [el('i', { 'data-lucide': 'check' }), 'OK']) : null,
        ]),
        el('div', { class: 'sub' }, [e.hora ? U.fmtTime(e.hora) + ' - ' : '', e.local].join('').replace(/ - $/, '')),
        el('div', { class: 'row gap-2 mt-2 wrap' }, [
          el('span', { class: 'badge badge-brand' }, [el('i', { 'data-lucide': 'music' }), String(e.musicas.length)]),
          listaTons ? el('span', { class: 'badge badge-key' }, listaTons) : null,
          d === 0 ? el('span', { class: 'badge badge-warn' }, 'hoje') : null,
          resps.length ? el('span', {
            class: 'badge badge-info', title: 'Quem toca: ' + resps.join(', '),
            onclick: function (ev) { ev.stopPropagation(); verResponsaveis(e); },
          }, [el('i', { 'data-lucide': 'users' }), nResp]) : null,
          nObs ? el('span', {
            class: 'badge badge-warn', title: 'Observacoes',
            onclick: function (ev) { ev.stopPropagation(); verObservacoes(e); },
          }, [el('i', { 'data-lucide': 'message-square' }), String(nObs)]) : null,
        ]),
      ]),
      el('div', { class: 'stack', style: { gap: '4px', flex: 'none' } }, [
        el('button', { class: 'btn-icon sm', 'aria-label': 'Compartilhar', onclick: function (ev) { ev.stopPropagation(); global.Share.menu(e); } },
          el('i', { 'data-lucide': 'share-2' })),
        el('button', { class: 'btn-icon sm', 'aria-label': 'Mais', onclick: function (ev) { ev.stopPropagation(); menuEscala(e); } },
          el('i', { 'data-lucide': 'more-vertical' })),
      ]),
    ]);
  }

  function menuEscala(e) {
    const linhas = [
      ['list-music', 'Abrir / editar', function () { abrirEditor(e, false); }],
      ['play-circle', 'Abrir no estudio', function () {
        if (e.musicas.length) global.Studio.abrir(e.musicas[0], e);
        else UI.toast('Adicione musicas primeiro', { tipo: 'err' });
      }],
      ['share-2', 'Compartilhar / .ics / imprimir', function () { global.Share.menu(e); }],
      ['copy', 'Duplicar nesta data', function () { duplicar(e); }],
      ['check-circle-2', e.status === 'confirmada' ? 'Voltar para rascunho' : 'Confirmar escala', function () { alternarStatus(e); recarregar(); }],
      ['trash-2', 'Excluir', function () { confirmarExcluir(e); }, 'var(--danger-500)'],
    ];
    UI.sheet({
      title: e.titulo, sub: U.fmtDateLong(e.data) + (e.hora ? ' - ' + U.fmtTime(e.hora) : ''),
      body: el('div', { class: 'stack gap-2' }, linhas.map(function (l) {
        return el('button', { class: 'list-item tap', style: { width: '100%', color: l[3] || '' }, onclick: function () { UI.closeAllSheets(); l[2](); } },
          [el('i', { 'data-lucide': l[0], style: { width: '18px', height: '18px' } }), el('span', { class: 'fs-md' }, l[1])]);
      })),
      foot: [el('button', { class: 'btn btn-secondary btn-block', onclick: function () { UI.closeAllSheets(); } }, 'Fechar')],
    });
  }

  function alternarStatus(e) {
    const x = S.porId(e.id);
    if (!x) return;
    x.status = (x.status === 'confirmada') ? 'rascunho' : 'confirmada';
    S.mudou('escala');
    UI.toast(x.status === 'confirmada' ? 'Escala confirmada' : 'Marcada como rascunho', { tipo: 'ok' });
  }

  function duplicar(e) {
    const c = JSON.parse(JSON.stringify(e));
    c.id = U.uid('esc');
    c.titulo = e.titulo + ' (copia)';
    c.musicas.forEach(function (m) { m.id = U.uid('mus'); });
    S.db.escalas.push(c);
    S.mudou('escala');
    sel = c.data;
    UI.toast('Escala duplicada', { tipo: 'ok' });
    abrirEditor(c, false);
  }

  function confirmarExcluir(e) {
    UI.confirmar({
      title: 'Excluir evento', danger: true, okText: 'Excluir',
      message: 'Excluir "' + e.titulo + '" de ' + U.fmtDate(e.data) + '? Nao da para desfazer.',
    }).then(function (ok) {
      if (!ok) return;
      const i = S.db.escalas.findIndex(function (x) { return x.id === e.id; });
      if (i >= 0) S.db.escalas.splice(i, 1);
      S.mudou('escala');
      UI.closeAllSheets();
      UI.toast('Evento excluido', { tipo: 'ok' });
      recarregar();
    });
  }

  /* =======================
     EDITOR
     ======================= */
  function campo(label, control) { return el('div', { class: 'field' }, [el('label', { class: 'label' }, label), control]); }

  /**
   * Escolhe a foto do evento.
   *
   * A encolhe para 1400px antes de guardar. A foto do celular tem tres mil
   * pixels de lado e quase quatro megabytes de base64 — guardada assim, dez
   * eventos estouram a cota do armazenamento e o app deixa de salvar sem
   * avisar. O mesmo caminho que a foto de cada musica usa.
   */
  function escolherFotoDoEvento(alvo) {
    const entrada = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    document.body.appendChild(entrada);
    entrada.addEventListener('change', function () {
      const arq = entrada.files[0];
      document.body.removeChild(entrada);
      if (!arq) return;
      U.readFile(arq, true)
        .then(function (d) { return U.shrinkImage(d, 1400, 0.8); })
        .then(function (p) {
          if (!p) { UI.toast('Nao deu para ler a imagem', { tipo: 'err' }); return; }
          alvo.foto = p;
          UI.toast('Foto anexada ao evento', { tipo: 'ok' });
          // A escala e re-renderizada para a foto aparecer na hora, em vez
          // de so quando a pessoa sair e voltar.
          if (typeof renderLista === 'function') renderLista();
          const p2 = document.querySelector('.foto-ev');
          if (p2) {
            p2.innerHTML = '';
            p2.appendChild(el('img', { class: 'foto-evia', src: p, alt: 'Foto do evento' }));
          }
        })
        .catch(function () { UI.toast('Nao deu para ler a imagem', { tipo: 'err' }); });
    });
    entrada.click();
  }

  function abrirEditor(existente, isNew) {
    const base = existente ? JSON.parse(JSON.stringify(existente)) : S.normEscala({ data: sel, hora: '19:00', tipo: 'missa' });
    const form = el('div', { class: 'stack gap-3' });

    const fTitulo = el('input', { class: 'input', value: base.titulo, placeholder: 'Ex.: Ensaio de quinta' });
    const fHora = el('input', { class: 'input', type: 'time', value: base.hora || '' });
    const fLocal = el('input', { class: 'input', value: base.local, placeholder: 'Ex.: Salão paroquial' });
    const fTipo = el('select', { class: 'select' }, TIPOS.map(function (t) { return el('option', { value: t.id, selected: base.tipo === t.id }, t.nome); }));
    const fData = el('input', { class: 'input', type: 'date', value: base.data });
    const fObs = el('textarea', { class: 'textarea', style: { minHeight: '70px' }, placeholder: 'Observacoes, tema, avisos...' });
    fObs.value = base.obs;

    form.appendChild(campo('Titulo do evento', fTitulo));
    form.appendChild(el('div', { class: 'grid-2' }, [campo('Data', fData), campo('Horario', fHora)]));
    form.appendChild(el('div', { class: 'grid-2' }, [campo('Local', fLocal), campo('Tipo', fTipo)]));
    form.appendChild(campo('Observacoes', fObs));

    // ---- a foto do evento ----
    //
    // Cada musica tem a sua foto; o evento nao tinha nenhuma. E a do evento
    // que e a que as pessoas mandam no grupo antes de todo mundo confirmar:
    // o aviso, a partitura do grupo, o mapa de quem fica onde.
    const fFoto = el('div', { class: 'foto-ev' });

    function pintarFoto() {
      U.clear(fFoto);
      if (!base.foto) {
        fFoto.appendChild(el('button', {
          class: 'btn btn-soft btn-sm', type: 'button',
          onclick: function () { escolherFotoDoEvento(base); },
        }, [el('i', { 'data-lucide': 'image' }), 'Anexar foto do evento']));
        fFoto.appendChild(el('div', { class: 'fs-xs muted mt-1' },
          'O aviso, a partitura do grupo, o mapa. Aparece ao enviar.'));
        return;
      }
      fFoto.appendChild(el('div', { class: 'row gap-2 wrap' }, [
        el('img', { class: 'foto-evia', src: base.foto, alt: 'Foto do evento' }),
        el('button', {
          class: 'btn-icon sm danger', type: 'button', 'aria-label': 'Trocar a foto',
          onclick: function () { escolherFotoDoEvento(base); },
        }, el('i', { 'data-lucide': 'refresh-cw' })),
        el('button', {
          class: 'btn-icon sm danger', type: 'button', 'aria-label': 'Remover a foto',
          onclick: function () { base.foto = ''; pintarFoto(); },
        }, el('i', { 'data-lucide': 'trash-2' })),
      ]));
    }
    pintarFoto();

    form.appendChild(el('div', { class: 'section-title' }, [el('i', { 'data-lucide': 'image' }), 'Foto do evento']));
    form.appendChild(fFoto);

    const listaBox = el('div', {});
    form.appendChild(el('div', { class: 'hr-label' }, 'Musicas'));
    form.appendChild(listaBox);

    function renderLista() {
      U.clear(listaBox);
      if (!base.musicas.length) {
        listaBox.appendChild(el('p', { class: 'fs-sm muted center', style: { padding: '14px 0' } },
          'Nenhuma musica. Puxe do repertorio ou crie na hora.'));
      } else {
        const box = el('div', { class: 'card card-flat', style: { padding: '6px 12px' } });
        base.musicas.forEach(function (m, i) {
          const mover = function (dir) {
            const j = i + dir;
            if (j < 0 || j >= base.musicas.length) return;
            const t = base.musicas[i]; base.musicas[i] = base.musicas[j]; base.musicas[j] = t;
            renderLista();
          };
          // A linha inteira e clicavel e abre a pagina da musica. Antes so havia o
          // botao do Estudio, e as anotacoes que aparecem aqui — "obs", "foto",
          // o icone do YouTube — nao tinham para onde levar. A badge "obs" era
          // um aviso de que existia uma anotacao em lugar nenhum.
          box.appendChild(el('div', {
            class: 'row gap-2', style: { padding: '9px 0', borderBottom: i < base.musicas.length - 1 ? '1px solid var(--line)' : 'none' },
            role: 'button', tabindex: '0',
            title: 'Abrir ' + m.nome,
            onclick: function () { if (V.cancao) V.cancao.abrir(m, base); },
            onkeydown: function (ev) {
              if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (V.cancao) V.cancao.abrir(m, base); }
            },
          }, [
            el('span', { class: 'mono fs-xs muted', style: { width: '18px', flex: 'none' } }, String(i + 1)),
            el('div', { class: 'grow', style: { minWidth: '0' } }, [
              el('div', { class: 'fs-md fw-7 ellipsis' }, m.nome),
              el('div', { class: 'row gap-1 wrap' }, [
                m.tom ? el('span', { class: 'badge badge-key' }, m.tom) : null,
                m.bpm ? el('span', { class: 'badge' }, m.bpm + ' bpm') : null,
                m.categoria ? el('span', { class: 'badge' }, m.categoria) : null,
                (m.yt || m.ytId) ? el('span', { class: 'badge badge-yt' }, [el('i', { 'data-lucide': 'youtube' })]) : null,
                m.foto ? el('span', { class: 'badge badge-info' }, 'foto') : null,
                m.obs ? el('span', { class: 'badge badge-warn' }, 'obs') : null,
              ]),
            ]),
            el('button', {
              class: 'btn-icon sm', 'aria-label': 'Abrir no estudio', type: 'button',
              onclick: function (ev) { ev.stopPropagation(); global.Studio.abrir(m, base); },
            }, el('i', { 'data-lucide': 'play-circle' })),
            el('button', { class: 'btn-icon sm', 'aria-label': 'Subir', disabled: i === 0, onclick: function () { mover(-1); } },
              el('i', { 'data-lucide': 'chevron-up' })),
            el('button', { class: 'btn-icon sm danger', 'aria-label': 'Remover', onclick: function () { base.musicas.splice(i, 1); renderLista(); } },
              el('i', { 'data-lucide': 'x' })),
          ]));
        });
        listaBox.appendChild(box);
      }
      listaBox.appendChild(el('div', { class: 'row gap-2 mt-3 wrap' }, [
        el('button', { class: 'btn btn-soft btn-sm', onclick: function () { escolherDoRepertorio(base, renderLista); } },
          [el('i', { 'data-lucide': 'library' }), 'Do repertorio']),
        el('button', { class: 'btn btn-soft btn-sm', onclick: function () { addMusica(base, renderLista); } },
          [el('i', { 'data-lucide': 'plus' }), 'Nova musica']),
      ]));
      UI.icons(listaBox);
    }
    renderLista();

    function coletar() {
      base.titulo = fTitulo.value.trim() || 'Evento';
      base.data = fData.value || base.data;
      base.hora = fHora.value;
      base.local = fLocal.value.trim();
      base.tipo = fTipo.value;
      base.obs = fObs.value;
      // A foto ja esta em `base`: o seletor mexe no objeto. Sem linha de
      // gravacao aqui de proposito — uma copia que so existisse no formulario
      // sumiria ao trocar de aba sem salvar, que e como a foto sumia.
    }

    const h = UI.sheet({
      title: isNew ? 'Novo evento' : 'Editar evento', sub: U.fmtDateLong(base.data),
      wide: true, body: form,
      foot: [
        !isNew ? el('button', { class: 'btn btn-danger', onclick: function () { h.close(); confirmarExcluir(base); } },
          [el('i', { 'data-lucide': 'trash-2' }), 'Excluir']) : el('span', { class: 'grow' }),
        el('button', { class: 'btn btn-secondary', onclick: function () { h.close(); } }, 'Cancelar'),
        el('button', { class: 'btn btn-success', onclick: function () { coletar(); salvar(base); h.close(); } },
          [el('i', { 'data-lucide': 'check' }), 'Salvar']),
      ].filter(Boolean),
    });
    setTimeout(function () { fTitulo.focus(); }, 90);
  }

  function salvar(e) {
    e.atualizadaEm = Date.now();
    const i = S.db.escalas.findIndex(function (x) { return x.id === e.id; });
    if (i >= 0) S.db.escalas[i] = e; else S.db.escalas.push(e);
    S.mudou('escala');
    sel = e.data; ref = U.fromKey(e.data);
    UI.toast('Salvo!', { tipo: 'ok' });
    recarregar();
  }
  /* =======================
     NOVA MUSICA
     ======================= */
  function addMusica(escala, onChange) {
    const nome = el('input', { class: 'input', placeholder: 'Nome da musica' });
    const artista = el('input', { class: 'input', placeholder: 'Artista / compositor' });
    const tom = R.selectTon({ value: '', placeholder: 'Tom' });
    const bpm = el('input', { class: 'input', type: 'number', min: '20', max: '320', placeholder: 'BPM' });
    const comp = el('select', { class: 'select' }, global.Metro.COMPASSOS.map(function (c) { return el('option', { value: c.v }, c.n); }));
    const cat = el('select', { class: 'select' }, [el('option', { value: '' }, 'Categoria')].concat(CATEGORIAS.map(function (c) { return el('option', { value: c }, c); })));
    const resp = el('input', { class: 'input', placeholder: 'Quem toca / responsavel' });
    const obs = el('input', { class: 'input', placeholder: 'Observacao (ex.: sobe no refrão)' });
    const yt = el('input', { class: 'input', placeholder: 'Link do YouTube (a gente extrai o video)' });

    let foto = '';
    const preview = el('img', { style: { display: 'none', maxHeight: '110px', borderRadius: '10px', margin: '0 auto' } });
    const arq = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    const drop = el('div', { class: 'drop' }, [
      el('i', { 'data-lucide': 'camera' }),
      el('div', { class: 't' }, 'Foto da cifra'),
      el('div', { class: 's' }, 'Da para desenhar em cima no Estudio'),
      preview,
    ]);
    drop.addEventListener('click', function () { arq.click(); });
    arq.addEventListener('change', function () {
      if (!arq.files[0]) return;
      U.readFile(arq.files[0], true).then(function (d) { return U.shrinkImage(d, 1300, 0.78); })
        .then(function (p) { foto = p; preview.src = p; preview.style.display = 'block'; });
    });

    const h = UI.sheet({
      title: 'Nova musica', sub: 'Adiciona a este evento',
      body: el('div', { class: 'stack gap-3' }, [
        campo('Nome *', nome), campo('Artista', artista),
        el('div', { class: 'grid-3' }, [campo('Tom', tom), campo('BPM', bpm), campo('Compasso', comp)]),
        el('div', { class: 'grid-2' }, [campo('Categoria', cat), campo('Responsavel', resp)]),
        campo('Observacao', obs), campo('YouTube', yt),
        drop, arq,
      ]),
      foot: [
        el('button', { class: 'btn btn-secondary', onclick: function () { h.close(); } }, 'Cancelar'),
        el('button', { class: 'btn btn-primary', onclick: function () {
          const n = nome.value.trim();
          if (!n) { nome.focus(); return; }
          const ytId = Lk.extrairYouTubeId(yt.value.trim());
          escala.musicas.push(S.normMusica({
            nome: n, artista: artista.value.trim(), tom: tom.value, bpm: bpm.value,
            compasso: comp.value, categoria: cat.value, responsavel: resp.value.trim(),
            obs: obs.value.trim(), yt: yt.value.trim(), ytId: ytId, foto: foto,
          }));
          onChange(); h.close();
          UI.toast('Musica adicionada', { tipo: 'ok' });
        } }, 'Adicionar'),
      ],
    });
    setTimeout(function () { nome.focus(); }, 90);
  }

  function escolherDoRepertorio(escala, onChange) {
    const lista = S.cifras();
    const busca = el('input', { class: 'input', placeholder: 'Buscar no repertorio...' });
    const box = el('div', { class: 'mt-3', style: { maxHeight: '50vh', overflowY: 'auto' } });
    const h = UI.sheet({ title: 'Do repertorio', sub: lista.length + ' cifras salvas', body: el('div', {}, [busca, box]),
      foot: [el('button', { class: 'btn btn-secondary btn-block', onclick: function () { h.close(); } }, 'Fechar')] });

    function pintar() {
      const q = U.norm(busca.value.trim());
      const itens = S.filtrarCifras({ q: q }).filter(function (c) {
        return !escala.musicas.some(function (m) { return m.cifraId === c.id; });
      });
      U.clear(box);
      if (!itens.length) {
        box.appendChild(UI.empty({ icon: 'library', title: 'Nada aqui', message: 'Salve cifras em Repertorio - Nova cifra.' }));
        return;
      }
      const l = el('div', { class: 'list' });
      itens.forEach(function (c) {
        l.appendChild(el('button', { class: 'list-item tap', style: { width: '100%', textAlign: 'left' }, onclick: function () {
          escala.musicas.push(S.normMusica({
            nome: c.titulo, artista: c.artista, tom: c.tom, bpm: c.bpm,
            compasso: c.compasso, categoria: c.categoria, cifraId: c.id,
          }));
          onChange();
          UI.toast('"' + c.titulo + '" adicionada', { tipo: 'ok' });
          pintar();
        } }, [
          el('div', { class: 'avatar' }, el('i', { 'data-lucide': 'file-music', style: { width: '17px', height: '17px' } })),
          el('div', { class: 'grow', style: { minWidth: '0' } }, [
            el('div', { class: 'fs-md fw-7 ellipsis' }, c.titulo),
            el('div', { class: 'fs-xs muted ellipsis' }, [c.artista, c.tom].filter(Boolean).join(' - ')),
          ]),
          el('i', { 'data-lucide': 'plus', style: { width: '16px', height: '16px', color: 'var(--primary)' } }),
        ]));
      });
      box.appendChild(l);
    }
    busca.addEventListener('input', U.debounce(pintar, 130));
    pintar();
  }

  function copiarSemana() {
    const origem = S.ultimas(1)[0];
    if (!origem) { UI.toast('Nenhuma escala anterior', { tipo: 'err' }); return; }
    const nova = JSON.parse(JSON.stringify(origem));
    nova.id = U.uid('esc');
    nova.musicas.forEach(function (m) { m.id = U.uid('mus'); });
    S.db.escalas.push(nova);
    S.mudou('escala');
    sel = nova.data; ref = U.fromKey(nova.data);
    UI.toast('Copiada para ' + U.fmtDate(nova.data), { tipo: 'ok' });
    recarregar();
  }


  /* =======================
     DETALHES RÁPIDOS
     ======================= */
  function verResponsaveis(e) {
    const linhas = e.musicas.filter(function (m) { return m.responsavel; });
    if (!linhas.length) return;
    UI.sheet({
      title: 'Quem toca', sub: e.titulo,
      body: el('div', { class: 'list' }, linhas.map(function (m) {
        return el('div', { class: 'list-item' }, [
          el('div', { class: 'avatar' }, el('i', { 'data-lucide': 'user', style: { width: '17px', height: '17px' } })),
          el('div', { class: 'grow', style: { minWidth: '0' } }, [
            el('div', { class: 'fs-md fw-7 ellipsis' }, m.responsavel),
            el('div', { class: 'fs-xs muted ellipsis' }, m.nome + (m.tom ? ' (' + m.tom + ')' : '')),
          ]),
        ]);
      })),
      foot: [el('button', { class: 'btn btn-secondary btn-block', onclick: function () { UI.closeAllSheets(); } }, 'Fechar')],
    });
  }

  function verObservacoes(e) {
    const linhas = e.musicas.filter(function (m) { return m.obs; });
    if (!linhas.length) return;
    UI.sheet({
      title: 'Observações', sub: e.titulo,
      body: el('div', { class: 'list' }, linhas.map(function (m) {
        return el('div', { class: 'list-item', style: { alignItems: 'flex-start' } }, [
          el('div', { class: 'avatar' }, el('i', { 'data-lucide': 'message-square', style: { width: '17px', height: '17px' } })),
          el('div', { class: 'grow', style: { minWidth: '0' } }, [
            el('div', { class: 'fs-md fw-7 ellipsis' }, m.nome),
            el('div', { class: 'fs-sm c-2' }, m.obs),
          ]),
        ]);
      })),
      foot: [el('button', { class: 'btn btn-secondary btn-block', onclick: function () { UI.closeAllSheets(); } }, 'Fechar')],
    });
  }
  V.agenda = { render: render, abrirEditor: abrirEditor };
})(typeof window !== 'undefined' ? window : globalThis);