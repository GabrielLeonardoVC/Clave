/* =========================================================
   tools/test-instrumento.js
   O sintetizador, rodando de verdade contra um contexto falso.

   POR QUE UM CONTEXTO DE MENTIRA

   `test-timbre.js` prova a matematica: as frequencias, as amplitudes, a ordem
   em que os parciais morrem. E tudo puro, e tudo esta certo.

   Mas a matematica certa nao e som. Falta a outra metade — a que so aparece
   quando o codigo chama um metodo que talvez nao exista, com uma assinatura
   diferente da que a memria lembra, e o aparelho engole a excecao. Nenhuma
   analise estatica pega isso.

   Este arquivo executa o caminho inteiro contra um `AudioContext` falso que
   registra tudo: quantos osciladores foram criados, em que frequencia, que
   envelope cada um recebeu, e o que foi ligado em que.

   O QUE ISTO NAO PROVA

   Que soa bonito. Isso exige ouvido humano e alto-falante. O que este arquivo
   garante e que o aparelho vai mesmo tocar, com o numero certo de vozes, sem
   estourar o limite do motor, e que o caminho antigo do tom puro continua
   intacto — que e o que o afinador depende.
   ========================================================= */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');

let passou = 0;
let falhou = 0;
const problemas = [];

function ok(cond, titulo, detalhe) {
  if (cond) { passou++; console.log('  ok    ' + titulo + (detalhe ? '  (' + detalhe + ')' : '')); }
  else { falhou++; problemas.push(titulo); console.log('  FALHA ' + titulo + (detalhe ? '  (' + detalhe + ')' : '')); }
}
function secao(t) { console.log('\n=== ' + t + ' ==='); }

/* ------------------------------------------------------------------ */
/* O AUDIOCONTEXT FALSO.                                              */
/*                                                                     */
/* Ele nao produz som — nao tem como. Ele REGISTRA. Cada metodo guarda o    */
/* que recebeu e devolve um objeto com o mesmo formato, para que o codigo    */
/* real rode sem nenhuma condicao especial.                              */
/* ------------------------------------------------------------------ */
function contextoFalso(registro) {
  const no = () => ({
    /* Guarda a ARESTA, e nao so o destino. Registrar so o alvo responde "o que
     * recebeu alguem", e nao "quem alimentou o que" — e a segunda e a pergunta
     * que este arquivo faz. */
    connect(alvo) { registro.arestas.push({ de: this, para: alvo }); this.conexaoCom = alvo; return this; },
    disconnect() {},
  });

  return {
    currentTime: 10,
    sampleRate: 48000,
    destination: { nome: 'destino' },

    createOscillator() {
      const osc = no();
      osc.type = 'sine';
      osc.frequency = {
        valor: 440,
        setValueAtTime(v, t) { this.valor = v; osc._freqEm = t; },
      };
      osc.tipo = 'oscilador';
      osc.start = (t) => { osc._comecouEm = t; registro.osciladores.push(osc); };
      osc.stop = (t) => { osc._parouEm = t; };
      osc.onended = null;
      registro.criados++;
      return osc;
    },

    createGain() {
      const g = no();
      /* `ganho.value` e o ganho estatico. Nos parciais ele nunca e lido — cada
       * um e controlado por envelope — mas na raspagem do ataque ele e o unico
       * controle, e por isso o teste precisa poder le-lo. */
      g.gain = {
        valor: 1,
        ganhoEm: [],
        set value(v) { this.valor = v; },
        get value() { return this.valor; },
        setValueAtTime(v, t) { this.valor = v; this.ganhoEm.push({ tipo: 'set', v: v, t: t }); },
        exponentialRampToValueAtTime(v, t) { this.ganhoEm.push({ tipo: 'exponencial', v: v, t: t }); },
        linearRampToValueAtTime(v, t) { this.ganhoEm.push({ tipo: 'linear', v: v, t: t }); },
        setTargetAtTime(v, t, tau) { this.ganhoEm.push({ tipo: 'alvo', v: v, t: t, tau: tau }); },
      };
      /* Deixa o no saber em quem ele descarrega. E o que distingue o ganho de
       * saida (que vai para o aparelho) do ganho da raspagem (que vai para o
       * ganho de saida). */
      g.tipo = 'ganho';
      g.conexaoCom = null;
      registro.ganhos++;
      return g;
    },

    createBuffer(canais, quadros, taxa) {
      return {
        length: quadros,
        sampleRate: taxa,
        getChannelData() { return new Float32Array(quadros); },
      };
    },

    createBufferSource() {
      const b = no();
      b.tipo = 'buffer';
      b.buffer = null;
      b.start = (t) => { b._comecouEm = t; registro.buffers.push(b); };
      b.stop = (t) => { b._parouEm = t; };
      return b;
    },

    createBiquadFilter() {
      const f = no();
      f.tipo = 'filtro';
      f.type = 'lowpass';
      f.frequency = { valor: 350, setValueAtTime(v) { this.valor = v; } };
      f.Q = { valor: 1, set value(v) { this._v = v; }, get value() { return this._v; } };
      return f;
    },
  };
}

