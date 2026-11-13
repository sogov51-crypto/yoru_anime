const VISIBLE_STEP = 48;
const CATALOG_TARGET = 20000;
const CATALOG_PAGE_SIZE = 50;
const CATALOG_PAGES_PER_STREAM = 100;
const CATALOG_SORT_STREAMS = [
  { sort: ["POPULARITY_DESC"], label: "популярности" },
  { sort: ["START_DATE_DESC"], label: "новизне" },
  { sort: ["START_DATE"], label: "дате выхода" },
  { sort: ["SCORE_DESC"], label: "оценке" },
  { sort: ["TRENDING_DESC"], label: "трендам" },
  { sort: ["FAVOURITES_DESC"], label: "избранному" }
];
const CATALOG_MAX_PAGE_TOKEN = CATALOG_PAGES_PER_STREAM * CATALOG_SORT_STREAMS.length;

function save() {
  animeList.forEach(a => {
    savedStatuses[a.id] = { status: a.status, progress: a.progress };
  });
  localStorage.setItem("yoruStatuses", JSON.stringify(savedStatuses));
}

let searchRequestId = 0;

async function loadAnime(search = "", sort = ["POPULARITY_DESC"], forceRefresh = false) {
  const requestId = ++searchRequestId;
  const message = document.getElementById("listSub");
  const normalizedSearch = search.trim();

  // Keep the current cards visible while searching; don't clear the grid.
  if (normalizedSearch) {
    message.textContent = "Ищем похожие названия…";
  } else if (!animeList.length) {
    message.textContent = "Загружаем популярные аниме…";
  }

  try {
    if (!normalizedSearch) {
      // Initial load only. Clearing the search must not discard titles found earlier.
      if (animeList.length && !forceRefresh) {
        render();
        return;
      }
      const items = await fetchAniList("", sort);
      if (requestId !== searchRequestId) return;
      animeList = items.map(item => fromAniList(item));
      catalogLoadedPages.add(1);
      await queueCatalogCacheWrite();
    } else {
      const results = await Promise.allSettled([
        fetchAniList(normalizedSearch, ["SEARCH_MATCH"]),
        fetchJikan(normalizedSearch),
        fetchShikimori(normalizedSearch)
      ]);
      // Ignore late responses from an older query.
      if (requestId !== searchRequestId) return;

      const aniItems = results[0].status === "fulfilled" ? results[0].value : [];
      const malItems = results[1].status === "fulfilled" ? results[1].value : [];
      const shikiItems = results[2].status === "fulfilled" ? results[2].value : [];
      const malById = new Map(malItems.map(item => [item.mal_id, item]));
      const shikiByMalId = new Map(shikiItems.filter(item => item.myanimelist_id).map(item => [Number(item.myanimelist_id), item]));
      const incoming = aniItems.map(item => {
        const match = item.idMal ? malById.get(item.idMal) : null;
        const shiki = item.idMal ? shikiByMalId.get(Number(item.idMal)) : null;
        const anime = fromAniList(item, pickRussianTitle(match));
        return shiki ? applyShikimoriLocalization(anime, shiki) : anime;
      });
      const knownMalIds = new Set(aniItems.map(item => item.idMal).filter(Boolean));
      malItems.forEach(item => {
        if (!knownMalIds.has(item.mal_id)) incoming.push(fromJikan(item));
      });
      const knownShikiMalIds = new Set([...knownMalIds, ...malItems.map(item => item.mal_id)]);
      shikiItems.forEach(item => {
        if (!item.myanimelist_id || !knownShikiMalIds.has(Number(item.myanimelist_id))) incoming.push(fromShikimori(item));
      });

      // Add search results to the existing catalogue instead of replacing it.
      // If APIs return nothing, the previously loaded cards remain available.
      if (incoming.length) animeList = mergeAnimeLists(animeList, incoming);
    }

    if (requestId !== searchRequestId) return;
    render();
    if (!normalizedSearch) {
      updateCatalogBackgroundUI(`Сейчас ${animeList.length.toLocaleString("ru-RU")} / ${CATALOG_TARGET.toLocaleString("ru-RU")}. Каталог не грузится в фоне — нажми «Загрузить ещё», чтобы добавить следующую страницу.`);
    }
    if (normalizedSearch) {
      const matchCount = getMatchedAnime().length;
      message.textContent = matchCount
        ? `Найдено похожих тайтлов: ${matchCount}`
        : "Совпадений в загруженных данных нет. Попробуй другое название или подожди загрузки каталога.";
    }
  } catch (error) {
    console.error(error);
    if (requestId !== searchRequestId) return;
    // Never wipe the existing catalogue if a search request fails.
    if (animeList.length) {
      render();
      message.textContent = "Не удалось обновить поиск. Оставили загруженные аниме — проверь интернет.";
    } else {
      message.textContent = "Не удалось загрузить каталог. Проверь интернет и попробуй позже.";
      document.getElementById("empty").style.display = "block";
      document.getElementById("grid").style.display = "none";
    }
  }
}

