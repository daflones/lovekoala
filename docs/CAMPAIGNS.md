# Configuração de campanhas — LoveKoala

Acesse `/admin` → Campanhas e tags. Os campos recebem identificadores públicos, sem scripts.

## 1. Prepare o site e a medição

1. Use o domínio final com HTTPS. Confirme que os botões de exemplo, criação, cadastro e checkout estão funcionando.
2. Deixe as ferramentas de campanhas desativadas enquanto copia os identificadores. Nenhuma chave secreta é necessária nestes campos.
3. Escolha Google Tag Manager OU a instalação direta de GA4/Google Ads. Se usar GTM, não instale as mesmas tags duas vezes.
4. O painel registra o funil no próprio backend. Os pixels externos só carregam depois que a pessoa permite as ferramentas de campanhas.

[Documentação do Google](https://developers.google.com/tag-platform/gtagjs/reference)

## 2. Google Analytics 4

1. Crie uma propriedade GA4 para o LoveKoala e adicione um fluxo de dados Web com o domínio do site.
2. Copie o ID de medição que começa com G- e cole em Google Analytics 4. Se escolher GTM, instale a tag dentro do seu contêiner.
3. Ative e salve as campanhas no painel. Abra o site em uma aba de teste, aceite a medição de campanhas e navegue pelo editor.
4. Use o Tempo real e o DebugView do GA4 para verificar page_view, view_item, customize_product, begin_checkout e sign_up. purchase só é emitido após pagamento confirmado.

[Configurar o Google Analytics](https://support.google.com/analytics/answer/9304153)

## 3. Google Ads e YouTube Ads

1. No Google Ads, configure uma ação de conversão para compra no seu site. Escolha valor dinâmico e moeda BRL.
2. Copie o ID AW- e o rótulo da conversão para os dois campos correspondentes no painel. Se usar GTM, crie a tag de conversão no contêiner com o mesmo ID e rótulo.
3. O valor e o ID da transação vêm do pagamento confirmado. Não configure clique no botão de pagar como se já fosse uma compra.
4. Valide a instalação pelo Google Tag Assistant e pelo diagnóstico da conversão. As campanhas do YouTube usam essa mesma ação de conversão do Google Ads.

[Conversões do Google Ads](https://support.google.com/google-ads/answer/6095821)

## 4. Meta Ads · Facebook e Instagram

1. No Gerenciador de Eventos da Meta, crie ou selecione a fonte de dados Web / Pixel do LoveKoala.
2. Copie apenas o identificador numérico do Pixel e cole no campo Meta Pixel. Salve e ative as ferramentas.
3. Use Testar eventos no Gerenciador de Eventos ou o Meta Pixel Helper. Aceite as ferramentas no site e teste exemplo, criação e início do checkout.
4. Os eventos disponíveis são PageView, ViewContent, Lead, InitiateCheckout, CompleteRegistration e Purchase. Otimize a campanha para o evento que já tenha volume e dados reais.
5. Se configurar a Conversions API no futuro, use o mesmo event_id para desduplicar. Esta versão instala o Pixel do navegador; não pede token secreto no painel.

[Documentação do Meta Pixel](https://developers.facebook.com/docs/meta-pixel/get-started)

## 5. TikTok Ads

1. No TikTok Events Manager, crie uma fonte Web e selecione o TikTok Pixel com configuração manual.
2. Copie o Pixel ID e cole no campo TikTok Pixel. Salve, ative e aceite as ferramentas na sua visita de teste.
3. Valide em Test Events e com o TikTok Pixel Helper. O app envia ViewContent, Lead, InitiateCheckout, CompleteRegistration, Purchase e Subscribe.
4. Para novas configurações, use Purchase e Lead. Os nomes antigos CompletePayment e SubmitForm foram substituídos pelo TikTok.
5. Escolha o evento de otimização no grupo de anúncios depois de confirmar que ele está chegando na fonte de dados correta.

[Eventos atuais do TikTok](https://ads.tiktok.com/help/article/how-to-adopt-tiktoks-updated-standard-events)

## 6. Marque a origem e valide o funil

1. Acrescente UTMs aos links dos anúncios. Exemplo: ?utm_source=instagram&utm_medium=paid_social&utm_campaign=namorados_2026.
2. Use uma visita normal, fora do admin e do personalizador. Entre no exemplo, comece a criar, escolha um formato e avance até o checkout.
3. Confira os movimentos no painel. Uma mesma sessão permite acompanhar a sequência das etapas sem gravar o texto da história ou as fotos nos eventos.
4. Para validar Purchase de ponta a ponta, será necessário um pagamento confirmado no provedor. Os testes desta entrega não fazem uma compra.
5. Bloqueadores, consentimento e privacidade do navegador podem reduzir os números dos pixels. Para receita e assinaturas, use os registros confirmados do painel.

[Marcação de campanhas com UTMs](https://support.google.com/analytics/answer/10917952)

## Eventos do painel e dos pixels

| Ação | Google | Meta / TikTok |
| --- | --- | --- |
| Abrir página | page_view | PageView |
| Abrir exemplo | view_item | ViewContent |
| Começar presente | customize_product | Lead |
| Iniciar checkout | begin_checkout | InitiateCheckout |
| Cadastrar conta | sign_up | CompleteRegistration |
| Pagamento confirmado | purchase | Purchase |
| Renovação confirmada | purchase | Subscribe |

O painel interno recebe pagamentos e renovações pelo servidor. Pixels do navegador dependem de consentimento e de retorno do comprador ao app; renovações automáticas sem visita não são enviadas aos pixels nesta versão.
