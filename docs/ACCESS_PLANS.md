# Modalidades de acesso e edição

| Oferta atual | Cobrança | Acesso e edição | Criações |
| --- | --- | --- | --- |
| 24 horas · ID `carinho` | R$29,90, uma vez | 24h contadas da confirmação | Um presente, 20 fotos, álbum ou retrospectiva |
| Para sempre · ID `encanto` | R$49,90, uma vez | Vitalício | Um presente, 40 fotos, álbum e retrospectiva |
| Clube do Coala · ID `universo` | R$79,90 por período mensal | Cada presente criado é vitalício | Dois novos presentes por mês pago, 80 fotos cada, ambos os formatos |

Valores iniciais preservados nesta mudança e editáveis no admin. As ofertas mudam a duração; os recursos visuais seguem os mesmos modelos por formato.

O período de 24h começa na confirmação, depois de o cliente montar e conferir a prévia. `expires_at` e `edit_expires_at` recebem o mesmo instante. A API nega edição, fotos e publicação após o prazo e a rota pública só retorna presentes dentro do prazo. `lovekoala-freeze-expired` roda a cada minuto no Supabase e marca o estado no banco. Assim, a precisão do bloqueio não depende do próximo cron.

Vitalício é `infinity` no PostgreSQL, acompanhado por `access_kind`. O frontend reconhece esse valor somente nos tipos vitalício/Clube. Pausa, exclusão e reembolso continuam com suas proteções.

## Clube

A assinatura continua ancorada no primeiro presente, mas o benefício pertence à conta. A primeira confirmação cria o período pago e consome uma vaga para esse presente. `lk_redeem_club_gift` libera o segundo, dentro de uma transação com trava, sem criar pedido ou cobrar. A vaga só é usada depois que o cliente confirma a escolha; rascunhos continuam gratuitos.

`lk_club_periods` registra limites e períodos; `lk_club_redemptions` registra os presentes, com um registro único por presente. Excluir um presente não devolve a vaga. O resgate é idempotente, exige proprietário autenticado, conteúdo, fotos, plano compatível e período pago. Não aceita pedidos pendentes no mesmo rascunho.

Somente pagamento verificado cria novas cotas. Webhooks/faturas repetidos não duplicam períodos. A normalização do primeiro período aceita a pequena diferença de horário entre confirmação inicial e o período canônico do Stripe. O mês seguinte começa no ciclo de cobrança, não no primeiro dia do mês. Vagas não acumulam. O painel permite configurar pelo menos duas por período.

Stripe renova o cartão mensalmente; Pix depende de uma nova cobrança paga. Cancelar ou vencer impede novas cotas. Os presentes já liberados continuam com acesso e edição vitalícios. A conta mostra a cota atual, prazo do período e botões de renovação/cancelamento.

## Compatibilidade

Pedidos anteriores à mudança receberam `access_kind=legacy` e `access_days_snapshot` com o prazo original. Os presentes que já tinham `expires_at` não foram alterados. Cobranças anteriores ainda pendentes mantêm suas condições ao confirmar. A versão da oferta no novo checkout impede cobrar novas condições a partir de uma tela antiga em cache; nesse caso, a API pede atualização antes de gerar uma cobrança.

`lk_restore_paid_access` recompõe apenas uma concessão ausente depois de a Edge verificar o pedido no provedor. Mantém a data original de pagamento, não reinicia um prazo vencido e não estende um acesso já gravado. Divergências de pagamento ficam em conferência, sem nova cobrança automática.
