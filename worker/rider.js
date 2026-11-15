// Rider phone page API. A rider is identified by the private link a manager makes in the POS
// (/rider/<token>); only the token's SHA-256 is stored.
import { PRIVATE_BUCKET, bad, json, keyHeaders, pos, rows, sha256 } from "./store.js";

const ACTIVE = ["accepted", "ready"];

const manilaDayStart = () => {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  return new Date(`${ymd}T00:00:00+08:00`).toISOString();
};

async function findRider(env, token) {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const [r] = await rows(env, `rider?select=id,company_id,branch_id,name,status,is_active&token_hash=eq.${await sha256(token)}&limit=1`);
  return r && r.is_active ? r : null;
}

const patch = (env, path, body) => pos(env, path, { method: "PATCH", body, headers: { prefer: "return=minimal" } });

async function riderView(env, rider) {
  const [orders, done, [store], [tg]] = await Promise.all([
    rows(env, `online_order?select=id,order_number,status,customer_name,customer_phone,address,address_notes,latitude,longitude,items,notes,total,delivery_fee,payment_method,payment_status,picked_up_at&rider_id=eq.${rider.id}&status=in.(${ACTIVE.join(",")})&order=rider_assigned_at`),
    rows(env, `online_order?select=total,delivery_fee,payment_method&rider_id=eq.${rider.id}&status=eq.completed&delivered_at=gte.${encodeURIComponent(manilaDayStart())}`),
    rows(env, `online_store?select=display_name,address,latitude,longitude&branch_id=eq.${rider.branch_id}&limit=1`),
    rows(env, `telegram_link?select=chat_id&email=eq.${encodeURIComponent(`rider:${rider.id}`)}&company_id=eq.${rider.company_id}&limit=1`),
  ]);
  return json({
    rider: { name: rider.name, status: rider.status, telegram: !!tg?.chat_id },
    store: store ? { name: store.display_name, address: store.address, latitude: store.latitude, longitude: store.longitude } : null,
    orders: orders.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      address: o.address,
      address_notes: o.address_notes,
      latitude: o.latitude,
      longitude: o.longitude,
      notes: o.notes,
      items: (o.items || []).map((l) => ({ name: l.product_name, option: l.recipe_option_name, extras: l.modifier_labels || [], quantity: l.quantity, note: l.note })),
      collect: o.payment_method === "cod" ? o.total : 0,
      delivery_fee: o.delivery_fee,
    })),
    today: {
      deliveries: done.length,
      cod_collected: done.filter((o) => o.payment_method === "cod").reduce((s, o) => s + Number(o.total || 0), 0),
      fees_earned: done.reduce((s, o) => s + Number(o.delivery_fee || 0), 0),
    },
  });
}

async function setStatus(request, env, rider) {
  const { status } = await request.json().catch(() => ({}));
  if (!["available", "offline"].includes(status)) return bad("Choose Available or Offline.");
  if (rider.status === "on_delivery") return bad("Finish your delivery first.", 409);
  if (rider.status !== status) await patch(env, `rider?id=eq.${rider.id}&status=neq.on_delivery`, { status });
  const [fresh] = await rows(env, `rider?select=id,company_id,branch_id,name,status,is_active&id=eq.${rider.id}&limit=1`);
  return riderView(env, fresh);
}

async function uploadPhoto(env, path, dataUrl) {
  const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const bytes = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0));
  if (bytes.length > 4 * 1024 * 1024) return null;
  const file = `${path}.${m[2] === "jpeg" ? "jpg" : m[2]}`;
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${PRIVATE_BUCKET}/${file}`, {
    method: "POST",
    headers: { ...keyHeaders(env), "content-type": m[1], "x-upsert": "true" },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Storage upload: ${res.status} ${await res.text()}`);
  return `private-files/${file}`;
}

async function orderStep(request, env, rider, orderId, step) {
  if (!/^[a-f0-9]{32}$/.test(orderId)) return bad("Order not found", 404);
  const [o] = await rows(env, `online_order?select=id,status&id=eq.${orderId}&rider_id=eq.${rider.id}&limit=1`);
  if (!o) return bad("This order isn't assigned to you anymore.", 404);
  const now = new Date().toISOString();
  if (step === "pickup") {
    if (o.status !== "accepted") return bad("This order was already picked up.", 409);
    await patch(env, `online_order?id=eq.${o.id}&rider_id=eq.${rider.id}&status=eq.accepted`, { status: "ready", ready_at: now, picked_up_at: now });
  } else {
    if (o.status !== "ready") return bad("Tap Picked up first.", 409);
    const { photo } = await request.json().catch(() => ({}));
    const proof = await uploadPhoto(env, `delivery-proofs/${o.id}`, photo);
    if (!proof) return bad("Take a photo of the order at the customer's door (JPG or PNG, under 4 MB).");
    await patch(env, `online_order?id=eq.${o.id}&rider_id=eq.${rider.id}&status=eq.ready`, { status: "completed", completed_at: now, delivered_at: now, delivery_proof_uri: proof });
  }
  const [fresh] = await rows(env, `rider?select=id,company_id,branch_id,name,status,is_active&id=eq.${rider.id}&limit=1`);
  return riderView(env, fresh);
}

// Telegram link: same /start <code> flow as staff, stored under "rider:<id>".
async function telegramLink(env, rider) {
  const [integ] = await rows(env, `company_integration?select=telegram_bot_username&company_id=eq.${rider.company_id}&limit=1`);
  if (!integ?.telegram_bot_username) return bad("Telegram isn't set up for this store yet. Ask your manager.", 409);
  const email = `rider:${rider.id}`;
  const code = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const [link] = await rows(env, `telegram_link?select=id&email=eq.${encodeURIComponent(email)}&company_id=eq.${rider.company_id}&limit=1`);
  if (link) await patch(env, `telegram_link?id=eq.${link.id}`, { link_code: code });
  else await pos(env, "telegram_link", { method: "POST", body: { email, company_id: rider.company_id, link_code: code }, headers: { prefer: "return=minimal" } });
  return json({ url: `https://t.me/${integ.telegram_bot_username}?start=${code}` });
}

export async function handleRider(request, env, pathname) {
  const m = /^\/api\/rider\/([^/]+)(?:\/(status|telegram|orders\/([^/]+)\/(pickup|deliver)))?$/.exec(pathname);
  if (!m) return null;
  const rider = await findRider(env, m[1]);
  if (!rider) return bad("This rider link isn't valid anymore. Ask your manager for a new one.", 404);
  if (!m[2] && request.method === "GET") return riderView(env, rider);
  if (request.method !== "POST") return bad("Method not allowed", 405);
  if (m[2] === "status") return setStatus(request, env, rider);
  if (m[2] === "telegram") return telegramLink(env, rider);
  if (m[3]) return orderStep(request, env, rider, m[3], m[4]);
  return null;
}
