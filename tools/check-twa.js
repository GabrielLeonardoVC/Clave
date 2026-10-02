/* =========================================================
   tools/check-twa.js
   O aplicativo android aponta para o mesmo site que o navegador.

   POR QUE ISTE EXISTE

   O aplicativo android e uma janela que abre um endereco. Isso tem uma
  vantagem enorme — nao ha duas copias do app, e o que se conserta no navegador
   ja esta no aplicativo — e uma desvantagem silenciosa: se o endereco mudar de
   lugar e o TWA nao mudar junto, o aplicativo continua abrindo, sem erro, e
   mostrando a coisa errada.

   Os quatro jeitos de errar, e o que acontece em cada um:

     - o `start_url` do manifesto web muda e a Activity nao. O aplicativo abre
       a raiz do dominio, que nao e este app.
     - o dominio do `network_security_config.xml` fica desatualizado. O Android
       recusa a janela e cai no Chrome — o sintoma e "instalei e abriu o
       navegador", sem mensagem.
     - o `app_name` fica para tras quando o nome muda. O aplicativo entra na
       loja com um nome e abre com outro.
     - o icone some. O aplicativo fica sem icone e o proprio `check-icones.js`
       nem ve, porque ele so olha a pasta web.

   Nenhum dos quatro da erro, aviso ou log. Todos os quatro aparecem como "o
   aplicativo esta estranho", e ninguem sabe onde olhar.

   O QUE ISTO NAO VERIFICA

   Que o aplicativo COMPILA, e que a chave bate com o `assetlinks.json`. As duas
   coisas precisam do Android SDK e da sua chave. Aqui da para conferir o resto.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ANDROID = path.join(RAIZ, 'android');

let passou = 0;
let falhou = 0;
const problemas = [];
function ok(cond, titulo, porque) {
  if (cond) { passou++; console.log('  ok    ' + titulo); }
  else {
    falhou++;
    problemas.push(titulo);
    console.log('  FALHA ' + titulo);
    if (porque) console.log('        ' + porque);
  }
}
function secao(t) { console.log('\n=== ' + t + ' ==='); }

const existe = (p) => fs.existsSync(path.join(ANDROID, p));
const leia = (p) => fs.readFileSync(path.join(ANDROID, p), 'utf8');

/**
 * O arquivo sem o comentario.
 *
 * Estes arquivos do android explicam a regra que eles mesmos seguem — o
 * `network_security_config.xml` diz, em prosa, que `cleartextTrafficPermitted=
 * "false"` e o que exige HTTPS, e o `build.gradle` diz que nao ha SDK de
 * rastreio. A frase estava no arquivo.
 *
 * Uma regra que procura `cleartextTrafficPermitted="false"` achava a frase em
 * vez do atributo; uma mutacao que trocava o atributo por `true` mexia no
 * comentario e deixava o atributo quieto, e o verificador passava. O mesmo
 * com o nome do SDK: aparecia na explicacao de que ele nao existe.
 *
 * Verificar um arquivo que explica a regra, sem antes tirar a explicacao de
 * dentro, e o jeito de a regra passar a provar a frase que a justifica.
 */
function semComentario(txt) {
  return String(txt)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^.'"`])\/\/[^\n]*/g, '$1');
}

/* ------------------------------------------------------------------ */
secao('0. A pasta do aplicativo existe');

ok(fs.existsSync(ANDROID), 'a pasta android/ esta aqui',
  'sem ela o aplicativo nao foi montado');
if (!fs.existsSync(ANDROID)) {
  console.log('\n  0 passaram, 1 falharam\n');
  process.exit(1);
}

const ARQUIVOS = [
  'build.gradle',
  'settings.gradle',
  'gradle.properties',
  'app/build.gradle',
  'app/src/main/AndroidManifest.xml',
  'app/src/main/java/br/com/clave/app/MainActivity.java',
  'app/src/main/res/values/strings.xml',
  'app/src/main/res/xml/network_security_config.xml',
  'assetlinks.json',
  'COMO-MONTAR.md',
];
for (const arq of ARQUIVOS) ok(existe(arq), arq + ' esta no lugar');

