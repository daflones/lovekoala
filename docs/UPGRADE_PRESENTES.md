# Análise do vídeo e atualização dos presentes

Referência recebida: `2026-10-18 09-30-57.mp4`, 5min16s, 1920×1080. A análise visual percorreu todo o intervalo em sequências de quadros a cada dois segundos, incluindo a saída final da gravação. O áudio não foi transcrito. O vídeo é referência de experiência; as artes e os componentes novos do LoveKoala são próprios.

## O que a referência mostra

| Intervalo aproximado | Experiência observada | Ideia de produto |
| --- | --- | --- |
| 00:00–00:18 | Alternância álbum/retrospectiva, prévias grandes e entrada pelos exemplos | Mostrar o produto em uso e facilitar a descoberta |
| 00:18–01:00 | Playlist, carrossel, ficha do casal, contador, cartão e marcos | Uma biblioteca de memórias com identidade de player musical |
| 01:00–01:36 | Edição em telas inteiras: capa tipográfica, minutos, números, música e pergunta do primeiro dia | Cada capítulo tem sua própria composição e ritmo |
| 01:36–01:58 | Calendário com data marcada, céu/lua, estação e transição para a jornada | Transformar informações em cenas, com revelações progressivas |
| 01:58–02:20 | Fotos empilhadas, lembranças e uma página de momento | Dar mais espaço às imagens e às legendas |
| 02:20–02:40 | Entrada do álbum, cenário de mesa, capa, sumário, relógio e carta | A abertura já faz parte do presente |
| 02:40–03:00 | Universo noturno, lua e jardim que responde aos cliques | Um cenário tem objetos com funções, em vez de apenas decoração |
| 03:00–03:22 | Cartas/fotos para revelar, cabine de fotos, biblioteca e varal | Oferecer descobertas e ampliar memórias |
| 03:22–03:42 | Roda/céu de encontros e cartões que abrem | Variação de escala, profundidade e movimento |
| 03:42–04:02 | Painel de fotos, bilhetes, pote de motivos e caixa musical | Conteúdo pessoal associado a objetos reconhecíveis |
| 04:02–04:20 | Cartas “abra quando” e quebra-cabeça com imagem | Dar uma ação clara a cada surpresa |
| 04:20–04:42 | Raspadinha, fotografia, câmera e mudança de iluminação | Alternar contemplação com interação |
| 04:42–05:04 | Globo, destinos, placas e cartões de viagem | Usar os sonhos do casal para compor uma página |
| 05:04–05:16 | Jogo de percurso, curiosidades e encerramento da gravação | Encerrar com participação e vontade de explorar de novo |

## O que entrou no LoveKoala

### Álbum

- Abertura com botão “Abrir nosso álbum”, capa com moldura e ambientação iluminada.
- Três cenários ilustrados próprios: jardim, ateliê e caminho entre nuvens. As imagens são fundos fixos do modelo; textos, fotos e ações são componentes reais.
- Jardim secreto em três regas: nasce a haste, aparecem as folhas e a flor se abre. A promessa/dedicatória fornecida aparece quando o jardim floresce.
- Cabine de fotos: selecionar até três imagens do próprio presente, revelar uma tirinha e baixar PNG. Não usa webcam. Com menos de três fotos, a composição repete as selecionadas para preencher os três quadros.
- Quebra-cabeça de nove peças com foto do presente. Troca por dois toques ou arraste no computador, dica, contagem de trocas, reinício e escolha de outra foto.
- Fotos do álbum abrem ampliadas, com navegação e ampliação adicional.
- Página de caminhos/sonhos, com placas preenchidas pelo conteúdo do casal.
- Carta, música, relógio, céu e sonhos receberam ambientação ilustrada; páginas de papel continuam intercaladas para dar contraste.
- As animações das novas cenas entram nas folhas visíveis. Folhas fora da dupla/página ativa ficam fora da navegação assistiva. O teclado também pode folhear pelo contêiner do livro.
- Exemplos ganharam atalhos para jardim, cabine e quebra-cabeça. A fixture completa tem 39 páginas; os seis exemplos de plano/formato têm 40 páginas de álbum.

O som de papel, a raspadinha, as cartas, os vales, os jogos anteriores e a música opcional na página musical continuam integrados. Regas, peças e escolha de fotos são estados da visita, sem gravar novas informações na conta.

