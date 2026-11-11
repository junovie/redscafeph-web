// Online store API: stores, menu (from the POS catalog), placing orders and order status.
// Everything runs with the service role key, so every input is validated and every price
// is recomputed here from the POS data, never trusted from the browser.

export const COD_LIMIT = 1000;
const ROAD_FACTOR = 1.25;
const MAX_ORDERS_PER_HOUR = 5;
const HIDDEN_CATEGORIES = /^(grab\b|employee only|misc charges)/i;
const PRIVATE_BUCKET = "order-private-files";
const MAYA = "https://pg.paymaya.com";
const PAY_WINDOW_MS = 70 * 60_000;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

const bad = (error, status = 400) => json({ error }, status);
const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const round2 = (n) => Math.round(n * 100) / 100;

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function keyHeaders(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  return { apikey: key, ...(key.startsWith("eyJ") ? { authorization: `Bearer ${key}` } : {}) };
}

async function pos(env, path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
    method,
    headers: {
      ...keyHeaders(env),
      "accept-profile": "commonorder",
      "content-profile": "commonorder",
      "content-type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]}: ${res.status} ${await res.text()}`);
  return res;
}
const rows = async (env, path) => (await pos(env, path)).json();

const companyId = (env) => {
  if (!env.STORE_COMPANY_ID) throw new Error("STORE_COMPANY_ID not set");
  return env.STORE_COMPANY_ID;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Date, weekday (0 = Sunday) and minutes since midnight in Manila.
function manilaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
    mins: Number(get("hour")) * 60 + Number(get("minute")),
  };
}
const toMinutes = (hhmm, fallback) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
};

// A closed date wins over the weekday's hours; stores without weekly hours use open_time/last_order_time every day.
function hoursOn(s, ymd, weekday) {
  const holiday = (Array.isArray(s.closed_dates) ? s.closed_dates : []).find((c) => c?.date === ymd);
  if (holiday) return { closed: true, note: holiday.note || "" };
  const day = Array.isArray(s.weekly_hours) && s.weekly_hours.length === 7 ? s.weekly_hours[weekday] : null;
  if (day?.closed) return { closed: true, note: "" };
  return { closed: false, open: day?.open || s.open_time || "07:00", last_order: day?.last_order || s.last_order_time || "24:00" };
}

// Product ids the store has switched off online (Grab-style sold out); "until" null = until staff turn it back on.
const soldOut = (s, now = new Date()) =>
  (Array.isArray(s.unavailable_items) ? s.unavailable_items : []).filter((u) => u?.product_id && (!u.until || new Date(u.until) > now)).map((u) => u.product_id);

function storeStatus(s, now = new Date()) {
  const paused = s.paused_until && new Date(s.paused_until) > now;
  const { ymd, weekday, mins } = manilaParts(now);
  const today = hoursOn(s, ymd, weekday);
  const open = !today.closed && mins >= toMinutes(today.open, 7 * 60) && mins < toMinutes(today.last_order, 24 * 60);
  let next_open = null;
  for (let i = 0; !open && i < 15; i++) {
    const p = i ? manilaParts(new Date(now.getTime() + i * 86400e3)) : { ymd, weekday };
    const h = hoursOn(s, p.ymd, p.weekday);
    if (h.closed || (i === 0 && mins >= toMinutes(h.last_order, 24 * 60))) continue;
    next_open = { date: p.ymd, day: i === 0 ? "today" : i === 1 ? "tomorrow" : `on ${WEEKDAYS[p.weekday]}`, time: h.open };
    break;
  }
  // Within hours but nobody has opened a shift at the POS: nobody would see the order.
  const noShift = open && s.shift_open === false;
  return {
    open: open && !paused && !noShift,
    paused: !!paused,
    no_shift: noShift && !paused,
    paused_until: paused ? s.paused_until : null,
    open_time: today.open || null,
    last_order_time: today.last_order || null,
    closed_today: today.closed,
    closed_note: today.note || "",
    next_open,
  };
}

function distanceKm(aLat, aLng, bLat, bLng) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h)) * ROAD_FACTOR;
}

