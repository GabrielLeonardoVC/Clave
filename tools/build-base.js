/* Gerador de js/data/base.js
   Valida cada acorde de cada cifra antes de escrever o arquivo.
   Uso:  node tools/build-base.js                                 */
const fs = require('fs');
const path = require('path');
const M = require('../js/core/music.js');

/* Cada entrada traz a letra e a cifra.
   O BLOCO abaixo é a única fonte de verdade; o gerador normaliza
   e valida tudo antes de gravar. */
const BASE = [
  {
    id: 'h_amazing_grace',
    titulo: 'Amazing Grace (Preziosa Graca)',
    artista: 'John Newton (1779)',
    tom: 'G', bpm: 76, compasso: '3/4', categoria: 'Tradicional',
    tags: ['graca', 'classico', 'tradicional'],
    letra: [
      'Amazing grace, how sweet the sound',
      'That saved a wretch like me;',
      'I once was lost, but now am found,',
      'Was blind, but now I see.',
    ],
    cifra: [
      '[Verso 1]',
      'G              C        G',
      'Amazing grace, how sweet the sound',
      'D              G',
      'That saved a wretch like me;',
      'G              C        G',
      'I once was lost, but now am found,',
      'D              G',
      'Was blind, but now I see.',
      '',
      '[Verso 2]',
      'G              C        G',
      "'Twas grace that taught my heart to fear,",
      'D              G',
      'And grace my fears relieved;',
      'G              C        G',
      'How precious did that grace appear',
      'D              G',
      'The hour I first believed!',
    ],
  },
  {
    id: 'h_quao_grande',
    titulo: 'Quao Grande Es Tu, Senhor',
    artista: 'O Store Gud (Sueco, 1885)',
    tom: 'C', bpm: 72, compasso: '3/4', categoria: 'Tradicional',
    tags: ['devocional', 'classico', 'tradicional'],
    letra: [
      'O Senhor meu Deus, quando olho',
      'Para o mundo que criastei,',
      'Vejo o sol, a lua e as estrelas,',
      'E o mar que o teu poder formastei.',
    ],
    cifra: [
      '[Verso]',
      'C                    F',
      'O Senhor meu Deus, quando olho',
      'C              G',
      'Para o mundo que criastei,',
      'F                C',
      'Vejo o sol, a lua e as estrelas,',
      'G         C',
      'E o mar que o teu poder formastei.',
      '',
      '[Refrao]',
      'C            F',
      'Quao grande es Tu, Senhor!',
      'C              G',
      'Maravilhoso es o meu Deus!',
      'F                C',
      'Em toda parte vejo o teu poder,',
      'G         C',
      'Teu nome eu louvo, Senhor!',
    ],
  },
  {
    id: 'h_vencendo_vem',
    titulo: 'Vencendo Vem Jesus',
    artista: 'Tradicional',
    tom: 'D', bpm: 96, compasso: '4/4', categoria: 'Classico',
    tags: ['ressurreicao', 'classico'],
    letra: [
      'Vencendo vem Jesus, meu Rei!',
      'Vencendo vem Jesus, por mim!',
      'Quando eu for tentado,',
      'Ele me guia, e o meu pastor!',
    ],
    cifra: [
      '[Verso]',
      'D           A',
      'Vencendo vem Jesus, meu Rei!',
      'D           A     Bm',
      'Vencendo vem Jesus, por mim!',
      'G         D      A',
      'Quando eu for tentado,',
      'D         G        A',
      'Ele me guia, e o meu pastor!',
    ],
  },
  {
    id: 'h_firmemente',
    titulo: 'Firmemente Estaremos',
    artista: 'Tradicional',
    tom: 'C', bpm: 88, compasso: '4/4', categoria: 'Tradicional',
    tags: ['perseveranca', 'tradicional'],
    letra: [
      'Firmemente estaremos, de pe no nosso lugar,',
      'Com a verdade nos pousamos e o amor a nos ligar.',
    ],
    cifra: [
      '[Verso]',
      'C                       G',
      'Firmemente estaremos, de pe no nosso lugar,',
      'Am        F        C/G',
      'Com a verdade nos pousamos e o amor a nos ligar.',
      'F         C      Dm7      G',
      'A justica e o amor, alicates de paz,',
      'C        F        C',
      'A justica e o amor, que nunca mais tera fim.',
    ],
  },
  {
    id: 'h_mais_perto',
    titulo: 'Mais Perto Quero Estar',
    artista: 'Balm (1869)',
    tom: 'C', bpm: 64, compasso: '3/4', categoria: 'Tradicional',
    tags: ['devocional', 'classico', 'tradicional'],
    letra: [
      'Mais perto quero estar,',
      'Contigo, Senhor!',
      'E com teu Nome, oh, nao sei viver',
      'De outra maneira!',
    ],
    cifra: [
      '[Refrao]',
      'C       G/B     Am',
      'Mais perto quero estar,',
      'C/B      Am     F',
      'Contigo, Senhor!',
      'C       G/B     Am',
      'E com teu Nome, oh, nao sei viver',
      'F         C/G',
      'De outra maneira!',
    ],
  },
  {
    id: 'h_o_rei_vive',
    titulo: 'O Rei Vive',
    artista: 'Tradicional',
    tom: 'F', bpm: 84, compasso: '4/4', categoria: 'Tradicional',
    tags: ['ressurreicao', 'tradicional'],
    letra: [
      'O Rei vive! Sim, o Rei vive!',
      'E nao morri, nao, nao morreu!',
      'Esta tomba, mas esta de pe,',
      'O Rei vive!',
    ],
    cifra: [
      '[Refrao]',
      'F          C/E',
      'O Rei vive! Sim, o Rei vive!',
      'Dm        C     Bb',
      'E nao morri, nao, nao morreu!',
      'F            C',
      'Esta tomba, mas esta de pe,',
      'C     C/E    F',
      'O Rei vive!',
    ],
  },
  {
    id: 'h_tuas_maravilhas',
    titulo: 'Tuas Maravilhas',
    artista: 'Tradicional',
    tom: 'C', bpm: 78, compasso: '4/4', categoria: 'Tradicional',
    tags: ['devocional', 'tradicional'],
    letra: [
      'Tu que o amor plantaste',
    ],
    cifra: [
      '[Verso]',
      'C',
      'O seu amor',
    ],
  },
];

