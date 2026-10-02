/* =========================================================
   tools/provar-instrumento.js
   Prova que o `test-instrumento` pega o que ele diz pegar.

   A regra do projeto e simples: um verificador que nunca falha e um verificador
   que e ignorado. Nao adianta o teste passar bonito se ele passa tambem com o
   defeito instalado.

   Cada mutacao abaixo quebra UMA coisa do motor de audio, e o teste tem de
   notar. O que este arquivo nao faz e testar os casos ruins: para isso existe o
   `provar-timbre`, que ataca a matematica.

   UMA REGRA QUE ESTE ARQUIVO APRENDEU DO JEITO DIRETO

   Cada mutacao mexe em UMA LINHA, nunca em um bloco copiado.

   A primeira versao copiava quatro linhas do codigo para reescreve-las com um
   numero trocado. Isso falhou de duas maneiras, uma atras da outra:

     - o fim de linha tem de bater. Os arquivos deste projeto nao sao todos
       iguais: os que ja existiam usam CRLF e os novos usam LF. Uma mutacao
       escrita com o fim de linha errado nao casa com nada, e o provador
       reporta "nao achei o trecho" — que parece defeito do codigo e e defeito
       do provador.

     - cada linha copiada pode sair com um caractere a mais ou a menos. Duas
       grafias quase iguais (`parciaisPorVoz` e `parciaisPorVoz`) fazem a copia
       falhar sem nenhum aviso visivel: o `indexOf` devolve menos um e nao ha
       mensagem que diga qual caractere e qual.

   Mudar uma linha so evita os dois. E a conference abaixo existe porque
   "evitei o problema" e o mesmo que "acertei": se a linha nao for encontrada, o
   provador diz isso e para, em vez de dar um "passou" que nao mediu nada.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const AUDIO = path.join(RAIZ, 'js', 'core', 'audio.js');
const TIMBRE = path.join(RAIZ, 'js', 'core', 'timbre.js');
const TESTE = path.join(__dirname, 'test-instrumento.js');

const CR = String.fromCharCode(13);
const NL = String.fromCharCode(10);

const originais = {
  audio: fs.readFileSync(AUDIO, 'utf8'),
  timbre: fs.readFileSync(TIMBRE, 'utf8'),
};

/**
 * Cada mutacao e uma linha que existe, trocada por outra que existe.
 *
 * `de` e `para` sao linhas inteiras do arquivo, com o mesmo recuo. Se uma
 * delas nao for encontrada, o provador PARA e diz o que procurou — nunca segue
 * como se tivesse medido algo.
 */
const MUTACOES = [
  {
    nome: 'o contador de vozes deixou de contar',
    arquivo: 'audio',
    de: '        vozesAtivas: vozesSoando(),',
    para: '        vozesAtivas: 1,',
  },
  {
    nome: 'o contador nunca volta a zero',
    arquivo: 'audio',
    de: '    const solta = function () { if (vozes > 0) vozes--; };',
    para: '    const solta = function () { /* nunca solta */ };',
  },
  {
    nome: 'o decaimento virou rampa ate um valor final',
    arquivo: 'timbre',
    de: '      g.gain.setTargetAtTime(0.0001, inicial + ataque, tau);',
    para: '      g.gain.exponentialRampToValueAtTime(0.0001, inicial + ataque + tau);',
  },
  {
    nome: 'a raspagem do ataque foi aplicada a todos os instrumentos',
    arquivo: 'timbre',
    de: '    if (M.atacante > 0 && opts.atacante !== false) {',
    para: '    if (opts.atacante !== false) {',
  },
  {
    nome: 'o limite de vozes foi desligado (todo mundo com 10 parciais)',
    arquivo: 'timbre',
    de: '    if (vozesAtivas <= 3) return 6;',
    para: '    if (vozesAtivas <= 3) return 10;',
  },
  {
    nome: 'o ganho do ataque subiu a zero (fica mudo sem dar erro)',
    arquivo: 'timbre',
    de: '      gr.gain.value = M.atacante * volume * 0.5;',
    para: '      gr.gain.value = M.atacante * volume * 0;',
  },
  {
    nome: 'a voz deixou de ser contada quando a nota comeca',
    arquivo: 'audio',
    de: '    vozes++;',
    para: '    /* nao conta */',
  },
];

