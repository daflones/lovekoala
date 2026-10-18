# Controles administrativos

## Ativar ou desativar o Koala dos clientes

Entre em `/admin?aba=ai`, usando uma conta administradora existente. Na seção **Conversa com IA**, altere a chave **Ativada / Desativada**.

Desativar oculta o convite da página inicial, o botão flutuante e a janela do chat. O servidor bloqueia novas mensagens antes de chamar a NVIDIA. Clientes com a página já aberta recebem a configuração ao voltar para a aba ou em até um minuto. Conversas em curso são interrompidas no cliente quando o componente é removido; a requisição tem também prazo máximo no servidor.

A edição por formulários, perguntas determinísticas, prévias, pagamentos e publicação continuam disponíveis. O Capitão Koala administrativo é independente dessa chave.

O estado fica em `lk_site_settings.data.features.koala_chat`. Ausência do campo mantém a disponibilidade anterior. A RPC `lk_set_koala_chat` exige administrador ativo e é executável apenas pelo backend. Mudanças ficam em `lk_admin_audit`, com estado anterior, novo estado, administrador e data. O personalizador respeita esse campo e revisões concorrentes.

## Conferir ou aprovar um pagamento

Entre em `/admin?aba=billing` → **Histórico de cobranças**.

- **Conferir no provedor:** consulta Stripe/MercosulPay e sincroniza um recebimento confirmado, sem gerar cobrança.
- **Aprovar manualmente:** disponível para pedidos ainda não aprovados e com cobrança identificada. Confira pedido, presente, plano e valor; informe um motivo de 10 a 1.000 caracteres, marque a confirmação e conclua a aprovação.
- Pedidos pagos não exibem outra aprovação. Pedidos reembolsados, presentes excluídos/pausados, valores divergentes, cobranças substituídas e conflitos de Clube são recusados no servidor.

A aprovação libera o acesso e a publicação conforme o plano contratado. O cliente ainda precisa cumprir os requisitos normais de conta proprietária, e-mail do checkout, conteúdo e consentimento para publicar. As 24 horas contam da aprovação; planos vitalícios continuam sem vencimento. O Clube libera somente a cota daquele ciclo e o primeiro presente ocupa uma vaga.

A ação não realiza débito no cartão, não gera um Pix e não cria uma assinatura externa. Um ciclo mensal aprovado manualmente não passa a renovar automaticamente por isso. A renovação automática exige uma assinatura Stripe efetivamente confirmada.

## Auditoria e relatórios

O histórico mostra **Aprovado manualmente** e permite abrir o motivo, o administrador e a data. A ação `payment_manually_approved` fica na auditoria. Repetir uma requisição não reinicia o prazo, não duplica a cota e não duplica a aprovação.

`approval_source` separa `manual` de `provider`. Os campos `manual_approved_at`, `manual_approved_by` e `manual_approval_reason` preservam a decisão administrativa. `provider_verified_at` só é preenchido após confirmação no provedor. Quando essa confirmação ocorre depois, o histórico manual permanece; acesso e cota não são concedidos novamente.

Visão geral e Capitão mostram a receita bruta aprovada e distinguem os valores manuais dos confirmados pelo provedor. Aprovação manual não comprova recebimento externo. O Capitão não possui ferramenta para aprovar pagamentos: essa operação exige o formulário administrativo.

## Validação

`tests/admin-controls.test.mjs` verifica autorização, validação, flag no backend, preservação no personalizador e reconciliação posterior. `tests/admin-controls.sql` passou no banco real com rollback: permissões, auditoria, repetição, prazo exato, publicação, receita sem duplicação, Clube e primeira fatura Stripe recebida dias depois. Nenhuma cobrança real foi aprovada nesses testes.
