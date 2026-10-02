# Como montar o aplicativo android

Tudo o que esta aqui roda sem compilar. As duas coisas que faltam precisam da
sua maquina e da sua chave — e nenhuma delas pode ficar neste repositorio.

## 1. Instalar o que compila

Android Studio, ou so a linha de comando:

    # No Windows, com o Android SDK instalado e no PATH:
    cd android
    gradlew.bat assembleDebug

O `.apk` sai em `android/app/build/outputs/apk/debug/`.

## 2. Criar a chave de assinatura

**A chave nao entra no git.** Uma chave de assinatura versionada e uma chave
publica: com ela qualquer um gera um aplicativo com o mesmo nome, e pode
oferecer uma versao falsa para quem tem o Clave instalado. Um `.jks` no git
vaza do mesmo jeito que uma senha.

    keytool -genkeypair -v \
      -keystore minha-chave.jks \
      -alias clave \
      -keyalg RSA -keysize 2048 -validity 10000

Guarde a senha em algum lugar. Sem ela a chave e inutil, e a chave e a unica
coisa que impede alguem de falsificar o aplicativo. Faca uma copia em dois
lugares: perder a chave e perder o direito de atualizar o aplicativo na loja.

## 3. A impressão digital

O android precisa dizer ao site "eu sou eu", e isso sai da chave:

    keytool -list -v \
      -keystore minha-chave.jks \
      -alias clave | grep SHA256

Copie o que vier depois de `SHA256:`. Sao os dois pontos no meio e nao no fim —
esse detalhe quebra a prova silenciosamente, e o sintoma e o TWA cair no Chrome
com o aplicativo instalado, sem mensagem nenhuma.

## 4. Colocar a prova no endereco

Abra `android/assetlinks.json`, troque os dois `TODO` e **suba o arquivo para a
RAIZ do dominio**:

    https://gabrielleonardovc.github.io/.well-known/assetlinks.json

Repare: na raiz do dominio, e nao dentro de `/Cifras-pro/`. O android procura
exatamente ai. A pasta `.well-known` comeca com ponto — no GitHub Pages ela
precisa de um arquivo vazio chamado `.nojekyll` na raiz, e ja existe um neste
projeto, entao isso ja esta resolvido.

Para conferir se a prova esta no lugar:

    curl -s https://gabrielleonardovc.github.io/.well-known/assetlinks.json

Um `404` aqui e a unica causa de "instalei e abriu no navegador".

## 5. Assinar e publicar

    gradlew.bat bundleRelease

O arquivo em `app/build/outputs/bundle/release/` vai para a Play Console.

Antes disso, confira o que da para conferir sem compilar:

    npm run verificar        # inclui check:twa

Ele nao valida o aplicativo compilado. Valida o endereco, o dominio, o nome e os
icones — que sao as quatro coisas que ficam erradas em silencio.

## O que este projeto nao faz no android

- **Sem SDK de anuncio.** Um aplicativo de loja e instalado roda codigo de
  terceiros no aparelho da pessoa. Zero dependencia.
- **Sem analytics nem relato de erro.** Nao ha para onde enviar.
- **Sem permissao alem de internet.** Nada de microfone, camera, local ou
  arquivos. O que o app usa ja e publico da web.
- **Sem servidor.** Os dados continuam no aparelho, como na versao web. A loja
  nao muda nada disso — e nao deve: se o servidor aparecesse, apareceria
  junto a conta, e o app nao tem nem uma.