function getBaseVisibleAnime() {
  // Use the canonical catalogue objects in category mode so status/progress changes stay in sync.
  let source = categoryModeActive
    ? categoryResults.map(item => animeList.find(existing => String(existing.id) === String(item.id)) || item)
    : animeList;
  if (currentFilter === "popular" && currentView !== "favorites") {
    if (popularPeriod === "month" && popularAnime.length) source = popularAnime;
    else if (popularPeriod === "year") {
      // Use the larger local catalog for the selected year, plus any newly fetched year results.
      source = mergeAnimeLists(animeList.filter(a => Number(a.year) === CURRENT_YEAR), popularAnime)
        .filter(a => Number(a.year) === CURRENT_YEAR);
    }
    // All-time popularity uses the full loaded catalog, not only the first API page.
  }
  let list = source.filter(a =>
    (currentView !== "favorites" || favoriteIds.includes(a.id)) &&
    (currentView === "favorites" || currentFilter === "all" || currentFilter === "popular" || a.status === currentFilter) &&
    (currentFilter !== "popular" || (Number(a.score) || 0) >= popularMinScore)
  );
  if (currentFilter === "popular") {
    if (popularSort === "trending" && popularPeriod === "month") {
      // Keep AniList's live trending order intact.
      return list;
    }
    list = list.slice().sort((a, b) => {
      if (popularSort === "score") return (Number(b.score)||0) - (Number(a.score)||0) || (b.popularity||0)-(a.popularity||0);
      if (popularSort === "trending") return (b.popularity||0) - (a.popularity||0);
      if (popularSort === "newest") return (Number(b.year)||0) - (Number(a.year)||0) || (b.popularity||0)-(a.popularity||0);
      return (b.popularity||0) - (a.popularity||0);
    });
  }
  return list;
}

function getMatchedAnime() {
  const q = document.getElementById("search").value.trim();
  const base = getBaseVisibleAnime();
  if (!q) return base;
  return base.map(a => ({anime: a, score: animeMatchScore(a, q)}))
    .filter(item => item.score >= 35)
    .sort((a, b) => b.score - a.score)
    .map(item => item.anime);
}

function getVisibleAnime() {
  const base = getBaseVisibleAnime();
  const q = document.getElementById("search").value.trim();
  if (!q) return base;
  const matches = getMatchedAnime();
  // Never show unrelated titles when a search has no matches.
  return matches;
}

