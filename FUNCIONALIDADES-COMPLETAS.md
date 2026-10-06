# FUNCIONALIDADES COMPLETAS DO CLAVE

Inventario do que existe **hoje**, no codigo atual deste repositorio.

Regras usadas:

- so conta o que esta implementado e alcancavel pela interface;
- codigo sem acesso confirmado pela interface entra como
  `IMPLEMENTADO, ACESSO NAO CONFIRMADO`;
- comentario, README e plano **nao** contam como funcionalidade;
- "implementado" e "validado" sao estados diferentes, e nunca se confundem.

Estados usados:

| Estado | Significado |
|---|---|
| `IMPLEMENTADA E VALIDADA` | existe e foi exercitada de verdade |
| `IMPLEMENTADA` | existe e funciona, sem exercicio de prova registrado |
| `IMPLEMENTADA, NAO VALIDADA` | existe; nunca foi provada (falta hardware ou gesto) |
| `PARCIAL` | parte funciona, parte nao |
| `ACESSO NAO CONFIRMADO` | o codigo existe; nao confirmei que a interface chega ate ele |
| `NAO EXISTE` | procurado e nao encontrado |

---

## 1. NAVEGACAO E INTERFACE

### Barra inferior de navegacao
**O que faz:** seis destinos sempre visiveis: Hoje, Agenda, Repertorio, Teoria, Afinador, Mais.
**Como acessar:** barra inferior, sempre presente.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/app.js` (`montarNav`) · os seis itens foram clicados e contados porBrowser.

### Menu "Mais"
**O que faz:** tela completa com tres grupos — NAVEGAR (Hoje, Agenda, Repertorio, Ajustes), FERRAMENTAS (Afinador, Colar cifra, Transpor, Metronomo, Instrumento em 3D), AJUDA (Sobre o Clave, Atalhos).
**Como acessar:** barra inferior → Mais.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/app.js` (`abrirDrawer`) · conteudo lido do DOM.

### Atalhos da Home
**O que faz:** atalhos para Evento, Cifra, Afinador, Colar, Braco.
**Como acessar:** Hoje → bloco de atalhos.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/hoje.js`.

### Atalhos de teclado
**O que faz:** mostra a lista de atalhos.
**Como acessar:** Mais → Atalhos.
**Estado:** IMPLEMENTADA, NAO VALIDADA (a execucao das teclas nao foi provada; `KeyboardEvent` sintetico nao e acao nativa do navegador).
**Evidencia:** `js/app.js` (`atalhos`, `aoTeclar`).

### Folha (sheet) modal
**O que faz:** painel que abre sobre a tela, empilha e fecha por botao, Escape ou backdrop; guarda contra saida com pendencia.
**Como acessar:** acoes que abrem folhas em varias telas.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/core/ui.js` (`sheet`, `close`, `closeAllSheets`); pilha real testada em `tools/guarda-navegador.js`.

### Avisos (toast)
**O que faz:** mensagem temporaria, com variante de undo ou de acao.
**Como acessar:** disparado por acoes do app.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/ui.js` (`toast`).

### Confirmacao com acoes
**O que faz:** diálogo com ate 4 botoes (Tentar salvar / Fazer backup / Continuar aqui / Sair e descartar).
**Como acessar:** sair da mesa de ensaio com gravacao nao salva.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/core/ui.js` (`confirmar`) · `tools/guarda-navegador.js`.

### Tema e densidade
**O que faz:** tema claro/escuro e ciclo automatico; densidade da interface.
**Como acessar:** Ajustes.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/ajustes.js` (`cicloTema`, `aplicarTema`).

---

## 2. MUSICAS / CIFRAS

### Criar cifra
**O que faz:** abre formulario com titulo, artista, tom, BPM, compasso, categoria, letra, cifra, tags, observacoes, video do YouTube e foto.
**Como acessar:** Home → Cifra.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/repertorio.js` (`campo`, `novo`, `editar`, `conferirYt`, `pintarFoto`).

### Editar cifra
**O que faz:** reabre o mesmo formulario com os dados carregados e salva alteracoes.
**Como acessar:** cartao da cifra → Editar.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/repertorio.js` (`editar`).

### Excluir cifra
**O que faz:** remove a cifra da biblioteca, com confirmacao.
**Como acessar:** cartao da cifra → Excluir.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/repertorio.js` (`confirmarExcluir`).

### Visualizar cifra
**O que faz:** abre a folha da musica com a cifra, controles de exibicao e acoes do palco.
**Como acessar:** cartao da cifra.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/cancao.js`.

### Modo "só acordes" e "mostrar tudo"
**O que faz:** alterna a folha entre mostrar so as linhas de acordes e mostrar tudo.
**Como acessar:** folha da musica.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/cancao.js`.

### Linha de_capoeira
**O que faz:** alterna a rolagem da cifra entre por linha e por verso.
**Como acessar:** folha da musica.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/cancao.js`; `.cifraScroller` em `js/core/render.js`.

### Campo BPM
**O que faz:** guarda o andamento da musica.
**Como acessar:** formulario da cifra.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/store.js` (`normCifra.bpm`).

### Campo compasso
**O que faz:** guarda o compasso (ex.: 4/4).
**Como acessar:** formulario da cifra.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/store.js` (`normCifra.compasso`).

### Campo tom
**O que faz:** guarda o tom anotado da musica.
**Como acessar:** formulario da cifra, com seletor de tons.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/core/store.js` (`normCifra.tom`), `js/views/cancao.js` (`botaoTom`).

### Campo artista
**O que faz:** guarda o autor da musica.
**Como acessar:** formulario da cifra.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/core/store.js` (`normCifra.artista`).

### Campo letra
**O que faz:** guarda a letra.
**Como acessar:** formulario da cifra.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/store.js` (`normCifra.letra`).

### Campo observacoes
**O que faz:** guarda observacoes livres.
**Como acessar:** formulario da cifra.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/store.js` (`normCifra.obs`).

### Campo tags
**O que faz:** guarda etiquetas; entram na busca.
**Como acessar:** formulario da cifra.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/store.js` (`normCifra.tags`), `js/core/search.js` (indexa `tags`).

