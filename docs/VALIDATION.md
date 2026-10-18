# Validação da entrega de 18/10/2026

## Verificações concluídas

- **41 testes Node** comportamentais: pagamentos, Clube, expiração, retomada, áudio/álbum, música, relógio, jogos, pausa de imagens, navegação Koala, checkout de visitante e ferramentas do Capitão.
- **5 testes Python** do instalador: quatro migrations em ordem, atualização parcial, repetição sem reexecutar histórico, modo consulta, preservação de secrets e interrupção se projeto/deploy não corresponder.
- TypeScript frontend e Edge Function aprovados.
- SSR aprovado para landing, autenticação, conta/admin, editor, álbum, retrospectiva, exemplos e suporte. Inclui e-mail preenchido no cadastro após pagamento e interface do Capitão. Confere conteúdo/estrutura; não aparência em navegador.
- Produção com handler real e provedores isolados: exige dois proxies HTTPS corretos antes da ativação; altera só o endpoint Stripe dedicado, preserva assinaturas e usa callback de domínio para novos Pix.
- Koala com fragmentação de ferramentas, respostas incompletas, intenções inválidas, pedidos negativos, destinos limitados, ausência de dados privados e bloqueio das rotas de imagem.
- Checkout visitante: gera checkout sem login usando acesso privado, exige conta na publicação, usa RPC atômica para vincular e também no autosave; e-mail de checkout permanece fixo quando há pedido ativo.
- Capitão: visitante/não admin bloqueados antes do provedor; relatório e catálogo real de textos/13 etapas; proposta não altera o plano; exige confirmação posterior; proposta desconhecida não aplica; raciocínio interno não aparece.
- Scripts Python compilados e --help do instalador executado sem credenciais. git diff --check aprovado. Build e integridade/scan do ZIP são conferidos na finalização.

## Banco e Edge remotos

- Migrations 015–018 aplicadas pelo Supabase com versões registradas 20261018033136, 20261018033423, 20261018034104 e 20261018035009. Arquivos locais com os mesmos IDs.
- Edge lovekoala-api **v21 ACTIVE**, com autenticação própria e verificações de assinatura.
- Configuração pública respondeu HTTP 200 com CORS https://lovekoala.com.br e image_credits=0.
- Chat público GLM/NVIDIA respondeu HTTP 200 em streaming, com conclusão, sem erro e ação examples/retrospectiva/encanto para o pedido explícito. Nenhum presente/pedido criado.
- tests/guest-checkout.sql passou com rollback no banco real: visitante sem proprietário antes/depois do pagamento, conta de e-mail incorreto recusada inclusive durante pendência, vinculação do presente e assinatura, cota, duplicação de Clube recusada, retomada e permissões.
- tests/captain.sql passou com rollback: admin/propriedade da proposta, mudança e idempotência com um registro de auditoria, conflito, expiração, 12 meses e acesso privado às tabelas/RPC.
- Novas tabelas com RLS e funções internas sem execução para papéis públicos. Crons de conciliação/expiração confirmados ativos.

## Limites e testes não concluídos

A conversa autenticada real do Capitão não foi executada. A revisão automática recusou um procedimento que criaria um usuário/admin de QA permanente e faria login sem limpeza; esse procedimento não foi executado nem contornado. A validação usou o handler real com provedores isolados e SQL remoto com rollback. As fixtures das suítes SQL aprovadas não persistem.

Nenhuma alteração desta rodada nos defaults SITE_URL/ALLOWED_ORIGINS ou Site URL do Auth foi confirmada. O código aceita produção e usa redirects explícitos; script/procedimento manual de EASYPANEL.md conclui essa configuração. DNS, HTTPS, EasyPanel e ativação dos webhooks no domínio não foram executados.

Docker/Nginx e controle de navegador não estão disponíveis neste ambiente. Não houve screenshot do Site, teste de toque/arraste, reprodução em alto-falante ou autoplay no celular. Não foram feitas compras/renovações reais ou envio de e-mail. Build/SSR/contratos não substituem esses testes de ponta a ponta.

Os resultados abaixo são históricos e não devem ser tratados como revalidação remota da versão atual.

---

# Verificação — 17/10/2026

## Rodada atual

- 37 testes Node passaram: domínio, calendário, relógio na virada de segundos/minutos/horas/dias, autorização de edição de 24h, `infinity`, música, Coala, jogos, contratos Stripe, resumo e pedido pago sem acesso.
- O contrato do Clube executa o handler real com banco isolado, usa a identidade autenticada, libera o presente sem chamar provedor de pagamento e nega cota esgotada/visitante sem login.
- O contrato de recuperação reproduz pedido pago com presente em rascunho: exige confirmação do provedor, recompõe o acesso, permite publicar, preserva idempotência e bloqueia divergência de valor ou pagamento pendente. Também nega alterações em presentes de 24h vencidos.
- TypeScript frontend e Edge, renderização SSR e parser CSS passaram. SSR cobre seis exemplos (35 páginas na fixture antiga, 36 nos exemplos novos), 17 capítulos, música opcional no álbum, relógios, ausência do aviso de 20 casais e do botão “Fotos com YouTube”.
- SQL das novas ofertas foi executado antes de aplicar, com rollback: 24h exatas, vitalício real, dois presentes por mês, primeiro presente contado, repetição sem consumir vaga, terceira criação negada, assinatura duplicada negada, fatura não paga sem cota, novo período pago e preservação dos presentes após cancelamento. Permissões de tabelas/RPC também verificadas.
- Comparação automática executada com rollback: invisível abaixo de 20 histórias, sem identificadores/datas retornados, cálculo agregado e par repetido não acrescentando um casal à amostra.
- Som de página substituído por gravação CC0 preparada em WAV mono local (52 KB); fonte e preparação em `docs/AUDIO.md`. Arte botânica própria foi rasterizada para revisão isolada; isso não é captura da tela do Site.

