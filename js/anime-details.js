function animeSeasonLabel(a){
 const names={WINTER:'Зима',SPRING:'Весна',SUMMER:'Лето',FALL:'Осень'};
 if(a?.season&&a?.seasonYear)return `${names[a.season]||a.season} ${a.seasonYear}`;
 if(a?.seasonYear)return `Сезон ${a.seasonYear}`;
 return a?.year&&a.year!=='—'?`Год ${a.year}`:'Сезон не указан';
}
function animeReleaseLine(a){
 if(a?.nextEpisodeAt){const d=new Date(Number(a.nextEpisodeAt)*1000);const day=d.toLocaleDateString('ru-RU',{weekday:'long'});const date=d.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});const time=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});return `Следующая серия ${a.nextEpisode||'?'}: ${day}, ${date} в ${time} (по времени устройства)`;}
 if(a?.airingStatus==='RELEASING')return 'Выходит сейчас; точное время следующей серии пока не предоставлено источником.';
 return a?.airingStatus==='FINISHED'?'Показ завершён.':'Дата выхода не подтверждена.';
}
function countryFlag(code) {
  const value = String(code || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) return "🌐";
  return String.fromCodePoint(...[...value].map(char => 127397 + char.charCodeAt(0)));
}

function renderAnimeMeta(a) {
  const country = String(a?.countryOfOrigin || "").toUpperCase();
  const countryLabels = {
    JP: "Япония", CN: "Китай", KR: "Южная Корея", TW: "Тайвань", US: "США",
    GB: "Великобритания", FR: "Франция", DE: "Германия", CA: "Канада", IT: "Италия",
    ES: "Испания", RU: "Россия", TH: "Таиланд", VN: "Вьетнам", IN: "Индия"
  };
  const flag = country ? `${countryFlag(country)} ${countryLabels[country] || country}` : "🌐 Страна не указана";
  const studios = (a?.studios || []).filter(Boolean).join(", ") || "Студия не указана в источнике";
  const staff = Array.isArray(a?.staff) ? a.staff : [];
  const creators = staff.filter(person => /original creator|original work|creator|author|manga author|story|原作|原案/i.test(person.role));
  const directors = staff.filter(person => /director|chief director|監督/i.test(person.role));
  const uniquePeople = list => [...new Map(list.map(person => [person.name, person])).values()].slice(0, 4);
  const creatorText = uniquePeople(creators).map(person => person.name).join(", ");
  const directorText = uniquePeople(directors).map(person => person.name).join(", ");
  const staffBits = [creatorText ? `✍️ Автор / первоисточник: ${creatorText}` : "", directorText ? `🎞️ Режиссёр: ${directorText}` : ""].filter(Boolean);
  return `<span class="yoru-meta-chip">${escapeHTML(flag)}</span><span class="yoru-meta-chip">🎬 ${escapeHTML(a?.format || "Формат не указан")}</span><span class="yoru-meta-chip">🏢 ${escapeHTML(studios)}</span><span class="yoru-meta-chip">📅 ${escapeHTML(animeSeasonLabel(a))}</span>${staffBits.map(text => `<span class="yoru-meta-chip yoru-meta-wide">${escapeHTML(text)}</span>`).join("")}<div class="yoru-release-line">${escapeHTML(animeReleaseLine(a))}</div>`;
}

const yoruRelationCache = new Map();

const ANILIST_RELATION_NODE_FIELDS = `
  id idMal type format status seasonYear episodes nextAiringEpisode { episode airingAt }
  title { romaji english native userPreferred } coverImage { medium large }
  startDate { year } studios { nodes { name } }
  staff(sort: RELEVANCE, perPage: 6) { edges { role node { name { full native } } } }
`;

async function fetchRelationNode(id) {
  const query = `query($id:Int){Media(id:$id,type:ANIME){id relations(page:1,perPage:50){edges{relationType(version:2) node{${ANILIST_RELATION_NODE_FIELDS}}}}}}`;
  const result = await enqueueAniListRequest(async () => {
    const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ query, variables: { id: Number(id) } }) });
    if (r.status === 429) throw new Error("AniList временно ограничил запросы. Попробуй ещё раз позже.");
    if (!r.ok) throw new Error(`AniList ${r.status}`);
    const j = await r.json();
    if (j.errors?.length) throw new Error(j.errors[0].message);
    return j;
  }, "high");
  return result?.data?.Media?.relations?.edges || [];
}