### Campo responsavel
**O que faz:** guarda quem responde pela musica no evento.
**Como acessar:** evento.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/store.js` (`normMusica.responsavel`).

### Estudo de velocidade
**O que faz:** guarda velocidade de estudo e se os acordes estao ocultos.
**Como acessar:** acoes de estudo na lista de cifras.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/repertorio.js` (`gravarEstudo`, `gravarVelocidade`), `Store.normEstudo`.

### Imprimir cifra
**O que faz:** gera folha de uma musica para impressao.
**Como acessar:** cartao da cifra → Imprimir.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/repertorio.js` (`printCifra`), `js/core/print.js`.

---

## 3. BIBLIOTECA

### Lista "Minhas cifras"
**O que faz:** lista as cifras guardadas, com tom e contador.
**Como acessar:** Repertorio → aba "Minhas cifras".
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/repertorio.js` (`painelMinhas`, `pintar`, `cartaoCifra`).

### Filtro por tom
**O que faz:** filtra a lista por tom, com a opcao "Todos".
**Como acessar:** Repertorio → "Minhas cifras" → linha de tons.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/repertorio.js`.

### Marcadores de ficha
**O que faz:** mostra marcadores de preenchimento da ficha (foto, video, VS, estudo).
**Como acessar:** cartao da cifra.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/repertorio.js` (`marcadoresDaFicha`).

### Importar da base
**O que faz:** importa a base de cifras que vem com o app.
**Como acessar:** Repertorio → "Repertório pronto".
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/repertorio.js` (`importarDaBase`, `painelBase`), `js/data/base.js`.

### Metricas da biblioteca
**O que faz:** conta e resume o que existe na biblioteca - quantas cifras, quais tons, armaduras, quantas faixas de cada tom.
**Como acessar:** chamando o modulo; nao ha tela propria.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/store.js` (`metricas`, `armadura` em `js/core/music.js`).

---

## 4. REPERTORIOS / EVENTOS

### Criar evento
**O que faz:** agenda um ensaio, missa ou show com data, hora, titulo, local, tipo, responsavel, observacao, foto e lista de musicas.
**Como acessar:** Home → Evento (ou Agenda → Novo).
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/agenda.js` (`card`, `render`, `recarregar`).

### Editar evento
**O que faz:** reabre o evento para alteracao.
**Como acessar:** Agenda → tocar no evento.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/agenda.js`.

### Excluir evento
**O que faz:** remove o evento e NAO apaga as musicas da biblioteca.
**Como acessar:** folha do evento → Excluir.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/agenda.js`; verificado: evento removido, 8 cifras intactas.

### Calendario mensal
**O que faz:** navegacao por mes, com os dias marcados por evento.
**Como acessar:** Agenda.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/agenda.js` (`calendario`, `ano`, `inicioSemana`, `grid`).

### Tipos e categorias de evento
**O que faz:** distingue missa, ensaio e show.
**Como acessar:** formulario do evento.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/agenda.js` (`TIPOS`), `Store.normEscala.tipo`.

### Status do evento
**O que faz:** marca o evento como rascunho, confirmada ou tocada.
**Como acessar:** formulario do evento.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/store.js` (`normEscala.status`).

### Adicionar musica ao evento
**O que faz:** coloca uma musica da biblioteca no evento, guardando **metadados + `cifraId`** (nao a cifra inteira).
**Como acessar:** folha do evento → "Do repertório".
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/agenda.js` (`escolherDoRepertorio`).

### Remover musica do evento
**O que faz:** tira a musica do evento, sem mexer na biblioteca.
**Como acessar:** evento → remover musica.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/execucao.js` ("Tirar do repertorio"); verificado `2 de 2`.

### Ordenar musicas do evento
**O que faz:** a ordem definida no evento e a ordem percorrida na execucao, e persiste.
**Como acessar:** lista de musicas do evento.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** ordem preservada apos exportar/apagar/importar.

### Ver quantidade de musicas
**O que faz:** mostra "8 músicas" no cartao do evento.
**Como acessar:** Agenda e Home.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/hoje.js`, `js/views/agenda.js`.

### Compartilhar evento
**O que faz:** texto para WhatsApp, arquivo `.ics` de calendario, link da equipe e folha para PDF.
**Como acessar:** evento → compartilhar.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/share.js` (`texto`, `ics`, `baixarIcs`, `linkDaEscala`, `menu`).

### Lembretes de evento
**O que faz:** agendador que dispara lembrete pelo Notification API enquanto o app esta aberto, e registra preferencia para o service worker.
**Como acessar:** Ajustes → notificacoes e antecedencia.
**Estado:** IMPLEMENTADA, NAO VALIDADA (dispara depende de o app ficar aberto e de permissao concedida ao sistema).
**Evidencia:** `js/core/notify.js` (`suporta`, `permissao`, `pedir`).

---

## 5. MODO DE EXECUCAO

### Iniciar o repertorio
**O que faz:** abre a musica 1 do evento em uma folha propria, sem voltar ao editor.
**Como acessar:** evento → "Começar o repertório".
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/execucao.js` (`iniciar`); 8 musicas percorridas no navegador.

### Barra de execucao
**O que faz:** faixa acima do palco com titulo, posicao, tom e botoes.
**Como acessar:** durante a execucao.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/execucao.js` (`barra`, `pintar`); `BARRAS=1` em todos os passos medidos.

### Proxima musica
**O que faz:** avanca uma posicao e recria a folha.
**Como acessar:** botão Próxima.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/execucao.js` (`proxima`); mutacao M1 detectada por `tools/provar-execucao.js`.

### Musica anterior
**O que faz:** volta uma posicao.
**Como acessar:** botão Anterior.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/execucao.js` (`anterior`); mutação M2 detectada.

