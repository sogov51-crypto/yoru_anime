// Russian titles are official/localized titles only (not machine-translated guesses).
const RU_TITLE_CACHE_KEY = "yoruOfficialRuTitlesV3";
const RU_DESCRIPTION_CACHE_KEY = "yoruRuDescriptionsV3";
let officialRuTitleCache = {};
let descriptionTranslationCache = {};
const descriptionTranslationInFlight = new Map();
try { officialRuTitleCache = JSON.parse(localStorage.getItem(RU_TITLE_CACHE_KEY) || "{}"); } catch (e) { officialRuTitleCache = {}; }
try { descriptionTranslationCache = JSON.parse(localStorage.getItem(RU_DESCRIPTION_CACHE_KEY) || "{}"); } catch (e) { descriptionTranslationCache = {}; }

function saveSmallCache(storageKey, cache, limit = 350) {
  const entries = Object.entries(cache).slice(-limit);
  const compact = Object.fromEntries(entries);
  try { localStorage.setItem(storageKey, JSON.stringify(compact)); } catch (e) { /* Storage may be disabled/full. */ }
  return compact;
}

function pickRussianTitleFromFull(item) {
  const value = (item?.titles || []).find(t => /russian/i.test(t.type || ""))?.title?.trim() || "";
  return isPlausibleAnimeTitle(value) ? value : "";
}

function updateLocalizedTitleInPage(a) {
  const shownTitle = a.ruTitle || a.title || a.originalTitle || "Без названия";
  document.querySelectorAll(`[data-title-id="${String(a.id)}"]`).forEach(el => {
    el.textContent = shownTitle;
    el.title = shownTitle;
  });
  document.querySelectorAll(`[data-title-image-id="${String(a.id)}"]`).forEach(el => { el.alt = shownTitle; });
  document.querySelectorAll(`[data-title-alt-id="${String(a.id)}"]`).forEach(el => {
    el.textContent = a.originalTitle && a.originalTitle !== shownTitle ? a.originalTitle : (a.alt || "");
  });
  if (activeAnime === a.id) {
    const heading = document.querySelector("#modalContent h2");
    if (heading) heading.textContent = shownTitle;
  }
}

function localizeVisibleTitles(list) {
  for (const a of list) {
    if (!a || a.ruTitle || !a.malId) continue;
    const cacheKey = String(a.malId);
    if (Object.prototype.hasOwnProperty.call(officialRuTitleCache, cacheKey)) {
      const cached = officialRuTitleCache[cacheKey];
      if (cached && cached !== "__NO_RUSSIAN_TITLE__") {
        a.ruTitle = cached;
        a.title = cached;
        updateLocalizedTitleInPage(a);
      }
      continue;
    }
    if (a._ruTitleQueued || (a._ruTitleRetryAfter && Date.now() < a._ruTitleRetryAfter)) continue;
    a._ruTitleQueued = true;
    requestJikanFull(a.malId).then(item => {
      a._ruTitleQueued = false;
      if (!item) {
        a._ruTitleRetryAfter = Date.now() + 60000;
        return;
      }
      const localized = pickRussianTitleFromFull(item);
      officialRuTitleCache[cacheKey] = localized || "__NO_RUSSIAN_TITLE__";
      officialRuTitleCache = saveSmallCache(RU_TITLE_CACHE_KEY, officialRuTitleCache, 1600);
      if (localized) {
        a.ruTitle = localized;
        a.title = localized;
        a._searchFields = null;
        updateLocalizedTitleInPage(a);
      }
      // Keep full metadata so opening the card need not fetch the same anime again.
      if (item.synopsis && (!a.desc || a.desc === "Описание пока недоступно.")) a.desc = cleanDescription(item.synopsis);
    });
  }
}

