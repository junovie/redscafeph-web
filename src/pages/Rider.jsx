import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, MapPin, Navigation, Phone } from "lucide-react";
import { api, peso, shrinkImage } from "@/lib/store";

// Rider's phone page, opened from the private link the store gives each rider.
export default function Rider() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(
    () =>
      api(`/api/rider/${token}`)
        .then((d) => (setData(d), setError("")))
        .catch((e) => setError(e.message)),
    [token],
  );
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const post = async (key, path, body) => {
    setBusy(key);
    setError("");
    try {
      const d = await api(`/api/rider/${token}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
      if (d.url) window.location.assign(d.url);
      else setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const deliver = async (o, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await post(o.id, `/orders/${o.id}/deliver`, { photo: await shrinkImage(file) });
    } catch (err) {
      setError(err.message);
    }
  };

  if (!data) return <Shell>{error ? <p className="text-red-brand">{error}</p> : <p className="text-paper/60">Loading…</p>}</Shell>;
  const { rider, store, orders, today } = data;

  return (
    <Shell>
      <p className="eyebrow">{store?.name || "Rider"}</p>
      <h1 className="section-title mt-2 text-4xl">Hi, {rider.name}</h1>

      <div className="mt-6 grid grid-cols-2 border border-white/15">
        {[["available", "Available"], ["offline", "Offline"]].map(([s, label]) => (
          <button
            key={s}
            disabled={rider.status === "on_delivery" || !!busy}
            onClick={() => post("status", "/status", { status: s })}
            className={`py-3 font-display text-sm uppercase tracking-[0.2em] disabled:opacity-60 ${rider.status === s ? "bg-red-brand text-white" : "text-paper/70"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-paper/60">
        {rider.status === "on_delivery" ? "On delivery. You'll be available again after your last drop-off." : rider.status === "available" ? "You're in the queue for the next delivery." : "You won't get deliveries while offline."}
      </p>
      {!rider.telegram && (
        <button className="btn-outline mt-4 w-full" disabled={!!busy} onClick={() => post("tg", "/telegram")}>Get delivery alerts on Telegram</button>
      )}
      {error && <p className="mt-4 text-sm text-red-brand">{error}</p>}

      {orders.map((o) => (
        <div key={o.id} className="card mt-6 p-5">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-lg text-cream">{o.order_number}</p>
            <span className="text-xs uppercase tracking-[0.2em] text-paper/60">{o.status === "ready" ? "On the way" : "Pick up at store"}</span>
          </div>
          <p className="mt-3">{o.customer_name}</p>
          <a href={`tel:${o.customer_phone}`} className="mt-1 inline-flex items-center gap-2 text-sm underline"><Phone className="h-4 w-4" />{o.customer_phone}</a>
          <p className="mt-3 flex gap-2 text-sm text-paper/80"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{o.address}{o.address_notes ? ` · ${o.address_notes}` : ""}</p>
          <a className="btn-outline mt-3 w-full gap-2" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${o.latitude},${o.longitude}&travelmode=two-wheeler`}>
            <Navigation className="h-4 w-4" /> Open in Google Maps
          </a>
          <ul className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
            {o.items.map((l, i) => (
              <li key={i}>{l.quantity}× {l.name}{[l.option, ...l.extras].filter(Boolean).length ? ` (${[l.option, ...l.extras].filter(Boolean).join(", ")})` : ""}{l.note ? ` — “${l.note}”` : ""}</li>
            ))}
          </ul>
          {o.notes && <p className="mt-2 text-sm italic text-paper/60">Note: {o.notes}</p>}
          <p className="mt-4 font-display text-xl text-cream">{o.collect ? `Collect ${peso(o.collect)} cash` : "Paid online. Collect ₱0"}</p>
          <p className="text-xs text-paper/50">Your delivery fee: {peso(o.delivery_fee)}</p>
          {o.status === "accepted" ? (
            <button className="btn-solid mt-4 w-full" disabled={!!busy} onClick={() => post(o.id, `/orders/${o.id}/pickup`)}>{busy === o.id ? "Saving…" : "Picked up"}</button>
          ) : (
            <label className={`btn-solid mt-4 w-full cursor-pointer gap-2 ${busy ? "pointer-events-none opacity-60" : ""}`}>
              <Camera className="h-4 w-4" /> {busy === o.id ? "Saving…" : "Delivered: take photo"}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => deliver(o, e)} />
            </label>
          )}
        </div>
      ))}
      {!orders.length && <p className="mt-8 text-paper/60">No deliveries right now.</p>}

      <div className="mt-10 border-t border-white/10 pt-5 text-sm text-paper/70">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-cream">Today</p>
        <p className="mt-2">{today.deliveries} deliveries · Delivery fees {peso(today.fees_earned)} · COD collected {peso(today.cod_collected)}</p>
        <p className="mt-1 text-xs text-paper/50">Hand all COD cash to the cashier at the end of your shift.</p>
      </div>
    </Shell>
  );
}

const Shell = ({ children }) => <section className="container-page max-w-xl py-12">{children}</section>;