async function fetchRelationBatch(ids) {
  const safeIds = [...new Set((ids || []).map(Number).filter(id => Number.isInteger(id) && id > 0))].slice(0, 50);
  if (!safeIds.length) return [];
  const query = `query($ids:[Int]){Page(page:1,perPage:50){media(id_in:$ids,type:ANIME){id relations(page:1,perPage:50){edges{relationType(version:2) node{${ANILIST_RELATION_NODE_FIELDS}}}}}}}`;
  const result = await enqueueAniListRequest(async () => {
    const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ query, variables: { ids: safeIds } }) });
    if (r.status === 429) throw new Error("AniList временно ограничил запросы. Попробуй ещё раз позже.");
    if (!r.ok) throw new Error(`AniList ${r.status}`);
    const j = await r.json();
    if (j.errors?.length) throw new Error(j.errors[0].message);
    return j;
  }, "high");
  return result?.data?.Page?.media || [];
}

async function fetchAniListByMalId(malId) {
  const query = `query($malId:Int){Media(idMal:$malId,type:ANIME){id idMal title{romaji english native userPreferred} synonyms coverImage{extraLarge large medium} bannerImage description(asHtml:false) episodes status nextAiringEpisode{episode airingAt} popularity averageScore genres season seasonYear countryOfOrigin format studios{nodes{name}} staff(sort:RELEVANCE,perPage:10){edges{role node{name{full native}}}} startDate{year month day}}}`;
  const result = await enqueueAniListRequest(async () => {
    const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ query, variables: { malId: Number(malId) } }) });
    if (!r.ok) throw new Error(`AniList ${r.status}`);
    const j = await r.json();
    if (j.errors?.length) throw new Error(j.errors[0].message);
    return j?.data?.Media || null;
  }, "high");
  return result;
}

async function fetchAniListById(animeId) {
  const id = Number(animeId);
  if (!(id > 0)) return null;
  const query = `query($id:Int){Media(id:$id,type:ANIME){id idMal type title{romaji english native userPreferred} synonyms coverImage{extraLarge large medium} bannerImage description(asHtml:false) episodes status nextAiringEpisode{episode airingAt} popularity averageScore genres season seasonYear countryOfOrigin format studios{nodes{name}} staff(sort:RELEVANCE,perPage:10){edges{role node{name{full native}}}} startDate{year month day}}}`;
  const result = await enqueueAniListRequest(async () => {
    const response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query, variables: { id } }) });
    if (!response.ok) throw new Error(`AniList ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error(payload.errors[0].message);
    return payload?.data?.Media || null;
  }, "high");
  return result;
}

async function fetchAniListByMalIds(malIds) {
  const ids = [...new Set((malIds || []).map(Number).filter(id => Number.isInteger(id) && id > 0))].slice(0, 50);
  if (!ids.length) return [];
  const query = `query($ids:[Int]){Page(page:1,perPage:50){media(idMal_in:$ids,type:ANIME){id idMal type format status seasonYear episodes nextAiringEpisode{episode airingAt} title{romaji english native userPreferred} coverImage{medium large} startDate{year} studios{nodes{name}} staff(sort:RELEVANCE,perPage:6){edges{role node{name{full native}}}}}}}}`;
  const result = await enqueueAniListRequest(async () => {
    const response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query, variables: { ids } }) });
    if (!response.ok) throw new Error(`AniList ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error(payload.errors[0].message);
    return payload?.data?.Page?.media || [];
  }, "high");
  return result;
}

function normalizeJikanRelationType(value) {
  const key = String(value || "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  const map = {
    "prequel": "PREQUEL", "parent story": "PARENT", "sequel": "SEQUEL",
    "side story": "SIDE_STORY", "spin off": "SPIN_OFF", "alternative version": "ALTERNATIVE",
    "alternative setting": "ALTERNATIVE", "summary": "SUMMARY", "full story": "FULL_STORY",
    "adaptation": "ADAPTATION", "other": "OTHER"
  };
  return map[key] || "OTHER";
}

