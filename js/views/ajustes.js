/* =========================================================
   ACORDE - views/ajustes.js
   Aparencia, lembretes, dados e plano.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const S = global.Store;
  const UI = global.UI;
  const { el, $ } = U;
  const V = global.Views || (global.Views = {});

  /**
   * Acentos disponiveis.
   *
   * Nao ha hex aqui: a amostra do botao mede o CSS de verdade, em
   * corRealDoAcento. Guardar a cor nesta lista e o que fazia a amostra
   * divergir do que o app realmente aplica. Esta lista precisa cobrir todo
   * acento que o CSS declara — um que exista no CSS e nao aqui nunca seria
   * oferecido a pessoa.
   */
  const ACCENTS = [
    { id: 'ember', nome: 'Brasa' },
    { id: 'ambar', nome: 'Ambar' },
    { id: 'coral', nome: 'Coral' },
    { id: 'lima', nome: 'Lima' },
    { id: 'floresta', nome: 'Floresta' },
    { id: 'jade', nome: 'Jade' },
    { id: 'turquesa', nome: 'Turquesa' },
    { id: 'ocean', nome: 'Mar' },
    { id: 'azul', nome: 'Azul' },
    { id: 'indigo', nome: 'Indigo' },
    { id: 'violet', nome: 'Violeta' },
    { id: 'lilas', nome: 'Lilas' },
    { id: 'magenta', nome: 'Magenta' },
    { id: 'rose', nome: 'Rosa' },
  ];

  /**
   * A cor que o app realmente aplica para um acento.
   *
   * A amostra do botao e medida no proprio CSS, e nao escrita aqui. A lista
   * guardava o hex do `--brand-500`, mas o que a tela usa e o `--primary`, que
   * e o `--brand-400` — outra cor. As cinco amostras mostravam algo diferente
   * do que a pessoa recebia, e no "Brasa", que e o padrao, nem batia com a
   * definicao do tema. Medindo, a amostra nao tem como divergir: se o CSS
   * mudar, o botao acompanha.
   */
  function corRealDoAcento(id) {
    const sonda = el('span', { 'data-accent': id });
    sonda.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden';
    document.body.appendChild(sonda);
    const cor = getComputedStyle(sonda).getPropertyValue('--primary').trim();
    sonda.remove();
    return cor;
  }

  function render(root) {
    U.clear(root);
    root.appendChild(el('div', { class: 'page-head' }, [
      el('h1', {}, 'Ajustes'),
      el('div', { class: 'sub' }, 'Do jeito que fica melhor para você'),
    ]));

    /* ---------- aparencia ---------- */
    root.appendChild(secao('palette', 'Aparência'));
    const ap = el('div', { class: 'card' });

    ap.appendChild(el('label', { class: 'label' }, 'Cor do app'));
    const cores = el('div', { class: 'row gap-2 wrap mb-3' });
    const atual = S.ajuste('accent', 'ember');
    ACCENTS.forEach(function (a) {
      const b = el('button', {
        class: 'st-cor' + (a.id === atual ? ' on' : ''), style: { background: corRealDoAcento(a.id), width: '32px', height: '32px' },
        'aria-label': a.nome, title: a.nome, 'aria-pressed': a.id === atual ? 'true' : 'false',
        onclick: function () {
          S.setAjuste('accent', a.id);
          global.App.aplicarTema();
          U.$$('.st-cor', cores).forEach(function (x, i) {
            const ligado = ACCENTS[i].id === a.id;
            x.classList.toggle('on', ligado);
            x.setAttribute('aria-pressed', ligado ? 'true' : 'false');
          });
        },
      });
      cores.appendChild(b);
    });
    ap.appendChild(cores);

    ap.appendChild(el('label', { class: 'label' }, 'Tema'));
    const tema = S.ajuste('tema', 'auto');
    ap.appendChild(el('div', { class: 'row gap-2 mb-3' }, [
      { v: 'auto', n: 'Automatico', i: 'sun-moon' }, { v: 'light', n: 'Claro', i: 'sun' }, { v: 'dark', n: 'Escuro', i: 'moon' },
    ].map(function (o) {
      return el('button', {
        class: 'btn ' + (tema === o.v ? 'btn-primary' : 'btn-secondary') + ' grow',
        onclick: function () { S.setAjuste('tema', o.v); global.App.aplicarTema(); recarregar(); },
      }, [el('i', { 'data-lucide': o.i }), o.n]);
    })));

    ap.appendChild(el('label', { class: 'label' }, 'Densidade'));
    ap.appendChild(el('div', { class: 'chips mb-3' }, [
      { v: 'compact', n: 'Compacta' }, { v: 'normal', n: 'Normal' }, { v: 'roomy', n: 'Ampla' },
    ].map(function (o) {
      return el('button', { class: 'chip', 'aria-pressed': String(S.ajuste('densidade', 'normal') === o.v),
        onclick: function () { S.setAjuste('densidade', o.v); global.App.aplicarTema(); recarregar(); } }, o.n);
    })));

    ap.appendChild(el('label', { class: 'label' }, 'Tamanho do texto'));
    ap.appendChild(el('div', { class: 'chips mb-3' }, [
      { v: 'small', n: 'Pequeno' }, { v: 'normal', n: 'Normal' }, { v: 'large', n: 'Grande' },
    ].map(function (o) {
      return el('button', { class: 'chip', 'aria-pressed': String(S.ajuste('fontsize', 'normal') === o.v),
        onclick: function () { S.setAjuste('fontsize', o.v); global.App.aplicarTema(); recarregar(); } }, o.n);
    })));

    ap.appendChild(linhaChave('Reduzir animacoes', 'Para quem se incomoda com movimento',
      S.ajuste('motion', 'on') === 'off', function (v) { S.setAjuste('motion', v ? 'off' : 'on'); global.App.aplicarTema(); }));
    root.appendChild(ap);

    /* ---------- lembretes ---------- */
    root.appendChild(secao('bell', 'Lembretes'));
    const lem = el('div', { class: 'card' });
    lem.appendChild(linhaChave('Avisar antes de cada evento', 'Notificacao do navegador',
      !!S.ajuste('notificacoes', true), function (v) {
        S.setAjuste('notificacoes', v);
        if (v && global.Notify) global.Notify.pedir();
      }));
    lem.appendChild(el('div', { class: 'mt-2' },
      (function () {
        // Horas e minutos separados, e nao um cursor so.
        //
        // O cursor ia de 15 em 15 minutos e chegava a 24 h. Duas coisas
        // ficam impossiveis nele: pedir "2 h 30" — que e o que a maioria
        // quer, para a missa das 19h30 com aviso as 17h — e qualquer valor
        // que nao fosse multiplo de 15. E a frase fica escrita no texto, sem o
        // "e" que a pessoa usaria falando.
        const val = S.ajuste('antecedenciaNotif', 120);
        let horas = Math.floor(val / 60);
        let minutos = val % 60;
        if (minutos < 0) { minutos += 60; horas -= 1; }
        if (horas < 0) { horas = 0; minutos = 0; }

        const rotulo = function () {
          if (horas === 0 && minutos === 0) return 'Avisar na hora do evento';
          const p = [];
          if (horas) p.push(horas + (horas === 1 ? ' hora' : ' horas'));
          if (minutos) p.push(minutos + (minutos === 1 ? ' minuto' : ' minutos'));
          return 'Avisar ' + p.join(' e ') + ' antes';
        };
        const out = el('div', { class: 'fs-xs muted mb-2' }, rotulo());

        // 5 em 5 minutos. Quem programa missa pensa em 5 e 10, nao em 7.
        const passos = [0, 5, 10, 15, 20, 30, 40, 45, 55];
        const campoMin = el('select', { class: 'select', 'aria-label': 'Minutos de antecedencia' },
          passos.map(function (m) {
            return el('option', { value: String(m), selected: m === minutos },
              m === 0 ? 'em cima da hora' : m + ' min');
          }));
        const campoHora = el('input', {
          class: 'input', type: 'number', min: '0', max: '24', step: '1',
          value: String(horas), 'aria-label': 'Horas de antecedencia',
          style: { width: '5.5rem' },
        });
        const gravar = function () {
          let h = Math.max(0, Math.min(24, parseInt(campoHora.value, 10) || 0));
          const m = parseInt(campoMin.value, 10) || 0;
          horas = h; minutos = m;
          const total = Math.min(1440, h * 60 + m);
          out.textContent = rotulo();
          S.setAjuste('antecedenciaNotif', total);
        };
        campoHora.addEventListener('change', gravar);
        campoHora.addEventListener('input', gravar);
        campoMin.addEventListener('change', gravar);

        return el('div', {}, [
          out,
          el('div', { class: 'row gap-2' }, [
            campoHora,
            campoMin,
          ]),
        ]);
      })()));
    lem.appendChild(el('button', { class: 'btn btn-secondary btn-block mt-3', onclick: function () { global.Notify.testar(); } },
      [el('i', { 'data-lucide': 'send' }), 'Testar notificacao']));
    root.appendChild(lem);

    /* ---------- agenda ---------- */
    root.appendChild(secao('calendar-days', 'Agenda'));
    const ag = el('div', { class: 'card' });
    ag.appendChild(el('label', { class: 'label' }, 'Inicio da semana'));
    const ini = S.ajuste('inicioSemana', 0);
    ag.appendChild(el('div', { class: 'chips mb-3' }, [0, 1].map(function (i) {
      return el('button', { class: 'chip', 'aria-pressed': String(ini === i),
        onclick: function () { S.setAjuste('inicioSemana', i); recarregar(); } }, i === 0 ? 'Domingo' : 'Segunda');
    })));
    ag.appendChild(el('label', { class: 'label' }, 'Notacao de acordes'));
    const amol = S.ajuste('usarAmoles', 'auto');
    ag.appendChild(el('div', { class: 'chips mb-2' }, [
      { v: 'auto', n: 'Automatica' }, { v: 'sharps', n: 'Usar #' }, { v: 'flats', n: 'Usar bemol' },
    ].map(function (o) {
      return el('button', { class: 'chip', 'aria-pressed': String(amol === o.v),
        onclick: function () { S.setAjuste('usarAmoles', o.v); recarregar(); } }, o.n);
    })));
    ag.appendChild(el('p', { class: 'fs-xs muted' }, 'Automatica usa bemois em tons como F, Bb e Eb.'));
    ag.appendChild(linhaChave('Link automatico', 'Preenche Cifra Club e Letras ao criar musicas',
      !!S.ajuste('autoLink', true), function (v) { S.setAjuste('autoLink', v); }));
    root.appendChild(ag);

    /* ---------- dados ---------- */
    root.appendChild(secao('database', 'Dados e backup'));
    const info = S.storageInfo();
    const dad = el('div', { class: 'card' });
    dad.appendChild(el('div', { class: 'row between mb-2' }, [
      el('span', { class: 'fs-sm fw-7' }, 'Armazenamento no aparelho'),
      el('span', { class: 'fs-xs muted' }, U.fmtBytes(info.used)),
    ]));
    dad.appendChild(el('div', { class: 'progress' + (info.pct > 85 ? ' danger' : info.pct > 70 ? ' warn' : '') },
      el('i', { style: { width: Math.min(100, info.pct) + '%' } })));
    const m = S.metricas();
    dad.appendChild(el('p', { class: 'fs-xs muted mt-2' },
      m.escalas + ' eventos e ' + m.cifras + ' cifras salvos. Faca backup para levar para outro aparelho.'));
    dad.appendChild(el('div', { class: 'stack gap-2 mt-3' }, [
      el('button', { class: 'btn btn-secondary btn-block', onclick: exportar },
        [el('i', { 'data-lucide': 'download' }), 'Fazer backup (.json)']),
      el('button', { class: 'btn btn-secondary btn-block', onclick: function () { importar('mesclar'); } },
        [el('i', { 'data-lucide': 'upload' }), 'Restaurar backup']),
      el('button', { class: 'btn btn-danger btn-block', onclick: apagar },
        [el('i', { 'data-lucide': 'trash-2' }), 'Apagar todos os dados']),
    ]));
    root.appendChild(dad);

    /* ---------- plano (micro saas) ---------- */
    root.appendChild(secao('gem', 'Seu plano'));
    const LIMITE = 200;
    const uso = Math.min(100, Math.round((m.cifras / LIMITE) * 100));
    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'row between mb-2' }, [
        el('div', {}, [
          el('div', { class: 'fs-md fw-8' }, 'Gratuito'),
          el('div', { class: 'fs-xs muted' }, 'Para Bands e equipes pequenas'),
        ]),
        el('span', { class: 'badge badge-brand' }, m.cifras + ' / ' + LIMITE + ' cifras'),
      ]),
      el('div', { class: 'progress' + (uso > 85 ? ' warn' : '') }, el('i', { style: { width: uso + '%' } })),
      el('p', { class: 'fs-xs muted mt-2' }, 'Ensaios, musicas, fotos e o estudio nao tem limite.'),
      el('button', { class: 'btn btn-soft btn-block mt-3', onclick: function () {
        UI.toast('Planos pagos chegam na proxima versao', { tipo: 'info', dur: 3500 });
      } }, [el('i', { 'data-lucide': 'sparkles' }), 'Conhecer planos']),
    ]));

    /* ---------- sobre ---------- */
    root.appendChild(secao('info', 'Sobre'));
    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'row gap-3' }, [
        el('img', { src: 'assets/logo.svg', width: '44', height: '44', alt: '' }),
        el('div', {}, [
          el('div', { class: 'fs-md fw-8' }, 'acorde'),
          el('div', { class: 'fs-xs muted' }, 'escalas, cifras e ensaio  -  funciona offline'),
        ]),
      ]),
      el('p', { class: 'fs-sm c-3 mt-3' }, 'A mesa de trabalho de quem toca. Tudo fica no seu aparelho, nada vai para servidor nenhum.'),
      el('div', { class: 'row gap-2 mt-3 wrap' }, [
        el('button', { class: 'btn btn-secondary btn-sm', onclick: function () { global.App.atalhos(); } },
          [el('i', { 'data-lucide': 'keyboard' }), 'Atalhos']),
        el('button', { class: 'btn btn-secondary btn-sm', onclick: function () { global.App.sobre(); } },
          [el('i', { 'data-lucide': 'info' }), 'Sobre o Acorde']),
      ]),
    ]));

    UI.icons(root);
  }

  function secao(icon, titulo) {
    return el('div', { class: 'section-title mt-5' }, [el('i', { 'data-lucide': icon }), titulo]);
  }

  function linhaChave(titulo, desc, valor, onChange) {
    const sw = el('div', { class: 'switch', role: 'switch', tabindex: '0', 'aria-checked': String(!!valor), 'aria-label': titulo });
    const row = el('div', { class: 'switch-row' }, [
      el('div', { class: 'grow' }, [el('div', { class: 't' }, titulo), desc ? el('div', { class: 'd' }, desc) : null]),
      sw,
    ]);
    const toggle = function () {
      const novo = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(novo));
      onChange(novo);
    };
    row.addEventListener('click', toggle);
    sw.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    return row;
  }

  function recarregar() {
    const p = document.getElementById('page-ajustes');
    if (p && p.classList.contains('active')) render(p);
  }

  function exportar() {
    U.download('acorde-backup-' + U.todayKey() + '.json', S.exportar());
    UI.toast('Backup salvo', { tipo: 'ok' });
  }

  function importar(modo) {
    const file = el('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    document.body.appendChild(file);
    file.addEventListener('change', async function () {
      const f = file.files[0];
      document.body.removeChild(file);
      if (!f) return;
      try {
        const txt = await U.readFile(f, false);
        const r = S.importar(txt, modo);
        UI.toast('Restaurado: ' + r.escalas + ' eventos e ' + r.cifras + ' cifras', { tipo: 'ok', dur: 4000 });
        recarregar();
      } catch (e) {
        UI.toast(e.message || 'Arquivo invalido', { tipo: 'err', dur: 5000 });
      }
    });
    file.click();
  }

  function apagar() {
    UI.confirmar({
      title: 'Apagar tudo', danger: true, okText: 'Apagar tudo',
      message: 'Isso apaga TODOS os seus eventos, cifras e preferencias deste aparelho. Nao da para desfazer.',
    }).then(function (ok) {
      if (!ok) return;
      S.apagar();
      UI.toast('Dados apagados', { tipo: 'ok' });
      global.App.ir('hoje');
    });
  }

  V.ajustes = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);