// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_KEY = '39754db5aa208e9eacd1d53d66112eb0';
const TMDB = 'https://api.themoviedb.org/3';
const BIG_BUDGET_THRESHOLD = 49_999_999;

// ─── STUDIO LISTS ─────────────────────────────────────────────────────────────
const DEFAULT_BLOCKED = `Walt Disney Pictures
Disney+
Disney Plus
Marvel Studios
Pixar Animation Studios
Pixar
20th Century Studios
20th Century Fox
Warner Bros. Pictures
Warner Bros
New Line Cinema
HBO Films
DC Films
DC Studios
Universal Pictures
Universal Studios
Amblin Entertainment
DreamWorks Pictures
DreamWorks Animation
DreamWorks
Paramount Pictures
Paramount Animation
Sony Pictures
Columbia Pictures
TriStar Pictures
Screen Gems
Lionsgate
Lionsgate Films
MGM
Metro-Goldwyn-Mayer
Amazon Studios
Amazon MGM Studios
Apple Original Films
Netflix
Netflix Studios
Skydance Media
Legendary Pictures
Village Roadshow Pictures`;



// ─── LIST HELPERS ─────────────────────────────────────────────────────────────
function getList(key, def) {
  return localStorage.getItem(key) || def;
}

function initLists() {
  document.getElementById('blockedStudios').value = getList('blockedStudios', DEFAULT_BLOCKED);
}

function saveLists() {
  localStorage.setItem('blockedStudios', document.getElementById('blockedStudios').value);
}

function getBlockedList() {
  return document.getElementById('blockedStudios').value.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean);
}


function toggleLists() {
  document.getElementById('listsPanel').classList.toggle('open');
}

// is it hollywood logic
function getVerdict(studios, originalLang, countries, budget) {
  const blockedList = getBlockedList();

  const blockedStudios = studios.filter(s =>
    blockedList.some(b => s.toLowerCase().includes(b) || b.includes(s.toLowerCase()))
  );


  const isForeign = originalLang !== 'en';
  const isUSA = countries.some(c => c.toLowerCase().includes('united states'));
  const isBigBudget = budget && budget >= BIG_BUDGET_THRESHOLD;
  // blocked studio = hard no
  if (blockedStudios.length > 0) {
    return { verdict: '🚫 No', cls: 'blocked', reason: `Produced by: ${blockedStudios.join(', ')}` };
  }
  // foreign language = yes
  if (isForeign) {
    return { verdict: '✅ Yes', cls: 'ok', reason: `Foreign language film — original language: ${originalLang.toUpperCase()}` };
  }
// not blocked + low budget = yes
if (!isBigBudget) {
  return { verdict: '✅ Yes', cls: 'ok', reason: 'Low budget, not from a blocked studio' };
}
  // big budget + no production data = maybe
  if (studios.length === 0) {
    return { verdict: '🤔 Maybe', cls: 'check', reason: 'No production data' };
  }
  // big budget usa = maybe
  return { verdict: '🤔 Maybe', cls: 'check', reason: `Big budget US film (${formatBudget(budget)})` };
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
async function searchMovie() {
  const title = document.getElementById('movieInput').value.trim();
  const resultEl = document.getElementById('result');
  if (!title) return;

  resultEl.style.display = 'block';
  resultEl.innerHTML = '<div class="loading">SEARCHING...</div>';
  document.getElementById('searchBtn').disabled = true;

  try {
    const res = await fetch(`${TMDB}/search/movie?query=${encodeURIComponent(title)}&api_key=${API_KEY}`);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      resultEl.innerHTML = `<div class="error-msg">No results for "${title}". Try adding a year, e.g. "Parasite 2019".</div>`;
      return;
    }

    // Sort by vote_count 
    const top = [...data.results]
      .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
      .slice(0, 3);

    top.length === 1 ? await loadMovie(top[0].id) : showPicker(top);

  } catch(e) {
    resultEl.innerHTML = '<div class="error-msg">Network error — check your connection and try again.</div>';
    console.error(e);
  } finally {
    document.getElementById('searchBtn').disabled = false;
  }
}

function showPicker(movies) {
  const resultEl = document.getElementById('result');
  const items = movies.map(m => {
    const year = m.release_date ? m.release_date.slice(0, 4) : '????';
    const poster = m.poster_path
      ? `<img src="https://image.tmdb.org/t/p/w92${m.poster_path}" alt="${m.title}" style="width:46px;border-radius:3px;flex-shrink:0">`
      : `<div style="width:46px;height:69px;background:var(--border);border-radius:3px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--muted)">🎬</div>`;
    return `
      <div onclick="loadMovie(${m.id})"
        style="display:flex;align-items:center;gap:14px;padding:12px;border:1px solid var(--border);border-radius:3px;cursor:pointer;transition:border-color 0.15s"
        onmouseover="this.style.borderColor='var(--accent)'"
        onmouseout="this.style.borderColor='var(--border)'">
        ${poster}
        <div>
          <div style="font-family:'DM Serif Display',serif;font-size:1rem">${m.title}</div>
          <div style="font-size:0.7rem;color:var(--muted);margin-top:2px">${year} · ${m.original_language.toUpperCase()}</div>
        </div>
      </div>`;
  }).join('');

  resultEl.innerHTML = `
    <div style="font-size:0.65rem;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:12px">Which one?</div>
    <div style="display:flex;flex-direction:column;gap:8px">${items}</div>
  `;
}

