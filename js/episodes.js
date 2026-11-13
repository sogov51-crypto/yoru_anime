function isOnePiece(a) {
  // Проверяем основные названия, но не синонимы: иначе фильм с "One Piece" в названии
  // мог бы ошибочно получить список из 1 180 эпизодов.
  const names = [a.title, a.originalTitle, a.ruTitle, a.alt].map(normalizeSearchText);
  const hasSeriesName = names.some(name => name === "one piece" || name === "ван пис" || name === "ван писе" || name === "one piece tv" || name === "one piece (1999)");
  const isMovieOrSpecial = names.some(name => /\b(film|movie|special|stampede|strong world|episode of|gold|red|z)\b/.test(name));
  return hasSeriesName && !isMovieOrSpecial;
}

function isCurrentlyAiring(a) { return a.airingStatus === "RELEASING"; }

// Для One Piece фиксируем полный список из 1 180 серий (актуальность: октябрь 2026).
function animeEpisodeCount(a) {
  if (isOnePiece(a)) return 1180;
  const nextEpisode = Math.max(0, Number(a?.nextEpisode) || 0);
  if (isCurrentlyAiring(a) && nextEpisode > 1) return nextEpisode - 1;
  const names = [a?.title, a?.originalTitle, a?.alt, ...(a?.synonyms || [])].filter(Boolean).join(" ").toLowerCase();
  const isBlackCloverSeason2 = Number(a?.id) === 195604 || (/black\s*clover|черн(ый|ого)\s+клевер/.test(names) && /2nd\s*season|season\s*2|2\s*сезон|2й\s+сезон/.test(names));
  if (isBlackCloverSeason2 && Number(a?.seasonYear || a?.year) === 2026) {
    // Official schedule: premiere 3 Oct 2026, then weekly; episode 5 aired 31 Oct 2026.
    const premiere = Date.UTC(2026, 9, 3, 14, 0, 0);
    const aired = Math.floor((Date.now() - premiere) / (7 * 86400000)) + 1;
    return Math.max(0, Math.min(26, aired));
  }
  return Math.max(0, Number(a?.episodes) || 0);
}

function episodeBadge(a) {
  const count = animeEpisodeCount(a);
  if (!count) return isCurrentlyAiring(a) ? "выходит" : "сер. ?";
  if (isOnePiece(a)) return "1180 сер.";
  return `${count}${isCurrentlyAiring(a) ? "+" : ""} сер.`;
}

function episodeSummary(a) {
  const count = animeEpisodeCount(a);
  if (isOnePiece(a)) return "1180 серий в списке. Филлеры и смешанные эпизоды отмечены цветом. Список проверен в октябре 2026 года.";
  if (isCurrentlyAiring(a)) return count ? `Сериал выходит. Уже вышло примерно ${count} серий${a.episodeCountEstimated ? " (по номеру следующего эпизода)" : ""}; общее количество может измениться.` : "Сериал выходит, количество серий пока неизвестно.";
  return count ? `${count} серий` : "Количество серий неизвестно";
}

const EPISODES_PER_PAGE = 100;
let episodePage = 0;

// Филлеры, смешанные эпизоды и аниме-оригинальные серии One Piece.
const ONE_PIECE_FILLER_RANGES = [[54,60],[98,99],[102,102],[131,143],[196,206],[220,225],[279,283],[291,292],[303,303],[317,319],[326,336],[382,384],[406,407],[426,429],[457,458],[492,492],[542,542],[575,578],[590,590],[626,627],[747,750],[780,782],[895,896],[907,907],[1029,1030]];
const ONE_PIECE_MIXED_RANGES = [[45,47],[61,61],[68,69],[101,101],[226,226],[354,354],[421,421],[489,489],[520,520],[574,574],[625,625],[628,628],[633,633],[653,653],[657,657],[679,679],[690,690],[731,731],[738,738],[751,751],[777,778],[789,789],[803,803],[807,807],[878,879],[881,885],[887,890],[924,924],[988,989],[991,991]];
const ONE_PIECE_ANIME_CANON_RANGES = [[50,51],[93,93],[213,216],[418,420],[453,456],[497,499],[506,506],[737,737],[775,775],[1084,1084]];
function inEpisodeRanges(number, ranges) { return ranges.some(([from, to]) => number >= from && number <= to); }
function onePieceEpisodeType(number) {
  if (inEpisodeRanges(number, ONE_PIECE_FILLER_RANGES)) return "filler";
  if (inEpisodeRanges(number, ONE_PIECE_MIXED_RANGES)) return "mixed";
  if (inEpisodeRanges(number, ONE_PIECE_ANIME_CANON_RANGES)) return "anime-canon";
  return "canon";
}

