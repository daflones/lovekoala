# LoveKoala — entrega de 18/10/2026

## Atualização visual dos presentes

Análise do vídeo de 5min16s e atualização documentadas em UPGRADE_PRESENTES.md. Álbum com abertura, cenários próprios, jardim que floresce, cabine com tirinha PNG, quebra-cabeça, fotos ampliadas e sonhos ilustrados. Retrospectiva mantém a playlist e inclui uma edição em histórias com calendário, números animados, marcos e conteúdo pessoal. Os exemplos foram atualizados. Esta rodada altera apenas o frontend; backend e credenciais permanecem como registrados abaixo.

## Implementado

- Pagamento antes de criar conta: visitante monta e paga por cartão/Pix; depois cadastra ou entra, com e-mail preenchido. A vinculação exige o e-mail confirmado do checkout e associa presente e assinatura na mesma transação.
- Retomada de checkout também para visitantes, por link privado no resumo solicitado por e-mail. Envios dependem do transporte configurado.
- Geração de imagens pausada no backend e removida das etapas/benefícios. Créditos zerados; arquivos anteriores preservados.
- Admin → Assistente Koala: chave para exibir/ocultar o chat dos clientes, com bloqueio no servidor e auditoria.
- Admin → Pagamentos: conferência no provedor e aprovação manual com motivo, confirmação, trava/idempotência, origem distinta nos relatórios e respeito aos limites dos planos.
- Koala público conversa por streaming e navega por sete intenções internas. Não cobra, publica ou administra.
- Capitão Koala exclusivo do admin: relatórios mensais/anuais, consulta de usuários, presentes, pedidos, assinaturas, abandonos e auditoria; propostas para planos, textos, cores, seções, perguntas das etapas, tags e pausas. Antes/depois, confirmação, validade de 15 minutos e auditoria.
- Dockerfile Node 24 → Nginx, porta 8080, health check, SPA e proxies HTTPS para webhooks. Ativação do domínio no admin verifica os dois proxies antes de alterar o endpoint Stripe dedicado e callbacks dos novos Pix.

## Supabase efetivamente atualizado

Projeto confirmado: enhnlektomuoumozjsfp, ACTIVE_HEALTHY. Edge Function lovekoala-api **v26 ACTIVE**, com autenticação própria, verificação de origem e assinaturas de webhook.

Migrations 001–014 preservadas. Novas versões aplicadas e registradas:

| Versão | Migration |
| --- | --- |
| 20261018033136 | production_domain_image_pause |
| 20261018033423 | guest_checkout_after_payment |
| 20261018034104 | captain_koala_admin_assistant |
| 20261018035009 | guest_checkout_claim_guard |
| 20261018043541 | admin_chat_payment_controls |
| 20261018120929 | admin_approval_guards |
| 20261018143421 | retrospective_community_stats |

Os nomes locais correspondem ao histórico real. Não reaplique os arquivos individualmente nem execute migration-history.sql no banco existente. O script prepare-production.py ignora cada versão já registrada.

Verificações remotas desta entrega:

- Configuração pública: HTTP 200 com CORS para https://lovekoala.com.br e créditos de imagens zerados.
- Conversas públicas reais concluídas por streaming durante a investigação. O provedor apresentou latência variável; o cliente agora encerra no evento terminal, o servidor envia progresso antes do provedor e os erros não deixam o formulário ocupado. A seleção explícita de formato/plano é validada também pelo código. Na checagem final v25 a API excedeu o prazo e retornou erro tratado; a resposta de IA ainda depende da disponibilidade externa. O admin pode ocultá-la pela nova chave. Ver resultados finais em VALIDATION.md.
- Teste SQL de checkout de visitante: antes/depois do pagamento, e-mail incorreto bloqueado, presente e assinatura vinculados, Clube sem duplicação e retomada protegida. Tudo com rollback.
- Teste SQL do Capitão: autorização, aplicação, idempotência, conflito, validade, relatório de 12 meses e permissões. Tudo com rollback.
- tests/admin-controls.sql passou com rollback: toggle/admin ativo, motivo/valor, 24h exatas, publicação, auditoria sem duplicação, receita por origem, cota Clube, cobrança antiga conflitante e confirmação Stripe posterior sem nova cota.
- RLS das novas tabelas ativa; funções privadas indisponíveis a anon/authenticated. Admin existente preservado.
- Cron lovekoala-reconcile a cada cinco minutos e lovekoala-freeze-expired a cada minuto confirmados ativos.
- Segredo de webhook MercosulPay atualizado em 18/10/2026, com conferência do digest no Supabase. Evento sintético assinado e sua repetição responderam 200; assinatura incorreta e timestamp vencido responderam 401. Registro sintético removido e ausência confirmada. Nenhuma cobrança foi criada.
- SITE_URL, ALLOWED_ORIGINS e Site URL do Auth configurados para https://lovekoala.com.br. Redirects anteriores preservados; domínio principal, www, prévia e localhost:4173 autorizados. As demais configurações de Auth foram preservadas.

