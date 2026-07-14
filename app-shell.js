/* ============================================================
   Inventory ERP — Login, Shell (sidebar/topbar/mobile nav),
   Router, and App Bootstrap
   ============================================================ */

function renderLogin() {
  const loginRoot = document.getElementById("loginScreen");
  document.getElementById("shell").classList.add("hidden");
  loginRoot.classList.remove("hidden");
  loginRoot.innerHTML = `
    <div class="login-shell">
      <div class="login-card">
        <div class="flex items-center gap-2 mb-1">
          <div class="h-9 w-9 rounded-lg bg-erp-accent flex items-center justify-center font-bold text-white">IE</div>
          <span class="font-semibold text-lg">${escapeAttr(SETTINGS.dashboardTitle)}</span>
        </div>
        <p class="text-sm text-erp-muted mb-5">${t("login.subtitle")}</p>
        <div id="loginError"></div>
        <form id="loginForm" class="space-y-3">
          <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("login.email")}</span><input id="loginEmail" type="email" class="field-input" value="Admin@namq.com" required /></label>
          <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("login.password")}</span><input id="loginPassword" type="password" class="field-input" required /></label>
          <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">${t("login.signIn")}</button>
        </form>
        <p class="text-[11px] text-erp-muted mt-4">${t("login.demoHint")}</p>
        <div class="flex justify-center gap-2 mt-4">
          <button id="loginLangEn" class="btn" style="padding:.25rem .6rem;font-size:.7rem">EN</button>
          <button id="loginLangAr" class="btn" style="padding:.25rem .6rem;font-size:.7rem">AR</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const user = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
      document.getElementById("loginError").innerHTML = `<div class="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 mb-3">${t("login.invalid")}</div>`;
      return;
    }
    CURRENT_USER = user;
    saveCurrentUser(user);
    boot();
  });
  document.getElementById("loginLangEn").addEventListener("click", () => {
    SETTINGS.locale = "en";
    saveSettingsToStorage(SETTINGS);
    applyLocaleDirection();
    renderLogin();
  });
  document.getElementById("loginLangAr").addEventListener("click", () => {
    SETTINGS.locale = "ar";
    saveSettingsToStorage(SETTINGS);
    applyLocaleDirection();
    renderLogin();
  });
  if (window.lucide) lucide.createIcons();
}

function logout() {
  CURRENT_USER = null;
  saveCurrentUser(null);
  location.hash = "";
  boot();
}

function switchLocale(locale) {
  SETTINGS.locale = locale;
  saveSettingsToStorage(SETTINGS);
  applyLocaleDirection();
  render();
}

/* ---------- Shell ---------- */

function isActiveRoute(route, seg) {
  return route.parts[0] === seg;
}
function isActiveCategory(route, slug) {
  return route.parts[0] === "categories" && route.parts[1] === slug;
}

function renderSidebarHTML(route) {
  return `
    <div class="flex items-center gap-2 px-5 h-16 border-b border-white/10">
      <div class="h-8 w-8 rounded-lg bg-erp-accent flex items-center justify-center font-bold text-sm">IE</div>
      <span class="font-semibold tracking-tight">${escapeAttr(SETTINGS.dashboardTitle)}</span>
    </div>
    <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      <a href="#/dashboard" class="nav-link ${isActiveRoute(route, "dashboard") ? "active" : ""}"><i data-lucide="layout-dashboard" style="width:17px;height:17px"></i><span class="truncate">${t("nav.dashboard")}</span></a>
      <a href="#/inventory" class="nav-link ${isActiveRoute(route, "inventory") ? "active" : ""}"><i data-lucide="table-2" style="width:17px;height:17px"></i><span class="truncate">${t("nav.inventory")}</span></a>
      <div class="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-blue-200/70 mt-3">${t("nav.categories")}</div>
      ${CATEGORY_LINKS.map((c) => `<a href="#/categories/${c.slug}" class="nav-link ${isActiveCategory(route, c.slug) ? "active" : ""}"><i data-lucide="${c.icon}" style="width:17px;height:17px"></i><span class="truncate">${t("nav." + c.slug)}</span></a>`).join("")}
      <div class="pt-3 space-y-1">
        <a href="#/suppliers" class="nav-link ${isActiveRoute(route, "suppliers") ? "active" : ""}"><i data-lucide="truck" style="width:17px;height:17px"></i><span class="truncate">${t("nav.suppliers")}</span></a>
        <a href="#/brands" class="nav-link ${isActiveRoute(route, "brands") ? "active" : ""}"><i data-lucide="tags" style="width:17px;height:17px"></i><span class="truncate">${t("nav.brands")}</span></a>
        <a href="#/analytics" class="nav-link ${isActiveRoute(route, "analytics") ? "active" : ""}"><i data-lucide="bar-chart-3" style="width:17px;height:17px"></i><span class="truncate">${t("nav.analytics")}</span></a>
        <a href="#/purchase-planning" class="nav-link ${isActiveRoute(route, "purchase-planning") ? "active" : ""}"><i data-lucide="shopping-cart" style="width:17px;height:17px"></i><span class="truncate">${t("nav.purchase-planning")}</span></a>
        <a href="#/alerts" class="nav-link ${isActiveRoute(route, "alerts") ? "active" : ""}"><i data-lucide="bell" style="width:17px;height:17px"></i><span class="truncate">${t("nav.alerts")}</span></a>
      </div>
    </nav>
    <div class="px-3 py-4 border-t border-white/10">
      <a href="#/settings" class="nav-link ${isActiveRoute(route, "settings") ? "active" : ""}"><i data-lucide="settings" style="width:17px;height:17px"></i><span class="truncate">${t("nav.settings")}</span></a>
    </div>
  `;
}

function renderTopbarHTML() {
  const criticalCount = DATA.alerts.filter((a) => a.severity === "critical").length;
  const cartCount = ORDER_CART.length;
  return `
    <span class="font-semibold">${escapeAttr(SETTINGS.dashboardTitle)}</span>
    <div class="flex-1" style="max-width:30rem">
      <div class="relative">
        <i data-lucide="search" style="width:16px;height:16px" class="absolute left-3 top-1/2 -translate-y-1/2 text-blue-200"></i>
        <input id="topSearch" placeholder="${t("topbar.search")}" class="w-full rounded-lg bg-white/10 border border-white/10 py-2 text-sm text-white placeholder:text-blue-200/60 focus:outline-none focus:ring-2 focus:ring-erp-accent" style="padding-left:2.25rem;padding-right:0.75rem" />
      </div>
    </div>
    <div class="flex items-center gap-2" style="margin-left:auto">
      <div class="hidden md:flex items-center bg-white/10 border border-white/10 rounded-lg text-xs overflow-hidden">
        <button id="langEn" class="px-2 py-2 ${SETTINGS.locale === "en" ? "bg-white/20" : ""}">EN</button>
        <button id="langAr" class="px-2 py-2 ${SETTINGS.locale === "ar" ? "bg-white/20" : ""}">AR</button>
      </div>
      <select id="intervalSelect" class="hidden md:block bg-white/10 border border-white/10 rounded-lg text-xs px-2 py-2 text-white">
        <option value="0">${t("topbar.manual")}</option>
        <option value="30">${t("topbar.30s")}</option>
        <option value="60">${t("topbar.1m")}</option>
        <option value="300">${t("topbar.5m")}</option>
      </select>
      <button id="refreshBtn" title="Refresh now" class="p-2 rounded-lg hover:bg-white/10"><i id="refreshIcon" data-lucide="refresh-cw" style="width:17px;height:17px"></i></button>
      <button id="themeBtn" title="Toggle theme" class="p-2 rounded-lg hover:bg-white/10"><i data-lucide="${THEME === "light" ? "moon" : "sun"}" style="width:17px;height:17px"></i></button>
      <a href="#/purchase-planning" class="relative p-2 rounded-lg hover:bg-white/10" title="${t("topbar.myOrderList")}">
        <i data-lucide="shopping-cart" style="width:17px;height:17px"></i>
        ${cartCount > 0 ? `<span class="absolute -top-0.5 -right-0.5 bg-erp-accent text-[10px] leading-none rounded-full px-1.5 py-1 font-bold">${cartCount}</span>` : ""}
      </a>
      <div class="relative p-2 rounded-lg hover:bg-white/10 cursor-pointer" title="Alerts">
        <i data-lucide="bell" style="width:17px;height:17px"></i>
        ${criticalCount > 0 ? `<span class="absolute -top-0.5 -right-0.5 bg-erp-critical text-[10px] leading-none rounded-full px-1.5 py-1 font-bold">${criticalCount}</span>` : ""}
      </div>
      <div class="relative group">
        <button id="userBtn" class="flex items-center gap-1 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-xs">${escapeAttr(CURRENT_USER.name || CURRENT_USER.email)} <i data-lucide="chevron-down" style="width:14px;height:14px"></i></button>
        <div class="absolute right-0 mt-1 hidden group-hover:block bg-white text-slate-800 rounded-lg shadow-cardHover border border-erp-border py-1 z-40" style="width:12rem">
          <div class="px-3 py-2 text-xs text-erp-muted border-b border-erp-border">${t("role." + CURRENT_USER.role)}</div>
          <button id="logoutBtn" class="w-full text-left px-3 py-2 text-sm hover:bg-erp-bg">${t("topbar.logout")}</button>
        </div>
      </div>
    </div>
  `;
}

function renderMobileNavHTML(route) {
  const items = [
    { href: "#/dashboard", icon: "layout-dashboard", label: t("nav.dashboard"), seg: "dashboard" },
    { href: "#/inventory", icon: "table-2", label: t("nav.inventory"), seg: "inventory" },
    { href: "#/analytics", icon: "bar-chart-3", label: t("nav.analytics"), seg: "analytics" },
    { href: "#/purchase-planning", icon: "shopping-cart", label: t("nav.purchase-planning"), seg: "purchase-planning" },
    { href: "#/settings", icon: "settings", label: t("nav.settings"), seg: "settings" },
  ];
  return items
    .map(
      (it) =>
        `<a href="${it.href}" style="font-size:10px" class="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg ${route.parts[0] === it.seg ? "text-white" : "text-blue-200/70"}"><i data-lucide="${it.icon}" style="width:18px;height:18px"></i>${it.label}</a>`
    )
    .join("");
}

function manualRefresh() {
  const icon = document.getElementById("refreshIcon");
  if (icon) icon.style.animation = "spin 0.6s linear";
  DATA = buildAppData(Math.floor(Math.random() * 1000000));
  render();
}
function resetAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  if (SETTINGS.refreshIntervalSeconds > 0) autoRefreshTimer = setInterval(manualRefresh, SETTINGS.refreshIntervalSeconds * 1000);
}

function wireShellEvents(route) {
  const intervalSelect = document.getElementById("intervalSelect");
  intervalSelect.value = String(SETTINGS.refreshIntervalSeconds);
  intervalSelect.addEventListener("change", (e) => {
    SETTINGS.refreshIntervalSeconds = Number(e.target.value);
    saveSettingsToStorage(SETTINGS);
    resetAutoRefresh();
  });
  document.getElementById("refreshBtn").addEventListener("click", manualRefresh);
  document.getElementById("themeBtn").addEventListener("click", () => {
    setTheme(THEME === "light" ? "dark" : "light");
    renderShell(route);
  });
  document.getElementById("langEn").addEventListener("click", () => switchLocale("en"));
  document.getElementById("langAr").addEventListener("click", () => switchLocale("ar"));
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("topSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") location.hash = "#/inventory?q=" + encodeURIComponent(e.target.value);
  });
}

function renderShell(route) {
  document.getElementById("sidebar").innerHTML = renderSidebarHTML(route);
  document.getElementById("topbar").innerHTML = renderTopbarHTML(route);
  document.getElementById("mobileNav").innerHTML = renderMobileNavHTML(route);
  wireShellEvents(route);
}

/* ---------- Router ---------- */

function parseHash() {
  let hash = location.hash.replace(/^#\/?/, "");
  const [path, queryStr] = hash.split("?");
  const parts = path.split("/").filter(Boolean);
  const query = new URLSearchParams(queryStr || "");
  return { parts, query };
}

function render() {
  if (!CURRENT_USER) {
    renderLogin();
    return;
  }
  const route = parseHash();
  renderShell(route);
  const [seg, param] = route.parts;

  if (!seg || seg === "dashboard") renderDashboard();
  else if (seg === "inventory" && param) renderProductDetail(decodeURIComponent(param));
  else if (seg === "inventory") renderInventory(route.query.get("q") || "", route.query.get("status") || "All", route.query.get("category") || "All", route.query.get("supplier") || "All");
  else if (seg === "categories" && param) renderCategory(param);
  else if (seg === "suppliers") renderSuppliers();
  else if (seg === "brands" && param) renderBrandDetail(decodeURIComponent(param));
  else if (seg === "brands") renderBrands();
  else if (seg === "analytics") renderAnalytics();
  else if (seg === "purchase-planning") renderPurchasePlanning();
  else if (seg === "alerts") renderAlerts();
  else if (seg === "settings") renderSettings();
  else {
    location.hash = "#/dashboard";
    return;
  }

  if (window.lucide) lucide.createIcons();
  window.scrollTo(0, 0);
}

/* ---------- Bootstrap ---------- */

function boot() {
  applyAppearance();
  applyLocaleDirection();
  applyTheme(THEME);

  if (!CURRENT_USER) {
    document.getElementById("shell").classList.add("hidden");
    renderLogin();
    return;
  }

  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("loginScreen").innerHTML = "";
  document.getElementById("shell").classList.remove("hidden");
  resetAutoRefresh();
  if (!location.hash || location.hash === "#") location.hash = "#/dashboard";
  else render();
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", boot);
