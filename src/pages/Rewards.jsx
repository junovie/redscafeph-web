import PageHeader from "@/components/PageHeader";
import { PERKS_URL } from "@/data/site";
import { REWARDS } from "@/data/rewards";

export default function Rewards() {
  return (
    <>
      <PageHeader
        eyebrow="For Redsidents"
        title="Rewards"
        intro={<p>Every visit earns you points, Redsident. Trade them in at the counter for treats and Red's merch.</p>}
      >
        <a href={PERKS_URL} target="_blank" rel="noreferrer" className="btn-solid">
          Check my points
        </a>
      </PageHeader>
      <div className="container-page grid grid-cols-2 gap-4 py-16 sm:grid-cols-3 lg:grid-cols-4 md:py-20">
        {REWARDS.map((r) => (
          <div key={r.name} className="card">
            <img src={r.image} alt={r.name} loading="lazy" className="aspect-square w-full object-cover" />
            <div className="p-4">
              <span className="inline-block bg-red-brand px-2 py-0.5 font-display text-xs uppercase tracking-[0.15em] text-white">{r.points} pts</span>
              <p className="mt-3 font-display text-lg uppercase tracking-wide text-cream">{r.name}</p>
              <p className="mt-1 text-sm text-paper/60">{r.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
