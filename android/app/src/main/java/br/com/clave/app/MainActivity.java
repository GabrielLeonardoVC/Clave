package br.com.clave.app;

import android.os.Bundle;

import androidx.browser.customtabs.TrustedWebActivity;

/**
 * A tela unica do aplicativo.
 *
 * <p>Nao ha interface aqui, e isso e o ponto. Todo o app — cifras, escalas,
 * teoria, gravador, o violao 3D — vive no endereco declarado em
 * {@link #ENDERECO}. Aqui so se diz ao sistema: "abre essa janela, com a barra
 * escondida, e acompanha o dedo".
 *
 * <p>O que GANHA por estar dentro de uma janela do sistema, e nao no Chrome:
 *
 * <ul>
 *   <li>a barra de endereco some, e com ela a duvida de "estou no site ou no
 *       aplicativo?";</li>
 *   <li>os dados ficam no aparelho da pessoa, e nao no perfil do navegador —
 *       que e o que o Android so permite quando o aplicativo e de confianca;</li>
 *   <li>o botao voltar e o gesto de voltar do sistema;</li>
 *   <li>o compartilhamento usa o menu do sistema, com os aplicativos que a
 *       pessoa ja tem.</li>
 * </ul>
 *
 * <p>O que NAO acontece aqui, e vale escrever: nenhuma chamada de rede alem da
 * do endereco acima, nenhum rastreio, nenhum relatorio de erro, nenhum dado sai
 * do aparelho.
 *
 * <h2>Isto nao foi compilado</h2>
 *
 * <p>Nao ha Android SDK na maquina em que este arquivo foi escrito, e o
 * aplicativo nao foi gerado. Como nao da para compilar, este codigo se limita
 * as chamadas documentadas do {@link TrustedWebActivity} — {@code
 * setTrustedWebActivityLaunchUrl}, {@code setToolbarVisibility} e {@code
 * setDisplayScrollbarsEnabled} — em vez de tentar adivinhar assinatura de
 * metodo. Metodo inventado e erro que so aparece na hora de compilar, do
 * outro lado.
 *
 * <p>{@code check-twa.js} confere o que da para conferir sem compilar: que o
 * endereco bate com a origem do projeto, que o dominio do
 * {@code network_security_config.xml} e o certo, que o nome e o do app, e que
 * os icones existem.
 */
public class MainActivity extends TrustedWebActivity {

    /**
     * O endereco que este aplicativo abre.
     *
     * <p>Precisa ser o endereco COMPLETO, com o caminho. A raiz do dominio
     * {@code https://gabrielleonardovc.github.io/} nao e este aplicativo — e
     * outra pagina, ou uma pagina que nao existe.
     *
     * <p>{@code check-twa.js} compara esta constante com a origem declarada no
     * {@code README.md} e com o {@code start_url} do manifesto web. Se as tres
     * pararem de bater, o aplicativo abre a coisa errada — e o sintoma e um 404
     * dentro de um aplicativo que abriu certo, que e a pior combinacao.
     */
    private static final String ENDERECO = "https://gabrielleonardovc.github.io/Cifras-pro/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setTrustedWebActivityLaunchUrl(ENDERECO);

        /* A barra do navegador escondida. O aplicativo ja tem a propria
         * navegacao, com os botoes na base da tela — a barra em cima da
         * navegacao do app só rouba altura, e no ensaio, com o aparelho na coxa,
         * altura e o que mais incomoda. */
        setToolbarVisibility(android.view.View.GONE);

        /* Sem barra de rolagem. A rolagem existe, a barra enfeite nao, e a
         * largura dela empurra o conteudo a cada quadro de rolagem. */
        setDisplayScrollbarsEnabled(false);
    }
}