import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, MapPin, Plus, ShoppingBag } from "lucide-react";
import { api, closedMessage, distanceKm, hoursLabel, peso, roundKm } from "@/lib/store";
import ItemSheet from "@/pages/order/ItemSheet";
import Checkout from "@/pages/order/Checkout";

const sameLine = (a, b) =>
  a.product_id === b.product_id && a.recipe_id === b.recipe_id && a.note === b.note && JSON.stringify(a.modifiers) === JSON.stringify(b.modifiers);

export default function Order() {
  const navigate = useNavigate();
  const [stores, setStores] = useState(null);
  const [config, setConfig] = useState({ cod_limit: 1000, road_factor: 1.25 });
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState("");
  const [storeId, setStoreId] = useState(() => localStorage.getItem("rc-store") || "");
  const [picked, setPicked] = useState(() => !!localStorage.getItem("rc-store"));
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [picker, setPicker] = useState(false);
  const [item, setItem] = useState(null);
  const [view, setView] = useState("menu");
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem("rc-cart") || "[]"));

  useEffect(() => {
    Promise.all([api("/api/store/stores"), api("/api/store/menu")])
      .then(([s, m]) => {
        setStores(s.stores);
        setConfig({ cod_limit: s.cod_limit, road_factor: s.road_factor });
        setMenu(m);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => localStorage.setItem("rc-cart", JSON.stringify(cart)), [cart]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);
  useEffect(requestLocation, [requestLocation]);

  const ranked = useMemo(() => {
    if (!stores) return [];
    return stores
      .map((s) => ({ ...s, km: location ? roundKm(distanceKm(location.lat, location.lng, s.latitude, s.longitude, config.road_factor)) : null }))
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  }, [stores, location, config.road_factor]);

  // Nearest open store, unless the customer picked one themselves.
  useEffect(() => {
    if (!ranked.length || (picked && ranked.some((s) => s.id === storeId))) return;
    const best = (ranked.find((s) => s.open) || ranked[0]).id;
    if (best !== storeId) setStoreId(best);
  }, [ranked, storeId, picked]);

  const store = ranked.find((s) => s.id === storeId);
  const soldOutIds = new Set(store?.sold_out || []);
  const blocked = cart.filter((l) => soldOutIds.has(l.product_id));
  const chooseStore = (id) => {
    localStorage.setItem("rc-store", id);
    setPicked(true);
    setStoreId(id);
    setPicker(false);
  };

  const modsFor = (p) => (menu?.modifiers || []).filter((m) => p.modifier_ids.includes(m.id));
  const add = (line) => {
    setCart((c) => {
      const same = c.find((l) => sameLine(l, line));
      if (same) return c.map((l) => (l === same ? { ...l, quantity: Math.min(50, l.quantity + line.quantity) } : l));
      return [...c, { ...line, key: crypto.randomUUID() }];
    });
    setItem(null);
  };
  const setQty = (key, q) => setCart((c) => (q < 1 ? c.filter((l) => l.key !== key) : c.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, q) } : l))));

  // Drop basket lines whose item left the menu.
  useEffect(() => {
    if (menu) setCart((c) => c.filter((l) => menu.products.some((p) => p.id === l.product_id)));
  }, [menu]);

  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const subtotal = cart.reduce((s, l) => s + l.unit_price * l.quantity, 0);

  if (error) return <section className="container-page py-16 text-paper/70">{error}</section>;
  if (!stores || !menu) return <section className="container-page py-16 text-paper/60">Loading the menu…</section>;
  if (!stores.length) return <section className="container-page py-16 text-paper/70">Online ordering isn't open yet. Please check back soon.</section>;

  if (view === "checkout" && store?.open && cart.length && !blocked.length) {
    return (
      <Checkout
        store={store}
        lines={cart}
        setQty={setQty}
        codLimit={config.cod_limit}
        roadFactor={config.road_factor}
        location={location}
        locating={locating}
        requestLocation={requestLocation}
        onBack={() => setView("menu")}
        onPlaced={(token, leaving) => {
          setCart([]);
          if (!leaving) navigate(`/order/${token}`);
        }}
      />
    );
  }

  const byCat = menu.categories.map((c) => ({ ...c, items: menu.products.filter((p) => p.category_id === c.id) })).filter((c) => c.items.length);

  return (
    <>
      <section className="border-b border-white/10 bg-coal">
        <div className="container-page py-6">
          <p className="eyebrow">Order online</p>
          <button onClick={() => setPicker(true)} className="mt-2 flex w-full items-center gap-3 text-left">
            <MapPin className="h-5 w-5 shrink-0 text-red-brand" />
            <span className="flex-1">
              <span className="block font-display text-2xl uppercase tracking-wide">{store?.name || "Pick a store"}</span>
              <span className="block text-sm text-paper/60">
                {store ? `${store.address}${store.km != null ? ` · ${store.km} km away` : ""}` : ""}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-sm text-cream">Change <ChevronDown className="h-4 w-4" /></span>
          </button>
          {store && !store.open && (
            <p className="mt-4 border border-red-brand/50 bg-red-brand/10 px-4 py-3 text-sm">
              {store.paused ? `${store.name} is busy and paused online orders for a bit.` : closedMessage(store)} You can still browse, or pick another store.
            </p>
          )}
          {!location && !locating && <p className="mt-3 text-xs text-paper/50">Turn on location to find the nearest store, or pick one yourself.</p>}
        </div>
      </section>

      <nav className="sticky top-[57px] z-30 border-b border-white/10 bg-ink/95 backdrop-blur">
        <div className="container-page flex gap-2 overflow-x-auto py-3">
          {byCat.map((c) => (
            <a key={c.id} href={`#cat-${c.id}`} className="shrink-0 border border-white/15 px-3 py-1.5 text-xs uppercase tracking-wider text-paper/80 hover:border-red-brand">
              {c.name}
            </a>
          ))}
        </div>
      </nav>

      <section className="container-page pb-32 pt-6">
        {byCat.map((c) => (
          <div key={c.id} id={`cat-${c.id}`} className="scroll-mt-32 pt-6">
            <h2 className="border-b border-red-brand/70 pb-2 font-display text-xl uppercase tracking-[0.2em] text-red-brand">{c.name}</h2>
            <ul className="grid gap-px bg-white/10 sm:grid-cols-2">
              {c.items.map((p) => (
                <li key={p.id} className="bg-ink">
                  <button className="flex w-full items-center gap-4 py-4 text-left disabled:opacity-50 sm:px-3" disabled={soldOutIds.has(p.id)} onClick={() => setItem(p)}>
                    {p.image_url && <img src={p.image_url} alt="" className="h-16 w-16 shrink-0 object-cover" loading="lazy" />}
                    <span className="flex-1">
                      <span className="block font-medium">{p.name}</span>
                      {p.description && <span className="mt-0.5 line-clamp-2 block text-sm text-paper/55">{p.description}</span>}
                      <span className="mt-1 block font-display tabular-nums text-cream">
                        {p.options.length ? `from ${peso(p.price + Math.min(...p.options.map((o) => o.price)))}` : peso(p.price + p.base_extra)}
                      </span>
                    </span>
                    {soldOutIds.has(p.id) ? (
                      <span className="shrink-0 text-xs uppercase tracking-wider text-paper/60">Sold out</span>
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-red-brand text-white"><Plus className="h-5 w-5" /></span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/95 p-4 backdrop-blur">
          {blocked.length > 0 && (
            <p className="mx-auto mb-3 flex max-w-2xl items-center justify-between gap-3 text-sm">
              <span>{[...new Set(blocked.map((l) => l.product_name || l.name))].join(", ")} sold out at {store?.name}.</span>
              <button className="shrink-0 underline" onClick={() => setCart((c) => c.filter((l) => !soldOutIds.has(l.product_id)))}>Remove</button>
            </p>
          )}
          <button className="btn-solid mx-auto flex w-full max-w-2xl justify-between gap-3 px-5" disabled={!store?.open || blocked.length > 0} onClick={() => setView("checkout")}>
            <span className="inline-flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> {count} item{count > 1 ? "s" : ""}</span>
            <span>{store?.open ? "View basket" : "Store closed"}</span>
            <span className="tabular-nums">{peso(subtotal)}</span>
          </button>
        </div>
      )}

      {item && <ItemSheet product={item} modifiers={modsFor(item)} onAdd={add} onClose={() => setItem(null)} />}

      {picker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={() => setPicker(false)}>
          <div className="w-full max-w-lg bg-coal p-5 sm:border sm:border-white/10" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl uppercase tracking-wide">Choose a store</h3>
            <ul className="mt-4 space-y-2">
              {ranked.map((s) => (
                <li key={s.id}>
                  <button onClick={() => chooseStore(s.id)} className={`w-full border px-4 py-3 text-left ${s.id === storeId ? "border-red-brand bg-red-brand/10" : "border-white/10 hover:border-white/30"}`}>
                    <span className="flex justify-between gap-3">
                      <span className="font-medium">{s.name}</span>
                      <span className={`text-xs ${s.open ? "text-green-400" : "text-paper/50"}`}>{s.open ? "Open" : s.paused ? "Busy, paused" : "Closed"}</span>
                    </span>
                    <span className="block text-sm text-paper/60">{s.address}</span>
                    <span className="block text-xs text-paper/50">{s.km != null ? `${s.km} km away · ` : ""}{hoursLabel(s)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
