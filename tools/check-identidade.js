/* =========================================================
   ACORDE - tools/check-identidade.js
   O nome do app esta igual em todos os lugares.

   Duas coisas nao podem ler `core/identidade.js`: o titulo da aba e o
   manifesto. O titulo precisa existir antes da primeira pintura, e o manifesto
   e lido antes de qualquer JavaScript rodar. Sao exatamente as duas que
   divergiriam em silencio se o nome fosse trocado e alguem esquecesse uma.

   E o modo de divergencia que importa: nao fica um aviso na tela. Fica uma aba
   chamada de uma coisa, um icone de outra e um backup exportado com um nome que
   nenhuma das duas corresponde — e o backup volta para um aparelho onde o app
   ja foi renomeado, sem ninguem notar ate procurar as contas.

   Verifica:
     1. o titulo da aba bate com `COMPLETO`;
     2. o `name` e o `short_name` do manifesto batem;
     3. a marca na barra bate com `MARCA`;
     4. a descricao do manifesto menciona o nome.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const I = require('../js/core/identidade.js');

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const manifesto = fs.readFileSync(path.join(RAIZ, 'manifest.webmanifest'), 'utf8');

let problemas = 0;
function conferir(ok, rotulo, obtido, esperado) {
  console.log((ok ? '  ok    ' : '  FALHA ') + rotulo);
  if (ok) return;
  problemas++;
  console.log('        obtido   ' + JSON.stringify(obtido));
  console.log('        esperado ' + JSON.stringify(esperado));
}

console.log('\n=== o nome do app em todos os lugares ===');
console.log('  ' + I.NOME + '  ·  ' + I.COMPLETO);

/* 1. o titulo da aba */
const titulo = /<title>([^<]*)<\/title>/.exec(html);
conferir(!!titulo && titulo[1] === I.COMPLETO,
  'o titulo da aba', titulo ? titulo[1] : '(sem title)', I.COMPLETO);

/* 2. o manifesto */
const nome = /"name"\s*:\s*"([^"]*)"/.exec(manifesto);
const curto = /"short_name"\s*:\s*"([^"]*)"/.exec(manifesto);
conferir(!!nome && nome[1] === I.COMPLETO,
  'o name do manifesto', nome ? nome[1] : '(sem name)', I.COMPLETO);
conferir(!!curto && curto[1] === I.NOME,
  'o short_name do manifesto', curto ? curto[1] : '(sem short_name)', I.NOME);

/* 3. a marca na barra */
const marca = /class="t1"[^>]*>([^<]*)</.exec(html);
conferir(!!marca && marca[1] === I.MARCA,
  'a marca na barra', marca ? marca[1] : '(sem .t1)', I.MARCA);

/* 3b. o texto alternativo do logo na barra.

   Sao dois lugares com o nome: o desenho tem o `aria-label` dele, e a barra tem
   o `alt` da imagem. O verificador conferia o primeiro e nao o segundo — e o
   `alt` e o que o leitor de tela anuncia quando a barra entra.

   A busca e feita DENTRO da barra, e nao no arquivo inteiro. Ha dois logos com
   o mesmo `src`: o da tela de abertura, decorativo e com `alt` vazio de
   proposito, e o da barra. Buscar pelo arquivo inteiro pegava o primeiro — o
   decorativo — e o verificador aprovava um `alt` vazio como se fosse o certo. */
const barra = /<div class="brandmark">([\s\S]*?)<div class="actions"/.exec(html);
const alt = barra ? /<img[^>]*alt="([^"]*)"/.exec(barra[1]) : null;
conferir(!!alt && alt[1] === I.NOME,
  'o alt do logo na barra', alt ? JSON.stringify(alt[1]) : '(sem .brandmark)', I.NOME);

/* 4. a descricao do manifesto cita o nome */
const descricao = /"description"\s*:\s*"([^"]*)"/.exec(manifesto);
conferir(!!descricao && descricao[1].indexOf(I.NOME) >= 0,
  'a descricao do manifesto cita o nome', descricao ? descricao[1] : '(sem)', I.NOME);

/* 5. o desenho, o calendario e o backup tambem carregam o nome */
const logo = fs.readFileSync(path.join(RAIZ, 'assets', 'logo.svg'), 'utf8');
const logoLabel = /aria-label="([^"]*)"/.exec(logo);
conferir(!!logoLabel && logoLabel[1] === I.NOME,
  'o aria-label do logo', logoLabel ? logoLabel[1] : '(sem)', I.NOME);

