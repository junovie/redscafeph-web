import PageHeader from "@/components/PageHeader";
import { DRINK_SECTIONS, MENU } from "@/data/menu";

function Section({ section }) {
  return (
    <div className="break-inside-avoid pb-12">
      <h3 className="border-b border-red-brand/70 pb-2 font-display text-xl uppercase tracking-[0.2em] text-red-brand">
        {section.title}
        {section.note && <span className="ml-3 align-middle font-sans text-xs normal-case tracking-normal text-paper/60">{section.note}</span>}
      </h3>
      <ul className="mt-5 space-y-4">
        {section.items.map(([name, price, desc, tag]) => (
          <li key={name}>
            <div className="flex items-baseline gap-3">
              <span className="font-medium">
                {name}
                {tag && <span className="ml-2 font-script text-sm text-red-brand">{tag}</span>}
              </span>
              <span className="flex-1 border-b border-dotted border-white/20" />
              <span className="font-display tabular-nums text-cream">{price}</span>
            </div>
            {desc && <p className="mt-1 max-w-md text-sm text-paper/55">{desc}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Group({ id, eyebrow, title, sections }) {
  return (
    <section id={id} className="scroll-mt-24">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="section-title mb-12 mt-2">{title}</h2>
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
    <>
      <PageHeader eyebrow="Eat & drink" title="Menu" intro={<p>Prices in pesos. Also in Grab! 15% discount for students.</p>}>
        <a href="#food" className="btn-outline">
          Food
        </a>
        <a href="#drinks" className="btn-outline">
          Drinks
        </a>
      </PageHeader>

      <div className="grid grid-cols-3 lg:grid-cols-6">
        {photos.map((s) => (
          <img key={s.title} src={s.image} alt={s.title} loading="lazy" className="aspect-square w-full object-cover" />
        ))}
      </div>

      <div className="container-page space-y-20 py-16 md:py-24">
        <Group id="food" eyebrow="Savor." title="Food" sections={food} />
        <Group id="drinks" eyebrow="Sip." title="Drinks" sections={drinks} />
      </div>
    </>
  );
}
