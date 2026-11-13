let categoryMetadataLoaded = false;
let categoryMetadataLoading = false;
let categoryItems = [];
let selectedGenres = new Set();
let selectedTags = new Set();
let categoryModeActive = false;
let categoryResults = [];
let categoryResultPage = 0;
let categorySearchQuery = "";
let categoryHasMore = false;
let categoryRequestId = 0;
let categoryLoadingMore = false;
let activeCategoryKind = "all";

// ── Live genre/tag discovery via the public AniList GraphQL collection ──
const CATEGORY_RU_LABELS = {
  "action":"Экшен", "adventure":"Приключения", "comedy":"Комедия", "drama":"Драма",
  "fantasy":"Фэнтези", "horror":"Ужасы", "mahou shoujo":"Махо-сёдзё", "mecha":"Меха",
  "music":"Музыка", "mystery":"Тайна / детектив", "psychological":"Психология",
  "romance":"Романтика", "sci-fi":"Научная фантастика", "slice of life":"Повседневность",
  "sports":"Спорт", "supernatural":"Сверхъестественное", "thriller":"Триллер",
  "shounen":"Сёнэн", "shoujo":"Сёдзё", "seinen":"Сэйнэн", "josei":"Дзёсэй",
  "isekai":"Исекай", "school":"Школа", "school life":"Школьная жизнь", "time travel":"Путешествия во времени",
  "reincarnation":"Реинкарнация", "magic":"Магия", "super power":"Сверхспособности", "superpowers":"Сверхспособности",
  "martial arts":"Боевые искусства", "historical":"Историческое", "military":"Военное", "crime":"Криминал",
  "detective":"Детектив", "vampire":"Вампиры", "vampires":"Вампиры", "zombie":"Зомби", "zombies":"Зомби",
  "survival":"Выживание", "revenge":"Месть", "mythology":"Мифология", "parody":"Пародия", "gag humor":"Гэг-юмор",
  "found family":"Найденная семья", "family life":"Семейные истории", "coming of age":"Взросление",
  "love triangle":"Любовный треугольник", "urban fantasy":"Городское фэнтези", "high stakes game":"Игра на выживание",
  "video games":"Видеоигры", "otaku culture":"Отаку-культура", "idol":"Айдолы", "idols":"Айдолы",
  "acting":"Актёрство", "performing arts":"Сценическое искусство", "animals":"Животные", "pets":"Домашние животные",
  "cooking":"Кулинария", "food":"Еда", "medicine":"Медицина", "work":"Работа", "workplace":"Рабочее место",
  "mafia":"Мафия", "organized crime":"Организованная преступность", "espionage":"Шпионаж", "politics":"Политика",
  "war":"Война", "space":"Космос", "robots":"Роботы", "post-apocalyptic":"Постапокалипсис",
  "apocalypse":"Апокалипсис", "dystopian":"Антиутопия", "utopia":"Утопия", "art":"Искусство",
  "photography":"Фотография", "writing":"Писательство", "literature":"Литература", "poetry":"Поэзия",
  "ghost":"Призраки", "ghosts":"Призраки", "demons":"Демоны", "demon":"Демоны", "angels":"Ангелы",
  "gods":"Боги", "goddess":"Богини", "dragons":"Драконы", "elves":"Эльфы", "witches":"Ведьмы",
  "witchcraft":"Колдовство", "alchemy":"Алхимия", "supernatural powers":"Сверхъестественные силы",
  "body swapping":"Обмен телами", "gender bending":"Смена гендера", "crossdressing":"Кроссдрессинг",
  "amnesia":"Амнезия", "memory manipulation":"Манипуляции памятью", "mind games":"Игры разума",
  "revenge":"Месть", "tournament":"Турниры", "combat sports":"Боевые виды спорта", "boxing":"Бокс",
  "basketball":"Баскетбол", "football":"Футбол", "baseball":"Бейсбол", "volleyball":"Волейбол",
  "swimming":"Плавание", "running":"Бег", "tennis":"Теннис", "cycling":"Велоспорт", "racing":"Гонки",
  "school club":"Школьный клуб", "club":"Клубы", "friendship":"Дружба", "romantic subtext":"Романтическая линия",
  "love polygon":"Любовный многоугольник", "slow romance":"Медленная романтика", "rural":"Деревенская жизнь",
  "urban":"Городская жизнь", "travel":"Путешествия", "road trip":"Дорожное путешествие", "adventure":"Приключения",
  "surreal comedy":"Сюрреалистическая комедия", "dark fantasy":"Тёмное фэнтези", "fairy tale":"Сказка",
  "alternate universe":"Альтернативная вселенная", "parallel world":"Параллельный мир", "virtual world":"Виртуальный мир",
  "cyberpunk":"Киберпанк", "steampunk":"Стимпанк", "space opera":"Космическая опера", "aliens":"Пришельцы",
  "extraterrestrial":"Внеземная жизнь", "clone":"Клоны", "cloning":"Клонирование", "artificial intelligence":"Искусственный интеллект",
  "android":"Андроиды", "cyborg":"Киборги", "dungeon":"Подземелья", "guilds":"Гильдии", "adventurers":"Авантюристы",
  "monster":"Монстры", "monster girl":"Монстр-девушка", "monster boys":"Монстр-мальчики", "beastmen":"Зверолюди",
  "animal transformation":"Превращение в животных", "shapeshifting":"Оборотничество", "werewolf":"Оборотни",
  "superhero":"Супергерои", "villainess":"Злодейка", "villain":"Злодеи", "anti-hero":"Антигерой",
  "teacher":"Учитель", "teaching":"Преподавание", "parenthood":"Родительство", "childcare":"Забота о детях",
  "siblings":"Братья и сёстры", "twins":"Близнецы", "orphan":"Сироты", "orphanage":"Приют",
  "historical fiction":"Историческая фантастика", "samurai":"Самураи", "ninja":"Ниндзя", "martial arts":"Боевые искусства",
  "traditional games":"Традиционные игры", "board games":"Настольные игры", "card games":"Карточные игры", "gambling":"Азартные игры",
  "ballet":"Балет", "dance":"Танцы", "classical music":"Классическая музыка", "rock music":"Рок-музыка",
  "band":"Музыкальная группа", "concert":"Концерт", "fashion":"Мода", "makeup":"Макияж", "beauty":"Красота",
  "fashion design":"Дизайн одежды", "cafe":"Кафе", "restaurant":"Ресторан", "hospital":"Больница", "medicine":"Медицина",
  "detectives":"Детективы", "police":"Полиция", "law enforcement":"Правоохранительные органы", "courtroom drama":"Судебная драма",
  "murder":"Расследование убийства", "serial killer":"Серийный преступник", "psychological thriller":"Психологический триллер",
  "horror comedy":"Комедийный хоррор", "body horror":"Боди-хоррор", "survival horror":"Хоррор-выживание",
  "cultivation":"Культивация", "wuxia":"Уся", "xianxia":"Сянься", "reincarnated in another world":"Перерождение в другом мире",
  "villainess":"Злодейка", "isekai":"Исекай", "reincarnation":"Реинкарнация", "regression":"Возвращение в прошлое",
  "time loop":"Временная петля", "time manipulation":"Манипуляции временем", "prophecy":"Пророчество", "destiny":"Судьба",
  "fate":"Рок", "supernatural mystery":"Сверхъестественная тайна", "conspiracy":"Заговор", "secret identity":"Тайная личность",
  "gender swap":"Обмен гендерными ролями", "body horror":"Боди-хоррор", "paranormal":"Паранормальное", "occult":"Оккультизм",
  "religion":"Религия", "religious symbolism":"Религиозная символика", "philosophy":"Философия", "existentialism":"Экзистенциализм",
  "coming of age":"Взросление", "trauma":"Преодоление травмы", "healing":"Исцеление", "slice of life":"Повседневность",
  "iyashikei":"Иясикэй — спокойная атмосфера", "iyashikei":"Иясикэй — спокойная атмосфера", "episodic":"Эпизодическое повествование",
  "ensemble cast":"Ансамбль персонажей", "female protagonist":"Главная героиня", "male protagonist":"Главный герой",
  "strong female lead":"Сильная героиня", "strong male lead":"Сильный герой", "anti-hero":"Антигерой", "tragedy":"Трагедия",
  "melodrama":"Мелодрама", "satire":"Сатира", "black comedy":"Чёрная комедия", "workplace comedy":"Комедия о работе",
  "romantic comedy":"Романтическая комедия", "romcom":"Романтическая комедия", "coming of age":"Взросление"
};
const CATEGORY_SAFE_EXCLUDE = /(?:hentai|ecchi|erotica|erotic|pornograph|sexual content|sexual violence|nudity|incest|rape|groping|explicit sexual|adult content)/i;
const CATEGORY_PRIORITY = ["Romance", "Shounen", "Action", "Adventure", "Comedy", "Fantasy", "Isekai", "Drama", "School", "Shoujo", "Seinen", "Mystery", "Supernatural", "Psychological", "Sci-Fi", "Slice of Life", "Thriller", "Sports", "Reincarnation", "Time Travel", "Magic", "Martial Arts"];
const CATEGORY_FALLBACK = [
  ["genre","Action"],["genre","Adventure"],["genre","Comedy"],["genre","Drama"],["genre","Fantasy"],["genre","Horror"],["genre","Mystery"],["genre","Psychological"],["genre","Romance"],["genre","Sci-Fi"],["genre","Slice of Life"],["genre","Sports"],["genre","Supernatural"],["genre","Thriller"],
  ...["Shounen","Shoujo","Seinen","Josei","Isekai","School","School Life","Time Travel","Reincarnation","Magic","Super Power","Martial Arts","Historical","Military","Crime","Detective","Vampire","Zombies","Survival","Revenge","Mythology","Parody","Found Family","Coming of Age","Love Triangle","Urban Fantasy","Video Games","Otaku Culture","Idol","Acting","Animals","Cooking","Mafia","Espionage","Politics","War","Space","Robots","Post-Apocalyptic","Dystopian","Utopia","Art","Photography","Writing","Poetry","Ghosts","Demons","Angels","Gods","Dragons","Elves","Witches","Alchemy","Body Swapping","Amnesia","Mind Games","Tournament","Boxing","Basketball","Football","Baseball","Volleyball","Swimming","Running","Tennis","Cycling","Racing","Friendship","Romantic Subtext","Slow Romance","Rural","Urban","Travel","Dark Fantasy","Fairy Tale","Alternate Universe","Parallel World","Cyberpunk","Steampunk","Aliens","Cloning","Artificial Intelligence","Android","Cyborg","Dungeon","Guilds","Monster","Shapeshifting","Werewolf","Superhero","Villainess","Teacher","Parenthood","Childcare","Siblings","Twins","Orphanage","Samurai","Ninja","Dance","Band","Fashion","Cafe","Hospital","Police","Murder","Psychological Thriller","Time Loop","Destiny","Occult","Philosophy","Healing","Iyashikei","Episodic","Ensemble Cast","Female Protagonist","Strong Female Lead","Tragedy","Melodrama","Satire","Black Comedy","Romantic Comedy"].map(name => ["tag",name])
];
function categoryLocalizedLabel(name) {
  const key = String(name || "").trim().toLowerCase();
  return CATEGORY_RU_LABELS[key] || name;
}
function normalizeCategoryValue(value) { return String(value || "").trim().toLowerCase(); }
function buildCategoryChipData(genres, tags) {
  const items = [];
  const seen = new Set();
  (genres || []).forEach(name => {
    const key = `genre:${normalizeCategoryValue(name)}`;
    if (!name || seen.has(key)) return;
    seen.add(key);
    items.push({ type: "genre", name, label: categoryLocalizedLabel(name), category: "Жанр" });
  });
  (tags || []).forEach(tag => {
    const name = String(tag?.name || "").trim();
    const category = String(tag?.category || "Темы");
    if (!name || tag?.isAdult || CATEGORY_SAFE_EXCLUDE.test(`${name} ${category}`)) return;
    const key = `tag:${normalizeCategoryValue(name)}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ type: "tag", name, label: categoryLocalizedLabel(name), category });
  });
  const priorityIndex = name => {
    const index = CATEGORY_PRIORITY.findIndex(p => normalizeCategoryValue(p) === normalizeCategoryValue(name));
    return index < 0 ? 999 : index;
  };
  items.sort((a,b) => {
    if (a.type !== b.type) return a.type === "genre" ? -1 : 1;
    const pa = priorityIndex(a.name), pb = priorityIndex(b.name);
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label, "ru");
  });
  return items;
}
function renderCategoryChips() {
  const root = document.getElementById("categoryChips");
  const badge = document.getElementById("categoryCountBadge");
  if (!root) return;
  const q = normalizeSearchText(document.getElementById("categorySearch")?.value || "");
  const kind = activeCategoryKind;
  const filtered = categoryItems.filter(item => {
    if (kind !== "all" && item.type !== kind) return false;
    if (!q) return true;
    return normalizeSearchText(`${item.label} ${item.name} ${item.category}`).includes(q);
  });
  if (badge) badge.textContent = categoryItems.length >= 100 ? `${categoryItems.length.toLocaleString("ru-RU")} категорий` : `${categoryItems.length} категорий`;
  if (!filtered.length) {
    root.innerHTML = `<div class="category-empty">Не нашёл такую категорию. Попробуй русское или английское название.</div>`;
    updateCategorySelectionLabel();
    return;
  }
  // All categories stay available in a scrollable area; search narrows the list instantly.
  root.innerHTML = filtered.map(item => {
    const selected = item.type === "genre" ? selectedGenres.has(item.name) : selectedTags.has(item.name);
    return `<button type="button" class="category-chip" data-category-type="${item.type}" data-category-name="${escapeHTML(item.name)}" aria-pressed="${selected}" title="${escapeHTML(item.category || item.type)}"><span>${escapeHTML(item.label)}</span><small class="category-chip-kind">${item.type === "genre" ? "жанр" : "тема"}</small></button>`;
  }).join("");
  updateCategorySelectionLabel();
}
function updateCategorySelectionLabel() {
  const label = document.getElementById("categorySelectionLabel");
  const status = document.getElementById("categoryStatus");
  if (label) {
    const count = selectedGenres.size + selectedTags.size;
    label.textContent = count ? `Выбрано: ${selectedGenres.size} жанр(а) · ${selectedTags.size} тем` : "Ничего не выбрано";
  }
  if (status && !categoryModeActive && categoryMetadataLoaded) {
    status.textContent = `Доступно ${categoryItems.length.toLocaleString("ru-RU")} жанров и тематических меток. Выбирай несколько, затем нажми «Найти аниме».`;
  }
}
function toggleCategoryChip(type, name) {
  const set = type === "genre" ? selectedGenres : selectedTags;
  if (set.has(name)) set.delete(name); else set.add(name);
  renderCategoryChips();
}
async function fetchCategoryMetadata() {
  if (categoryMetadataLoaded || categoryMetadataLoading) return;
  categoryMetadataLoading = true;
  const status = document.getElementById("categoryStatus");
  try {
    const query = `query { GenreCollection MediaTagCollection { name category isAdult } }`;
    const result = await enqueueAniListRequest(async () => {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After")) || 60;
        const error = new Error("AniList ограничил частоту запросов");
        error.retryAfterMs = retryAfter * 1000;
        throw error;
      }
      const json = await response.json();
      if (!response.ok || json.errors) throw new Error(json.errors?.[0]?.message || "Не удалось получить категории");
      return json.data;
    }, "normal");
    categoryItems = buildCategoryChipData(result?.GenreCollection || [], result?.MediaTagCollection || []);
    categoryMetadataLoaded = true;
    if (status) status.textContent = `Загружено ${categoryItems.length.toLocaleString("ru-RU")} доступных категорий из AniList.`;
  } catch (error) {
    console.warn("YORU category metadata unavailable", error);
    categoryItems = buildCategoryChipData(CATEGORY_FALLBACK.filter(([type]) => type === "genre").map(([,name]) => name), CATEGORY_FALLBACK.filter(([type]) => type === "tag").map(([,name]) => ({ name, category: "Темы", isAdult: false })));
    if (status) status.textContent = "Не удалось загрузить полный список категорий. Показан запасной список; для поиска нужны интернет и AniList.";
  } finally {
    categoryMetadataLoading = false;
    renderCategoryChips();
  }
}
async function applyCategorySelection() {
  const hasSelected = selectedGenres.size > 0 || selectedTags.size > 0;
  const status = document.getElementById("categoryStatus");
  if (!hasSelected) {
    categoryModeActive = false;
    categoryResults = [];
    categoryResultPage = 0;
    categoryHasMore = false;
    visibleLimit = VISIBLE_STEP;
    render();
    if (status) status.textContent = "Фильтр снят — снова показывается общий каталог.";
    return;
  }
  const requestId = ++categoryRequestId;
  currentFilter = "all";
  document.querySelectorAll(".tab").forEach(button => button.classList.toggle("active", button.dataset.filter === "all"));
  categoryModeActive = true;
  categoryResults = [];
  categoryResultPage = 0;
  categorySearchQuery = "";
  categoryHasMore = true;
  categoryLoadingMore = false;
  visibleLimit = VISIBLE_STEP;
  const genres = Array.from(selectedGenres);
  const tags = Array.from(selectedTags);
  if (status) status.textContent = "Ищем подходящие тайтлы в AniList…";
  document.getElementById("listTitle").textContent = "Аниме по категориям";
  document.getElementById("listSub").textContent = "Подбираем тайтлы по выбранным жанрам и темам…";
  try {
    const raw = await fetchAniList("", ["POPULARITY_DESC"], 1, null, "normal", { genres, tags });
    if (requestId !== categoryRequestId) return;
    categoryResults = raw.map(item => fromAniList(item));
    animeList = mergeAnimeLists(animeList, categoryResults);
    categoryResultPage = 1;
    categoryHasMore = raw.length === 50;
    render();
    if (status) status.textContent = categoryResults.length
      ? `Найдено ${categoryResults.length} аниме на первой странице. Кнопка «Показать ещё» загрузит следующие результаты.`
      : "По этим сочетаниям ничего не найдено. Попробуй снять одну из выбранных меток.";
    queueCatalogCacheWrite();
  } catch (error) {
    if (requestId !== categoryRequestId) return;
    console.error("YORU category search failed", error);
    if (status) status.textContent = "Не получилось выполнить поиск категорий. Проверь соединение и повтори.";
    render();
  }
}
async function loadMoreCategoryResults() {
  if (!categoryModeActive || categoryLoadingMore || !categoryHasMore) return;
  // Reveal the remaining items from the already fetched page before requesting the next one.
  if (visibleLimit < categoryResults.length) {
    visibleLimit = Math.min(categoryResults.length, visibleLimit + VISIBLE_STEP);
    render();
    return;
  }
  categoryLoadingMore = true;
  const status = document.getElementById("categoryStatus");
  const button = document.getElementById("showMoreButton");
  if (button) { button.disabled = true; button.textContent = "Загружаем…"; }
  const page = categoryResultPage + 1;
  const requestId = categoryRequestId;
  try {
    const raw = await fetchAniList(categorySearchQuery, categorySearchQuery ? ["SEARCH_MATCH"] : ["POPULARITY_DESC"], page, null, "normal", {
      genres: Array.from(selectedGenres), tags: Array.from(selectedTags)
    });
    if (requestId !== categoryRequestId) return;
    const incoming = raw.map(item => fromAniList(item));
    categoryResults = mergeAnimeLists(categoryResults, incoming);
    animeList = mergeAnimeLists(animeList, incoming);
    categoryResultPage = page;
    categoryHasMore = raw.length === 50;
    visibleLimit += VISIBLE_STEP;
    if (status) status.textContent = `Загружено ${categoryResults.length.toLocaleString("ru-RU")} результатов по выбранным категориям.`;
    render();
    queueCatalogCacheWrite();
  } catch (error) {
    if (status) status.textContent = "Не удалось загрузить следующую страницу категорий. Нажми «Показать ещё», чтобы повторить.";
  } finally {
    categoryLoadingMore = false;
    if (button) button.disabled = false;
    render();
  }
}
function clearCategorySelection() {
  selectedGenres.clear();
  selectedTags.clear();
  categoryModeActive = false;
  categoryResults = [];
  categoryResultPage = 0;
  categorySearchQuery = "";
  categoryHasMore = false;
  categoryRequestId++;
  renderCategoryChips();
  render();
  const status = document.getElementById("categoryStatus");
  if (status) status.textContent = "Выбор очищен. Показывается общий каталог.";
}

async function searchWithinSelectedCategories(queryText) {
  const query = String(queryText || "").trim();
  if (!categoryModeActive || !query) return;
  const requestId = ++categoryRequestId;
  categorySearchQuery = query;
  categoryResults = [];
  categoryResultPage = 0;
  categoryHasMore = false;
  visibleLimit = VISIBLE_STEP;
  const status = document.getElementById("categoryStatus");
  if (status) status.textContent = `Ищем «${query}» среди выбранных категорий…`;
  try {
    const raw = await fetchAniList(query, ["SEARCH_MATCH"], 1, null, "normal", {
      genres: Array.from(selectedGenres), tags: Array.from(selectedTags)
    });
    if (requestId !== categoryRequestId) return;
    categoryResults = raw.map(item => fromAniList(item));
    animeList = mergeAnimeLists(animeList, categoryResults);
    categoryResultPage = 1;
    categoryHasMore = raw.length === 50;
    render();
    if (status) status.textContent = categoryResults.length
      ? `Найдено ${categoryResults.length} совпадений по названию и выбранным категориям.`
      : "По этому названию в выбранных категориях ничего не найдено. Попробуй изменить запрос.";
    queueCatalogCacheWrite();
  } catch (error) {
    if (requestId !== categoryRequestId) return;
    if (status) status.textContent = "Не удалось выполнить поиск по категориям. Проверь соединение и повтори.";
  }
}

document.getElementById("categoryToggle")?.addEventListener("click", () => {
  const button = document.getElementById("categoryToggle");
  const panel = document.getElementById("categoryPanel");
  if (!button || !panel) return;
  const open = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(open));
  panel.hidden = !open;
  if (open) fetchCategoryMetadata();
});
document.getElementById("categorySearch")?.addEventListener("input", renderCategoryChips);
document.getElementById("categoryChips")?.addEventListener("click", event => {
  const chip = event.target.closest(".category-chip[data-category-type][data-category-name]");
  if (!chip) return;
  toggleCategoryChip(chip.dataset.categoryType, chip.dataset.categoryName);
});
document.querySelectorAll(".category-kind").forEach(button => button.addEventListener("click", () => {
  activeCategoryKind = button.dataset.categoryKind || "all";
  document.querySelectorAll(".category-kind").forEach(item => item.classList.toggle("active", item === button));
  renderCategoryChips();
}));
document.getElementById("clearCategorySelection")?.addEventListener("click", clearCategorySelection);
document.getElementById("applyCategorySelection")?.addEventListener("click", applyCategorySelection);