const share = fs.readFileSync(path.join(RAIZ, 'js', 'core', 'share.js'), 'utf8');
const prodid = /PRODID:[^'\n]*/.exec(share);
conferir(!!prodid && prodid[0].indexOf('//' + I.NOME + '//') >= 0,
  'o PRODID do calendario exportado', prodid ? prodid[0] : '(sem)', '//' + I.NOME + '//');

/* O titulo do evento que vai para o .ics e para o texto enviado. Sem isto o
   backup exportado teria o nome certo e o evento compartilhado outro — e o
   primeiro so e conferido por quem abre o arquivo, o segundo por quem recebe. */
const tituloIcs = /Repertório — ([^'*\n]*)/.exec(share);
conferir(!!tituloIcs && tituloIcs[1] === I.NOME,
  'o titulo do evento compartilhado', tituloIcs ? tituloIcs[1] : '(sem)', I.NOME);

const store = fs.readFileSync(path.join(RAIZ, 'js', 'core', 'store.js'), 'utf8');
/* O nome entra no backup exportado. A reserva (`: 'Acorde'`) e o que roda
   quando o modulo nao esta carregado — nos testes em Node, por exemplo. Se a
   reserva ficar com o nome velho, o backup gerado nos testes diz um app e o
   backup gerado no navegador diz outro. */
const reserva = /Identidade\.NOME\s*:\s*'([^']*)'/.exec(store);
conferir(!!reserva && reserva[1] === I.NOME,
  'a reserva do nome no backup', reserva ? reserva[1] : '(sem)', I.NOME);

/* 6. todo arquivo que DEVE carregar o nome carrega.

   O caminho inverso — procurar o nome antigo — so funciona na primeira troca.
   Depois do primeiro rename nao existe mais "o nome antigo" para procurar, e o
   verificador passa aa sem conferir nada. Por isso o teste e de PRESENCA:
   cada arquivo listado tem de conter o nome declarado.

   Um arquivo pode ter o nome duas vezes sem problema — o titulo e a descricao
   do manifesto, por exemplo. O que nao pode e faltar. */
const COM_NOME = [
  'index.html', 'manifest.webmanifest', 'assets/logo.svg', 'sw.js',
  'js/core/share.js', 'js/core/store.js', 'js/data/base.js',
];
const semNome = [];
for (const arq of COM_NOME) {
  const caminho = path.join(RAIZ, arq);
  if (!fs.existsSync(caminho)) { semNome.push(arq + ' (nao existe)'); continue; }
  const t = fs.readFileSync(caminho, 'utf8');
  // Sem diferenciar caixa: o cabecalho do `sw.js` escreve em maiuscula e o
  // nome do cache em minuscula, e as duas coisas precisam bater com o mesmo
  // nome. Verificar com caixa fixa acusaria os dois.
  if (t.toLowerCase().indexOf(I.NOME.toLowerCase()) < 0) semNome.push(arq);
}
conferir(!semNome.length,
  'todo arquivo que leva o nome leva o nome declarado',
  semNome.join(', ') || 'todos', 'todos');

/* 7. o desenho do icone tambem se chama pelo nome.
 *
   O verificador confere o `aria-label` do `logo.svg`, e nao do `icon-512.svg` —
   que sao dois arquivos com o mesmo desenho. O segundo estava com o nome antigo
   e ninguem olhava: o `logo.svg` estava certo, a tela de inicio estava certa, e
   o icone que o aparelho usa continuava se anunciando pelo nome que o app teve
   antes do rename.
 *
   E o mesmo furo que a regra 6 descreve, aplicado a um arquivo que ficou de
   fora da lista. Vale a pena porque o `aria-label` do icone e lido por leitor de
   tela na tela de inicio, que e um dos poucos lugares do aparelho onde a pessoa
   ainda nao esta dentro do app. */
const icone = path.join(RAIZ, 'assets', 'icon-512.svg');
if (fs.existsSync(icone)) {
  const r = /aria-label="([^"]*)"/.exec(fs.readFileSync(icone, 'utf8'));
  conferir(!!r && r[1] === I.NOME,
    'o aria-label do icone',
    r ? r[1] : '(sem)', I.NOME);
}

console.log('');
console.log('=================================================');
console.log(problemas
  ? problemas + ' lugar(es) divergem do nome declarado'
  : 'o nome bate em todos os lugares');
console.log('=================================================\n');

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
process.exit(problemas ? 1 : 0);