- Regressões de interação do álbum: arrastar papel vira página; raspar, clicar em botões e rolar texto não iniciam essa ação; caneta/toque/mouse seguem a mesma separação; captura é liberada; traço rápido não deixa lacunas; a revelação por botão continua disponível. Entrada na página da música é detectada em retrato e em ambas as posições de uma dupla, sem repetir no redimensionamento. Testes com eventos/controlador isolados, sem alegar verificação em navegador real.

## Verificações de integração

As 36 verificações do fluxo HTTP principal passaram na Edge Function v16. As cinco suítes SQL também passaram novamente no banco após a aplicação, todas com rollback.

O fluxo HTTP principal usa dados sintéticos e imagem real de teste em bucket privado. Confere validação, upload, URL assinada, publicação vitalícia, leitura pelo destinatário, ocultação do e-mail e bloqueio de site/edição/fotos após 24h, sem aguardar o cron. Nenhum pagamento ou e-mail real é feito. Fixtures e eventos do teste são removidos.

A suíte administrativa verificou login, perfil administrativo, leitura do painel, RLS, proprietário, lista/retomada, dados de música, compras pendentes, prévia pública, pausa, vencimento e rejeição de configurações inválidas. A conexão do ambiente foi interrompida no teste de busca musical, antes dos últimos casos; a suíte completa não é contada como aprovada nesta rodada. O registro temporário do presente, a cobrança sem provedor e o usuário sintético foram removidos por IDs conferidos; o banco confirmou zero registros restantes.

A suíte administrativa inclui verificações de proprietário, login, papel administrativo, RLS, lista/retomada/prévia, pausa, CMS, tags, planos, funil, compras não finalizadas, exclusão e ausência de segredos na resposta. O estado do CMS e dos planos é restaurado no fim.

## Limites

O ambiente não dispõe do controle de navegador exigido para QA visual pelo fluxo de Sites. Não foi feita captura de tela do Site, escuta em alto-falante/celular ou teste físico de arraste/YouTube. Build, SSR, análise de CSS e testes HTTP/SQL não substituem essa revisão. A publicação é verificada pelo resultado nativo do deploy.

A cobrança real reportada pelo usuário foi conferida por GET no provedor: o banco registra pago, mas a MercosulPay retornou `pending`. O pedido não foi alterado para fingir confirmação, nenhuma segunda cobrança foi criada e o presente não foi publicado como se o provedor tivesse confirmado. A recuperação automática está preparada para uma confirmação posterior.

## Koala / NVIDIA nesta rodada

- TypeScript frontend e Edge, 37 testes Node, SSR dos controles novos e parser CSS passaram. O contrato de IA executa o handler de produção com provedor isolado: valida planos, pagamento, referência, prompt, reserva, resultado e seleção; o chat filtra `reasoning_content`, bloqueia mensagens de sistema do visitante e mantém erros do provedor sem chaves. O presente público não inclui descrições de cenas, prompts, e-mail ou referências.
- Duas migrações aplicadas e registradas: 013 para estúdio e referências, 014 para revisão antes da inclusão. A suíte SQL dedicada passou com rollback: quatro slots, quinta imagem bloqueada, geração paralela bloqueada, resultado concluído sem regeneração, retirada sem recuperar crédito e acesso negado a plano de entrada, presente não pago, congelado ou reembolsado. Buckets e tabelas de referência são privados.
- GLM respondeu a uma chamada direta de streaming com a chave fornecida; a resposta inicial levou aproximadamente 47 segundos.
- Testes HTTP pela Edge v19 confirmaram leitura privada, propriedade, duas referências fictícias em storage privado, URLs temporárias e consentimento. As primeiras chamadas na região automática excederam o limite. Ao direcionar somente as chamadas NVIDIA para `us-west-1`, o suporte respondeu em aproximadamente oito segundos e o teste real de visão com duas referências concluiu em 22,3 segundos. A configuração regional está aplicada no cliente e no script de integração. Os arquivos e presentes sintéticos foram removidos ao fim de cada tentativa, sem cobrança, e-mail ou publicação.
- A primeira execução do script de integração interpretou HTTP 201 de sucesso do Management API como erro. O script foi corrigido; o único registro temporário daquela execução foi identificado por ID/marcadores de teste, sem pedidos, e removido.
- Nenhuma imagem foi realmente gerada pelo NIM: o endpoint GPU ainda não existe na configuração. O caminho de inferência foi verificado com resposta controlada no contrato isolado; isso não comprova uma inferência real.
- O mascote SVG foi rasterizado para revisão da ilustração. Não é captura do Site e não substitui QA visual ou de interação em celular.

- A rodada final pela região `us-west-1` passou nos 17 casos HTTP do script de IA: referências privadas, visão GLM com duas imagens, prompt sem gastar tentativa, ausência de NIM sem consumo de slot, invalidação após remover referência e resposta real de suporte em streaming com conclusão e planos corretos. A limpeza automática confere a exclusão do presente/arquivos sintéticos ao encerrar.
