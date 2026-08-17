/* ============================================================
   swipe-games / script.js
   - Busca jogos na RAWG API (com fallback para catálogo local)
   - Deck de cards com swipe (mouse + touch)
   - Wishlist persistida em localStorage
   - "Motor de recomendação" simples: prioriza gêneros curtidos
   ============================================================ */

const CONFIG = {
  // Proxy que busca dados direto da Steam (contorna o bloqueio de CORS)
  STEAM_PROXY_URL: 'https://swipe-games-proxy.sjanaylle.workers.dev/',
  // Alternativa: cole aqui sua chave gratuita de https://rawg.io/apidocs
  RAWG_API_KEY: '',
  RAWG_ENDPOINT: 'https://api.rawg.io/api/games',
  PAGE_SIZE: 20,
};

const STORAGE_KEYS = {
  wishlist: 'swipe-games:wishlist',
  seen: 'swipe-games:seen',
  genreScore: 'swipe-games:genre-score',
};

/* ---------- catálogo local (fallback, sem precisar de chave) ---------- */
const FALLBACK_GAMES = [
  { id: 'f1', name: 'Hollow Knight', released: '2017', rating: 4.5, genres: ['Metroidvania', 'Indie'], image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/header.jpg' },
  { id: 'f2', name: 'Hades', released: '2020', rating: 4.7, genres: ['Roguelike', 'Ação'], image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1145360/header.jpg' },
  { id: 'f3', name: 'Stardew Valley', released: '2016', rating: 4.6, genres: ['Simulação', 'Indie'], image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/header.jpg' },
  { id: 'f4', name: 'Celeste', released: '2018', rating: 4.5, genres: ['Plataforma', 'Indie'], image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/504230/header.jpg' },
  { id: 'f5', name: 'Disco Elysium', released: '2019', rating: 4.6, genres: ['RPG', 'Narrativa'], image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/632470/header.jpg' },
  { id: 'f6', name: 'Slay the Spire', released: '2019', rating: 4.4, genres: ['Roguelike', 'Cartas'], image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/646570/header.jpg' },
  { id: 'f7', name: 'Outer Wilds', released: '2019', rating: 4.7, genres: ['Exploração', 'Puzzle'], image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/753640/header.jpg' },
  { id: 'f8', name: 'Vampire Survivors', released: '2022', rating: 4.3, genres: ['Roguelike', 'Ação'], image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1794680/header.jpg' },
  { id: 'f9', name: 'Return of the Obra Dinn', released: '2018', rating: 4.5, genres: ['Mistério', 'Puzzle'], image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/653530/header.jpg' },
  { id: 'f10', name: 'Terraria', released: '2011', rating: 4.6, genres: ['Sandbox', 'Aventura'], image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/105600/header.jpg' },
  { id: 'f11', name: 'Undertale', released: '2015', rating: 4.5, genres: ['RPG', 'Indie'], image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/391540/header.jpg' },
  { id: 'f12', name: 'Dead Cells', released: '2018', rating: 4.4, genres: ['Roguelike', 'Metroidvania'], image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/588650/header.jpg' },
];

/* ---------- estado ---------- */
let queue = [];
let wishlist = load(STORAGE_KEYS.wishlist, []);
let genreScore = load(STORAGE_KEYS.genreScore, {});
let dragState = null;

/* ---------- refs ---------- */
const deckEl = document.getElementById('deck');
const deckEmptyEl = document.getElementById('deckEmpty');
const deckCounterEl = document.getElementById('deckCounter');
const apiStatusEl = document.getElementById('apiStatus');
const modeLabelEl = document.getElementById('modeLabel');
const wishlistEl = document.getElementById('wishlist');
const wishlistEmptyEl = document.getElementById('wishlistEmpty');
const wishCountEl = document.getElementById('wishCount');
const activityEl = document.getElementById('activity');
const passBtn = document.getElementById('passBtn');
const likeBtn = document.getElementById('likeBtn');
const infoBtn = document.getElementById('infoBtn');
const reloadBtn = document.getElementById('reloadBtn');

/* ---------- utils ---------- */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
function timestamp() {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}
function log(message, type = '') {
  const line = document.createElement('p');
  line.className = `activity-line ${type ? 'activity-line--' + type : ''}`;
  line.innerHTML = `<span class="activity-line__time">[${timestamp()}]</span> ${message}`;
  activityEl.appendChild(line);
}

/* ---------- carregar jogos ---------- */
async function loadGames() {
  apiStatusEl.textContent = '● connecting…';
  apiStatusEl.className = 'winbar__status';

  if (CONFIG.STEAM_PROXY_URL) {
    try {
      const res = await fetch(CONFIG.STEAM_PROXY_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('resposta vazia');
      apiStatusEl.textContent = '● online · steam';
      apiStatusEl.classList.add('is-ready');
      modeLabelEl.textContent = 'modo: Steam (via proxy)';
      return normalize(data, 'steam');
    } catch (err) {
      log(`erro ao buscar proxy Steam: ${err.message} — tentando alternativa`, 'sys');
    }
  }

  if (CONFIG.RAWG_API_KEY) {
    try {
      const url = `${CONFIG.RAWG_ENDPOINT}?key=${CONFIG.RAWG_API_KEY}&ordering=-added&page_size=${CONFIG.PAGE_SIZE}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      apiStatusEl.textContent = '● online · rawg.io';
      apiStatusEl.classList.add('is-ready');
      modeLabelEl.textContent = 'modo: RAWG API (trending)';
      return normalize(data.results, 'rawg');
    } catch (err) {
      apiStatusEl.textContent = '● falha na API · fallback local';
      apiStatusEl.classList.add('is-error');
      modeLabelEl.textContent = 'modo: catálogo local (falha ao buscar RAWG)';
      log(`erro ao buscar RAWG API: ${err.message} — usando catálogo local`, 'sys');
      return normalize(FALLBACK_GAMES, 'local');
    }
  }

  apiStatusEl.textContent = '● sem fonte externa · catálogo local';
  apiStatusEl.classList.add('is-error');
  modeLabelEl.textContent = 'modo: catálogo local (nenhuma API configurada)';
  return normalize(FALLBACK_GAMES, 'local');
}

function normalize(list, source) {
  const seen = new Set(load(STORAGE_KEYS.seen, []));
  return list
    .map(g => {
      if (source === 'rawg') {
        return {
          id: String(g.id),
          name: g.name,
          released: (g.released || '').slice(0, 4) || '—',
          rating: g.rating || 0,
          genres: (g.genres || []).map(x => x.name).slice(0, 3),
          image: g.background_image || '',
        };
      }
      if (source === 'steam') {
        return {
          id: String(g.id),
          name: g.name,
          released: g.released || '—',
          rating: g.rating || 4,
          genres: g.genres && g.genres.length ? g.genres : ['Steam'],
          image: g.image || '',
        };
      }
      return g;
    })
    .filter(g => !seen.has(g.id));
}

/* ---------- ordenação por "recomendação" ---------- */
function sortByPreference(list) {
  return [...list].sort((a, b) => scoreOf(b) - scoreOf(a));
}
function scoreOf(game) {
  return (game.genres || []).reduce((sum, g) => sum + (genreScore[g] || 0), 0);
}
function bumpGenreScore(game, delta) {
  (game.genres || []).forEach(g => {
    genreScore[g] = (genreScore[g] || 0) + delta;
  });
  save(STORAGE_KEYS.genreScore, genreScore);
}

/* ---------- render do deck ---------- */
function renderDeck() {
  deckEl.querySelectorAll('.card').forEach(c => c.remove());

  if (queue.length === 0) {
    deckEmptyEl.hidden = false;
    deckCounterEl.textContent = '0 jogos restantes no buffer';
    return;
  }
  deckEmptyEl.hidden = true;
  deckCounterEl.textContent = `${queue.length} jogo(s) restante(s) no buffer`;

  const visible = queue.slice(0, 3).reverse();
  visible.forEach((game, i) => {
    const depth = visible.length - 1 - i;
    const card = buildCard(game, depth);
    deckEl.appendChild(card);
  });
}

function buildCard(game, depth) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = game.id;
  card.style.transform = `translateY(${depth * 8}px) scale(${1 - depth * 0.035})`;
  card.style.zIndex = String(10 - depth);

  card.innerHTML = `
    <div class="card__media" style="background-image:url('${game.image || ''}')">
      <span class="card__tag">${game.released}</span>
      <span class="card__score">★ ${game.rating.toFixed(1)}</span>
      <span class="card__stamp card__stamp--like">LIKE</span>
      <span class="card__stamp card__stamp--pass">PASS</span>
    </div>
    <div class="card__body">
      <h2 class="card__title">${game.name}</h2>
      <p class="card__meta"><span>lançamento</span> ${game.released}</p>
      <div class="card__genres">
        ${(game.genres || []).map(g => `<span class="card__genre">${g}</span>`).join('')}
      </div>
    </div>
  `;

  if (depth === 0) attachDrag(card, game);
  return card;
}

/* ---------- drag / swipe ---------- */
function attachDrag(card, game) {
  card.addEventListener('pointerdown', onDown);

  function onDown(e) {
    card.setPointerCapture(e.pointerId);
    dragState = { startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 };
    card.classList.add('dragging');
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
  }
  function onMove(e) {
    if (!dragState) return;
    dragState.dx = e.clientX - dragState.startX;
    dragState.dy = e.clientY - dragState.startY;
    const rotate = dragState.dx / 18;
    card.style.transform = `translate(${dragState.dx}px, ${dragState.dy}px) rotate(${rotate}deg)`;
    const likeStamp = card.querySelector('.card__stamp--like');
    const passStamp = card.querySelector('.card__stamp--pass');
    likeStamp.style.opacity = Math.max(0, Math.min(1, dragState.dx / 100));
    passStamp.style.opacity = Math.max(0, Math.min(1, -dragState.dx / 100));
  }
  function onUp() {
    card.removeEventListener('pointermove', onMove);
    card.removeEventListener('pointerup', onUp);
    card.classList.remove('dragging');
    const threshold = 110;
    if (dragState && dragState.dx > threshold) {
      commitSwipe(card, game, 'like');
    } else if (dragState && dragState.dx < -threshold) {
      commitSwipe(card, game, 'pass');
    } else {
      card.style.transform = 'translate(0,0) rotate(0)';
    }
    dragState = null;
  }
}

function commitSwipe(card, game, direction) {
  const flyX = direction === 'like' ? 700 : -700;
  card.style.transform = `translate(${flyX}px, -40px) rotate(${direction === 'like' ? 30 : -30}deg)`;
  card.style.opacity = '0';

  queue = queue.filter(g => g.id !== game.id);
  const seen = load(STORAGE_KEYS.seen, []);
  seen.push(game.id);
  save(STORAGE_KEYS.seen, seen.slice(-500));

  if (direction === 'like') {
    addToWishlist(game);
    bumpGenreScore(game, 2);
    log(`SWIPE_RIGHT → <strong>${game.name}</strong> adicionado à wishlist.json`, 'like');
  } else {
    bumpGenreScore(game, -1);
    log(`SWIPE_LEFT → <strong>${game.name}</strong> descartado`, 'pass');
  }

  setTimeout(() => {
    queue = sortByPreference(queue);
    renderDeck();
  }, 250);
}

/* ---------- botões manuais ---------- */
function swipeTop(direction) {
  const topCard = deckEl.querySelector('.card:last-child');
  if (!topCard) return;
  const game = queue[0];
  if (!game) return;
  commitSwipe(topCard, game, direction);
}
passBtn.addEventListener('click', () => swipeTop('pass'));
likeBtn.addEventListener('click', () => swipeTop('like'));
infoBtn.addEventListener('click', () => {
  const game = queue[0];
  if (!game) return;
  const query = encodeURIComponent(game.name + ' game');
  window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener');
  log(`INFO → detalhes de <strong>${game.name}</strong> abertos em nova aba`, 'sys');
});
reloadBtn.addEventListener('click', () => init(true));

/* ---------- wishlist ---------- */
function addToWishlist(game) {
  if (wishlist.some(w => w.id === game.id)) return;
  wishlist.unshift(game);
  save(STORAGE_KEYS.wishlist, wishlist);
  renderWishlist();
}
function removeFromWishlist(id) {
  const game = wishlist.find(w => w.id === id);
  wishlist = wishlist.filter(w => w.id !== id);
  save(STORAGE_KEYS.wishlist, wishlist);
  renderWishlist();
  if (game) log(`wishlist.json → <strong>${game.name}</strong> removido`, 'pass');
}
function renderWishlist() {
  wishCountEl.textContent = `[${wishlist.length}]`;
  wishlistEl.querySelectorAll('.wish-item').forEach(el => el.remove());
  wishlistEmptyEl.hidden = wishlist.length > 0;

  wishlist.forEach(game => {
    const item = document.createElement('div');
    item.className = 'wish-item';
    item.innerHTML = `
      <span class="wish-item__thumb" style="background-image:url('${game.image || ''}')"></span>
      <span class="wish-item__name">${game.name}</span>
      <button class="wish-item__remove" aria-label="Remover">✕</button>
    `;
    item.querySelector('.wish-item__remove').addEventListener('click', () => removeFromWishlist(game.id));
    wishlistEl.appendChild(item);
  });
}

/* ---------- init ---------- */
async function init(isReload = false) {
  if (isReload) log('reload --batch executado', 'sys');
  const games = await loadGames();
  queue = sortByPreference(games);
  renderDeck();
  if (!isReload) log('sessão iniciada · buffer carregado', 'sys');
}

renderWishlist();
init();
