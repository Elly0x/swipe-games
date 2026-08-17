# swipe-games

"Tinder para jogos" — descubra jogos deslizando cards, salve os que te interessam numa wishlist. HTML/CSS/JS puro, sem build, sem backend.

## Como funciona

- Arraste o card (mouse ou toque) para a direita = **like** (vai pra wishlist), para a esquerda = **pass** (descarta).
- Os botões ✕ / ♥ na parte de baixo fazem o mesmo, sem precisar arrastar.
- A wishlist e o histórico de swipes ficam salvos no `localStorage` do navegador.
- Cada like reforça os gêneros daquele jogo; o próximo lote de cards é reordenado priorizando gêneros parecidos (motor de recomendação simples).

## Dados dos jogos

Por padrão o site funciona **sem nenhuma configuração**, usando um catálogo local de exemplo (12 jogos) em `script.js`.

Para puxar dados reais e atualizados (jogos em alta, lançamentos etc.):

1. Crie uma conta gratuita em [rawg.io/apidocs](https://rawg.io/apidocs) e copie sua API key.
2. Abra `script.js` e cole a chave na primeira linha do objeto `CONFIG`:
   ```js
   const CONFIG = {
     RAWG_API_KEY: 'sua-chave-aqui',
     ...
   };
   ```
3. Salve — o site passa a buscar os jogos mais populares direto da RAWG API.

> A Steam Web API oficial **não funciona direto do navegador** (bloqueia CORS), por isso o projeto usa a RAWG API, que é gratuita e liberada para uso client-side.

## Publicar no GitHub Pages

1. Crie um repositório novo no GitHub (ex: `swipe-games`) e suba estes três arquivos (`index.html`, `style.css`, `script.js`) na raiz — pode usar o upload direto pelo site do GitHub ou o github.dev.
2. No repositório, vá em **Settings → Pages**.
3. Em "Build and deployment", selecione **Deploy from a branch**.
4. Escolha a branch `main` e a pasta `/ (root)`, depois clique em **Save**.
5. Em 1–2 minutos o site fica disponível em `https://seu-usuario.github.io/swipe-games/`.

Não precisa de servidor nem de passo de build — é só HTML/CSS/JS estático.
