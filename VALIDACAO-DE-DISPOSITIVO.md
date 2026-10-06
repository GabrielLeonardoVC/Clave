# VALIDACAO DE DISPOSITIVO REAL

Documento de teste manual. **Nao e' uma lista de tarefas de codigo.**
Nenhum item aqui exige mudar o produto.

Este arquivo existe porque duas coisas do Clave **nunca foram exercitadas com
audio de verdade** em nenhum dos ciclos de desenvolvimento ate agora:

1. a gravacao de voz (VS);
2. a instalacao do PWA.

Tudo o mais ja foi medido em navegador automatizado. Estas duas, nao — e a
raza e simples: o microfone e negado pelo navegador neste ambiente, e nao ha
ferramenta para conceder a permissao nem para instalar um aplicativo. Um audio
fabricado passaria pelos testes de persistencia e **nao provaria nada** sobre
audio gravado.

---

## 1. O QUE JA ESTA COMPROVADO

Medido em navegador real, com o codigo como esta hoje:

| Area | Evidencia |
|---|---|
| Suite de testes | `npm test` = EXIT 0 |
| Verificador | `npm run verificar` = EXIT 0 em 3/3 |
| Checkers | 33/33 rodando, sem curto-circuito |
| Execucao de repertorio | 8 musicas, posicao `N de 8` sempre visivel |
| Transpose isolado | `A +2` e `B +2` convivem; ninguem herda |
| Acordes complexos | maior, menor, setima, sustenido, bemol, slash — com tabela de alturas independente |
| Orfa | aviso visivel, sequencia continua, "Tirar do repertorio" limpa o handle |
| Empilhadura | dez "+" seguidos: `barras=1`, `folhas=1` |
| Busca | titulo, artista, sem acento, caixa, **typo** ("O Sennhor" acha a certa) |
| Biblioteca pela UI | 2 cliques: `Repertório` -> `Minhas cifras` |
| Backup | exportar -> apagar -> importar devolve **identico**, com a ordem |
| Recuperacao | reload: dados intactos, sessao nao vaza, transpose nao persiste |
| Offline (navegador) | servidor da origem **desligado**: fluxo inteiro rodando do cache |
| Performance | 10/50/100 musicas sem crescimento estrutural |

**Nenhum P0. Nenhum P1.**

---

## 2. O QUE AINDA DEPENDE DE DISPOSITIVO REAL

| # | Pendencia | Bloqueio |
|---|---|---|
| 1 | Microfone autorizado | `permissions: denied` neste ambiente |
| 2 | Gravar VS real | depende de 1 |
| 3 | Reproduzir VS real | depende de 2 |
| 4 | VS apos recarregar | depende de 2 |
| 5 | VS isolado entre duas musicas | depende de 2 |
| 6 | VS no backup/importacao | depende de 2 |
| 7 | Tamanho real do audio | depende de 2 |
| 8 | Instalar o PWA | sem gesto do usuario no ambiente |
| 9 | Abrir como aplicativo instalado | depende de 8 |
| 10 | Offline no aplicativo **instalado** | depende de 8 |

O `manifest` esta correto e o service worker tem 53 recursos em cache. Isso
**nao** e o mesmo que "instalado e usado" — sao coisas diferentes, e o checklist
abaixo separa as duas.

---

## 3. PROCEDIMENTO — MICROFONE

### Checklist A — gravacao basica

Em um computador com microfone, em um navegador normal (sem automacao):

```
[ ] abrir o Clave
[ ] abrir uma musica
[ ] permitir microfone quando o navegador perguntar
[ ] iniciar a gravacao
[ ] falar por 10 a 15 segundos
[ ] parar
[ ] salvar
[ ] reproduzir
```

Registrar:

```
MIME:      (ex.: audio/webm;codecs=opus)
TAMANHO:   (bytes do audio)
DURACAO:   (segundos)
RESULTADO: PASS / FAIL
```

