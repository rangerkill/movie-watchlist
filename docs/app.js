const STORAGE_KEY = "ranger-watchlist-progress-v2";
const state = { movies: [], progress: {}, query: "", genre: "全部", status: "全部", selectedId: null };

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const formatDate = (value, withTime = false) => {
  if (!value) return "尚未记录";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(value));
};

function loadProgress() {
  try { state.progress = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { state.progress = {}; }
}

function saveProgress() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); }
function watchedAt(movie) { return state.progress[movie.id]?.watchedAt ?? movie.watched_at; }
function activeMovies() { return state.movies.filter((movie) => !state.progress[movie.id]?.removed); }
function watchlist() { return activeMovies().filter((movie) => !watchedAt(movie)); }
function watchedMovies() { return activeMovies().filter((movie) => watchedAt(movie)); }

function toggleWatched(movieId) {
  const movie = state.movies.find((item) => item.id === movieId);
  if (!movie) return;
  state.progress[movie.id] = { ...state.progress[movie.id], watchedAt: watchedAt(movie) ? null : new Date().toISOString() };
  saveProgress(); renderAll();
  if (state.selectedId === movie.id) openMovie(movie.id);
}

function removeMovie(movieId) {
  const movie = state.movies.find((item) => item.id === movieId);
  if (!movie || !window.confirm(`确定将《${movie.title}》移出片单吗？`)) return;
  state.progress[movie.id] = { ...state.progress[movie.id], removed: true };
  saveProgress(); closeDialog(); renderAll();
}

function randomPick() {
  const candidates = watchlist().length ? watchlist() : activeMovies();
  if (candidates.length) openMovie(candidates[Math.floor(Math.random() * candidates.length)].id);
}

function renderFeatured() {
  const movies = watchlist().slice().sort((a, b) => (b.added_at || b.added_date).localeCompare(a.added_at || a.added_date));
  const movie = movies[0] || activeMovies()[0];
  if (!movie) return;
  $("#featured").innerHTML = `
    <div class="heroBackdrop" style="background-image:linear-gradient(90deg,rgba(7,9,13,.98) 10%,rgba(7,9,13,.84) 48%,rgba(7,9,13,.18)),url('${escapeHtml(movie.poster)}')"></div>
    <div class="featuredCopy">
      <p class="eyebrow">TONIGHT'S PICK · 今晚看什么</p>
      <div class="heroRating"><span>豆瓣</span><strong>${movie.douban_rating ?? "暂无"}</strong><small>更新于 ${formatDate(movie.rating_updated_at)}</small></div>
      <h1>${escapeHtml(movie.title)}</h1><p class="heroOriginal">${escapeHtml(movie.original_title)}</p>
      <p class="heroReason">“${escapeHtml(movie.recommendation)}”</p>
      <div class="heroFacts"><span>${movie.runtime ? `${movie.runtime} 分钟` : "片长待定"}</span><span>${escapeHtml(movie.genres.join(" · "))}</span><span>${escapeHtml(movie.availability)}</span></div>
      <div class="heroActions"><button class="primaryButton" type="button" data-open="${escapeHtml(movie.id)}">查看详情</button><button class="ghostButton" type="button" data-random>换一部</button></div>
    </div>
    <div class="summary" aria-label="片单概况"><div><strong>${watchlist().length}</strong><span>部待看</span></div><b></b><div><strong>${watchedMovies().length}</strong><span>部已看</span></div><b></b><div><strong>${activeMovies().length}</strong><span>全部收藏</span></div></div>`;
}

function renderNew() {
  const movies = activeMovies().slice().sort((a, b) => (b.added_at || b.added_date).localeCompare(a.added_at || a.added_date)).slice(0, 3);
  $("#new-list").innerHTML = movies.map((movie) => `<button class="spotlightCard" type="button" data-open="${escapeHtml(movie.id)}"><img src="${escapeHtml(movie.poster)}" alt=""/><span class="spotlightShade"></span><span class="spotlightContent"><small>加入于 ${formatDate(movie.added_at || movie.added_date)}</small><strong>${escapeHtml(movie.title)}</strong><em>${escapeHtml(movie.recommendation)}</em></span></button>`).join("");
}

