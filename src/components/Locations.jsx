import { MapPin } from "lucide-react";
import Heading from "@/components/Heading";
import { LOCATIONS } from "@/data/site";

export default function Locations() {
  return (
    <section id="locationshours" className="container-page scroll-mt-24 py-20 md:py-28">
      <Heading center eyebrow="Visit us" title="Drop by the cafe sometime" />
      <div className="mt-14 grid gap-4 md:grid-cols-4">
        {LOCATIONS.map((l) => (
          <a key={l.name} href={l.map} target="_blank" rel="noreferrer" className="card group p-6 transition-colors hover:border-red-brand">
            <MapPin className="h-6 w-6 text-red-brand" />
            <p className="mt-4 font-display text-lg uppercase tracking-wide text-cream">{l.name}</p>
            <p className="mt-2 text-sm leading-relaxed text-paper/70">{l.where}</p>
            <p className="mt-4 font-display text-xs uppercase tracking-[0.2em] text-paper/50 group-hover:text-red-brand">Get directions</p>
          </a>
        ))}
        <div className="card flex flex-col justify-center bg-red-brand p-6 text-white">
          <p className="font-display text-xs uppercase tracking-[0.2em]">Open daily</p>
          <p className="mt-2 font-display text-4xl font-medium">7AM–2AM</p>
          <p className="mt-3 text-sm">Look for us in Grab too!</p>
        </div>
      </div>
    </section>
  );
}