function render() {
  const q = document.getElementById("search").value.trim();
  const list = getVisibleAnime();
  const visibleList = list.slice(0, visibleLimit);

  document.getElementById("grid").innerHTML = visibleList.map((a, i) => `
    <article class="card" role="button" tabindex="0" aria-label="Открыть аниме ${escapeHTML(a.ruTitle || a.title)}" onclick="openModal(${a.id})" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openModal(${a.id})}" style="animation-delay:${Math.min(i * 40, 250)}ms">
      <div class="poster">
        <img data-title-image-id="${a.id}" src="${a.cover || 'https://placehold.co/400x600/211938/e9ddff?text=YORU'}" alt="${escapeHTML(a.ruTitle || a.title)}"
          loading="lazy" decoding="async"
          onerror="this.onerror=null;this.src='https://placehold.co/400x600/211938/e9ddff?text=YORU'">
        <span class="status ${a.status || "unset"}">
          ${statusNames[a.status] || statusNames.unset}
        </span>
        <span class="rating">★ ${a.score}</span>
        <button class="favorite-button ${favoriteIds.includes(a.id) ? "is-favorite" : ""}" onclick="toggleFavorite(event, ${a.id})" title="${favoriteIds.includes(a.id) ? "Убрать из избранного" : "Добавить в избранное"}">${favoriteIds.includes(a.id) ? "♥" : "♡"}</button>
        <div class="poster-info">
          <strong>${a.year}</strong>
          <span>${escapeHTML(episodeBadge(a))}</span>
        </div>
      </div>

      <div class="card-body">
        <h3 data-title-id="${a.id}" title="${escapeHTML(a.ruTitle || a.title)}">${escapeHTML(a.ruTitle || a.title)}</h3>
        <div class="alt" data-title-alt-id="${a.id}">${escapeHTML(a.originalTitle || a.alt || "")}</div>

        <div class="tags">
          ${a.genres.slice(0, 2).map(g =>
            `<span class="tag">${escapeHTML(g)}</span>`
          ).join("")}
          <span class="tag">${escapeHTML(animeSeasonLabel(a))}</span>
        </div>

        <div class="actions" onclick="event.stopPropagation()">
          <button class="details" onclick="openModal(${a.id})">
            Подробнее
          </button>
          <button class="primary" onclick="openModal(${a.id}, true)">
            ▶ Смотреть
          </button>
          <div class="status-picker">
            <button onclick="toggleStatusMenu(event, ${a.id})" aria-label="Выбрать статус" title="Текущий статус: ${escapeHTML(statusNames[a.status] || statusNames.unset)}">${escapeHTML(statusNames[a.status] || statusNames.unset)} ▾</button>
            <div class="status-menu" id="status-menu-${a.id}">
              <button onclick="setStatus(${a.id}, 'watching')">◉ Смотрю</button>
              <button onclick="setStatus(${a.id}, 'watched')">✓ Просмотрено</button>
              <button onclick="setStatus(${a.id}, 'dropped')">✕ Брошено</button>
              <button onclick="setStatus(${a.id}, 'planned')">☆ В планах</button>
              <button onclick="setStatus(${a.id}, 'unset')">Сбросить статус</button>
            </div>
          </div>
        </div>
      </div>
    </article>
  `).join("");

  document.getElementById("empty").style.display = list.length ? "none" : "block";
  const empty = document.getElementById("empty");
  if (empty && q) empty.innerHTML = `<h3>Ничего не найдено</h3>По запросу «${escapeHTML(q)}» совпадений нет. Попробуй другое название.`;
  else if (empty) empty.innerHTML = "<h3>Ничего не найдено</h3>Попробуй изменить фильтр или подключение к интернету.";

  document.getElementById("grid").style.display =
    visibleList.length ? "grid" : "none";
  localizeVisibleTitles(visibleList);
  const showMore = document.getElementById("showMoreButton");
  if (showMore) {
    const localItemsRemain = visibleList.length < list.length;
    const remoteItemsRemain = categoryModeActive && categoryHasMore;
    showMore.hidden = !localItemsRemain && !remoteItemsRemain;
    showMore.textContent = localItemsRemain
      ? `Показать ещё ${Math.min(VISIBLE_STEP, list.length - visibleList.length)}`
      : (remoteItemsRemain ? `Загрузить ещё ${Math.min(CATALOG_PAGE_SIZE, 50)} аниме` : "Показать ещё");
  }
  const totalStatNode = document.getElementById("totalStat");
  if (totalStatNode) totalStatNode.textContent = animeList.length;
  document.getElementById("watchingStat").textContent =
    animeList.filter(a => a.status === "watching").length;
  document.getElementById("watchedStat").textContent =
    animeList.filter(a => a.status === "watched").length;
  document.getElementById("plannedStat").textContent =
    animeList.filter(a => a.status === "planned").length;

  syncYoruHeroSlides();
  ensureYoruHeroBannerPool();

  document.getElementById("listTitle").textContent =
    currentView === "favorites" ? "Избранное" :
    (categoryModeActive ? "Аниме по категориям" :
      (currentFilter === "popular" ? "Популярное аниме" :
        currentFilter === "all" ? "Все аниме" : statusNames[currentFilter]));

  const popularPeriods = document.getElementById("popularPeriods");
  if (popularPeriods) popularPeriods.hidden = currentFilter !== "popular" || currentView === "favorites";
  const popularControls = document.getElementById("popularControls");
  if (popularControls) popularControls.hidden = currentFilter !== "popular" || currentView === "favorites";
  const periodNote = document.getElementById("periodNote");
  if (periodNote) {
    periodNote.textContent = popularPeriod === "alltime"
      ? "Рейтинг AniList за всё время. Используй сортировку и фильтр рейтинга ниже."
      : popularPeriod === "year"
        ? `Релизы ${CURRENT_YEAR} года; сортировку можно менять ниже.`
        : "Текущие тренды AniList — это приближение к популярности месяца, не архив за 30 дней.";
  }
  document.getElementById("listSub").textContent =
    q ? "Результаты поиска: " + q :
    (categoryModeActive ? `Результаты AniList по выбранным категориям · ${categoryResults.length.toLocaleString("ru-RU")} загружено` :
      (currentView === "favorites" ? "Тайтлы, которые ты сохранил сердечком" :
        currentFilter === "popular" ? (popularPeriod === "alltime" ? "Популярные аниме за всё время" : popularPeriod === "year" ? `Популярные аниме, вышедшие в ${CURRENT_YEAR} году` : "Аниме в актуальном тренде AniList") :
        "Выбери тайтл, чтобы узнать подробности"));

  document.getElementById("resultCount")?.remove();

  const title = document.getElementById("listTitle");
  title.title = list.length + " " + word(list.length);
}