function renderPriority() {
  const movies = watchlist().filter((movie) => movie.priority === "最想看");
  $("#priority-list").innerHTML = movies.map((movie, index) => `<button type="button" data-open="${escapeHtml(movie.id)}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(movie.title)}</strong><small>${escapeHtml(movie.moods.join(" · "))}</small></div><em>${movie.douban_rating ?? "—"}</em><i>查看详情</i></button>`).join("") || `<div class="archiveEmpty"><p>最想看的电影都已完成。</p></div>`;
}

function renderFilters() {
  const genres = ["全部", ...new Set(activeMovies().flatMap((movie) => movie.genres))];
  $("#filters").innerHTML = genres.map((item) => `<button type="button" data-genre="${escapeHtml(item)}" class="${state.genre === item ? "active" : ""}">${escapeHtml(item)}</button>`).join("");
  $("#status-tabs").innerHTML = ["全部", "待看", "已看"].map((item) => `<button type="button" data-status="${item}" class="${state.status === item ? "active" : ""}">${item}</button>`).join("");
}

function movieMatches(movie) {
  const needle = state.query.trim().toLocaleLowerCase("zh-CN");
  const text = [movie.title, movie.original_title, movie.director, ...movie.cast, ...movie.genres].join(" ").toLocaleLowerCase("zh-CN");
  const statusMatches = state.status === "全部" || (state.status === "已看" ? Boolean(watchedAt(movie)) : !watchedAt(movie));
  return (!needle || text.includes(needle)) && (state.genre === "全部" || movie.genres.includes(state.genre)) && statusMatches;
}

function movieCard(movie) {
  const done = watchedAt(movie);
  return `<article class="movieCard ${done ? "isWatched" : ""}">
    <button class="posterButton" type="button" data-open="${escapeHtml(movie.id)}" aria-label="查看《${escapeHtml(movie.title)}》详情"><div class="posterFrame"><span class="posterFallback">${escapeHtml(movie.title.slice(0, 4))}</span><img src="${escapeHtml(movie.poster)}" alt="《${escapeHtml(movie.title)}》海报" loading="lazy"/><span class="posterShade"></span><span class="posterBadge ${done ? "watched" : ""}">${done ? "已看" : escapeHtml(movie.priority)}</span>${movie.douban_rating ? `<span class="ratingBadge"><b>${movie.douban_rating}</b><small>豆瓣</small></span>` : ""}</div></button>
    <div class="movieInfo"><button class="titleButton" type="button" data-open="${escapeHtml(movie.id)}"><h3>${escapeHtml(movie.title)}</h3><span>${escapeHtml((movie.release_date || "待定").slice(0, 4))}</span></button><p class="originalTitle">${escapeHtml(movie.original_title)}</p><p class="castLine">主演 · ${escapeHtml(movie.cast.slice(0, 3).join(" / "))}</p><div class="cardBottom"><span>${movie.runtime ? `${movie.runtime} 分钟` : escapeHtml(movie.genres.slice(0, 2).join(" · "))}</span><label class="watchCheck"><input type="checkbox" data-toggle="${escapeHtml(movie.id)}" ${done ? "checked" : ""}/><i aria-hidden="true">✓</i><span>${done ? "已看" : "标记已看"}</span></label></div></div>
  </article>`;
}

function renderGrid() {
  const visible = activeMovies().filter(movieMatches);
  $("#movie-grid").innerHTML = visible.map(movieCard).join("");
  $("#movie-grid").hidden = !visible.length;
  $("#empty-state").hidden = Boolean(visible.length);
}

function renderWatched() {
  const movies = watchedMovies();
  $("#watched-list").innerHTML = movies.length ? `<div class="watchedList">${movies.map((movie) => `<button type="button" data-open="${escapeHtml(movie.id)}"><img src="${escapeHtml(movie.poster)}" alt=""/><span><strong>${escapeHtml(movie.title)}</strong><small>看完于 ${formatDate(watchedAt(movie), true)}</small></span><em>豆瓣 ${movie.douban_rating ?? "暂无"}</em></button>`).join("")}</div>` : `<div class="archiveEmpty"><span>○</span><p>还没有看完的电影。<br/>看完一部后，勾选卡片上的“标记已看”即可。</p></div>`;
}

function renderAll() { renderFeatured(); renderNew(); renderPriority(); renderFilters(); renderGrid(); renderWatched(); }

