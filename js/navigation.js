function dismissNavigationOverlays() {
  document.getElementById("accountOverlay")?.classList.remove("show");
  document.getElementById("settingsOverlay")?.classList.remove("show");
  document.body.style.overflow = "";
}

function setActiveNav(which) {
  const navIds = ["navHome", "navFavorites", "navAccount", "navSettings"];
  navIds.forEach(id => document.getElementById(id)?.classList.remove("active"));
  document.getElementById(which)?.classList.add("active");
  const nav = document.getElementById("bottomNav");
  if (nav) {
    const index = Math.max(0, navIds.indexOf(which));
    nav.style.setProperty("--active-index", index);
    nav.style.removeProperty("--nav-drag-pos");
    positionNavIndicator(index);
  }
}
function showHome() {
  dismissNavigationOverlays();
  document.body.classList.remove("library-view");
  currentView = "home";
  visibleLimit = VISIBLE_STEP;
  setActiveNav("navHome");
  document.getElementById("hero")?.scrollIntoView({ behavior: "smooth", block: "start" });
  render();
}
function showFavorites() {
  dismissNavigationOverlays();
  document.body.classList.add("library-view");
  currentView = "favorites";
  currentFilter = "all";
  visibleLimit = VISIBLE_STEP;
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.filter === "all"));
  setActiveNav("navFavorites");
  document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
  render();
}

function applyDockStyle(){const nav=document.getElementById('bottomNav');if(!nav)return;profileData.dockOrientation='horizontal';nav.classList.add('dock-glass-polish');nav.classList.remove('dock-solid','dock-neon','dock-minimal','dock-compact','dock-shape-pill','dock-shape-soft','dock-shape-square','dock-vertical','dock-labels-hidden');const style=profileData.dockStyle||'glass';if(style!=='glass')nav.classList.add('dock-'+style);nav.classList.add('dock-shape-'+(profileData.dockShape||'pill'));if(profileData.dockLabels==='hide')nav.classList.add('dock-labels-hidden');nav.style.setProperty('--dock-radius',(profileData.dockRadius??30)+'px');nav.style.setProperty('--dock-opacity',String((profileData.dockOpacity??78)/100));nav.style.setProperty('--dock-blur',(profileData.dockBlur??24)+'px');nav.style.setProperty('--dock-width',Math.max(280,Math.min(680,profileData.dockWidth??430))+'px');nav.style.setProperty('--dock-height',Math.max(54,Math.min(112,profileData.dockHeight??66))+'px');nav.style.width='min(var(--dock-width), calc(100vw - 24px))';nav.style.height='';nav.style.minHeight='var(--dock-height)';nav.style.borderRadius='var(--dock-radius)';nav.style.backgroundColor=`rgba(20,15,31,var(--dock-opacity))`;nav.style.backdropFilter=`blur(var(--dock-blur)) saturate(145%)`;nav.style.webkitBackdropFilter=`blur(var(--dock-blur)) saturate(145%)`;nav.querySelectorAll('button').forEach(b=>{b.style.minHeight='calc(var(--dock-height) - 12px)'});}

function updateDockControl(id,key,labelId,suffix){const el=document.getElementById(id);if(!el)return;profileData[key]=Number(el.value);const out=document.getElementById(labelId);if(out)out.textContent=el.value+suffix;applyDockStyle();localStorage.setItem('yoruProfile',JSON.stringify(profileData));}
function applyDockPosition(){const nav=document.getElementById('bottomNav');if(!nav)return;profileData.dockOrientation='horizontal';const p=profileData.dockPosition;if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){const w=nav.offsetWidth,h=nav.offsetHeight,x=Math.max(8,Math.min(innerWidth-w-8,p.x)),y=Math.max(8,Math.min(innerHeight-h-8,p.y));nav.style.left=x+'px';nav.style.top=y+'px';nav.style.bottom='auto';nav.style.transform='none';profileData.dockPosition={x,y}}else{nav.style.left='50%';nav.style.top='';nav.style.bottom='calc(10px + env(safe-area-inset-bottom))';nav.style.transform='translateX(-50%)'}}