function showMoreAnime() {
  if (categoryModeActive) {
    if (visibleLimit < categoryResults.length) {
      visibleLimit = Math.min(categoryResults.length, visibleLimit + VISIBLE_STEP);
      render();
    } else if (categoryHasMore) {
      loadMoreCategoryResults();
    }
    return;
  }
  visibleLimit += VISIBLE_STEP;
  render();
}

async function loadPopularPeriod(period) {
  popularPeriod = period;
  visibleLimit = VISIBLE_STEP;
  document.querySelectorAll(".period-button[data-period]").forEach(button =>
    button.classList.toggle("active", button.dataset.period === period));
  render();
  const requestId = ++popularRequestId;
  const status = document.getElementById("catalogLoadStatus");
  if (status) status.textContent = "Обновляем рейтинг популярности…";
  try {
    const sortMap = { popularity: "POPULARITY_DESC", score: "SCORE_DESC", trending: "TRENDING_DESC", newest: "START_DATE_DESC" };
    const apiSort = [sortMap[popularSort] || "POPULARITY_DESC"];
    // AniList's monthly period is represented by its live trending ranking, not archived 30-day stats.
    let items;
    if (period === "year") items = await fetchAniList("", apiSort, 1, CURRENT_YEAR);
    else if (period === "month" && popularSort === "popularity") items = await fetchAniList("", ["TRENDING_DESC"], 1, null);
    else items = await fetchAniList("", apiSort, 1, null);
    if (requestId !== popularRequestId) return;
    popularAnime = items.map(item => fromAniList(item));
    animeList = mergeAnimeLists(animeList, popularAnime);
    render();
    if (status) status.textContent = `Загружено ${popularAnime.length} аниме для этой подборки.`;
  } catch (error) {
    console.error(error);
    if (requestId !== popularRequestId) return;
    if (status) status.textContent = "Не удалось обновить подборку. Показываем уже загруженный каталог.";
  }
}

function updateCatalogBackgroundUI(messageText = "") {
  const status = document.getElementById("catalogLoadStatus");
  const totalStat = document.getElementById("totalStat");
  const button = document.getElementById("loadCatalogButton");
  if (totalStat) totalStat.textContent = animeList.length;
  if (messageText && status) status.textContent = messageText;
  if (button) {
    button.hidden = animeList.length === 0;
    button.disabled = catalogLoading || animeList.length >= CATALOG_TARGET;
    button.textContent = catalogLoading
      ? "Загружаем страницу…"
      : animeList.length >= CATALOG_TARGET
        ? "Каталог достиг весь каталог"
        : `Загрузить следующую страницу · ${animeList.length.toLocaleString("ru-RU")} / ${CATALOG_TARGET.toLocaleString("ru-RU")}`;
  }
  const search = document.getElementById("search")?.value.trim() || "";
  if (!search && currentView === "home") {
    const showMore = document.getElementById("showMoreButton");
    if (showMore) {
      let count = categoryModeActive ? categoryResults.length : animeList.length;
      if (!categoryModeActive && ["watching", "watched", "planned", "dropped"].includes(currentFilter)) {
        count = animeList.filter(a => a.status === currentFilter).length;
      } else if (!categoryModeActive && currentFilter === "popular") {
        count = getBaseVisibleAnime().length;
      }
      const localRemain = visibleLimit < count;
      const remoteRemain = categoryModeActive && categoryHasMore;
      showMore.hidden = !localRemain && !remoteRemain;
      showMore.textContent = localRemain
        ? `Показать ещё ${Math.max(0, Math.min(VISIBLE_STEP, count - visibleLimit))}`
        : (remoteRemain ? "Загрузить ещё аниме" : "Показать ещё");
    }
  }
}

