/* =========================================================
   Cifras e Escalas Pro — core/utils.js
   Utilitarios de DOM, datas, texto e formatacao.
   Expõe window.Utils.
   ========================================================= */
(function (global) {
  'use strict';

  /* ---------------- DOM ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        // Uma chave "__proto__" num atributo viraria o prototipo do elemento:
        // `node.__proto__ = valor` e uma atribuicao de prototipo, nao uma
        // propriedade comum. `constructor` e `prototype` nao mudam o prototipo
        // sozinhos, mas sao o caminho que um objeto malformado usa para chegar
        // la. O filtro de propriedade propria acima ja impede o `__proto__` que
        // veio herdado; este bloqueia o que veio escrito.
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === 'dataset') {
          for (const d in v) node.dataset[d] = v[d];
        }
        /* `html` nao e atributo: ele viraria `setAttribute('html', ...)`, que nao
         * faz nada, e quem quisesse HTML passaria a acreditar que fez.
         *
         * Existia aqui uma linha que assignava `innerHTML`, e ela foi removida.
         * Nenhum codigo do projeto usava — mas o atributo era o caminho mais
         * curto entre um campo que a pessoa preenche e o navegador executando o
         * que ela escreveu. Bastava um `el('div', { html: m.titulo })` e o titulo
         * viraria script.
         *
         * Quem precisar de HTML constroi o no: `el('br')`, `el('b', {}, 'x')`.
         * Para texto, `text:` ja resolve, e resolve certo.
         *
         * O `check-seguranca` vigia esta linha. */
        else if (k === 'html') {
          throw new Error('el() não aceita html. Use text: para texto, ou construa o nó.');
        }
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    (Array.isArray(children) ? children : children != null ? [children] : []).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number'
        ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  /** Escapa texto para uso seguro em innerHTML. */
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Delegacao de eventos: on(root, 'click', '.btn', handler) */
  function on(root, type, selector, handler) {
    root.addEventListener(type, (ev) => {
      const t = ev.target.closest(selector);
      if (t && root.contains(t)) handler(ev, t);
    });
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* ---------------- Datas ---------------- */
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
    'quinta-feira', 'sexta-feira', 'sábado'];
  const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  const pad = (n) => (n < 10 ? '0' + n : '' + n);

  /** Data local no formato YYYY-MM-DD (nunca UTC: evita bug de fuso). */
  function toKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  /** Converte 'YYYY-MM-DD' em Date local (meio-dia, evita DST). */
  function fromKey(key) {
    const p = String(key).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0, 0);
  }
  function todayKey() { return toKey(new Date()); }

  function addDays(d, n) {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
    r.setDate(r.getDate() + n);
    return r;
  }
  function addMonths(d, n) {
    const r = new Date(d.getFullYear(), d.getMonth() + n, 1, 12);
    // nao deixa pular de mes (31 de janeiro + 1 mes = 3 de marco)
    const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(d.getDate(), last));
    return r;
  }
  function startOfWeek(d, firstDay) {
    const f = firstDay === undefined ? 0 : firstDay;
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
    r.setDate(r.getDate() - ((r.getDay() - f + 7) % 7));
    return r;
  }
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }
  function diffDays(a, b) {
    const x = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 12);
    const y = new Date(b.getFullYear(), b.getMonth(), b.getDate(), 12);
    return Math.round((y - x) / 86400000);
  }
  /** '2026-09-29' -> '29/09/2026' */
  function fmtDate(key) {
    const p = String(key).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  /** '2026-09-29' -> 'Terça, 29 de setembro' */
  function fmtDateLong(key) {
    const d = fromKey(key);
    return capitalize(DIAS[d.getDay()]) + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
  }
  function fmtMonthYear(d) { return MESES[d.getMonth()] + ' de ' + d.getFullYear(); }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  /** '19:30' -> '19h30'; '19:00' -> '19h' */
  function fmtTime(hm) {
    if (!hm) return '';
    const p = String(hm).split(':');
    if (p.length < 2) return hm;
    return p[1] === '00' ? p[0] + 'h' : p[0] + 'h' + p[1];
  }
  /** '2026-09-29' -> 'hoje' | 'amanhã' | 'ontem' | '29 set' */
  function fmtRelativeDay(key) {
    const n = diffDays(new Date(), fromKey(key));
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    const d = fromKey(key);
    if (d.getFullYear() === new Date().getFullYear()) return d.getDate() + ' ' + MESES_CURTOS[d.getMonth()];
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2);
  }

  /* ---------------- Texto ---------------- */
  /** Normaliza para busca: minúsculo, sem acento. */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  /** Remove acentos mas mantém a caixa. */
  function deaccent(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function slug(s) {
    return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function titleCase(s) {
    return String(s || '').replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  }

  /** Debounce simples. */
  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), ms || 200);
    };
  }
  function throttle(fn, ms) {
    let last = 0, timer = null;
    return function () {
      const args = arguments, ctx = this, now = Date.now();
      const remain = ms - (now - last);
      if (remain <= 0) { last = now; fn.apply(ctx, args); }
      else if (!timer) {
        timer = setTimeout(() => { timer = null; last = Date.now(); fn.apply(ctx, args); }, remain);
      }
    };
  }

  /* ---------------- Diversos ---------------- */
  let idCounter = 0;
  function uid(prefix) {
    idCounter = (idCounter + 1) % 100000;
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + idCounter.toString(36)
      + Math.random().toString(36).slice(2, 6);
  }

  function clamp(n, min, max) { return n < min ? min : n > max ? max : n; }

  /** Deep clone simples (JSON puro — os dados do app sao JSON). */
  function clone(o) {
    return o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  }

  /** Agrupa elementos por chave. */
  function groupBy(arr, keyFn) {
    const out = {};
    arr.forEach((x) => {
      const k = keyFn(x);
      (out[k] = out[k] || []).push(x);
    });
    return out;
  }

  function sortBy(arr, fn, desc) {
    return arr.slice().sort((a, b) => {
      const x = fn(a), y = fn(b);
      const r = x < y ? -1 : x > y ? 1 : 0;
      return desc ? -r : r;
    });
  }

  /** Agrupa por dia mantendo ordem. */
  function groupByDate(arr) {
    return groupBy(arr, (x) => x.data);
  }

  /** Highlight de busca: devolve HTML seguro. */
  function highlight(text, query) {
    const t = esc(text);
    if (!query) return t;
    const q = norm(query).trim();
    if (!q) return t;
    // casa sem acento no texto original usando indices normalizados
    const normChars = deaccent(text);
    const lower = normChars.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx < 0) return t;
    // mapeia indices normalizados -> indices originais
    let map = [];
    let acc = '';
    for (let i = 0; i < text.length; i++) {
      const c = deaccent(text[i]);
      if (c) { acc += c.toLowerCase(); map.push(i); }
    }
    const at = acc.indexOf(q);
    if (at < 0) return t;
    const start = map[at];
    const end = map[at + q.length - 1] + 1;
    return esc(text.slice(0, start)) + '<mark>' + esc(text.slice(start, end)) + '</mark>'
      + esc(text.slice(end));
  }

  /** Copia texto para a area de transferencia (com fallback). */
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const ta = el('textarea', {
        value: text,
        style: { position: 'fixed', top: '-1000px', opacity: '0' },
      });
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy-failed'));
    });
  }

  /* ------------------------------------------------------------
     BAIXAR ARQUIVO — O CAMINHO DO IPHONE

     A versao anterior era esta:

         const a = el('a', { href: url, download: filename });
         a.click();
         setTimeout(() => URL.revokeObjectURL(url), 100);

     Tres defeitos, e os tres doem no iPhone.

     1. NO IPHONE, `download` COM `blob:` E' SERRILHA. O Safari escolhe o que
        fazer pelo TIPO do arquivo: quando ele reconhece o tipo, ABRE O
        CONTEUDO no lugar de salvar. Um `.ics` abre como calendario, um `.json`
        pode abrir como texto. A pessoa toca em "Salvar backup", ve o arquivo
        aberto, e acredita que salvou.

     2. REVOGAR A URL EM 100 MS CORTA O ARQUIVO. O download do navegador e
        assincrono: revogar a URL enquanto ele ainda esta lendo o blob da o
        arquivo pela metade. Emrede rapida passa; em 3G deIncreto nao.

     3. A FUNCAO NAO DEVIA NADA. Ela nao sabia se o arquivo saiu. E o chamador
        usava isso para GRABAR O BACKUP E CALAR O AVISO — entao um download
        falhado virava "Backup salvo" e desligava a unica protecao que o app
        tinha. A funcao agora conta o que aconteceu.

     A saida nativa do iPhone e `navigator.share` com arquivo: o app entrega o
     arquivo, o iPhone abre a folha de partilha do sistema, e a pessoa escolhe
     "Salvar nos Arquivos". E o caminho que o proprio iOS espera, e o unico em
     que o app tem CERTEZA de que chegou ate a mao — porque alguem tocou em
     "Salvar".

     No iPhone o `navigator.share` so existe a partir do iOS 15. Antes disso, e
     no resto, o ancor com `download` continua sendo o caminho, e o retorno
     avisa que o caminho e menos confiavel.
     ------------------------------------------------------------ */

  /** O conteudo vira um arquivo de verdade, ou `null` se nao der. */
  function arquivoDe(content, filename, mime) {
    try {
      const blob = new Blob([content == null ? '' : String(content)], {
        type: mime || 'application/json;charset=utf-8',
      });
      // O construtor de File nao existe em navegador velho, e sem ele nao ha
      // como anexar arquivo na partilha do sistema.
      if (typeof File !== 'function') return null;
      return new File([blob], filename, { type: blob.type });
    } catch (e) {
      return null;
    }
  }

  /** O navegador aceita compartilhar ESTE arquivo? */
  function podeCompartilharArquivo(arquivo) {
    if (!arquivo) return false;
    const n = global.navigator;
    if (!n || typeof n.share !== 'function') return false;
    if (typeof n.canShare !== 'function') return false;
    try { return n.canShare({ files: [arquivo] }) === true; } catch (e) { return false; }
  }

  /** Data-URL vira um arquivo de verdade, ou `null` se nao der.
   *
   * O app guarda imagem como data-URL — e a unica forma de ela sobreviver sem
   * servidor. Mas `navigator.share` so anexa um `File` de verdade, entao a
   * base64 precisa virar bytes. */
  function dataURLParaArquivo(dataUrl, nome, extensaoForcada) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const i = dataUrl.indexOf(',');
    if (i < 0) return null;
    const cabecalho = dataUrl.slice(0, i);
    const base64 = dataUrl.slice(i + 1);
    const tipoM = /data:([^;]+)/.exec(cabecalho);
    if (!tipoM) return null;
    let bin;
    try { bin = atob(base64); } catch (e) { return null; }
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    const tipo = tipoM[1];
    const ext = extensaoForcada || (tipo.indexOf('png') >= 0 ? 'png' : 'jpg');
    if (typeof File !== 'function') return null;
    try { return new File([bytes], (nome || 'arquivo') + '.' + ext, { type: tipo }); }
    catch (e) { return null; }
  }

  /* Entrega um arquivo pronto — um `File` ou um `Blob` — e CONTA o que
   * aconteceu.
   *
   * E o nucleo de `download`, e existe separado porque a imagem anotada ja
   * chega pronta do `canvas`, sem passar por texto. */
  function entregarArquivo(arquivo, filename) {
    if (!arquivo) return Promise.resolve({ via: 'nada', salvou: false });

    if (podeCompartilharArquivo(arquivo)) {
      return Promise.resolve()
        .then(function () {
          return global.navigator.share({ files: [arquivo], title: filename || arquivo.name });
        })
        .then(function () { return { via: 'partilha', salvou: true }; })
        .catch(function () {
          /* Cancelar a partilha NAO e falha do app. A pessoa mudou de ideia, e
           * o certo e ficar quieto — um "deu errado" aqui seria mentira. */
          return { via: 'partilha', salvou: false, cancelou: true };
        });
    }

    try {
      const url = URL.createObjectURL(arquivo);
      const a = el('a', { href: url, download: filename || arquivo.name || 'arquivo' });
      document.body.appendChild(a);
      a.click();
      /* A revogacao vai para muito depois. 100 ms era o "prazo do download", e o
       * download nao termina em 100 ms — em rede de telefone, nao termina nem em
       * dez segundos. `revokeObjectURL` nao e urgente: a memoria do blob e
       * devolvida quando a aba fecha, e o que estava antes era um arquivo pela
       * metade. */
      setTimeout(function () {
        try { document.body.removeChild(a); } catch (e) { /* ja saiu */ }
        URL.revokeObjectURL(url);
      }, 60000);
      return Promise.resolve({ via: 'ancora', salvou: true });
    } catch (e) {
      return Promise.resolve({ via: 'nada', salvou: false });
    }
  }

  /**
   * Baixa um texto como arquivo.
   *
   * Devolve PROMESSA com `{via, salvou}`:
   *   via = 'partilha' — entregue a folha do sistema; a pessoa escolheu o destino
   *   via = 'ancora'   — baixado direto pelo navegador
   *   via = 'nada'     — o navegador nao aceitou de jeito nenhum
   *
   * `salvou` quer dizer "o arquivo saiu daqui", e nao "esta guardado em algum
   * lugar". Guardar foi decisao da pessoa, no destino que ela escolheu.
   *
   * E PROMESSA de proposito. A versao anterior era sincrona e nao dizia nada, e
   * foi por isso que o app declarava "Backup salvo" sem saber. */
  function download(filename, content, mime) {
    return entregarArquivo(arquivoDe(content, filename, mime), filename);
  }

  /** Lê um arquivo como texto. */
  function readFile(file, asDataURL) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      if (asDataURL) fr.readAsDataURL(file); else fr.readAsText(file);
    });
  }

  /**
   * Redimensiona e recomprime uma imagem para caber no localStorage.
   * Fotos de cifra em resolucao cheia estouram a cota em minutos.
   */
  function shrinkImage(dataUrl, maxW, quality) {
    maxW = maxW || 1100;
    quality = quality || 0.72;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) return resolve(dataUrl);
          if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const cx = cv.getContext('2d');
          cx.fillStyle = '#fff';
          cx.fillRect(0, 0, w, h);
          cx.drawImage(img, 0, 0, w, h);
          let out = '';
          try { out = cv.toDataURL('image/jpeg', quality); } catch (e) { out = ''; }
          resolve(out && out.length > 40 ? out : seguro(dataUrl));
        } catch (e) { resolve(seguro(dataUrl)); }
      };
      /* Falhou ao carregar: devolve vazio, e nao o original. O original pode
         ser um SVG — que e um documento com script dentro, e a foto seria
         descartada pelo store. Devolver vazio faz a tela avisar que nao deu;
         devolver o original faria a imagem sumir sem ninguem saber por que. */
      img.onerror = () => resolve('');
      img.src = dataUrl;
    });
  }

  /**
   * Devolve a imagem so se ela for de um formato que o app aceita.
   *
   * PNG, JPEG, WebP e GIF. SVG e recusado porque e um documento XML que executa
   * o que tem escrito dentro — e uma foto de partitura nao precisa de SVG para
   * nada aqui.
   */
  function seguro(dataUrl) {
    return /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(String(dataUrl || '')) ? dataUrl : '';
  }

  /** Tamanho legível de bytes. */
  function fmtBytes(b) {
    if (!b) return '0 KB';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
    return (Math.pow(1024, i) ? b / Math.pow(1024, i) : 0).toFixed(i ? 1 : 0) + ' ' + u[i];
  }

  /**
   * Um numero com a palavra certa: 1 música, 4 músicas.
   *
   * Existe por causa de um defeito que aparecia em quase toda tela: o app
   * escrevia `e.musicas.length + ' músicas'` e a pessoa com uma música na
   * escala lia "1 músicas". Nenhuma ferramenta acusava, porque o codigo estava
   * certo — a string estava certa, a concatenacao estava certa, e o defeito e
   * de portugues, nao de programa.
   *
   * E "1 músicas" e o tipo de detalhe que faz alguem desconfiar de que o app
   * foi escrito por alguem. Ninguem que escreve portugues escreve "1 musicas"
   * de proposito: escreve sem pensar, e o resultado denuncia a maquina.
   *
   * O plural nao e sempre "acrescentar um s": "1 dia" e "2 dias", mas
   * "1 capaz"? O par vem do chamador, e o padrao cobre o caso comum do app:
   * o singular e o plural sao a mesma palavra com o `s` no fim.
   *
   *     U.plural(e.musicas.length, 'música')   ->  "1 música"
   *     U.plural(e.musicas.length, 'música')   ->  "4 músicas"
   *
   * Devolve so a palavra combinada com o numero. Quem quiser o numero separado,
   * passa o texto antes.
   */
  /** O plural de uma palavra, quando o chamador nao passou.
   *
   * Aqui NAO existe heuristica, e essa ausencia e uma decisao.
   *
   * A primeira versao tentava adivinhar: terminava em `-l`, `-m`, `-z` e
   * ganhava `es`. Produzia "2 homemes" e "2 festivales". Em portugues o plural
   * de `homem` e `homens`, o de `festival` e `festivais`, e o de `papel` e
   * `papeis` — nenhuma das tres regras cabe em "acrescente `es`".
   *
   * Palavra errada na tela e pior do que palavra repetida. A pessoa le "2
   * homemes" e sabe que aquilo foi escrito sem ninguem pensar — que e o defeito
   * que este modulo existe para tirar. Entao a regra e uma so, a unica que
   * quase sempre esta certa, e quem sabe melhor passa a palavra certa.
   *
   * Os casos irregulares deste app estao na lista abaixo. Uma palavra fora da
   * lista ganha `s`, e quem precisar de outro manda o plural explicitamente. */
  const PLURAIS_IRREGULARES = {
    capaz: 'capazes',
    pais: 'países',
    mês: 'meses',
  };

  /* As regras do portugues, na ordem em que precisam ser testadas.
   *
   * A ordem importa e nao e detalhe. `anotação` termina em `ão`, e uma regra de
   * `o` mal colocada comecaria a comer esse `ão` e faria "anotaçãos". `luz`
   * termina em `z`, e a regra do `z` precisa vir antes da do `s`. Testar na
   * ordem errada produz exatamente o defeito que este modulo existe para tirar.
   *
   * Cada regra tem o exemplo ao lado porque a lista e curta e o exemplo diz mais
   * do que um paragrafo. */
  const REGRAS_PLURAL = [
    { fim: /ão$/, troca: (p) => p.slice(0, -2) + 'ões' },  // anotação -> anotações
    { fim: /z$/, troca: (p) => p.slice(0, -1) + 'zes' },   // luz -> luzes
    { fim: /el$/, troca: (p) => p.slice(0, -2) + 'éis' },  // papel -> papéis
    { fim: /l$/, troca: (p) => p.slice(0, -1) + 'is' },    // animal -> animais
    { fim: /m$/, troca: (p) => p.slice(0, -1) + 'ns' },    // homem -> homens
    { fim: /r$/, troca: (p) => p + 'es' },                  // altar -> altares
    { fim: /s$/, troca: (p) => p.slice(0, -1) + 'ses' },   // pais -> países
  ];

  function pluralDe(palavra) {
    if (Object.prototype.hasOwnProperty.call(PLURAIS_IRREGULARES, palavra)) {
      return PLURAIS_IRREGULARES[palavra];
    }
    for (const regra of REGRAS_PLURAL) {
      if (regra.fim.test(palavra)) return regra.troca(palavra);
    }
    return palavra + 's';                                 // música -> músicas
  }

  function plural(n, singular, pluralForma) {
    const quantos = Number(n) || 0;
    return quantos + ' ' + (quantos === 1 ? singular : (pluralForma || pluralDe(singular)));
  }

  /** Abre link externo com validação (o app original falhava nisso). */
  function openLink(url) {
    if (!url) return false;
    let u = String(url).trim();
    if (!/^https?:\/\//i.test(u)) {
      // domínio sem protocolo:(prefixa https://
      if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) u = 'https://' + u;
      else return false;
    }
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      window.open(parsed.href, '_blank', 'noopener,noreferrer');
      return true;
    } catch (e) { return false; }
  }

  /** Link de busca no YouTube / CifraClub para uma música. */
  function searchLinks(nome, artista) {
    const q = encodeURIComponent([nome, artista].filter(Boolean).join(' '));
    return {
      youtube: 'https://www.youtube.com/results?search_query=' + q,
      cifraclub: 'https://www.cifraclub.com.br/busca.php?query=' + q,
      spotify: 'https://open.spotify.com/search/' + q,
    };
  }

  /** Duração aproximada de um texto de cifra (c. 2,5 palavras/segundo). */
  function estimateDuration(cifra) {
    if (!cifra) return 0;
    const lines = String(cifra).split('\n');
    let n = 0;
    lines.forEach((l) => { n += l.trim().split(/\s+/).filter(Boolean).length; });
    return Math.max(1, Math.round(n / 2.6));
  }

  /** Ratio de bytes da-string (aprox. UTF-16 -> UTF-8). */
  function byteLen(s) {
    return new Blob([s == null ? '' : String(s)]).size;
  }

  global.Utils = {
    $, $$, el, esc, on, clear,
    MESES, MESES_CURTOS, DIAS, DIAS_CURTOS, pad, toKey, fromKey, todayKey,
    addDays, addMonths, startOfWeek, isSameDay, diffDays,
    fmtDate, fmtDateLong, fmtMonthYear, fmtTime, fmtRelativeDay, capitalize,
    norm, deaccent, slug, titleCase, debounce, throttle,
    uid, clamp, clone, groupBy, groupByDate, sortBy, highlight,
    copy, download, readFile, shrinkImage, fmtBytes, plural, openLink, searchLinks,
    arquivoDe: arquivoDe, podeCompartilharArquivo: podeCompartilharArquivo,
    entregarArquivo: entregarArquivo, dataURLParaArquivo: dataURLParaArquivo,
    estimateDuration, byteLen,
  };
})(typeof window !== 'undefined' ? window : globalThis);
