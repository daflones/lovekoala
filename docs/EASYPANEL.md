# Implantação do LoveKoala no EasyPanel

Domínio: **https://lovekoala.com.br**. Projeto Supabase existente: `enhnlektomuoumozjsfp`.

## 1. Preparar o código

Extraia a pasta `lovekoala` do ZIP. Na raiz devem estar `package.json`, `package-lock.json`, `Dockerfile`, `deploy/`, `src/`, `public/` e `supabase/`.

Se for um repositório novo, inicialize o Git, faça commit e adicione o remote do seu próprio repositório. Se já existe, copie os arquivos mantendo o histórico. O pacote não contém o Git interno da hospedagem de prévia. Não coloque senhas ou tokens no commit.

Faça commit e push. O build usa o lockfile e `npm ci`. Para verificar localmente:

```sh
npm ci
npm run check
npm run check:edge
npm test
npm run test:ops
node scripts/render-check.mjs
npm run build
```

## 2. Conferir o backend já configurado

O backend desta entrega já está no Supabase: Edge Function v26 ativa e migrations 001–021 aplicadas em 18/10/2026. O segredo de webhook MercosulPay foi salvo e verificado com notificações assinadas; as credenciais Stripe foram preservadas. Site URL do Auth, redirects, SITE_URL e ALLOWED_ORIGINS também já estão alinhados ao domínio. Você não precisa reconfigurar esses valores para implantar o frontend. Para conferir o histórico ou preparar uma atualização futura, execute a partir da raiz do projeto:

```sh
python scripts/prepare-production.py
python scripts/prepare-production.py --apply
```

Use Python 3.10 ou posterior. O token de acesso Supabase é solicitado sem eco no terminal; também pode ser fornecido pela variável `SUPABASE_ACCESS_TOKEN`. O token não é salvo em arquivo. Esse script é específico do projeto existente com migrations 001–014: ele verifica o histórico antes de alterar algo.

A execução com `--apply`:

1. Aplica apenas os arquivos ausentes da tabela abaixo e registra cada histórico na mesma transação. No projeto atual, os sete já estão registrados e são ignorados.
2. Publica `supabase/functions/lovekoala-api/index.ts` com `verify_jwt=false`; as verificações próprias de autenticação, propriedade, admin, origem e assinaturas continuam no código.
3. Define `SITE_URL=https://lovekoala.com.br` e autoriza a origem principal, `www`, a prévia existente e o dev local na porta 4173.
4. Define o Site URL do Supabase Auth e acrescenta redirects para esses endereços, preservando os redirects anteriores.
5. Preserva as chaves de Stripe/MercosulPay/NVIDIA, a conta administradora, o segredo do cron e os dados existentes. Não cria pedidos, não envia e-mail e não altera webhooks de outros projetos.

| Versão registrada | Arquivo / finalidade |
| --- | --- |
| 20261018033136 | production_domain_image_pause: pausa de imagens e configuração privada dos callbacks |
| 20261018033423 | guest_checkout_after_payment: checkout de visitante, vinculação e retomada privada |
| 20261018034104 | captain_koala_admin_assistant: relatórios, propostas e aplicação auditada |
| 20261018035009 | guest_checkout_claim_guard: mesma proteção de e-mail no salvamento e no pagamento pendente |
| 20261018043541 | admin_chat_payment_controls: disponibilidade do chat, aprovação auditada e receita por origem |
| 20261018120929 | admin_approval_guards: preserva exclusividade do Clube na aprovação manual |
| 20261018143421 | retrospective_community_stats: comparações agregadas por comunidade e cidade |

Os nomes completos estão em `supabase/migrations/`. O script confere os IDs registrados, não reaplica os arquivos já concluídos e pode retomar uma atualização parcial. Não execute duas instâncias ao mesmo tempo. Uma republicação futura recebe uma versão Supabase posterior à v26.

Referência para manutenção manual: no Supabase, Authentication → URL Configuration, Site URL é `https://lovekoala.com.br`, com redirects para o domínio, `www`, a prévia e o desenvolvimento local. Nos secrets, SITE_URL e ALLOWED_ORIGINS seguem `supabase/.env.example`. Esses valores já foram configurados. **Nunca envie o arquivo de exemplo inteiro como secrets:** os valores vazios substituiriam credenciais existentes. O código também envia redirects explícitos no cadastro e na recuperação.

As migrations 001–014 são histórico de um banco já existente. Não execute o arquivo `migration-history.sql` nem todas as migrations novamente sobre produção. Para outro projeto Supabase, planeje a migração separadamente.

Se o backend desta release já tiver sido aplicado, as etapas são idempotentes; não é preciso trocar as credenciais. Consulte `STATUS.md` para o que foi efetivamente aplicado nesta entrega.

## 3. Criar o serviço no EasyPanel

- Crie um projeto e um serviço **App**.
- Fonte **GitHub/Git**: selecione seu repositório e branch. Caminho de build `/` se os arquivos estiverem na raiz do repositório; se você subir uma pasta externa chamada `lovekoala`, use `/lovekoala`.
- Builder **Dockerfile**; caminho `Dockerfile` relativo ao build path. Não defina comando de desenvolvimento, Vite preview ou `npm start`.
- Porta interna/target **8080**, protocolo interno **HTTP**. O proxy EasyPanel termina o HTTPS.
- Não é necessário volume para dados: fotos e banco permanecem no Supabase.
- O health check consulta `/healthz`. O contêiner serve o frontend pelo Nginx; `node_modules` não entram na imagem final.
- Faça Deploy e confira o log do build e do serviço.