/* remove a entrada incompleta usada so como placeholder */
const LIMPAR = ['h_tuas_maravilhas'];
const FINAL = BASE.filter((h) => LIMPAR.indexOf(h.id) < 0);

/* ---------------- validação ---------------- */
let problemas = 0;
FINAL.forEach((h) => {
  const texto = h.cifra.join('\n');
  const chords = M.extractChords(texto);
  if (!chords.length) {
    console.log('  AVISO ' + h.id + ': nenhum acorde encontrado');
  }
  chords.forEach((c) => {
    if (!M.parseChord(c.text)) {
      console.log('  ERRO  ' + h.id + ': acorde invalido "' + c.text + '"');
      problemas++;
    }
  });
  // o tom declarado precisa existir como acorde
  if (h.tom && !M.parseChord(h.tom)) {
    console.log('  ERRO  ' + h.id + ': tom invalido "' + h.tom + '"');
    problemas++;
  }
  // detecta o tom
  const k = M.detectKey(texto);
  console.log('  ' + h.id.padEnd(20) + ' tom=' + h.tom.padEnd(4) +
    ' detectado=' + (k ? M.noteName(k.pc, M.useFlatsFor(k.pc)) + (k.mode === 'minor' ? 'm' : '') : '?') +
    '  acordes=' + chords.length);
});

if (problemas) {
  console.log('\n' + problemas + ' PROBLEMA(S). Arquivo nao gerado.');
  process.exit(1);
}

/* ---------------- gera o arquivo ---------------- */
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const linhas = [];
linhas.push('/* =========================================================');
linhas.push('   Acorde - data/base.js');
linhas.push('   Repertorio de referencia, para comecar.');
linhas.push('');
linhas.push('   ATENCAO: sao cifras de REFERENCIA, nao fonte oficial.');
linhas.push('   Versoes variam entre grupos e Published.');
linhas.push('   Confira sempre antes de usar. O app permite editar ou colar a sua.');
linhas.push('');
linhas.push('   Gerado por tools/build-base.js - nao editar a mao.');
linhas.push('   ========================================================= */');
linhas.push("(function (global) {");
linhas.push("  'use strict';");
linhas.push('');
linhas.push('  const LISTA = [');
FINAL.forEach((h) => {
  linhas.push('    {');
  linhas.push('      id: ' + q(h.id) + ',');
  linhas.push('      titulo: ' + q(h.titulo) + ',');
  linhas.push('      artista: ' + q(h.artista) + ',');
  linhas.push('      tom: ' + q(h.tom) + ',');
  linhas.push('      bpm: ' + JSON.stringify(h.bpm) + ',');
  linhas.push('      compasso: ' + q(h.compasso) + ',');
  linhas.push('      categoria: ' + q(h.categoria) + ',');
  linhas.push('      tags: ' + JSON.stringify(h.tags) + ',');
  linhas.push('      letra: [');
  h.letra.forEach((l) => linhas.push('        ' + q(l) + ','));
  linhas.push('      ].join(' + "'\\n'" + '),');
  linhas.push('      cifra: [');
  h.cifra.forEach((l) => linhas.push('        ' + q(l) + ','));
  linhas.push('      ].join(' + "'\\n'" + '),');
  linhas.push('    },');
});
linhas.push('  ];');
linhas.push('');
linhas.push("  global.BASE = { list: LISTA };");
linhas.push('  global.BASE.byId = function (id) {');
linhas.push('    return LISTA.find(function (h) { return h.id === id; }) || null;');
linhas.push('  };');
linhas.push("})(typeof window !== 'undefined' ? window : globalThis);");
linhas.push('');

const destino = path.join(__dirname, '..', 'js', 'data', 'base.js');
fs.writeFileSync(destino, linhas.join('\n'), 'utf8');
console.log('\nGerado: ' + destino + ' (' + FINAL.length + ' cifras)');
