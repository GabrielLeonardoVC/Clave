/* =========================================================
   tools/provar-ios.js
   Cada regra do check-ios tem que falhar com o defeito de volta.

   Um verificador que nunca falha e ignorado — e pior, e CREDITADO como se
   estivesse vigilando. Este arquivo reintroduz um defeito por vez e exige
   que o verificador acuse.

   Uso:  node tools/provar-ios.js

   ESTE ARQUIVO JA REPROVOU O VERIFICADOR

   Na primeira rodada, 8 das 16 regras NAO acusaram. Nao porque o verificador
   estivesse catching demais, e porque ele aceitava qualquer coisa:

     - tres regras olhavam "a string existe no arquivo", e a string aparecia
       no comentario que EXPLICAVA a regra;
     - uma regra procurava `navigator.share` e casava com o comentario que
       falava dele;
     - uma regra de safe-area aceitava qualquer uma das duas ocorrencias da
       propriedade, e apagar a errada passava;
     - uma regra de revogacao usava um padrao que nao atravessava a quebra de
       linha do corpo do `setTimeout`, entao nao casava nem com o codigo certo
       nem com o errado.

   Um verificador fraco nao e neutro: ele da a sensacao de que o iPhone esta
   cuidado enquanto ninguem esta olhando.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const VERIF = path.join(RAIZ, 'tools', 'check-ios.js');
const ZOOM = path.join(RAIZ, 'tools', 'check-ios-zoom.js');

const CRLF = '\r\n';

const ALVOS = {
  'index.html': path.join(RAIZ, 'index.html'),
  'manifest.webmanifest': path.join(RAIZ, 'manifest.webmanifest'),
  'css/features.css': path.join(RAIZ, 'css', 'features.css'),
  'css/components.css': path.join(RAIZ, 'css', 'components.css'),
  'css/base.css': path.join(RAIZ, 'css', 'base.css'),
  'js/core/utils.js': path.join(RAIZ, 'js', 'core', 'utils.js'),
  'js/core/ui.js': path.join(RAIZ, 'js', 'core', 'ui.js'),
  'js/views/ajustes.js': path.join(RAIZ, 'js', 'views', 'ajustes.js'),
  'js/core/armazenamento.js': path.join(RAIZ, 'js', 'core', 'armazenamento.js'),
  'js/app.js': path.join(RAIZ, 'js', 'app.js'),
  'js/core/store.js': path.join(RAIZ, 'js', 'core', 'store.js'),
};

const MUTACOES = [
  {
    nome: 'tirar o viewport-fit=cover',
    porque: 'Sem ele o safe-area vale zero e o topo fica sob a barra de status.',
    arquivo: 'index.html',
    de: 'initial-scale=1, viewport-fit=cover',
    para: 'initial-scale=1',
  },
  {
    nome: 'bloquear o zoom da pessoa',
    porque: 'Um app de cifra miuda precisa de zoom. Bloquear e barreira de acessibilidade.',
    arquivo: 'index.html',
    de: 'initial-scale=1, viewport-fit=cover',
    para: 'initial-scale=1, user-scalable=no, viewport-fit=cover',
  },
  {
    nome: 'tirar o apple-touch-icon',
    porque: 'O iOS usa este icone, e nao o do manifesto. Sem ele, mostra um recorte.',
    arquivo: 'index.html',
    de: '<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">',
    para: '<!-- sem icone -->',
  },
  {
    nome: 'deixar o iOS inflar a fonte',
    porque: 'Sem text-size-adjust, o Safari aumenta o texto ao girar e quebra o layout.',
    arquivo: 'css/base.css',
    de: '-webkit-text-size-adjust: 100%;',
    para: '/* sem text-size-adjust */',
  },
  {
    nome: 'tirar o safe-area de TODAS as barras de baixo',
    porque: 'O botao de navegacao fica sob o indicador do iPhone e nao recebe o toque.',
    arquivo: 'css/features.css',
    todos: true,
    de: 'padding-bottom: env(safe-area-inset-bottom);',
    para: 'padding-bottom: 0;',
  },
  {
    nome: 'usar 100vh como tela inteira',
    porque: 'No iOS, 100vh passa da tela visivel e o rodape some atras da barra.',
    arquivo: 'css/features.css',
    de: 'max-height: 420px;',
    para: 'max-height: 420px;' + CRLF + '  height: 100vh;',
  },
  {
    nome: 'tirar a rede de seguranca do seletor de arquivo',
    porque: 'Sem application/octet-stream, o iOS pode nao oferecer NENHUM arquivo (bug 279606).',
    arquivo: 'js/views/ajustes.js',
    de: "const ACEITE_BACKUP = '.json,application/json,application/octet-stream';",
    para: "const ACEITE_BACKUP = '.json,application/json';",
  },
  {
    nome: 'confiar no accept e nao filtrar no codigo',
    porque: 'Com octet-stream, qualquer arquivo passa. Sem a conferida, a pessoa escolhe a foto errada.',
    arquivo: 'js/views/ajustes.js',
    de: "if (!/\\.json$/i.test(f.name || '')) {",
    para: "if (false) {",
  },
  {
    nome: 'tirar a partilha nativa do iOS',
    porque: 'Sem navigator.share com arquivo, o iPhone so abre uma previa do backup.',
    arquivo: 'js/core/utils.js',
    de: 'return global.navigator.share({ files: [arquivo], title: filename || arquivo.name });',
    para: 'return Promise.resolve();',
  },
  {
    nome: 'revogar a URL do blob cedo',
    porque: 'revokeObjectURL em 100 ms corta o download pela metade.',
    arquivo: 'js/core/utils.js',
    de: '      }, 60000);',
    para: '      }, 100);',
  },
  {
    nome: 'gravar a data do backup antes da resposta',
    porque: 'Marcar antes da resposta e o que desligava o aviso de risco: o app declarava backup '
      + 'feito sem saber se o arquivo saiu.',
    arquivo: 'js/views/ajustes.js',
    de: "U.download('acorde-backup-' + hoje + '.json', S.exportar())" + CRLF + '      .then(function (r) {',
    para: 'marcarBackup();' + CRLF + "    U.download('acorde-backup-' + hoje + '.json', S.exportar())" + CRLF + '      .then(function (r) {',
  },
  {
    nome: 'tirar a confirmacao de quem guardou',
    porque: 'A partilha pode ser cancelada; sem perguntar, o app declara o que nao houve.',
    arquivo: 'js/views/ajustes.js',
    de: '          acao: function () {' + CRLF + '            marcarBackup();',
    para: '          semAcao: function () {' + CRLF + '            marcarBackup();',
  },
  {
    nome: 'chamar vibrate sem guardar',
    porque: 'No iOS navigator.vibrate nao existe: TypeError no primeiro toque.',
    arquivo: 'js/core/ui.js',
    de: 'if (navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) { /* ignora */ } }',
    para: 'navigator.vibrate(ms || 8);',
  },
  {
    nome: 'manifesto com display: browser',
    porque: 'Com browser, o icone da tela de inicio abre o Safari e o relogio de sete dias continua valendo.',
    arquivo: 'manifest.webmanifest',
    de: '"display": "standalone"',
    para: '"display": "browser"',
  },
  {
    nome: 'tirar o reconhecimento do WebKit',
    porque: 'Sem ele, o aviso de perda de dados nao aparece no aparelho que perde. (O '
      + 'comportamento da funcao e provado no test-armazenamento; aqui e o reconhecimento.)',
    arquivo: 'js/core/armazenamento.js',
    de: 'if (/iPhone|iPad|iPod/.test(ua)) return true;',
    para: 'if (false) return true;',
  },
  {
    nome: 'o app deixa de escutar a falha de gravacao',
    porque: 'Sem assinar "erro" e "cota", o Store avisa que a gravacao falhou e ninguem escuta: '
      + 'a pessoa ve o que digitou, fecha o app, e o nome nao estava em lugar nenhum.',
    arquivo: 'js/app.js',
    de: "      if (tipo === 'erro') { avisarFalhaAoSalvar('erro'); return; }" + CRLF
      + "      if (tipo === 'cota') { avisarFalhaAoSalvar('cota'); return; }" + CRLF,
    para: '',
  },
  {
    nome: 'a falha de gravacao vira evento sem frase',
    porque: 'Um evento sem frase e um evento que ninguem ve. Aqui a frase foi comentada, que e '
      + 'como um aviso "temporariamente" desligado sempre termina.',
    arquivo: 'js/app.js',
    de: "    UI.toast('Não consegui salvar agora.",
    para: "    // UI.toast('Não consegui salvar agora.",
  },
  {
    nome: 'o Store deixa de dizer a causa da falha',
    porque: '"Cheio" e "erro" pedem respostas diferentes, e sem a causa a tela nao sabe qual.',
    arquivo: 'js/core/store.js',
    de: 'ultimoErro: function () { return ultimoErro; },',
    para: '/* sem causa */',
  },
];

