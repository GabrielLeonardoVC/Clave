/* =========================================================
   ACORDE - views/execucao.js
   A EXECUCAO DE UM REPERTORIO: tocar as musicas em ordem, sem voltar ao editor

   O QUE ISTO NAO E

   Nao e' um palco. `palco.js` continua sendo a SESSAO DE UMA MUSICA — video,
   voz, BPM, anotacoes — e continua sendo dono de tudo isso. Aqui nao ha
   metronomo, nem rolagem, nem gravador, nem player. Nenhuma logica foi copiada
   de la; a unica coisa que este arquivo chama e' `palco.abrirDeMusica`.

   A REGUA QUE GUIOU O DESENHO

   Trocar entre musicas trocando a FOLHA, e nao alterando o conteudo dela.

   Isso nao e' economia de codigo, e' a garantia de isolamento: se a folha e'
   recriada a cada musica, entao a transposicao de uma nao pode vazar para a
   seguinte (porque o estado vivia na folha), o player do audio de uma nao pode
   aparecer na outra, e a rolagem nao continua correndo. Um controlador que
   mutasse a folha teria de lembrar de desfazer cada uma dessas coisas, e
   esquecer uma delas seria um bug invisivel — o tipo que so aparece na missa,
   com gente olhando.

   O preco: a metronoma e a rolagem reiniciam a cada musica. E' o comportamento
   correto para quem abre uma musica nova, e foi o que a propria `palco.abrir`
   ja fazia quando alguém abria outra musica sem fechar a anterior.

   O ESTADO

   `sessao` guarda SO o necessario para saber onde estamos: qual evento, em qual
   posicao. Nenhuma copia de cifra, letra ou audio — a musica se resolve por
   `escala.musicas[indice]`, e o audio pela ficha que o palco ja sabe montar.
   Guardar a musica aqui seria a segunda copia, e a V5.12 mediu o que a primeira
   custa: 400 KB por evento.
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views || (global.Views = {});
  const U = global.Utils;
  const S = global.Store;
  /* `el` e' o construtor de elemento do `Utils`, nao um global. `palco.js`
   * faz o mesmo (`const { el } = U`) e e' por isso que la `el(...)` funciona
   * sem qualifier. Aqui o `U` precisa existir na hora do modulo carregar. */
  const { el } = U;

  /* Onde estamos. `null` = nenhuma execucao em curso.
   *
   * `indice` e' a posicao na lista do evento, e nao um id: a ordem de uma
   * missa e' o que a pessoa montou, e e' ela que a execucao percorre. */
  let sessao = null;
  /* A folha que esta sessao abriu. E o palco que devolve; o controlador so
   * guarda para poder fechar a SUA, e nao a ultima da pilha. */
  let ultimaFolha = null;

  const partes = () => {
    if (!sessao) return { escala: null, musica: null };
    const escala = S.porId(sessao.escalaId);
    if (!escala || !escala.musicas || !escala.musicas.length) {
      return { escala: null, musica: null };
    }
    const i = Math.min(Math.max(0, sessao.indice), escala.musicas.length - 1);
    return { escala: escala, musica: escala.musicas[i], indice: i, total: escala.musicas.length };
  };

  /* ================================================================
     O TRANSPOR DA SESSAO

     O CONTRATO, E POR QUE ELE E' ESTE

     `Music.transposeCifra(texto, semis, flat)` ja existe em `music.js` e e' um
     calculo PURO: recebe um texto e um numero de semitons, devolve o texto.
     Ele nao escreve na Store, nao mexe no repertorio e nao conhece a musica.
     A tela de Teoria usa exatamente assim: guarda `{ texto, semis }` num
     estado local e redesenha.

     O modo de execucao reusa esse motor, sem uma linha de calculo propria. O
     que ele guarda e so o numero de semitons.

     TEMPORARIO, E POR MUSICA

     Duas decisoes, e as duas foram pensadas para nao-surpreender:

     **1. E' temporario.** Nada aqui escreve na biblioteca. Se o musico sobe
     dois semitons para caber no instrumento durante a missa, a cifra da
     biblioteca continua como estava — e ele espera que continue, porque a
     proxima missa pode ser com outro instrumento.

     **2. E' por musica.** O estado e' um dicionario indexado pelo `id` da
     entrada, e nao um unico numero da sessao. Com um numero so, subir dois
     semitons em A contaminaria B ao seguir para ela — e a contagem voltaria a
     zero ao voltar para A, o que e' o oposto de "voltar ao que eu tinha feito".
     Por musica, cada uma guarda a sua, e voltar restaura.
     ================================================================ */
  function semisDe(musica) {
    if (!sessao || !musica) return 0;
    const id = musica.id;
    const v = sessao.semisPorMusica[id];
    return typeof v === 'number' ? v : 0;
  }

  /** A ficha da musica, com a cifra transposta quando a sessao pediu. */
  function fichaTransposta(escala, musica) {
    const M = global.Music;
    const ficha = S.fichaDe(musica, escala);
    const semis = semisDe(musica);
    if (semis && M && typeof M.transposeCifra === 'function' && ficha.cifra) {
      /* O sinal de bemol segue a NOTA DE DESTINO: subir para Db escreve Db, e
       * nao C#. E' a mesma conta que `teoria.js` faz antes de chamar o motor
       * — `flatPara(M.mod12(semis))` — com o mesmo ajuste do usuario
       * (`usarAmoles`: `sharps`, `flats` ou `auto`).
       *
       * Nao ha `M.notePc`: o mod12 do semitom ja e' a nota de destino, que e'
       * o que o motor vai usar. */
      const modo = (S.ajuste && S.ajuste('usarAmoles', 'auto')) || 'auto';
      const pc = M.mod12(semis);
      const flat = modo === 'sharps' ? false
        : modo === 'flats' ? true
          : (typeof M.useFlatsFor === 'function' ? M.useFlatsFor(pc) : false);
      ficha.cifra = M.transposeCifra(ficha.cifra, semis, flat);
      ficha.semisSessao = semis;
    } else {
      ficha.semisSessao = semis;
    }
    return ficha;
  }

  /** Sobe ou desce o tom da musica atual. Devolve os semitons agora. */
  function transpor(delta) {
    if (!sessao) return 0;
    const p = partes();
    if (!p.musica) return 0;
    const novo = (semisDe(p.musica) || 0) + (delta || 0);
    /* Semitons sao circulares: +12 e' o mesmo acorde. Guardar modulo 12 evita
     * que a conta cresca sem parar na mesma sessao e mantem o numero legivel. */
    sessao.semisPorMusica[p.musica.id] = ((novo % 12) + 12) % 12;
    return sessao.semisPorMusica[p.musica.id];
  }

  /** Volta a musica atual ao tom original. */
  function restaurarTom() {
    if (!sessao) return 0;
    const p = partes();
    if (!p.musica) return 0;
    sessao.semisPorMusica[p.musica.id] = 0;
    return 0;
  }

  function tomAtual() {
    const p = partes();
    if (!p.musica) return null;
    return { semis: semisDe(p.musica), original: p.musica.tom || '', nome: p.musica.nome };
  }

  /** A musica desta posicao esta no catalogo? */
  function orfa(musica) {
    if (!musica) return true;
    const S = global.Store;
    if (musica.cifraId) return !S.cifraPorId(musica.cifraId);
    /* Sem `cifraId`, a musica foi digitada direto no evento: ela carrega a
     * propria cifra e nao depende do catalogo. Nao e' orfa. */
    return false;
  }

  /**
   * Monta a barra de navegacao e a coloca no topo da folha do palco.
   *
   * A barra fica ACIMA do conteudo do palco, e nao no `foot`: o `foot` e' do
   * palco e pertence a sessao da musica. Empilhar a barra do repertorio ali
   * faria as duas coisas disputarem o mesmo espaco, e quem manda ali e' a
   * musica.
   */
  function barra(handle, p) {
    return pintar(handle, p);
  }

  /** Desenha a barra. So isto usa DOM — e o provador comportamental mede. */
  function pintar(handle, p) {
    const titulo = p.musica && p.musica.nome ? p.musica.nome : 'Sem título';
    const posicao = (p.indice + 1) + ' de ' + p.total;
    const primeira = p.indice <= 0;
    const ultima = p.indice >= p.total - 1;

    const linha = el('div', { class: 'ex-bar' }, [
      el('div', { class: 'ex-topo' }, [
        el('div', { class: 'grow', style: { minWidth: '0' } }, [
          el('div', { class: 'ex-titulo ellipsis' }, titulo),
          el('div', { class: 'ex-meta' }, [
            posicao,
            p.musica && p.musica.tom ? '· ' + p.musica.tom : '',
            p.escala ? '· ' + p.escala.titulo : '',
          ].filter(Boolean).join('  ')),
        ]),
        el('button', {
          class: 'btn-icon sm', type: 'button', 'aria-label': 'Sair da execução',
          title: 'Sair da execução',
          onclick: sair,
        }, el('i', { 'data-lucide': 'x' })),
      ]),
      /* A posicao tambem em texto grande, nao so no `aria`. Quem toca nao
       * olha o rotulo de um botao de 44 px; olha o numero. */
      el('div', { class: 'ex-botoes' }, [
        el('button', {
          class: 'btn btn-secondary', type: 'button',
          'aria-label': 'Música anterior',
          disabled: primeira,
          onclick: anterior,
        }, [el('i', { 'data-lucide': 'chevron-left' }), 'Anterior']),
        el('button', {
          class: 'btn btn-primary', type: 'button',
          'aria-label': 'Próxima música',
          disabled: ultima,
          onclick: proxima,
        }, ['Próxima', el('i', { 'data-lucide': 'chevron-right' })]),
      ]),
    ]);

    /* Uma musica orfa nao pode abrir a mesa — e a pessoa precisa saber disso
     * antes de descobrir que o audio sumiu. */
    if (orfa(p.musica)) {
      linha.insertBefore(el('div', { class: 'aviso-perm', role: 'alert' }, [
        el('div', { class: 'linha' }, [
          el('i', { 'data-lucide': 'triangle-alert' }),
          el('span', {}, 'Esta música não está mais na sua biblioteca. Você pode seguir para a próxima ou tirar do repertório.'),
        ]),
      ]), linha.children[1] || null);
    }

    /* TRANSPOR: tres botoes e um numero.
     *
     * Subir, descer e voltar ao original. Nao ha tela nova: quem esta tocando
     * nao pode perder o lugar da musica na tela para mudar o tom.
     *
     * O rotulo do meio mostra o quanto se afasta do original — `+2`, ou o
     * nome do tom de destino quando a musica tem tom anotado. Quem esta num
     * so precisa saber que mudou e o quanto; o acorde ja esta na cifra acima. */
    const semis = semisDe(p.musica);
    const rotuloTom = semis === 0
      ? (p.musica.tom || 'tom original')
      : (p.musica.tom ? p.musica.tom + ' ' + semis : '+' + semis + (semis > 1 ? ' semitons' : ' semitom'));

    linha.insertBefore(el('div', { class: 'ex-tom' }, [
      el('button', {
        class: 'btn btn-secondary', type: 'button', 'aria-label': 'Descer um semitom',
        onclick: function () { aplicar(-1); },
      }, [el('i', { 'data-lucide': 'chevron-down' }), '−']),
      el('span', {
        class: 'ex-tom-valor' + (semis ? ' movido' : ''),
        'aria-live': 'polite',
        title: semis ? 'Transposto ' + semis + ' semitom(s) nesta sessão' : 'Tom original',
      }, rotuloTom),
      el('button', {
        class: 'btn btn-secondary', type: 'button', 'aria-label': 'Subir um semitom',
        onclick: function () { aplicar(1); },
      }, ['+', el('i', { 'data-lucide': 'chevron-up' })]),
      semis !== 0 ? el('button', {
        class: 'btn btn-ghost', type: 'button', 'aria-label': 'Voltar ao tom original',
        title: 'Voltar ao tom original',
        /* `restaurarTom` sozinho NAO BASTAVA, e isto era um bug real.
         *
         * O botao chamava `restaurarTom`, que zera o semitom guardado, e mais
         * nada. O estado voltava a zero enquanto a folha continuava mostrando a
         * cifra transposta, porque `restaurarTom` nao redesenha nada. Medido no
         * navegador: depois de C, C+1, C+2, C+1 e clicar em "Original", a tela
         * mostrava `Db Ebm Ab7 G B Db/F Bbm7 Ab/C` — o estado era 0 e a tela
         * discordava.
         *
         * Pior: o proximo "+" sairia de um numero que a tela nao mostrava, e
         * quem estivesse tocando leria os acordes errados sem nenhuma pista de
         * que algo estava errado. Reapintar e obrigatorio aqui.
         *
         * NOTA SOBRE O TEXTO DESTE COMENTARIO
         *
         * Nao ha apostrofo de crase em nenhum ponto. O `check-botoes` acha o
         * fim de um `el(..., { ... })` contando aspas, e nao tira comentario
         * antes de contar. Um `e` seguido de apostrofo aqui desequilibra essa
         * contagem, o "fim" do botao passa do ponto, e o checker acusa um botao
         * dentro de outro que nao existe. Foi exatamente o que aconteceu: um
         * comentario honesto acusou um bug que nao havia. */
        onclick: function () { restaurarTom(); reapintar(); },
      }, [el('i', { 'data-lucide': 'undo-2' }), 'Original']) : null,
    ]), linha.children[1] || null);

    function reapintar() {
      /* Recria a folha da MESMA posicao, ja com o estado novo.
       *
       * Existe porque o "Voltar ao tom original" mudava o estado sem redesenhar
       * (medido: a tela mostrava a cifra transposta com o estado ja em zero).
       * Fechar antes e' o mesmo cuidado do `aplicar`: sem isso, cada apertada
       * empilharia uma folha. */
      fechar();
      mostrar(p.indice);
    }

    function aplicar(delta) {
      transpor(delta);
      /* Fecha ANTES de recriar, exatamente como `proxima` e `anterior` fazem.
       *
       * A primeira versao so chamava `mostrar`. Medido no navegador: apertar
       * "+" empilhava uma folha nova por cima da anterior, e a contagem de
       * barras ia 1, 2, 3 e ficava em 3 — tres copias da barra e tres handlers
       * de clique vivos, com a pessoa achando que tinha apertado uma vez.
       *
       * Trocar de musica ja fechava; so o transpose nao fechava. `fechar` so
       * derruba A NOSSA folha (ela guarda o handle), entao nao ha risco de
       * derrubar a folha de outra pessoa. */
      fechar();
      mostrar(p.indice);
    }

    handle.node.insertBefore(linha, handle.node.firstChild);
    global.UI.icons(linha);
    return linha;
  }

  /** Troca a folha do palco para a posicao dada. */
  function mostrar(indice) {
    const Mesa = Views.palco;
    const S = global.Store;
    if (!Mesa || typeof Mesa.abrir !== 'function') {
      global.UI.toast('Mesa de ensaio indisponível', { tipo: 'err' });
      return false;
    }
    if (!sessao) return false;
    sessao.indice = indice;
    const p = partes();
    if (!p.escala || !p.musica) { fechar(); return false; }

    if (orfa(p.musica)) {
      /* Nao abrir a mesa de uma musica que nao existe mais: a ficha viria pela
       * metade, e o palco mostraria um titulo com o video e o audio vazios.
       * A barra de navegacao ainda aparece, para a pessoa poder seguir. */
      fechar();
      const handle = global.UI.sheet({
        title: p.musica.nome || 'Música',
        sub: (p.indice + 1) + ' de ' + p.total + (p.escala ? ' · ' + p.escala.titulo : ''),
        body: el('div', { class: 'stack gap-3' }, [
          el('div', { class: 'aviso-perm', role: 'alert' }, [
            el('div', { class: 'linha' }, [
              el('i', { 'data-lucide': 'triangle-alert' }),
              el('span', {}, 'Esta música não está mais na sua biblioteca. Ela ficou no repertório, mas o original foi excluído.'),
            ]),
          ]),
          el('p', { class: 'fs-sm muted' },
            p.musica.tom ? 'Tom anotado: ' + p.musica.tom : 'Sem tom anotado.'),
        ]),
      });
      const Linha = document.createElement('div');
      handle.node.insertBefore(Linha, handle.node.firstChild);
      /* A propria navigation da folha orfa: seguir, voltar ou tirar.
       *
       * O handle precisa ser guardado em `ultimaFolha` como em qualquer outra
       * folha. Sem isso, `fechar()` nao tinha o que derrubar ao navegar a
       * partir de uma orfa: a folha anterior ficava viva e cada "Proxima"
       * empilhava mais uma. Foi o mesmo bug do transpose, pelo mesmo motivo —
       * uma folha que a sessao abriu e a sessao nao conhece. */
      ultimaFolha = handle;
      montarNavegacaoOrfa(handle, p);
      global.UI.icons(handle.node);
      return true;
    }

    const handle = Mesa.abrir(fichaTransposta(p.escala, p.musica));
    /* A SEPARACAO ENTRE DECIDIR E PARECER
     *
     * `mostrar` decide ONDE estamos; `pintar` decide COMO isso aparece. A
     * decisao e' aritmetica e consulta — e por isso que este arquivo a testa em
     * Node, sem DOM nenhum. O desenho usa `el()`, que precisa de `document`.
     *
     * Juntar as duas coisas deixava a sessao intestavel sem um navegador inteiro:
     * um `indice + 2` so apareceria na missa. Quebrar aqui foi o que permitiu
     * medir. */
    ultimaFolha = handle;
    if (handle && handle.node) pintar(handle, p);
    return true;
  }

  function montarNavegacaoOrfa(handle, p) {
    handle.node.insertBefore(el('div', { class: 'ex-botoes mt-3' }, [
      el('button', {
        class: 'btn btn-secondary', type: 'button',
        'aria-label': 'Música anterior', disabled: p.indice <= 0, onclick: anterior,
      }, 'Anterior'),
      el('button', {
        class: 'btn btn-primary', type: 'button',
        'aria-label': 'Próxima música', disabled: p.indice >= p.total - 1, onclick: proxima,
      }, 'Próxima'),
      el('button', {
        class: 'btn btn-danger', type: 'button',
        /* O nome acessivel nao pode ser so o texto. "Tirar do repertorio"
         * descarta a musica do EVENTO; lido por um leitor de tela, um botao
         * sem rotulo explicito nao diz o que vai acontecer. O texto continua
         * igual — o que muda e' que a intencao tambem esta no `aria`. */
        'aria-label': 'Tirar do repertório',
        title: 'Tirar esta música do repertório (a cifra continua na biblioteca)',
        onclick: function () {
          const S2 = global.Store;
          const e = S2.porId(sessao.escalaId);
          if (e && e.musicas) { e.musicas.splice(sessao.indice, 1); S2.mudou('escala'); }
          /* `fechar`, nao `handle.close()` solto: fechar a folha e esquecer de
           * soltar o handle deixaria `ultimaFolha` apontando para uma folha
           * morta, e o proximo `fechar()` tentaria fecha-la de novo. */
          fechar();
          const depois = partes();
          if (depois.escala && depois.musica) mostrar(depois.indice);
          else sair();
        },
      }, 'Tirar do repertório'),
    ]), handle.node.firstChild);
  }

  function fechar() {
    /* Fecha a folha que ESTA sessao abriu, e so ela.
     *
     * A primeira versao procurava `document.querySelectorAll('.scrim')` e
     * clicava no botao da ultima. Duas consequencias ruins: o controlador
     * dependia do DOM, o que o tornava intestavel sem navegador; e, pior, ele
     * podia fechar a folha de outra pessoa — a ultima da pilha nao e
     * necessariamente a que a execucao abriu.
     *
     * O palco devolve o handle da folha, e a folha tem `close()`. Guardar o
     * handle e' a unica forma de saber qual folha e' a nossa. */
    if (ultimaFolha && typeof ultimaFolha.close === 'function') {
      try { ultimaFolha.close(); } catch (e) { /* ja estava fechada */ }
    }
    ultimaFolha = null;
  }

  /* ---------------- o controlador ---------------- */

  function iniciar(escala) {
    /* Um inicio que falha TEM de limpar a sessao anterior.
     *
     * Sem isto, `iniciar` devolvia `false` para um repertorio vazio e deixava a
     * sessao do repertorio anterior de pe. `ativa()` continuava dizendo que
     * havia execucao em curso, e a proxima tentava mover um indice de um evento
     * que ja nao existia. Quem chamasse `ativa()` para decidir se mostra a
     * barra veria um "sim" que nao correspondia a nada.
     *
     * A sessao e' zerada primeiro, e so depois se decide se ha o que comecar. */
    sessao = null;
    ultimaFolha = null;
    if (!escala) return false;
    if (!escala.musicas || !escala.musicas.length) {
      global.UI.toast('Este repertório não tem músicas ainda', { tipo: 'err' });
      return false;
    }
    sessao = { escalaId: escala.id, indice: 0, semisPorMusica: {} };
    return mostrar(0);
  }

  function proxima() {
    if (!sessao) return false;
    const p = partes();
    if (!p.escala) return false;
    /* Na ultima: NAO fecha e NAO volta. Quem estiver tocando precisa saber
     * que acabou — e fechar a folha sem querer seria perder o lugar. */
    if (p.indice >= p.total - 1) {
      global.UI.toast('Última música do repertório', { tipo: 'info', dur: 2200 });
      return false;
    }
    fechar();
    return mostrar(p.indice + 1);
  }

  function anterior() {
    if (!sessao) return false;
    const p = partes();
    if (!p.escala) return false;
    if (p.indice <= 0) {
      global.UI.toast('Primeira música do repertório', { tipo: 'info', dur: 2200 });
      return false;
    }
    fechar();
    return mostrar(p.indice - 1);
  }

  function sair() {
    sessao = null;
    fechar();
    return true;
  }

  function ativa() { return !!sessao; }
  function posicao() {
    const p = partes();
    return p.musica ? { indice: p.indice, total: p.total, nome: p.musica.nome, orfa: orfa(p.musica) } : null;
  }

  Views.execucao = {
    iniciar, proxima, anterior, sair, ativa, posicao, mostrar,
    transpor, restaurarTom, tomAtual, semisDe,
    /* Para o teste de estado: qual sessao esta em curso. */
    sessaoAtual: () => sessao,
    fechar,
  };
  global.ExecucaoView = Views.execucao;

  if (typeof module !== 'undefined' && module.exports) module.exports = Views.execucao;
})(typeof window !== 'undefined' ? window : globalThis);