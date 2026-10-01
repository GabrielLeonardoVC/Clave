/* =========================================================
   ACORDE - core/identidade.js
   O nome do app, em um lugar so.

   O nome aparecia espalhado por oito arquivos: o titulo da aba, o manifesto,
   a marca na barra, o texto do menu "Sobre", o prefixo do console, o cabecalho
   da notificacao de teste e o campo `app` do backup exportado. Trocar um nome
   significava nove edições, e errar uma delas deixaria a aba com um nome, o
   manifesto com outro e o backup com um terceiro — sem nenhum aviso, porque
   nenhum dos tres tem como saber o que o outro deveria dizer.

   Aqui o nome e declarado uma vez. O manifesto e o titulo da aba sao as duas
   unicas coisas que nao podem ler este arquivo — o manifesto e lido antes do
   JavaScript rodar, e o titulo precisa existir antes da primeira pintura. Por
   isso `tools/check-identidade.js` confere que os tres batem, e falha se
   divergirem.

   Trocar o nome do app e, hoje, trocar `NOME` aqui e rodar `npm run verificar`.
   ========================================================= */
(function (global) {
  'use strict';

  /* O nome.
   *
   * CLAVE e a clave 3-2 — os dois compassos que sustentam o ritmo de um
   * conjunto inteiro. Nao e enfeite: e a coisa que faz tres pessoas tocarem
   * junto sem combinar nada antes. E o que este app promete.
   *
   * E uma chave de entrada, que e a segunda razao. Todo mundo ouve a clave e
   * sabe onde comecar — e o app faz a mesma coisa com o tom: o botao que se
   * ouve, em todo lugar onde ha um tom.
   *
   * Cinco letras, duas silabas: cabe no icone do celular sem encolher. */
  const NOME = 'Clave';

  /* A linha completa. Aparece no titulo da aba e no manifesto, onde ha espaco
     para explicar o que o app e. */
  const COMPLETO = NOME + ' — escalas, cifras e ensaio';

  /* A frase de apresentacao, usada na pagina inicial. */
  const RESUMO = 'A mesa de trabalho de quem toca';

  /* A marca na barra e a versao minuscula, do jeito que o desenho pede.
     "clave" em minusculo, sem acento — e o desenho, nao e erro de escrita. */
  const MARCA = NOME.toLowerCase();

  global.Identidade = {
    NOME: NOME,
    COMPLETO: COMPLETO,
    RESUMO: RESUMO,
    MARCA: MARCA,
    /* O prefixo do console. Mensagem de erro nao precisa ser bonita, mas
       precisa dizer de qual app veio, quando duas abas do mesmo navegador
       estao abertas com versoes diferentes. */
    prefixo: function (onde) { return '[' + NOME + '] ' + (onde || ''); },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.Identidade;
})(typeof window !== 'undefined' ? window : globalThis);