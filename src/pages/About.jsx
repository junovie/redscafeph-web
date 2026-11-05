import SocialIcons from "@/components/SocialIcons";
import { EMAILS, SOCIALS } from "@/data/site";

export default function About() {
  return (
    <>
      <section className="grid md:grid-cols-2">
        <img src="/images/storefront-day.webp" alt="Red's Cafe storefront" className="h-96 w-full object-cover md:h-auto" />
        <div className="px-8 py-16 md:px-16 lg:px-20">
          <h1 className="section-title">Our Story</h1>
          <div className="mt-8 space-y-6 leading-relaxed text-neutral-200">
            <p>
              We opened a tiny cafe at Raintree Mall early 2023 by the end of covid era. A lot of establishments were closing one by one at the
              time while everyone else was moving on. Everything was a challenge on our first few months. Then came our first loyal customers.
              The Students. They were there from the beginning with their bags, books, laptops and all looking so excited and just genuinely
              happy being around us. We felt there was a need for a place where they can hang out, chill, and ultimately a place for them to
              study with no judgement and rolling eyes. A home. And slowly, this cafe shifted as we listened to their requests to make life
              easier within our walls. At some point we realized the need to expand as our community was growing. The community built itself,
              with students in mind and as our foundation, and we now call everyone "Redsidents".
            </p>
            <p>
              Fast forward, we are now on our third location and as our community has evolved, our vision has expanded. While our foundation
              will always be student-friendly, Red's has grown into a shared space for all. From early-risers grabbing their morning cup of
              coffee to professionals working through the afternoon, friends catching up, family gathering on a Sunday, or simply someone
              stopping in for hearty cooked meals. We see our tables filled with a diverse mix of people. We've evolved our space and menu to
              ensure that no matter what stage of life you're in, you'll always find a warm welcome at Red's and a seat at our table.
            </p>
          </div>
        </div>
      </section>
      <section className="grid md:grid-cols-2">
        <div className="px-8 py-16 md:order-1 md:px-16 lg:px-20">
          <h2 className="section-title">You can reach out and say hello @</h2>
          <ul className="mt-8 space-y-2">
            {EMAILS.map((e) => (
              <li key={e}>
                <a href={`mailto:${e}`} className="hover:text-red-brand">
                  {e}
                </a>
              </li>
            ))}
            {SOCIALS.map((s) => (
              <li key={s.name}>
                <a href={s.href} target="_blank" rel="noreferrer" className="hover:text-red-brand">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <SocialIcons className="mt-8" />
        </div>
        <img src="/images/storefront-night.webp" alt="Red's Cafe at night" loading="lazy" className="h-96 w-full object-cover md:order-2 md:h-auto" />
      </section>
    </>
  );
}
