/* Prova que a rede de seguranca do provador NAO e fe.
 *
 * Um mecanismo de restauracao que nunca foi interrompido de proposito e' so
 * uma boa intencao. Aqui cada camada e' testada derrubando o processo DEPOIS
 * da mutacao, do jeito que acontece quando a pessoa aperta Ctrl+C. */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const RAIZ = 'C:/Users/Gilson/Documents/Micro Saas/Cifras-pro';
const PROVADOR = path.join(RAIZ, 'tools', 'provar-quota-vs.js');
const ALVO = path.join(RAIZ, 'js', 'views', 'cancao.js');
const orig = fs.readFileSync(ALVO, 'utf8');

/* Mata o provador no meio da mutacao. `SIGKILL` nao deixa o Node rodar NENHUM
 * handler — nem `exit`, nem sinal, nem finally. E' o caso que nenhuma camada
 * em JS cobre, e o motivo de a copia em disco existir. */
const casos = [
  { nome: 'SIGINT  (Ctrl+C durante a mutacao)', sinal: 'SIGINT', matar: true },
  { nome: 'SIGTERM (encerrar processo)', sinal: 'SIGTERM', matar: true },
  { nome: 'SIGKILL (processo morto, sem handler)', sinal: 'SIGKILL', matar: false },
  { nome: 'saida normal', sinal: null, matar: false },
];

console.log('=== O CODIGO DO PRODUTO SOBREVIVE A CADA INTERRUPCAO? ===');
let ruins = 0;
for (const c of casos) {
  if (fs.readFileSync(ALVO, 'utf8') !== orig) fs.writeFileSync(ALVO, orig, 'utf8');

  if (c.sinal === null) {
    execFileSync('node', [PROVADOR], { encoding: 'utf8' });
  } else {
    const filho = spawn('node', [PROVADOR], { stdio: 'ignore', detached: true });
    // deixa a primeira mutacao acontecer, e entao mata
    const esperaMutar = setInterval(() => {
      if (fs.readFileSync(ALVO, 'utf8') !== orig) {
        clearInterval(esperaMutar);
        try { process.kill(-filho.pid, c.sinal); } catch (e) { try { filho.kill(c.sinal); } catch (e2) {} }
      }
    }, 15);
    const fim = Date.now() + 25000;
    while (Date.now() < fim) {
      try { process.kill(filho.pid, 0); } catch (e) { break; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40);
    }
    clearInterval(esperaMutar);
    try { process.kill(-filho.pid, 'SIGKILL'); } catch (e) {}
  }

  const atual = fs.readFileSync(ALVO, 'utf8');
  const intacto = atual === orig;
  const comMutacao = (atual.match(/mutado/g) || []).length;
  if (!intacto) ruins++;
  console.log('  ' + c.nome.padEnd(42)
    + (intacto ? 'RESTAURADO' : '*** DEIXOU MUTADO (' + comMutacao + ' marcas) ***')
    + (c.matar ? '' : ''));
  fs.writeFileSync(ALVO, orig, 'utf8');
}

/* E a prova de que a mutacao ACONTECE de verdade — uma rede que nunca foi
 * exercitada passa porque nada aconteceu. */
console.log('\n=== A MUTACAO ACONTECE? (senao a rede nao foi testada) ===');
const antes = fs.readFileSync(ALVO, 'utf8');
const filho = spawn('node', [PROVADOR], { stdio: 'ignore', detached: true });
let viuMutado = false;
const dorme = new Int32Array(new SharedArrayBuffer(4));
const fim = Date.now() + 25000;
while (Date.now() < fim) {
  /* A leitura fica DENTRO do laco, e nao num `setInterval`.
   *
   * `Atomics.wait` bloqueia a thread, e um `setInterval` blocked nunca roda: o
   * vigia ficava morto durante a espera inteira, e a rede "passava" sem nunca
   * ter sido exercitada. Era o mesmo defeito que um verificador fraco — a
   * prova passava sem ter provado nada. */
  try { if (fs.readFileSync(ALVO, 'utf8') !== antes) viuMutado = true; } catch (e) {}
  try { process.kill(filho.pid, 0); } catch (e) { break; }
  Atomics.wait(dorme, 0, 0, 3);
}
try { process.kill(-filho.pid, 'SIGKILL'); } catch (e) {}
fs.writeFileSync(ALVO, orig, 'utf8');
console.log('  o arquivo chegou a ficar mutado durante a execucao: '
  + (viuMutado ? 'SIM — a rede foi exercitada' : 'NAO — a rede NAO foi testada'));
if (!viuMutado) ruins++;

fs.writeFileSync(ALVO, orig, 'utf8');
console.log('\n=== estado final do arquivo do produto: '
  + (fs.readFileSync(ALVO, 'utf8') === orig ? 'IDENTICO ao original' : 'DIFERENTE') + ' ===');
console.log('\n  ' + (ruins === 0
  ? 'A REDE SEGURA O CODIGO DO PRODUTO.'
  : ruins + ' FALHA(S): o provador pode deixar cancao.js mutado.'));
process.exit(ruins ? 1 : 0);