A configuração pública do Supabase já tem defaults corretos. Se você a alterar, os únicos build args admitidos pelo Dockerfile são `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Esses valores são incorporados durante o build; exigem rebuild para mudar. Não coloque secrets de pagamento no EasyPanel.

Se quiser validar a imagem antes, em uma máquina com Docker:

```sh
docker build -t lovekoala .
docker run --rm -p 8080:8080 lovekoala
```

## 4. DNS, domínio e HTTPS

No seu provedor DNS:

- `A` para `@` apontando ao IP público **atual** do seu servidor EasyPanel.
- `www` como CNAME para `lovekoala.com.br`, se quiser usar o redirecionamento.
- Remova ou corrija AAAA antigo se o servidor não atender IPv6.

No EasyPanel, adicione `lovekoala.com.br` como domínio primário, HTTPS habilitado, destino HTTP na porta 8080. Adicione `www.lovekoala.com.br` ao mesmo serviço com certificado próprio; o Nginx redireciona para o domínio principal.

Se usar Cloudflare, o caminho até o servidor precisa ter certificado válido. Confirme HTTPS na origem antes de usar Full (strict). Não use Flexible. DNS, certificados e o serviço EasyPanel exigem acesso ao painel do seu servidor e não são configurados apenas ao extrair o ZIP.

## 5. Verificar rotas e migrar pagamentos

Até o domínio estar hospedado, os endpoints diretos Supabase continuam atendendo. URLs atuais e eventos necessários estão em [PAGAMENTOS.md](PAGAMENTOS.md). O segredo MercosulPay já pertence ao backend remoto e não deve ser copiado ao Git ou ao EasyPanel.

Depois de publicar:

```sh
python scripts/smoke-production.py
```

O script não faz compra. Verifica `/healthz`, o fallback das páginas internas e a rejeição de duas notificações sem assinatura.

Entre em **https://lovekoala.com.br/admin** com sua conta administradora existente. Em **Pagamentos → Domínio de produção**:

1. Clique **Verificar domínio**.
2. As duas rotas devem aparecer como verificadas.
3. Clique **Ativar webhooks no domínio**.

Endereços finais:

| Uso | Endereço |
| --- | --- |
| Stripe | `https://lovekoala.com.br/api/webhooks/stripe` |
| Novas cobranças Pix | `https://lovekoala.com.br/api/webhooks/mercosulpay` |
| Presentes publicados | `https://lovekoala.com.br/presente/endereco-escolhido` |
| Conta / recuperação de senha | `https://lovekoala.com.br/conta` |

A ativação testa os proxies com POST sem assinatura e exige `401 BAD_SIGNATURE` e o identificador do proxy correto. Depois atualiza **o mesmo endpoint dedicado do LoveKoala** no Stripe, preservando o segredo de assinatura, e grava a base dos novos callbacks Pix no Vault. Não cria outro endpoint nem altera o webhook de LifeBots/Kindora Paws.

Pedidos Pix anteriores mantêm o callback original. Os endpoints diretos Supabase continuam ativos para essas notificações e para reconciliação. O cron continua no Supabase; não precisa criar um agendamento EasyPanel.

Se a verificação falhar, a ativação é recusada antes de alterar os provedores. Corrija DNS/HTTPS/proxy e tente novamente. Não force uma URL de domínio que ainda não atende a função.

## 6. Verificação operacional antes de lançar

- Como visitante: monte o presente, pague sem conta, crie a conta/entre com o e-mail preenchido e confirme o endereço para vincular/publicar. Confira também quem já está conectado e a recuperação de senha. Guarde o acesso privado até concluir a vinculação.
- Koala: “Me mostra uma retrospectiva”, “Quero criar um álbum” e “Qual plano combina comigo?”. A dúvida sem pedido de navegação não deve trocar a página sozinha. O Koala não pode efetuar cobrança por conversa.
- Admin → Capitão Koala: consulte receitas de cada mês e compare períodos. Peça uma alteração, confira antes/depois e aplique pela proposta ou por nova mensagem explícita. Não trate receita bruta como lucro. Veja `CAPITAO_KOALA.md`.
- Uma compra controlada por cartão e uma por Pix, confirmação do provedor, publicação, retorno ao editor e acesso pelo celular. Os testes desta entrega não fazem transações financeiras reais.
- Oferta 24h: a expiração começa no pagamento e deve bloquear link/edição ao vencer. Clube: cota por período efetivamente pago; cancelamento mantém presentes vitalícios já criados.
- Configure o remetente Resend em Admin → Compras não finalizadas se quiser enviar resumos. Sem chave e domínio de envio verificado, o pedido e o link são salvos, mas o e-mail não é enviado. E-mails de autenticação dependem separadamente do SMTP/Supabase Auth.
- Complete a identificação do responsável e o contato comercial no texto do site antes do lançamento público. O pacote não inventa CNPJ/CPF ou um serviço de atendimento.
- Confira folha/raspadinha, calendários, música com toque inicial no celular, rotação de tela e leitor dos exemplos em aparelhos reais. O browser pode bloquear autoplay e vídeos específicos podem bloquear embed.

## Referências oficiais

- https://easypanel.io/docs/services/app
- https://docs.stripe.com/webhooks
- https://supabase.com/docs/guides/auth/redirect-urls

As referências foram consultadas em 18/10/2026. O tutorial documenta a configuração implementada neste projeto; não é um comprovante de implantação no seu servidor.