### Posicao "N de N"
**O que faz:** mostra em que musica a pessoa esta.
**Como acessar:** barra de execucao.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/execucao.js`; "1 de 8" lido do DOM.

### Limites das pontas
**O que faz:** desabilita Anterior na primeira e Próxima na ultima, com aviso.
**Como acessar:** pontas do repertorio.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/execucao.js`; mutações M3 e M4 detectadas.

### Sair da execucao
**O que faz:** encerra a sessao, fecha a folha e volta para a Agenda. **Volta sempre na musica 1.**
**Como acessar:** botão X na barra.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/execucao.js` (`sair`); `folhas=0` apos sair; retomar custa 2 acoes.

### Isolamento de estado entre musicas
**O que faz:** trocar de musica nao carrega tom nem rolagem da anterior.
**Como acessar:** execucao com mais de uma musica.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** troca de folha, nao mutacao; 8 musicas percorridas.

---

## 6. TRANSPOSE

### Subir um semitom
**O que faz:** transpõe a musica atual +1, temporario e so nesta sessao.
**Como acessar:** botão + na barra.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/execucao.js` (`transpor`).

### Descer um semitom
**O que faz:** −1 semitom.
**Como acessar:** botão − na barra.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/execucao.js` (`transpor`).

### Voltar ao tom original
**O que faz:** zera o desvio e **redesenha a folha**.
**Como acessar:** botão "Original" (so aparece quando ha desvio).
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/execucao.js` (`restaurarTom`, `reapintar`). BUG corrigido: antes nao redesenhava.

### Transpose por musica
**O que faz:** cada musica guarda o proprio desvio; A +2 nao contamina B, e voltar a A restaura.
**Como acessar:** execucao com 3+ musicas.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `sessao.semisPorMusica`; medido no navegador; mutações M6 e M7 detectadas.

### Indicador de desvio
**O que faz:** mostra o tom e o numero de semitons, com classe "movido".
**Como acessar:** barra de execucao.
**Estado:** IMPLEMENTADA E VALIDADA. **P3 conhecido:** mostra "C 2" sem unidade visivel.
**Evidencia:** `js/views/execucao.js` (`rotuloTom`).

### Sem drift em varios passos
**O que faz:** +1 +1 −1 volta exatamente ao estado de +1.
**Como acessar:** botoes da barra.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** medido no navegador; `tools/test-execucao.js`.

### Circulo de 12 semitons
**O que faz:** +12 devolve a mesma cifra.
**Como acessar:** + repetido 12 vezes.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/views/execucao.js` (modulo 12); medido no navegador.

### Painel de transposicao na Teoria
**O que faz:** transpoe qualquer texto de cifra, com escolha de sustenido ou bemol.
**Como acessar:** Teoria → Transpor.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/teoria.js` (`painelTranspor`, `flatPara`, `dialogTranspor`).

---

## 7. AUDIO / VS

> Esta categoria e a que tem mais estados diferentes. Cada passo e listado separado.

### Acesso ao microfone
**O que faz:** pede permissao de microfone e detecta se ja foi concedida.
**Como acessar:** mesa de ensaio → gravar narração.
**Estado:** IMPLEMENTADA, NAO VALIDADA EM HARDWARE. `getUserMedia → NotAllowedError` no ambiente de teste.
**Evidencia:** `js/core/gravador.js` (`disponivel`, `jaAutorizado`).

### Iniciar gravacao
**O que faz:** abre o fluxo de gravacao e comeca a capturar.
**Como acessar:** botão de gravar na mesa de ensaio.
**Estado:** IMPLEMENTADA, NAO VALIDADA EM HARDWARE.
**Evidencia:** `js/core/gravador.js` (`iniciar`, `FORMATOS`, `tipoDoGravador`).

### Parar gravacao
**O que faz:** encerra a captura e devolve os bytes.
**Como acessar:** botão parar.
**Estado:** IMPLEMENTADA, NAO VALIDADA EM HARDWARE.
**Evidencia:** `js/core/gravador.js`.

### Descartar gravacao
**O que faz:** solta o microfone sem entregar audio.
**Estado:** IMPLEMENTADA, NAO VALIDADA EM HARDWARE.
**Evidencia:** `js/core/gravador.js` (`cancelar`).

### Salvar gravacao
**O que faz:** converte o audio em data-URL (o unico formato que cabe no armazenamento local) e grava na ficha da musica.
**Como acessar:** confirmar a gravacao.
**Estado:** IMPLEMENTADA, NAO VALIDADA. **Achado de campo:** um `blob:` semeado a mao e descartado pela normalizacao — o que **nao** prova que audio real se perca.
**Evidencia:** `js/core/gravador.js` (`blobParaDataUrl`, `tamanhoDe`), `js/views/palco.js` (`salvarFicha`).

### Reproduzir VS
**O que faz:** toca a narração guardada.
**Como acessar:** botão de reproduzir na faixa narrada.
**Estado:** IMPLEMENTADA, NAO VALIDADA — **o player aparecer não prova que o audio toca.**
**Evidencia:** `js/views/palco.js`, `js/views/cancao.js`.

### Regravar narração
**O que faz:** substitui a narração existente.
**Como acessar:** botão Regravar narração.
**Estado:** IMPLEMENTADA, NAO VALIDADA EM HARDWARE.
**Evidencia:** `js/views/palco.js`.

### VS por capitulo
**O que faz:** divide a narração em capitulos com marcação de tempo e nome.
**Como acessar:** faixa narrada da folha da musica.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/cancao.js` (`blocoObs`, capitulo), `Store.normVsCapitulo`.

### VS isolado por musica
**O que faz:** cada musica guarda a sua gravacao; uma nao aparece na outra.
**Como acessar:** gravar em A, depois em B.
**Estado:** IMPLEMENTADA, NAO VALIDADA (isolamento de metadados confirmado; de audio real, nao).
**Evidencia:** VS vive em `escala.musicas[i]`; verificado que nao vaza para o evento nem para as outras musicas.

### VS apos fechar e reabrir
**Estado:** IMPLEMENTADA, NAO VALIDADA.
**Evidencia:** a tela carrega `vs` e `vsSeg`; **nunca houve audio real para provar a persistencia.**

### VS no backup
**Estado:** NAO CONFIRMADO. O backup preserva metadados e `vsSeg`; **se o audio entra no arquivo exportado nunca foi provado.**
**Evidencia:** `Store.exportar` preservou ordem, metadados e `vsSeg` em teste real.

### Calculo honesto de espaco
**O que faz:** diz quantos segundos de audio cabem no espaco restante.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/gravador.js` (`tamanhoDe`), `Store.espacoParaGravacao`.