function syncDockSettings(){const nav=document.getElementById('bottomNav'),enabled=!!nav?.classList.contains('dock-drag-enabled'),b=document.getElementById('settingsDockModeButton'),h=document.getElementById('settingsDockHint');if(b)b.textContent=enabled?'✓ Завершить кастомизацию':'✦ Включить режим кастомизации';if(h)h.textContent=enabled?'Режим включён: тяни за угол, чтобы изменить размер. Капсула остаётся на месте; свайп с зажатой иконкой переключает разделы.':'Режим выключен. Включи его, чтобы менять размер и оформление капсулы. Сама капсула останется на месте.';const fields={settingsDockStyle:['dockStyle','glass'],settingsDockShape:['dockShape','pill'],settingsDockLabels:['dockLabels','show'],settingsDockWidth:['dockWidth',430],settingsDockHeight:['dockHeight',66],settingsDockOpacity:['dockOpacity',78],settingsDockBlur:['dockBlur',24]};Object.entries(fields).forEach(([id,[key,def]])=>{const el=document.getElementById(id);if(el)el.value=profileData[key]??def});const preset=document.getElementById('settingsDockPreset');if(preset){const chosen=preset.value;preset.innerHTML='<option value=\"\">Мои пресеты</option>'; (profileData.dockPresets||[]).forEach((p,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=p.name;preset.appendChild(o)});if(chosen)preset.value=chosen;}[['settingsDockWidthLabel','dockWidth',' px'],['settingsDockHeightLabel','dockHeight',' px'],['settingsDockOpacityLabel','dockOpacity','%'],['settingsDockBlurLabel','dockBlur',' px']].forEach(([id,key,suf])=>{const el=document.getElementById(id);if(el)el.textContent=(profileData[key]??0)+suf})}
function setDockOption(key,value){if(['dockWidth','dockHeight','dockOpacity','dockBlur'].includes(key))value=Number(value);profileData[key]=value;applyDockStyle();localStorage.setItem('yoruProfile',JSON.stringify(profileData));syncDockSettings()}
function saveDockPreset(){const name=(prompt('Название пресета капсулы:')||'').trim().slice(0,28);if(!name)return;const keys=['dockStyle','dockShape','dockWidth','dockHeight','dockOpacity','dockBlur','dockLabels','dockPosition'];const data={name};keys.forEach(k=>data[k]=profileData[k]??null);profileData.dockPresets=Array.isArray(profileData.dockPresets)?profileData.dockPresets:[];const old=profileData.dockPresets.findIndex(x=>x.name.toLowerCase()===name.toLowerCase());if(old>=0)profileData.dockPresets[old]=data;else profileData.dockPresets.push(data);localStorage.setItem('yoruProfile',JSON.stringify(profileData));syncDockSettings();const sel=document.getElementById('settingsDockPreset');if(sel)sel.value=String(profileData.dockPresets.length-1);toast('Пресет «'+name+'» сохранён');}
function loadDockPreset(){const sel=document.getElementById('settingsDockPreset');const p=profileData.dockPresets?.[Number(sel?.value)];if(!p){toast('Сначала выбери пресет');return}Object.keys(p).forEach(k=>{if(k!=='name')profileData[k]=p[k]});applyDockStyle();applyDockPosition();syncDockSettings();localStorage.setItem('yoruProfile',JSON.stringify(profileData));toast('Пресет «'+p.name+'» применён');}
function toggleDockPlacement(){const nav=document.getElementById('bottomNav');if(!nav)return;const enabled=!nav.classList.contains('dock-drag-enabled');nav.classList.toggle('dock-drag-enabled',enabled);const b=document.getElementById('settingsDockModeButton');if(b)b.textContent=enabled?'✓ Завершить кастомизацию':'✦ Включить режим кастомизации';const old=document.getElementById('dockPlacementButton');if(old)old.textContent=enabled?'✓ Завершить кастомизацию':'✦ Кастомизация капсулы';const hint=document.getElementById('settingsDockHint');if(hint)hint.textContent=enabled?'Режим включён: тяни за угол, чтобы изменить размер. Капсула остаётся на месте. Зажми иконку и проведи к другой, чтобы открыть раздел.':'Режим выключен. Капсула остаётся на месте; включи режим, чтобы менять её оформление и размер.';const ph=document.getElementById('dockPlacementHint');if(ph)ph.textContent=enabled?'Капсула остаётся на месте. Потяни за угол, чтобы изменить размер; зажми иконку и проведи к другой, чтобы переключить раздел.':'Оформление капсулы сохранено.';syncDockSettings();if(enabled)toast('Режим кастомизации включён');else{localStorage.setItem('yoruProfile',JSON.stringify(profileData));toast('Настройки капсулы сохранены')}}
function resetDockPlacement(){profileData.dockPosition=null;localStorage.setItem('yoruProfile',JSON.stringify(profileData));applyDockPosition();toast('Капсула возвращена в исходное положение')}
(function setupDockDrag(){
 const nav=document.getElementById('bottomNav');if(!nav)return;
 let state=null,suppressClick=false,suppressTimer=null;
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const save=()=>{try{localStorage.setItem('yoruProfile',JSON.stringify(profileData))}catch(_){}};
 function clearTarget(){nav.querySelectorAll('.dock-swipe-target').forEach(b=>b.classList.remove('dock-swipe-target'));}
 function begin(e){
  if(e.pointerType==='mouse'&&e.button!==0)return;if(state)return;
  const edit=nav.classList.contains('dock-drag-enabled');
  const resize=!!e.target.closest?.('#dockResizeHandle');
  const btn=e.target.closest?.('#bottomNav button');
  const blank=!btn&&!resize;
  if(resize&&!edit)return;
  if(edit&&!resize&&!blank)return; // nav buttons remain clickable, so Settings can always be reopened
  if(!edit&&!btn)return;
  const r=nav.getBoundingClientRect();
  state={id:e.pointerId,kind:resize?'resize':edit?'position':'swipe',x:e.clientX,y:e.clientY,left:r.left,top:r.top,w:r.width,h:r.height,origin:btn,target:btn,moved:false};
  if(state.kind==='position'||state.kind==='resize'){
   try{nav.setPointerCapture(e.pointerId)}catch(_){}
   if(state.kind==='position'){nav.style.left=r.left+'px';nav.style.top=r.top+'px';nav.style.right='auto';nav.style.bottom='auto';nav.style.transform='none';nav.classList.add('dragging');}
   else nav.classList.add('dock-resize-active');
   e.preventDefault();
  }
 }
 function move(e){
  if(!state||e.pointerId!==state.id)return;
  const dx=e.clientX-state.x,dy=e.clientY-state.y,dist=Math.hypot(dx,dy);
  if(state.kind==='swipe'){
   if(dist<5)return;state.moved=true;
   // No hold timer: the destination is tracked on the very first fast movement.
   const el=document.elementFromPoint(e.clientX,e.clientY);let btn=el?.closest?.('#bottomNav button');if(!btn){const tabs=[...nav.querySelectorAll('button')];btn=tabs.reduce((best,b)=>{const r=b.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,d=Math.hypot(e.clientX-cx,e.clientY-cy);return !best||d<best.d?{b,d}:best},null)?.b;}if(btn&&btn!==state.target){clearTarget();state.target=btn;btn.classList.add('dock-swipe-target');}
   e.preventDefault();return;
  }
  if(state.kind==='position'){
   const maxX=Math.max(8,innerWidth-nav.offsetWidth-8),maxY=Math.max(8,innerHeight-nav.offsetHeight-8);
   const left=clamp(state.left+dx,8,maxX),top=clamp(state.top+dy,8,maxY);
   nav.style.left=left+'px';nav.style.top=top+'px';nav.style.right='auto';nav.style.bottom='auto';nav.style.transform='none';
   profileData.dockPosition={x:left,y:top};state.moved=true;e.preventDefault();return;
  }
  if(state.kind==='resize'){
   profileData.dockWidth=clamp(Math.round((state.w+dx)/4)*4,280,680);
   profileData.dockHeight=clamp(Math.round((state.h+dy)/2)*2,54,112);
   applyDockStyle();syncDockSettings();state.moved=true;e.preventDefault();
  }
 }
 function end(e){
  if(!state||e&&e.pointerId!==state.id)return;
  const done=state;state=null;nav.classList.remove('dock-resize-active','dock-tab-swiping','dragging');clearTarget();
  if(done.kind==='swipe'&&done.moved){
   suppressClick=true;clearTimeout(suppressTimer);suppressTimer=setTimeout(()=>suppressClick=false,350);
   if(done.target&&nav.contains(done.target))done.target.click();
  }
  if(done.kind==='position'&&done.moved){save();applyDockPosition();}
  if(done.kind==='resize'&&done.moved){save();toast('Размер капсулы сохранён');}
 }
 nav.addEventListener('pointerdown',begin);nav.addEventListener('pointermove',move);nav.addEventListener('pointerup',end);nav.addEventListener('pointercancel',end);nav.addEventListener('lostpointercapture',end);
 nav.addEventListener('click',e=>{if(nav.classList.contains('dock-drag-enabled')&&!e.target.closest('#dockResizeHandle')){const b=e.target.closest('button');if(b&&b.id!=='navSettings'){e.preventDefault();e.stopImmediatePropagation();return;}}if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;clearTimeout(suppressTimer);}},true);
 window.addEventListener('resize',()=>{applyDockPosition();});
})();

