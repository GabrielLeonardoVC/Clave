# Acorde

**A mesa de trabalho de quem toca.** Monte escalas de ensaio, culto e show;
organize o repertório; decore a cifra no estúdio com o vídeo do YouTube do
lado; desenhe por cima da foto da cifra e mantenha o BPM na mão.

App web puro. Sem build, sem dependências, sem servidor, funciona offline.

**No ar:** <https://gabrielleonardovc.github.io/Cifras-pro/>

```bash
npm test          # 399 testes do motor, dos links e da busca
npm run verificar # os testes e a varredura de sintaxe, UTF-8 e caracteres
npm run servir    # http://127.0.0.1:8080
```

Não há `npm install`: o app não tem dependência nenhuma. O `package.json`
existe só para reunir os comandos.

### Como ele é publicado

`.github/workflows/pages.yml` roda a cada `push` na `main`. Não há build — o
`index.html` da raiz já é o produto final. O workflow roda os testes, monta a
pasta com o que vai ao ar e publica no GitHub Pages. Se algum teste falhar, não
publica.

Depois do primeiro deploy, ative em **Settings → Pages → Source: GitHub
Actions**.

### Estrutura

```
index.html · manifest.webmanifest · sw.js · .nojekyll
assets/    logo.svg · icon-512.svg
css/       base (tokens) · components · features
js/core/   music · utils · store · ui · render · print · search
           links · metronome · studio · notify · share
js/data/   hinos
js/views/  hoje · agenda · repertorio · teoria · ajustes
tools/     testes e validação (não vai para produção)
```

