# LoveKoala

Presentes digitais para casais: álbum 3D e retrospectiva, com identidade lilás/rosa, cartas, fotos, músicas, contadores e minijogos. React + TypeScript + Vite; Supabase para autenticação, dados, arquivos, pagamentos e chat.

## Implantar no EasyPanel

Comece por **[docs/EASYPANEL.md](docs/EASYPANEL.md)**. O projeto inclui Dockerfile, Nginx com fallback de SPA, health check e proxies para webhooks. Porta interna **8080**. Domínio **https://lovekoala.com.br**.

O Supabase existente é `enhnlektomuoumozjsfp`. Os dados, contas, pagamentos e secrets já existentes permanecem lá; não é preciso hospedar outro banco, uma GPU ou um NIM no EasyPanel.

A configuração pública já aponta para o projeto correto. As chaves de Stripe, Pix e NVIDIA pertencem somente aos secrets do Supabase; nunca a `VITE_*`, ao frontend ou ao Git. `.env.example` e `supabase/.env.example` não contêm chaves privadas.

## Esta versão

- Geração de imagens pausada no backend e retirada do editor e dos benefícios. Arquivos anteriores são preservados.
- Visitantes pagam primeiro e depois criam a conta ou entram. O cadastro recebe o e-mail informado; a vinculação exige e-mail confirmado correspondente ao checkout. Quem já está conectado continua na própria conta.
- Koala usa GLM-5.3-Flash, responde em streaming e oferece navegação por intenções limitadas a páginas internas. Pode abrir uma página quando a pessoa pede. Ele não cria cobranças, publica ou altera contas.
- **Capitão Koala**, exclusivo do admin: relatórios por mês, consultas operacionais e ferramentas para propor alterações em planos, personalizador e pausas. Aplicação com revisão, confirmação e auditoria. Acesse `/admin?aba=captain`; veja [docs/CAPITAO_KOALA.md](docs/CAPITAO_KOALA.md).
- Etapas essenciais funcionam sem IA. A revisão de pagamento continua exigindo as informações e confirmações da pessoa.
- Um único chat acompanha a navegação entre a landing, o editor, os exemplos e a conta, mantendo a conversa apenas na sessão da página.
- Novos webhooks em `/api/webhooks/stripe` e `/api/webhooks/mercosulpay`. Admin → Pagamentos verifica os proxies HTTPS antes de migrar o endpoint Stripe e os callbacks de novos Pix. Os endpoints Supabase continuam aceitando notificações de cobranças anteriores.

**Estado remoto e limitações da entrega:** ver [docs/STATUS.md](docs/STATUS.md). Edge Function v21 e migrations 001–018 estão aplicadas. DNS/EasyPanel e a ativação dos webhooks no domínio dependem da implantação no servidor.

## Desenvolvimento e verificação

Node 24 LTS e npm:

```sh
npm ci
npm run check
npm run check:edge
npm test
npm run test:ops
node scripts/render-check.mjs
npm run build
npm run dev
```

O dev server usa a porta 4173. `npm run build` gera `dist/`; a imagem Docker serve somente esses arquivos. As Edge Functions não rodam dentro desse contêiner.

## Backend e domínio

Para atualizar o Supabase existente sem baixar ou substituir chaves de pagamento, use Python 3.10+:

```sh
python scripts/prepare-production.py
python scripts/prepare-production.py --apply
```

O token é solicitado de forma oculta ou lido de `SUPABASE_ACCESS_TOKEN`. O primeiro comando apenas consulta; o segundo aplica apenas as migrations 015–018 ausentes, publica a função e configura URL/origens/redirects de autenticação. O banco e a função já foram atualizados nesta entrega; o script também permite concluir o endereço padrão de Auth e as variáveis de domínio, que não foram reconfigurados nesta sessão. Não gera uma cobrança nem migra webhooks antes de o domínio responder. Use o guia completo antes da primeira execução.

## Continuidade

- [STATUS.md](docs/STATUS.md): estado atual e pendências verificadas.
- [VALIDATION.md](docs/VALIDATION.md): resultados e limites dos testes.
- [DEVIN_CONTINUACAO.md](docs/DEVIN_CONTINUACAO.md): prompt de continuidade.
- [ACCESS_PLANS.md](docs/ACCESS_PLANS.md): 24h, vitalício e Clube com dois presentes por ciclo pago.
- [CAMPAIGNS.md](docs/CAMPAIGNS.md): configuração e eventos de anúncios.
- [CHECKOUT_RECOVERY.md](docs/CHECKOUT_RECOVERY.md): compras não finalizadas e e-mail.
- [NVIDIA_AI.md](docs/NVIDIA_AI.md): conversa e navegação do Koala.
- [CAPITAO_KOALA.md](docs/CAPITAO_KOALA.md): ferramentas do assistente administrativo e leitura dos relatórios.

O ZIP exportado contém o código e a documentação, sem `.git`, credenciais, dependências locais ou diretórios de build. Faça commit e push no seu repositório e use esse repositório como fonte do EasyPanel.
"# lovekoala" 
