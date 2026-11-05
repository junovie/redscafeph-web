import { MapPin } from "lucide-react";
import { HOURS, LOCATIONS } from "@/data/site";

export default function Locations() {
  return (
    <section id="locationshours" className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="section-title text-center">Drop by the cafe sometime</h2>
      <div className="mt-14 grid gap-12 md:grid-cols-2 md:divide-x md:divide-white/30">
        <div className="md:pr-12">
          <h3 className="mb-6 text-center font-logo text-2xl">We're at</h3>
          <ul className="space-y-6">
            {LOCATIONS.map((l) => (
              <li key={l.name}>
                <a href={l.map} target="_blank" rel="noreferrer" className="group flex gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-red-brand" />
                  <span>
                    <span className="font-medium group-hover:text-red-brand">{l.name}</span>
                    <span className="block text-sm text-neutral-300">{l.where}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-center md:pl-12">
          <h3 className="mb-6 font-logo text-2xl">Our Hours</h3>
          <p className="text-neutral-200">{HOURS}</p>
          <p className="mt-2 text-neutral-200">Look for us in Grab too!</p>
        </div>
      </div>
    </section>
  );
}
