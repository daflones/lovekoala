# Fotos e navegação dos presentes

Refinamento de 18/10/2026, posterior à ampliação descrita em RETROSPECTIVA_COMPLETA.md. Esta atualização altera o frontend; não acrescenta migrations, cobranças ou alterações de credenciais. O backend permanece na Edge v26, com 21 migrations aplicadas.

## Retrospectiva

- Todas as fotos entram nos três capítulos de replay, divididas em grupos equilibrados e mantendo a ordem do presente. Antes, esses capítulos mostravam apenas as três primeiras fotos. O limite de cada plano continua valendo; a implementação suporta as 80 fotos do plano mais amplo.
- Cada replay tem foto inteira, legenda, anterior/próxima, miniaturas e acesso à galeria completa. O avanço automático percorre as fotos antes de mudar de capítulo; a barra representa o progresso do grupo inteiro. As setas do teclado e o gesto sobre a foto percorrem esse replay. Os controles inferiores continuam navegando entre capítulos.
- A galeria amplia a imagem e oferece miniaturas de todas as fotos. Ao abri-la, as histórias e a música são pausadas. Ao fechar, a leitura retorna ao mesmo capítulo e à mesma foto. Recomeçar a edição leva novamente à primeira foto de cada replay.
- Motivos, sonhos e marcos não são mais cortados depois do quinto item. Listas com mais de cinco itens ou textos longos deixam o avanço automático pausado para leitura. Cartas, lugares, conquistas, vales, quiz e jogos também têm tempo livre.
- Cartas abertas, vales revelados e respostas do quiz permanecem ao sair de um capítulo e voltar durante a mesma visita à edição. Esse estado é local à edição aberta; não grava respostas ou resgates permanentes no banco.
- O exemplo completo continua com 27 stories. A quantidade de capítulos reais depende do conteúdo, das escolhas da pessoa e da disponibilidade de estatísticas.

## Álbum

O botão **Explorar páginas** abre um índice com miniaturas, número e título das páginas. É possível buscar por palavras ou número, filtrar por fotos, cartas, surpresas ou história e abrir diretamente uma folha. A busca ignora acentos e combina as palavras informadas. O seletor compacto e as setas continuam disponíveis.

Foi corrigida a materialização das folhas no livro 3D. React 19 pode colocar um `link rel="preload" as="image"` antes da página produzida por `renderToStaticMarkup`. Usar `firstElementChild` selecionava esse recurso em vez da folha e podia omitir páginas com fotos. `createAlbumPage` agora seleciona explicitamente `.album-page` antes de entregar os elementos ao PageFlip. A verificação estrutural confere as 39 folhas da fixture completa, incluindo capa e fotografias; os exemplos expandidos têm 40 folhas.

O índice usa os títulos e imagens que realmente existem nas folhas, sem duplicar o conteúdo do presente em um catálogo separado. A página atual fica identificada. Os controles do livro ficam inativos enquanto um diálogo de leitura está aberto.

## Celular e acessibilidade

Miniaturas e categorias têm rolagem horizontal; o índice usa duas colunas em telas pequenas, três em tablets e quatro em telas maiores. Diálogos respeitam a altura disponível e as áreas seguras. Os novos botões principais têm alvos de pelo menos 44 px. Movimento reduzido desativa as novas animações e a rolagem animada. Busca, fotos e saltos de página recebem rótulos; os diálogos mantêm foco e fechamento por Escape.

## Leitura, galeria e diálogos

A playlist da retrospectiva respeita o tempo de leitura e de interação. Cartas, quiz, vales, lugares, conquistas, jogos, estatísticas e textos/listas longos mostram **No seu tempo**; a pessoa segue pelo botão Próximo. O avanço também fica suspenso na lista de capítulos, ao abrir a fila, em diálogos, ao segurar o conteúdo e enquanto a aba está oculta. A música continua com seus controles próprios; abrir a galeria, um jogo ou uma carta em diálogo pausa a reprodução e fecha o player.

O carrossel da playlist ganhou **Ver inteira**, abrindo a mesma galeria usada pelo álbum e pelos stories. Um gesto horizontal sobre a imagem troca a foto. Rolagem vertical, movimento diagonal, gesto curto, imagem ampliada ou rolagem da faixa de miniaturas não acionam essa troca. As setas e as miniaturas continuam disponíveis. Na galeria, Home e End vão à primeira e à última foto.

O controle de foco dos leitores passou a usar uma pilha por documento. Escape fecha apenas o diálogo do topo, Tab permanece nele e a página só recupera a rolagem quando o último leitor fecha. Atualizar a tela não reinstala o diálogo nem manda o foco de volta ao começo. Ao fechar, o foco retorna ao controle anterior disponível. Não são incluídos listeners para diálogos ausentes.

## Verificação

Passaram TypeScript, **72 testes Node**, SSR e os testes estruturais de DOM com LinkeDOM. Os cinco testes da etapa anterior cobrem todas as quantidades de fotos de 1 a 80 sem perdas ou repetições, progresso do replay, leitura de conteúdo longo, busca/categorias e estado idempotente de visita. A suíte SSR/DOM usa a função real de criação das folhas para reproduzir a regressão de preload do React 19, verifica as 39 folhas e o índice, as 80 imagens nos replays, listas completas e estado controlado de cartas/quiz/vales.

LinkeDOM é dependência de desenvolvimento para essa verificação estrutural; não é um navegador e não entra no código de produção. Não houve revisão visual em navegador, gesto físico ou reprodução de áudio em celular nesta rodada. Esses testes precisam ser feitos nos aparelhos após abrir a prévia ou hospedar no EasyPanel.

Sete regressões adicionais cobrem as condições de avanço da playlist, o mapeamento de capítulos para leitura livre, os gestos de foto e a pilha de leitores: Escape no topo, remoção fora de ordem, rolagem, foco, Tab e diálogos sem controles. O SSR verifica o botão de ampliar e a galeria com indicação da foto selecionada.