---

## 8. AFINADOR

### Ligar o microfone do afinador
**Estado:** IMPLEMENTADA, NAO VALIDADA EM HARDWARE (permissao negada no ambiente).
**Evidencia:** `js/views/afinador.js` (`ligar`, `disligar`), `js/core/audio.js` (`Nota`).

### Detectar frequencia
**O que faz:** mede a frequencia do som e devolve nota e cents.
**Como acessar:** Afinador.
**Estado:** IMPLEMENTADA (o algoritmo tem 18/18 de prova; a captura nao).
**Evidencia:** `js/core/tuner.js` (`detectar`, `detectarHz`, `suavizar`).

### Mostrar nota, frequencia e cents
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/tuner.js` (`notaParaHz`, `hzParaNota`), `js/views/afinador.js`.

### Curva de desvio (agulha)
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/afinador.js` (`desenhar`, `posicaoDoCursor`).

### Nota de referencia (La)
**O que faz:** ajusta o La de referencia.
**Estado:** IMPLEMENTADA. **P3:** "Ajustar o tom de qualquer cifra" e o botao "Cifra" na Home apontam para areas diferentes.
**Evidencia:** `js/views/afinador.js`; `Tuner.A4_PADRAO`.

---

## 9. TEORIA MUSICAL

### Placa do acorde
**O que faz:** mostra o acorde montado, com a nota e o intervalo.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/teoria.js` (`placaDoAcorde`).

### Deduplicado e dedilhado
**O que faz:** mostra o dedilhado do acorde em duas linhas.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/teoria.js` (`dedilhado`).

### Ouvir o acorde
**O que faz:** toca o acorde.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/teoria.js`.

### Painel de acordes
**O que faz:** lista as formas e os diagramas por qualidade.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/teoria.js` (`painelAcordes`, `fretNote`, `fretNoteName`, `fretsForNote`, `fret`).

### Painel de escalas
**O que faz:** mostra a escala no traste e as notas.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/teoria.js` (`painelEscalas`, `bracoPara`).

### Circulo das quintas
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/teoria.js` (`painelCirculo`).

### Identificacao de tom a partir da cifra
**O que faz:** le a cifra e devolve o tom mais provavel, com modo, rotulo e armadura; mostra quantas linhas ficam fora.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/core/music.js` (`resumoDeTons`); `provar:musica` 18/18.

### Conversor de tom (tela de emergencia)
**O que faz:** escolhe a tonica de origem e a desejada e mostra o caminho de meio tom; monta links de busca em fontes externas.
**Estado:** IMPLEMENTADO, ACESSO NAO CONFIRMADO — o script carrega, mas nao localizei a rota nem o item de menu que abre esta tela.
**Evidencia:** `js/views/emergencia.js` (`parseTon`, `diferenca`, `conversor`, `urlDe`); fontes: Cifra Club, YouTube, Letras, InArtist, Google.

### Metronomo (tela)
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/teoria.js` (`abrirMetronomo`), `js/core/metronome.js`.

### Modos e graus
**O que faz:** motor com modos maior e menor, graus e rotulos.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/music.js` (`modo`, `modeName`, `keyLabel`, `armadura`).

---

## 10. INSTRUMENTOS / 3D

### Formas canonicas (CAGED) por qualidade
**O que faz:** formas deTemplates para maior, menor, 7, m7, maj7 e sus4.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/music.js` (`SHAPE_TEMPLATES`, `guitarShapes`).

### Afinação e cordas
**O que faz:** afinacao padrao (E A D G B E), rotulos de corda e nota de cada corda.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/music.js` (`TUNING`, `OPEN_PC`, `STRING_LABELS`, `fretsForNote`).

### Traste para nota
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/music.js` (`fretNote`, `fretNoteName`, `fret`).

### Formas por instrumento
**O que faz:** formatos de corda para violao, baixo, cavaquinho, violino, ukulele e outros.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/music.js` (`INSTRUMENTOS`, `instrumentShapes`, `idDeInstrumento`, `chaveDeInstrumento`, `validateVoicing`).

### Violao 3D
**O que faz:** visualizacao 3D do instrumento.
**Estado:** IMPLEMENTADA. **P3:** o item se chama "Braco" na Home e "Instrumento em 3D" no menu — mesmo destino, dois nomes.
**Evidencia:** `js/views/violao3d.js` (`Violao3D`), `js/core/gfx.js`, `js/core/cena.js`.

### Traste 3D
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/traste3d.js` (`Traste3D`).

---

## 11. BUSCA

### Campo de busca
**O que faz:** campo que anuncia "Buscar por titulo, artista ou letra...".
**Como acessar:** Repertorio → "Minhas cifras".
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/core/search.js`; rotulo lido do DOM.

### Busca por titulo
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `Search.buscar`; "O Senhor e o Meu Pastor" devolvio 1 resultado correto.

### Busca por artista
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/core/search.js` (indice inclui `artista`); 3 resultados corretos.

### Busca por letra e tags e observacoes
**Estado:** IMPLEMENTADA.
**Evidencia:** indice inclui `letra`, `tags`, `obs`, `categoria`, `tom`.

### Busca sem acento
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `normalizeText`; "Gloria" achou "GLORIA AO SENHOR".

### Busca sem diferenciar caixa
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** "AMAZING GRACE" achou "Amazing Grace".

