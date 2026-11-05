import { Star } from "lucide-react";
import { LOCATIONS } from "@/data/site";

export default function Reviews() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <h1 className="font-logo text-5xl sm:text-6xl">Tell us anything</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-neutral-300">
        Loved your stay, or think we can do better? Leave us a review. We read every one.
      </p>
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <a
          href="https://www.facebook.com/redscafeph/reviews"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-4 border border-white/20 p-6 transition-colors hover:border-red-brand"
        >
          <Star className="h-8 w-8 text-red-brand" />
          <span>
            <span className="block text-lg">Review us on Facebook</span>
            <span className="text-sm text-neutral-400">facebook.com/redscafeph</span>
          </span>
        </a>
        {LOCATIONS.map((l) => (
          <a
            key={l.name}
            href={l.map}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 border border-white/20 p-6 transition-colors hover:border-red-brand"
          >
            <Star className="h-8 w-8 text-red-brand" />
            <span>
              <span className="block text-lg">Review {l.name} on Google</span>
              <span className="text-sm text-neutral-400">{l.where}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
