function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function animeMatchScore(anime, query) {
  const q = normalizeSearchText(query);
  if (!q) return 100;

  const queryWords = q.split(/\s+/).filter(Boolean);
  const fields = anime._searchFields || (anime._searchFields =
    [anime.title, anime.ruTitle, anime.originalTitle, anime.alt, ...(anime.synonyms || []), ...(anime.genres || [])]
      .map(normalizeSearchText)
      .filter(Boolean));
  let best = 0;

  for (const field of fields) {
    // Strong matches first: exact title, title prefix, or phrase contained in title.
    if (field === q) return 100;
    if (field.startsWith(q)) best = Math.max(best, 95);
    else if (field.includes(q)) best = Math.max(best, 90);

    const fieldWords = field.split(/\s+/).filter(Boolean);
    let matchedWords = 0;
    let wordScore = 0;

    for (const qw of queryWords) {
      let thisWordScore = 0;
      for (const fw of fieldWords) {
        if (fw === qw) {
          thisWordScore = Math.max(thisWordScore, 85);
        } else if (qw.length >= 3 && fw.startsWith(qw)) {
          thisWordScore = Math.max(thisWordScore, 75);
        } else if (qw.length >= 5) {
          const distance = editDistance(qw, fw);
          const maxDistance = qw.length >= 9 ? 2 : 1;
          if (distance <= maxDistance) {
            thisWordScore = Math.max(thisWordScore, 72 - distance * 5);
          }
        }
      }
      if (thisWordScore > 0) {
        matchedWords++;
        wordScore += thisWordScore;
      }
    }

    if (queryWords.length) {
      const coverage = matchedWords / queryWords.length;
      // Multi-word queries must match every word, or almost all for long queries.
      if (coverage === 1) best = Math.max(best, wordScore / queryWords.length);
      else if (queryWords.length >= 3 && coverage >= 0.75) {
        best = Math.max(best, (wordScore / matchedWords) * coverage);
      }
    }
  }

  // Short searches are intentionally strict to avoid unrelated/random titles.
  if (q.length <= 2) {
    return fields.some(field => field === q || field.startsWith(q)) ? Math.max(best, 90) : 0;
  }
  if (best >= 65) return best;
  const narrative = normalizeSearchText([anime.desc, anime.descRu].filter(Boolean).join(" "));
  if (narrative) {
    const stop = new Set(["аниме", "история", "про", "для", "когда", "который", "которая", "где", "или", "это", "есть", "the", "and", "with", "about"]);
    const meaningful = queryWords.filter(word => word.length >= 3 && !stop.has(word));
    const hits = meaningful.filter(word => narrative.includes(word)).length;
    if (meaningful.length && hits / meaningful.length >= 0.55) return 52 + 35 * hits / meaningful.length;
  }
  return 0;
}

async function openYoruSearchAnime(id) {
  let a = animeList.find(x => String(x.id) === String(id));
  if (!a) return;
  if (Number(a.id) < 0 && a.malId) {
    try {
      const item = await fetchAniListByMalId(a.malId);
      if (item?.id) {
        const mapped = fromAniList(item, a.ruTitle || "");
        mapped.status = a.status || mapped.status;
        mapped.progress = a.progress || 0;
        animeList = mergeAnimeLists(animeList, [mapped]);
        a = animeList.find(x => String(x.id) === String(mapped.id)) || mapped;
      }
    } catch (error) { console.debug("AniList cross-reference unavailable", error); }
  }
  openModal(a.id);
}