let yoruNavPhysics = { x: 0, target: 0, velocity: 0, frame: 0, lastTime: 0, initialized: false };
function navCellWidth(nav, indicator) {
  const rect = nav.getBoundingClientRect();
  const width = indicator?.offsetWidth || Math.max(1, (rect.width - 12) / 4);
  return { rect, width, inset: indicator ? (parseFloat(getComputedStyle(indicator).left) || 5) : 5, maxOffset: width * 3 };
}
function animateNavSpring() {
  const nav = document.getElementById("bottomNav");
  const indicator = nav?.querySelector(".nav-indicator");
  if (!nav || !indicator) { yoruNavPhysics.frame = 0; return; }
  const now = performance.now();
  const dt = Math.min(32, Math.max(1, now - (yoruNavPhysics.lastTime || now)));
  yoruNavPhysics.lastTime = now;
  const motionOff = document.body.classList.contains("reduce-motion");
  const delta = yoruNavPhysics.target - yoruNavPhysics.x;
  if (motionOff) {
    yoruNavPhysics.x = yoruNavPhysics.target;
    yoruNavPhysics.velocity = 0;
  } else {
    // A slightly heavier spring provides a visible lag, a little overshoot, then a damped watery settle.
    const acceleration = delta * 0.0009 - yoruNavPhysics.velocity * 0.022;
    yoruNavPhysics.velocity += acceleration * dt;
    yoruNavPhysics.x += yoruNavPhysics.velocity * dt;
    if (Math.abs(delta) < 0.22 && Math.abs(yoruNavPhysics.velocity) < 0.018) {
      yoruNavPhysics.x = yoruNavPhysics.target;
      yoruNavPhysics.velocity = 0;
    }
  }
  const { width, maxOffset } = navCellWidth(nav, indicator);
  const speed = Math.min(1, Math.abs(yoruNavPhysics.velocity) / 2.8);
  const direction = Math.sign(yoruNavPhysics.velocity || delta || 0);
  const endOvershoot = yoruNavPhysics.target < 0
    ? Math.max(-1, yoruNavPhysics.target / 18)
    : yoruNavPhysics.target > maxOffset ? Math.min(1, (yoruNavPhysics.target - maxOffset) / 18) : 0;
  const tail = direction * speed * 12 + endOvershoot * 8;
  indicator.style.setProperty("--nav-offset", `${yoruNavPhysics.x}px`);
  indicator.style.setProperty("--nav-stretch", (1 + speed * 0.19 + Math.abs(endOvershoot) * 0.045).toFixed(3));
  indicator.style.setProperty("--nav-squash", (1 - speed * 0.075).toFixed(3));
  indicator.style.setProperty("--nav-tilt", `${Math.max(-7, Math.min(7, -yoruNavPhysics.velocity * 1.45))}deg`);
  indicator.style.setProperty("--nav-tail", `${tail.toFixed(2)}px`);
  indicator.style.setProperty("--glint-shift", `${Math.max(-28, Math.min(28, yoruNavPhysics.velocity * 10))}%`);
  indicator.style.setProperty("--hotspot-x", `${Math.max(0, Math.min(100, 50 + yoruNavPhysics.velocity * 10))}%`);
  if (Math.abs(yoruNavPhysics.target - yoruNavPhysics.x) > 0.22 || Math.abs(yoruNavPhysics.velocity) > 0.018) {
    yoruNavPhysics.frame = requestAnimationFrame(animateNavSpring);
  } else {
    yoruNavPhysics.frame = 0;
    indicator.style.setProperty("--nav-stretch", "1");
    indicator.style.setProperty("--nav-squash", "1");
    indicator.style.setProperty("--nav-tilt", "0deg");
    indicator.style.setProperty("--nav-tail", "0px");
    indicator.style.setProperty("--nav-origin", "50% 50%");
  }
}
function setNavSpringTarget(x, impulse = 0) {
  yoruNavPhysics.target = Number.isFinite(x) ? x : 0;
  if (impulse) yoruNavPhysics.velocity += impulse;
  if (!yoruNavPhysics.frame) {
    yoruNavPhysics.lastTime = performance.now();
    yoruNavPhysics.frame = requestAnimationFrame(animateNavSpring);
  }
}
function positionNavIndicator(index) {
  const nav = document.getElementById("bottomNav");
  const indicator = nav?.querySelector(".nav-indicator");
  if (!nav || !indicator) return;
  indicator.style.removeProperty("--nav-offset-y");
  const { width } = navCellWidth(nav, indicator);
  const destination = Math.max(0, Math.min(3, index)) * width;
  if (!yoruNavPhysics.initialized || document.body.classList.contains("reduce-motion")) {
    yoruNavPhysics.x = destination; yoruNavPhysics.target = destination; yoruNavPhysics.velocity = 0;
    yoruNavPhysics.initialized = true;
    indicator.style.setProperty("--nav-offset", `${destination}px`);
    indicator.style.setProperty("--nav-stretch", "1");
    indicator.style.setProperty("--nav-squash", "1");
    indicator.style.setProperty("--nav-tilt", "0deg");
    indicator.style.setProperty("--nav-tail", "0px");
    indicator.style.setProperty("--nav-origin", "50% 50%");
    return;
  }
  const delta = destination - yoruNavPhysics.x;
  setNavSpringTarget(destination, Math.sign(delta) * Math.min(0.95, Math.abs(delta) * 0.009));
}

