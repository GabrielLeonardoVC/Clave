# CifraCeleste

Cifras, escalas e teoria musical para músicos ao vivo. Feito para quem toca na
missa com o celular na mão, com a banda esperando e o tom errado na hora.

Funciona offline, não manda nada para servidor nenhum, e os dados ficam no
próprio aparelho.

---

## O que ele faz

**Repertório.** Guarde as cifras que você usa sempre. Cole do Cifra Club, do
WhatsApp ou de onde vier: os acordes são reconhecidos sozinhos e ficam alinhados
com a letra.

**Transposição.** Meio tom para cima, meio tom para baixo, ou o tom exato que
você escolher. Escolher o tom certo importa mais do que parece — ver
[Transposição](#transposição).

**Clicar toca.** Cada acorde na cifra é clicável e soa na hora, com o grave uma
oitava abaixo para dar peso.

**Modo Estúdio.** Só a cifra e o essencial. Sem menu, sem rodapé, sem nada
chamando atenção. Com rolagem automática de velocidade ajustável.

**Missas.** Agenda com missas, ensaios e shows, cada um com a sua lista de
músicas, responsável, andamento e local.

**Lembretes.** Aviso com **horas e minutos exatos**: a missa é às 19h30 e você
quer ser avisado às 18h30, não "daqui a duas horas".

**Metrônomo e voz.** Batida com ajuste fino, tap tempo, quatro timbres. E um
gravador: cante os trinta segundos do início, grave, e depois é só apertar
play para lembrar o tom e a frase.

**Emergência.** Um botão vermelho, sempre visível, com três coisas para o
momento em que a banda está esperando:

- **Buscar** — a mesma busca tolerante a erro de digitação, sem sair do lugar
- **Calcular tom** — o que aquele acorde é, em qualquer tom
- **Colar cifra** — colou de outro grupo? Transpõe na hora e salva no repertório

**Teoria.** Acordes com as notas de cada um, 16 escalas e modos, diagrama do
teclado e do braço do violão, círculo das quintas. Tudo clicável e audível.

---

## Rodando

```bash
npm install
npm run dev        # desenvolvimento, em http://127.0.0.1:5180
npm run build      # gera a pasta dist/
npm run preview    # serve o dist para conferir
npm test           # 112 testes
npm run typecheck  # TypeScript em modo estrito
```

Requer Node 18 ou mais novo. Não há servidor de dados: tudo roda no navegador.

---

## Decisões que valem explicação

### A regra que não pode quebrar: nunca escrever C♭ nem E♯

Transposição ingênua pega o número da altura, soma os semitons e escolhe a
letra ao acaso. Aí aparecem `Cb`, `E#`, `Fb`, `B#` — coisas que nenhum músico
escreve, e que ele vai ter que traduzir de cabeça tocante.

O motor decide a grafia **antes** de transpor, nesta ordem:

1. Tem tom de destino? Usa a armadura desse tom.
2. A nota de origem tem acidente? Segue o sentido do acidente.
   - `Db` tem bemol, então desce para `C`, e não para `Cb`
   - `Eb` tem bemol, então sobe para `E`, e não para `E#`
3. Nota natural subindo? Prefere sustenido: `F +1 = F#`
4. Nota natural descendo? Prefere bemol: `F −1 = E`

Junto com a regra de que **menos alterações vence** em `spellNote`, isso
torna impossível qualquer uma das 12 alturas assumir duplo acidente. Há um
teste que varre as 12 alturas por 24 semitons e falha se aparecer `Cb`, `E#`,
`Fb`, `B#`, `##` ou `bb`.

### Transposição: meio tom e tom exato são operações diferentes

Os botões de meio tom aplicam um número fixo de semitons. Simples, previsível,
é o que o músico quer quando a soprano subiu meio tom.

O seletor de tom exato faz outra coisa: **reatribui os graus da escala**. A
razão é uma armadilha que todo app cai:

> Dó maior e Lá menor têm a mesma armadura. Levar uma música de uma para a
> outra **não** é um deslocamento de semitons.

Deslocar 9 semitons leva o acorde de Dó para Lá — correto. Mas leva o `Am` de
Dó maior para `F#`, e o certo em Lá menor é `C`. Não há número de semitons que
acerte os dois, porque os graus não coincidem. Só a reatribuição acerta.

O motor ainda cuida de dois casos especiais:

- **Acorde emprestado.** O `F#7` não é diatônico em Dó maior, mas é o sexto
  grau legítimo de Sol maior. Ele fica onde está, em vez de virar `C#7`.
- **Inversão preservada.** `C/G` vira `G/D` — o que se mantém é a inversão, a
  quinta no baixo, e não a nota.

### Letra nunca vira acorde

Este é o defeito mais comum de app de cifra, e o mais irritante na hora do
ensaio. Decidir se o `e` de *"e o meu pastor"* é o acorde Mi ou a conjunção
"e", e se o `do` de *"do Senhor"* é Ré diminuto ou a preposição.

A estratégia tem três camadas:

1. **O padrão de acorde exige um terminador.** `Amém` não casa, porque depois
   de `Am` vem `é`, que é letra. `Composição` não casa pelo mesmo motivo.
   `Cmin7` só casa como `min7`, e não como `min` com um `7` sobrando.
2. **Palavras que colidem com notação musical são letra, sempre.** Na dúvida,
   a letra ganha.
3. **Linha com zero acordes inequívocos é letra, sem exceção.** E, dentro de
   uma linha com letra, um acorde em minúscula é rebaixado a palavra — em
   toda cifra publicada a fundamental do acorde é maiúscula.

Há treze linhas de letra no conjunto de testes que já enganaram algum app
(`O Senhor e o meu pastor`, `Amém`, `Da glória à vitória`, `do céu desce`,
`Emanuel, Emanuel`…), todas classificadas corretamente como letra.

### Busca que acha a música com o nome meio errado

Músico digitando no celular erra uma letra com frequência. Busca que exige
grafia exata falha justamente no momento em que mais importa.

Para cada palavra digitada, procura-se o melhor casamento, do mais forte para
o mais fraco: igual, começa com, início de palavra, dentro de, subquência
(`sr` acha *Senhor*), erro de digitação. Todos os termos precisam casar, então
`preziosa graça` não traz as músicas só de *graça*.

Acontece no **teclado**: trocar de lado as letras vizinhas conta como um erro
só, não dois.

Desempenho medido, fora do runner de teste:

| Repertório | Por busca |
|---|---|
| 300 músicas (realista) | **2,1 ms** |
| 2.000 músicas | 9,3 ms |
| 5.000 músicas | 25,7 ms |

O índice é construído uma vez e guardado num `WeakMap`, invalidado quando o
conteúdo da música muda. Sem isso, cada tecla digitada refazia a normalização
de todos os campos de todas as músicas: quase 300 ms com cinco mil itens, e um
solavanco visível na primeira tecla — a mais perceptível de todas.

### Tema escuro sem piscar

O script inline no `<head>` do `index.html` aplica a classe `dark` e a cor de
fundo do `<html>` **antes da primeira pintura**. Se isso rodar depois do
React, o usuário vê um flash branco — que é justamente o defeito que o projeto
precisa evitar.

No escuro, o fundo é cinza chumbo azulado (`rgb(20 23 28)`), não preto puro.
No claro, é papel quente (`rgb(250 249 247)`), não branco. Os dois têm
contraste acima de 7:1 com o texto.

A transição de cor só entra depois da classe ser aplicada, senão o navegador
pinta o tema novo uma vez sem transição e outra com.

### Movimento reduzido não pode esconder a tela

Este foi o defeito mais grave encontrado na verificação, e é o tipo de coisa
que só aparece com o navegador aberto.

Ao respeitar `prefers-reduced-motion`, encurtar a animação para 0,01 ms **não**
a cancela. Com `fill-mode: both`, o elemento fica preso no estado inicial — e
como a entrada de tela anima de `opacity: 0`, **a tela inteira desaparecia**
para quem pede menos movimento, sem nenhum erro no console.

A correção é desligar a animação e declarar o estado final:

```css
@media (prefers-reduced-motion: reduce) {
  .tela-entra {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

Há um teste de regressão para isso em `src/index.test.ts`, e ele foi
verificado: reintroduzir o defeito faz o teste falhar.

### A entrada é CSS, não biblioteca

A animação de biblioteca depende do ciclo de medição do navegador para saber
quando começou. Se ela não rodar, o elemento fica em `opacity: 0` para sempre.
Aconteceu três vezes, em três lugares:

- a troca de tela parou de funcionar e as telas ficaram invisíveis
- o painel de emergência fechava mas continuava no DOM
- **o aviso de confirmação nunca aparecia** — o usuário salvava a música e não
  tinha como saber que tinha dado certo

O terceiro é o mais grave, e o mais difícil de achar: nada quebra, nada
reclama no console, e a tela funciona perfeitamente. Falta só o retorno.

Uma animação CSS declarada no arquivo roda na primeira pintura, sem depender
de nada, e se falhar o conteúdo continua visível. As sobreposições não
dependem de animação de biblioteca para **existir**: entram por CSS e saem na
hora. Quem fecha um painel quer que ele suma, não uma animação de despedida.

Só o `whileTap` dos cartões ainda usa a biblioteca, que nesse caso é só um
detalhe tátil e não mexe em visibilidade.

### Sobreposições saem por portal

Um `z-index` alto não basta. A animação de troca de tela aplica `transform` no
contentor, e isso cria um contexto de empilhamento que prende o `z-index` da
cifra dentro dele — o resultado é a barra de navegação e o botão de emergência
continuando clicáveis por cima.

O painel passa por portal para o `body`, onde compete direto com a navegação.

E as sobreposições não dependem de animação de biblioteca para **existir**.
Isso já custou dois defeitos: o painel de emergência ficava no DOM depois de
fechado, e o botão flutuante ficava invisível quando a animação não rodava. A
entrada é CSS; a saída não é necessária, porque quem fecha o painel quer que
ele suma.

### Nada de evento órfão

Houve um botão que emitia um evento global e **ninguém escutava**: o clique
não produzia efeito nenhum, e o defeito só aparecia ao usar. Um evento sem
ouvinte é botão morto.

No lugar, um controlador exposto (`src/lib/emergencia.ts`). Se o nome mudar, o
compilador reclama — e o botão quebrado não chega em produção.

---

## Estrutura

```
src/
  lib/
    music/
      notes.ts            alturas, grafia, armadura
      chords.ts           45 qualidades, leitura e escrita
      smartParser.ts      separa acorde de letra
      keyDetection.ts     tom por perfil de Krumhansl-Schmuckler
      chordTransposer.ts  o motor de transposição
      scales.ts           16 escalas e modos
      transGrau.ts        reatribuição por grau da escala
    searchLogic.ts        busca tolerante a erro
    store.ts              estado e persistência
    audio.ts              acordes, notas e metrônomo
    recorder.ts           gravação e IndexedDB
    notify.ts             lembretes
    router.ts             navegação por hash
    emergencia.ts         controle do painel flutuante
    pwa.ts                instalação e service worker
    helpers.ts            utilidades de formatação
    useDebounce.ts        atraso na digitação
  components/
    SongView.tsx          a tela da cifra
    EmergencyPanel.tsx    busca, tom e colagem
    NotificationScheduler.tsx  lembrete com hora exata
    AudioTools.tsx        metrônomo e gravação
    TeoriaViews.tsx       acordes, escalas e círculo das quintas
    ui.tsx                botão, campo, diálogo e aviso
  pages/                  Hoje, Missas, Repertório, Teoria, Ajustes
tools/
  conferir.mjs            varredura de caracteres, terminologia e bytes NUL
  VERIFICAR.md            os casos que só o navegador aberto pega
```

Navegação por hash, e não History API, porque o app é publicado como arquivos
estáticos no GitHub Pages. A History API exigiria regra de rewrite no servidor
(toda rota cair no `index.html`), e hospedagem estática não tem onde colocar
isso. Com hash, `#/missas` é o próprio arquivo, sem configuração nenhuma — e
os atalhos do `manifest.webmanifest` abrem a tela direto.

---

## Palavras

O vocabulário segue o uso da equipe: **Missas**, **Cantos**, **Músicas**,
**Repertório**. O módulo de cifras de emergência é **Emergência**.

A varredura em `tools/conferir.mjs` roda junto e falha se alguma palavra
proibida reaparecer.

---

## Sobre as cifras de referência

As três cifras que vêm prontas em *Repertório → Para começar* são referência
para editar, não fonte oficial. Cifras variam entre hinários e arranjos: o
que está no app serve de ponto de partida, e quem usa sabe a cifra do seu
grupo. Tudo o que é salvo fica editável.

---

## Verificação

```bash
npm test          # 112 testes
npm run typecheck # TypeScript estrito
node tools/conferir.mjs
```

O que os 112 testes cobrem:

- as 12 alturas × 24 semitons sem nunca produzir `Cb`, `E#`, `Fb` ou `B#`
- tríades e acordes complexos: `C#m7b5`, `F#/A#`, `Bbmaj7/D`, `Cmaj7#11`
- treze linhas de letra que já enganaram algum app de cifra
- reatribuição por grau, incluindo tom emprestado e inversão de baixo
- detecção de tom com o gabarito de progressões conhecidas
- busca com erro de digitação, acento, letra faltando, letras trocadas,
  abreviação e desempenho
- regressões de folha de estilo: movimento reduzido, tema escuro, grade da
  cifra, foco visível
- sobreposições sem `AnimatePresence`, e toda animação de entrada com a regra
  de movimento reduzido correspondente

Além dos testes, o app foi verificado no navegador contra o build de produção:
navegação nas cinco telas, ausência de erro e aviso no console, troca de tema
com contraste medido, transposição pela interface, lembrete com hora exata,
gravação, metrônomo e as três abas da emergência.
