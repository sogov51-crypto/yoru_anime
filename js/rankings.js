// YORU live discovery: AniList-powered rankings and local collections.
let yoruRankCurrent='week',yoruRankCache={},yoruCollections=JSON.parse(localStorage.getItem('yoruCollectionsV1')||'[]');
let yoruSessionStarted=Date.now(),yoruLocalWatchMs=Number(localStorage.getItem('yoruLocalWatchMs')||0);
function yoruRankTitle(m){return (m.title?.userPreferred||m.title?.english||m.title?.romaji||'Без названия').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function yoruFlag(c){return ({JP:'🇯🇵',CN:'🇨🇳',KR:'🇰🇷',TW:'🇹🇼',US:'🇺🇸',GB:'🇬🇧',FR:'🇫🇷',DE:'🇩🇪'})[c]||'🌐'}
function yoruSafe(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function yoruRankQuery(sort,status,recentOnly=false){const recent=recentOnly?',startDate_greater:20231231,startDate_lesser:20270101':'';return `query { Page(page:1,perPage:30){ media(type:ANIME,isAdult:false${status?',status:'+status:''}${recent},sort:[${sort}]){ id idMal title{romaji english native userPreferred} coverImage{large} episodes format status seasonYear averageScore popularity trending favourites countryOfOrigin studios(isMain:true){edges{node{name}}} nextAiringEpisode{episode airingAt timeUntilAiring} startDate{year month day} } } }`}
async function yoruFetchRank(key){if(yoruRankCache[key]&&Date.now()-yoruRankCache[key].savedAt<5*60*1000)return yoruRankCache[key].items;let recent=key==='popularRecent'||key==='activeRecent';let sort=key==='popularRecent'?'POPULARITY_DESC':key==='activeRecent'?'TRENDING_DESC':key==='week'?'TRENDING_DESC':key==='month'?'POPULARITY_DESC':key==='top'?'SCORE_DESC':key==='hidden'?'POPULARITY':'START_DATE_DESC';let q=yoruRankQuery(sort,key==='airing'?'RELEASING':null,recent);let r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:q})});if(!r.ok)throw Error('AniList HTTP '+r.status);let j=await r.json();if(j.errors?.length)throw Error(j.errors[0].message);let a=j?.data?.Page?.media||[];yoruRankCache[key]={items:a,savedAt:Date.now()};return a}
function yoruLocalActivityScore(m){const e=getLocalAnimeEngagement(m.id);return (Number(m.trending)||0)*1.5+Math.log10((Number(m.popularity)||0)+1)*8+e.views*2+e.comments*12+e.rated*6;}
function yoruRankCard(m,i){let studio=(m.studios?.edges||[]).map(e=>e.node?.name).filter(Boolean).slice(0,2).join(', ')||'Студия не указана';let ep=m.nextAiringEpisode;let next=ep?`Следующая: серия ${ep.episode} · ${new Date(ep.airingAt*1000).toLocaleString('ru-RU',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`:(m.episodes?`${m.episodes} серий`:'Серии уточняются');let score=m.averageScore?`${(m.averageScore/10).toFixed(1)} ★`:'Нет оценки';let year=m.seasonYear||m.startDate?.year||'—';let local=getLocalAnimeEngagement(m.id);let activity=yoruRankCurrent==='activeRecent'?` · ${local.views} откр. · ${local.comments} комм.`:'';return `<article class="rank-card" onclick="yoruOpenRankAnime(${m.id})"><span class="rank-position">#${i+1}</span><img class="rank-cover" loading="lazy" src="${yoruSafe(m.coverImage?.large||'')}" alt=""><div class="rank-card-body"><div class="rank-card-title">${yoruRankTitle(m)}</div><div class="rank-card-meta">${year} · ${m.format||'Аниме'}<br><span class="rank-flag">${yoruFlag(m.countryOfOrigin)}</span>${yoruSafe(studio)}<br>${yoruSafe(next)}</div><div class="rank-card-foot"><span>${score}</span><span>${Number(m.popularity||0).toLocaleString('ru-RU')} в списках${activity}</span></div></div></article>`}
async function yoruRankTab(key){
  yoruRankCurrent=key;
  document.querySelectorAll('.rank-tab').forEach(b=>b.classList.toggle('active',b.dataset.rank===key));
  const grid=document.getElementById('rankGrid'),tools=document.getElementById('rankTools'),desc=document.getElementById('rankExplainer'),status=document.getElementById('rankStatus');
  if(!grid)return;tools.innerHTML='';status.textContent='';
  if(key==='collections'){desc.textContent='Создавай собственные подборки. Они сохраняются в этом браузере.';renderYoruCollections();return;}
  if(key==='hours'){desc.textContent='Локальная статистика времени активности сайта в этом браузере, а не глобальный рейтинг пользователей.';const mins=Math.floor((yoruLocalWatchMs+Date.now()-yoruSessionStarted)/60000);grid.innerHTML=`<div class="rank-collection"><h3>Твоя активность</h3><strong>${(mins/60).toFixed(1)} ч</strong><p class="rank-card-meta">Время с открытым YORU в этой вкладке.</p></div>`;return;}
  const descriptions={
    popularRecent:'Самые популярные аниме, впервые вышедшие с 1 января 2024 по 31 декабря 2026. Сортировка по количеству пользователей AniList, добавивших тайтл в списки.',
    activeRecent:'Самые активные новинки 2024–2026: текущий тренд AniList плюс локальные просмотры, комментарии и оценки в этом браузере. Локальные сигналы не являются общей статистикой сайта.',
    week:'Текущие тренды AniList за короткий период; это не архивная статистика строго за 7 дней.',
    month:'Популярность AniList на текущий момент; это не точный архив просмотров за 30 дней.',
    airing:'Свежие текущие онгоинги, отсортированные по дате начала выхода.',
    top:'Тайтлы с высокими средними оценками AniList.',
    hidden:'Менее популярные тайтлы AniList — здесь встречаются нишевые работы.'
  };
  desc.textContent=descriptions[key]||'';
  grid.innerHTML='<div class="rank-loading">Загружаем подборку…</div>';
  try{
    let rows=await yoruFetchRank(key);
    if(key==='popularRecent'||key==='activeRecent')rows=rows.filter(m=>{const y=Number(m.startDate?.year||m.seasonYear||0);return y>=2024&&y<=2026;});
    if(key==='activeRecent')rows=rows.slice().sort((a,b)=>yoruLocalActivityScore(b)-yoruLocalActivityScore(a));
    if(key==='airing')rows=rows.filter(m=>m.status==='RELEASING').sort((a,b)=>(Number(b.startDate?.year||b.seasonYear)||0)-(Number(a.startDate?.year||a.seasonYear)||0)||(Number(b.startDate?.month)||0)-(Number(a.startDate?.month)||0));
    if(key==='hidden')rows=rows.filter(m=>m.popularity>0&&m.popularity<25000).slice(0,24);
    if(key==='top')rows=rows.filter(m=>m.averageScore&&m.averageScore>=75&&m.popularity>1000);
    if(!rows.length){grid.innerHTML='<div class="rank-empty">В этом периоде пока нет результатов от AniList.</div>';return;}
    grid.innerHTML=rows.map(yoruRankCard).join('');
    status.textContent=key==='activeRecent'?'AniList + локальные действия на этом устройстве.':'Данные AniList · период 2024–2026 для двух новых вкладок.';
  }catch(e){console.error(e);grid.innerHTML='<div class="rank-empty">Не удалось загрузить подборку. Проверь соединение и попробуй ещё раз.</div>';}
}
function yoruOpenRankAnime(id){let m=yoruRankCache[yoruRankCurrent]?.items?.find(x=>x.id===id);if(!m)return;let a=fromAniList(m);animeList=mergeAnimeLists(animeList,[a]);let card=document.querySelector(`[data-id="${id}"]`);if(card)card.click();else if(typeof openModal==='function')openModal(a.id);else loadAnimeDetails(a);}
function renderYoruCollections(){let grid=document.getElementById('rankGrid'),tools=document.getElementById('rankTools');tools.innerHTML='<form class="rank-collection-form" onsubmit="createYoruCollection(event)"><input id="yoruCollectionName" maxlength="40" placeholder="Название новой коллекции…" required><button type="submit">＋ Создать</button></form>';grid.innerHTML=yoruCollections.length?yoruCollections.map((c,i)=>`<div class="rank-collection"><h3>${yoruSafe(c.name)}</h3><small>${c.items.length} аниме · локально</small><div>${c.items.slice(0,6).map(x=>`<span class="award">${yoruSafe(x.title)}</span>`).join(' ')}</div><button onclick="addCurrentAnimeToCollection(${i})">Добавить аниме</button><button onclick="deleteYoruCollection(${i})">Удалить</button></div>`).join(''):'<div class="rank-empty">Коллекций пока нет. Создай первую подборку выше.</div>'}
function createYoruCollection(e){e.preventDefault();let name=(document.getElementById('yoruCollectionName').value||'').trim();if(!name)return;yoruCollections.push({name,items:[]});localStorage.setItem('yoruCollectionsV1',JSON.stringify(yoruCollections));renderYoruCollections();toast('Коллекция создана')}
function addCurrentAnimeToCollection(i){let title=prompt('Название аниме для добавления:');if(!title)return;yoruCollections[i].items.push({title:title.trim()});localStorage.setItem('yoruCollectionsV1',JSON.stringify(yoruCollections));renderYoruCollections()}
function deleteYoruCollection(i){if(!confirm('Удалить коллекцию?'))return;yoruCollections.splice(i,1);localStorage.setItem('yoruCollectionsV1',JSON.stringify(yoruCollections));renderYoruCollections()}
document.addEventListener('visibilitychange',()=>{if(document.hidden){yoruLocalWatchMs+=Date.now()-yoruSessionStarted;localStorage.setItem('yoruLocalWatchMs',String(yoruLocalWatchMs))}else yoruSessionStarted=Date.now()});