Nenhuma compra, conta de QA ou alteração de preço permanente foi criada pelos testes concluídos. Quanto às credenciais, somente o segredo de webhook MercosulPay fornecido pelo proprietário foi atualizado. Chaves de API MercosulPay, Stripe, segredo Stripe, NVIDIA, cron e salt foram preservados e seus digests conferidos.

## O que ainda depende da implantação

1. **EasyPanel, DNS e HTTPS:** não foram acessados. O proprietário fará commit/push no próprio repositório e criará o App com Dockerfile, porta interna 8080.
2. **Webhooks do domínio:** ainda não ativados. Após HTTPS/proxies responderem, Admin → Pagamentos → Verificar domínio → Ativar webhooks no domínio. Até lá, endpoints Supabase existentes continuam válidos. Não foi alterado nenhum webhook de outros projetos. URLs atuais em PAGAMENTOS.md.
3. **Verificação operacional:** compra controlada por cartão/Pix, renovação, confirmação de e-mail e entrega em navegador/celular real. Não houve transação financeira real ou envio de e-mail nesta rodada.
4. **E-mails:** o último estado registrado não tinha Resend/remetente ativo. Conferir o painel e configurar se necessário; SMTP/Auth é separado.
5. **Identificação comercial:** preencher dados reais do responsável/contato antes do lançamento.

## Alcance dos testes

72 testes Node, 5 Python, TypeScript frontend/Edge e SSR aprovados. A verificação estrutural de DOM reproduz a regressão de preload do React 19 e confere as folhas reais do álbum. Build e pacote são conferidos na finalização. Consultas e ferramentas do Capitão foram testadas com handler real e provedores isolados, além do SQL remoto.

Não houve conversa autenticada real do Capitão nesta sessão. A revisão automática bloqueou um teste que criaria usuário/admin de QA permanente sem limpeza; esse procedimento foi abandonado. Os testes SQL aprovados usam rollback e não deixam esse usuário. Nenhum teste foi declarado aprovado com base na tentativa bloqueada.

Não estão disponíveis Docker/Nginx ou o controle de navegador exigido para QA visual. SSR não comprova aparência/gestos/autoplay. Resultados detalhados e histórico estão em VALIDATION.md.

## Produto preservado

Landing LoveKoala, seis exemplos de plano/formato com os novos elementos, editor de 13 etapas, presentes por URL personalizada e QR Code. Álbum 3D com folha, cartas, raspadinha, vales e música opcional na página musical. Retrospectiva com até 17 capítulos, carrossel, contadores e três minijogos.

Planos: 24h após confirmação; compra vitalícia; Clube com pelo menos dois novos presentes vitalícios por ciclo mensal pago, sem acúmulo. Cartão renova automaticamente; Pix é manual. Cancelar/vencer Clube bloqueia novas cotas e preserva presentes vitalícios já liberados. Snapshots de compras antigas preservados.

Música usa players oficiais visíveis YouTube/Spotify. Busca de metadados sem chave, com API oficial opcional; reprodução/autoplay dependem dos provedores e do navegador. CMS administra campos estruturados, não código arbitrário.

## Continuidade

ADMIN_CONTROLS.md, EASYPANEL.md, PAGAMENTOS.md, CAPITAO_KOALA.md, NVIDIA_AI.md, VALIDATION.md, DEVIN_CONTINUACAO.md, ACCESS_PLANS.md, CHECKOUT_RECOVERY.md e CAMPAIGNS.md acompanham o ZIP. O arquivo archive/koala-ai-quotas-before-pause.sql é histórico.

## Stories completos e estatísticas

Exemplo completo com 27 stories e índice de navegação; batimentos estimados ao vivo, lua/estações calculadas, passaporte datado, música em equivalência, cartas/vales/quiz/jogos. Comparação real por comunidade e cidade, sem aviso abaixo de 20 relações. Exemplos usam dados ilustrativos identificados. Migration 021 (20261018143421) e Edge v26 aplicadas. Consulte RETROSPECTIVA_COMPLETA.md para fórmulas, critérios, testes e limites.

## Refinamento de fotos e navegação

Todas as fotos entram nos replays, com miniaturas e galeria completa. Motivos, sonhos e marcos aparecem integralmente; conteúdo longo recebe tempo livre. Quiz, cartas e vales mantêm o estado enquanto a edição está aberta. O álbum ganhou índice visual pesquisável por assunto e número. Corrigida a seleção das folhas com imagens quando o React 19 antepõe recursos de preload. Nenhuma mudança adicional no Supabase nesta rodada. Detalhes em NAVEGACAO_PRESENTES.md.

A playlist também respeita o tempo de leitura, a fila, os diálogos e a aba oculta. Galeria com gesto sobre a foto e leitores com foco/Escape/rolagem coordenados. O modo ampliado preserva o gesto de explorar a imagem em vez de trocar a foto.