### Retrospectiva

- Playlist preservada com uma entrada grande para **A nossa edição**.
- Edição em histórias com composições diferentes: capa/vinil, contador de minutos, fotos empilhadas, calendário real do primeiro mês, pergunta da data, números, selos de marcos, linha do tempo, carta, motivos, sonhos e final.
- Os conteúdos opcionais respeitam as seleções da retrospectiva. Partes sem informações são omitidas.
- Calendário usa a data informada e trata anos bissextos; números e marcos vêm da contagem de tempo existente. As comparações reais e os cálculos da ampliação estão em RETROSPECTIVA_COMPLETA.md; estimativas lúdicas e dados de demonstração são identificados. Não se inventam audições, medições cardíacas ou rankings de casais.
- Avanço automático, segmentos de progresso, pausa, navegação por botões, setas do teclado e gesto horizontal. Ao segurar o conteúdo, o avanço pausa; aba oculta também pausa.
- Carta e pergunta oferecem tempo para leitura/interação. A música fica no player oficial existente, aberto explicitamente.
- A preferência por reduzir movimento é respeitada nas animações e na abertura das folhas.

Os formulários de formato e as listas de recursos dos planos agora apresentam os novos conteúdos. Nenhum novo pagamento, preço, tipo de plano ou requisito de IA foi criado nesta atualização.

## Como experimentar

1. Abra os exemplos e selecione Álbum 3D.
2. Use os atalhos do jardim, da cabine e do quebra-cabeça; depois explore o restante pelo sumário.
3. Selecione Retrospectiva e clique em “Dar play na nossa edição”.
4. Para voltar à playlist, use o X no topo ou o botão final.

As mesmas interações usam os dados reais dos presentes criados pelos clientes. Os exemplos usam fotos e história ilustrativas.

## Artes e implementação

Artes criadas com a ferramenta integrada de geração de imagens, usadas como fundos fixos:

| Arquivo no projeto | Uso |
| --- | --- |
| `public/assets/scenes/moon-garden.webp` | Jardim e encerramento da edição |
| `public/assets/scenes/love-atelier.webp` | Mesa, cartas, relógio, música, cabine e quebra-cabeça |
| `public/assets/scenes/our-journey.webp` | Sonhos, caminhos e jornada |

Os três WebP somam aproximadamente 795 KiB. Prompts completos em `docs/ART_PROMPTS.md`. A geração de imagens pelos clientes continua pausada no produto.

Componentes principais: `KeepsakeScenes.tsx`, `MemoryLab.tsx`, `RetrospectiveStories.tsx`, `keepsake.mjs`, `keepsake-scenes.mjs` e `keepsake-upgrade.css`.

## Validação e limites

60 testes Node, TypeScript e SSR cobrem a atualização: calendário/fuso, respostas da data, conteúdo opcional, peças únicas/trocas/solução, jardim com três ações, visibilidade das folhas, recorte da tirinha e falhas de exportação. Os testes antigos de gestos verificam que botões/canvas não iniciam um arraste de folha. SSR também verifica os controles e as páginas dos seis exemplos.

O controle de navegador exigido pelo fluxo de publicação não está disponível. Não houve captura de tela do site nem teste físico de toque, áudio ou exportação em celular. Verificar no navegador depois de abrir a prévia/publicação; SSR e build validam estrutura e compilação. Fotos de fontes externas que bloqueiem exportação geram mensagem clara na cabine.

## Atualizar seu Git e EasyPanel

Copie os arquivos da pasta `lovekoala` do ZIP para o seu repositório local, preservando a pasta `.git` existente e sua configuração privada. Depois faça commit/push na branch usada pelo EasyPanel e execute o deploy. A ampliação seguinte também recebeu a migration 021 e Edge v26, já aplicadas no projeto Supabase. Não reaplicar migrations concluídas nem substituir secrets. Consulte RETROSPECTIVA_COMPLETA.md.

## Ampliação após rever os detalhes do vídeo

Veja RETROSPECTIVA_COMPLETA.md: 27 stories no exemplo, percentuais e posição por cidade reais, estimativa de dois corações com “sim nós calculamos isso!”, lua e estação calculadas, marcos datados, equivalência musical e interações completas. Os números de exemplo são identificados como ilustrativos; a comparação real surge somente com base suficiente.
