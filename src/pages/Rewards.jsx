import { PERKS_URL } from "@/data/site";
import { REWARDS } from "@/data/rewards";

export default function Rewards() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-2xl">
        <h1 className="font-logo text-5xl sm:text-6xl">Rewards</h1>
        <p className="mt-4 leading-relaxed text-neutral-300">
          Every visit earns you points, Redsident. Trade them in at the counter for treats and Red's merch.
        </p>
        <a href={PERKS_URL} target="_blank" rel="noreferrer" className="btn-solid mt-8">
          Check my points
        </a>
      </div>
      <div className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {REWARDS.map((r) => (
          <div key={r.name}>
            <img src={r.image} alt={r.name} loading="lazy" className="aspect-square w-full object-cover" />
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <p>{r.name}</p>
                <p className="text-sm text-neutral-400">{r.detail}</p>
              </div>
              <span className="shrink-0 bg-red-brand px-2 py-0.5 text-sm font-medium">{r.points} pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