`js/core/search.js` é a busca que tolera erro de digitação. Ver
[A busca](#a-busca-que-acacha-música-com-o-nome-meio-errado).

---

## Marca

O nome vem do **acorde** — a nota que sustenta o resto e que une a equipe.
Curto, termo musical de verdade, funciona para missa, show e ensaio, e dá um
logo forte: a caixinha de cifrinha que todo mundo desenha no papel.

**Identidade: "luz de palco".** Âmbar quente sobre quase-preto, no lugar do
roxo-IA padrão. O app abre no escuro porque é o cenário de ensaio.

- `assets/logo.svg` — a marca
- `assets/icon-512.svg` — ícone do app (PWA)
- Tipografia: **Bricolage Grotesque** (display) + **Inter Tight** (interface)
- 5 acentos de cor: Brasa (padrão), Jade, Mar, Violeta, Rosa

---

## Como usar

Abra o `index.html` — não precisa de servidor nem de instalar nada. Para
instalar como aplicativo, use o endereço em HTTPS e "Adicionar à tela de
início". Para conferir o service worker, o cache e o console, suba um servidor
local com `npm run servir`.

```
index.html · manifest.webmanifest · sw.js · .nojekyll
assets/    logo.svg · icon-512.svg
css/       base (tokens) · components · features
js/core/   music · utils · store · ui · render · print · search
           links · metronome · studio · notify · share
js/data/   hinos
js/views/  hoje · agenda · repertorio · teoria · ajustes
tools/     testes e validação (não vai para produção)
```

---

## As funções

### Estúdio — o coração do app
Abre com o botão ▶ de qualquer música da escala.

- **Vídeo do YouTube** no alto, com a foto da cifra logo abaixo
- **Desenhe por cima da foto**: caneta, marcador, borracha, 5 cores,
  espessura, desfazer/refazer. Salva como JPEG com a anotação embutida
- **Metrônomo independente** — usa Web Audio, então **continua tocando com o
  vídeo rodando** e não atrasa quando a aba perde o foco
- BPM com +/−, **tap tempo**, compasso (2/4 a 12/8), divisão colcheia/
  semicolcheia, 4 sons
- **Tom e transposição** na hora
- Todos os links de pesquisa do lado

### Agenda
- Vários eventos no mesmo dia (culto, ensaio, rehearsal, show)
- Campos: título, **data, hora, local, tipo, observações**
- Por música: **observação própria**, responsável, categoria, BPM, compasso
--Toque nos selos para ver **quem toca** e as **observações**
- Copiar a semana, duplicar, confirmar, imprimir A4, exportar `.ics`
  (Google/Apple/Outlook) com alarme 2 h antes
- Compartilhar no WhatsApp com links de cifra prontos

### Repertório
- Biblioteca central: cadastre uma vez, use em qualquer escala
- **Colar cifra** do Cifra Club/WhatsApp: identifica os acordes e sugere o tom
- Filtro por tom e categoria, busca sem acento
- Hinos base para importar (viram editáveis)
- Transposição de cifra inteira, detecção de tom, graus romanos

### Teoria
- Acordes: 14 qualidades com posições de violão
- Escalas: 16 escalas/modos com acordes relativos, fretboard e teclado
- Círculo das quintas interativo
- Metrônomo solto

### Ajustes
Tema, **cor do app**, densidade, tamanho do texto, reduzir animações,
antecedência do lembrete, notação ♯/♭, início da semana, backup, plano.

### Busca global (`/`)
Cifras, hinos, músicas usadas nas escalas e nomes de evento, num campo só.

---

## Links externos — todos verificados

Testei cada padrão com requisição real. **Estes funcionam:**

| Fonte | URL |
|---|---|
| Cifra Club | `cifraclub.com.br/?q=` |
| Letras.mus.br | `letras.mus.br/?q=` |
| YouTube | `youtube.com/results?search_query=` |
| Ultimate Guitar | `ultimate-guitar.com/search.php?search_type=title&value=` |
| Chordify | `chordify.com/search/` |
| Vagalume | `vagalume.com.br/busca.html?q=` |
| Spotify · Deezer · Apple Music | busca por `/search/` |

**Estes retornam 404** (não use): `cifraclub.com.br/busca.php?query=`,
`cifraclub.com.br/busca/?q=`, `letras.mus.br/busca/?q=`.

O `extrairYouTubeId()` aceita `youtu.be`, `watch?v=`, `/embed/`,
`/shorts/`, `/live/` e o ID solto — e rejeita link malicioso.

---

## O motor de teoria

Escrito do zero, coberto por **294 testes** (`node tools/test-music.js`).

**Acordes** — 42 qualidades com grafias alternativas: `m` `min` `-` `dim`
`o` `°` `ø` `m7b5` `aug` `+` `5` `6` `6/9` `9` `11` `13` `maj7` `M7` `Δ`
`sus2` `sus4` `7sus4` `add9` `m9` `m11` `maj13`, e baixo separado
(`C/G`, `Bbmaj7/D`). Distingue `m` (menor) de `M` (maior).

**Tokenização sem falso positivo.** O ponto mais delicado: a frase
*"Nada me faltará"* não pode virar `N a d a m e f a l t a r a`. O motor
valida o token contra o padrão de acorde, rejeita palavras portuguesas e só
depois considera a linha "de acordes". Verificado: `O Senhor e o meu pastor`
→ zero acordes; `C        G` → `C G`; `C/G` → `C/G` com baixo transposto.

**Detecção de tom** — correlação de Pearson com os perfis tonais de
Krumhansl-Schmuckler + refinamento estrutural. Tom declarado entre colchetes
(`[Am]`) tem prioridade absoluta. 13 cifras com chave conhecida.

**Posições de violão** — 3 etapas: formas **CAGED** (sempre corretas) →
formas abertas clássicas com prioridade → busca por trastes. Cada voicing
passa por `validateVoicing()`: tem fundamental e 3ª, nada fora do acorde,
fundamental é a mais grave. 26 acordes conferidos (C=`x32010`, Am=`x02210`,
F=`133211`, G=`320003`…); ~3 ms por acorde.

**Transposição por grau** — escolher o tom exato **reatribui os graus da
escala**, e não aplica um número fixo de semitons. Só importa quando origem e
destino têm modos diferentes ou estão a mais de uma quinta, e é justamente o
caso comum: levar uma música de Dó maior para Lá menor.

> Dó maior e Lá menor têm a **mesma armadura**. Levar uma para a outra não é um
> deslocamento de semitons. Deslocar 9 leva o acorde de Dó para Lá — correto —
> mas leva o `Am` de Dó para `F#`, e o certo em Lá menor é `C`. Não existe
> número de semitons que acerte os dois, porque os graus não coincidem. Só a
> reatribuição acerta.

A armadura vem do **tom**, e não da tônica sozinha: Ré menor tem um bemol e Ré
maior não tem nenhum, então decidir só pela tônica escrevia `A#` onde o músico
lê `B♭`. Três casos à parte:

- **Inversão preservada.** O que se mantém é o baixo, e não a nota. `C/G` em
  Dó maior vira `G/D` em Sol maior, com a quinta no baixo nos dois casos.
- **Acorde emprestado.** O `F#7` não é diatônico em Dó maior, mas é o sexto
  grau legítimo em Sol maior. Fica onde está, em vez de virar `C#7` e perder a
  função que cumpre.
- **Estrangeiro dos dois lados.** Desloca e mantém a qualidade escrita.

Os botões de meio tom continuam aplicando um número fixo de semitons — é o que
o músico quer quando a soprano subiu meio tom. Os dois caminhos são diferentes
operações, e por isso existem separados.

---

## A busca que acha a música com o nome meio errado

Músico digitando no celular erra uma letra com frequência. Busca que exige
grafia exata falha justamente no momento em que mais importa.

Para cada palavra digitada procura-se o melhor casamento, do mais forte para o
mais fraco:

| | Pontos | Exemplo |
|---|---|---|
| igual | 1000 | `pastor` em "pastor" |
| começa com | 900 | `past` em "pastor" |
| início de palavra, tolerante | 800 | `pstr` em "pastor" |
| dentro de | 700 | `stor` em "pastor" |
| subquência | 420 | `sr` em "Senhor" |
| erro de digitação | 300 | `pasotr` em "pastor" |

Todos os termos precisam casar (semântica E): buscar `preziosa graça` não pode
devolver só as músicas de "graça". E campo por campo: título pesa mais que
artista, que pesa mais que a letra.

**No teclado**, trocar de lado as letras vizinhas conta como **um** erro só, e
não dois. `prezoisa` acha "Preziosa". É o erro mais comum de dedo em tela
deitada, e a distância de edição comum o contaria como dois.

Medido fora do runner de teste, seis buscas em um repertório de 5.000 músicas:
**127 ms**. O índice é construído uma vez e guardado num `WeakMap`, invalidado
quando o conteúdo da música muda — sem isso, cada tecla digitada refazia a
normalização de todos os campos de todos os itens, e a primeira tecla pagava por
todas as outras.

`js/core/search.js` cuida do campo `titulo` e do campo `nome`, porque o mesmo
objeto se chama diferente no repertório e dentro de uma escala. Buscar por um
só fazia a busca funcionar numa tela e falhar na outra.

---

## O que foi consertado do projeto anterior

| Problema | Causa | Correção |
|---|---|---|
| Fundo da navegação inválido | `rgba(var(--bg), .85)` — cor dentro de `rgba()` | tokens de superfície + `color-mix()` |
| Editar/excluir a música errada | `del(data, i)` usava **índice** | `id` próprio em tudo (`uid()`) |
| Injeção de HTML | `innerHTML` com `${m.nome}` sem escapar | tudo via `Utils.esc()` / nós de DOM |
| Fotos estouravam o armazenamento | base64 em resolução cheia | `shrinkImage()` → 1400 px / JPEG 80 % |
| Sem 2º evento no mesmo dia | `temp`/`editId` globais | rascunho isolado por editor |
| Link inválido sem tratamento | `openLink` só checava `http` | valida protocolo, normaliza, avisa |
| Zoom bloqueado no iOS | `user-scalable=no` | removido |
| Foto de cifra só aparecia isolada | não dava para estudar | Estúdio com desenho por cima |

### Os quatro defeitos que não davam erro nenhum

Nenhum destes aparecia em mensagem, teste ou aviso. Passavam limpos e só
apareciam na tela de quem estava tocando.

| Sintoma | Causa | Correção |
|---|---|---|
| `F#/A#` virava `G#/undefined` | o baixo vinha do regex como um grupo só, e esse grupo ia para a tabela de letras como se fosse a letra. `undefined` virava `NaN` e caminhava pela cifra | letra e acidente separados, como já era feito com a fundamental |
| Hino de um acorde por vez não transpunha | `isChordLine` exigia dois acordes na linha, e hinário se escreve um por vez | a linha inteira decide, não a contagem; reconferida na passada restritiva |
| `Em C G D` +2 virava `Em D A E` | `isChordLine` decidia a linha, mas `transposeLine` redecidia token por token, e a lista de palavras recusava `A`, `E` e `Em` — que também são acordes | dentro de uma linha de acordes, todo token que é acorde vale |
| Link do YouTube devolvia `"youtube-noc"` | os quatro padrões estavam mortos: como literal de regex, o `' + YT_ID + '` entrava dentro do padrão. Tudo dependia de uma busca solta que pegava os 11 primeiros caracteres do link — e `youtube-nocookie`, com hífen, junta 11 | padrões com `new RegExp`; domínio conferido antes; a busca solta roda sobre o caminho, nunca sobre o domínio |

O último é o mais ingrato: `youtube-nocookie.com` tem hífen, o hífen entra na
classe de caracteres, e o host vencia o id. Um link de compartilhamento sem
cookie é exatamente o que o celular da banda costuma ter — e o app tocava o
vídeo errado sem reclamar.

---

## Ferramentas

Todas em `tools/`, sem dependência nenhuma. A varredura é fechada no app
(`tools/arquivos.js`), e a raiz é resolvida pelo próprio módulo — rodar de
dentro de `tools/` confere a mesma coisa que rodar da raiz.

```
npm test                        399 testes: motor, links e busca
npm run verificar               os testes e a varredura de sintaxe, UTF-8 e caracteres

node tools/test-music.js        294 testes do motor de teoria
node tools/test-links.js        45 testes da leitura de link e das fontes
node tools/test-search.js       60 testes da busca tolerante a erro
node tools/check-syntax.js      sintaxe de todos os .js
node tools/check-utf8.js        UTF-8 estrito
node tools/scan.js              detecta caracteres corrompidos
node tools/check-api.js         nenhum acesso a uma API que não existe
node tools/icons.js             confere se os ícones existem no Lucide
node tools/build-hinos.js       gera js/data/hinos.js validando cada acorde
node tools/serve.js             servidor local (npm run servir)
```

### `check-api.js` — o compilador que o app não tem

O Acorde é JavaScript puro. Um método renomeado na API e chamado pelo nome
antigo na tela **não dá erro de sintaxe, não quebra o build e não aparece em
nenhum teste**: só quebra quando alguém toca, muitas vezes dentro de um
`setTimeout`, muito depois do app ter aberto.

Aconteceu quatro vezes:

| Chamava | Existe | Efeito |
|---|---|---|
| `Store.allEscalas()` | `escalas` | o aviso de missa nunca aparecia |
| `Store.cmpEscala` | `cmp` | a ordenação das escalas saía embaralhada |
| `UI.cicloTema` | `cycleTheme` | o botão de trocar de tema não fazia nada |
| `Store.cifraById` | `cifraPorId` | a folha A4 saía sem as cifras anexas |

Nenhum desses dava mensagem, aviso ou falha. O `check-api.js` carrega cada
módulo, lê a API que ele de fato publica, resolve os apelidos que cada arquivo
cria (`const M = global.Music`) e confere os 594 acessos do app. É o substituto
do compilador, e roda em `npm run verificar` e no deploy.

`tools/e2e-body.js` não é comando: é o corpo do teste de ponta a ponta, para
colar no console da página. O resultado sai em `window.__e2e`.

`build-hinos.js` valida todos os acordes antes de gravar: um erro de digitação
na biblioteca quebra o build em vez de chegar ao usuário.

---

## Aviso

As cifras de `js/data/hinos.js` são **referência**, não fonte oficial —
versões variam entre hinários e arranjos. Confira, edite e cole a versão da
sua igreja. Todas ficam editáveis no app.

## Privacidade

Tudo fica em `localStorage` no seu navegador. Nada é enviado a servidor
nenhum. Faça backup em **Ajustes** — limpar os dados do site apaga tudo.
