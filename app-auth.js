/* ============================================================
   Inventory ERP — Auth/Users data layer

   Two layers of shared-account access, so login works on any device
   with zero setup while account management stays admin-only:

   1. READ (baked into the app, always on): PUBLIC_USERS_BIN_ID /
      PUBLIC_USERS_READ_KEY below are a jsonbin.io bin + a read-only
      Access Key. Every device — even one that's never opened
      Settings — uses these automatically to check logins against
      the shared account list. A read-only key can only view the
      bin, never change it, so it's safe to ship in public source.

   2. WRITE (Settings -> Users -> Shared Accounts Database, admin
      only): the admin's own device additionally has the bin's full
      Master Key, entered manually in Settings. Only that key can
      add, edit, delete, or change a password — regular devices
      can check logins but can't modify the account list.

   If neither is configured, or the shared bin is unreachable,
   everything falls back to this device's local copy so a network
   hiccup can never fully lock someone out.
   ============================================================ */

const PUBLIC_USERS_BIN_ID = "6a579c52da38895dfe616bde";
const PUBLIC_USERS_READ_KEY = "$2a$10$E2Ti7x/SGWucSd.NDQC92.tniHdrsGBfU7pQ8uEUzl12fQgzGmqfq";

// Does this device have the admin Master Key (can add/edit/delete/change)?
function hasWriteAccess() {
  return !!(SETTINGS.usersBinId && SETTINGS.usersBinId.trim() && SETTINGS.usersApiKey && SETTINGS.usersApiKey.trim());
}
// Can this device at least check logins, whether via its own configured
// Master Key or the read-only key baked into the app?
function hasSharedReadAccess() {
  return hasWriteAccess() || !!(PUBLIC_USERS_BIN_ID && PUBLIC_USERS_READ_KEY);
}
// Kept for any older call sites / Settings badge — "configured for write".
function hasSharedStore() {
  return hasWriteAccess();
}

function readBinId() {
  return (SETTINGS.usersBinId && SETTINGS.usersBinId.trim()) || PUBLIC_USERS_BIN_ID;
}
function readAuthHeaders() {
  if (SETTINGS.usersApiKey && SETTINGS.usersApiKey.trim()) return { "X-Master-Key": SETTINGS.usersApiKey.trim() };
  if (PUBLIC_USERS_READ_KEY) return { "X-Access-Key": PUBLIC_USERS_READ_KEY };
  return {};
}
function sharedStoreUrl() {
  return `https://api.jsonbin.io/v3/b/${SETTINGS.usersBinId.trim()}`;
}

async function fetchRemoteUsers() {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${readBinId()}/latest`, {
    headers: { ...readAuthHeaders(), "X-Bin-Meta": "false" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.record)) return data.record; // in case meta wasn't stripped
  return [];
}
async function saveRemoteUsers(users) {
  if (!hasWriteAccess()) {
    const e = new Error("No admin key configured on this device — it can check logins but can't save changes.");
    e.code = "NO_WRITE_ACCESS";
    throw e;
  }
  const res = await fetch(sharedStoreUrl(), {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Master-Key": SETTINGS.usersApiKey.trim() },
    body: JSON.stringify(users),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// Actually attempts the connection (unlike hasWriteAccess, which only checks
// that the fields are filled in) so Settings and the login screen can show
// the real reason a shared login isn't working, instead of failing silently.
async function checkSharedStoreStatus() {
  if (!hasWriteAccess()) return { configured: false, connected: false };
  try {
    await fetchRemoteUsers();
    return { configured: true, connected: true };
  } catch (e) {
    return { configured: true, connected: false, error: e.message || String(e) };
  }
}

// Same idea, but for the read path used on the login screen — checks
// whatever key this device actually has (baked-in read key or an admin's
// own Master Key), so the diagnostic matches what apiLogin really did.
async function checkSharedReadStatus() {
  if (!hasSharedReadAccess()) return { configured: false, connected: false };
  try {
    await fetchRemoteUsers();
    return { configured: true, connected: true };
  } catch (e) {
    return { configured: true, connected: false, error: e.message || String(e) };
  }
}

async function apiLogin(email, password) {
  if (hasSharedReadAccess()) {
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
  if (hasSharedReadAccess()) {
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
  if (hasWriteAccess()) {
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
  if (hasWriteAccess()) {
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
  if (hasWriteAccess()) {
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
  if (hasSharedReadAccess()) {
    try {
      const remoteUsers = await fetchRemoteUsers();
      const u = remoteUsers.find((x) => x.email.toLowerCase() === email.toLowerCase());
      if (!u || u.password !== currentPassword) return { ok: false, error: "invalid" };
      if (!hasWriteAccess()) {
        return { ok: false, error: "This device can check logins but isn't set up to save changes to the shared database. Ask your admin to change it from their device." };
      }
      u.password = newPassword;
      await saveRemoteUsers(remoteUsers);
      USERS = remoteUsers;
      saveUsers();
      return { ok: true };
    } catch (e) {
      if (e && e.code === "NO_WRITE_ACCESS") return { ok: false, error: e.message };
      return { ok: false, error: `Could not reach the shared accounts database (${e.message || e}).` };
    }
  }
  const u = USERS.find((x) => x.email.toLowerCase() === email.toLowerCase());
  if (!u || u.password !== currentPassword) return { ok: false, error: "invalid" };
  u.password = newPassword;
  saveUsers();
  return { ok: true };
}
