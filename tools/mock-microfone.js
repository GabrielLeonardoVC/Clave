/* =========================================================
   ACORDE - tools/mock-microfone.js

   Microfone falso, para exercitar a gravacao da faixa narrada sem microfone
   de verdade.

   Nao e parte do app. E carregado so pelos testes, nunca pelo index.html, e
   por isso mora em tools/.

   Duas coisas que este arquivo ensina sobre como testar navegador:

   1. `navigator.mediaDevices` e somente-leitura. Trocar o objeto inteiro por
      outro e ignorado em silencio — sem erro, sem aviso — e o `getUserMedia`
      real continua lá, falhando sem microfone. E preciso trocar o METODO:

          navigator.mediaDevices.getUserMedia = ...

   2. Um `MediaRecorder` de mentira precisa disparar `dataavailable`. O app
      junta os pedacos nesse evento e so no fim monta o audio; sem ele, o
      gravador para, solta o microfone e diz "nada foi gravado" — o que parece
      bug do app e e mock sem conteudo.

   Uso (no console, com o servidor local no ar):

      await import('/tools/mock-microfone.js');
   ========================================================= */

/* O que o teste observa. */
const r = {
  getUserMedia: 0,
  paradas: 0,
  pedido: null,
};

navigator.mediaDevices.getUserMedia = function (restricoes) {
  r.getUserMedia++;
  r.pedido = restricoes;
  return Promise.resolve({
    getTracks: function () {
      return [{
        kind: 'audio',
        // `parar` e a unica metodo que o app chama, e a unica coisa que
        // importa medir: quem soltou o microfone.
        stop: function () { r.paradas++; },
        readyState: 'live',
      }];
    },
  });
};

function MicrofoneFalso(fluxo, opcoes) {
  this.mimeType = (opcoes && opcoes.mimeType) || 'audio/webm;codecs=opus';
  this.stream = fluxo;
  this.state = 'inactive';
  this.ondata = null;
  this.onstop = null;
  this.onerror = null;
  this._partes = [];
}

MicrofoneFalso.prototype.start = function (fatiaMs) {
  const t = this;
  this.state = 'recording';
  // A fatia e o que o app pede: `start(250)` quer dizer "me devolve um pedaco a
  // cada 250 ms", e nao "grava 250 ms". Aqui a fatia e de 40 ms para o teste
  // nao demorar.
  const fatia = Math.max(20, Math.min(fatiaMs || 250, 60));
  t._relogio = setInterval(function () {
    const pedaco = new Blob([new Uint8Array(2048)], { type: t.mimeType });
    t._partes.push(pedaco);
    // `dataavailable` e o evento de que o app depende.
    if (t.ondata) t.ondata({ data: pedaco });
  }, fatia);
};

MicrofoneFalso.prototype.addEventListener = function (nome, fn) {
  if (nome === 'dataavailable') this.ondata = fn;
  else if (nome === 'stop') this.onstop = fn;
  else if (nome === 'error') this.onerror = fn;
};

MicrofoneFalso.prototype.stop = function () {
  const t = this;
  if (this.state !== 'recording') return;
  this.state = 'inactive';
  clearInterval(this._relogio);
  // O `stop` e assincrono no gravador real, e o app depende disso: ele awaits o
  // evento antes de montar o audio.
  setTimeout(function () { if (t.onstop) t.onstop({}); }, 0);
};

MicrofoneFalso.isTypeSupported = function (mime) {
  return String(mime).indexOf('opus') >= 0;
};

window.MediaRecorder = MicrofoneFalso;
window.__microfone = r;

'microfone falso instalado';