async function loadAnimeRelations(id) {
  const a = animeList.find(x => String(x.id) === String(id));
  const box = document.getElementById("yoruFranchiseBody");
  if (!a || !box) return;
  if (yoruRelationCache.has(String(id))) { box.innerHTML = yoruRelationCache.get(String(id)); return; }
  box.innerHTML = '<p class="community-note">Собираем продолжения, фильмы, OVA и побочные истории из нескольких баз…</p>';
  const labels = {
    PREQUEL: "Предыстория", PARENT: "Основная франшиза", SEQUEL: "Продолжение", SIDE_STORY: "Побочная история",
    SPIN_OFF: "Спин-офф", ALTERNATIVE: "Альтернативная версия", SUMMARY: "Краткое изложение", FULL_STORY: "Полная история",
    SOURCE: "Первоисточник", ADAPTATION: "Адаптация", CHARACTER: "История персонажа", OTHER: "Связанное произведение", RELATED: "Связано через франшизу"
  };
  try {
    let rootId = Number(a.id) > 0 ? Number(a.id) : 0;
    if (!rootId && a.malId) {
      const mapped = await fetchAniListByMalId(a.malId);
      if (mapped?.id) {
        const mappedAnime = fromAniList(mapped, a.ruTitle || "");
        animeList = mergeAnimeLists(animeList, [mappedAnime]);
        rootId = Number(mapped.id);
      }
    }

    const tasks = [];
    if (rootId) tasks.push(fetchRelationNode(rootId).then(edges => ({ kind: "anilist", data: edges })).catch(error => ({ kind: "anilist-error", error })));
    if (a.malId) tasks.push(requestJikanRelations(a.malId).then(data => ({ kind: "jikan", data: data || [] })).catch(error => ({ kind: "jikan-error", error })));
    const settled = await Promise.all(tasks);
    const directEdges = settled.find(item => item.kind === "anilist")?.data || [];
    const jikanGroups = settled.find(item => item.kind === "jikan")?.data || [];

    const found = new Map();
    const directIds = [];
    const addNode = (node, relationType = "OTHER", depth = 0) => {
      const nodeId = Number(node?.id);
      const malId = Number(node?.idMal) || 0;
      if (!node || node.type !== "ANIME" || (!nodeId && !malId) || nodeId === rootId) return;
      const key = malId ? `mal-${malId}` : `id-${nodeId}`;
      const previous = found.get(key);
      if (!previous || depth < previous.depth) found.set(key, { node, relationType, depth });
    };
    directEdges.forEach(edge => {
      addNode(edge?.node, edge?.relationType || "OTHER", 0);
      if (Number(edge?.node?.id) > 0) directIds.push(Number(edge.node.id));
    });

    // Jikan contributes relation rows that AniList sometimes does not connect.
    const jikanEntries = [];
    for (const group of jikanGroups) {
      const relationType = normalizeJikanRelationType(group?.relation);
      for (const entry of group?.entry || []) {
        if (String(entry?.type || "").toLowerCase() !== "anime" || !(Number(entry?.mal_id) > 0)) continue;
        jikanEntries.push({ malId: Number(entry.mal_id), name: String(entry.name || "").trim(), url: entry.url || "", relationType });
      }
    }
    const mappedJikan = jikanEntries.length ? await fetchAniListByMalIds(jikanEntries.map(x => x.malId)).catch(() => []) : [];
    const byMalId = new Map(mappedJikan.map(node => [Number(node.idMal), node]));
    for (const entry of jikanEntries) {
      const mapped = byMalId.get(entry.malId);
      if (mapped) {
        addNode(mapped, entry.relationType, 0);
        directIds.push(Number(mapped.id));
      } else {
        addNode({
          id: -entry.malId, idMal: entry.malId, type: "ANIME", format: "Связанное аниме", status: "UNKNOWN",
          seasonYear: null, episodes: 0, title: { english: entry.name, romaji: entry.name, native: "", userPreferred: entry.name },
          coverImage: {}, studios: { nodes: [] }, staff: { edges: [] }, externalUrl: entry.url
        }, entry.relationType, 0);
      }
    }

    // Add one more relation level to catch seasons/films linked through sibling entries.
    const neighbourIds = [...new Set(directIds.filter(x => x > 0))].slice(0, 50);
    if (neighbourIds.length) {
      const relatedMedia = await fetchRelationBatch(neighbourIds).catch(error => {
        console.debug("Second-level AniList relations unavailable", error);
        return [];
      });
      for (const media of relatedMedia) {
        for (const edge of media.relations?.edges || []) addNode(edge?.node, "RELATED", 1);
      }
    }

    const rels = [...found.values()].sort((x, y) => {
      const order = { PREQUEL: 0, PARENT: 1, SEQUEL: 2, SIDE_STORY: 3, SPIN_OFF: 4, ALTERNATIVE: 5, SUMMARY: 6, FULL_STORY: 7, SOURCE: 8, ADAPTATION: 9, RELATED: 10, OTHER: 11 };
      return (order[x.relationType] ?? 12) - (order[y.relationType] ?? 12) ||
        (Number(x.node.seasonYear || x.node.startDate?.year) || 9999) - (Number(y.node.seasonYear || y.node.startDate?.year) || 9999);
    });
    if (!rels.length) {
      box.innerHTML = '<p class="community-note">В AniList и MyAnimeList пока не обнаружены связанные части. Если у франшизы есть продолжение, источник мог не указать связь.</p><button type="button" class="period-button" onclick="yoruRelationCache.delete(' + JSON.stringify(String(id)) + ');loadAnimeRelations(' + JSON.stringify(id) + ')">↻ Повторить поиск</button>';
      return;
    }

    box.innerHTML = '<div class="yoru-franchise-list">' + rels.map(({ node: n, relationType, depth }) => {
      const canonical = safeAnimeTitle([n.title?.english, n.title?.romaji, n.title?.native, n.title?.userPreferred]);
      const key = normalizeSearchText(canonical);
      const title = RU_TITLE_OVERRIDES[key] || canonical;
      const year = n.seasonYear || n.startDate?.year || "Год неизвестен";
      const nodeId = Number(n.id);
      const malId = Number(n.idMal) || (nodeId < 0 ? -nodeId : 0);
      const studios = (n.studios?.nodes || []).map(x => x.name).filter(Boolean).join(", ") || "Студия уточняется";
      const staff = (n.staff?.edges || []).filter(e => /original creator|original work|creator|author|manga author|story|原作|原案/i.test(e.role || "")).map(e => e.node?.name?.full || e.node?.name?.native).filter(Boolean).slice(0, 2).join(", ");
      const nextEp = Number(n.nextAiringEpisode?.episode) || 0;
      const epCount = n.status === "RELEASING" && nextEp > 1 ? nextEp - 1 : Number(n.episodes) || 0;
      const epText = epCount ? `${epCount} эп. ${n.status === "RELEASING" ? "вышло" : "всего"}` : (n.status === "RELEASING" ? "серии выходят" : "количество уточняется");
      const relationUrl = n.externalUrl ? ` · <a href="${escapeHTML(n.externalUrl)}" target="_blank" rel="noopener noreferrer">источник</a>` : "";
      return `<div class="yoru-franchise-item" data-yoru-relation="${nodeId}" data-mal-id="${malId}"><img loading="lazy" src="${escapeHTML(n.coverImage?.medium || n.coverImage?.large || "")}" alt=""><div><strong data-relation-title title="${escapeHTML(canonical)}">${escapeHTML(title)}</strong><small>${escapeHTML(labels[relationType] || relationType || "Связанное аниме")} · ${escapeHTML(String(year))} · ${escapeHTML(n.format || "Формат не указан")} · ${escapeHTML(epText)}<br>🏢 ${escapeHTML(studios)}${staff ? `<br>✍️ ${escapeHTML(staff)}` : ""}${depth ? " · связь второго уровня" : ""}${relationUrl}</small></div><button type="button" onclick="openRelatedAnime(${nodeId})">Открыть</button></div>`;
    }).join("") + '</div><p class="community-note" style="margin-top:10px">Список объединяет связи AniList и MyAnimeList/Jikan, включая прямые связи и соседние части франшизы. Произведения без связей в этих базах всё ещё могут отсутствовать.</p>';
    yoruRelationCache.set(String(id), box.innerHTML);
    enrichFranchiseRussianTitles(box);
  } catch (err) {
    console.warn("YORU franchise relations failed", err);
    box.innerHTML = '<p class="community-note">Не удалось загрузить связи из внешних баз. Попробуй повторить запрос.</p><button type="button" class="period-button" onclick="yoruRelationCache.delete(' + JSON.stringify(String(id)) + ');loadAnimeRelations(' + JSON.stringify(id) + ')">↻ Повторить</button>';
  }
}

