/* =========================================================
   ACORDE/CLAVE — android/

   O MESMO APP, NA LOJA DO ANDROID.

   POR QUE ISTO EXISTE

   O app e uma PWA: roda no navegador, guarda tudo no aparelho, e nao tem
   servidor nem conta. No iPhone isso e resolvido pelo Safari: "Adicionar a Tela
   de Inicio" e o proprio app instalado, com icone, tela cheia e os dados
   guardados no aparelho.

   No Android nao existe o equivalente no navegador. O Chrome instala um
   atalho que abre o Chrome — com a barra de endereco, sem os dados da loja, e
   com a chance de aparecer um aviso de "nao e um app". Quem usa muito no
   ensaio sente a diferenca: demora mais para abrir, e a lista de apps parece
   errada.

   O TWA (Trusted Web Activity) resolve. O app abre dentro de uma janela que o
   sistema controla, com icone da loja, e o conteudo vem do mesmo endereco do
   navegador. Sem reescrever nada, sem servidor novo, sem duplicar codigo.

   A CONFIANCA, E POR QUE ISSO NAO E UM ESCAPULGIO

   Um TWA mostra o seu site. O Android so aceita isso quando o site PROVA, na
   propria origem, que este aplicativo android e dono dele. A prova e o arquivo
   `assetlinks.json`, assinado com a chave do aplicativo.

   Sem essa prova o Android abre o site no Chrome, e o TWA nao vale nada. Por
   isso o `assetlinks.json` e a unica peca deste projeto que NAO pode ficar
   aqui: ele tem de ser colocado no endereco do site, na raiz do dominio, e a
   impressao digital so existe depois que a chave de assinatura do android e
   gerada. Ver `COMO-MONTAR.md` nesta pasta.

   O QUE ESTA AQUI E O QUE NAO ESTA

   Aqui esta tudo que nao depende de assinatura: o projeto Gradle, o manifesto
   e a Activity. Faltam duas coisas que so existem na sua maquina:

     1. a chave de assinatura (`upload-keystore.jks`), gerada por voce;
     2. a `impressao digital` SHA-256 dessa chave, que vai dentro do
        `assetlinks.json`.

   E isto nao foi compilado. Nao ha Android SDK nesta maquina, e afirmar que
   um `.apk` foi gerado aqui seria mentira. O que foi conferido e o que da
   para conferir sem compilar: que o manifesto aponta para o endereco certo, que
   o nome e o do app, e que os icones existem. Isso e `check-twa.js`, e ele roda
   em todo `npm run verificar`.
   ========================================================= */