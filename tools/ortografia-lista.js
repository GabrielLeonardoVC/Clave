/* =========================================================
   ACORDE - tools/ortografia-lista.js

   As palavras que este projeto mostra na tela e que perdem o acento quando
   escritas sem.

   Lista, e nao objeto: uma entrada por linha, "sem-acento = com-acento". E mais
   seguro de manter do que um objeto grande com duas colunas, onde um erro de
   digitacao nao aparece como erro de sintaxe — aparece como uma palavra
   estranha no meio das outras. Duas vezes isso aconteceu aqui.

   Duas regras que o verificador depende e que por isso valem:

     - a chave (o lado esquerdo) vai SEM ACENTO. E contra ela que a busca
       acontece, sobre um texto ja sem acento; uma chave acentuada nunca
       encontraria nada e nao acusaria erro nenhum;
     - o valor (o lado direito) vai COM ACENTO, e e o que o relatorio mostra
       como sugestao de correcao.

   O que NAO entra aqui:

     - palavra que nao leva acento (`bloco`, `estreia`, `plateia`). Uma entrada
       dessas nunca encontra nada e so ocupa lugar. O verificador recusa a lista
       se aparecer alguma;
     - palavra que, sem acento, e outra palavra valida ("esta" pronome, "so"
       preposicao, "ja" ja adverbio, "por", "la", "ha", "re"). Acusar essas
       daria falso positivo em quase toda frase, e depende de leitura humana;
     - o portugues inteiro. Esta e a lista do vocabulario deste app.

   Um verificador que acusa coisa errada e pior do que nenhum: a pessoa para
   de olhar a saida, e um defeito real passa junto.
   ========================================================= */
'use strict';

const BRUTO = `
gravacao = gravação
observacao = observação
observacoes = observações
informacao = informação
configuracao = configuração
configuracoes = configurações
selecao = seleção
transposicao = transposição
vibracao = vibração
ressonancia = ressonância
funcao = função
funcoes = funções
execucao = execução
acao = ação
acoes = ações
atencao = atenção
duracao = duração
versoes = versões
opcao = opção
opcoes = opções
regiao = região
secao = seção
posicao = posição
condicao = condição
equacao = equação
frequencia = frequência
experiencia = experiência
referencia = referência
referencias = referências
diferenca = diferença
diferencas = diferenças
preferencia = preferência
preferencias = preferências
conferencia = conferência
confianca = confiança
presenca = presença
aparencia = aparência
emergencia = emergência
silencio = silêncio
ciencia = ciência
consciencia = consciência
paciencia = paciência
vivencia = vivência
autorizacao = autorização
autenticacao = autenticação
validacao = validação
verificacao = verificação
importacao = importação
exportacao = exportação
migracao = migração
atualizacao = atualização
criacao = criação
remocao = remoção
correcao = correção
publicacao = publicação
anotacao = anotação
sincronizacao = sincronização
navegacao = navegação
afirmacao = afirmação
recuperacao = recuperação
construcao = construção
transicao = transição
traducao = tradução
apresentacao = apresentação
interpretacao = interpretação
repeticao = repetição
repeticoes = repetições
improvisacao = improvisação
organizacao = organização
interacao = interação
excecao = exceção
conexao = conexão
situacao = situação
sugestao = sugestão
exibicao = exibição
instalacao = instalação
aplicacao = aplicação
ocupacao = ocupação
codigo = código
codigos = códigos
formatacao = formatação

musica = música
musicas = músicas
musico = músico
musicos = músicos
publico = público
unico = único
unica = única
ultimo = último
ultima = última
proprio = próprio
propria = própria
tipico = típico
tipica = típica
basico = básico
basica = básica
pratico = prático
pratica = prática
praticas = práticas
teorico = teórico
teorica = teórica
acustico = acústico
acustica = acústica
eletrico = elétrico
eletrica = elétrica
dinamico = dinâmico
dinamica = dinâmica
armonico = harmônico
armonica = harmônica
melodico = melódico
melodica = melódica
ritmico = rítmico
ritmica = rítmica
metrico = métrico
metrica = métrica
metronomo = metrônomo
harmonizacao = harmonização
necessario = necessário
necessaria = necessária
multiplos = múltiplos
automatico = automático

area = área
areas = áreas
historia = história
memoria = memória
numero = número
numeros = números
titulo = título
titulos = títulos
capitulo = capítulo
angulo = ângulo
simbolo = símbolo
metodo = método
periodo = período
violao = violão
violoes = violões
vocabulario = vocabulário
dicionario = dicionário
criterio = critério
criterios = critérios
cancao = canção
estagio = estágio
pagina = página
paginas = páginas
grafico = gráfico
logico = lógico
historico = histórico
padrao = padrão
espaco = espaço
usuarios = usuários
mostruario = mostruário
responsavel = responsável
responsaveis = responsáveis

voce = você
voces = vocês
nao = não
tambem = também
apos = após
sera = será
serao = serão
estao = estão
ate = até
alem = além
atraves = através
possivel = possível
impossivel = impossível
facil = fácil
dificil = difícil
util = útil
inutil = inútil
proximo = próximo
proxima = próxima
proximos = próximos
proximas = próximas
saida = saída
saidas = saídas
saude = saúde
alcool = álcool
disponivel = disponível
indisponivel = indisponível
estudio = estúdio
invalido = inválido
valido = válido
audio = áudio
video = vídeo
tonica = tônica
tonico = tônico
repertorio = repertório
ambar = âmbar
lilas = lilás
esta2 = está
`;

/** Troca os acentos por letra neutra, para comparar. */
const MAPA = {
  'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a', 'é': 'e', 'ê': 'e', 'è': 'e',
  'ë': 'e', 'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i', 'ó': 'o', 'ô': 'o', 'õ': 'o',
  'ò': 'o', 'ö': 'o', 'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ç': 'c', 'ñ': 'n',
};