const yoruRussianTitleCache = new Map();
async function enrichFranchiseRussianTitles(root){
 const rows=[...root.querySelectorAll('.yoru-franchise-item[data-mal-id]')].filter(row=>Number(row.dataset.malId)>0);
 for(const row of rows){
  const malId=Number(row.dataset.malId); const titleNode=row.querySelector('[data-relation-title]');
  if(!titleNode || !malId) continue;
  try{
   let russian=yoruRussianTitleCache.get(malId);
   if(russian===undefined){
    const response=await fetch(`${JIKAN_URL}/anime/${malId}/full`,{headers:{Accept:'application/json'}});
    if(!response.ok) throw new Error(`Jikan ${response.status}`);
    const payload=await response.json();
    russian=pickRussianTitle(payload?.data)||'';
    yoruRussianTitleCache.set(malId,russian);
    await sleep(380); // бережно относимся к публичному API
   }
   if(isPlausibleAnimeTitle(russian) && titleNode.isConnected){titleNode.textContent=russian;titleNode.title='Русское название из MyAnimeList/Jikan';}
  }catch(error){console.debug('Russian franchise title unavailable:',malId,error);}
 }
}

async function openRelatedAnime(id) {
  let a = animeList.find(x => String(x.id) === String(id));
  const numericId = Number(id);
  const malId = a?.malId || (numericId < 0 ? -numericId : 0);

  if (!a && numericId > 0) {
    try {
      const item = await fetchAniListById(numericId);
      if (item?.id) {
        a = fromAniList(item);
        animeList = mergeAnimeLists(animeList, [a]);
      }
    } catch (error) { console.debug("AniList related entry unavailable", error); }
  }

  if ((!a || Number(a.id) < 0) && malId) {
    try {
      const item = await fetchAniListByMalId(malId);
      if (item?.id) {
        const mapped = fromAniList(item, a?.ruTitle || "");
        if (a) { mapped.status = a.status || mapped.status; mapped.progress = a.progress || 0; }
        animeList = mergeAnimeLists(animeList, [mapped]);
        a = animeList.find(x => String(x.id) === String(mapped.id)) || mapped;
      }
    } catch (error) { console.debug("AniList mapping for related title unavailable", error); }
  }
  if (!a && malId) {
    const data = await requestJikanFull(malId, true);
    if (data) {
      a = fromJikan(data);
      animeList = mergeAnimeLists(animeList, [a]);
    }
  }
  if (a) openModal(a.id);
}

