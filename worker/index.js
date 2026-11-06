const LOCATIONS = ["Red's Cafe", "Red's Cafe Too", "Also Red's Cafe"];
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

const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// Reviews live in Supabase (schema redscafeweb), reached through PostgREST with the service role key.
async function db(env, path, { method = "GET", body, headers = {} } = {}) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      ...(key.startsWith("eyJ") ? { authorization: `Bearer ${key}` } : {}),
      "accept-profile": "redscafeweb",
      "content-profile": "redscafeweb",
      "content-type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]}: ${res.status} ${await res.text()}`);
  return res;
}

const rows = async (env, path) => (await db(env, path)).json();

async function count(env, path) {
  const res = await db(env, path, { method: "HEAD", headers: { prefer: "count=exact" } });
  return Number(res.headers.get("content-range")?.split("/")[1] || 0);
}

async function listPublic(env) {
  const [reviews, ratings] = await Promise.all([
    rows(env, "reviews?select=id,name,location,rating,comment,reply,created_at&status=eq.approved&order=created_at.desc&limit=200"),
    rows(env, "reviews?select=rating&status=eq.approved"),
  ]);
  const average = ratings.length ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : null;
  return json({ reviews, count: ratings.length, average });
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

  const ipHash = await sha256(`${request.headers.get("cf-connecting-ip") || "local"}:${env.SUPABASE_SERVICE_ROLE_KEY}`);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const recent = await count(env, `reviews?select=id&ip_hash=eq.${ipHash}&created_at=gt.${encodeURIComponent(since)}`);
  if (recent >= MAX_PER_HOUR) return json({ error: "Thanks! You've sent a few already. Please try again later." }, 429);

  await db(env, "reviews", {
    method: "POST",
    body: { name, location, rating, comment, ip_hash: ipHash },
    headers: { prefer: "return=minimal" },
  });
  return json({ ok: true }, 201);
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
      if (pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};
