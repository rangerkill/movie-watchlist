const state = {
  movies: [],
  query: "",
  genre: "全部",
};

const grid = document.querySelector("#movie-grid");
const filters = document.querySelector("#filters");
const searchInput = document.querySelector("#search-input");
const emptyState = document.querySelector("#empty-state");
const resetSearch = document.querySelector("#reset-search");
const dialog = document.querySelector("#movie-dialog");
const dialogContent = document.querySelector("#dialog-content");
const dialogClose = document.querySelector("#dialog-close");

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[char]);

const getYear = (date) => (date ? date.slice(0, 4) : "待定");

const formatDate = (date) => {
  if (!date) return "待定";
  const [year, month, day] = date.split("-");
  return `${year}.${month}.${day}`;
};

function renderSummary() {
  const genres = new Set(state.movies.flatMap((movie) => movie.genres));
  const latest = [...state.movies]
    .map((movie) => movie.added_date)
    .filter(Boolean)
    .sort()
    .at(-1);

  document.querySelector("#watch-count").textContent = state.movies.length;
  document.querySelector("#genre-count").textContent = genres.size;
  document.querySelector("#updated-date").textContent = formatDate(latest);
}

function renderFilters() {
  const genreNames = ["全部", ...new Set(state.movies.flatMap((movie) => movie.genres))];
  filters.innerHTML = genreNames
    .map((genre) => `
      <button
        class="filter-button${genre === state.genre ? " active" : ""}"
        type="button"
        data-genre="${escapeHtml(genre)}"
        aria-pressed="${genre === state.genre}"
      >${escapeHtml(genre)}</button>
    `)
    .join("");

  filters.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.genre = button.dataset.genre;
      renderFilters();
      renderMovies();
    });
  });
}

function movieMatches(movie) {
  const haystack = [
    movie.title,
    movie.original_title,
    movie.director,
    ...movie.genres,
    ...movie.cast,
  ].join(" ").toLocaleLowerCase("zh-CN");

  const matchesQuery = haystack.includes(state.query.toLocaleLowerCase("zh-CN"));
  const matchesGenre = state.genre === "全部" || movie.genres.includes(state.genre);
  return matchesQuery && matchesGenre;
}

function movieCard(movie, index) {
  const genres = movie.genres.slice(0, 3).map((genre) => `<li>${escapeHtml(genre)}</li>`).join("");
  const initials = movie.title.replace(/[：:！!·\s]/g, "").slice(0, 4);

  return `
    <article class="movie-card" style="animation-delay: ${index * 70}ms">
      <button class="poster-button" type="button" data-movie-id="${escapeHtml(movie.id)}" aria-label="查看《${escapeHtml(movie.title)}》详情">
        <div class="poster-frame">
          <span class="poster-fallback" aria-hidden="true">${escapeHtml(initials)}</span>
          <img src="${escapeHtml(movie.poster)}" alt="《${escapeHtml(movie.title)}》海报" loading="lazy" />
          <span class="poster-shade" aria-hidden="true"></span>
          <span class="poster-badge">待看</span>
          <span class="poster-index">${String(index + 1).padStart(2, "0")}</span>
        </div>
      </button>
      <div class="movie-info">
        <div class="movie-title-row">
          <h3>${escapeHtml(movie.title)}</h3>
          <span class="year">${escapeHtml(getYear(movie.release_date))}</span>
        </div>
        <p class="original-title">${escapeHtml(movie.original_title)}</p>
        <ul class="movie-tags">${genres}</ul>
      </div>
    </article>
  `;
}

function renderMovies() {
  const visibleMovies = state.movies.filter(movieMatches);
  grid.innerHTML = visibleMovies.map(movieCard).join("");
  grid.hidden = visibleMovies.length === 0;
  emptyState.hidden = visibleMovies.length !== 0;

  grid.querySelectorAll("img").forEach((image) => {
    image.addEventListener("error", () => image.remove(), { once: true });
  });

  grid.querySelectorAll("[data-movie-id]").forEach((button) => {
    button.addEventListener("click", () => openMovie(button.dataset.movieId));
  });
}

function openMovie(movieId) {
  const movie = state.movies.find((item) => String(item.id) === String(movieId));
  if (!movie) return;

  const facts = [
    formatDate(movie.release_date),
    movie.runtime ? `${movie.runtime} 分钟` : null,
    movie.region,
    movie.genres.join(" · "),
  ].filter(Boolean);

  dialogContent.innerHTML = `
    <div class="dialog-layout">
      <div class="dialog-poster" style="background-image: linear-gradient(150deg, rgba(255,77,54,.12), rgba(6,8,12,.2)), url('${escapeHtml(movie.poster)}')"></div>
      <div class="dialog-copy">
        <p class="eyebrow">WATCHLIST · ${escapeHtml(getYear(movie.release_date))}</p>
        <h2>${escapeHtml(movie.title)}</h2>
        <p class="dialog-original">${escapeHtml(movie.original_title)}</p>
        <div class="dialog-facts">${facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div>
        <p class="dialog-overview">${escapeHtml(movie.overview)}</p>
        <p class="dialog-credit">导演：${escapeHtml(movie.director)}<br />主演：${escapeHtml(movie.cast.join("、"))}</p>
      </div>
    </div>
  `;

  dialog.showModal();
}

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  renderMovies();
});

resetSearch.addEventListener("click", () => {
  state.query = "";
  state.genre = "全部";
  searchInput.value = "";
  renderFilters();
  renderMovies();
  searchInput.focus();
});

dialogClose.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

async function initialize() {
  try {
    const response = await fetch("./data/movies.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.movies = await response.json();
    renderSummary();
    renderFilters();
    renderMovies();
  } catch (error) {
    grid.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector("span").textContent = "片单加载失败，请稍后刷新";
    resetSearch.hidden = true;
    console.error("Unable to load watchlist", error);
  }
}

initialize();