### Busca com erro de digitacao
**O que faz:** tolera troca de letras e vizinhanca, com distancia limitada.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `Search.boundedEditDistance`, `isAdjacentSwap`; "O Sennhor" achou a musica certa.

### Sugestoes
**Estado:** IMPLEMENTADA.
**Evidencia:** `Search.sugerir`.

### "Nada encontrado"
**O que faz:** estado vazio honesto quando a busca nao acha nada.
**Estado:** IMPLEMENTADA E VALIDATA.
**Evidencia:** mensagem lida noDOM.

### Aquecimento do indice
**Estado:** IMPLEMENTADA.
**Evidencia:** `Search.aquecerIndice`; evita que a primeira tecla pague a construcao do indice.

---

## 12. BACKUP / IMPORTACAO / EXPORTACAO

### Exportar backup
**O que faz:** gera um arquivo JSON com todo o estado.
**Como acessar:** Ajustes → exportar.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/core/store.js` (`exportar`); 10.069 bytes gerados.

### Importar backup
**O que faz:** le o arquivo e devolve os dados.
**Como acessar:** Ajustes → importar.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `Store.importar`; exportar → apagar → importar devolveu estado identico.

### Validacao do arquivo importado
**O que faz:** rejeita conteudo invalido antes de gravar.
**Estado:** IMPLEMENTADA.
**Evidencia:** `Store.importar`; `tools/test-musica.js` e afins.

### Modos de importacao
**O que faz:** mesclar com o que ja existe.
**Estado:** IMPLEMENTADA.
**Evidencia:** `Store.importar(json, modo)`.

### Preservacao da ordem do repertorio
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** ordem identica apos exportar → apagar → importar.

### Preservacao de metadados e IDs
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** IDs e metadados conferidos byte a byte no teste.

### Preservacao de audio
**Estado:** NAO CONFIRMADO. Ver categoria 7.

### Compartilhar por WhatsApp (texto)
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/share.js` (`texto`).

### Calendario `.ics`
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/share.js` (`ics`, `baixarIcs`, `dataIcs`, `duracaoIcs`).

### Link / QR da equipe
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/share.js` (`linkDaEscala`).

### Folha para PDF
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/print.js` (`folhaEscala`).

### Imprimir lista do repertorio
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/repertorio.js` (`imprimirLista`).

---

## 13. ARMAZENAMENTO / PERSISTENCIA

### localStorage
**O que faz:** guarda o estado inteiro sob a chave `acorde_v4`.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `js/core/store.js` (`STORAGE_KEY`, `carregar`, `salvar`, `gravar`).

### Persistencia entre recargas
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** reload real preservou 20 cifras, 1 evento e 10.720 bytes.

### Persistencia apos fechar
**Estado:** IMPLEMENTADA E VALIDADA (como recarga do navegador).
**Evidencia:** ver secao de recuperacao.

### Migracao de esquema
**O que faz:** versao do modelo (`SCHEMA=4`) com normalizacao na leitura.
**Estado:** IMPLEMENTADA.
**Evidencia:** `Store.normCifra`, `normEscala`, `normMusica`, `normEstudo`, `normAnotacao`, `normVsCapitulo`.

### Limite de tamanho (4,5 MB)
**O que faz:** cota do estado gravado.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `Store.MAX_BYTES`, `tools/test-quota-vs.js`.

### Tratamento de cota cheia
**O que faz:** guarda o motivo da falha (`cheio`, `erro`, ou nada) e a tela reage em cima disso.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `Store.ultimoErro`, `espacoParaGravacao`, `tools/test-pendencia-vs.js`.

### Estado do armazenamento (uso, cota, persistente, instalado)
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/armazenamento.js` (`estado`, `nivel`, `titulo`, `texto`).

### Recuperacao apos fechar
**O que faz:** recarregar devolve os dados e **nao** restaura sessao de execucao nem transpose.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `execucaoAtiva: false`, 0 folhas, tom inicial "C" apos reload.

---

## 14. PWA

### Manifest
**Estado:** IMPLEMENTADA.
**Evidencia:** `manifest.webmanifest` — name, short_name, description, lang, dir, start_url, scope, id, display, orientation, cores, 4 icones, 3 shortcuts.

### Service Worker
**Estado:** IMPLEMENTADA.
**Evidencia:** `sw.js` — eventos install, activate, fetch, notificationclick, message.

### Cache de recursos (47 itens)
**O que faz:** guarda 35 scripts, 3 folhas de estilo e 9 outros recursos; falha inteira se um faltar.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `sw.js` (`RECURSOS`, `addAll`); 53 entradas no cache.

### skipWaiting e clients.claim
**Estado:** IMPLEMENTADA.
**Evidencia:** `sw.js`.

### Limpeza de cache antigo
**Estado:** IMPLEMENTADA.
**Evidencia:** `sw.js` (`cache.delete`).

### Atualizacao do app
**O que faz:** detecta versao nova e recarrega.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/app.js` (`atualizarServiceWorker`).

### Cache de bibliotecas externas
**Estado:** NAO EXISTE. Nao ha CDN no produto; as 24 icones renderizam de recursos locais.
**Evidencia:** `sw.js` sem dominios externos; medido em V5.19.

### Installacao do app
**Estado:** IMPLEMENTADA, NAO VALIDADA — exige gesto do usuario e ambiente instalavel.
**Evidencia:** manifest pronto; instalacao nunca executada.

### Abertura standalone
**Estado:** NAO CONFIRMADA. `display: standalone` esta declarado; a abertura real nunca foi exercitada.
**Evidencia:** `manifest.webmanifest`.

###atalhos do manifest
**Estado:** IMPLEMENTADA.
**Evidencia:** 3 shortcuts: Novo evento, Repertorio, Transpor.

---

## 15. OFFLINE

### Funcionar sem servidor (navegador)
**O que faz:** com a origem desligada, o app abre, o repertorio abre, a musica abre, a execucao anda e o transpose funciona.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** servidor derrubado (`Impossivel conectar-se ao servidor remoto`), pagina recarregada, fluxo completo rodando.