function registroNovo() {
  return { osciladores: [], buffers: [], arestas: [], criados: 0, ganhos: 0 };
}

/* ------------------------------------------------------------------ */
/* Carrega o app de audio com o contexto falso.                         */
/* ------------------------------------------------------------------ */
function carregarAudio(registro) {
  delete require.cache[require.resolve(path.join(RAIZ, 'js', 'core', 'timbre.js'))];
  delete require.cache[require.resolve(path.join(RAIZ, 'js', 'core', 'audio.js'))];
  require(path.join(RAIZ, 'js', 'core', 'timbre.js'));

  const c = contextoFalso(registro);
  global.window = global;
  global.AudioContext = function () { return c; };
  global.webkitAudioContext = undefined;

  require(path.join(RAIZ, 'js', 'core', 'utils.js'));
  require(path.join(RAIZ, 'js', 'core', 'audio.js'));
  return c;
}

global.document = {
  createElement: () => ({ style: {}, addEventListener() {}, removeEventListener() {} }),
  addEventListener() {}, removeEventListener() {},
  querySelector() { return null; }, querySelectorAll() { return []; },
  body: { appendChild(c) { return c; } },
};
/* No Node 24 `global.navigator` e somente-leitura: atribuir direto lanca
 * TypeError. E preciso redefinir a propriedade. */
Object.defineProperty(global, 'navigator', {
  value: { userAgent: 'node' },
  configurable: true,
  writable: true,
});

/* ------------------------------------------------------------------ */
secao('1. O caminho do tom puro continua igual');

/* Este e o caminho do afinador. Se ele mudar, o afinador passa a ouvir um
 * arranjo no lugar do tom de referencia — e a corda parece mais afinada do que
 * esta, que e o defeito que o tom puro foi criado para evitar. */
{
  const r = registroNovo();
  carregarAudio(r);
  const Nota = global.Nota;

  const n = Nota.tocarNota(220, 1.5, {});
  ok(!!n, 'toca sem instrumento');
  ok(r.criados === 1, 'cria UM so oscilador, sem pedir instrumento',
    r.criados + ' osciladores');
  ok(n && n.timbre === 'triangle', 'e o tom puro de sempre (triangle)',
    n && n.timbre);
  ok(!!(n && n.osc), 'devolve a nota com o oscilador, como antes');
}

{
  const r = registroNovo();
  carregarAudio(r);
  const n = global.Nota.tocarNota(220, 1, { instrumento: 'violao' });
  ok(r.criados > 1, 'com instrumento, cria um oscilador por harmonico',
    r.criados + ' osciladores');
  ok(n && n.instrumento === 'violao', 'e devolve o nome do instrumento');
}

/* ------------------------------------------------------------------ */
secao('2. As frequencias batem com o modelo');

{
  const r = registroNovo();
  carregarAudio(r);
  global.Nota.tocarNota(220, 2, { instrumento: 'violao' });

  const freqs = r.osciladores.map((o) => o.frequency.valor).sort((a, b) => a - b);
  ok(freqs.length > 0 && freqs[0] === 220, 'o primeiro parcial e a fundamental',
    String(freqs[0]));
  let todosMultiplos = true;
  for (const f of freqs) {
    const m = f / 220;
    if (Math.abs(m - Math.round(m)) > 1e-6) todosMultiplos = false;
  }
  ok(todosMultiplos, 'todo parcial e um multiplo inteiro da fundamental',
    freqs.slice(0, 5).join(', '));
  let crescente = true;
  for (let i = 1; i < freqs.length; i++) if (freqs[i] <= freqs[i - 1]) crescente = false;
  ok(crescente, 'e os parciais estao em ordem, sem repeticao');
}

/* ------------------------------------------------------------------ */
secao('3. O envelope de cada parcial e o que da o timbre');