function renderAnimeModal(a, showEpisodes = false) {
  const episodes = animeEpisodeCount(a);
  const links = a.watchLinks || {};
  document.getElementById("modalContent").innerHTML = `
    <div class="modal-content">
      <img class="modal-poster" src="${a.cover}"
        alt="${escapeHTML(a.ruTitle || a.title)}">

      <div>
        <div style="color:#c5a4ff;font-size:12px">
          ${a.year} · ★ ${a.score}
        </div>

        <h2>${escapeHTML(a.ruTitle || a.title)}</h2>
        <div class="alt">${escapeHTML(a.originalTitle || a.alt || "")}</div>

        <div class="facts">
          <div class="fact">${escapeHTML(episodeSummary(a))}</div>
          <div class="fact">${escapeHTML(animeSeasonLabel(a))}</div>
          <div class="fact">${statusNames[a.status]}</div>
        </div>

        <p class="description" id="animeDescription">${escapeHTML(descriptionTextForModal(a))}</p>
        ${a.descTranslationError ? `<button class="period-button" id="retryDescriptionButton" onclick="retryDescriptionTranslation(${a.id})">↻ Повторить перевод описания</button>` : ""}

        <p style="color:#a2a5b8;font-size:13px">
          Жанры: ${(a.genres || []).map(escapeHTML).join(", ")}
        </p>
        <div class="yoru-anime-meta" id="yoruAnimeMeta">${renderAnimeMeta(a)}</div>
        <details class="yoru-franchise" id="yoruFranchise" ontoggle="if(this.open)loadAnimeRelations(${a.id})">
          <summary>Все части франшизы — сезоны, фильмы и OVA <span>⌄</span></summary>
          <div class="yoru-franchise-body" id="yoruFranchiseBody"><p class="community-note">Нажми, чтобы загрузить связанные сезоны, фильмы и дополнительные истории.</p></div>
        </details>

        <p style="font-size:13px">
          Прогресс: <b>${a.progress} / ${episodes || "?"}</b> серий
        </p>

        <div class="modal-buttons">
          <button class="primary" onclick="openWatch(${a.id})">▶ Смотреть на Yami Anime</button>
          <button onclick="setStatus(${a.id},'watching')">Смотрю</button>
          <button onclick="setStatus(${a.id},'watched')">✓ Просмотрено</button>
          <button onclick="setStatus(${a.id},'planned')">☆ В планы</button>
          <button onclick="setStatus(${a.id},'unset')">Сбросить</button>
        </div>
      </div>
    </div>
    <section class="episode-panel" id="episodePanel">
      <div class="episode-heading"><div><p class="episode-kicker">夜 YORU. · WATCHLIST</p><h3>Серии и просмотр</h3></div><span class="episode-count-pill">${animeEpisodeCount(a) ? `${animeEpisodeCount(a)} эп.` : "серии"}</span></div>
      <p class="episode-note">${escapeHTML(episodeSummary(a))} Выбери серию ниже — YORU откроет страницу этого аниме на Yami Anime и передаст номер серии в URL. Если внешний сайт не поддерживает переход по номеру серии, может понадобиться выбрать эпизод там вручную.</p>
      <div class="player-shell">
        <div class="player-frame-wrap" id="yoruPlayer">
          <div class="player-empty"><strong>夜 YORU. → выбранный эпизод</strong><span id="yamiPlayerHint">${Number(selectedEpisodes?.[a.id]) ? `Выбрана серия ${Number(selectedEpisodes[a.id])}.` : "Выбери серию ниже или продолжи просмотр."} Откроется страница выбранного тайтла на Yami Anime в отдельной вкладке.</span><button class="primary" onclick="openWatch(${a.id})" style="margin-top:12px;padding:10px 16px;border-radius:10px">▶ Открыть выбранную серию ↗</button></div>
        </div>
      </div>
      ${renderEpisodeButtons(a)}
    </section>
    <section class="anime-rating-panel" aria-label="Оценка аниме"><div id="animeRatingWidget">${renderAnimeRating(a.id)}</div></section>
    <section class="anime-community" aria-label="Комментарии к аниме">
      <h3>Обсуждение тайтла</h3><p class="community-note">Оставляй мнение без спойлеров и оскорблений. Сейчас комментарии сохраняются только в этом браузере; для общего обсуждения нужен сервер.</p>
      <textarea class="community-input" id="animeCommentText" rows="3" maxlength="1200" placeholder="Что думаешь об этом аниме?"></textarea>
      <div class="community-actions"><button class="primary" onclick="postAnimeComment(${a.id})">Опубликовать</button><button onclick="openCommunity('rules')">Правила сообщества</button></div>
      <div id="animeCommentsList">${renderAnimeComments(a.id)}</div>
    </section>
  `;
}

