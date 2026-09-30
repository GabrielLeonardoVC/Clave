/* =========================================================
   ACORDE - core/links.js
   Links externos VERIFICADOS com requisicao real.

   CUIDADO com estes padroes (retornam 404):
     cifraclub.com.br/busca.php?query=...   -> 404
     cifraclub.com.br/busca/?q=...          -> 404
     letras.mus.br/busca/?q=...              -> 404
   Os que funcionam:
     cifraclub.com.br/?q=...
     letras.mus.br/?q=...
     youtube.com/results?search_query=...

   Expõe window.Links.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;

  function termo(titulo, artista) {
    return [titulo, artista]
      .map(function (s) { return U.deaccent(String(s || '')).trim(); })
      .filter(Boolean).join(' ');
  }
  const enc = encodeURIComponent;

  /* ---- onde achar a CIFRA ---- */
  const FONTES = [
    {
      id: 'cifraclub', nome: 'Cifra Club', curto: 'Cifra Club',
      descricao: 'Cifra completa, com tablatura',
      cor: '#E23D2C', icone: 'guitar', padrao: true,
      url: function (t, a) { return 'https://www.cifraclub.com.br/?q=' + enc(termo(t, a)); },
    },
    {
      id: 'ultimateguitar', nome: 'Ultimate Guitar', curto: 'UG',
      descricao: 'Cifras e partituras',
      cor: '#0E7C3A', icone: 'music',
      url: function (t, a) { return 'https://www.ultimate-guitar.com/search.php?search_type=title&value=' + enc(termo(t, a)); },
    },
    {
      id: 'chordify', nome: 'Chordify', curto: 'Chordify',
      descricao: 'Cifra com rolagem automática',
      cor: '#5B32D1', icone: 'play-square',
      url: function (t, a) { return 'https://chordify.com/search/' + enc(termo(t, a)); },
    },
  ];

  /* ---- onde achar a LETRA ---- */
  const LETRAS = [
    {
      id: 'letras', nome: 'Letras.mus.br', curto: 'Letras',
      descricao: 'Letra completa com a cifra',
      cor: '#B91C1C', icone: 'align-left', padrao: true,
      url: function (t, a) { return 'https://www.letras.mus.br/?q=' + enc(termo(t, a)); },
    },
    {
      id: 'vagalume', nome: 'Vagalume', curto: 'Vagalume',
      descricao: 'Letra e tradução',
      cor: '#0E7490', icone: 'book-open',
      url: function (t, a) { return 'https://www.vagalume.com.br/busca.html?q=' + enc(termo(t, a)); },
    },
  ];

  /* ---- onde ouvir / assistir ---- */
  const AUDIO = [
    {
      id: 'youtube', nome: 'YouTube', curto: 'YouTube',
      descricao: 'Vídeo oficial, Shelter e aula',
      cor: '#FF0000', icone: 'youtube', padrao: true,
      url: function (t, a) { return 'https://www.youtube.com/results?search_query=' + enc(termo(t, a)); },
    },
    {
      id: 'spotify', nome: 'Spotify', curto: 'Spotify',
      descricao: 'Gravar e levar para a fila',
      cor: '#1DB954', icone: 'circle-play',
      url: function (t, a) { return 'https://open.spotify.com/search/' + enc(termo(t, a)); },
    },
    {
      id: 'deezer', nome: 'Deezer', curto: 'Deezer',
      descricao: 'Streaming grátis',
      cor: '#A238FF', icone: 'disc',
      url: function (t, a) { return 'https://www.deezer.com/search/' + enc(termo(t, a)); },
    },
    {
      id: 'apple', nome: 'Apple Music', curto: 'Apple',
      descricao: 'Para o iPhone da equipe',
      cor: '#FA243C', icone: 'apple',
      url: function (t, a) { return 'https://music.apple.com/br/search?term=' + enc(termo(t, a)); },
    },
  ];

  const TODAS = FONTES.concat(LETRAS, AUDIO);
  const porId = function (id) { return TODAS.find(function (f) { return f.id === id; }) || null; };
  const urlDe = function (id, t, a) { const f = porId(id); return f ? f.url(t, a) : ''; };

  function abrir(id, titulo, artista) {
    const u = urlDe(id, titulo, artista);
    if (!u) return false;
    if (!U.openLink(u)) {
      if (global.UI) global.UI.toast('Não consegui abrir o link', { tipo: 'err' });
      return false;
    }
    return true;
  }

  function de(titulo, artista) {
    return TODAS.map(function (f) {
      return {
        id: f.id, nome: f.nome, curto: f.curto, descricao: f.descricao,
        cor: f.cor, icone: f.icone, padrao: !!f.padrao, url: f.url(titulo, artista),
      };
    });
  }
  function cifras(t, a) { return de(t, a).filter(function (x) { return FONTES.some(function (f) { return f.id === x.id; }); }); }
  function letras(t, a) { return de(t, a).filter(function (x) { return LETRAS.some(function (f) { return f.id === x.id; }); }); }
  function audio(t, a) { return de(t, a).filter(function (x) { return AUDIO.some(function (f) { return f.id === x.id; }); }); }

  /* =======================================================
     YOUTUBE — extrair o id do vídeo
     Aceita todas as formas que a galera cola.
     ======================================================= */
  const YT_ID = '[A-Za-z0-9_-]{11}';

  /**
   * Padroes montados com new RegExp, e nao como literal de regex.
   *
   * Escrito como literal, o trecho "' + YT_ID + '" entrava dentro do padrao: o
   * que o motor procurava era a propria frase, e nao um link. Os quatro padroes
   * ficavam mortos, e tudo passava a depender da busca solta do fim — que pega o
   * primeiro bloco de onze caracteres do link inteiro. Funcionava por acaso, e
   * quebrava com host hifenizado: "youtube-nocookie" tem hifen, junta onze
   * caracteres, e o id devolvido era "youtube-noc".
   */
  const YT_FORMAS = [
    new RegExp('youtu\\.be/(' + YT_ID + ')', 'i'),
    new RegExp('[?&]v=(' + YT_ID + ')', 'i'),
    new RegExp('/embed/(' + YT_ID + ')', 'i'),
    new RegExp('/(?:shorts|live|v)/(' + YT_ID + ')', 'i'),
  ];

  /**
   * O link e mesmo do YouTube?
   *
   * O esquema e opcional de proposito: no grupo e comum colar
   * "youtube.com/watch?v=..." sem o https://, e recusar isso faria o app
   * parecer burro na hora do ensaio. Depois do dominio so aceita /, ?, # ou o
   * fim do texto, senao "youtube.com.br" e "notyoutube.com" passariam.
   */
  function ehDoYouTube(s) {
    return /^([a-z0-9-]+\.)*(youtube\.com|youtu\.be|youtube-nocookie\.com)([/?#]|$)/i
      .test(String(s).replace(/^[a-z]+:\/\//i, ''));
  }

  function extrairYouTubeId(entrada) {
    if (!entrada) return '';
    const s = String(entrada).trim();
    if (new RegExp('^' + YT_ID + '$').test(s)) return s;
    // O dominio e conferido antes de qualquer padrao. Sem esta ordem, um "?v="
    // em site de terceiros — que tambem e o formato de player do Vimeo — casaria
    // e tocaria o video errado.
    if (!ehDoYouTube(s)) return '';

    for (let i = 0; i < YT_FORMAS.length; i++) {
      const achado = s.match(YT_FORMAS[i]);
      if (achado) return achado[1];
    }

    // Ultimo recurso: formato de URL do YouTube que ainda nao conhecemos. A
    // busca roda sobre o caminho e nunca sobre o dominio, porque o dominio e o
    // lugar onde hifen junta onze caracteres sem que nada disso seja video.
    const caminho = s.replace(/^[a-z]+:\/\//i, '').replace(/^[^/?#]+/, '');
    const solto = caminho.match(new RegExp('(' + YT_ID + ')'));
    return solto ? solto[1] : '';
  }

  function embedYouTube(id, opts) {
    opts = opts || {};
    const p = ['rel=0', 'modestbranding=1', 'playsinline=1', 'autoplay=' + (opts.autoplay ? 1 : 0)];
    if (opts.t) p.push('start=' + Math.max(0, parseInt(opts.t, 10) || 0));
    if (opts.mi) p.push('mute=1');
    return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?' + p.join('&');
  }

  function urlYouTube(entrada) {
    const id = extrairYouTubeId(entrada);
    return id ? 'https://www.youtube.com/watch?v=' + id : '';
  }
  function buscaYouTube(t, a) { return 'https://www.youtube.com/results?search_query=' + enc(termo(t, a)); }

  global.Links = {
    FONTES: FONTES, LETRAS: LETRAS, AUDIO: AUDIO, TODAS: TODAS,
    porId: porId, urlDe: urlDe, abrir: abrir,
    de: de, cifras: cifras, letras: letras, audio: audio,
    extrairYouTubeId: extrairYouTubeId, embedYouTube: embedYouTube,
    urlYouTube: urlYouTube, buscaYouTube: buscaYouTube,
  };
})(typeof window !== 'undefined' ? window : globalThis);