### Cache Servido ao abrir
**Estado:** IMPLEMENTADA.
**Evidencia:** 53 entradas; icones renderizados.

### Busca offline
**Estado:** IMPLEMENTADA (a busca e local, sobre o estado em memoria).
**Evidencia:** `js/core/search.js` nao usa rede.

### Notificacoes offline
**Estado:** PARCIAL — o agendador depende do Notification API e de o app estar aberto.
**Evidencia:** `js/core/notify.js`.

### Offline no aplicativo instalado
**Estado:** NAO CONFIRMADO — depende da instalacao, nunca exercitada.

---

## 16. FOTOS / IMAGENS / ANOTACOES

### Anexar foto da cifra
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/repertorio.js` (`escolherFoto`, `pintarFoto`).

### Anexar foto do evento
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/palco.js` (`mostrarFoto`), folha do evento.

### Desenhar sobre a foto (Estudio)
**O que faz:** pincel sobre a foto da cifra, com desfazer e refazer.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/studio.js` (`criarPincel`, `comecar`, `mover`, `terminar`, `desfazer`, `refazer`, `limpar`).

### Exportar o desenho
**Estado:** IMPLEMENTADA.
**Evidencia:** `Studio.exportar`.

### Anotacoes com hora
**O que faz:** anotacoes com marcacao de tempo, ligadas ao metronomo.
**Estado:** IMPLEMENTADA.
**Evidencia:** `Store.normAnotacao`, `js/views/palco.js` (`blocoObs`), CSS "as anotacoes com hora".

### Pular para anotacao
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/palco.js` (`Pular para`).

### Apagar anotacao
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/palco.js` (`Apagar anotação`).

### Link de video do YouTube na cifra
**O que faz:** cola o link, valida o id e mostra o video ao lado.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/links.js` (`YT_ID`, padroes), `js/views/cancao.js` (`fonte`, `reguaCompasso`).

---

## 17. AJUSTES

Todas as chaves lidas e gravadas por `js/views/ajustes.js`:

| Ajuste | Estado |
|---|---|
| Cor do app (`accent`) | IMPLEMENTADA |
| Tema (`tema`) | IMPLEMENTADA |
| Densidade (`densidade`) | IMPLEMENTADA |
| Tamanho do texto (`fontsize`) | IMPLEMENTADA |
| Movimento (`motion`) | IMPLEMENTADA |
| Notificacoes (`notificacoes`) | IMPLEMENTADA |
| Antecedencia do lembrete (`antecedenciaNotif`) | IMPLEMENTADA |
| Inicio da semana (`inicioSemana`) | IMPLEMENTADA |
| Notacao de acordes (`usarAmoles`) | IMPLEMENTADA |
| Abrir links automaticamente (`autoLink`) | IMPLEMENTADA |
| Instrumento padrao (`instrumento`) | IMPLEMENTADA |

**Evidencia:** `js/views/ajustes.js` (`linhaChave`, `secao`, `secaoInstrumento`).

**Acoes de dados em Ajustes:** exportar, importar, apagar tudo, ver estado do armazenamento e ver quanto cabe de audio. **Nao contam como itens novos** — as quatro primeiras ja sao as entradas 101, 102 e 119, e a quinta e o item 69. Ver a secao "As 5 acoes de dados de Ajustes que NAO contam", no resumo deste documento.
**Evidencia:** `exportar`, `importar`, `apagar`, `marcarBackup`.

---

## 18. ACESSIBILIDADE

### Nome acessivel nos controles
**O que faz:** `aria-label` nos botoes de acao sem texto util.
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** "Sair da execucao", "Subir um semitom", "Descer um semitom", "Musica anterior", "Proxima musica", "Tirar do repertorio" — todos conferidos no DOM.

### Botoes desabilitados nas pontas
**Estado:** IMPLEMENTADA E VALIDATA.
**Evidencia:** Anterior desabilitado na primeira musica; verificado que nao executa acao.

### Foco visivel
**O que faz:** regra `:focus-visible` declarada na folha de estilo.
**Estado:** IMPLEMENTADA. **O anel visual em si nao foi medido** (getComputedStyle com foco programatico nao reproduz o estado real).
**Evidencia:** folha de estilo tem regras `:focus-visible`.

### Live region no tom
**Estado:** IMPLEMENTADA.
**Evidencia:** `aria-live="polite"` no indicador de tom.

### `prefers-reduced-motion`
**Estado:** IMPLEMENTADA.
**Evidencia:** ajuste `motion` em Ajustes.

### Alvos de toque de 44 px
**Estado:** IMPLEMENTADA.
**Evidencia:** `.ex-botoes` em `css/features.css`.

### Navegacao por teclado
**Estado:** IMPLEMENTADA, NAO VALIDADA. ENTER e Space exigem evento confiavel; nao existe como fabricar um. **Nao marcar como validada.**

---

## 19. SEGURANCA / VALIDACOES

### Escape de HTML
**Estado:** IMPLEMENTADA.
**Evidencia:** `Utils.esc`; `tools/check-escape.js`.

### Validacao de importacao
**O que faz:** rejeita JSON invalido.
**Estado:** IMPLEMENTADA.
**Evidencia:** `Store.importar`; commit `d5bdbec` ("harden import validation and duplicate IDs").

### Protecao contra IDs duplicados
**Estado:** IMPLEMENTADA.
**Evidencia:** mesmo commit.

### Validacao de link do YouTube
**O que faz:** quatro formatos de link aceitos, com o id extraido por padrao e nao por busca solta.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/links.js` (`YT_FORMAS`).

### Limite de importacao (LIMITE)
**O que faz:** tamanho maximo aceito.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/store.js` (`limite`, `livre`).

### Aviso honesto quando o limite e' atingido
**Estado:** IMPLEMENTADA E VALIDADA.
**Evidencia:** `Store.ultimoErro`; a tela distingue "cheio" de "erro".

---

