const DEFAULT_YORU_SETTINGS = {
  accent: "violet",
  glass: true,
  showOriginalTitle: true,
  showStats: true,
  stickyHeader: true,
  reduceMotion: false,
  density: "standard",
  theme: "midnight",
  glassStyle: "liquid",
  cardStyle: "poster",
  posterShape: "tall",
  cardAnimation: "lift",
  cardRadius: "round",
  capsule: "water",
  ambient: true
};
let yoruSettings = { ...DEFAULT_YORU_SETTINGS };
try {
  const storedYoruSettings = JSON.parse(localStorage.getItem("yoruSettings") || "{}");
  if (storedYoruSettings && typeof storedYoruSettings === "object") {
    yoruSettings = { ...DEFAULT_YORU_SETTINGS, ...storedYoruSettings };
  }
} catch (e) {
  yoruSettings = { ...DEFAULT_YORU_SETTINGS };
}

const YORU_ACCENT_PALETTES = {
  violet: { accent: "#a78bfa", secondary: "#e879a9" },
  burgundy: { accent: "#d18bd4", secondary: "#fb7185" },
  ocean: { accent: "#7aa2ff", secondary: "#65e3ff" },
  rose: { accent: "#f09ac8", secondary: "#fb7185" },
  emerald: { accent: "#68dcb2", secondary: "#a78bfa" }
};

function applyYoruSettings() {
  const settings = { ...DEFAULT_YORU_SETTINGS, ...yoruSettings };
  const palette = YORU_ACCENT_PALETTES[settings.accent] || YORU_ACCENT_PALETTES.violet;
  document.documentElement.style.setProperty("--accent", palette.accent);
  document.documentElement.style.setProperty("--accent-2", palette.secondary);
  document.body.classList.toggle("no-glass", !settings.glass);
  document.body.classList.toggle("no-original-title", !settings.showOriginalTitle);
  document.body.classList.toggle("hide-stats", !settings.showStats);
  document.body.classList.toggle("header-static", !settings.stickyHeader);
  document.body.classList.toggle("reduce-motion", !!settings.reduceMotion);
  document.body.classList.toggle("density-roomy", settings.density === "roomy");
  document.body.classList.toggle("density-compact", settings.density === "compact");
  ["midnight", "dusk", "blossom", "abyss"].forEach(name => document.body.classList.toggle(`theme-${name}`, settings.theme === name));
  ["liquid", "soft", "mist"].forEach(name => document.body.classList.toggle(`glass-${name}`, settings.glassStyle === name));
  document.body.classList.toggle("view-glass", settings.cardStyle === "glass");
  document.body.classList.toggle("view-list", settings.cardStyle === "list");
  document.body.classList.toggle("poster-square", settings.posterShape === "square");
  document.body.classList.toggle("poster-wide", settings.posterShape === "wide");
  document.body.classList.toggle("card-motion-glow", settings.cardAnimation === "glow");
  document.body.classList.toggle("card-motion-none", settings.cardAnimation === "none");
  document.body.classList.toggle("radius-soft", settings.cardRadius === "soft");
  document.body.classList.toggle("radius-sharp", settings.cardRadius === "sharp");
  document.body.classList.toggle("capsule-calm", settings.capsule === "calm");
  document.body.classList.toggle("ambient-off", !settings.ambient);

  const values = {
    settingAccent: settings.accent,
    settingGlass: !!settings.glass,
    settingOriginalTitle: !!settings.showOriginalTitle,
    settingStats: !!settings.showStats,
    settingStickyHeader: !!settings.stickyHeader,
    settingReduceMotion: !!settings.reduceMotion,
    settingDensity: ["roomy", "standard", "compact"].includes(settings.density) ? settings.density : "standard",
    settingTheme: ["midnight", "dusk", "blossom", "abyss"].includes(settings.theme) ? settings.theme : "midnight",
    settingGlassStyle: ["liquid", "soft", "mist"].includes(settings.glassStyle) ? settings.glassStyle : "liquid",
    settingCardStyle: ["poster", "glass", "list"].includes(settings.cardStyle) ? settings.cardStyle : "poster",
    settingPosterShape: ["tall", "square", "wide"].includes(settings.posterShape) ? settings.posterShape : "tall",
    settingCardAnimation: ["lift", "glow", "none"].includes(settings.cardAnimation) ? settings.cardAnimation : "lift",
    settingCardRadius: ["round", "soft", "sharp"].includes(settings.cardRadius) ? settings.cardRadius : "round",
    settingCapsule: ["water", "calm"].includes(settings.capsule) ? settings.capsule : "water",
    settingAmbient: !!settings.ambient
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!value;
    else el.value = value;
  });
  const nav = document.getElementById("bottomNav");
  const active = document.querySelector(".bottom-nav button.active");
  if (nav && active) {
    const idx = ["navHome", "navFavorites", "navAccount", "navSettings"].indexOf(active.id);
    if (idx >= 0) {
      nav.style.setProperty("--active-index", idx);
      positionNavIndicator(idx);
    }
  }
}

