/* ============================================================
   Inventory ERP — Settings (data source, branding, appearance,
   language, dashboard sections, user management)
   ============================================================ */

function renderUsersRows() {
  return USERS.map(
    (u) => `
    <tr>
      <td>${escapeHtml(u.name || "-")}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${t("role." + u.role)}</td>
      <td style="white-space:nowrap">
        <button class="editUserBtn text-xs text-erp-accent hover:underline" data-email="${escapeAttr(u.email)}">${t("settings.edit")}</button>
        &middot;
        <button class="deleteUserBtn text-xs text-red-600 hover:underline" data-email="${escapeAttr(u.email)}">${t("settings.delete")}</button>
      </td>
    </tr>`
  ).join("");
}

function renderUsersSection(storeStatus) {
  const status = storeStatus || { configured: false, connected: false };
  const badgeClass = status.connected
    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
    : status.configured
    ? "bg-red-50 text-red-700 border border-red-200"
    : "bg-amber-50 text-amber-700 border border-amber-200";
  const badgeLabel = status.connected ? t("settings.accountsShared") : status.configured ? t("settings.accountsConfiguredError") : t("settings.accountsLocalOnly");
  return `
    <div class="card p-5 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <h3 class="text-sm font-semibold">${t("settings.users")}</h3>
        <span class="text-[11px] font-medium px-2 py-1 rounded-full ${badgeClass}">${badgeLabel}</span>
      </div>
      <p class="text-[11px] text-erp-muted">${t("settings.sharedAccountsIntro")}</p>
      ${status.configured && !status.connected ? msgBox(t("settings.sharedAccountsErrorDetail").replace("{error}", escapeHtml(status.error || "")), "error") : ""}
      <div class="overflow-x-auto">
        <table class="erp-table">
          <thead><tr><th>${t("settings.name")}</th><th>${t("settings.email")}</th><th>${t("settings.role")}</th><th>${t("settings.actions")}</th></tr></thead>
          <tbody id="usersTableBody">${renderUsersRows()}</tbody>
        </table>
      </div>
      <div id="userMsg"></div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <input type="hidden" id="editingUserEmail" value="" />
        <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("settings.name")}</span><input id="newUserName" class="field-input" /></label>
        <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("settings.email")}</span><input id="newUserEmail" type="email" class="field-input" /></label>
        <label class="block"><span class="block text-xs text-erp-muted mb-1" id="newUserPasswordLabel">${t("settings.password")}</span><input id="newUserPassword" type="text" class="field-input" /></label>
        <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("settings.role")}</span>
          <select id="newUserRole" class="field-input">${ROLES.map((r) => `<option value="${r}">${t("role." + r)}</option>`).join("")}</select>
        </label>
      </div>
      <div class="flex gap-2">
        <button id="addUserBtn" class="btn btn-primary"><i data-lucide="user-plus" style="width:15px;height:15px"></i> <span id="addUserBtnLabel">${t("settings.addUser")}</span></button>
        <button id="cancelEditUserBtn" class="btn hidden">${t("settings.cancel")}</button>
      </div>

      <div class="pt-3 border-t border-erp-border space-y-2">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-erp-muted">${t("settings.sharedAccounts")}</h4>
        <p class="text-[11px] text-erp-muted whitespace-pre-line">${t("settings.sharedAccountsHelp")}</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("settings.usersBinId")}</span><input id="setUsersBinId" class="field-input" placeholder="e.g. 6642a1b2c3d4e5f6a7b8c9d0" value="${escapeAttr(SETTINGS.usersBinId || "")}" /></label>
          <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("settings.usersApiKey")}</span><input id="setUsersApiKey" type="password" class="field-input" value="${escapeAttr(SETTINGS.usersApiKey || "")}" /></label>
        </div>
        <p class="text-[11px] text-erp-muted">${t("settings.sharedAccountsSaveNote")}</p>
      </div>

      <div class="pt-3 border-t border-erp-border space-y-2">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-erp-muted">${t("settings.shareAccounts")}</h4>
        <p class="text-[11px] text-erp-muted">${t("settings.shareAccountsHelp")}</p>
        <button id="exportUsersBtn" class="btn"><i data-lucide="download" style="width:14px;height:14px"></i> ${t("settings.exportUsers")}</button>
      </div>
    </div>
  `;
}

function resetUserForm() {
  document.getElementById("editingUserEmail").value = "";
  document.getElementById("newUserName").value = "";
  document.getElementById("newUserEmail").value = "";
  document.getElementById("newUserEmail").disabled = false;
  document.getElementById("newUserPassword").value = "";
  document.getElementById("newUserRole").value = ROLES[0];
  document.getElementById("addUserBtnLabel").textContent = t("settings.addUser");
  document.getElementById("cancelEditUserBtn").classList.add("hidden");
  document.getElementById("newUserPasswordLabel").textContent = t("settings.password");
}

async function refreshUsersTable() {
  await apiListUsers();
  document.getElementById("usersTableBody").innerHTML = renderUsersRows();
  wireRowButtons();
  if (window.lucide) lucide.createIcons();
}

