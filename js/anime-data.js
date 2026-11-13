const RU_TITLE_OVERRIDES = {
  "one piece":"Ван-Пис", "naruto":"Наруто", "naruto shippuden":"Наруто: Ураганные хроники",
  "bleach":"Блич", "dragon ball z":"Драконий жемчуг Z", "dragon ball":"Драконий жемчуг",
  "attack on titan":"Атака титанов", "shingeki no kyojin":"Атака титанов", "demon slayer":"Клинок, рассекающий демонов",
  "kimetsu no yaiba":"Клинок, рассекающий демонов", "jujutsu kaisen":"Магическая битва", "chainsaw man":"Человек-бензопила",
  "spy x family":"Семья шпиона", "death note":"Тетрадь смерти", "fullmetal alchemist brotherhood":"Стальной алхимик: Братство",
  "fullmetal alchemist":"Стальной алхимик", "hunter x hunter":"Охотник × Охотник", "my hero academia":"Моя геройская академия",
  "boku no hero academia":"Моя геройская академия", "tokyo ghoul":"Токийский гуль", "frieren beyond journey s end":"Провожающая в последний путь Фрирен",
  "sousou no frieren":"Провожающая в последний путь Фрирен", "solo leveling":"Поднятие уровня в одиночку", "blue lock":"Синяя тюрьма: Блю Лок",
  "haikyu":"Волейбол!!", "violet evergarden":"Вайолет Эвергарден", "your name":"Твоё имя", "kimi no na wa":"Твоё имя",
  "weathering with you":"Дитя погоды", "suzume":"Судзумэ, закрывающая двери", "mob psycho 100":"Моб Психо 100",
  "one-punch man":"Ванпанчмен", "one punch man":"Ванпанчмен", "re zero":"Re:Zero — жизнь с нуля в альтернативном мире",
  "steins gate":"Врата Штейна", "cowboy bebop":"Ковбой Бибоп", "neon genesis evangelion":"Евангелион нового поколения",
  "the apothecary diaries":"Монолог фармацевта", "kusuriya no hitorigoto":"Монолог фармацевта", "dr. stone":"Доктор Стоун",
  "black clover":"Чёрный клевер", "black clover season 2":"Чёрный клевер: 2 сезон", "black clover 2nd season":"Чёрный клевер: 2 сезон",
  "fairy tail":"Хвост Феи", "vinland saga":"Сага о Винланде", "vinland saga season 2":"Сага о Винланде: 2 сезон", "vinland saga season two":"Сага о Винланде: 2 сезон", "berserk":"Берсерк",
  "the dangers in my heart":"Опасности в моём сердце", "oshi no ko":"Звёздное дитя", "mushoku tensei":"Реинкарнация безработного",
  "overlord":"Повелитель", "classroom of the elite":"Добро пожаловать в класс превосходства", "the eminence in shadow":"Восхождение в тени"
};

function applySavedStatus(anime) {
  const saved = savedStatuses[anime.id];
  if (saved) {
    anime.status = saved.status || anime.status;
    anime.progress = saved.progress ?? anime.progress;
  }
  return anime;
}