## 20. OUTRAS FUNCIONALIDADES EXISTENTES

### Metronomo
**O que faz:** BPM, compasso, subdivisao, acento, som, volume, contagem de batida, tap tempo.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/metronome.js` (`iniciar`, `definir`, `bpmEfetivo`, `tapTempo`, `destravar`).

### Tocar o compasso
**O que faz:** toca o compasso do andamento.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/palco.js`, `js/views/cancao.js`.

### Tocar notas sintetizadas
**O que faz:** toca notas para ouvir acorde e escala.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/audio.js` (exporta como `Nota`, para nao colidir com o construtor `Audio` do navegador).

### Colar cifra
**O que faz:** traz uma cifra de link externo.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/repertorio.js` (`colar`, `colado`).

### Analise automatica do tom
**O que faz:** detecta o tom de uma cifra colada.
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/views/repertorio.js` (`analisar`), `Music.resumoDeTons`.

### Links para fontes externas
**O que faz:** leva a Cifra Club, Ultimate Guitar, Chordify, Letras.mus.br, Vagalume, YouTube, Spotify, Deezer e Apple Music.
**Estado:** IMPLEMENTADA. **Nenhuma foi clicada neste ambiente** (os hosts responderam 403 ao fetch).
**Evidencia:** `js/core/links.js`.

### Imagem de fundo animada
**Estado:** IMPLEMENTADA.
**Evidencia:** `js/core/cena.js` (`acordar`, `animar`, `parar`, `ajustar`, `destruir`).

---

# MAPA DE TELAS

```
HOME (Hoje)
|-- PRÓXIMO · HOJE ....... evento de hoje, com as musicas por tom
|-- Estatísticas .......... nº de cifras / musicas / ensaios
|-- Tons que você mais toca
|-- Atalhos ............... Evento · Cifra · Afinador · Colar · Braco
|-- FERRAMENTAS ........... Metrônomo · Transpor · Acordes · Círculo das quintas
`
HOME (Agenda)
|-- Calendario do mes
|-- Cartoes de evento ..... tocar abre a folha do evento
|-- Estoque ............... musicas fora do repertorio

REPERTORIO
|-- "Minhas cifras" ....... lista, busca, filtro por tom, cartoes
`-- "Repertório pronto" ... base de cifras que vem com o app

TEORIA
|-- Placa do acorde
|-- Deduplicado / dedilhado
|-- Painel de acordes ...... formas e diagramas por qualidade
|-- Painel de escalas ...... escala no traste
|-- Circulo das quintas
|-- Transpor .............. transposicao de qualquer texto
`-- Metronomo

AFINADOR
|-- Visor de nota, frequencia e cents
|-- Agulha de desvio
`-- Nota de referencia (La)

AJUSTES
|-- Aparencia ............. cor, tema, densidade, tamanho do texto, movimento
|-- Musica ................ notacao de acordes, instrumento, links automaticos
|-- Agenda ................ inicio da semana, lembretes
`-- Dados ................. exportar, importar, apagar, espaco, backup

MESA DE ENSAIO (folha, sobre qualquer musica)
`-- Video · foto · anotacoes · narração · metrônomo · rolagem · Beginning

EXECUCAO (folha, sobre a mesa)
|-- Barra: titulo · posicao · tom · transpor · sair
`-- Navegação: Anterior · Próxima

```

---

# FLUXOS PRINCIPAIS

| # | Fluxo | Caminho | Estado |
|---|---|---|---|
| 1 | Criar musica | Home → Cifra → preencher → salvar | VALIDADO |
| 2 | Encontrar musica | Repertorio → Minhas cifras → buscar → abrir | VALIDADO |
| 3 | Editar musica | cartao → Editar → salvar | IMPLEMENTADO |
| 4 | Criar repertorio | Home → Evento → preencher → salvar | VALIDADO |
| 5 | Adicionar musicas | evento → Do repertorio | VALIDADO |
| 6 | Iniciar repertorio | evento → Começar | VALIDADO |
| 7 | Transpor | + / − / Original | VALIDADO |
| 8 | Avancar / voltar | Proxima / Anterior | VALIDADO |
| 9 | Lidar com orfa | aviso → Tirar do repertorio | VALIDADO |
| 10 | Sair | X na barra → 2 acoes para retomar | VALIDADO |
| 11 | Backup | Ajustes → Exportar | VALIDADO |
| 12 | Restaurar | Ajustes → Importar | VALIDADO |
| 13 | Offline | sem servidor → app inteiro | VALIDADO (navegador) |
| 14 | Gravar VS | mesa → gravar → parar → salvar | **NAO VALIDADO** |
| 15 | Afinador | Afinador → permitir microfone | **NAO VALIDADO** |
| 16 | Teoria | Teoria → painel | IMPLEMENTADO |
| 17 | PWA instalar | instalar → abrir pelo icone | **NAO VALIDADO** |

---

# RESUMO EXECUTIVO

## Como este documento conta

Antes de qualquer numero, a regra. Um documento que mostra tres totais
diferentes nao informa: distrai. Ate a V5.24 ele mostrava tres, porque os tres
foram escritos de memoria, em tres momentos diferentes, e nenhum foi
conferido contra o proprio arquivo.

A regra adotada aqui, e unica:

> **ITEM CATALOGADO** = uma capacidade nomeada no documento, com titulo
> proprio e estado proprio. Isso inclui funcionalidade de usuario, etapa de
> uma funcionalidade, propriedade observada, protecao e infraestrutura.
>
> **FUNCIONALIDADE DE USUARIO** = o item que a pessoa faz, abre, ve ou recebe.
> O que nao e: mecanismo interno, protecao, propriedade que so se observa,
> e infraestrutura.

Nenhum item foi apagado para o numero fechar. Os tecnicos continuam
catalogados, com o mesmo estado, e apenas sao contados na coluna certa.

## Totais

```
CATEGORIAS ................................ 20
ITENS CATALOGADOS ........................ 173
  dos quais TECNICOS ..................... 36
FUNCIONALIDADES DE USUARIO ............... 137
```

