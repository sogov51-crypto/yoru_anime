// ── YORU Editorial Hero: curated anime scenes rotate every 10 minutes ──
const YORU_HERO_EDITORIALS = [
  { keys: ["one piece", "ван пис", "ван-пис"], thought: "Однажды, спустя сотни лет истории появиться тот.... кто бросит вызов всему миру! One Piece существует!" },
  { keys: ["jujutsu kaisen", "магическая битва"], thought: "Даже среди проклятий важно помнить, ради чего ты продолжаешь сражаться." },
  { keys: ["naruto", "наруто"], thought: "Связи, которые мы выбираем, иногда делают нас сильнее любых техник." },
  { keys: ["frieren", "фрирен"], thought: "Некоторые мгновения становятся драгоценными только тогда, когда смотришь на них издалека." },
  { keys: ["attack on titan", "атака титанов"], thought: "За каждой стеной скрывается мир, который стоит понять, прежде чем судить." },
  { keys: ["demon slayer", "клинок, рассекающий демонов"], thought: "Мягкое сердце не делает человека слабым — оно помогает ему не потерять себя." },
  { keys: ["fullmetal alchemist", "стальной алхимик"], thought: "Цена выбора раскрывается не в обещаниях, а в поступках." },
  { keys: ["hunter x hunter", "охотник x охотник", "охотник × охотник"], thought: "Путь меняет тебя сильнее, чем финальная точка, к которой ты стремился." },
  { keys: ["spy x family", "семья шпиона"], thought: "Иногда домом становятся люди, которых ты совсем не ожидал встретить." },
  { keys: ["chainsaw man", "человек-бензопила"], thought: "Большая мечта иногда начинается с самого простого человеческого желания." },
  { keys: ["my hero academia", "моя геройская академия"], thought: "Героизм начинается с шага навстречу, даже когда тебе самому страшно." },
  { keys: ["vinland saga", "сага о винланде"], thought: "Настоящая сила — самому решить, кем ты станешь после тяжёлого пути." },
  { keys: ["death note", "тетрадь смерти"], thought: "Самое сложное испытание — не власть, а способность оставаться честным с собой." },
  { keys: ["bleach", "блич"], thought: "Иногда защищать кого-то — значит найти в себе силу, о которой ты не знал." }
];
const YORU_HERO_FALLBACK_THOUGHTS = [
  "Даже короткое приключение может оставить след на всю жизнь.",
  "Каждая история по-своему напоминает, что выбор всегда остаётся за тобой.",
  "Иногда один встреченный человек меняет направление целого пути.",
  "Самые важные победы начинаются задолго до того, как их замечают другие."
];
let yoruHeroSlides = [];
let yoruHeroIndex = 0;
let yoruHeroActiveLayer = "A";
let yoruHeroSourceSignature = "";
let yoruHeroLastTitleId = null;
let yoruHeroTimerStarted = false;

function yoruHeroText(anime) {
  const searchable = [anime?.title, anime?.ruTitle, anime?.originalTitle, anime?.alt, ...(anime?.synonyms || [])]
    .filter(Boolean).map(normalizeSearchText).join(" | ");
  const match = YORU_HERO_EDITORIALS.find(item => item.keys.some(key => searchable.includes(normalizeSearchText(key))));
  if (match) return match.thought;
  const stable = Math.abs(Number(anime?.id) || searchable.length) % YORU_HERO_FALLBACK_THOUGHTS.length;
  return YORU_HERO_FALLBACK_THOUGHTS[stable];
}