function rodar(qual) {
  try {
    return execFileSync(process.execPath, [qual], { encoding: 'utf8', cwd: RAIZ, timeout: 120000 });
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

const originais = {};
for (const k in ALVOS) originais[k] = fs.readFileSync(ALVOS[k], 'utf8');

function restaurarTudo() {
  for (const k in ALVOS) fs.writeFileSync(ALVOS[k], originais[k], 'utf8');
}

let falhas = 0;
console.log('\n=== o verificador de iOS acusa o defeito? ===\n');

for (const m of MUTACOES) {
  const alvo = ALVOS[m.arquivo];
  const orig = originais[m.arquivo];

  if (orig.indexOf(m.de) < 0) {
    console.log('  NAO ACHOU o trecho de "' + m.nome + '" em ' + m.arquivo);
    console.log('    (o arquivo mudou de forma; este provador precisa ser atualizado)');
    falhas++;
    continue;
  }

  const mod = m.todos ? orig.split(m.de).join(m.para) : orig.replace(m.de, m.para);
  fs.writeFileSync(alvo, mod, 'utf8');
  const saida = rodar(VERIF);
  const acusou = /FALHA/.test(saida);
  fs.writeFileSync(alvo, orig, 'utf8');

  console.log((acusou ? '  ok    ' : '  FALHA ') + m.nome);
  if (acusou) {
    for (const l of saida.split('\n').filter((x) => /FALHA/.test(x)).slice(0, 1)) {
      console.log('          ' + l.trim().slice(0, 96));
    }
  } else {
    console.log('          o verificador passou com o defeito presente');
    console.log('          ' + m.porque);
    falhas++;
  }
}

/* O verificador de zoom tambem tem que distinguir o defeito. */
console.log('\n=== o verificador de zoom distingue o conserto do defeito? ===\n');
{
  const comp = ALVOS['css/components.css'];
  const orig = originais['css/components.css'];
  const muts = [
    { nome: 'a media query antiga, por largura', de: '@media (hover: none) and (pointer: coarse) {', para: '@media (max-width: 480px) {' },
  ];
  for (const mut of muts) {
    if (orig.indexOf(mut.de) < 0) {
      console.log('  NAO ACHOU o trecho de "' + mut.nome + '"');
      falhas++;
      continue;
    }
    fs.writeFileSync(comp, orig.replace(mut.de, mut.para), 'utf8');
    const saida = rodar(ZOOM);
    const acusou = /ZOOMA/.test(saida);
    fs.writeFileSync(comp, orig, 'utf8');
    console.log((acusou ? '  ok    ' : '  FALHA ') + mut.nome);
    if (!acusou) {
      console.log('          o verificador de zoom passou com o defeito');
      falhas++;
    }
  }
}

restaurarTudo();

const total = MUTACOES.length + 1;
console.log('\n  ' + (total - falhas) + ' de ' + total + ' defeitos foram pegos de volta');
process.exit(falhas ? 1 : 0);