function showEpisodePage(id, page) {
  const a = animeList.find(x => x.id === id);
  if (!a) return;
  const overlay = document.getElementById("overlay");
  const modal = overlay?.querySelector(".modal");
  const overlayTop = overlay?.scrollTop || 0;
  const modalTop = modal?.scrollTop || 0;
  episodePage = Math.max(0, page);
  renderAnimeModal(a, true);
  requestAnimationFrame(() => {
    if (overlay) overlay.scrollTop = overlayTop;
    const nextModal = overlay?.querySelector(".modal");
    if (nextModal) nextModal.scrollTop = modalTop;
    document.getElementById("episodePanel")?.scrollIntoView({ block: "nearest", behavior: "auto" });
  });
}

function openModal(id, showEpisodes = false) {
  const a = animeList.find(x => x.id === id);
  if (!a) return;
  activeAnime = id;
  recordAnimeView(id);
  episodePage = 0;
  renderAnimeModal(a, showEpisodes);
  document.getElementById("overlay").classList.add("show");
  document.body.style.overflow = "hidden";
  loadAnimeDetails(a);
}

function closeModal() {
  document.getElementById("overlay").classList.remove("show");
  document.body.style.overflow = "";
  activeAnime = null;
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeModal();
    if (document.getElementById("settingsOverlay")?.classList.contains("show")) closeSettings();
    else if (document.getElementById("accountOverlay")?.classList.contains("show")) closeAccount();
  }
});
