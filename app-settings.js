/* ============================================================
   Inventory ERP — Settings (data source, branding, appearance,
   language, dashboard sections, user management)
   ============================================================ */

function renderUsersRows() {
  return USERS.map(
    (u) =>
      `<tr><td>${u.name || "-"}</td><td>${u.email}</td><td>${t("role." + u.role)}</td><td><button class="deleteUserBtn text-xs text-red-600 hover:underline" data-email="${escapeAttr(u.email)}">${t("settings.delete")}</button></td></tr>`
  ).join("");
}
function renderUsersSection() {
  return `
    <div class="card p-5 space-y-4">
      <h3 class="text-sm font-semibold">${t("settings.users")}</h3>
      <div class="overflow-x-auto">
        <table class="erp-table">
          <thead><tr><th>${t("settings.name")}</th><th>${t("settings.email")}</th><th>${t("settings.role")}</th><th>${t("settings.actions")}</th></tr></thead>
          <tbody id="usersTableBody">${renderUsersRows()}</tbody>
        </table>
      </div>
      <div id="userMsg"></div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("settings.name")}</span><input id="newUserName" class="field-input" /></label>
        <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("settings.email")}</span><input id="newUserEmail" type="email" class="field-input" /></label>
        <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("settings.password")}</span><input id="newUserPassword" type="text" class="field-input" /></label>
        <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("settings.role")}</span>
          <select id="newUserRole" class="field-input">${ROLES.map((r) => `<option value="${r}">${t("role." + r)}</option>`).join("")}</select>
        </label>
      </div>
      <button id="addUserBtn" class="btn btn-primary"><i data-lucide="user-plus" style="width:15px;height:15px"></i> ${t("settings.addUser")}</button>
    </div>
  `;
}
function wireDeleteButtons() {
  document.querySelectorAll(".deleteUserBtn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const email = btn.dataset.email;
      if (email.toLowerCase() === CURRENT_USER.email.toLowerCase()) {
        document.getElementById("userMsg").innerHTML = `<div class="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">${t("settings.cannotDeleteSelf")}</div>`;
        return;
      }
      USERS = USERS.filter((u) => u.email !== email);
      saveUsers();
      document.getElementById("usersTableBody").innerHTML = renderUsersRows();
      wireDeleteButtons();
    })
  );
}
function wireUsersSection() {
  document.getElementById("addUserBtn").addEventListener("click", () => {
    const name = document.getElementById("newUserName").value.trim();
    const email = document.getElementById("newUserEmail").value.trim();
    const password = document.getElementById("newUserPassword").value;
    const role = document.getElementById("newUserRole").value;
    const msgEl = document.getElementById("userMsg");
    if (!email || !password) return;
    if (USERS.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      msgEl.innerHTML = `<div class="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">${t("settings.userExists")}</div>`;
      return;
    }
    USERS.push({ name, email, password, role });
    saveUsers();
    document.getElementById("usersTableBody").innerHTML = renderUsersRows();
    wireDeleteButtons();
    msgEl.innerHTML = `<div class="text-sm bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2">${t("settings.userAdded")}</div>`;
    document.getElementById("newUserName").value = "";
    document.getElementById("newUserEmail").value = "";
    document.getElementById("newUserPassword").value = "";
  });
  wireDeleteButtons();
}

