/* ============================================================
   Namqwh Inventory ERP — Shared Auth/Users Worker

   Problem this fixes: user accounts were stored in each browser's
   local storage. Adding someone in Settings only ever updated the
   admin's own browser — nobody else's device knew that account
   existed, so their login always failed. This Worker stores all
   accounts centrally in Cloudflare KV instead, so login and user
   management work identically from any device the moment you add
   someone.

   Deploy steps (free, ~3 minutes):
     1. dash.cloudflare.com -> Workers & Pages -> Create -> Create Worker.
     2. Any name, e.g. "namqwh-auth" -> Deploy.
     3. Workers & Pages -> KV -> Create a namespace (e.g. "NAMQWH_USERS").
     4. Back on this Worker: Settings -> Bindings -> Add binding ->
        KV Namespace -> Variable name: USERS_KV -> pick the namespace
        you just created -> Save.
     5. Settings -> Variables -> add an encrypted secret named ADMIN_KEY,
        value = any strong string you choose (this is what protects
        adding/editing/deleting users) -> Save.
     6. Edit code -> replace everything with this file -> Save and Deploy.
     7. Copy this Worker's URL.
     8. In the Namqwh site: Settings -> Users -> Centralized Accounts ->
        paste the Worker URL into "Auth Worker URL" and the same
        ADMIN_KEY value into "Admin Key" -> Save.

   From then on, adding/editing/removing users and logging in all go
   through this Worker instead of browser storage.

   A default seed account is created automatically the first time
   this Worker runs, if no users exist yet: Admin@namq.com / 123456.
   Change that password immediately after setup (Change Password in
   the app's user menu, once logged in as Admin).
   ============================================================ */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function getUsers(env) {
  const raw = await env.USERS_KV.get("users");
  if (!raw) {
    const seed = [{ name: "Admin", email: "Admin@namq.com", password: "123456", role: "Admin" }];
    await env.USERS_KV.put("users", JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
async function saveUsers(env, users) {
  await env.USERS_KV.put("users", JSON.stringify(users));
}

function requireAdmin(request, env) {
  const key = request.headers.get("X-Admin-Key") || "";
  return !!env.ADMIN_KEY && key === env.ADMIN_KEY;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (!env.USERS_KV) {
      return json({ ok: false, error: "Worker is missing the USERS_KV binding. See PART setup steps in this file's header comment." }, 500);
    }

    // Login — no admin key required, anyone with valid credentials can sign in.
    if (path === "/login" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const users = await getUsers(env);
      const user = users.find((u) => u.email.toLowerCase() === String(body.email || "").toLowerCase() && u.password === body.password);
      if (!user) return json({ ok: false, error: "Invalid email or password." }, 401);
      return json({ ok: true, user });
    }

    // Self-service password change — requires knowing the current password, not the admin key.
    if (path === "/change-password" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const users = await getUsers(env);
      const user = users.find((u) => u.email.toLowerCase() === String(body.email || "").toLowerCase());
      if (!user || user.password !== body.currentPassword) return json({ ok: false, error: "Current password is incorrect." }, 401);
      if (!body.newPassword) return json({ ok: false, error: "New password required." }, 400);
      user.password = body.newPassword;
      await saveUsers(env, users);
      return json({ ok: true });
    }

    // Everything below manages the account list and requires the admin key.
    if (!requireAdmin(request, env)) return json({ ok: false, error: "Missing or invalid admin key." }, 403);

    if (path === "/users" && request.method === "GET") {
      return json({ ok: true, users: await getUsers(env) });
    }

    if (path === "/users" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (!body.email || !body.password) return json({ ok: false, error: "Email and password required." }, 400);
      const users = await getUsers(env);
      if (users.some((u) => u.email.toLowerCase() === String(body.email).toLowerCase())) {
        return json({ ok: false, error: "A user with this email already exists." }, 409);
      }
      users.push({ name: body.name || "", email: body.email, password: body.password, role: body.role || "Viewer" });
      await saveUsers(env, users);
      return json({ ok: true, users });
    }

    const userMatch = path.match(/^\/users\/(.+)$/);
    if (userMatch && request.method === "PUT") {
      const email = decodeURIComponent(userMatch[1]);
      const body = await request.json().catch(() => ({}));
      const users = await getUsers(env);
      const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user) return json({ ok: false, error: "User not found." }, 404);
      if (body.name !== undefined) user.name = body.name;
      if (body.role !== undefined) user.role = body.role;
      if (body.password) user.password = body.password;
      await saveUsers(env, users);
      return json({ ok: true, users });
    }

    if (userMatch && request.method === "DELETE") {
      const email = decodeURIComponent(userMatch[1]);
      const users = await getUsers(env);
      const filtered = users.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
      await saveUsers(env, filtered);
      return json({ ok: true, users: filtered });
    }

    return json({ ok: false, error: "Not found." }, 404);
  },
};