**Fechamento:**

```
ITENS CATALOGADOS = 137 (usuario) + 36 (tecnicos) = 173
SOMA DOS ESTADOS  = 54 + 99 + 14 + 1 + 4 + 1 = 173
CONFERENCIA      = 173 (igual ao total de itens: OK)
```

## Estado

| Estado | Quantidade |
|---|---|
| IMPLEMENTADA E VALIDADA | 54 |
| IMPLEMENTADA | 99 |
| IMPLEMENTADA, NAO VALIDADA | 14 |
| PARCIAL | 1 |
| ACESSO NAO CONFIRMADO | 4 |
| NAO EXISTE | 1 |
| **Total** | **173** ||| **54** 

### Por categoria

| Categoria | Itens | Tecnicos | Func. de usuario | Validadas | Observacao |
|---|---|---|---|---|---|
| 1. NAVEGACAO E INTERFACE | 8 | 0 | 8 | 4 | Atalhos de teclado nao executados |
| 2. MUSICAS / CIFRAS | 16 | 0 | 16 | 4 | Campos existem e persistem |
| 3. BIBLIOTECA | 5 | 1 | 4 | 1 | Importar da base nao exercitada |
| 4. REPERTORIOS / EVENTOS | 12 | 0 | 12 | 7 | Lembretes dependem do sistema |
| 5. MODO DE EXECUCAO | 8 | 1 | 7 | 8 | Validada por inteiro |
| 6. TRANSPOSE | 8 | 2 | 6 | 7 | 1 P3 no rotulo do tom |
| 7. AUDIO / VS | 12 | 4 | 8 | 0 | Microfone negado no ambiente |
| 8. AFINADOR | 5 | 0 | 5 | 0 | Captura nao exercitada |
| 9. TEORIA MUSICAL | 10 | 1 | 9 | 1 | Conversor sem rota confirmada |
| 10. INSTRUMENTOS / 3D | 6 | 3 | 3 | 0 | 1 P3 de nomenclatura |
| 11. BUSCA | 10 | 1 | 9 | 7 | A categoria mais validada do produto |
| 12. BACKUP / IMPORTACAO / EXPORTACAO | 12 | 4 | 8 | 4 | Audio fora do confirmado |
| 13. ARMAZENAMENTO / PERSISTENCIA | 8 | 7 | 1 | 6 | Quase toda infraestrutura |
| 14. PWA | 9 | 6 | 3 | 1 | Instalacao nunca executada |
| 15. OFFLINE | 5 | 1 | 4 | 1 | Instalado nao exercitado |
| 16. FOTOS / IMAGENS / ANOTACOES | 8 | 0 | 8 | 0 | — |
| 17. AJUSTES | 11 | 0 | 11 | 0 | Todas as chaves existem |
| 18. ACESSIBILIDADE | 7 | 0 | 7 | 2 | Teclado nao validado |
| 19. SEGURANCA / VALIDACOES | 6 | 5 | 1 | 1 | Quase so protecoes |
| 20. OUTRAS FUNCIONALIDADES EXISTENTES | 7 | 0 | 7 | 0 | Fontes externas nunca clicadas |
| **Total** | **173** | **36** | **137** | **054** | |

### Os itens tecnicos, nome a nome

Nao somam funcionalidade de usuario porque descrevem **como** o produto funciona,
nao **o que** a pessoa faz com ele. Continuam catalogados, com o mesmo estado.

- **Categoria 3:** Metricas da biblioteca
- **Categoria 5:** Isolamento de estado entre musicas
- **Categoria 6:** Sem drift em varios passos; Circulo de 12 semitons
- **Categoria 7:** VS isolado por musica; VS apos fechar e reabrir; VS no backup; Calculo honesto de espaco
- **Categoria 9:** Modos e graus
- **Categoria 10:** Formas canonicas (CAGED) por qualidade; Afinação e cordas; Traste para nota
- **Categoria 11:** Aquecimento do indice
- **Categoria 12:** Validacao do arquivo importado; Preservacao da ordem do repertorio; Preservacao de metadados e IDs; Preservacao de audio
- **Categoria 13:** localStorage; Persistencia entre recargas; Persistencia apos fechar; Migracao de esquema; Limite de tamanho (4,5 MB); Tratamento de cota cheia; Recuperacao apos fechar
- **Categoria 14:** Manifest; Service Worker; Cache de recursos (47 itens); skipWaiting e clients.claim; Limpeza de cache antigo; Cache de bibliotecas externas
- **Categoria 15:** Cache Servido ao abrir
- **Categoria 19:** Escape de HTML; Validacao de importacao; Protecao contra IDs duplicados; Validacao de link do YouTube; Limite de importacao (LIMITE)

### As 5 acoes de dados de Ajustes que NAO contam

A categoria 17 lista, alem dos 11 ajustes, cinco acoes de dados: exportar,
importar, apagar tudo, ver estado do armazenamento e ver quanto cabe de audio.

**Essas cinco nao sao itens novos.** As quatro primeiras ja estavam catalogadas:
exportar e importar sao as entradas 101 e 102 (categoria 12); ver estado do
armazenamento e a entrada 119 (categoria 13); ver quanto cabe de audio e o item
69 (categoria 7). Somar aqui contaria a mesma funcionalidade duas vezes.

Por isso a categoria 17 tem **11** itens, e nao 16.

## O que o resumo diz

O produto esta **dividido em dois**:

- **O que tem prova:** navegacao, eventos, execucao, transpose, busca, backup de
  metadados, armazenamento e offline no navegador.
- **O que so tem codigo:** tudo que depende de **microfone** (VS, afinador) e
  tudo que depende de **instalar** (PWA). Nenhuma dessas foi exercitada, todas
  pela mesma razao — o ambiente nega permissao e nao instala aplicativo.

Nenhuma delas e `NAO EXISTE`. Todas tem codigo. Nenhuma foi comprovadamente
quebrada.

---
