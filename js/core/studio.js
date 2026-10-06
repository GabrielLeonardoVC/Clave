/* =========================================================
   ACORDE - core/studio.js
   Estudio de ensaio: video do YouTube + foto da cifra +
   desenho por cima da foto + metronomo, ao mesmo tempo.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const M = global.Music;
  const UI = global.UI;
  const Lk = global.Links;
  const Metro = global.Metro;
  const R = global.Render;
  const { el, $ } = U;

  /* =======================================================
     CANVAS DE DESENHO
     ======================================================= */
  function criarPincel(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    let desenhando = false;
    let atual = null;
    let historia = [];
    let futuro = [];
    let config = { cor: '#F5B45C', largura: 6, ferramenta: 'caneta' };

    function baseLargura() {
      return parseFloat(canvas.dataset.larguraOrig) || 1200;
    }

    function tamanho() {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const dpr = global.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      return r;
    }

    function ponto(e) {
      const r = canvas.getBoundingClientRect();
      const src = (e.touches && e.touches[0]) ? e.touches[0] : e;
      const L = baseLargura();
      return { x: ((src.clientX - r.left) * L) / r.width, y: ((src.clientY - r.top) * L) / r.width };
    }

    function repintar() {
      const r = tamanho();
      if (!r) return;
      const s = r.width / baseLargura();
      ctx.clearRect(0, 0, r.width, r.height);
      const lista = atual ? historia.concat([atual]) : historia;
      lista.forEach(function (tr) {
        ctx.globalCompositeOperation = (tr.ferramenta === 'borracha') ? 'destination-out' : 'source-over';
        ctx.strokeStyle = tr.cor;
        ctx.lineWidth = ((tr.ferramenta === 'borracha') ? tr.largura * 4 : tr.largura) * s;
        ctx.beginPath();
        tr.pontos.forEach(function (p, i) {
          if (i === 0) ctx.moveTo(p.x * s, p.y * s); else ctx.lineTo(p.x * s, p.y * s);
        });
        if (tr.pontos.length === 1) ctx.lineTo(tr.pontos[0].x * s + 0.1, tr.pontos[0].y * s + 0.1);
        ctx.stroke();
      });
      ctx.globalCompositeOperation = 'source-over';
    }

    function comecar(e) {
      if (e.cancelable) e.preventDefault();
      desenhando = true; futuro = [];
      atual = { cor: config.cor, largura: config.largura, ferramenta: config.ferramenta, pontos: [ponto(e)] };
      repintar();
    }
    function mover(e) {
      if (!desenhando || !atual) return;
      if (e.cancelable) e.preventDefault();
      atual.pontos.push(ponto(e));
      repintar();
    }
    function terminar() {
      if (!desenhando) return;
      desenhando = false;
      if (atual && atual.pontos.length) historia.push(atual);
      atual = null; repintar();
    }

    canvas.addEventListener('pointerdown', comecar);
    canvas.addEventListener('pointermove', mover);
    global.addEventListener('pointerup', terminar);
    canvas.addEventListener('pointerleave', terminar);

    return {
      definir: function (k, v) { config[k] = v; },
      get config() { return config; },
      limpar: function () { historia = []; futuro = []; repintar(); },
      desfazer: function () { if (historia.length) { futuro.push(historia.pop()); repintar(); } },
      refazer: function () { if (futuro.length) { historia.push(futuro.pop()); repintar(); } },
      temAlgo: function () { return historia.length > 0; },
      repintar: repintar,
      carregar: function (src) {
        return new Promise(function (resolve) {
          const img = new Image();
          img.onload = function () {
            canvas.dataset.larguraOrig = '1200';
            canvas.dataset.proporcaoOrig = String(img.naturalHeight / img.naturalWidth);
            tamanho(); repintar(); resolve(img);
          };
          img.onerror = function () { resolve(null); };
          img.src = src;
        });
      },
      exportar: function (fundo) {
        return new Promise(function (resolve) {
          /* A largura de saída é o MENOR entre o teto e a foto. Antes era o teto
             sozinho: uma partitura de 512 px saía em 1400 px, cinco vezes maior
             no disco, mais borrada e sem nenhuma informação a mais. Ampliar não
             guarda nada — só ocupa. O teto continua valendo para a foto grande,
             que é o caso que ele existe para atender. */
          const teto = 1400;
          const natural = (fundo && fundo.naturalWidth) || 0;
          const L = natural ? Math.min(teto, natural) : teto;
          const prop = parseFloat(canvas.dataset.proporcaoOrig) || 1.4;
          const out = document.createElement('canvas');
          out.width = L; out.height = Math.round(L * prop);
          const c2 = out.getContext('2d');
          if (fundo && fundo.naturalWidth) {
            try { c2.drawImage(fundo, 0, 0, out.width, out.height); }
            catch (e) { c2.fillStyle = '#fff'; c2.fillRect(0, 0, out.width, out.height); }
          } else { c2.fillStyle = '#fff'; c2.fillRect(0, 0, out.width, out.height); }
          const s = L / baseLargura();
          historia.forEach(function (tr) {
            c2.globalCompositeOperation = (tr.ferramenta === 'borracha') ? 'destination-out' : 'source-over';
            c2.strokeStyle = tr.cor;
            c2.lineWidth = (tr.ferramenta === 'borracha') ? tr.largura * 4 : tr.largura;
            c2.lineCap = 'round'; c2.lineJoin = 'round';
            c2.beginPath();
            tr.pontos.forEach(function (p, i) {
              if (i === 0) c2.moveTo(p.x * s, p.y * s); else c2.lineTo(p.x * s, p.y * s);
            });
            if (tr.pontos.length === 1) c2.lineTo(tr.pontos[0].x * s + 0.1, tr.pontos[0].y * s + 0.1);
            c2.stroke();
          });
          c2.globalCompositeOperation = 'source-over';
          try { resolve(out.toDataURL('image/jpeg', 0.88)); } catch (e) { resolve(''); }
        });
      },
    };
  }
  /* =======================================================
     TELA DO ESTÚDIO
     ======================================================= */
  function abrir(musica, escala, aoSalvar) {
    escala = escala || null;
    const m = Object.assign({}, musica);
    const corpo = el('div', { class: 'studio' });
    let pincel = null, imgBase = null;
    let ytId = m.ytId || Lk.extrairYouTubeId(m.yt || '');

    /* ---------- video ---------- */
    const videoStage = el('div', { class: 'st-video-stage' });
    const videoBox = el('div', { class: 'st-video' }, videoStage);

    function botarVideo(id) {
      U.clear(videoStage);
      videoStage.appendChild(el('iframe', {
        src: Lk.embedYouTube(id),
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
        title: 'Vídeo: ' + m.nome, loading: 'lazy',
      }));
    }
    if (ytId) botarVideo(ytId);
    else {
      videoStage.appendChild(el('div', { class: 'st-video-empty' }, [
        el('i', { 'data-lucide': 'youtube' }),
        el('p', { class: 'fs-sm' }, 'Cole o link do YouTube para ver o vídeo aqui do lado'),
        el('button', { class: 'btn btn-soft btn-sm', onclick: pedirVideo }, [el('i', { 'data-lucide': 'link' }), 'Colar link']),
      ]));
    }
    function pedirVideo() {
      UI.prompt({
        title: 'Link do YouTube',
        message: 'Aceita youtube.com/watch, youtu.be, /shorts, /live ou só o código do vídeo.',
        placeholder: 'https://youtu.be/...', value: m.yt || '',
      }).then(function (v) {
        if (!v) return;
        const id = Lk.extrairYouTubeId(v);
        if (!id) { UI.toast('Não reconheci esse link. E do YouTube?', { tipo: 'err' }); return; }
        m.yt = v; m.ytId = id; botarVideo(id);
        UI.toast('Vídeo carregado', { tipo: 'ok' });
      });
    }

    /* ---------- imagem ---------- */
    const imgStage = el('div', { class: 'st-img-stage' });
    const imgBox = el('div', { class: 'st-img' }, imgStage);
    const canvas = el('canvas', { class: 'st-canvas', 'data-largura-orig': '1200' });
    // 'barra' e criada mais abaixo; guarda a referencia aqui para o montagem
    var barra = null;

    function montarImagem(src) {
      U.clear(imgStage);
      imgStage.appendChild(el('img', { class: 'st-foto', src: src, alt: 'Cifra de ' + m.nome }));
      imgStage.appendChild(canvas);
      pincel = criarPincel(canvas);
      pincel.carregar(src).then(function (i) { imgBase = i; });
      if (barra) barra.style.display = 'flex';
    }
    if (m.foto) montarImagem(m.foto);
    else {
      imgStage.appendChild(el('div', { class: 'st-img-empty' }, [
        el('i', { 'data-lucide': 'image' }),
        el('p', { class: 'fs-sm' }, 'Anexe a foto da sua cifra e desenhe em cima'),
        el('button', { class: 'btn btn-soft btn-sm', onclick: escolherFoto }, [el('i', { 'data-lucide': 'upload' }), 'Enviar foto']),
      ]));
    }
    function escolherFoto() {
      const f = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
      document.body.appendChild(f);
      f.addEventListener('change', function () {
        const arq = f.files[0];
        document.body.removeChild(f);
        if (!arq) return;
        U.readFile(arq, true).then(function (d) { return U.shrinkImage(d, 1400, 0.8); })
          .then(function (p) {
            // Vazio aqui e "nao deu para ler". Sem a conferencia, um arquivo
            // recusado viraria `src=""` e a foto da cifra apareceria quebrada.
            if (!p) { UI.toast('Não deu para ler a imagem', { tipo: 'err' }); return; }
            m.foto = p; montarImagem(p);
            UI.icons(imgBox);
            UI.toast('Foto anexada - pode desenhar', { tipo: 'ok' });
          });
      });
      f.click();
    }

    /* ---------- barra de desenho ---------- */
    const CORES = ['#F5B45C', '#FFFFFF', '#2DD4BF', '#F0634A', '#111111'];
    barra = el('div', { class: 'st-draw' });
    const gFerr = el('div', { class: 'st-draw-group' });
    [['caneta', 'pen-tool'], ['marca', 'highlighter'], ['borracha', 'eraser']].forEach(function (t, i) {
      const b = el('button', {
        class: 'st-tool' + (i === 0 ? ' on' : ''), 'aria-label': t[0],
        onclick: function () {
          if (!pincel) return;
          pincel.definir('ferramenta', t[0]);
          U.$$('.st-tool', gFerr).forEach(function (x) { x.classList.toggle('on', x === b); });
        },
      }, el('i', { 'data-lucide': t[1] }));
      gFerr.appendChild(b);
    });
    const gCores = el('div', { class: 'st-draw-group' });
    CORES.forEach(function (c, i) {
      gCores.appendChild(el('button', {
        class: 'st-cor' + (i === 0 ? ' on' : ''), style: { background: c }, 'aria-label': 'Cor ' + (i + 1),
        onclick: function () {
          if (!pincel) return;
          pincel.definir('cor', c);
          U.$$('.st-cor', gCores).forEach(function (x, j) { x.classList.toggle('on', j === i); });
        },
      }));
    });
    barra.appendChild(gFerr);
    barra.appendChild(gCores);
    barra.appendChild(el('div', { class: 'st-draw-group' }, el('input', {
      type: 'range', class: 'st-largura', min: '2', max: '22', value: '6', 'aria-label': 'Espessura do traco',
      oninput: function (e) { if (pincel) pincel.definir('largura', +e.target.value); },
    })));
    barra.appendChild(el('div', { class: 'st-draw-group' }, [
      el('button', { class: 'st-tool', 'aria-label': 'Desfazer', onclick: function () { if (pincel) pincel.desfazer(); } }, el('i', { 'data-lucide': 'undo-2' })),
      el('button', { class: 'st-tool', 'aria-label': 'Refazer', onclick: function () { if (pincel) pincel.refazer(); } }, el('i', { 'data-lucide': 'redo-2' })),
      el('button', { class: 'st-tool', 'aria-label': 'Limpar', onclick: function () {
        if (!pincel) return;
        pincel.limpar();
        /* O aviso antigo dizia "Anotações limpas", e nada tinha sido limpo de
           lugar nenhum: os traços só saem do canvas, e a anotação que estiver
           gravada na música continua lá. Dizer o que aconteceu — e o que
           ainda NÃO aconteceu — é a diferença entre a pessoa entender e a
           pessoa duvidar do aplicativo. */
        UI.toast('Traços limpos nesta edição. Nada é apagado da música até salvar.', { tipo: 'ok', dur: 5200 });
      } }, el('i', { 'data-lucide': 'trash-2' })),
    ]));
    barra.style.display = m.foto ? 'flex' : 'none';
    /* ---------- metronomo ---------- */
    const dots = el('div', { class: 'st-dots' });
    for (let i = 0; i < 4; i++) dots.appendChild(el('i', { class: i === 0 ? 'accent' : '' }));
    const bpmNum = el('div', { class: 'st-bpm' }, String(m.bpm || Metro.METRONOME.bpm));
    const subTxt = el('div', { class: 'st-sub' }, (m.compasso || Metro.METRONOME.compasso) + '/4');

    const btnPlay = el('button', {
      class: 'st-play', 'aria-label': 'Tocar metrônomo',
      onclick: function () {
        const t = Metro.alternar();
        btnPlay.classList.toggle('on', t);
        U.clear(btnPlay);
        btnPlay.appendChild(el('i', { 'data-lucide': t ? 'pause' : 'play' }));
        UI.icons(btnPlay);
      },
    }, el('i', { 'data-lucide': 'play' }));

    function moverBpm(d) {
      Metro.definir('bpm', U.clamp(Metro.METRONOME.bpm + d, 20, 320));
      bpmNum.textContent = String(Metro.METRONOME.bpm);
      m.bpm = Metro.METRONOME.bpm;
    }

    const metro = el('div', { class: 'st-metro' }, [
      dots,
      el('div', { class: 'st-metro-mid' }, [btnPlay, el('div', {}, [bpmNum, subTxt])]),
      el('div', { class: 'st-metro-side' }, [
        el('button', { class: 'st-mini', 'aria-label': 'Menos 1 BPM', onclick: function () { moverBpm(-1); } }, el('i', { 'data-lucide': 'minus' })),
        el('button', { class: 'st-mini', 'aria-label': 'Mais 1 BPM', onclick: function () { moverBpm(1); } }, el('i', { 'data-lucide': 'plus' })),
        el('button', { class: 'st-mini', 'aria-label': 'Tap tempo', onclick: function () {
          const b = Metro.tapTempo();
          if (b) { bpmNum.textContent = String(b); m.bpm = b; UI.buzz(12); }
        } }, el('span', { class: 'st-tap' }, 'TAP')),
      ]),
    ]);

    if (m.bpm) Metro.aplicar({ bpm: m.bpm });
    if (m.compasso) Metro.definir('compasso', +m.compasso);

    const onBeatAntigo = Metro.METRONOME.onBeat;
    Metro.METRONOME.onBeat = function (b) {
      for (let i = 0; i < dots.children.length; i++) {
        dots.children[i].classList.toggle('on', i === b);
      }
    };

    /* ---------- controles ---------- */
    const menor = /m$/i.test(m.tom || '');
    const selTom = el('select', { class: 'select', style: { maxWidth: '120px' } });
    selTom.appendChild(el('option', { value: '' }, 'Tom'));
    R.TONS_MAIORES.forEach(function (t) {
      const nome = M.noteName(t.pc, M.useFlatsFor(t.pc)) + (menor ? 'm' : '');
      selTom.appendChild(el('option', { value: nome, selected: m.tom === nome }, nome));
    });
    selTom.addEventListener('change', function () { m.tom = selTom.value; });

    const selComp = el('select', { class: 'select', style: { maxWidth: '108px' } });
    Metro.COMPASSOS.forEach(function (c) {
      const o = el('option', { value: c.v }, c.n);
      if (+(m.compasso || Metro.METRONOME.compasso) === c.v) o.selected = true;
      selComp.appendChild(o);
    });
    selComp.addEventListener('change', function () {
      m.compasso = selComp.value;
      Metro.definir('compasso', +selComp.value);
      subTxt.textContent = selComp.value + '/4';
    });

    const inBpm = el('input', {
      type: 'number', class: 'input', style: { maxWidth: '88px' }, min: '20', max: '320',
      value: m.bpm || '', placeholder: 'BPM',
      oninput: function (e) {
        m.bpm = e.target.value;
        if (e.target.value) { Metro.definir('bpm', +e.target.value); bpmNum.textContent = e.target.value; }
      },
    });

    const controles = el('div', { class: 'st-controls' }, [
      el('div', { class: 'st-row' }, [
        el('span', { class: 'eyebrow' }, 'Tom'),
        selTom,
        el('button', { class: 'btn btn-secondary btn-sm', onclick: function () { dialogTranspor(m); } },
          [el('i', { 'data-lucide': 'shuffle' }), 'Transpor']),
        el('button', { class: 'btn btn-secondary btn-sm', onclick: function () { barra.style.display = 'flex'; escolherFoto(); } },
          [el('i', { 'data-lucide': 'image' }), 'Foto']),
      ]),
      el('div', { class: 'st-row' }, [
        el('span', { class: 'eyebrow' }, 'BPM'), inBpm,
        el('span', { class: 'eyebrow' }, 'Compasso'), selComp,
      ]),
      el('div', { class: 'st-row' }, [
        el('span', { class: 'eyebrow' }, 'Pesquisar'),
        el('div', { class: 'st-links' }, Lk.de(m.nome, m.artista).map(function (f) {
          return el('button', {
            class: 'st-link', style: { '--c': f.cor }, title: f.nome + ' - ' + f.descricao,
            onclick: function () { Lk.abrir(f.id, m.nome, m.artista); },
          }, [el('i', { 'data-lucide': f.icone }), el('span', {}, f.curto)]);
        })),
      ]),
    ]);

    corpo.appendChild(videoBox);
    corpo.appendChild(metro);
    corpo.appendChild(el('div', { class: 'st-divider' }));
    corpo.appendChild(imgBox);
    imgBox.appendChild(barra);
    corpo.appendChild(controles);

    const h = UI.sheet({
      title: m.nome, sub: m.artista || '', wide: true, body: corpo,
      onClose: function () {
        Metro.parar();
        Metro.METRONOME.onBeat = onBeatAntigo;
      },
      foot: [
        el('button', { class: 'btn btn-secondary', onclick: function () {
          if (!pincel || !pincel.temAlgo()) { UI.toast('Desenhe algo na foto antes de salvar', { tipo: 'err' }); return; }
          pincel.exportar(imgBase).then(function (png) {
            if (!png) { UI.toast('Não consegui gerar a imagem', { tipo: 'err' }); return; }
            /* O nome do arquivo saia de `m.nome`, que existe na musica da ESCALA. Uma
             * cifra da biblioteca nao tem `nome` — tem `titulo`. Sem esta
             * alternativa, exportar de la produzia um arquivo chamado
             * "undefined (anotada).jpg", que e um arquivo que ninguem quer
             * achar depois. */
            const nome = (m.nome || m.titulo || 'Foto') + ' (anotada)';
            /* A imagem vai pela mesma rota do backup, e pelo mesmo motivo: no
             * iPhone, um `image/jpeg` com `download` e ABERTO pelo Safari em vez
             * de salvo — a pessoa ve a foto na tela e acredita que salvou. A
             * folha de partilha do sistema e o caminho que o iOS espera. */
            const arquivo = U.dataURLParaArquivo(png, nome, 'jpg');
            U.entregarArquivo(arquivo, nome + '.jpg').then(function (r) {
              if (r.via === 'nada') {
                UI.toast('Não consegui preparar a imagem.', { tipo: 'err' });
              } else if (r.cancelou) {
                /* Cancelou: cala. */
              } else if (r.via === 'partilha') {
                UI.toast('Escolha "Salvar nos Arquivos" para guardar a imagem.', {
                  tipo: 'warn', dur: 9000,
                });
              } else {
                UI.toast('Imagem anotada salva', { tipo: 'ok' });
              }
            });
          });
        } }, [el('i', { 'data-lucide': 'download' }), 'Salvar anotação']),

        /* ---- SALVAR NO CLAVE ----
           *
           * A terceira via, e a única que grava. As outras duas continuam
           * como são: "Salvar anotação" ENTREGA um arquivo ao sistema, e
           * "Salvar na escala"/"Salvar" guardam a foto que já estava lá. Esta
           * uma faz o que nenhuma fazia — junta a foto com os traços e grava
           * o resultado na música.
           *
           * A composição é a mesma do "Salvar anotação": `exportar` já monta
           * fundo + traços num JPEG de 1400 px. A diferença é para onde o
           * resultado vai, e é por isso que são dois botões e não um.
           *
           * Nada é gravado enquanto a pessoa desenha, desfaz, refaz ou limpa.
           * Só aqui. */
        el('button', { class: 'btn btn-primary', onclick: function () {
          if (!pincel || !imgBase || !imgBase.naturalWidth) {
            UI.toast('Abra uma foto antes de salvar a anotação', { tipo: 'err' });
            return;
          }
          /* Sem rabisco, o que o "salvar" gravaria é a própria foto de novo,
             recodificada — a pessoa perderia qualidade sem ganhar nada. */
          if (!pincel.temAlgo()) {
            UI.toast('Desenhe algo na foto antes de salvar', { tipo: 'err' });
            return;
          }
          pincel.exportar(imgBase).then(function (p) {
            if (!p) {
              /* A montagem falhou. O desenho continua no canvas e a foto da
                 música continua como estava: avisa e devolve a pessoa para
                 tentar de novo. */
              UI.toast('Não consegui montar a imagem anotada', { tipo: 'err' });
              return;
            }
            /* O registro de trabalho passa a carregar a imagem anotada ANTES
               do commit — é dele que `gravarCampos` lê o campo `foto`. */
            m.foto = p;
            if (escala) gravarNaEscala(escala, m, aoSalvar);
            else if (aoSalvar) gravarNaMusica(musica, m, aoSalvar);
            else {
              UI.toast('Esta tela não tem para onde salvar', { tipo: 'err' });
              return;
            }
            /* Recarrega a base a partir do que acabou de ser salvo, para que
               o próximo rabisco seja composto sobre a imagem anotada — e não
               sobre a foto original de novo. `montarImagem` cria canvas e
               pincel novos, então o histórico de traços começa limpo. */
            montarImagem(p);
            UI.toast('Anotação salva no Clave', { tipo: 'ok' });
          });
        } }, [el('i', { 'data-lucide': 'save' }), 'Salvar no Clave']),
        /* O botao de gravar diz para ONDE ele grava, porque os dois destinos
           são musically diferentes e a pessoa precisa saber qual está
           usando. Com escala, é a música da escala. Sem escala — a biblioteca —
           é a própria música. E sem nenhum dos dois, quem chamou não pediu
           persistência: fica o espaço, e nada se grava. */
        escala
          ? el('button', { class: 'btn btn-success', onclick: function () { gravarNaEscala(escala, m, aoSalvar); h.close(); } },
            [el('i', { 'data-lucide': 'check' }), 'Salvar na escala'])
          : (aoSalvar
            ? el('button', { class: 'btn btn-success', onclick: function () { gravarNaMusica(musica, m, aoSalvar); h.close(); } },
              [el('i', { 'data-lucide': 'check' }), 'Salvar'])
            : el('span', { class: 'grow' })),
      ],
    });

    UI.icons(corpo);
    setTimeout(function () { if (pincel) pincel.repintar(); }, 150);
  }

  /* Os campos que o Estúdio pode mudar sozinho.
   *
   * O desenho NAO esta aqui de propósito: ele vive no canvas e sai pelo
   * "Salvar anotação", que é exportação. Metrônomo e foto sim — os dois
   * escrevem em `m`, que é a cópia de trabalho. */
  const CAMPOS_DO_ESTUDIO = ['tom', 'bpm', 'compasso', 'yt', 'ytId', 'foto'];

  /* Copia o que o Estúdio mudou para o registro de destino.
   *
   * Uma lista só, para os dois caminhos não divergirem: o mesmo campo aceito
   * aqui é o mesmo aceito ali. E o `if (dados[k])` continua sendo o que era —
   * só valor presente sobrescreve. Isso significa que pelo Estúdio não se
   * APAGA um campo, e é a regra que já valia; mudá-la aqui seria mudar o
   * comportamento do botão que já existia. */
  function gravarCampos(alvo, dados) {
    CAMPOS_DO_ESTUDIO.forEach(function (k) {
      if (dados[k]) alvo[k] = dados[k];
    });
  }

  /**
   * Grava o desenho na musica da escala.
   *
   * `aoSalvar`, quando vem, e quem de fato persiste. Ver `persistir` em
   * views/cancao.js para o porque: a agenda abre a pagina da musica sobre um
   * rascunho, e escrever direto em `S.db.escalas` aqui funcionaria e perderia
   * o desenho — o `salvar` do evento sobrescreveria o banco com o rascunho, que
   * ainda estava sem a foto.
   */
  function gravarNaEscala(escala, dados, aoSalvar) {
    const S = global.Store;
    const alvo = escala.musicas.find(function (x) { return x.id === dados.id; });
    if (!alvo) return;
    gravarCampos(alvo, dados);
    escala.atualizadaEm = Date.now();
    if (typeof aoSalvar === 'function') {
      aoSalvar();
    } else {
      S.mudou('musica');
    }
    UI.toast('Atualizado na escala', { tipo: 'ok' });
  }

  /**
   * Grava o que o Estúdio mudou direto na música que veio nele.
   *
   * Este caminho é o de quem abriu uma cifra da BIBLIOTECA: não há escala
   * nenhuma, e sem este botão a foto que a pessoa acabou de anexar morria
   * aqui — aparecia na tela, e o registro continuava sem ela. A pessoa saía
   * convencida de que tinha salvo.
   *
   * `musica` é o registro de verdade, não a cópia: quem chamou passou o
   * objeto que está no armazenamento. Por isso dá para gravar nele, e é por
   * isso que a cópia de trabalho (`m`) continua existindo — o metrônomo
   * mexe em `m.bpm` a cada batida, e nada disso deve vazar para o registro
   * antes de a pessoa apertar Salvar.
   *
   * Nada é gravado ao fechar, e nada é gravado sozinho. Fechar sem salvar
   * deixa o registro como estava, que é o que a edição local promete. */
  function gravarNaMusica(musica, dados, aoSalvar) {
    if (!musica) return;
    gravarCampos(musica, dados);
    if (typeof aoSalvar === 'function') aoSalvar();
    else global.Store.mudou('cifra');
    UI.toast('Atualizado', { tipo: 'ok' });
  }

  function dialogTranspor(m) {
    const base = M.parseChord(m.tom || 'C') || M.parseChord('C');
    const menor = /m$/i.test(m.tom || '');
    let semis = 0;
    const info = el('div', { class: 'fs-sm muted mb-3 center' });
    const out = el('div', {});

    function pintar() {
      const novo = M.mod12(base.root + semis);
      const nome = M.noteName(novo, M.useFlatsFor(novo)) + (menor ? 'm' : '');
      info.textContent = (m.tom || 'C') + '  ->  ' + nome;
      U.clear(out);
      out.appendChild(el('div', { class: 'theory-card' }, [el('div', { class: 'big-key' }, nome)]));
      UI.icons(out);
    }

    const h = UI.sheet({
      title: 'Transpor tom', sub: m.nome,
      body: el('div', {}, [
        el('div', { class: 'semitone-bar mb-3' }, [
          el('button', { class: 'semitone', onclick: function () { semis -= 12; pintar(); } }, '-8'),
          el('button', { class: 'semitone', onclick: function () { semis -= 3; pintar(); } }, '-3'),
          el('button', { class: 'semitone', onclick: function () { semis--; pintar(); } }, '-1'),
          el('button', { class: 'semitone', onclick: function () { semis = 0; pintar(); } }, '0'),
          el('button', { class: 'semitone', onclick: function () { semis++; pintar(); } }, '+1'),
          el('button', { class: 'semitone', onclick: function () { semis += 3; pintar(); } }, '+3'),
          el('button', { class: 'semitone', onclick: function () { semis += 12; pintar(); } }, '+8'),
        ]),
        info, out,
      ]),
      foot: [
        el('button', { class: 'btn btn-secondary', onclick: function () { h.close(); } }, 'Cancelar'),
        el('button', { class: 'btn btn-primary', onclick: function () {
          const novo = M.mod12(base.root + semis);
          m.tom = M.noteName(novo, M.useFlatsFor(novo)) + (menor ? 'm' : '');
          h.close();
          UI.toast('Tom agora e ' + m.tom, { tipo: 'ok' });
        } }, 'Aplicar'),
      ],
    });
    pintar();
  }

  global.Studio = { abrir: abrir, criarPincel: criarPincel };
})(typeof window !== 'undefined' ? window : globalThis);