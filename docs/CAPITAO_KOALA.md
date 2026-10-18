# Capitão Koala

Assistente de operações exclusivo da administração, em **/admin?aba=captain**. Usa a conta administradora já existente; não exige outro cadastro ou chave no navegador.

## O que pedir

| Pedido | Ferramenta / resultado |
| --- | --- |
| “Como foi este mês? Compare com o anterior.” | Consulta meses e explica receitas, pagamentos e funil |
| “Mostre as receitas de cada mês de 2026.” | Relatório de 12 meses, também exibido na tabela |
| “Em qual parte da compra estão desistindo?” | Visitas, criar, checkout e compras; ressalva sobre sessões e instrumentação |
| “Mostre os pedidos pendentes.” | Até 20 registros operacionais, com filtros disponíveis |
| “Quais planos temos e quanto custam?” | Valores e limites atuais do banco |
| “Mude o Para sempre para R$59,90.” | Proposta de preço para novas compras, sem aplicar imediatamente |
| “Deixe a cor principal #8054A0.” | Proposta do tema do personalizador |
| “Reescreva a pergunta da etapa de fotos.” | Consulta as 13 etapas e propõe os textos, preservando as demais |
| “Quero pausar este presente.” | Consulta/identificação e proposta de pausa pelo ID |

Há oito ferramentas: monthly_report, read_records, read_plans, read_site_settings, propose_plan, propose_site, propose_pause e apply_proposal. Os resultados vêm do backend, não do conhecimento geral do modelo.

## Revisar e aplicar

1. Faça o pedido e confira a resposta e o cartão em **Alterações para revisar**.
2. Abra **Comparar antes e depois**. A proposta ainda não alterou o site.
3. Use **Aplicar alteração** ou envie outra mensagem explícita, como “Pode aplicar a proposta 1234abcd”. Se houver várias, especifique o código ou confirme todas explicitamente.
4. O servidor verifica admin, autoria da proposta, validade e se o dado mudou desde a consulta. Se houve mudança concorrente, peça uma nova proposta.
5. Aplicação concluída fica em lk_admin_audit com admin, alvo, antes/depois e ID da proposta. Repetir a mesma aplicação não duplica a alteração/auditoria.

Propostas duram 15 minutos. Podem ser descartadas. A conversa em memória some ao recarregar; propostas recentes são carregadas do banco. Uma resposta interrompida pode deixar uma proposta salva ou uma alteração já confirmada concluída: confira os cartões e a auditoria antes de repetir.

## Relatórios e interpretações

- Ano inteiro ou mês específico, em America/Sao_Paulo. Tabela, totais e conversa usam a mesma função do banco.
- Receita bruta aprovada = pedidos pagos + renovações registradas, sem duplicação com pedido/primeira fatura. A tabela e o relatório separam confirmação no provedor de aprovação manual. Aprovação manual não comprova recebimento externo.
- Há agrupamentos por plano, provedor e origem; novas contas, presentes, visitas, sessões e checkout. Assinaturas ativas, presentes publicados e armazenamento são o estado atual, não snapshots históricos.
- Não é lucro. Taxas, custos e impostos não estão integrados. Reembolsos de pedidos aparecem ligados ao mês da venda; estornos de faturas recorrentes posteriores não têm cobertura completa. A receita exclui pedidos atualmente reembolsados, por isso não subtraia novamente esse campo para obter um “líquido”.
- Sessões são IDs de navegação, não pessoas identificadas. Consentimento, bloqueadores e início da instrumentação afetam os números. Comparações com o mês atual devem indicar que ele ainda está em andamento.

## Escopo das alterações

Planos: nome, descrição, preço, mensalidade, fotos, cota mensal, formatos, benefícios e disponibilidade, dentro dos limites do sistema. Snapshots de compras contratadas não são reescritos.

Personalizador: textos cadastrados, cores, arredondamento, ordem/visibilidade de seções, títulos/perguntas das etapas e IDs de campanhas aceitos pelo painel. Não altera código, componentes arbitrários, DNS ou credenciais. As etapas preservam os 13 índices do editor.

Pausas: presentes e usuários comuns. Não pode pausar a própria conta ou administradores. Pausar usuário/site não cancela automaticamente cobrança de assinatura.

Aprovação manual de pagamento fica somente no formulário de Pagamentos, com motivo, confirmação e auditoria. O assistente não possui ferramenta para aprovar pagamento, criar cobrança, reembolsar, excluir dados, promover admin, executar SQL livre ou trocar segredos. O formulário administrativo existente continua disponível para operações fora desse escopo.

## Acesso e privacidade

JWT e lk_admins são conferidos antes de usar a IA. As tabelas de proposta têm RLS e as funções internas não são executáveis pelos papéis públicos. O suporte Koala do visitante não recebe relatórios/ferramentas administrativos.

As consultas retornam no máximo 20 registros por leitura, com colunas permitidas. Resultados necessários podem ser enviados ao modelo NVIDIA, incluindo e-mails solicitados em consultas de usuários/compras. Não incluem senhas, chaves de API, fotos, cartas ou tokens privados do presente. Dados do banco são tratados como dados, não instruções.

Secret/modelo são os mesmos do suporte: NVIDIA_CHAT_API_KEY, nvidia/nemotron-3.5-lightning-30b-a3b. Sem GPU/NIM no EasyPanel. Limites de tempo, histórico, requisições e rodadas de ferramentas evitam consultas sem fim; tarefas grandes podem exigir dividir o pedido.

## Verificação desta entrega

Handler real com provedores isolados: acesso negado a visitante/não admin antes da NVIDIA, relatórios, leitura de etapas/textos, proposta sem aplicação, confirmação explícita posterior e proposta inexistente recusada. SQL remoto com rollback: aplicação idempotente, conflito, expiração, propriedade e RLS. Não houve conversa autenticada real do Capitão nem teste de navegador nesta rodada; esses limites estão em VALIDATION.md.
