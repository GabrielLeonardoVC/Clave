/* =========================================================
   tools/guarda-execucao.js
   O QUE SO O NAVEGADOR VÊ

   POR QUE ESTE ARQUIVO EXISTE, E POR QUE ELE E' SEPARADO

   Em V5.17, tres bugs vivem no navegador enquanto as 65 aserções de
   `test-execucao.js` passavam sem uma palavra:

     A. o transpose empilhava uma folha por clique (barras 1, 2, 3...);
     B. a folha órfã não registrava o handle, e navegar a partir dela empilhava;
     C. "Tirar do repertório" fechava a folha sem soltar o handle.

   Os 65 testes medem ESTADO: índice, semitons, ordem. Nenhum deles pergunta
   quantas folhas estão no DOM, porque isso exige um DOM de verdade. Fabricar
   um DOM falso aqui seria pior que não ter teste — o DOM falso aceitaria a
   folha duplicada e o teste passaria.

   Este arquivo roda dentro do app de verdade. Não é importado por
   `index.html` e não entra no cache do PWA: ele é carregado por `fetch` e
   avaliado na hora, por um harness.

   O QUE ESTE ARQUIVO SE PROIBE DE FAZER

   Não usa `source.includes()` para provar nada. Não mede tempo para decidir
   se algo passou. Cada asserção olha o DOM ou o estado depois de uma ação
   real — clicar no botão que a pessoa clica, não chamar a função por dentro.

   As três regressões A, B e C vivem aqui e em nenhum outro lugar.
   ========================================================= */
