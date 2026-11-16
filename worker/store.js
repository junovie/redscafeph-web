// Online store API: stores, menu (from the POS catalog), placing orders and order status.
// Everything runs with the service role key, so every input is validated and every price
// is recomputed here from the POS data, never trusted from the browser.

import { AREA_LABEL, COD_MAX, INTERCITY_MAX_KM, PAID_METHODS, ROAD_FACTOR, codAllowed, deliveryQuote, distanceKm } from "../src/lib/delivery.js";
import { ID_KINDS, MAX_IDS, discountBase, idDiscount } from "../src/lib/discount.js";

const MAX_ORDERS_PER_HOUR = 5;
const HIDDEN_CATEGORIES = /^(grab\b|employee only|misc charges)/i;
export const PRIVATE_BUCKET = "order-private-files";
const MAYA = "https://pg.paymaya.com";
const PAY_WINDOW_MS = 70 * 60_000;

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

export const bad = (error, status = 400) => json({ error }, status);
export const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const round2 = (n) => Math.round(n * 100) / 100;

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function keyHeaders(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  return { apikey: key, ...(key.startsWith("eyJ") ? { authorization: `Bearer ${key}` } : {}) };
}

export async function pos(env, path, { method = "GET", body, headers = {} } = {}) {
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
export const rows = async (env, path) => (await pos(env, path)).json();

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
  return {
    open: open && !paused,
    paused: !!paused,
    paused_until: paused ? s.paused_until : null,
    open_time: today.open || null,
    last_order_time: today.last_order || null,
    closed_today: today.closed,
    closed_note: today.note || "",
    next_open,
  };
}

async function loadStores(env) {
  const [stores, pays] = await Promise.all([
    rows(env, `online_store?select=*&company_id=eq.${companyId(env)}&is_enabled=eq.true&order=display_name`),
    rows(env, `online_store_payment?select=branch_id&company_id=eq.${companyId(env)}`),
  ]);
  const online = new Set(pays.map((p) => p.branch_id));
  return stores.map((s) => ({ ...s, online_pay: online.has(s.branch_id) }));
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
        ...order.items.map((l) => ({ name: l.product_name.slice(0, 100), quantity: l.quantity, totalAmount: { value: round2(l.line_total - (l.discount_amount || 0)) } })),
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
    qrph_image_url: s.qrph_image_url || null,
    online_pay: !!s.online_pay,
    ...storeStatus(s),
  };
}

const ROUTES = "https://routes.googleapis.com/directions/v2:computeRoutes";
const ROUTE_CACHE_SECONDS = 30 * 86400;
const ROUTE_LOOKUPS_PER_HOUR = 20;

// Rough per-IP cap on Google lookups (per Cloudflare location); past it the caller estimates instead.
async function routeLookupAllowed(cache, request, env) {
  if (!cache) return true;
  const ip = await sha256(`${request.headers.get("cf-connecting-ip") || "local"}:route:${env.SUPABASE_SERVICE_ROLE_KEY}`);
  const key = new Request(`https://route-cache.redscafeph.com/limit/${ip}/${Math.floor(Date.now() / 3600_000)}`);
  const used = Number(await (await cache.match(key).catch(() => null))?.text()) || 0;
  if (used >= ROUTE_LOOKUPS_PER_HOUR) return false;
  await cache.put(key, new Response(String(used + 1), { headers: { "cache-control": "max-age=3600" } })).catch(() => {});
  return true;
}

