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
   * Os acentos, agrupados por familia.
   *
   * Nao ha cor nenhuma aqui. A amostra da tela recebe o `data-accent` e quem
   * pinta e o CSS. Guardar hex nesta lista foi o que ja fez a amostra divergir
   * do que o app aplica — e, por um tempo, o que fez todas as amostras
   * aparecerem da mesma cor.
   *
   * As familias nao sao decoracao: com vinte e duas cores, uma fileira unica
   * vira uma parede, e ninguem acha o azul no meio dos amareados. A ordem vai
   * do mais quente ao mais frio, com o neutro no fim, porque e assim que as
   * cores se parecem entre si.
   *
   * Esta lista precisa cobrir todo acento que o CSS declara: um que exista no
   * CSS e nao aqui nunca seria oferecido a pessoa, e `tools/check-api.js`
   * confere os dois sentidos.
   */
  const FAMILIAS = [
  { familia: 'Brasa', nota: 'vermelhos e laranjas', cores: [
    { id: 'ember', nome: 'Brasa' },
    { id: 'coral', nome: 'Coral' },
    { id: 'terracota', nome: 'Terracota' }
  ] },
  { familia: 'Ambar', nota: 'dourados e areias', cores: [
    { id: 'ambar', nome: 'Ambar' },
    { id: 'ouro', nome: 'Ouro' },
    { id: 'areia', nome: 'Areia' }
  ] },
  { familia: 'Verde', nota: 'verdes', cores: [
    { id: 'floresta', nome: 'Floresta' },
    { id: 'jade', nome: 'Jade' },
    { id: 'lima', nome: 'Lima' },
    { id: 'oliva', nome: 'Oliva' },
    { id: 'musgo', nome: 'Musgo' }
  ] },
  { familia: 'Agua', nota: 'azuis e cianos', cores: [
    { id: 'ocean', nome: 'Mar' },
    { id: 'turquesa', nome: 'Turquesa' },
    { id: 'azul', nome: 'Azul' },
    { id: 'cobalto', nome: 'Cobalto' }
  ] },
  { familia: 'Violeta', nota: 'roxos frios', cores: [
    { id: 'indigo', nome: 'Indigo' },
    { id: 'violet', nome: 'Violeta' },
    { id: 'lilas', nome: 'Lilas' }
  ] },
  { familia: 'Rosa', nota: 'rosas e magentas', cores: [
    { id: 'magenta', nome: 'Magenta' },
    { id: 'rose', nome: 'Rosa' },
    { id: 'ameixa', nome: 'Ameixa' }
  ] },
  { familia: 'Neutro', nota: 'sem cor', cores: [
    { id: 'grafite', nome: 'Grafite' }
  ] }
  ];

  /**
   * Todos os acentos, na ordem das familias.
   *
   * Sao as mesmas entradas, so que reunidas por familia. A lista plana
   * continua existindo porque o verificador de acentos (check-api.js) a le
   * para conferir que todo acento do CSS e oferecido aqui — e ele precisa de
   * uma lista simples para percorrer.
   */

  const ACCENTS = FAMILIAS.reduce(function (todos, f) {
    return todos.concat(f.cores);
  }, []);

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

    // O acento ligado agora. Cada amostra se compara com ele, e nao com a
    // posicao na lista — que e o que quebrava assim que os acentos passaram
    // a vir agrupados por familia.
    const atual = S.ajuste('accent', 'ember');

    // Um botao de amostra.
    //
    // O botao sabe o proprio id. Antes o "ligado" era decidido pela posicao na
    // lista (ACCENTS[i]), o que so funciona numa fileira unica: agrupando por
    // familia, a posicao passa a ser a do grupo, e o circulo marcado vira o de
    // cima. Nada quebra, e e por isso que passa.
