import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, peso } from "@/lib/store";

const STEPS = {
  pickup: [
    ["new", "Order sent", "Waiting for the store to accept it."],
    ["accepted", "Preparing", "The store is making your order."],
    ["ready", "Ready for pickup", "Your order is ready. Show your order number at the counter."],
    ["completed", "Picked up", "Enjoy!"],
  ],
  delivery: [
    ["new", "Order sent", "Waiting for the store to accept it."],
    ["accepted", "Preparing", "The store is making your order."],
    ["ready", "On the way", "A rider is bringing your order."],
    ["completed", "Delivered", "Enjoy!"],
  ],
};

export default function OrderStatus() {
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    const load = () =>
      api(`/api/store/orders/${token}`)
        .then((o) => !stop && (setOrder(o), setError("")))
        .catch((e) => !stop && setError(e.message));
    load();
    const t = setInterval(load, new URLSearchParams(window.location.search).get("paid") === "1" ? 5000 : 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [token]);

  if (error && !order) return <Shell><p className="text-paper/70">{error}</p></Shell>;
  if (!order) return <Shell><p className="text-paper/60">Loading your order…</p></Shell>;

  const steps = STEPS[order.fulfillment] || STEPS.pickup;
  const cancelled = ["rejected", "cancelled"].includes(order.status);
  if (order.status === "awaiting_payment") {
    return (
      <Shell>
        <p className="eyebrow">Order {order.order_number}</p>
        <h1 className="section-title mt-2 text-4xl sm:text-5xl">Waiting for your payment</h1>
        <p className="lead mt-3">
          The store gets your order once you've paid {peso(order.total)}. If you just paid, this page updates in a few seconds.
        </p>
        {order.pay_url && <a href={order.pay_url} className="btn-solid mt-8">Pay now</a>}
        <p className="mt-6 text-sm text-paper/50">Unpaid orders are cancelled after about an hour.</p>
      </Shell>
    );
  }
  const at = steps.findIndex(([s]) => s === order.status);

  return (
    <Shell>
      <p className="eyebrow">Order {order.order_number}</p>
      <h1 className="section-title mt-2 text-4xl sm:text-5xl">{cancelled ? "Order cancelled" : steps[Math.max(0, at)][1]}</h1>
      <p className="lead mt-3">
        {cancelled ? order.status_note || "The store couldn't take this order." : steps[Math.max(0, at)][2]}
        {!cancelled && order.status_note ? ` ${order.status_note}` : ""}
      </p>

      {!cancelled && (
        <ol className="mt-8 grid grid-cols-4 gap-2">
          {steps.map(([s, label], i) => (
            <li key={s} className="text-center">
              <div className={`h-1.5 ${i <= at ? "bg-red-brand" : "bg-white/15"}`} />
              <span className={`mt-2 block text-xs ${i <= at ? "text-paper" : "text-paper/40"}`}>{label}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="card mt-10 p-5">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-cream">
          {order.fulfillment === "delivery" ? "Delivery from" : "Pickup at"} {order.store?.name}
        </p>
        <p className="mt-1 text-sm text-paper/60">{order.fulfillment === "delivery" ? order.address : order.store?.address}</p>
        <ul className="mt-5 space-y-3 border-t border-white/10 pt-5">
          {order.items.map((l, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="tabular-nums text-paper/60">{l.quantity}×</span>
              <span className="flex-1">
                {l.name}
                {[l.option, ...l.extras].filter(Boolean).length > 0 && <span className="block text-paper/50">{[l.option, ...l.extras].filter(Boolean).join(", ")}</span>}
                {l.note && <span className="block italic text-paper/50">“{l.note}”</span>}
              </span>
              <span className="tabular-nums">{peso(l.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-5 space-y-1 border-t border-white/10 pt-5 text-sm">
          <Row label="Subtotal" value={peso(order.subtotal)} />
          {order.fulfillment === "delivery" && <Row label="Delivery fee" value={peso(order.delivery_fee)} />}
          <Row label="Total" value={peso(order.total)} strong />
          <Row label="Payment" value={order.payment_method === "cod" ? "Cash on delivery / pickup" : order.payment_method === "maya" || order.payment_method === "maya_qr" ? (order.payment_status === "paid" ? (order.payment_method === "maya_qr" ? "Paid by QR Ph" : "Paid online") : "Online payment not completed") : order.payment_status === "paid" ? "GCash, confirmed" : "GCash, being checked"} />
        </dl>
      </div>
      <p className="mt-6 text-sm text-paper/50">This page updates by itself. Keep it open or bookmark it.</p>
      <Link to="/order" className="btn-outline mt-8">Order again</Link>
    </Shell>
  );
}

const Shell = ({ children }) => <section className="container-page max-w-2xl py-16">{children}</section>;

const Row = ({ label, value, strong }) => (
  <div className={`flex justify-between ${strong ? "font-display text-lg text-cream" : "text-paper/70"}`}>
    <dt>{label}</dt>
    <dd className="tabular-nums">{value}</dd>
  </div>
);
