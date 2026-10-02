/* Prova que o check-twa pega o que ele diz pegar.
 *
 * O risco deste verificador e ser decorativo: um TWA que aponta para o
 * endereco errado abre, mostra 404, e nada reclama. Se o verificador nao olha
 * a coisa certa, ele passa com um aplicativo que aponta para o sitio errado —
 * que e o mesmo que nao ter o verificador, so que com mais confianca.
 *
 * Cada mutacao abaixo muda UM dos quatro jeitos de errar que nao dao aviso.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ANDROID = path.join(RAIZ, 'android');
const VERIF = path.join(__dirname, 'check-twa.js');
const NL = String.fromCharCode(10);

const ALVOS = {
  'app/src/main/java/br/com/clave/app/MainActivity.java':
    path.join(ANDROID, 'app/src/main/java/br/com/clave/app/MainActivity.java'),
  'app/src/main/res/xml/network_security_config.xml':
    path.join(ANDROID, 'app/src/main/res/xml/network_security_config.xml'),
  'app/src/main/AndroidManifest.xml': path.join(ANDROID, 'app/src/main/AndroidManifest.xml'),
  'app/src/main/res/values/strings.xml': path.join(ANDROID, 'app/src/main/res/values/strings.xml'),
  'assetlinks.json': path.join(ANDROID, 'assetlinks.json'),
  'app/build.gradle': path.join(ANDROID, 'app/build.gradle'),
};

const originais = {};
for (const rel of Object.keys(ALVOS)) originais[rel] = fs.readFileSync(ALVOS[rel], 'utf8');

const MUTACOES = [
  {
    nome: 'a Activity aponta para outro site',
    rel: 'app/src/main/java/br/com/clave/app/MainActivity.java',
    de: '"https://gabrielleonardovc.github.io/Cifras-pro/"',
    para: '"https://exemplo.com/Clave/"',
  },
  {
    nome: 'a Activity abre a raiz do dominio, e nao o app',
    rel: 'app/src/main/java/br/com/clave/app/MainActivity.java',
    de: '"https://gabrielleonardovc.github.io/Cifras-pro/"',
    para: '"https://gabrielleonardovc.github.io/"',
  },
  {
    nome: 'o dominio autorizado e de outra pessoa',
    rel: 'app/src/main/res/xml/network_security_config.xml',
    de: 'gabrielleonardovc.github.io',
    para: 'exemplo.com',
  },
  {
    nome: 'o android aceitou HTTP, e certificado vencido ainda abriria',
    rel: 'app/src/main/res/xml/network_security_config.xml',
    de: '<domain-config cleartextTrafficPermitted="false">',
    para: '<domain-config cleartextTrafficPermitted="true">',
  },
  {
    nome: 'o dominio passou a valer para subdominio alheio',
    rel: 'app/src/main/res/xml/network_security_config.xml',
    de: '<domain includeSubdomains="false">',
    para: '<domain includeSubdomains="true">',
  },
  {
    nome: 'o manifesto android parou de declarar o servico da janela',
    rel: 'app/src/main/AndroidManifest.xml',
    de: 'androidx.browser.customtabs.TrustedWebActivityService',
    para: 'androidx.browser.customtabs.CustomTabsService',
  },
  {
    nome: 'o meta-data do dominio sumiu',
    rel: 'app/src/main/AndroidManifest.xml',
    de: 'androidx.browser.customtabs.trustedwebactivity',
    para: 'androidx.browser.customtabs.qualquer.coisa',
  },
  {
    nome: 'a Activity deixou de ser exportada',
    rel: 'app/src/main/AndroidManifest.xml',
    de: 'android:exported="true"',
    para: 'android:exported="false"',
  },
  {
    nome: 'o nome do aplicativo na loja ficou diferente do app',
    rel: 'app/src/main/res/values/strings.xml',
    de: '<string name="app_name">Clave</string>',
    para: '<string name="app_name">Outro Nome</string>',
  },
  {
    nome: 'o pacote do assetlinks nao bate com o do Gradle',
    rel: 'assetlinks.json',
    de: '"package_name": "br.com.clave.app"',
    para: '"package_name": "br.com.outra.coisa"',
  },
  {
    /* NAO existe uma mutacao para o campo `origem`. Preenche-lo com a URL real
     * e o CERTO: ele existe justamente para ser substituido, e a origem do
     * aplicativo e publica. So a impressao digital e secreta, e e a unica que
     * tem regra.
     *
     * Havia aqui uma mutacao que trocava o `TODO` da origem pela URL, e ela
     * "falhou" — porque o verificador estava certo em nao se importar. Uma
     * mutacao que acusa codigo certo e mutacao ruim: ela treina o provador a
     * procurar defeito onde nao ha. */
    nome: 'a impressao digital de outra pessoa foi para o repositorio',
    rel: 'assetlinks.json',
    de: '"TODO: a impressão digital SHA-256 da sua chave de assinatura"',
    para: '"AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"',
  },
  {
    nome: 'entrou um SDK de rastreio no aplicativo',
    rel: 'app/build.gradle',
    de: "implementation 'androidx.browser:browser:1.8.0'",
    para: "implementation 'androidx.browser:browser:1.8.0'\n    implementation 'com.google.firebase:firebase-analytics'",
  },
];

