# Stories, números e comparações do LoveKoala

Atualização de 18/10/2026. O vídeo foi revisto em quadros de resolução integral nos trechos de 00:34, 00:40, 01:06, 01:18–01:20, 01:26 e 01:48. Foram confirmados o TOP percentual, a posição por cidade, os carimbos com datas, os batimentos, a fita musical com equivalência de tempo e a apresentação em stories. As composições, cores, código e desenhos do LoveKoala são próprios.

## Experiência entregue

O exemplo completo tem **27 stories**: abertura, minutos, lugar/encontro, três cenas de foto, calendário, pergunta da data, números, dois corações, passaporte de marcos, comunidade, cidade, fita musical, lua, estação, linha do tempo, lugares, conquistas, carta, motivos, sonhos, cartas para abrir, vales, quiz, jogos e encerramento. Campos vazios e capítulos desmarcados são omitidos; a quantidade do presente real varia.

Há índice para navegar diretamente, botões anterior/próximo, teclado, gesto horizontal, pausa ao segurar e ao ocultar a aba. Carta, listas e interações têm tempo livre. Abrir jogos pausa o avanço e retoma a mesma história ao fechar. Botões e formulários não iniciam um gesto de trocar story. A preferência de movimento reduzido desliga as animações. Astronomia e componentes adicionais são carregados quando a edição é aberta.

A playlist anterior continua com até 17 capítulos. Em **Exemplos → Retrospectiva → Dar play na nossa edição**, o índice permite ir diretamente a “Dois corações no mesmo ritmo”, “A nossa história na comunidade” e “Um amor na nossa cidade”.

## Contas e significados

| Recurso | Regra |
| --- | --- |
| Relógio | Instante inicial em Brasília, horário informado ou 00:00. Recalcula do instante original, sem acumular atraso de abas suspensas. Segundos continuam avançando. |
| Batimentos | `floor(segundos / 60 × 72 × 2)`. Dois corações; 72 bpm é uma hipótese lúdica, não frequência medida ou média individual inferida. A tela explica a estimativa e mostra **“sim nós calculamos isso!”**. |
| Fins de semana | Conta somente intervalos completos de sábado 00:00 a segunda 00:00 em UTC−03. Não afirma que o casal esteve fisicamente junto durante eles. |
| Luas cheias | Enumera as passagens astronômicas pela fase de 180° entre início e abertura da edição, usando Astronomy Engine 2.1.19. Não divide os dias por um mês lunar médio. |
| Lua do primeiro dia | Fase e fração iluminada calculadas para a data/hora inicial. A orientação do desenho é decorativa; não é fotografia nem mapa do céu local. |
| Estação | Equinócios/solstícios do ano, com estações do Hemisfério Sul. Mudanças de estação contam eventos no período. Para personalização internacional futura, acrescentar hemisfério. |
| Marcos | Limiares de dias decorridos, com data, carimbos e progresso entre o último e o próximo marco. Não substituir 365 dias por aniversário civil em ano bissexto. |
| Música em repeat | `floor(segundos juntos / duração real da faixa)`. Só aparece depois que o player informar duração válida. É uma equivalência hipotética, não histórico de audições. YouTube continua no player oficial visível. |

Astronomia é calculada para relações de até 100 anos. Textos extensos continuam roláveis. Carta, quiz, vales revelados e resultados de jogos são estados desta visita; não mudam a conta, a cobrança ou o conteúdo salvo.

## Comunidade e cidade

- O endpoint `couple_stats` chama `lk_story_stats(integer,text,text)` exclusivamente pelo backend.
- Considera presentes publicados, não suspensos, não congelados, não excluídos e com acesso vigente, inclusive `infinity`.
- Somente nomes e data válidos entram. Deduplica o par de nomes normalizados (ordem indiferente) + data de começo; entre vários presentes desse par/data, usa o mais recentemente atualizado. Não é verificação de identidade civil: homônimos com a mesma data podem coincidir.
- Com menos de **20 relações elegíveis**, retorna apenas `{"available":false}`. A comparação e o story não aparecem; não há aviso de espera nem autorização de participação no criador ou no presente.
- O percentual conta relações com duração estritamente menor e arredonda para 5 pontos percentuais. O TOP usa o complemento, arredondado para cima em blocos de 5; mínimo visual TOP 5%. A legenda delimita a base à comunidade LoveKoala. Isso não representa todos os casais brasileiros, probabilidade de separação ou sobrevivência futura.
- A comparação local exige **20 relações na mesma cidade e UF**. Posição = 1 + número de relações com maior duração; empates dividem posição. A base local pequena não expõe contagem, posição ou percentual.
- Cidade e UF são campos opcionais específicos no começo do criador. O texto livre “Onde foi?” continua para o local afetivo. A cidade é normalizada por acentos, caixa e espaços; não há geocodificação automática nem inferência de cidade a partir da história.
- Respostas agregadas não trazem nomes, datas, listas de casais ou cidades alheias. RPCs não permitem execução por anon/authenticated. O endpoint tem controle de origem e limite por IP.
- Resultados são compartilhados entre componentes por até três minutos. A consulta é antecipada na playlist. Resultados recebidos no começo dos stories são incluídos antes de o usuário chegar à comparação; resultados tardios não trocam o capítulo em leitura. Reabrir recebe a base atual.
- Os exemplos passam uma flag de demonstração explícita e mostram **“EXEMPLO · DADOS ILUSTRATIVOS”** nas comparações. Esses números não entram no banco nem aparecem como estatística de um presente real.

## Backend aplicado

Migration **021**, versão real `20261018143421_retrospective_community_stats`, e Edge **lovekoala-api v26 ACTIVE**. Campos `relationship_city` e `relationship_state` ficam em `lk_gifts.content`, validados no salvamento. Chaves, preços, pedidos e contas não foram alterados.

Não reaplicar migrations existentes. O script `prepare-production.py` agora reconhece 015–021. O backend deste projeto já recebeu a atualização; o deploy do frontend no EasyPanel usa o ZIP/repositório atualizado.

## Verificação e limites

60 testes Node e 5 Python passaram, além de TypeScript frontend/Edge, SSR e parser CSS. SSR percorre todas as novas cenas, confere 27 stories no exemplo e omissão de comparações indisponíveis. `tests/story-stats.sql` passou no Supabase com rollback: 19/20, duplicação, acentos, estados, empate, exclusões, expiração, respostas sem dados pessoais e permissões. A suíte anterior de recuperação também passou com rollback após a alteração do RPC legado.

Na v26, o endpoint real respondeu 200 com comparação indisponível (base atual abaixo do mínimo), 400 para duração inválida e 403 para origem não permitida. Nenhuma transação financeira, conta de teste permanente ou envio de e-mail foi criado nesta rodada. Não houve revisão em navegador ou teste físico em celular neste ambiente; estrutura e cálculos passaram, aparência/gestos/áudio precisam de conferência nos aparelhos.

Fontes de implementação: [Astronomy Engine](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md), [Supabase Database Functions](https://supabase.com/docs/guides/database/functions). A hipótese lúdica de batimentos não é orientação de saúde; a frequência real varia. Referência geral: [American Heart Association](https://www.heart.org/en/healthy-living/exercise-and-physical-activity/fitness-basics/target-heart-rates).
