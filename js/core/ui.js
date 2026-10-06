/* =========================================================
   Cifras e Escalas Pro — core/ui.js
   Toasts, modais/sheets, confirmação, ícones, tema.
   Expõe window.UI.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const { el, esc } = U;

  /* ---------------- Ícones ---------------- */
  function icons(root) {
    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      try { global.lucide.createIcons({ nameAttr: 'data-lucide', ...(root ? { attrs: {} } : {}) }); }
      catch (e) { /* ignora */ }
    }
  }

  /* ---------------- Toast ----------------

     Aceita `undo` (desfazer) ou `acao` + `acaoTexto` (levar a pessoa ate a tela
     que resolve).

     A distincao existe por causa de um aviso sobre o dado guardado. "Desfazer"
     e a palavra certa para voltar atras de algo que o app acabou de fazer, e e
     a palavra ERRADA para "seu trabalho pode ser apagado, va em Ajustes". A
     pessoa le o rotulo antes do aviso, e um botao que promete desfazer faz a
     pessoa desconfiar do aviso inteiro.

     Um aviso que oferece o caminho e um aviso que se resolve sozinho. Este
     aqui precisa da segunda coisa: o app nao pode apagar o armazenamento do
     navegador, e a unica defesa que sobra e a pessoa tombol. */
  function toast(msg, opts) {
    opts = opts || {};
    const host = document.getElementById('toast-host');
    if (!host) return;
    const tipo = opts.tipo || 'info';
    const iconName = tipo === 'ok' ? 'check-circle-2' : tipo === 'err' ? 'alert-circle' : 'info';
    const node = el('div', { class: 'toast ' + tipo, role: 'status' }, [
      el('i', { 'data-lucide': iconName }),
      el('span', { class: 'grow' }, msg),
    ]);

    const aoTocar = opts.acao || opts.undo;
    if (aoTocar) {
      /* O gancho e um ATRIBUTO, nao uma classe.
       *
       * A classe `undo` ja faz o estilo. Este marcador existe so para o clique
       * por fora nao engolir o clique no botao — e um gancho de codigo, nao uma
       * aparencia. Dar uma classe a ele obrigaria a criar uma regra de CSS que
       * nao muda nada, e uma regra sem efeito e uma regra que o proximo
       * mantenedor nao sabe se pode apagar. */
      node.appendChild(el('button', {
        class: 'undo',
        'data-toast-acao': '',
        type: 'button',
        onclick: function (ev) {
          if (ev) ev.stopPropagation();
          close();
          try { aoTocar(); } catch (e) { console.error(e); }
        },
      }, opts.acaoTexto || 'Desfazer'));
    }

    host.appendChild(node);
    icons(node);
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      node.classList.add('out');
      setTimeout(() => node.remove(), 220);
    }
    const dur = opts.dur || (aoTocar ? 6000 : tipo === 'err' ? 5000 : 2800);
    const t = setTimeout(close, dur);
    node.addEventListener('click', (e) => {
      // Clicar no botao de acao e o botao de acao: o clique por fora fecha o
      // aviso, o clique em cima dele faz o que ele diz.
      if (e.target.closest('[data-toast-acao]')) return;
      clearTimeout(t); close();
    });
    return close;
  }

  /* ---------------- Sheet / Modal ---------------- */
  let sheetStack = [];

  /**
   * Limpa os temporizadores de uma folha ao fechá-la.
   *
   * Qualquer `setInterval` que uma folha cria precisa morrer com ela. Sem isto,
   * abrir a mesma tela dez vezes no dia deixa dez temporizadores rodando, cada
   * um pintando um elemento que ja saiu do documento. No celular isso aparece
   * como o aparelho esquentando e a bateria caindo sem motivo aparente — e
   * como uma lentidao que ninguem consegue apontar, porque o culpado e um
   * intervalo de 400 ms que ninguem lembra de ter criado.
   *
   * Como usar: guardar o id com `limparNoClose(folha, setInterval(...))`, em
   * vez de so `setInterval(...)`.
   */
  function limparNoClose(folha, id) {
    if (folha && typeof folha.noClose === 'function' && id) folha.noClose(id);
    return id;
  }

  /**
   * Abre um sheet (mobile) / modal (desktop).
   * opts: {title, sub, body(Node|string), foot[Node], wide, onClose, dismissible}
   * Retorna {close, node}
   */
  function sheet(opts) {
    opts = opts || {};
    const temporizadores = [];
    const scrim = el('div', { class: 'scrim' });
    const bodyNode = el('div', { class: 'sheet-body' + (opts.flush ? ' flush' : '') });
    if (opts.body) {
      /* O corpo e um NO. Sempre.
       *
       * Existia aqui um desvio que aceitava string e fazia `innerHTML` nela.
       * Os 31 chamadores do app passam no — todos declarados com `el(...)` — de
       * modo que o desvio nao servia para ninguem e so servia para errar: uma
       * folha montada com `body: algumTexto` rodaria esse texto como HTML, e o
       * lugar mais provavel do texto ser o titulo que a pessoa acabou de digitar.
       *
       * `body` continua aceitando texto dentro de um no: `el('p', {}, txt)`.
       * E `el()` recusa `html:` com um erro, pelo mesmo motivo. */
      if (typeof opts.body === 'string') {
        throw new Error('UI.sheet: o corpo é um nó, não um texto. Use el("p", {}, texto).');
      }
      bodyNode.appendChild(opts.body);
    }
    const panel = el('div', { class: 'sheet' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' }, [
      el('div', { class: 'sheet-grip' }),
      opts.title ? el('div', { class: 'sheet-head' }, [
        el('div', { class: 'grow' }, [
          el('h3', {}, opts.title),
          opts.sub ? el('div', { class: 'sub' }, opts.sub) : null,
        ]),
        el('button', {
          class: 'btn-icon', 'aria-label': 'Fechar',
          /* O X e uma das portas, entao passa pelo mesmo `close` que as outras.
           * Antes ele chamava o fechamento direto e ignorava `dismissible`: o
           * unico jeito de fechar por Escape era o unico jeito de NAO fechar. */
          onclick: () => close(),
        }, el('i', { 'data-lucide': 'x' })),
      ]) : null,
      bodyNode,
      opts.foot && opts.foot.length ? el('div', { class: 'sheet-foot' }, opts.foot) : null,
    ]);
    scrim.appendChild(panel);

    function close(forcado) {
      /* O PORTAO — o unico lugar onde uma folha pode nao fechar
       *
       * Antes desta guarda, fechar era um so caminho (`close`), e a folha nao
       * tinha opiniao: X, Escape, backdrop e `closeAllSheets()` fechavam
       * direto. O `dismissible` existia e so protegeia Escape e backdrop — o X
       * nao olhava. Uma gravacao nao salva era a unica coisa do app que nao
       * tinha nome; aqui, ela passa a ter.
       *
       * Por que no `close` e nao em cada chamador: sao oito portas (X, Escape,
       * backdrop, `closeAllSheets`, os botoes do `foot`, o `onClose` de quem
       * chama `h.close()`). Guardar em cada uma e o jeito garantido de deixar
       * uma aberta. Guardando aqui, fechar passa a ser um unico portao — e
       * `closeAllSheets()`, que percorre a pilha chamando `close()` de cada
       * folha, respeita a de cada uma sem saber que ela existe.
       *
       * O guarda pode devolver `false` (nao sai, sem dialogo), uma Promise, ou
       * nada (sai). `forcado` existe para os dois casos em que a folha NAO tem
       * voto: a propria confirmacao que ela abriu, e o descarte explicito que a
       * pessoa escolheu.
       */
      if (!forcado && opts.aoFechar) {
        let r;
        try { r = opts.aoFechar(); } catch (e) { console.error(e); return; }
        if (r === false) return false;            /* cancelado, nem dialogo */
        if (r && typeof r.then === 'function') {
          /* Assincrono: a folha espera. E o unico jeito de uma confirmacao
           * existir — perguntar e uma promise, e fechar antes da resposta
           * descartaria a propria pergunta.
           *
           * O retorno e' um PROMISE, e nao o resultado: a folha ainda nao
           * respondeu. `closeAllSheets` usa este valor para saber se ALGUEM
           * recusou e parar a descida — e um `undefined` seria indistinguivel
           * de "ninguem disse nada". */
          r.then(function (ok) { if (ok) fechar(); }, function () { /* recusado */ });
          return r;
        }
      }
      fechar();
      return true;
    }
    function fechar() {
      const i = sheetStack.indexOf(handle);
      if (i >= 0) sheetStack.splice(i, 1);
      scrim.style.animation = 'fadeIn .15s reverse';
      setTimeout(() => scrim.remove(), 140);
      document.removeEventListener('keydown', onKey);
      // Todo temporizador registrado pela folha morre aqui. E o unico lugar do
      // app onde isso e garantido — uma folha fechada e um no, e a tela e o
      // `clearInterval` nao existem mais.
      for (const id of temporizadores) clearInterval(id);
      temporizadores.length = 0;
      if (opts.onClose) opts.onClose();
    }
    /* `close` publica tambem a saida sem guarda. Quem tem o direito de descartar
     * (a confirmacao, o "Sair e descartar") usa esta, e nao `close`: senao a
     * pergunta reaparece sozinha, eternamente. */
    function semGuarda() { fechar(); }
    function onKey(ev) {
      if (ev.key === 'Escape' && opts.dismissible !== false) {
        // fecha só o topo da pilha
        if (sheetStack[sheetStack.length - 1] === handle) { ev.stopPropagation(); close(); }
      }
    }

    scrim.addEventListener('click', (ev) => {
      if (ev.target === scrim && opts.dismissible !== false) close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(scrim);

    const handle = { close, node: panel, body: bodyNode, scrim, semGuarda };
    /* Registrar o temporizador de uma folha e o que garante que ele pare. Sem
     * isto, o `setInterval` criado dentro do `body` sobrevive ao `close`. */
    handle.noClose = function (id) { temporizadores.push(id); return id; };
    sheetStack.push(handle);
    icons(panel);
    // foca o primeiro campo, se houver
    const first = panel.querySelector('input:not([type=hidden]), textarea, select, .btn-primary');
    if (first && opts.autofocus !== false && window.matchMedia('(min-width: 900px)').matches) {
      setTimeout(() => first.focus(), 60);
    }
    return handle;
  }

  function closeAllSheets() {
    /* DE CIMA PARA BAIXO, PARANDO NO PRIMEIRO VETO
     *
     * A primeira versao percorria a pilha inteira e chamava `close` em cada
     * folha, deixando cada uma decidir. Medido no navegador, com a pilha real
     * [Mesa de ensaio, Gravar a narração, Folha C]:
     *
     *   closeAllSheets()  ->  [Gravar a narração, A narração ainda não foi salva]
     *
     * A folha C fechou (nao tinha nada a perder) e a MESA fechou tambem — e a
     * gravacao, que e' FILHA da mesa, ficou sozinha sobre uma tela onde a mesa
     * nao existe mais. Nada foi perdido: o audio segue na memoria e o guarda
     * segue armado. Mas a pilha ficou incoerente, e uma filha que ainda
     * precisa da mae nao deveria ficar orfa.
     *
     * A ordem de cima para baixo e o que resolve: a folha do topo e' a primeira
     * a ser perguntada, e quando uma delas recusa, NADA abaixo fecha. A pilha
     * que sobra e' sempre um bloco coeso — a folha que recusou e tudo acima
     * dela. E`close` devolve `false` justamente para isto: antes ele devolvia
     * nada, e o `for` nao tinha como saber que alguem tinha falado. */
    const deCimaParaBaixo = sheetStack.slice().reverse();
    for (const h of deCimaParaBaixo) {
      const resposta = h.close();
      /* O veto chega em DUAS formas, e so uma estava sendo tratada.
       *
       * `false` e' o veto sincrono — o guarda respondeu "nao" na hora.
       *
       * A Promise e' o veto ASSINCRONO, que e' o caso de verdade: perguntar
       * involves um diálogo, e um diálogo e' assincrono por natureza. A
       * primeira versao comparava so com `false`, entao uma Promise nunca casava
       * e a varredura seguia para a folha de baixo — que nao tem guarda nenhuma
       * e fechava.
       *
       * Medido no navegador, com a pilha [Mesa de ensaio, Gravar a narração,
       * Folha C]: a mesa FECHAVA e a gravacao ficava orfa, exatamente o defeito
       * que o `break` existia para impedir. O `break` estava no lugar certo e
       * nao disparava, porque a condicao testava a metade do caso.
       *
       * Nao da para esperar a resposta antes de decidir: e a espera que abre o
       * diálogo. O que se sabe de imediato, sem esperar, e' que a folha nao
       * respondeu — e isso basta para parar a varredura. */
      if (resposta === false || (resposta && typeof resposta.then === 'function')) break;
    }
  }

  /* ---------------- Confirmação ---------------- */
  /** Substitui window.confirm. resolve(true/false). */
  function confirmar(opts) {
    if (typeof opts === 'string') opts = { message: opts };
    opts = opts || {};
    return new Promise((resolve) => {
      let done = false;
      function finish(v) { if (done) return; done = true; h.close(); resolve(v); }

      /* Acoes extras, quando a pergunta tem mais de duas respostas.
       *
       * "Esta gravacao nao foi salva" nao e uma pergunta de sim ou nao: quem
       * responde "sim" a "sair?" pode querer salvar, querer fazer backup, ou
       * estar disposposto a perder. Uma confirmacao de duas respostas obrigaria
       * a pessoa a escolher entre salvar e sair, e o backup — que e a acao que
       * NAO perde nada — ficaria fora da conversa.
       *
       * `acoes` entra na ordem dada, e a ultima costuma ser a destrutiva: quem
       * perde dados costuma precisar chegar ate o fim da lista para fazer isso. */
      const botoes = [];
      if (Array.isArray(opts.acoes)) {
        for (const a of opts.acoes) {
          botoes.push(el('button', {
            class: 'btn ' + (a.classe || 'btn-secondary') + ' btn-block',
            type: 'button',
            onclick: function () { finish(a.valor); },
          }, a.texto));
        }
      } else {
        botoes.push(el('button', { class: 'btn btn-secondary', type: 'button', onclick: function () { finish(false); } },
          opts.cancelText || 'Cancelar'));
        botoes.push(el('button', {
          class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'),
          type: 'button',
          onclick: function () { finish(true); },
        }, opts.okText || 'Confirmar'));
      }

      const h = sheet({
        title: opts.title || 'Confirmar',
        body: el('p', { class: 'fs-md', style: { lineHeight: '1.5' } }, opts.message || ''),
        foot: botoes,
        /* A pergunta precisa ser respondida. Sem isto, Escape e o X
         * responderiam "cancelei" — e o cancelamento de um cancelamento e
         * ficar onde esta, que e o que a pessoa quer. */
        dismissible: false,
        onClose: function () { finish(opts.cancelValue === undefined ? false : opts.cancelValue); },
      });
      setTimeout(() => {
        const b = h.node.querySelector('.sheet-foot .btn:last-child');
        if (b) b.focus();
      }, 60);
    });
  }

  /* ---------------- Prompt ---------------- */
  /** Sheet com um campo. resolve(valor | null). */
  function prompt(opts) {
    if (typeof opts === 'string') opts = { title: opts };
    opts = opts || {};
    return new Promise((resolve) => {
      let done = false;
      const input = el(opts.multiline ? 'textarea' : 'input', {
        class: opts.multiline ? 'textarea' : 'input',
        placeholder: opts.placeholder || '',
        value: opts.value || '',
      });
      function finish(v) { if (done) return; done = true; h.close(); resolve(v); }
      const body = el('div', {}, [
        opts.message ? el('p', { class: 'fs-sm muted mb-3' }, opts.message) : null,
        opts.label ? el('label', { class: 'label' }, opts.label) : null,
        input,
      ]);
      const h = sheet({
        title: opts.title || 'Digite',
        body,
        foot: [
          el('button', { class: 'btn btn-secondary', onclick: () => finish(null) }, 'Cancelar'),
          el('button', { class: 'btn btn-primary', onclick: () => finish(input.value.trim()) },
            opts.okText || 'Salvar'),
        ],
        onClose: () => finish(null),
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !opts.multiline) { e.preventDefault(); finish(input.value.trim()); }
      });
      setTimeout(() => input.focus(), 80);
    });
  }

  /* ---------------- Estado vazio ---------------- */
  function empty(opts) {
    return el('div', { class: 'empty' }, [
      el('div', { class: 'ico' }, el('i', { 'data-lucide': opts.icon || 'inbox' })),
      el('h4', {}, opts.title || 'Nada por aqui'),
      opts.message ? el('p', {}, opts.message) : null,
      opts.action ? el('button', {
        class: 'btn btn-primary', onclick: opts.action.onClick,
      }, [el('i', { 'data-lucide': opts.action.icon || 'plus' }), opts.action.label]) : null,
    ]);
  }

  /* ---------------- Indicador de imagem ---------------- */
  function openImage(src, opts) {
    opts = opts || {};
    const modal = document.getElementById('img-modal');
    const img = document.getElementById('img-modal-img');
    if (!modal || !img) return;
    img.src = src;
    modal.style.display = 'flex';
    function close() { modal.style.display = 'none'; img.src = ''; }
    modal.onclick = close;
    const bar = modal.querySelector('.bar');
    if (bar) {
      bar.innerHTML = '';
      if (opts.onDelete) {
        bar.appendChild(el('button', {
          class: 'btn-icon danger', 'aria-label': 'Remover imagem', onclick: () => {
            close(); opts.onDelete();
          },
        }, el('i', { 'data-lucide': 'trash-2' })));
      }
      bar.appendChild(el('button', {
        class: 'btn-icon', 'aria-label': 'Fechar', onclick: close,
      }, el('i', { 'data-lucide': 'x' })));
    }
    icons(modal);
  }

  /* ---------------- Tema ---------------- */
  function applyTheme(tema) {
    const t = tema || 'auto';
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    const escuro = t === 'dark' || (t === 'auto'
      && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (meta) meta.setAttribute('content', escuro ? '#080b14' : '#f4f6fb');
    document.querySelectorAll('[data-theme-btn]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.themeBtn === t));
    });
  }

  function cycleTheme(atual) {
    const ordem = ['auto', 'light', 'dark'];
    const i = ordem.indexOf(atual);
    return ordem[(i + 1) % ordem.length];
  }

  /* ---------------- Vibração (feedback tátil) ---------------- */
  function buzz(ms) {
    if (global.Store && global.Store.ajuste('vibrar', true) === false) return;
    if (navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) { /* ignora */ } }
  }

  /* ---------------- Impressão ---------------- */
  function print(html) {
    const area = document.getElementById('print-area');
    if (!area) return;
    area.innerHTML = html;
    const done = () => { area.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { window.print(); setTimeout(done, 1500); }, 60);
  }

  global.UI = {
    icons, toast, sheet, closeAllSheets, confirmar, prompt,
    empty, openImage, applyTheme, cycleTheme, buzz, print,
    limparNoClose,
  };
})(typeof window !== 'undefined' ? window : globalThis);