function renderEpisodeButtons(a) {
  const total = animeEpisodeCount(a);
  if (!total) return `<p class="episode-note">Количество серий пока неизвестно. Проверь страницу аниме на Yami Anime.</p>`;
  const onePiece = isOnePiece(a);
  const pages = Math.ceil(total / EPISODES_PER_PAGE);
  episodePage = Math.min(episodePage, Math.max(0, pages - 1));
  const start = episodePage * EPISODES_PER_PAGE + 1;
  const end = Math.min(total, start + EPISODES_PER_PAGE - 1);
  const buttons = Array.from({ length: end - start + 1 }, (_, i) => {
    const n = start + i;
    const isSelected = Number(selectedEpisodes[a.id]) === n;
    const type = onePiece ? onePieceEpisodeType(n) : "";
    const typeLabel = type === "filler" ? "Филлер" : type === "mixed" ? "Смешанная" : type === "anime-canon" ? "Аниме-канон" : "";
    const label = typeLabel ? `<small class="ep-type-label">${typeLabel}</small>` : "";
    const readableType = typeLabel ? ` · ${typeLabel}` : "";
    return `<button class="episode-button available ${type ? `episode-${type}` : ""} ${isSelected ? "selected-episode" : ""}" aria-pressed="${isSelected}" title="Серия ${n}${readableType}. Открыть на Yami Anime" onclick="playEpisode(${a.id}, ${n})"><span class="ep-number">${n}</span>${label}</button>`;
  }).join("");
  const legend = onePiece ? `<div class="episode-legend"><span class="legend-chip legend-filler">Филлер</span><span class="legend-chip legend-mixed">Смешанная серия</span><span class="legend-chip legend-anime">Аниме-канон</span><span class="legend-chip legend-canon">По манге / основной сюжет</span></div><p class="episode-note">Пометки основаны на фанатских гайдах по эпизодам и могут отличаться в отдельных списках. У смешанных серий есть материал из манги — не все из них стоит пропускать.</p>` : `<p class="episode-note">Выбери номер серии. Для этого тайтла источник не предоставляет отдельную разметку филлеров.</p>`;
  return `${legend}<div class="episode-page-info">Серии ${start}–${end} из ${total}${onePiece ? " · One Piece" : isCurrentlyAiring(a) ? "+" : ""}</div><div class="episode-grid">${buttons}</div>${pages > 1 ? `<div class="episode-pagination"><button class="episode-button" ${episodePage === 0 ? "disabled" : ""} onclick="showEpisodePage(${a.id}, ${episodePage - 1})">← Назад</button><span>Страница ${episodePage + 1} из ${pages}</span><button class="episode-button" ${episodePage >= pages - 1 ? "disabled" : ""} onclick="showEpisodePage(${a.id}, ${episodePage + 1})">Далее →</button></div>` : ""}`;
}

// Deep links на страницы просмотра Yami Anime.
// Проверенный шаблон страницы тайтла: https://yamianime.com/anime/<slug>/watch
// Параметр ?episode=N передаёт номер выбранной серии; Yami Anime может не поддерживать его во всех случаях.
const SELECTED_EPISODE_KEY = "yoruSelectedEpisodesV1";
let selectedEpisodes = {};
let yamiPlayerWindow = null;
try {
  const savedEpisodes = JSON.parse(localStorage.getItem(SELECTED_EPISODE_KEY) || "{}");
  if (savedEpisodes && typeof savedEpisodes === "object" && !Array.isArray(savedEpisodes)) selectedEpisodes = savedEpisodes;
} catch (error) { selectedEpisodes = {}; }

