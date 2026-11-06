import { Link } from "react-router-dom";
import Heading from "@/components/Heading";
import Locations from "@/components/Locations";
import { PERKS_URL } from "@/data/site";

function Feature({ eyebrow, title, body, cta, to, href, image, alt, flip }) {
  const Btn = href ? "a" : Link;
  const btnProps = href ? { href } : { to };
  return (
    <section className="grid md:grid-cols-2">
      <div className={`flex items-center px-6 py-16 md:px-16 lg:px-24 ${flip ? "md:order-2" : ""}`}>
        <div>
          <Heading eyebrow={eyebrow} title={title}>
            <p>{body}</p>
          </Heading>
          <Btn className="btn-outline mt-8" {...btnProps}>
            {cta}
          </Btn>
        </div>
      </div>
      <img src={image} alt={alt} loading="lazy" className={`h-80 w-full object-cover md:h-[38rem] ${flip ? "md:order-1" : ""}`} />
    </section>
  );
}

const STRIP = ["strip-1", "strip-2", "strip-3", "banner", "strip-5"];

export default function Home() {
  return (
    <>
      <section className="relative flex min-h-[85vh] items-end overflow-hidden">
        <img src="/images/hero.webp" alt="Two Red's Cafe coffees" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="container-page relative pb-20">
          <p className="eyebrow text-cream">Welcome to Red's</p>
          <h1 className="mt-2 font-display text-7xl font-semibold uppercase leading-none tracking-wide sm:text-8xl md:text-9xl">It's home</h1>
          <p className="lead mt-5 max-w-md">All-day breakfast, coffee and homemade pastries in Cebu. Open 7AM til 2AM daily.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/menu" className="btn-solid">
              View Menu
            </Link>
            <a href={PERKS_URL} target="_blank" rel="noreferrer" className="btn-outline">
              My Points
            </a>
          </div>
        </div>
      </section>

      <Feature
        eyebrow="Savor."
        title="Breakfast, lunch & treats"
        body="Breakfast, Lunch, and Delectable treats are the main characters of your stay."
        cta="Menu"
        to="/menu"
        image="/images/savor.webp"
        alt="Waffles with strawberry and blueberry and an iced drink"
      />
      <Feature
        flip
        eyebrow="Sip."
        title="Your favorite brew awaits"
        body="Whether you crave a robust espresso or a soothing tea, our drinks are carefully made with heart. Coffee you say?"
        cta="The Beverage Collection"
        to="/menu#drinks"
        image="/images/sip.webp"
        alt="Croissant dipped in a latte"
      />
      <Feature
        eyebrow="Connect"
        title="A home away from home"
        body="Red's is not just a place to dine, it's a place to share stories with friends and family and just let conversations flow. No we are not in any way a quiet cafe. Every Red's is full of laughter, voices, gossip, full of different emotions, full of life."
        cta="Come Visit Us"
        href="#locationshours"
        image="/images/connect.webp"
        alt="Friends laughing at Red's Cafe"
      />

      <Locations />

      <div className="grid grid-cols-2 sm:grid-cols-5">
        {STRIP.map((s, i) => (
          <img key={s} src={`/images/${s}.webp`} alt="" loading="lazy" className={`aspect-[3/4] w-full object-cover ${i === STRIP.length - 1 ? "hidden sm:block" : ""}`} />
        ))}
      </div>
    </>
  );
}