{
  const r = registroNovo();
  carregarAudio(r);
  global.Nota.tocarNota(220, 3, { instrumento: 'violao' });

  /* Cada oscilador passa por um ganho proprio. O ganho e o que faz o parcial
   * alto sumir antes do grave, e e a propriedade que o `test-timbre` prova
   * na matematica — aqui prova que o codigo realmente a aplica.
   *
   * A conta tem tres partes: um ganho por parcial, o ganho de saida da nota
   * (que e o que permite cortar a nota inteira de uma vez) e o ganho da
   * raspagem do ataque. O ultimo so existe para instrumento que pinca — o
   * sintetizador e cortado, entao o ruido do dedao nao tem sentido nele. */
  const temRaspagem = global.Timbre.modeloDe('violao').atacante > 0;
  const esperado = r.osciladores.length + 1 + (temRaspagem ? 1 : 0);
  ok(r.ganhos === esperado,
    'um ganho por parcial, o de saida, e o da raspagem do ataque',
    r.ganhos + ' ganhos para ' + r.osciladores.length + ' osciladores (esperado ' + esperado + ')');

  /* E a prova de que a raspagem e do instrumento: um pad nao tem ruido de
   * dedao, e se aparecesse la o app estaria imitando uma corda num teclado. */
  const r2 = registroNovo();
  carregarAudio(r2);
  global.Nota.tocarNota(220, 2, { instrumento: 'sintetizador' });
  const temRaspagemPad = global.Timbre.modeloDe('sintetizador').atacante > 0;
  const esperadoPad = r2.osciladores.length + 1 + (temRaspagemPad ? 1 : 0);
  ok(r2.ganhos === esperadoPad,
    'o sintetizador nao ganha raspagem de ataque',
    r2.ganhos + ' ganhos para ' + r2.osciladores.length + ' osciladores (esperado ' + esperadoPad + ')');
  ok(r2.buffers.length === 0, 'e nenhum ruido e gerado para ele',
    r2.buffers.length + ' buffers');

  /* O decaimento e `setTargetAtTime`, e nao `exponentialRampToValueAtTime`. A
   * diferenca nao e de estilo: a rampa precisa de um valor final, e uma corda
   * que chega a zero para de soar. A curva que se aproxima de zero sem chegar e
   * `setTargetAtTime`. */
  let temAlvo = 0;
  for (const a of r.arestas) {
    if (a.de.gain && a.de.gain.ganhoEm && a.de.gain.ganhoEm.some((e) => e.tipo === 'alvo')) temAlvo++;
  }
  ok(temAlvo >= r.osciladores.length - 1,
    'os parciais decaem com setTargetAtTime',
    temAlvo + ' envelopes de decaimento');
}

/* ------------------------------------------------------------------ */
secao('4. Nenhum envelope toca zero');

/* `exponentialRampToValueAtTime` LANCA excecao quando o alvo e zero. Nao e um
 * valor estranho: e um erro. E o aparelho engole excecao aqui, porque a nota
 * esta dentro de um `try` em quase toda tela de audio — o sintoma seria um
 * silencio sem explicação. */
{
  const r = registroNovo();
  carregarAudio(r);
  global.Nota.tocarNota(110, 2, { instrumento: 'violao' });
  global.Nota.tocarNota(330, 2, { instrumento: 'baixo' });

  let comZero = 0;
  const inspecionar = (g) => {
    if (!g || !g.gain || !g.gain.ganhoEm) return;
    for (const e of g.gain.ganhoEm) {
      if (e.tipo === 'exponencial' && e.v === 0) comZero++;
    }
  };
  for (const a of r.arestas) inspecionar(a.de);
  ok(comZero === 0, 'nenhuma rampa exponencial tem zero como alvo',
    comZero + ' rampas com zero');
}

/* ------------------------------------------------------------------ */
secao('5. O Traste muda o que toca, e nao so o numero');

{
  const r = registroNovo();
  carregarAudio(r);
  global.Nota.tocarNota(220, 2, { instrumento: 'violao', traste: 0 });
  const aberto = r.osciladores.length;

  const r2 = registroNovo();
  carregarAudio(r2);
  global.Nota.tocarNota(220, 2, { instrumento: 'violao', traste: 22 });
  const fechado = r2.osciladores.length;

  ok(aberto > 0 && fechado > 0, 'os dois tocasparam alguma coisa',
    aberto + ' e ' + fechado + ' osciladores');

  /* O traste tem de mudar o TEMPO, nao necessariamente quantos parciais
   * cabem: a corda curta e mais brilhante, mas com o mesmo numero de
   * osciladores ela pode ter os mesmos parciais com outro decaimento. */
  const gainDe = (reg) => reg.arestas.filter((a) => a.de.gain && a.de.gain.ganhoEm)
    .map((a) => a.de.gain.ganhoEm.find((e) => e.tipo === 'alvo')).filter(Boolean);
  const tausAberto = gainDe(r).map((e) => e.tau);
  const tausFechado = gainDe(r2).map((e) => e.tau);

  let maisCurtos = 0;
  for (let i = 0; i < Math.min(tausAberto.length, tausFechado.length); i++) {
    if (tausFechado[i] < tausAberto[i]) maisCurtos++;
  }
  ok(maisCurtos > 0, 'no traste 22 a corda morre antes',
    maisCurtos + ' de ' + Math.min(tausAberto.length, tausFechado.length)
    + ' parciais mais rapidos');
}

