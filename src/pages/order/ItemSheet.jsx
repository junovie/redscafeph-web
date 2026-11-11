import { useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { defaultChoices, linePrice, peso } from "@/lib/store";

export default function ItemSheet({ product, modifiers, onAdd, onClose }) {
  const [option, setOption] = useState(product.options[0] || null);
  const [chosen, setChosen] = useState(() => defaultChoices(modifiers));
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const unit = useMemo(() => linePrice(product, option, modifiers, chosen), [product, option, modifiers, chosen]);
  const missing = modifiers.find((m) => m.required && !(Array.isArray(chosen[m.id]) ? chosen[m.id].length : chosen[m.id]));

  const toggle = (m, label) =>
    setChosen((c) => {
      if (!m.multiple) return { ...c, [m.id]: c[m.id] === label && !m.required ? undefined : label };
      const cur = c[m.id] || [];
      return { ...c, [m.id]: cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label] };
    });

  const add = () => {
    const mods = Object.fromEntries(Object.entries(chosen).filter(([, v]) => (Array.isArray(v) ? v.length : v)));
    onAdd({
      product_id: product.id,
      name: product.name,
      recipe_id: option?.id || null,
      option_name: option?.name || null,
      modifiers: mods,
      labels: Object.values(mods).flat(),
      quantity: qty,
      unit_price: unit,
      note: note.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto bg-coal sm:border sm:border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-white/10 bg-coal p-5">
          <div>
            <h3 className="font-display text-2xl uppercase tracking-wide">{product.name}</h3>
            {product.description && <p className="mt-1 text-sm text-paper/60">{product.description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 p-1 text-paper/70 hover:text-paper">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-6 p-5">
          {product.options.length > 0 && (
            <Group title="Choose one" required>
              {product.options.map((o) => (
                <Choice key={o.id} active={option?.id === o.id} onClick={() => setOption(o)} label={o.name} price={product.price + o.price} />
              ))}
            </Group>
          )}
          {modifiers.map((m) => (
            <Group key={m.id} title={m.name} required={m.required} hint={m.multiple ? "Pick any" : "Pick one"}>
              {m.options.map((o) => {
                const active = m.multiple ? (chosen[m.id] || []).includes(o.label) : chosen[m.id] === o.label;
                return <Choice key={o.label} active={active} onClick={() => toggle(m, o.label)} label={o.label} extra={o.price} square={m.multiple} />;
              })}
            </Group>
          ))}
          <div>
            <label className="label" htmlFor="item-note">Note for the store</label>
            <input id="item-note" className="field" maxLength={120} placeholder="Optional, e.g. less ice" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center gap-4 border-t border-white/10 bg-coal p-5">
          <div className="flex items-center border border-white/15">
            <button className="p-3 disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Less">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center font-display text-lg tabular-nums">{qty}</span>
            <button className="p-3 disabled:opacity-40" onClick={() => setQty((q) => Math.min(50, q + 1))} disabled={qty >= 50} aria-label="More">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button className="btn-solid flex-1 px-4" onClick={add} disabled={!!missing}>
            {missing ? `Choose ${missing.name}` : `Add · ${peso(unit * qty)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ title, required, hint, children }) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h4 className="font-display text-sm uppercase tracking-[0.2em] text-cream">{title}</h4>
        <span className="text-xs text-paper/50">{required ? "Required" : hint || "Optional"}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Choice({ active, onClick, label, price, extra, square }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border px-4 py-3 text-left transition-colors ${active ? "border-red-brand bg-red-brand/10" : "border-white/10 hover:border-white/30"}`}
    >
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center border ${square ? "" : "rounded-full"} ${active ? "border-red-brand bg-red-brand" : "border-white/40"}`} />
      <span className="flex-1">{label}</span>
      {price != null && <span className="tabular-nums text-cream">{peso(price)}</span>}
      {extra ? <span className="tabular-nums text-paper/60">+{peso(extra)}</span> : null}
    </button>
  );
}
