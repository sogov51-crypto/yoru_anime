function profileLevel(){const watched=Array.isArray(animeList)?animeList.filter(a=>a.status==='watched').length:0;return watched>=50?50:watched>=20?20:watched>=10?10:watched>=5?5:1}
function profileLevelName(level){return ({1:'Новичок',5:'Исследователь',10:'Знаток аниме',20:'Сэнсэй',50:'Лунная легенда'})[level]||'Новичок'}
function profileAsset(){return profileData.avatarData||profileData.avatarUrl||''}
function updateProfileCustomizationUI(){
 const level=profileLevel(),name=(profileData.name||'YoruFan').trim();
 const avatar=document.getElementById('profileAvatarPreview'),banner=document.getElementById('profileBannerPreview');
 if(avatar){avatar.textContent=profileAsset()?'':(name[0]||'Y').toUpperCase();avatar.style.backgroundImage=profileAsset()?`url("${profileAsset().replace(/"/g,'%22')}")`:'';avatar.className='profile-custom-avatar'+(Number(profileData.frame)>=5&&level>=Number(profileData.frame)?' frame-'+profileData.frame:'');}
 if(banner){const b=profileData.bannerData||profileData.bannerUrl;banner.style.backgroundImage=b?`linear-gradient(0deg,#09071088,transparent),url("${b.replace(/"/g,'%22')}")`:'';const video=document.getElementById('profileBannerVideoPreview');if(video){if(profileData.bannerVideo){video.src=profileData.bannerVideo;video.style.display='block';video.play().catch(()=>{});}else{video.pause();video.removeAttribute('src');video.load();video.style.display='none';}}}
 const title=document.getElementById('profilePreviewName');if(title)title.textContent=name;
 const label=document.getElementById('profileBannerName');if(label)label.textContent='夜 '+name.toUpperCase();
 const levelText=document.getElementById('profileLevelText');if(levelText)levelText.textContent=`Уровень ${level} · ${profileLevelName(level)}`;
 const progress=document.getElementById('profileProgressBar');if(progress)progress.style.width=(level===50?100:Math.min(100,level===20?level/50*100:level===10?level/20*100:level===5?level/10*100:20))+'%';
 const f=document.getElementById('customProfileFrame');if(f){[...f.options].forEach(o=>o.disabled=Number(o.value)>level);if(Number(profileData.frame)>level)f.value='0';else f.value=String(profileData.frame||0)}
 const n=document.getElementById('customProfileName');if(n)n.value=profileData.name||'';
 const au=document.getElementById('customAvatarUrl');if(au)au.value=profileData.avatarUrl||'';
 const bu=document.getElementById('customBannerUrl');if(bu)bu.value=profileData.bannerUrl||'';
 const bv=document.getElementById('customBannerVideo');if(bv)bv.value=profileData.bannerVideo||'';
 const ds=document.getElementById('customDockStyle');if(ds)ds.value=profileData.dockStyle||'glass';
 const shape=document.getElementById('customDockShape');if(shape)shape.value=profileData.dockShape||'pill';
 [['customDockWidth','dockWidth',430,'dockWidthValue',' px'],['customDockHeight','dockHeight',66,'dockHeightValue',' px'],['customDockOpacity','dockOpacity',78,'dockOpacityValue','%'],['customDockBlur','dockBlur',24,'dockBlurValue',' px']].forEach(([id,key,def,label,suffix])=>{const el=document.getElementById(id);if(el)el.value=profileData[key]??def;const out=document.getElementById(label);if(out)out.textContent=(profileData[key]??def)+suffix});
 applyDockStyle();applyDockPosition();
}