/* ------------------------------------------------------------------ */
secao('6. As entradas ruins viram silencio, e nao excecao');

/* Este e o ponto que mais machuca no aparelho: um `throw` dentro de um
 * `try` que engole a excecao vira silencio sem aviso, e a pessoa acha que o
 * app esta quebrado. Nenhum destes pode escapar. */
{
  const r = registroNovo();
  carregarAudio(r);
  const Nota = global.Nota;
  let escapou = null;

  for (const ruim of [0, -5, NaN, Infinity, 'abc', null, undefined, {}, []]) {
    try {
      const n = Nota.tocarNota(ruim, 1, { instrumento: 'violao' });
      if (n !== null && n !== undefined) escapou = escapou || ('devolveu algo para ' + JSON.stringify(ruim));
    } catch (e) {
      escapou = escapou || ('lançou ' + e.constructor.name + ' para ' + JSON.stringify(ruim));
    }
  }
  ok(!escapou, 'nenhuma entrada invalida escapa ou devolve som', escapou || '');

  // Instrumento inexistente: tem de cair no violão, não quebrar.
  let comInstrumentoFalso = null;
  try {
    const n = Nota.tocarNota(220, 1, { instrumento: 'instrumento-que-nao-existe' });
    if (!n) comInstrumentoFalso = 'devolveu nada';
  } catch (e) { comInstrumentoFalso = 'lançou ' + e.message; }
  ok(!comInstrumentoFalso, 'instrumento que não existe cai no violão e toca',
    comInstrumentoFalso || '');

  // Volume zero: silêncio é uma resposta legítima, e não uma nota.
  let comVolumeZero = 'ok';
  try {
    const n = Nota.tocarNota(220, 1, { instrumento: 'violao', volume: 0 });
    if (n) comVolumeZero = 'tocou com volume zero';
  } catch (e) { comVolumeZero = 'lançou ' + e.message; }
  ok(comVolumeZero === 'ok', 'volume zero devolve silêncio de propósito', comVolumeZero);
}

/* ------------------------------------------------------------------ */
secao('7. O acorde conta as vozes, e o limite cabe no aparelho');

/* Um acorde de seis notas com dez parciais cada sao sessenta osciladores ao
 * mesmo tempo. O `parciaisPorVoz` existe para impedir isso — mas so se o
 * `audio.js` CONTAR as vozes. Se ele mandar sempre 1, a degradacao nunca
 * acontece e o aparelho engasga. */
{
  const r = registroNovo();
  carregarAudio(r);
  const Nota = global.Nota;

  const hzs = [82, 110, 147, 220, 330, 440];
  const notas = Nota.tocarAcorde(hzs, { instrumento: 'violao', duracao: 3 });

  ok(notas.length === 6, 'o acorde tem as seis notas', String(notas.length));
  ok(r.criados < 60, 'e mesmo assim nao abriu sessenta osciladores',
    r.criados + ' osciladores para 6 notas');

  /* E o mais importante: a PRIMEIRA nota pode ser cheia, mas a sexta tem de
   * ser mais leve. Sem isso, todas tocam iguais e o limite nao existe. */
  const porNota = [];
  for (const n of notas) {
    if (n && n.osciladores) porNota.push(n.osciladores.length);
  }
  ok(porNota.length === 6, 'cada nota sabe quantos osciladores tem',
    porNota.join(' '));
  const ultima = porNota[porNota.length - 1];
  const primeira = porNota[0];
  ok(ultima <= primeira, 'a ultima nota do acorde e mais leve que a primeira',
    primeira + ' -> ' + ultima);
}

/* ------------------------------------------------------------------ */
secao('8. O contador de vozes volta a zero');