Depois, sem tocar em mais nada:

```
[ ] sair da musica
[ ] reabrir a mesma musica
[ ] reproduzir novamente
```

**PASS** se o audio tocar as duas vezes e for o mesmo conteudo.
**FAIL** se a segunda reproducao falhar, ou se tocar um silencio, ou se nao
tiver mais audio nenhum.

### Checklist B — duas musicas

```
[ ] gravar VS na musica A
[ ] gravar um VS DIFERENTE na musica B
[ ] abrir A  -> confirmar que toca o audio de A
[ ] abrir B  -> confirmar que toca o audio de B
[ ] voltar A -> confirmar que ainda toca o audio de A
```

**FAIL** se B tocar o audio de A, se A tocar o audio de B, ou se um dos dois
perder o audio ao trocar de musica.

Teste tambem: em A, transponha, vá em B, volte para A.
A musica e o tom precisam sair **independentes**.

### Checklist C — recarregar

```
[ ] gravar
[ ] salvar
[ ] recarregar a pagina inteira (F5)
[ ] abrir a mesma musica
[ ] reproduzir
```

Registrar:

```
vs:      (o que aparece no estado da musica)
vsSeg:   (duracao, em segundos)
MIME:
bytes:
```

**FAIL** se `vs` ou `vsSeg` nao voltarem, ou se o player aparecer sem audio.

Se falhar, **nao presuma que e limitacao do navegador**. Antes de fechar como
FAIL, registre o que encontrou:

- o audio sumiu ao salvar, ou sumiu ao recarregar?
- `vs` esta vazio no estado?
- `vsSeg` sobrevive mesmo com `vs` vazio?
- ha alguma mensagem de erro na tela?
- o tamanho em `localStorage` mudou?

Essa distincao muda o diagnostico: `vsSeg` sobrevive e `vs` nao, o problema e
na **gravacao da URL**; os dois somem, o problema e na **persistencia**.

### Checklist D — backup

```
[ ] gravar audio real
[ ] exportar o backup (anote o tamanho do arquivo)
[ ] apagar os dados
[ ] importar o backup
[ ] abrir a musica
[ ] reproduzir
```

Resultados possiveis:

- **PASS** — o audio real sobreviveu ao backup.
- **FAIL** — o audio sumiu, sem o produto avisar que o formato nao o transporta.
- **LIMITACAO DO FORMATO** — o audio nao entrou no backup **e o produto diz
  isso** ou documenta que nao entra. Isso e' comportamento aceitavel, desde que
  seja honesto.

O que **nao** e' aceitavel: o backup dizer que salvou tudo e o audio sumir sem
nenhum aviso.

### Checklist E — tamanho

Grave dois audios: um curto (5 s) e um moderado (60 s).

```
CURTO:     duracao / bytes / MIME / tamanho exportado / tamanho persistido
MODERADO:  duracao / bytes / MIME / tamanho exportado / tamanho persistido
```

Nao tente encher a cota para provoke. O que importa e: quando o limite for
atingido de verdade, o aplicativo

- [ ] nao afirma que salvou o que nao salvou;
- [ ] preserva o audio pendente, se couber;
- [ ] mostra uma mensagem honesta.

---

## 4. PROCEDIMENTO — PWA

Em um celular ou em um navegador que ofereca instalacao (Chrome, Edge; no iPhone,
pela aba Compartilhar > Adicionar na Tela de Inicio).

### Checklist E — instalacao

```
[ ] o navegador reconheceu o manifest
[ ] instalei o aplicativo
[ ] abri pelo icone
[ ] abriu como aplicativo (sem barra de endereco)
[ ] o nome aparece correto
[ ] o icone aparece correto
[ ] fechei o aplicativo
[ ] reabri pelo icone
[ ] os dados continuam la
[ ] o repertorio continua la
[ ] as musicas continuam la
[ ] a execucao do repertorio funciona
```