function openMovie(movieId) {
  const movie = activeMovies().find((item) => item.id === movieId);
  if (!movie) return;
  state.selectedId = movie.id;
  const done = watchedAt(movie);
  const similar = activeMovies().filter((item) => item.id !== movie.id && item.genres.some((genre) => movie.genres.includes(genre))).slice(0, 3);
  $("#dialog-content").innerHTML = `<div class="dialogLayout">
    <div class="dialogVisual" style="background-image:linear-gradient(to top,#11141a 0%,transparent 48%),url('${escapeHtml(movie.poster)}')"><span class="dialogScore"><b>${movie.douban_rating ?? "—"}</b><small>豆瓣评分</small></span></div>
    <div class="dialogCopy"><p class="eyebrow">${done ? "WATCHED · 已看" : `${escapeHtml(movie.priority)} · 待看`}</p><h2>${escapeHtml(movie.title)}</h2><p class="dialogOriginal">${escapeHtml(movie.original_title)}</p>
      <div class="dialogFacts"><span>${formatDate(movie.release_date)}</span>${movie.runtime ? `<span>${movie.runtime} 分钟</span>` : ""}<span>${escapeHtml(movie.region)}</span><span>${escapeHtml(movie.genres.join(" · "))}</span></div>
      <div class="dialogActions"><button class="primaryButton" type="button" data-toggle-button="${escapeHtml(movie.id)}">${done ? "取消已看" : "✓ 标记已看"}</button><a class="ghostButton" href="${escapeHtml(movie.trailer_url)}" target="_blank" rel="noreferrer">观看预告</a><a class="ghostButton" href="${escapeHtml(movie.douban_url)}" target="_blank" rel="noreferrer">豆瓣页面</a></div>
      <div class="detailGrid"><div><small>加入时间</small><strong>${formatDate(movie.added_at || movie.added_date)}</strong></div><div><small>已看时间</small><strong>${formatDate(done, true)}</strong></div><div><small>上映状态</small><strong>${escapeHtml(movie.availability)}</strong></div><div><small>评分更新</small><strong>${formatDate(movie.rating_updated_at)}</strong></div></div>
      <div class="detailBlock"><h3>为什么想看</h3><p class="recommendation">“${escapeHtml(movie.recommendation)}”</p></div><div class="detailBlock"><h3>故事简介</h3><p>${escapeHtml(movie.overview)}</p></div><div class="detailBlock credits"><h3>主创与主演</h3><p><span>导演</span>${escapeHtml(movie.director)}</p><p><span>主演</span>${escapeHtml(movie.cast.join("、"))}</p></div>
      ${similar.length ? `<div class="detailBlock"><h3>片单里的相似电影</h3><div class="similarList">${similar.map((item) => `<button type="button" data-open="${escapeHtml(item.id)}"><img src="${escapeHtml(item.poster)}" alt=""/><span>${escapeHtml(item.title)}</span></button>`).join("")}</div></div>` : ""}
      <button class="removeButton" type="button" data-remove="${escapeHtml(movie.id)}">移出片单</button>
    </div></div>`;
  const dialog = $("#movie-dialog"); if (!dialog.open) dialog.showModal();
}

function closeDialog() { state.selectedId = null; $("#movie-dialog").close(); }

document.addEventListener("click", (event) => {
  const target = event.target.closest("button,a"); if (!target) return;
  if (target.dataset.open) openMovie(target.dataset.open);
  if (target.hasAttribute("data-random")) randomPick();
  if (target.dataset.genre) { state.genre = target.dataset.genre; renderFilters(); renderGrid(); }
  if (target.dataset.status) { state.status = target.dataset.status; renderFilters(); renderGrid(); }
  if (target.hasAttribute("data-reset")) { state.query = ""; state.genre = "全部"; state.status = "全部"; $("#search-input").value = ""; renderAll(); }
  if (target.dataset.toggleButton) toggleWatched(target.dataset.toggleButton);
  if (target.dataset.remove) removeMovie(target.dataset.remove);
});
document.addEventListener("change", (event) => { if (event.target.dataset.toggle) toggleWatched(event.target.dataset.toggle); });
$("#search-input").addEventListener("input", (event) => { state.query = event.target.value; renderGrid(); });
$("#dialog-close").addEventListener("click", closeDialog);
$("#movie-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeDialog(); });

async function initialize() {
  loadProgress();
  try {
    const response = await fetch("./data/movies.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.movies = await response.json(); renderAll();
  } catch (error) {
    $("#featured").innerHTML = `<div class="archiveEmpty"><p>片单加载失败，请稍后刷新。</p></div>`;
    console.error("Unable to load watchlist", error);
  }
}

initialize();