function wireRowButtons() {
  document.querySelectorAll(".deleteUserBtn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const email = btn.dataset.email;
      if (email.toLowerCase() === CURRENT_USER.email.toLowerCase()) {
        document.getElementById("userMsg").innerHTML = msgBox(t("settings.cannotDeleteSelf"), "warning");
        return;
      }
      const result = await apiDeleteUser(email);
      const msgEl = document.getElementById("userMsg");
      if (!result.ok) {
        msgEl.innerHTML = msgBox(result.error || "Failed.", "error");
        return;
      }
      await refreshUsersTable();
    })
  );
  document.querySelectorAll(".editUserBtn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const user = USERS.find((u) => u.email === btn.dataset.email);
      if (!user) return;
      document.getElementById("editingUserEmail").value = user.email;
      document.getElementById("newUserName").value = user.name || "";
      document.getElementById("newUserEmail").value = user.email;
      document.getElementById("newUserEmail").disabled = true;
      document.getElementById("newUserPassword").value = "";
      document.getElementById("newUserRole").value = user.role;
      document.getElementById("addUserBtnLabel").textContent = t("settings.updateUser");
      document.getElementById("cancelEditUserBtn").classList.remove("hidden");
      document.getElementById("newUserPasswordLabel").textContent = t("settings.newPasswordOptional");
    })
  );
}

function wireUsersSection() {
  wireRowButtons();
  document.getElementById("exportUsersBtn").addEventListener("click", exportUsersFile);
  document.getElementById("cancelEditUserBtn").addEventListener("click", resetUserForm);
  document.getElementById("addUserBtn").addEventListener("click", async () => {
    const editingEmail = document.getElementById("editingUserEmail").value;
    const name = document.getElementById("newUserName").value.trim();
    const email = document.getElementById("newUserEmail").value.trim();
    const password = document.getElementById("newUserPassword").value;
    const role = document.getElementById("newUserRole").value;
    const msgEl = document.getElementById("userMsg");

    if (editingEmail) {
      const patch = { name, role };
      if (password) patch.password = password;
      const result = await apiUpdateUser(editingEmail, patch);
      if (!result.ok) {
        msgEl.innerHTML = msgBox(result.error || t("settings.userExists"), "error");
        return;
      }
      msgEl.innerHTML = msgBox(t("settings.userUpdated"), "success");
      resetUserForm();
      await refreshUsersTable();
      return;
    }

    if (!email || !password) return;
    const result = await apiAddUser({ name, email, password, role });
    if (!result.ok) {
      msgEl.innerHTML = msgBox(t("settings.userExists"), "warning");
      return;
    }
    msgEl.innerHTML = msgBox(t("settings.userAdded"), "success");
    resetUserForm();
    await refreshUsersTable();
  });
}

function currentSourceLabel(s) {
  if (s.dataSource === "live") return t("settings.sourceLive");
  if (s.dataSource === "upload") return t("settings.sourceUploadShared");
  return t("settings.sourceSample");
}

