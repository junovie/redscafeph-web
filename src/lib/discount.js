// Senior Citizen / PWD and Student discounts for online orders, shared by checkout and the worker.
// Each ID covers its holder's most expensive food and most expensive drink. Add-ons the POS marks as
// not discountable are left out of the discounted price, as at the counter.
export const ID_KINDS = { sc_pwd: "Senior Citizen / PWD", student: "Student" };
export const MAX_IDS = 6;
const round2 = (n) => Math.round(n * 100) / 100;

const eligible = (rule, line) =>
  !(rule.excluded_product_ids || []).includes(line.product_id) &&
  !(rule.excluded_category_ids || []).includes(line.category_id) &&
  (!(rule.applicable_category_ids || []).length || rule.applicable_category_ids.includes(line.category_id));

// lines: [{ product_id, category_id, kind: "food" | "drink" | null, quantity, discount_base }]
// Returns { lines: [{ qty, amount }] in the same order, total }.
export function idDiscount(lines, rule, ids) {
  const per = lines.map(() => ({ qty: 0, amount: 0 }));
  if (rule && ids > 0) {
    for (const kind of ["food", "drink"]) {
      const units = lines.flatMap((l, i) => (l.kind === kind && eligible(rule, l) ? Array.from({ length: l.quantity }, () => i) : []));
      units.sort((a, b) => lines[b].discount_base - lines[a].discount_base);
      for (const i of units.slice(0, ids)) {
        per[i].qty += 1;
        per[i].amount += (lines[i].discount_base * rule.percent) / 100;
      }
    }
  }
  const out = per.map((p) => ({ qty: p.qty, amount: round2(p.amount) }));
  return { lines: out, total: round2(out.reduce((s, p) => s + p.amount, 0)) };
}

// Unit price minus add-ons that don't get discounts. modifiers: [{ id, no_discount, options: [{ label, price }] }]
export function discountBase(unitPrice, chosen, modifiers) {
  let base = unitPrice;
  for (const m of modifiers) {
    if (!m.no_discount) continue;
    const picked = chosen?.[m.id];
    for (const l of Array.isArray(picked) ? picked : picked ? [picked] : []) base -= Math.max(0, m.options.find((o) => o.label === l)?.price || 0);
  }
  return round2(Math.max(0, base));
}
