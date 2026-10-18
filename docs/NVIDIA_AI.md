# Koala: conversa e navegação

## Estado desta versão

A geração de imagens está **pausada por decisão do produto**. O editor não apresenta estúdio, fotos de referência, preparação de cenas ou compra de créditos. As ofertas públicas informam zero créditos e não listam imagens IA como benefício.

`AI_IMAGES_PAUSED=true` no backend bloqueia as rotas de setup, preparação, inclusão, upload de referência e geração. Chaves antigas não reativam a função. A remoção de referências já existentes continua permitida ao proprietário; conteúdo e histórico anteriores não são apagados. O leitor ainda consegue mostrar artes antigas que já tenham sido incluídas.

As migrations 013/014 e o código antigo do conector foram preservados para uma eventual retomada planejada. A migration 015, já aplicada, zera os créditos dos planos. Não configure Qwen, SD3.5, endpoint NIM ou GPU para esta versão.

## Modelo de conversa

- Modelo de conversa: `nvidia/nemotron-3.5-lightning-30b-a3b`.
- API hospedada: `https://integrate.api.nvidia.com/v1/chat/completions`.
- Secret: `NVIDIA_CHAT_API_KEY`, somente no Supabase.
- Streaming, `chat_template_kwargs.enable_thinking=false` e `reasoning_budget=0` e limite de histórico de 9 mensagens/7 mil caracteres no cliente; servidor revalida os limites e papéis.
- Chamadas de chat usam a região Supabase `us-west-1`, já verificada na rodada anterior. Armazenamento/editor/pagamentos mantêm o roteamento normal.
- O site, o editor e as cobranças funcionam sem IA. Atalhos e o guia determinístico também estão disponíveis se o chat falhar.

A documentação NVIDIA consultada em 18/10/2026 confirma o identificador, endpoint hospedado e suporte a ferramentas: https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b/api. Disponibilidade de teste não representa garantia de capacidade ou SLA para produção.

## Disponibilidade pelo admin

Em Admin → Assistente Koala, a chave **Conversa com IA** controla `features.koala_chat`. Desativar oculta convite/botão/janela do cliente e bloqueia novas requisições antes do provedor. Clientes abertos atualizam ao focar ou em até um minuto. O Capitão não usa essa chave. A alteração exige admin ativo e gera auditoria. Ver ADMIN_CONTROLS.md.

O secret `NVIDIA_CHAT_MODEL` permite uma futura troca validada de modelo. O default é o modelo acima. A chave NVIDIA existente permanece no servidor. O modelo GLM anterior continua somente no código de imagens/visão pausado; essa parte não é chamada nesta versão.

## Navegação implementada

A ferramenta `navigate_lovekoala` recebe uma intenção, nunca uma URL ou código:

| Intenção | Comportamento |
| --- | --- |
| `create` | Editor com formato e plano opcionais |
| `plans` | Seção de preços |
| `examples` | Galeria no formato/plano selecionado |
| `how` | Seção de etapas |
| `faq` | Dúvidas frequentes |
| `account` | Própria conta e presentes |
| `checkout` | Revisão no editor; destaca a primeira informação obrigatória ausente |

Servidor e cliente limitam destinos, planos e formatos. A ferramenta não recebe links arbitrários, tokens de edição ou IDs de outro usuário. O servidor só autoriza navegação automática quando a mensagem atual contém um pedido explícito; explicações e pedidos negativos mantêm um botão de escolha. Uma resposta interrompida não executa a navegação. Se a pessoa já mudou de página enquanto o modelo respondia, o resultado permanece como atalho.

O Koala não cria cobranças, não preenche dados fictícios, não publica, não cancela e não altera a conta. “Quero comprar direto” abre a criação; o pagamento exige completar o presente e confirmar os campos na interface.

Um único componente mantém a conversa durante a navegação SPA entre início, editor, conta e exemplos. As mensagens ficam em memória da página; recarregar encerra essa memória. A criação salva o rascunho local ao navegar e mantém o aviso de recuperação de checkout pendente. Conversas não aparecem sobre o presente final entregue ao destinatário.

## Privacidade e interface

O backend envia à NVIDIA as mensagens da conversa e uma categoria de página (`home`, `create`, `account`, `examples`). Não inclui automaticamente nomes, fotos, cartas, token privado, dados do pedido ou dados financeiros. Valores e limites dos planos vêm do banco, sem o modelo decidir preço.

O mascote SVG pisca, respira, pensa, fala e acena; animações respeitam `prefers-reduced-motion`. O chat tem atalhos, envio por teclado, interrupção e tentativa novamente; adapta sua altura ao viewport móvel/teclado.

## Validação

`npm test` cobre o handler real com provedores isolados: bloqueio de imagens mesmo com chaves, ferramentas fragmentadas, intenções inválidas, pedidos negativos, resposta incompleta, restrição de papel e privacidade. Os testes do cliente cobrem evento done/error sem encerramento da conexão: ambos liberam o formulário e cancelam a leitura; erros não executam navegação. O backend envia ready/status antes de esperar a NVIDIA, inclui pings e limita a duração. Logs de falha contêm somente código/status/modelo/tempo, sem mensagens ou chaves. O provedor apresentou latência variável durante os testes; HTTP 200 sozinho não comprova resposta concluída. Resultados reais e limites estão em VALIDATION.md.

Após publicar a Edge Function, rode `tests/ai-backend.py` com o JSON público solicitado por stdin. Ele verifica a pausa e uma única conversa real pedindo um exemplo de retrospectiva; não cria presente, pedido ou pagamento. Veja `STATUS.md` para os testes remotos que foram efetivamente executados nesta entrega.

## Capitão Koala

O assistente do admin usa o mesmo modelo e secret de conversa, em uma rota separada que exige JWT e papel administrativo antes de chamar a NVIDIA. Ele recebe resultados de ferramentas de negócio para consultar números e preparar mudanças. A memória da conversa continua em memória da página; propostas persistem no banco e expiram em 15 minutos. O suporte público não recebe essas ferramentas ou dados.

Dados operacionais necessários à resposta, inclusive e-mails quando solicitados em uma consulta de usuários/compras, podem ser enviados à NVIDIA. Credenciais, fotos, cartas e tokens de edição não fazem parte das consultas. Escopo, exemplos e confirmação estão em [CAPITAO_KOALA.md](CAPITAO_KOALA.md).
