import { DRINK_SECTIONS, MENU } from "@/data/menu";

function Section({ section }) {
  return (
    <div className="break-inside-avoid pb-10">
      <h3 className="border-b-2 border-red-brand pb-1 font-heading text-xl uppercase tracking-[0.2em]">
        {section.title}
        {section.note && <span className="ml-3 align-middle font-sans text-xs normal-case tracking-normal text-neutral-300">{section.note}</span>}
      </h3>
      <ul className="mt-4 space-y-3">
        {section.items.map(([name, price, desc, tag]) => (
          <li key={name}>
            <div className="flex items-baseline gap-3">
              <span>
                {name}
                {tag && <span className="ml-2 text-xs italic text-red-brand">{tag}</span>}
              </span>
              <span className="flex-1 border-b border-dotted border-white/20" />
              <span className="font-medium tabular-nums">{price}</span>
            </div>
            {desc && <p className="mt-0.5 max-w-md text-sm text-neutral-400">{desc}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Group({ id, title, sections }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="section-title mb-10">{title}</h2>
      <div className="gap-14 md:columns-2">
        {sections.map((s) => (
          <Section key={s.title} section={s} />
        ))}
      </div>
    </section>
  );
}

export default function Menu() {
  const drinks = MENU.slice(0, DRINK_SECTIONS);
  const food = MENU.slice(DRINK_SECTIONS);
  const photos = food.filter((s) => s.image);
  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-logo text-5xl sm:text-6xl">Menu</h1>
          <p className="mt-3 text-neutral-300">Prices in pesos. Also in Grab! 15% discount for students.</p>
        </div>
        <nav className="flex gap-3">
          <a href="#food" className="btn-outline">Food</a>
          <a href="#drinks" className="btn-outline">Drinks</a>
        </nav>
      </div>

      <div className="mb-14 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {photos.map((s) => (
          <img key={s.title} src={s.image} alt={s.title} loading="lazy" className="aspect-square w-full object-cover" />
        ))}
      </div>

      <div className="space-y-16">
        <Group id="food" title="Food" sections={food} />
        <Group id="drinks" title="Drinks" sections={drinks} />
      </div>
    </div>
  );
}
