setupYoruInstantSearch();
applyYoruSettings();
initBottomNavDragging();
bootCatalog();
setTimeout(()=>yoruRankTab("popularRecent"),900);

document.addEventListener("DOMContentLoaded",()=>{updateAuthUI();showAccountState()});
// Keep page content (search, rankings and dock) out of the foreground while a dialog is open.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const settings = document.getElementById("settingsOverlay");
  const account = document.getElementById("accountOverlay");
  const anime = document.getElementById("overlay");
  const community = document.getElementById("communityOverlay");
  if (settings?.classList.contains("show")) closeSettings();
  else if (account?.classList.contains("show")) closeAccount();
  else if (anime?.classList.contains("show")) closeModal();
  else if (community?.classList.contains("show")) closeCommunity();
});