(function () {
  'use strict';

  const esp = (ms) => new Promise((z) => setTimeout(z, ms));
  const txt = (b) => (b.textContent || '').trim();

  let passou = 0; let falhou = 0;
  const problemas = [];
  const ok = (cond, titulo, detalhe) => {
    if (cond) { passou++; }
    else { falhou++; problemas.push(titulo + (detalhe ? ' — ' + detalhe : '')); }
    return !!cond;
  };

  /* A folha mais NOVA da pilha. `querySelector('.scrim')` devolve a mais
     antiga, que é a que a pessoa não está vendo — foi assim que uma contagem
     de folhas mentiu numa rodada anterior. */
  const topo = () => { const s = document.querySelectorAll('.scrim'); return s[s.length - 1]; };
  const folhas = () => document.querySelectorAll('.scrim').length;
  const barras = () => document.querySelectorAll('.ex-bar').length;

  const botao = (re) => {
    const f = topo(); if (!f) return null;
    return Array.from(f.querySelectorAll('button'))
      .find((b) => b.offsetParent !== null && !b.disabled && new RegExp(re).test(txt(b)));
  };
  const porRotulo = (re) => {
    const f = topo(); if (!f) return null;
    return Array.from(f.querySelectorAll('button'))
      .find((b) => b.offsetParent !== null && re.test(b.getAttribute('aria-label') || ''));
  };

  /* A CIFRA COMO A PESSOA VÊ: os acordes e só os acordes, na ordem, sem as
     palavras do palco. Ler a folha inteira contaria o título, os botões e a
     letra, e um bug de duplicação se esconderia dentro desse barulho.

     A primeira versão filtrava só por `.ex-bar`, e o título da música aparece
     DUAS vezes na folha: na barra e no cabeçalho do palco. Assim "Completa" e
     "Começar" entraram na lista e a contagem deu 11 em vez de 8. Um teste que
     mede a coisa errada reprovando não é sinal de produto quebrado — é sinal de
     teste ruim. */
  const acordes = () => {
    const f = topo(); if (!f) return [];
    /* O titulo da folha e' um bloco de texto igual a qualquer outro, e nao e'
     * um acorde. Descartar pela classe do elemento nao adianta: o titulo do
     * palco e' um `div` e nao casa com `.sheet-title`, `h2` nem `h3` — as tres
     * tentativas anteriores, todas minhas. O que sempre funciona e' comparar
     * com o titulo que a BARRA desta execucao esta exibindo: e' o mesmo texto,
     * e e' ele que diz qual musica esta aberta. */
    const cab = f.querySelector('.ex-titulo');
    const tituloDaFolha = cab ? txt(cab) : '';
    return Array.from(f.querySelectorAll('*'))
      .filter((x) => x.children.length === 0
        && !x.closest('button') && !x.closest('h1,h2,h3,h4,h5')
        && x.closest('.ex-bar') === null && x.closest('.ex-botoes') === null)
      .map((x) => txt(x))
      .filter((t) => t && t !== tituloDaFolha && /^[A-G][^\s]{0,7}$/.test(t) && t.length <= 8);
  };

  /* ---- A REFERENCIA INDEPENDENTE ----
     A tabela de alturas abaixo NAO é o motor: é uma tabela escrita à mão, com
     os 12 sons. Comparar contra `Music.transposeCifra(...)` seria comparar o
     motor com ele mesmo, e passaria mesmo com o motor errado — foi o que a
     regra do projeto proibiu desde o começo.

     Com esta tabela o teste responde a uma pergunta musical de verdade: o acorde
     que estava em C está um semitom acima? A sétima continua sendo sétima? O
     baixo do slash chord andou a mesma distância? A preferência entre sustenido e
     bemol NAO e' verificada aqui, porque essa escolha e' do usuario e nao e'
     erro nenhum — o que seria erro e' o acorde nao andar. */
  const ALTURA = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
    'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const pc = (n) => (ALTURA[n] === undefined ? null : ALTURA[n]);
     /* Separa a raiz do que e qualidade/baixo: a raiz e' o que casa com a tabela
     de alturas, e o resto fica como estava. Sem depender do motor. */
  const partes = (c) => {
    const m = /^([A-G][#b]?)(.*)$/.exec(c);
    return m ? { raiz: m[1], resto: m[2] } : { raiz: '', resto: c };
  };

  const posicao = () => {
    const f = topo(); if (!f) return null;
    const bar = f.querySelector('.ex-bar');
    return bar ? (bar.querySelector('.ex-meta') || {}).textContent : null;
  };
  const titulo = () => {
    const f = topo(); if (!f) return null;
    const bar = f.querySelector('.ex-bar');
    return bar ? txt(bar.querySelector('.ex-titulo')) : null;
  };
  const tom = () => {
    const f = topo(); if (!f) return null;
    const t = f.querySelector('.ex-tom-valor');
    return t ? txt(t) : null;
  };

  async function limpar() {
    /* FECHAR TUDO ANTES DE RECOMEÇAR O CENÁRIO.
     *
     * A primeira versão desta suíte media `folhas()` sem nunca fechar a
     * execução anterior, e accuseu o produto de empilhar: `folhas=2`, depois
     * `folhas=3`. Eram as folhas das SEÇÕES ANTERIORES da própria suíte. É a
     * terceira vez nesta rodada que a sonda inventa um bug (o `mod12`, o
     * `M.notePc`, a injeção no fim do arquivo); e a segunda vez em que a
     * conclusão seria "empilha" por causa de sujeira minha.
     *
     * `sair()` derruba a folha da execução; `closeAllSheets` derruba o resto. */
    try { if (window.Views && window.Views.execucao) window.Views.execucao.sair(); } catch (e) { /* ja saiu */ }
    await esp(500);
    try { if (window.UI && window.UI.closeAllSheets) window.UI.closeAllSheets(); } catch (e) { /* sem pilha */ }
    await esp(400);
    while (document.querySelector('.scrim')) {
      const s = document.querySelectorAll('.scrim');
      const t = s[s.length - 1];
      const x = t.querySelector('[data-lucide="x"], .sheet-close, [aria-label*="echar" i], [aria-label="Fechar"]');
      if (!x) break;
      x.click();
      await esp(320);
    }
  }

  function cenario(musicas, apagarCifra) {
    const S = window.Store;
    const d = new Date(); const pd = (n) => String(n).padStart(2, '0');
    const chave = d.getFullYear() + '-' + pd(d.getMonth() + 1) + '-' + pd(d.getDate());
    S.apagar();
    musicas.forEach((m) => {
      S.db.cifras.push(S.normCifra({
        titulo: m.titulo, tom: m.tom, bpm: 90, categoria: 'liturgia',
        cifra: m.cifra, letra: 'v1',
      }));
    });
    S.gravar();
    const ev = S.normEscala({ data: chave, hora: '19:00', titulo: 'Missa', musicas: [] });
    S.cifras().forEach((c) => {
      ev.musicas.push(S.normMusica({
        nome: c.titulo, tom: c.tom, bpm: c.bpm, categoria: c.categoria, cifraId: c.id,
      }));
    });
    S.db.escalas.push(ev); S.gravar();
    if (apagarCifra) {
      const alvo = S.cifras().filter((c) => c.titulo === apagarCifra)[0];
      if (alvo) S.db.cifras.splice(S.db.cifras.indexOf(alvo), 1);
      S.gravar();
    }
  }

  async function comecar() {
    window.App.ir('agenda'); await esp(1000);
    const card = Array.from(document.querySelectorAll('.day-ev'))
      .find((c) => /Missa/.test(c.innerText));
    if (!card) return false;
    (card.querySelector('div[style*="cursor"]') || card).click();
    await esp(1300);
    const c = Array.from(document.querySelectorAll('.scrim button'))
      .find((b) => /Começar o repertório/.test(b.textContent));
    if (!c) return false;
    c.click(); await esp(1600);
    return true;
  }

  window.__guardaExecucao = async function () {
    const inicio = Date.now();

    /* ============ 1. QUALIDADES DE ACORDE (FASE 3) ============
       A cifra tem maior, menor, sétima, sustenido, bemol e dois slash
       chords. O que se prova não é que o tom mudou: é que a CIFRA INTEIRA
       acompanhou, nenhum acorde virou maior e nenhum texto sumiu. */
    const COMPLETA = 'C\nDm\nG7\nF#\nBb\nC/E\nAm7\nG/B';
    await limpar();
    cenario([{ titulo: 'Completa', tom: 'C', cifra: COMPLETA }]);
    ok(await comecar(), 'o repertorio de uma musica abriu');
    await esp(600);

    const base = acordes();
    ok(base.length === 8, 'a cifra original mostra os 8 acordes', 'veio ' + base.length + ': ' + base.join(' '));

    /* Compara a cifra original com a transposta, pergunta musical a pergunta
       musical. Cada acorde ocupa a MESMA posicao nas duas listas, entao cada par
       e' o mesmo acorde antes e depois. */
    const conferir = (antes, depois, semis, rotulo) => {
      ok(antes.length === depois.length,
        rotulo + ': a mesma quantidade de acordes', antes.length + ' -> ' + depois.length);
      if (antes.length !== depois.length) return;
      for (let i = 0; i < antes.length; i++) {
        const a = partes(antes[i]); const b = partes(depois[i]);
        const pa = pc(a.raiz); const pb = pc(b.raiz);
        ok(pa !== null && pb !== null && ((pb - pa + 12) % 12) === ((semis % 12) + 12) % 12,
          rotulo + ': ' + antes[i] + ' andou ' + semis + ' semitom(s) (virou ' + depois[i] + ')',
          'de ' + pa + ' para ' + pb);
        /* A qualidade e' o que vem DEPOIS da raiz. Um menor que vira maior nao
         * anda um semitom: ele troca de acorde. */
        /* Num slash chord o resto tem o BAIXO, e o baixo anda. Comparar a
         * qualidade inteira exigiria '/E' == '/F', o que e' falso por definicao:
         * a primeira versao desta prova afirmava isso e reprovava com o motor
         * certo. Aqui so se compara a parte ANTES da barra. */
        const qual = (x) => (x.charAt(0) === '/' ? '' : x);
        ok(qual(a.resto) === qual(b.resto),
          rotulo + ': a qualidade de ' + antes[i] + ' foi preservada (' + (qual(a.resto) || 'maior') + ')',
          "'" + a.resto + "' virou '" + b.resto + "'");
        /* O baixo de um slash chord tambem e' uma nota: ele anda junto. */
        if (a.resto.charAt(0) === '/' && b.resto.charAt(0) === '/') {
          const ba = pc(a.resto.slice(1)); const bb = pc(b.resto.slice(1));
          ok(ba !== null && bb !== null && ((bb - ba + 12) % 12) === ((semis % 12) + 12) % 12,
            rotulo + ': o baixo de ' + antes[i] + ' andou junto (' + a.resto + ' -> ' + b.resto + ')',
            'de ' + ba + ' para ' + bb);
        }
      }
    };

    /* +1 e +2: o que precisa NAO acontecer e' mais forte do que o que precisa. */
    porRotulo(/Subir um semitom/).click(); await esp(1300);
    const p1 = acordes();
    conferir(base, p1, 1, '+1');
    ok(!base.some((x) => p1.indexOf(x) >= 0), '+1: nenhum acorde ficou parado no tom antigo',
      base.filter((x) => p1.indexOf(x) >= 0).join(' ') || '(nenhum)');

    porRotulo(/Subir um semitom/).click(); await esp(1300);
    const p2 = acordes();
    conferir(base, p2, 2, '+2');

    porRotulo(/Descer um semitom/).click(); await esp(1300);
    const volta1 = acordes();
    ok(volta1.join('|') === p1.join('|'), '-1 volta EXATAMENTE ao estado de +1', volta1.join(' '));

    porRotulo(/Voltar ao tom original/).click(); await esp(1400);
    const original = acordes();
    ok(original.join('|') === base.join('|'), 'restaurar volta a cifra inteira', original.join(' '));

    /* +12 tem de dar a MESMA coisa: e' a mesma nota uma oitava acima. */
    for (let i = 0; i < 12; i++) { const b = porRotulo(/Subir um semitom/); if (b) b.click(); }
    await esp(1600);
    const d12 = acordes();
    ok(d12.join('|') === base.join('|'), '+12 volta a cifra original (mesma nota, oitava acima)', d12.join(' '));
    ok(topo().querySelectorAll('.ex-bar').length === 1, '+12 nao empilhou barras');
    ok(folhas() === 1, '+12 nao empilhou folhas');

    /* ============ 2. REGRESSÃO DO BUG A (FASE 7) ============
       Transpose não empilha. Este é o bug que os 65 testes de estado não
       pegaram: o estado estava certo a cada passo e havia três barras. */
    await limpar();
    cenario([
      { titulo: 'A', tom: 'C', cifra: 'C\nG' },
      { titulo: 'B', tom: 'G', cifra: 'G\nC' },
      { titulo: 'C', tom: 'Dm', cifra: 'Dm\nC' },
    ]);
    window.App.ir('agenda'); await esp(500);
    await comecar(); await esp(800);
    ok(barras() === 1 && folhas() === 1, 'BUG A: abre com uma barra e uma folha',
      'barras=' + barras() + ' folhas=' + folhas());

    let piorBarras = 1; let piorFolhas = 1;
    for (let i = 0; i < 10; i++) { porRotulo(/Subir um semitom/).click(); await esp(260); }
    await esp(900);
    piorBarras = Math.max(piorBarras, barras()); piorFolhas = Math.max(piorFolhas, folhas());
    ok(barras() === 1 && folhas() === 1, 'BUG A: dez "+" seguidos nao empilharam',
      'barras=' + barras() + ' folhas=' + folhas() + ' (pior visto ' + piorBarras + '/' + piorFolhas + ')');
    const tomApos10 = tom();

    for (let i = 0; i < 10; i++) { porRotulo(/Descer um semitom/).click(); await esp(260); }
    await esp(900);
    ok(barras() === 1 && folhas() === 1, 'BUG A: dez "-" seguidos nao empilharam',
      'barras=' + barras() + ' folhas=' + folhas());
    ok(tom() === 'C', 'BUG A: dez para cima e dez para baixo volta ao tom original',
      'ficou em ' + tom() + ' (era ' + tomApos10 + ' antes de descer)');

    /* ==== 3. ISOLAMENTO VISUAL (FASE 3 da rodada anterior, agora com prova) ==== */
    porRotulo(/Subir um semitom/).click(); await esp(300);
    porRotulo(/Subir um semitom/).click(); await esp(1100);
    ok(tom() !== 'C', 'A esta em +2');
    botao('Próxima').click(); await esp(1200);
    ok(titulo() === 'B', 'foi para B', 'titulo=' + titulo());
    ok(tom() === 'G', 'BUG: B nao herdou o +2 de A', 'tom de B = ' + tom());
    botao('Próxima').click(); await esp(1200);
    ok(titulo() === 'C' && tom() === 'Dm', 'C nao herdou nada de ninguem', titulo() + ' / ' + tom());
    botao('Anterior').click(); await esp(1100);
    botao('Anterior').click(); await esp(1200);
    ok(titulo() === 'A', 'voltou para A', 'titulo=' + titulo());
    ok(tom() !== 'C', 'A guardou o +2 ao voltar', 'tom=' + tom());
    ok(barras() === 1 && folhas() === 1, 'BUG A: navegar ida e volta nao empilhou',
      'barras=' + barras() + ' folhas=' + folhas());

    /* ============ 4. TECLADO (FASE 5) ============
       O QUE DÁ E O QUE NÃO DÁ — e é melhor dizer do que fingir.

       A primeira versão desta prova disparava um `KeyboardEvent('Tab')` e
       contava as paradas de foco. Isso não funciona: Tab é ação NATIVA do
       navegador, e um evento sintético não a dispara. A prova contava zero
       e podia ter "passado" medindo nada. Aqui o que se mede é o que dá:

         - cada controle da barra RECEBE foco (`.focus()` move o `activeElement`);
         - o foco chega no DOM deles, na ordem em que aparecem;
         - cada um tem nome acessível;
         - e o clique no controle funciona, que é o que o ENTER dispara.

       O que NÃO é medido: a tecla ENTER/Space em si, e a ordem do Tab do
       navegador. Ativação por teclado exige evento confiável, e não existe
       jeito de fabricar um. Fica como NÃO VALIDADO, dito aqui dentro do
       teste, e não escondido no relatório. */
    const f = topo();
    const controles = Array.from(f.querySelectorAll('.ex-bar button:not([disabled]), .ex-botoes button:not([disabled])'));
    let focaveis = 0; let semNome = 0; let semAnel = 0;
    controles.forEach((b) => {
      b.focus();
      if (document.activeElement === b) focaveis++;
      const nome = (b.getAttribute('aria-label') || txt(b) || '').trim();
      if (!nome) semNome++;
      const cs = getComputedStyle(b);
    });
    ok(controles.length >= 5, 'a barra tem os controles esperados', 'veio ' + controles.length);
    ok(focaveis === controles.length, 'todo controle da barra recebe foco',
      focaveis + ' de ' + controles.length);
    ok(semNome === 0, 'todo controle tem nome acessivel', semNome + ' sem nome');
    /* `focus()` programatico NAO casa `:focus-visible`, entao medir o outline
     * por getComputedStyle aqui mede o estado errado — a primeira versao acusou
     * 2 controles sem anel por causa disso. O que existe de verdade e' se a
     * folha de estilo declara foco visivel. */
    let temRegraFoco = 0;
    for (const fh of document.styleSheets) {
      let regras; try { regras = fh.cssRules; } catch (e) { continue; }
      if (!regras) continue;
      for (const r of regras) if (r.selectorText && /:focus-visible/.test(r.selectorText)) temRegraFoco++;
    }
    ok(temRegraFoco > 0, 'a folha de estilo declara :focus-visible',
      temRegraFoco + ' regra(s); o anel em si nao e automatizavel aqui');
    void semAnel;

    /* um disabled NAO pode executar acao */
    const primeira = topo().querySelector('.ex-botoes button[disabled]');
    const desabilitado = !!primeira;
    ok(desabilitado, 'o botao da ponta comeca desabilitado', 'ninguem desabilitado na primeira musica');
    if (desabilitado) {
      const posAntes = posicao();
      primeira.click(); await esp(700);
      ok(posicao() === posAntes, 'botao desabilitado nao executa acao',
        'de ' + posAntes + ' para ' + posicao());
    }

    /* ---- os nomes acessiveis, lidos do DOM ---- */
    const nomes = {};
    Array.from(topo().querySelectorAll('button')).forEach((b) => {
      const n = b.getAttribute('aria-label') || txt(b);
      if (n) nomes[n] = true;
    });
    ['Sair da execução', 'Descer um semitom', 'Subir um semitom', 'Música anterior', 'Próxima música']
      .forEach((n) => ok(nomes[n], 'aria-label presente: ' + n));
    ok(/Voltar ao tom original/.test(Object.keys(nomes).join('|')) || tom() === 'C',
      'o botao de restaurar original so aparece quando ha desvio (como deve)');

    /* ============ 5. REGRESSÃO DO BUG B E C (FASE 7) ============ */
    await limpar();
    cenario([
      { titulo: 'A', tom: 'C', cifra: 'C\nG' },
      { titulo: 'B', tom: 'G', cifra: 'G\nC' },
      { titulo: 'C', tom: 'Dm', cifra: 'Dm\nC' },
    ], 'B');
    window.App.ir('agenda'); await esp(500);
    await comecar(); await esp(800);

    ok(folhas() === 1 && barras() === 1, 'BUG B: abre com uma folha so',
      'folhas=' + folhas() + ' barras=' + barras());
    botao('Próxima').click(); await esp(1200);
    const orfaAviso = !!topo().querySelector('.aviso-perm');
    ok(orfaAviso, 'a orfa mostra o aviso na tela', 'sem .aviso-perm');
    ok(/não está mais na sua biblioteca/.test(topo().innerText), 'o aviso diz o que aconteceu');
    ok(/2 de 3/.test(topo().innerText), 'a posicao da orfa e 2 de 3');

    botao('Próxima').click(); await esp(1200);
    ok(titulo() === 'C', 'BUG B: a sequencia CONTINUA depois da orfa', 'titulo=' + titulo());
    ok(folhas() === 1, 'BUG B: passar pela orfa nao empilhou folha', 'folhas=' + folhas());
    botao('Anterior').click(); await esp(1100);
    ok(orfaAviso === true && !!topo().querySelector('.aviso-perm'), 'BUG B: voltar traz a orfa de volta');
    botao('Anterior').click(); await esp(1200);
    ok(titulo() === 'A', 'BUG B: e de volta para A', 'titulo=' + titulo());
    ok(folhas() === 1 && barras() === 1, 'BUG B: nenhuma folha sobrou no caminho inteiro',
      'folhas=' + folhas() + ' barras=' + barras());

    /* BUG C: tirar deixa handle solto? */
    botao('Próxima').click(); await esp(1300);
    ok(!!topo().querySelector('.aviso-perm'), 'BUG C: voltou para a orfa');
    const tirar = botao('Tirar do repertório');
    ok(!!tirar, 'BUG C: o botao "Tirar do repertorio" existe');
    if (tirar) {
      ok(tirar.getAttribute('aria-label') === 'Tirar do repertório',
        'FASE 5: "Tirar do repertorio" tem nome acessivel explicito',
        'aria-label=' + tirar.getAttribute('aria-label'));
      tirar.click(); await esp(1600);
      ok(/2 de 2/.test((topo().querySelector('.ex-meta') || {}).textContent || ''),
        'BUG C: depois de tirar, a posicao e 2 de 2',
        'posicao=' + ((topo().querySelector('.ex-meta') || {}).textContent || '(sem barra)'));
      ok(folhas() === 1 && barras() === 1, 'BUG C: tirar nao deixou folha nem handle morto',
        'folhas=' + folhas() + ' barras=' + barras());
      /* Depois de tirar a musica do MEIO, a sessao fica na ultima das duas que
       sobraram. "Proxima" desabilitado e' o estado CORRETO. A primeira versao
       desta prova exigia um "Proxima" clicavel aqui e reprovou — o erro estava
       no teste, nao no produto. E' por isso que a correcao foi do teste: trocar
       a expectativa errada por outra espera nao ensinaria nada. */
      const proxBarra = topo().querySelector('.ex-botoes button[aria-label="Próxima música"]');
      ok(proxBarra && proxBarra.disabled, 'BUG C: depois de tirar, "Proxima" da barra fica desabilitado (ultima musica)',
        proxBarra ? 'disabled=' + proxBarra.disabled : 'nao achei o botao da barra');
      ok(!!botao('Anterior'), 'BUG C: "Anterior" continua disponivel');
      botao('Anterior').click(); await esp(1300);
      ok(titulo() === 'A', 'BUG C: da para voltar para A depois de tirar', 'titulo=' + titulo());
      ok(/1 de 2/.test((topo().querySelector('.ex-meta') || {}).textContent || ''),
        'BUG C: a posicao ficou 1 de 2',
        'posicao=' + ((topo().querySelector('.ex-meta') || {}).textContent || '(sem barra)'));
      ok(folhas() === 1 && barras() === 1, 'BUG C: voltar depois de tirar nao empilhou',
        'folhas=' + folhas() + ' barras=' + barras());
      botao('Próxima').click(); await esp(1300);
      ok(titulo() === 'C', 'BUG C: e da para seguir de novo, sem indice invalido', 'titulo=' + titulo());
    }

    /* ============ 6. SAIR (FASE 20 da rodada anterior) ============ */
    porRotulo(/Sair da execução/).click(); await esp(1200);
    ok(folhas() === 0, 'sair fecha a folha da execucao', 'folhas=' + folhas());
    ok(!window.Views.execucao.ativa(), 'sair limpa a sessao');

    window.__guardaResultado = {
      passou: passou, falhou: falhou, problemas: problemas,
      ms: Date.now() - inicio,
    };
    return window.__guardaResultado;
  };
})();