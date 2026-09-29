/* =========================================================
   ACORDE - core/metronome.js
   Metronomo com Web Audio API.

   Por que Web Audio e nao <audio> em loop?
   - Continua funcionando com a aba em segundo plano (sem throttling).
   - Nao depende de arquivo de audio: sem latencia de carga.
   - Precisao de tempo: a batida acontece no relogio de audio,
     nao no relogio do JavaScript (que atrasa quando a aba perde foco).
   - Continua audivel MESMO COM o video do YouTube tocando, porque
     nao usa o canal de audio do elemento <video>.

   Expõe window.Metro.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;

  const ctx = { ac: null, master: null };

  function audio() {
    if (!ctx.ac) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx.ac = new AC();
      ctx.master = ctx.ac.createGain();
      ctx.master.gain.value = 0.9;
      ctx.master.connect(ctx.ac.destination);
    }
    return ctx.ac;
  }

  /** Navegadores exigem gesto do usuario para iniciar audio. */
  function destravar() {
    const ac = audio();
    if (ac && ac.state === 'suspended') ac.resume().catch(function () {});
    return ac;
  }

  const METRONOME = {
    bpm: 100,
    compasso: 4,        // batidas por compasso
    subdivisao: 1,      // 1 = colcheia, 2 = semicolcheia
    acento: true,       // realca a primeira batida
    som: 'click',       // click | wood | bell | digital
    volume: 0.8,
    tocando: false,
    batida: 0,          // indice da batida atual
    onBeat: null,       // callback da interface
    _timer: null,
    _nextTime: 0,
    _count: 0,
    _lookahead: 0.025,  // 25 ms de antecipacao
    _interval: 25,      // varredura a cada 25 ms
  };

  function duracaoBatida() {
    return 60 / METRONOME.bpm / METRONOME.subdivisao;
  }

  /** Sintetiza uma batida no instante exato. */
  function tocarBatida(tempo, primeiro) {
    const ac = audio();
    if (!ac) return;

    const g = ac.createGain();
    g.connect(ctx.master);

    const dur = 0.055;
    let freq;
    if (METRONOME.som === 'wood') freq = primeiro ? 1174 : 880;
    else if (METRONOME.som === 'digital') freq = primeiro ? 2093 : 1318;
    else if (METRONOME.som === 'bell') freq = primeiro ? 1567 : 1046;
    else freq = primeiro ? 1567 : 1046;

    const osc = ac.createOscillator();
    osc.type = METRONOME.som === 'wood' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, tempo);
    if (primeiro) osc.frequency.exponentialRampToValueAtTime(freq * 0.72, tempo + dur * 0.9);

    const vol = METRONOME.volume * (primeiro ? 1 : 0.62);
    g.gain.setValueAtTime(0.0001, tempo);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), tempo + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, tempo + dur);

    osc.connect(g);
    osc.start(tempo);
    osc.stop(tempo + dur + 0.02);

    // avisa a interface no tempo certo (nao no setTimeout)
    if (METRONOME.onBeat) {
      const atraso = Math.max(0, (tempo - ac.currentTime) * 1000);
      setTimeout(function () { METRONOME.onBeat(METRONOME.batida); }, atraso);
    }
  }

  /** Agenda as batidas que ainda vao acontecer dentro da janela. */
  function agendar() {
    if (!METRONOME.tocando) return;
    const ac = audio();
    if (!ac) return;
    const d = duracaoBatida();
    const compassoTotal = METRONOME.compasso * METRONOME.subdivisao;
    let guarda = 0;
    while (METRONOME._nextTime < ac.currentTime + METRONOME._lookahead && guarda++ < 64) {
      METRONOME.batida = METRONOME._count % compassoTotal;
      const primeiro = METRONOME.acento && (METRONOME.batida % METRONOME.compasso === 0);
      tocarBatida(METRONOME._nextTime, primeiro);
      METRONOME._nextTime += d;
      METRONOME._count++;
    }
  }

  function iniciar() {
    destravar();
    if (METRONOME.tocando) return;
    const ac = audio();
    if (!ac) return;
    METRONOME.tocando = true;
    METRONOME._count = 0;
    METRONOME._nextTime = ac.currentTime + 0.08;
    agendar();
    METRONOME._timer = setInterval(agendar, METRONOME._interval);
  }

  function parar() {
    METRONOME.tocando = false;
    clearInterval(METRONOME._timer);
    METRONOME._timer = null;
  }

  function alternar() {
    if (METRONOME.tocando) parar(); else iniciar();
    return METRONOME.tocando;
  }

  /** Toca UM tique unico (botao "testar"). */
  function tique(primeiro) {
    const ac = destravar();
    if (!ac) return;
    tocarBatida(ac.currentTime + 0.01, primeiro !== false);
  }

  function definir(chave, valor) { METRONOME[chave] = valor; }

  /** BPM efetivo ja com a subdivisao aplicada. */
  function bpmEfetivo() { return Math.round(METRONOME.bpm * METRONOME.subdivisao); }

  function estado() {
    return {
      bpm: METRONOME.bpm, compasso: METRONOME.compasso,
      subdivisao: METRONOME.subdivisao, acento: METRONOME.acento,
      som: METRONOME.som, volume: METRONOME.volume,
      tocando: METRONOME.tocando, batida: METRONOME.batida,
    };
  }

  function aplicar(cfg) {
    if (!cfg) return;
    if (cfg.bpm) METRONOME.bpm = U.clamp(parseInt(cfg.bpm, 10) || 100, 20, 320);
    if (cfg.compasso) METRONOME.compasso = U.clamp(parseInt(cfg.compasso, 10) || 4, 1, 16);
    if (cfg.subdivisao) METRONOME.subdivisao = U.clamp(parseInt(cfg.subdivisao, 10) || 1, 1, 4);
    if (typeof cfg.acento === 'boolean') METRONOME.acento = cfg.acento;
    if (cfg.som) METRONOME.som = cfg.som;
    if (cfg.volume !== undefined) METRONOME.volume = U.clamp(+cfg.volume || 0, 0, 1);
  }

  /* ---------------- tap tempo ---------------- */
  let taps = [];
  function tapTempo() {
    const agora = (global.performance && performance.now) ? performance.now() : Date.now();
    taps = taps.filter(function (t) { return agora - t < 2600; });
    taps.push(agora);
    if (taps.length < 2) return null;
    const recent = taps.slice(-6);
    const gaps = [];
    for (let i = 1; i < recent.length; i++) gaps.push(recent[i] - recent[i - 1]);
    gaps.sort(function (a, b) { return a - b; });
    const med = gaps[Math.floor(gaps.length / 2)];
    if (!med || med < 200 || med > 2400) return null;
    METRONOME.bpm = U.clamp(Math.round(60000 / med), 20, 320);
    return METRONOME.bpm;
  }
  function resetarTap() { taps = []; }

  const COMPASSOS = [
    { v: 2, n: '2/4' }, { v: 3, n: '3/4' }, { v: 4, n: '4/4' },
    { v: 6, n: '6/8' }, { v: 7, n: '7/8' }, { v: 9, n: '9/8' }, { v: 12, n: '12/8' },
  ];

  global.Metro = {
    METRONOME: METRONOME,
    iniciar: iniciar, parar: parar, alternar: alternar, tique: tique,
    definir: definir, estado: estado, aplicar: aplicar,
    bpmEfetivo: bpmEfetivo,
    tapTempo: tapTempo, resetarTap: resetarTap,
    destravar: destravar, COMPASSOS: COMPASSOS,
    get ctx() { return ctx.ac; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