function cleanDescription(value) {
  return String(value || "Описание пока недоступно.")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlausibleAnimeTitle(value) {
  const title = String(value || "").trim();
  if (!title || /^\d{1,4}$/.test(title)) return false;
  if (/^(?:n\/?a|unknown|без названия|неизвестно)$/i.test(title)) return false;
  return title.length >= 2;
}

function pickRussianTitle(item) {
  const titles = item?.titles || [];
  const value = titles.find(t => /russian/i.test(t.type || ""))?.title?.trim() || "";
  return isPlausibleAnimeTitle(value) ? value : "";
}

function safeAnimeTitle(candidates, fallback = "Без названия") {
  const values = [...new Set((candidates || []).map(value => String(value || "").trim()).filter(Boolean))];
  // If one provider accidentally places an episode/rank number in a title field,
  // prefer a meaningful alternate title. Numeric-only real titles still survive
  // when no textual alternative exists (for example, "86").
  const meaningful = values.find(value => !/^\d{1,4}$/.test(value));
  return meaningful || values[0] || fallback;
}

function fromAniList(item, officialRussianTitle = "") {
  const title = item.title || {};
  const canonicalTitle = safeAnimeTitle([title.english, title.romaji, title.native, title.userPreferred, ...(item.synonyms || [])]);
  const key = normalizeSearchText(canonicalTitle);
  const localized = (isPlausibleAnimeTitle(officialRussianTitle) ? officialRussianTitle : "") || RU_TITLE_OVERRIDES[key] || "";
  const altTitle = safeAnimeTitle([title.romaji, title.native, title.english, title.userPreferred], canonicalTitle);
  const staff = (item.staff?.edges || []).map(edge => ({
    role: String(edge.role || "").trim(),
    name: String(edge.node?.name?.full || edge.node?.name?.native || "").trim()
  })).filter(person => person.name);
  const anime = {
    id: item.id,
    malId: item.idMal,
    title: localized || canonicalTitle,
    originalTitle: canonicalTitle,
    ruTitle: localized,
    alt: altTitle !== canonicalTitle ? altTitle : "",
    year: item.seasonYear || item.startDate?.year || "—",
    seasons: null,
    season: item.season || null,
    seasonYear: item.seasonYear || item.startDate?.year || null,
    countryOfOrigin: item.countryOfOrigin || "JP",
    format: item.format || "TV",
    studios: item.studios?.nodes?.map(x => x.name).filter(Boolean) || [],
    staff,
    startDate: item.startDate || null,
    episodes: Number(item.episodes) || (item.status === "RELEASING" && Number(item.nextAiringEpisode?.episode) > 1 ? Number(item.nextAiringEpisode.episode) - 1 : 0),
    episodeCountEstimated: !Number(item.episodes) && item.status === "RELEASING" && Number(item.nextAiringEpisode?.episode) > 1,
    airingStatus: item.status || "UNKNOWN",
    nextEpisode: item.nextAiringEpisode?.episode || null,
    nextEpisodeAt: item.nextAiringEpisode?.airingAt || null,
    popularity: item.popularity || 0,
    genres: item.genres || [],
    score: item.averageScore == null ? "—" : (item.averageScore / 10).toFixed(1),
    status: "unset",
    progress: 0,
    cover: item.coverImage?.extraLarge || item.coverImage?.large || item.coverImage?.medium || "",
    banner: item.bannerImage || "",
    desc: cleanDescription(item.description),
    descRu: "",
    synonyms: [...new Set([...(item.synonyms || []), title.english, title.romaji, title.native, title.userPreferred].filter(Boolean))]
  };
  return applySavedStatus(anime);
}

function fromJikan(item) {
  const russian = pickRussianTitle(item);
  const english = safeAnimeTitle([item.title_english, item.title, item.title_japanese, ...(item.title_synonyms || [])]);
  const key = normalizeSearchText(english);
  const localized = russian || RU_TITLE_OVERRIDES[key] || "";
  const anime = {
    id: -(item.mal_id || 1),
    malId: item.mal_id,
    title: localized || english,
    originalTitle: english,
    ruTitle: localized,
    alt: [item.title, item.title_japanese, ...(item.title_synonyms || [])].find(t => t && t !== (localized || english)) || "",
    year: item.year || item.aired?.prop?.from?.year || "—",
    seasons: null,
    episodes: item.episodes || 0,
    countryOfOrigin: item.countryOfOrigin || "",
    studios: (item.studios || []).map(x => x.name).filter(Boolean),
    staff: [],
    airingStatus: item.airing ? "RELEASING" : "FINISHED",
    nextEpisode: null,
    nextEpisodeAt: null,
    popularity: item.members || 0,
    genres: (item.genres || []).map(g => g.name),
    score: item.score == null ? "—" : Number(item.score).toFixed(1),
    status: "unset",
    progress: 0,
    cover: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || "",
    banner: "",
    desc: cleanDescription(item.synopsis),
    descRu: "",
    synonyms: [...new Set([...(item.titles || []).map(t => t.title), ...(item.title_synonyms || [])].filter(Boolean))]
  };
  return applySavedStatus(anime);
}

function applyShikimoriLocalization(anime, item) {
  if (!anime || !item) return anime;
  const rawRussian = String(item.russian || "").trim();
  const russian = isPlausibleAnimeTitle(rawRussian) ? rawRussian : "";
  const english = String(item.english || "").trim();
  const japanese = String(item.japanese || "").trim();
  const aliases = Array.isArray(item.synonyms) ? item.synonyms : [];
  const original = isPlausibleAnimeTitle(anime.originalTitle) ? anime.originalTitle : safeAnimeTitle([english, japanese, anime.title]);
  const override = RU_TITLE_OVERRIDES[normalizeSearchText(original)] || "";
  const localized = russian || (isPlausibleAnimeTitle(anime.ruTitle) ? anime.ruTitle : override);
  anime.ruTitle = localized || "";
  anime.title = localized || original || safeAnimeTitle([anime.title, english, japanese]);
  anime.originalTitle = original;
  anime.alt = [english, japanese, ...aliases, anime.alt].find(x => isPlausibleAnimeTitle(x) && normalizeSearchText(x) !== normalizeSearchText(anime.title)) || anime.alt || "";
  anime.synonyms = [...new Set([...(anime.synonyms || []), english, japanese, ...aliases].filter(Boolean))];
  anime._searchFields = null;
  return anime;
}

function fromShikimori(item) {
  const malId = Number(item.myanimelist_id || item.mal_id || 0) || null;
  const rawRussian = String(item.russian || "").trim();
  const russian = /^\d{1,4}$/.test(rawRussian) ? "" : rawRussian;
  const english = safeAnimeTitle([item.english, item.name, item.japanese]);
  return applySavedStatus({
    id: malId ? -malId : -(1000000000 + Number(item.id || 1)), malId, title: russian && !/^\d{1,4}$/.test(russian) ? russian : english,
    originalTitle: english, ruTitle: russian, alt: item.japanese || "",
    synonyms: [...new Set([...(Array.isArray(item.synonyms) ? item.synonyms : []), item.name, item.english, item.japanese].filter(Boolean))],
    year: item.aired_on ? Number(String(item.aired_on).slice(0,4)) || "—" : "—",
    seasons: null, episodes: Number(item.episodes) || 0, airingStatus: item.status === "ongoing" ? "RELEASING" : "FINISHED",
    countryOfOrigin: item.country || "", studios: (item.studios || []).map(x => x.name || x).filter(Boolean), staff: [],
    nextEpisode: null, nextEpisodeAt: null, popularity: 0, genres: (item.genres || []).map(g => g.russian || g.name).filter(Boolean),
    score: item.score ? Number(item.score).toFixed(1) : "—", status: "unset", progress: 0,
    cover: item.image?.original ? `https://shikimori.one${item.image.original}` : (item.image?.preview ? `https://shikimori.one${item.image.preview}` : ""),
    banner: "", desc: cleanDescription(item.description || ""), descRu: ""
  });
}

function mergeAnimeLists(existing, incoming) {
  const byId = new Map(existing.map(a => [String(a.id), a]));
  incoming.forEach(a => {
    const key = String(a.id);
    const previous = byId.get(key);
    if (previous) {
      // Refresh metadata but preserve the user's saved status/progress.
      byId.set(key, {
        ...previous,
        ...a,
        title: (isPlausibleAnimeTitle(a.ruTitle) && a.ruTitle) || (isPlausibleAnimeTitle(previous.ruTitle) && previous.ruTitle) || safeAnimeTitle([a.title, previous.title, a.originalTitle, previous.originalTitle]),
        ruTitle: (isPlausibleAnimeTitle(a.ruTitle) && a.ruTitle) || (isPlausibleAnimeTitle(previous.ruTitle) && previous.ruTitle) || "",
        synonyms: [...new Set([...(previous.synonyms || []), ...(a.synonyms || [])])],
        status: previous.status || a.status || "unset",
        progress: previous.progress ?? a.progress ?? 0
      });
    } else {
      byId.set(key, a);
    }
  });
  return Array.from(byId.values());
}
