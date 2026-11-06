const LOCATIONS = ["Red's Cafe", "Red's Cafe Too", "Also Red's Cafe"];
const STATUSES = ["pending", "approved", "hidden"];
const MAX_PER_HOUR = 3;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function isAdmin(request, env) {
  const given = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!env.ADMIN_PASSWORD || !given) return false;
  const [a, b] = await Promise.all([sha256(given), sha256(env.ADMIN_PASSWORD)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

async function listPublic(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, location, rating, comment, reply, created_at FROM reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 200",
  ).all();
  const stats = await env.DB.prepare(
    "SELECT COUNT(*) AS count, AVG(rating) AS average FROM reviews WHERE status = 'approved'",
  ).first();
  return json({ reviews: results, count: stats.count, average: stats.average });
}

async function submit(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (body.website) return json({ ok: true });
  const name = clean(body.name, 60);
  const comment = String(body.comment ?? "").trim().slice(0, 1500);
  const rating = Number(body.rating);
  const location = LOCATIONS.includes(body.location) ? body.location : "";
  if (!name) return json({ error: "Please enter your name." }, 400);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "Please pick a star rating." }, 400);

  const ipHash = await sha256(`${request.headers.get("cf-connecting-ip") || "local"}:${env.ADMIN_PASSWORD || ""}`);
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM reviews WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hour')",
  )
    .bind(ipHash)
    .first();
  if (recent.n >= MAX_PER_HOUR) return json({ error: "Thanks! You've sent a few already. Please try again later." }, 429);

  await env.DB.prepare("INSERT INTO reviews (name, location, rating, comment, ip_hash) VALUES (?, ?, ?, ?, ?)")
    .bind(name, location, rating, comment, ipHash)
    .run();
  return json({ ok: true }, 201);
}

async function admin(request, env, path) {
  if (!(await isAdmin(request, env))) return json({ error: "Wrong password" }, 401);
  if (path === "/api/admin/reviews" && request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT id, name, location, rating, comment, status, reply, created_at FROM reviews ORDER BY created_at DESC LIMIT 500",
    ).all();
    return json({ reviews: results });
  }
  const id = Number(path.match(/^\/api\/admin\/reviews\/(\d+)$/)?.[1]);
  if (!id) return json({ error: "Not found" }, 404);
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM reviews WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }
  if (request.method === "PATCH") {
    const body = await request.json().catch(() => ({}));
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return json({ error: "Invalid status" }, 400);
      await env.DB.prepare("UPDATE reviews SET status = ? WHERE id = ?").bind(body.status, id).run();
    }
    if (body.reply !== undefined) {
      await env.DB.prepare("UPDATE reviews SET reply = ? WHERE id = ?")
        .bind(String(body.reply).trim().slice(0, 1500), id)
        .run();
    }
    return json({ ok: true });
  }
  return json({ error: "Method not allowed" }, 405);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/api/reviews") {
        if (request.method === "GET") return await listPublic(env);
        if (request.method === "POST") return await submit(request, env);
        return json({ error: "Method not allowed" }, 405);
      }
      if (pathname.startsWith("/api/admin/")) return await admin(request, env, pathname);
      if (pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};