function buildYoruHeroSlides() {
  // В панорамном баннере используем ТОЛЬКО настоящие широкие изображения AniList.
  // Вертикальные постеры больше не растягиваем на весь баннер — именно это портило качество.
  const all = Array.isArray(animeList)
    ? animeList.filter(a => a && typeof a.banner === "string" && /^https?:\/\//i.test(a.banner))
    : [];
  if (!all.length) return [];
  const normalize = value => normalizeSearchText(value || "");
  const chosen = [];
  const used = new Set();
  const makeSlide = (anime, thought) => ({
    id: anime.id,
    title: anime.ruTitle || anime.title || anime.originalTitle || "Аниме",
    originalTitle: anime.originalTitle || anime.title || "",
    image: anime.banner,
    cover: anime.cover || "",
    thought: thought || yoruHeroText(anime),
    anime
  });
  // Сначала — редакционные истории с подходящими авторскими фразами.
  for (const editorial of YORU_HERO_EDITORIALS) {
    const found = all.find(a => {
      if (used.has(String(a.id))) return false;
      const haystack = [a.title, a.ruTitle, a.originalTitle, a.alt, ...(a.synonyms || [])]
        .filter(Boolean).map(normalize).join(" | ");
      return editorial.keys.some(key => haystack.includes(normalize(key)));
    });
    if (found) { chosen.push(makeSlide(found, editorial.thought)); used.add(String(found.id)); }
  }
  // Остальные панорамные баннеры сортируем по популярности, без постеров низкого качества.
  all.slice().sort((a,b) => (Number(b.popularity)||0) - (Number(a.popularity)||0)).forEach(anime => {
    if (chosen.length < 12 && !used.has(String(anime.id))) {
      chosen.push(makeSlide(anime)); used.add(String(anime.id));
    }
  });
  return chosen.slice(0, 12);
}

const yoruHeroPreloads = new Map();
function preloadYoruHeroImage(url, priority = "low") {
  if (!url || yoruHeroPreloads.has(url)) return;
  const image = new Image();
  image.decoding = "async";
  try { image.fetchPriority = priority; } catch (_) {}
  image.onload = () => yoruHeroPreloads.set(url, image);
  image.onerror = () => yoruHeroPreloads.set(url, null);
  image.src = url;
  yoruHeroPreloads.set(url, image);
}

function syncYoruHeroSlides() {
  const nextSlides = buildYoruHeroSlides();
  if (!nextSlides.length) return;
  const signature = nextSlides.map(slide => `${slide.id}:${slide.image}`).join("|");
  if (signature === yoruHeroSourceSignature) return;
  const currentlyShowingId = yoruHeroSlides[yoruHeroIndex]?.id ?? yoruHeroLastTitleId;
  yoruHeroSlides = nextSlides;
  // Warm the active and next banner early; do not wait for the larger catalogue to arrive.
  yoruHeroSlides.slice(0, 2).forEach((slide, index) => preloadYoruHeroImage(slide.image, index === 0 ? "high" : "low"));
  yoruHeroSourceSignature = signature;
  const preserveIndex = yoruHeroSlides.findIndex(slide => String(slide.id) === String(currentlyShowingId));
  yoruHeroIndex = preserveIndex >= 0 ? preserveIndex : 0;
  drawYoruHeroDots();
  showYoruHeroSlide(yoruHeroIndex, true);
  if (!yoruHeroTimerStarted) {
    yoruHeroTimerStarted = true;
    window.setInterval(() => {
      if (!document.hidden && yoruHeroSlides.length > 1) stepHeroSlide(1, true);
    }, 10 * 60 * 1000);
  }
}

let yoruHeroPoolRequested = false;
async function ensureYoruHeroBannerPool() {
  if (yoruHeroPoolRequested || yoruHeroSlides.length >= 6) return;
  yoruHeroPoolRequested = true;
  try {
    const query = `query { Page(page:1,perPage:50) { media(type:ANIME,isAdult:false,sort:[POPULARITY_DESC]) { id idMal title{romaji english native} synonyms coverImage{extraLarge large medium} bannerImage episodes status popularity averageScore seasonYear countryOfOrigin format studios{nodes{name}} startDate{year month day} } } }`;
    const result = await enqueueAniListRequest(async () => {
      const response = await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query})});
      if (!response.ok) throw new Error('AniList '+response.status);
      return response.json();
    }, 'normal');
    const items = result?.data?.Page?.media || [];
    if (items.length) {
      animeList = mergeAnimeLists(animeList, items.map(fromAniList));
      syncYoruHeroSlides();
    }
  } catch (error) { console.warn('YORU hero banner pool:', error); }
}