/* ------------------------------------------------------------------ */
/* A ORIGEM DE VERDADE.                                                */
/*                                                                     */
/* O endereco do app esta em tres lugares e nenhum avisa sobre os outros:   */
/* o README (o que a pessoa le), o manifesto web (o que o navegador usa) e    */
/* o android (o que o TWA abre). A ordem de confianca e essa: o README       */
/* declara, o android segue.                                              */
/* ------------------------------------------------------------------ */
const readme = fs.readFileSync(path.join(RAIZ, 'README.md'), 'utf8');
const origemDoReadme = (readme.match(/https?:\/\/[^\s)>\]]+/g) || [])
  .find((u) => u.indexOf('github.io') >= 0);

ok(!!origemDoReadme, 'o README declara o endereco do app',
  'nenhuma URL de github.io encontrada — sem fonte de verdade para conferir');

const manifestoWeb = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.webmanifest'), 'utf8'));

if (origemDoReadme) {
  const u = new URL(origemDoReadme);
  const origem = u.origin;
  const caminho = u.pathname.replace(/\/*$/, '/');
  const enderecoCompleto = origem + caminho;

  console.log('');
  console.log('  endereco de verdade: ' + enderecoCompleto);
  console.log('  dominio:            ' + u.host);
  console.log('');

  /* ------------------------------------------------------------------ */
  secao('1. O aplicativo abre o endereco certo');

  const activity = leia('app/src/main/java/br/com/clave/app/MainActivity.java');
  const dentroDaActivity = activity.match(/"(https?:\/\/[^"]+)"/);

  ok(!!dentroDaActivity, 'a Activity declara um endereco');
  ok(dentroDaActivity && dentroDaActivity[1] === enderecoCompleto,
    'a Activity abre o endereco do projeto',
    dentroDaActivity ? 'abri ' + dentroDaActivity[1] : 'nao achou');

  /* O erro mais comum: deixar a raiz do dominio, que nao e este app. */
  ok(dentroDaActivity && dentroDaActivity[1] !== origem + '/',
    'e nao a raiz do dominio, que e outra pagina',
    dentroDaActivity ? 'abri ' + dentroDaActivity[1] : '');
  ok(dentroDaActivity && dentroDaActivity[1].indexOf(caminho) === origem.length,
    'e com o caminho do app junto',
    dentroDaActivity ? 'caminho ' + dentroDaActivity[1].substring(origem.length) : '');

  /* ------------------------------------------------------------------ */
  secao('2. O dominio autorizado bate com o endereco');

  /* Este e o arquivo que impede alguem que NAO tenha o site usar o nome do
   * aplicativo. Se ele divergir, o Android recusa a janela e cai no Chrome —
   * sem aviso nenhum, e o sintoma e "instalei e abriu o navegador". */
  const nscCrua = leia('app/src/main/res/xml/network_security_config.xml');
  const nsc = semComentario(nscCrua);
  const dominioNsc = (nsc.match(/<domain[^>]*>([^<]+)<\/domain>/) || [])[1];

  ok(!!dominioNsc, 'o network_security_config declara um dominio');
  ok(dominioNsc === u.host, 'o dominio e o do endereco do projeto',
    'tem ' + dominioNsc + ', o projeto esta em ' + u.host);

  ok(/cleartextTrafficPermitted="false"/.test(nsc),
    'e exige HTTPS: sem isso, um certificado vencido ainda abriria');
  ok(!/includeSubdomains="true"/.test(nsc),
    'e nao vale para subdominio alheio');

  /* ------------------------------------------------------------------ */
  secao('3. O manifesto android esta ligado a rede');

  const mf = leia('app/src/main/AndroidManifest.xml');

  ok(/androidx\.browser\.customtabs\.TrustedWebActivityService/.test(mf),
    'o manifesto declara o servico da janela do sistema',
    'sem ele o TWA abre o navegador comum por dentro');
  ok(/androidx\.browser\.customtabs\.trustedwebactivity/.test(mf),
    'e aponta para a configuracao de dominio',
    'sem este meta-data o android nao sabe qual endereco pode abrir');
  ok(/@xml\/network_security_config/.test(mf),
    'e o recurso apontado existe de verdade', existe('app/src/main/res/xml/network_security_config.xml') ? '' : 'nao existe');
  ok(/android\.permission\.INTERNET/.test(mf), 'e pede permissao de internet');
  ok(/android:exported="true"/.test(mf), 'e a Activity principal e exportada',
    'sem isso o icone da loja nao abre o aplicativo');

  /* ------------------------------------------------------------------ */
  secao('4. O nome do aplicativo e o mesmo nos tres lugares');

  /* Tres arquivos dizendo o mesmo nome, e nenhum avisa quando um fica para
   * tras. O aplicativo entra na loja com um nome e abre com outro. */
  const nomeWeb = manifestoWeb.short_name || manifestoWeb.name;
  const strings = leia('app/src/main/res/values/strings.xml');
  const nomeAndroid = (strings.match(/<string name="app_name">([^<]*)<\/string>/) || [])[1];

  let nomeIdentidade = null;
  try {
    const Identidade = require(path.join(RAIZ, 'js', 'core', 'identidade.js'));
    nomeIdentidade = Identidade.NOME || (Identidade.NOME_COMPLETO || '').split('—')[0].trim();
  } catch (e) { /* sem o modulo, segue com dois */ }

  ok(!!nomeAndroid, 'o android tem nome de aplicacao');
  ok(nomeAndroid === nomeWeb, 'o nome do android e o do manifesto web',
    nomeAndroid + ' contra ' + nomeWeb);
  if (nomeIdentidade) {
    ok(nomeAndroid === nomeIdentidade || (nomeWeb || '').indexOf(nomeIdentidade) >= 0,
      'e o do modulo de identidade',
      nomeAndroid + ' contra ' + nomeIdentidade);
  }

  /* ------------------------------------------------------------------ */
  secao('5. O icone existe dos dois lados');

  /* O `check-icones.js` olha so a pasta web. Um icone que falta no android
   * deixa o aplicativo sem icone na loja, e nenhum verificador do projeto
   *nada disso. */
  const drawable = 'app/src/main/res/drawable/ic_launcher.png';
  const icones = manifestoWeb.icons || [];
  const tem512 = icones.some((i) => /512/.test(i.sizes || ''));
  const tem192 = icones.some((i) => /192/.test(i.sizes || ''));

  ok(tem192 && tem512, 'o manifesto web tem icone de 192 e de 512');
  ok(existe(drawable), 'o icone que o manifesto android aponta existe',
    'faltou ' + drawable + ' — copie o PNG de 512 da pasta assets para ai');
  ok(/@drawable\/ic_launcher/.test(mf), 'e o manifesto android aponta para ele');

  /* ------------------------------------------------------------------ */
  secao('6. A prova de propriedade esta preparada');

  /* O `assetlinks.json` e a peca que so pode ser feita na maquina da pessoa.
   * Aqui so se verifica que o molde esta no lugar e que os dois `TODO` ainda
   * estao la — um arquivo com a impressao digital preenchida no repositorio
   * seria a chave de outra pessoa. */
  const al = JSON.parse(leia('assetlinks.json'));
  const entrada = (al.aplicativos || [])[0] || {};

  ok(!!entrada.package_name, 'o assetlinks declara o pacote');
  ok(entrada.package_name === 'br.com.clave.app', 'e o pacote bate com o do Gradle',
    entrada.package_name + ' contra br.com.clave.app');
  ok(Array.isArray(entrada.sha256_cert_fingerprints) && entrada.sha256_cert_fingerprints.length > 0,
    'e tem lugar para a impressao digital');

  /* A IMPRESSAO DIGITAL TEM DE ESTAR VAZIA.
   *
   * A regra anterior perguntava se ainda havia um `TODO` no arquivo. Isso
   * detectava metade dos casos e deixava passar a outra metade: preenchendo so
   * a origem, o `TODO` da impressao continuava ali e o verificador dizia "ainda
   * esta vazio". O que importa nao e a ausencia da palavra `TODO` — e que o
   * campo da impressao digital nao tenha cara de impressao digital.
   *
   * E por que isso importa tanto: a chave de assinatura e o que impede
   * alguem de gerar um aplicativo com o nome deste e oferecer uma versao falsa
   * para quem tem o Clave instalado. Uma impressao digital no repositorio e a
   * chave de outra pessoa versionada. */
  const BR2 = String.fromCharCode(92);
  void BR2;
  const digital = (entrada.sha256_cert_fingerprints || []).join(' ');
  const pareceDigital = /(^|[^0-9A-Fa-f])[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){20,}([^0-9A-Fa-f]|$)/.test(digital);
  ok(!pareceDigital,
    'a impressao digital do assetlinks NAO esta preenchida',
    pareceDigital ? 'a chave de outra pessoa esta no repositorio' : '');

  /* E o passo a passo tem de dizer onde o arquivo vai. O erro de colocar em
   * `/Cifras-pro/.well-known/` em vez de na raiz do dominio e o mais comum, e o
   * sintoma e "instalei e abriu no navegador", sem mensagem. */
  const doc = leia('COMO-MONTAR.md');
  ok(doc.indexOf('.well-known/assetlinks.json') >= 0,
    'e o passo a passo diz onde o arquivo tem que ser colocado',
    'o caminho da prova e a raiz do dominio, e nao a pasta do projeto');
  ok(doc.indexOf('keytool -list') >= 0, 'e diz como obter a impressao digital');
  /* O aviso precisa estar no passo a passo E no .gitignore. Uma chave de
   * assinatura versionada e uma chave publica — quem le isso e pode gerar um
   * aplicativo com este nome. */
  ok(/chave\s+(nao|n[aã]o)\s+entra\s+no\s+git|nunca deve estar/i.test(doc),
    'e avisa, no passo a passo, que a chave nao entra no git');

  const gitignore = fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8');
  ok(gitignore.indexOf('*.jks') >= 0 && gitignore.indexOf('*.keystore') >= 0,
    'e o .gitignore bloqueia o arquivo de chave',
    'sem isso, um `gradlew assembleRelease` deixa a chave pronta para ser commitada por engano');


  /* ------------------------------------------------------------------ */
  secao('7. Nada de servidor dentro do aplicativo');

  /* O aplicativo e uma janela. Se ele ganhar uma chamada de rede que nao seja
   * a do endereco acima, alguem passou a olhar o que a pessoa toca. */
  const java = activity;
  ok(!/https?:\/\/(?!gabrielleonardovc\.github\.io)/.test(java),
    'a Activity nao menciona nenhum outro endereco',
    'so o endereco do app pode aparecer aqui');

  /* O nome dos SDKs e procurado no codigo SEM COMENTARIO — ver
   * `semComentario` no topo deste arquivo: a explicacao de que eles nao
   * existem estava no proprio `build.gradle`, e a regra achava a frase em
   * vez do codigo. */
  const gradle = semComentario(leia('app/build.gradle'));
  const manifestoAndroid = semComentario(mf);
  ok(!/analytics|firebase|sentry|crashlytics|umeng|appboy/i.test(gradle + java + manifestoAndroid),
    'e o projeto nao tem SDK de rastreio nem de relato de erro');
  ok(!/uses-permission[^"]*"(android\.permission\.(CAMERA|RECORD_AUDIO|ACCESS_FINE_LOCATION|READ_EXTERNAL_STORAGE))/
    .test(mf),
    'e nao pede permissao alem de internet',
    'o que o app usa ja e publico da web');
}

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(54));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  Nenhum destes quatro erros da aviso, log ou tela. Todos aparecem');
  console.log('  como "o aplicativo esta estranho", e ninguem sabe onde olhar.');
  for (const p of problemas) console.log('    - ' + p);
}
console.log('='.repeat(54) + '\n');
process.exit(falhou ? 1 : 0);