async function loadMovie(movieId) {
  const resultEl = document.getElementById('result');
  resultEl.innerHTML = '<div class="loading">LOADING...</div>';

  try {
    const [detailRes, creditsRes] = await Promise.all([
      fetch(`${TMDB}/movie/${movieId}?api_key=${API_KEY}`),
      fetch(`${TMDB}/movie/${movieId}/credits?api_key=${API_KEY}`)
    ]);
    renderResult(await detailRes.json(), await creditsRes.json());
  } catch(e) {
    resultEl.innerHTML = '<div class="error-msg">Failed to load movie details. Try again.</div>';
  }
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function formatBudget(n) {
  if (!n || n === 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString()}`;
}

function renderResult(d, credits) {
  const blockedList = getBlockedList();

  const studios   = (d.production_companies || []).map(c => c.name);
  const countries = (d.production_countries || []).map(c => c.name);
  const languages = (d.spoken_languages    || []).map(l => l.english_name);
  const budget    = d.budget;
  const cast      = (credits.cast  || []).slice(0, 6).map(a => a.name);
  const director  = (credits.crew  || []).find(c => c.job === 'Director');

  const { verdict, cls, reason } = getVerdict(studios, d.original_language, countries, budget);
  const isBigBudget = budget && budget > BIG_BUDGET_THRESHOLD;

  const studioFlags = studios.length > 0
  ? studios.map(s => {
      const bad = blockedList.some(b => s.toLowerCase().includes(b) || b.includes(s.toLowerCase()));
      return `<span class="flag ${bad ? 'bad' : 'neutral'}">${s}</span>`;
    }).join('')
  : '<span style="color:var(--muted);font-size:0.75rem">Not listed</span>';

  const countryFlags = countries.length > 0
    ? countries.map(c => `<span class="flag ${c.toLowerCase().includes('united states') ? 'bad' : 'neutral'}">${c}</span>`).join('')
    : '<span style="color:var(--muted);font-size:0.75rem">Unknown</span>';

  const posterHTML = d.poster_path
    ? `<div class="poster"><img src="https://image.tmdb.org/t/p/w200${d.poster_path}" alt="${d.title}"></div>`
    : `<div class="poster-placeholder">🎬</div>`;

  const year    = d.release_date ? d.release_date.slice(0, 4) : '';
  const runtime = d.runtime ? `${d.runtime} min` : '';
  const genres  = (d.genres || []).map(g => g.name).join(', ');
  const budgetFormatted = formatBudget(budget);

  document.getElementById('result').innerHTML = `
    <div class="verdict ${cls}">
      <div>
        <div class="verdict-label">${verdict}</div>
        <div class="verdict-reason">${reason}</div>
      </div>
    </div>

    <div class="movie-title">${d.title}</div>
    <div class="movie-meta">${[year, runtime, genres].filter(Boolean).join(' · ')}</div>

    <div class="poster-row">
      ${posterHTML}
      <div class="info-grid">
        <div class="info-item">
          <label>Director</label>
          <div class="value">${director ? director.name : 'N/A'}</div>
        </div>
        <div class="info-item">
          <label>Country</label>
          <div class="value">${countryFlags}</div>
        </div>
        <div class="info-item">
          <label>Language</label>
          <div class="value">${languages.join(', ') || d.original_language.toUpperCase()}</div>
        </div>
        <div class="info-item">
          <label>Production</label>
          <div class="value">${studioFlags}</div>
        </div>
      </div>
    </div>

    ${budgetFormatted ? `<div class="budget-note ${isBigBudget ? 'big' : ''}">Budget: ${budgetFormatted}${isBigBudget ? '' : ''}</div>` : ''}
    ${d.overview ? `<p class="plot">${d.overview}</p>` : ''}

    <div class="section-title">Top Billed Cast</div>
    <div class="cast-list">${cast.map(a => `<span class="cast-pill">${a}</span>`).join('')}</div>

    <a class="tmdb-link" href="https://www.themoviedb.org/movie/${d.id}" target="_blank">→ Open on TMDB</a>
  `;
}

//  innit
window.addEventListener('load', () => {
  initLists();
  document.getElementById('blockedStudios').addEventListener('input', saveLists);
  document.getElementById('movieInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') searchMovie();
  });
});
