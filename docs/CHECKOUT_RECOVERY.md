# Compras não finalizadas

## Comportamento entregue

1. O cliente informa o e-mail e monta seu presente antes de iniciar uma cobrança.
2. O servidor registra a tentativa com plano, formato, valor, provedor e um resumo. Isso não concede autorização para campanhas.
3. Antes do checkout, a pessoa pode marcar que quer receber um único resumo se não concluir. Nesse caso, a fila aguarda 15 minutos.
4. Ao voltar do Stripe, fechar o QR Pix ou sair do editor por um link interno, pode pedir o resumo imediatamente. Visitantes usam o mesmo e-mail do checkout; contas proprietárias podem escolher o endereço do resumo.
5. Para presentes vinculados, o link `/criar?id=UUID&continuar=1` exige login na conta proprietária. Para visitantes, o e-mail contém um link privado com `#retomar=...`. O segredo no fragmento permite retomar sem criar conta antes do pagamento; o servidor armazena seu hash e troca o acesso de edição ao consumi-lo. O link vence em 30 dias e deixa de funcionar após a vinculação à conta. Retentativas da mesma retomada são idempotentes.
6. O pagamento confirmado cancela resumos pendentes e marca as tentativas anteriores do mesmo presente como recuperadas.

Fechar a aba do navegador não permite abrir um modal personalizado. O cliente tenta registrar a saída com `fetch(..., {keepalive: true})`; o servidor também classifica como interrompida a tentativa sem movimento por 15 minutos. O opt-in anterior permite o resumo mesmo se o evento de saída não chegar.

O Pix continua pendente até o provedor informar vencimento ou pagamento. Fechar o QR não cancela a cobrança. Uma sessão Stripe pode ser retomada ou encerrada explicitamente; antes de encerrá-la o servidor confere se houve pagamento.

## Ativar envio de e-mail

**Último estado registrado: envio ainda não configurado.** A captura, a lista administrativa e os links funcionam; confira o estado atual no painel. A interface informa quando o envio estiver indisponível.

1. Acesse [Resend → Domains](https://resend.com/domains), adicione o domínio de envio e publique os registros DNS indicados pelo provedor.
2. Espere o domínio ficar verificado. Escolha um remetente desse domínio, como `LoveKoala <carinho@lovekoala.com.br>`.
3. Crie uma API key de envio no Resend.
4. Entre em `/admin` com a conta administradora → **Compras não finalizadas** → **Envio dos resumos**.
5. Preencha remetente e chave, marque **Ativar envio dos resumos solicitados** e salve. A chave vai para o Vault e não é devolvida ao navegador.
6. Como alternativa para operação por CLI, configure `RESEND_API_KEY`, `EMAIL_FROM` e `EMAIL_ENABLED=true` nos secrets da Edge Function. Essa opção prevalece sobre o formulário do painel.
7. Faça uma verificação de entrega com um rascunho seu e um endereço que você controla. Não marque uma compra como paga para testar e-mail.

Nenhum e-mail real foi enviado nos testes da implementação. Um status `sent` confirma aceitação da API do provedor; entrega em caixa de entrada depende do domínio, destinatário e serviço de e-mail.

## Operação

- A lista permite procurar pelo e-mail, filtrar em aberto/interrompidas/recuperadas e abrir uma prévia administrativa.
- Sem configuração de envio, o pedido recebe `unavailable`; o link e o rascunho continuam acessíveis. Após configurar, o cliente pode solicitar novamente. Pedidos antigos não são reenviados automaticamente só por ativar a integração.
- Fila acionada pela conciliação existente a cada cinco minutos. Reserva atômica evita dois workers processando o mesmo pedido; a API do provedor recebe chave de idempotência e payload estável para retries.
- Até três tentativas por pedido, intervalo de cinco minutos e janela de sete dias. Uma nova solicitação exige o acesso privado do presente ou a conta proprietária, consentimento e limites de requisição. Para visitantes, o destinatário precisa corresponder ao e-mail do checkout.
- Conteúdo do e-mail: nomes, formato, plano, valor, quantidade de fotos e link. Sem fotos, cartas ou senha. O link de visitante é um acesso privado; não o compartilhe. O payload estável da fila contém esse link para manter a idempotência e só é acessível pelo backend.
- A captura usa `lk_checkout_recovery`; leitura administrativa passa pela Edge Function. A tabela e as funções de fila/configuração não ficam abertas aos papéis `anon` ou `authenticated`.

A configuração é separada do Supabase Auth/SMTP usado por recuperação de senha. Não altera os webhooks Stripe/MercosulPay dos outros projetos.

Depois do pagamento, a pessoa cria a conta ou entra. O formulário recebe o e-mail informado anteriormente. A API só vincula um presente de visitante com pagamento em andamento/concluído a uma conta com esse mesmo e-mail confirmado. A assinatura mensal é vinculada junto; nenhum segundo pagamento é necessário para publicar.
