/* =========================================================
   ACORDE - core/notify.js
   Lembrete de ensaios, missas e eventos.

   Usa a Notification API do navegador. Como o app e offline,
   o agendamento e feito pela propria app: enquanto o app estiver
   aberto, um agendador dispara os lembretes. Alem disso gravamos
   as preferencias para o service worker mostrar avisos na barra
   de sistema.

   Expõe window.Notify.
   ========================================================= */
(function (global) {
  'use strict';

  const U = global.Utils;
  const S = global.Store;

  const CHAVE_PEDIDO = 'acorde_notificas';

  /* =======================
     PERMISSAO
     ======================= */
  function suporta() {
    return typeof Notification !== 'undefined';
  }
  function permissao() {
    return suporta() ? Notification.permission : 'unsupported';
  }
  function pedir() {
    if (!suporta()) return Promise.resolve('unsupported');
    if (Notification.permission === 'granted') return Promise.resolve('granted');
    if (Notification.permission === 'denied') return Promise.resolve('denied');
    try { return Notification.requestPermission(); }
    catch (e) { return Promise.resolve('denied'); }
  }

  /* =======================
     AGENDAMENTO
     ======================= */
  let timer = null;
  const disparados = {};

  function chaveDe(e) { return e.id + '@' + e.data; }

  /** Quanto tempo antes avisar (em minutos). */
  function antecedencia() {
    return S.ajuste('antecedenciaNotif', 120); // 2h por padrão
  }

  function notificar(titulo, corpo, dados) {
    if (!suporta() || Notification.permission !== 'granted') return false;
    try {
      const n = new Notification(titulo, {
        body: corpo,
        icon: 'assets/icon-512.svg',
        badge: 'assets/icon-512.svg',
        tag: (dados && dados.tag) || 'acorde',
        data: dados || {},
        requireInteraction: false,
        silent: false,
      });
      n.onclick = function () {
        try { global.focus(); } catch (e) { /* noop */ }
        if (dados && dados.rota) global.App && global.App.irPara(dados.rota, dados.params || {});
        n.close();
      };
      return true;
    } catch (e) { return false; }
  }

  /** Quando (ms desde agora) este evento deve gerar aviso, ou 0. */
  function momentoDoAviso(e) {
    if (!e.data) return 0;
    const [ano, mes, dia] = e.data.split('-').map(Number);
    const [hh, mm] = (e.hora || '09:00').split(':').map(Number);
    const quando = new Date(ano, mes - 1, dia, hh || 0, mm || 0, 0, 0).getTime();
    const dif = quando - Date.now();
    const antes = quando - antecedencia() * 60000;
    if (dif < -3600000) return 0;          // ja passou faz tempo
    if (dif <= 0) return 1;                // agora/passa: avisa ja
    if (antes - Date.now() <= 0) return 1;
    return 0;
  }

  function textoDoAviso(e) {
    const linhas = e.musicas.slice(0, 3).map((m) => '• ' + m.nome).join('\n');
    const resto = e.musicas.length > 3 ? '\n+' + (e.musicas.length - 3) + ' outras' : '';
    return e.hora
      ? U.fmtTime(e.hora) + ' · ' + e.musicas.length + ' músicas\n' + linhas + resto
      : e.musicas.length + ' músicas\n' + linhas + resto;
  }

  function checar() {
    if (!suporta() || Notification.permission !== 'granted') return;
    if (!S.ajuste('notificacoes', true)) return;
    const hoje = U.todayKey();
    const proximas = S.escalas()
      .filter((e) => e.data >= hoje)
      .sort(S.cmp)
      .slice(0, 40);
    proximas.forEach((e) => {
      const d = U.diffDays(new Date(), U.fromKey(e.data));
      if (d > 30) return;
      const k = chaveDe(e);
      if (disparados[k]) return;
      if (momentoDoAviso(e)) {
        disparados[k] = 1;
        notificar(e.titulo + (e.hora ? ' · ' + U.fmtTime(e.hora) : ''), textoDoAviso(e), {
          tag: k, rota: 'agenda', params: { data: e.data, abrir: e.id },
        });
      }
    });
  }

  function iniciar() {
    parar();
    if (timer) return;
    checar();
    timer = setInterval(checar, 60000);
  }
  function parar() { clearInterval(timer); timer = null; }

  /* =======================
     AVISO IN-APP (funciona
     mesmo sem permissao)
     ======================= */
  function avisoInterno() {
    if (!S.ajuste('notificacoes', true)) return;
    const hoje = U.todayKey();
    const lista = S.escalas().filter((e) => e.data >= hoje).sort(S.cmp);
    const alvo = lista.filter((e) => {
      const d = U.diffDays(new Date(), U.fromKey(e.data));
      return d <= 7;
    });
    if (!alvo.length) return;
    const d = U.diffDays(new Date(), U.fromKey(alvo[0].data));
    const quando = d === 0 ? 'hoje' : d === 1 ? 'amanhã' : 'em ' + d + ' dias';
    const jaAvisou = sessionStorage.getItem('acorde_aviso_' + alvo[0].id);
    if (jaAvisou) return;
    sessionStorage.setItem('acorde_aviso_' + alvo[0].id, '1');
    global.UI && global.UI.toast(
      alvo[0].titulo + ' ' + quando + ' · ' + alvo[0].musicas.length + ' músicas',
      { tipo: 'info', dur: 6000 }
    );
  }

  /* =======================
     TESTE
     ======================= */
  function testar() {
    if (permissao() === 'unsupported') { global.UI.toast('Seu navegador não suporta notificações', { tipo: 'err' }); return; }
    if (permissao() === 'granted') {
      notificar('Teste do ' + global.Identidade.NOME, 'Se você viu isso, os lembretes vão funcionar.', { tag: 'teste' });
      global.UI.toast('Notificação enviada!', { tipo: 'ok' });
      return;
    }
    pedir().then((p) => {
      if (p === 'granted') {
        notificar('Lembretes ativados', 'Avisaremos antes de cada ensaio e missa.', { tag: 'teste' });
        global.UI.toast('Lembretes ativados', { tipo: 'ok' });
      } else {
        global.UI.toast('Permissão negada. Ative nas configurações do site.', { tipo: 'err', dur: 5000 });
      }
    });
  }

  global.Notify = {
    suporta, permissao, pedir, notificar, iniciar, parar, checar,
    avisoInterno, testar, antecedencia,
  };
})(typeof window !== 'undefined' ? window : globalThis);
