export const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function distanceKm(aLat, aLng, bLat, bLng, roadFactor = 1.25) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h)) * roadFactor;
}

export const roundKm = (km) => Math.round(km * 10) / 10;

export function deliveryFee(store, km) {
  const d = store.delivery || {};
  const base = Number(d.base_fee ?? 49);
  const baseKm = Number(d.base_km ?? 2);
  const perKm = Number(d.per_km ?? 10);
  return Math.round((base + Math.max(0, Math.ceil(km - baseKm)) * perKm) * 100) / 100;
}

export function linePrice(product, option, modifiers, chosen) {
  let unit = product.price + (option ? option.price : product.base_extra || 0);
  for (const m of modifiers) {
    const picked = chosen[m.id];
    for (const l of Array.isArray(picked) ? picked : picked ? [picked] : []) unit += m.options.find((o) => o.label === l)?.price || 0;
  }
  return Math.round(unit * 100) / 100;
}

export function defaultChoices(modifiers) {
  const out = {};
  for (const m of modifiers) {
    const defs = m.options.filter((o) => o.default).map((o) => o.label);
    if (defs.length) out[m.id] = m.multiple ? defs : defs[0];
  }
  return out;
}

export async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

const fmtTime = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h)) return "";
  if (h === 24 || (h === 0 && !m)) return "midnight";
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "AM" : "PM"}`;
};
export const hoursLabel = (s) =>
  s.closed_today ? `Closed today${s.closed_note ? ` (${s.closed_note})` : ""}` : `Online orders today ${fmtTime(s.open_time)}–${fmtTime(s.last_order_time)}`;
export function closedMessage(s) {
  if (s.no_shift) return `${s.name} isn't taking online orders right now. Please try again in a bit.`;
  const why = s.closed_today
    ? `${s.name} is closed today${s.closed_note ? ` (${s.closed_note})` : ""}.`
    : `${s.name} is closed for online orders now. ${hoursLabel(s)}.`;
  return s.next_open ? `${why} Opens ${s.next_open.day} at ${fmtTime(s.next_open.time)}.` : why;
}

// Shrinks a photo to a JPEG data URL so uploads stay small on mobile data.
export function shrinkImage(file, max = 1400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that photo. Please try a screenshot."));
    };
    img.src = url;
  });
}
