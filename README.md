# Cifras-pro

Repositório com **dois aplicativos**. O que está publicado é o
**CifraCeleste**; o **Acorde** é a versão anterior, mantida como referência.

| | Pasta | O que é | Estado |
|---|---|---|---|
| **CifraCeleste** | [`cifraceleste/`](cifraceleste/) | React + TypeScript + Vite + Tailwind | **Publicado** |
| Acorde | raiz (`index.html`, `js/`, `css/`) | App puro em JS, sem build | Referência |

O Acorde não é mais o projeto — o motor de teoria dele foi portado para o
CifraCeleste. Ele continua no repositório porque os 220 testes de
`tools/test-music.js` servem de referência para conferir o que foi portado.

## CifraCeleste — o app publicado

**No ar:** <https://gabrielleonardovc.github.io/Cifras-pro/>

Cifras, escalas e teoria musical para músicos ao vivo. Repertório, missas,
transposição instantânea, áudio e modo estúdio. Instala como aplicativo e
funciona sem internet — a estratégia do service worker é *rede primeiro, cache
como reserva*, porque quem precisa da cifra no porão da igreja não pode ficar
olhando uma tela em branco.

```bash
cd cifraceleste
npm install
npm run dev      # http://127.0.0.1:5180
npm run build    # typecheck + build de produção em dist/
npm test         # 112 testes
```

### Como ele é publicado

`.github/workflows/pages.yml` compila a cada `push` na `main` que mexa em
`cifraceleste/`, roda os testes antes de gerar o artefato e publica o
`dist/` no GitHub Pages. O Vite já está com `base: './'`, então o app roda
no subdomínio `/Cifras-pro/` sem configuração extra.

Depois do primeiro deploy, ative em **Settings → Pages → Source: GitHub
Actions**.

---

# Acorde

> App anterior, mantido como referência. Não é publicado.

**A mesa de trabalho de quem toca.** Monte escalas de ensaio, culto e show;
organize o repertório; decore a cifra no estúdio com o vídeo do YouTube do
lado; desenhe por cima da foto da cifra e mantenha o BPM na mão.

App web puro. Sem build, sem dependências, sem servidor, funciona offline.

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

Abra o `index.html`. Para instalar como aplicativo, publique em HTTPS
(GitHub Pages) e use "Adicionar à tela de início".

```
index.html · manifest.webmanifest · sw.js
assets/    logo.svg · icon-512.svg
css/       base (tokens) · components · features
js/core/   music · utils · store · ui · render · print
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

Escrito do zero, coberto por **220 testes** (`node tools/test-music.js`).

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

---

## Ferramentas

```
node tools/test-music.js      220 testes do motor de teoria
node tools/check-syntax.js    sintaxe de todos os .js
node tools/check-utf8.js      UTF-8 estrito
node tools/scan.js            detecta caracteres corrompidos
node tools/icons.js           confere se os ícones existem no Lucide
node tools/build-hinos.js     gera js/data/hinos.js validando cada acorde
```

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