/** Depois de tirar o acento, falta acento? E o que decide se a entrada vale. */
const SEM_ACENTO = (s) => String(s).replace(/[áàãâäéêèëíìîïóôõòöúùûüçñÁÀÃÂÉÊÍÓÔÕÚÇ]/g, (c) => MAPA[c] || c);

const entradas = [];
const repetidas = [];
const acusadas = [];

for (const linha of BRUTO.split('\n')) {
  const t = linha.trim();
  if (!t || t.indexOf('=') < 1) continue;

  const partes = t.split('=');
  const de = partes[0].trim();
  const para = partes[1].trim();

  /* A chave precisa ir sem acento: a busca e feita sobre texto sem acento, e
     uma chave acentuada jamais encontraria a si mesma. */
  if (SEM_ACENTO(de) !== de) {
    acusadas.push({ chave: de, problema: 'a chave precisa ir sem acento' });
    continue;
  }
  /* A entrada precisa ser uma palavra que PERDE acento. `bloco = bloco` nunca
     encontra nada e so ocupa lugar. */
  if (SEM_ACENTO(para) === para) {
    acusadas.push({ chave: de, problema: 'esta palavra nao perde acento' });
    continue;
  }
  if (entradas.some((e) => e.de === de)) { repetidas.push(de); continue; }

  entradas.push({ de: de, para: para });
}

/* ------------------------------------------------------------
   Palavras que o app tambem usa como identificador.

   Estas aparecem na tela com acento E no codigo sem, como nome de campo, valor
   de enumeracao ou canal de aviso:

     `linha.tipo === 'secao'`   o valor e comparavel, nunca mostrado
     `S.mudou('musica')`        e um canal do armazenamento
     `{ nome: 'titulo' }`       e o nome de um campo, nao o rotulo

   Sem esta lista, o verificador acusaria codigo que esta certo. E o preco e
   conhecido: um rotulo de interface com UMA PALAVRA SO destas nao sera
   acusado. Nao existe nenhum no app, e o que existir precisa ser uma palavra
   so para valer a pena.
   ------------------------------------------------------------ */
const CODIGOS = [
  'secao', 'musica', 'musicas', 'titulo', 'titulos',
  'referencia', 'referencias', 'versao', 'versoes', 'opcao', 'opcoes',
  'categoria', 'compasso', 'andamento', 'gravacao', 'posicao', 'condicao',
  'funcao', 'funcoes', 'acao', 'acoes', 'atencao', 'duracao', 'vibracao',
  'frequencia', 'experiencia', 'silencio', 'aplicacao', 'atualizacao',
  'repeticao', 'apresentacao', 'interpretacao', 'improviso', 'improvisacao',
  'transposicao', 'anotacao', 'configuracao', 'configuracoes',
  'sugestao', 'situacao', 'conexao', 'excecao', 'interacao', 'organizacao',
  'traducao', 'revisao', 'transicao', 'construcao', 'navegacao',
  /* Identificadores que o codigo usa como chave e que nao aparecem na tela.
     `ir('repertorio')` e o id da rota; `campoVolume('video', ...)` e o nome
     da fonte de som. Sao grafados sem acento porque sao chave de objeto — o
     rotulo que aparece ao lado ("Vídeo") leva acento normalmente. */
  'repertorio', 'audio', 'video',

  /* Os ids dos instrumentos.
     *
     * `'violao'` e uma chave: vai para o `localStorage`, para o backup, para o
     * prefetch do service worker e para a comparacao da lista. Acentuar o id
     * significaria trocar o valor guardado — e perder a preferencia de quem
     * chose o instrumento, sem erro em lugar nenhum.
     *
     * O nome que a pessoa LÊ e outro, e leva acento normalmente: `nome: 'Violão'`.
     * Sao duas coisas, e e por isso que `Music.instrumento()` aceita o id com
     * acento e sem — para que um acento perdido num lugar nao vire um
     * instrumento trocado em silencio. */
  'violao', 'ukulele', 'cavaquinho', 'violino', 'baixo', 'baixo5',
];

/* ------------------------------------------------------------
   Regioes que sao DADO, e nao rotulo.

   Entram aqui as listas que o app consulta, e nunca mostra. Nao ha como
   reconhecê-las pelo formato: `PT_STOPWORDS` sao duzentas palavras minusculas
   de uma linha so, e um menu tem o mesmo aspecto. Declarar aqui e mais honesto
   do que inventar uma heuristica que erra.

   O que costuma estar nestas listas e o oposto de erro: sao justamente as
   palavras que PRECISAM ficar sem acento. O motor de cifra tira os acentos da
   letra antes de consultar, entao "proprio" com acento nunca seria encontrado e
   "proprio" viraria um acorde na letra.

   `marcador` e o trecho que identifica a regiao. A extensao vai ate o
   fechamento do colchete, contando profundidade — quando a lista cresce, a
   regiao cresce junto, sem ninguem editar este arquivo.
   ------------------------------------------------------------ */
const TABELAS = [
  {
    arquivo: 'js/core/music.js',
    marcador: 'const PT_STOPWORDS = new Set(',
    motivo: 'palavras que o motor de cifra consulta; precisa vir sem acento',
  },
  {
    arquivo: 'js/core/music.js',
    marcador: 'const INSTRUMENTOS = [',
    motivo: 'identificadores de instrumento; o rotulo ao lado tem acento',
  },
];

module.exports = {
  entradas: entradas,
  repetidas: repetidas,
  acusadas: acusadas,
  CODIGOS: CODIGOS,
  TABELAS: TABELAS,
  SEM_ACENTO: SEM_ACENTO,
};