async function renderSettings() {
  const app = document.getElementById("app");
  const isAdmin = ROLE_PERMISSIONS[CURRENT_USER.role].canEditSettings;
  const s = SETTINGS;
  const sec = s.dashboardSections;

  if (isAdmin) await apiListUsers();
  const usersStoreStatus = isAdmin ? await checkSharedStoreStatus() : { configured: false, connected: false };

  app.innerHTML = `
    <div class="space-y-6" style="max-width:52rem">
      <div><h1 class="text-xl font-bold">${t("settings.title")}</h1><p class="text-sm text-erp-muted">${t("settings.subtitle")}</p></div>
      ${!isAdmin ? `<div class="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">${t("settings.adminOnly")} <strong>${t("role." + CURRENT_USER.role)}</strong>. ${t("settings.adminOnlyEnd")}</div>` : ""}

      <div class="card p-5 space-y-4">
        <h3 class="text-sm font-semibold">${t("settings.dataSource")}</h3>
        <div class="rounded-lg bg-erp-bg border border-erp-border px-3 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <span><span class="text-erp-muted">${t("settings.currentSource")}:</span> <strong>${currentSourceLabel(s)}</strong></span>
          <span><strong>${formatNumber(DATA.items.length)}</strong> ${t("settings.itemsLoaded")}</span>
          <span><span class="text-erp-muted">${t("settings.lastSynced")}:</span> <strong>${getLastSyncedAt() ? formatDate(getLastSyncedAt()) : t("settings.never")}</strong></span>
        </div>
        <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.dataSourceMode")}</span>
          <select id="setDataSource" class="field-input" ${!isAdmin ? "disabled" : ""}>
            <option value="upload" ${s.dataSource !== "live" ? "selected" : ""}>${t("settings.sampleData")}</option>
            <option value="live" ${s.dataSource === "live" ? "selected" : ""}>${t("settings.liveSharepoint")}</option>
          </select>
        </label>
        <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.worksheetName")}</span>
          <input id="setSheet" class="field-input" value="${escapeAttr(s.worksheetName)}" ${!isAdmin ? "disabled" : ""} />
          <span class="block text-[11px] text-erp-muted mt-1">${t("settings.worksheetNameHelp")}</span>
        </label>
        <p class="text-[11px] text-erp-muted">${t("settings.expectedColumns")}</p>

        <div class="pt-3 border-t border-erp-border space-y-2">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <h4 class="text-xs font-semibold uppercase tracking-wide text-erp-muted">${t("settings.uploadFileTitle")}</h4>
            <span class="text-[11px] font-medium px-2 py-1 rounded-full ${hasGithubWriteAccess() ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}">
              ${hasGithubWriteAccess() ? t("settings.uploadPushes") : t("settings.uploadLocalOnly")}
            </span>
          </div>
          <p class="text-[11px] text-erp-muted">${t("settings.uploadFileHelp")}</p>
          ${
            isAdmin
              ? `<label class="btn btn-primary" style="display:inline-flex;cursor:pointer">
                  <i data-lucide="upload" style="width:14px;height:14px"></i> ${t("settings.chooseFile")}
                  <input id="setUploadFile" type="file" accept=".xlsx,.xls,.csv" class="hidden" />
                </label>`
              : ""
          }
          <div id="uploadMsg"></div>
          <label class="block"><span class="block text-xs text-erp-muted mb-1">${t("settings.githubToken")}</span>
            <input id="setGithubToken" type="password" class="field-input" placeholder="github_pat_..." value="${escapeAttr(s.githubToken || "")}" ${!isAdmin ? "disabled" : ""} />
          </label>
          <p class="text-[11px] text-erp-muted">${t("settings.githubTokenHelp")}</p>
        </div>

        <div class="pt-3 border-t border-erp-border space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-erp-muted">${t("settings.liveSharepoint")}</h4>
          <label class="block"><span class="block text-xs font-medium text-erp-muted mb-1">${t("settings.sharepointUrl")}</span>
            <input id="setUrl" class="field-input" value="${escapeAttr(s.sharePointUrl)}" ${!isAdmin ? "disabled" : ""} />
            <span class="block text-[11px] text-erp-muted mt-1">${t("settings.excelUrlHelp")}</span>
          </label>
        </div>

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

      ${isAdmin ? renderUsersSection(usersStoreStatus) : ""}
    </div>
  `;

  if (isAdmin) {
    document.getElementById("setSave").addEventListener("click", async () => {
      SETTINGS = {
        ...SETTINGS,
        dataSource: document.getElementById("setDataSource").value,
        sharePointUrl: document.getElementById("setUrl").value,
        worksheetName: document.getElementById("setSheet").value,
        githubToken: document.getElementById("setGithubToken").value.trim(),
        usersBinId: document.getElementById("setUsersBinId").value.trim(),
        usersApiKey: document.getElementById("setUsersApiKey").value.trim(),
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
      await renderSettings();
      const msgEl = document.getElementById("setMsg");
      if (msgEl) msgEl.innerHTML = msgBox(t("settings.savedMsg"), "success");
      if (SETTINGS.dataSource === "upload") {
        await syncSharedItems(true);
        await renderSettings();
      } else if (SETTINGS.dataSource === "live" && SETTINGS.sharePointUrl) {
        await syncLiveData(true);
        await renderSettings();
      }
    });
    document.getElementById("setReload").addEventListener("click", performRefresh);
    document.getElementById("setTest").addEventListener("click", async () => {
      const msgEl = document.getElementById("setMsg");
      const mode = document.getElementById("setDataSource").value;
      if (mode !== "live") {
        msgEl.innerHTML = msgBox(t("settings.testSampleMode"), "warning");
        return;
      }
      const url = document.getElementById("setUrl").value;
      const sheet = document.getElementById("setSheet").value;
      msgEl.innerHTML = msgBox(t("settings.testing"), "info");
      try {
        const result = await loadDataFromExcelUrl(url, sheet);
        msgEl.innerHTML = msgBox(t("settings.testSuccess").replace("{count}", result.rowCount).replace("{sheet}", result.sheetName), "success");
      } catch (e) {
        msgEl.innerHTML = msgBox(buildSyncErrorMessage(e), "error");
      }
    });
    const uploadInput = document.getElementById("setUploadFile");
    if (uploadInput) {
      uploadInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const msgEl = document.getElementById("uploadMsg");
        msgEl.innerHTML = msgBox(t("settings.testing"), "info");
        try {
          const result = await handleFileUpload(file);
          msgEl.innerHTML = msgBox(t("settings.uploadSuccess").replace("{count}", result.rowCount).replace("{name}", escapeHtml(file.name)), "success");
          await renderSettings();
        } catch (err) {
          console.error("Upload failed:", err);
          msgEl.innerHTML = msgBox(t("settings.uploadFailed").replace("{error}", (err && err.message) || String(err)), "error");
        }
      });
    }
    wireUsersSection();
  }

  if (window.lucide) lucide.createIcons();
}