export function deliveryFee(store, km) {
  const base = Number(store.delivery_base_fee ?? 49);
  const baseKm = Number(store.delivery_base_km ?? 2);
  const perKm = Number(store.delivery_per_km ?? 10);
  return round2(base + Math.max(0, Math.ceil(km - baseKm)) * perKm);
}

async function loadStores(env) {
  const [stores, pays, shifts] = await Promise.all([
    rows(env, `online_store?select=*&company_id=eq.${companyId(env)}&is_enabled=eq.true&order=display_name`),
    rows(env, `online_store_payment?select=branch_id&company_id=eq.${companyId(env)}`),
    rows(env, `shift?select=branch_id&company_id=eq.${companyId(env)}&status=eq.open`),
  ]);
  const online = new Set(pays.map((p) => p.branch_id));
  const shiftOpen = new Set(shifts.map((x) => x.branch_id));
  return stores.map((s) => ({ ...s, online_pay: online.has(s.branch_id), shift_open: shiftOpen.has(s.branch_id) }));
}

// Each branch is paid into its own Maya account; the keys never leave the server.
async function mayaKeys(env, branchId) {
  const res = await pos(env, "rpc/online_store_maya_keys", { method: "POST", body: { p_branch: branchId } });
  const [k] = await res.json();
  return k?.public_key && k?.secret_key ? k : null;
}
const basic = (key) => `Basic ${btoa(`${key}:`)}`;

