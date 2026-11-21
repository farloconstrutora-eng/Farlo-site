# FARLO — site

Site institucional da FARLO (sites com 3D e automações), publicado com GitHub Pages em https://farlo.online.

- HTML, CSS e JS puros, sem build.
- Páginas: `index.html`, `pacotes.html`, `portfolio.html`, `contato.html` e as versões em inglês em `en/`.
- Textos em `js/content.js` (PT e EN). Os HTML trazem o mesmo texto para quem abre sem JavaScript e para os buscadores.
- `js/home3d.js`: 3D do topo da home (three.js e modelos `.glb` carregados sob demanda) e demo da residência.
- `residencia-3d/`: demonstração 3D interativa, embutida na home.

## WhatsApp

O número do WhatsApp fica em `config.whatsapp` de `js/content.js` (só dígitos: 55 + DDD + número). Sem número válido, os botões voltam a levar ao Instagram e o formulário abre o e-mail.

## Créditos dos modelos 3D

- Sacola FAWÉ, casa e sala de demonstração: modeladas pela FARLO no Blender.
- Móveis, vegetação e texturas de apoio: [Poly Haven](https://polyhaven.com), licença CC0.