function rodar() {
  try {
    const saida = execFileSync(process.execPath, [VERIF], { encoding: 'utf8', cwd: RAIZ, timeout: 180000 });
    return { saida: saida, caiu: false, quebrou: false };
  } catch (e) {
    const texto = (e.stdout || '') + (e.stderr || '');
    const quebrou = /TypeError|ReferenceError|SyntaxError|Invalid regular expression|JSON/.test(texto);
    return { saida: texto, caiu: true, quebrou: quebrou };
  }
}

function restaurar() {
  for (const rel of Object.keys(ALVOS)) fs.writeFileSync(ALVOS[rel], originais[rel], 'utf8');
}

let falhas = 0;
console.log('\n=== o verificador do TWA pega o defeito? ===\n');

for (const m of MUTACOES) {
  const base = originais[m.rel];
  const achadas = base.split(m.de).length - 1;
  if (achadas !== 1) {
    console.log('  FALHA ' + m.nome);
    console.log('          o trecho aparece ' + achadas + ' vez(es), e o provador espera 1.');
    console.log('          procurava: ' + JSON.stringify(m.de.slice(0, 70)));
    falhas++;
    continue;
  }

  fs.writeFileSync(ALVOS[m.rel], base.split(m.de).join(m.para), 'utf8');
  const r = rodar();
  restaurar();

  if (r.quebrou) {
    console.log('  FALHA ' + m.nome);
    console.log('          o verificador QUEBROU em vez de reprovar.');
    falhas++;
    continue;
  }

  const acusou = /FALHA/.test(r.saida);
  console.log((acusou ? '  ok    ' : '  FALHA ') + m.nome);
  if (!acusou) {
    console.log('          o verificador passou com o defeito instalado');
    falhas++;
  } else {
    for (const l of r.saida.split(NL)) {
      if (/FALHA/.test(l) && l.indexOf('    - ') < 0) {
        console.log('          ' + l.trim().slice(0, 92));
        break;
      }
    }
  }
}

restaurar();
let voltou = true;
for (const rel of Object.keys(ALVOS)) {
  if (fs.readFileSync(ALVOS[rel], 'utf8') !== originais[rel]) voltou = false;
}
console.log('\n  ' + (voltou ? 'ok    ' : 'FALHA ') + 'os arquivos voltaram ao estado original');
if (!voltou) falhas++;

const limpo = rodar();
const passou = !limpo.caiu && !/FALHA/.test(limpo.saida);
console.log((passou ? '  ok    ' : '  FALHA ') + 'e, sem nenhum defeito, o verificador passa');
if (!passou) falhas++;

console.log('\n  ' + (MUTACOES.length + 2 - falhas) + ' de ' + (MUTACOES.length + 2)
  + ' se comportaram como deviam');
process.exit(falhas ? 1 : 0);