function saveSelectedEpisodes() {
  try { localStorage.setItem(SELECTED_EPISODE_KEY, JSON.stringify(selectedEpisodes)); } catch (error) { /* Storage may be disabled. */ }
}

function makeYamiSlug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getYamiAnimeSlug(a) {
  // Prefer Romaji/alternative title before English: some Yami Anime slugs use the Japanese/Romaji title.
  const candidates = [a?.yamiSlug, a?.alt, a?.originalTitle, ...(Array.isArray(a?.synonyms) ? a.synonyms : []), a?.title];
  for (const candidate of candidates) {
    const slug = makeYamiSlug(candidate);
    if (slug.length >= 2 && /[a-z]/.test(slug)) return slug;
  }
  return "";
}

function buildYamiWatchUrl(a, episodeNumber) {
  const slug = getYamiAnimeSlug(a);
  const episode = Math.max(1, Math.floor(Number(episodeNumber) || 1));
  if (!slug) {
    // Honest fallback: open catalogue search instead of inventing an anime URL.
    return "https://yamianime.com/";
  }
  const url = new URL(`https://yamianime.com/anime/${slug}/watch`);
  url.searchParams.set("episode", String(episode));
  return url.toString();
}

function openYamiInSingleTab(url) {
  try {
    if (yamiPlayerWindow && !yamiPlayerWindow.closed) {
      yamiPlayerWindow.location.href = url;
      yamiPlayerWindow.focus();
      return true;
    }
    // A named window lets later episode changes reuse the same tab. Detach opener for safety.
    const opened = window.open(url, "YORU_YAMI_PLAYER");
    if (!opened) return false;
    try { opened.opener = null; } catch (error) { /* Browser may disallow changing opener. */ }
    yamiPlayerWindow = opened;
    try { opened.focus(); } catch (error) { /* Focus is optional. */ }
    return true;
  } catch (error) {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    return !!opened;
  }
}

function playEpisode(id, episodeNumber) {
  const a = animeList.find(item => item.id === id);
  if (!a) return;
  const episode = Math.max(1, Math.floor(Number(episodeNumber) || 1));
  selectedEpisodes[id] = episode;
  saveSelectedEpisodes();

  // Update the selected series in-place so the touched button does not disappear,
  // the episode list stays under the finger, and mobile users can tap consecutive episodes.
  if (activeAnime === id) {
    document.querySelectorAll(".episode-button.selected-episode").forEach(button => {
      button.classList.remove("selected-episode");
      button.setAttribute("aria-pressed", "false");
    });
    const chosen = [...document.querySelectorAll(".episode-button")].find(button =>
      button.getAttribute("onclick") === `playEpisode(${id}, ${episode})`
    );
    if (chosen) {
      chosen.classList.add("selected-episode");
      chosen.setAttribute("aria-pressed", "true");
    }
    const hint = document.getElementById("yamiPlayerHint");
    if (hint) hint.textContent = `Выбрана серия ${episode}. Откроется страница выбранного тайтла на Yami Anime в отдельной вкладке.`;
  }

  const url = buildYamiWatchUrl(a, episode);
  const opened = openYamiInSingleTab(url);
  if (opened) {
    toast(`Открываем «${a.ruTitle || a.title}», серия ${episode}, на Yami Anime`);
  } else {
    toast("Браузер заблокировал новую вкладку. Разреши всплывающие окна для YORU и повтори.");
  }
}

function openWatch(id) {
  const a = animeList.find(item => item.id === id);
  if (!a) return;
  const knownTotal = animeEpisodeCount(a);
  let episode = Number(selectedEpisodes[id]) || (Number(a.progress) > 0 ? Number(a.progress) + 1 : 1);
  episode = Math.max(1, Math.floor(episode));
  if (knownTotal > 0) episode = Math.min(episode, knownTotal);
  playEpisode(id, episode);
}