function activateNavIndex(index) {
  const navIds = ["navHome", "navFavorites", "navAccount", "navSettings"];
  const safeIndex = Math.max(0, Math.min(navIds.length - 1, index));
  const accountOverlay = document.getElementById("accountOverlay");
  const settingsOverlay = document.getElementById("settingsOverlay");
  if (accountOverlay?.classList.contains("show")) accountOverlay.classList.remove("show");
  if (settingsOverlay?.classList.contains("show")) settingsOverlay.classList.remove("show");
  document.body.style.overflow = "";
  if (safeIndex === 0) showHome();
  else if (safeIndex === 1) showFavorites();
  else if (safeIndex === 2) openAccount();
  else openSettings();
}

function initBottomNavDragging() {
  const nav = document.getElementById("bottomNav");
  if (!nav) return;
  let startX = null, isDragging = false, suppressClick = false, dragPointerId = null;
  let lastPointerX = 0, lastMoveAt = 0, grabOrigin = 50, releaseTimer = 0;
  const indicator = nav.querySelector(".nav-indicator");
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const releasePulse = () => {
    nav.classList.remove("liquid-release");
    void nav.offsetWidth;
    nav.classList.add("liquid-release");
    clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(() => nav.classList.remove("liquid-release"), 520);
  };

  nav.addEventListener("pointerdown", event => {
    if ((event.button !== undefined && event.button !== 0) || event.isPrimary === false) return;
    startX = event.clientX;
    lastPointerX = event.clientX;
    lastMoveAt = performance.now();
    isDragging = false;
    dragPointerId = event.pointerId;
    const indicatorRect = indicator?.getBoundingClientRect();
    if (indicatorRect && indicatorRect.width > 0) {
      const grabbedAt = (event.clientX - indicatorRect.left) / indicatorRect.width;
      // When starting outside the current lens, preserve the nearest side as the grab point.
      grabOrigin = clamp(grabbedAt, 0, 1) * 100;
      if (grabbedAt < 0) grabOrigin = 8;
      if (grabbedAt > 1) grabOrigin = 92;
    }
    indicator?.style.setProperty("--nav-origin", `${grabOrigin.toFixed(1)}% 50%`);
  });

  document.addEventListener("pointermove", event => {
    if (startX === null || (dragPointerId !== null && event.pointerId !== dragPointerId)) return;
    const dxFromStart = event.clientX - startX;
    if (Math.abs(dxFromStart) > 5) {
      isDragging = true;
      nav.classList.add("dragging");
      const { rect, width, inset, maxOffset } = navCellWidth(nav, indicator);
      // Align the middle of the liquid pill to the pointer. A small rubber-band extension is allowed at each end.
      const rawOffset = event.clientX - rect.left - inset - width * 0.5;
      let targetX = rawOffset;
      if (rawOffset < 0) targetX = -Math.min(18, Math.abs(rawOffset) * 0.22);
      else if (rawOffset > maxOffset) targetX = maxOffset + Math.min(18, (rawOffset - maxOffset) * 0.22);
      const now = performance.now();
      const stepX = event.clientX - lastPointerX;
      const stepMs = Math.max(8, now - lastMoveAt);
      const pointerSpeed = stepX / stepMs;
      setNavSpringTarget(targetX, clamp(pointerSpeed * 0.045, -0.10, 0.10));
      const lensX = rect.left + inset + yoruNavPhysics.x;
      indicator?.style.setProperty("--hotspot-x", `${clamp(((event.clientX - lensX) / width) * 100, 0, 100)}%`);
      indicator?.style.setProperty("--nav-origin", `${grabOrigin.toFixed(1)}% 50%`);
      lastPointerX = event.clientX;
      lastMoveAt = now;
    }
  }, { passive: true });

  document.addEventListener("pointerup", event => {
    if (startX === null || (dragPointerId !== null && event.pointerId !== dragPointerId)) return;
    const dx = event.clientX - startX;
    const { rect, width, inset } = navCellWidth(nav, indicator);
    const rawIndex = (event.clientX - rect.left - inset - width * 0.5) / width;
    let didNavigate = false;
    if (isDragging && Math.abs(dx) > 16) {
      const snapped = Math.round(clamp(rawIndex, 0, 3));
      activateNavIndex(snapped);
      setNavSpringTarget(snapped * width, Math.sign(dx) * 0.62);
      didNavigate = true;
      suppressClick = true;
      window.setTimeout(() => { suppressClick = false; }, 450);
    }
    startX = null;
    dragPointerId = null;
    isDragging = false;
    nav.classList.remove("dragging");
    indicator?.style.setProperty("--nav-origin", "50% 50%");
    indicator?.style.setProperty("--nav-tail", `${Math.sign(dx) * Math.min(11, Math.abs(dx) * 0.035)}px`);
    releasePulse();
    if (!didNavigate) {
      const active = nav.querySelector("button.active");
      const idx = ["navHome", "navFavorites", "navAccount", "navSettings"].indexOf(active?.id);
      if (idx >= 0) positionNavIndicator(idx);
    } else {
      const active = nav.querySelector("button.active");
      const idx = ["navHome", "navFavorites", "navAccount", "navSettings"].indexOf(active?.id);
      if (idx >= 0) setNavSpringTarget(idx * width, Math.sign(dx) * 0.42);
    }
  });

  document.addEventListener("pointercancel", () => {
    startX = null;
    dragPointerId = null;
    isDragging = false;
    nav.classList.remove("dragging");
    indicator?.style.setProperty("--nav-origin", "50% 50%");
    releasePulse();
    const active = nav.querySelector("button.active");
    const idx = ["navHome", "navFavorites", "navAccount", "navSettings"].indexOf(active?.id);
    if (idx >= 0) positionNavIndicator(idx);
  });

  window.addEventListener("resize", () => {
    const active = nav.querySelector("button.active");
    const idx = ["navHome", "navFavorites", "navAccount", "navSettings"].indexOf(active?.id);
    if (idx >= 0) {
      const { width } = navCellWidth(nav, indicator);
      yoruNavPhysics.x = idx * width;
      yoruNavPhysics.target = idx * width;
      yoruNavPhysics.velocity = 0;
      indicator?.style.setProperty("--nav-offset", `${idx * width}px`);
      indicator?.style.setProperty("--nav-origin", "50% 50%");
    }
  });

  nav.addEventListener("click", event => {
    if (!suppressClick) return;
    event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false;
  }, true);
}

