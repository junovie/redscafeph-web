import { Link } from "react-router-dom";
import Locations from "@/components/Locations";
import { PERKS_URL } from "@/data/site";

function Feature({ title, subtitle, body, cta, to, href, image, alt, flip }) {
  const Btn = href ? "a" : Link;
  const btnProps = href ? { href, target: "_blank", rel: "noreferrer" } : { to };
  return (
    <section className="grid md:grid-cols-2">
      <div className={`flex items-center px-8 py-16 md:px-16 lg:px-24 ${flip ? "md:order-2" : ""}`}>
        <div className="max-w-md">
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="mt-4 text-lg">{subtitle}</p>}
          <p className="mt-5 leading-relaxed text-neutral-200">{body}</p>
          <Btn className="btn-outline mt-8" {...btnProps}>
            {cta}
          </Btn>
        </div>
      </div>
      <img src={image} alt={alt} loading="lazy" className={`h-80 w-full object-cover md:h-[36rem] ${flip ? "md:order-1" : ""}`} />
    </section>
  );
}

const STRIP = ["strip-1", "strip-2", "strip-3", "banner", "strip-5"];

export default function Home() {
  return (
    <>
      <section className="relative flex min-h-[80vh] items-end overflow-hidden">
        <img src="/images/hero.webp" alt="Two Red's Cafe coffees" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl px-6 pb-16">
          <h1 className="font-logo text-6xl sm:text-7xl md:text-8xl">It's home</h1>
          <div className="mt-8 flex flex-wrap gap-4">
            <a href={PERKS_URL} target="_blank" rel="noreferrer" className="btn-outline">
              My Points
            </a>
            <Link to="/menu" className="btn-solid">
              View Menu
            </Link>
          </div>
        </div>
      </section>

      <Feature
        title="Savor."
        body="Breakfast, Lunch, and Delectable treats are the main characters of your stay."
        cta="Menu"
        to="/menu"
        image="/images/savor.webp"
        alt="Waffles with strawberry and blueberry and an iced drink"
      />
      <Feature
        flip
        title="Sip."
        subtitle="Your Favorite Brew Awaits"
        body="Whether you crave a robust espresso or a soothing tea, our drinks are carefully made with heart. Coffee you say?"
        cta="The Beverage Collection"
        to="/menu#drinks"
        image="/images/sip.webp"
        alt="Croissant dipped in a latte"
      />
      <Feature
        title="Connect"
        subtitle="A Home Away from Home"
        body="Red's is not just a place to dine, it's a place to share stories with friends and family and just let conversations flow. No we are not in any way a quiet cafe. Every Red's is full of laughter, voices, gossip, full of different emotions, full of life."
        cta="Come Visit Us"
        href="#locationshours"
        image="/images/connect.webp"
        alt="Friends laughing at Red's Cafe"
      />

      <Locations />

      <div className="grid grid-cols-2 sm:grid-cols-5">
        {STRIP.map((s) => (
          <img key={s} src={`/images/${s}.webp`} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
        ))}
      </div>
    </>
  );
}