// A one-time QR Ph code for this order's exact total, shown on Maya's page; any bank or e-wallet can pay it.
async function createMayaQr(keys, order, origin) {
  const back = `${origin}/order/${order.status_token}`;
  const res = await fetch(`${MAYA}/payments/v1/qr/payments`, {
    method: "POST",
    headers: { authorization: basic(keys.public_key), "content-type": "application/json" },
    body: JSON.stringify({
      totalAmount: { value: order.total, currency: "PHP" },
      redirectUrl: { success: `${back}?paid=1`, failure: `${back}?paid=0`, cancel: `${back}?paid=0` },
      requestReferenceNumber: order.id,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.redirectUrl) throw new Error(`Maya QR: ${res.status} ${data.message || data.error || ""}`);
  return { checkoutId: data.paymentId, redirectUrl: data.redirectUrl };
}

async function createMayaCheckout(keys, order, origin) {
  const back = `${origin}/order/${order.status_token}`;
  const res = await fetch(`${MAYA}/checkout/v1/checkouts`, {
    method: "POST",
    headers: { authorization: basic(keys.public_key), "content-type": "application/json" },
    body: JSON.stringify({
      totalAmount: { value: order.total, currency: "PHP" },
      buyer: { firstName: order.customer_name, contact: { phone: order.customer_phone, ...(order.customer_email ? { email: order.customer_email } : {}) } },
      items: [
        ...order.items.map((l) => ({ name: l.product_name.slice(0, 100), quantity: l.quantity, totalAmount: { value: l.line_total } })),
        ...(order.delivery_fee ? [{ name: "Delivery fee", quantity: 1, totalAmount: { value: order.delivery_fee } }] : []),
      ],
      redirectUrl: { success: `${back}?paid=1`, failure: `${back}?paid=0`, cancel: `${back}?paid=0` },
      requestReferenceNumber: order.id,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.redirectUrl) throw new Error(`Maya checkout: ${res.status} ${data.message || data.error || ""}`);
  return data;
}

// Asks Maya (never the browser or the webhook body) whether an order awaiting payment was paid.
async function confirmMayaPayment(env, order) {
  if (order.status !== "awaiting_payment") return order;
  const keys = await mayaKeys(env, order.branch_id);
  let paid = null;
  if (keys) {
    const res = await fetch(`${MAYA}/payments/v1/payment-rrns/${order.id}`, { headers: { authorization: basic(keys.secret_key) } });
    const list = res.ok ? await res.json().catch(() => []) : [];
    paid = (Array.isArray(list) ? list : []).find((p) => p.isPaid && Number(p.amount) >= Number(order.total) - 0.01) || null;
  }
  let patch = null;
  if (paid) {
    patch = { status: "new", payment_status: "paid", paid_at: new Date().toISOString(), payment_reference: String(paid.id || "").slice(0, 40) };
  } else if (Date.now() - new Date(order.created_date).getTime() > PAY_WINDOW_MS) {
    patch = { status: "cancelled", cancelled_at: new Date().toISOString(), status_note: "The online payment wasn't completed, so this order was cancelled." };
  }
  if (!patch) return order;
  // Only move it if it's still awaiting payment, so two checks at once can't both change it.
  const res = await pos(env, `online_order?id=eq.${order.id}&status=eq.awaiting_payment`, {
    method: "PATCH",
    body: patch,
    headers: { prefer: "return=representation" },
  });
  const [updated] = await res.json();
  return updated ? { ...order, ...updated } : order;
}

async function mayaWebhook(request, env) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.requestReferenceNumber || "");
  if (/^[a-f0-9]{32}$/.test(id)) {
    const [o] = await rows(env, `online_order?select=id,branch_id,status,total,created_date&id=eq.${id}&limit=1`);
    if (o) await confirmMayaPayment(env, o);
  }
  return json({ ok: true });
}

function publicStore(s) {
  return {
    id: s.branch_id,
    name: s.display_name,
    address: s.address,
    latitude: s.latitude,
    longitude: s.longitude,
    allow_delivery: s.allow_delivery !== false,
    delivery: {
      base_fee: s.delivery_base_fee,
      base_km: s.delivery_base_km,
      per_km: s.delivery_per_km,
      max_km: s.delivery_max_km,
    },
    qrph_image_url: s.qrph_image_url || null,
    online_pay: !!s.online_pay,
    sold_out: soldOut(s),
    ...storeStatus(s),
  };
}

async function listStores(env) {
  const stores = await loadStores(env);
  return json({ stores: stores.map(publicStore), cod_limit: COD_LIMIT, road_factor: ROAD_FACTOR });
}

// Same rule the POS uses to decide which modifiers apply to a product.
function modifierApplies(m, product) {
  if (m.exclude_product_ids?.includes(product.id)) return false;
  const labels = m.apply_to_labels || [];
  const cats = m.apply_to_categories || [];
  const labelMatch = !labels.length || (product.labels || []).some((l) => labels.includes(l));
  const catMatch = !cats.length || cats.includes(product.category_id);
  return labelMatch && catMatch;
}

async function loadCatalog(env) {
  const c = companyId(env);
  const [categories, products, recipes, modifiers] = await Promise.all([
    rows(env, `category?select=id,name,sort_order,is_active&company_id=eq.${c}&order=sort_order`),
    rows(env, `product?select=id,name,category_id,price,description,image_url,labels,is_employee_only,is_addon_only,open_price&company_id=eq.${c}&is_active=eq.true&order=name`),
    rows(env, `recipe?select=id,product_id,name,option_name,price&company_id=eq.${c}`),
    rows(env, `modifier?select=id,name,options,apply_to_labels,apply_to_categories,exclude_product_ids,is_required,allow_multiple&company_id=eq.${c}&is_active=eq.true`),
  ]);
  const cats = categories.filter((x) => x.is_active !== false && !HIDDEN_CATEGORIES.test(x.name || ""));
  const catIds = new Set(cats.map((x) => x.id));
  const prods = products.filter(
    (p) => catIds.has(p.category_id) && !p.is_employee_only && !p.is_addon_only && !p.open_price && !(p.labels || []).includes("GrabFood") && !/\(grab\)/i.test(p.name || ""),
  );
  const optionsByProduct = {};
  for (const r of recipes) (optionsByProduct[r.product_id] ||= []).push(r);
  return { cats, prods, optionsByProduct, modifiers };
}

async function menu(env) {
  const { cats, prods, optionsByProduct, modifiers } = await loadCatalog(env);
  const mods = modifiers.map((m) => ({
    id: m.id,
    name: m.name,
    required: !!m.is_required,
    multiple: !!m.allow_multiple,
    options: (m.options || []).filter((o) => o?.label).map((o) => ({ label: o.label, price: Number(o.price_adjustment || 0), default: !!o.is_default })),
  }));
  const usedCats = new Set(prods.map((p) => p.category_id));
  return json(
    {
      categories: cats.filter((x) => usedCats.has(x.id)).map((x) => ({ id: x.id, name: x.name })),
      products: prods.map((p) => {
        const opts = optionsByProduct[p.id] || [];
        return {
          id: p.id,
          name: p.name,
          category_id: p.category_id,
          price: Number(p.price || 0),
          description: p.description || "",
          image_url: p.image_url || null,
          options: opts.length > 1 ? opts.map((r) => ({ id: r.id, name: r.option_name || r.name, price: Number(r.price || 0) })) : [],
          base_extra: opts.length === 1 ? Number(opts[0].price || 0) : 0,
          modifier_ids: modifiers.filter((m) => modifierApplies(m, p)).map((m) => m.id),
        };
      }),
      modifiers: mods,
    },
    200,
    { "cache-control": "public, max-age=60" },
  );
}

// Rebuilds each line from the POS catalog; returns { lines } or { error }.
function priceLines(items, catalog) {
  const { prods, optionsByProduct, modifiers } = catalog;
  if (!Array.isArray(items) || !items.length) return { error: "Your basket is empty." };
  if (items.length > 40) return { error: "That's a lot of items. Please call the store for big orders." };
  const lines = [];
  for (const it of items) {
    const p = prods.find((x) => x.id === it?.product_id);
    if (!p) return { error: "An item in your basket is no longer available. Please remove it." };
    const qty = Number(it.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) return { error: `Check the quantity of ${p.name}.` };
    const opts = optionsByProduct[p.id] || [];
    let recipe = opts.length === 1 ? opts[0] : null;
    if (opts.length > 1) {
      recipe = opts.find((r) => r.id === it.recipe_id);
      if (!recipe) return { error: `Pick an option for ${p.name}.` };
    }
    let unit = Number(p.price || 0) + Number(recipe?.price || 0);
    const chosen = {};
    for (const m of modifiers.filter((m) => modifierApplies(m, p))) {
      const raw = it.modifiers?.[m.id];
      const picked = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String);
      const valid = picked.filter((l) => (m.options || []).some((o) => o.label === l));
      if (valid.length !== picked.length) return { error: `${p.name}: an option is no longer available.` };
      const labels = m.allow_multiple ? [...new Set(valid)] : valid.slice(0, 1);
      // The item sheet starts from the defaults, so an absent choice means the customer unticked it.
      const final = labels;
      if (m.is_required && !final.length) return { error: `Choose ${m.name} for ${p.name}.` };
      if (!final.length) continue;
      chosen[m.id] = m.allow_multiple ? final : final[0];
      for (const l of final) unit += Number(m.options.find((o) => o.label === l)?.price_adjustment || 0);
    }
    unit = round2(unit);
    lines.push({
      product_id: p.id,
      product_name: p.name,
      recipe_id: recipe?.id || null,
      recipe_option_name: opts.length > 1 ? recipe.option_name || recipe.name : null,
      modifiers: chosen,
      modifier_labels: Object.values(chosen).flat(),
      quantity: qty,
      unit_price: unit,
      line_total: round2(unit * qty),
      note: clean(it.note, 120),
    });
  }
  return { lines };
}

async function uploadProof(env, id, dataUrl) {
  const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const bytes = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0));
  if (bytes.length > 4 * 1024 * 1024) throw Object.assign(new Error("too big"), { userMessage: "That photo is too big. Please use a screenshot." });
  const path = `online-orders/${id}.${m[2] === "jpeg" ? "jpg" : m[2]}`;
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${PRIVATE_BUCKET}/${path}`, {
    method: "POST",
    headers: { ...keyHeaders(env), "content-type": m[1], "x-upsert": "true" },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Storage upload: ${res.status} ${await res.text()}`);
  return `private-files/${path}`;
}

