import { useState } from "react";
import { ArrowLeft, LocateFixed, Minus, Plus } from "lucide-react";
import { api, deliveryFee, distanceKm, peso, roundKm, shrinkImage } from "@/lib/store";

export default function Checkout({ store, lines, setQty, codLimit, roadFactor, location, locating, requestLocation, onBack, onPlaced }) {
  const [fulfillment, setFulfillment] = useState(store.allow_delivery ? "delivery" : "pickup");
  const [form, setForm] = useState(() => JSON.parse(localStorage.getItem("rc-customer") || "{}"));
  const [payment, setPayment] = useState("");
  const [proof, setProof] = useState(null);
  const [proofTotal, setProofTotal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const km = location ? roundKm(distanceKm(store.latitude, store.longitude, location.lat, location.lng, roadFactor)) : null;
  const maxKm = Number(store.delivery?.max_km ?? 10);
  const tooFar = fulfillment === "delivery" && km != null && km > maxKm;
  const fee = fulfillment === "delivery" && km != null && !tooFar ? deliveryFee(store, km) : 0;
  const total = Math.round((subtotal + fee) * 100) / 100;
  const codOk = total < codLimit;
  const pay = payment === "cod" && !codOk ? "" : payment;

  const pickProof = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setProof(await shrinkImage(file));
      setProofTotal(total);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const place = async () => {
    setError("");
    if (fulfillment === "delivery" && !location) return setError("Please share your location so we know where to deliver.");
    if (!pay) return setError("Please choose how you'll pay.");
    if (pay === "qrph" && !proof) return setError("Please upload your QRPh payment screenshot.");
    if (pay === "qrph" && proofTotal !== total) return setError(`Your total changed to ${peso(total)} after you uploaded a receipt for ${peso(proofTotal)}. Upload a receipt for ${peso(total)}, or change your order back.`);
    setBusy(true);
    try {
      const { name, phone, email, address, address_notes } = form;
      localStorage.setItem("rc-customer", JSON.stringify({ name, phone, email, address, address_notes }));
      const res = await api("/api/store/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          store_id: store.id,
          fulfillment,
          name,
          phone,
          email,
          address,
          address_notes,
          latitude: fulfillment === "delivery" ? location?.lat : null,
          longitude: fulfillment === "delivery" ? location?.lng : null,
          notes: form.notes,
          payment_method: pay,
          payment_reference: form.payment_reference,
          payment_proof: pay === "qrph" ? proof : undefined,
          items: lines.map((l) => ({ product_id: l.product_id, recipe_id: l.recipe_id, modifiers: l.modifiers, quantity: l.quantity, note: l.note })),
          expected_total: total,
          website: form.website,
        }),
      });
      onPlaced(res.token);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <section className="container-page max-w-2xl py-10">
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm text-paper/70 hover:text-paper">
        <ArrowLeft className="h-4 w-4" /> Back to menu
      </button>
      <h1 className="section-title text-4xl sm:text-5xl">Checkout</h1>
      <p className="mt-2 text-paper/60">From {store.name}</p>

      <div className="mt-8 grid grid-cols-2 border border-white/15">
        {["delivery", "pickup"].map((f) => (
          <button
            key={f}
            disabled={f === "delivery" && !store.allow_delivery}
            onClick={() => setFulfillment(f)}
            className={`py-3 font-display text-sm uppercase tracking-[0.2em] disabled:opacity-40 ${fulfillment === f ? "bg-red-brand text-white" : "text-paper/70"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <Block title="Your order">
        <ul className="space-y-3">
          {lines.map((l) => (
            <li key={l.key} className="flex items-start gap-3 text-sm">
              <div className="flex items-center border border-white/15">
                <button className="p-1.5" onClick={() => setQty(l.key, l.quantity - 1)} aria-label="Less"><Minus className="h-3 w-3" /></button>
                <span className="w-6 text-center tabular-nums">{l.quantity}</span>
                <button className="p-1.5" onClick={() => setQty(l.key, l.quantity + 1)} aria-label="More"><Plus className="h-3 w-3" /></button>
              </div>
              <span className="flex-1">
                {l.name}
                {[l.option_name, ...l.labels].filter(Boolean).length > 0 && <span className="block text-paper/50">{[l.option_name, ...l.labels].filter(Boolean).join(", ")}</span>}
                {l.note && <span className="block italic text-paper/50">“{l.note}”</span>}
              </span>
              <span className="tabular-nums">{peso(l.unit_price * l.quantity)}</span>
            </li>
          ))}
        </ul>
      </Block>

      {fulfillment === "delivery" && (
        <Block title="Deliver to">
          <button onClick={requestLocation} className="btn-outline w-full gap-2 px-4" disabled={locating}>
            <LocateFixed className="h-4 w-4" /> {locating ? "Finding you…" : location ? "Update my location" : "Use my current location"}
          </button>
          {km != null && (
            <p className={`mt-3 text-sm ${tooFar ? "text-red-brand" : "text-paper/70"}`}>
              {tooFar ? `You're about ${km} km away. ${store.name} delivers up to ${maxKm} km. Try another store or pickup.` : `About ${km} km from ${store.name}. Delivery fee ${peso(fee)}.`}
            </p>
          )}
          <p className="mt-2 text-xs text-paper/50">We book a Lalamove or Grab Express rider for you. Stay at the location you shared.</p>
          <div className="mt-4 space-y-4">
            <Field label="Address" value={form.address} onChange={set("address")} placeholder="House/unit no., street, barangay" max={300} />
            <Field label="Landmark or notes for the rider" value={form.address_notes} onChange={set("address_notes")} placeholder="Optional" max={200} />
          </div>
        </Block>
      )}
      {fulfillment === "pickup" && (
        <Block title="Pick up at">
          <p>{store.name}</p>
          <p className="text-sm text-paper/60">{store.address}</p>
        </Block>
      )}

      <Block title="Your details">
        <div className="space-y-4">
          <Field label="Name" value={form.name} onChange={set("name")} max={60} autoComplete="name" />
          <Field label="Mobile number" value={form.phone} onChange={set("phone")} placeholder="0917 123 4567" type="tel" autoComplete="tel" max={16} />
          <Field label="Notes for the store" value={form.notes} onChange={set("notes")} placeholder="Optional" max={300} />
          <input className="hidden" tabIndex={-1} autoComplete="off" value={form.website || ""} onChange={set("website")} aria-hidden="true" />
        </div>
      </Block>

      <Block title="Payment">
        <div className="space-y-2">
          <PayOption id="cod" active={pay === "cod"} onClick={setPayment} disabled={!codOk} label={fulfillment === "delivery" ? "Cash on delivery" : "Cash on pickup"} hint={codOk ? "" : `Only for orders under ${peso(codLimit)}`} />
          <PayOption id="qrph" active={pay === "qrph"} onClick={setPayment} disabled={!store.qrph_image_url} label="QRPh (any bank or e-wallet)" hint={store.qrph_image_url ? "Scan our QR, then upload your receipt" : "Not available at this store yet"} />
          <PayOption id="gcash" disabled label="GCash" hint="Coming soon" />
          <PayOption id="card" disabled label="Credit / debit card" hint="Coming soon" />
        </div>
        {pay === "qrph" && (
          <div className="mt-5 border border-white/10 p-4">
            <p className="text-sm text-paper/70">Pay exactly <span className="font-display text-cream">{peso(total)}</span> to this QR code, then upload a screenshot of the receipt.</p>
            <img src={store.qrph_image_url} alt={`${store.name} QRPh code`} className="mx-auto mt-4 w-full max-w-xs bg-white p-2" />
            <a href={store.qrph_image_url} download className="mt-2 block text-center text-xs text-paper/60 underline">Save QR image</a>
            <label className="btn-outline mt-4 w-full cursor-pointer px-4">
              {proof ? "Change screenshot" : "Upload payment screenshot"}
              <input type="file" accept="image/*" className="hidden" onChange={pickProof} />
            </label>
            {proof && <img src={proof} alt="Your payment screenshot" className="mx-auto mt-3 max-h-60" />}
            {proof && proofTotal !== total && <p className="mt-2 text-sm text-red-300">This receipt was for {peso(proofTotal)}, but your total is now {peso(total)}.</p>}
            <div className="mt-4">
              <Field label="Reference no." value={form.payment_reference} onChange={set("payment_reference")} placeholder="Optional" max={40} />
            </div>
          </div>
        )}
      </Block>

      <div className="mt-8 space-y-1 border-t border-white/10 pt-5 text-sm">
        <Row label="Subtotal" value={peso(subtotal)} />
        {fulfillment === "delivery" && <Row label="Delivery fee" value={location ? peso(fee) : "Share your location"} />}
        <Row label="Total" value={peso(total)} strong />
      </div>
      {error && <p className="mt-4 text-sm text-red-brand">{error}</p>}
      <button className="btn-solid mt-6 w-full" onClick={place} disabled={busy || tooFar || !lines.length}>
        {busy ? "Placing order…" : `Place order · ${peso(total)}`}
      </button>
    </section>
  );
}

const Block = ({ title, children }) => (
  <div className="mt-8">
    <h2 className="mb-4 font-display text-sm uppercase tracking-[0.2em] text-cream">{title}</h2>
    {children}
  </div>
);

const Field = ({ label, max, ...props }) => (
  <label className="block">
    <span className="label">{label}</span>
    <input className="field" maxLength={max} {...props} value={props.value || ""} />
  </label>
);

const PayOption = ({ id, active, onClick, disabled, label, hint }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => onClick?.(id)}
    className={`flex w-full items-center gap-3 border px-4 py-3 text-left disabled:opacity-40 ${active ? "border-red-brand bg-red-brand/10" : "border-white/10"}`}
  >
    <span className={`h-4 w-4 shrink-0 rounded-full border ${active ? "border-red-brand bg-red-brand" : "border-white/40"}`} />
    <span className="flex-1">{label}</span>
    {hint && <span className="text-xs text-paper/50">{hint}</span>}
  </button>
);

const Row = ({ label, value, strong }) => (
  <div className={`flex justify-between ${strong ? "font-display text-lg text-cream" : "text-paper/70"}`}>
    <span>{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);
