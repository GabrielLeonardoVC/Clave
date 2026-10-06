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
  /* As principais primeiro, na ordem quente para fria.

     Sao as tres que a pessoa procura quando abre a lista sem saber o nome de
     nenhuma outra. O vermelho e o amarelo simplesmente nao existiam: a paleta
     saltava do laranja para o verde, e quem queria a cor basica nao
     encontrava. O azul ja existia e sobe para aqui em vez de ganhar um
     primo quase igual — duas cores quase iguais so confundem. */
  { familia: 'Principais', nota: 'as três básicas', cores: [
    { id: 'carmim', nome: 'Vermelho' },
    { id: 'amarelo', nome: 'Amarelo' },
    { id: 'azul', nome: 'Azul' }
  ] },
  { familia: 'Brasa', nota: 'vermelhos e laranjas', cores: [
    { id: 'ember', nome: 'Brasa' },
    { id: 'coral', nome: 'Coral' },
    { id: 'terracota', nome: 'Terracota' }
  ] },
  { familia: 'Âmbar', nota: 'dourados e areias', cores: [
    { id: 'ambar', nome: 'Âmbar' },
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
    { id: 'cobalto', nome: 'Cobalto' }
  ] },
  { familia: 'Violeta', nota: 'roxos frios', cores: [
    { id: 'indigo', nome: 'Indigo' },
    { id: 'violet', nome: 'Violeta' },
    { id: 'lilas', nome: 'Lilás' }
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

    /* ---------- o instrumento ----------
     *
     * Esta secao esta no topo, e nao junto com o som, porque nao e uma preferencia
     * de som: e a escolha que dirige tres coisas ao mesmo tempo. O timbre de
     * tudo que o app toca, o braco que aparece nas telas de teoria e o violao 3D.
     *
     * Por isso o rotulo diz "no braço" e nao "qual som": escolher "Violão de
     * nylon" nao troca so o timbre, mantem o mesmo braço de seis cordas, e quem
     * tem um nao tem o outro.
     *
     * E o item que NAO tem braço aparece assim mesmo, com o aviso. Um teclado nao
     * tem trastes para desenhar; esconder a opcao seria esconder que a escolha
     * existe, e mostrar um braco de violao seria inventar um instrumento. */
    root.appendChild(secao('guitar', 'Seu instrumento'));

    const T = global.Timbre;
    const M = global.Music;
    const instrumento = secaoInstrumento(T, M);
    root.appendChild(instrumento.linha);
    if (instrumento.aviso) root.appendChild(instrumento.aviso);

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
      { v: 'auto', n: 'Automático', i: 'sun-moon' }, { v: 'light', n: 'Claro', i: 'sun' }, { v: 'dark', n: 'Escuro', i: 'moon' },
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
  ap.appendChild(el('p', { class: 'fs-xs muted' }, 'O app inteiro acompanha, não só o texto das cifras.'));

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
    ag.appendChild(linhaChave('Link automático', 'Preenche Cifra Club e Letras ao criar músicas',
      !!S.ajuste('autoLink', true), function (v) { S.setAjuste('autoLink', v); }));
    root.appendChild(ag);

    /* ---------- dados ---------- */
    root.appendChild(secao('database', 'Dados e backup'));
    const info = S.storageInfo();

    /* O bloco que explica o risco.
     *
     * Este cartao ficava em silencio. Mostrava "1,2 MB" e um "Faca backup para
     * levar para outro aparelho" generico, e mais nada. O numero vinha de um
     * limite inventado no `store` — 4,5 MB nao e o limite de ninguem; o
     * navegador decide, e o limite dele muda com o espaco que sobra no aparelho.
     *
     * A tela agora diz as tres coisas que importam: se este espaco pode ser
     * apagado pelo navegador, quanto ja foi exportado, e o que fazer se a
     * resposta for "pode". O `risco()` ja devolve a frase pronta, para que a
     * tela nao invente um jeito de dizer a mesma coisa em dois lugares. */
    const Arm = global.Armazenamento;
    const cartaoRisco = el('div', { class: 'card' + (Arm ? '' : ' oculto') });
    if (Arm) {
      const r = Arm.risco();
      /* O nivel do risco vira a familia visual que ja existe no projeto.
       *
       * `risco()` fala em tres situacoes da vida real — esta tudo bem, este
       * espaco pode sumir, isto aqui ja esta atras. Cada uma ganha a cor que o
       * resto do app ja usa para a mesma ideia, para o cartao nao virar uma
       * quarta linguagem visual. */
      const familia = r.nivel === 'perigo' ? 'danger' : r.nivel === 'atencao' ? 'warn' : 'ok';

      cartaoRisco.appendChild(el('div', { class: 'row between mb-2' }, [
        el('span', { class: 'fs-sm fw-7' }, [
          el('i', {
            'data-lucide': r.nivel === 'tranquilo' ? 'shield-check' : 'shield-alert',
          }),
          ' ' + r.titulo,
        ]),
        el('span', { class: 'badge badge-' + familia },
          Arm.persistente() ? 'persistente' : 'descartável'),
      ]));
      cartaoRisco.appendChild(el('p', { class: 'fs-xs muted' }, r.texto));

      /* O que o browser realmente diz, quando ele diz. */
      Arm.medir().then(function (m) {
        if (!m.exato) return;
        const linhas = [];
        linhas.push(U.fmtBytes(m.uso) + ' em uso');
        if (m.cota) linhas.push('de ' + U.fmtBytes(m.cota) + ' disponíveis neste aparelho');
        linhas.push(m.pct + '%');
        const detalhe = el('p', { class: 'fs-xs muted mt-2' }, [
          el('span', { class: 'muted' }, 'Medido pelo navegador: ' + linhas.join(' · ')),
        ]);
        cartaoRisco.appendChild(detalhe);
      });

      /* Se o espaco puder ser apagado, o botao de pedir deixa de ser interno.
       * E o que a pessoa pode fazer que o app nao pode. */
      const acoes = [];

      if (!Arm.persistente() && Arm.suporta()) {
        acoes.push(el('button', {
          class: 'btn btn-soft btn-block', type: 'button',
          onclick: function () {
            Arm.pedir().then(function (concedido) {
              if (concedido) UI.toast('Este espaço agora é seu. O navegador não apaga.', { tipo: 'ok' });
              else UI.toast('O navegador ainda não liberou. Baixar um backup é o que resolve.', { tipo: 'warn' });
              recarregar();
            });
          },
        }, [el('i', { 'data-lucide': 'lock' }), 'Pedir para o navegador não apagar isto']));
      }

      /* O botão de instalar NÃO mora aqui.
       *
       * Ele ficava neste cartão — o de risco de armazenamento — e por isso
       * aparecia só quando o navegador estava prestes a apagar o espaço. Sem
       * risco, a pessoa que QUERIA instalar não tinha botão nenhum: o recurso
       * que tira o prazo de sete dias ficava escondido dentro do aviso que
       * fala do prazo de sete dias.
       *
       * Ele foi para o bloco "Use o Clave como aplicativo", que é renderizado
       * sempre que a instalação está disponível. Ver mais abaixo. */
      if (acoes.length) cartaoRisco.appendChild(el('div', { class: 'stack gap-2 mt-3' }, acoes));
      root.appendChild(cartaoRisco);
    }

    const dad = el('div', { class: 'card' });
    /* O titulo dizia "Armazenamento no aparelho", e a barra logo abaixo media
     * o limite do CLAVE — 4,5 MB. Logo mais embaixo, outra linha dizia "de
     * 9,8 GB disponíveis neste aparelho", que e a cota do navegador. Os dois
     * numeros eram verdadeiros e se contradiam na mesma tela.
     *
     * O titulo agora diz o que a barra mede, e o que SOBRA aparece em bytes:
     * e o unico numero que a pessoa consegue usar para decidir se grava. */
    const espaco = S.espacoParaGravacao ? S.espacoParaGravacao() : null;
    dad.appendChild(el('div', { class: 'row between mb-2' }, [
      el('span', { class: 'fs-sm fw-7' }, 'Espaço do Clave'),
      el('span', { class: 'fs-xs muted' }, U.fmtBytes(info.used) + ' de ' + U.fmtBytes(info.limit)),
    ]));
    dad.appendChild(el('div', { class: 'progress' + (info.pct > 85 ? ' danger' : info.pct > 70 ? ' warn' : '') },
      el('i', { style: { width: Math.min(100, info.pct) + '%' } })));
    if (espaco) {
      const minutos = Math.floor(espaco.segundosQueCabem / 60);
      const segundos = espaco.segundosQueCabem % 60;
      const duracao = minutos ? minutos + ' min ' + segundos + ' s' : segundos + ' s';
      dad.appendChild(el('p', { class: 'fs-xs muted mt-2' },
        espaco.estado === 'cheio'
          ? 'Sem espaço para novas gravações. Exporte um backup e apague gravações antigas para liberar espaço.'
          : 'Sobra ' + U.fmtBytes(espaco.livre) + ' — cerca de ' + duracao + ' de gravação.'));
    }
    const m = S.metricas();
    const ultimo = Arm && Arm.ultimoBackup ? Arm.ultimoBackup() : '';
    dad.appendChild(el('p', { class: 'fs-xs muted mt-2' },
      U.plural(m.escalas, 'evento') + ' e ' + U.plural(m.cifras, 'cifra')
      /* O "salva/salvas" concorda com CIFRA, nao com a soma.
       *
       * Amarrar no total dava "1 evento e 1 cifra salvas": um evento e uma
       * cifra somam dois, o total era dois, e a frase saia com o adjetivo no
       * plural. O adjetivo olha para o substantivo mais proximo — e a regra do
       * portugues e tambem a regra do algoritmo. */
      + (m.cifras === 1 ? ' salva' : ' salvas') + '.'
      + (ultimo
        ? ' Último backup em ' + ultimo + '.'
        : ' Faça backup para levar para outro aparelho.')));
    dad.appendChild(el('div', { class: 'stack gap-2 mt-3' }, [
      el('button', { class: 'btn btn-secondary btn-block', onclick: exportar },
        [el('i', { 'data-lucide': 'download' }), 'Fazer backup (.json)']),
      el('button', { class: 'btn btn-secondary btn-block', onclick: function () { importar('mesclar'); } },
        [el('i', { 'data-lucide': 'upload' }), 'Restaurar backup']),
      el('button', { class: 'btn btn-danger btn-block', onclick: apagar },
        [el('i', { 'data-lucide': 'trash-2' }), 'Apagar todos os dados']),
    ]));
    root.appendChild(dad);

    /* ---------- usar o Clave como aplicativo ----------
     *
     * Fica aqui, logo depois do cartão de armazenamento, e não dentro do
     * cartão de risco, por um motivo que é de produto e não de estética:
     * quem não tem risco de espaço não tinha botão de instalar. O recurso que
     * tira o prazo de sete dias estava escondido dentro do aviso que fala do
     * prazo de sete dias — e a pessoa que quer instalar é justamente a que
     * não tem pressa nenhuma.
     *
     * Aparece SÓ quando o navegador oferece a instalação. No iPhone ele nunca
     * oferece: o `beforeinstallprompt` não existe no Safari de iOS, e lá o
     * caminho é manual, pelo menu Compartilhar. Sem esta guarda, o botão
     * seria uma promessa que o navegador não pode cumprir. */
    if (Arm && Arm.podeInstalar() && !Arm.instalado()) {
      const instalarAgora = function () {
        Arm.instalar().then(function (aceitou) {
          if (aceitou) UI.toast('Instalado. Agora o prazo de sete dias não corre.', { tipo: 'ok' });
          else UI.toast('O navegador não instalou agora. Dá para tentar de novo depois.', { tipo: 'warn' });
          recarregar();
        });
      };
      root.appendChild(secao('smartphone', 'Use o Clave como aplicativo'));
      root.appendChild(el('div', { class: 'card' }, [
        el('p', { class: 'fs-sm' },
          'Instale na tela de início para abrir rapidamente seus repertórios, teoria, afinador e ferramentas.'),
        el('button', { class: 'btn btn-primary btn-block mt-3', type: 'button', onclick: instalarAgora },
          [el('i', { 'data-lucide': 'smartphone' }), 'Instalar Clave']),
      ]));
    }

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
      el('p', { class: 'fs-xs muted mt-2' }, 'Ensaios, músicas, fotos e o estúdio não tem limite.'),
      el('button', { class: 'btn btn-soft btn-block mt-3', onclick: function () {
        UI.toast('Planos pagos chegam na próxima versão', { tipo: 'info', dur: 3500 });
      } }, [el('i', { 'data-lucide': 'sparkles' }), 'Conhecer planos']),
    ]));

    /* ---------- sobre ---------- */
    root.appendChild(secao('info', 'Sobre'));
    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'row gap-3' }, [
        el('img', { src: 'assets/logo.svg', width: '44', height: '44', alt: '' }),
        el('div', {}, [
          el('div', { class: 'fs-md fw-8' }, global.Identidade.NOME),
          el('div', { class: 'fs-xs muted' }, 'escalas, cifras e ensaio  -  funciona offline'),
        ]),
      ]),
      el('p', { class: 'fs-sm c-3 mt-3' }, 'A mesa de trabalho de quem toca. Tudo fica no seu aparelho, nada vai para servidor nenhum.'),
      el('div', { class: 'row gap-2 mt-3 wrap' }, [
        el('button', { class: 'btn btn-secondary btn-sm', onclick: function () { global.App.atalhos(); } },
          [el('i', { 'data-lucide': 'keyboard' }), 'Atalhos']),
        el('button', { class: 'btn btn-secondary btn-sm', onclick: function () { global.App.sobre(); } },
          [el('i', { 'data-lucide': 'info' }), 'Sobre o ' + global.Identidade.NOME]),
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

  /**
   * A escolha do instrumento.
   *
   * E uma lista de TIMBRES, e nao de instrumentos. Para quem tem violao a
   * diferenca parece academica; para quem tem dois — um de aco e um de nylon —
   * sao dois sons de verdade, com o mesmo braco. Como o timbre e o que decide o
   * som e o timbre e o que diz qual braco usar, uma lista so resolve.
   *
   * O item sem braço continua na lista, avisado. Esconder a opcao esconde a
   * escolha; mostrar um braco de violao para quem toca teclado seria desenhar um
   * instrumento que a pessoa nao tem.
   */
  function secaoInstrumento(T, M) {
    const card = el('div', { class: 'card' });

    if (!T || typeof T.noPique !== 'function') {
      card.appendChild(el('div', { class: 'd' },
        'O módulo de som não carregou. O app continua tocando o tom de referência.'));
      return { linha: card, aviso: null };
    }

    card.appendChild(el('label', { class: 'label' }, 'O que você toca'));

    const ids = T.noPique();
    const atual = S.ajuste('instrumento', 'violao');

    const chips = el('div', { class: 'chips' });
    const aviso = el('div', { class: 'd mt-2' });

    ids.forEach(function (id) {
      const nome = T.nomeDe(id);
      const braco = M && typeof M.bracoPara === 'function' ? M.bracoPara(id) : null;
      const marcado = id === atual;

      chips.appendChild(el('button', {
        class: 'chip', 'aria-pressed': String(!!marcado),
        onclick: function () {
          S.setAjuste('instrumento', id);
          // A tela inteira e redesenhada: o aviso e a lista dependem da escolha,
          // e redesenhar so os botoes deixaria o "ligado" fora do lugar.
          render(document.getElementById('page-ajustes'));
        },
      }, nome + (braco ? ' · ' + braco.cordas + ' cordas' : '')));
    });
    card.appendChild(chips);

    const bracoDoAtual = M && typeof M.bracoPara === 'function' ? M.bracoPara(atual) : null;
    if (bracoDoAtual) {
      aviso.textContent = 'O braço aparece nas telas de teoria e no violão 3D.';
    } else if (ids.indexOf(atual) >= 0) {
      aviso.textContent = 'Esse não tem braço. O app não vai desenhar trastes para ele —'
        + ' o som funciona, o desenho não.';
    } else {
      aviso.textContent = 'A escolha salva não existe mais nesta versão do app.'
        + ' O som está no violão até você escolher outro.';
    }
    card.appendChild(aviso);

    return { linha: card, aviso: null };
  }

  function recarregar() {
    const p = document.getElementById('page-ajustes');
    if (p && p.classList.contains('active')) render(p);
  }

  /* O backup so ajuda se a pessoa souber que ele existe e quando foi feito.
   *
   * Sem esta linha, o app nao tinha como saber que a copia estava feita: o
   * contador "ha quanto tempo voce nao exporta" nao teria de onde sair, e a
   * tela nao poderia dizer "seu backup e de ontem" — que e a frase que faz
   * alguem apertar o botao.
   *
   * `registrarBackup` guarda no proprio store, entao a data sobrevive a
   * fechar o app. E o botao de apagar tudo tambem passa por aqui. */
  function marcarBackup() {
    const Arm = global.Armazenamento;
    if (Arm && typeof Arm.registrarBackup === 'function') return Arm.registrarBackup();
    return U.todayKey();
  }

  function exportar() {
    const hoje = U.todayKey();
    U.download('acorde-backup-' + hoje + '.json', S.exportar())
      .then(function (r) {
        if (r.via === 'nada') {
          UI.toast('Não consegui gerar o arquivo. Tente de novo.', { tipo: 'err', dur: 6000 });
          return;
        }
        if (r.cancelou) return;

        if (r.via === 'ancora') {
          marcarBackup();
          UI.toast('Backup salvo (' + hoje + '). Guarde o arquivo fora do navegador.', { tipo: 'ok', dur: 6000 });
          recarregar();
          return;
        }

        /* A partilha do sistema entregou o arquivo, mas QUEM GUARDA E A PESSOA.
         *
         * A versao anterior marcava o backup como feito no mesmo instante em que
         * a funcao de download retornava, sem saber de nada. No iPhone isso era o
         * pior defeito possivel: a folha de partilha abre, a pessoa cancela por
         * engano ou envia para o lugar errado, e o app ja tinha gravado "backup
         * feito" — desligando o aviso de "faz N dias sem backup", que e a unica
         * coisa que protege o repertorio de quem nao fez copia nenhuma.
         *
         * Entao aqui o app PERGUNTA, em vez de declarar. Um toque e o app
         * acredita na pessoa; sem o toque, o aviso continua aparecendo, que e o
         * comportamento certo. */
        UI.toast('Escolha "Salvar nos Arquivos" para guardar o backup.', {
          tipo: 'warn',
          dur: 12000,
          acaoTexto: 'Guardei',
          acao: function () {
            marcarBackup();
            UI.toast('Backup guardado (' + hoje + ').', { tipo: 'ok' });
            recarregar();
          },
        });
      });
  }

  /* O `accept` leva tres coisas, e as tres sao para o iPhone.
   *
   * No iOS o `accept` nao filtra por extensao: ele filtra pelo que o PROPRIO
   * iOS reconhece. E o WebKit avisa explicitamente (bug 279606) que "se nenhuma
   * extensao for suportada, nenhum arquivo pode ser selecionado".
   *
   * Isso e perigoso aqui: o seletor de arquivo e a unica coisa entre a pessoa e
   * a restauracao do repertorio. Quem perdeu tudo volta, toca em "Restaurar", e
   * se depara com um seletor sem nada selecionavel — e conclui que o backup
   * nunca existiu.
   *
   * Por isso tres valores:
   *   - `.json`, a extensao, que funciona no resto;
   *   - `application/json`, o tipo, para quem nao reconhece a extensao;
   *   - `application/octet-stream`, a rede de seguranca. E o tipo que o iOS
   *     sempre aceita, e e ele que garante que o seletor ofereca alguma coisa.
   *
   * A extensao e conferida no codigo, porque no iOS quem filtra de verdade e o
   * app: ali o `accept` e so uma sugestao de interface. */
  const ACEITE_BACKUP = '.json,application/json,application/octet-stream';

  function importar(modo) {
    const file = el('input', { type: 'file', accept: ACEITE_BACKUP, style: { display: 'none' } });
    document.body.appendChild(file);
    file.addEventListener('change', async function () {
      const f = file.files[0];
      document.body.removeChild(file);
      if (!f) return;
      /* No iOS o `accept` e so uma sugestao, e o `application/octet-stream`
       * deixa passar qualquer arquivo. E por isso que a extensao e conferida
       * aqui: e o app que filtra de verdade. A mensagem diz o que fazer em vez
       * de recusar em silencio, porque a pessoa esta a um toque de recuperar o
       * repertorio inteiro. */
      if (!/\.json$/i.test(f.name || '')) {
        UI.toast('Escolha o arquivo de backup do Clave, que termina em .json.', { tipo: 'err', dur: 6000 });
        return;
      }
      try {
        const txt = await U.readFile(f, false);
        const r = S.importar(txt, modo);
        UI.toast('Restaurado: ' + U.plural(r.escalas, 'evento') + ' e ' + U.plural(r.cifras, 'cifra'), { tipo: 'ok', dur: 4000 });
        recarregar();
      } catch (e) {
        UI.toast(e.message || 'Arquivo inválido', { tipo: 'err', dur: 5000 });
      }
    });
    file.click();
  }

  function apagar() {
    UI.confirmar({
      title: 'Apagar tudo', danger: true, okText: 'Apagar tudo',
      message: 'Isso apaga TODOS os seus eventos, cifras e preferências deste aparelho. Não da para desfazer.',
    }).then(function (ok) {
      if (!ok) return;
      S.apagar();
      UI.toast('Dados apagados', { tipo: 'ok' });
      global.App.ir('hoje');
    });
  }

  V.ajustes = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);