async function placeOrder(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid request");
  }
  if (body.website) return json({ ok: true });

  const stores = await loadStores(env);
  const store = stores.find((s) => s.branch_id === body.store_id);
  if (!store) return bad("Please pick a store.");
  const st = storeStatus(store);
  // A QRPh customer has already paid, so their order is always recorded; staff see why and can refund.
  const paidQr = body.payment_method === "qrph" && !!body.payment_proof;
  const issues = [];
  if (st.paused && paidQr) issues.push("Paid by QRPh while online orders were paused");
  else if (!st.open && paidQr) issues.push("Paid by QRPh while the store was closed for online orders");
  else if (st.paused) return bad(`${store.display_name} is busy and isn't taking online orders right now. Please try again in a bit or pick another store.`, 409);
  if (!st.open && !paidQr) return bad(`${store.display_name} is closed for online orders right now.`, 409);

  const name = clean(body.name, 60);
  const phone = String(body.phone ?? "").replace(/[\s()-]/g, "");
  if (!name) return bad("Please enter your name.");
  if (!/^(09|\+639)\d{9}$/.test(phone)) return bad("Please enter a valid mobile number, like 0917 123 4567.");
  const fulfillment = body.fulfillment === "delivery" ? "delivery" : "pickup";

  let distance = null;
  let fee = 0;
  let lat = null;
  let lng = null;
  const address = clean(body.address, 300);
  if (fulfillment === "delivery") {
    if (store.allow_delivery === false) return bad(`${store.display_name} doesn't deliver right now. Please choose pickup.`);
    lat = Number(body.latitude);
    lng = Number(body.longitude);
    if (body.latitude == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return bad("Please share your location so we know where to deliver.");
    }
    if (!address) return bad("Please enter your delivery address.");
    distance = Math.round(distanceKm(store.latitude, store.longitude, lat, lng) * 10) / 10;
    const max = Number(store.delivery_max_km ?? 10);
    if (distance > max) return bad(`You're about ${distance} km from ${store.display_name}. We only deliver up to ${max} km. Try a nearer store or pickup.`);
    fee = deliveryFee(store, distance);
  }

  const catalog = await loadCatalog(env);
  const priced = priceLines(body.items, catalog);
  if (priced.error) return bad(priced.error);
  const gone = new Set(soldOut(store));
  const out = [...new Set(priced.lines.filter((l) => gone.has(l.product_id)).map((l) => l.product_name))].join(", ");
  if (out && paidQr) issues.push(`Sold out online: ${out}`);
  else if (out) return bad(`${out} ${out.includes(", ") ? "are" : "is"} sold out at ${store.display_name}. Please remove ${out.includes(", ") ? "them" : "it"} from your basket.`, 409);
  const subtotal = round2(priced.lines.reduce((s, l) => s + l.line_total, 0));
  const total = round2(subtotal + fee);
  if (body.expected_total != null && Math.abs(Number(body.expected_total) - total) > 0.01) {
    if (paidQr) issues.push(`Customer saw ₱${Number(body.expected_total).toFixed(2)}, POS prices now give ₱${total.toFixed(2)}`);
    else return bad("Prices changed since you added these items. Please check your basket and order again.", 409);
  }

  const method = body.payment_method;
  if (method === "cod") {
    if (total >= COD_LIMIT) return bad(`Cash on delivery is only for orders under ₱${COD_LIMIT.toLocaleString("en-PH")}. Please pay online or with QR.`);
  } else if (method === "qrph") {
    if (!store.qrph_image_url) return bad(`${store.display_name} can't take GCash QR yet. Please choose another payment.`);
    if (!body.payment_proof) return bad("Please upload your GCash payment screenshot.");
  } else if (method === "maya" || method === "maya_qr") {
    if (!store.online_pay) return bad(`${store.display_name} can't take online payments yet. Please choose another payment.`);
  } else {
    return bad("Please choose how you'll pay.");
  }

  const ipHash = await sha256(`${request.headers.get("cf-connecting-ip") || "local"}:order:${env.SUPABASE_SERVICE_ROLE_KEY}`);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const recent = await rows(env, `online_order?select=id&ip_hash=eq.${ipHash}&created_date=gt.${encodeURIComponent(since)}&limit=${MAX_ORDERS_PER_HOUR}`);
  if (recent.length >= MAX_ORDERS_PER_HOUR) return bad("You've placed several orders already. Please call the store.", 429);

  const id = crypto.randomUUID().replace(/-/g, "");
  const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
  let proofUri = null;
  if (method === "qrph") {
    try {
      proofUri = await uploadProof(env, id, body.payment_proof);
    } catch (e) {
      if (e.userMessage) return bad(e.userMessage);
      throw e;
    }
    if (!proofUri) return bad("Please upload your payment screenshot as a photo (JPG or PNG).");
  }

  const online = method === "maya" || method === "maya_qr";
  const order = {
    id,
    company_id: store.company_id,
    branch_id: store.branch_id,
    order_number: `W-${token.slice(0, 6).toUpperCase()}`,
    status_token: token,
    status: online ? "awaiting_payment" : "new",
    fulfillment,
    customer_name: name,
    customer_phone: phone,
    customer_email: clean(body.email, 120),
    address: fulfillment === "delivery" ? address : "",
    address_notes: fulfillment === "delivery" ? clean(body.address_notes, 200) : "",
    latitude: lat,
    longitude: lng,
    distance_km: distance,
    items: priced.lines,
    notes: clean(body.notes, 300),
    status_note: issues.join(". "),
    subtotal,
    delivery_fee: fee,
    total,
    payment_method: method,
    payment_status: method === "qrph" ? "to_verify" : online ? "pending" : "unpaid",
    payment_reference: clean(body.payment_reference, 40),
    payment_proof_uri: proofUri,
    ip_hash: ipHash,
  };
  await pos(env, "online_order", { method: "POST", body: order, headers: { prefer: "return=minimal" } });
  if (online) {
    try {
      const keys = await mayaKeys(env, store.branch_id);
      if (!keys) throw new Error("Maya keys missing");
      const create = method === "maya_qr" ? createMayaQr : createMayaCheckout;
      const checkout = await create(keys, order, new URL(request.url).origin);
      await pos(env, `online_order?id=eq.${id}`, {
        method: "PATCH",
        body: { maya_checkout_id: checkout.checkoutId, maya_checkout_url: checkout.redirectUrl },
        headers: { prefer: "return=minimal" },
      });
      return json({ ok: true, token, order_number: order.order_number, pay_url: checkout.redirectUrl }, 201);
    } catch (e) {
      console.error(e);
      await pos(env, `online_order?id=eq.${id}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
      return bad("We couldn't start the online payment. Please try again or choose another payment.", 502);
    }
  }
  return json({ ok: true, token, order_number: order.order_number }, 201);
}

async function orderStatus(env, token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return bad("Order not found", 404);
  const [o] = await rows(
    env,
    `online_order?select=id,maya_checkout_url,order_number,status,status_note,fulfillment,branch_id,customer_name,address,items,subtotal,delivery_fee,total,payment_method,payment_status,created_date,accepted_at,ready_at,completed_at,cancelled_at&status_token=eq.${token}&limit=1`,
  );
  if (!o) return bad("Order not found", 404);
  Object.assign(o, await confirmMayaPayment(env, o));
  const [s] = await rows(env, `online_store?select=display_name,address&branch_id=eq.${o.branch_id}&limit=1`);
  const rest = { ...o, pay_url: o.status === "awaiting_payment" ? o.maya_checkout_url : null };
  delete rest.branch_id;
  delete rest.id;
  delete rest.maya_checkout_url;
  return json({
    ...rest,
    items: (o.items || []).map((l) => ({
      name: l.product_name,
      option: l.recipe_option_name,
      extras: l.modifier_labels || [],
      quantity: l.quantity,
      line_total: l.line_total,
      note: l.note,
    })),
    store: s ? { name: s.display_name, address: s.address } : null,
  });
}

export async function handleStore(request, env, pathname) {
  if (pathname === "/api/store/stores" && request.method === "GET") return listStores(env);
  if (pathname === "/api/store/menu" && request.method === "GET") return menu(env);
  if (pathname === "/api/store/orders" && request.method === "POST") return placeOrder(request, env);
  if (pathname === "/api/store/maya-webhook" && request.method === "POST") return mayaWebhook(request, env);
  const m = /^\/api\/store\/orders\/([^/]+)$/.exec(pathname);
  if (m && request.method === "GET") return orderStatus(env, m[1]);
  return null;
}
