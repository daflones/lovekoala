# Pagamentos e webhooks

## Configuração concluída em 18/10/2026

O segredo de webhook MercosulPay fornecido pelo proprietário está salvo somente nos secrets do projeto Supabase enhnlektomuoumozjsfp, em MERCOSULPAY_WEBHOOK_SECRET. O valor não está no código, exemplos de ambiente ou ZIP. A conferência do digest e os testes HTTP passaram.

As chaves de API MercosulPay, Stripe, segredo Stripe, NVIDIA, cron e salt foram preservadas. Edge lovekoala-api v26 ativa; 21 migrations registradas. Site URL, redirects e origens de autenticação já estão alinhados ao domínio.

## URLs atuais

Os endpoints diretos atendem mesmo antes de hospedar o frontend no EasyPanel:

| Provedor | URL |
| --- | --- |
| MercosulPay | https://enhnlektomuoumozjsfp.supabase.co/functions/v1/lovekoala-api/webhook/mercosulpay |
| Stripe | https://enhnlektomuoumozjsfp.supabase.co/functions/v1/lovekoala-api/webhook/stripe |

MercosulPay: as novas cobranças Pix recebem o callback pelo backend. Se o painel do provedor solicitar uma URL de webhook, use o endereço acima. O evento reconhecido para recebimento é pix.received. O segredo precisa ser o mesmo salvo no backend.

Stripe: mantenha o endpoint exclusivo do LoveKoala. Se precisar ajustar a URL, edite esse mesmo endpoint. O segredo STRIPE_WEBHOOK_SECRET é o segredo de assinatura desse endpoint, separado do segredo MercosulPay, mesmo que ambos comecem por whsec_. Não substitua um pelo outro.

Eventos que o LoveKoala usa no Stripe:

    checkout.session.completed
    checkout.session.async_payment_succeeded
    checkout.session.expired
    charge.refunded
    invoice.paid
    invoice.payment_failed
    customer.subscription.updated
    customer.subscription.deleted

Pedidos de outro projeto não são processados como LoveKoala. As rotas validam assinaturas e conferem a cobrança no provedor antes de conceder o acesso; enviar um evento por conta própria não confirma um pagamento real.

## Depois de hospedar lovekoala.com.br

Com Dockerfile na porta 8080, DNS e HTTPS prontos, rode smoke-production.py e use Admin → Pagamentos → Verificar domínio → Ativar webhooks no domínio. Só ative quando os dois proxies forem verificados.

| Provedor | URL após ativação |
| --- | --- |
| MercosulPay | https://lovekoala.com.br/api/webhooks/mercosulpay |
| Stripe | https://lovekoala.com.br/api/webhooks/stripe |

A ação atualiza o mesmo endpoint Stripe dedicado, preserva seu segredo e grava a base dos callbacks de novos Pix. Não altera outros projetos. Cobranças Pix antigas mantêm o callback original; as rotas Supabase continuam válidas. Essa ativação ainda não foi executada porque a hospedagem do domínio depende do servidor do proprietário.

## O que foi testado

- Notificação sintética corretamente assinada: HTTP 200.
- Repetição idêntica: HTTP 200, sem duplicação do registro.
- Assinatura incorreta: HTTP 401 BAD_SIGNATURE.
- Timestamp vencido: HTTP 401 BAD_SIGNATURE.
- Evento sintético removido ao fim; zero registros restantes conferidos.

Nenhuma cobrança, compra, assinatura ou conta foi criada no teste. Ele valida a recepção e a assinatura, não substitui uma compra controlada no ambiente do provedor. Uma compra real por cartão/Pix, renovação e publicação ainda precisam da verificação operacional descrita em EASYPANEL.md.

## Aprovação pelo administrador

Admin → Pagamentos → Aprovar manualmente libera um pedido mediante motivo e confirmação. O registro permanece distinto de pagamento confirmado pelo provedor e integra os relatórios por origem. Repetir a ação não duplica prazo/cota. A ação não cobra o cliente ou cria assinatura externa. Ver [ADMIN_CONTROLS.md](ADMIN_CONTROLS.md).