async function loadNextCatalogPage() {
  if (catalogLoading) return;
  if (!animeList.length) {
    await loadAnime();
    return;
  }
  if (animeList.length >= CATALOG_TARGET) {
    updateCatalogBackgroundUI(`Готово: ${animeList.length.toLocaleString("ru-RU")} уникальных аниме сохранено в этом браузере.`);
    return;
  }

  catalogLoading = true;
  updateCatalogBackgroundUI(`Готовим следующую страницу каталога… Текущий размер: ${animeList.length.toLocaleString("ru-RU")} / ${CATALOG_TARGET.toLocaleString("ru-RU")}.`);
  let addedUnique = 0;
  let attemptedPages = 0;
  let failed = false;
  try {
    // Each click fetches at most one non-empty page; no automatic 10k background crawl.
    while (animeList.length < CATALOG_TARGET && attemptedPages < CATALOG_MAX_PAGE_TOKEN) {
      let token = 0;
      for (let candidate = 2; candidate <= CATALOG_MAX_PAGE_TOKEN; candidate++) {
        if (!catalogLoadedPages.has(candidate)) { token = candidate; break; }
      }
      if (!token) break;

      const streamIndex = Math.floor((token - 1) / CATALOG_PAGES_PER_STREAM);
      const page = ((token - 1) % CATALOG_PAGES_PER_STREAM) + 1;
      const stream = CATALOG_SORT_STREAMS[streamIndex];
      if (!stream) break;
      attemptedPages++;

      let rawItems;
      try {
        rawItems = await fetchAniList("", stream.sort, page, null, "normal");
      } catch (error) {
        failed = true;
        throw error;
      }
      catalogLoadedPages.add(token);

      if (!rawItems.length) {
        // An empty page marks the remainder of this sorted stream as exhausted.
        for (let p = page + 1; p <= CATALOG_PAGES_PER_STREAM; p++) {
          catalogLoadedPages.add(streamIndex * CATALOG_PAGES_PER_STREAM + p);
        }
        continue;
      }

      const previousCount = animeList.length;
      animeList = mergeAnimeLists(animeList, rawItems.map(item => fromAniList(item)));
      addedUnique = animeList.length - previousCount;
      await queueCatalogCacheWrite();
      syncYoruHeroSlides();
      render();
      break;
    }

    if (!failed) {
      if (animeList.length >= CATALOG_TARGET) {
        updateCatalogBackgroundUI(`Готово: ${animeList.length.toLocaleString("ru-RU")} уникальных аниме в каталоге.`);
      } else if (attemptedPages === 0) {
        updateCatalogBackgroundUI(`Достигнут конец доступных подборок. Сохранено ${animeList.length.toLocaleString("ru-RU")} уникальных тайтлов.`);
      } else if (addedUnique >= 0) {
        updateCatalogBackgroundUI(`Добавлено ${addedUnique} новых уникальных тайтлов. Сейчас ${animeList.length.toLocaleString("ru-RU")} / ${CATALOG_TARGET.toLocaleString("ru-RU")}. Нажми кнопку ещё раз, чтобы загрузить следующую страницу.`);
      }
    }
  } catch (error) {
    console.warn("YORU manual catalog page failed", error);
    const retryAfter = error.retryAfterMs ? ` AniList попросил подождать примерно ${Math.ceil(error.retryAfterMs / 1000)} секунд.` : " Проверь соединение и попробуй снова.";
    updateCatalogBackgroundUI(`Не удалось загрузить страницу каталога.${retryAfter} Текущие данные сохранены.`);
  } finally {
    catalogLoading = false;
    updateCatalogBackgroundUI(document.getElementById("catalogLoadStatus")?.textContent || "");
  }
}