function renderSettings() {
  const app = document.getElementById("app");
  const isAdmin = ROLE_PERMISSIONS[CURRENT_USER.role].canEditSettings;
  const s = SETTINGS;
  const sec = s.dashboardSections;

  app.innerHTML = `
    <div class="space-y-6" style="max-width:52rem">
      <div><h1 class="text-xl font-bold">${t("settings.title")}</h1><p class="text-sm text-erp-muted">${t("settings.subtitle")}</p></div>
      ${!isAdmin ? `<div class="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">${t("settings.adminOnly")} <strong>${t("role." + CURRENT_USER.role)}</strong>. ${t("settings.adminOnlyEnd")}</div>` : ""}

      <div class="card p-5 space-y-4">
        <h3 class="text-sm font-semibold">${t("settings.dataSource")}</h3>
        <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.dataSourceMode")}</span>
          <select id="setDataSource" class="field-input" ${!isAdmin ? "disabled" : ""}>
            <option value="sample" ${s.dataSource === "sample" ? "selected" : ""}>${t("settings.sampleData")}</option>
            <option value="live" ${s.dataSource === "live" ? "selected" : ""}>${t("settings.liveSharepoint")}</option>
          </select>
        </label>
        <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.sharepointUrl")}</span>
          <input id="setUrl" class="field-input" value="${escapeAttr(s.sharePointUrl)}" ${!isAdmin ? "disabled" : ""} />
        </label>
        <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.worksheetName")}</span>
          <input id="setSheet" class="field-input" value="${escapeAttr(s.worksheetName)}" ${!isAdmin ? "disabled" : ""} />
        </label>
        <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.refreshInterval")}</span>
          <select id="setInterval" class="field-input" ${!isAdmin ? "disabled" : ""}>
            <option value="0" ${s.refreshIntervalSeconds === 0 ? "selected" : ""}>${t("topbar.manual")}</option>
            <option value="30" ${s.refreshIntervalSeconds === 30 ? "selected" : ""}>${t("topbar.30s")}</option>
            <option value="60" ${s.refreshIntervalSeconds === 60 ? "selected" : ""}>${t("topbar.1m")}</option>
            <option value="300" ${s.refreshIntervalSeconds === 300 ? "selected" : ""}>${t("topbar.5m")}</option>
          </select>
        </label>
      </div>

      <div class="card p-5 space-y-4">
        <h3 class="text-sm font-semibold">${t("settings.branding")}</h3>
        <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.dashboardTitle")}</span><input id="setTitle" class="field-input" value="${escapeAttr(s.dashboardTitle)}" ${!isAdmin ? "disabled" : ""} /></label>
        <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.companyLogo")}</span><input id="setLogo" class="field-input" value="${escapeAttr(s.companyLogo)}" ${!isAdmin ? "disabled" : ""} /></label>
      </div>

      <div class="card p-5 space-y-4">
        <h3 class="text-sm font-semibold">${t("settings.appearance")}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.theme")}</span>
            <select id="setTheme" class="field-input" ${!isAdmin ? "disabled" : ""}>
              <option value="light" ${THEME === "light" ? "selected" : ""}>${t("settings.light")}</option>
              <option value="dark" ${THEME === "dark" ? "selected" : ""}>${t("settings.dark")}</option>
            </select>
          </label>
          <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.language")}</span>
            <select id="setLocale" class="field-input" ${!isAdmin ? "disabled" : ""}>
              <option value="en" ${s.locale === "en" ? "selected" : ""}>English</option>
              <option value="ar" ${s.locale === "ar" ? "selected" : ""}>العربية</option>
            </select>
          </label>
          <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.primaryColor")}</span>
            <input id="setPrimaryColor" type="color" class="swatch" value="${s.primaryColor}" ${!isAdmin ? "disabled" : ""} />
          </label>
          <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.headerColor")}</span>
            <input id="setHeaderColor" type="color" class="swatch" value="${s.headerColor}" ${!isAdmin ? "disabled" : ""} />
          </label>
          <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.fontColor")}</span>
            <input id="setFontColor" type="color" class="swatch" value="${s.fontColor}" ${!isAdmin ? "disabled" : ""} />
          </label>
        </div>
      </div>

      <div class="card p-5 space-y-3">
        <h3 class="text-sm font-semibold">${t("settings.sections")}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <label class="flex items-center gap-2"><input type="checkbox" id="secKpis" ${sec.kpis ? "checked" : ""} ${!isAdmin ? "disabled" : ""} /> ${t("settings.sec.kpis")}</label>
          <label class="flex items-center gap-2"><input type="checkbox" id="secHealth" ${sec.health ? "checked" : ""} ${!isAdmin ? "disabled" : ""} /> ${t("settings.sec.health")}</label>
          <label class="flex items-center gap-2"><input type="checkbox" id="secCategoryChart" ${sec.categoryChart ? "checked" : ""} ${!isAdmin ? "disabled" : ""} /> ${t("settings.sec.categoryChart")}</label>
          <label class="flex items-center gap-2"><input type="checkbox" id="secStatusChart" ${sec.statusChart ? "checked" : ""} ${!isAdmin ? "disabled" : ""} /> ${t("settings.sec.statusChart")}</label>
          <label class="flex items-center gap-2"><input type="checkbox" id="secAlerts" ${sec.alerts ? "checked" : ""} ${!isAdmin ? "disabled" : ""} /> ${t("settings.sec.alerts")}</label>
        </div>
      </div>

      ${
        isAdmin
          ? `<div class="flex flex-wrap gap-2">
        <button id="setSave" class="btn btn-primary"><i data-lucide="save" style="width:15px;height:15px"></i> ${t("settings.save")}</button>
        <button id="setReload" class="btn"><i data-lucide="refresh-cw" style="width:15px;height:15px"></i> ${t("settings.reloadData")}</button>
        <button id="setTest" class="btn"><i data-lucide="plug-zap" style="width:15px;height:15px"></i> ${t("settings.testConnection")}</button>
      </div>`
          : ""
      }
      <div id="setMsg"></div>
      <p class="text-xs text-erp-muted">${t("settings.staticNote")}</p>

      ${isAdmin ? renderUsersSection() : ""}
    </div>
  `;

  if (isAdmin) {
    document.getElementById("setSave").addEventListener("click", () => {
      SETTINGS = {
        ...SETTINGS,
        dataSource: document.getElementById("setDataSource").value,
        sharePointUrl: document.getElementById("setUrl").value,
        worksheetName: document.getElementById("setSheet").value,
        refreshIntervalSeconds: Number(document.getElementById("setInterval").value),
        dashboardTitle: document.getElementById("setTitle").value,
        companyLogo: document.getElementById("setLogo").value,
        locale: document.getElementById("setLocale").value,
        primaryColor: document.getElementById("setPrimaryColor").value,
        headerColor: document.getElementById("setHeaderColor").value,
        fontColor: document.getElementById("setFontColor").value,
        dashboardSections: {
          kpis: document.getElementById("secKpis").checked,
          health: document.getElementById("secHealth").checked,
          categoryChart: document.getElementById("secCategoryChart").checked,
          statusChart: document.getElementById("secStatusChart").checked,
          alerts: document.getElementById("secAlerts").checked,
        },
      };
      saveSettingsToStorage(SETTINGS);
      const newTheme = document.getElementById("setTheme").value;
      if (newTheme !== THEME) setTheme(newTheme);
      applyAppearance();
      applyLocaleDirection();
      resetAutoRefresh();
      renderShell(parseHash());
      renderSettings();
      const msgEl = document.getElementById("setMsg");
      if (msgEl) msgEl.innerHTML = `<div class="text-sm bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2">${t("settings.savedMsg")}</div>`;
    });
    document.getElementById("setReload").addEventListener("click", manualRefresh);
    document.getElementById("setTest").addEventListener("click", () => {
      document.getElementById("setMsg").innerHTML = `<div class="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">${t("settings.testMsg")}</div>`;
    });
    wireUsersSection();
  }

  if (window.lucide) lucide.createIcons();
}