function amostra(a) {
      // A amostra NAO recebe a cor por JavaScript: recebe o `data-accent` e
      // deixa o proprio CSS pintar.
      //
      // A versao anterior media a cor com uma sonda e punha o resultado no
      // `background`. A sonda pegava o `--brand-400` e o `--brand-600` certos de
      // cada acento, mas lia o `--primary`, que e declarado no `:root` como
      // `var(--brand-400)`. A substituicao de `var()` acontece onde a
      // propriedade e DECLARADA, nao onde e lida — entao a sonda herdava sempre
      // o valor ja resolvido do acento ATIVO, e as 22 amostras saiam da mesma
      // cor. O seletor de cores mostrava 22 copias do mesmo circulo, que e
      // pior do que nao ter seletor: parece que o app oferece escolha e nao
      // oferece.
      //
      // Entregar o `data-accent` ao CSS elimina a medicao. A amostra nao tem
      // como divergir da cor que a pessoa vai receber, porque e a mesma regra
      // que pinta o resto do app.
      return el('button', {
        class: 'st-cor' + (a.id === atual ? ' on' : ''),
        'data-accent': a.id,
        'aria-label': a.nome, title: a.nome,
        'aria-pressed': a.id === atual ? 'true' : 'false',
        onclick: function () {
          S.setAjuste('accent', a.id);
          global.App.aplicarTema();
          // Marca pelo id, nao pela posicao na lista.
          U.$$('.st-cor', ap).forEach(function (x) {
            const ligado = x.getAttribute('data-cor') === a.id;
            x.classList.toggle('on', ligado);
            x.setAttribute('aria-pressed', ligado ? 'true' : 'false');
          });
        },
      });
    }

    FAMILIAS.forEach(function (f) {
      ap.appendChild(el('div', { class: 'label st-cor-familia' }, [
        el('span', { class: 'f-nome' }, f.familia),
        el('span', { class: 'f-nota' }, f.nota),
      ]));
      const linha = el('div', { class: 'row gap-2 wrap mb-3' });
      f.cores.forEach(function (a) {
        const b = amostra(a);
        b.setAttribute('data-cor', a.id);
        linha.appendChild(b);
      });
      ap.appendChild(linha);
    });

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

    // Tamanho do texto. Seis degraus, de 14 a 22 px.
//
// Antes eram tres ("small"/"large") e nao faziam nada: todos os 108 tamanhos
// de texto do app estavam em px, entao mudar a fonte da raiz nao alterava nada
// visivel. Tudo agora esta em rem, e a raiz e que muda.
//
// As chaves sao ASCII de proposito. Este projeto ja foi mordido por
// normalizacao unicode duas vezes, e um valor de ajuste nao e lugar para
// arriscar.
const TAMANHOS = [
    { v: 'xs', n: 'A', px: 14 }, { v: 'sm', n: 'A', px: 15 }, { v: 'md', n: 'A', px: 16 },
    { v: 'lg', n: 'A', px: 18 }, { v: 'xl', n: 'A', px: 20 }, { v: 'xxl', n: 'A', px: 22 },
  ];
  ap.appendChild(el('label', { class: 'label' }, 'Tamanho do texto'));
  ap.appendChild(el('div', { class: 'chips mb-2' }, TAMANHOS.map(function (o) {
    return el('button', {
      class: 'chip', 'aria-pressed': String(S.ajuste('fontsize', 'md') === o.v),
      // Cada "A" e desenhado no tamanho que seria escolhido. Um seletor de
      // tamanho em que todas as opcoes sao visualmente iguais e um seletor
      // que obriga a decorar — o rotulo vira a unica informacao disponivel.
      style: { fontSize: (o.px / 16) + 'rem' },
      title: o.px + ' px',
      onclick: function () { S.setAjuste('fontsize', o.v); global.App.aplicarTema(); recarregar(); },
    }, 'A');
  })));
  ap.appendChild(el('p', { class: 'fs-xs muted' }, 'O app inteiro acompanha, nao so o texto das cifras.'));

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