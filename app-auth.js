/* ============================================================
   Inventory ERP — Auth/Users data layer

   Every call here checks SETTINGS.authWorkerUrl. If it's set, user
   management and login go through the deployed Auth Worker (shared
   across every device). If it's not set, everything falls back to
   the local USERS array + localStorage exactly as before, so the
   app keeps working with zero setup — the Worker is opt-in.
   ============================================================ */

function hasAuthBackend() {
  return !!(SETTINGS.authWorkerUrl && SETTINGS.authWorkerUrl.trim());
}
function authBaseUrl() {
  return SETTINGS.authWorkerUrl.trim().replace(/\/+$/, "");
}
function authHeaders() {
  return { "Content-Type": "application/json", "X-Admin-Key": SETTINGS.authAdminKey || "" };
}

async function apiLogin(email, password) {
  if (hasAuthBackend()) {
    try {
      const res = await fetch(`${authBaseUrl()}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({ ok: false }));
      return json.ok ? json.user : null;
    } catch (e) {
      console.error("apiLogin failed:", e);
      return null;
    }
  }
  const user = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  return user || null;
}

async function apiListUsers() {
  if (hasAuthBackend()) {
    try {
      const res = await fetch(`${authBaseUrl()}/users`, { headers: authHeaders() });
      const json = await res.json().catch(() => ({ ok: false, users: [] }));
      if (json.ok) USERS = json.users;
      return json.ok ? json.users : USERS;
    } catch (e) {
      console.error("apiListUsers failed:", e);
      return USERS;
    }
  }
  return USERS;
}

async function apiAddUser(user) {
  if (hasAuthBackend()) {
    try {
      const res = await fetch(`${authBaseUrl()}/users`, { method: "POST", headers: authHeaders(), body: JSON.stringify(user) });
      const json = await res.json().catch(() => ({ ok: false, error: "Request failed." }));
      if (json.ok) USERS = json.users;
      return json;
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  if (USERS.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) return { ok: false, error: "exists" };
  USERS.push(user);
  saveUsers();
  return { ok: true, users: USERS };
}

async function apiUpdateUser(email, patch) {
  if (hasAuthBackend()) {
    try {
      const res = await fetch(`${authBaseUrl()}/users/${encodeURIComponent(email)}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(patch) });
      const json = await res.json().catch(() => ({ ok: false, error: "Request failed." }));
      if (json.ok) USERS = json.users;
      return json;
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  const u = USERS.find((x) => x.email.toLowerCase() === email.toLowerCase());
  if (!u) return { ok: false, error: "not found" };
  Object.assign(u, patch);
  saveUsers();
  return { ok: true, users: USERS };
}

async function apiDeleteUser(email) {
  if (hasAuthBackend()) {
    try {
      const res = await fetch(`${authBaseUrl()}/users/${encodeURIComponent(email)}`, { method: "DELETE", headers: authHeaders() });
      const json = await res.json().catch(() => ({ ok: false, error: "Request failed." }));
      if (json.ok) USERS = json.users;
      return json;
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  USERS = USERS.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
  saveUsers();
  return { ok: true, users: USERS };
}

async function apiChangePassword(email, currentPassword, newPassword) {
  if (hasAuthBackend()) {
    try {
      const res = await fetch(`${authBaseUrl()}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, currentPassword, newPassword }),
      });
      return res.json().catch(() => ({ ok: false, error: "Request failed." }));
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  const u = USERS.find((x) => x.email.toLowerCase() === email.toLowerCase());
  if (!u || u.password !== currentPassword) return { ok: false, error: "invalid" };
  u.password = newPassword;
  saveUsers();
  return { ok: true };
}