Resultado: `PASS` / `FAIL` / `NAO SUPORTADO PELO AMBIENTE`.

### Checklist F — offline, instalado

```
[ ] abrir online
[ ] acessar o repertorio
[ ] abrir uma musica
[ ] DESLIGAR a conexao (modo aviao / desligar o wifi)
[ ] fechar o aplicativo
[ ] reabrir pelo icone
[ ] abrir o repertorio
[ ] abrir uma musica
[ ] avancar
[ ] voltar
[ ] transpor
```

Resultado: `PASS` / `PASS COM LIMITACAO` / `FAIL`.

Se houver `LIMITACAO`, **escreva qual dependencia externa apareceu** (fonte,
icone, mapa). "Abreu mas uma coisa nao carregou" nao serve: o nome do recurso
que faltou e' a informacao toda.

---

## 5. CRITERIOS PASS / FAIL

Uma regra so, aplicada a tudo:

> **PASS** = a pessoa fez o que o checklist pede e deu certo.
> **FAIL** = a pessoa fez o que o checklist pede e deu errado.
> **NAO TESTADO** = nao foi possivel executar neste ambiente.

O que **nao** pode ser registrado como PASS:

- "o botao de gravar aparece" — aparecer nao e persistir.
- "o player aparece" — um player sem audio e um bug silencioso.
- "o estado tem o campo `vs` preenchido" — um valor que nao reproduz nao serve.
- "o manifest esta certo" — manifest nao e instalacao.

Se um passo nao pode ser feito no ambiente disponivel, escreva
`NAO SUPORTADO PELO AMBIENTE` e **passe para o proximo dispositivo**. Isso e
informacao, nao falha.

---

## 6. P3 DE UX — CONHECIDOS, NAO CORRIGIDOS

Nenhum destes bloqueia a release. Nenhum foi tocado, de proposito.

| # | Item | Leitura |
|---|---|---|
| 1 | Na barra de baixo o item se chama `Repertório`, mas abre "Sua biblioteca de cifras", com a aba `Minhas cifras`. Ha outra aba ali chamada `Repertório pronto`. | Pequena ambiguidade: o nome na barra nao anuncia o conteudo. |
| 2 | O atalho `Cifra` na tela inicial abre o formulario de **criar** uma cifra nova, nao a lista. | Quem quer criar entende; quem quer ver as cifras, nao. |
| 3 | O rotulo do tom mostra `C 2` sem unidade visivel. O numero esta la, e a cifra ja esta no tom certo; a explicacao esta no tooltip. | Ambiguidade leve: `C 2` pode ser lido como "C dois" (oitava). |

Se, depois de usar o Clave de verdade, algum desses incomoda de fato, ele vira
backlog com relato — nao antes disso.

---

## 7. CRITERIO FINAL DE RELEASE

Antes de qualquer distribuicao, rodar:

```
npm test              -> tem de sair EXIT 0
npm run verificar     -> tem de sair EXIT 0
git diff --check      -> sem erros
```

E conferir que nada ficou pela metade:

```
[ ] nenhum arquivo do produto foi alterado sem motivo
[ ] nenhum arquivo temporario sobrou
[ ] nenhum log de investigacao no codigo
[ ] nenhum commit novo nao revisado
[ ] nada foi enviado para o repositorio remoto
```

O estado do produto hoje:

> **Release tecnicamente pronta; validacoes de microfone real e instalacao PWA
> permanecem como testes manuais de dispositivo.**

Ou seja: o caminho principal esta medido e verde. As duas pendencias acima sao
**tarefas de teste**, nao de codigo — e nao se resolvem escrevendo mais nada
neste projeto. Resolvem-se abrindo o Clave num computador com microfone e num
celular, e preenchendo os checklists A a F.

Se a gravacao de voz entrar na release, os checklists A, B, C e D tem de estar
`PASS` antes de sair. Se o aplicativo instalado for parte da promessa do
produto, os checklists E e F tambem.