function saveProfileCustomization(){
 const n=document.getElementById('customProfileName');if(n)profileData.name=n.value.trim().slice(0,24);
 const au=document.getElementById('customAvatarUrl');if(au)profileData.avatarUrl=au.value.trim();
 const bu=document.getElementById('customBannerUrl');if(bu)profileData.bannerUrl=bu.value.trim();
 const bv=document.getElementById('customBannerVideo');if(bv)profileData.bannerVideo=bv.value.trim();
 const ds=document.getElementById('customDockStyle');if(ds)profileData.dockStyle=ds.value;
 const shape=document.getElementById('customDockShape');if(shape)profileData.dockShape=shape.value;
 ['customDockWidth','customDockHeight','customDockOpacity','customDockBlur'].forEach(id=>{const el=document.getElementById(id);if(el)profileData[id==='customDockWidth'?'dockWidth':id==='customDockHeight'?'dockHeight':id==='customDockOpacity'?'dockOpacity':'dockBlur']=Number(el.value)});
 const fr=document.getElementById('customProfileFrame');if(fr)profileData.frame=Number(fr.value)||0;
 localStorage.setItem('yoruProfile',JSON.stringify(profileData));document.getElementById('profileName').value=profileData.name||'';updateProfileStats();updateProfileCustomizationUI();toast('Кастомизация профиля сохранена');
}
function readProfileImage(file,field){if(!file)return;if(file.size>2*1024*1024){toast('Выбери изображение до 2 МБ');return}const reader=new FileReader();reader.onload=()=>{profileData[field]=String(reader.result||'');if(field==='avatarData')profileData.avatarUrl='';if(field==='bannerData')profileData.bannerUrl='';localStorage.setItem('yoruProfile',JSON.stringify(profileData));updateProfileCustomizationUI();toast('Изображение добавлено')};reader.readAsDataURL(file)}

function isYoruLoggedIn(){return localStorage.getItem("yoruLoggedIn")==="1" && !!profileData.name}
function updateAuthUI(){const b=document.getElementById("headerLoginButton");if(b)b.textContent=isYoruLoggedIn()?((profileData.name||"Профиль")+" ▾"):"Войти"}
function authProviderLater(provider){toast("Вход через "+provider+" пока не подключён. Пока доступен локальный вход по никнейму.")}
function loginLocal(){const input=document.getElementById("localAuthName");const name=(input?.value||"").trim().slice(0,24);if(name.length<2){toast("Введи никнейм минимум из 2 символов");input?.focus();return}profileData.name=name;localStorage.setItem("yoruProfile",JSON.stringify(profileData));localStorage.setItem("yoruLoggedIn","1");showAccountState();updateProfileStats();updateProfileCustomizationUI();updateAuthUI();toast("Добро пожаловать, "+name+"!")}
function logoutLocal(){localStorage.removeItem("yoruLoggedIn");showAccountState();updateAuthUI();toast("Ты вышел из аккаунта")}
function showAccountState(){const logged=isYoruLoggedIn();const gate=document.getElementById("authGate"),content=document.getElementById("profileAccountContent");if(gate)gate.style.display=logged?"none":"block";if(content)content.style.display=logged?"block":"none";const input=document.getElementById("localAuthName");if(input)input.value=profileData.name||""}
const YORU_FRIENDS_KEY = "yoruFriendsLocalV1";
function getYoruFriendRequests(){
  try {
    const value = JSON.parse(localStorage.getItem(YORU_FRIENDS_KEY) || "[]");
    return Array.isArray(value) ? value.filter(x => x && typeof x.name === "string") : [];
  } catch (_) { return []; }
}
function saveYoruFriendRequests(items){
  try { localStorage.setItem(YORU_FRIENDS_KEY, JSON.stringify(items.slice(0,100))); }
  catch (_) { toast("Не удалось сохранить список. Возможно, переполнено хранилище браузера."); }
}
function renderYoruFriends(){
  const list = document.getElementById("yoruFriendsList");
  const count = document.getElementById("yoruFriendsCount");
  if(!list) return;
  const items = getYoruFriendRequests();
  if(count) count.textContent = String(items.length);
  if(!items.length){
    list.innerHTML = '<div class="yoru-friends-empty">Здесь пока пусто. Добавь никнейм, чтобы сохранить контакт в своём списке.</div>';
    return;
  }
  list.innerHTML = items.map((item,index)=>{
    const safeName = escapeHTML(item.name);
    const initial = escapeHTML((item.name.trim()[0] || "?").toUpperCase());
    const when = item.createdAt ? new Date(item.createdAt).toLocaleDateString("ru-RU") : "";
    return `<div class="yoru-friend-row"><div class="yoru-friend-avatar">${initial}</div><div class="yoru-friend-info"><strong>${safeName}</strong><small>Локальный запрос · ${when}</small></div><button class="yoru-friend-remove" type="button" onclick="removeYoruFriendRequest(${index})" aria-label="Удалить ${safeName}">Удалить</button></div>`;
  }).join("");
}
function addYoruFriendRequest(event){
  event?.preventDefault();
  const input = document.getElementById("yoruFriendName");
  const name = (input?.value || "").trim().replace(/^@+/, "").slice(0,24);
  if(name.length < 2){ toast("Введи никнейм длиной хотя бы 2 символа"); input?.focus(); return; }
  if(!isYoruLoggedIn()){ toast("Сначала создай профиль YORU"); return; }
  if(name.toLocaleLowerCase() === (profileData.name || "").trim().toLocaleLowerCase()){
    toast("Нельзя добавить самого себя"); return;
  }
  const items = getYoruFriendRequests();
  if(items.some(x => x.name.toLocaleLowerCase() === name.toLocaleLowerCase())){
    toast("Этот никнейм уже есть в списке"); return;
  }
  items.unshift({name,createdAt:Date.now(),status:"local-request"});
  saveYoruFriendRequests(items);
  if(input) input.value = "";
  renderYoruFriends();
  toast("Никнейм сохранён в локальном списке");
}
function removeYoruFriendRequest(index){
  const items = getYoruFriendRequests();
  if(!Number.isInteger(Number(index)) || !items[Number(index)]) return;
  items.splice(Number(index),1);
  saveYoruFriendRequests(items);
  renderYoruFriends();
  toast("Контакт удалён");
}

