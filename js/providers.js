const API_URL = "https://graphql.anilist.co";
const JIKAN_URL = "https://api.jikan.moe/v4";

// AniList currently documents a reduced limit of 30 requests/minute; pace all requests conservatively.
const ANILIST_MIN_INTERVAL_MS = 2200;
let aniListLastRequestAt = 0;
let aniListQueueRunning = false;
let aniListQueueOrder = 0;
const aniListRequestQueue = [];

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, Math.max(0, ms))); }

function enqueueAniListRequest(task, priority = "normal") {
  return new Promise((resolve, reject) => {
    aniListRequestQueue.push({ task, priority: priority === "background" ? 0 : 10, order: ++aniListQueueOrder, resolve, reject });
    aniListRequestQueue.sort((a, b) => b.priority - a.priority || a.order - b.order);
    drainAniListQueue();
  });
}

async function drainAniListQueue() {
  if (aniListQueueRunning) return;
  aniListQueueRunning = true;
  try {
    while (aniListRequestQueue.length) {
      aniListRequestQueue.sort((a, b) => b.priority - a.priority || a.order - b.order);
      const job = aniListRequestQueue.shift();
      const waitFor = ANILIST_MIN_INTERVAL_MS - (Date.now() - aniListLastRequestAt);
      if (aniListLastRequestAt && waitFor > 0) await sleep(waitFor);
      aniListLastRequestAt = Date.now();
      try { job.resolve(await job.task()); }
      catch (error) { job.reject(error); }
    }
  } finally {
    aniListQueueRunning = false;
    if (aniListRequestQueue.length) drainAniListQueue();
  }
}

const jikanFullCache = new Map();
const jikanJobs = new Map();
const jikanQueue = [];
let jikanQueueRunning = false;
let jikanLastRequestAt = 0;

async function fetchAniList(search = "", sort = ["POPULARITY_DESC"], page = 1, seasonYear = null, priority = "normal", filters = null) {
  const query = `
    query ($search: String, $page: Int, $sort: [MediaSort], $seasonYear: Int, $genres: [String], $tags: [String]) {
      Page(page: $page, perPage: 50) {
        pageInfo { currentPage hasNextPage }
        media(search: $search, seasonYear: $seasonYear, genre_in: $genres, tag_in: $tags, minimumTagRank: 18, type: ANIME, isAdult: false, sort: $sort) {
          id
          idMal
          title { romaji english native userPreferred }
          staff(sort: RELEVANCE, perPage: 10) { edges { role node { name { full native } } } }
          synonyms
          coverImage { extraLarge large medium }
          bannerImage
          episodes
          status
          nextAiringEpisode { episode airingAt }
          popularity
          averageScore
          genres
          description(asHtml: false)
          seasonYear
          season
          countryOfOrigin
          format
          studios { nodes { name } }
          startDate { year month day }
        }
      }
    }
  `;
  return enqueueAniListRequest(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    let response, result;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query, variables: {
          search: search || null, page, sort, seasonYear,
          genres: filters?.genres?.length ? filters.genres : null,
          tags: filters?.tags?.length ? filters.tags : null
        } }),
        signal: controller.signal
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After")) || 60;
        const error = new Error("AniList временно ограничил количество запросов.");
        error.retryAfterMs = Math.max(2200, retryAfter * 1000);
        throw error;
      }
      result = await response.json();
    } finally { clearTimeout(timeout); }
    if (!response.ok || result.errors) {
      const error = new Error(result?.errors?.[0]?.message || "AniList API error");
      error.status = response.status;
      throw error;
    }
    return result.data?.Page?.media || [];
  }, priority);
}

async function fetchJikan(search) {
  if (!search) return [];
  const response = await fetch(`${JIKAN_URL}/anime?q=${encodeURIComponent(search)}&limit=20&sfw=true`);
  if (!response.ok) throw new Error("Jikan API error");
  const result = await response.json();
  return result.data || [];
}

// Shikimori содержит отдельное поле russian и ищет по русским/английским названиям.
// Используем его как дополнительный источник локализованных названий, не заменяя AniList.
async function fetchShikimori(search) {
  if (!search) return [];
  const url = `https://shikimori.one/api/animes?search=${encodeURIComponent(search)}&limit=30&order=popularity`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Shikimori API error");
  const result = await response.json();
  return Array.isArray(result) ? result : [];
}

function requestJikanFull(malId, priority = false) {
  const id = Number(malId);
  if (!id) return Promise.resolve(null);
  if (jikanFullCache.has(id)) return Promise.resolve(jikanFullCache.get(id));

  let job = jikanJobs.get(id);
  if (job) {
    if (priority && !job.started) {
      const oldIndex = jikanQueue.indexOf(job);
      if (oldIndex >= 0) jikanQueue.splice(oldIndex, 1);
      jikanQueue.unshift(job);
    }
    return job.promise;
  }

  let resolveJob;
  const promise = new Promise(resolve => { resolveJob = resolve; });
  job = { id, promise, resolve: resolveJob, started: false };
  jikanJobs.set(id, job);
  if (priority) jikanQueue.unshift(job); else jikanQueue.push(job);
  runJikanQueue();
  return promise;
}

const jikanStaffCache = new Map();
const jikanRelationsCache = new Map();
let jikanSupplementQueue = Promise.resolve();

function requestJikanSupplement(path, cache) {
  const key = String(path);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  const task = jikanSupplementQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - jikanLastRequestAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    const response = await fetch(`${JIKAN_URL}${path}`, { headers: { Accept: "application/json" } });
    jikanLastRequestAt = Date.now();
    if (!response.ok) throw new Error(`Jikan ${response.status}`);
    const payload = await response.json();
    const data = payload?.data ?? null;
    cache.set(key, data);
    return data;
  });
  jikanSupplementQueue = task.catch(() => null);
  return task;
}

function requestJikanStaff(malId) {
  const id = Number(malId);
  return id > 0 ? requestJikanSupplement(`/anime/${id}/staff`, jikanStaffCache) : Promise.resolve([]);
}

function requestJikanRelations(malId) {
  const id = Number(malId);
  return id > 0 ? requestJikanSupplement(`/anime/${id}/relations`, jikanRelationsCache) : Promise.resolve([]);
}

async function runJikanQueue() {
  if (jikanQueueRunning) return;
  jikanQueueRunning = true;
  try {
    while (jikanQueue.length) {
      const wait = Math.max(0, 1100 - (Date.now() - jikanLastRequestAt));
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      const job = jikanQueue.shift();
      if (!job) continue;
      job.started = true;
      let data = null;
      try {
        const response = await fetch(`${JIKAN_URL}/anime/${job.id}/full`, {
          signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined
        });
        if (response.ok) {
          const result = await response.json();
          data = result.data || null;
          if (data) jikanFullCache.set(job.id, data);
        }
      } catch (e) {
        data = null;
      } finally {
        jikanLastRequestAt = Date.now();
        jikanJobs.delete(job.id);
        job.resolve(data);
      }
    }
  } finally {
    jikanQueueRunning = false;
    if (jikanQueue.length) runJikanQueue();
  }
}