function hasRussianDescription(text) {
  const value = String(text || "");
  const letters = (value.match(/[A-Za-zА-Яа-яЁё]/g) || []).length;
  const cyrillic = (value.match(/[А-Яа-яЁё]/g) || []).length;
  return letters > 0 && cyrillic / letters > 0.68;
}

function descriptionHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

function decodeTranslationEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

async function translateWithGoogle(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ru&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined });
  if (!response.ok) throw new Error("Google Translate is unavailable");
  const data = await response.json();
  const translated = Array.isArray(data?.[0]) ? data[0].map(part => part?.[0] || "").join("").trim() : "";
  if (!translated || translated === text || !hasRussianDescription(translated)) throw new Error("Translation was not returned");
  return translated;
}

async function translateWithMyMemory(text) {
  // MyMemory's public endpoint has a short per-query limit, so split into short chunks.
  const chunks = [];
  for (let i = 0; i < text.length; i += 430) chunks.push(text.slice(i, i + 430));
  const result = [];
  for (const chunk of chunks) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|ru`;
    const response = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined });
    if (!response.ok) throw new Error("Fallback translation is unavailable");
    const data = await response.json();
    const part = decodeTranslationEntities(data?.responseData?.translatedText || "");
    if (!part || /MYMEMORY WARNING|PLEASE SELECT/i.test(part)) throw new Error("Fallback translation failed");
    result.push(part);
    if (chunks.length > 1) await new Promise(resolve => setTimeout(resolve, 180));
  }
  const translated = result.join("").trim();
  if (!translated || !hasRussianDescription(translated)) throw new Error("Fallback did not return Russian text");
  return translated;
}

async function translateDescriptionToRussian(source, cacheKey) {
  const text = cleanDescription(source);
  if (!text || text === "Описание пока недоступно.") return "";
  if (hasRussianDescription(text)) return text;
  const key = `${cacheKey || "anime"}:${descriptionHash(text)}`;
  if (descriptionTranslationCache[key]) return descriptionTranslationCache[key];
  if (descriptionTranslationInFlight.has(key)) return descriptionTranslationInFlight.get(key);

  const task = (async () => {
    let translated = "";
    try {
      translated = await translateWithGoogle(text.slice(0, 4500));
    } catch (googleError) {
      try { translated = await translateWithMyMemory(text.slice(0, 3500)); }
      catch (fallbackError) { translated = ""; }
    }
    if (!translated) return "";
    descriptionTranslationCache[key] = translated;
    descriptionTranslationCache = saveSmallCache(RU_DESCRIPTION_CACHE_KEY, descriptionTranslationCache, 320);
    return translated;
  })();
  descriptionTranslationInFlight.set(key, task);
  try { return await task; }
  finally { descriptionTranslationInFlight.delete(key); }
}

function descriptionTextForModal(a) {
  if (a.descRu) return a.descRu;
  const source = cleanDescription(a.desc || "");
  if (source && hasRussianDescription(source)) return source;
  // Show a previously translated description synchronously from localStorage-backed cache.
  if (source && descriptionTranslationCache) {
    const key = `mal-${a.malId || a.id}:${descriptionHash(source)}`;
    const cached = descriptionTranslationCache[key];
    if (cached) return cached;
  }
  // Never leave an empty-looking modal while Jikan/translation requests are running.
  if (source && source !== "Описание пока недоступно.") return source;
  if (a.descTranslationError) return "Для этого аниме нет доступного описания на русском. Можно повторить перевод позже.";
  if (a.descLoading) return "Описание загружается…";
  return "Описание пока недоступно.";
}

async function loadAnimeDetails(a, retry = false) {
  if (!a || a.descLoading) return;
  if (a.descRu && !retry) return;
  a.descLoading = true;
  a.descTranslationError = false;
  // Update only the description node; rebuilding the whole modal while the user taps
  // episode buttons can replace the touched element and make mobile taps feel unreliable.
  if (activeAnime === a.id) refreshModalDescription(a);

  try {
    let item = a.malId ? await requestJikanFull(a.malId, true) : null;
    if (item) {
      const officialRussian = pickRussianTitleFromFull(item);
      if (officialRussian) {
        a.ruTitle = officialRussian;
        a.title = officialRussian;
        officialRuTitleCache[String(a.malId)] = officialRussian;
        officialRuTitleCache = saveSmallCache(RU_TITLE_CACHE_KEY, officialRuTitleCache, 1600);
        updateLocalizedTitleInPage(a);
      } else if (!Object.prototype.hasOwnProperty.call(officialRuTitleCache, String(a.malId))) {
        officialRuTitleCache[String(a.malId)] = "__NO_RUSSIAN_TITLE__";
        officialRuTitleCache = saveSmallCache(RU_TITLE_CACHE_KEY, officialRuTitleCache, 1600);
      }
      if (item.synopsis) a.desc = cleanDescription(item.synopsis);
      if (Array.isArray(item.studios) && item.studios.length) a.studios = item.studios.map(x => x.name).filter(Boolean);
      if (item.episodes && (!a.episodes || a.episodes < item.episodes)) a.episodes = Number(item.episodes) || a.episodes;
      if (item.year && !a.year) a.year = item.year;
      a._jikanDetailsLoaded = true;
      const meta = document.getElementById("yoruAnimeMeta");
      if (meta && activeAnime === a.id) meta.innerHTML = renderAnimeMeta(a);
      // MyAnimeList/Jikan staff data includes original creators and directors for many entries.
      requestJikanStaff(a.malId).then(rows => {
        if (!Array.isArray(rows) || !rows.length) return;
        a.staff = [...(a.staff || [])];
        for (const row of rows) {
          const name = row.person?.name || "";
          const roles = Array.isArray(row.positions) ? row.positions : [];
          for (const role of roles) {
            if (!name) continue;
            if (!a.staff.some(person => person.name === name && person.role === role)) a.staff.push({ name, role });
          }
        }
        const currentMeta = document.getElementById("yoruAnimeMeta");
        if (currentMeta && activeAnime === a.id) currentMeta.innerHTML = renderAnimeMeta(a);
      }).catch(error => console.debug("Jikan staff unavailable", error));
    }

    // Avoid replacing a valid AniList description with a blank/placeholder synopsis.
    const source = cleanDescription(a.desc);
    if (!source || source === "Описание пока недоступно.") {
      a.descRu = "Для этого аниме пока нет описания в подключённых каталогах.";
    } else {
      const translated = await translateDescriptionToRussian(source, `mal-${a.malId || a.id}`);
      if (!translated) throw new Error("Translation failed");
      a.descRu = translated;
      a.descTranslationError = false;
    }
  } catch (error) {
    a.descTranslationError = true;
  } finally {
    a.descLoading = false;
    if (activeAnime === a.id) refreshModalDescription(a);
  }
}

function refreshModalDescription(a) {
  const paragraph = document.getElementById("animeDescription");
  if (!paragraph || !a || activeAnime !== a.id) return;
  paragraph.textContent = descriptionTextForModal(a);
  paragraph.classList.toggle("description-updating", !!a.descLoading);
  let retry = document.getElementById("retryDescriptionButton");
  if (a.descTranslationError && !retry) {
    retry = document.createElement("button");
    retry.id = "retryDescriptionButton";
    retry.type = "button";
    retry.className = "period-button";
    retry.textContent = "↻ Повторить перевод описания";
    retry.addEventListener("click", () => retryDescriptionTranslation(a.id));
    paragraph.insertAdjacentElement("afterend", retry);
  } else if (!a.descTranslationError && retry) {
    retry.remove();
  }
}

function retryDescriptionTranslation(id) {
  const a = animeList.find(x => x.id === id);
  if (!a) return;
  a.descRu = "";
  a.descTranslationError = false;
  loadAnimeDetails(a, true);
}