function drawYoruHeroDots() {
  const root = document.getElementById("heroDots");
  if (!root) return;
  root.innerHTML = yoruHeroSlides.map((slide,index) => `<button type="button" class="hero-dot ${index === yoruHeroIndex ? "active" : ""}" aria-label="История ${index+1}: ${escapeHTML(slide.title)}" aria-pressed="${index===yoruHeroIndex}" onclick="showYoruHeroSlide(${index})"></button>`).join("");
}

function showYoruHeroSlide(index, immediate = false) {
  if (!yoruHeroSlides.length) return;
  yoruHeroIndex = ((Number(index) % yoruHeroSlides.length) + yoruHeroSlides.length) % yoruHeroSlides.length;
  const slide = yoruHeroSlides[yoruHeroIndex];
  const layerA = document.getElementById("heroArtA");
  const layerB = document.getElementById("heroArtB");
  const nextLayer = yoruHeroActiveLayer === "A" ? layerB : layerA;
  const currentLayer = yoruHeroActiveLayer === "A" ? layerA : layerB;
  if (nextLayer) {
    const safeImage = String(slide.image || "").replace(/["\\]/g, "\\$&");
    nextLayer.style.setProperty("--hero-image", `url("${safeImage}")`);
    nextLayer.classList.add("is-changing");
    // Two animation frames let the browser stage the new background before the fade.
    if (immediate) {
      nextLayer.classList.add("is-active");
      if (currentLayer) currentLayer.classList.remove("is-active");
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        nextLayer.classList.add("is-active");
        if (currentLayer) currentLayer.classList.remove("is-active");
      }));
    }
    window.setTimeout(() => nextLayer.classList.remove("is-changing"), 1000);
    yoruHeroActiveLayer = yoruHeroActiveLayer === "A" ? "B" : "A";
  }
  yoruHeroLastTitleId = slide.id;
  const title = document.getElementById("heroAnimeTitle");
  const quote = document.getElementById("heroQuote");
  const feature = document.getElementById("heroFeatureLabel");
  const counter = document.getElementById("heroSlideCount");
  const open = document.getElementById("heroOpenButton");
  const sourceTitle = document.getElementById("heroSourceTitle");
  const sourceOriginal = document.getElementById("heroSourceOriginal");
  const sourceCover = document.getElementById("heroSourceCover");
  const sourceAnime = slide.anime || {};
  if (sourceTitle) sourceTitle.textContent = slide.title || sourceAnime.title || "Аниме";
  if (sourceOriginal) {
    const originalName = sourceAnime.originalTitle || slide.originalTitle || "";
    const localizedName = slide.title || sourceAnime.title || "";
    sourceOriginal.textContent = originalName && normalizeSearchText(originalName) !== normalizeSearchText(localizedName)
      ? originalName : "Изображение и сведения: AniList";
  }
  if (sourceCover) {
    const coverUrl = sourceAnime.cover || slide.cover || "";
    sourceCover.hidden = !coverUrl;
    if (coverUrl && sourceCover.src !== coverUrl) sourceCover.src = coverUrl;
    sourceCover.alt = `Обложка аниме ${slide.title || ""}`;
  }
  if (title) {
    title.style.animation = "none"; void title.offsetWidth; title.style.animation = "";
    title.textContent = slide.title;
  }
  if (quote) {
    quote.style.animation = "none"; void quote.offsetWidth; quote.style.animation = "";
    quote.textContent = slide.thought;
  }
  if (feature) feature.textContent = slide.originalTitle && slide.originalTitle !== slide.title ? slide.originalTitle : "ВЫБОР 夜 YORU.";
  if (counter) counter.textContent = `${String(yoruHeroIndex+1).padStart(2,"0")} / ${String(yoruHeroSlides.length).padStart(2,"0")}`;
  if (open) open.textContent = "Открыть историю ↗";
  drawYoruHeroDots();
}

function stepHeroSlide(direction, fromTimer = false) {
  if (!yoruHeroSlides.length) { syncYoruHeroSlides(); return; }
  showYoruHeroSlide(yoruHeroIndex + direction);
}

function openHeroAnime() {
  const current = yoruHeroSlides[yoruHeroIndex];
  if (current && typeof openModal === "function") {
    openModal(current.id);
  } else {
    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