// Клавиша / или Ctrl+K быстро переводит фокус в поиск каталога.
document.addEventListener("keydown", event => {
  const target = event.target;
  const isTyping = target && (target.matches("input, textarea, select") || target.isContentEditable);
  if (!isTyping && (event.key === "/" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k"))) {
    event.preventDefault();
    const search = document.getElementById("search");
    search?.focus();
    search?.scrollIntoView({ behavior: yoruSettings.reduceMotion ? "auto" : "smooth", block: "center" });
  }
});

// ── YORU Global Search: live search across AniList, Shikimori and MyAnimeList/Jikan ──
const yoruSearchCache = new Map();
const YORU_SEARCH_CACHE_MS = 8 * 60 * 1000;
let yoruSearchSequence = 0;
let yoruSearchTimer = 0;

function yoruKeyboardLayoutVariant(value) {
  const en = "`qwertyuiop[]asdfghjkl;'zxcvbnm,./~QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>?";
  const ru = "ёйцукенгшщзхъфывапролджэячсмитьбю.ЁЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,";
  const toRu = new Map([...en].map((ch, i) => [ch, [...ru][i] || ch]));
  const toEn = new Map([...ru].map((ch, i) => [ch, [...en][i] || ch]));
  const hasCyr = /[а-яё]/i.test(value);
  const hasLat = /[a-z]/i.test(value);
  if (hasCyr && !hasLat) return [...value].map(ch => toEn.get(ch) || ch).join("");
  if (hasLat && !hasCyr) return [...value].map(ch => toRu.get(ch) || ch).join("");
  return "";
}

function yoruTransliterateRu(value) {
  const map = { ж:"zh", х:"kh", ц:"ts", ч:"ch", ш:"sh", щ:"shch", ю:"yu", я:"ya", ё:"yo", э:"e", й:"y", ы:"y", ь:"", ъ:"", а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", з:"z", и:"i", к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u", ф:"f" };
  return [...String(value || "").toLowerCase()].map(ch => map[ch] ?? ch).join("");
}

function yoruSearchVariants(query) {
  const variants = [];
  const keyboard = yoruKeyboardLayoutVariant(query).trim();
  if (keyboard.length >= 3 && normalizeSearchText(keyboard) !== normalizeSearchText(query)) variants.push(keyboard);
  if (/[а-яё]/i.test(query)) {
    const translit = yoruTransliterateRu(query).trim();
    if (translit.length >= 3 && normalizeSearchText(translit) !== normalizeSearchText(query)) variants.push(translit);
  }
  const words = String(query).trim().split(/\s+/).filter(word => word.length >= 4);
  if (words.length >= 2) {
    const longest = [...words].sort((a, b) => b.length - a.length)[0];
    if (longest && longest.length >= 5) variants.push(longest);
  }
  return [...new Set(variants)].slice(0, 2);
}

function mergeSearchProviderResults(aniItems, jikanItems, shikiItems) {
  const shikiByMal = new Map(shikiItems.filter(x => Number(x.myanimelist_id)).map(x => [Number(x.myanimelist_id), x]));
  const jikanByMal = new Map(jikanItems.filter(x => Number(x.mal_id)).map(x => [Number(x.mal_id), x]));
  const results = [];
  const usedMal = new Set();
  const usedAni = new Set();
  for (const item of aniItems) {
    const malId = Number(item.idMal) || 0;
    const shiki = malId ? shikiByMal.get(malId) : null;
    const jikan = malId ? jikanByMal.get(malId) : null;
    let anime = fromAniList(item, pickRussianTitle(jikan));
    if (shiki) anime = applyShikimoriLocalization(anime, shiki);
    results.push(anime);
    usedAni.add(Number(item.id));
    if (malId) usedMal.add(malId);
  }
  for (const item of jikanItems) {
    const malId = Number(item.mal_id) || 0;
    if (!malId || usedMal.has(malId)) continue;
    let anime = fromJikan(item);
    const shiki = shikiByMal.get(malId);
    if (shiki) anime = applyShikimoriLocalization(anime, shiki);
    results.push(anime);
    usedMal.add(malId);
  }
  for (const item of shikiItems) {
    const malId = Number(item.myanimelist_id) || 0;
    if (malId && usedMal.has(malId)) continue;
    results.push(fromShikimori(item));
    if (malId) usedMal.add(malId);
  }
  const byKey = new Map();
  for (const anime of results) {
    const key = anime.malId ? `mal-${anime.malId}` : `title-${normalizeSearchText(anime.originalTitle || anime.title)}`;
    if (!byKey.has(key)) byKey.set(key, anime);
  }
  return [...byKey.values()];
}

async function yoruSearchRaw(query) {
  const responses = await Promise.allSettled([
    fetchAniList(query, ["SEARCH_MATCH"], 1, null, "high"),
    fetchJikan(query),
    fetchShikimori(query)
  ]);
  const ani = responses[0].status === "fulfilled" ? responses[0].value : [];
  const jikan = responses[1].status === "fulfilled" ? responses[1].value : [];
  const shiki = responses[2].status === "fulfilled" ? responses[2].value : [];
  const items = mergeSearchProviderResults(ani, jikan, shiki);
  return { items, sources: responses.map((r, i) => r.status === "fulfilled" ? ["AniList", "Jikan", "Shikimori"][i] : "").filter(Boolean), failures: responses.filter(r => r.status === "rejected").length };
}

function yoruSearchRank(anime, query) {
  let score = animeMatchScore(anime, query);
  if (score) return score;
  const qWords = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  const fields = [anime.title, anime.ruTitle, anime.originalTitle, anime.alt, ...(anime.synonyms || [])].map(normalizeSearchText).filter(Boolean);
  for (const field of fields) {
    const fWords = field.split(/\s+/).filter(Boolean);
    let matched = 0, sum = 0;
    for (const q of qWords) {
      let best = 0;
      for (const w of fWords) {
        if (q === w) best = Math.max(best, 95);
        else if (q.length >= 4 && w.length >= 4) {
          const d = editDistance(q, w);
          const limit = q.length >= 9 ? 2 : 1;
          if (d <= limit) best = Math.max(best, 78 - d * 8);
        }
      }
      if (best) { matched++; sum += best; }
    }
    if (qWords.length && matched / qWords.length >= (qWords.length > 2 ? .66 : .5)) score = Math.max(score, sum / qWords.length);
  }
  return score;
}

function mergeYoruAnimeObjects(...groups) {
  const map = new Map();
  for (const anime of groups.flat()) {
    if (!anime) continue;
    const key = anime.malId ? `mal-${anime.malId}` : (Number(anime.id) > 0 ? `ani-${anime.id}` : `title-${normalizeSearchText(anime.originalTitle || anime.title)}`);
    const old = map.get(key);
    if (!old) { map.set(key, anime); continue; }
    const merged = {
      ...old,
      ...anime,
      title: (isPlausibleAnimeTitle(anime.ruTitle) && anime.ruTitle) || (isPlausibleAnimeTitle(old.ruTitle) && old.ruTitle) || anime.title || old.title,
      ruTitle: (isPlausibleAnimeTitle(anime.ruTitle) && anime.ruTitle) || old.ruTitle || "",
      originalTitle: safeAnimeTitle([old.originalTitle, anime.originalTitle, old.alt, anime.alt]),
      alt: anime.alt || old.alt || "",
      cover: anime.cover || old.cover || "",
      studios: [...new Set([...(old.studios || []), ...(anime.studios || [])])],
      staff: [...(old.staff || []), ...(anime.staff || [])],
      synonyms: [...new Set([...(old.synonyms || []), ...(anime.synonyms || [])])],
      desc: anime.desc && anime.desc !== "Описание пока недоступно." ? anime.desc : old.desc,
      countryOfOrigin: anime.countryOfOrigin || old.countryOfOrigin || ""
    };
    map.set(key, merged);
  }
  return [...map.values()];
}

// Natural-language discovery: translate common Russian descriptions into AniList genres/tags.
// AniList remains the source of titles and metadata; this is tag-based discovery, not an AI-generated guess.
const YORU_SEARCH_INTENTS = [
  { keys: ["романтик", "любов", "влюб", "отношен", "свидан"], label: "романтика", genres: ["Romance"], tags: [] },
  { keys: ["забот", "опек", "воспитан", "приемн", "приёмн", "усынов", "отвергнут", "брошенн", "сирот", "одинокая девушка", "одинокую девушку", "оставленную девушку", "девушку которую бросили", "девушкой без семьи", "забота о девушке", "воспитание девочки", "осиротевшую девушку"], label: "забота, поддержка и семейные отношения", genres: ["Drama", "Slice of Life"], tags: ["Family Life", "Female Protagonist", "Found Family", "Adoption", "Orphan"] },
  { keys: ["яой", "яои", "boys love", "boys' love", "романтика между парнями", "любовь между парнями", "парень влюбился в парня", "мальчик влюбился в мальчика"], label: "романтика между парнями", genres: ["Romance"], tags: ["Boys' Love"] },
  { keys: ["дружб", "друз", "команд", "товарищ"], label: "дружба и команда", genres: ["Adventure"], tags: ["Friendship", "Found Family"] },
  { keys: ["школ", "школьн", "учеб", "старшекласс"], label: "школьная жизнь", genres: ["Slice of Life", "Comedy"], tags: ["School", "School Life"] },
  { keys: ["приключен", "путешеств", "экспедиц", "исследован"], label: "приключения", genres: ["Adventure", "Fantasy"], tags: [] },
  { keys: ["маг", "волшеб", "заклинан", "фэнтези"], label: "магия и фэнтези", genres: ["Fantasy"], tags: ["Magic"] },
  { keys: ["детектив", "расследован", "загадк", "тайн"], label: "детектив и загадки", genres: ["Mystery"], tags: ["Detective"] },
  { keys: ["смешн", "комед", "юмор"], label: "комедия", genres: ["Comedy"], tags: [] },
  { keys: ["страш", "ужас", "пугающ", "хоррор"], label: "ужасы", genres: ["Horror", "Thriller"], tags: [] },
  { keys: ["спорт", "соревнован", "турнир"], label: "спорт и соревнования", genres: ["Sports"], tags: [] },
  { keys: ["психолог", "психологическ", "напряжен"], label: "психологическая история", genres: ["Psychological", "Drama"], tags: [] }
];
function inferYoruSearchIntent(query) {
  const q = normalizeSearchText(String(query || "").replace(/[’‘]/g, "'").replace(/[–—-]/g, " "));
  const found = YORU_SEARCH_INTENTS.filter(intent => intent.keys.some(key => q.includes(normalizeSearchText(key))));
  if (!found.length) return null;
  const genres = [...new Set(found.flatMap(x => x.genres))].slice(0, 4);
  const tags = [...new Set(found.flatMap(x => x.tags))].slice(0, 5);
  return { label: [...new Set(found.map(x => x.label))].join(" · "), genres, tags };
}

async function searchYoruSemantic(query) {
  const intent = inferYoruSearchIntent(query);
  if (!intent) return { items: [], intent: null, failures: 0 };
  try {
    const raw = await fetchAniList("", ["POPULARITY_DESC", "SCORE_DESC"], 1, null, "high", { genres: intent.genres, tags: intent.tags });
    return { items: raw.map(item => fromAniList(item)), intent, failures: 0 };
  } catch (error) {
    console.debug("YORU semantic search unavailable", error);
    return { items: [], intent, failures: 1 };
  }
}

async function searchYoruEverywhere(query) {
  const key = normalizeSearchText(query);
  const cached = yoruSearchCache.get(key);
  if (cached && Date.now() - cached.at < YORU_SEARCH_CACHE_MS) return cached.result;

  const [base, semantic] = await Promise.all([yoruSearchRaw(query), searchYoruSemantic(query)]);
  let items = mergeYoruAnimeObjects(base.items, semantic.items);
  let sources = [...base.sources, ...(semantic.items.length ? ["Поиск по жанрам и темам AniList"] : [])];
  const bestScore = () => Math.max(0, ...items.map(item => yoruSearchRank(item, query)));
  // Retry layout/transliteration variants for title searches, but do not waste API calls
  // when the query is clearly a genre/story description.
  if (!semantic.intent && bestScore() < 78) {
    for (const variant of yoruSearchVariants(query)) {
      const extra = await yoruSearchRaw(variant);
      items = mergeYoruAnimeObjects(items, extra.items);
      sources = [...new Set([...sources, ...extra.sources])];
      if (bestScore() >= 78) break;
    }
  }

  items = mergeYoruAnimeObjects(items).sort((a, b) =>
    yoruSearchRank(b, query) - yoruSearchRank(a, query) ||
    (Number(b.popularity) || 0) - (Number(a.popularity) || 0)
  );
  const result = { items, sources: [...new Set(sources)], failures: base.failures + semantic.failures, intent: semantic.intent };
  yoruSearchCache.set(key, { at: Date.now(), result });
  if (yoruSearchCache.size > 80) yoruSearchCache.delete(yoruSearchCache.keys().next().value);
  animeList = mergeAnimeLists(animeList, items);
  return result;
}

function yoruSearchResultMarkup(anime) {
  const title = [anime.ruTitle, anime.title, anime.originalTitle].find(isPlausibleAnimeTitle) || "Без названия";
  const original = [anime.originalTitle, anime.alt].find(value => value && normalizeSearchText(value) !== normalizeSearchText(title)) || "";
  const year = anime.year && anime.year !== "—" ? anime.year : "Год уточняется";
  const format = anime.format || "Аниме";
  const count = animeEpisodeCount(anime);
  const episodes = count ? `${count} эп. ${isCurrentlyAiring(anime) ? "вышло" : ""}` : (isCurrentlyAiring(anime) ? "онгоинг" : "серии уточняются");
  const flag = countryFlag(anime.countryOfOrigin);
  return `<button type="button" class="yoru-search-result" role="option" aria-label="${escapeHTML(title)}" data-anime-id="${escapeHTML(String(anime.id))}"><img loading="lazy" decoding="async" src="${escapeHTML(anime.cover || "")}" alt=""><span><strong>${escapeHTML(title)}</strong><small>${original ? `<span class="yoru-search-original">${escapeHTML(original)} · </span>` : ""}${flag} ${escapeHTML(String(year))} · ${escapeHTML(format)} · ${escapeHTML(episodes)}${anime.studios?.length ? `<br>🏢 ${escapeHTML(anime.studios.slice(0,2).join(", "))}` : ""}</small></span><span class="yoru-search-rating">${anime.score !== "—" ? `★ ${escapeHTML(anime.score)}` : "↗"}</span></button>`;
}

function setupYoruInstantSearch() {
  const input = document.getElementById("search");
  const panel = document.getElementById("yoruSearchResults");
  if (!input || !panel || input.dataset.yoruSearchReady === "1") return;
  input.dataset.yoruSearchReady = "1";
  const hide = () => { panel.hidden = true; panel.innerHTML = ""; };
  const show = (items, query, note = "") => {
    const local = animeList.filter(a => yoruSearchRank(a, query) > 0).sort((a,b) => yoruSearchRank(b,query)-yoruSearchRank(a,query)).slice(0, 5);
    const combined = [];
    const seen = new Set();
    for (const a of [...items, ...local]) {
      const key = a.malId ? `mal-${a.malId}` : `id-${a.id}`;
      if (!seen.has(key)) { seen.add(key); combined.push(a); }
    }
    const rows = combined.slice(0, 12).map(yoruSearchResultMarkup).join("");
    panel.innerHTML = (rows || '<div class="yoru-search-state">В подключённых базах пока нет точного совпадения. Попробуй альтернативное название, оригинальное написание или проверь опечатку.</div>') + (note ? `<div class="yoru-search-state">${escapeHTML(note)}</div>` : "");
    panel.hidden = false;
  };
  input.addEventListener("input", () => {
    clearTimeout(yoruSearchTimer);
    const query = input.value.trim();
    const token = ++yoruSearchSequence;
    if (query.length < 2) { hide(); if (document.body.classList.contains("library-view")) render(); return; }
    const local = animeList.filter(a => yoruSearchRank(a, query) > 0).sort((a,b) => yoruSearchRank(b,query)-yoruSearchRank(a,query)).slice(0, 8);
    panel.innerHTML = (local.map(yoruSearchResultMarkup).join("") || '<div class="yoru-search-state">Ищем в AniList, Shikimori и MyAnimeList…</div>') + '<div class="yoru-search-state" data-search-loading>Проверяем альтернативные названия…</div>';
    panel.hidden = false;
    if (document.body.classList.contains("library-view")) { visibleLimit = VISIBLE_STEP; render(); }
    yoruSearchTimer = setTimeout(async () => {
      try {
        const result = await searchYoruEverywhere(query);
        if (token !== yoruSearchSequence || input.value.trim() !== query) return;
        const sourceNote = result.intent ? `Подборка по теме: ${result.intent.label}.` : (result.sources.length ? `Источники: ${result.sources.join(" · ")}.` : "");
        const note = result.items.length ? sourceNote : (result.failures === 3 ? "Внешние базы временно не отвечают. Попробуй ещё раз чуть позже." : "Точного совпадения пока нет. Попробуй синоним, жанр или более короткую формулировку сюжета.");
        show(result.items, query, note);
      } catch (error) {
        if (token !== yoruSearchSequence) return;
        console.warn("YORU global search error", error);
        show([], query, "Поиск временно недоступен. Проверь подключение к интернету.");
      }
    }, 360);
  });
  panel.addEventListener("click", event => {
    const row = event.target.closest("[data-anime-id]");
    if (!row) return;
    const id = row.dataset.animeId;
    hide();
    input.blur();
    openYoruSearchAnime(id);
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") { hide(); return; }
    if (event.key === "Enter" && !panel.hidden) {
      const first = panel.querySelector("[data-anime-id]");
      if (first) { event.preventDefault(); first.click(); }
    }
    if (event.key === "ArrowDown" && !panel.hidden) {
      event.preventDefault();
      panel.querySelector("[data-anime-id]")?.focus();
    }
  });
  panel.addEventListener("keydown", event => {
    const rows = [...panel.querySelectorAll("[data-anime-id]")];
    const index = rows.indexOf(document.activeElement);
    if (event.key === "ArrowDown") { event.preventDefault(); rows[Math.min(rows.length - 1, index + 1)]?.focus(); }
    if (event.key === "ArrowUp") { event.preventDefault(); if (index <= 0) input.focus(); else rows[index - 1]?.focus(); }
  });
  document.addEventListener("click", event => { if (!event.target.closest(".yoru-search-wrap")) hide(); });
}