// Desktop pointer lighting adds a subtle moving reflection to the liquid capsule.
(() => {
  const nav = document.getElementById("bottomNav");
  const indicator = nav?.querySelector(".nav-indicator");
  if (!nav || !indicator) return;
  nav.addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse" || nav.classList.contains("dragging")) return;
    const rect = indicator.getBoundingClientRect();
    if (rect.width <= 0) return;
    const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    indicator.style.setProperty("--hotspot-x", `${percent}%`);
  }, { passive: true });
  nav.addEventListener("pointerleave", () => indicator.style.setProperty("--hotspot-x", "45%"), { passive: true });
})();

// ColorOS-inspired Flexible Feedback: brief compression on touch, then a damped rebound.
(function initFlexibleFeedback() {
  const selector = 'button:not(:disabled), .card, .tab, .period-button, .settings-section, .setting-row';
  let active = null;
  let activePointer = null;
  let cleanupTimer = 0;
  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.target?.closest?.(selector);
    if (!target || target.closest('.bottom-nav') && target.classList.contains('bottom-nav')) return;
    if (active && active !== target) active.classList.remove('yoru-pressed');
    active = target;
    activePointer = event.pointerId;
    clearTimeout(cleanupTimer);
    active.classList.remove('yoru-rebound');
    active.classList.add('yoru-pressed');
  }, { passive: true, capture: true });
  const release = event => {
    if (!active || (activePointer !== null && event?.pointerId !== undefined && event.pointerId !== activePointer)) return;
    const target = active;
    active = null;
    activePointer = null;
    target.classList.remove('yoru-pressed');
    if (!document.body.classList.contains('reduce-motion')) {
      // Trigger the same small rebound even if the DOM is retained after a click.
      void target.offsetWidth;
      target.classList.add('yoru-rebound');
      cleanupTimer = setTimeout(() => target.classList.remove('yoru-rebound'), 480);
    }
  };
  document.addEventListener('pointerup', release, { passive: true, capture: true });
  document.addEventListener('pointercancel', release, { passive: true, capture: true });
  document.addEventListener('click', event => {
    const target = event.target?.closest?.(selector);
    if (!target) return;
    target.classList.remove('yoru-pressed');
  }, true);
})();