function openAccount() {
  document.getElementById("settingsOverlay")?.classList.remove("show");
  setActiveNav("navAccount");
  document.getElementById("profileName").value = profileData.name || "";
  showAccountState();
  updateAuthUI();
  updateProfileStats();
  updateProfileCustomizationUI();
  renderYoruFriends();
  document.getElementById("accountOverlay").classList.add("show");
  document.body.style.overflow = "hidden";
}
function closeAccount() {
  document.getElementById("accountOverlay").classList.remove("show");
  document.body.style.overflow = "";
  setActiveNav(currentView === "favorites" ? "navFavorites" : "navHome");
}
function saveProfile() {
  profileData.name = document.getElementById("profileName").value.trim().slice(0, 24);
  localStorage.setItem("yoruProfile", JSON.stringify(profileData));
  localStorage.setItem("yoruProfile", JSON.stringify(profileData));
  localStorage.setItem("yoruLoggedIn", "1");
  updateProfileStats(); updateProfileCustomizationUI(); showAccountState(); updateAuthUI();
  toast("Профиль сохранён в этом браузере");
}
function updateProfileStats() {
  const name = (profileData.name || "Y").trim();
  const av=document.getElementById("accountAvatar"); if(av){av.textContent=profileAsset()?"":(name ? name[0].toUpperCase() : "Y"); av.style.backgroundImage=profileAsset()?`url("${profileAsset().replace(/"/g,"%22")}")`:""; av.style.backgroundSize="cover"; av.style.backgroundPosition="center";}
  document.getElementById("profileFavoritesCount").textContent = favoriteIds.length;
  document.getElementById("profileWatchedCount").textContent = animeList.filter(a => a.status === "watched").length;
  document.getElementById("profileWatchingCount").textContent = animeList.filter(a => a.status === "watching").length;
}