/* O que aconteceu de verdade com o teste, e nao so o que ele imprimiu.
 *
 * Um teste que QUEBRA nao passa: ele morre antes de olhar para o defeito. O
 * erro sai pelo `stderr`, o provador le o `stdout`, nao acha a palavra FALHA e
 * escreve "o teste passou com o defeito instalado" — o contrario do que
 * aconteceu.
 *
 * Ja aconteceu nesta rodada, com o timbre: desligar a ressonancia do violao
 * fazia o teste quebrar com TypeError, e o provador dava "ok". Por isso a queda
 * e separada da verificacao, e uma queda que NAO seja uma reprovacao e tratada
 * como defeito do teste — nunca como sucesso. */
function rodarTeste() {
  try {
    const saida = execFileSync(process.execPath, [TESTE], { encoding: 'utf8', cwd: RAIZ, timeout: 180000 });
    return { saida: saida, caiu: false, quebrou: false };
  } catch (e) {
    const texto = (e.stdout || '') + (e.stderr || '');
    const quebrou = /TypeError|ReferenceError|SyntaxError|RangeError|is not a function|Cannot read propert/.test(texto);
    return { saida: texto, caiu: true, quebrou: quebrou };
  }
}

function restaurar() {
  fs.writeFileSync(AUDIO, originais.audio, 'utf8');
  fs.writeFileSync(TIMBRE, originais.timbre, 'utf8');
}

let falhas = 0;
console.log('\n=== o teste do motor de audio pega o defeito? ===\n');

for (const m of MUTACOES) {
  const caminho = m.arquivo === 'audio' ? AUDIO : TIMBRE;
  const base = m.arquivo === 'audio' ? originais.audio : originais.timbre;

  /* A linha precisa existir exatamente uma vez. "Zero vezes" e mutacao mal
   * escrita; "mais de uma" e ambiguo, e significa que a mutacao mudaria mais
   * do que uma coisa — que e exatamente o que um provador nao deve medir. */
  const achadas = base.split(m.de).length - 1;
  if (achadas !== 1) {
    console.log('  FALHA ' + m.nome);
    console.log('          a linha procurada aparece ' + achadas + ' vez(es), e o provador'
      + ' espera 1. Ele mediu outra coisa, entao parou.');
    console.log('          procurava: ' + JSON.stringify(m.de));
    falhas++;
    continue;
  }

  fs.writeFileSync(caminho, base.split(m.de).join(m.para), 'utf8');
  const r = rodarTeste();
  restaurar();

  if (r.quebrou) {
    console.log('  FALHA ' + m.nome);
    console.log('          o teste QUEBROU em vez de reprovar. Isso nao prova que o'
      + ' teste pegaria o defeito — prova que ele nao chegou a olhar.');
    falhas++;
    continue;
  }

  const acusou = /FALHA/.test(r.saida);
  console.log((acusou ? '  ok    ' : '  FALHA ') + m.nome);

  if (!acusou) {
    console.log('          o teste passou com o defeito instalado');
    falhas++;
  } else {
    for (const l of r.saida.split(NL)) {
      if (/FALHA/.test(l) && l.indexOf('        - ') < 0) {
        console.log('          ' + l.trim().slice(0, 96));
        break;
      }
    }
  }
}

/* Confere que os arquivos voltaram ao estado certo. Um provador que deixa o
 * codigo quebrado e pior do que um provador que nao prova nada. */
restaurar();
const voltou = fs.readFileSync(AUDIO, 'utf8') === originais.audio
  && fs.readFileSync(TIMBRE, 'utf8') === originais.timbre;
console.log('\n  ' + (voltou ? 'ok    ' : 'FALHA ') + 'os arquivos voltaram ao estado original');
if (!voltou) falhas++;

const limpo = rodarTeste();
const semDefeito = !limpo.caiu && !/FALHA/.test(limpo.saida);
console.log((semDefeito ? '  ok    ' : '  FALHA ') + 'e, sem nenhum defeito, o teste passa');
if (!semDefeito) {
  if (limpo.caiu) console.log('          o teste nem chegou ao fim sem defeito nenhum');
  falhas++;
}

console.log('\n  ' + (MUTACOES.length + 2 - falhas) + ' de ' + (MUTACOES.length + 2)
  + ' se comportaram como deviam');
process.exit(falhas ? 1 : 0);