/* Se a contagem so sobe, a terceira nota ja nasce achando que o aparelho esta
 * no limite, e o timbre degrada para sempre.
 *
 * A primeira versao deste teste tocava UMA nota, deixava terminar, e tocava
 * outra — e nao via nada. Com uma voz o limite nao age: `parciaisPorVoz(0)` e
 * `parciaisPorVoz(1)` dao o mesmo resultado, entao um contador travado em 1
 * produzia exatamente a mesma leitura que um contador saudavel.
 *
 * So ha um jeito de ver a diferenca: empilhar varias notas, terminar todas, e
 * entao recomecar. Com o contador travado em 3, a nota seguinte ainda se acha
 * num arranjo e sai mais leve. */
{
  const r = registroNovo();
  carregarAudio(r);
  const Nota = global.Nota;
  const qtd = (n) => (n && n.osciladores ? n.osciladores.length : 0);

  // Tres notas empilhadas, sem terminar nenhuma.
  const a = qtd(Nota.tocarNota(220, 8, { instrumento: 'violao' }));
  const b = qtd(Nota.tocarNota(247, 8, { instrumento: 'violao' }));
  const c = qtd(Nota.tocarNota(262, 8, { instrumento: 'violao' }));

  ok(a === 10 && b === 10, 'com uma e duas vozes ainda toca cheio',
    a + ' e ' + b);
  ok(c < a, 'com tres vozes ja comeca a aliviar', c + ' contra ' + a);

  // Termina tudo, como o motor faria.
  for (const o of r.osciladores) {
    if (typeof o.onended === 'function') o.onended();
  }

  const depois = qtd(Nota.tocarNota(220, 8, { instrumento: 'violao' }));
  ok(depois === 10, 'depois que tudo acaba, a proxima volta a tocar cheia',
    'viram ' + c + ', agora ' + depois);
}

/* O ganho da raspagem precisa ser audivel. Zerado, o app nao estoura — ele
 * fica mudo no ataque, o que e pior, porque nao da erro nenhum.
 *
 * Como achar o ganho da raspagem entre todos os outros: ele e o unico que
 * alimenta outro ganho, em vez de alimentar o destino do aparelho. O resto vai
 * direto para a saida. */
{
  const r = registroNovo();
  carregarAudio(r);
  global.Nota.tocarNota(220, 2, { instrumento: 'violao' });

  /* O ganho de saida e o unico que descarrega direto no aparelho — todos os
   * outros descarregam nele. E essa distincao que separa o ganho da nota, o
   * ganho de cada parcial e o ganho da raspagem. */
  const naSaida = r.arestas.filter((a) => a.de.tipo === 'ganho' && a.para.tipo !== 'ganho');
  ok(naSaida.length === 1, 'a nota tem um ganho de saida, por onde tudo passa',
    naSaida.length + ' ganhos ligados direto no aparelho');

  const saidaDaNota = naSaida.length ? naSaida[0].de : null;
  const alimentamSaida = r.arestas.filter((a) => a.para === saidaDaNota);
  /* O caminho da raspagem: buffer -> filtro -> ganho. So um ganho tem um
   * filtro atras dele, e e isso que o separa dos ganhos dos parciais. */
  const raspagens = alimentamSaida.filter((a) =>
    r.arestas.some((x) => x.para === a.de && x.de.tipo === 'filtro'));
  ok(raspagens.length === 1,
    'e dentro dele so a raspagem do ataque cabe um ganho a mais',
    raspagens.length + ' ganho(s) a mais alem dos '
    + (alimentamSaida.length - raspagens.length) + ' parciais');
  ok(raspagens.length === 1 && raspagens[0].de.gain.value > 0,
    'e ele tem volume: com zero, o ataque fica mudo sem dar erro',
    raspagens.length ? String(raspagens[0].de.gain.value) : 'nao achou');

  /* E o inverso: um instrumento que nao se raspa nao gera esse ruido. */
  const r2 = registroNovo();
  carregarAudio(r2);
  global.Nota.tocarNota(220, 2, { instrumento: 'sintetizador' });
  ok(r2.buffers.length === 0, 'o sintetizador nao gera ruido de ataque',
    r2.buffers.length + ' buffers de ruido');
  const filtroNoPad = r2.arestas.filter((a) => a.de.tipo === 'filtro').length;
  ok(filtroNoPad === 0, 'e nao passa nenhum filtro de raspagem',
    filtroNoPad + ' filtros');
}

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(52));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  O motor de audio roda dentro de um `try` em quase toda tela.');
  console.log('  Uma excecao aqui vira silencio sem aviso — e a pessoa acha que');
  console.log('  o app quebrou, nao que o codigo lancou.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(52) + '\n');
process.exit(falhou ? 1 : 0);