function updateYoruSetting(key, value) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_YORU_SETTINGS, key)) return;
  yoruSettings[key] = value;
  try { localStorage.setItem("yoruSettings", JSON.stringify(yoruSettings)); } catch (e) {}
  applyYoruSettings();
  if (key === "showOriginalTitle") {
    toast(value ? "Оригинальные названия включены" : "Оригинальные названия скрыты");
  } else if (key === "density") {
    toast(value === "compact" ? "Компактная сетка включена" : value === "roomy" ? "Крупные карточки включены" : "Обычная сетка включена");
  } else if (key === "accent") {
    toast("Акцентный цвет изменён");
  }
}

function setYoruTheme(theme) {
  const names = ["yoru-theme-midnight", "yoru-theme-rose", "yoru-theme-emerald", "yoru-theme-graphite", "yoru-theme-amber", "yoru-theme-crimson"];
  document.body.classList.remove(...names);
  if (theme !== "default") document.body.classList.add("yoru-theme-" + theme);
  try { localStorage.setItem("yoruThemeV1", theme); } catch (e) {}
  toast("Оформление обновлено");
}
(function restoreYoruTheme() {
  try {
    const theme = localStorage.getItem("yoruThemeV1");
    if (theme && theme !== "default") document.body.classList.add("yoru-theme-" + theme);
  } catch (e) {}
})();

function openSettings() {
  document.getElementById("accountOverlay")?.classList.remove("show");
  setActiveNav("navSettings");
  applyYoruSettings();
  syncDockSettings();
  document.getElementById("settingsOverlay")?.classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeSettings() {
  document.getElementById("settingsOverlay")?.classList.remove("show");
  document.body.style.overflow = "";
  setActiveNav(currentView === "favorites" ? "navFavorites" : "navHome");
}

function resetYoruSettings() {
  yoruSettings = { ...DEFAULT_YORU_SETTINGS };
  try { localStorage.setItem("yoruSettings", JSON.stringify(yoruSettings)); } catch (e) {}
  applyYoruSettings();
  toast("Настройки возвращены к исходным");
}

function exportYoruBackup() {
  const payload = {
    app: "YORU", version: 1, exportedAt: new Date().toISOString(),
    favorites: favoriteIds,
    statuses: savedStatuses,
    profile: profileData,
    settings: yoruSettings
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `yoru-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
  toast("Резервная копия создана");
}

async function importYoruBackup(input) {
  const file = input?.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!payload || payload.app !== "YORU" || !payload.version || typeof payload !== "object") {
      throw new Error("Это не резервная копия YORU");
    }
    const safeFavorites = Array.isArray(payload.favorites) ? payload.favorites.filter(x => Number.isFinite(Number(x))).map(Number) : [];
    const safeStatuses = payload.statuses && typeof payload.statuses === "object" && !Array.isArray(payload.statuses) ? payload.statuses : {};
    const safeProfile = payload.profile && typeof payload.profile === "object" ? { name: String(payload.profile.name || "").slice(0, 24) } : { name: "" };
    const safeSettings = payload.settings && typeof payload.settings === "object" ? { ...DEFAULT_YORU_SETTINGS, ...payload.settings } : { ...DEFAULT_YORU_SETTINGS };
    localStorage.setItem("yoruFavorites", JSON.stringify(safeFavorites));
    localStorage.setItem("yoruStatuses", JSON.stringify(safeStatuses));
    localStorage.setItem("yoruProfile", JSON.stringify(safeProfile));
    localStorage.setItem("yoruSettings", JSON.stringify(safeSettings));
    toast("Копия импортирована. Обновляем сайт…");
    setTimeout(() => location.reload(), 500);
  } catch (error) {
    toast("Не удалось импортировать: проверь JSON-файл");
    console.error("YORU backup import error:", error);
  } finally {
    if (input) input.value = "";
  }
}

function clearLocalizationCache() {
  const confirmed = confirm("Очистить сохранённые русские названия и переводы описаний? Сайт сможет запросить их заново при следующей загрузке.");
  if (!confirmed) return;
  try {
    localStorage.removeItem(RU_TITLE_CACHE_KEY);
    localStorage.removeItem(RU_DESCRIPTION_CACHE_KEY);
  } catch (e) {}
  officialRuTitleCache = {};
  descriptionTranslationCache = {};
  toast("Кэш локализации очищен");
  setTimeout(() => location.reload(), 450);
}

function resetYoruData() {
  const confirmed = confirm("Удалить избранное, статусы, профиль и настройки YORU в этом браузере? Это нельзя отменить, если у тебя нет резервной копии.");
  if (!confirmed) return;
  ["yoruFavorites", "yoruStatuses", "yoruProfile", "yoruSettings"].forEach(key => localStorage.removeItem(key));
  toast("Локальные данные удалены");
  setTimeout(() => location.reload(), 450);
}
