# Fotos novas dos exemplos

Quatro imagens foram criadas nesta rodada com a ferramenta integrada **image_gen** (sem CLI ou API particular). São fotografias ilustrativas de um casal adulto fictício, usando a foto de demonstração já existente somente como referência de aparência. Foram integradas ao álbum e à retrospectiva; não representam clientes.

| Arquivo no projeto | Cena |
| --- | --- |
| `public/assets/demo-cafe.png` | Café em um dia de chuva, conversa e duas xícaras |
| `public/assets/demo-praia.png` | Praia ao pôr do sol, de mãos dadas |
| `public/assets/demo-casa.png` | Cozinhando juntos em casa |
| `public/assets/demo-serra.png` | Passeio no mirante da serra de Teresópolis |

A quinta foto do exemplo é a imagem anterior `public/assets/couple-demo.webp`.

## Prompts de produção

Especificação comum aplicada às quatro gerações:

> Use case: photorealistic-natural. Asset type: one landscape 3:2 demo photo for the LoveKoala couples-gift website. Input image: the existing fictional couple as CHARACTER REFERENCE ONLY. Preserve their adult mid-twenties appearance, warm medium skin, the woman's dark wavy hair and the man's short dark curly hair and beard. Create a new candid Brazilian lifestyle photograph, natural skin texture, warm intimate mood, believable light and hands. A single photo, no collage, no text, no logos, no watermarks, no UI.

Variações de cena usadas:

1. **Café:** a cozy Brazilian café on a rainy afternoon; two coffees by a window with raindrops; a candid affectionate conversation; warm window light.
2. **Praia:** walking hand in hand at a Brazilian beach at golden hour; ocean in the background; candid movement and natural smiles; soft sunset light.
3. **Casa:** cooking together in a cozy home kitchen; a shared ordinary happy moment; warm natural light and everyday details.
4. **Serra:** a scenic walk at a misty mountain viewpoint in Teresópolis, Brazil; the couple together looking across the green landscape; soft atmospheric daylight.

As animações, calendários, jogos e interfaces foram construídos em código, sem depender de geração de imagem em tempo de uso.

## Ilustrações da interface

`src/GiftArtwork.tsx` contém seis miniaturas de ocasião (bolo, presente, carta, anel, viagem e brinde), cinco decorações e três marcas de jogos. São SVGs construídos no código com paleta lilás/rosa/verde/dourado, sem fontes de emoji, imagens externas ou chamada de IA. As ilustrações foram inspecionadas em uma prancha renderizada dos próprios SVGs. Isso verifica os desenhos, sem substituir uma revisão do site em navegador.