// Google's driving distance in km from the store to the pin (snapped to ~11 m), cached per store and
// pin, or null (no key, pin beyond the delivery limit, lookup cap hit, or Google failed) so the caller estimates.
async function roadKm(request, env, store, pinLat, pinLng) {
  const lat = Math.round(pinLat * 1e4) / 1e4;
  const lng = Math.round(pinLng * 1e4) / 1e4;
  const key = env.GOOGLE_ROUTES_KEY;
  if (!key || distanceKm(store.latitude, store.longitude, lat, lng, 1) > INTERCITY_MAX_KM) return null;
  const cacheKey = new Request(`https://route-cache.redscafeph.com/${store.branch_id}/${store.latitude},${store.longitude}/${lat},${lng}`);
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const hit = await cache?.match(cacheKey).catch(() => null);
  if (hit) return Number(await hit.text());
  if (!(await routeLookupAllowed(cache, request, env))) return null;
  try {
    const point = (latitude, longitude) => ({ location: { latLng: { latitude, longitude } } });
    const res = await fetch(ROUTES, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key, "x-goog-fieldmask": "routes.distanceMeters" },
      body: JSON.stringify({ origin: point(store.latitude, store.longitude), destination: point(lat, lng), travelMode: "DRIVE" }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Routes API: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const meters = (await res.json()).routes?.[0]?.distanceMeters;
    if (!Number.isFinite(meters)) return null;
    const km = meters / 1000;
    await cache?.put(cacheKey, new Response(String(km), { headers: { "cache-control": `max-age=${ROUTE_CACHE_SECONDS}` } })).catch(() => {});
    return km;
  } catch (e) {
    console.error(e);
    return null;
  }
}

function readPin(body) {
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  if (body.latitude == null || body.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

const deliveryQuoteFor = async (request, env, store, { lat, lng }) => deliveryQuote(store, lat, lng, await roadKm(request, env, store, lat, lng));

async function quoteDelivery(request, env) {
  const body = await request.json().catch(() => ({}));
  const pin = readPin(body);
  if (!pin) return bad("Please set your pin.");
  const store = (await loadStores(env)).find((s) => s.branch_id === body.store_id);
  if (!store) return bad("Please pick a store.");
  return json(await deliveryQuoteFor(request, env, store, pin));
}

async function listStores(env) {
  const stores = await loadStores(env);
  return json({ stores: stores.map(publicStore), cod_limit: COD_MAX, road_factor: ROAD_FACTOR, maps_key: env.GOOGLE_MAPS_KEY || null });
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
  const [categories, products, recipes, modifiers, discountTypes] = await Promise.all([
    rows(env, `category?select=id,name,sort_order,is_active&company_id=eq.${c}&order=sort_order`),
    rows(env, `product?select=id,name,category_id,type,price,description,image_url,labels,is_employee_only,is_addon_only,open_price&company_id=eq.${c}&is_active=eq.true&order=name`),
    rows(env, `recipe?select=id,product_id,name,option_name,price&company_id=eq.${c}`),
    rows(env, `modifier?select=id,name,options,apply_to_labels,apply_to_categories,exclude_product_ids,is_required,allow_multiple,include_in_discounts&company_id=eq.${c}&is_active=eq.true`),
    rows(env, `discount_type?select=name,discount_type,discount_value,applicable_category_ids,excluded_category_ids,excluded_product_ids,is_active&company_id=eq.${c}`),
  ]);
  const cats = categories.filter((x) => x.is_active !== false && !HIDDEN_CATEGORIES.test(x.name || ""));
  const catIds = new Set(cats.map((x) => x.id));
  const prods = products.filter(
    (p) => catIds.has(p.category_id) && !p.is_employee_only && !p.is_addon_only && !p.open_price && !(p.labels || []).includes("GrabFood") && !/\(grab\)/i.test(p.name || ""),
  );
  const optionsByProduct = {};
  for (const r of recipes) (optionsByProduct[r.product_id] ||= []).push(r);
  return { cats, prods, optionsByProduct, modifiers, idRules: idRules(discountTypes) };
}

// The POS's Senior Citizen/PWD and Student discount types, as rules for online orders.
function idRules(types) {
  const pick = (re) => {
    const d = types.find((t) => t.is_active !== false && t.discount_type === "percentage" && re.test(t.name || ""));
    if (!d || !(Number(d.discount_value) > 0)) return null;
    return {
      name: d.name,
      percent: Number(d.discount_value),
      applicable_category_ids: d.applicable_category_ids || [],
      excluded_category_ids: d.excluded_category_ids || [],
      excluded_product_ids: d.excluded_product_ids || [],
    };
  };
  return { sc_pwd: pick(/senior|pwd/i), student: pick(/student/i) };
}

const productKind = (p) => (p.type === "food" || p.type === "drink" ? p.type : null);
const publicModifier = (m) => ({
  id: m.id,
  no_discount: m.include_in_discounts === false,
  options: (m.options || []).filter((o) => o?.label).map((o) => ({ label: o.label, price: Number(o.price_adjustment || 0) })),
});

async function menu(env) {
  const { cats, prods, optionsByProduct, modifiers, idRules: rules } = await loadCatalog(env);
  const mods = modifiers.map((m) => ({
    id: m.id,
    no_discount: m.include_in_discounts === false,
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
          kind: productKind(p),
          price: Number(p.price || 0),
          description: p.description || "",
          image_url: p.image_url || null,
          options: opts.length > 1 ? opts.map((r) => ({ id: r.id, name: r.option_name || r.name, price: Number(r.price || 0) })) : [],
          base_extra: opts.length === 1 ? Number(opts[0].price || 0) : 0,
          modifier_ids: modifiers.filter((m) => modifierApplies(m, p)).map((m) => m.id),
        };
      }),
      modifiers: mods,
      id_discounts: Object.fromEntries(Object.entries(rules).filter(([, r]) => r)),
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
      category_id: p.category_id,
      kind: productKind(p),
      discount_base: discountBase(unit, chosen, modifiers.map(publicModifier)),
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
  if (!st.open) return bad(`${store.display_name} is closed for online orders right now.`, 409);

  const name = clean(body.name, 60);
  const phone = String(body.phone ?? "").replace(/[\s()-]/g, "");
  if (!name) return bad("Please enter your name.");
  if (!/^(09|\+639)\d{9}$/.test(phone)) return bad("Please enter a valid mobile number, like 0917 123 4567.");
  const fulfillment = body.fulfillment === "delivery" ? "delivery" : "pickup";

  const method = body.payment_method;
  let distance = null;
  let fee = 0;
  let lat = null;
  let lng = null;
  const address = clean(body.address, 300);
  if (fulfillment === "delivery") {
    if (store.allow_delivery === false) return bad(`${store.display_name} doesn't deliver right now. Please choose pickup.`);
    const pin = readPin(body);
    if (!pin) return bad("Please share your location so we know where to deliver.");
    ({ lat, lng } = pin);
    if (!address) return bad("Please enter your delivery address.");
    // Outside Cebu City and Mandaue City the order must be paid online first.
    const quote = await deliveryQuoteFor(request, env, store, pin);
    distance = quote.km;
    if (quote.tooFar) return bad(`You're about ${distance} km from ${store.display_name}. Outside ${AREA_LABEL.cebu_city} and ${AREA_LABEL.mandaue} we deliver up to ${INTERCITY_MAX_KM} km. Try a nearer store or pickup.`);
    if (quote.intercity && !PAID_METHODS.includes(method)) {
      return bad(`Your pin is outside ${AREA_LABEL.cebu_city} and ${AREA_LABEL.mandaue}, so please pay online or with QR. Cash on delivery is only inside the two cities.`);
    }
    fee = quote.fee;
    // The fee can differ from the one shown if Google's distance wasn't available for one of the two lookups.
    if (!paidQr && body.expected_fee != null && Math.abs(Number(body.expected_fee) - fee) > 0.01) {
      return json({ error: `The delivery fee is now ₱${fee}. Please check your total and place the order again.`, delivery_quote: quote }, 409);
    }
  }

  const catalog = await loadCatalog(env);
  const priced = priceLines(body.items, catalog);
  if (priced.error) return bad(priced.error);
  const subtotal = round2(priced.lines.reduce((s, l) => s + l.line_total, 0));
  // Staff check the ID photos before accepting; an invalid ID gets the order cancelled.
  const discountKind = Object.hasOwn(ID_KINDS, body.discount_kind || "") ? body.discount_kind : null;
  const idPhotos = discountKind && Array.isArray(body.id_photos) ? body.id_photos : [];
  let discount = null;
  if (discountKind) {
    const rule = catalog.idRules[discountKind];
    if (!rule) return bad(`The ${ID_KINDS[discountKind]} discount isn't available online right now.`);
    if (!idPhotos.length) return bad("Please upload a photo of each ID.");
    if (idPhotos.length > MAX_IDS) return bad(`Up to ${MAX_IDS} IDs per online order. For bigger groups, please call the store.`);
    discount = idDiscount(priced.lines, rule, idPhotos.length);
    if (!discount.total) return bad(`None of the items in your basket get the ${ID_KINDS[discountKind]} discount.`);
  }
  const lines = priced.lines.map((l, i) => (discount?.lines[i].qty ? { ...l, discount_qty: discount.lines[i].qty, discount_amount: discount.lines[i].amount } : l));
  const discountAmount = discount?.total || 0;
  const total = round2(subtotal - discountAmount + fee);
  if (body.expected_total != null && Math.abs(Number(body.expected_total) - total) > 0.01) {
    if (paidQr) issues.push(`Customer saw ₱${Number(body.expected_total).toFixed(2)}, POS prices now give ₱${total.toFixed(2)}`);
    else return bad("Prices changed since you added these items. Please check your basket and order again.", 409);
  }

  if (method === "cod") {
    if (!codAllowed(total)) return bad(`Cash is only for orders of ₱${COD_MAX} or less. Please pay online or with QR.`);
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
  let idUris = null;
  if (discountKind) {
    try {
      idUris = await Promise.all(idPhotos.map((photo, n) => uploadProof(env, `${id}-id${n + 1}`, photo)));
    } catch (e) {
      if (e.userMessage) return bad(e.userMessage);
      throw e;
    }
    if (idUris.some((u) => !u)) return bad("Please upload each ID as a photo (JPG or PNG).");
  }
  // Points go to the member with this number. It's looked up only after the rate limit, so it can't be probed.
  const loyaltyDigits = String(body.loyalty_phone ?? "").replace(/\D/g, "").slice(-10);
  const member = loyaltyDigits.length === 10 ? await findLoyaltyMember(env, store.company_id, loyaltyDigits) : null;

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
    items: lines,
    notes: clean(body.notes, 300),
    status_note: issues.join(". "),
    subtotal,
    discount_kind: discountKind,
    discount_id_count: discountKind ? idPhotos.length : null,
    discount_id_uris: idUris,
    discount_amount: discountAmount,
    loyalty_phone: loyaltyDigits.length === 10 ? `0${loyaltyDigits}` : null,
    loyalty_customer_id: member?.id || null,
    loyalty_name: member?.full_name || null,
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

async function findLoyaltyMember(env, companyId, last10) {
  const found = await rows(env, `loyalty_customer?select=id,full_name,phone,points_balance&company_id=eq.${companyId}&is_active=not.is.false&phone=like.*${last10.slice(-4)}&limit=200`);
  return (
    found
      .filter((c) => String(c.phone || "").replace(/\D/g, "").slice(-10) === last10)
      .sort((a, b) => (b.points_balance || 0) - (a.points_balance || 0))[0] || null
  );
}

async function orderStatus(env, token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return bad("Order not found", 404);
  const [o] = await rows(
    env,
    `online_order?select=id,maya_checkout_url,order_number,status,status_note,fulfillment,branch_id,customer_name,address,items,subtotal,discount_kind,discount_id_count,discount_amount,loyalty_phone,loyalty_customer_id,delivery_fee,total,payment_method,payment_status,created_date,accepted_at,ready_at,completed_at,cancelled_at,rider_name,rider_assigned_at,picked_up_at,delivered_at&status_token=eq.${token}&limit=1`,
  );
  if (!o) return bad("Order not found", 404);
  Object.assign(o, await confirmMayaPayment(env, o));
  const [s] = await rows(env, `online_store?select=display_name,address&branch_id=eq.${o.branch_id}&limit=1`);
  const rest = { ...o, rider_name: (o.rider_name || "").split(" ")[0] || null, pay_url: o.status === "awaiting_payment" ? o.maya_checkout_url : null };
  delete rest.branch_id;
  delete rest.id;
  delete rest.maya_checkout_url;
  delete rest.loyalty_customer_id;
  return json({
    ...rest,
    discount_label: o.discount_kind ? ID_KINDS[o.discount_kind] : null,
    loyalty_linked: !!o.loyalty_customer_id,
    items: (o.items || []).map((l) => ({
      discount_qty: l.discount_qty || 0,
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

const MAP_HOSTS = /^(maps\.app\.goo\.gl|goo\.gl|(www\.|maps\.)?google\.com(\.ph)?)$/;

// Finds the coordinates in a Google Maps link. Short links are followed (Google hosts only).
async function resolveMapLink(url) {
  let link = String(url || "").trim();
  for (let hop = 0; hop < 5; hop++) {
    let u;
    try {
      u = new URL(link);
    } catch {
      return bad("That doesn't look like a Google Maps link.");
    }
    if (u.protocol !== "https:" || !MAP_HOSTS.test(u.hostname)) return bad("Please paste a Google Maps link.");
    const text = decodeURIComponent(u.href.replace(/\+/g, " "));
    const m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(text) || /[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(text) || /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(text);
    if (m) return json({ lat: Number(m[1]), lng: Number(m[2]) });
    if (!/goo\.gl$/.test(u.hostname)) break;
    const res = await fetch(u.href, { redirect: "manual" });
    const next = res.headers.get("location");
    if (!next) break;
    link = new URL(next, u.href).href;
  }
  return bad("We couldn't find a pin in that link. Drop a pin in Google Maps, tap Share, and copy the link.");
}

export async function handleStore(request, env, pathname) {
  if (pathname === "/api/store/map-link" && request.method === "GET") return resolveMapLink(new URL(request.url).searchParams.get("url"));
  if (pathname === "/api/store/stores" && request.method === "GET") return listStores(env);
  if (pathname === "/api/store/menu" && request.method === "GET") return menu(env);
  if (pathname === "/api/store/orders" && request.method === "POST") return placeOrder(request, env);
  if (pathname === "/api/store/delivery-quote" && request.method === "POST") return quoteDelivery(request, env);
  if (pathname === "/api/store/maya-webhook" && request.method === "POST") return mayaWebhook(request, env);
  const m = /^\/api\/store\/orders\/([^/]+)$/.exec(pathname);
  if (m && request.method === "GET") return orderStatus(env, m[1]);
  return null;
}