async function bootCatalog() {
  const status = document.getElementById("catalogLoadStatus");
  try {
    const cache = await readCatalogCache();
    if (cache && Array.isArray(cache.items) && cache.items.length) {
      animeList = cache.items.map(item => applySavedStatus({ ...item }));
      const rawPages = Array.isArray(cache.pages) ? cache.pages.map(Number).filter(Number.isFinite) : [1];
      // Old builds tried page 101+ and could cache those empty pages as completed. Keep the real
      // popularity stream (pages 1..100) and let the fixed multi-stream loader fill the rest.
      if (cache.catalogSchema !== 3) {
        catalogLoadedPages = new Set(rawPages.filter(page => page >= 1 && page <= CATALOG_PAGES_PER_STREAM));
      } else {
        catalogLoadedPages = new Set(rawPages.filter(page => page >= 1 && page <= CATALOG_MAX_PAGE_TOKEN));
      }
      if (!catalogLoadedPages.has(1)) catalogLoadedPages.add(1);
      catalogLastCachedPage = Math.max(1, ...Array.from(catalogLoadedPages));
      render();
      updateCatalogBackgroundUI(`Мгновенно открыли сохранённый каталог: ${animeList.length.toLocaleString("ru-RU")} уникальных аниме. Цель — ${CATALOG_TARGET.toLocaleString("ru-RU")}; новые страницы загружаются только по твоему нажатию.`);
      return;
    }
  } catch (error) {
    console.warn("YORU IndexedDB cache unavailable", error);
  }
  if (status) status.textContent = "Загружаем первую страницу каталога…";
  loadAnime();
}

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b =>
      b.classList.remove("active")
    );
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    if (currentFilter === "popular" && categoryModeActive) {
      categoryModeActive = false;
      categoryResults = [];
      categorySearchQuery = "";
      categoryRequestId++;
    }
    visibleLimit = VISIBLE_STEP;
    render();
    if (currentFilter === "popular") loadPopularPeriod(popularPeriod);
    else if (currentFilter === "all") {
      const status = document.getElementById("catalogLoadStatus");
      if (status && !catalogLoading && animeList.length >= CATALOG_TARGET) status.textContent = `Готово: ${animeList.length} аниме в каталоге.`;
    }
  });
});

document.querySelectorAll(".period-button[data-period]").forEach(button => {
  button.addEventListener("click", () => loadPopularPeriod(button.dataset.period));
});

document.getElementById("popularSort")?.addEventListener("change", event => {
  popularSort = event.target.value;
  if (currentFilter === "popular") loadPopularPeriod(popularPeriod);
  else render();
});
document.getElementById("popularMinScore")?.addEventListener("change", event => {
  popularMinScore = Number(event.target.value) || 0;
  render();
});

function closeStatusMenus() {
  document.querySelectorAll(".status-menu.open").forEach(item => item.classList.remove("open"));
  document.querySelectorAll(".card.status-menu-open").forEach(card => card.classList.remove("status-menu-open"));
}

function toggleStatusMenu(event, id) {
  event.stopPropagation();
  const menu = document.getElementById(`status-menu-${id}`);
  if (!menu) return;
  const wasOpen = menu.classList.contains("open");
  closeStatusMenus();
  if (!wasOpen) {
    menu.classList.add("open");
    menu.closest(".card")?.classList.add("status-menu-open");
  }
}

document.addEventListener("click", event => {
  if (!event.target.closest(".status-picker")) closeStatusMenus();
});

function cycleStatus(id) {
  const a = animeList.find(x => x.id === id);
  if (!a) return;
  const order = ["unset", "watching", "watched", "dropped", "planned"];
  a.status = order[(order.indexOf(a.status) + 1) % order.length];

  if (a.status === "watched") a.progress = animeEpisodeCount(a);
  if (a.status === "unset") a.progress = 0;

  save();
  render();
  toast("Статус: " + statusNames[a.status]);
}

function setStatus(id, status) {
  const a = animeList.find(x => x.id === id);
  if (!a || !Object.prototype.hasOwnProperty.call(statusNames, status)) return;
  a.status = status;

  if (status === "watched") a.progress = animeEpisodeCount(a);
  if (status === "unset") a.progress = 0;

  save();
  render();

  if (activeAnime === id) openModal(id);
  toast("Статус обновлён: " + statusNames[status]);
}

function toggleFavorite(event, id) {
  event?.stopPropagation();
  favoriteIds = favoriteIds.includes(id) ? favoriteIds.filter(x => x !== id) : [...favoriteIds, id];
  localStorage.setItem("yoruFavorites", JSON.stringify(favoriteIds));
  render();
  updateProfileStats();
  toast(favoriteIds.includes(id) ? "Добавлено в избранное ♥" : "Убрано из избранного");
}
