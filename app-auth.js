/* ============================================================
   Inventory ERP — Auth/Users data layer

   Two ways accounts can work, chosen by whether a shared database
   is configured (Settings -> Users -> Shared Accounts Database):

   1. Not configured (default): accounts live only in this browser's
      localStorage. Use Export/Import to move accounts between
      devices manually.

   2. Configured: every login/add/edit/delete reads and writes a
      small free hosted JSON store (jsonbin.io — no server code, no
      deployment, just a free account and two values pasted into
      Settings). Every device with a network connection then sees
      the same accounts automatically.

   If the shared database is unreachable for any reason, everything
   falls back to the local copy so a network hiccup can never fully
   lock someone out.
   ============================================================ */

function hasSharedStore() {
  return !!(SETTINGS.usersBinId && SETTINGS.usersBinId.trim() && SETTINGS.usersApiKey && SETTINGS.usersApiKey.trim());
}
function sharedStoreUrl() {
  return `https://api.jsonbin.io/v3/b/${SETTINGS.usersBinId.trim()}`;
}
async function fetchRemoteUsers() {
  const res = await fetch(`${sharedStoreUrl()}/latest`, {
    headers: { "X-Master-Key": SETTINGS.usersApiKey.trim(), "X-Bin-Meta": "false" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.record)) return data.record; // in case meta wasn't stripped
  return [];
}
async function saveRemoteUsers(users) {
  const res = await fetch(sharedStoreUrl(), {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Master-Key": SETTINGS.usersApiKey.trim() },
    body: JSON.stringify(users),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function apiLogin(email, password) {
  if (hasSharedStore()) {
    try {
      const remoteUsers = await fetchRemoteUsers();
      USERS = remoteUsers;
      saveUsers(); // keep a local cache so a later offline moment still has something
      const user = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
      return user || null;
    } catch (e) {
      console.error("apiLogin (shared store) failed, falling back to local accounts:", e);
      // Fall through to the local check below.
    }
  }
  const user = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  return user || null;
}

/* ---------- Export / Import (manual, file-based account sharing) ---------- */

function exportUsersFile() {
  downloadBlob(new Blob([JSON.stringify(USERS, null, 2)], { type: "application/json" }), "namqwh-users.json");
}

// Merges accounts from an exported file into this browser's local list —
// used on the login screen so a newly-added person can unlock their own
// account before they've ever been able to log in (when no shared
// database is configured).
function importUsersFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported)) throw new Error("File is not a valid accounts list.");
        let count = 0;
        imported.forEach((u) => {
          if (!u || !u.email || !u.password) return;
          const existing = USERS.find((x) => x.email.toLowerCase() === u.email.toLowerCase());
          if (existing) Object.assign(existing, u);
          else USERS.push(u);
          count++;
        });
        saveUsers();
        resolve(count);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsText(file);
  });
}

async function apiListUsers() {
  if (hasSharedStore()) {
    try {
      USERS = await fetchRemoteUsers();
      saveUsers();
      return USERS;
    } catch (e) {
      console.error("apiListUsers (shared store) failed:", e);
    }
  }
  return USERS;
}

async function apiAddUser(user) {
  if (hasSharedStore()) {
    try {
      const remoteUsers = await fetchRemoteUsers();
      if (remoteUsers.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) return { ok: false, error: "exists" };
      remoteUsers.push(user);
      await saveRemoteUsers(remoteUsers);
      USERS = remoteUsers;
      saveUsers();
      return { ok: true, users: USERS };
    } catch (e) {
      return { ok: false, error: `Could not reach the shared accounts database (${e.message || e}).` };
    }
  }
  if (USERS.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) return { ok: false, error: "exists" };
  USERS.push(user);
  saveUsers();
  return { ok: true, users: USERS };
}

async function apiUpdateUser(email, patch) {
  if (hasSharedStore()) {
    try {
      const remoteUsers = await fetchRemoteUsers();
      const u = remoteUsers.find((x) => x.email.toLowerCase() === email.toLowerCase());
      if (!u) return { ok: false, error: "not found" };
      Object.assign(u, patch);
      await saveRemoteUsers(remoteUsers);
      USERS = remoteUsers;
      saveUsers();
      return { ok: true, users: USERS };
    } catch (e) {
      return { ok: false, error: `Could not reach the shared accounts database (${e.message || e}).` };
    }
  }
  const u = USERS.find((x) => x.email.toLowerCase() === email.toLowerCase());
  if (!u) return { ok: false, error: "not found" };
  Object.assign(u, patch);
  saveUsers();
  return { ok: true, users: USERS };
}

async function apiDeleteUser(email) {
  if (hasSharedStore()) {
    try {
      const remoteUsers = await fetchRemoteUsers();
      const filtered = remoteUsers.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
      await saveRemoteUsers(filtered);
      USERS = filtered;
      saveUsers();
      return { ok: true, users: USERS };
    } catch (e) {
      return { ok: false, error: `Could not reach the shared accounts database (${e.message || e}).` };
    }
  }
  USERS = USERS.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
  saveUsers();
  return { ok: true, users: USERS };
}

async function apiChangePassword(email, currentPassword, newPassword) {
  if (hasSharedStore()) {
    try {
      const remoteUsers = await fetchRemoteUsers();
      const u = remoteUsers.find((x) => x.email.toLowerCase() === email.toLowerCase());
      if (!u || u.password !== currentPassword) return { ok: false, error: "invalid" };
      u.password = newPassword;
      await saveRemoteUsers(remoteUsers);
      USERS = remoteUsers;
      saveUsers();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: `Could not reach the shared accounts database (${e.message || e}).` };
    }
  }
  const u = USERS.find((x) => x.email.toLowerCase() === email.toLowerCase());
  if (!u || u.password !== currentPassword) return { ok: false, error: "invalid" };
  u.password = newPassword;
  saveUsers();
  return { ok: true };
}
