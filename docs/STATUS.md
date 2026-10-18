# LoveKoala — entrega de 18/10/2026

## Implementado

- Pagamento antes de criar conta: visitante monta e paga por cartão/Pix; depois cadastra ou entra, com e-mail preenchido. A vinculação exige o e-mail confirmado do checkout e associa presente e assinatura na mesma transação.
- Retomada de checkout também para visitantes, por link privado no resumo solicitado por e-mail. Envios dependem do transporte configurado.
- Geração de imagens pausada no backend e removida das etapas/benefícios. Créditos zerados; arquivos anteriores preservados.
- Koala público conversa por streaming e navega por sete intenções internas. Não cobra, publica ou administra.
- Capitão Koala exclusivo do admin: relatórios mensais/anuais, consulta de usuários, presentes, pedidos, assinaturas, abandonos e auditoria; propostas para planos, textos, cores, seções, perguntas das etapas, tags e pausas. Antes/depois, confirmação, validade de 15 minutos e auditoria.
- Dockerfile Node 24 → Nginx, porta 8080, health check, SPA e proxies HTTPS para webhooks. Ativação do domínio no admin verifica os dois proxies antes de alterar o endpoint Stripe dedicado e callbacks dos novos Pix.

## Supabase efetivamente atualizado

Projeto confirmado: enhnlektomuoumozjsfp, ACTIVE_HEALTHY. Edge Function lovekoala-api **v21 ACTIVE**, com autenticação própria, verificação de origem e assinaturas de webhook.

Migrations 001–014 preservadas. Novas versões aplicadas e registradas:

| Versão | Migration |
| --- | --- |
| 20261018033136 | production_domain_image_pause |
| 20261018033423 | guest_checkout_after_payment |
| 20261018034104 | captain_koala_admin_assistant |
| 20261018035009 | guest_checkout_claim_guard |

Os nomes locais correspondem ao histórico real. Não reaplique os arquivos individualmente nem execute migration-history.sql no banco existente. O script prepare-production.py ignora cada versão já registrada.

Verificações remotas desta entrega:

- Configuração pública: HTTP 200 com CORS para https://lovekoala.com.br e créditos de imagens zerados.
- Conversa real Koala/NVIDIA concluída por streaming; ferramenta retornou exemplo de retrospectiva Para sempre, sem erro.
- Teste SQL de checkout de visitante: antes/depois do pagamento, e-mail incorreto bloqueado, presente e assinatura vinculados, Clube sem duplicação e retomada protegida. Tudo com rollback.
- Teste SQL do Capitão: autorização, aplicação, idempotência, conflito, validade, relatório de 12 meses e permissões. Tudo com rollback.
- RLS das novas tabelas ativa; funções privadas indisponíveis a anon/authenticated. Admin existente preservado.
- Cron lovekoala-reconcile a cada cinco minutos e lovekoala-freeze-expired a cada minuto confirmados ativos.

Nenhuma compra, conta de QA ou alteração de preço permanente foi criada pelos testes concluídos. Não foram substituídas chaves de Stripe, MercosulPay ou NVIDIA.

## O que ainda depende da implantação

1. **Concluir os defaults de domínio/Auth:** SITE_URL/ALLOWED_ORIGINS dos secrets e Site URL padrão do Supabase Auth não foram reconfigurados nesta sessão. O código aceita produção e passa redirects explícitos; o script ou o procedimento manual de EASYPANEL.md conclui os defaults sem trocar outras chaves.
2. **EasyPanel, DNS e HTTPS:** não foram acessados. O proprietário fará commit/push no próprio repositório e criará o App com Dockerfile, porta interna 8080.
3. **Webhooks do domínio:** ainda não ativados. Após HTTPS/proxies responderem, Admin → Pagamentos → Verificar domínio → Ativar webhooks no domínio. Até lá, endpoints Supabase existentes continuam válidos. Não foi alterado nenhum webhook de outros projetos.
4. **Verificação operacional:** compra controlada por cartão/Pix, renovação, confirmação de e-mail e entrega em navegador/celular real. Não houve transação financeira real ou envio de e-mail nesta rodada.
5. **E-mails:** o último estado registrado não tinha Resend/remetente ativo. Conferir o painel e configurar se necessário; SMTP/Auth é separado.
6. **Identificação comercial:** preencher dados reais do responsável/contato antes do lançamento.

## Alcance dos testes

41 testes Node, 5 Python, TypeScript frontend/Edge e SSR aprovados. Build e pacote são conferidos na finalização. Consultas e ferramentas do Capitão foram testadas com handler real e provedores isolados, além do SQL remoto.

Não houve conversa autenticada real do Capitão nesta sessão. A revisão automática bloqueou um teste que criaria usuário/admin de QA permanente sem limpeza; esse procedimento foi abandonado. Os testes SQL aprovados usam rollback e não deixam esse usuário. Nenhum teste foi declarado aprovado com base na tentativa bloqueada.

Não estão disponíveis Docker/Nginx ou o controle de navegador exigido para QA visual. SSR não comprova aparência/gestos/autoplay. Resultados detalhados e histórico estão em VALIDATION.md.

## Produto preservado

Landing LoveKoala, seis exemplos de plano/formato, editor de 13 etapas, presentes por URL personalizada e QR Code. Álbum 3D com folha, cartas, raspadinha, vales e música opcional na página musical. Retrospectiva com até 17 capítulos, carrossel, contadores e três minijogos.

Planos: 24h após confirmação; compra vitalícia; Clube com pelo menos dois novos presentes vitalícios por ciclo mensal pago, sem acúmulo. Cartão renova automaticamente; Pix é manual. Cancelar/vencer Clube bloqueia novas cotas e preserva presentes vitalícios já liberados. Snapshots de compras antigas preservados.

Música usa players oficiais visíveis YouTube/Spotify. Busca de metadados sem chave, com API oficial opcional; reprodução/autoplay dependem dos provedores e do navegador. CMS administra campos estruturados, não código arbitrário.

## Continuidade

EASYPANEL.md, CAPITAO_KOALA.md, NVIDIA_AI.md, VALIDATION.md, DEVIN_CONTINUACAO.md, ACCESS_PLANS.md, CHECKOUT_RECOVERY.md e CAMPAIGNS.md acompanham o ZIP. O arquivo archive/koala-ai-quotas-before-pause.sql é histórico.
